import logging
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone

from celery import shared_task
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.db.database import SyncSessionLocal
from app.db.models import ActionLog, RollbackRecord, IPReputation, AnomalyScore, NetworkLog
from app.core.event_bus import get_redis_client, publish_event

logger = logging.getLogger(__name__)

@dataclass
class RollbackResult:
    success: bool
    record_id: str | None
    error: str | None

class RollbackManager:
    def __init__(self):
        self.redis = get_redis_client()

    async def rollback_action(self, session: AsyncSession, action_log_id: str, rolled_back_by: str, reason: str) -> RollbackResult:
        try:
            action_id_uuid = uuid.UUID(action_log_id)
            action_log = await session.get(ActionLog, action_id_uuid)
            
            if not action_log:
                return RollbackResult(success=False, record_id=None, error="ActionLog not found")

            ip = action_log.target_ip
            action_type = action_log.action_type

            if action_type == "BLOCK":
                reputation = await session.get(IPReputation, ip)
                if reputation:
                    reputation.is_blocked = False
            elif action_type == "RATE_LIMIT":
                # Remove rate limits from redis
                self.redis.delete(f"ratelimit:{ip}")

            # Create RollbackRecord
            record = RollbackRecord(
                action_log_id=action_id_uuid,
                rolled_back_by=rolled_back_by,
                rollback_reason=reason,
                was_successful=True
            )
            session.add(record)
            await session.commit()
            await session.refresh(record)

            logger.info("Rolled back %s on %s by %s. Reason: %s", action_type, ip, rolled_back_by, reason)
            
            # Emit event
            publish_event("action_rolled_back", {
                "action_log_id": action_log_id,
                "ip": ip,
                "action_type": action_type,
                "rolled_back_by": rolled_back_by
            })

            return RollbackResult(success=True, record_id=str(record.id), error=None)

        except Exception as e:
            logger.exception("Rollback failed for %s", action_log_id)
            await session.rollback()
            return RollbackResult(success=False, record_id=None, error=str(e))

    def schedule_auto_rollback(self, action_log_id: str, minutes: int):
        logger.info("Scheduling auto-rollback for %s in %d minutes", action_log_id, minutes)
        # Delay the celery task execution
        auto_rollback_task.apply_async(args=[action_log_id], countdown=minutes * 60)


@shared_task(bind=True, name="tasks.auto_rollback", max_retries=3)
def auto_rollback_task(self, action_log_id: str):
    """
    Called automatically after AUTO_ROLLBACK_MINUTES for blocked actions.
    Checks if anomaly score dropped. If so, rolls back. If not, extends block.
    """
    session = SyncSessionLocal()
    try:
        manager = RollbackManager()
        action_id_uuid = uuid.UUID(action_log_id)
        action_log = session.get(ActionLog, action_id_uuid)

        if not action_log or action_log.action_type != "BLOCK":
            return {"status": "skipped", "reason": "Not a BLOCK action"}

        ip = action_log.target_ip
        
        # Check recent anomaly scores for this IP
        recent_anomalies = session.execute(
            select(AnomalyScore).join(NetworkLog).where(
                NetworkLog.source_ip == ip
            ).order_by(AnomalyScore.created_at.desc()).limit(5)
        ).scalars().all()

        is_still_high = False
        if recent_anomalies:
            avg_score = sum(a.combined_score for a in recent_anomalies) / len(recent_anomalies)
            if avg_score >= settings.ANOMALY_THRESHOLD:
                is_still_high = True

        if not is_still_high:
            # Safe to rollback
            res = manager.rollback_action(session, action_log_id, "AUTO_TIMER", "Anomaly scores dropped below threshold")
            return {"status": "rolled_back", "record_id": res.record_id}
        else:
            # Extend block
            logger.info("IP %s still showing high anomalies. Extending block by %d minutes.", ip, settings.AUTO_ROLLBACK_MINUTES)
            manager.schedule_auto_rollback(action_log_id, settings.AUTO_ROLLBACK_MINUTES)
            return {"status": "extended_block"}

    except Exception as exc:
        logger.exception("Auto rollback task failed for %s", action_log_id)
        raise self.retry(exc=exc)
    finally:
        session.close()
