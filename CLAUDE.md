# Claude Code Prompt: Multi-Agent Design Team Orchestration

## Project Overview

Build a **multi-agent AI design team** that takes a design brief as input and produces production-ready UI deliverables (React components, design tokens, and Figma-ready specs) through collaborative agent workflows. This is a **portfolio-ready demo project** showcasing AI-powered design orchestration.

The system simulates a real design team with four specialized roles that collaborate, review each other's work, and **self-improve over successive design rounds**.

---

## Tech Stack

- **Language**: Python 3.11+
- **Orchestration**: LangGraph (for stateful, graph-based multi-agent workflows with built-in human-in-the-loop support)
- **LLM**: Anthropic Claude API (claude-sonnet-4-20250514 for agents, claude-sonnet-4-20250514 for Design Manager review tasks)
- **Front-End**: React, Next.js
- **UI Components**: shadcn/ui
- **Output Generation**: Jinja2 templates for React/HTML code generation, Style Dictionary for design tokens
- **State Management**: LangGraph's `StateGraph` with checkpointing (SQLite for local persistence)
- **Shared Agent Memory**: All agents (Designer roles) share a single memory database — enabling cross-agent context awareness, shared design decisions, and collaborative recall across the workflow
- **CLI Interface**: Rich (for beautiful terminal UI showing agent status, approvals, and outputs)
- **Project Structure**: Python package with `pyproject.toml`

---

## Architecture

### Agent Roles & Responsibilities

#### 1. Design Manager (Orchestrator + Reviewer + Supplementary Designer)

##### Phase 0: Scope Clarification (BEFORE any delegation)
- **This is the Design Manager's first and most critical responsibility.** Before assigning any task to any sub-agent, the Design Manager must:
  1. **Analyze the brief** for ambiguities, missing information, implicit assumptions, and unstated constraints
  2. **Generate clarifying questions** organized by category:
     - **Users & Context**: Who is the target user? What devices/platforms? What accessibility requirements?
     - **Scope & Boundaries**: Which screens/flows are in scope? What's explicitly out of scope?
     - **Brand & Visual Direction**: Existing brand guidelines? Visual references or mood? Competitor examples?
     - **Technical Constraints**: Target framework? Existing design system to integrate with? Browser support?
     - **Priority & Tradeoffs**: What matters most — speed, polish, innovation, consistency?
  3. **Present questions to the human** and wait for answers before proceeding
  4. **Synthesize answers into a structured Design Scope Document** that becomes the single source of truth for all sub-agents
  5. If the brief is sufficiently detailed and unambiguous, the Design Manager should state its interpretation and ask the human for a quick confirmation rather than asking redundant questions

##### Adaptive Confirmation Frequency
- The Design Manager controls how often it pauses for human confirmation throughout the workflow
- **Early stages (scope clarification + first round)**: HIGH frequency — confirm scope interpretation, confirm design direction, confirm token/component decisions. The goal is to build alignment before investing agent tokens in execution
- **Mid stages (implementation rounds)**: MEDIUM frequency — confirm at the standard human checkpoints, but the Design Manager may insert additional micro-confirmations if it detects ambiguity or divergence from the brief
- **Late stages (refinement + final assembly)**: LOW frequency — only the standard final checkpoint, unless the Design Manager identifies a significant deviation
- **Frequency decision logic**: The Design Manager tracks a `human_alignment_confidence` score (0.0–1.0) based on:
  - How many human revisions were requested at previous checkpoints (more revisions → lower confidence → keep frequency high)
  - How consistent human feedback has been (contradictory feedback → lower confidence)
  - How well-defined the scope document is (vague scope → lower confidence)
  - The Design Manager explicitly communicates its confidence level and frequency decision to the human: _"Based on our aligned scope and your approval of the design direction, I'm reducing confirmation frequency for the implementation phase. I'll check in at the component review checkpoint unless I encounter ambiguity."_

##### Primary role
- Orchestrate the workflow, delegate tasks, review all outputs at each stage
- **All task delegations must reference the Design Scope Document** — sub-agents never work from the raw brief alone

##### Secondary role
- Act as supplementary designer when other agents are occupied or when their output needs direct improvement

