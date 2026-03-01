"""Conditional edge routing functions for the LangGraph StateGraph.

These functions inspect state and return the name of the next node.
"""
from __future__ import annotations

from .state import DesignTeamState


def should_micro_checkpoint_kickoff(state: DesignTeamState) -> str:
    """After kickoff, only micro-checkpoint if confidence < 0.5."""
    if state.get("confidence", 0.5) < 0.5:
        return "kickoff_micro_checkpoint"
    return "designing"


def _effective_threshold(agent_trust: dict) -> float:
    """Compute the adaptive self-approve threshold from Manager trust level.

    manager_trust = 0.5 (default) -> threshold = 0.75 (original behavior)
    manager_trust = 0.8           -> threshold = 0.50 (auto-approves faster)
    manager_trust = 1.0           -> threshold = 0.50 (floor)
    manager_trust = 0.0           -> threshold = 1.00 (never self-approves)
    """
    manager_trust = agent_trust.get(0, 0.5)
    return max(0.5, 1.0 - manager_trust)


def should_checkpoint_1(state: DesignTeamState) -> str:
    """Adaptive: skip checkpoint 1 if confidence >= threshold and no critical flags."""
    flags = state.get("milestone_flags", [])
    has_critical = any(f.get("critical", False) for f in flags)
    threshold = _effective_threshold(state.get("agent_trust", {}))
    confidence = state.get("confidence", 0.5)

    if not has_critical and confidence >= threshold:
        return "implementing"  # self-approve
    return "checkpoint_1"


def should_checkpoint_2(state: DesignTeamState) -> str:
    """Adaptive: skip checkpoint 2 if confidence >= threshold and no critical flags."""
    flags = state.get("milestone_flags", [])
    has_critical = any(f.get("critical", False) for f in flags)
    threshold = _effective_threshold(state.get("agent_trust", {}))
    confidence = state.get("confidence", 0.5)

    if not has_critical and confidence >= threshold:
        return "senior_review"  # self-approve
    return "checkpoint_2"


def after_checkpoint_1(state: DesignTeamState) -> str:
    """After checkpoint_1: re-run Senior+Visual if human requested revisions."""
    if state.get("human_action") == "revise":
        return "revision_1"
    return "implementing"


def after_checkpoint_2(state: DesignTeamState) -> str:
    """After checkpoint_2: re-run Junior if human requested revisions."""
    if state.get("human_action") == "revise":
        return "revision_2"
    return "senior_review"
