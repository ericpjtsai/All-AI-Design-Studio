"""Bridge between LangGraph node execution and the SSE asyncio.Queue.

Every node receives the sse_queue via config["configurable"]["sse_queue"]
and wraps it in an EmitFn so existing agent code works unmodified.
"""
from __future__ import annotations

import asyncio
from typing import Any

from ..agents.base import EmitFn


def make_emit(sse_queue: asyncio.Queue | None) -> EmitFn:
    """Create an emit callback that pushes events to the SSE queue."""
    def emit(event_type: str, payload: dict) -> None:
        if sse_queue is not None:
            sse_queue.put_nowait({"event": event_type, "data": payload})
    return emit


def get_emit_from_config(config: dict[str, Any]) -> EmitFn:
    """Extract sse_queue from LangGraph config and return an emit function."""
    sse_queue = config.get("configurable", {}).get("sse_queue")
    return make_emit(sse_queue)