##### Review responsibilities
- Evaluate each agent's output against the **Design Scope Document**, design principles, and quality standards
- Provide structured feedback with specific, actionable improvement directives
- **Meta-skill**: After each design round, generate a `skill_evolution` object for each agent that refines their system prompt for the next round (this is the self-improving loop)
- Track quality metrics across rounds (coherence, consistency, completeness, token efficiency)

##### Supplementary design
- When an agent's output is below threshold after 2 revision attempts, the Design Manager produces the deliverable directly, incorporating the agent's partial work

##### Decision authority
- Determines when work is ready for human review checkpoints
- Determines confirmation frequency based on `human_alignment_confidence`

#### 2. Senior Designer (UX Strategy + Information Architecture + Interaction Design)
- **Inputs**: Design brief, user research insights (if provided), Design Manager's task assignment
- **Outputs**:
  - User flow diagrams (Mermaid.js syntax for rendering)
  - Information architecture maps
  - Wireframe specifications (structured JSON describing layout, hierarchy, and interaction patterns)
  - Interaction design specs (micro-interactions, transitions, states)
  - Annotated component requirements for handoff to Junior Designer
- **Review loop**: Receives Design Manager feedback, revises up to 2 times before escalation

#### 3. Junior Designer (UI Implementation + Prototyping)
- **Inputs**: Senior Designer's wireframes + IA specs, Design Manager's task assignment, Visual Designer's design tokens
- **Outputs**:
  - React component code (functional components with TypeScript)
  - HTML/CSS prototypes (single-file, self-contained)
  - Component props and state documentation
  - Responsive breakpoint implementations
- **Review loop**: Receives Design Manager feedback, revises up to 2 times before escalation

#### 4. Visual Designer (Design Systems + Graphics + Tokens)
- **Inputs**: Design brief (brand context), Senior Designer's IA for visual hierarchy needs
- **Outputs**:
  - Design token definitions (JSON format compatible with Style Dictionary)
    - Color palette (primitives + semantic tokens)
    - Typography scale
    - Spacing system
    - Border radius, shadows, elevation
    - Motion/animation tokens
  - Component-level style specifications
  - Figma-ready specs (structured JSON that maps to Figma auto-layout properties)
  - SVG graphics/icons when needed (inline SVG code)
- **Review loop**: Receives Design Manager feedback, revises up to 2 times before escalation

---

### Workflow Graph (LangGraph StateGraph)

