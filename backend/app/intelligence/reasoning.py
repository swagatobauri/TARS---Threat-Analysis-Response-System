"""
TARS Agent Reasoning Engine
---------------------------
The core decision-making brain of AIRS. It evaluates context, history, and risk
to select optimal defensive actions using a weighted multi-factor scoring system
rather than simple rule-based if/else statements.
"""

import logging
from dataclasses import dataclass
from enum import Enum
from typing import List, Tuple, Dict, Optional

# Using string type hints to avoid circular imports if they ever arise
from app.db.models import IPReputation, ThreatEvent

logger = logging.getLogger(__name__)


# ============================================================
# Action Space Definitions
# ============================================================

class ActionSpace(Enum):
    """
    Available defensive actions.
    Values are: (db_value, severity, reversibility, escalation_cost)
    """
    MONITOR = ("MONITOR", 1, True, 0.0)
    ALERT = ("ALERT", 2, True, 0.1)
    RATE_LIMIT = ("RATE_LIMIT", 3, True, 0.4)
    BLOCK_IP = ("BLOCK", 4, False, 0.8)
    SIMULATE_PORT_CLOSE = ("PORT_CLOSE", 5, False, 0.9)

    def __init__(self, db_value: str, severity: int, reversibility: bool, escalation_cost: float):
        self.db_value = db_value
        self.severity = severity
        self.reversibility = reversibility
        self.escalation_cost = escalation_cost


# ============================================================
# Context & Decision Dataclasses
# ============================================================

@dataclass
class AgentContext:
    anomaly_score: float
    risk_level: str
    source_ip: str
    ip_history: Optional[IPReputation]
    recent_decisions: List[ThreatEvent]  # last 10 for this IP
    time_of_day: int
    attack_type_guess: Optional[str]
    confidence: float


@dataclass
class AgentDecision:
    action: ActionSpace
    confidence: float
    reasoning_chain: List[str]
    alternatives: List[Tuple[ActionSpace, float]]
    estimated_risk_reduction: float


# ============================================================
# Core Reasoning Engine
# ============================================================

