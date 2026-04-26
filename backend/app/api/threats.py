from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc
from typing import List, Optional
import uuid
from datetime import datetime

from app.db.database import get_db
from app.db.models import ThreatEvent, AnomalyScore
from app.api.schemas import ThreatEventBase, ThreatStats

router = APIRouter()

@router.get("", response_model=List[ThreatEventBase])
async def get_threats(
    skip: int = 0,
    limit: int = 100,
    risk_level: Optional[str] = None,
    ip: Optional[str] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    db: AsyncSession = Depends(get_db)
):
    query = select(ThreatEvent)
    
    if ip:
        query = query.where(ThreatEvent.source_ip == ip)
    if start_date:
        query = query.where(ThreatEvent.created_at >= start_date)
    if end_date:
        query = query.where(ThreatEvent.created_at <= end_date)
        
    query = query.order_by(desc(ThreatEvent.created_at)).offset(skip).limit(limit)
    result = await db.execute(query)
    threats = result.scalars().all()
    return threats

@router.get("/stats", response_model=ThreatStats)
async def get_threat_stats(db: AsyncSession = Depends(get_db)):
    # Group by action taken
    action_query = select(ThreatEvent.action_taken, func.count(ThreatEvent.id)).group_by(ThreatEvent.action_taken)
    action_result = await db.execute(action_query)
    action_counts = {row[0]: row[1] for row in action_result.all()}
    
    # Group by risk level
    risk_query = select(AnomalyScore.risk_level, func.count(AnomalyScore.id)).group_by(AnomalyScore.risk_level)
    risk_result = await db.execute(risk_query)
    risk_counts = {row[0]: row[1] for row in risk_result.all()}
    
    from datetime import timedelta, timezone
    from app.db.models import DetectionMetric, ActionLog
    
    yesterday = datetime.now(timezone.utc) - timedelta(days=1)
    metric_query = select(DetectionMetric).where(DetectionMetric.measured_at >= yesterday).order_by(desc(DetectionMetric.measured_at)).limit(1)
    metric_result = await db.execute(metric_query)
    recent_metric = metric_result.scalars().first()
    fp_rate = recent_metric.false_positive_rate if recent_metric else 0.0
    
    latency_query = select(func.avg(ActionLog.execution_time_ms))
    latency_result = await db.execute(latency_query)
    avg_latency = latency_result.scalar() or 0.0
    
    return {
        "risk_level_counts": risk_counts, 
        "action_taken_counts": action_counts,
        "fp_rate_last_24h": fp_rate,
        "avg_detection_latency_ms": avg_latency
    }

@router.get("/{id}", response_model=ThreatEventBase)
async def get_threat(id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    threat = await db.get(ThreatEvent, id)
    if not threat:
        raise HTTPException(status_code=404, detail="Threat not found")
    return threat

@router.post("/{id}/resolve", response_model=ThreatEventBase)
async def resolve_threat(id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    threat = await db.get(ThreatEvent, id)
    if not threat:
        raise HTTPException(status_code=404, detail="Threat not found")
    
    threat.resolved = True
    threat.resolved_at = datetime.utcnow()
    await db.commit()
    await db.refresh(threat)
    return threat

from pydantic import BaseModel

class FPMarkRequest(BaseModel):
    reporter: str
    notes: Optional[str] = ""

class TPMarkRequest(BaseModel):
    reporter: str

@router.post("/{id}/mark-false-positive")
async def mark_false_positive(id: uuid.UUID, payload: FPMarkRequest, db: AsyncSession = Depends(get_db)):
    threat = await db.get(ThreatEvent, id)
    if not threat:
        raise HTTPException(status_code=404, detail="Threat not found")
        
    from app.db.models import FalsePositiveFeedback
    
    feedback = FalsePositiveFeedback(
        threat_event_id=id,
        reporter=payload.reporter,
        was_false_positive=True,
        notes=payload.notes
    )
    db.add(feedback)
    
    # Process the feedback right away if we wanted, but we have a ModelUpdater or threshold manager
    # Typically this is batched or processed on insert. For now we just record it.
    
    threat.resolved = True
    threat.resolved_at = datetime.utcnow()
    threat.agent_reasoning = (threat.agent_reasoning or "") + f"\n\n[ANALYST FEEDBACK] FALSE_POSITIVE by {payload.reporter}"
    
    await db.commit()
    
    # Notify adaptive ML
    from app.ml.adaptive import ModelUpdater, ThresholdManager
    manager = ThresholdManager()
    manager.update_thresholds_with_feedback([feedback])
    updater = ModelUpdater()
    updater.collect_feedback(str(id), was_true_positive=False)
    
    return {"status": "success", "message": "Marked as False Positive"}

@router.post("/{id}/mark-true-positive")
async def mark_true_positive(id: uuid.UUID, payload: TPMarkRequest, db: AsyncSession = Depends(get_db)):
    threat = await db.get(ThreatEvent, id)
    if not threat:
        raise HTTPException(status_code=404, detail="Threat not found")
        
    from app.db.models import FalsePositiveFeedback
    
    feedback = FalsePositiveFeedback(
        threat_event_id=id,
        reporter=payload.reporter,
        was_false_positive=False,
        notes="Confirmed True Positive"
    )
    db.add(feedback)
    
    threat.resolved = True
    threat.resolved_at = datetime.utcnow()
    threat.agent_reasoning = (threat.agent_reasoning or "") + f"\n\n[ANALYST FEEDBACK] TRUE_POSITIVE by {payload.reporter}"
    
    await db.commit()
    
    from app.ml.adaptive import ModelUpdater, ThresholdManager
    manager = ThresholdManager()
    manager.update_thresholds_with_feedback([feedback])
    updater = ModelUpdater()
    updater.collect_feedback(str(id), was_true_positive=True)
    
    return {"status": "success", "message": "Marked as True Positive"}
