"""
TARS Agent Reasoning Task
-------------------------
Takes a scored anomaly, gathers IP reputation context, decides on an action,
calls Groq for a natural-language explanation, and persists the ThreatEvent.
"""

import logging
import uuid
from datetime import datetime

from celery import shared_task

from app.core.config import settings
from app.db.database import SyncSessionLocal
from app.db.models import AnomalyScore, NetworkLog, ThreatEvent, IPReputation

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------
# Threat-type classifier (heuristic, will be replaced by full
# agent reasoning engine in Phase 3)
# ---------------------------------------------------------------

def _classify_threat_type(features: dict) -> str:
    """Map feature patterns to human-readable threat categories."""
    if features.get("request_rate", 0) > 500:
        return "DDoS / Volumetric Flood"
    if features.get("port_entropy", 0) > 0.9:
        return "Port Scan / Reconnaissance"
    if features.get("session_deviation", 0) > 0.8:
        return "Session Hijack / Anomalous Burst"
    if features.get("repeated_offender", False):
        return "Persistent Threat / Repeat Offender"
    return "Unknown Anomaly"


# ---------------------------------------------------------------
# Action decision engine (rule-based placeholder — will be
# replaced by LLM-guided reasoning in the agent module)
# ---------------------------------------------------------------

def _decide_action(combined_score: float, risk_level: str, repeated_offender: bool) -> str:
    """
    Determine the response action based on score, risk, and history.
    Returns one of: MONITOR, ALERT, RATE_LIMIT, BLOCK, PORT_CLOSE.
    """
    if risk_level == "CRITICAL" or (repeated_offender and combined_score > 0.75):
        return "BLOCK"
    if risk_level == "HIGH":
        return "RATE_LIMIT" if not repeated_offender else "BLOCK"
    if risk_level == "MEDIUM":
        return "ALERT"
    return "MONITOR"


# ---------------------------------------------------------------
# Groq LLM explanation generator
# ---------------------------------------------------------------

def _generate_explanation(context: dict) -> str:
    """
    Call Groq to produce a natural-language explanation of the agent's decision.
    Falls back to a template string when the API key is missing.
    """
    if not settings.GROQ_API_KEY:
        return (
            f"[Auto-generated] Anomaly detected from {context['ip']} with combined score "
            f"{context['score']:.4f} (risk: {context['risk_level']}). "
            f"Action taken: {context['action']}. "
            f"IP has {context['history_count']} prior incident(s). "
            f"Repeated offender: {context['repeated_offender']}."
        )

    try:
        from groq import Groq

        client = Groq(api_key=settings.GROQ_API_KEY)
        prompt = (
            "You are TARS, an autonomous intrusion response agent. "
            "Explain the following security decision in 2-3 sentences for a SOC analyst.\n\n"
            f"Source IP: {context['ip']}\n"
            f"Combined anomaly score: {context['score']:.4f}\n"
            f"Risk level: {context['risk_level']}\n"
            f"Threat type: {context['threat_type']}\n"
            f"Prior incidents from this IP: {context['history_count']}\n"
            f"Repeated offender: {context['repeated_offender']}\n"
            f"Action decided: {context['action']}\n"
        )

        completion = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.3,
            max_tokens=256,
        )
        return completion.choices[0].message.content.strip()

    except Exception as exc:
        logger.warning("Groq API call failed, using template: %s", exc)
        return (
            f"[Fallback] Score {context['score']:.4f} / risk {context['risk_level']}. "
            f"Action: {context['action']}."
        )


# ---------------------------------------------------------------
# Celery Task
# ---------------------------------------------------------------

@shared_task(bind=True, name="tasks.run_agent_reasoning", max_retries=3, default_retry_delay=15)
def run_agent_reasoning(self, anomaly_score_id: str):
    """
    Agent reasoning pipeline:
    1. Load anomaly score + parent log
    2. Fetch / create IP reputation record
    3. Decide action
    4. Generate LLM explanation via Groq
    5. Persist ThreatEvent
    6. Chain to execute_response if action != MONITOR
    """
    session = SyncSessionLocal()

    try:
        # 1. Load anomaly score and its parent log
        anomaly = session.get(AnomalyScore, uuid.UUID(anomaly_score_id))
        if anomaly is None:
            logger.error("AnomalyScore %s not found — aborting", anomaly_score_id)
            return {"status": "error", "detail": "anomaly_not_found"}

        log = session.get(NetworkLog, anomaly.log_id)
        if log is None:
            logger.error("Parent NetworkLog %s not found", anomaly.log_id)
            return {"status": "error", "detail": "log_not_found"}

        source_ip = log.source_ip

        # 2. Fetch or initialise IP reputation
        ip_rep = session.get(IPReputation, source_ip)
        if ip_rep is None:
            ip_rep = IPReputation(
                ip_address=source_ip,
                threat_count=0,
                last_seen=datetime.utcnow(),
                is_blocked=False,
                reputation_score=1.0,
                attack_history=[],
            )
            session.add(ip_rep)
            session.flush()

        repeated_offender = ip_rep.threat_count >= 3

        # 3. Decide action
        action = _decide_action(anomaly.combined_score, anomaly.risk_level, repeated_offender)

        # Build context for the LLM explanation
        threat_type = _classify_threat_type({
            "request_rate": log.request_rate or 0,
            "port_entropy": 0,  # would come from features in production
            "session_deviation": anomaly.behavioral_deviation,
            "repeated_offender": repeated_offender,
        })

        context = {
            "ip": source_ip,
            "score": anomaly.combined_score,
            "risk_level": anomaly.risk_level,
            "threat_type": threat_type,
            "history_count": ip_rep.threat_count,
            "repeated_offender": repeated_offender,
            "action": action,
        }

        # 4. Generate LLM explanation
        explanation = _generate_explanation(context)

        # 5. Persist ThreatEvent
        threat_event = ThreatEvent(
            source_ip=source_ip,
            threat_type=threat_type,
            confidence_score=anomaly.combined_score,
            action_taken=action,
            agent_reasoning=explanation,
            resolved=False,
        )
        session.add(threat_event)

        # Update IP reputation
        ip_rep.threat_count += 1
        ip_rep.last_seen = datetime.utcnow()
        ip_rep.attack_history = ip_rep.attack_history + [{
            "timestamp": datetime.utcnow().isoformat(),
            "score": anomaly.combined_score,
            "action": action,
            "threat_type": threat_type,
        }]

        session.commit()
        session.refresh(threat_event)

        logger.info(
            "Agent decision — ip=%s  action=%s  confidence=%.4f  threat=%s",
            source_ip, action, anomaly.combined_score, threat_type,
        )

        # 6. Chain to response executor if action is not just monitoring
        if action != "MONITOR":
            from app.tasks.response import execute_response
            execute_response.delay(str(threat_event.id))

        return {
            "status": "decided",
            "threat_event_id": str(threat_event.id),
            "action": action,
            "threat_type": threat_type,
        }

    except Exception as exc:
        session.rollback()
        logger.exception("Agent reasoning failed for anomaly_score_id=%s", anomaly_score_id)
        raise self.retry(exc=exc)

    finally:
        session.close()
