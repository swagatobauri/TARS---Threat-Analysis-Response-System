import uuid
from datetime import datetime, timezone
from unittest.mock import MagicMock, patch

import pytest
from sqlalchemy.orm import Session

from app.db.models import NetworkLog, AttackerProfile
from app.kill_chain.tracker import StageClassifier, KillChainTracker, KillChainStage, StageClassification
from app.scoring.decision_engine import ScoringEngine

@pytest.fixture
def db_session():
    return MagicMock(spec=Session)

def test_stage_classification_recon():
    classifier = StageClassifier()
    log = NetworkLog(
        source_ip="1.2.3.4",
        request_rate=150.0,
        raw_payload={"port_entropy": 0.9}
    )
    result = classifier.classify_stage(log, [])
    assert result.stage == KillChainStage.RECONNAISSANCE
    assert "high_connection_rate_to_many_ports" in result.signals_matched

def test_stage_classification_exploit():
    classifier = StageClassifier()
    log = NetworkLog(
        source_ip="1.2.3.4",
        raw_payload={"failed_logins": 15, "sqli_pattern": "1=1"}
    )
    result = classifier.classify_stage(log, [])
    assert result.stage == KillChainStage.EXPLOITATION
    assert "brute_force_login" in result.signals_matched
    assert "sqli_pattern" in result.signals_matched

def test_attacker_progression(db_session):
    tracker = KillChainTracker()
    ip = "1.2.3.4"
    
    # First stage: RECON
    with patch("app.kill_chain.tracker.publish_event"):
        profile = tracker.record_event(db_session, ip, KillChainStage.RECONNAISSANCE, 0.8, str(uuid.uuid4()))
        db_session.get.return_value = profile
        
        # Second stage: ENUM
        profile = tracker.record_event(db_session, ip, KillChainStage.ENUMERATION, 0.8, str(uuid.uuid4()))
        
        assert tracker.is_progressing(profile) is True
        assert profile.current_stage == KillChainStage.ENUMERATION.value

def test_kill_chain_multiplier():
    engine = ScoringEngine()
    # Mocking input for decide()
    anomaly_result = MagicMock(combined_score=0.5)
    ip_profile = MagicMock(reputation_score=1.0)
    fp_assessment = MagicMock(fp_risk_score=0.1)
    settings = MagicMock(HIGH_CONFIDENCE_THRESHOLD=0.8, MEDIUM_CONFIDENCE_THRESHOLD=0.5)
    
    # Without kill chain
    decision_normal = engine.decide(anomaly_result, ip_profile, None, fp_assessment, settings)
    
    # With EXPLOITATION stage
    decision_exploit = engine.decide(anomaly_result, ip_profile, KillChainStage.EXPLOITATION, fp_assessment, settings)
    
    # EXPLOITATION should increase confidence
    assert decision_exploit.confidence > decision_normal.confidence

def test_prediction(db_session):
    tracker = KillChainTracker()
    profile = AttackerProfile(
        source_ip="1.2.3.4",
        current_stage=KillChainStage.ENUMERATION.value,
        stage_history=[]
    )
    
    next_stage = tracker.predict_next_stage(profile)
    assert next_stage == KillChainStage.EXPLOITATION.value
