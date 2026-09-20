"""FastAPI application factory — CORS, middleware, router registration, WebSocket."""

from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, Request, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import async_session_factory
from app.dependencies import get_db
from app.websocket import ws_manager


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup / shutdown lifecycle events."""
    # Startup: verify DB connection or run light checks if needed
    yield
    # Shutdown: cleanup


def create_app() -> FastAPI:
    app = FastAPI(
        title=settings.app_name,
        description="Unified AI Communication Assistant — API",
        version="1.0.0",
        lifespan=lifespan,
    )

    # ── CORS Middleware ──────────────────────────────────────────────────
    origins = [
        "https://omni-app-mu.vercel.app",
        "http://localhost:5173",
        "http://localhost:80",
        "http://localhost",
        "http://localhost:3000",
    ]
    if settings.frontend_url and settings.frontend_url not in origins:
        origins.append(settings.frontend_url)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_origin_regex=r"https?://.*",
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=["*"],
    )

    # ── Global Exception Handler to ensure CORS headers on 500 errors ────
    @app.exception_handler(Exception)
    async def global_exception_handler(request: Request, exc: Exception):
        origin = request.headers.get("origin", "*")
        return JSONResponse(
            status_code=500,
            content={"detail": f"Internal Server Error: {str(exc)}"},
            headers={
                "Access-Control-Allow-Origin": origin if origin != "*" else "https://omni-app-mu.vercel.app",
                "Access-Control-Allow-Credentials": "true",
            },
        )

    # ── Routers ──────────────────────────────────────────────────────────
    from app.routers.auth import router as auth_router
    from app.routers.conversations import router as conversations_router
    from app.routers.messages import router as messages_router
    from app.routers.automation import router as automation_router
    from app.routers.platforms import router as platforms_router
    from app.routers.contacts import router as contacts_router
    from app.routers.webhooks import router as webhooks_router
    from app.routers.device import router as device_router

    app.include_router(auth_router)
    app.include_router(conversations_router)
    app.include_router(messages_router)
    app.include_router(automation_router)
    app.include_router(platforms_router)
    app.include_router(contacts_router)
    app.include_router(webhooks_router)
    app.include_router(device_router)

    # ── WebSocket endpoint (browser) ─────────────────────────────────────
    @app.websocket("/ws/{user_id}")
    async def websocket_endpoint(websocket: WebSocket, user_id: str):
        await ws_manager.connect(websocket, user_id)
        try:
            while True:
                # Keep connection alive; client can send pings
                await websocket.receive_text()
        except WebSocketDisconnect:
            ws_manager.disconnect(websocket, user_id)

    # ── WebSocket endpoint (Android device bridge) ────────────────────────
    @app.websocket("/ws/device/{device_id}")
    async def device_websocket_endpoint(
        websocket: WebSocket,
        device_id: str,
        secret: str,
        db: AsyncSession = Depends(get_db),
    ):
        from app.routers.device import device_websocket_handler
        await device_websocket_handler(websocket, device_id, secret, db)

    # ── Root & Health check ──────────────────────────────────────────────
    @app.get("/")
    async def root():
        return {
            "status": "online",
            "app": settings.app_name,
            "version": "1.0.0",
            "docs": "/docs",
            "health": "/health",
        }

    @app.get("/health")
    @app.get("/api/health")
    async def health():
        return {"status": "ok", "app": settings.app_name}

    return app


app = create_app()
