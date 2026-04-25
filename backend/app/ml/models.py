"""
Anomaly detection models for TARS.

Two base detectors (Isolation Forest, One-Class SVM) and an ensemble
that combines them for the final verdict.
"""

import logging
import os
from dataclasses import dataclass
from typing import Optional

import joblib
import numpy as np
from sklearn.ensemble import IsolationForest
from sklearn.svm import OneClassSVM

from app.ml.data_pipeline import FeatureExtractor, PreprocessingPipeline

logger = logging.getLogger(__name__)


@dataclass
class AnomalyResult:
    """What the ensemble spits out for each log entry."""
    isolation_forest_score: float
    svm_score: float
    combined_score: float
    is_anomaly: bool
    confidence: float
    risk_level: str   # LOW / MEDIUM / HIGH / CRITICAL


# ============================================================
# Isolation Forest
# ============================================================

class IsolationForestDetector:
    """
    Unsupervised anomaly detector. Works well on high-dimensional data
    and doesn't need labeled samples — it just learns what "normal" looks like
    and flags everything else.
    """

    def __init__(self, contamination=0.05, n_estimators=200, random_state=42, n_jobs=-1):
        self.model = IsolationForest(
            contamination=contamination,
            n_estimators=n_estimators,
            random_state=random_state,
            n_jobs=n_jobs,
        )
        self._is_trained = False

    def train(self, X: np.ndarray):
        """Fit on the full dataset (normal + anomalous). Returns self for chaining."""
        logger.info("Training Isolation Forest on %d samples...", len(X))
        self.model.fit(X)
        self._is_trained = True
        logger.info("Isolation Forest trained.")
        return self

    def predict(self, X: np.ndarray) -> dict:
        """
        Score a single sample (or batch). Returns dict with:
          - anomaly_score: 0-1, higher = more suspicious
          - is_anomaly: bool
          - confidence: how sure we are (also 0-1)
        """
        if not self._is_trained:
            raise RuntimeError("Model not trained yet — call train() or load() first")

        # score_samples returns negative values for anomalies
        raw_scores = self.model.score_samples(X)

        # flip and normalize to 0-1 range
        # more negative = more anomalous → higher score after flip
        normalized = self._normalize(raw_scores)

        # sklearn's predict: -1 = anomaly, 1 = normal
        predictions = self.model.predict(X)

        return {
            "anomaly_score": float(normalized[0]) if len(normalized) == 1 else normalized.tolist(),
            "is_anomaly": bool(predictions[0] == -1) if len(predictions) == 1 else (predictions == -1).tolist(),
            "confidence": float(abs(raw_scores[0])) if len(raw_scores) == 1 else np.abs(raw_scores).tolist(),
        }

    def _normalize(self, scores: np.ndarray) -> np.ndarray:
        """Map raw scores to [0, 1] where 1 = most anomalous."""
        # shift so the most anomalous is highest
        flipped = -scores
        mn, mx = flipped.min(), flipped.max()
        if mx - mn == 0:
            return np.zeros_like(flipped)
        return (flipped - mn) / (mx - mn)

    def save(self, path: str):
        os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
        joblib.dump(self.model, path)
        logger.info("Isolation Forest saved → %s", path)

    def load(self, path: str):
        self.model = joblib.load(path)
        self._is_trained = True
        logger.info("Isolation Forest loaded ← %s", path)
        return self


# ============================================================
# One-Class SVM
# ============================================================

