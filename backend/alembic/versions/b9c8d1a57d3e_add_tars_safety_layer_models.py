"""Add TARS safety layer models

Revision ID: b9c8d1a57d3e
Revises: d6a8d1a57d3f
Create Date: 2026-04-26 05:05:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'b9c8d1a57d3e'
down_revision: Union[str, Sequence[str], None] = 'd6a8d1a57d3f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ShadowDecision
    op.create_table('shadow_decisions',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('timestamp', sa.DateTime(timezone=True), nullable=False),
    sa.Column('source_ip', sa.String(length=50), nullable=False),
    sa.Column('anomaly_score', sa.Float(), nullable=False),
    sa.Column('risk_level', sa.String(length=20), nullable=False),
    sa.Column('would_have_taken_action', sa.Enum('MONITOR', 'ALERT', 'RATE_LIMIT', 'BLOCK', name='shadow_action_enum'), nullable=False),
    sa.Column('reasoning_summary', sa.Text(), nullable=False),
    sa.Column('was_approved_by_human', sa.Boolean(), nullable=True),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_shadow_decisions_timestamp'), 'shadow_decisions', ['timestamp'], unique=False)
    op.create_index(op.f('ix_shadow_decisions_source_ip'), 'shadow_decisions', ['source_ip'], unique=False)

    # RollbackRecord
    op.create_table('rollback_records',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('action_log_id', sa.UUID(), nullable=False),
    sa.Column('rolled_back_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('rolled_back_by', sa.Enum('HUMAN', 'AUTO_TIMER', 'SYSTEM', name='rollback_actor_enum'), nullable=False),
    sa.Column('rollback_reason', sa.Text(), nullable=False),
    sa.Column('was_successful', sa.Boolean(), nullable=False),
    sa.ForeignKeyConstraint(['action_log_id'], ['action_logs.id'], ),
    sa.PrimaryKeyConstraint('id')
    )

    # AllowlistEntry
    op.create_table('allowlist_entries',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('entry_type', sa.Enum('IP', 'CIDR', 'ASN', name='allowlist_type_enum'), nullable=False),
    sa.Column('value', sa.String(length=255), nullable=False),
    sa.Column('label', sa.String(length=255), nullable=False),
    sa.Column('added_by', sa.String(length=100), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('is_active', sa.Boolean(), nullable=False),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_allowlist_entries_value'), 'allowlist_entries', ['value'], unique=False)

    # HumanApprovalQueue
    op.create_table('human_approval_queue',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('threat_event_id', sa.UUID(), nullable=False),
    sa.Column('proposed_action', sa.String(length=50), nullable=False),
    sa.Column('confidence_score', sa.Float(), nullable=False),
    sa.Column('reasoning_summary', sa.Text(), nullable=False),
    sa.Column('status', sa.Enum('PENDING', 'APPROVED', 'REJECTED', 'EXPIRED', name='approval_status_enum'), nullable=False),
    sa.Column('reviewed_by', sa.String(length=100), nullable=True),
    sa.Column('reviewed_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['threat_event_id'], ['threat_events.id'], ),
    sa.PrimaryKeyConstraint('id')
    )

    # FalsePositiveFeedback
    op.create_table('false_positive_feedback',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('threat_event_id', sa.UUID(), nullable=False),
    sa.Column('reporter', sa.String(length=100), nullable=False),
    sa.Column('was_false_positive', sa.Boolean(), nullable=False),
    sa.Column('notes', sa.Text(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['threat_event_id'], ['threat_events.id'], ),
    sa.PrimaryKeyConstraint('id')
    )

    # KillChainEvent
    op.create_table('kill_chain_events',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('source_ip', sa.String(length=50), nullable=False),
    sa.Column('stage', sa.Enum('RECONNAISSANCE', 'ENUMERATION', 'EXPLOITATION', 'PERSISTENCE', name='kill_chain_stage_enum'), nullable=False),
    sa.Column('detected_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('evidence', sa.JSON(), nullable=False),
    sa.Column('predicted_next_stage', sa.String(length=50), nullable=True),
    sa.Column('confidence', sa.Float(), nullable=False),
    sa.Column('linked_threat_events', sa.JSON(), nullable=False),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_kill_chain_events_source_ip'), 'kill_chain_events', ['source_ip'], unique=False)

    # AttackerProfile
    op.create_table('attacker_profiles',
    sa.Column('source_ip', sa.String(length=50), nullable=False),
    sa.Column('first_stage_seen', sa.String(length=50), nullable=False),
    sa.Column('current_stage', sa.String(length=50), nullable=False),
    sa.Column('stage_history', sa.JSON(), nullable=False),
    sa.Column('predicted_next_action', sa.Text(), nullable=True),
    sa.Column('is_active', sa.Boolean(), nullable=False),
    sa.Column('last_activity', sa.DateTime(timezone=True), nullable=False),
    sa.PrimaryKeyConstraint('source_ip')
    )

    # DetectionMetric
    op.create_table('detection_metrics',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('measured_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('true_positives', sa.Integer(), nullable=False),
    sa.Column('false_positives', sa.Integer(), nullable=False),
    sa.Column('false_negatives', sa.Integer(), nullable=False),
    sa.Column('precision', sa.Float(), nullable=False),
    sa.Column('recall', sa.Float(), nullable=False),
    sa.Column('f1_score', sa.Float(), nullable=False),
    sa.Column('false_positive_rate', sa.Float(), nullable=False),
    sa.Column('avg_detection_latency_ms', sa.Float(), nullable=False),
    sa.Column('time_window_minutes', sa.Integer(), nullable=False),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_detection_metrics_measured_at'), 'detection_metrics', ['measured_at'], unique=False)

    # BusinessImpactRecord
    op.create_table('business_impact_records',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('date', sa.Date(), nullable=False),
    sa.Column('total_requests_blocked', sa.Integer(), nullable=False),
    sa.Column('total_ips_blocked', sa.Integer(), nullable=False),
    sa.Column('estimated_cost_saved_usd', sa.Float(), nullable=False),
    sa.Column('estimated_analyst_hours_saved', sa.Float(), nullable=False),
    sa.Column('attacks_stopped_count', sa.Integer(), nullable=False),
    sa.Column('false_blocks_count', sa.Integer(), nullable=False),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_business_impact_records_date'), 'business_impact_records', ['date'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_business_impact_records_date'), table_name='business_impact_records')
    op.drop_table('business_impact_records')
    op.drop_index(op.f('ix_detection_metrics_measured_at'), table_name='detection_metrics')
    op.drop_table('detection_metrics')
    op.drop_table('attacker_profiles')
    op.drop_index(op.f('ix_kill_chain_events_source_ip'), table_name='kill_chain_events')
    op.drop_table('kill_chain_events')
    op.drop_table('false_positive_feedback')
    op.drop_table('human_approval_queue')
    op.drop_index(op.f('ix_allowlist_entries_value'), table_name='allowlist_entries')
    op.drop_table('allowlist_entries')
    op.drop_table('rollback_records')
    op.drop_index(op.f('ix_shadow_decisions_source_ip'), table_name='shadow_decisions')
    op.drop_index(op.f('ix_shadow_decisions_timestamp'), table_name='shadow_decisions')
    op.drop_table('shadow_decisions')

    op.execute("DROP TYPE IF EXISTS shadow_action_enum")
    op.execute("DROP TYPE IF EXISTS rollback_actor_enum")
    op.execute("DROP TYPE IF EXISTS allowlist_type_enum")
    op.execute("DROP TYPE IF EXISTS approval_status_enum")
    op.execute("DROP TYPE IF EXISTS kill_chain_stage_enum")
