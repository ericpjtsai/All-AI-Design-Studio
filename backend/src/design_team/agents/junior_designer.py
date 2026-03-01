from __future__ import annotations

import json
from typing import Awaitable, Callable

from google import genai

from .base import BaseAgent, EmitFn
from ..prompts import JUNIOR_DESIGNER_SYSTEM


class _HtmlStreamExtractor:
    """Extracts the html_prototype string value from a streaming JSON response.

    The LLM emits text like:
      {"components": [...], "html_prototype": "<!DOCTYPE html>...", ...}

    This class scans the raw text stream chunk-by-chunk and calls
    on_html_delta(delta) with each unescaped HTML fragment as it arrives,
    enabling real-time prototype preview without waiting for the full response.
    """

    _MARKER = '"html_prototype"'

    def __init__(self, on_html_delta: Callable[[str], None]) -> None:
        self._on = on_html_delta
        self._buf = ""
        self._state = "seek"   # seek | skip_to_quote | extract | done
        self._escape = False   # True when the previous char was a backslash

    def feed(self, raw: str) -> None:
        if self._state == "done":
            return

        self._buf += raw

        if self._state == "seek":
            idx = self._buf.find(self._MARKER)
            if idx == -1:
                # Retain the tail in case the marker spans two chunks
                tail = len(self._MARKER) - 1
                self._buf = self._buf[-tail:] if len(self._buf) > tail else self._buf
                return
            self._buf = self._buf[idx + len(self._MARKER):]
            self._state = "skip_to_quote"

        if self._state == "skip_to_quote":
            q = self._buf.find('"')
            if q == -1:
                self._buf = self._buf[-4:] if len(self._buf) > 4 else self._buf
                return
            self._buf = self._buf[q + 1:]  # consume the opening quote
            self._state = "extract"

        if self._state == "extract":
            out: list[str] = []
            i = 0
            b = self._buf
            n = len(b)

            while i < n:
                ch = b[i]
                if self._escape:
                    self._escape = False
                    if   ch == 'n':  out.append('\n')
                    elif ch == 't':  out.append('\t')
                    elif ch == 'r':  out.append('\r')
                    elif ch == '"':  out.append('"')
                    elif ch == '\\': out.append('\\')
                    elif ch == '/':  out.append('/')
                    elif ch == 'u' and i + 4 < n:
                        try:
                            out.append(chr(int(b[i + 1:i + 5], 16)))
                        except ValueError:
                            out.append('\\u' + b[i + 1:i + 5])
                        i += 4
                    else:
                        out.append(ch)
                elif ch == '\\':
                    self._escape = True
                elif ch == '"':
                    # Closing quote — HTML string is complete
                    if out:
                        self._on(''.join(out))
                    self._state = "done"
                    self._buf = ""
                    return
                else:
                    out.append(ch)
                i += 1

            if out:
                self._on(''.join(out))
            self._buf = ""  # consumed; _escape preserved for next call

AGENT_INDEX = 2

MilestoneFn = Callable[[str, str], Awaitable[str]]


