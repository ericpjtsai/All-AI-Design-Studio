from __future__ import annotations

from typing import Literal
from pydantic import BaseModel


# ── SSE event payloads ────────────────────────────────────────────────────────

class AgentUpdatePayload(BaseModel):
    agentIndex: int
    status: Literal["idle", "working", "reviewing", "complete", "error"]
    currentTask: str
    progress: float  # 0.0 – 1.0
    isActive: bool


class ActivityPayload(BaseModel):
    agentIndex: int
    message: str
    level: Literal["info", "success", "warn", "error"] = "info"


class PhaseChangePayload(BaseModel):
    phase: Literal["briefing", "scoping", "designing", "implementing", "reviewing", "complete"]


class ConfirmationOption(BaseModel):
    id: str
    label: str
    description: str = ""


class ConfirmationPromptPayload(BaseModel):
    id: str
    title: str
    question: str
    context: str = ""
    options: list[ConfirmationOption] = []


class SessionCompletePayload(BaseModel):
    pass


class SessionErrorPayload(BaseModel):
    message: str


# ── SSE envelope ──────────────────────────────────────────────────────────────

class SSEEvent(BaseModel):
    event: str
    data: dict


# ── REST request / response bodies ───────────────────────────────────────────

class StartSessionRequest(BaseModel):
    brief: str
    agent_trust: dict[int, float] = {}


class StartSessionResponse(BaseModel):
    session_id: str


class ConfirmRequest(BaseModel):
    action: Literal["confirm", "revise"]
    feedback: str | None = None


class ConfirmResponse(BaseModel):
    ok: bool


class SessionListItem(BaseModel):
    session_id: str
    status: str
    brief: str


class HealthResponse(BaseModel):
    status: str = "ok"
