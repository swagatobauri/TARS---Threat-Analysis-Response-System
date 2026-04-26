"""
TARS Intelligence Layer
-----------------------
The intelligence layer provides LLM-powered threat analysis, reasoning, and
natural-language incident reporting. It does NOT make deterministic decisions —
those live in the scoring module. Instead, it provides contextual enrichment
and human-readable explanations for actions the scoring engine has already decided.

Components:
    - ReasoningEngine: Multi-factor contextual threat analysis
    - ThreatExplainer: LLM-powered incident report generation (Groq / LLaMA)
    - FallbackExplainer: Template-based explanations when LLM is unavailable
"""

from app.intelligence.reasoning import ReasoningEngine, AgentContext, AgentDecision, ActionSpace
from app.intelligence.explainer import ThreatExplainer, RiskSummaryGenerator
from app.intelligence.fallback_explainer import generate_fallback_explanation
