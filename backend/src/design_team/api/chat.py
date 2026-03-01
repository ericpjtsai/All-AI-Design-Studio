"""Chat endpoint: context-aware conversation with design team agents.

When a session is active, the agent receives its base system prompt plus
relevant session context (scope doc, its own outputs).  When no session
context is available, the agent still responds using its base prompt.
"""
from __future__ import annotations

import json
from typing import Literal

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from google import genai

from ..prompts import (
    DESIGN_MANAGER_SYSTEM,
    SENIOR_DESIGNER_SYSTEM,
    JUNIOR_DESIGNER_SYSTEM,
    VISUAL_DESIGNER_SYSTEM,
)

# ── Agent prompt lookup (backend index → system prompt) ──────────────────────

AGENT_PROMPTS: dict[int, str] = {
    0: DESIGN_MANAGER_SYSTEM,
    1: SENIOR_DESIGNER_SYSTEM,
    2: JUNIOR_DESIGNER_SYSTEM,
    3: VISUAL_DESIGNER_SYSTEM,
}

AGENT_ROLES: dict[int, str] = {
    0: "Design Manager",
    1: "Senior Designer",
    2: "Junior Designer",
    3: "Visual Designer",
}

# Keys in session outputs that are relevant per-agent
AGENT_CONTEXT_KEYS: dict[int, list[str]] = {
    0: ["scope_doc", "direction_brief", "cross_critique", "review"],
    1: ["scope_doc", "direction_brief", "senior_output"],
    2: ["scope_doc", "senior_output", "visual_output", "junior_output"],
    3: ["scope_doc", "direction_brief", "visual_output"],
}

import os

MODEL = os.environ.get("GEMINI_CHAT_MODEL", "gemini-2.5-flash")


# ── Request / response models ────────────────────────────────────────────────

class ChatMessage(BaseModel):
    role: Literal["user", "model"]
    text: str


class ChatRequest(BaseModel):
    agent_index: int
    message: str
    history: list[ChatMessage] = []


class ChatResponse(BaseModel):
    reply: str


# ── Router ───────────────────────────────────────────────────────────────────

router = APIRouter()


def _build_system_prompt(agent_index: int, session_outputs: dict | None) -> str:
    """Combine the agent's base prompt with session context."""
    base = AGENT_PROMPTS.get(agent_index)
    if base is None:
        raise ValueError(f"Unknown agent index: {agent_index}")

    parts = [base.strip()]

    if session_outputs:
        context_keys = AGENT_CONTEXT_KEYS.get(agent_index, [])
        context_parts = []
        for key in context_keys:
            val = session_outputs.get(key)
            if val:
                label = key.replace("_", " ").title()
                try:
                    formatted = json.dumps(val, indent=2, default=str)[:2000]
                except Exception:
                    formatted = str(val)[:2000]
                context_parts.append(f"## {label}\n{formatted}")

        if context_parts:
            parts.append("\n\n---\n# Current Session Context\n" + "\n\n".join(context_parts))

    parts.append(
        "\n\nKeep responses concise (2-4 sentences). "
        "Answer from your role's perspective. "
        "Reference session context when relevant."
    )

    return "\n".join(parts)


@router.post("/api/sessions/{session_id}/chat", response_model=ChatResponse)
async def chat_with_agent(session_id: str, body: ChatRequest):
    """Chat with a specific agent in the context of a session."""
    from .routes import _manager

    if body.agent_index not in AGENT_PROMPTS:
        raise HTTPException(status_code=400, detail=f"Invalid agent_index: {body.agent_index}")

    # Get session outputs for context
    session_outputs = _manager.get_outputs(session_id)

    system_prompt = _build_system_prompt(body.agent_index, session_outputs)

    # Build Gemini contents from history + new message
    contents = []
    for msg in body.history:
        contents.append({
            "role": "user" if msg.role == "user" else "model",
            "parts": [{"text": msg.text}],
        })
    contents.append({
        "role": "user",
        "parts": [{"text": body.message}],
    })

    try:
        client = genai.Client()
        response = await client.aio.models.generate_content(
            model=MODEL,
            contents=contents,
            config=genai.types.GenerateContentConfig(
                system_instruction=system_prompt,
                max_output_tokens=1024,
                temperature=0.7,
            ),
        )
        reply = response.text or "I'm not sure how to respond to that."
        # Some agent prompts instruct JSON output; extract plain text if wrapped.
        _stripped = reply.strip()
        if _stripped.startswith("{"):
            try:
                _parsed = json.loads(_stripped)
                if isinstance(_parsed, dict):
                    reply = (
                        _parsed.get("response")
                        or _parsed.get("reply")
                        or _parsed.get("text")
                        or _parsed.get("message")
                        or reply
                    )
            except json.JSONDecodeError:
                pass
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"LLM error: {exc}")

    return ChatResponse(reply=reply)
