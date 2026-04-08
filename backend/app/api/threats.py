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
    
    return {"risk_level_counts": risk_counts, "action_taken_counts": action_counts}

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
