"""session_manager.py — asyncio workflow + SSE bridge.

Architecture
────────────
One SessionData object lives per browser session.  The workflow runs as a
background asyncio Task; it emits events via an asyncio.Queue; the SSE
endpoint drains that queue.  Human confirmations arrive via the REST endpoint
and resume the workflow through an asyncio.Event.

Confidence model
────────────────
`confidence` (0.0–1.0) tracks the Manager's alignment with the human.
- Starts at 0.5 (medium certainty)
- +0.1 after each approved checkpoint
- -0.2 after each revision request
- Determines whether intermediate checkpoints go to the human or are
  self-approved by the Manager (threshold: ≥ 0.75 → self-approve)
- Checkpoints 0 (scope) and 3 (final) are ALWAYS shown to the human

Workflow phases
───────────────
Phase 0   : Scoping          — Manager analyzes brief → [Human Checkpoint 0]
Phase 0b  : Kickoff          — Manager briefs team → [micro-checkpoint if confidence < 0.5]
Phase 1   : Designing        — Senior + Visual + Manager ponder in parallel
              Each agent has two milestone phases; Manager reviews each milestone.
              Flags from reviews feed into a dynamic checkpoint after the gather.
Phase 1b  : Cross-critique   — Manager checks Senior ↔ Visual alignment
              → [Human Checkpoint 1 — adaptive]
Phase 2   : Implementing     — Junior builds in two milestone phases with Manager reviews
              → [Human Checkpoint 2 — adaptive; skippable if confidence ≥ 0.75]
Phase 3   : Reviewing        — Manager final quality gate
              → [Human Checkpoint 3 — always required]
"""
from __future__ import annotations

import asyncio
import uuid
from dataclasses import dataclass, field
from typing import AsyncGenerator

import anthropic

from .agents import DesignManager, SeniorDesigner, VisualDesigner, JuniorDesigner
from .api.models import ConfirmationOption, ConfirmationPromptPayload


# ── Confidence constants ──────────────────────────────────────────────────────

CONFIDENCE_INIT = 0.5
CONFIDENCE_SELF_APPROVE_THRESHOLD = 0.75   # above this: Manager auto-approves
CONFIDENCE_GAIN_APPROVED = 0.10
CONFIDENCE_LOSS_REVISED = 0.20


# ── Session data container ────────────────────────────────────────────────────

@dataclass
class SessionData:
    session_id: str
    brief: str
    queue: asyncio.Queue = field(default_factory=asyncio.Queue)
    resume_event: asyncio.Event = field(default_factory=asyncio.Event)
    resume_data: dict | None = None
    task: asyncio.Task | None = None
    status: str = "running"   # running | awaiting_confirm | complete | error
    confidence: float = CONFIDENCE_INIT
    milestone_flags: list[dict] = field(default_factory=list)
    # Per-agent trust settings (0.0–1.0). Keys: 0=Manager,1=Senior,2=Junior,3=Visual
    agent_trust: dict = field(default_factory=dict)
    # Final outputs
    scope_doc: dict = field(default_factory=dict)
    direction_brief: dict = field(default_factory=dict)
    senior_output: dict = field(default_factory=dict)
    visual_output: dict = field(default_factory=dict)
    junior_output: dict = field(default_factory=dict)
    optimization_prep: dict = field(default_factory=dict)
    cross_critique_result: dict = field(default_factory=dict)
    senior_impl_review: dict = field(default_factory=dict)
    review: dict = field(default_factory=dict)


# ── Session manager ───────────────────────────────────────────────────────────

