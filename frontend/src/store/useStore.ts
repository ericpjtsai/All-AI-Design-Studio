import { create } from 'zustand';
import {
  AgentRuntimeState,
  ActivityEntry,
  ConfirmationPayload,
  WorkflowPhase,
} from '../types';
import { AGENTS } from '../data/agents';

// ── Helpers ───────────────────────────────────────────────────────────────────

let _activityId = 0;

function makeActivity(
  agentIndex: number,
  message: string,
  level: ActivityEntry['level'] = 'info',
): ActivityEntry {
  return {
    id: String(++_activityId),
    agentIndex,
    message,
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    level,
  };
}

// ── Initial state ─────────────────────────────────────────────────────────────

const initialAgentStates: AgentRuntimeState[] = AGENTS.map((a) => ({
  index: a.index,
  status: a.index === 0 ? 'working' : 'idle',
  currentTask:
    a.index === 0
      ? 'Analyzing brief for ambiguities...'
      : 'Waiting for scope confirmation',
  progress: a.index === 0 ? 65 : 0,
  isActive: false,
}));

const initialActivities: ActivityEntry[] = [
  makeActivity(0, 'Brief received. Starting Phase 0: scope clarification.', 'info'),
  makeActivity(0, 'Identified 4 ambiguities in the brief.', 'warn'),
  makeActivity(0, 'Generated scope clarification questions.', 'info'),
  makeActivity(0, 'Ready to present Design Scope Document for confirmation.', 'success'),
];

const initialConfirmation: ConfirmationPayload = {
  id: 'scope-confirm-1',
  title: 'Scope Clarification Ready',
  question:
    "I've analyzed your brief and synthesized the following Design Scope Document. Please confirm this scope before I delegate work to the team.",
  context:
    'Project: Analytics Dashboard\n' +
    '• Target users: Data analysts, internal teams\n' +
    '• Platform: Web (desktop-first, 1280px+)\n' +
    '• Deliverables: Dashboard layout, chart components, design tokens\n' +
    '• Out of scope: Mobile, auth flows, data ingestion\n' +
    '• Priority: Speed → Polish → Innovation\n' +
    '• Component library: shadcn/ui',
  options: ['confirm', 'revise'],
};

// ── Store definition ──────────────────────────────────────────────────────────

interface StudioStore {
  agentStates: AgentRuntimeState[];
  activities: ActivityEntry[];
  pendingConfirmation: ConfirmationPayload | null;
  workflowPhase: WorkflowPhase;
  graphVisible: boolean;
  graphNodeScreenPositions: Array<{ x: number; y: number } | null>;

  // Actions
  confirmDecision: (id: string, action: 'confirm' | 'revise', feedback?: string) => void;
  toggleGraph: () => void;
  setGraphNodeScreenPositions: (pos: Array<{ x: number; y: number } | null>) => void;
  _updateAgent: (index: number, patch: Partial<AgentRuntimeState>) => void;
  _addActivity: (entry: ActivityEntry) => void;
}

