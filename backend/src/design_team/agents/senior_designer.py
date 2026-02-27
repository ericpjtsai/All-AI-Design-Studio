from __future__ import annotations

import json
from typing import Awaitable, Callable

import anthropic

from .base import BaseAgent, EmitFn
from ..prompts import SENIOR_DESIGNER_SYSTEM

AGENT_INDEX = 1

# Milestone callback: (milestone_name, output_summary) -> feedback string
MilestoneFn = Callable[[str, str], Awaitable[str]]


class SeniorDesigner(BaseAgent):
    def __init__(self, client: anthropic.AsyncAnthropic) -> None:
        super().__init__(AGENT_INDEX, client)

    async def run(
        self,
        scope_doc: dict,
        direction_brief: dict,
        emit: EmitFn,
        on_milestone: MilestoneFn | None = None,
    ) -> dict:
        """Two-phase design with Manager milestone reviews.

        Phase 1: user flows + information architecture
        Phase 2: wireframes + interaction specs (incorporates milestone feedback)
        """
        approach = direction_brief.get("design_approach", "")
        primary_journey = direction_brief.get("primary_user_journey", "")
        quality_priorities = direction_brief.get("quality_priorities", [])

        # ── Phase 1: User flows + IA ──────────────────────────────────────────
        self.emit_status(emit, "working", "Mapping user flows & information architecture", 0.1)
        self.emit_activity(
            emit,
            f"Primary journey: {primary_journey[:80]}…" if primary_journey else "Mapping user flows…",
        )

        flows_prompt = f"""Design the user flows and information architecture.

SCOPE DOCUMENT:
{json.dumps(scope_doc, indent=2)}

MANAGER DIRECTION:
Design approach: {approach}
Primary journey: {primary_journey}
Quality priorities: {quality_priorities}

Return a JSON object:
{{
  "user_flows": [
    {{
      "id": "flow_01",
      "title": "string",
      "mermaid_syntax": "flowchart TD\\n  A[Start] --> B[Step]"
    }}
  ],
  "ia_map": {{
    "root": {{
      "label": "App",
      "children": [
        {{"label": "Section", "children": []}}
      ]
    }}
  }}
}}
"""
        flows_raw = await self.call_claude(
            system=SENIOR_DESIGNER_SYSTEM,
            user=flows_prompt,
            emit=emit,
            activity_prefix="Mapping flows",
            max_tokens=2048,
        )

        try:
            flows_data = json.loads(flows_raw)
        except json.JSONDecodeError:
            flows_data = {"user_flows": [], "ia_map": {}}

        flows_count = len(flows_data.get("user_flows", []))
        self.emit_activity(emit, f"{flows_count} user flow(s) and IA map complete.", "success")
        self.emit_status(emit, "working", "User flows done — awaiting Manager review", 0.35)

        # ── Milestone 1: flows + IA review ────────────────────────────────────
        feedback_1 = ""
        if on_milestone:
            summary = (
                f"{flows_count} user flow(s) covering primary journey '{primary_journey}'. "
                f"IA map root sections: {list(flows_data.get('ia_map', {}).keys())}"
            )
            feedback_1 = await on_milestone("user_flows_and_ia", summary)
            if feedback_1:
                self.emit_activity(emit, f"Manager feedback received: {feedback_1[:100]}")

        # ── Phase 2: Wireframes + interaction specs ───────────────────────────
        self.emit_status(emit, "working", "Building wireframe specifications", 0.5)
        self.emit_activity(emit, "Translating flows into detailed wireframe JSON…")

        wireframes_prompt = f"""Build wireframe specifications and interaction design.

SCOPE DOCUMENT:
{json.dumps(scope_doc, indent=2)}

USER FLOWS AND IA (already designed):
{json.dumps(flows_data, indent=2)}

MANAGER MILESTONE FEEDBACK:
{feedback_1 if feedback_1 else "No specific feedback — maintain current direction."}

Return a JSON object:
{{
  "wireframes": [
    {{
      "screen_id": "dashboard",
      "screen_name": "Dashboard",
      "component_tree": [
        {{"type": "Container", "props": {{}}, "children": []}}
      ],
      "layout_props": {{"grid": "12-column", "gap": "16px"}}
    }}
  ],
  "interaction_specs": {{
    "ComponentName": "description of states and transitions"
  }},
  "handoff_notes": "developer-facing implementation notes"
}}
"""
        wireframes_raw = await self.call_claude(
            system=SENIOR_DESIGNER_SYSTEM,
            user=wireframes_prompt,
            emit=emit,
            activity_prefix="Wireframing",
            max_tokens=3072,
        )

        try:
            wireframes_data = json.loads(wireframes_raw)
        except json.JSONDecodeError:
            wireframes_data = {
                "wireframes": [],
                "interaction_specs": {},
                "handoff_notes": wireframes_raw[:400],
            }

        screens_count = len(wireframes_data.get("wireframes", []))
        self.emit_activity(emit, f"{screens_count} screen(s) wireframed with interaction specs.", "success")
        self.emit_status(emit, "working", "Wireframes done — awaiting Manager review", 0.8)

        # ── Milestone 2: wireframes review ────────────────────────────────────
        if on_milestone:
            summary = (
                f"{screens_count} screen wireframe(s). "
                f"Handoff: {str(wireframes_data.get('handoff_notes', ''))[:120]}"
            )
            await on_milestone("wireframes_complete", summary)

        combined = {**flows_data, **wireframes_data}

        self.emit_status(emit, "complete", "UX deliverables complete", 1.0, False)
        self.emit_activity(emit, "Flows, IA, wireframes, and interaction specs delivered.", "success")

        return combined

    async def review_implementation(
        self,
        junior_output: dict,
        visual_output: dict,
        scope_doc: dict,
        emit: EmitFn,
    ) -> dict:
        """Review Junior's component implementation and Visual's token usage.

        Called in Phase 2b before the Manager's final review.
        Returns a structured assessment of UX adherence and token correctness.
        """
        self.emit_status(emit, "reviewing", "Reviewing Junior & Visual implementation", 0.1)
        self.emit_activity(emit, "Auditing component implementation against wireframes…")

        components = junior_output.get("components", [])
        comp_summary = [
            {"name": c.get("name", ""), "code_snippet": c.get("tsx_code", "")[:300]}
            for c in components[:4]
        ]
        token_keys = list((visual_output.get("design_tokens") or {}).keys())
        component_styles_keys = list((visual_output.get("component_styles") or {}).keys())

        review_prompt = f"""You are a Senior Designer reviewing the Junior Designer's React implementation
and the Visual Designer's token usage. Your job is to check UX adherence and design system correctness.

SCOPE DOCUMENT (what was agreed):
{json.dumps(scope_doc, indent=2)}

JUNIOR DESIGNER'S COMPONENTS (first 4):
{json.dumps(comp_summary, indent=2)}

VISUAL DESIGNER'S TOKEN CATEGORIES:
{json.dumps(token_keys, indent=2)}

COMPONENT STYLES DEFINED:
{json.dumps(component_styles_keys, indent=2)}

IMPLEMENTATION NOTES FROM JUNIOR:
{junior_output.get("implementation_notes", "")[:400]}

Review for:
1. UX adherence — do components match the wireframe intent and interaction specs?
2. Token usage — are design tokens applied (no hardcoded color/spacing values visible)?
3. Completeness — are all expected components present?
4. Quality highlights — what was done well?
5. Issues — specific problems that need attention.

Return JSON:
{{
  "ux_adherence_score": 8,
  "token_usage_score": 7,
  "component_issues": ["issue 1", "issue 2"],
  "positive_highlights": ["highlight 1"],
  "recommendations": ["recommendation 1"],
  "overall_assessment": "one paragraph summary"
}}"""

        raw = await self.call_claude(
            system=SENIOR_DESIGNER_SYSTEM,
            user=review_prompt,
            emit=emit,
            activity_prefix="Reviewing implementation",
            max_tokens=1024,
        )

        try:
            result = json.loads(raw)
        except json.JSONDecodeError:
            result = {
                "ux_adherence_score": None,
                "token_usage_score": None,
                "component_issues": [],
                "positive_highlights": [],
                "recommendations": [],
                "overall_assessment": raw[:400],
            }

        ux_score = result.get("ux_adherence_score", "N/A")
        token_score = result.get("token_usage_score", "N/A")
        self.emit_activity(
            emit,
            f"Implementation review: UX adherence {ux_score}/10 · Token usage {token_score}/10.",
            "success" if (ux_score or 0) >= 7 else "warn",
        )

        issues = result.get("component_issues", [])
        if issues:
            self.emit_activity(emit, f"Issues found: {'; '.join(issues[:2])}", "warn")

        self.emit_status(emit, "complete", "Implementation review complete", 1.0, False)
        return result
