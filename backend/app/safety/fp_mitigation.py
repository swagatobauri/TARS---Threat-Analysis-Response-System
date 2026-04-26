import json
import logging
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import List, Dict, Any

from app.core.event_bus import get_redis_client

logger = logging.getLogger(__name__)

@dataclass
class FPRiskAssessment:
    fp_risk_score: float
    risk_factors: List[str]
    recommendation: str
    adjusted_confidence: float

class CooldownTracker:
    def __init__(self):
        self.redis = get_redis_client()
        
    def record_alert(self, ip: str) -> None:
        key = f"tars:cooldown:{ip}"
        self.redis.setex(key, 600, "1")  # TTL 10 minutes
        
    def is_in_cooldown(self, ip: str) -> bool:
        return self.redis.exists(f"tars:cooldown:{ip}") > 0

class MultiEventCorrelator:
    def __init__(self):
        self.redis = get_redis_client()
        
    def add_event(self, ip: str, anomaly_score: float, timestamp: datetime) -> None:
        key = f"tars:correlation:{ip}"
        event = {
            "score": anomaly_score,
            "ts": timestamp.timestamp()
        }
        self.redis.lpush(key, json.dumps(event))
        self.redis.expire(key, 300)  # 5 minutes TTL
        
    def get_correlation_score(self, ip: str, window_minutes: int = 5) -> float:
        key = f"tars:correlation:{ip}"
        events_json = self.redis.lrange(key, 0, -1)
        if not events_json:
            return 0.0
            
        now = datetime.now(timezone.utc).timestamp()
        valid_events = []
        for ej in events_json:
            e = json.loads(ej)
            if now - e["ts"] <= window_minutes * 60:
                valid_events.append(e)
                
        if len(valid_events) >= 3:
            return 1.0  # High correlation -> NOT a false positive
        return 0.0

    def is_pattern_emerging(self, ip: str) -> bool:
        return self.get_correlation_score(ip) >= 1.0

class FalsePositiveMitigator:
    def __init__(self):
        self.cooldown = CooldownTracker()
        self.correlator = MultiEventCorrelator()

    def evaluate_for_fp_risk(self, anomaly_score: float, ip: str, history: List[Dict[str, Any]]) -> FPRiskAssessment:
        factors = []
        fp_risk_score = 0.0
        
        # 1. Cooldown factor
        if self.cooldown.is_in_cooldown(ip):
            fp_risk_score += 0.3
            factors.append("IP in cooldown (recently alerted)")
            
        # 2. Correlation factor
        is_pattern = self.correlator.is_pattern_emerging(ip)
        if not is_pattern:
            fp_risk_score += 0.4
            factors.append("Single isolated event (no emerging pattern)")
            
        # 3. History factor
        if not history:
            fp_risk_score += 0.2
            factors.append("Zero prior incidents (first time seen)")
            
        # Ensure max risk score is 0.9 (we never drop confidence to 0)
        fp_risk_score = min(fp_risk_score, 0.9)
        
        adjusted_confidence = anomaly_score * (1.0 - fp_risk_score)
        
        if fp_risk_score > 0.5:
            recommendation = "High FP risk. Downgrade response to MONITOR or ALERT."
        elif fp_risk_score > 0.2:
            recommendation = "Moderate FP risk. Consider ALERT."
        else:
            recommendation = "Low FP risk. Proceed with autonomous response."
            
        return FPRiskAssessment(
            fp_risk_score=fp_risk_score,
            risk_factors=factors,
            recommendation=recommendation,
            adjusted_confidence=adjusted_confidence
        )
