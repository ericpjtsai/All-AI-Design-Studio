"""LangGraph node functions for the design team workflow.

Each node is an async function: (state, config) -> dict  that returns a
partial state update.  Agents are NOT modified — nodes are thin wrappers.

The sse_queue is read from config["configurable"]["sse_queue"] and wrapped
in an EmitFn via the emit_bridge module.
"""
from __future__ import annotations

import asyncio
import os

from google import genai
from langchain_core.runnables import RunnableConfig
from langgraph.types import interrupt

from .state import DesignTeamState
from .emit_bridge import get_emit_from_config
from .formatting import format_scope_doc, format_direction_summary, format_final_summary
from ..agents import DesignManager, SeniorDesigner, VisualDesigner, JuniorDesigner
from ..api.models import ConfirmationOption, ConfirmationPromptPayload


# ── Confidence constants ─────────────────────────────────────────────────────

CONFIDENCE_GAIN_APPROVED = 0.10
CONFIDENCE_LOSS_REVISED = 0.20


# ── Module-level singletons (stateless agents, shared across invocations) ────

_client: genai.Client | None = None
_manager: DesignManager | None = None
_senior: SeniorDesigner | None = None
_visual: VisualDesigner | None = None
_junior: JuniorDesigner | None = None


def _get_agents() -> tuple[DesignManager, SeniorDesigner, VisualDesigner, JuniorDesigner]:
    global _client, _manager, _senior, _visual, _junior
    if _client is None:
        _client = genai.Client(api_key=os.environ["GEMINI_API_KEY"])
        _manager = DesignManager(_client)
        _senior = SeniorDesigner(_client)
        _visual = VisualDesigner(_client)
        _junior = JuniorDesigner(_client)
    return _manager, _senior, _visual, _junior  # type: ignore[return-value]


# ── Helper: process interrupt response ───────────────────────────────────────

def _process_checkpoint_response(
    response: dict,
    current_confidence: float,
    emit,
) -> dict:
    """Process the human's checkpoint response and return state update."""
    action = response.get("action", "confirm")
    feedback = response.get("feedback", "")

    if action == "confirm":
        new_confidence = min(1.0, current_confidence + CONFIDENCE_GAIN_APPROVED)
        emit("activity", {
            "agentIndex": 0,
            "message": f"Approved. Alignment confidence \u2192 {new_confidence:.0%}.",
            "level": "success",
        })
    else:
        new_confidence = max(0.0, current_confidence - CONFIDENCE_LOSS_REVISED)
        msg = f"Revision requested. Confidence \u2192 {new_confidence:.0%}."
        if feedback:
            msg += f" Noted: {feedback[:80]}"
        emit("activity", {"agentIndex": 0, "message": msg, "level": "warn"})

    return {
        "confidence": new_confidence,
        "human_action": action,
        "human_feedback": feedback,
    }


# ── Phase 0: Scoping ────────────────────────────────────────────────────────

async def scoping_node(state: DesignTeamState, config: RunnableConfig) -> dict:
    """Manager analyzes the brief and produces a Design Scope Document."""
    manager, _, _, _ = _get_agents()
    emit = get_emit_from_config(config)
    emit("phase_change", {"phase": "scoping"})

    scope_doc = await manager.analyze_brief(state["brief"], emit)

    emit("design_output", {"output_type": "scope_doc", "data": scope_doc})
    return {"scope_doc": scope_doc, "current_phase": "scoping"}


async def scope_checkpoint_node(state: DesignTeamState, config: RunnableConfig) -> dict:
    """Human checkpoint 0 — always required."""
    emit = get_emit_from_config(config)

    scope_text = format_scope_doc(state["scope_doc"])
    confidence = state.get("confidence", 0.5)
    context = scope_text + f"\n\n\u2500\u2500\u2500 Manager Confidence: {confidence:.0%} \u2500\u2500\u2500"

    # Emit confirmation prompt to frontend
    emit("confirmation_prompt", ConfirmationPromptPayload(
        id="scope",
        title="Design Scope Ready",
        question=(
            "I've analyzed your brief and prepared the Design Scope Document. "
            "Does this capture what you need?"
        ),
        context=context,
        options=[
            ConfirmationOption(id="confirm", label="Approve & continue", description=""),
            ConfirmationOption(id="revise", label="Request changes", description=""),
        ],
    ).model_dump())

    # Pause execution — resume value comes from Command(resume={...})
    response = interrupt({"checkpoint_id": "scope", "type": "human_checkpoint"})

    return _process_checkpoint_response(response, confidence, emit)


