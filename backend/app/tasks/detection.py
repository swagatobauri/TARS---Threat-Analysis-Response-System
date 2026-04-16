"""
TARS Detection Task
-------------------
Loads a network log, extracts features, runs Isolation Forest + One-Class SVM,
computes a combined anomaly score, and chains to agent reasoning if suspicious.
"""

import logging
import math
import uuid
from collections import Counter
from datetime import datetime

import joblib
import numpy as np
from celery import shared_task
from sqlalchemy import select, func

from app.core.config import settings
from app.db.database import SyncSessionLocal
from app.db.models import NetworkLog, AnomalyScore, IPReputation

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------
# Model cache — loaded once per worker process, reused across tasks
# ---------------------------------------------------------------
_model_cache: dict = {}


def _load_models():
    """Load ML models from disk into the worker-level cache."""
    if "iso_forest" not in _model_cache:
        try:
            _model_cache["iso_forest"] = joblib.load(f"{settings.MODEL_PATH}/isolation_forest.pkl")
            _model_cache["svm"] = joblib.load(f"{settings.MODEL_PATH}/one_class_svm.pkl")
            logger.info("ML models loaded successfully from %s", settings.MODEL_PATH)
        except FileNotFoundError:
            logger.warning("ML model files not found at %s — using synthetic scoring", settings.MODEL_PATH)
            _model_cache["iso_forest"] = None
            _model_cache["svm"] = None
    return _model_cache.get("iso_forest"), _model_cache.get("svm")


# ---------------------------------------------------------------
# Feature extraction helpers
# ---------------------------------------------------------------

def _compute_port_entropy(dest_port: int | None, src_port: int | None) -> float:
    """Shannon entropy across the two port values (proxy for port-scan behaviour)."""
    ports = [p for p in [dest_port, src_port] if p is not None]
    if not ports:
        return 0.0
    counts = Counter(ports)
    total = sum(counts.values())
    return -sum((c / total) * math.log2(c / total) for c in counts.values() if c > 0)


def _compute_ip_frequency(source_ip: str, session) -> float:
    """How many logs this IP has generated in the last 10 000 records (normalised 0-1)."""
    total = session.execute(select(func.count(NetworkLog.id))).scalar() or 1
    ip_count = session.execute(
        select(func.count(NetworkLog.id)).where(NetworkLog.source_ip == source_ip)
    ).scalar() or 0
    return min(ip_count / max(total, 1), 1.0)


def _compute_session_deviation(log: NetworkLog) -> float:
    """Simple deviation metric from 'normal' session profile."""
    duration = log.duration_seconds or 0.0
    bytes_sent = log.bytes_sent or 0
    # Heuristic: short burst with high bytes is anomalous
    if duration < 1.0 and bytes_sent > 50_000:
        return 0.95
    if duration < 5.0 and bytes_sent > 20_000:
        return 0.70
    return 0.15


def _extract_features(log: NetworkLog, session) -> dict:
    """Build the feature vector dict consumed by the ML models."""
    return {
        "request_rate": log.request_rate or 0.0,
        "port_entropy": _compute_port_entropy(log.dest_port, log.src_port),
        "session_deviation": _compute_session_deviation(log),
        "ip_frequency_score": _compute_ip_frequency(log.source_ip, session),
        "bytes_sent": log.bytes_sent or 0,
        "packets": log.packets or 0,
        "duration_seconds": log.duration_seconds or 0.0,
    }


# ---------------------------------------------------------------
# Risk-level mapper
# ---------------------------------------------------------------

def _classify_risk(combined_score: float) -> str:
    if combined_score >= 0.85:
        return "CRITICAL"
    if combined_score >= 0.65:
        return "HIGH"
    if combined_score >= 0.40:
        return "MEDIUM"
    return "LOW"


# ---------------------------------------------------------------
# Celery Task
# ---------------------------------------------------------------

@shared_task(bind=True, name="tasks.detect_anomaly", max_retries=3, default_retry_delay=10)
def detect_anomaly(self, log_id: str):
    """
    Main detection pipeline for a single NetworkLog entry.

    1. Load log from DB
    2. Extract feature vector
    3. Score with Isolation Forest + One-Class SVM
    4. Persist AnomalyScore
    5. Chain to agent reasoning if score exceeds threshold
    """
    session = SyncSessionLocal()

    try:
        # 1. Load the log
        log = session.get(NetworkLog, uuid.UUID(log_id))
        if log is None:
            logger.error("NetworkLog %s not found — aborting detection", log_id)
            return {"status": "error", "detail": "log_not_found"}

        # 2. Extract features
        features = _extract_features(log, session)
        feature_array = np.array([[
            features["request_rate"],
            features["port_entropy"],
            features["session_deviation"],
            features["ip_frequency_score"],
            features["bytes_sent"],
            features["packets"],
            features["duration_seconds"],
        ]])

        # 3. Score with ML models
        iso_model, svm_model = _load_models()

        if iso_model is not None and svm_model is not None:
            # Isolation Forest: decision_function returns negative for outliers
            iso_raw = iso_model.decision_function(feature_array)[0]
            iso_score = max(0.0, min(1.0, 0.5 - iso_raw))  # normalise to 0-1

            svm_raw = svm_model.decision_function(feature_array)[0]
            svm_score = max(0.0, min(1.0, 0.5 - svm_raw))
        else:
            # Synthetic fallback when models aren't trained yet
            iso_score = features["session_deviation"] * 0.8 + features["ip_frequency_score"] * 0.2
            svm_score = features["request_rate"] / max(features["request_rate"] + 1, 1)

        # 4. Combined score
        combined_score = round(0.6 * iso_score + 0.4 * svm_score, 4)
        behavioral_deviation = round(features["session_deviation"], 4)
        risk_level = _classify_risk(combined_score)

        anomaly = AnomalyScore(
            log_id=log.id,
            isolation_forest_score=round(iso_score, 4),
            svm_score=round(svm_score, 4),
            combined_score=combined_score,
            behavioral_deviation=behavioral_deviation,
            risk_level=risk_level,
        )
        session.add(anomaly)
        session.commit()
        session.refresh(anomaly)

        logger.info(
            "Anomaly scored — log=%s  combined=%.4f  risk=%s",
            log_id, combined_score, risk_level,
        )

        # 5. Chain to agent reasoning if threshold exceeded
        if combined_score > settings.ANOMALY_THRESHOLD:
            from app.tasks.agent import run_agent_reasoning
            run_agent_reasoning.delay(str(anomaly.id))

        return {
            "status": "scored",
            "log_id": log_id,
            "combined_score": combined_score,
            "risk_level": risk_level,
            "chained": combined_score > settings.ANOMALY_THRESHOLD,
        }

    except Exception as exc:
        session.rollback()
        logger.exception("Detection task failed for log_id=%s", log_id)
        raise self.retry(exc=exc)

    finally:
        session.close()
