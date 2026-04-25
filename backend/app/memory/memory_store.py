"""
Memory Module for AIRS.
Provides stateful intelligence across time by tracking IP behaviour profiles,
remembering past decisions, detecting long-term patterns, and allowing
retrospective attack replay.
"""

import json
import logging
import os
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any

import redis
from sqlalchemy import select
from sqlalchemy.orm import joinedload

from app.core.config import settings
from app.db.database import SyncSessionLocal
from app.db.models import ThreatEvent, NetworkLog, AnomalyScore, ActionLog

logger = logging.getLogger(__name__)

IP_MEMORY_TTL = 30 * 24 * 60 * 60  # 30 days


# ============================================================
# IP Profile Dataclass
# ============================================================

@dataclass
class IPProfile:
    ip_address: str
    first_seen: str
    last_seen: str
    total_events: int
    attack_events: int
    false_positives: int
    reputation_score: float
    risk_category: str
    attack_timeline: List[Dict[str, Any]] = field(default_factory=list)
    geo_hint: Optional[str] = None


# ============================================================
# Memory Store
# ============================================================

class MemoryStore:
    """
    Hybrid memory store:
    - Redis for fast, 30-day rolling IP memory and event timelines.
    - PostgreSQL for permanent decision memory (used for case-based reasoning).
    """

    def __init__(self, redis_url: str = None):
        url = redis_url or settings.REDIS_URL
        self.redis = redis.from_url(url, decode_responses=True)

    def _get_key(self, ip: str) -> str:
        return f"tars:memory:ip:{ip}:timeline"

    # --- IP Memory (Redis) ---

    def record_event(self, ip: str, event: dict):
        """Append an event dict to the IP's timeline and refresh TTL."""
        key = self._get_key(ip)
        event.setdefault("timestamp", datetime.utcnow().isoformat())
        self.redis.rpush(key, json.dumps(event))
        self.redis.expire(key, IP_MEMORY_TTL)

    def _get_timeline(self, ip: str) -> List[dict]:
        key = self._get_key(ip)
        raw_events = self.redis.lrange(key, 0, -1)
        return [json.loads(e) for e in raw_events]

    def get_ip_profile(self, ip: str) -> IPProfile:
        """Aggregate the Redis timeline into a structured profile."""
        timeline = self._get_timeline(ip)
        if not timeline:
            return IPProfile(
                ip_address=ip, first_seen=datetime.utcnow().isoformat(),
                last_seen=datetime.utcnow().isoformat(), total_events=0,
                attack_events=0, false_positives=0, reputation_score=0.0,
                risk_category="UNKNOWN"
            )

        timestamps = [datetime.fromisoformat(e["timestamp"]) for e in timeline if "timestamp" in e]
        first_seen = min(timestamps).isoformat() if timestamps else datetime.utcnow().isoformat()
        last_seen = max(timestamps).isoformat() if timestamps else datetime.utcnow().isoformat()

        attack_events = sum(1 for e in timeline if e.get("type") == "ATTACK" or e.get("score", 0) > 0.3)
        false_positives = sum(1 for e in timeline if e.get("outcome") == "FALSE_POSITIVE")
        rep_score = self.compute_reputation_score(ip)

        if rep_score > 0.8:
            risk_cat = "CRITICAL"
        elif rep_score > 0.6:
            risk_cat = "HIGH"
        elif rep_score > 0.3:
            risk_cat = "MEDIUM"
        else:
            risk_cat = "LOW"

        return IPProfile(
            ip_address=ip,
            first_seen=first_seen,
            last_seen=last_seen,
            total_events=len(timeline),
            attack_events=attack_events,
            false_positives=false_positives,
            reputation_score=round(rep_score, 4),
            risk_category=risk_cat,
            attack_timeline=timeline[-20:],  # attach only the last 20 for brevity
        )

    def compute_reputation_score(self, ip: str) -> float:
        """
        Calculates a stateful reputation score (0 to 1).
        Weights:
          - attack_frequency (7d): 0.4
          - severity_avg: 0.3
          - recency: 0.2
          - false_positive_rate: -0.1 (exoneration)
        """
        timeline = self._get_timeline(ip)
        if not timeline:
            return 0.0

        now = datetime.utcnow()
        recent_events = []
        for e in timeline:
            if "timestamp" in e:
                try:
                    ts = datetime.fromisoformat(e["timestamp"])
                    if now - ts <= timedelta(days=7):
                        recent_events.append(e)
                except ValueError:
                    pass

        # Frequency: cap at 50 events = max score
        attack_frequency = min(len(recent_events) / 50.0, 1.0)

        if recent_events:
            valid_scores = [e.get("score") for e in recent_events if isinstance(e.get("score"), (int, float))]
            severity_avg = sum(valid_scores) / len(valid_scores) if valid_scores else 0.0

            timestamps = [datetime.fromisoformat(e["timestamp"]) for e in recent_events if "timestamp" in e]
            latest_ts = max(timestamps) if timestamps else now
            days_ago = (now - latest_ts).days
            recency_score = max(0.0, 1.0 - (days_ago / 7.0))
        else:
            severity_avg = 0.0
            recency_score = 0.0

        fp_count = sum(1 for e in timeline if e.get("outcome") == "FALSE_POSITIVE")
        fp_rate = min(fp_count / max(len(timeline), 1), 1.0)

        score = (attack_frequency * 0.4) + (severity_avg * 0.3) + (recency_score * 0.2) - (fp_rate * 0.1)
        return float(max(0.0, min(score, 1.0)))

    # --- Decision Memory (PostgreSQL) ---

    def record_decision(self, ip: str, action: str, outcome: str):
        """Append the outcome of a decision to the Redis timeline for quick reputation updates."""
        self.record_event(ip, {
            "type": "DECISION_OUTCOME",
            "action": action,
            "outcome": outcome,
        })

    def get_similar_cases(self, anomaly_score: float, risk_level: str) -> List[dict]:
        """
        Case-based reasoning: look up past ThreatEvents that had a similar anomaly score
        to see what actions were taken and if they were successful.
        """
        session = SyncSessionLocal()
        try:
            # We want to find ThreatEvents whose parent AnomalyScore is within +/- 0.05
            # Since AnomalyScore is not directly linked to ThreatEvent via FK, we filter by
            # ThreatEvent confidence (which is usually copied from combined_score).
            lower_bound = max(0.0, anomaly_score - 0.05)
            upper_bound = min(1.0, anomaly_score + 0.05)

            query = (
                select(ThreatEvent)
                .where(ThreatEvent.confidence_score >= lower_bound)
                .where(ThreatEvent.confidence_score <= upper_bound)
                .order_by(ThreatEvent.created_at.desc())
                .limit(5)
            )

            results = session.execute(query).scalars().all()
            cases = []
            for t in results:
                # Did an analyst mark it resolved as a false positive? (extracted from agent_reasoning or outcome)
                was_fp = "FALSE_POSITIVE" in (t.agent_reasoning or "")
                cases.append({
                    "threat_event_id": str(t.id),
                    "action_taken": t.action_taken,
                    "confidence": t.confidence_score,
                    "was_false_positive": was_fp
                })
            return cases
        finally:
            session.close()

    # --- Pattern Memory ---

    def detect_attack_pattern(self, ip_history: List[dict]) -> Optional[str]:
        """
        Looks at the IP's event timeline to identify multi-step attack patterns
        using sliding window analysis.
        """
        if len(ip_history) < 5:
            return None

        # Sort chronologically just in case
        valid_events = [e for e in ip_history if "timestamp" in e]
        valid_events.sort(key=lambda x: datetime.fromisoformat(x["timestamp"]))

        # Check for Port Scan: rapid succession, low severity, but high volume
        # (Assuming events might contain 'dest_port' if we log network details here)
        ports = set(e.get("dest_port") for e in valid_events if e.get("dest_port"))
        if len(ports) > 10 and len(valid_events) >= 10:
            return "port_scan"

        # Check for Slow Burn: consistent low-severity hits over a long period
        scores = [e.get("score", 0) for e in valid_events]
        if len(scores) >= 20 and all(s < 0.4 for s in scores[-20:]):
            first_ts = datetime.fromisoformat(valid_events[-20]["timestamp"])
            last_ts = datetime.fromisoformat(valid_events[-1]["timestamp"])
            if (last_ts - first_ts).total_seconds() > 3600:
                return "slow_burn"

        # Check for DDoS Buildup: accelerating event frequency
        if len(valid_events) >= 10:
            recent_chunk = valid_events[-5:]
            older_chunk = valid_events[-10:-5]
            
            recent_delta = (datetime.fromisoformat(recent_chunk[-1]["timestamp"]) - datetime.fromisoformat(recent_chunk[0]["timestamp"])).total_seconds()
            older_delta = (datetime.fromisoformat(older_chunk[-1]["timestamp"]) - datetime.fromisoformat(older_chunk[0]["timestamp"])).total_seconds()
            
            # If recent 5 events happened 3x faster than the 5 before them
            if recent_delta > 0 and older_delta > 0 and (older_delta / recent_delta) > 3:
                return "ddos_buildup"

        return None