```
[Human Input: Design Brief]
        │
        ▼
┌─────────────────────────────────────┐
│  PHASE 0: SCOPE CLARIFICATION        │
│  Design Manager analyzes brief for:  │
│  - Ambiguities & missing info        │
│  - Implicit assumptions              │
│  - Unstated constraints              │
│  - Generates clarifying questions    │
└────────┬────────────────────────────┘
         │
         ▼
  ╔══════════════════════════════════╗
  ║  HUMAN CHECKPOINT 0              ║
  ║  Answer clarifying questions     ║
  ║  (may loop multiple times until  ║
  ║   Manager has full clarity)      ║
  ╚══════════╤═══════════════════════╝
             │
             ▼
┌─────────────────────────────────────┐
│  Design Manager: Scope Synthesis     │
│  - Produces Design Scope Document    │
│  - Defines constraints & priorities  │
│  - Sets initial confirmation freq    │
│  - Sets alignment_confidence = 0.0   │
└────────┬────────────────────────────┘
         │
         ▼
  ╔══════════════════════════════════╗
  ║  HUMAN CHECKPOINT 0b             ║
  ║  Confirm Design Scope Document   ║
  ║  (high-freq: early stage)        ║
  ╚══════════╤═══════════════════════╝
             │
             ▼
┌─────────────────┐
│  Design Manager  │ ◄──────────────────────────────────────┐
│  (Delegate from  │                                         │
│   Scope Doc)     │                                         │
└────────┬────────┘                                         │
         │ Delegates parallel tasks                         │
         ├──────────────────┐                               │
         ▼                  ▼                               │
┌─────────────────┐ ┌─────────────────┐                     │
│ Senior Designer  │ │ Visual Designer  │                     │
│ (UX/IA/Flows)   │ │ (Tokens/System)  │                     │
└────────┬────────┘ └────────┬────────┘                     │
         │                   │                               │
         ▼                   ▼                               │
┌─────────────────────────────────────┐                     │
│  Design Manager Review (Round 1)     │                     │
│  - Quality gate vs Scope Doc         │                     │
│  - Feedback to agents OR escalate    │                     │
│  - Generate skill_evolution          │                     │
│  - Update alignment_confidence       │                     │
└────────┬────────────────────────────┘                     │
         │                                                   │
         ▼                                                   │
  ╔══════════════════════════════════╗                       │
  ║  HUMAN CHECKPOINT 1              ║                       │
  ║  Review: Strategy & Direction    ║                       │
  ║  (high-freq: still early)        ║                       │
  ║  + Optional micro-confirmations  ║                       │
  ╚══════════╤═══════════════════════╝                       │
             │ Approve / Request changes                     │
             │ (Manager adjusts alignment_confidence)        │
             ▼                                               │
┌─────────────────┐                                         │
│ Junior Designer  │ (receives Scope Doc + Senior's specs    │
│ (UI Components)  │  + Visual's tokens + human feedback)    │
└────────┬────────┘                                         │
         ▼                                                   │
┌─────────────────────────────────────┐                     │
│  Design Manager Review (Round 2)     │                     │
│  - Component quality gate            │                     │
│  - Visual consistency vs Scope Doc   │                     │
│  - Feedback OR direct fixes          │                     │
│  - Update skill_evolution            │                     │
│  - Evaluate: reduce confirmation?    │                     │
└────────┬────────────────────────────┘                     │
         │                                                   │
         ▼                                                   │
  ╔══════════════════════════════════╗                       │
  ║  HUMAN CHECKPOINT 2              ║                       │
  ║  Review: Components & System     ║                       │
  ║  (freq based on confidence:      ║                       │
  ║   may skip if confidence > 0.8)  ║                       │
  ╚══════════╤═══════════════════════╝                       │
             │ Approve / Request changes ────────────────────┘
             ▼
┌─────────────────────────────────────┐
│  Design Manager: Final Assembly      │
│  - Package all deliverables          │
│  - Generate Figma-ready specs        │
│  - Export design tokens              │
│  - Bundle React components           │
│  - Produce final quality report      │
│  - Log token usage & efficiency      │
│  - Final alignment_confidence log    │
└────────┬────────────────────────────┘
         ▼
  ╔══════════════════════════════════╗
  ║  HUMAN CHECKPOINT 3 (FINAL)      ║
  ║  Final Deliverables              ║
  ║  (always required regardless     ║
  ║   of confidence level)           ║
  ╚══════════════════════════════════╝
```

---

### Self-Improving Feedback Loop (Key Differentiator)

This is the most important architectural feature. After each review round, the Design Manager generates a `skill_evolution` object:

```python
@dataclass
class SkillEvolution:
    agent_role: str                    # Which agent this applies to
    round_number: int                  # Which review round
    quality_scores: dict               # { coherence: 0.8, completeness: 0.9, ... }
    improvement_directives: list[str]  # Specific improvements for next round
    prompt_refinements: str            # Addendum to agent's system prompt
    token_usage: int                   # Tokens used this round
    output_quality_ratio: float        # quality_score / tokens_used (normalized)
    # The prompt_refinements accumulate across rounds, making each agent
    # progressively better at their specific task
```

**How it works**:
1. Each agent starts with a base system prompt defining their role
2. After Round 1 review, Design Manager appends `prompt_refinements` based on observed weaknesses
3. In subsequent rounds (if revision is needed), the agent receives their base prompt + accumulated refinements
4. Over multiple design projects (or revision rounds within a project), agents produce higher quality output with fewer tokens
5. `skill_evolution` history is persisted to disk so improvements carry across sessions

---

### State Schema

