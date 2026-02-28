import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckSquare, RotateCcw, ShieldCheck } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { WorkflowPhase } from '../../types';

// ── Color swatch (inline, same pattern as DesignViewer) ─────────────────────

const ColorSwatch: React.FC<{ name: string; value: string }> = ({ name, value }) => (
  <div className="flex items-center gap-2.5">
    <div
      className="w-5 h-5 rounded-md shrink-0"
      style={{ background: value, border: '1px solid rgba(0,0,0,0.08)', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}
    />
    <span className="text-[10px] font-medium truncate flex-1" style={{ color: '#71717a' }}>{name}</span>
    <span className="text-[9px] tabular-nums font-mono" style={{ color: '#a1a1aa' }}>{value}</span>
  </div>
);

// ── Left half: contextual preview ───────────────────────────────────────────

const PreviewPane: React.FC<{ phase: WorkflowPhase }> = ({ phase }) => {
  const designOutputs = useStore((s) => s.designOutputs);

  const scopeDoc = designOutputs?.scope_doc ?? {};
  const seniorOut = designOutputs?.senior_output ?? {};
  const visualOut = designOutputs?.visual_output ?? {};
  const juniorOut = designOutputs?.junior_output ?? {};
  const tokens = (visualOut.design_tokens as Record<string, unknown>) ?? {};
  const colorPrimitives = (tokens.color as Record<string, unknown> ?? {}).primitives as Record<string, string> | undefined;
  const components = Array.isArray(juniorOut.components) ? juniorOut.components : [];

  return (
    <div className="h-full overflow-y-auto px-5 py-5 space-y-4">
      <p className="text-[9px] font-black uppercase tracking-widest" style={{ color: '#a1a1aa' }}>
        Preview
      </p>

      {/* Scope preview — always show if available */}
      {(phase === 'scoping' || Object.keys(scopeDoc).length > 0) && (
        <div className="space-y-2">
          {!!scopeDoc.project_overview && (
            <div className="rounded-xl p-3" style={{ background: '#fafafa', border: '1px solid #f0f0f0' }}>
              <p className="text-[9px] font-black uppercase tracking-wider mb-1" style={{ color: '#a1a1aa' }}>Scope</p>
              <p className="text-[11px] font-medium leading-relaxed" style={{ color: '#52525b' }}>
                {String(scopeDoc.project_overview)}
              </p>
            </div>
          )}
          {Array.isArray(scopeDoc.in_scope) && (
            <div className="rounded-xl p-3" style={{ background: '#fafafa', border: '1px solid #f0f0f0' }}>
              <p className="text-[9px] font-black uppercase tracking-wider mb-1.5" style={{ color: '#a1a1aa' }}>In Scope</p>
              <ul className="space-y-1">
                {(scopeDoc.in_scope as string[]).map((item, i) => (
                  <li key={i} className="text-[10px] font-medium flex gap-1.5" style={{ color: '#71717a' }}>
                    <span style={{ color: '#22c55e' }}>✓</span>{item}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Color palette — designing+ */}
      {colorPrimitives && Object.keys(colorPrimitives).length > 0 && (
        <div>
          <p className="text-[9px] font-black uppercase tracking-wider mb-2" style={{ color: '#a1a1aa' }}>
            Color Palette
          </p>
          <div className="space-y-1.5 rounded-xl p-3" style={{ background: '#fafafa', border: '1px solid #f0f0f0' }}>
            {Object.entries(colorPrimitives).slice(0, 8).map(([k, v]) => (
              <ColorSwatch key={k} name={k} value={String(v)} />
            ))}
          </div>
        </div>
      )}

      {/* Wireframes — designing */}
      {Array.isArray(seniorOut.wireframes) && seniorOut.wireframes.length > 0 && (
        <div>
          <p className="text-[9px] font-black uppercase tracking-wider mb-2" style={{ color: '#a1a1aa' }}>
            Wireframes
          </p>
          <div className="space-y-1.5">
            {(seniorOut.wireframes as Array<Record<string, unknown>>).map((w, i) => (
              <div key={i} className="rounded-xl p-3" style={{ background: '#fafafa', border: '1px solid #f0f0f0' }}>
                <p className="text-[11px] font-black text-zinc-900">
                  {String(w.screen_name ?? w.screen_id ?? `Screen ${i + 1}`)}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Components — implementing/reviewing */}
      {components.length > 0 && (
        <div>
          <p className="text-[9px] font-black uppercase tracking-wider mb-2" style={{ color: '#a1a1aa' }}>
            Components ({components.length})
          </p>
          {components.slice(0, 2).map((c: Record<string, unknown>, i: number) => (
            <div key={i} className="rounded-xl overflow-hidden mb-2" style={{ border: '1px solid #f0f0f0' }}>
              <div className="flex items-center justify-between px-3 py-2" style={{ background: '#fafafa', borderBottom: '1px solid #f0f0f0' }}>
                <span className="text-[10px] font-black text-zinc-900">{String(c.name)}.tsx</span>
              </div>
              <pre className="text-[8px] font-mono p-3 overflow-x-auto max-h-32 overflow-y-auto leading-relaxed bg-white" style={{ color: '#52525b' }}>
                {String(c.tsx_code ?? '').slice(0, 500)}
              </pre>
            </div>
          ))}
        </div>
      )}

      {/* Fallback */}
      {Object.keys(scopeDoc).length === 0 && !colorPrimitives && components.length === 0 && (
        <div className="flex items-center justify-center h-40">
          <p className="text-[12px] font-medium" style={{ color: '#d4d4d8' }}>
            No preview data available yet.
          </p>
        </div>
      )}
    </div>
  );
};

// ── Main component ──────────────────────────────────────────────────────────

const CheckpointReviewView: React.FC = () => {
  const pendingConfirmation = useStore((s) => s.pendingConfirmation);
  const confirmDecision = useStore((s) => s.confirmDecision);
  const workflowPhase = useStore((s) => s.workflowPhase);

  const [showRevise, setShowRevise] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [confirmed, setConfirmed] = useState(false);

  if (!pendingConfirmation) return null;

  const handleConfirm = () => {
    setConfirmed(true);
    confirmDecision(pendingConfirmation.id, 'confirm');
  };

  const handleRevise = () => {
    if (!showRevise) {
      setShowRevise(true);
      return;
    }
    confirmDecision(pendingConfirmation.id, 'revise', feedback);
  };

  // Parse confidence from context (e.g., "Confidence: 0.74")
  const confidenceMatch = pendingConfirmation.context?.match(/[Cc]onfidence[:\s]+(\d+\.?\d*)/);
  const confidence = confidenceMatch ? parseFloat(confidenceMatch[1]) : null;
  const confidencePct = confidence !== null ? (confidence <= 1 ? confidence * 100 : confidence) : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ type: 'spring', stiffness: 380, damping: 28 }}
      className="flex flex-row h-full"
    >
      {/* Left half — preview */}
      <div className="flex-1 min-w-0" style={{ borderRight: '1px solid #f4f4f5' }}>
        <PreviewPane phase={workflowPhase} />
      </div>

      {/* Right half — report + actions */}
      <div className="flex-1 min-w-0 flex flex-col">
        <div className="flex-1 overflow-y-auto px-5 py-5">
          {/* Checkpoint badge */}
          <div className="flex items-center gap-2 mb-4">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: '#f59e0b15' }}
            >
              <ShieldCheck size={14} strokeWidth={2.5} color="#f59e0b" />
            </div>
            <span className="text-[9px] font-black uppercase tracking-widest" style={{ color: '#f59e0b' }}>
              Checkpoint Review
            </span>
          </div>

          {/* Title */}
          <h3 className="text-[16px] font-black text-zinc-900 mb-2 leading-tight">
            {pendingConfirmation.title}
          </h3>

          {/* Question */}
          <p className="text-[12px] font-medium leading-relaxed mb-4" style={{ color: '#71717a' }}>
            {pendingConfirmation.question}
          </p>

          {/* Confidence bar */}
          {confidencePct !== null && (
            <div className="mb-4">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[9px] font-black uppercase tracking-widest" style={{ color: '#a1a1aa' }}>
                  Confidence
                </span>
                <span
                  className="text-[11px] font-black tabular-nums"
                  style={{
                    color: confidencePct >= 80 ? '#22c55e' : confidencePct >= 60 ? '#f59e0b' : '#ef4444',
                  }}
                >
                  {Math.round(confidencePct)}%
                </span>
              </div>
              <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: '#f4f4f5' }}>
                <motion.div
                  className="h-full rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${confidencePct}%` }}
                  transition={{ duration: 0.8, ease: 'easeOut' }}
                  style={{
                    background: confidencePct >= 80 ? '#22c55e' : confidencePct >= 60 ? '#f59e0b' : '#ef4444',
                  }}
                />
              </div>
            </div>
          )}

          {/* Context block */}
          {pendingConfirmation.context && (
            <pre
              className="rounded-xl p-3 text-[10px] font-mono leading-relaxed mb-4 whitespace-pre-wrap overflow-x-auto"
              style={{ background: '#f9f9f9', border: '1px solid #f0f0f0', color: '#52525b' }}
            >
              {pendingConfirmation.context}
            </pre>
          )}

          {/* Revision textarea */}
          <AnimatePresence>
            {showRevise && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mb-4 overflow-hidden"
              >
                <p className="text-[9px] font-black uppercase tracking-widest mb-2" style={{ color: '#a1a1aa' }}>
                  Revision Feedback
                </p>
                <textarea
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  placeholder="Describe what should be changed..."
                  className="w-full rounded-xl px-3 py-2.5 text-[12px] font-medium placeholder:font-medium focus:outline-none resize-none transition-colors"
                  style={{ background: '#f9f9f9', border: '1.5px solid #e4e4e7', color: '#18181b' }}
                  rows={4}
                  autoFocus
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Actions — pinned to bottom */}
        <div className="shrink-0 px-5 pb-5 pt-3 flex gap-2" style={{ borderTop: '1px solid #f4f4f5' }}>
          <button
            onClick={handleConfirm}
            disabled={confirmed}
            className="flex-1 flex items-center justify-center gap-1.5 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest text-white transition-all active:scale-[0.98] disabled:opacity-50"
            style={{ background: confirmed ? '#22c55e80' : '#22c55e' }}
          >
            <CheckSquare size={11} strokeWidth={3} />
            {confirmed ? 'Approved' : 'Approve & Continue'}
          </button>
          <button
            onClick={handleRevise}
            className="flex-1 flex items-center justify-center gap-1.5 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-[0.98]"
            style={{ background: '#f4f4f5', color: '#52525b' }}
          >
            <RotateCcw size={11} strokeWidth={3} />
            {showRevise ? 'Submit Revision' : 'Request Revisions'}
          </button>
        </div>
      </div>
    </motion.div>
  );
};

export default CheckpointReviewView;
