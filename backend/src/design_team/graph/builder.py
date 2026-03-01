"""Compile the LangGraph StateGraph for the design team workflow.

The graph mirrors the existing session_manager._run_workflow() but uses
LangGraph's interrupt() for human checkpoints and conditional edges for
adaptive self-approval.
"""
from __future__ import annotations

from langgraph.graph import StateGraph, START, END

from .state import DesignTeamState
from . import nodes, edges


def build_graph() -> StateGraph:
    """Build and return the compiled LangGraph workflow (no checkpointer).

    A checkpointer must be added at compile time for interrupt() to work.
    Use build_graph_with_checkpointer() for a production-ready graph.
    """
    graph = StateGraph(DesignTeamState)

    # ── Add nodes ────────────────────────────────────────────────────────────
    graph.add_node("scoping", nodes.scoping_node)
    graph.add_node("scope_checkpoint", nodes.scope_checkpoint_node)
    graph.add_node("kickoff", nodes.kickoff_node)
    graph.add_node("kickoff_micro_checkpoint", nodes.kickoff_micro_checkpoint_node)
    graph.add_node("designing", nodes.designing_node)
    graph.add_node("cross_critique", nodes.cross_critique_node)
    graph.add_node("checkpoint_1", nodes.checkpoint_1_node)
    graph.add_node("implementing", nodes.implementing_node)
    graph.add_node("checkpoint_2", nodes.checkpoint_2_node)
    graph.add_node("senior_review", nodes.senior_review_node)
    graph.add_node("reviewing", nodes.reviewing_node)
    graph.add_node("final_checkpoint", nodes.final_checkpoint_node)
    graph.add_node("revision_1", nodes.revision_1_node)
    graph.add_node("revision_2", nodes.revision_2_node)
    graph.add_node("complete", nodes.complete_node)

    # ── Wire edges ───────────────────────────────────────────────────────────
    # Phase 0: Scoping (always requires human)
    graph.add_edge(START, "scoping")
    graph.add_edge("scoping", "scope_checkpoint")
    graph.add_edge("scope_checkpoint", "kickoff")

    # Phase 0b: Kickoff (micro-checkpoint if confidence < 0.5)
    graph.add_conditional_edges("kickoff", edges.should_micro_checkpoint_kickoff, {
        "kickoff_micro_checkpoint": "kickoff_micro_checkpoint",
        "designing": "designing",
    })
    graph.add_edge("kickoff_micro_checkpoint", "designing")

    # Phase 1: Designing (parallel in-node) → cross-critique → adaptive checkpoint
    graph.add_edge("designing", "cross_critique")
    graph.add_conditional_edges("cross_critique", edges.should_checkpoint_1, {
        "checkpoint_1": "checkpoint_1",
        "implementing": "implementing",
    })
    # checkpoint_1: confirm → implementing, revise → revision_1 → re-cross-critique
    graph.add_conditional_edges("checkpoint_1", edges.after_checkpoint_1, {
        "revision_1": "revision_1",
        "implementing": "implementing",
    })
    graph.add_edge("revision_1", "cross_critique")

    # Phase 2: Implementing → adaptive checkpoint → senior review
    graph.add_conditional_edges("implementing", edges.should_checkpoint_2, {
        "checkpoint_2": "checkpoint_2",
        "senior_review": "senior_review",
    })
    # checkpoint_2: confirm → senior_review, revise → revision_2 → back to checkpoint_2
    graph.add_conditional_edges("checkpoint_2", edges.after_checkpoint_2, {
        "revision_2": "revision_2",
        "senior_review": "senior_review",
    })
    graph.add_edge("revision_2", "checkpoint_2")

    # Phase 3: Final review (always requires human)
    graph.add_edge("senior_review", "reviewing")
    graph.add_edge("reviewing", "final_checkpoint")
    graph.add_edge("final_checkpoint", "complete")
    graph.add_edge("complete", END)

    return graph
