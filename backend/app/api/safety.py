import uuid
from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.database import get_sync_db
from app.db.models import HumanApprovalQueue, AllowlistEntry, ActionLog
from app.core.config import settings
from app.core.event_bus import get_redis_client
from app.safety.approval_handler import HumanApprovalHandler
from app.safety.rollback import RollbackManager

router = APIRouter()
redis = get_redis_client()

# --- Schemas ---

class SafetyStatus(BaseModel):
    shadow_mode: bool
    human_approval_mode: bool
    high_confidence_threshold: float
    medium_confidence_threshold: float
    auto_rollback_minutes: int
    allowlist_count: int

class SafetyModeUpdate(BaseModel):
    shadow_mode: Optional[bool] = None
    human_approval_mode: Optional[bool] = None

class ThresholdUpdate(BaseModel):
    high_confidence: Optional[float] = None
    medium_confidence: Optional[float] = None

class ApprovalAction(BaseModel):
    reviewer: str
    reason: Optional[str] = None

class RollbackRequest(BaseModel):
    reason: str

class AllowlistCreate(BaseModel):
    entry_type: str  # IP, CIDR, ASN
    value: str
    label: Optional[str] = None
    added_by: str

class AllowlistResponse(BaseModel):
    id: uuid.UUID
    entry_type: str
    value: str
    label: Optional[str]
    added_by: str
    created_at: datetime
    is_active: bool

    class Config:
        orm_mode = True

class ApprovalQueueResponse(BaseModel):
    id: uuid.UUID
    threat_event_id: uuid.UUID
    proposed_action: str
    confidence_score: float
    reasoning_summary: str
    status: str
    expires_at: datetime

    class Config:
        orm_mode = True

# --- Routes ---

@router.get("/status", response_model=SafetyStatus)
def get_safety_status(db: Session = Depends(get_sync_db)):
    shadow = redis.get("tars:config:shadow_mode")
    human = redis.get("tars:config:human_approval_mode")
    
    allowlist_count = db.execute(select(AllowlistEntry).where(AllowlistEntry.is_active == True)).scalars().all()
    
    return SafetyStatus(
        shadow_mode=shadow.lower() == "true" if shadow else settings.SHADOW_MODE,
        human_approval_mode=human.lower() == "true" if human else settings.HUMAN_APPROVAL_MODE,
        high_confidence_threshold=settings.HIGH_CONFIDENCE_THRESHOLD,
        medium_confidence_threshold=settings.MEDIUM_CONFIDENCE_THRESHOLD,
        auto_rollback_minutes=settings.AUTO_ROLLBACK_MINUTES,
        allowlist_count=len(allowlist_count)
    )

@router.post("/mode")
def update_safety_mode(update: SafetyModeUpdate):
    if update.shadow_mode is not None:
        redis.set("tars:config:shadow_mode", str(update.shadow_mode).lower())
    if update.human_approval_mode is not None:
        redis.set("tars:config:human_approval_mode", str(update.human_approval_mode).lower())
    return {"status": "success", "message": "Safety mode updated"}

@router.patch("/thresholds")
def update_thresholds(update: ThresholdUpdate):
    if update.high_confidence is not None:
        redis.set("tars:threshold:HIGH", str(update.high_confidence))
    if update.medium_confidence is not None:
        redis.set("tars:threshold:MEDIUM", str(update.medium_confidence))
    return {"status": "success", "message": "Thresholds updated"}

@router.get("/approvals", response_model=List[ApprovalQueueResponse])
def list_approvals(status: Optional[str] = None, db: Session = Depends(get_sync_db)):
    query = select(HumanApprovalQueue)
    if status:
        query = query.where(HumanApprovalQueue.status == status)
    query = query.order_by(HumanApprovalQueue.expires_at.asc())
    
    items = db.execute(query).scalars().all()
    return items

@router.post("/approvals/{id}/approve")
def approve_action(id: str, payload: ApprovalAction, db: Session = Depends(get_sync_db)):
    handler = HumanApprovalHandler()
    res = handler.process_approval(db, id, approved=True, reviewer=payload.reviewer)
    if not res.success:
        raise HTTPException(status_code=400, detail=f"Failed to approve: {res.status}")
    return {"status": "approved", "action_executed": res.action_executed}

@router.post("/approvals/{id}/reject")
def reject_action(id: str, payload: ApprovalAction, db: Session = Depends(get_sync_db)):
    handler = HumanApprovalHandler()
    res = handler.process_approval(db, id, approved=False, reviewer=payload.reviewer)
    if not res.success:
        raise HTTPException(status_code=400, detail=f"Failed to reject: {res.status}")
    return {"status": "rejected"}

@router.post("/rollback/{action_log_id}")
def trigger_rollback(action_log_id: str, payload: RollbackRequest, db: Session = Depends(get_sync_db)):
    manager = RollbackManager()
    res = manager.rollback_action(db, action_log_id, rolled_back_by="HUMAN", reason=payload.reason)
    if not res.success:
        raise HTTPException(status_code=400, detail=f"Rollback failed: {res.error}")
    return {"status": "success", "rollback_record_id": res.record_id}

@router.get("/allowlist", response_model=List[AllowlistResponse])
def get_allowlist(db: Session = Depends(get_sync_db)):
    items = db.execute(select(AllowlistEntry).where(AllowlistEntry.is_active == True)).scalars().all()
    return items

@router.post("/allowlist", response_model=AllowlistResponse)
def add_allowlist_entry(payload: AllowlistCreate, db: Session = Depends(get_sync_db)):
    entry = AllowlistEntry(
        entry_type=payload.entry_type,
        value=payload.value,
        label=payload.label,
        added_by=payload.added_by,
        is_active=True
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    
    # Clear cache
    redis.delete("tars:allowlist:cache")
    return entry

@router.delete("/allowlist/{id}")
def remove_allowlist_entry(id: str, db: Session = Depends(get_sync_db)):
    try:
        entry = db.get(AllowlistEntry, uuid.UUID(id))
        if entry:
            entry.is_active = False
            db.commit()
            redis.delete("tars:allowlist:cache")
            return {"status": "success"}
        raise HTTPException(status_code=404, detail="Entry not found")
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid ID")