class SessionManager:
    def __init__(self) -> None:
        self._sessions: dict[str, SessionData] = {}
        self._client = anthropic.AsyncAnthropic()
        # Agents are stateless — safe to share across sessions
        self._manager = DesignManager(self._client)
        self._senior = SeniorDesigner(self._client)
        self._visual = VisualDesigner(self._client)
        self._junior = JuniorDesigner(self._client)

    # ── Public API ────────────────────────────────────────────────────────────

    async def create_session(self, brief: str, agent_trust: dict | None = None) -> str:
        session_id = str(uuid.uuid4())[:8]
        # Convert string keys from JSON to int keys
        trust = {}
        if agent_trust:
            for k, v in agent_trust.items():
                trust[int(k)] = float(v)
        data = SessionData(session_id=session_id, brief=brief, agent_trust=trust)
        self._sessions[session_id] = data
        data.task = asyncio.create_task(self._run_workflow(data))
        return session_id

    async def confirm(self, session_id: str, action: str, feedback: str | None = None) -> bool:
        data = self._sessions.get(session_id)
        if data is None or data.status != "awaiting_confirm":
            return False
        data.resume_data = {"action": action, "feedback": feedback}
        data.status = "running"
        data.resume_event.set()
        return True

    async def stream_events(self, session_id: str) -> AsyncGenerator[dict, None]:
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
        data = self._sessions.get(session_id)
        if data is None:
            return None
        return {
            "scope_doc": data.scope_doc,
            "direction_brief": data.direction_brief,
            "senior_output": data.senior_output,
            "visual_output": data.visual_output,
            "junior_output": data.junior_output,
            "optimization_prep": data.optimization_prep,
            "cross_critique": data.cross_critique_result,
            "senior_impl_review": data.senior_impl_review,
            "review": data.review,
        }

    # ── Checkpoint helpers ────────────────────────────────────────────────────

    async def _human_checkpoint(
        self,
        data: SessionData,
        emit,
        checkpoint_id: str,
        title: str,
        question: str,
        context: str,
        always_require: bool = False,
    ) -> None:
        """Pause and ask the human. Updates data.confidence based on response."""
        pct = f"{data.confidence:.0%}"
        full_context = context
        full_context += f"\n\n─── Manager Confidence: {pct} ───"

        if data.milestone_flags:
            full_context += "\n\nFlags from milestone reviews:"
            for f in data.milestone_flags:
                full_context += f"\n  ⚠ {f.get('reason', '')}"

        data.status = "awaiting_confirm"
        data.milestone_flags.clear()
        emit(
            "confirmation_prompt",
            ConfirmationPromptPayload(
                id=checkpoint_id,
                title=title,
                question=question,
                context=full_context,
                options=[
                    ConfirmationOption(id="confirm", label="Approve & continue", description=""),
                    ConfirmationOption(id="revise", label="Request changes", description=""),
                ],
            ).model_dump(),
        )

        await data.resume_event.wait()
        data.resume_event.clear()

        if data.resume_data and data.resume_data.get("action") == "confirm":
            data.confidence = min(1.0, data.confidence + CONFIDENCE_GAIN_APPROVED)
            emit("activity", {
                "agentIndex": 0,
                "message": f"Approved. Alignment confidence → {data.confidence:.0%}.",
                "level": "success",
            })
        else:
            feedback = (data.resume_data or {}).get("feedback", "")
            data.confidence = max(0.0, data.confidence - CONFIDENCE_LOSS_REVISED)
            emit("activity", {
                "agentIndex": 0,
                "message": (
                    f"Revision requested. Confidence → {data.confidence:.0%}. "
                    + (f"Noted: {feedback[:80]}" if feedback else "Will adjust.")
                ),
                "level": "warn",
            })

    def _effective_threshold(self, data: SessionData) -> float:
        """Compute the adaptive self-approve threshold from Manager trust level.

        manager_trust = 0.5 (default) → threshold = 0.75 (original behaviour)
        manager_trust = 0.8            → threshold = 0.50 (auto-approves faster)
        manager_trust = 1.0            → threshold = 0.50 (floor)
        manager_trust = 0.0            → threshold = 1.00 (never self-approves)
        """
        manager_trust = data.agent_trust.get(0, 0.5)
        # threshold decreases linearly from 1.0 to 0.5 as trust goes from 0 → 1
        return max(0.5, 1.0 - manager_trust)

    async def _adaptive_checkpoint(
        self,
        data: SessionData,
        emit,
        checkpoint_id: str,
        title: str,
        question: str,
        context: str,
    ) -> None:
        """Checkpoint that the Manager may self-approve when confidence is high."""
        has_critical_flag = any(f.get("critical", False) for f in data.milestone_flags)
        threshold = self._effective_threshold(data)

        if not has_critical_flag and data.confidence >= threshold:
            pct = f"{data.confidence:.0%}"
            thr_pct = f"{threshold:.0%}"
            emit("activity", {
                "agentIndex": 0,
                "message": (
                    f"Confidence {pct} ≥ {thr_pct} — self-approving '{title}'. "
                    "Human override available via confirm button."
                ),
                "level": "info",
            })
            data.milestone_flags.clear()
            return

        await self._human_checkpoint(data, emit, checkpoint_id, title, question, context)

    # ── Main workflow ─────────────────────────────────────────────────────────

    async def _run_workflow(self, data: SessionData) -> None:
        def emit(event_type: str, payload: dict) -> None:
            data.queue.put_nowait({"event": event_type, "data": payload})

        manager = self._manager
        senior = self._senior
        visual = self._visual
        junior = self._junior

        try:
            # ── Phase 0: Scoping ────────────────────────────────────────────
            emit("phase_change", {"phase": "scoping"})

            scope_doc = await manager.analyze_brief(data.brief, emit)
            data.scope_doc = scope_doc
            scope_text = _format_scope_doc(scope_doc)

            await self._human_checkpoint(           # always required
                data, emit,
                "scope", "Design Scope Ready",
                "I've analyzed your brief and prepared the Design Scope Document. "
                "Does this capture what you need?",
                scope_text,
                always_require=True,
            )

            feedback_scope = (data.resume_data or {}).get("feedback", "")
            if feedback_scope:
                emit("activity", {"agentIndex": 0,
                                  "message": f"Scope feedback noted: {feedback_scope[:120]}",
                                  "level": "info"})

            # ── Phase 0b: Kickoff ───────────────────────────────────────────
            direction_brief = await manager.kickoff_with_senior(scope_doc, emit)
            data.direction_brief = direction_brief

            # Micro-checkpoint for direction when confidence is low
            if data.confidence < 0.5:
                kickoff_summary = direction_brief.get("kickoff_summary", "")
                approach = direction_brief.get("design_approach", "")
                priorities = direction_brief.get("quality_priorities", [])
                direction_context = (
                    f"DESIGN APPROACH:\n{approach}\n\n"
                    f"PRIMARY JOURNEY:\n{direction_brief.get('primary_user_journey', '')}\n\n"
                    f"QUALITY PRIORITIES:\n" + "\n".join(f"  {i+1}. {p}" for i, p in enumerate(priorities))
                    + "\n\nCAUTIONS:\n" + "\n".join(f"  • {c}" for c in direction_brief.get("cautions", []))
                )
                await self._adaptive_checkpoint(
                    data, emit,
                    "kickoff-direction", "Initial Design Direction",
                    f"Manager briefing: '{kickoff_summary}' — Does this direction resonate?",
                    direction_context,
                )

            # ── Phase 1: Designing (Senior + Visual + Manager ponder) ───────
            emit("phase_change", {"phase": "designing"})

            # Milestone callbacks — called from within agent coroutines
            async def senior_milestone(milestone_name: str, summary: str) -> str:
                review = await manager.review_milestone(
                    "Senior Designer", milestone_name, summary, scope_doc, emit
                )
                # Only flag if Senior's trust is below 0.7
                if review.get("needs_human", False) and data.agent_trust.get(1, 0.5) < 0.7:
                    data.milestone_flags.append({"reason": review.get("reason", ""), "critical": False})
                return review.get("feedback", "")

            async def visual_milestone(milestone_name: str, summary: str) -> str:
                review = await manager.review_milestone(
                    "Visual Designer", milestone_name, summary, scope_doc, emit
                )
                # Only flag if Visual's trust is below 0.7
                if review.get("needs_human", False) and data.agent_trust.get(3, 0.5) < 0.7:
                    data.milestone_flags.append({"reason": review.get("reason", ""), "critical": False})
                return review.get("feedback", "")

            senior_out, visual_out, opt_prep = await asyncio.gather(
                senior.run(scope_doc, direction_brief, emit, on_milestone=senior_milestone),
                visual.run(scope_doc, emit, on_milestone=visual_milestone),
                manager.ponder_optimizations(scope_doc, emit),
            )
            data.senior_output = senior_out
            data.visual_output = visual_out
            data.optimization_prep = opt_prep

            # Surface optimization insights from the Manager's pondering
            opt_notes = opt_prep.get("optimization_notes", "")
            if opt_notes:
                emit("activity", {"agentIndex": 0,
                                  "message": f"Insight: {opt_notes[:140]}",
                                  "level": "info"})
            risk_areas = opt_prep.get("risk_areas", [])
            if risk_areas:
                emit("activity", {"agentIndex": 0,
                                  "message": f"Risk areas: {', '.join(risk_areas[:3])}",
                                  "level": "warn"})

            # ── Phase 1b: Cross-critique ────────────────────────────────────
            cross = await manager.cross_critique(senior_out, visual_out, scope_doc, emit)
            data.cross_critique_result = cross

            # Human Checkpoint 1 — adaptive (skippable at high confidence)
            direction_summary = _format_direction_summary(senior_out, visual_out, cross)
            await self._adaptive_checkpoint(
                data, emit,
                "checkpoint-1", "Strategy & Direction Review",
                "Senior Designer and Visual Designer have completed Phase 1. "
                "Cross-critique is done. Ready to move to implementation?",
                direction_summary,
            )

            cp1_feedback = (data.resume_data or {}).get("feedback", "")

            # ── Phase 2: Implementing ───────────────────────────────────────
            emit("phase_change", {"phase": "implementing"})

            async def junior_milestone(milestone_name: str, summary: str) -> str:
                review = await manager.review_milestone(
                    "Junior Designer", milestone_name, summary, scope_doc, emit
                )
                # Only flag if Junior's trust is below 0.7
                if review.get("needs_human", False) and data.agent_trust.get(2, 0.5) < 0.7:
                    data.milestone_flags.append({
                        "reason": review.get("reason", ""),
                        "critical": review.get("score", 10) < 5,
                    })
                return review.get("feedback", "")

            junior_addendum = opt_prep.get("junior_brief_addendum", "")
            cross_notes = cross.get("junior_notes", "")
            if cp1_feedback:
                cross_notes = f"Human feedback: {cp1_feedback}\n{cross_notes}"

            junior_out = await junior.run(
                scope_doc, senior_out, visual_out, emit,
                manager_addendum=junior_addendum,
                cross_critique_notes=cross_notes,
                on_milestone=junior_milestone,
            )
            data.junior_output = junior_out

            # Human Checkpoint 2 — adaptive
            comp_count = len(junior_out.get("components", []))
            comp_names = [c.get("name", "") for c in junior_out.get("components", [])[:6]]
            comp_summary = (
                f"COMPONENTS BUILT ({comp_count}):\n"
                + "\n".join(f"  • {n}" for n in comp_names)
                + f"\n\nIMPLEMENTATION NOTES:\n{junior_out.get('implementation_notes', '')[:300]}"
            )

            await self._adaptive_checkpoint(
                data, emit,
                "checkpoint-2", "Components Review",
                f"Junior Designer delivered {comp_count} React component(s) + HTML prototype. "
                "Ready to move to final review?",
                comp_summary,
            )

            cp2_feedback = (data.resume_data or {}).get("feedback", "")

            # ── Phase 2b: Senior reviews Junior + Visual implementation ─────
            emit("activity", {
                "agentIndex": 1,
                "message": "Reviewing Junior's components and token adherence…",
                "level": "info",
            })
            senior_impl_review = await senior.review_implementation(
                junior_out, visual_out, scope_doc, emit,
            )
            data.senior_impl_review = senior_impl_review

            # ── Phase 3: Reviewing ──────────────────────────────────────────
            emit("phase_change", {"phase": "reviewing"})

            review = await manager.review_outputs(
                scope_doc, senior_out, visual_out, junior_out, emit,
                optimization_prep=opt_prep,
                senior_impl_review=senior_impl_review,
            )
            data.review = review

            if cp2_feedback:
                emit("activity", {"agentIndex": 0,
                                  "message": f"Incorporating final feedback: {cp2_feedback[:100]}",
                                  "level": "info"})

            final_summary = _format_final_summary(review, junior_out, cross)
            await self._human_checkpoint(          # always required
                data, emit,
                "final", "Final Deliverables Ready",
                f"All deliverables complete. Overall quality: {review.get('overall_score', 'N/A')}/10. "
                "This is the final confirmation — approve to close the project.",
                final_summary,
                always_require=True,
            )

            # ── Complete ────────────────────────────────────────────────────
            emit("phase_change", {"phase": "complete"})
            data.status = "complete"
            emit("session_complete", {})

        except Exception as exc:  # noqa: BLE001
            data.status = "error"
            emit("session_error", {"message": str(exc)})