```python
from typing import TypedDict, Annotated
from langgraph.graph import add_messages

class DesignTeamState(TypedDict):
    # Input
    design_brief: str
    human_feedback: list[str]

    # Scope Clarification (Phase 0)
    clarifying_questions: list[dict]    # Questions generated by Design Manager
    scope_answers: list[dict]           # Human's answers to clarifying questions
    design_scope_document: dict         # Structured source of truth for all agents
    scope_confirmed: bool               # Human has confirmed the scope doc

    # Adaptive Confirmation
    human_alignment_confidence: float   # 0.0–1.0, updated after each checkpoint
    confirmation_frequency: str         # "high" | "medium" | "low"
    confirmation_log: list[dict]        # { checkpoint, confidence, frequency, revisions_requested }
    skipped_checkpoints: list[str]      # Checkpoints auto-approved due to high confidence

    # Agent outputs (each round appends, keyed by round number)
    senior_designer_output: dict        # { wireframes, flows, ia_map, interaction_specs }
    visual_designer_output: dict        # { design_tokens, component_styles, figma_specs }
    junior_designer_output: dict        # { react_components, html_prototypes, docs }

    # Review state
    manager_reviews: list[dict]         # History of all reviews
    current_round: int
    revision_counts: dict               # { "senior": 0, "junior": 0, "visual": 0 }

    # Self-improvement
    skill_evolutions: dict              # { agent_role: [SkillEvolution, ...] }

    # Metrics
    token_usage_log: list[dict]         # Per-agent, per-round token tracking
    quality_metrics: list[dict]         # Per-round quality scores

    # Control flow
    status: str                         # "clarifying", "scoping", "in_progress", "awaiting_human", "complete"
    messages: Annotated[list, add_messages]
```

---

### Human-in-the-Loop Checkpoints

Use LangGraph's built-in `interrupt()` mechanism:

```python
from langgraph.types import interrupt

def human_checkpoint(state: DesignTeamState, checkpoint_name: str) -> dict:
    """Pause execution and present deliverables for human review."""
    # Display current deliverables summary via Rich CLI
    # Show quality metrics and token usage
    feedback = interrupt({
        "checkpoint": checkpoint_name,
        "deliverables_summary": summarize_current_state(state),
        "quality_metrics": state["quality_metrics"][-1] if state["quality_metrics"] else None,
        "action_needed": "approve | revise | abort"
    })
    return {"human_feedback": [feedback]}
```

**Three Checkpoint Phases** (with adaptive frequency):

0. **Scope Clarification** (ALWAYS required, may loop): Design Manager presents clarifying questions → human answers → Manager may ask follow-ups → produces Design Scope Document → human confirms. This phase loops until the Manager has sufficient clarity. It is the foundation for everything downstream.
   - **0b: Scope Confirmation**: Human reviews the synthesized Design Scope Document. This is non-negotiable — no agent work begins without confirmed scope.
1. **Strategy Review**: After Senior Designer + Visual Designer initial outputs — review direction before component work begins. At this stage, confirmation frequency is HIGH. The Manager may also insert micro-confirmations (e.g., "Before the Junior Designer starts, I want to confirm the component hierarchy I've derived from your feedback...").
2. **Component Review**: After Junior Designer builds components — review implementation quality. The Manager evaluates `human_alignment_confidence` and decides whether this checkpoint requires full human review or can be streamlined (e.g., "Confidence is 0.85 based on zero revisions at Checkpoint 1. I recommend a quick scan rather than deep review — but it's your call.").
3. **Final Deliverables**: Complete package review before export. **Always required regardless of confidence level.**

**Adaptive Frequency Rules**:
- `confidence < 0.4`: Insert extra micro-confirmations between standard checkpoints
- `confidence 0.4–0.7`: Standard checkpoints only, no skipping
- `confidence 0.7–0.9`: Manager may recommend streamlined review at Checkpoint 2
- `confidence > 0.9`: Manager may recommend skipping Checkpoint 2 entirely (human can override)
- Checkpoint 0 (scope) and Checkpoint 3 (final) are **never** skippable

---

### Output Artifacts

#### 1. React Components (Junior Designer)
```
/output/components/
  ├── ComponentName.tsx        # Functional component with TypeScript
  ├── ComponentName.styles.ts  # Styled-components or CSS modules
  ├── ComponentName.stories.ts # Basic Storybook story
  └── index.ts                 # Barrel export
```

#### 2. Design Tokens (Visual Designer)
```
/output/tokens/
  ├── tokens.json              # Style Dictionary format
  ├── figma-variables.json     # Figma Variables-compatible export
  ├── colors.css               # CSS custom properties
  ├── typography.css
  └── spacing.css
```

#### 3. Figma-Ready Specs (Visual Designer + Design Manager)
```
/output/figma-specs/
  ├── layout-spec.json         # Auto-layout properties, constraints
  ├── component-spec.json      # Component properties, variants
  └── style-guide.json         # Complete style reference
```

#### 4. Documentation (Design Manager)
```
/output/docs/
  ├── design-decisions.md      # Rationale for key decisions
  ├── quality-report.md        # Metrics, token usage, evolution log
  └── handoff-notes.md         # Implementation notes for developers
```

