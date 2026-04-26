"""
TARS Scoring Engine
-------------------
Deterministic decision engine extracted from the intelligence layer.
Converts anomaly scores + contextual signals into concrete actions
(MONITOR, ALERT, RATE_LIMIT, BLOCK_IP) using threshold-based logic.
Decisions are transparent, auditable, and reproducible.
"""
