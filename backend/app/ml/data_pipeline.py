"""
Data pipeline for TARS anomaly detection.
Handles loading CICIDS2017 + UNSW-NB15, feature extraction from live logs,
and preprocessing (scaling, train/val split).
"""

import math
import logging
import os
from collections import Counter
from datetime import datetime, timedelta

import numpy as np
import pandas as pd
import joblib
from sklearn.preprocessing import StandardScaler, LabelEncoder
from sklearn.model_selection import train_test_split

logger = logging.getLogger(__name__)


# ============================================================
# Dataset Loading
# ============================================================

class DatasetLoader:
    """
    Loads and cleans CICIDS2017 and UNSW-NB15 datasets.
    Both datasets have their own quirks — messy headers,
    inf values, mixed types — so we handle each separately
    and then merge into a single unified DataFrame.
    """

    # The columns we actually care about after merging.
    # Everything else gets dropped.
    UNIFIED_COLUMNS = [
        "duration", "protocol", "src_bytes", "dst_bytes",
        "src_port", "dst_port", "packets", "rate",
        "label",  # 0 = normal, 1 = attack
    ]

    def load_cicids(self, path: str) -> pd.DataFrame:
        """Load a CICIDS2017 CSV file (or folder of CSVs)."""

        if os.path.isdir(path):
            # CICIDS ships as multiple CSV files, one per day
            frames = []
            for f in sorted(os.listdir(path)):
                if f.endswith(".csv"):
                    frames.append(pd.read_csv(os.path.join(path, f), low_memory=False))
            df = pd.concat(frames, ignore_index=True)
        else:
            df = pd.read_csv(path, low_memory=False)

        # strip whitespace from column names — CICIDS headers are notoriously messy
        df.columns = df.columns.str.strip()

        # nuke inf values, they break everything downstream
        df.replace([np.inf, -np.inf], np.nan, inplace=True)
        df.dropna(subset=["Flow Duration"], inplace=True, errors="ignore")

        # build the unified format
        out = pd.DataFrame()
        out["duration"] = pd.to_numeric(df.get("Flow Duration", 0), errors="coerce").fillna(0)
        out["protocol"] = df.get("Protocol", 0)
        out["src_bytes"] = pd.to_numeric(df.get("Total Fwd Packets", 0), errors="coerce").fillna(0)
        out["dst_bytes"] = pd.to_numeric(df.get("Total Backward Packets", 0), errors="coerce").fillna(0)
        out["src_port"] = pd.to_numeric(df.get("Source Port", 0), errors="coerce").fillna(0).astype(int)
        out["dst_port"] = pd.to_numeric(df.get("Destination Port", 0), errors="coerce").fillna(0).astype(int)
        out["packets"] = pd.to_numeric(df.get("Total Fwd Packets", 0), errors="coerce").fillna(0)
        out["rate"] = pd.to_numeric(df.get("Flow Packets/s", 0), errors="coerce").fillna(0)

        # label: anything that isn't "BENIGN" is an attack
        label_col = df.get("Label", pd.Series(["BENIGN"] * len(df)))
        out["label"] = (label_col.str.strip().str.upper() != "BENIGN").astype(int)

        logger.info("CICIDS loaded — %d rows, %d attacks", len(out), out["label"].sum())
        return out

    def load_unsw(self, path: str) -> pd.DataFrame:
        """Load UNSW-NB15 CSV. Handles categorical encoding for proto/service/state."""

        df = pd.read_csv(path, low_memory=False)
        df.columns = df.columns.str.strip()

        # encode the string columns that UNSW uses
        cat_cols = ["proto", "service", "state"]
        encoders = {}
        for col in cat_cols:
            if col in df.columns:
                le = LabelEncoder()
                df[col] = le.fit_transform(df[col].astype(str))
                encoders[col] = le

        out = pd.DataFrame()
        out["duration"] = pd.to_numeric(df.get("dur", 0), errors="coerce").fillna(0)
        out["protocol"] = df.get("proto", 0)
        out["src_bytes"] = pd.to_numeric(df.get("sbytes", 0), errors="coerce").fillna(0)
        out["dst_bytes"] = pd.to_numeric(df.get("dbytes", 0), errors="coerce").fillna(0)
        out["src_port"] = pd.to_numeric(df.get("sport", 0), errors="coerce").fillna(0).astype(int)
        out["dst_port"] = pd.to_numeric(df.get("dsport", 0), errors="coerce").fillna(0).astype(int)
        out["packets"] = pd.to_numeric(df.get("spkts", 0), errors="coerce").fillna(0)

        # rate isn't directly available — approximate it
        dur = out["duration"].replace(0, 0.001)
        out["rate"] = out["packets"] / dur

        # UNSW uses a numeric label column (0 or 1) and an "attack_cat" column
        if "label" in df.columns:
            out["label"] = df["label"].astype(int)
        elif "Label" in df.columns:
            out["label"] = df["Label"].astype(int)
        else:
            out["label"] = 0

        logger.info("UNSW loaded — %d rows, %d attacks", len(out), out["label"].sum())
        return out

    def merge_datasets(self, cicids_path: str, unsw_path: str) -> pd.DataFrame:
        """Load both datasets and stack them into one big DataFrame."""

        cicids = self.load_cicids(cicids_path)
        unsw = self.load_unsw(unsw_path)

        merged = pd.concat([cicids, unsw], ignore_index=True)

        # final cleanup pass
        merged.replace([np.inf, -np.inf], np.nan, inplace=True)
        merged.fillna(0, inplace=True)

        logger.info("Merged dataset — %d total rows", len(merged))
        return merged[self.UNIFIED_COLUMNS]


# ============================================================
# Feature Extraction (for live logs)
# ============================================================

