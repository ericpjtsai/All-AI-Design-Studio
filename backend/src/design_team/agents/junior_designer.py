from __future__ import annotations

import json
from typing import Awaitable, Callable

import anthropic

from .base import BaseAgent, EmitFn
from ..prompts import JUNIOR_DESIGNER_SYSTEM

AGENT_INDEX = 2

MilestoneFn = Callable[[str, str], Awaitable[str]]


class JuniorDesigner(BaseAgent):
    def __init__(self, client: anthropic.AsyncAnthropic) -> None:
        super().__init__(AGENT_INDEX, client)

    async def run(
        self,
        scope_doc: dict,
        senior_output: dict,
        visual_output: dict,
        emit: EmitFn,
        manager_addendum: str = "",
        cross_critique_notes: str = "",
        on_milestone: MilestoneFn | None = None,
    ) -> dict:
        """Two-phase implementation with Manager milestone reviews.

        Phase 1: core React components (the most critical ones from wireframes)
        Phase 2: remaining components + self-contained HTML prototype
        """
        # Compact inputs to stay within context budget
        wireframes = senior_output.get("wireframes", [])[:2]
        handoff = senior_output.get("handoff_notes", "")[:300]
        tokens = visual_output.get("design_tokens", {})
        comp_styles = visual_output.get("component_styles", {})

        extra_notes = "\n".join(filter(None, [manager_addendum, cross_critique_notes]))

        # ── Phase 1: Core components ──────────────────────────────────────────
        self.emit_status(emit, "working", "Building core React components", 0.1)
        self.emit_activity(emit, "Reading wireframes, tokens, and Manager brief…")

        core_prompt = f"""Build the most critical React components from the wireframes.

SCOPE:
{json.dumps(scope_doc.get('in_scope', []))}
Technical constraints: {scope_doc.get('technical_constraints', '')}

MANAGER NOTES:
{extra_notes if extra_notes else "Follow the wireframes and apply all design tokens."}

WIREFRAMES (top 2 screens):
{json.dumps(wireframes, indent=2)}

DESIGN TOKENS (key values):
Colors: {json.dumps(tokens.get('color', {}).get('semantic', {}), indent=2)}
Typography: fontFamily={tokens.get('typography', {}).get('fontFamily', {})}
Spacing base: {tokens.get('spacing', {}).get('base', '4px')}

COMPONENT STYLES:
{json.dumps(comp_styles, indent=2)}

HANDOFF NOTES:
{handoff}

Build 2-3 core components. Return a JSON object:
{{
  "components": [
    {{
      "name": "ComponentName",
      "tsx_code": "import React from 'react';\\nexport interface ComponentProps {{}}\\nconst Component: React.FC<ComponentProps> = () => {{\\n  return <div />;\\n}};\\nexport default Component;",
      "props_doc": "description of props and usage"
    }}
  ]
}}

Rules:
- Use design tokens as CSS custom properties or inline style values — never hardcode colors/spacing
- Handle all states: default, hover, focus, active, disabled, loading, error
- Semantic HTML with ARIA attributes
- TypeScript with explicit prop interfaces
"""
        core_raw = await self.call_claude(
            system=JUNIOR_DESIGNER_SYSTEM,
            user=core_prompt,
            emit=emit,
            activity_prefix="Building core components",
            max_tokens=4096,
        )

        try:
            core_data = json.loads(core_raw)
        except json.JSONDecodeError:
            core_data = {"components": []}

        core_count = len(core_data.get("components", []))
        core_names = [c.get("name", "") for c in core_data.get("components", [])[:3]]
        self.emit_activity(emit, f"Core components ready: {', '.join(core_names)}.", "success")
        self.emit_status(emit, "working", "Core components done — awaiting Manager review", 0.45)

        # ── Milestone 1: core components review ───────────────────────────────
        feedback_1 = ""
        if on_milestone:
            summary = (
                f"{core_count} core component(s): {', '.join(core_names)}. "
                f"Built from wireframes with full token integration."
            )
            feedback_1 = await on_milestone("core_components", summary)
            if feedback_1:
                self.emit_activity(emit, f"Manager feedback: {feedback_1[:100]}")

        # ── Phase 2: Remaining components + HTML prototype ────────────────────
        self.emit_status(emit, "working", "Building remaining components & prototype", 0.6)
        self.emit_activity(emit, "Completing full component set and assembling prototype…")

        remaining_wireframes = senior_output.get("wireframes", [])[2:]
        interaction_specs = senior_output.get("interaction_specs", {})

        proto_prompt = f"""Complete the remaining components and build a self-contained HTML prototype.

SCOPE:
{json.dumps(scope_doc.get('in_scope', []))}

ALREADY BUILT (do not duplicate):
Components: {core_names}

REMAINING WIREFRAMES:
{json.dumps(remaining_wireframes[:2], indent=2)}

INTERACTION SPECS:
{json.dumps(interaction_specs, indent=2)}

MANAGER REVIEW FEEDBACK ON CORE COMPONENTS:
{feedback_1 if feedback_1 else "Core components approved. Maintain the same quality standard."}

FULL TOKEN SET:
{json.dumps(tokens, indent=2)[:800]}

Return a JSON object:
{{
  "components": [
    {{
      "name": "AdditionalComponent",
      "tsx_code": "import React from 'react';\\nexport default function AdditionalComponent() {{ return <div />; }}",
      "props_doc": "props description"
    }}
  ],
  "html_prototype": "<!DOCTYPE html><html lang='en'><head>...</head><body>...</body></html>",
  "implementation_notes": "notes for developers"
}}

The html_prototype must be a COMPLETE self-contained HTML file with:
- Inline CSS using the exact color, typography, and spacing values from the design tokens
- Inline JavaScript for interactive states (hover, click, toggles)
- All screens/views visible or navigable
- Responsive layout
"""
        proto_raw = await self.call_claude(
            system=JUNIOR_DESIGNER_SYSTEM,
            user=proto_prompt,
            emit=emit,
            activity_prefix="Building prototype",
            max_tokens=8096,
        )

        try:
            proto_data = json.loads(proto_raw)
        except json.JSONDecodeError:
            proto_data = {
                "components": [],
                "html_prototype": f"<html><body><pre>{proto_raw[:2000]}</pre></body></html>",
                "implementation_notes": proto_raw[:300],
            }

        remaining_count = len(proto_data.get("components", []))
        self.emit_activity(
            emit,
            f"{remaining_count} additional component(s) + HTML prototype assembled.",
            "success",
        )
        self.emit_status(emit, "working", "Full set done — awaiting Manager review", 0.85)

        # ── Milestone 2: full component set review ────────────────────────────
        if on_milestone:
            all_names = core_names + [c.get("name", "") for c in proto_data.get("components", [])]
            summary = (
                f"{core_count + remaining_count} total components: {', '.join(all_names[:6])}. "
                f"HTML prototype included. "
                f"Notes: {str(proto_data.get('implementation_notes', ''))[:100]}"
            )
            await on_milestone("full_implementation", summary)

        # Merge all components
        all_components = core_data.get("components", []) + proto_data.get("components", [])
        combined = {
            "components": all_components,
            "html_prototype": proto_data.get("html_prototype", ""),
            "implementation_notes": proto_data.get("implementation_notes", ""),
        }

        self.emit_status(emit, "complete", "All components and prototype delivered", 1.0, False)
        self.emit_activity(
            emit,
            f"{len(all_components)} React component(s) + prototype ready for handoff.",
            "success",
        )

        return combined