---

## Project File Structure

```
design-team-orchestration/
├── pyproject.toml
├── README.md
├── .env.example                    # ANTHROPIC_API_KEY
├── src/
│   └── design_team/
│       ├── __init__.py
│       ├── main.py                 # CLI entry point
│       ├── graph.py                # LangGraph StateGraph definition
│       ├── state.py                # State schema & data models
│       ├── agents/
│       │   ├── __init__.py
│       │   ├── base.py             # BaseAgent class with skill_evolution support
│       │   ├── design_manager.py   # Orchestrator + reviewer + supplementary
│       │   ├── senior_designer.py  # UX strategy + IA + interaction design
│       │   ├── junior_designer.py  # UI implementation + React components
│       │   └── visual_designer.py  # Design system + tokens + graphics
│       ├── prompts/
│       │   ├── __init__.py
│       │   ├── manager.py          # Design Manager system prompt
│       │   ├── senior.py           # Senior Designer system prompt
│       │   ├── junior.py           # Junior Designer system prompt
│       │   └── visual.py           # Visual Designer system prompt
│       ├── review/
│       │   ├── __init__.py
│       │   ├── quality_gate.py     # Quality scoring rubric
│       │   ├── skill_evolution.py  # Self-improvement logic
│       │   ├── metrics.py          # Token tracking & efficiency calculation
│       │   └── confirmation.py     # Adaptive confirmation frequency controller
│       ├── scope/
│       │   ├── __init__.py
│       │   ├── clarifier.py        # Brief analysis + question generation
│       │   ├── scope_document.py   # DesignScopeDocument model + synthesis
│       │   └── templates.py        # Question templates by category
│       ├── outputs/
│       │   ├── __init__.py
│       │   ├── react_generator.py  # React component code generation
│       │   ├── token_generator.py  # Design token export (Style Dictionary)
│       │   ├── figma_spec.py       # Figma-ready spec generation
│       │   └── templates/          # Jinja2 templates for code gen
│       │       ├── component.tsx.j2
│       │       ├── styles.ts.j2
│       │       └── story.ts.j2
│       └── cli/
│           ├── __init__.py
│           ├── display.py          # Rich-based terminal UI
│           └── checkpoints.py      # Human review interaction handlers
├── examples/
│   ├── briefs/
│   │   ├── dashboard.md            # Example: Analytics dashboard brief
│   │   ├── onboarding.md           # Example: User onboarding flow
│   │   └── settings.md             # Example: Settings page brief
│   └── outputs/                    # Example generated outputs for demo
├── tests/
│   ├── test_graph.py
│   ├── test_agents.py
│   ├── test_quality_gate.py
│   └── test_skill_evolution.py
└── data/
    └── skill_evolutions/           # Persisted agent improvements across sessions
```

---

## Implementation Instructions

