import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useStore } from '../store/useStore';
import { WorkflowPhase, ConfirmationPayload } from '../types';
import DashboardView from './views/DashboardView';
import WarRoomView from './views/WarRoomView';
import CheckpointReviewView from './views/CheckpointReviewView';
import OutputView from './views/OutputView';
import ScopeConversationView from './views/ScopeConversationView';

// ── View routing ─────────────────────────────────────────────────────────────

type ActiveView = 'dashboard' | 'scope-conversation' | 'war-room' | 'checkpoint' | 'output';

function getActiveView(
  phase: WorkflowPhase,
  pending: ConfirmationPayload | null,
): ActiveView {
  // Scope checkpoint (id='scope') is handled in ScopeConversationView —
  // don't redirect to CheckpointReviewView for it.
  const isScopeCheckpoint = pending?.id === 'scope';
  if (pending && !isScopeCheckpoint) return 'checkpoint';
  switch (phase) {
    case 'briefing':
      return 'dashboard';
    case 'complete':
      return 'output';
    case 'scoping':
      return 'scope-conversation';
    case 'designing':
    case 'implementing':
    case 'reviewing':
      return 'war-room';
    default:
      return 'dashboard';
  }
}

const ACCENT_COLORS: Record<ActiveView, string> = {
  'dashboard': '#7EACEA',
  'scope-conversation': '#7EACEA',
  'war-room': '#22c55e',
  'checkpoint': '#f59e0b',
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
      className="flex-1 flex flex-col bg-white overflow-hidden min-w-0 relative"
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
          {activeView === 'war-room' && <WarRoomView key="warroom" />}
          {activeView === 'checkpoint' && <CheckpointReviewView key="checkpoint" />}
          {activeView === 'output' && <OutputView key="output" />}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default RightPanel;
