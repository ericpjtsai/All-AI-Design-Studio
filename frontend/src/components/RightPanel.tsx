import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useStore } from '../store/useStore';
import { WorkflowPhase, ConfirmationPayload } from '../types';
import DashboardView from './views/DashboardView';
import OutputView from './views/OutputView';
import ScopeConversationView from './views/ScopeConversationView';
import DesignPhaseView from './views/DesignPhaseView';
import BuildPhaseView from './views/BuildPhaseView';
import ReviewPhaseView from './views/ReviewPhaseView';

// ── View routing ─────────────────────────────────────────────────────────────

type ActiveView =
  | 'dashboard'
  | 'scope-conversation'
  | 'design-phase'
  | 'build-phase'
  | 'review-phase'
  | 'output';

function getActiveView(
  phase: WorkflowPhase,
  pending: ConfirmationPayload | null,
): ActiveView {
  // Scope confirmations are handled inside ScopeConversationView.
  const isScopeCheckpoint =
    pending?.id === 'scope' || pending?.id === 'scope-confirm-2';

  // Any non-scope confirmation (checkpoint-1, final-review, etc.) shows the
  // ReviewPhaseView, which owns the approve / God-Mode UI for all checkpoints.
  if (pending && !isScopeCheckpoint) return 'review-phase';

  switch (phase) {
    case 'briefing':
      return 'dashboard';
    case 'complete':
      return 'output';
    case 'scoping':
      return 'scope-conversation';
    case 'designing':
      return 'design-phase';
    case 'implementing':
      return 'build-phase';
    case 'reviewing':
      return 'review-phase';
    default:
      return 'dashboard';
  }
}

const ACCENT_COLORS: Record<ActiveView, string> = {
  'dashboard': '#7EACEA',
  'scope-conversation': '#7EACEA',
  'design-phase': '#22c55e',
  'build-phase': '#ef4444',
  'review-phase': '#f59e0b',
  'output': '#22c55e',
};

// ── Component ────────────────────────────────────────────────────────────────

const RightPanel: React.FC = () => {
  const workflowPhase = useStore((s) => s.workflowPhase);
  const pendingConfirmation = useStore((s) => s.pendingConfirmation);
  const activeView = getActiveView(workflowPhase, pendingConfirmation);
  const accentColor = ACCENT_COLORS[activeView];

  return (
    <div
      className="w-[420px] shrink-0 flex flex-col bg-white overflow-hidden relative"
      style={{
        borderRadius: 32,
        border: '1px solid rgba(0,0,0,0.05)',
        boxShadow: '0 8px 40px rgba(0,0,0,0.08)',
      }}
    >
      {/* Animated accent bar */}
      <motion.div
        className="h-1.5 w-full shrink-0"
        animate={{ background: accentColor }}
        transition={{ duration: 0.4 }}
      />

      {/* View content with cross-fade */}
      <div className="flex-1 overflow-hidden relative">
        <AnimatePresence mode="wait">
          {activeView === 'dashboard' && <DashboardView key="dashboard" />}
          {activeView === 'scope-conversation' && <ScopeConversationView key="scope" />}
          {activeView === 'design-phase' && <DesignPhaseView key="design" />}
          {activeView === 'build-phase' && <BuildPhaseView key="build" />}
          {activeView === 'review-phase' && <ReviewPhaseView key="review" />}
          {activeView === 'output' && <OutputView key="output" />}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default RightPanel;
