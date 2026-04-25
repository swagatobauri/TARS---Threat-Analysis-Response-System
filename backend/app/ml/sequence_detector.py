"""
LSTM-based sequence anomaly detector for TARS.

Looks at the last N request_rate values from an IP and predicts
the next one. If the actual value deviates significantly from the
prediction, that's suspicious.

This is an optional module — the system works fine without it.
If PyTorch isn't installed, everything degrades gracefully to
a simple statistical fallback.
"""

import logging
import os
from typing import Optional

import numpy as np

logger = logging.getLogger(__name__)

# try to import torch — if it's not installed, we still work
try:
    import torch
    import torch.nn as nn
    TORCH_AVAILABLE = True
except ImportError:
    TORCH_AVAILABLE = False
    logger.info("PyTorch not available — sequence detector will use statistical fallback")


SEQUENCE_LENGTH = 20  # how many past values we look at


# ============================================================
# The LSTM model (only defined if torch is available)
# ============================================================

if TORCH_AVAILABLE:

    class RequestRateLSTM(nn.Module):
        """
        Tiny LSTM that takes a sequence of request_rate values
        and predicts the next one. Nothing fancy — 1 layer, 32 hidden units.
        """

        def __init__(self, hidden_size=32, num_layers=1):
            super().__init__()
            self.hidden_size = hidden_size
            self.num_layers = num_layers

            self.lstm = nn.LSTM(
                input_size=1,
                hidden_size=hidden_size,
                num_layers=num_layers,
                batch_first=True,
            )
            self.fc = nn.Linear(hidden_size, 1)

        def forward(self, x):
            # x shape: (batch, seq_len, 1)
            out, _ = self.lstm(x)
            # take the last timestep
            last = out[:, -1, :]
            return self.fc(last)


# ============================================================
# Sequence Detector — the public API
# ============================================================

class SequenceDetector:
    """
    Wraps the LSTM model for easy use from the rest of TARS.

    Usage:
        detector = SequenceDetector()
        detector.load("models/sequence_lstm.pt")
        result = detector.predict([1.2, 3.4, 2.1, ...])  # 20 values
        # result = {"predicted_rate": 2.5, "deviation_score": 0.73, "is_anomalous": True}
    """

    # if the actual value is this many std devs from prediction, flag it
    DEVIATION_THRESHOLD = 2.5

    def __init__(self):
        self.model = None
        self._ready = False

        if TORCH_AVAILABLE:
            self.model = RequestRateLSTM()
            self.model.eval()

    def load(self, path: str):
        """Load trained weights from disk."""
        if not TORCH_AVAILABLE:
            logger.warning("Can't load LSTM — torch not installed")
            return self

        if not os.path.exists(path):
            logger.warning("LSTM weights not found at %s — using untrained model", path)
            return self

        self.model.load_state_dict(torch.load(path, map_location="cpu", weights_only=True))
        self.model.eval()
        self._ready = True
        logger.info("Sequence LSTM loaded from %s", path)
        return self

    def save(self, path: str):
        """Save model weights."""
        if not TORCH_AVAILABLE or self.model is None:
            return
        os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
        torch.save(self.model.state_dict(), path)
        logger.info("Sequence LSTM saved to %s", path)

    def predict(self, rate_history: list[float]) -> dict:
        """
        Takes the last SEQUENCE_LENGTH request_rate values and returns:
          - predicted_rate: what the model expected next
          - deviation_score: 0-1, how much the actual deviates
          - is_anomalous: bool
        """
        if len(rate_history) < 2:
            return {"predicted_rate": 0.0, "deviation_score": 0.0, "is_anomalous": False}

        # pad or truncate to SEQUENCE_LENGTH
        seq = list(rate_history[-SEQUENCE_LENGTH:])
        while len(seq) < SEQUENCE_LENGTH:
            seq.insert(0, seq[0])

        actual_last = seq[-1]

        # use the LSTM if available and ready, otherwise fallback
        if TORCH_AVAILABLE and self.model is not None:
            predicted = self._predict_lstm(seq[:-1] + [0.0])  # mask the last value
        else:
            predicted = self._predict_statistical(seq[:-1])

        # compute deviation
        std = max(np.std(seq[:-1]), 0.001)  # avoid div by zero
        deviation = abs(actual_last - predicted) / std
        deviation_score = min(deviation / (self.DEVIATION_THRESHOLD * 2), 1.0)

        return {
            "predicted_rate": round(float(predicted), 4),
            "deviation_score": round(float(deviation_score), 4),
            "is_anomalous": deviation > self.DEVIATION_THRESHOLD,
        }

    def _predict_lstm(self, seq: list[float]) -> float:
        """Run the sequence through the LSTM and get the predicted next value."""
        x = torch.tensor(seq, dtype=torch.float32).unsqueeze(0).unsqueeze(-1)
        with torch.no_grad():
            pred = self.model(x)
        return pred.item()

    def _predict_statistical(self, seq: list[float]) -> float:
        """
        Simple fallback when torch isn't available.
        Uses exponentially weighted moving average — surprisingly effective
        for short-term traffic prediction.
        """
        if not seq:
            return 0.0

        alpha = 0.3
        ewma = seq[0]
        for val in seq[1:]:
            ewma = alpha * val + (1 - alpha) * ewma
        return ewma

    def train_on_sequences(self, sequences: list[list[float]], epochs=50, lr=0.001):
        """
        Train the LSTM on a list of request_rate sequences.
        Each sequence should be SEQUENCE_LENGTH + 1 values
        (the last value is the target).
        """
        if not TORCH_AVAILABLE:
            logger.warning("Can't train LSTM — torch not installed")
            return

        if not sequences:
            logger.warning("No sequences to train on")
            return

        # prep training data
        X_list, y_list = [], []
        for seq in sequences:
            if len(seq) < SEQUENCE_LENGTH + 1:
                continue
            X_list.append(seq[:SEQUENCE_LENGTH])
            y_list.append(seq[SEQUENCE_LENGTH])

        if not X_list:
            logger.warning("No valid sequences after filtering")
            return

        X = torch.tensor(X_list, dtype=torch.float32).unsqueeze(-1)  # (N, seq_len, 1)
        y = torch.tensor(y_list, dtype=torch.float32).unsqueeze(-1)  # (N, 1)

        self.model.train()
        optimizer = torch.optim.Adam(self.model.parameters(), lr=lr)
        loss_fn = nn.MSELoss()

        for epoch in range(epochs):
            optimizer.zero_grad()
            pred = self.model(X)
            loss = loss_fn(pred, y)
            loss.backward()
            optimizer.step()

            if (epoch + 1) % 10 == 0:
                logger.info("Epoch %d/%d  loss=%.6f", epoch + 1, epochs, loss.item())

        self.model.eval()
        self._ready = True
        logger.info("Sequence LSTM trained on %d sequences", len(X_list))
