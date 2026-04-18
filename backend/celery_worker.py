"""
TARS Celery Worker
------------------
Central Celery application definition.

Usage:
  Worker   → celery -A celery_worker.celery_app worker --loglevel=info
  Beat     → celery -A celery_worker.celery_app beat   --loglevel=info
"""

import logging
from celery import Celery
from celery.schedules import crontab
from app.core.config import settings

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------
# Celery App
# ---------------------------------------------------------------

celery_app = Celery(
    "tars",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_acks_late=True,               # re-deliver if worker crashes mid-task
    worker_prefetch_multiplier=1,      # fair scheduling across workers
    result_expires=3600,               # results expire after 1 hour
)

# ---------------------------------------------------------------
# Task Autodiscovery
# ---------------------------------------------------------------
celery_app.autodiscover_tasks(["app.tasks"])

# ---------------------------------------------------------------
# Beat Schedule — periodic jobs
# ---------------------------------------------------------------
celery_app.conf.beat_schedule = {
    "update-ml-thresholds-hourly": {
        "task": "tasks.run_threshold_update",
        "schedule": crontab(minute=0),   # every hour on the hour
    },
}


# ---------------------------------------------------------------
# Periodic: Threshold update task
# ---------------------------------------------------------------

@celery_app.task(name="tasks.run_threshold_update")
def run_threshold_update():
    """
    Periodic task — recalculates the anomaly detection threshold
    based on the latest scored data distribution.

    In production this would:
    1. Pull recent AnomalyScores from the last N hours
    2. Compute the 95th percentile of combined_score
    3. Write the new threshold to a shared config or Redis key
    4. Optionally retrain / warm-start the Isolation Forest
    """
    from app.db.database import SyncSessionLocal
    from app.db.models import AnomalyScore
    from sqlalchemy import select, func

    session = SyncSessionLocal()

    try:
        avg_score = session.execute(
            select(func.avg(AnomalyScore.combined_score))
        ).scalar() or 0.5

        count = session.execute(
            select(func.count(AnomalyScore.id))
        ).scalar() or 0

        # Simple adaptive threshold: midpoint between average and 1.0
        new_threshold = round(min(0.5 + (avg_score * 0.5), 0.90), 4)

        logger.info(
            "Threshold update — samples=%d  avg_score=%.4f  new_threshold=%.4f",
            count, avg_score, new_threshold,
        )

        return {
            "status": "updated",
            "samples": count,
            "avg_score": round(avg_score, 4),
            "new_threshold": new_threshold,
        }

    except Exception as exc:
        logger.exception("Threshold update failed: %s", exc)
        return {"status": "error", "detail": str(exc)}

    finally:
        session.close()
