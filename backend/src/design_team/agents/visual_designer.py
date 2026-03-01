from __future__ import annotations

import json
from typing import Awaitable, Callable

from google import genai

from .base import BaseAgent, EmitFn
from ..prompts import VISUAL_DESIGNER_SYSTEM

AGENT_INDEX = 3

MilestoneFn = Callable[[str, str], Awaitable[str]]


class VisualDesigner(BaseAgent):
    def __init__(self, client: genai.Client) -> None:
        super().__init__(AGENT_INDEX, client)

    async def run(
        self,
        scope_doc: dict,
        emit: EmitFn,
        on_milestone: MilestoneFn | None = None,
    ) -> dict:
        """Two-phase design system work with Manager milestone reviews.

        Phase 1: color palette + typography + spacing (the core token set)
        Phase 2: elevation + motion + Figma specs + component styles
        """
        # ── Phase 1: Core tokens ──────────────────────────────────────────────
        self.emit_status(emit, "working", "Defining color palette & typography scale", 0.1)
        self.emit_activity(emit, "Building primitive color palette and type scale…")

        core_prompt = f"""Design the core visual design tokens.

SCOPE DOCUMENT:
{json.dumps(scope_doc, indent=2)}

Return a JSON object with these keys:
{{
  "color": {{
    "primitive": {{
      "blue": {{"50": "#eff6ff", "100": "#dbeafe", "500": "#3b82f6", "900": "#1e3a8a"}},
      "neutral": {{"50": "#f9fafb", "100": "#f3f4f6", "900": "#111827"}}
    }},
    "semantic": {{
      "primary": "reference to primitive",
      "success": "#22c55e",
      "warning": "#f59e0b",
      "error": "#ef4444",
      "background": "#ffffff",
      "surface": "#f9fafb",
      "text": {{"primary": "#111827", "secondary": "#6b7280"}}
    }}
  }},
  "typography": {{
    "fontFamily": {{"sans": "Inter, system-ui, sans-serif", "mono": "JetBrains Mono, monospace"}},
    "fontSize": {{"xs": "0.75rem", "sm": "0.875rem", "base": "1rem", "lg": "1.125rem", "xl": "1.25rem", "2xl": "1.5rem", "3xl": "1.875rem"}},
    "fontWeight": {{"normal": 400, "medium": 500, "semibold": 600, "bold": 700}},
    "lineHeight": {{"tight": 1.25, "snug": 1.375, "normal": 1.5, "relaxed": 1.625}}
  }},
  "spacing": {{
    "base": "4px",
    "scale": {{"1": "4px", "2": "8px", "3": "12px", "4": "16px", "6": "24px", "8": "32px", "12": "48px", "16": "64px"}}
  }}
}}
"""
        core_raw = await self.call_llm(
            system=VISUAL_DESIGNER_SYSTEM,
            user=core_prompt,
            emit=emit,
            activity_prefix="Defining tokens",
            max_tokens=3072,
        )

        try:
            core_tokens = json.loads(self.clean_json(core_raw))
            if not isinstance(core_tokens, dict):
                core_tokens = {}
        except Exception as e:
            print(f"[Visual core_tokens JSON error] {e} | first 300: {core_raw[:300]}")
            core_tokens = {}

        def _dg(obj: object, *keys, default=None):
            """Safe nested dict accessor — tolerates non-dict intermediate values."""
            for key in keys:
                if not isinstance(obj, dict):
                    return default
                obj = obj.get(key, default)
            return obj

        color_obj = _dg(core_tokens, 'color', 'semantic', default={}) or {}
        color_count = len(color_obj)
        print(f"[Visual] core_tokens top_keys={list(core_tokens.keys())} | color_count={color_count}")
        self.emit_activity(emit, f"Core tokens ready: {color_count} semantic colors, type scale, spacing.", "success")
        self.emit_status(emit, "working", "Core tokens done — awaiting Manager review", 0.35)

        # ── Milestone 1: core tokens review ───────────────────────────────────
        feedback_1 = ""
        if on_milestone:
            font_sizes = _dg(core_tokens, 'typography', 'fontSize', default={}) or {}
            spacing_base = _dg(core_tokens, 'spacing', 'base', default='4px') or '4px'
            if not isinstance(spacing_base, str):
                spacing_base = '4px'
            summary = (
                f"{color_count} semantic color tokens, "
                f"typography scale with {len(font_sizes)} sizes, "
                f"spacing scale based on {spacing_base} base."
            )
            feedback_1 = await on_milestone("core_tokens", summary)
            if feedback_1:
                self.emit_activity(emit, f"Manager feedback: {feedback_1[:100]}")

        # ── Phase 2: Elevation + motion + Figma specs + component styles ───────
        self.emit_status(emit, "working", "Defining elevation, motion & Figma specs", 0.5)
        self.emit_activity(emit, "Adding elevation, motion tokens and generating Figma specs…")

        specs_prompt = f"""Complete the design system with advanced tokens and Figma specs.

SCOPE DOCUMENT:
{json.dumps(scope_doc, indent=2)}

CORE TOKENS (already designed):
{json.dumps(core_tokens, indent=2)}

MANAGER MILESTONE FEEDBACK:
{feedback_1 if feedback_1 else "No specific feedback — maintain current direction."}

Return a JSON object:
{{
  "elevation": {{
    "none": "none",
    "sm": "0 1px 2px rgba(0,0,0,0.05)",
    "md": "0 4px 6px rgba(0,0,0,0.07)",
    "lg": "0 10px 15px rgba(0,0,0,0.10)",
    "xl": "0 20px 25px rgba(0,0,0,0.12)"
  }},
  "border": {{
    "radius": {{"none": "0", "sm": "4px", "md": "8px", "lg": "12px", "xl": "16px", "full": "9999px"}},
    "width": {{"thin": "1px", "medium": "2px"}}
  }},
  "motion": {{
    "duration": {{"fast": "100ms", "normal": "200ms", "slow": "400ms"}},
    "easing": {{"default": "cubic-bezier(0.4, 0, 0.2, 1)", "in": "cubic-bezier(0.4, 0, 1, 1)", "out": "cubic-bezier(0, 0, 0.2, 1)"}}
  }},
  "component_styles": {{
    "Button": {{"padding": "8px 16px", "borderRadius": "border.radius.md", "fontWeight": "typography.fontWeight.semibold"}},
    "Card": {{"padding": "24px", "borderRadius": "border.radius.lg", "shadow": "elevation.md"}},
    "Input": {{"height": "40px", "borderRadius": "border.radius.md", "borderColor": "color.semantic.border"}}
  }},
  "figma_specs": {{
    "layout_spec": {{"gridColumns": 12, "columnGap": "16px", "rowGap": "16px", "margin": "24px"}},
    "component_spec": {{"buttonVariants": ["primary", "secondary", "ghost"], "inputVariants": ["default", "error", "disabled"]}},
    "style_guide": {{"primaryColor": "color.semantic.primary", "fontStack": "typography.fontFamily.sans"}}
  }}
}}
"""
        specs_raw = await self.call_llm(
            system=VISUAL_DESIGNER_SYSTEM,
            user=specs_prompt,
            emit=emit,
            activity_prefix="Building specs",
            max_tokens=3072,
        )

        try:
            specs_data = json.loads(self.clean_json(specs_raw))
            if not isinstance(specs_data, dict):
                specs_data = {}
        except Exception as e:
            print(f"[Visual specs_data JSON error] {e} | first 300: {specs_raw[:300]}")
            specs_data = {}
        if not specs_data:
            specs_data = {"elevation": {}, "border": {}, "motion": {}, "component_styles": {}, "figma_specs": {}}

        comp_count = len(specs_data.get("component_styles", {}))
        self.emit_activity(emit, f"Design system complete: elevation, motion, {comp_count} component styles, Figma specs.", "success")
        self.emit_status(emit, "working", "Full system done — awaiting Manager review", 0.8)

        # ── Milestone 2: full system review ───────────────────────────────────
        if on_milestone:
            motion_val = specs_data.get('motion', {})
            motion_durations = len(motion_val.get('duration', {})) if isinstance(motion_val, dict) else 0
            elevation_count = len(specs_data.get('elevation', {}))
            summary = (
                f"{comp_count} component styles, Figma specs, "
                f"motion tokens ({motion_durations} durations), "
                f"elevation scale ({elevation_count} levels)."
            )
            await on_milestone("design_system_complete", summary)

        # Merge all tokens into a unified design_tokens dict
        combined = {
            "design_tokens": {
                **core_tokens,
                "elevation": specs_data.get("elevation", {}),
                "border": specs_data.get("border", {}),
                "motion": specs_data.get("motion", {}),
            },
            "component_styles": specs_data.get("component_styles", {}),
            "figma_specs": specs_data.get("figma_specs", {}),
        }
        self.emit_status(emit, "complete", "Design system complete", 1.0, False)
        self.emit_activity(emit, "Full design token set and Figma specs delivered.", "success")

        return combined
