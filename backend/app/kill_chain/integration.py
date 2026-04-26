import logging
from typing import Tuple, Optional
from sqlalchemy.orm import Session
from sqlalchemy import select

from app.db.models import NetworkLog, AttackerProfile
from app.kill_chain.tracker import KillChainTracker, StageClassifier

logger = logging.getLogger(__name__)

def enrich_with_kill_chain(
    session: Session, source_ip: str, log: NetworkLog, threat_event_id: str
) -> Tuple[Optional[str], bool]:
    """
    Integrates Kill Chain tracking into the reasoning pipeline.
    Classifies the current log, updates the attacker profile,
    and returns the current stage and progressing status.
    """
    try:
        classifier = StageClassifier()
        tracker = KillChainTracker()
        
        # We would typically pull recent history logs for the classifier, 
        # but passing an empty list as a placeholder for heuristic
        history_logs = []
        
        classification = classifier.classify_stage(log, history_logs)
        
        if classification.stage and classification.confidence >= 0.4:
            logger.info("Kill chain stage detected: %s (conf: %.2f)", classification.stage.value, classification.confidence)
            profile = tracker.record_event(
                session, source_ip, classification.stage, classification.confidence, threat_event_id
            )
            is_progressing = tracker.is_progressing(profile)
            return classification.stage.value, is_progressing
            
        # If no new stage detected, check if profile already exists
        profile = session.get(AttackerProfile, source_ip)
        if profile and profile.is_active:
            is_progressing = tracker.is_progressing(profile)
            return profile.current_stage, is_progressing
            
    except Exception as e:
        logger.exception("Failed to enrich kill chain context")
        
    return None, False