# ── Phase 0b: Kickoff ────────────────────────────────────────────────────────

async def kickoff_node(state: DesignTeamState, config: RunnableConfig) -> dict:
    """Manager produces a direction brief for the team."""
    manager, _, _, _ = _get_agents()
    emit = get_emit_from_config(config)

    direction_brief = await manager.kickoff_with_senior(state["scope_doc"], emit)

    return {"direction_brief": direction_brief}


async def kickoff_micro_checkpoint_node(state: DesignTeamState, config: RunnableConfig) -> dict:
    """Micro-checkpoint when confidence is low (< 0.5)."""
    emit = get_emit_from_config(config)
    direction = state.get("direction_brief", {})
    confidence = state.get("confidence", 0.5)

    approach = direction.get("design_approach", "")
    priorities = direction.get("quality_priorities", [])
    cautions = direction.get("cautions", [])
    summary = direction.get("kickoff_summary", "")

    context = (
        f"DESIGN APPROACH:\n{approach}\n\n"
        f"PRIMARY JOURNEY:\n{direction.get('primary_user_journey', '')}\n\n"
        f"QUALITY PRIORITIES:\n" + "\n".join(f"  {i+1}. {p}" for i, p in enumerate(priorities))
        + "\n\nCAUTIONS:\n" + "\n".join(f"  \u2022 {c}" for c in cautions)
        + f"\n\n\u2500\u2500\u2500 Manager Confidence: {confidence:.0%} \u2500\u2500\u2500"
    )

    emit("confirmation_prompt", ConfirmationPromptPayload(
        id="kickoff-direction",
        title="Initial Design Direction",
        question=f"Manager briefing: '{summary}' \u2014 Does this direction resonate?",
        context=context,
        options=[
            ConfirmationOption(id="confirm", label="Approve & continue", description=""),
            ConfirmationOption(id="revise", label="Request changes", description=""),
        ],
    ).model_dump())

    response = interrupt({"checkpoint_id": "kickoff-direction", "type": "human_checkpoint"})
    return _process_checkpoint_response(response, confidence, emit)


# ── Phase 1: Designing (Senior + Visual + Manager ponder in parallel) ────────

async def designing_node(state: DesignTeamState, config: RunnableConfig) -> dict:
    """Run Senior Designer, Visual Designer, and Manager ponder concurrently."""
    manager, senior, visual, _ = _get_agents()
    emit = get_emit_from_config(config)
    emit("phase_change", {"phase": "designing"})

    scope_doc = state["scope_doc"]
    direction_brief = state.get("direction_brief", {})
    agent_trust = state.get("agent_trust", {})
    milestone_flags: list[dict] = []

    # Milestone callbacks — manager reviews each partial output
    async def senior_milestone(name: str, summary: str) -> str:
        review = await manager.review_milestone(
            "Senior Designer", name, summary, scope_doc, emit
        )
        if review.get("needs_human") and agent_trust.get(1, 0.5) < 0.7:
            milestone_flags.append({"reason": review.get("reason", ""), "critical": False})
        return review.get("feedback", "")

    async def visual_milestone(name: str, summary: str) -> str:
        review = await manager.review_milestone(
            "Visual Designer", name, summary, scope_doc, emit
        )
        if review.get("needs_human") and agent_trust.get(3, 0.5) < 0.7:
            milestone_flags.append({"reason": review.get("reason", ""), "critical": False})
        return review.get("feedback", "")

    senior_out, visual_out, opt_prep = await asyncio.gather(
        senior.run(scope_doc, direction_brief, emit, on_milestone=senior_milestone),
        visual.run(scope_doc, emit, on_milestone=visual_milestone),
        manager.ponder_optimizations(scope_doc, emit),
    )

    # Surface insights
    opt_notes = opt_prep.get("optimization_notes", "")
    if opt_notes:
        emit("activity", {"agentIndex": 0, "message": f"Insight: {opt_notes[:140]}", "level": "info"})
    risk_areas = opt_prep.get("risk_areas", [])
    if risk_areas:
        emit("activity", {"agentIndex": 0, "message": f"Risk areas: {', '.join(risk_areas[:3])}", "level": "warn"})

    # Push design outputs to frontend in real-time
    emit("design_output", {"output_type": "senior_output", "data": senior_out})
    emit("design_output", {"output_type": "visual_output", "data": visual_out})

    return {
        "senior_output": senior_out,
        "visual_output": visual_out,
        "optimization_prep": opt_prep,
        "milestone_flags": milestone_flags,
    }


