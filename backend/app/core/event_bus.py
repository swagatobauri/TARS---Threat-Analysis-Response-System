"""
TARS Event Bus — Redis pub/sub for real-time system-wide event broadcasting.

All components (Celery tasks, action executor, threshold updater) publish here.
The SSE bridge subscribes and streams events to the frontend.
"""

import json
from datetime import datetime, timezone
from typing import Any, Dict

import redis

from app.core.config import settings


def get_redis_client() -> redis.Redis:
    return redis.Redis.from_url(settings.REDIS_URL, decode_responses=True)


CHANNEL = "airs:events"


def publish_event(event_type: str, data: Dict[str, Any]) -> None:
    """
    Publish a system event to the Redis pub/sub channel.

    event_type: one of 'threat_detected', 'action_executed',
                'threshold_updated', 'ip_blocked', 'model_retrained'
    data: arbitrary payload dict
    """
    client = get_redis_client()
    event = {
        "event_type": event_type,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "payload": data,
    }
    client.publish(CHANNEL, json.dumps(event))


# ── Convenience publishers ──

def emit_threat_detected(
    source_ip: str, anomaly_score: float, risk_level: str, log_id: str
) -> None:
    publish_event("threat_detected", {
        "source_ip": source_ip,
        "anomaly_score": anomaly_score,
        "risk_level": risk_level,
        "log_id": log_id,
    })


def emit_action_executed(
    source_ip: str, action: str, success: bool, execution_ms: float
) -> None:
    publish_event("action_executed", {
        "source_ip": source_ip,
        "action": action,
        "success": success,
        "execution_time_ms": execution_ms,
    })


def emit_ip_blocked(ip: str, reason: str) -> None:
    publish_event("ip_blocked", {
        "ip": ip,
        "reason": reason,
    })


def emit_threshold_updated(risk_level: str, old: float, new: float) -> None:
    publish_event("threshold_updated", {
        "risk_level": risk_level,
        "old_threshold": old,
        "new_threshold": new,
    })