# ── Formatting helpers ────────────────────────────────────────────────────────

def _format_scope_doc(doc: dict) -> str:
    lines: list[str] = []
    lines.append(f"PROJECT: {doc.get('project_overview', '')}")
    lines.append(f"\nUSERS: {doc.get('target_users', '')}")

    in_scope = doc.get("in_scope", [])
    if in_scope:
        lines.append("\nIN SCOPE:")
        for item in in_scope:
            lines.append(f"  • {item}")

    out_scope = doc.get("out_of_scope", [])
    if out_scope:
        lines.append("\nOUT OF SCOPE:")
        for item in out_scope:
            lines.append(f"  • {item}")

    lines.append(f"\nVISUAL DIRECTION: {doc.get('visual_direction', '')}")
    lines.append(f"\nTECH CONSTRAINTS: {doc.get('technical_constraints', '')}")

    priorities = doc.get("priority_stack", [])
    if priorities:
        lines.append("\nPRIORITIES:")
        for i, p in enumerate(priorities, 1):
            lines.append(f"  {i}. {p}")

    questions = doc.get("clarifying_questions", [])
    if questions:
        lines.append("\nCLARIFYING QUESTIONS:")
        for q in questions:
            lines.append(f"  ? {q}")

    return "\n".join(lines)


def _format_direction_summary(senior: dict, visual: dict, cross: dict) -> str:
    lines: list[str] = []

    flows = senior.get("user_flows", [])
    lines.append(f"USER FLOWS: {len(flows)} flow(s)")
    for f in flows[:3]:
        lines.append(f"  • {f.get('title', f.get('id', ''))}")

    wireframes = senior.get("wireframes", [])
    lines.append(f"\nWIREFRAMES: {len(wireframes)} screen(s)")
    for w in wireframes[:3]:
        lines.append(f"  • {w.get('screen_name', w.get('screen_id', ''))}")

    tokens = visual.get("design_tokens", {})
    color_count = len(tokens.get("color", {}).get("semantic", {}))
    lines.append(f"\nDESIGN TOKENS: {color_count} semantic colors, typography, spacing, motion")

    comp_styles = list(visual.get("component_styles", {}).keys())
    if comp_styles:
        lines.append(f"\nCOMPONENT STYLES: {', '.join(comp_styles[:5])}")

    score = cross.get("alignment_score", "N/A")
    summary = cross.get("summary", "")
    issues = cross.get("alignment_issues", [])
    lines.append(f"\nCROSS-CRITIQUE: alignment {score}/10 — {summary}")
    for issue in issues[:3]:
        lines.append(f"  ⚠ {issue}")

    lines.append(f"\nHANDOFF NOTES:\n{senior.get('handoff_notes', '')[:250]}")
    return "\n".join(lines)


