from __future__ import annotations

import json

import anthropic

from .base import BaseAgent, EmitFn
from ..prompts import DESIGN_MANAGER_SYSTEM

# Agent index in the frontend AGENTS array
AGENT_INDEX = 0


class DesignManager(BaseAgent):
    def __init__(self, client: anthropic.AsyncAnthropic) -> None:
        super().__init__(AGENT_INDEX, client)

    # ── Phase 0: brief analysis → scope document ─────────────────────────────

    async def analyze_brief(self, brief: str, emit: EmitFn) -> dict:
        """Ask Claude to analyze the brief and produce a Design Scope Document."""
        self.emit_status(emit, "working", "Analyzing design brief", 0.1)
        self.emit_activity(emit, "Reading design brief and identifying scope…")

        user_prompt = f"""Analyze this design brief and produce a Design Scope Document.

BRIEF:
{brief}

Return a JSON object with exactly these keys:
{{
  "project_overview": "string",
  "target_users": "string",
  "in_scope": ["item1", "item2"],
  "out_of_scope": ["item1"],
  "visual_direction": "string",
  "technical_constraints": "string",
  "priority_stack": ["highest priority first"],
  "success_criteria": ["criterion1"],
  "clarifying_questions": ["question1", "question2"]
}}

If the brief is detailed enough, set clarifying_questions to an empty array.
"""
        raw = await self.call_claude(
            system=DESIGN_MANAGER_SYSTEM,
            user=user_prompt,
            emit=emit,
            activity_prefix="Analyzing brief",
            max_tokens=2048,
        )

        self.emit_status(emit, "working", "Synthesizing scope document", 0.6)
        self.emit_activity(emit, "Scope document ready for review", "success")

        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            return {
                "project_overview": brief[:200],
                "target_users": "To be clarified",
                "in_scope": [],
                "out_of_scope": [],
                "visual_direction": "To be clarified",
                "technical_constraints": "To be clarified",
                "priority_stack": [],
                "success_criteria": [],
                "clarifying_questions": [],
                "_raw": raw,
            }

    # ── Phase 0b: kickoff — align team on design direction ────────────────────

    async def kickoff_with_senior(self, scope_doc: dict, emit: EmitFn) -> dict:
        """Run the design kickoff and produce a direction brief for the Senior Designer.

        This is where the Manager actively shapes the creative approach before
        any design work begins — not just a delegation note but real strategic input.
        """
        self.emit_status(emit, "working", "Running design team kickoff…", 0.2)
        self.emit_activity(emit, "Briefing team on scope priorities and direction…")

        user_prompt = f"""You are the Design Manager running a kickoff briefing for your team.

Based on the confirmed Design Scope Document, provide a focused direction brief.

SCOPE DOCUMENT:
{json.dumps(scope_doc, indent=2)}

Return a JSON object:
{{
  "design_approach": "1-2 sentences on the overall design philosophy for this project",
  "primary_user_journey": "the single most critical user journey to nail first",
  "quality_priorities": ["top priority", "second", "third"],
  "recommended_patterns": ["specific UX or UI pattern to explore"],
  "cautions": ["specific thing to avoid or watch out for"],
  "kickoff_summary": "2-sentence briefing message to the team"
}}
"""
        raw = await self.call_claude(
            system=DESIGN_MANAGER_SYSTEM,
            user=user_prompt,
            emit=emit,
            activity_prefix="Briefing team",
            max_tokens=512,
        )

        self.emit_status(emit, "reviewing", "Kickoff complete — team is now designing", 0.3)
        self.emit_activity(emit, "Direction brief delivered. Monitoring team progress…", "success")

        try:
            result = json.loads(raw)
            summary = result.get("kickoff_summary", "")
            if summary:
                self.emit_activity(emit, f"Kickoff: {summary[:120]}")
            return result
        except json.JSONDecodeError:
            return {"design_approach": raw[:200], "_raw": raw}

    # ── Phase 1 (concurrent): ponder optimization while designers work ────────

    async def ponder_optimizations(self, scope_doc: dict, emit: EmitFn) -> dict:
        """Run concurrently with Senior + Visual designers.

        Prepares quality criteria, risk analysis, and skill-evolution directives
        so the review phase hits the ground running.
        """
        self.emit_status(emit, "working", "Preparing quality criteria…", 0.15)
        self.emit_activity(emit, "While designers work, analysing scope for edge cases…")

        user_prompt = f"""You are the Design Manager. Your team is currently designing.
Use this time to prepare for the upcoming review.

SCOPE DOCUMENT:
{json.dumps(scope_doc, indent=2)}

Return a JSON object:
{{
  "quality_criteria": {{
    "senior": ["criterion 1", "criterion 2"],
    "visual": ["criterion 1", "criterion 2"],
    "junior": ["criterion 1", "criterion 2"]
  }},
  "risk_areas": ["risk 1", "risk 2"],
  "skill_evolution_directives": {{
    "senior": "one sentence guidance to improve Senior this round",
    "visual": "one sentence guidance to improve Visual this round",
    "junior": "one sentence guidance to improve Junior this round"
  }},
  "junior_brief_addendum": "extra implementation notes for the Junior Designer",
  "optimization_notes": "2-3 sentences on how to get the best result from this team on this project"
}}
"""
        self.emit_status(emit, "working", "Drafting skill-evolution directives…", 0.4)
        self.emit_activity(emit, "Identifying risk areas and preparing review criteria…")

        raw = await self.call_claude(
            system=DESIGN_MANAGER_SYSTEM,
            user=user_prompt,
            emit=emit,
            activity_prefix="Pondering",
            max_tokens=1024,
        )

        self.emit_status(emit, "reviewing", "Criteria ready — monitoring team progress…", 0.7)
        self.emit_activity(emit, "Review criteria complete. Awaiting milestone updates.", "success")

        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            return {
                "quality_criteria": {"senior": [], "visual": [], "junior": []},
                "risk_areas": [],
                "skill_evolution_directives": {"senior": "", "visual": "", "junior": ""},
                "junior_brief_addendum": raw[:400],
                "optimization_notes": raw[:200],
                "_raw": raw,
            }

    # ── Milestone review — called after each agent checkpoint ─────────────────

    async def review_milestone(
        self,
        agent_name: str,
        milestone_name: str,
        output_summary: str,
        scope_doc: dict,
        emit: EmitFn,
    ) -> dict:
        """Quick milestone review of an agent's partial output.

        Returns {ok, score, feedback, needs_human, reason}.
        Keeps the token budget tight — this is a rapid gut-check, not a deep review.
        """
        self.emit_status(emit, "reviewing", f"Milestone check: {agent_name}", 0.5)
        self.emit_activity(emit, f"Reviewing {agent_name} — {milestone_name}…")

        user_prompt = f"""Quick milestone review.

AGENT: {agent_name}
MILESTONE: {milestone_name}
OUTPUT SUMMARY:
{output_summary[:600]}

SCOPE SUCCESS CRITERIA:
{json.dumps(scope_doc.get('success_criteria', []))}

Return a JSON object (keep feedback ≤ 2 sentences):
{{
  "ok": true,
  "score": 8,
  "feedback": "specific actionable feedback",
  "needs_human": false,
  "reason": "reason human review is needed (empty string if not)"
}}

Only set needs_human=true for genuine quality risks or scope deviations that require human judgment.
"""
        raw = await self.call_claude(
            system=DESIGN_MANAGER_SYSTEM,
            user=user_prompt,
            emit=emit,
            activity_prefix=f"Checking {agent_name}",
            max_tokens=256,
        )

        try:
            result = json.loads(raw)
        except json.JSONDecodeError:
            result = {"ok": True, "score": 7, "feedback": "", "needs_human": False, "reason": ""}

        score = result.get("score", 7)
        ok = result.get("ok", True)
        level = "success" if ok and score >= 7 else "warn" if score >= 5 else "error"
        feedback_preview = result.get("feedback", "")[:80]
        self.emit_activity(
            emit,
            f"{agent_name} [{milestone_name}]: {score}/10 — {feedback_preview}",
            level,
        )
        return result

    # ── Cross-team critique ───────────────────────────────────────────────────

    async def cross_critique(
        self,
        senior_output: dict,
        visual_output: dict,
        scope_doc: dict,
        emit: EmitFn,
    ) -> dict:
        """Cross-team critique: verify UX and design system are aligned before handoff."""
        self.emit_status(emit, "reviewing", "Running cross-team design critique…", 0.6)
        self.emit_activity(emit, "Cross-checking Senior's UX against Visual's design system…")

        flows_count = len(senior_output.get("user_flows", []))
        screens_count = len(senior_output.get("wireframes", []))
        handoff = str(senior_output.get("handoff_notes", ""))[:250]
        token_keys = list(visual_output.get("design_tokens", {}).keys())
        comp_styles = list(visual_output.get("component_styles", {}).keys())[:6]

        user_prompt = f"""Cross-team design critique. Check UX ↔ design system alignment.

SENIOR DESIGNER SUMMARY:
- {flows_count} user flow(s), {screens_count} wireframed screen(s)
- Handoff notes: {handoff}

VISUAL DESIGNER SUMMARY:
- Token groups: {token_keys}
- Styled components: {comp_styles}

SCOPE:
Visual direction: {scope_doc.get('visual_direction', '')}
Technical constraints: {scope_doc.get('technical_constraints', '')}
Priority stack: {scope_doc.get('priority_stack', [])}

Return a JSON object:
{{
  "alignment_score": 8,
  "alignment_issues": ["issue 1"],
  "for_senior": "1-sentence feedback for Senior about visual alignment",
  "for_visual": "1-sentence feedback for Visual about UX alignment",
  "junior_notes": "implementation notes for Junior based on this cross-critique",
  "summary": "1-sentence summary of the cross-critique outcome"
}}
"""
        raw = await self.call_claude(
            system=DESIGN_MANAGER_SYSTEM,
            user=user_prompt,
            emit=emit,
            activity_prefix="Cross-critiquing",
            max_tokens=512,
        )

        self.emit_status(emit, "reviewing", "Cross-critique complete", 0.65)

        try:
            result = json.loads(raw)
        except json.JSONDecodeError:
            result = {
                "alignment_score": 8,
                "alignment_issues": [],
                "for_senior": "",
                "for_visual": "",
                "junior_notes": raw[:300],
                "summary": "Cross-critique complete.",
                "_raw": raw,
            }

        score = result.get("alignment_score", 8)
        summary = result.get("summary", "")
        self.emit_activity(
            emit,
            f"Cross-critique: alignment {score}/10 — {summary[:100]}",
            "success" if score >= 7 else "warn",
        )
        return result

    # ── Phase 3: final review of all outputs ─────────────────────────────────

    async def review_outputs(
        self,
        scope_doc: dict,
        senior_output: dict,
        visual_output: dict,
        junior_output: dict,
        emit: EmitFn,
        optimization_prep: dict | None = None,
        senior_impl_review: dict | None = None,
    ) -> dict:
        """Produce the final quality report, applying the criteria prepared in advance."""
        self.emit_status(emit, "reviewing", "Applying pre-prepared criteria to all deliverables…", 0.8)
        self.emit_activity(emit, "Running final quality gate across all deliverables…")

        criteria_section = ""
        if optimization_prep:
            criteria = optimization_prep.get("quality_criteria", {})
            risk_areas = optimization_prep.get("risk_areas", [])
            skill_dirs = optimization_prep.get("skill_evolution_directives", {})
            criteria_section = f"""
QUALITY CRITERIA (prepared in advance):
Senior: {criteria.get("senior", [])}
Visual: {criteria.get("visual", [])}
Junior: {criteria.get("junior", [])}
Risk areas: {risk_areas}
Skill-evolution directives: {json.dumps(skill_dirs)}
Optimization notes: {optimization_prep.get("optimization_notes", "")}
"""

        senior_review_section = ""
        if senior_impl_review:
            senior_review_section = f"""
SENIOR DESIGNER'S IMPLEMENTATION REVIEW:
UX Adherence: {senior_impl_review.get("ux_adherence_score", "N/A")}/10
Token Usage: {senior_impl_review.get("token_usage_score", "N/A")}/10
Issues: {senior_impl_review.get("component_issues", [])}
Highlights: {senior_impl_review.get("positive_highlights", [])}
Assessment: {senior_impl_review.get("overall_assessment", "")}
"""

        user_prompt = f"""Final quality review of all three designer outputs.

SCOPE DOCUMENT:
{json.dumps(scope_doc, indent=2)}
{criteria_section}{senior_review_section}
SENIOR DESIGNER OUTPUT (summary):
{str(senior_output)[:400]}

VISUAL DESIGNER OUTPUT (summary):
{str(visual_output)[:400]}

JUNIOR DESIGNER OUTPUT (summary):
{str(junior_output)[:400]}

Apply the prepared criteria and the Senior Designer's implementation review. Return a JSON object:
{{
  "overall_score": 8,
  "scope_alignment": 9,
  "completeness": 8,
  "coherence": 8,
  "production_readiness": 7,
  "highlights": ["highlight 1"],
  "issues": ["issue 1"],
  "skill_evolution_applied": {{"senior": "note", "visual": "note", "junior": "note"}},
  "summary": "2-3 sentence narrative"
}}
"""
        raw = await self.call_claude(
            system=DESIGN_MANAGER_SYSTEM,
            user=user_prompt,
            emit=emit,
            activity_prefix="Final review",
            max_tokens=1024,
        )

        self.emit_status(emit, "complete", "Final review complete", 1.0, False)
        self.emit_activity(emit, "All deliverables reviewed and packaged", "success")

        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            return {"summary": raw, "_raw": raw}
