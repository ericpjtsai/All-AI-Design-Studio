"""LangGraph-based session manager.

Drop-in replacement for the asyncio-based SessionManager.  Exposes the
exact same public API so routes.py can switch between them with a feature flag.

Key differences from the old implementation:
- Workflow is a compiled LangGraph StateGraph (not a single async function)
- Human checkpoints use interrupt() / Command(resume=...) instead of asyncio.Event
- State is checkpointed to SQLite for persistence
- SSE events still flow through an asyncio.Queue (unchanged contract)
"""
from __future__ import annotations

import asyncio
import uuid
from dataclasses import dataclass, field
from typing import AsyncGenerator

import os

from langgraph.checkpoint.memory import MemorySaver
from langgraph.checkpoint.sqlite import SqliteSaver
from langgraph.types import Command

from .builder import build_graph
from .state import DesignTeamState


CONFIDENCE_INIT = 0.5


@dataclass
class LGSessionData:
    """Per-session runtime data (not persisted — LangGraph state is)."""
    session_id: str
    brief: str
    thread_id: str
    queue: asyncio.Queue = field(default_factory=asyncio.Queue)
    task: asyncio.Task | None = None
    status: str = "running"
    agent_trust: dict = field(default_factory=dict)
    # Internal signaling for human checkpoint bridge
    _resume_event: asyncio.Event = field(default_factory=asyncio.Event)
    _resume_data: dict | None = None


class LangGraphSessionManager:
    """Manages sessions backed by a LangGraph StateGraph."""

    def __init__(self, checkpointer=None, db_path: str | None = None) -> None:
        self._sessions: dict[str, LGSessionData] = {}
        graph_builder = build_graph()

        if checkpointer is not None:
            self._checkpointer = checkpointer
        elif db_path or os.environ.get("LANGGRAPH_DB"):
            path = db_path or os.environ.get("LANGGRAPH_DB", "data/sessions.sqlite")
            import sqlite3
            conn = sqlite3.connect(path, check_same_thread=False)
            self._checkpointer = SqliteSaver(conn)
        else:
            self._checkpointer = MemorySaver()

        self._graph = graph_builder.compile(checkpointer=self._checkpointer)

    # ── Public API (same signatures as old SessionManager) ───────────────────

    async def create_session(self, brief: str, agent_trust: dict | None = None) -> str:
        session_id = str(uuid.uuid4())[:8]
        thread_id = f"thread_{session_id}"

        trust: dict[int, float] = {}
        if agent_trust:
            for k, v in agent_trust.items():
                trust[int(k)] = float(v)

        data = LGSessionData(
            session_id=session_id,
            brief=brief,
            thread_id=thread_id,
            agent_trust=trust,
        )
        self._sessions[session_id] = data
        data.task = asyncio.create_task(self._run_graph(data))
        return session_id

    async def confirm(self, session_id: str, action: str, feedback: str | None = None) -> bool:
        data = self._sessions.get(session_id)
        if data is None or data.status != "awaiting_confirm":
            return False
        data._resume_data = {"action": action, "feedback": feedback or ""}
        data.status = "running"
        data._resume_event.set()
        return True

    async def stream_events(self, session_id: str) -> AsyncGenerator[dict, None]:
        """Drain the SSE queue — identical to old SessionManager."""
        data = self._sessions.get(session_id)
        if data is None:
            yield {"event": "session_error", "data": {"message": "Session not found"}}
            return
        while True:
            try:
                event = await asyncio.wait_for(data.queue.get(), timeout=30.0)
                yield event
                data.queue.task_done()
                if event["event"] in ("session_complete", "session_error"):
                    break
            except asyncio.TimeoutError:
                yield {"event": "ping", "data": {}}

    def list_sessions(self) -> list[dict]:
        return [
            {"session_id": s.session_id, "status": s.status, "brief": s.brief[:80]}
            for s in self._sessions.values()
        ]

    def get_outputs(self, session_id: str) -> dict | None:
        """Read outputs from the latest LangGraph checkpoint state."""
        data = self._sessions.get(session_id)
        if data is None:
            return None

        config = {"configurable": {"thread_id": data.thread_id}}
        try:
            snapshot = self._graph.get_state(config)
            state = snapshot.values
            return {
                "scope_doc": state.get("scope_doc", {}),
                "direction_brief": state.get("direction_brief", {}),
                "senior_output": state.get("senior_output", {}),
                "visual_output": state.get("visual_output", {}),
                "junior_output": state.get("junior_output", {}),
                "optimization_prep": state.get("optimization_prep", {}),
                "cross_critique": state.get("cross_critique_result", {}),
                "senior_impl_review": state.get("senior_impl_review", {}),
                "review": state.get("review", {}),
            }
        except Exception:
            return {}

    # ── Internal: run graph with interrupt handling ──────────────────────────

    async def _run_graph(self, data: LGSessionData) -> None:
        """Execute the LangGraph, bridging interrupt() to human confirmations."""
        try:
            initial_state: DesignTeamState = {
                "brief": data.brief,
                "agent_trust": data.agent_trust,
                "confidence": CONFIDENCE_INIT,
                "milestone_flags": [],
                "scope_doc": {},
                "direction_brief": {},
                "senior_output": {},
                "visual_output": {},
                "junior_output": {},
                "optimization_prep": {},
                "cross_critique_result": {},
                "senior_impl_review": {},
                "review": {},
                "human_feedback": "",
                "human_action": "",
                "current_phase": "scoping",
                "status": "running",
            }

            config = {
                "configurable": {
                    "thread_id": data.thread_id,
                    "sse_queue": data.queue,  # runtime-only, not checkpointed
                }
            }

            # First invocation — runs until first interrupt()
            await self._graph.ainvoke(initial_state, config)

            # Loop: check if graph is interrupted, wait for human, resume
            while True:
                snapshot = await self._graph.aget_state(config)

                if not snapshot.next:
                    # Graph finished (no more nodes to run)
                    break

                # Graph is interrupted — wait for human confirmation
                data.status = "awaiting_confirm"
                data._resume_event.clear()
                await data._resume_event.wait()

                # Resume the graph with the human's response
                resume_data = data._resume_data or {"action": "confirm", "feedback": ""}
                await self._graph.ainvoke(
                    Command(resume=resume_data),
                    config,
                )

            data.status = "complete"

        except Exception as exc:
            data.status = "error"
            data.queue.put_nowait({"event": "session_error", "data": {"message": str(exc)}})
