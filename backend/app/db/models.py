import uuid
from datetime import datetime
from typing import Optional, List, Any

from sqlalchemy import String, Integer, Float, Boolean, ForeignKey, DateTime, Text, JSON, Enum, Date
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

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
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

class ShadowDecision(Base):
    __tablename__ = "shadow_decisions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, index=True)
    source_ip: Mapped[str] = mapped_column(String(50), index=True)
    anomaly_score: Mapped[float] = mapped_column(Float)
    risk_level: Mapped[str] = mapped_column(String(20))
    would_have_taken_action: Mapped[str] = mapped_column(Enum("MONITOR", "ALERT", "RATE_LIMIT", "BLOCK", name="shadow_action_enum"))
    reasoning_summary: Mapped[str] = mapped_column(Text)
    was_approved_by_human: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)

class RollbackRecord(Base):
    __tablename__ = "rollback_records"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    action_log_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("action_logs.id"))
    rolled_back_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    rolled_back_by: Mapped[str] = mapped_column(Enum("HUMAN", "AUTO_TIMER", "SYSTEM", name="rollback_actor_enum"))
    rollback_reason: Mapped[str] = mapped_column(Text)
    was_successful: Mapped[bool] = mapped_column(Boolean, default=True)

class AllowlistEntry(Base):
    __tablename__ = "allowlist_entries"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    entry_type: Mapped[str] = mapped_column(Enum("IP", "CIDR", "ASN", name="allowlist_type_enum"))
    value: Mapped[str] = mapped_column(String(255), index=True)
    label: Mapped[str] = mapped_column(String(255))
    added_by: Mapped[str] = mapped_column(String(100))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

class HumanApprovalQueue(Base):
    __tablename__ = "human_approval_queue"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    threat_event_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("threat_events.id"), index=True)
    proposed_action: Mapped[str] = mapped_column(String(50))
    confidence_score: Mapped[float] = mapped_column(Float)
    reasoning_summary: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(Enum("PENDING", "APPROVED", "REJECTED", "EXPIRED", name="approval_status_enum"), default="PENDING", index=True)
    reviewed_by: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    reviewed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))

class FalsePositiveFeedback(Base):
    __tablename__ = "false_positive_feedback"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    threat_event_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("threat_events.id"))
    reporter: Mapped[str] = mapped_column(String(100))
    was_false_positive: Mapped[bool] = mapped_column(Boolean)
    notes: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

class KillChainEvent(Base):
    __tablename__ = "kill_chain_events"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    source_ip: Mapped[str] = mapped_column(String(50), index=True)
    stage: Mapped[str] = mapped_column(Enum("RECONNAISSANCE", "ENUMERATION", "EXPLOITATION", "PERSISTENCE", name="kill_chain_stage_enum"))
    detected_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    evidence: Mapped[dict] = mapped_column(JSON)
    predicted_next_stage: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    confidence: Mapped[float] = mapped_column(Float)
    linked_threat_events: Mapped[list] = mapped_column(JSON, default=list)

class AttackerProfile(Base):
    __tablename__ = "attacker_profiles"

    source_ip: Mapped[str] = mapped_column(String(50), primary_key=True)
    first_stage_seen: Mapped[str] = mapped_column(String(50))
    current_stage: Mapped[str] = mapped_column(String(50))
    stage_history: Mapped[dict] = mapped_column(JSON)
    predicted_next_action: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    last_activity: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

class DetectionMetric(Base):
    __tablename__ = "detection_metrics"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    measured_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, index=True)
    true_positives: Mapped[int] = mapped_column(Integer, default=0)
    false_positives: Mapped[int] = mapped_column(Integer, default=0)
    false_negatives: Mapped[int] = mapped_column(Integer, default=0)
    precision: Mapped[float] = mapped_column(Float, default=0.0)
    recall: Mapped[float] = mapped_column(Float, default=0.0)
    f1_score: Mapped[float] = mapped_column(Float, default=0.0)
    false_positive_rate: Mapped[float] = mapped_column(Float, default=0.0)
    avg_detection_latency_ms: Mapped[float] = mapped_column(Float, default=0.0)
    time_window_minutes: Mapped[int] = mapped_column(Integer)

class BusinessImpactRecord(Base):
    __tablename__ = "business_impact_records"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    date: Mapped[datetime] = mapped_column(Date, index=True)
    total_requests_blocked: Mapped[int] = mapped_column(Integer, default=0)
    total_ips_blocked: Mapped[int] = mapped_column(Integer, default=0)
    estimated_cost_saved_usd: Mapped[float] = mapped_column(Float, default=0.0)
    estimated_analyst_hours_saved: Mapped[float] = mapped_column(Float, default=0.0)
    attacks_stopped_count: Mapped[int] = mapped_column(Integer, default=0)
    false_blocks_count: Mapped[int] = mapped_column(Integer, default=0)
