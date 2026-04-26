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
    from app.safety.execution_gate import AllowlistChecker
    checker = AllowlistChecker()
    
    new_logs = []
    skipped_trusted = 0
    
    for log_data in logs:
        if checker.is_trusted(log_data.source_ip):
            skipped_trusted += 1
            continue
            
        new_log = NetworkLog(**log_data.model_dump())
        db.add(new_log)
        new_logs.append(new_log)
        
    await db.commit()

    for log in new_logs:
        await db.refresh(log)

    from app.tasks.detection import detect_anomaly
    for log in new_logs:
        detect_anomaly(str(log.id))
    
    return {
        "status": "success",
        "enqueued": len(new_logs),
        "skipped_trusted": skipped_trusted,
        "rejected": 0,
        "message": "Logs processed"
    }

@router.get("/live")
async def live_logs():
    """SSE endpoint for real-time log streaming."""
    import redis.asyncio as aioredis
    from app.core.config import settings
    
    async def log_generator():
        client = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
        pubsub = client.pubsub()
        await pubsub.subscribe("tars:events")
        
        try:
            while True:
                message = await pubsub.get_message(ignore_subscribe_messages=True, timeout=1.0)
                if message and message['type'] == 'message':
                    data = message['data']
                    yield f"data: {data}\n\n"
                else:
                    yield f"data: {json.dumps({'event': 'keep-alive', 'status': 'listening'})}\n\n"
                await asyncio.sleep(0.5)
        finally:
            await pubsub.unsubscribe("tars:events")
            await client.close()
            
    return StreamingResponse(log_generator(), media_type="text/event-stream")
