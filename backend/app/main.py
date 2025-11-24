"""
Ulwandle Tech - Main FastAPI Application
Resource Allocation & Compliance (RAC) System
"""

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import logging

from app.core.config import settings
from app.api import (
    monitoring,
    water_quality,
    kill_switch,
    predictions,
    districts,
    alerts,
    dashboard
)
from app.db.database import engine, Base
from app.services.websocket_manager import websocket_manager

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan events"""
    # Startup
    logger.info("Starting Ulwandle Tech RAC System...")
    logger.info(f"Environment: {settings.APP_ENV}")
    logger.info(f"Database: {settings.DATABASE_URL.split('@')[-1]}")

    # Create database tables
    Base.metadata.create_all(bind=engine)
    logger.info("Database tables created")

    yield

    # Shutdown
    logger.info("Shutting down Ulwandle Tech RAC System...")


# Initialize FastAPI app
app = FastAPI(
    title=settings.APP_NAME,
    description="Smart Water Monitoring System for South Africa - Resource Allocation & Compliance",
    version=settings.APP_VERSION,
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Health check endpoint
@app.get("/", tags=["Health"])
async def root():
    """Root endpoint - health check"""
    return {
        "app": settings.APP_NAME,
        "tagline": "Resource Allocation & Compliance (RAC)",
        "version": settings.APP_VERSION,
        "status": "operational",
        "environment": settings.APP_ENV
    }


@app.get("/health", tags=["Health"])
async def health_check():
    """Detailed health check"""
    return {
        "status": "healthy",
        "database": "connected",
        "ai_service": "operational",
        "version": settings.APP_VERSION
    }


# WebSocket endpoint for real-time updates
@app.websocket("/ws/{client_id}")
async def websocket_endpoint(websocket: WebSocket, client_id: str):
    """WebSocket connection for real-time monitoring and alerts"""
    await websocket_manager.connect(websocket, client_id)
    try:
        while True:
            data = await websocket.receive_text()
            # Echo back for now - can be enhanced with specific message handling
            await websocket_manager.send_personal_message(
                f"Message received: {data}", client_id
            )
    except WebSocketDisconnect:
        websocket_manager.disconnect(client_id)
        logger.info(f"Client {client_id} disconnected")


# Include API routers
app.include_router(monitoring.router, prefix="/api/v1/monitoring", tags=["Monitoring"])
app.include_router(water_quality.router, prefix="/api/v1/water-quality", tags=["Water Quality"])
app.include_router(kill_switch.router, prefix="/api/v1/kill-switch", tags=["Kill Switch"])
app.include_router(predictions.router, prefix="/api/v1/predictions", tags=["AI Predictions"])
app.include_router(districts.router, prefix="/api/v1/districts", tags=["Districts"])
app.include_router(alerts.router, prefix="/api/v1/alerts", tags=["Alerts"])
app.include_router(dashboard.router, prefix="/api/v1/dashboard", tags=["Dashboard"])


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True
    )
