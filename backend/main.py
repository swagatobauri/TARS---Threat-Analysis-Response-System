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
from app.api.intelligence import router as intelligence_router
from app.api.logs import router as logs_router
from app.api.health import router as health_router
from app.api.safety import router as safety_router
from app.api.kill_chain import router as kill_chain_router
from app.api.metrics import router as metrics_router

# ---------------------------------------------------------
# Lifespan Context Manager
# ---------------------------------------------------------
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup Event
    logger.info("TARS API Starting up...")
    
    if settings.DEMO_MODE:
        logger.info("🚀 DEMO MODE ACTIVE: Starting internal background loops...")
        import asyncio
        from app.tasks.detection import detect_anomaly
        from app.metrics.validator import MetricsComputer

        async def run_detection_loop():
            while True:
                try:
                    await asyncio.to_thread(detect_anomaly)
                except Exception as e:
                    logger.error(f"Error in background detection: {e}")
                await asyncio.sleep(5) # Scan every 5s in demo mode

        async def run_metrics_loop():
            computer = MetricsComputer()
            while True:
                try:
                    await asyncio.to_thread(computer.compute_window_metrics)
                except Exception as e:
                    logger.error(f"Error in background metrics: {e}")
                await asyncio.sleep(600) # Compute every 10 mins in demo mode

        asyncio.create_task(run_detection_loop())
        asyncio.create_task(run_metrics_loop())

    logger.info(f"Connecting to database at {settings.DATABASE_URL}")
    logger.info(f"Loading ML models from {settings.MODEL_PATH}")
    
    yield # App runs here
    
    # Shutdown Event
    logger.info("TARS API Shutting down...")

# ---------------------------------------------------------
# FastAPI App Initialization
# ---------------------------------------------------------
app = FastAPI(
    title="TARS API",
    description="Production-Grade Autonomous Cybersecurity Agent — autonomous security co-pilot that reduces alert fatigue, accelerates response time, and safely automates high-confidence defensive actions",
    version="2.0.0",
    lifespan=lifespan
)

# CORS middleware allowing all origins for demo compatibility
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Allows Render frontend to connect to Render backend
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(threats_router, prefix="/api/v1/threats", tags=["Threats"])
app.include_router(intelligence_router, prefix="/api/v1/intelligence", tags=["Intelligence"])
app.include_router(logs_router, prefix="/api/v1/logs", tags=["Logs"])
app.include_router(health_router, prefix="/api/v1/health", tags=["Health"])
app.include_router(safety_router, prefix="/api/v1/safety", tags=["Safety"])
app.include_router(kill_chain_router, prefix="/api/v1/kill-chain", tags=["Kill Chain"])
app.include_router(metrics_router, prefix="/api/v1/metrics", tags=["Metrics"])

if __name__ == "__main__":
    import uvicorn
    # Typically this is run via the uvicorn command in docker/production, 
    # but left here for local dev convenience
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
