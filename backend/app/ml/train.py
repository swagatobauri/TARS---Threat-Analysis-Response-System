#!/usr/bin/env python3
"""
TARS Model Training Script
---------------------------
Trains both anomaly detectors (Isolation Forest + One-Class SVM),
saves them to disk, and prints a quick evaluation if labels are available.

Usage:
    python -m app.ml.train --data-dir data/ --output-dir ml_models/

Or from the backend directory:
    python app/ml/train.py --data-dir data/ --output-dir ml_models/
"""

import argparse
import logging
import os
import sys
import time

import numpy as np
from sklearn.metrics import classification_report

# make sure we can import app modules when running as a script
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from app.ml.data_pipeline import DatasetLoader, PreprocessingPipeline
from app.ml.models import IsolationForestDetector, OneClassSVMDetector

logging.basicConfig(level=logging.INFO, format="%(asctime)s  %(levelname)-8s  %(message)s")
logger = logging.getLogger("tars.train")


def train_models(data_dir: str, output_dir: str):
    """Main training loop."""

    os.makedirs(output_dir, exist_ok=True)
    loader = DatasetLoader()

    # --------------------------------------------------------
    # Step 1: Load data
    # --------------------------------------------------------
    cicids_path = os.path.join(data_dir, "cicids")
    unsw_path = os.path.join(data_dir, "unsw", "UNSW-NB15.csv")

    # try to load whichever dataset is available
    df = None
    if os.path.exists(cicids_path) and os.path.exists(unsw_path):
        logger.info("Found both datasets — merging CICIDS + UNSW")
        df = loader.merge_datasets(cicids_path, unsw_path)
    elif os.path.exists(cicids_path):
        logger.info("Found CICIDS only")
        df = loader.load_cicids(cicids_path)
    elif os.path.exists(unsw_path):
        logger.info("Found UNSW-NB15 only")
        df = loader.load_unsw(unsw_path)
    else:
        logger.warning("No datasets found in %s — generating synthetic data for demo", data_dir)
        df = _generate_synthetic_data()

    logger.info("Dataset shape: %s", df.shape)
    logger.info("Attack ratio: %.2f%%", df["label"].mean() * 100)

    # --------------------------------------------------------
    # Step 2: Preprocess — scale + split
    # --------------------------------------------------------
    scaler_path = os.path.join(output_dir, "scaler.pkl")
    pipeline = PreprocessingPipeline(scaler_path=scaler_path)

    X_train, X_val, y_train, y_val = pipeline.fit_and_save(df, label_col="label")
    logger.info("Train: %d  |  Val: %d", len(X_train), len(X_val))

    # --------------------------------------------------------
    # Step 3: Train Isolation Forest (on all data — it's unsupervised)
    # --------------------------------------------------------
    logger.info("--- Isolation Forest ---")
    t0 = time.time()

    iso = IsolationForestDetector(
        contamination=0.05,
        n_estimators=200,
        random_state=42,
        n_jobs=-1,
    )
    iso.train(X_train)
    iso.save(os.path.join(output_dir, "isolation_forest.pkl"))

    logger.info("IF training took %.1fs", time.time() - t0)

    # --------------------------------------------------------
    # Step 4: Train One-Class SVM (on NORMAL samples only)
    # --------------------------------------------------------
    logger.info("--- One-Class SVM ---")
    t0 = time.time()

    # filter to just the normal traffic for SVM training
    normal_mask = y_train == 0
    X_normal = X_train[normal_mask]

    # SVM can be slow on huge datasets, so cap it if needed
    MAX_SVM_SAMPLES = 50_000
    if len(X_normal) > MAX_SVM_SAMPLES:
        logger.info("Subsampling SVM training data: %d → %d", len(X_normal), MAX_SVM_SAMPLES)
        rng = np.random.RandomState(42)
        idx = rng.choice(len(X_normal), MAX_SVM_SAMPLES, replace=False)
        X_normal = X_normal[idx]

    svm = OneClassSVMDetector(kernel="rbf", nu=0.05, gamma="scale")
    svm.train(X_normal)
    svm.save(os.path.join(output_dir, "one_class_svm.pkl"))

    logger.info("SVM training took %.1fs", time.time() - t0)

    # --------------------------------------------------------
    # Step 5: Evaluate on validation set
    # --------------------------------------------------------
    if y_val is not None and len(np.unique(y_val)) > 1:
        logger.info("--- Evaluation ---")
        _evaluate(iso, svm, X_val, y_val)

    logger.info("All models saved to %s", output_dir)
    logger.info("Done.")


def _evaluate(iso: IsolationForestDetector, svm: OneClassSVMDetector, X_val: np.ndarray, y_val: np.ndarray):
    """Quick eval — prints classification reports for both models + the ensemble."""

    # Isolation Forest predictions
    iso_preds = iso.model.predict(X_val)
    iso_binary = (iso_preds == -1).astype(int)  # -1 = anomaly → 1

    print("\n=== Isolation Forest ===")
    print(classification_report(y_val, iso_binary, target_names=["Normal", "Attack"], zero_division=0))

    # SVM predictions
    svm_preds = svm.model.predict(X_val)
    svm_binary = (svm_preds == -1).astype(int)

    print("=== One-Class SVM ===")
    print(classification_report(y_val, svm_binary, target_names=["Normal", "Attack"], zero_division=0))

    # Ensemble — majority vote (simple version)
    ensemble_binary = ((iso_binary + svm_binary) >= 1).astype(int)

    print("=== Ensemble (OR) ===")
    print(classification_report(y_val, ensemble_binary, target_names=["Normal", "Attack"], zero_division=0))


def _generate_synthetic_data():
    """
    Creates a small fake dataset for testing the pipeline
    when real datasets aren't available yet.
    """
    import pandas as pd

    rng = np.random.RandomState(42)
    n_normal = 8000
    n_attack = 400

    # normal traffic: low values, small variance
    normal = pd.DataFrame({
        "duration": rng.exponential(10, n_normal),
        "protocol": rng.choice([6, 17], n_normal),       # TCP / UDP
        "src_bytes": rng.exponential(500, n_normal),
        "dst_bytes": rng.exponential(300, n_normal),
        "src_port": rng.randint(1024, 65535, n_normal),
        "dst_port": rng.choice([80, 443, 22, 53, 8080], n_normal),
        "packets": rng.poisson(10, n_normal),
        "rate": rng.exponential(5, n_normal),
        "label": 0,
    })

    # attack traffic: bursty, high rate, unusual ports
    attack = pd.DataFrame({
        "duration": rng.exponential(0.5, n_attack),
        "protocol": rng.choice([6, 17, 1, 47], n_attack),  # includes ICMP, GRE
        "src_bytes": rng.exponential(50000, n_attack),
        "dst_bytes": rng.exponential(100, n_attack),
        "src_port": rng.randint(1, 1024, n_attack),
        "dst_port": rng.randint(1, 65535, n_attack),         # scanning many ports
        "packets": rng.poisson(500, n_attack),
        "rate": rng.exponential(200, n_attack),
        "label": 1,
    })

    df = pd.concat([normal, attack], ignore_index=True)
    df = df.sample(frac=1, random_state=42).reset_index(drop=True)

    logger.info("Generated synthetic dataset: %d normal + %d attack", n_normal, n_attack)
    return df


# ============================================================
# CLI
# ============================================================

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Train TARS anomaly detection models")
    parser.add_argument("--data-dir", default="data/", help="Path to dataset folder")
    parser.add_argument("--output-dir", default="ml_models/", help="Where to save trained models")
    args = parser.parse_args()

    train_models(args.data_dir, args.output_dir)
