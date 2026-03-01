"""Formatting helpers for human-readable checkpoint context.

Extracted from session_manager.py so LangGraph nodes can reuse them.
"""
from __future__ import annotations


def format_scope_doc(doc: dict) -> str:
    lines: list[str] = []
    lines.append(f"PROJECT: {doc.get('project_overview', '')}")
    lines.append(f"\nUSERS: {doc.get('target_users', '')}")

    in_scope = doc.get("in_scope", [])
    if in_scope:
        lines.append("\nIN SCOPE:")
        for item in in_scope:
            lines.append(f"  \u2022 {item}")

    out_scope = doc.get("out_of_scope", [])
    if out_scope:
        lines.append("\nOUT OF SCOPE:")
        for item in out_scope:
            lines.append(f"  \u2022 {item}")

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


def _safe_dict(val: object) -> dict:
    """Return val if it's a dict, otherwise an empty dict."""
    return val if isinstance(val, dict) else {}


def _safe_list(val: object) -> list:
    """Return val if it's a list, otherwise an empty list."""
    return val if isinstance(val, list) else []


def format_direction_summary(senior: dict, visual: dict, cross: dict) -> str:
    lines: list[str] = []

    flows = _safe_list(senior.get("user_flows", []))
    lines.append(f"USER FLOWS: {len(flows)} flow(s)")
    for f in flows[:3]:
        if isinstance(f, dict):
            lines.append(f"  \u2022 {f.get('title', f.get('id', ''))}")

    wireframes = _safe_list(senior.get("wireframes", []))
    lines.append(f"\nWIREFRAMES: {len(wireframes)} screen(s)")
    for w in wireframes[:3]:
        if isinstance(w, dict):
            lines.append(f"  \u2022 {w.get('screen_name', w.get('screen_id', ''))}")

    tokens = _safe_dict(visual.get("design_tokens"))
    color = _safe_dict(tokens.get("color"))
    color_count = len(_safe_dict(color.get("semantic")))
    lines.append(f"\nDESIGN TOKENS: {color_count} semantic colors, typography, spacing, motion")

    comp_styles_val = _safe_dict(visual.get("component_styles"))
    comp_styles = list(comp_styles_val.keys())
    if comp_styles:
        lines.append(f"\nCOMPONENT STYLES: {', '.join(comp_styles[:5])}")

    score = cross.get("alignment_score", "N/A")
    summary = cross.get("summary", "")
    issues = _safe_list(cross.get("alignment_issues", []))
    lines.append(f"\nCROSS-CRITIQUE: alignment {score}/10 \u2014 {summary}")
    for issue in issues[:3]:
        lines.append(f"  \u26a0 {issue}")

    lines.append(f"\nHANDOFF NOTES:\n{senior.get('handoff_notes', '')[:250]}")
    return "\n".join(lines)


def format_final_summary(review: dict, junior: dict, cross: dict) -> str:
    lines: list[str] = []
    lines.append(f"OVERALL SCORE:        {review.get('overall_score', 'N/A')}/10")
    lines.append(f"Scope Alignment:      {review.get('scope_alignment', 'N/A')}/10")
    lines.append(f"Completeness:         {review.get('completeness', 'N/A')}/10")
    lines.append(f"Coherence:            {review.get('coherence', 'N/A')}/10")
    lines.append(f"Production Readiness: {review.get('production_readiness', 'N/A')}/10")

    highlights = _safe_list(review.get("highlights", []))
    if highlights:
        lines.append("\nHIGHLIGHTS:")
        for h in highlights:
            lines.append(f"  \u2713 {h}")

    issues = _safe_list(review.get("issues", []))
    if issues:
        lines.append("\nISSUES:")
        for i in issues:
            lines.append(f"  \u26a0 {i}")

    skill_ev = _safe_dict(review.get("skill_evolution_applied"))
    if skill_ev:
        lines.append("\nSKILL EVOLUTION APPLIED:")
        for agent, note in skill_ev.items():
            lines.append(f"  {agent}: {note}")

    lines.append(f"\nSUMMARY:\n{review.get('summary', '')}")

    components = _safe_list(junior.get("components", []))
    lines.append(f"\nCOMPONENTS BUILT: {len(components)}")
    for c in components[:6]:
        if isinstance(c, dict):
            lines.append(f"  \u2022 {c.get('name', '')}")

    alignment = cross.get("alignment_score", "N/A")
    lines.append(f"\nCROSS-CRITIQUE SCORE: {alignment}/10")

    return "\n".join(lines)