# ── Phase 1b: Cross-critique ────────────────────────────────────────────────

async def cross_critique_node(state: DesignTeamState, config: RunnableConfig) -> dict:
    """Manager checks Senior ↔ Visual alignment."""
    manager, _, _, _ = _get_agents()
    emit = get_emit_from_config(config)

    cross = await manager.cross_critique(
        state["senior_output"], state["visual_output"], state["scope_doc"], emit
    )

    return {"cross_critique_result": cross}


async def checkpoint_1_node(state: DesignTeamState, config: RunnableConfig) -> dict:
    """Adaptive checkpoint after Phase 1 — may self-approve at high confidence."""
    emit = get_emit_from_config(config)
    confidence = state.get("confidence", 0.5)

    direction_summary = format_direction_summary(
        state["senior_output"], state["visual_output"], state["cross_critique_result"]
    )
    context = direction_summary + f"\n\n\u2500\u2500\u2500 Manager Confidence: {confidence:.0%} \u2500\u2500\u2500"

    flags = state.get("milestone_flags", [])
    if flags:
        context += "\n\nFlags from milestone reviews:"
        for f in flags:
            context += f"\n  \u26a0 {f.get('reason', '')}"

    emit("confirmation_prompt", ConfirmationPromptPayload(
        id="checkpoint-1",
        title="Strategy & Direction Review",
        question=(
            "Senior Designer and Visual Designer have completed Phase 1. "
            "Cross-critique is done. Ready to move to implementation?"
        ),
        context=context,
        options=[
            ConfirmationOption(id="confirm", label="Approve & continue", description=""),
            ConfirmationOption(id="revise", label="Request changes", description=""),
        ],
    ).model_dump())

    response = interrupt({"checkpoint_id": "checkpoint-1", "type": "human_checkpoint"})
    result = _process_checkpoint_response(response, confidence, emit)
    result["milestone_flags"] = []  # clear flags after checkpoint
    return result


# ── Phase 2: Implementing ────────────────────────────────────────────────────

async def implementing_node(state: DesignTeamState, config: RunnableConfig) -> dict:
    """Junior Designer builds components with milestone reviews."""
    manager, _, _, junior = _get_agents()
    emit = get_emit_from_config(config)
    emit("phase_change", {"phase": "implementing"})

    scope_doc = state["scope_doc"]
    agent_trust = state.get("agent_trust", {})
    milestone_flags: list[dict] = []

    async def junior_milestone(name: str, summary: str) -> str:
        review = await manager.review_milestone(
            "Junior Designer", name, summary, scope_doc, emit
        )
        if review.get("needs_human") and agent_trust.get(2, 0.5) < 0.7:
            milestone_flags.append({
                "reason": review.get("reason", ""),
                "critical": review.get("score", 10) < 5,
            })
        return review.get("feedback", "")

    opt_prep = state.get("optimization_prep", {})
    cross = state.get("cross_critique_result", {})
    human_feedback = state.get("human_feedback", "")

    junior_addendum = opt_prep.get("junior_brief_addendum", "")
    cross_notes = cross.get("junior_notes", "")
    if human_feedback:
        cross_notes = f"Human feedback: {human_feedback}\n{cross_notes}"

    junior_out = await junior.run(
        scope_doc, state["senior_output"], state["visual_output"], emit,
        manager_addendum=junior_addendum,
        cross_critique_notes=cross_notes,
        on_milestone=junior_milestone,
    )

    emit("design_output", {"output_type": "junior_output", "data": junior_out})

    return {
        "junior_output": junior_out,
        "milestone_flags": milestone_flags,
    }


