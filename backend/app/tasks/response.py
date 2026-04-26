"""
TARS Response Executor Task
----------------------------
Executes the defensive action decided by the agent: BLOCK, RATE_LIMIT, ALERT,
or PORT_CLOSE.  Updates IP reputation and writes to the ActionLog audit trail.
"""

import logging
import time
import uuid
from datetime import datetime

from celery import shared_task

from app.db.database import SyncSessionLocal
from app.db.models import ThreatEvent, IPReputation, ActionLog

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------
# Action handlers
# ---------------------------------------------------------------

def _handle_block(source_ip: str, session) -> tuple[bool, str | None]:
    """Block the IP — sets is_blocked on the reputation record."""
    ip_rep = session.get(IPReputation, source_ip)
    if ip_rep is None:
        ip_rep = IPReputation(
            ip_address=source_ip,
            threat_count=1,
            is_blocked=True,
            block_reason="Automated TARS block — high-confidence threat",
            reputation_score=0.0,
            attack_history=[],
        )
        session.add(ip_rep)
    else:
        ip_rep.is_blocked = True
        ip_rep.block_reason = "Automated TARS block — high-confidence threat"
        ip_rep.reputation_score = max(0.0, ip_rep.reputation_score - 0.5)

    logger.info("BLOCK executed — IP %s is now blocked", source_ip)
    return True, None


def _handle_rate_limit(source_ip: str, session) -> tuple[bool, str | None]:
    """Simulate iptables rate-limit rule insertion."""
    # In production this would call out to a firewall API or run an iptables command
    rule = f"iptables -A INPUT -s {source_ip} -m limit --limit 10/min -j ACCEPT"
    logger.info("RATE_LIMIT simulated — rule: %s", rule)

    ip_rep = session.get(IPReputation, source_ip)
    if ip_rep:
        ip_rep.reputation_score = max(0.0, ip_rep.reputation_score - 0.25)

    return True, None


def _handle_alert(source_ip: str, session) -> tuple[bool, str | None]:
    """Log the alert for SOC visibility.  SSE push handled at the API layer."""
    logger.info("ALERT raised — suspicious activity from %s sent to SOC dashboard", source_ip)
    return True, None


def _handle_port_close(source_ip: str, threat_event: ThreatEvent, session) -> tuple[bool, str | None]:
    """Simulate closing the targeted port."""
    logger.info("PORT_CLOSE simulated — blocking traffic from %s on targeted port", source_ip)

    ip_rep = session.get(IPReputation, source_ip)
    if ip_rep:
        ip_rep.reputation_score = max(0.0, ip_rep.reputation_score - 0.4)

    return True, None


# ---------------------------------------------------------------
# Reputation decay — called after every action
# ---------------------------------------------------------------

def _update_reputation(source_ip: str, action: str, session):
    """Apply additional reputation decay based on action severity."""
    ip_rep = session.get(IPReputation, source_ip)
    if ip_rep is None:
        return
    ip_rep.last_seen = datetime.utcnow()


# ---------------------------------------------------------------
# Celery Task
# ---------------------------------------------------------------

@shared_task(name="tasks.execute_response", max_retries=3, default_retry_delay=10)
def execute_response(threat_event_id: str):
    """
    Execute the defensive response for a given ThreatEvent:
    1. Load the threat event
    2. Dispatch to the correct handler
    3. Record an ActionLog entry with timing
    4. Update IP reputation
    """
    session = SyncSessionLocal()
    start = time.perf_counter()

    try:
        # 1. Load threat event
        threat = session.get(ThreatEvent, uuid.UUID(threat_event_id))
        if threat is None:
            logger.error("ThreatEvent %s not found — aborting response", threat_event_id)
            return {"status": "error", "detail": "threat_not_found"}

        source_ip = threat.source_ip
        action = threat.action_taken

        # 2. Dispatch
        handlers = {
            "BLOCK": lambda: _handle_block(source_ip, session),
            "RATE_LIMIT": lambda: _handle_rate_limit(source_ip, session),
            "ALERT": lambda: _handle_alert(source_ip, session),
            "PORT_CLOSE": lambda: _handle_port_close(source_ip, threat, session),
        }

        handler = handlers.get(action)
        if handler is None:
            logger.warning("No handler for action '%s' — skipping execution", action)
            return {"status": "skipped", "action": action}

        success, error_message = handler()

        # 3. Record ActionLog
        elapsed_ms = round((time.perf_counter() - start) * 1000, 2)

        action_log = ActionLog(
            threat_event_id=threat.id,
            action_type=action,
            target_ip=source_ip,
            success=success,
            error_message=error_message,
            execution_time_ms=elapsed_ms,
        )
        session.add(action_log)

        # 4. Update reputation
        _update_reputation(source_ip, action, session)

        session.commit()
        
        # 5. Enqueue validation
        if action != "MONITOR":
            from app.metrics.validator import validate_after_action
            validate_after_action.apply_async(args=[str(action_log.id)], countdown=60)

        logger.info(
            "Response executed — threat=%s  action=%s  ip=%s  time=%.2fms  success=%s",
            threat_event_id, action, source_ip, elapsed_ms, success,
        )

        return {
            "status": "executed",
            "threat_event_id": threat_event_id,
            "action": action,
            "success": success,
            "execution_time_ms": elapsed_ms,
        }

    except Exception as exc:
        session.rollback()
        logger.exception("Response execution failed for threat_event_id=%s", threat_event_id)
        raise exc

    finally:
        session.close()
