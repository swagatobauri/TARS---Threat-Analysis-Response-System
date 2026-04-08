from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from typing import List

from app.db.database import get_db
from app.db.models import ThreatEvent
from app.api.schemas import AgentAnalysisRequest, AgentReplayRequest, AgentDecision

router = APIRouter()

@router.post("/analyze")
async def analyze_log(request: AgentAnalysisRequest, db: AsyncSession = Depends(get_db)):
    return {"status": "success", "message": f"Agent analysis triggered for log_id {request.log_id}"}

@router.get("/decisions", response_model=List[AgentDecision])
async def get_decisions(limit: int = 10, db: AsyncSession = Depends(get_db)):
    query = select(ThreatEvent).order_by(desc(ThreatEvent.created_at)).limit(limit)
    result = await db.execute(query)
    threats = result.scalars().all()
    
    return [
        AgentDecision(
            threat_event_id=t.id,
            threat_type=t.threat_type,
            action_taken=t.action_taken,
            confidence_score=t.confidence_score,
            agent_reasoning=t.agent_reasoning,
            created_at=t.created_at
        ) for t in threats
    ]

@router.post("/replay")
async def replay_attack(request: AgentReplayRequest, db: AsyncSession = Depends(get_db)):
    return {"status": "success", "message": f"Replay initiated for threat_event_id {request.threat_event_id}"}
