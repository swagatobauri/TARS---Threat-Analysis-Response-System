from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from sqlalchemy.orm import selectinload
from fastapi.responses import StreamingResponse
from typing import List
import asyncio
import json

from app.db.database import get_db
from app.db.models import NetworkLog
from app.api.schemas import NetworkLogWithScores, LogIngestRequest

router = APIRouter()

@router.get("", response_model=List[NetworkLogWithScores])
async def get_logs(skip: int = 0, limit: int = 50, db: AsyncSession = Depends(get_db)):
    query = select(NetworkLog).options(selectinload(NetworkLog.anomaly_score)).order_by(desc(NetworkLog.timestamp)).offset(skip).limit(limit)
    result = await db.execute(query)
    return result.scalars().all()

@router.post("/ingest")
async def ingest_logs(logs: List[LogIngestRequest], db: AsyncSession = Depends(get_db)):
    new_logs = []
    for log_data in logs:
        new_log = NetworkLog(**log_data.model_dump())
        db.add(new_log)
        new_logs.append(new_log)
        
    await db.commit()

    # Refresh to get generated UUIDs, then enqueue each for detection
    for log in new_logs:
        await db.refresh(log)

    from app.tasks.detection import detect_anomaly
    for log in new_logs:
        detect_anomaly.delay(str(log.id))
    
    return {"status": "success", "ingested": len(new_logs), "message": "Logs ingested and queued for detection"}

@router.get("/live")
async def live_logs():
    """SSE endpoint for real-time log streaming."""
    async def log_generator():
        while True:
            await asyncio.sleep(2)
            yield f"data: {json.dumps({'event': 'keep-alive', 'status': 'listening'})}\n\n"
            
    return StreamingResponse(log_generator(), media_type="text/event-stream")
