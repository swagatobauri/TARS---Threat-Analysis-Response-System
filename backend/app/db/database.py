from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from app.core.config import settings

# ---------------------
# Async Engine (FastAPI)
# ---------------------
engine = create_async_engine(settings.DATABASE_URL, echo=settings.DEBUG)

AsyncSessionLocal = async_sessionmaker(
    engine, class_=AsyncSession, expire_on_commit=False
)

async def get_db():
    async with AsyncSessionLocal() as session:
        yield session

# ---------------------
# Sync Engine (Celery)
# ---------------------
sync_engine = create_engine(settings.SYNC_DATABASE_URL, echo=settings.DEBUG)

SyncSessionLocal = sessionmaker(
    bind=sync_engine, class_=Session, expire_on_commit=False
)

def get_sync_db():
    """Context manager for synchronous Celery tasks."""
    session = SyncSessionLocal()
    try:
        yield session
    finally:
        session.close()