class OneClassSVMDetector:
    """
    Trained ONLY on normal traffic. Anything that doesn't look like the
    training distribution gets flagged. More precise than IF but slower
    and pickier about feature scaling.
    """

    def __init__(self, kernel="rbf", nu=0.05, gamma="scale"):
        self.model = OneClassSVM(kernel=kernel, nu=nu, gamma=gamma)
        self._is_trained = False

    def train(self, X: np.ndarray):
        """
        Train on NORMAL samples only.
        If you pass in a mix, filter first — this model assumes all training data is clean.
        """
        logger.info("Training One-Class SVM on %d normal samples...", len(X))
        self.model.fit(X)
        self._is_trained = True
        logger.info("One-Class SVM trained.")
        return self

    def predict(self, X: np.ndarray) -> dict:
        if not self._is_trained:
            raise RuntimeError("Model not trained yet — call train() or load() first")

        raw_scores = self.model.decision_function(X)
        normalized = self._normalize(raw_scores)
        predictions = self.model.predict(X)

        return {
            "anomaly_score": float(normalized[0]) if len(normalized) == 1 else normalized.tolist(),
            "is_anomaly": bool(predictions[0] == -1) if len(predictions) == 1 else (predictions == -1).tolist(),
            "confidence": float(min(abs(raw_scores[0]), 1.0)) if len(raw_scores) == 1 else np.clip(np.abs(raw_scores), 0, 1).tolist(),
        }

    def _normalize(self, scores: np.ndarray) -> np.ndarray:
        """Same idea as IF — flip so anomalies score higher."""
        flipped = -scores
        mn, mx = flipped.min(), flipped.max()
        if mx - mn == 0:
            return np.zeros_like(flipped)
        return (flipped - mn) / (mx - mn)

    def save(self, path: str):
        os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
        joblib.dump(self.model, path)
        logger.info("One-Class SVM saved → %s", path)

    def load(self, path: str):
        self.model = joblib.load(path)
        self._is_trained = True
        logger.info("One-Class SVM loaded ← %s", path)
        return self


# ============================================================
# Ensemble Detector — this is what the rest of TARS uses
# ============================================================

class EnsembleDetector:
    """
    Combines Isolation Forest (60%) and One-Class SVM (40%)
    into a single score. Also handles feature extraction and scaling
    so the caller just passes in a raw log dict.
    """

    ISO_WEIGHT = 0.6
    SVM_WEIGHT = 0.4

    def __init__(self):
        self.iso = IsolationForestDetector()
        self.svm = OneClassSVMDetector()
        self.feature_extractor = FeatureExtractor()
        self.pipeline = PreprocessingPipeline()
        self._ready = False

    def load_all(self, model_dir: str):
        """Load both models + scaler from disk. Call this at app startup."""
        self.iso.load(os.path.join(model_dir, "isolation_forest.pkl"))
        self.svm.load(os.path.join(model_dir, "one_class_svm.pkl"))

        scaler_path = os.path.join(model_dir, "scaler.pkl")
        if os.path.exists(scaler_path):
            self.pipeline.scaler_path = scaler_path
            self.pipeline.load_scaler()

        self._ready = True
        logger.info("Ensemble detector loaded from %s", model_dir)

    def analyze(self, log: dict, ip_history: list[dict]) -> AnomalyResult:
        """
        Full pipeline: extract → scale → score → combine → classify.
        This is the main method that Celery tasks and API endpoints call.
        """
        if not self._ready:
            raise RuntimeError("Models not loaded — call load_all() first")

        # extract the 6 features from raw log + history
        features = self.feature_extractor.extract_features(log, ip_history)

        # scale them
        scaled = self.pipeline.transform(features)

        # get scores from both models
        iso_result = self.iso.predict(scaled)
        svm_result = self.svm.predict(scaled)

        iso_score = iso_result["anomaly_score"]
        svm_score = svm_result["anomaly_score"]

        # weighted combination
        combined = round(self.ISO_WEIGHT * iso_score + self.SVM_WEIGHT * svm_score, 4)

        # confidence = how much the two models agree
        agreement = 1.0 - abs(iso_score - svm_score)
        confidence = round(agreement * combined, 4)

        risk_level = self._classify_risk(combined)

        return AnomalyResult(
            isolation_forest_score=round(iso_score, 4),
            svm_score=round(svm_score, 4),
            combined_score=combined,
            is_anomaly=combined > 0.3,
            confidence=confidence,
            risk_level=risk_level,
        )

    @staticmethod
    def _classify_risk(score: float) -> str:
        if score > 0.8:
            return "CRITICAL"
        if score > 0.6:
            return "HIGH"
        if score > 0.3:
            return "MEDIUM"
        return "LOW"
