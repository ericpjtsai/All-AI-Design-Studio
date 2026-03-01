from __future__ import annotations

import asyncio
import re
import time
from typing import Callable, Awaitable

from google import genai

from ..api.models import ActivityPayload, AgentUpdatePayload

# Emit callback type: receives event-name + payload dict, puts it on the SSE queue
EmitFn = Callable[[str, dict], None]

import os

MODEL = os.environ.get("GEMINI_MODEL", "gemini-2.5-flash")


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

    # ── JSON cleaning ───────────────────────────────────────────────────────

    @staticmethod
    def clean_json(raw: str) -> str:
        """Clean and repair LLM JSON responses; always returns a JSON object string.

        json-repair handles: trailing commas, unescaped chars, truncated JSON, etc.
        We additionally unwrap any top-level JSON array — all our prompts ask for
        a single object, so an array is always a wrapping mistake by the LLM.
        """
        import json as _json
        from json_repair import repair_json  # type: ignore[import]

        raw = raw.strip()

        # Strip only the OUTER code fence using anchored patterns
        if raw.startswith("```"):
            raw = re.sub(r"^```(?:json|JSON)?\s*", "", raw)
            raw = re.sub(r"\s*```\s*$", "", raw)
            raw = raw.strip()

        repaired = repair_json(raw, return_objects=False)

        # Unwrap if the LLM wrapped the object in a JSON array: [{...}] → {...}
        try:
            parsed = _json.loads(repaired)
            if isinstance(parsed, list):
                first = next((item for item in parsed if isinstance(item, dict)), None)
                return _json.dumps(first if first is not None else {})
        except Exception:
            pass

        return repaired

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
        max_retries: int = 3,
        on_chunk: Callable[[str], None] | None = None,
    ) -> str:
        """Stream a Gemini response, emitting activity dots while streaming.

        Retries up to max_retries times on transient errors before raising.
        Returns the full response text.
        """
        last_exc: Exception | None = None
        for attempt in range(max_retries):
            try:
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
                        if on_chunk:
                            on_chunk(chunk.text)

                    now = time.monotonic()
                    if now - last_activity_at > 1.5:
                        self.emit_activity(emit, f"{activity_prefix}…", "info")
                        last_activity_at = now

                result = full_text.strip()
                print(f"[LLM:{activity_prefix}] {len(result)} chars | max_tokens={max_tokens}")
                return result

            except Exception as exc:
                last_exc = exc
                wait = 2 ** attempt  # 1 s, 2 s, 4 s
                print(f"[LLM:{activity_prefix}] attempt {attempt + 1} failed: {exc!r} — retrying in {wait}s")
                self.emit_activity(
                    emit,
                    f"{activity_prefix}: error, retrying… ({exc.__class__.__name__})",
                    "warn",
                )
                await asyncio.sleep(wait)

        raise RuntimeError(f"LLM call failed after {max_retries} attempts") from last_exc
