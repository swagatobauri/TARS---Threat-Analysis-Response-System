import ipaddress
import json
import logging
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from enum import Enum
from typing import Optional

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.database import AsyncSessionLocal, SyncSessionLocal
from app.db.models import AllowlistEntry, ShadowDecision, HumanApprovalQueue
from app.core.event_bus import get_redis_client

logger = logging.getLogger(__name__)

class ExecutionMode(str, Enum):
    SHADOW = "SHADOW"
    HUMAN_APPROVAL = "HUMAN_APPROVAL"
    AUTONOMOUS = "AUTONOMOUS"

@dataclass
class GateResult:
    allowed: bool
    mode: ExecutionMode
    reason: str
    shadow_decision_id: Optional[str] = None
    approval_queue_id: Optional[str] = None

class AllowlistChecker:
    def __init__(self):
        self.redis = get_redis_client()
        self.cache_key = "tars:allowlist:cache"
        self.ttl = 300  # 5 minutes

    def is_trusted(self, ip: str, session: Session) -> bool:
        # Check env trusted IPs
        if ip in settings.TRUSTED_IPS:
            return True
            
        try:
            ip_obj = ipaddress.ip_address(ip)
        except ValueError:
            logger.error("Invalid IP address: %s", ip)
            return False

        # Load from cache
        cached_data = self.redis.get(self.cache_key)
        if cached_data:
            allowlist = json.loads(cached_data)
        else:
            # Load from DB
            entries = session.execute(
                select(AllowlistEntry).where(AllowlistEntry.is_active == True)
            ).scalars().all()
            
            allowlist = {
                "ips": [e.value for e in entries if e.entry_type == "IP"],
                "cidrs": [e.value for e in entries if e.entry_type == "CIDR"]
            }
            self.redis.setex(self.cache_key, self.ttl, json.dumps(allowlist))

        if ip in allowlist.get("ips", []):
            return True

        for cidr in allowlist.get("cidrs", []):
            try:
                network = ipaddress.ip_network(cidr, strict=False)
                if ip_obj in network:
                    return True
            except ValueError:
                continue

        return False

class ShadowLogger:
    def record_shadow_decision(
        self, session: Session, ip: str, score: float, risk: str, action: str, reasoning: str
    ) -> ShadowDecision:
        decision = ShadowDecision(
            source_ip=ip,
            anomaly_score=score,
            risk_level=risk,
            would_have_taken_action=action,
            reasoning_summary=reasoning
        )
        session.add(decision)
        session.commit()
        session.refresh(decision)
        return decision

    def get_shadow_summary(self, session: Session, days: int = 7) -> dict:
        since = datetime.now(timezone.utc) - timedelta(days=days)
        decisions = session.execute(
            select(ShadowDecision).where(ShadowDecision.timestamp >= since)
        ).scalars().all()
        
        total_block = sum(1 for d in decisions if d.would_have_taken_action == "BLOCK")
        total_alert = sum(1 for d in decisions if d.would_have_taken_action == "ALERT")
        
        from collections import Counter
        ips = Counter(d.source_ip for d in decisions).most_common(10)
        
        return {
            "total_would_block": total_block,
            "total_would_alert": total_alert,
            "top_ips": [{"ip": ip, "count": count} for ip, count in ips]
        }

class ConfidenceGate:
    def __init__(self):
        self.allowlist_checker = AllowlistChecker()
        self.shadow_logger = ShadowLogger()

    def can_execute(
        self, session: Session, source_ip: str, action: str, confidence: float, reasoning: str, risk: str, score: float, event_id: str
    ) -> GateResult:
        """
        Evaluate if an action is allowed to execute based on safety rules.
        Runs synchronously as it's part of the Celery pipeline logic.
        """
        # Rule a: Allowlist
        if self.allowlist_checker.is_trusted(source_ip, session):
            logger.info("Gate DENY: %s in allowlist", source_ip)
            return GateResult(
                allowed=False, mode=ExecutionMode.AUTONOMOUS, reason="IP in allowlist"
            )

        # Rule b: Shadow Mode
        if settings.SHADOW_MODE:
            logger.info("Gate SHADOW: would execute %s on %s", action, source_ip)
            shadow_dec = self.shadow_logger.record_shadow_decision(
                session, source_ip, score, risk, action, reasoning
            )
            return GateResult(
                allowed=False, mode=ExecutionMode.SHADOW, reason="Shadow mode enabled",
                shadow_decision_id=str(shadow_dec.id)
            )

        # Rule c: Human Approval Mode
        if settings.HUMAN_APPROVAL_MODE and action in ["BLOCK", "RATE_LIMIT"]:
            logger.info("Gate QUEUE: human approval required for %s on %s", action, source_ip)
            queue_item = HumanApprovalQueue(
                threat_event_id=event_id,
                proposed_action=action,
                confidence_score=confidence,
                reasoning_summary=reasoning,
                expires_at=datetime.now(timezone.utc) + timedelta(hours=24)
            )
            session.add(queue_item)
            session.commit()
            return GateResult(
                allowed=False, mode=ExecutionMode.HUMAN_APPROVAL, reason="Queued for human approval",
                approval_queue_id=str(queue_item.id)
            )

        # Rule d: High Confidence -> ALLOW
        if confidence >= settings.HIGH_CONFIDENCE_THRESHOLD:
            return GateResult(
                allowed=True, mode=ExecutionMode.AUTONOMOUS, reason="High confidence autonomous action"
            )

        # Rule e: Medium Confidence -> ALERT only
        if confidence >= settings.MEDIUM_CONFIDENCE_THRESHOLD:
            logger.info("Gate DOWNGRADE: Confidence %.2f downgraded to ALERT", confidence)
            return GateResult(
                allowed=False, mode=ExecutionMode.AUTONOMOUS, reason="Medium confidence downgraded to ALERT"
            )

        # Rule f: Low Confidence -> MONITOR only
        logger.info("Gate DOWNGRADE: Confidence %.2f downgraded to MONITOR", confidence)
        return GateResult(
            allowed=False, mode=ExecutionMode.AUTONOMOUS, reason="Low confidence downgraded to MONITOR"
        )
