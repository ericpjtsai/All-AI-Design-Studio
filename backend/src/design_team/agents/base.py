from __future__ import annotations

import asyncio
import time
from typing import Callable, Awaitable

import anthropic

from ..api.models import ActivityPayload, AgentUpdatePayload

# Emit callback type: receives event-name + payload dict, puts it on the SSE queue
EmitFn = Callable[[str, dict], None]

MODEL = "claude-sonnet-4-20250514"


class BaseAgent:
    """Shared foundation for all design-team agents.

    Each concrete agent subclass gets:
      - its own role index (maps to the frontend AGENTS array)
      - an AsyncAnthropic client
      - helper methods: emit_activity(), emit_status(), call_claude()
    """

    def __init__(self, role_index: int, client: anthropic.AsyncAnthropic) -> None:
        self.role_index = role_index
        self.client = client

    # ── Emit helpers ────────────────────────────────────────────────────────

    def emit_activity(
        self,
        emit: EmitFn,
        message: str,
        level: str = "info",
    ) -> None:
        payload = ActivityPayload(
            agentIndex=self.role_index,
            message=message,
            level=level,
        )
        emit("activity", payload.model_dump())

    def emit_status(
        self,
        emit: EmitFn,
        status: str,
        current_task: str,
        progress: float = 0.0,
        is_active: bool = True,
    ) -> None:
        payload = AgentUpdatePayload(
            agentIndex=self.role_index,
            status=status,
            currentTask=current_task,
            progress=progress,
            isActive=is_active,
        )
        emit("agent_update", payload.model_dump())

    # ── Claude call ─────────────────────────────────────────────────────────

    async def call_claude(
        self,
        system: str,
        user: str,
        emit: EmitFn,
        activity_prefix: str = "Thinking",
        max_tokens: int = 8096,
    ) -> str:
        """Stream a Claude response, emitting activity dots while streaming.

        Returns the full response text.
        """
        full_text = ""
        chunk_count = 0
        last_activity_at = time.monotonic()

        async with self.client.messages.stream(
            model=MODEL,
            max_tokens=max_tokens,
            system=system,
            messages=[{"role": "user", "content": user}],
        ) as stream:
            async for text in stream.text_stream:
                full_text += text
                chunk_count += 1

                # Emit a brief activity pulse every ~20 chunks to show liveness
                now = time.monotonic()
                if now - last_activity_at > 1.5:
                    self.emit_activity(emit, f"{activity_prefix}…", "info")
                    last_activity_at = now

        return full_text.strip()
