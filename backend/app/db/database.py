from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from app.core.config import settings

# ---------------------
# Engine Setup
# ---------------------
is_sqlite = settings.DATABASE_URL.startswith("sqlite")
connect_args = {"check_same_thread": False} if is_sqlite else {}

# Async Engine (FastAPI)
engine = create_async_engine(
    settings.DATABASE_URL, 
    echo=settings.DEBUG,
    connect_args=connect_args if "asyncpg" not in settings.DATABASE_URL else {}
)

AsyncSessionLocal = async_sessionmaker(
    engine, class_=AsyncSession, expire_on_commit=False
)

# Enable WAL mode for SQLite to prevent "Database is locked" errors
from sqlalchemy import event

@event.listens_for(engine.sync_engine, "connect")
def set_sqlite_pragma(dbapi_connection, connection_record):
    if is_sqlite:
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.execute("PRAGMA synchronous=NORMAL")
        cursor.close()

@event.listens_for(sync_engine, "connect")
def set_sync_sqlite_pragma(dbapi_connection, connection_record):
    if is_sqlite:
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.execute("PRAGMA synchronous=NORMAL")
        cursor.close()

async def get_db():
    async with AsyncSessionLocal() as session:
        yield session

# Sync Engine (Celery / Background Tasks)
sync_engine = create_engine(
    settings.SYNC_DATABASE_URL, 
    echo=settings.DEBUG,
    connect_args=connect_args if "psycopg2" not in settings.SYNC_DATABASE_URL else {}
)

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
