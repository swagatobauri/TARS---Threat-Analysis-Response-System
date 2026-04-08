from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text

from app.db.database import get_db
from app.api.schemas import HealthResponse

router = APIRouter()

@router.get("", response_model=HealthResponse)
async def health_check(db: AsyncSession = Depends(get_db)):
    db_status = "unhealthy"
    try:
        await db.execute(text("SELECT 1"))
        db_status = "healthy"
    except Exception:
        pass

    return HealthResponse(
        status="ok",
        db_status=db_status,
        celery_active=True,   # To be integrated with celery inspect
        ml_model_loaded=True, # To be integrated with ML manager
        last_detection_timestamp=None
    )