class FeatureExtractor:
    """
    Takes a raw NetworkLog dict + recent history from the same IP,
    and spits out a (1, 6) feature vector ready for the ML models.

    Features:
        0 - request_rate
        1 - port_entropy
        2 - session_deviation
        3 - ip_frequency_score
        4 - protocol_anomaly
        5 - time_of_day_score
    """

    FEATURE_NAMES = [
        "request_rate",
        "port_entropy",
        "session_deviation",
        "ip_frequency_score",
        "protocol_anomaly",
        "time_of_day_score",
    ]

    # protocols we consider "normal" — anything else gets flagged
    COMMON_PROTOCOLS = {"TCP", "UDP", "ICMP", "tcp", "udp", "icmp", "6", "17", "1"}

    def _request_rate(self, log: dict) -> float:
        """packets per second"""
        packets = log.get("packets", 0) or 0
        duration = log.get("duration_seconds", 0) or 0
        if duration <= 0:
            # no duration means it was a single burst — treat it as high rate
            return float(packets) if packets > 0 else 0.0
        return packets / duration

    def _port_entropy(self, history: list[dict]) -> float:
        """
        Shannon entropy over the destination ports this IP
        has been hitting recently. High entropy = port scanning.
        """
        ports = [h.get("dest_port") for h in history if h.get("dest_port") is not None]
        if len(ports) < 2:
            return 0.0

        counts = Counter(ports)
        total = len(ports)
        entropy = 0.0
        for c in counts.values():
            p = c / total
            if p > 0:
                entropy -= p * math.log2(p)

        # normalize to 0-1 range (max entropy = log2(n))
        max_entropy = math.log2(len(counts)) if len(counts) > 1 else 1.0
        return entropy / max_entropy if max_entropy > 0 else 0.0

    def _session_deviation(self, log: dict, history: list[dict]) -> float:
        """
        How far this log's bytes_sent is from the IP's historical average,
        measured as a z-score. Capped at [-5, 5] to avoid blow-ups.
        """
        current_bytes = log.get("bytes_sent", 0) or 0

        past_bytes = [h.get("bytes_sent", 0) or 0 for h in history]
        if len(past_bytes) < 2:
            return 0.0

        mean = np.mean(past_bytes)
        std = np.std(past_bytes)
        if std == 0:
            return 0.0

        z = (current_bytes - mean) / std
        return float(np.clip(z, -5, 5))

    def _ip_frequency_score(self, history: list[dict]) -> float:
        """log(number of requests in the recent window + 1)"""
        return math.log(len(history) + 1)

    def _protocol_anomaly(self, log: dict) -> float:
        """1.0 if the protocol isn't in our common set, 0.0 otherwise"""
        proto = str(log.get("protocol", "TCP"))
        return 0.0 if proto in self.COMMON_PROTOCOLS else 1.0

    def _time_of_day_score(self, log: dict) -> float:
        """
        Normalize the hour of day to [0, 1].
        Attacks tend to cluster in off-hours so this is useful signal.
        """
        ts = log.get("timestamp")
        if ts is None:
            return 0.5  # no timestamp → middle of the range

        if isinstance(ts, str):
            try:
                ts = datetime.fromisoformat(ts)
            except ValueError:
                return 0.5

        if isinstance(ts, datetime):
            return ts.hour / 23.0

        return 0.5

    def extract_features(self, log: dict, history: list[dict]) -> np.ndarray:
        """
        Main entry point. Returns shape (1, 6).
        Pass in the current log dict and a list of recent log dicts
        from the same source IP (last ~5 minutes).
        """
        features = np.array([[
            self._request_rate(log),
            self._port_entropy(history),
            self._session_deviation(log, history),
            self._ip_frequency_score(history),
            self._protocol_anomaly(log),
            self._time_of_day_score(log),
        ]])

        return features


# ============================================================
# Preprocessing Pipeline
# ============================================================

class PreprocessingPipeline:
    """
    Wraps sklearn StandardScaler + train/val splitting.
    Call fit_and_save() once during training, then load_scaler()
    at inference time.
    """

    def __init__(self, scaler_path: str = "data/scaler.pkl"):
        self.scaler_path = scaler_path
        self.scaler = StandardScaler()

    def fit_and_save(self, df: pd.DataFrame, label_col: str = "label"):
        """
        Fit the scaler on training data and dump it to disk.
        Returns (X_train, X_val, y_train, y_val).
        """
        feature_cols = [c for c in df.columns if c != label_col]

        X = df[feature_cols].values.astype(np.float64)
        y = df[label_col].values.astype(int) if label_col in df.columns else None

        # stratified split if we have labels, random otherwise
        if y is not None and len(np.unique(y)) > 1:
            X_train, X_val, y_train, y_val = train_test_split(
                X, y, test_size=0.2, random_state=42, stratify=y
            )
        else:
            X_train, X_val, y_train, y_val = train_test_split(
                X, y, test_size=0.2, random_state=42
            )

        # fit scaler on training set only — prevents data leakage
        self.scaler.fit(X_train)
        X_train = self.scaler.transform(X_train)
        X_val = self.scaler.transform(X_val)

        # save it
        os.makedirs(os.path.dirname(self.scaler_path) or ".", exist_ok=True)
        joblib.dump(self.scaler, self.scaler_path)
        logger.info("Scaler saved to %s", self.scaler_path)

        return X_train, X_val, y_train, y_val

    def load_scaler(self) -> StandardScaler:
        """Load a previously fitted scaler from disk."""
        self.scaler = joblib.load(self.scaler_path)
        logger.info("Scaler loaded from %s", self.scaler_path)
        return self.scaler

    def transform(self, X: np.ndarray) -> np.ndarray:
        """Scale features using the fitted scaler."""
        return self.scaler.transform(X)
