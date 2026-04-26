#!/usr/bin/env python3
"""
TARS Dataset Loader — Integrates real cybersecurity datasets (CICIDS2017 & UNSW-NB15)
for ML training and live simulation.
"""

import argparse
import hashlib
import sys
from pathlib import Path
from typing import List, Dict, Optional

import numpy as np
import pandas as pd
from sklearn.preprocessing import LabelEncoder

DATA_DIR = Path(__file__).parent.parent / "data"
API_ENDPOINT = "http://localhost:8000/api/v1/logs/ingest"


# ──────────────────────────────────────────────
# CICIDS2017 Loader
# ──────────────────────────────────────────────
class CICIDSLoader:
    """Loader for the Canadian Institute for Cybersecurity IDS 2017 dataset."""

    COLUMN_MAP = {
        " Source IP": "source_ip",
        " Destination IP": "dest_ip",
        " Destination Port": "dest_port",
        " Protocol": "protocol",
        " Flow Duration": "duration_seconds",
        " Total Fwd Packets": "bytes_sent",
        " Total Backward Packets": "bytes_received",
        " Label": "label",
    }

    FILES = [
        "Monday-WorkingHours.pcap_ISCX.csv",
        "Tuesday-WorkingHours.pcap_ISCX.csv",
        "Wednesday-workingHours.pcap_ISCX.csv",
        "Thursday-WorkingHours-Morning-WebAttacks.pcap_ISCX.csv",
        "Thursday-WorkingHours-Afternoon-Infilteration.pcap_ISCX.csv",
        "Friday-WorkingHours-Morning.pcap_ISCX.csv",
        "Friday-WorkingHours-Afternoon-DDos.pcap_ISCX.csv",
        "Friday-WorkingHours-Afternoon-PortScan.pcap_ISCX.csv",
    ]

    def __init__(self, data_path: Optional[str] = None):
        self.data_path = Path(data_path) if data_path else DATA_DIR / "cicids2017"

    def load(self, max_files: int = 8) -> pd.DataFrame:
        """Load and concatenate available CSV files."""
        frames = []
        for fname in self.FILES[:max_files]:
            fpath = self.data_path / fname
            if fpath.exists():
                print(f"  Loading {fname}...")
                df = pd.read_csv(fpath, encoding="utf-8", low_memory=False)
                frames.append(df)
            else:
                print(f"  [SKIP] {fname} not found")

        if not frames:
            print("[ERROR] No CICIDS2017 files found. See data/README.md for download instructions.")
            sys.exit(1)

        return pd.concat(frames, ignore_index=True)

    def clean(self, df: pd.DataFrame) -> pd.DataFrame:
        """Handle infinities, NaN, duplicates, and whitespace in column names."""
        df.columns = df.columns.str.strip()
        df = df.replace([np.inf, -np.inf], np.nan)
        df = df.dropna()
        df = df.drop_duplicates()
        return df

    def normalize_columns(self, df: pd.DataFrame) -> pd.DataFrame:
        """Map CICIDS column names to TARS NetworkLog schema."""
        col_map = {k.strip(): v for k, v in self.COLUMN_MAP.items()}
        existing = {k: v for k, v in col_map.items() if k in df.columns}
        return df.rename(columns=existing)

    def get_labels(self, df: pd.DataFrame) -> np.ndarray:
        """Binary labels: 0 = BENIGN, 1 = ATTACK."""
        label_col = "label" if "label" in df.columns else "Label"
        return (df[label_col].str.strip() != "BENIGN").astype(int).values

    def to_network_logs(self, df: pd.DataFrame, n: int = 1000) -> List[Dict]:
        """Convert rows to dicts compatible with /api/v1/logs/ingest."""
        df = self.clean(df)
        df = self.normalize_columns(df)
        sample = df.head(n)

        logs = []
        for _, row in sample.iterrows():
            logs.append({
                "source_ip": str(row.get("source_ip", "192.168.1.1")),
                "dest_ip": str(row.get("dest_ip", "10.0.0.1")),
                "dest_port": int(row.get("dest_port", 80)),
                "protocol": str(row.get("protocol", "TCP")),
                "bytes_sent": int(row.get("bytes_sent", 0)),
                "bytes_received": int(row.get("bytes_received", 0)),
                "duration_seconds": float(row.get("duration_seconds", 0.0)),
                "timestamp": pd.Timestamp.now().isoformat(),
            })
        return logs


