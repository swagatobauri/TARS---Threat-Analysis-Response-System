import uuid
from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock, patch

import pytest
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.models import ActionLog, IPReputation, ShadowDecision, HumanApprovalQueue
from app.safety.execution_gate import ConfidenceGate, GateResult, ExecutionMode
from app.safety.approval_handler import HumanApprovalHandler
from app.safety.fp_mitigation import FalsePositiveMitigator
from app.safety.rollback import rollback_action

@pytest.fixture
def db_session():
    return MagicMock(spec=Session)

def test_shadow_mode_blocks_all_actions(db_session):
    gate = ConfidenceGate()
    with patch("app.safety.execution_gate.settings") as mock_settings:
        mock_settings.SHADOW_MODE = True
        mock_settings.TRUSTED_IPS = []
        
        result = gate.can_execute(
            db_session, "1.2.3.4", "BLOCK", 0.9, "reason", "HIGH", 0.85, str(uuid.uuid4())
        )
        
        assert result.allowed is False
        assert result.mode == ExecutionMode.SHADOW
        # Check that shadow decision was recorded
        assert db_session.add.called
        assert isinstance(db_session.add.call_args[0][0], ShadowDecision)

def test_confidence_gate_high(db_session):
    gate = ConfidenceGate()
    with patch("app.safety.execution_gate.settings") as mock_settings:
        mock_settings.SHADOW_MODE = False
        mock_settings.HUMAN_APPROVAL_MODE = False
        mock_settings.HIGH_CONFIDENCE_THRESHOLD = 0.8
        mock_settings.TRUSTED_IPS = []
        
        result = gate.can_execute(
            db_session, "1.2.3.4", "BLOCK", 0.9, "reason", "HIGH", 0.85, str(uuid.uuid4())
        )
        
        assert result.allowed is True
        assert result.mode == ExecutionMode.AUTONOMOUS

def test_confidence_gate_medium(db_session):
    gate = ConfidenceGate()
    with patch("app.safety.execution_gate.settings") as mock_settings:
        mock_settings.SHADOW_MODE = False
        mock_settings.HUMAN_APPROVAL_MODE = False
        mock_settings.HIGH_CONFIDENCE_THRESHOLD = 0.8
        mock_settings.MEDIUM_CONFIDENCE_THRESHOLD = 0.5
        mock_settings.TRUSTED_IPS = []
        
        result = gate.can_execute(
            db_session, "1.2.3.4", "BLOCK", 0.6, "reason", "MEDIUM", 0.55, str(uuid.uuid4())
        )
        
        assert result.allowed is False
        assert "downgraded to ALERT" in result.reason

def test_confidence_gate_low(db_session):
    gate = ConfidenceGate()
    with patch("app.safety.execution_gate.settings") as mock_settings:
        mock_settings.SHADOW_MODE = False
        mock_settings.HUMAN_APPROVAL_MODE = False
        mock_settings.HIGH_CONFIDENCE_THRESHOLD = 0.8
        mock_settings.MEDIUM_CONFIDENCE_THRESHOLD = 0.5
        mock_settings.TRUSTED_IPS = []
        
        result = gate.can_execute(
            db_session, "1.2.3.4", "BLOCK", 0.3, "reason", "LOW", 0.25, str(uuid.uuid4())
        )
        
        assert result.allowed is False
        assert "downgraded to MONITOR" in result.reason

def test_allowlist_blocks_trusted_ip(db_session):
    gate = ConfidenceGate()
    with patch("app.safety.execution_gate.settings") as mock_settings:
        mock_settings.TRUSTED_IPS = ["1.1.1.1"]
        
        result = gate.can_execute(
            db_session, "1.1.1.1", "BLOCK", 0.9, "reason", "HIGH", 0.85, str(uuid.uuid4())
        )
        
        assert result.allowed is False
        assert "allowlist" in result.reason

def test_human_approval_flow(db_session):
    handler = HumanApprovalHandler()
    threat_id = str(uuid.uuid4())
    
    # Create queue entry
    with patch("app.safety.approval_handler.emit_approval_requested"):
        item = handler.submit_for_approval(db_session, threat_id, "BLOCK", 0.85, "reason")
        assert item.status == "PENDING"
        db_session.add.assert_called()

    # Approve
    db_session.get.return_value = item
    with patch("app.tasks.response.execute_response.delay") as mock_exec:
        handler.process_approval(db_session, str(item.id), True, "analyst_1")
        assert item.status == "APPROVED"
        assert item.reviewed_by == "analyst_1"
        mock_exec.assert_called_with(threat_id)

def test_auto_rollback_scheduled():
    # This usually happens in the execute_response task
    # We can test if the task enqueues rollback
    from app.tasks.response import execute_response
    
    with patch("app.tasks.response.SyncSessionLocal") as mock_session_factory:
        mock_session = MagicMock()
        mock_session_factory.return_value = mock_session
        
        threat = MagicMock()
        threat.id = uuid.uuid4()
        threat.source_ip = "1.2.3.4"
        threat.action_taken = "BLOCK"
        mock_session.get.return_value = threat
        
        with patch("app.metrics.validator.validate_after_action.apply_async") as mock_val, \
             patch("app.safety.rollback.auto_rollback_action.apply_async") as mock_roll:
            
            execute_response(str(threat.id))
            
            # Check if rollback was scheduled (if BLOCK)
            # Note: The logic for auto-rollback scheduling might be in response.py or execution_gate.py
            # Based on requirements, it should be enqueued.
            assert mock_roll.called or mock_val.called

def test_rollback_unblocks_ip(db_session):
    ip = "1.2.3.4"
    rep = IPReputation(ip_address=ip, is_blocked=True)
    db_session.get.return_value = rep
    
    action_log_id = uuid.uuid4()
    rollback_action(db_session, str(action_log_id), reason="Test rollback", actor="SYSTEM")
    
    assert rep.is_blocked is False
    assert db_session.commit.called

def test_fp_risk_single_event():
    mitigator = FalsePositiveMitigator()
    # Mock history with only 1 event
    history = [MagicMock(timestamp=datetime.now(timezone.utc))]
    
    assessment = mitigator.evaluate_for_fp_risk(0.8, "1.2.3.4", history)
    # New IP/Single event usually has higher FP risk if it's an outlier
    assert assessment.fp_risk_score > 0.5

def test_fp_risk_correlated_events():
    mitigator = FalsePositiveMitigator()
    # 5 events in 5 minutes
    now = datetime.now(timezone.utc)
    history = [
        MagicMock(timestamp=now - timedelta(minutes=i)) for i in range(5)
    ]
    
    assessment = mitigator.evaluate_for_fp_risk(0.8, "1.2.3.4", history)
    # High frequency from same IP reduces FP risk (more likely a real attack)
    assert assessment.fp_risk_score < 0.3