export const useStore = create<StudioStore>()((set, get) => ({
  agentStates: initialAgentStates,
  activities: initialActivities,
  pendingConfirmation: initialConfirmation,
  workflowPhase: 'scoping',
  graphVisible: true,
  graphNodeScreenPositions: [null, null, null, null],

  toggleGraph: () => set((s) => ({ graphVisible: !s.graphVisible })),

  setGraphNodeScreenPositions: (pos) => set({ graphNodeScreenPositions: pos }),

  _updateAgent: (index, patch) =>
    set((s) => ({
      agentStates: s.agentStates.map((a) =>
        a.index === index ? { ...a, ...patch } : a,
      ),
    })),

  _addActivity: (entry) =>
    set((s) => ({
      activities: [entry, ...s.activities].slice(0, 60),
    })),

  // ── confirmDecision — drives the entire demo workflow ─────────────────────
  confirmDecision: (id, action, feedback) => {
    const { workflowPhase, _updateAgent, _addActivity } = get();

    set({ pendingConfirmation: null });

    // ── REVISE path ────────────────────────────────────────────────────────
    if (action === 'revise') {
      _updateAgent(0, {
        status: 'working',
        currentTask: feedback
          ? `Revising scope: "${feedback.slice(0, 40)}…"`
          : 'Revising scope document...',
        isActive: false,
      });
      _addActivity(makeActivity(0, 'Scope revision requested. Reworking scope document...', 'warn'));

      setTimeout(() => {
        _addActivity(makeActivity(0, 'Scope document revised. Presenting updated version.', 'success'));
        _updateAgent(0, { status: 'waiting', currentTask: 'Awaiting scope re-confirmation', progress: 80 });
        set({
          pendingConfirmation: {
            id: 'scope-confirm-2',
            title: 'Revised Scope Ready',
            question:
              "I've incorporated your feedback into the Design Scope Document. Please confirm to proceed.",
            context:
              'Project: Analytics Dashboard (Revised)\n' +
              '• Added: Accessibility requirements (WCAG AA)\n' +
              '• Clarified: Responsive breakpoints down to 1280px\n' +
              '• Confirmed: shadcn/ui as component library\n' +
              '• Updated: Priority now includes accessibility',
            options: ['confirm', 'revise'],
          },
        });
      }, 4000);
      return;
    }

    // ── CONFIRM path ───────────────────────────────────────────────────────

    if (workflowPhase === 'scoping') {
      // Phase 0 confirmed → delegates to Senior + Visual
      set({ workflowPhase: 'designing' });
      _updateAgent(0, {
        status: 'reviewing',
        currentTask: 'Delegating tasks to Senior & Visual designers',
        isActive: false,
        progress: 100,
      });
      _addActivity(makeActivity(0, 'Scope confirmed. Delegating to Senior Designer & Visual Designer.', 'success'));

      setTimeout(() => {
        _updateAgent(1, { status: 'working', currentTask: 'Generating user flow diagrams...', isActive: true, progress: 10 });
        _updateAgent(3, { status: 'working', currentTask: 'Defining color palette and type scale...', isActive: true, progress: 10 });
        _updateAgent(0, { status: 'idle', currentTask: 'Monitoring Senior & Visual designers', isActive: false });
        _addActivity(makeActivity(1, 'Starting user flow analysis for the dashboard.', 'info'));
        _addActivity(makeActivity(3, 'Creating color palette and typography scale.', 'info'));
      }, 1200);

      setTimeout(() => {
        _updateAgent(1, { progress: 45, currentTask: 'Building IA map and wireframe specs...' });
        _updateAgent(3, { progress: 55, currentTask: 'Defining spacing system and elevation tokens...' });
        _addActivity(makeActivity(1, 'User flows complete. Working on wireframe JSON specs.', 'info'));
        _addActivity(makeActivity(3, 'Color and type tokens done. Adding spacing + elevation.', 'info'));
      }, 5500);

      setTimeout(() => {
        _updateAgent(1, { status: 'done', progress: 100, currentTask: 'IA specs complete', isActive: false });
        _updateAgent(3, { status: 'done', progress: 100, currentTask: 'Design tokens complete', isActive: false });
        _updateAgent(0, { status: 'reviewing', currentTask: 'Reviewing Round 1 outputs...', isActive: false });
        _addActivity(makeActivity(1, 'Wireframe specs and user flows delivered.', 'success'));
        _addActivity(makeActivity(3, 'Design token set (34 tokens) ready for handoff.', 'success'));
        _addActivity(makeActivity(0, 'Round 1 review: Coherence 8/10 · Completeness 9/10.', 'info'));

        setTimeout(() => {
          set({
            workflowPhase: 'implementing',
            pendingConfirmation: {
              id: 'checkpoint-1',
              title: 'Strategy Review — Checkpoint 1',
              question:
                'Round 1 is complete. Senior Designer delivered wireframes & IA map. Visual Designer produced 34 design tokens. Quality scores are strong. Approve to start component implementation?',
              context:
                'Quality Scores:\n' +
                '• Scope alignment:     9/10\n' +
                '• Completeness:        9/10\n' +
                '• Coherence:           8/10\n' +
                '• Visual consistency:  8/10\n\n' +
                'Confidence: 0.74 — standard checkpoint required.',
              options: ['confirm', 'revise'],
            },
          });
          _updateAgent(0, { status: 'waiting', currentTask: 'Awaiting Checkpoint 1 approval' });
        }, 1500);
      }, 11000);
    } else if (workflowPhase === 'implementing') {
      // Checkpoint 1 confirmed → Junior Designer starts
      _addActivity(makeActivity(0, 'Checkpoint 1 approved. Delegating to Junior Designer.', 'success'));
      _updateAgent(0, { status: 'idle', currentTask: 'Monitoring Junior Designer' });

      setTimeout(() => {
        _updateAgent(2, { status: 'working', currentTask: 'Building Chart component...', isActive: true, progress: 15 });
        _addActivity(makeActivity(2, 'Received specs from Senior. Starting with Chart.tsx.', 'info'));
      }, 1000);

      setTimeout(() => {
        _updateAgent(2, { progress: 50, currentTask: 'Building DataCard and Sidebar components...' });
        _addActivity(makeActivity(2, 'Chart.tsx complete. Building DataCard and Sidebar.', 'info'));
      }, 6000);

      setTimeout(() => {
        _updateAgent(2, { status: 'done', progress: 100, currentTask: '4 components delivered', isActive: false });
        _updateAgent(0, { status: 'reviewing', currentTask: 'Running final quality gate...' });
        _addActivity(makeActivity(2, '4 React components delivered: Chart, DataCard, Sidebar, Header.', 'success'));
        _addActivity(makeActivity(0, 'Running final quality gate across all deliverables.', 'info'));

        setTimeout(() => {
          set({
            workflowPhase: 'reviewing',
            pendingConfirmation: {
              id: 'final-review',
              title: 'Final Deliverables — Checkpoint 3',
              question:
                'All deliverables are complete and quality-gated. The team produced 4 React components, 34 design tokens, Figma-ready specs, and handoff docs. Ready for your final approval.',
              context:
                'Deliverables:\n' +
                '✓ 4 React components (TypeScript + shadcn/ui)\n' +
                '✓ 34 design tokens (Style Dictionary format)\n' +
                '✓ Figma auto-layout specs (JSON)\n' +
                '✓ Handoff notes + design decisions (Markdown)\n\n' +
                'Overall quality score: 8.6/10',
              options: ['confirm', 'abort'],
            },
          });
          _updateAgent(0, { status: 'waiting', currentTask: 'Awaiting final approval' });
        }, 1500);
      }, 13000);
    } else if (workflowPhase === 'reviewing') {
      // Final confirmed → complete
      set({ workflowPhase: 'complete' });
      _updateAgent(0, { status: 'done', currentTask: 'Project complete!', isActive: false, progress: 100 });
      _updateAgent(1, { status: 'done', currentTask: 'All tasks complete', isActive: false });
      _updateAgent(2, { status: 'done', currentTask: 'All tasks complete', isActive: false });
      _updateAgent(3, { status: 'done', currentTask: 'All tasks complete', isActive: false });
      _addActivity(makeActivity(0, 'Project complete! All deliverables approved and exported.', 'success'));
    }
  },
}));
