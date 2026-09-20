"""Pydantic schemas for device bridge endpoints."""

import uuid
from datetime import datetime

from pydantic import BaseModel, Field


# ── Registration ─────────────────────────────────────────────────────────────

class DeviceRegisterRequest(BaseModel):
    device_name: str = Field(..., min_length=1, max_length=100, example="Pixel 9 Pro")
    metadata_: dict | None = Field(
        default=None,
        alias="metadata",
        description="Optional: OS version, app version, push token",
    )

    model_config = {"populate_by_name": True}


class DeviceRegisterResponse(BaseModel):
    device_id: str
    device_secret: str
    message: str = "Store these credentials securely. The secret is shown only once."


# ── Inbound message from phone ────────────────────────────────────────────────

class DeviceMessagePayload(BaseModel):
    device_id: str
    device_secret: str
    platform: str = Field(
        ...,
        description="whatsapp | messenger | instagram | sms",
        example="whatsapp",
    )
    sender_name: str = Field(..., example="John Doe")
    sender_handle: str = Field(
        ...,
        description="Phone number, username, or platform-specific ID",
        example="+8801712345678",
    )
    content: str = Field(..., min_length=1)
    notification_key: str = Field(
        ...,
        description="Unique Android notification key — used to route replies via RemoteInput",
        example="com.whatsapp|0|tag|12345",
    )
    app_package: str | None = Field(
        default=None,
        description="Android app package name",
        example="com.whatsapp",
    )
    timestamp_ms: int | None = Field(
        default=None,
        description="Message timestamp in milliseconds (Unix epoch)",
    )


# ── Reply acknowledgement from phone ─────────────────────────────────────────

class DeviceReplyAck(BaseModel):
    device_id: str
    device_secret: str
    conversation_id: str
    status: str = Field(..., description="sent | failed | dismissed")
    error: str | None = None


# ── Device status for UI ──────────────────────────────────────────────────────

class DeviceStatusResponse(BaseModel):
    device_id: str
    device_name: str
    is_online: bool
    last_seen_at: datetime | None
    created_at: datetime

    model_config = {"from_attributes": True}
