from __future__ import annotations

import json

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import StreamingResponse
from sse_starlette.sse import EventSourceResponse

from .models import (
    ConfirmRequest,
    ConfirmResponse,
    HealthResponse,
    SessionListItem,
    StartSessionRequest,
    StartSessionResponse,
)
from ..session_manager import SessionManager

router = APIRouter()
_manager = SessionManager()


# ── Health ────────────────────────────────────────────────────────────────────

@router.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    return HealthResponse()


# ── Sessions ──────────────────────────────────────────────────────────────────

@router.post("/api/sessions", response_model=StartSessionResponse)
async def start_session(body: StartSessionRequest) -> StartSessionResponse:
    if not body.brief.strip():
        raise HTTPException(status_code=422, detail="brief must not be empty")
    session_id = await _manager.create_session(body.brief)
    return StartSessionResponse(session_id=session_id)


@router.get("/api/sessions")
async def list_sessions() -> list[SessionListItem]:
    return [SessionListItem(**s) for s in _manager.list_sessions()]


@router.get("/api/sessions/{session_id}/events")
async def session_events(session_id: str, request: Request):
    """SSE stream of all workflow events for a session."""

    async def event_generator():
        async for event in _manager.stream_events(session_id):
            if await request.is_disconnected():
                break
            # sse-starlette expects dicts with 'event' and 'data' keys
            yield {"event": event["event"], "data": json.dumps(event["data"])}

    return EventSourceResponse(event_generator())


@router.post("/api/sessions/{session_id}/confirm", response_model=ConfirmResponse)
async def confirm(session_id: str, body: ConfirmRequest) -> ConfirmResponse:
    ok = await _manager.confirm(session_id, body.action, body.feedback)
    if not ok:
        raise HTTPException(
            status_code=409,
            detail="Session not found or not awaiting confirmation",
        )
    return ConfirmResponse(ok=True)


@router.get("/api/sessions/{session_id}/outputs")
async def get_outputs(session_id: str) -> dict:
    outputs = _manager.get_outputs(session_id)
    if outputs is None:
        raise HTTPException(status_code=404, detail="Session not found")
    return outputs
