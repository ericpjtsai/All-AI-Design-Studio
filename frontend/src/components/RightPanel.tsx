import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useStore } from '../store/useStore';
import { WorkflowPhase, ConfirmationPayload } from '../types';
import { CheckCircle2, ChevronDown, ChevronUp, Send } from 'lucide-react';
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

/**
 * A scope checkpoint is only "active" while we're still in the scoping phase.
 * If the phase has already advanced (e.g. to 'designing'), a stale
 * pendingConfirmation with id='scope' is ignored so the UI can move forward.
 */
function isScopeCheckpoint(pending: ConfirmationPayload | null, phase: WorkflowPhase): boolean {
  if (phase !== 'scoping') return false;
  return pending?.id === 'scope' || pending?.id === 'scope-confirm-2';
}

function getActiveView(
  phase: WorkflowPhase,
  pending: ConfirmationPayload | null,
): ActiveView {
  if (isScopeCheckpoint(pending, phase)) {
    return 'scope-conversation';
  }

  // During designing/implementing: keep the context-rich view visible.
  // The confirmation overlays as a bottom drawer instead of replacing the view.
  if (pending && phase === 'designing') return 'design-phase';
  if (pending && phase === 'implementing') return 'build-phase';

  // Explicit review phase or final checkpoint → ReviewPhaseView
  if (pending) return 'review-phase';

  switch (phase) {
    case 'briefing':   return 'dashboard';
    case 'complete':   return 'output';
    case 'scoping':    return 'scope-conversation';
    case 'designing':  return 'design-phase';
    case 'implementing': return 'build-phase';
    case 'reviewing':  return 'review-phase';
    default:           return 'dashboard';
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

// ── Inline confirmation drawer ────────────────────────────────────────────────

const ConfirmationDrawer: React.FC<{
  pending: ConfirmationPayload;
  accentColor: string;
}> = ({ pending, accentColor }) => {
  const confirmDecision = useStore((s) => s.confirmDecision);
  const [reviseOpen, setReviseOpen] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleApprove = () => {
    setSubmitting(true);
    confirmDecision(pending.id, 'confirm');
  };

  const handleRevise = () => {
    if (!feedback.trim()) return;
    setSubmitting(true);
    confirmDecision(pending.id, 'revise', feedback.trim());
  };

  return (
    <motion.div
      initial={{ y: '100%', opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: '100%', opacity: 0 }}
      transition={{ type: 'spring', damping: 28, stiffness: 320 }}
      className="absolute bottom-0 left-0 right-0 overflow-hidden"
      style={{
        background: 'rgba(255,255,255,0.97)',
        backdropFilter: 'blur(12px)',
        borderTop: `2px solid ${accentColor}40`,
        borderRadius: '0 0 32px 32px',
        boxShadow: '0 -8px 32px rgba(0,0,0,0.12)',
      }}
    >
      <div className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-start gap-2">
          <motion.div
            animate={{ scale: [1, 1.15, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="shrink-0 flex items-center justify-center rounded-lg"
            style={{ width: 28, height: 28, background: `${accentColor}18`, marginTop: 1 }}
          >
            <CheckCircle2 size={14} color={accentColor} />
          </motion.div>
          <div className="flex-1 min-w-0">
            <div style={{ fontSize: 12, fontWeight: 700, color: '#111' }}>
              {pending.title}
            </div>
            <div style={{ fontSize: 10.5, color: '#666', marginTop: 2, lineHeight: 1.4 }}>
              {pending.question}
            </div>
          </div>
        </div>

        {/* Approve button */}
        <motion.button
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleApprove}
          disabled={submitting || reviseOpen}
          className="w-full flex items-center justify-center gap-2 rounded-xl py-2.5"
          style={{
            background: submitting || reviseOpen
              ? '#e5e7eb'
              : `linear-gradient(135deg, ${accentColor}dd, ${accentColor})`,
            color: submitting || reviseOpen ? '#9ca3af' : '#fff',
            fontSize: 12,
            fontWeight: 700,
            border: 'none',
            cursor: submitting || reviseOpen ? 'not-allowed' : 'pointer',
            boxShadow: submitting || reviseOpen ? 'none' : `0 4px 16px ${accentColor}40`,
            letterSpacing: '0.01em',
            transition: 'all 0.2s',
          }}
        >
          <CheckCircle2 size={14} />
          Approve &amp; Continue
        </motion.button>

        {/* Revise toggle */}
        <button
          onClick={() => setReviseOpen((o) => !o)}
          disabled={submitting}
          className="w-full flex items-center justify-center gap-1.5"
          style={{
            background: 'none',
            border: 'none',
            cursor: submitting ? 'not-allowed' : 'pointer',
            color: '#888',
            fontSize: 11,
            fontWeight: 500,
            padding: '2px 0',
          }}
        >
          {reviseOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          Request changes
        </button>

        {/* Revise panel */}
        <AnimatePresence>
          {reviseOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden space-y-2"
            >
              <textarea
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder="What needs to change? Be specific…"
                rows={3}
                className="w-full resize-none rounded-xl p-2.5 outline-none"
                style={{
                  fontSize: 11.5,
                  color: '#1a1a1a',
                  background: '#f8f9fa',
                  border: '1px solid #e5e7eb',
                  lineHeight: 1.5,
                }}
              />
              <motion.button
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleRevise}
                disabled={!feedback.trim() || submitting}
                className="w-full flex items-center justify-center gap-2 rounded-xl py-2.5"
                style={{
                  background: feedback.trim() && !submitting ? '#111' : '#e5e7eb',
                  color: feedback.trim() && !submitting ? '#fff' : '#9ca3af',
                  fontSize: 12,
                  fontWeight: 700,
                  border: 'none',
                  cursor: feedback.trim() && !submitting ? 'pointer' : 'not-allowed',
                  transition: 'all 0.2s',
                }}
              >
                <Send size={13} />
                Send Revision Request
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};

// ── Session error banner ──────────────────────────────────────────────────────

const SessionErrorBanner: React.FC = () => {
  const sessionError = useStore((s) => s.sessionError);
  const resetSession = useStore((s) => s.resetSession);

  if (!sessionError) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="absolute top-0 left-0 right-0 z-50 mx-3 mt-3 rounded-2xl overflow-hidden"
      style={{
        background: '#fff1f2',
        border: '1px solid #fecdd3',
        boxShadow: '0 4px 16px rgba(239,68,68,0.12)',
      }}
    >
      <div className="px-4 py-3 flex items-start gap-3">
        <div
          className="shrink-0 rounded-lg flex items-center justify-center mt-0.5"
          style={{ width: 28, height: 28, background: '#fee2e2' }}
        >
          <span style={{ fontSize: 13 }}>⚠</span>
        </div>
        <div className="flex-1 min-w-0">
          <div style={{ fontSize: 11.5, fontWeight: 700, color: '#991b1b' }}>
            Connection Error
          </div>
          <div style={{ fontSize: 10.5, color: '#b91c1c', marginTop: 2, lineHeight: 1.45 }}>
            {sessionError}
          </div>
        </div>
        <button
          onClick={resetSession}
          className="shrink-0 rounded-xl px-3 py-1.5"
          style={{
            background: '#ef4444',
            color: '#fff',
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: '0.06em',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          NEW SESSION
        </button>
      </div>
    </motion.div>
  );
};

// ── Component ────────────────────────────────────────────────────────────────

const RightPanel: React.FC = () => {
  const workflowPhase = useStore((s) => s.workflowPhase);
  const pendingConfirmation = useStore((s) => s.pendingConfirmation);
  const sessionError = useStore((s) => s.sessionError);
  const activeView = getActiveView(workflowPhase, pendingConfirmation);
  const accentColor = sessionError ? '#ef4444' : ACCENT_COLORS[activeView];

  // Show drawer overlay when we keep design/build view during confirmation
  const showDrawer =
    pendingConfirmation != null &&
    !isScopeCheckpoint(pendingConfirmation, workflowPhase) &&
    (activeView === 'design-phase' || activeView === 'build-phase');

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

      {/* Session error overlay */}
      <AnimatePresence>
        {sessionError && <SessionErrorBanner key="error-banner" />}
      </AnimatePresence>

      {/* View content */}
      <div className="flex-1 overflow-hidden relative">
        <AnimatePresence mode="wait">
          {activeView === 'dashboard' && <DashboardView key="dashboard" />}
          {activeView === 'scope-conversation' && <ScopeConversationView key="scope" />}
          {activeView === 'design-phase' && <DesignPhaseView key="design" />}
          {activeView === 'build-phase' && <BuildPhaseView key="build" />}
          {activeView === 'review-phase' && <ReviewPhaseView key="review" />}
          {activeView === 'output' && <OutputView key="output" />}
        </AnimatePresence>

        {/* Slide-up confirmation drawer — keeps design/build view visible */}
        <AnimatePresence>
          {showDrawer && pendingConfirmation && (
            <ConfirmationDrawer
              key={pendingConfirmation.id}
              pending={pendingConfirmation}
              accentColor={accentColor}
            />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default RightPanel;
