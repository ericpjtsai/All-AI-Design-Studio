from __future__ import annotations

import asyncio
import time
from typing import Callable, Awaitable

from google import genai

from ..api.models import ActivityPayload, AgentUpdatePayload

# Emit callback type: receives event-name + payload dict, puts it on the SSE queue
EmitFn = Callable[[str, dict], None]

MODEL = "gemini-3-flash-preview"


class BaseAgent:
    """Shared foundation for all design-team agents.

    Each concrete agent subclass gets:
      - its own role index (maps to the frontend AGENTS array)
      - a Gemini client
      - helper methods: emit_activity(), emit_status(), call_llm()
    """

    def __init__(self, role_index: int, client: genai.Client) -> None:
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

    # ── LLM call ────────────────────────────────────────────────────────────

    async def call_llm(
        self,
        system: str,
        user: str,
        emit: EmitFn,
        activity_prefix: str = "Thinking",
        max_tokens: int = 8096,
    ) -> str:
        """Stream a Gemini response, emitting activity dots while streaming.

        Returns the full response text.
        """
        full_text = ""
        last_activity_at = time.monotonic()

        async for chunk in await self.client.aio.models.generate_content_stream(
            model=MODEL,
            contents=user,
            config=genai.types.GenerateContentConfig(
                system_instruction=system,
                max_output_tokens=max_tokens,
            ),
        ):
            if chunk.text:
                full_text += chunk.text

            # Emit a brief activity pulse every ~1.5 s to show liveness
            now = time.monotonic()
            if now - last_activity_at > 1.5:
                self.emit_activity(emit, f"{activity_prefix}…", "info")
                last_activity_at = now

        return full_text.strip()