# ============================================================
# Attack Replay System
# ============================================================

@dataclass
class ReplayResult:
    scenario_id: str
    would_detect: bool
    detection_latency_ms: float
    action_taken: Optional[str]
    new_confidence: float


class AttackReplaySystem:
    """
    Saves context snapshots of historical threats so they can be re-run
    through updated ML models to test detection efficacy and regression.
    """

    def __init__(self, storage_dir: str = "data/scenarios"):
        self.storage_dir = storage_dir
        os.makedirs(storage_dir, exist_ok=True)

    def store_attack_scenario(self, threat_event_id: str) -> Optional[str]:
        """Fetch all DB context related to a threat and dump it to a JSON scenario file."""
        session = SyncSessionLocal()
        try:
            threat = session.get(ThreatEvent, threat_event_id)
            if not threat:
                logger.error("ThreatEvent %s not found", threat_event_id)
                return None

            # We need to find the NetworkLog that caused this.
            # In a strict schema, ThreatEvent should point to AnomalyScore or NetworkLog.
            # For AIRS, we'll fetch the most recent AnomalyScore for this IP just before the threat.
            log_query = (
                select(NetworkLog)
                .where(NetworkLog.source_ip == threat.source_ip)
                .where(NetworkLog.timestamp <= threat.created_at)
                .order_by(NetworkLog.timestamp.desc())
                .limit(1)
            )
            net_log = session.execute(log_query).scalar_one_or_none()

            scenario = {
                "scenario_id": f"sc_{threat.id}",
                "original_threat_id": str(threat.id),
                "source_ip": threat.source_ip,
                "original_action": threat.action_taken,
                "original_confidence": threat.confidence_score,
                "timestamp": threat.created_at.isoformat(),
                "network_log": {
                    "request_rate": net_log.request_rate,
                    "dest_port": net_log.dest_port,
                    "src_port": net_log.src_port,
                    "bytes_sent": net_log.bytes_sent,
                    "duration_seconds": net_log.duration_seconds,
                    "packets": net_log.packets,
                    "protocol": net_log.protocol,
                } if net_log else {}
            }

            file_path = os.path.join(self.storage_dir, f"{scenario['scenario_id']}.json")
            with open(file_path, "w") as f:
                json.dump(scenario, f, indent=2)

            logger.info("Saved attack scenario to %s", file_path)
            return scenario["scenario_id"]

        finally:
            session.close()

    def list_scenarios(self) -> List[str]:
        if not os.path.exists(self.storage_dir):
            return []
        return [f.replace(".json", "") for f in os.listdir(self.storage_dir) if f.endswith(".json")]

    def replay_scenario(self, scenario_id: str, model_version: str = "latest") -> ReplayResult:
        """
        Load the JSON, pass the log through the current ML Ensemble,
        and see what it decides now.
        """
        import time
        from app.ml.models import EnsembleDetector

        file_path = os.path.join(self.storage_dir, f"{scenario_id}.json")
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"Scenario {scenario_id} not found")

        with open(file_path, "r") as f:
            scenario = json.load(f)

        log_data = scenario.get("network_log", {})
        
        # Load models
        detector = EnsembleDetector()
        # In a real app, model_version would dictate which dir to load from
        detector.load_all(settings.MODEL_PATH)

        start_t = time.perf_counter()
        
        # Pass empty history for replay since history is hard to mock perfectly 
        # without dumping the full Redis state at that exact moment.
        result = detector.analyze(log_data, ip_history=[])
        
        latency = (time.perf_counter() - start_t) * 1000

        # Simulate agent reasoning if it was flagged
        action_taken = None
        if result.is_anomaly:
            from app.agent.reasoning import ReasoningEngine, AgentContext
            
            # Create a mock IP reputation that mimics the scenario's outcome roughly
            from app.db.models import IPReputation
            mock_rep = IPReputation(threat_count=1)
            
            ctx = AgentContext(
                anomaly_score=result.combined_score,
                risk_level=result.risk_level,
                source_ip=scenario.get("source_ip", "0.0.0.0"),
                ip_history=mock_rep,
                recent_decisions=[],
                time_of_day=12,
                attack_type_guess=None,
                confidence=result.confidence
            )
            
            engine = ReasoningEngine()
            decision = engine.decide(ctx)
            action_taken = decision.action.db_value

        return ReplayResult(
            scenario_id=scenario_id,
            would_detect=result.is_anomaly,
            detection_latency_ms=round(latency, 2),
            action_taken=action_taken,
            new_confidence=result.confidence
        )
