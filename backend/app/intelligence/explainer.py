"""
Groq-powered Threat Explainer for AIRS.
Turns raw JSON context and scoring into clean, concise human-readable summaries
for SOC analysts.
"""

import time
import logging
import uuid
from typing import List, Optional

from groq import AsyncGroq, APIConnectionError, APITimeoutError, RateLimitError

from app.core.config import settings
from app.db.database import AsyncSessionLocal
from app.db.models import ActionLog, ThreatEvent
from app.memory.memory_store import IPProfile
from app.agent.fallback_explainer import generate_fallback_explanation

logger = logging.getLogger(__name__)

class ThreatExplainer:
    def __init__(self):
        self.client = AsyncGroq(api_key=settings.GROQ_API_KEY) if settings.GROQ_API_KEY else None

    async def explain_threat(
        self,
        reasoning_chain: List[str],
        action_taken: str,
        anomaly_score: float,
        ip_profile: IPProfile,
        attack_pattern: Optional[str] = None,
        threat_event_id: Optional[str] = None,
        **kwargs
    ) -> str:
        """
        Builds a structured prompt and calls Groq for a clear explanation.
        Handles rate limits and timeouts via a local fallback.
        """
        # If API key is missing, immediately fallback
        if not self.client:
            return generate_fallback_explanation(
                reasoning_chain, action_taken, anomaly_score, ip_profile, attack_pattern
            )

        system_prompt = (
            "You are a cybersecurity analyst AI. Given structured detection data, "
            "write a clear, concise 2-3 sentence explanation of the threat and action taken. "
            "If kill chain stage data is provided, describe where in the attack lifecycle "
            "the attacker is and what the predicted next step is. Be specific about stages. "
            "Be professional and avoid jargon."
        )

        user_content = (
            f"Source IP: {ip_profile.ip_address if ip_profile else 'Unknown'}\n"
            f"Anomaly Score: {anomaly_score:.4f}\n"
            f"Attack Pattern: {attack_pattern or 'None detected'}\n"
            f"Kill Chain Stage: {kwargs.get('kill_chain_stage', 'Unknown')}\n"
            f"Action Taken: {action_taken}\n"
            f"History: {len(ip_profile.attack_events) if ip_profile and getattr(ip_profile, 'attack_events', None) else 0} prior attack events\n"
            f"Reasoning Chain:\n" + "\n".join([f"- {r}" for r in reasoning_chain])
        )

        start_time = time.perf_counter()
        
        try:
            completion = await self.client.chat.completions.create(
                model="llama3-8b-8192",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_content}
                ],
                max_tokens=150,
                temperature=0.3
            )
            
            explanation = completion.choices[0].message.content.strip()
            success = True
            error_msg = None
            
        except RateLimitError as e:
            logger.warning("Groq rate limit hit. Falling back to local explanation. Enqueuing retry...")
            explanation = generate_fallback_explanation(
                reasoning_chain, action_taken, anomaly_score, ip_profile, attack_pattern
            )
            success = False
            error_msg = "RateLimitError: " + str(e)
            
        except (APIConnectionError, APITimeoutError, Exception) as e:
            logger.warning("Groq API error: %s. Using fallback.", e)
            explanation = generate_fallback_explanation(
                reasoning_chain, action_taken, anomaly_score, ip_profile, attack_pattern
            )
            success = False
            error_msg = str(e)

        latency_ms = (time.perf_counter() - start_time) * 1000

        # Log to ActionLog if we have a threat_event_id
        if threat_event_id:
            await self._log_api_call(threat_event_id, success, latency_ms, error_msg)

        return explanation

    async def _log_api_call(self, threat_event_id: str, success: bool, latency_ms: float, error_msg: Optional[str]):
        """Logs the Groq API call performance to the ActionLog."""
        async with AsyncSessionLocal() as session:
            try:
                log = ActionLog(
                    threat_event_id=uuid.UUID(threat_event_id),
                    action_type="LLM_EXPLANATION",
                    target_ip="GROQ_API",
                    success=success,
                    error_message=error_msg[:1000] if error_msg else None,
                    execution_time_ms=latency_ms
                )
                session.add(log)
                await session.commit()
            except Exception as e:
                logger.error("Failed to log Groq call to ActionLog: %s", e)


class RiskSummaryGenerator:
    def __init__(self):
        self.client = AsyncGroq(api_key=settings.GROQ_API_KEY) if settings.GROQ_API_KEY else None

    async def generate_daily_summary(self, threat_events: List[ThreatEvent], date: str) -> str:
        """
        Creates a high-level summary of the day's threats for the dashboard.
        """
        if not self.client:
            return "Daily summary generation requires Groq API key."
            
        if not threat_events:
            return f"No threats recorded for {date}."

        # Aggregate data
        total = len(threat_events)
        critical = sum(1 for t in threat_events if getattr(t, 'confidence_score', 0) > 0.8)
        actions = {}
        for t in threat_events:
            actions[t.action_taken] = actions.get(t.action_taken, 0) + 1

        system_prompt = (
            "You are a CISO reporting assistant. Summarize the daily threat activity "
            "into exactly 3 concise bullet points. Be analytical and executive-friendly."
        )
        
        user_content = (
            f"Date: {date}\n"
            f"Total Threats: {total}\n"
            f"Critical Threats: {critical}\n"
            f"Actions Breakdown: {actions}\n"
        )
        
        try:
            completion = await self.client.chat.completions.create(
                model="llama3-8b-8192",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_content}
                ],
                max_tokens=200,
                temperature=0.4
            )
            return completion.choices[0].message.content.strip()
            
        except Exception as e:
            logger.error("Failed to generate daily summary: %s", e)
            return f"Error generating daily summary: {e}"
