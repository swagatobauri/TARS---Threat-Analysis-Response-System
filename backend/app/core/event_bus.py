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


class ResilientRedis:
    """Mock Redis that falls back to local dictionary if connection fails."""
    def __init__(self, url):
        self.url = url
        self._local = {}
        try:
            self.client = redis.Redis.from_url(url, decode_responses=True, socket_timeout=1)
        except:
            self.client = None

    def get(self, key):
        try:
            return self.client.get(key) if self.client else self._local.get(key)
        except:
            return self._local.get(key)

    def set(self, key, value):
        try:
            if self.client: return self.client.set(key, value)
        except: pass
        self._local[key] = value
        return True

    def delete(self, key):
        try:
            if self.client: return self.client.delete(key)
        except: pass
        self._local.pop(key, None)
        return True

    def publish(self, channel, message):
        try:
            if self.client: return self.client.publish(channel, message)
        except: pass
        return 0

_redis_instance = None

def get_redis_client() -> ResilientRedis:
    global _redis_instance
    if not _redis_instance:
        _redis_instance = ResilientRedis(settings.REDIS_URL)
    return _redis_instance


CHANNEL = "tars:events"
# In-memory bus for Demo Mode
_memory_bus = []


def publish_event(event_type: str, data: Dict[str, Any]) -> None:
    """
    Publish a system event to the Redis pub/sub channel or internal memory bus.
    """
    event = {
        "event_type": event_type,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "payload": data,
    }
    
    client = get_redis_client()
    if client:
        try:
            client.publish(CHANNEL, json.dumps(event))
            return
        except Exception:
            pass
            
    # Fallback to memory bus if Redis is down or not configured
    _memory_bus.append(event)
    # Keep memory bus small
    if len(_memory_bus) > 100:
        _memory_bus.pop(0)


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


def emit_threshold_updated(new_high: float, new_low: float, reason: str) -> None:
    publish_event("threshold_updated", {
        "new_high": new_high,
        "new_low": new_low,
        "reason": reason,
    })

def emit_approval_requested(queue_id: str, ip: str, proposed_action: str, confidence: float, expires_at: str) -> None:
    publish_event("approval_requested", {
        "queue_id": queue_id,
        "ip": ip,
        "proposed_action": proposed_action,
        "confidence": confidence,
        "expires_at": expires_at,
    })

def emit_rollback_executed(ip: str, action_log_id: str, rolled_back_by: str) -> None:
    publish_event("rollback_executed", {
        "ip": ip,
        "action_log_id": action_log_id,
        "rolled_back_by": rolled_back_by,
    })

def emit_kill_chain_progression(ip: str, old_stage: str, new_stage: str, predicted_next: str) -> None:
    publish_event("kill_chain_progression", {
        "ip": ip,
        "old_stage": old_stage,
        "new_stage": new_stage,
        "predicted_next": predicted_next,
    })

def emit_shadow_decision(ip: str, would_have_acted: bool, action: str, score: float) -> None:
    publish_event("shadow_decision", {
        "ip": ip,
        "would_have_acted": would_have_acted,
        "action": action,
        "score": score,
    })

def emit_validation_complete(action_log_id: str, success: bool, delta_score: float) -> None:
    publish_event("validation_complete", {
        "action_log_id": action_log_id,
        "success": success,
        "delta_score": delta_score,
    })
