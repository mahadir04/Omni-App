"""FastAPI application factory — CORS, middleware, router registration, WebSocket."""

from contextlib import asynccontextmanager
from typing import Callable

from fastapi import FastAPI, Request, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from starlette.middleware.base import BaseHTTPMiddleware

from app.config import settings
from app.websocket import ws_manager


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup / shutdown lifecycle events."""
    # Startup: any init work (e.g., verifying DB connection) goes here
    yield
    # Shutdown: cleanup


class DynamicCORSMiddleware(BaseHTTPMiddleware):
    """Middleware that echoes back the request Origin header so any origin is allowed.
    
    This is the only reliable way to support credentials=true from any origin,
    since browsers reject Access-Control-Allow-Origin: * when credentials are used.
    """

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        origin = request.headers.get("origin", "")

        # Handle CORS preflight (OPTIONS) requests
        if request.method == "OPTIONS" and origin:
            response = Response(
                content="OK",
                status_code=200,
                headers={
                    "Access-Control-Allow-Origin": origin,
                    "Access-Control-Allow-Credentials": "true",
                    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
                    "Access-Control-Allow-Headers": "Content-Type, Authorization, Accept, X-Requested-With",
                    "Access-Control-Max-Age": "600",
                    "Vary": "Origin",
                },
            )
            return response

        # Handle regular requests
        response = await call_next(request)

        if origin:
            response.headers["Access-Control-Allow-Origin"] = origin
            response.headers["Access-Control-Allow-Credentials"] = "true"
            response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, PATCH, DELETE, OPTIONS"
            response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization, Accept, X-Requested-With"
            response.headers["Vary"] = "Origin"

        return response


def create_app() -> FastAPI:
    app = FastAPI(
        title=settings.app_name,
        description="Unified AI Communication Assistant — API",
        version="1.0.0",
        lifespan=lifespan,
    )

    # ── Dynamic CORS (works with credentials from any origin) ─────────────
    app.add_middleware(DynamicCORSMiddleware)

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
