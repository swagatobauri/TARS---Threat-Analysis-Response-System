"""initial_migration

Revision ID: d6a8d1a57d3f
Revises: 
Create Date: 2026-04-25 23:32:11.100853

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd6a8d1a57d3f'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table('ip_reputation',
    sa.Column('ip_address', sa.String(length=50), nullable=False),
    sa.Column('threat_count', sa.Integer(), nullable=False),
    sa.Column('last_seen', sa.DateTime(timezone=True), nullable=False),
    sa.Column('is_blocked', sa.Boolean(), nullable=False),
    sa.Column('block_reason', sa.String(length=255), nullable=True),
    sa.Column('reputation_score', sa.Float(), nullable=False),
    sa.Column('attack_history', sa.JSON(), nullable=False),
    sa.PrimaryKeyConstraint('ip_address')
    )
    op.create_table('network_logs',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('timestamp', sa.DateTime(timezone=True), nullable=False),
    sa.Column('source_ip', sa.String(length=50), nullable=False),
    sa.Column('dest_ip', sa.String(length=50), nullable=False),
    sa.Column('src_port', sa.Integer(), nullable=True),
    sa.Column('dest_port', sa.Integer(), nullable=True),
    sa.Column('protocol', sa.String(length=20), nullable=True),
    sa.Column('bytes_sent', sa.Integer(), nullable=True),
    sa.Column('packets', sa.Integer(), nullable=True),
    sa.Column('duration_seconds', sa.Float(), nullable=True),
    sa.Column('request_rate', sa.Float(), nullable=True),
    sa.Column('session_id', sa.String(length=100), nullable=True),
    sa.Column('user_agent', sa.String(length=255), nullable=True),
    sa.Column('raw_payload', sa.JSON(), nullable=True),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_network_logs_dest_ip'), 'network_logs', ['dest_ip'], unique=False)
    op.create_index(op.f('ix_network_logs_session_id'), 'network_logs', ['session_id'], unique=False)
    op.create_index(op.f('ix_network_logs_source_ip'), 'network_logs', ['source_ip'], unique=False)
    op.create_index(op.f('ix_network_logs_timestamp'), 'network_logs', ['timestamp'], unique=False)

    op.create_table('threat_events',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('source_ip', sa.String(length=50), nullable=False),
    sa.Column('threat_type', sa.String(length=100), nullable=False),
    sa.Column('confidence_score', sa.Float(), nullable=False),
    sa.Column('action_taken', sa.Enum('MONITOR', 'ALERT', 'RATE_LIMIT', 'BLOCK', 'PORT_CLOSE', name='action_type_enum'), nullable=False),
    sa.Column('agent_reasoning', sa.Text(), nullable=False),
    sa.Column('resolved', sa.Boolean(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('resolved_at', sa.DateTime(timezone=True), nullable=True),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_threat_events_source_ip'), 'threat_events', ['source_ip'], unique=False)

    op.create_table('action_logs',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('threat_event_id', sa.UUID(), nullable=False),
    sa.Column('action_type', sa.String(length=50), nullable=False),
    sa.Column('target_ip', sa.String(length=50), nullable=False),
    sa.Column('success', sa.Boolean(), nullable=False),
    sa.Column('error_message', sa.Text(), nullable=True),
    sa.Column('executed_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('execution_time_ms', sa.Float(), nullable=False),
    sa.ForeignKeyConstraint(['threat_event_id'], ['threat_events.id'], ),
    sa.PrimaryKeyConstraint('id')
    )

    op.create_table('anomaly_scores',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('log_id', sa.UUID(), nullable=False),
    sa.Column('isolation_forest_score', sa.Float(), nullable=False),
    sa.Column('svm_score', sa.Float(), nullable=False),
    sa.Column('combined_score', sa.Float(), nullable=False),
    sa.Column('behavioral_deviation', sa.Float(), nullable=False),
    sa.Column('risk_level', sa.Enum('LOW', 'MEDIUM', 'HIGH', 'CRITICAL', name='risk_level_enum'), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['log_id'], ['network_logs.id'], ),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('log_id')
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_table('anomaly_scores')
    op.drop_table('action_logs')
    op.drop_index(op.f('ix_threat_events_source_ip'), table_name='threat_events')
    op.drop_table('threat_events')
    op.drop_index(op.f('ix_network_logs_timestamp'), table_name='network_logs')
    op.drop_index(op.f('ix_network_logs_source_ip'), table_name='network_logs')
    op.drop_index(op.f('ix_network_logs_session_id'), table_name='network_logs')
    op.drop_index(op.f('ix_network_logs_dest_ip'), table_name='network_logs')
    op.drop_table('network_logs')
    op.drop_table('ip_reputation')
    op.execute("DROP TYPE IF EXISTS action_type_enum")
    op.execute("DROP TYPE IF EXISTS risk_level_enum")
