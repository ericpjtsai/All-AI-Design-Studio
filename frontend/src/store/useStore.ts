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
  status: 'idle' as const,
  currentTask: 'Waiting for brief…',
  progress: 0,
  isActive: false,
}));

// ── Store types ───────────────────────────────────────────────────────────────

interface StudioStore {
  // State
  agentStates: AgentRuntimeState[];
  activities: ActivityEntry[];
  pendingConfirmation: ConfirmationPayload | null;
  workflowPhase: WorkflowPhase;
  graphVisible: boolean;
  graphNodeScreenPositions: Array<{ x: number; y: number } | null>;
  /** null = demo mode (no backend), string = live session id */
  sessionId: string | null;

  // Public actions
  startSession: (brief: string) => Promise<void>;
  confirmDecision: (id: string, action: 'confirm' | 'revise', feedback?: string) => void;
  toggleGraph: () => void;
  setGraphNodeScreenPositions: (pos: Array<{ x: number; y: number } | null>) => void;

  // Internal actions — also called by useSSEStream
  _updateAgent: (payload: { agentIndex: number } & Partial<AgentRuntimeState>) => void;
  _addActivity: (payload: { agentIndex: number; message: string; level?: ActivityEntry['level'] }) => void;
  _setPhase: (phase: WorkflowPhase) => void;
  _setPendingConfirmation: (payload: ConfirmationPayload | null) => void;
  _setComplete: () => void;
}

// ── Store ─────────────────────────────────────────────────────────────────────

