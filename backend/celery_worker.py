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
    "expire-pending-approvals": {
        "task": "tasks.expire_pending_approvals",
        "schedule": 60.0,                # every 60 seconds
    },
    "update-attacker-profiles": {
        "task": "tasks.update_attacker_profiles",
        "schedule": 300.0,               # every 5 minutes
    },
}


# ---------------------------------------------------------------
# Periodic: Threshold update task
# ---------------------------------------------------------------

@celery_app.task(name="tasks.run_threshold_update")
def run_threshold_update():
    """
    Periodic task (every hour) — the "Learn" heartbeat.
    1. Pull recent AnomalyScores from the DB
    2. Update detection thresholds in Redis via EMA
    3. Check if enough analyst feedback has accumulated to retrain models
    """
    from app.db.database import SyncSessionLocal
    from app.db.models import AnomalyScore
    from app.ml.adaptive import ThresholdManager, ModelUpdater
    from sqlalchemy import select, desc

    session = SyncSessionLocal()

    try:
        # grab the last 1000 scored entries
        results = session.execute(
            select(AnomalyScore).order_by(desc(AnomalyScore.created_at)).limit(1000)
        ).scalars().all()

        # update thresholds
        threshold_mgr = ThresholdManager()
        updated = threshold_mgr.update_threshold(results)

        # check if it's time to retrain
        updater = ModelUpdater()
        retrained = updater.retrain_if_ready()

        logger.info(
            "Threshold update complete — thresholds=%s  retrained=%s  samples=%d",
            updated, retrained, len(results),
        )

        return {
            "status": "updated",
            "thresholds": updated,
            "samples_used": len(results),
            "retrained": retrained,
        }

    except Exception as exc:
        logger.exception("Threshold update failed: %s", exc)
        return {"status": "error", "detail": str(exc)}

    finally:
        session.close()

