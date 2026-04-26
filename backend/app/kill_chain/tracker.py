import json
import logging
import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from enum import Enum
from typing import List, Optional

from celery import shared_task
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.database import SyncSessionLocal
from app.db.models import AttackerProfile, NetworkLog, ThreatEvent, KillChainEvent
from app.core.event_bus import get_redis_client, publish_event

logger = logging.getLogger(__name__)

class KillChainStage(str, Enum):
    RECONNAISSANCE = "RECONNAISSANCE"
    ENUMERATION = "ENUMERATION"
    EXPLOITATION = "EXPLOITATION"
    PERSISTENCE = "PERSISTENCE"

@dataclass
class StageClassification:
    stage: Optional[KillChainStage]
    confidence: float
    signals_matched: List[str]

class StageClassifier:
    def classify_stage(self, log: NetworkLog, history: List[NetworkLog]) -> StageClassification:
        # A simple heuristic-based implementation
        features = log.raw_payload or {}
        
        # Reconnaissance signals
        recon_signals = []
        if (log.request_rate and log.request_rate > 100) or features.get("port_entropy", 0) > 0.8:
            recon_signals.append("high_connection_rate_to_many_ports")
        if getattr(log, 'protocol', '') == 'ICMP':
            recon_signals.append("ping_sweep")
            
        # Enumeration signals
        enum_signals = []
        if log.dest_port in [80, 443]:
            if log.request_rate and log.request_rate > 50:
                enum_signals.append("endpoint_probing")
            ua = log.user_agent or ""
            if "dirbuster" in ua.lower() or "nmap" in ua.lower():
                enum_signals.append("scanner_agent")
                
        # Exploitation signals
        exploit_signals = []
        if features.get("sqli_pattern"):
            exploit_signals.append("sqli_pattern")
        if features.get("failed_logins", 0) > 10:
            exploit_signals.append("brute_force_login")
            
        # Persistence signals
        persist_signals = []
        if log.duration_seconds and log.duration_seconds > 3600 and (log.bytes_sent or 0) < 1000:
            persist_signals.append("long_session_low_rate")
        if features.get("repeated_beaconing"):
            persist_signals.append("repeated_beaconing")

        # Select stage based on matched signals
        if persist_signals:
            return StageClassification(KillChainStage.PERSISTENCE, 0.9, persist_signals)
        elif exploit_signals:
            return StageClassification(KillChainStage.EXPLOITATION, 0.85, exploit_signals)
        elif enum_signals:
            return StageClassification(KillChainStage.ENUMERATION, 0.75, enum_signals)
        elif recon_signals:
            return StageClassification(KillChainStage.RECONNAISSANCE, 0.65, recon_signals)
            
        return StageClassification(None, 0.0, [])

class KillChainTracker:
    def record_event(self, session: Session, source_ip: str, stage: KillChainStage, confidence: float, threat_event_id: str) -> AttackerProfile:
        profile = session.get(AttackerProfile, source_ip)
        now_str = datetime.now(timezone.utc).isoformat()
        
        event_dict = {
            "stage": stage.value,
            "confidence": confidence,
            "threat_event_id": threat_event_id,
            "timestamp": now_str
        }

        if not profile:
            profile = AttackerProfile(
                source_ip=source_ip,
                first_stage_seen=stage.value,
                current_stage=stage.value,
                stage_history=[event_dict],
                is_active=True,
                last_activity=datetime.now(timezone.utc)
            )
            session.add(profile)
        else:
            profile.current_stage = stage.value
            profile.is_active = True
            profile.last_activity = datetime.now(timezone.utc)
            # SQLAlchemy JSON arrays need re-assignment to detect changes
            new_history = list(profile.stage_history)
            new_history.append(event_dict)
            profile.stage_history = new_history

        # Predict next stage
        profile.predicted_next_action = self.predict_next_stage(profile)
        
        session.commit()
        session.refresh(profile)
        
        publish_event("kill_chain_advanced", {
            "ip": source_ip,
            "stage": profile.current_stage,
            "predicted_next": profile.predicted_next_action
        })
        
        return profile

    def predict_next_stage(self, profile: AttackerProfile) -> Optional[str]:
        stage = profile.current_stage
        
        # Progression map
        if stage == KillChainStage.RECONNAISSANCE.value:
            return KillChainStage.ENUMERATION.value
        elif stage == KillChainStage.ENUMERATION.value:
            return KillChainStage.EXPLOITATION.value
        elif stage == KillChainStage.EXPLOITATION.value:
            return KillChainStage.PERSISTENCE.value
        return None

    def get_active_attackers(self, session: Session) -> List[AttackerProfile]:
        return session.execute(
            select(AttackerProfile).where(AttackerProfile.is_active == True)
        ).scalars().all()

    def is_progressing(self, profile: AttackerProfile) -> bool:
        if not profile or len(profile.stage_history) < 2:
            return False
            
        history = profile.stage_history
        last_event = history[-1]
        prev_event = history[-2]
        
        # Basic check: changed stage within the last hour
        stages = [s.value for s in KillChainStage]
        try:
            last_idx = stages.index(last_event["stage"])
            prev_idx = stages.index(prev_event["stage"])
            
            if last_idx > prev_idx:
                last_ts = datetime.fromisoformat(last_event["timestamp"])
                prev_ts = datetime.fromisoformat(prev_event["timestamp"])
                if (last_ts - prev_ts).total_seconds() <= 3600:
                    return True
        except (ValueError, KeyError):
            pass
            
        return False

@shared_task(bind=True, name="tasks.update_attacker_profiles")
def update_attacker_profiles(self):
    session = SyncSessionLocal()
    try:
        tracker = KillChainTracker()
        active_profiles = tracker.get_active_attackers(session)
        now = datetime.now(timezone.utc)
        
        count_expired = 0
        count_progressing = 0
        
        for profile in active_profiles:
            # Expire if no activity for 2 hours
            if (now - profile.last_activity) > timedelta(hours=2):
                profile.is_active = False
                count_expired += 1
                logger.info("AttackerProfile for %s marked inactive.", profile.source_ip)
                continue
                
            # Check for progressing attackers to emit alerts
            if tracker.is_progressing(profile):
                publish_event("attacker_progressing", {
                    "ip": profile.source_ip,
                    "current_stage": profile.current_stage
                })
                count_progressing += 1
                
        session.commit()
        return {"expired": count_expired, "progressing": count_progressing}
    except Exception as exc:
        logger.exception("Failed to update attacker profiles")
        session.rollback()
        raise self.retry(exc=exc)
    finally:
        session.close()
