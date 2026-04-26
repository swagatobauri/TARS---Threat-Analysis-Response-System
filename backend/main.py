import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, APIRouter
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ---------------------------------------------------------
# API Routers
# ---------------------------------------------------------
from app.api.threats import router as threats_router
from app.api.agent import router as agent_router
from app.api.logs import router as logs_router
from app.api.health import router as health_router

# ---------------------------------------------------------
# Lifespan Context Manager
# ---------------------------------------------------------
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup Event
    logger.info("TARS API Starting up...")
    logger.info(f"Connecting to database at {settings.DATABASE_URL}")
    logger.info(f"Loading ML models from {settings.MODEL_PATH}")
    # TODO: Implement actual Database initialization and ML model loading here
    
    yield # App runs here
    
    # Shutdown Event
    logger.info("TARS API Shutting down...")
    # TODO: Implement teardown of DB connections, ML model cleanup, etc.

# ---------------------------------------------------------
# FastAPI App Initialization
# ---------------------------------------------------------
app = FastAPI(
    title="TARS API",
    description="Production-Grade Autonomous Cybersecurity Agent — autonomous security co-pilot that reduces alert fatigue, accelerates response time, and safely automates high-confidence defensive actions",
    version="2.0.0",
    lifespan=lifespan
)

# CORS middleware allowing frontend origin
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(threats_router, prefix="/api/v1/threats", tags=["Threats"])
app.include_router(agent_router, prefix="/api/v1/agent", tags=["Intelligence"])
app.include_router(logs_router, prefix="/api/v1/logs", tags=["Logs"])
app.include_router(health_router, prefix="/api/v1/health", tags=["Health"])

if __name__ == "__main__":
    import uvicorn
    # Typically this is run via the uvicorn command in docker/production, 
    # but left here for local dev convenience
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
