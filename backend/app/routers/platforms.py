"""Platforms router — list, connect, disconnect, reconnect."""

import uuid

from fastapi import APIRouter, HTTPException
from sqlalchemy import select

from app.dependencies import CurrentUser, DbSession
from app.models.platform_connection import PlatformConnection
from app.schemas.platform import PlatformConnectionResponse, PlatformConnectRequest
from app.services.audit_service import log_action

router = APIRouter(prefix="/api/platforms", tags=["platforms"])

VALID_PLATFORMS = {"whatsapp", "slack", "email", "linkedin", "sms"}


@router.get("", response_model=list[PlatformConnectionResponse])
async def list_platforms(db: DbSession, current_user: CurrentUser):
    """List all platform connections for the current user."""
    result = await db.execute(
        select(PlatformConnection).where(
            PlatformConnection.user_id == current_user.id
        )
    )
    connections = result.scalars().all()
    # Map metadata_ → metadata_ for response (alias)
    return [
        PlatformConnectionResponse(
            id=c.id,
            platform=c.platform,
            status=c.status,
            external_account_id=c.external_account_id,
            metadata_=c.metadata_ or {},
            created_at=c.created_at,
        )
        for c in connections
    ]


@router.post("/connect", response_model=PlatformConnectionResponse, status_code=201)
async def connect_platform(
    body: PlatformConnectRequest,
    db: DbSession,
    current_user: CurrentUser,
):
    """Connect a platform. For MVP, accepts token directly.
    In production, this completes the OAuth callback flow."""
    if body.platform not in VALID_PLATFORMS:
        raise HTTPException(status_code=400, detail=f"Unknown platform: {body.platform}")

    # Check for existing connection
    result = await db.execute(
        select(PlatformConnection).where(
            PlatformConnection.user_id == current_user.id,
            PlatformConnection.platform == body.platform,
            PlatformConnection.external_account_id == body.external_account_id,
        )
    )
    existing = result.scalar_one_or_none()
    if existing:
        # Re-auth: update tokens + status
        existing.access_token_enc = body.access_token  # TODO: encrypt
        existing.refresh_token_enc = body.refresh_token
        existing.status = "connected"
        await db.commit()
        await db.refresh(existing)
        conn = existing
    else:
        conn = PlatformConnection(
            user_id=current_user.id,
            platform=body.platform,
            external_account_id=body.external_account_id,
            access_token_enc=body.access_token,  # TODO: encrypt at rest
            refresh_token_enc=body.refresh_token,
            status="connected",
        )
        db.add(conn)
        await db.flush()

    await log_action(
        db,
        user_id=current_user.id,
        actor="user",
        action="reconnect_platform",
        details={"platform": body.platform, "account": body.external_account_id},
    )
    await db.commit()
    await db.refresh(conn)
    return PlatformConnectionResponse(
        id=conn.id,
        platform=conn.platform,
        status=conn.status,
        external_account_id=conn.external_account_id,
        metadata_=conn.metadata_ or {},
        created_at=conn.created_at,
    )


@router.delete("/{connection_id}", status_code=204)
async def disconnect_platform(
    connection_id: uuid.UUID,
    db: DbSession,
    current_user: CurrentUser,
):
    """Disconnect a platform."""
    result = await db.execute(
        select(PlatformConnection).where(
            PlatformConnection.id == connection_id,
            PlatformConnection.user_id == current_user.id,
        )
    )
    conn = result.scalar_one_or_none()
    if not conn:
        raise HTTPException(status_code=404, detail="Platform connection not found")

    await db.delete(conn)
    await log_action(
        db,
        user_id=current_user.id,
        actor="user",
        action="disconnect_platform",
        details={"platform": conn.platform},
    )
    await db.commit()


@router.post("/{connection_id}/reconnect", response_model=PlatformConnectionResponse)
async def reconnect_platform(
    connection_id: uuid.UUID,
    db: DbSession,
    current_user: CurrentUser,
):
    """Trigger re-auth for a platform (stub — returns OAuth URL in production)."""
    result = await db.execute(
        select(PlatformConnection).where(
            PlatformConnection.id == connection_id,
            PlatformConnection.user_id == current_user.id,
        )
    )
    conn = result.scalar_one_or_none()
    if not conn:
        raise HTTPException(status_code=404, detail="Platform connection not found")

    conn.status = "reauth_required"
    await db.commit()
    await db.refresh(conn)
    # TODO: Return OAuth URL for the platform
    return PlatformConnectionResponse(
        id=conn.id,
        platform=conn.platform,
        status=conn.status,
        external_account_id=conn.external_account_id,
        metadata_=conn.metadata_ or {},
        created_at=conn.created_at,
    )
