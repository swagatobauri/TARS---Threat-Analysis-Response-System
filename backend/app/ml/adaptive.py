"""
Adaptive learning system for TARS.

Handles the "Learn" step — adjusting detection thresholds based on
recent scoring distributions and retraining models when enough
analyst feedback has been collected.
"""

import json
import logging
import os
import shutil
import tempfile
import uuid
from datetime import datetime
from typing import Optional

import joblib
import numpy as np
import redis

from app.core.config import settings
from app.db.database import SyncSessionLocal
from app.db.models import AnomalyScore, ThreatEvent, ActionLog

logger = logging.getLogger(__name__)


# ============================================================
# Threshold Manager — keeps thresholds in Redis
# ============================================================

class ThresholdManager:
    """
    Stores and updates per-risk-level detection thresholds in Redis.
    These thresholds decide whether a score triggers agent reasoning
    or just gets logged and ignored.

    Why Redis? Because multiple Celery workers and the FastAPI process
    all need to read the same thresholds, and we don't want to hit
    the database on every single log ingestion.
    """

    # default thresholds if nothing is stored yet
    DEFAULTS = {
        "LOW": 0.30,
        "MEDIUM": 0.50,
        "HIGH": 0.65,
        "CRITICAL": 0.80,
    }

    REDIS_KEY_PREFIX = "tars:threshold:"
    EMA_ALPHA = 0.1  # how much weight new data gets vs old threshold

    def __init__(self, redis_url: str = None):
        url = redis_url or settings.REDIS_URL
        self.redis = redis.from_url(url, decode_responses=True)

    def get_threshold(self, risk_level: str) -> float:
        """Fetch the current threshold for a given risk level."""
        key = f"{self.REDIS_KEY_PREFIX}{risk_level}"
        val = self.redis.get(key)
        if val is not None:
            return float(val)
        # not set yet — use the default and store it
        default = self.DEFAULTS.get(risk_level, 0.5)
        self.redis.set(key, str(default))
        return default

    def get_all_thresholds(self) -> dict:
        """Convenience method — return all four thresholds at once."""
        return {level: self.get_threshold(level) for level in self.DEFAULTS}

    def update_threshold(self, recent_scores: list) -> dict:
        """
        Recalculate thresholds using an exponential moving average.

        Takes a list of AnomalyScore objects (or dicts with 'combined_score'
        and 'risk_level' keys), computes the 90th percentile for each
        risk level, and blends it into the existing threshold.

        Formula: new = (1 - alpha) * old + alpha * p90_score
        """
        if not recent_scores:
            logger.info("No scores to update thresholds from — skipping")
            return self.get_all_thresholds()

        # bucket scores by risk level
        buckets = {"LOW": [], "MEDIUM": [], "HIGH": [], "CRITICAL": []}
        for s in recent_scores:
            level = s.risk_level if hasattr(s, "risk_level") else s.get("risk_level", "LOW")
            score = s.combined_score if hasattr(s, "combined_score") else s.get("combined_score", 0)
            if level in buckets:
                buckets[level].append(score)

        updated = {}
        for level, scores in buckets.items():
            old = self.get_threshold(level)
            if len(scores) < 5:
                # not enough data to meaningfully adjust
                updated[level] = old
                continue

            p90 = float(np.percentile(scores, 90))
            new = round((1 - self.EMA_ALPHA) * old + self.EMA_ALPHA * p90, 4)

            # clamp to reasonable range
            new = max(0.10, min(new, 0.95))

            key = f"{self.REDIS_KEY_PREFIX}{level}"
            self.redis.set(key, str(new))
            updated[level] = new

            logger.info("Threshold %s: %.4f → %.4f (p90=%.4f, samples=%d)",
                        level, old, new, p90, len(scores))

        # publish event so other processes can react
        self.redis.publish("tars:events:threshold_update", json.dumps({
            "event": "threshold_update",
            "thresholds": updated,
            "timestamp": datetime.utcnow().isoformat(),
        }))

        return updated


# ============================================================
# Model Updater — feedback collection + retraining
# ============================================================

