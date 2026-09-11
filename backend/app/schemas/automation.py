"""Automation rules schemas."""

from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, Field


class AutomationRulesResponse(BaseModel):
    master_switch_enabled: bool
    response_strategy: str
    confidence_threshold: float
    notify_on_negative_sentiment: bool
    bypass_automation_for_vip: bool
    forward_financial_queries: bool
    status: str  # draft | approved

    model_config = {"from_attributes": True}


class AutomationRulesUpdate(BaseModel):
    master_switch_enabled: bool | None = None
    response_strategy: Literal[
        "human_in_the_loop", "hybrid_autopilot", "full_autopilot"
    ] | None = None
    confidence_threshold: float | None = Field(None, ge=0, le=100)
    notify_on_negative_sentiment: bool | None = None
    bypass_automation_for_vip: bool | None = None
    forward_financial_queries: bool | None = None
