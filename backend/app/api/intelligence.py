import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.database import get_db
from app.db.models import ThreatEvent
from app.ml.adaptive import ShadowModeAnalyzer
from app.safety.fp_mitigation import FalsePositiveMitigator

router = APIRouter()

class DecisionResponse(BaseModel):
    threat_event_id: uuid.UUID
    threat_type: str
    action_taken: str
    confidence_score: float
    agent_reasoning: str
    fp_risk_score: Optional[float] = None
    created_at: str

    class Config:
        from_attributes = True

class ReplayResponse(BaseModel):
    status: str
    message: str
    would_kill_chain_catch: bool
    simulated_action: str
@router.get("/decisions", response_model=List[DecisionResponse])
async def get_decisions(limit: int = 20, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(ThreatEvent).order_by(desc(ThreatEvent.created_at)).limit(limit)
    )
    threats = result.scalars().all()
    
    mitigator = FalsePositiveMitigator()
    results = []
    
    for t in threats:
        history_dicts = [{"action": t.action_taken, "score": t.confidence_score}] 
        fp_assessment = mitigator.evaluate_for_fp_risk(t.confidence_score, t.source_ip, history_dicts)
        
        results.append(DecisionResponse(
            threat_event_id=t.id,
            threat_type=t.threat_type,
            action_taken=t.action_taken,
            confidence_score=t.confidence_score,
            agent_reasoning=t.agent_reasoning,
            fp_risk_score=fp_assessment.fp_risk_score,
            created_at=t.created_at.isoformat()
        ))
        
    return results

@router.get("/baseline-report")
async def get_baseline_report(db: AsyncSession = Depends(get_db)):
    analyzer = ShadowModeAnalyzer()
    report = await analyzer.analyze_shadow_period(db, 7)
    return {
        "status": "success",
        "ready_to_enable": "Ready" in report.recommendation,
        "report": {
            "total_shadow_decisions": report.total_shadow_decisions,
            "would_be_blocked": report.would_be_blocked,
            "would_be_alerted": report.would_be_alerted,
            "estimated_fp_rate": report.estimated_fp_rate,
            "recommendation": report.recommendation
        }
    }

@router.post("/replay/{id}", response_model=ReplayResponse)
async def replay_threat(id: str, db: AsyncSession = Depends(get_db)):
    threat = await db.get(ThreatEvent, uuid.UUID(id))
    if not threat:
        raise HTTPException(status_code=404, detail="ThreatEvent not found")
        
    # Mocking replay logic. In a real scenario, this would resend the log through the pipeline.
    would_kc_catch = "kill chain" in (threat.agent_reasoning or "").lower() or threat.confidence_score > 0.7
    
    return ReplayResponse(
        status="success",
        message=f"Replayed threat event {id}",
        would_kill_chain_catch=would_kc_catch,
        simulated_action=threat.action_taken
    )
