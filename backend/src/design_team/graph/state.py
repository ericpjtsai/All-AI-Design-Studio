"""LangGraph state schema for the design team workflow.

Maps 1:1 to the existing SessionData fields.  The sse_queue is passed
via LangGraph config (not state) because asyncio.Queue is not
JSON-serializable for the SQLite checkpointer.
"""
from __future__ import annotations

from typing import TypedDict


class DesignTeamState(TypedDict, total=False):
    # ── Input ──────────────────────────────────────────────────────
    brief: str
    agent_trust: dict[int, float]  # {0: manager, 1: senior, 2: junior, 3: visual}

    # ── Confidence model ───────────────────────────────────────────
    confidence: float               # 0.0–1.0
    milestone_flags: list[dict]

    # ── Phase outputs (accumulated by nodes) ───────────────────────
    scope_doc: dict
    direction_brief: dict
    senior_output: dict
    visual_output: dict
    junior_output: dict
    optimization_prep: dict
    cross_critique_result: dict
    senior_impl_review: dict
    review: dict

    # ── Human checkpoint data ──────────────────────────────────────
    human_feedback: str             # feedback text from last checkpoint
    human_action: str               # "confirm" | "revise"

    # ── Control flow ───────────────────────────────────────────────
    current_phase: str              # maps to SSE phase_change events
    status: str                     # "running" | "awaiting_confirm" | "complete" | "error"
