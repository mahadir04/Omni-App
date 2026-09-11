"""FastAPI application factory — CORS, middleware, router registration, WebSocket."""

from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.websocket import ws_manager


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup / shutdown lifecycle events."""
    # Startup: any init work (e.g., verifying DB connection) goes here
    yield
    # Shutdown: cleanup


def create_app() -> FastAPI:
    app = FastAPI(
        title=settings.app_name,
        description="Unified AI Communication Assistant — API",
        version="1.0.0",
        lifespan=lifespan,
    )

    # ── CORS ─────────────────────────────────────────────────────────────
    origins = [settings.frontend_url, "http://localhost:5173", "http://localhost:80", "http://localhost"]
    if settings.frontend_url not in origins:
        origins.append(settings.frontend_url)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_origin_regex=r"https?://.*\.railway\.app",
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # ── Routers ──────────────────────────────────────────────────────────
    from app.routers.auth import router as auth_router
    from app.routers.conversations import router as conversations_router
    from app.routers.messages import router as messages_router
    from app.routers.automation import router as automation_router
    from app.routers.platforms import router as platforms_router
    from app.routers.contacts import router as contacts_router
    from app.routers.webhooks import router as webhooks_router

    app.include_router(auth_router)
    app.include_router(conversations_router)
    app.include_router(messages_router)
    app.include_router(automation_router)
    app.include_router(platforms_router)
    app.include_router(contacts_router)
    app.include_router(webhooks_router)

    # ── WebSocket endpoint ───────────────────────────────────────────────
    @app.websocket("/ws/{user_id}")
    async def websocket_endpoint(websocket: WebSocket, user_id: str):
        await ws_manager.connect(websocket, user_id)
        try:
            while True:
                # Keep connection alive; client can send pings
                await websocket.receive_text()
        except WebSocketDisconnect:
            ws_manager.disconnect(websocket, user_id)

    # ── Health check ─────────────────────────────────────────────────────
    @app.get("/health")
    async def health():
        return {"status": "ok", "app": settings.app_name}

    return app


app = create_app()
