import uuid
from datetime import datetime
from typing import Optional, List, Any

from sqlalchemy import String, Integer, Float, Boolean, ForeignKey, DateTime, Text, JSON, Enum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship

class Base(DeclarativeBase):
    pass

class NetworkLog(Base):
    __tablename__ = "network_logs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, index=True)
    source_ip: Mapped[str] = mapped_column(String(50), index=True)
    dest_ip: Mapped[str] = mapped_column(String(50), index=True)
    src_port: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    dest_port: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    protocol: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    bytes_sent: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    packets: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    duration_seconds: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    request_rate: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    session_id: Mapped[Optional[str]] = mapped_column(String(100), index=True, nullable=True)
    user_agent: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    raw_payload: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)

    anomaly_score: Mapped[Optional["AnomalyScore"]] = relationship("AnomalyScore", back_populates="log", uselist=False)


class AnomalyScore(Base):
    __tablename__ = "anomaly_scores"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    log_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("network_logs.id"), unique=True)
    isolation_forest_score: Mapped[float] = mapped_column(Float)
    svm_score: Mapped[float] = mapped_column(Float)
    combined_score: Mapped[float] = mapped_column(Float)
    behavioral_deviation: Mapped[float] = mapped_column(Float)
    risk_level: Mapped[str] = mapped_column(Enum("LOW", "MEDIUM", "HIGH", "CRITICAL", name="risk_level_enum"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

    log: Mapped["NetworkLog"] = relationship("NetworkLog", back_populates="anomaly_score")


class ThreatEvent(Base):
    __tablename__ = "threat_events"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    source_ip: Mapped[str] = mapped_column(String(50), index=True)
    threat_type: Mapped[str] = mapped_column(String(100))
    confidence_score: Mapped[float] = mapped_column(Float)
    action_taken: Mapped[str] = mapped_column(Enum("MONITOR", "ALERT", "RATE_LIMIT", "BLOCK", "PORT_CLOSE", name="action_type_enum"))
    agent_reasoning: Mapped[str] = mapped_column(Text)
    resolved: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    resolved_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    action_logs: Mapped[List["ActionLog"]] = relationship("ActionLog", back_populates="threat_event")


class IPReputation(Base):
    __tablename__ = "ip_reputation"

    ip_address: Mapped[str] = mapped_column(String(50), primary_key=True)
    threat_count: Mapped[int] = mapped_column(Integer, default=0)
    last_seen: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    is_blocked: Mapped[bool] = mapped_column(Boolean, default=False)
    block_reason: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    reputation_score: Mapped[float] = mapped_column(Float, default=1.0)
    attack_history: Mapped[list] = mapped_column(JSON, default=list)


class ActionLog(Base):
    __tablename__ = "action_logs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    threat_event_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("threat_events.id"))
    action_type: Mapped[str] = mapped_column(String(50))
    target_ip: Mapped[str] = mapped_column(String(50))
    success: Mapped[bool] = mapped_column(Boolean, default=True)
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    executed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    execution_time_ms: Mapped[float] = mapped_column(Float)

    threat_event: Mapped["ThreatEvent"] = relationship("ThreatEvent", back_populates="action_logs")
