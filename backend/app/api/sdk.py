import logging
from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.db.database import get_db
from sqlalchemy.orm import Session
from app.db.models import NetworkLog
from app.tasks.detection import detect_anomaly

logger = logging.getLogger(__name__)

router = APIRouter()

# Schema for a request log from the SDK
class SDKTrafficLog(BaseModel):
    source_ip: str
    dest_ip: Optional[str] = "server"
    src_port: Optional[int] = None
    dest_port: Optional[int] = 80
    protocol: Optional[str] = "HTTP"
    bytes_sent: Optional[int] = 0
    packets: Optional[int] = 1
    duration_seconds: Optional[float] = 0.0
    request_rate: Optional[float] = 1.0
    session_id: Optional[str] = None
    user_agent: Optional[str] = None
    raw_payload: Optional[dict] = None

class SDKIngestPayload(BaseModel):
    logs: List[SDKTrafficLog]

@router.post("/ingest")
async def ingest_sdk_traffic(
    payload: SDKIngestPayload,
    db: Session = Depends(get_db)
):
    """
    Ingest real-time traffic logs from the TARS SDK.
    These logs are saved to the database and immediately queued for threat analysis.
    """
    log_ids = []
    try:
        for traffic in payload.logs:
            new_log = NetworkLog(
                source_ip=traffic.source_ip,
                dest_ip=traffic.dest_ip or "server",
                src_port=traffic.src_port,
                dest_port=traffic.dest_port,
                protocol=traffic.protocol,
                bytes_sent=traffic.bytes_sent,
                packets=traffic.packets,
                duration_seconds=traffic.duration_seconds,
                request_rate=traffic.request_rate,
                session_id=traffic.session_id,
                user_agent=traffic.user_agent,
                raw_payload=traffic.raw_payload,
                timestamp=datetime.utcnow()
            )
            db.add(new_log)
            db.flush() # get the ID before commit
            log_ids.append(str(new_log.id))
            
        db.commit()
        
        # Dispatch Celery detection tasks for each ingested log
        for l_id in log_ids:
            # detect_anomaly is a celery task, so we use .delay() to execute asynchronously
            detect_anomaly.delay(l_id)
            
        return {"status": "success", "ingested_count": len(log_ids)}

    except Exception as e:
        db.rollback()
        logger.error(f"Failed to ingest SDK traffic: {e}")
        raise HTTPException(status_code=500, detail="Internal server error during ingestion")