### Phase 1: Foundation (Start Here)
1. Initialize the project with `pyproject.toml`, dependencies: `langgraph`, `langchain-anthropic`, `rich`, `jinja2`, `style-dictionary` (or Python equivalent), `pydantic`
2. Define the state schema in `state.py` using Pydantic models and TypedDict — include the scope clarification and adaptive confirmation fields
3. Build `base.py` — the `BaseAgent` class that handles:
   - System prompt construction (base prompt + accumulated skill_evolution refinements)
   - Anthropic API calls with token counting
   - Structured output parsing (use Claude's tool use / JSON mode)
4. **Build the Design Manager's Phase 0 first** — scope clarification loop:
   - Brief analysis → question generation → human Q&A loop → scope synthesis → human confirmation
   - This is the most critical path — test it standalone before adding other agents
   - Build the `DesignScopeDocument` Pydantic model that all downstream agents receive
5. Build the adaptive confirmation controller: `confirmation_controller.py` — tracks `human_alignment_confidence`, decides checkpoint frequency, and manages the skip/streamline logic
6. Implement each agent in `agents/` with their specific system prompts in `prompts/`
7. Wire up the LangGraph `StateGraph` in `graph.py` with conditional edges

### Phase 2: Review & Self-Improvement
6. Build `quality_gate.py` — Design Manager's structured rubric for evaluating outputs (score 1-10 on: completeness, coherence, visual consistency, code quality, specification clarity)
7. Build `skill_evolution.py` — The logic that generates prompt refinements based on review scores and specific feedback patterns
8. Implement the revision loop: agent receives feedback → revises → re-review (max 2 rounds, then Design Manager takes over)

### Phase 3: Output Generation
9. Build React component generator with Jinja2 templates
10. Build design token exporter (JSON → CSS custom properties + Figma variables format)
11. Build Figma spec generator (structured JSON matching Figma's auto-layout model)
12. Build documentation generator (Markdown quality report + design decisions)

### Phase 4: CLI & Polish
13. Build Rich-based CLI with:
    - Animated agent status indicators (which agent is "working")
    - Checkpoint review interface (display deliverables, accept input)
    - Token usage dashboard
    - Quality metrics visualization
14. Add 2-3 example design briefs with pre-generated outputs for portfolio demo
15. Write README with architecture diagram, demo GIF, and setup instructions

---

## Agent System Prompts (Core Direction)

### Design Manager
```
You are a Design Manager leading a team of 3 designers. You are the quality
gatekeeper and the team's interface with the human stakeholder.

PHASE 0 — SCOPE CLARIFICATION (your FIRST action on any brief):
Before delegating ANY task, you must fully understand the design problem.
1. READ the brief carefully. Identify every ambiguity, gap, and assumption.
2. GENERATE clarifying questions organized by: Users & Context, Scope &
   Boundaries, Brand & Visual Direction, Technical Constraints, Priority &
   Tradeoffs. Only ask questions the brief doesn't already answer.
3. WAIT for human answers. Ask follow-ups if answers introduce new ambiguity.
4. SYNTHESIZE all information into a Design Scope Document with sections:
   - Project Overview (1-2 sentences)
   - Target Users & Context
   - In-Scope Deliverables (explicit list)
   - Out-of-Scope (explicit list)
   - Visual & Brand Direction
   - Technical Constraints
   - Priority Stack Rank (what matters most → least)
   - Success Criteria
5. PRESENT the Scope Doc to the human for confirmation. Do not proceed until
   confirmed. If the brief is already comprehensive, state your interpretation
   and ask for a quick confirmation instead of redundant questions.

ADAPTIVE CONFIRMATION:
- Track human_alignment_confidence (0.0–1.0) based on: revision frequency,
  feedback consistency, and scope clarity
- Early stages: confirm frequently (every major decision)
- Later stages: reduce frequency as confidence builds
- ALWAYS communicate your confidence level and frequency decision to the human
  transparently. Never silently skip a confirmation.
- Checkpoints 0 (scope) and 3 (final) are NEVER skippable.

ORCHESTRATION:
1. DELEGATE tasks by providing each agent with: relevant Scope Doc sections,
   specific deliverable requirements, and quality criteria
2. REVIEW all outputs against the Scope Doc (not the raw brief)
3. PROVIDE specific, actionable feedback (cite exact issues, suggest exact fixes)
4. ACT as supplementary designer when an agent fails after 2 revision rounds
5. OPTIMIZE team performance via skill_evolution refinements after each round
6. TRACK token efficiency — directive agents toward conciseness without
   sacrificing quality

Quality rubric (score each 1-10):
- Scope Alignment: Does the output address the Scope Doc's requirements?
- Completeness: Are all required deliverables present?
- Coherence: Is the output internally consistent?
- Visual Consistency: Do visual decisions align across agents?
- Production Readiness: Could a developer use this output directly?
```

### Senior Designer
```
You are a Senior Designer specializing in UX strategy, information architecture,
and interaction design. Given a design brief and task assignment:

1. ANALYZE the brief for user needs, business goals, and constraints
2. PRODUCE user flows as Mermaid.js diagrams
3. DEFINE information architecture with clear content hierarchy
4. SPECIFY wireframes as structured JSON (component tree with layout properties,
   content slots, and interaction states)
5. DOCUMENT interaction patterns: states, transitions, micro-interactions
6. ANNOTATE handoff requirements for the Junior Designer

Output format: Structured JSON with clear sections for each deliverable.
Be precise and specific — your specs drive the entire downstream implementation.
```

### Junior Designer
```
You are a Junior Designer who implements UI components from specifications.
Given wireframe specs from Senior Designer and design tokens from Visual Designer:

1. BUILD React functional components in TypeScript
2. APPLY design tokens for all visual properties (never hardcode colors/spacing)
3. IMPLEMENT responsive behavior using the specified breakpoints
4. HANDLE all component states (default, hover, focus, active, disabled, loading, error)
5. ENSURE accessibility: semantic HTML, ARIA labels, keyboard navigation
6. WRITE clean, readable code with clear prop interfaces

Output: Complete, self-contained React components that compile without errors.
Include TypeScript interfaces for all props.
```

### Visual Designer
```
You are a Visual Designer specializing in design systems, visual identity, and
design token architecture. Given a design brief:

1. DEFINE a complete design token set:
   - Color: primitives (palette) + semantic (intent-based: primary, success, etc.)
   - Typography: font families, scale (fluid if appropriate), weights, line-heights
   - Spacing: base unit + scale (4px/8px base)
   - Elevation: shadow tokens per level
   - Border: radius scale, widths
   - Motion: duration + easing tokens
2. SPECIFY component-level styles that reference only tokens (never raw values)
3. GENERATE Figma-ready specs: auto-layout properties, constraints, component
   property definitions matching Figma's data model
4. CREATE SVG graphics/icons when the brief calls for them (inline SVG)

Output format: JSON design tokens in Style Dictionary format + component style specs.
Ensure tokens are systematically named with clear hierarchy (e.g., color.primary.500).
```

---

## Key Design Decisions & Rationale

| Decision | Rationale |
|----------|-----------|
| **LangGraph** over CrewAI/AutoGen | Native human-in-the-loop (`interrupt()`), built-in state persistence, graph-based workflow gives precise control over agent coordination, and strong Python ecosystem |
| **Phase 0 scope clarification before any delegation** | Mirrors real design practice — ambiguity at the start compounds into wasted effort downstream. Investing tokens in scope alignment saves far more tokens than rework. Also prevents agents from hallucinating requirements |
| **Adaptive confirmation frequency** | Avoids two failure modes: too much human interruption (frustrating, breaks flow) and too little (agents drift from intent). The confidence-based system lets the Manager earn autonomy through demonstrated alignment |
| **Hub-and-spoke with Manager fallback** | Mirrors real team dynamics — Manager can unblock bottlenecks instead of deadlocking on poor agent output |
| **Design Scope Document as single source of truth** | Sub-agents never see the raw brief — they only receive the structured, confirmed Scope Doc. This eliminates interpretation drift between agents and ensures everyone works from the same understanding |
| **Skill Evolution persistence** | The self-improving loop is the project's key differentiator — persisting improvements across sessions demonstrates compounding value |
| **Structured JSON outputs** | Enables reliable parsing between agents and deterministic code generation from specs |
| **Style Dictionary format** for tokens | Industry standard, directly exportable to CSS/SCSS/iOS/Android — demonstrates real-world applicability |
| **Checkpoints 0 and 3 always required** | Scope alignment and final review are non-negotiable — only mid-process checkpoints are eligible for adaptive skipping |

---

## Example Usage

```bash
# Run with an example brief
python -m design_team run --brief examples/briefs/dashboard.md

# Run with custom brief
python -m design_team run --brief my-brief.md

# Resume from a checkpoint
python -m design_team resume --thread-id <thread_id>

# View skill evolution history
python -m design_team skills --show-history

# Export outputs to a directory
python -m design_team export --thread-id <thread_id> --output-dir ./my-output
```

---

## Success Criteria

1. **Scope clarification works**: Given a vague 1-sentence brief, the Design Manager generates relevant clarifying questions, synthesizes answers into a clear Scope Doc, and no downstream agent produces work that contradicts the confirmed scope
2. **Adaptive confirmation is visible**: The CLI clearly shows the Manager's confidence level and frequency decisions at each checkpoint. Over a multi-round project, confirmation frequency demonstrably decreases as confidence builds
3. **End-to-end execution**: Given a confirmed Design Scope Document, the system produces working React components, design tokens, and Figma specs without crashing
4. **Quality improvement**: Measurable quality score increase between Round 1 and Round 2 outputs (tracked in quality report)
5. **Token efficiency**: Demonstrate decreasing token usage with maintained/improved quality across successive runs (via skill_evolution)
6. **Portfolio-ready demo**: Clean CLI experience with Rich formatting, example outputs that showcase the system's capability, and a compelling README with architecture diagram
7. **Code quality**: Type-safe Python, clear separation of concerns, tested core logic (scope synthesis, quality gate, skill evolution, state transitions, confirmation controller)