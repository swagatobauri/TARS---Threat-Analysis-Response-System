import logging
import uuid
import json
from datetime import datetime, timedelta, timezone
from dataclasses import dataclass
from celery import shared_task
from sqlalchemy import select, func
from sqlalchemy.orm import Session

from app.db.database import SyncSessionLocal
from app.db.models import ActionLog, AnomalyScore, ThreatEvent, DetectionMetric, ShadowDecision, FalsePositiveFeedback
from app.core.config import settings
from app.core.event_bus import emit_validation_complete

try:
    from app.db.models import BusinessImpactRecord
except ImportError:
    pass

logger = logging.getLogger(__name__)

@dataclass
class ValidationResult:
    score_before: float
    score_after: float
    delta: float
    success: bool
    attack_resumed: bool

class ActionValidator:
    def validate_action(self, session: Session, action_log_id: str, wait_seconds: int = 60) -> ValidationResult:
        action_log = session.get(ActionLog, uuid.UUID(action_log_id))
        if not action_log:
            raise ValueError(f"ActionLog {action_log_id} not found")
            
        ip = action_log.target_ip
        action_time = action_log.created_at
        
        # Pull anomaly scores before action
        before_query = select(AnomalyScore).where(
            AnomalyScore.source_ip == ip,
            AnomalyScore.created_at <= action_time
        ).order_by(AnomalyScore.created_at.desc()).limit(5)
        
        scores_before = session.execute(before_query).scalars().all()
        score_before = sum(s.combined_score for s in scores_before) / len(scores_before) if scores_before else 0.0
        
        # Pull anomaly scores in validation window
        window_end = action_time + timedelta(seconds=wait_seconds)
        after_query = select(AnomalyScore).where(
            AnomalyScore.source_ip == ip,
            AnomalyScore.created_at > action_time,
            AnomalyScore.created_at <= window_end
        )
        
        scores_after = session.execute(after_query).scalars().all()
        score_after = sum(s.combined_score for s in scores_after) / len(scores_after) if scores_after else 0.0
        
        delta = score_before - score_after
        success = delta > 0.15
        
        # Check if attack resumed (score spiked after initial drop)
        attack_resumed = False
        if scores_after:
            max_after = max(s.combined_score for s in scores_after)
            if max_after > score_before - 0.1:
                attack_resumed = True
                
        result = ValidationResult(
            score_before=score_before,
            score_after=score_after,
            delta=delta,
            success=success,
            attack_resumed=attack_resumed
        )
        
        action_log.validation_result = {
            "score_before": score_before,
            "score_after": score_after,
            "delta": delta,
            "success": success,
            "attack_resumed": attack_resumed
        }
        
        session.commit()
        
        emit_validation_complete(
            action_log_id=action_log_id,
            success=success,
            delta_score=delta
        )
        
        return result


class MetricsComputer:
    def compute_window_metrics(self, session: Session, window_minutes: int = 15) -> DetectionMetric:
        since = datetime.now(timezone.utc) - timedelta(minutes=window_minutes)
        
        # TP: Action validation showed success
        # Wait, the prompt says "ThreatEvents where validation showed success=True"
        # Since validation is saved in ActionLog.validation_result, we count ActionLogs.
        tp_query = select(ActionLog).where(ActionLog.created_at >= since)
        logs = session.execute(tp_query).scalars().all()
        
        true_positives = sum(1 for log in logs if log.validation_result and log.validation_result.get("success", False))
        
        # FP: Marked as FP or rolled back
        fp_query = select(FalsePositiveFeedback).where(
            FalsePositiveFeedback.created_at >= since,
            FalsePositiveFeedback.was_false_positive == True
        )
        fps = session.execute(fp_query).scalars().all()
        false_positives = len(fps)
        
        # FN: Estimated from ShadowDecision logs (would have blocked but we didn't, or high score but no action)
        shadow_query = select(ShadowDecision).where(
            ShadowDecision.timestamp >= since,
            ShadowDecision.would_have_taken_action.in_(["BLOCK", "RATE_LIMIT"])
        )
        shadows = session.execute(shadow_query).scalars().all()
        false_negatives = len(shadows) # simplistic estimation
        
        precision = true_positives / (true_positives + false_positives) if (true_positives + false_positives) > 0 else 0.0
        recall = true_positives / (true_positives + false_negatives) if (true_positives + false_negatives) > 0 else 0.0
        
        tn_estimated = 1000 # hardcode TN for rate estimation, real system would count legitimate traffic
        fpr = false_positives / (false_positives + tn_estimated)
        
        # latency: ThreatEvent.created_at - AnomalyScore.created_at ? Actually we just use avg ActionLog.execution_time_ms
        latency_query = select(func.avg(ActionLog.execution_time_ms)).where(
            ActionLog.created_at >= since,
            ActionLog.action_type == "DECISION_ENGINE"
        )
        avg_latency = session.execute(latency_query).scalar() or 0.0
        
        f1_score = 2 * (precision * recall) / (precision + recall) if (precision + recall) > 0 else 0.0
        
        metric = DetectionMetric(
            measured_at=datetime.now(timezone.utc),
            true_positives=true_positives,
            false_positives=false_positives,
            false_negatives=false_negatives,
            precision=precision,
            recall=recall,
            f1_score=f1_score,
            false_positive_rate=fpr
        )
        
        session.add(metric)
        session.commit()
        return metric