async def checkpoint_2_node(state: DesignTeamState, config: RunnableConfig) -> dict:
    """Adaptive checkpoint after Phase 2."""
    emit = get_emit_from_config(config)
    confidence = state.get("confidence", 0.5)
    junior_out = state.get("junior_output", {})

    comp_count = len(junior_out.get("components", []))
    comp_names = [c.get("name", "") for c in junior_out.get("components", [])[:6]]
    context = (
        f"COMPONENTS BUILT ({comp_count}):\n"
        + "\n".join(f"  \u2022 {n}" for n in comp_names)
        + f"\n\nIMPLEMENTATION NOTES:\n{junior_out.get('implementation_notes', '')[:300]}"
        + f"\n\n\u2500\u2500\u2500 Manager Confidence: {confidence:.0%} \u2500\u2500\u2500"
    )

    flags = state.get("milestone_flags", [])
    if flags:
        context += "\n\nFlags from milestone reviews:"
        for f in flags:
            context += f"\n  \u26a0 {f.get('reason', '')}"

    emit("confirmation_prompt", ConfirmationPromptPayload(
        id="checkpoint-2",
        title="Components Review",
        question=(
            f"Junior Designer delivered {comp_count} React component(s) + HTML prototype. "
            "Ready to move to final review?"
        ),
        context=context,
        options=[
            ConfirmationOption(id="confirm", label="Approve & continue", description=""),
            ConfirmationOption(id="revise", label="Request changes", description=""),
        ],
    ).model_dump())

    response = interrupt({"checkpoint_id": "checkpoint-2", "type": "human_checkpoint"})
    result = _process_checkpoint_response(response, confidence, emit)
    result["milestone_flags"] = []
    return result


# ── Phase 1 revision: Re-run Senior + Visual ─────────────────────────────────

async def revision_1_node(state: DesignTeamState, config: RunnableConfig) -> dict:
    """Re-run Senior Designer and Visual Designer with human revision feedback."""
    manager, senior, visual, _ = _get_agents()
    emit = get_emit_from_config(config)
    emit("phase_change", {"phase": "designing"})

    scope_doc = state["scope_doc"]
    direction_brief = state.get("direction_brief", {})
    human_feedback = state.get("human_feedback", "")
    milestone_flags: list[dict] = []

    # Inject revision notes into scope context
    revised_scope = dict(scope_doc)
    if human_feedback:
        revised_scope["revision_notes"] = f"Revision directive from human: {human_feedback}"
        emit("activity", {
            "agentIndex": 0,
            "message": f"Revision directive received. Briefing team: {human_feedback[:100]}",
            "level": "info",
        })

    async def senior_milestone(name: str, summary: str) -> str:
        review = await manager.review_milestone("Senior Designer", name, summary, scope_doc, emit)
        if review.get("needs_human"):
            milestone_flags.append({"reason": review.get("reason", ""), "critical": False})
        return review.get("feedback", "")

    async def visual_milestone(name: str, summary: str) -> str:
        review = await manager.review_milestone("Visual Designer", name, summary, scope_doc, emit)
        if review.get("needs_human"):
            milestone_flags.append({"reason": review.get("reason", ""), "critical": False})
        return review.get("feedback", "")

    senior_out, visual_out = await asyncio.gather(
        senior.run(revised_scope, direction_brief, emit, on_milestone=senior_milestone),
        visual.run(revised_scope, emit, on_milestone=visual_milestone),
    )

    emit("design_output", {"output_type": "senior_output", "data": senior_out})
    emit("design_output", {"output_type": "visual_output", "data": visual_out})

    return {
        "senior_output": senior_out,
        "visual_output": visual_out,
        "milestone_flags": milestone_flags,
        "human_action": None,  # clear so routing doesn't loop
    }


# ── Phase 2 revision: Re-run Junior ──────────────────────────────────────────