# ──────────────────────────────────────────────
# UNSW-NB15 Loader
# ──────────────────────────────────────────────
class UNSWLoader:
    """Loader for the UNSW-NB15 dataset from the Australian Centre for Cyber Security."""

    COLUMN_MAP = {
        "srcip": "source_ip",
        "dstip": "dest_ip",
        "dsport": "dest_port",
        "proto": "protocol",
        "dur": "duration_seconds",
        "sbytes": "bytes_sent",
        "dbytes": "bytes_received",
        "label": "label",
    }

    CATEGORICAL_COLS = ["proto", "service", "state"]

    def __init__(self, data_path: Optional[str] = None):
        self.data_path = Path(data_path) if data_path else DATA_DIR / "unsw-nb15"
        self._label_encoders: Dict[str, LabelEncoder] = {}

    def load_train(self) -> pd.DataFrame:
        """Load the training partition (UNSW_NB15_training-set.csv)."""
        path = self.data_path / "UNSW_NB15_training-set.csv"
        if not path.exists():
            # Try the 4-file split
            return self._load_split()
        print(f"  Loading {path.name}...")
        return pd.read_csv(path, low_memory=False)

    def load_test(self) -> pd.DataFrame:
        path = self.data_path / "UNSW_NB15_testing-set.csv"
        if not path.exists():
            print("[ERROR] UNSW test set not found. See data/README.md.")
            sys.exit(1)
        print(f"  Loading {path.name}...")
        return pd.read_csv(path, low_memory=False)

    def _load_split(self) -> pd.DataFrame:
        """Load from the 4-file CSV split (UNSW-NB15_1.csv through _4.csv)."""
        frames = []
        for i in range(1, 5):
            fpath = self.data_path / f"UNSW-NB15_{i}.csv"
            if fpath.exists():
                print(f"  Loading {fpath.name}...")
                frames.append(pd.read_csv(fpath, header=None, low_memory=False))
        if not frames:
            print("[ERROR] No UNSW-NB15 files found. See data/README.md.")
            sys.exit(1)
        return pd.concat(frames, ignore_index=True)

    def normalize_columns(self, df: pd.DataFrame) -> pd.DataFrame:
        existing = {k: v for k, v in self.COLUMN_MAP.items() if k in df.columns}
        return df.rename(columns=existing)

    def encode_categoricals(self, df: pd.DataFrame) -> pd.DataFrame:
        """Label-encode categorical columns for ML training."""
        for col in self.CATEGORICAL_COLS:
            if col in df.columns:
                le = LabelEncoder()
                df[col] = le.fit_transform(df[col].astype(str))
                self._label_encoders[col] = le
        return df

    def get_labels(self, df: pd.DataFrame) -> np.ndarray:
        label_col = "label" if "label" in df.columns else "Label"
        return df[label_col].astype(int).values

    def to_network_logs(self, df: pd.DataFrame, n: int = 1000) -> List[Dict]:
        df = self.normalize_columns(df)
        sample = df.head(n)
        logs = []
        for _, row in sample.iterrows():
            logs.append({
                "source_ip": str(row.get("source_ip", "192.168.1.1")),
                "dest_ip": str(row.get("dest_ip", "10.0.0.1")),
                "dest_port": int(row.get("dest_port", 80)),
                "protocol": str(row.get("protocol", "TCP")),
                "bytes_sent": int(row.get("bytes_sent", 0)),
                "bytes_received": int(row.get("bytes_received", 0)),
                "duration_seconds": float(row.get("duration_seconds", 0.0)),
                "timestamp": pd.Timestamp.now().isoformat(),
            })
        return logs