export const useStore = create<StudioStore>()((set, get) => ({
  agentStates: initialAgentStates,
  activities: [],
  pendingConfirmation: null,
  workflowPhase: 'briefing',
  graphVisible: true,
  graphNodeScreenPositions: [null, null, null, null],
  sessionId: null,

  // ── UI helpers ─────────────────────────────────────────────────────────────

  toggleGraph: () => set((s) => ({ graphVisible: !s.graphVisible })),

  setGraphNodeScreenPositions: (pos) => set({ graphNodeScreenPositions: pos }),

  // ── SSE-compatible internal setters ───────────────────────────────────────

  _updateAgent: ({ agentIndex, ...patch }) =>
    set((s) => ({
      agentStates: s.agentStates.map((a) =>
        a.index === agentIndex ? { ...a, ...patch } : a,
      ),
    })),

  _addActivity: ({ agentIndex, message, level = 'info' }) =>
    set((s) => ({
      activities: [makeActivity(agentIndex, message, level), ...s.activities].slice(0, 60),
    })),

  _setPhase: (phase) => set({ workflowPhase: phase }),

  _setPendingConfirmation: (payload) => set({ pendingConfirmation: payload }),

  _setComplete: () => {
    const { _setPhase } = get();
    _setPhase('complete');
    AGENTS.forEach((a) =>
      get()._updateAgent({ agentIndex: a.index, status: 'complete', isActive: false }),
    );
  },

  // ── startSession — POST /api/sessions to kick off real backend ─────────────

  startSession: async (brief: string) => {
    try {
      const res = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brief }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const { session_id } = await res.json();
      set({
        sessionId: session_id,
        workflowPhase: 'scoping',
        activities: [],
        pendingConfirmation: null,
        agentStates: initialAgentStates.map((a) =>
          a.index === 0
            ? { ...a, status: 'working', currentTask: 'Analyzing design brief…', progress: 5 }
            : a,
        ),
      });
      get()._addActivity({ agentIndex: 0, message: 'Session started. Analyzing brief…' });
    } catch (err) {
      console.error('[startSession]', err);
    }
  },

  // ── confirmDecision — live: POST /api/sessions/{id}/confirm; demo: local ──

  confirmDecision: (id, action, feedback) => {
    const { sessionId, workflowPhase, _updateAgent, _addActivity } = get();

    set({ pendingConfirmation: null });

    // ── LIVE MODE: forward to backend ────────────────────────────────────────
    if (sessionId) {
      fetch(`/api/sessions/${sessionId}/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, feedback: feedback ?? null }),
      }).catch((err) => console.error('[confirmDecision]', err));
      return;
    }

    // ── DEMO MODE: local simulation ───────────────────────────────────────────

    if (action === 'revise') {
      _updateAgent({
        agentIndex: 0,
        status: 'working',
        currentTask: feedback ? `Revising: "${feedback.slice(0, 40)}…"` : 'Revising scope…',
        isActive: false,
      });
      _addActivity({ agentIndex: 0, message: 'Revision requested. Reworking scope document…', level: 'warn' });

      setTimeout(() => {
        _addActivity({ agentIndex: 0, message: 'Scope revised. Presenting updated version.', level: 'success' });
        _updateAgent({ agentIndex: 0, status: 'reviewing', currentTask: 'Awaiting re-confirmation', progress: 80 });
        set({
          pendingConfirmation: {
            id: 'scope-confirm-2',
            title: 'Revised Scope Ready',
            question: "I've incorporated your feedback. Please confirm to proceed.",
            context:
              'Project: Analytics Dashboard (Revised)\n' +
              '• Added: Accessibility requirements (WCAG AA)\n' +
              '• Clarified: Responsive breakpoints down to 1280px\n' +
              '• Confirmed: shadcn/ui as component library',
            options: ['confirm', 'revise'],
          },
        });
      }, 3500);
      return;
    }

    // CONFIRM path
    if (workflowPhase === 'scoping') {
      set({ workflowPhase: 'designing' });
      _updateAgent({ agentIndex: 0, status: 'reviewing', currentTask: 'Delegating to designers', progress: 100 });
      _addActivity({ agentIndex: 0, message: 'Scope confirmed. Delegating to Senior & Visual.', level: 'success' });

      setTimeout(() => {
        _updateAgent({ agentIndex: 1, status: 'working', currentTask: 'Generating user flows…', isActive: true, progress: 10 });
        _updateAgent({ agentIndex: 3, status: 'working', currentTask: 'Defining color palette…', isActive: true, progress: 10 });
        _updateAgent({ agentIndex: 0, status: 'idle', currentTask: 'Monitoring Senior & Visual', isActive: false });
        _addActivity({ agentIndex: 1, message: 'Starting user flow analysis.' });
        _addActivity({ agentIndex: 3, message: 'Creating color and type tokens.' });
      }, 1200);

      setTimeout(() => {
        _updateAgent({ agentIndex: 1, progress: 50, currentTask: 'Building IA and wireframe specs…' });
        _updateAgent({ agentIndex: 3, progress: 55, currentTask: 'Defining spacing + elevation…' });
        _addActivity({ agentIndex: 1, message: 'Flows done. Working on wireframe JSON.' });
        _addActivity({ agentIndex: 3, message: 'Color tokens done. Adding spacing + motion.' });
      }, 5500);

      setTimeout(() => {
        _updateAgent({ agentIndex: 1, status: 'complete', progress: 100, currentTask: 'IA specs complete', isActive: false });
        _updateAgent({ agentIndex: 3, status: 'complete', progress: 100, currentTask: 'Design tokens complete', isActive: false });
        _updateAgent({ agentIndex: 0, status: 'reviewing', currentTask: 'Reviewing Round 1 outputs…' });
        _addActivity({ agentIndex: 1, message: 'Wireframe specs and user flows delivered.', level: 'success' });
        _addActivity({ agentIndex: 3, message: 'Design token set (34 tokens) ready.', level: 'success' });
        _addActivity({ agentIndex: 0, message: 'Round 1 review: Coherence 8/10 · Completeness 9/10.' });

        setTimeout(() => {
          set({
            pendingConfirmation: {
              id: 'checkpoint-1',
              title: 'Strategy Review — Checkpoint 1',
              question: 'Round 1 complete. Senior delivered wireframes & IA; Visual produced 34 tokens. Approve to start implementation?',
              context:
                'Quality Scores:\n• Scope alignment: 9/10\n• Completeness: 9/10\n• Coherence: 8/10\n\nConfidence: 0.74',
              options: ['confirm', 'revise'],
            },
          });
          _updateAgent({ agentIndex: 0, status: 'reviewing', currentTask: 'Awaiting Checkpoint 1' });
        }, 1500);
      }, 11000);

    } else if (workflowPhase === 'designing') {
      set({ workflowPhase: 'implementing' });
      _addActivity({ agentIndex: 0, message: 'Checkpoint 1 approved. Delegating to Junior Designer.', level: 'success' });
      _updateAgent({ agentIndex: 0, status: 'idle', currentTask: 'Monitoring Junior Designer' });

      setTimeout(() => {
        _updateAgent({ agentIndex: 2, status: 'working', currentTask: 'Building Chart component…', isActive: true, progress: 15 });
        _addActivity({ agentIndex: 2, message: 'Received specs. Starting Chart.tsx.' });
      }, 1000);

      setTimeout(() => {
        _updateAgent({ agentIndex: 2, progress: 60, currentTask: 'Building DataCard and Sidebar…' });
        _addActivity({ agentIndex: 2, message: 'Chart.tsx complete. Building DataCard and Sidebar.' });
      }, 6000);

      setTimeout(() => {
        _updateAgent({ agentIndex: 2, status: 'complete', progress: 100, currentTask: '4 components delivered', isActive: false });
        _updateAgent({ agentIndex: 0, status: 'reviewing', currentTask: 'Running final quality gate…' });
        _addActivity({ agentIndex: 2, message: '4 React components delivered.', level: 'success' });
        _addActivity({ agentIndex: 0, message: 'Running final quality gate.' });

        setTimeout(() => {
          set({
            workflowPhase: 'reviewing',
            pendingConfirmation: {
              id: 'final-review',
              title: 'Final Deliverables — Checkpoint 3',
              question: 'All deliverables complete. 4 React components, 34 tokens, Figma specs, handoff docs. Ready for final approval.',
              context:
                'Deliverables:\n✓ 4 React components (TypeScript)\n✓ 34 design tokens\n✓ Figma specs (JSON)\n✓ Handoff notes\n\nOverall score: 8.6/10',
              options: ['confirm', 'revise'],
            },
          });
          _updateAgent({ agentIndex: 0, status: 'reviewing', currentTask: 'Awaiting final approval' });
        }, 1500);
      }, 13000);

    } else if (workflowPhase === 'reviewing') {
      set({ workflowPhase: 'complete' });
      AGENTS.forEach((a) =>
        _updateAgent({ agentIndex: a.index, status: 'complete', isActive: false, progress: 100 }),
      );
      _addActivity({ agentIndex: 0, message: 'Project complete! All deliverables approved.', level: 'success' });
    }
  },
}));