async def revision_2_node(state: DesignTeamState, config: RunnableConfig) -> dict:
    """Re-run Junior Designer with human revision feedback."""
    manager, _, _, junior = _get_agents()
    emit = get_emit_from_config(config)
    emit("phase_change", {"phase": "implementing"})

    scope_doc = state["scope_doc"]
    human_feedback = state.get("human_feedback", "")
    milestone_flags: list[dict] = []

    cross = state.get("cross_critique_result", {})
    cross_notes = cross.get("junior_notes", "")
    if human_feedback:
        cross_notes = f"Human revision feedback: {human_feedback}\n{cross_notes}"
        emit("activity", {
            "agentIndex": 0,
            "message": f"Revision directive: {human_feedback[:100]}",
            "level": "info",
        })

    async def junior_milestone(name: str, summary: str) -> str:
        review = await manager.review_milestone("Junior Designer", name, summary, scope_doc, emit)
        if review.get("needs_human"):
            milestone_flags.append({
                "reason": review.get("reason", ""),
                "critical": review.get("score", 10) < 5,
            })
        return review.get("feedback", "")

    opt_prep = state.get("optimization_prep", {})
    junior_addendum = opt_prep.get("junior_brief_addendum", "")

    junior_out = await junior.run(
        scope_doc, state["senior_output"], state["visual_output"], emit,
        manager_addendum=junior_addendum,
        cross_critique_notes=cross_notes,
        on_milestone=junior_milestone,
    )

    emit("design_output", {"output_type": "junior_output", "data": junior_out})

    return {
        "junior_output": junior_out,
        "milestone_flags": milestone_flags,
        "human_action": None,  # clear so routing doesn't loop
    }


# ── Phase 2b: Senior reviews implementation ──────────────────────────────────

async def senior_review_node(state: DesignTeamState, config: RunnableConfig) -> dict:
    """Senior Designer audits Junior's components."""
    _, senior, _, _ = _get_agents()
    emit = get_emit_from_config(config)

    emit("activity", {
        "agentIndex": 1,
        "message": "Reviewing Junior's components and token adherence\u2026",
        "level": "info",
    })

    result = await senior.review_implementation(
        state["junior_output"], state["visual_output"], state["scope_doc"], emit,
    )

    return {"senior_impl_review": result}


# ── Phase 3: Final review ───────────────────────────────────────────────────

async def reviewing_node(state: DesignTeamState, config: RunnableConfig) -> dict:
    """Manager produces the final quality report."""
    manager, _, _, _ = _get_agents()
    emit = get_emit_from_config(config)
    emit("phase_change", {"phase": "reviewing"})

    human_feedback = state.get("human_feedback", "")
    if human_feedback:
        emit("activity", {
            "agentIndex": 0,
            "message": f"Incorporating final feedback: {human_feedback[:100]}",
            "level": "info",
        })

    review = await manager.review_outputs(
        state["scope_doc"],
        state["senior_output"],
        state["visual_output"],
        state["junior_output"],
        emit,
        optimization_prep=state.get("optimization_prep"),
        senior_impl_review=state.get("senior_impl_review"),
    )

    emit("design_output", {"output_type": "review", "data": review})
    return {"review": review}


async def final_checkpoint_node(state: DesignTeamState, config: RunnableConfig) -> dict:
    """Checkpoint 3 — always required."""
    emit = get_emit_from_config(config)
    confidence = state.get("confidence", 0.5)
    review = state.get("review", {})
    junior_out = state.get("junior_output", {})
    cross = state.get("cross_critique_result", {})

    final_summary = format_final_summary(review, junior_out, cross)
    context = final_summary + f"\n\n\u2500\u2500\u2500 Manager Confidence: {confidence:.0%} \u2500\u2500\u2500"

    emit("confirmation_prompt", ConfirmationPromptPayload(
        id="final",
        title="Final Deliverables Ready",
        question=(
            f"All deliverables complete. Overall quality: {review.get('overall_score', 'N/A')}/10. "
            "This is the final confirmation \u2014 approve to close the project."
        ),
        context=context,
        options=[
            ConfirmationOption(id="confirm", label="Approve & continue", description=""),
            ConfirmationOption(id="revise", label="Request changes", description=""),
        ],
    ).model_dump())

    response = interrupt({"checkpoint_id": "final", "type": "human_checkpoint"})
    return _process_checkpoint_response(response, confidence, emit)


# ── Complete ─────────────────────────────────────────────────────────────────

async def complete_node(state: DesignTeamState, config: RunnableConfig) -> dict:
    """Mark session complete and emit final events."""
    emit = get_emit_from_config(config)
    emit("phase_change", {"phase": "complete"})
    emit("session_complete", {})
    return {"status": "complete", "current_phase": "complete"}
