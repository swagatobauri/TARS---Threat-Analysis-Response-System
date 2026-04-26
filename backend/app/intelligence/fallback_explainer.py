"""
Pure-Python fallback explainer.
Converts the structured reasoning chain into a human-readable text
without relying on any external LLM APIs.
"""

from typing import List, Optional
from app.memory.memory_store import IPProfile

def generate_fallback_explanation(
    reasoning_chain: List[str],
    action_taken: str,
    anomaly_score: float,
    ip_profile: IPProfile,
    attack_pattern: Optional[str] = None
) -> str:
    """
    Constructs a clear, rule-based summary of why an action was taken.
    Used when the Groq API is down, rate-limited, or disabled.
    """
    
    # 1. State the core finding
    risk = ip_profile.risk_category if ip_profile else "UNKNOWN"
    summary = f"Detected {risk} risk anomaly (score: {anomaly_score:.2f}). "
    
    # 2. Add pattern if known
    if attack_pattern:
        pattern_clean = attack_pattern.replace('_', ' ').title()
        summary += f"Matches known pattern: {pattern_clean}. "
        
    # 3. Add history context
    if ip_profile and ip_profile.attack_events > 0:
        summary += f"IP {ip_profile.ip_address} has a history of {ip_profile.attack_events} prior threat events. "
    else:
        summary += "First time offense for this IP. "
        
    # 4. Summarize the reasoning chain
    if reasoning_chain:
        # Pull out the most interesting rules that fired
        highlights = [r for r in reasoning_chain if "escalation" in r.lower() or "time" in r.lower() or "multiplier" in r.lower()]
        if highlights:
            summary += "Key factors: " + "; ".join(highlights) + ". "
            
    # 5. Conclude with the action
    summary += f"Automated response executed: {action_taken}."
    
    return summary
