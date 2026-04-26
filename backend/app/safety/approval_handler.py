import logging
import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

from celery import shared_task
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.database import SyncSessionLocal
from app.db.models import HumanApprovalQueue, ThreatEvent
from app.core.event_bus import publish_event

logger = logging.getLogger(__name__)

@dataclass
class ApprovalResult:
    success: bool
    status: str
    action_executed: bool

class HumanApprovalHandler:
    def submit_for_approval(
        self, session: Session, threat_event_id: str, proposed_action: str, confidence: float, reasoning: str
    ) -> HumanApprovalQueue:
        queue_entry = HumanApprovalQueue(
            threat_event_id=uuid.UUID(threat_event_id),
            proposed_action=proposed_action,
            confidence_score=confidence,
            reasoning_summary=reasoning,
            status="PENDING",
            expires_at=datetime.now(timezone.utc) + timedelta(minutes=5)
        )
        session.add(queue_entry)
        session.commit()
        session.refresh(queue_entry)
        
        # Emit SSE event to dashboard
        publish_event("approval_requested", {
            "queue_id": str(queue_entry.id),
            "threat_event_id": threat_event_id,
            "proposed_action": proposed_action,
            "expires_at": queue_entry.expires_at.isoformat()
        })
        
        logger.info("Submitted %s action for threat %s to human approval queue.", proposed_action, threat_event_id)
        return queue_entry

    def process_approval(self, session: Session, queue_id: str, approved: bool, reviewer: str) -> ApprovalResult:
        queue_uuid = uuid.UUID(queue_id)
        entry = session.get(HumanApprovalQueue, queue_uuid)
        
        if not entry:
            return ApprovalResult(success=False, status="NOT_FOUND", action_executed=False)
            
        if entry.status != "PENDING":
            return ApprovalResult(success=False, status=entry.status, action_executed=False)
            
        entry.reviewed_by = reviewer
        entry.reviewed_at = datetime.now(timezone.utc)
        
        threat_event = session.get(ThreatEvent, entry.threat_event_id)
        action_executed = False

        if approved:
            entry.status = "APPROVED"
            if threat_event:
                threat_event.action_taken = entry.proposed_action
            
            # Execute original action
            logger.info("Human %s approved action %s. Executing...", reviewer, entry.proposed_action)
            from app.tasks.response import execute_response
            execute_response.delay(str(entry.threat_event_id))
            action_executed = True
        else:
            entry.status = "REJECTED"
            if threat_event:
                # Assuming human_reviewed column exists or using resolved
                threat_event.resolved = True
            logger.info("Human %s rejected action %s.", reviewer, entry.proposed_action)
            
        session.commit()
        
        publish_event("approval_processed", {
            "queue_id": queue_id,
            "status": entry.status,
            "reviewer": reviewer
        })
        
        return ApprovalResult(success=True, status=entry.status, action_executed=action_executed)

@shared_task(bind=True, name="tasks.expire_pending_approvals")
def expire_pending_approvals(self):
    """
    Celery beat task to expire pending approvals and downgrade them to ALERT-only.
    """
    session = SyncSessionLocal()
    try:
        now = datetime.now(timezone.utc)
        expired_entries = session.execute(
            select(HumanApprovalQueue).where(
                HumanApprovalQueue.status == "PENDING",
                HumanApprovalQueue.expires_at <= now
            )
        ).scalars().all()
        
        if not expired_entries:
            return {"expired_count": 0}
            
        count = 0
        for entry in expired_entries:
            entry.status = "EXPIRED"
            threat_event = session.get(ThreatEvent, entry.threat_event_id)
            if threat_event:
                threat_event.action_taken = "ALERT"
                
            logger.info("Approval queue %s expired. Downgrading to ALERT.", entry.id)
            publish_event("approval_expired", {"queue_id": str(entry.id)})
            count += 1
            
        session.commit()
        return {"expired_count": count}
        
    except Exception as exc:
        logger.exception("Failed to expire pending approvals")
        session.rollback()
        raise self.retry(exc=exc)
    finally:
        session.close()