# ──────────────────────────────────────────────
# Dataset Importer (Orchestrator)
# ──────────────────────────────────────────────
class DatasetImporter:
    """Orchestrates dataset loading for training or live simulation."""

    def __init__(self, dataset: str):
        self.dataset = dataset
        self.loader = CICIDSLoader() if dataset == "cicids" else UNSWLoader()

    def import_for_training(self, sample_size: int = 50000) -> pd.DataFrame:
        """Load, clean, and balance a dataset for ML model training."""
        print(f"\n[TARS] Loading {self.dataset.upper()} for training...")

        if self.dataset == "cicids":
            df = self.loader.load()
            df = self.loader.clean(df)
            df = self.loader.normalize_columns(df)
        else:
            df = self.loader.load_train()
            df = self.loader.normalize_columns(df)
            df = self.loader.encode_categoricals(df)

        labels = self.loader.get_labels(df)
        df["_label"] = labels

        # Balanced sampling: 50/50 normal/attack
        normal = df[df["_label"] == 0]
        attack = df[df["_label"] == 1]
        half = sample_size // 2
        n_normal = min(half, len(normal))
        n_attack = min(half, len(attack))

        sampled = pd.concat([
            normal.sample(n=n_normal, random_state=42),
            attack.sample(n=n_attack, random_state=42),
        ], ignore_index=True).sample(frac=1, random_state=42)  # shuffle

        self.generate_statistics(sampled)
        return sampled

    def import_for_simulation(self, n: int = 1000):
        """Load n rows and send them to the API for live demo."""
        import requests

        print(f"\n[TARS] Loading {self.dataset.upper()} for simulation ({n} rows)...")

        if self.dataset == "cicids":
            df = self.loader.load()
            df = self.loader.clean(df)
        else:
            df = self.loader.load_train()

        logs = self.loader.to_network_logs(df, n=n)

        print(f"  Sending {len(logs)} logs to {API_ENDPOINT}...")
        chunk_size = 100
        for i in range(0, len(logs), chunk_size):
            chunk = logs[i:i + chunk_size]
            try:
                resp = requests.post(API_ENDPOINT, json=chunk, timeout=5)
                print(f"  Batch {i // chunk_size + 1}: {resp.status_code}")
            except requests.exceptions.RequestException as e:
                print(f"  [ERROR] Batch {i // chunk_size + 1}: {e}")

        print(f"[DONE] Sent {len(logs)} logs for simulation.")

    def generate_statistics(self, df: pd.DataFrame):
        """Print dataset statistics."""
        total = len(df)
        attacks = df["_label"].sum()
        normal = total - attacks

        print(f"\n{'='*50}")
        print(f"  Dataset: {self.dataset.upper()}")
        print(f"  Total rows:    {total:,}")
        print(f"  Normal:        {normal:,} ({normal/total*100:.1f}%)")
        print(f"  Attack:        {attacks:,} ({attacks/total*100:.1f}%)")
        print(f"  Features:      {len(df.columns)}")
        print(f"{'='*50}\n")


# ──────────────────────────────────────────────
# CLI
# ──────────────────────────────────────────────
if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="TARS Dataset Loader")
    parser.add_argument("--dataset", type=str, choices=["cicids", "unsw"], required=True,
                        help="Dataset to load (cicids = CICIDS2017, unsw = UNSW-NB15)")
    parser.add_argument("--mode", type=str, choices=["train", "simulate"], default="train",
                        help="'train' = balanced sample for ML, 'simulate' = send to API")
    parser.add_argument("--sample", type=int, default=50000, help="Sample size for training")
    parser.add_argument("--n", type=int, default=500, help="Number of rows for simulation")

    args = parser.parse_args()
    importer = DatasetImporter(args.dataset)

    if args.mode == "train":
        importer.import_for_training(sample_size=args.sample)
    else:
        importer.import_for_simulation(n=args.n)
