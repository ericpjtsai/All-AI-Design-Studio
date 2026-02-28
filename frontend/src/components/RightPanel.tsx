import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useStore } from '../store/useStore';
import { WorkflowPhase, ConfirmationPayload } from '../types';
import DashboardView from './views/DashboardView';
import WarRoomView from './views/WarRoomView';
import ManagersOfficeView from './views/ManagersOfficeView';
import CheckpointReviewView from './views/CheckpointReviewView';

// ── View routing ─────────────────────────────────────────────────────────────

type ActiveView = 'dashboard' | 'managers-office' | 'war-room' | 'checkpoint';

function getActiveView(
  phase: WorkflowPhase,
  pending: ConfirmationPayload | null,
): ActiveView {
  if (pending) return 'checkpoint';
  switch (phase) {
    case 'briefing':
    case 'complete':
      return 'dashboard';
    case 'scoping':
      return 'managers-office';
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
  'managers-office': '#7EACEA',
  'war-room': '#22c55e',
  'checkpoint': '#f59e0b',
};

// ── Component ────────────────────────────────────────────────────────────────

const RightPanel: React.FC = () => {
  const workflowPhase = useStore((s) => s.workflowPhase);
  const pendingConfirmation = useStore((s) => s.pendingConfirmation);
  const activeView = getActiveView(workflowPhase, pendingConfirmation);
  const accentColor = ACCENT_COLORS[activeView];

  return (
    <div
      className="flex-1 flex flex-col bg-white overflow-hidden min-w-0"
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
      <div className="flex-1 overflow-hidden">
        <AnimatePresence mode="wait">
          {activeView === 'dashboard' && <DashboardView key="dashboard" />}
          {activeView === 'managers-office' && <ManagersOfficeView key="office" />}
          {activeView === 'war-room' && <WarRoomView key="warroom" />}
          {activeView === 'checkpoint' && <CheckpointReviewView key="checkpoint" />}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default RightPanel;