class BusinessImpactCalculator:
    def compute_daily_impact(self, session: Session, date: datetime):
        start_of_day = date.replace(hour=0, minute=0, second=0, microsecond=0)
        end_of_day = start_of_day + timedelta(days=1)
        
        blocked_query = select(ActionLog.target_ip).where(
            ActionLog.created_at >= start_of_day,
            ActionLog.created_at < end_of_day,
            ActionLog.action_type == "BLOCK"
        ).distinct()
        
        blocked_ips = session.execute(blocked_query).scalars().all()
        num_blocked_ips = len(blocked_ips)
        
        estimated_avg_requests_per_blocked_ip = 500
        requests_blocked = num_blocked_ips * estimated_avg_requests_per_blocked_ip
        
        cost_saved_usd = requests_blocked * settings.COST_PER_BLOCKED_REQUEST
        
        threat_query = select(func.count(ThreatEvent.id)).where(
            ThreatEvent.created_at >= start_of_day,
            ThreatEvent.created_at < end_of_day
        )
        total_threat_events = session.execute(threat_query).scalar() or 0
        
        analyst_hours_saved = total_threat_events * 0.083 # 5 min per alert
        
        # Just log it or insert if model exists
        try:
            from app.db.models import BusinessImpactRecord
            record = BusinessImpactRecord(
                measured_at=datetime.now(timezone.utc),
                requests_blocked=requests_blocked,
                cost_saved_usd=cost_saved_usd,
                analyst_hours_saved=analyst_hours_saved
            )
            session.add(record)
            session.commit()
            return record
        except ImportError:
            logger.info(f"Business Impact - Blocked: {requests_blocked}, Saved: ${cost_saved_usd:.2f}, Hours Saved: {analyst_hours_saved:.1f}")
            return None


@shared_task(bind=True, name="tasks.validate_after_action", max_retries=3)
def validate_after_action(self, action_log_id: str):
    session = SyncSessionLocal()
    try:
        validator = ActionValidator()
        validator.validate_action(session, action_log_id)
    except Exception as exc:
        session.rollback()
        logger.exception(f"Failed to validate action {action_log_id}")
        raise self.retry(exc=exc)
    finally:
        session.close()

@shared_task(bind=True, name="tasks.compute_metrics_15m")
def compute_metrics_15m(self):
    session = SyncSessionLocal()
    try:
        computer = MetricsComputer()
        computer.compute_window_metrics(session, window_minutes=15)
    except Exception as exc:
        session.rollback()
        raise self.retry(exc=exc)
    finally:
        session.close()

@shared_task(bind=True, name="tasks.compute_daily_impact")
def compute_daily_impact(self):
    session = SyncSessionLocal()
    try:
        calculator = BusinessImpactCalculator()
        calculator.compute_daily_impact(session, datetime.now(timezone.utc))
    except Exception as exc:
        session.rollback()
        raise self.retry(exc=exc)
    finally:
        session.close()