class ReasoningEngine:
    """
    Evaluates context, history, and risk to select optimal actions.
    Uses multi-factor scoring.
    """

    def evaluate_context(self, ctx: AgentContext, reasoning_chain: List[str]) -> Dict[ActionSpace, float]:
        """
        Computes a score for every possible action based on the context.
        Returns a dictionary mapping ActionSpace to its computed score.
        """
        action_scores = {action: 0.0 for action in ActionSpace}

        # 1. Base Score from Anomaly Score
        # Higher anomaly scores generally push towards more severe actions.
        reasoning_chain.append(f"Anomaly score {ctx.anomaly_score:.4f} → {ctx.risk_level} risk")
        
        base_multiplier = ctx.anomaly_score
        
        for action in ActionSpace:
            # A rough heuristic: action severity normalized (1 to 5) -> (0.2 to 1.0)
            # We want the action's normalized severity to match the base_multiplier.
            normalized_severity = action.severity / 5.0
            
            # The closer the severity matches the anomaly score, the higher the base score
            # But we also don't want to penalize higher severity actions if anomaly is very high.
            if ctx.anomaly_score >= 0.8 and action.severity >= 4:
                action_scores[action] += 1.0
            elif ctx.anomaly_score < 0.4 and action.severity <= 2:
                action_scores[action] += 1.0
            else:
                # Gaussian-like distance
                distance = abs(normalized_severity - base_multiplier)
                action_scores[action] += max(0, 1.0 - (distance * 2))

        # 2. History Multiplier
        repeat_offense_count = ctx.ip_history.threat_count if ctx.ip_history else 0
        if repeat_offense_count > 0:
            history_multiplier = 1.0 + (0.15 * repeat_offense_count)
            reasoning_chain.append(f"IP {ctx.source_ip} has {repeat_offense_count} prior incidents (multiplier: {history_multiplier:.2f})")
            
            # Boost severe actions for repeat offenders
            for action in ActionSpace:
                if action.severity >= 3:
                    action_scores[action] *= history_multiplier
        else:
            reasoning_chain.append(f"IP {ctx.source_ip} is a first-time offender")

        # 3. Time of Day Weight (2 AM - 6 AM is highly suspicious)
        if 2 <= ctx.time_of_day <= 6:
            time_weight = 1.2
            reasoning_chain.append(f"Time {ctx.time_of_day:02d}:00 → elevated threat weight applied (off-hours)")
            for action in ActionSpace:
                if action.severity >= 3:
                    action_scores[action] *= time_weight

        # 4. Confidence Penalty
        if ctx.confidence < 0.5:
            reasoning_chain.append(f"Low confidence ({ctx.confidence:.2f}) → penalizing severe actions")
            for action in ActionSpace:
                if action.severity >= 4:
                    action_scores[action] *= 0.5  # Heavy penalty for low confidence

        # 5. Reversibility Preference
        if ctx.confidence < 0.7:
            reasoning_chain.append(f"Confidence {ctx.confidence:.2f} < 0.70 → preferring reversible actions")
            for action in ActionSpace:
                if action.reversibility:
                    action_scores[action] += 0.3  # Bump up reversible actions

        # 6. Escalation Guard
        # Don't jump from MONITOR to BLOCK without RATE_LIMIT first, unless CRITICAL
        highest_past_severity = 0
        if ctx.recent_decisions:
            # Map DB strings to severity
            action_map = {a.db_value: a.severity for a in ActionSpace}
            highest_past_severity = max([action_map.get(d.action_taken, 0) for d in ctx.recent_decisions])
        
        for action in ActionSpace:
            # If proposing a severe action (4 or 5)
            if action.severity >= 4:
                # If we haven't even rate limited or alerted before, and it's not CRITICAL
                if highest_past_severity < 3 and ctx.risk_level != "CRITICAL":
                    action_scores[action] -= action.escalation_cost
                    # Only add to reasoning chain if it was a top contender (heuristic check)
                    if action_scores[action] + action.escalation_cost > 1.5:
                        reasoning_chain.append(f"{action.name} penalized (escalation_guard active: no prior severe actions)")

        return action_scores

    def decide(self, ctx: AgentContext) -> AgentDecision:
        """
        Evaluates the context and returns the final AgentDecision.
        """
        from app.safety.fp_mitigation import FalsePositiveMitigator
        
        # 1. FP Mitigation Check
        mitigator = FalsePositiveMitigator()
        history_dicts = [{"action": t.action_taken, "score": t.confidence_score} for t in ctx.recent_decisions] if ctx.recent_decisions else []
        fp_assessment = mitigator.evaluate_for_fp_risk(ctx.anomaly_score, ctx.source_ip, history_dicts)
        
        # Adjust confidence based on FP risk
        ctx.confidence = fp_assessment.adjusted_confidence
        
        reasoning_chain = []
        if fp_assessment.risk_factors:
            reasoning_chain.append(f"FP Risk {fp_assessment.fp_risk_score:.2f} Factors: {', '.join(fp_assessment.risk_factors)}")
        reasoning_chain.append(f"FP Mitigation Recommendation: {fp_assessment.recommendation}")

        # 2. Evaluate context with adjusted confidence
        action_scores = self.evaluate_context(ctx, reasoning_chain)

        # Sort actions by score descending
        sorted_actions = sorted(action_scores.items(), key=lambda item: item[1], reverse=True)
        
        best_action, best_score = sorted_actions[0]
        
        # Calculate a pseudo-confidence based on the score margin between 1st and 2nd choice
        margin = 0.0
        if len(sorted_actions) > 1:
            margin = best_score - sorted_actions[1][1]
        
        # Base decision confidence is context confidence adjusted by the score margin
        decision_confidence = min(1.0, ctx.confidence * (1.0 + (margin * 0.1)))

        # Log the selection
        if len(sorted_actions) > 1:
            runner_up, _ = sorted_actions[1]
            reasoning_chain.append(f"{best_action.name} selected over {runner_up.name}")
        else:
            reasoning_chain.append(f"{best_action.name} selected")

        # Estimate risk reduction (heuristic: severity * confidence)
        estimated_risk_reduction = (best_action.severity / 5.0) * decision_confidence

        return AgentDecision(
            action=best_action,
            confidence=round(decision_confidence, 4),
            reasoning_chain=reasoning_chain,
            alternatives=sorted_actions[1:],
            estimated_risk_reduction=round(estimated_risk_reduction, 4)
        )