class JuniorDesigner(BaseAgent):
    def __init__(self, client: genai.Client) -> None:
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
        if not isinstance(tokens, dict):
            tokens = {}
        comp_styles = visual_output.get("component_styles", {})
        if not isinstance(comp_styles, dict):
            comp_styles = {}

        # Safe nested accessors — LLM sometimes returns strings instead of dicts
        def _d(obj: object, *keys, default=None):
            """Safe nested dict get that tolerates non-dict values."""
            for key in keys:
                if not isinstance(obj, dict):
                    return default
                obj = obj.get(key, default)
            return obj

        color_semantic = _d(tokens, 'color', 'semantic', default={}) or {}
        font_family = _d(tokens, 'typography', 'fontFamily', default={}) or {}
        spacing_base = _d(tokens, 'spacing', 'base', default='4px') or '4px'
        if not isinstance(spacing_base, str):
            spacing_base = '4px'

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
Colors: {json.dumps(color_semantic, indent=2)}
Typography: fontFamily={font_family}
Spacing base: {spacing_base}

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
        core_raw = await self.call_llm(
            system=JUNIOR_DESIGNER_SYSTEM,
            user=core_prompt,
            emit=emit,
            activity_prefix="Building core components",
            max_tokens=4096,
        )

        try:
            core_data = json.loads(self.clean_json(core_raw))
            if not isinstance(core_data, dict):
                core_data = {"components": []}
        except Exception as e:
            print(f"[Junior core_data JSON error] {e} | first 300: {core_raw[:300]}")
            core_data = {"components": []}

        core_components = core_data.get("components", [])
        if not isinstance(core_components, list):
            core_components = []
        core_count = len(core_components)
        core_names = [c.get("name", "") for c in core_components[:3] if isinstance(c, dict)]
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

        all_wireframes = senior_output.get("wireframes", [])
        remaining_wireframes = all_wireframes[2:]
        interaction_specs = senior_output.get("interaction_specs", {})

        # Summarise already-built component code (truncated) for context
        core_code_summary = "\n".join(
            f"// {c.get('name','')}.tsx\n{str(c.get('tsx_code',''))[:400]}"
            for c in core_data.get("components", [])[:3]
        )

        proto_prompt = f"""Complete the remaining components and build a FULL self-contained HTML prototype.

SCOPE:
{json.dumps(scope_doc.get('in_scope', []))}
Project overview: {scope_doc.get('project_overview', '')}

ALREADY BUILT COMPONENTS (reference — do not duplicate React code):
{core_code_summary or "None yet — build all components."}

ALL WIREFRAMES (use ALL of these to build the HTML prototype):
{json.dumps(all_wireframes, indent=2)[:1500]}

REMAINING WIREFRAMES (additional React components to produce if any):
{json.dumps(remaining_wireframes[:2], indent=2)}

INTERACTION SPECS:
{json.dumps(interaction_specs, indent=2)[:400]}

MANAGER REVIEW FEEDBACK ON CORE COMPONENTS:
{feedback_1 if feedback_1 else "Core components approved. Maintain the same quality standard."}

FULL TOKEN SET:
{json.dumps(tokens, indent=2)[:1000]}

Return a JSON object:
{{
  "components": [
    {{
      "name": "AdditionalComponent",
      "tsx_code": "import React from 'react';\\nexport default function AdditionalComponent() {{ return <div />; }}",
      "props_doc": "props description"
    }}
  ],
  "html_prototype": "<!DOCTYPE html><html lang='en'>...</html>",
  "implementation_notes": "notes for developers"
}}

CRITICAL — html_prototype requirements:
- MUST be a complete, visually rich, working single-file HTML application
- NEVER write a placeholder, stub, or "nothing to build" message — always render the full UI
- Use ALL design token values as inline CSS (colors, fonts, spacing)
- Inline JavaScript for navigation, interactive states (hover, click, toggles, modals)
- All screens from the wireframes must be rendered or navigable
- Must look like a polished, real product ready for stakeholder review
- Completely self-contained — zero external imports, all CSS/JS inline
"""
        # Stream HTML prototype in real-time via SSE so the frontend can show
        # a live preview as the LLM writes it.
        accumulated_html = ""

        def _on_html_delta(delta: str) -> None:
            nonlocal accumulated_html
            accumulated_html += delta
            emit("prototype_stream", {"delta": delta})

        extractor = _HtmlStreamExtractor(_on_html_delta)

        proto_raw = await self.call_llm(
            system=JUNIOR_DESIGNER_SYSTEM,
            user=proto_prompt,
            emit=emit,
            activity_prefix="Building prototype",
            max_tokens=12000,
            on_chunk=extractor.feed,
        )

        try:
            proto_data = json.loads(self.clean_json(proto_raw))
            if not isinstance(proto_data, dict):
                proto_data = {"components": [], "html_prototype": "", "implementation_notes": ""}
        except Exception as e:
            print(f"[Junior proto_data JSON error] {e} | first 300: {proto_raw[:300]}")
            proto_data = {
                "components": [],
                "html_prototype": f"<html><body><pre>{proto_raw[:2000]}</pre></body></html>",
                "implementation_notes": proto_raw[:300],
            }

        proto_components = proto_data.get("components", [])
        if not isinstance(proto_components, list):
            proto_components = []
        remaining_count = len(proto_components)
        self.emit_activity(
            emit,
            f"{remaining_count} additional component(s) + HTML prototype assembled.",
            "success",
        )
        self.emit_status(emit, "working", "Full set done — awaiting Manager review", 0.85)

        # ── Milestone 2: full component set review ────────────────────────────
        if on_milestone:
            proto_names = [c.get("name", "") for c in proto_components if isinstance(c, dict)]
            all_names = core_names + proto_names
            summary = (
                f"{core_count + remaining_count} total components: {', '.join(all_names[:6])}. "
                f"HTML prototype included. "
                f"Notes: {str(proto_data.get('implementation_notes', ''))[:100]}"
            )
            await on_milestone("full_implementation", summary)

        # Merge all components
        all_components = core_components + proto_components
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