def _format_final_summary(review: dict, junior: dict, cross: dict) -> str:
    lines: list[str] = []
    lines.append(f"OVERALL SCORE:        {review.get('overall_score', 'N/A')}/10")
    lines.append(f"Scope Alignment:      {review.get('scope_alignment', 'N/A')}/10")
    lines.append(f"Completeness:         {review.get('completeness', 'N/A')}/10")
    lines.append(f"Coherence:            {review.get('coherence', 'N/A')}/10")
    lines.append(f"Production Readiness: {review.get('production_readiness', 'N/A')}/10")

    highlights = review.get("highlights", [])
    if highlights:
        lines.append("\nHIGHLIGHTS:")
        for h in highlights:
            lines.append(f"  ✓ {h}")

    issues = review.get("issues", [])
    if issues:
        lines.append("\nISSUES:")
        for i in issues:
            lines.append(f"  ⚠ {i}")

    skill_ev = review.get("skill_evolution_applied", {})
    if skill_ev:
        lines.append("\nSKILL EVOLUTION APPLIED:")
        for agent, note in skill_ev.items():
            lines.append(f"  {agent}: {note}")

    lines.append(f"\nSUMMARY:\n{review.get('summary', '')}")

    components = junior.get("components", [])
    lines.append(f"\nCOMPONENTS BUILT: {len(components)}")
    for c in components[:6]:
        lines.append(f"  • {c.get('name', '')}")

    cross_score = cross.get("alignment_score", "N/A")
    lines.append(f"\nCROSS-CRITIQUE SCORE: {cross_score}/10")

    return "\n".join(lines)
