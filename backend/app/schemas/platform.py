"""Platform connection schemas."""

import uuid
from datetime import datetime

from pydantic import BaseModel


class PlatformConnectionResponse(BaseModel):
    id: uuid.UUID
    platform: str
    status: str  # connected | offline | reauth_required
    external_account_id: str | None = None
    metadata_: dict = {}
    created_at: datetime

    model_config = {"from_attributes": True}


class PlatformConnectRequest(BaseModel):
    platform: str  # whatsapp | slack | email | linkedin | sms
    external_account_id: str | None = None
    profile_name: str | None = None
    metadata_: dict | None = None
    # In a real implementation, the OAuth callback would provide the token.
    # For MVP/dev, accept it directly.
    access_token: str = "mock-token"
    refresh_token: str | None = None
