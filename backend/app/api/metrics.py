import uuid
from datetime import datetime, timedelta, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import select, func
from sqlalchemy.orm import Session

from app.db.database import get_sync_db
from app.db.models import DetectionMetric, FalsePositiveFeedback

# Assuming BusinessImpactRecord exists or we mock it if it doesn't.
# The user prompt mentions it. We'll import it if it exists.
try:
    from app.db.models import BusinessImpactRecord
except ImportError:
    pass

from app.ml.adaptive import ShadowModeAnalyzer, BaselineReport

router = APIRouter()

class DetectionMetricResponse(BaseModel):
    id: uuid.UUID
    measured_at: datetime
    true_positives: int
    false_positives: int
    false_negatives: int
    precision: float
    recall: float
    f1_score: float
    false_positive_rate: float

    class Config:
        orm_mode = True

class FPFeedbackSummary(BaseModel):
    true_positives: int
    false_positives: int
    total: int

@router.get("/detection", response_model=List[DetectionMetricResponse])
def get_detection_metrics(days: int = 7, db: Session = Depends(get_sync_db)):
    since = datetime.now(timezone.utc) - timedelta(days=days)
    items = db.execute(
        select(DetectionMetric).where(DetectionMetric.measured_at >= since).order_by(DetectionMetric.measured_at.asc())
    ).scalars().all()
    return items

@router.get("/impact")
def get_business_impact(days: int = Query(7, ge=1, le=90), db: Session = Depends(get_sync_db)):
    try:
        from app.db.models import BusinessImpactRecord
        since = (datetime.now(timezone.utc) - timedelta(days=days)).date()
        items = db.execute(
            select(BusinessImpactRecord).where(BusinessImpactRecord.date >= since).order_by(BusinessImpactRecord.date.asc())
        ).scalars().all()
        return items
    except ImportError:
        return {"error": "BusinessImpactRecord model not defined"}

@router.get("/shadow")
def get_shadow_mode_analysis(days: int = 7, db: Session = Depends(get_sync_db)):
    analyzer = ShadowModeAnalyzer()
    report = analyzer.analyze_shadow_period(db, days)
    return {
        "total_shadow_decisions": report.total_shadow_decisions,
        "would_be_blocked": report.would_be_blocked,
        "would_be_alerted": report.would_be_alerted,
        "estimated_fp_rate": report.estimated_fp_rate,
        "recommendation": report.recommendation
    }

@router.get("/fp-feedback", response_model=FPFeedbackSummary)
def get_fp_feedback_summary(db: Session = Depends(get_sync_db)):
    items = db.execute(select(FalsePositiveFeedback)).scalars().all()
    fp = sum(1 for i in items if i.was_false_positive)
    tp = sum(1 for i in items if not i.was_false_positive)
    
    return FPFeedbackSummary(
        true_positives=tp,
        false_positives=fp,
        total=len(items)
    )