class ModelUpdater:
    """
    Collects analyst feedback ("was this a real attack or a false positive?")
    and triggers retraining once enough labeled samples are available.
    """

    RETRAIN_THRESHOLD = 500  # minimum new labeled samples before retraining
    FEEDBACK_REDIS_KEY = "tars:feedback:count"

    def __init__(self, model_dir: str = None, redis_url: str = None):
        self.model_dir = model_dir or settings.MODEL_PATH
        url = redis_url or settings.REDIS_URL
        self.redis = redis.from_url(url, decode_responses=True)

    def collect_feedback(self, threat_event_id: str, was_true_positive: bool):
        """
        Record whether a flagged threat was actually malicious.
        Stores feedback in the DB (on the ThreatEvent) and increments
        a Redis counter so we know when to retrain.
        """
        session = SyncSessionLocal()
        try:
            threat = session.get(ThreatEvent, uuid.UUID(threat_event_id))
            if threat is None:
                logger.warning("ThreatEvent %s not found — feedback discarded", threat_event_id)
                return False

            # mark as resolved with the analyst's verdict
            threat.resolved = True
            threat.resolved_at = datetime.utcnow()

            # stash the feedback in agent_reasoning (append to existing)
            verdict = "TRUE_POSITIVE" if was_true_positive else "FALSE_POSITIVE"
            threat.agent_reasoning += f"\n\n[ANALYST FEEDBACK] {verdict} — {datetime.utcnow().isoformat()}"

            session.commit()

            # bump the counter
            self.redis.incr(self.FEEDBACK_REDIS_KEY)
            count = int(self.redis.get(self.FEEDBACK_REDIS_KEY) or 0)

            logger.info("Feedback recorded — event=%s verdict=%s (total: %d)",
                        threat_event_id, verdict, count)
            return True

        except Exception as e:
            session.rollback()
            logger.exception("Failed to store feedback: %s", e)
            return False
        finally:
            session.close()

    def retrain_if_ready(self) -> bool:
        """
        Check if we have enough new feedback to justify retraining.
        If yes, kick off the full retrain + model swap.
        """
        count = int(self.redis.get(self.FEEDBACK_REDIS_KEY) or 0)
        if count < self.RETRAIN_THRESHOLD:
            logger.info("Not enough feedback yet (%d/%d) — skipping retrain",
                        count, self.RETRAIN_THRESHOLD)
            return False

        logger.info("Retraining triggered — %d new labeled samples", count)

        try:
            self._do_retrain()
            # reset the counter
            self.redis.set(self.FEEDBACK_REDIS_KEY, "0")
            return True
        except Exception as e:
            logger.exception("Retraining failed: %s", e)
            return False

    def _do_retrain(self):
        """
        Actual retraining logic:
        1. Pull all scored data + feedback labels from DB
        2. Train new models
        3. Atomic swap the model files
        """
        from app.ml.data_pipeline import PreprocessingPipeline
        from app.ml.models import IsolationForestDetector, OneClassSVMDetector
        from sqlalchemy import select

        session = SyncSessionLocal()
        try:
            # grab all anomaly scores — use feedback as ground truth where available
            results = session.execute(
                select(AnomalyScore).order_by(AnomalyScore.created_at.desc()).limit(10000)
            ).scalars().all()

            if len(results) < 100:
                logger.warning("Too few samples (%d) to retrain", len(results))
                return

            # build feature matrix from the stored scores
            # (in a real system you'd re-extract from NetworkLogs, but this works for now)
            X = np.array([[
                s.isolation_forest_score,
                s.svm_score,
                s.combined_score,
                s.behavioral_deviation,
            ] for s in results])

            # train new models
            iso = IsolationForestDetector(contamination=0.05, n_estimators=200)
            iso.train(X)

            # SVM on the low-score samples (proxy for "normal")
            normal_mask = np.array([s.combined_score < 0.3 for s in results])
            if normal_mask.sum() > 50:
                svm = OneClassSVMDetector()
                svm.train(X[normal_mask])
            else:
                logger.warning("Not enough normal samples for SVM — keeping old model")
                return

            # atomic swap
            self.atomic_model_swap(iso, "isolation_forest")
            self.atomic_model_swap(svm, "one_class_svm")

            logger.info("Models retrained and swapped successfully")

        finally:
            session.close()

    def atomic_model_swap(self, model, model_type: str):
        """
        Save to a temp file first, then rename into place.
        os.rename is atomic on POSIX systems, so there's no window
        where the model file is missing or half-written.
        """
        final_path = os.path.join(self.model_dir, f"{model_type}.pkl")
        os.makedirs(self.model_dir, exist_ok=True)

        # write to a temp file in the same directory (same filesystem = atomic rename)
        fd, tmp_path = tempfile.mkstemp(dir=self.model_dir, suffix=".pkl.tmp")
        try:
            os.close(fd)
            model.save(tmp_path)
            os.replace(tmp_path, final_path)  # atomic on POSIX
            logger.info("Model swapped: %s → %s", model_type, final_path)
        except Exception:
            # clean up the temp file if something goes wrong
            if os.path.exists(tmp_path):
                os.unlink(tmp_path)
            raise
