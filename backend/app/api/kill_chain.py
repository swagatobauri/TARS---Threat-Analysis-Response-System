from datetime import datetime, timezone
from typing import List, Optional, Dict
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.database import get_db
from app.db.models import AttackerProfile

router = APIRouter()

class StageHistoryItem(BaseModel):
    stage: str
    confidence: float
    threat_event_id: str
    timestamp: str

class AttackerProfileResponse(BaseModel):
    source_ip: str
    first_stage_seen: str
    current_stage: str
    stage_history: List[StageHistoryItem]
    predicted_next_action: Optional[str]
    is_active: bool
    last_activity: datetime

    class Config:
        orm_mode = True

class KillChainStats(BaseModel):
    total_active: int
    stage_distribution: Dict[str, int]
    progression_rate: float

@router.get("/active", response_model=List[AttackerProfileResponse])
async def get_active_attackers(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(AttackerProfile).where(AttackerProfile.is_active == True))
    items = result.scalars().all()
    return items

@router.get("/stats", response_model=KillChainStats)
async def get_kill_chain_stats(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(AttackerProfile).where(AttackerProfile.is_active == True))
    active_profiles = result.scalars().all()
    
    dist = {"RECONNAISSANCE": 0, "ENUMERATION": 0, "EXPLOITATION": 0, "PERSISTENCE": 0}
    progressed = 0
    
    for p in active_profiles:
        if p.current_stage in dist:
            dist[p.current_stage] += 1
        
        if len(p.stage_history) > 1:
            progressed += 1
            
    progression_rate = (progressed / len(active_profiles)) if active_profiles else 0.0
    
    return KillChainStats(
        total_active=len(active_profiles),
        stage_distribution=dist,
        progression_rate=progression_rate
    )

@router.get("/{ip}", response_model=AttackerProfileResponse)
async def get_attacker_profile(ip: str, db: AsyncSession = Depends(get_db)):
    profile = await db.get(AttackerProfile, ip)
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    return profile
