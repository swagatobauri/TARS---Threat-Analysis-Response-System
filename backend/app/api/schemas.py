import uuid
from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict

class AnomalyScoreBase(BaseModel):
    isolation_forest_score: float
    svm_score: float
    combined_score: float
    behavioral_deviation: float
    risk_level: str

    model_config = ConfigDict(from_attributes=True)

class NetworkLogBase(BaseModel):
    id: uuid.UUID
    timestamp: datetime
    source_ip: str
    dest_ip: str
    src_port: Optional[int] = None
    dest_port: Optional[int] = None
    protocol: Optional[str] = None
    bytes_sent: Optional[int] = None
    packets: Optional[int] = None
    duration_seconds: Optional[float] = None
    request_rate: Optional[float] = None
    session_id: Optional[str] = None
    user_agent: Optional[str] = None
    raw_payload: Optional[dict] = None

    model_config = ConfigDict(from_attributes=True)

class NetworkLogWithScores(NetworkLogBase):
    anomaly_score: Optional[AnomalyScoreBase] = None

class ThreatEventBase(BaseModel):
    id: uuid.UUID
    source_ip: str
    threat_type: str
    confidence_score: float
    action_taken: str
    agent_reasoning: str
    resolved: bool
    created_at: datetime
    resolved_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)

class ThreatStats(BaseModel):
    risk_level_counts: dict
    action_taken_counts: dict

class LogIngestRequest(BaseModel):
    source_ip: str
    dest_ip: str
    src_port: Optional[int] = None
    dest_port: Optional[int] = None
    protocol: Optional[str] = None
    bytes_sent: Optional[int] = None
    packets: Optional[int] = None
    duration_seconds: Optional[float] = None
    request_rate: Optional[float] = None
    session_id: Optional[str] = None
    user_agent: Optional[str] = None
    raw_payload: Optional[dict] = None

class AgentAnalysisRequest(BaseModel):
    log_id: uuid.UUID

class AgentReplayRequest(BaseModel):
    threat_event_id: uuid.UUID

class AgentDecision(BaseModel):
    threat_event_id: uuid.UUID
    threat_type: str
    action_taken: str
    confidence_score: float
    agent_reasoning: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
    
class HealthResponse(BaseModel):
    status: str
    db_status: str
    celery_active: bool
    ml_model_loaded: bool
    last_detection_timestamp: Optional[datetime] = None
