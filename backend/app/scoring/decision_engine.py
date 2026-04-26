"""
Deterministic decision engine. Takes numeric inputs, returns action.
No ML inference, no LLM calls. Fully auditable.
Every action must be traceable to a specific score and threshold.
"""

import logging
from dataclasses import dataclass
from typing import Dict, Optional

from app.core.config import Settings
from app.db.models import IPReputation, AnomalyScore
from app.safety.fp_mitigation import FPRiskAssessment

logger = logging.getLogger(__name__)

@dataclass
class FinalDecision:
    action: str
    final_score: float
    score_breakdown: Dict[str, float]

class ScoringEngine:
    """
    Deterministic decision engine. Takes numeric inputs, returns action.
    No ML inference, no LLM calls. Fully auditable.
    Every action must be traceable to a specific score and threshold.
    """
    def decide(
        self,
        anomaly_score: AnomalyScore,
        ip_profile: Optional[IPReputation],
        kill_chain_stage: Optional[str],
        fp_assessment: FPRiskAssessment,
        settings: Settings
    ) -> FinalDecision:
        base_score = anomaly_score.combined_score
        
        # Kill Chain Multiplier
        kc_multiplier = 1.0
        if kill_chain_stage:
            stage_multipliers = {
                "RECONNAISSANCE": 1.1,
                "ENUMERATION": 1.3,
                "EXPLOITATION": 1.6,
                "PERSISTENCE": 1.8
            }
            kc_multiplier = stage_multipliers.get(kill_chain_stage, 1.0)
            
        fp_adj = 1.0 - fp_assessment.fp_risk_score
        
        final_score = base_score * kc_multiplier * fp_adj
        final_score = min(max(final_score, 0.0), 1.0)
        
        score_breakdown = {
            "base_score": base_score,
            "kill_chain_multiplier": kc_multiplier,
            "fp_adjustment": fp_adj,
            "escalation_guard_applied": 0.0
        }
        
        action = "MONITOR"
        high_threshold = getattr(settings, 'HIGH_CONFIDENCE_THRESHOLD', 0.8)
        med_threshold = getattr(settings, 'MEDIUM_CONFIDENCE_THRESHOLD', 0.5)
        
        if final_score >= high_threshold:
            action = "BLOCK"
        elif final_score >= 0.65:
            action = "RATE_LIMIT"
        elif final_score >= med_threshold:
            action = "ALERT"

        # Apply Escalation Guard
        # Cannot jump more than 1 tier without 2+ correlated events
        # Exception: CRITICAL risk (score > 0.9) can jump directly to BLOCK
        if action in ["BLOCK", "RATE_LIMIT"] and final_score <= 0.9:
            threat_count = ip_profile.threat_count if ip_profile else 0
            
            if threat_count < 2:
                # Downgrade action
                if action == "BLOCK":
                    action = "RATE_LIMIT"
                elif action == "RATE_LIMIT":
                    action = "ALERT"
                score_breakdown["escalation_guard_applied"] = 1.0
                logger.info("Escalation guard applied. Action downgraded to %s", action)
                
        return FinalDecision(
            action=action,
            final_score=final_score,
            score_breakdown=score_breakdown
        )
