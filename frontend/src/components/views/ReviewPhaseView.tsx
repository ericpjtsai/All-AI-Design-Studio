import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useStore } from '../../store/useStore';
import {
  CheckCircle2,
  ShieldAlert,
  Zap,
  GitMerge,
  Palette,
  Code2,
} from 'lucide-react';

// ── Agent definitions ─────────────────────────────────────────────────────────

const AGENTS = [
  { id: 'senior' as const, label: 'Senior', role: 'Change Structure', color: '#22c55e', Icon: GitMerge },
  { id: 'visual' as const, label: 'Visual', role: 'Change Style', color: '#EF52BA', Icon: Palette },
  { id: 'junior' as const, label: 'Junior', role: 'Change Code', color: '#ef4444', Icon: Code2 },
];

type AgentTarget = 'senior' | 'visual' | 'junior';


// ── Dashboard wireframe SVG ───────────────────────────────────────────────────

const DashboardWireframe: React.FC = () => (
  <svg
    viewBox="0 0 200 130"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    style={{ width: '100%', height: 'auto', display: 'block' }}
  >
    {/* Sidebar */}
    <rect x="0" y="0" width="36" height="130" rx="3" fill="#f1f5f9" />
    <rect x="6" y="10" width="24" height="6" rx="2" fill="#3b82f620" />
    <rect x="6" y="22" width="18" height="4" rx="2" fill="#cbd5e1" />
    <rect x="6" y="31" width="20" height="4" rx="2" fill="#e2e8f0" />
    <rect x="6" y="40" width="16" height="4" rx="2" fill="#e2e8f0" />
    <rect x="6" y="49" width="22" height="4" rx="2" fill="#e2e8f0" />
    {/* Sidebar accent */}
    <rect x="0" y="22" width="3" height="13" rx="1.5" fill="#3b82f6" />

    {/* Header */}
    <rect x="42" y="0" width="158" height="20" rx="3" fill="#f8fafc" />
    <rect x="48" y="6" width="36" height="8" rx="2" fill="#e2e8f0" />
    <circle cx="191" cy="10" r="5" fill="#cbd5e1" />

    {/* Metric cards row */}
    <rect x="42" y="26" width="46" height="32" rx="3" fill="#eff6ff" />
    <rect x="95" y="26" width="46" height="32" rx="3" fill="#f0fdf4" />
    <rect x="148" y="26" width="52" height="32" rx="3" fill="#fff7ed" />
    {/* Card labels */}
    <rect x="48" y="31" width="24" height="4" rx="2" fill="#bfdbfe" />
    <rect x="48" y="40" width="18" height="7" rx="2" fill="#3b82f6" opacity="0.7" />
    <rect x="101" y="31" width="24" height="4" rx="2" fill="#bbf7d0" />
    <rect x="101" y="40" width="18" height="7" rx="2" fill="#22c55e" opacity="0.7" />
    <rect x="154" y="31" width="24" height="4" rx="2" fill="#fed7aa" />
    <rect x="154" y="40" width="18" height="7" rx="2" fill="#f59e0b" opacity="0.7" />

    {/* Chart */}
    <rect x="42" y="64" width="98" height="58" rx="3" fill="#f8fafc" />
    <rect x="48" y="70" width="30" height="5" rx="2" fill="#e2e8f0" />
    {/* Chart bars */}
    {[
      [54, 22, '#3b82f660'],
      [66, 30, '#3b82f680'],
      [78, 18, '#3b82f670'],
      [90, 35, '#3b82f6'],
      [102, 26, '#3b82f688'],
      [114, 38, '#3b82f6aa'],
    ].map(([x, h, fill], i) => (
      <rect
        key={i}
        x={x as number}
        y={122 - (h as number)}
        width={8}
        height={h as number}
        rx="2"
        fill={fill as string}
      />
    ))}
    <line x1="48" y1="122" x2="130" y2="122" stroke="#e2e8f0" strokeWidth="0.5" />

    {/* Data table */}
    <rect x="148" y="64" width="52" height="58" rx="3" fill="#f8fafc" />
    <rect x="153" y="70" width="42" height="5" rx="2" fill="#e2e8f0" />
    {[78, 87, 96, 105, 114].map((y, i) => (
      <React.Fragment key={i}>
        <rect x="153" y={y} width={i % 2 === 0 ? 42 : 30} height="3" rx="1" fill="#f1f5f9" />
      </React.Fragment>
    ))}
  </svg>
);

// ── Helpers ───────────────────────────────────────────────────────────────────

function readScore(review: Record<string, unknown>, key: string, fallback: number): number {
  const v = review[key];
  return typeof v === 'number' ? Math.min(10, Math.max(0, Math.round(v))) : fallback;
}

function parseCtxInt(ctx: string | undefined, re: RegExp): number | null {
  if (!ctx) return null;
  const m = ctx.match(re);
  return m ? parseInt(m[1], 10) : null;
}

function parseCtxFloat(ctx: string | undefined, re: RegExp): number | null {
  if (!ctx) return null;
  const m = ctx.match(re);
  return m ? parseFloat(m[1]) : null;
}

function countLeafNodes(obj: unknown): number {
  if (typeof obj !== 'object' || obj === null) return 1;
  return Object.values(obj as Record<string, unknown>).reduce<number>(
    (sum, v) => sum + countLeafNodes(v),
    0,
  );
}

// ── Score bar ─────────────────────────────────────────────────────────────────

const ScoreBar: React.FC<{ label: string; score: number }> = ({ label, score }) => (
  <div>
    <div className="flex justify-between items-center mb-1">
      <span style={{ fontSize: 10, color: '#666' }}>{label}</span>
      <span
        style={{
          fontSize: 10,
          fontWeight: 700,
          color: score >= 9 ? '#22c55e' : score >= 7 ? '#f59e0b' : '#ef4444',
          fontFamily: 'ui-monospace, monospace',
        }}
      >
        {score}/10
      </span>
    </div>
    <div className="rounded-full overflow-hidden" style={{ height: 3, background: '#f1f5f9' }}>
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${score * 10}%` }}
        transition={{ duration: 0.6, delay: 0.2 }}
        style={{
          height: '100%',
          borderRadius: 9999,
          background: score >= 9 ? '#22c55e' : score >= 7 ? '#f59e0b' : '#ef4444',
        }}
      />
    </div>
  </div>
);

// ── Main component ────────────────────────────────────────────────────────────

const ReviewPhaseView: React.FC = () => {
  const pendingConfirmation = useStore((s) => s.pendingConfirmation);
  const confirmDecision = useStore((s) => s.confirmDecision);
  const designOutputs = useStore((s) => s.designOutputs);

  const [selectedTarget, setSelectedTarget] = useState<AgentTarget>('junior');
  const [instruction, setInstruction] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Use real review scores from backend, fall back to sensible defaults
  const review = (designOutputs?.review ?? {}) as Record<string, unknown>;
  const qualityScores = [
    { label: 'Scope Alignment', score: readScore(review, 'scope_alignment', 9) },
    { label: 'Completeness',    score: readScore(review, 'completeness', 9) },
    { label: 'Coherence',       score: readScore(review, 'coherence', 8) },
    { label: 'Prod. Ready',     score: readScore(review, 'production_readiness', 8) },
  ];
  const ctx = pendingConfirmation?.context;

  const overallScore =
    typeof review.overall_score === 'number'
      ? (Math.round((review.overall_score as number) * 10) / 10).toFixed(1)
      : parseCtxFloat(ctx, /[Oo]verall\s+score:\s*([\d.]+)/i)?.toFixed(1)
      ?? '8.5';

  // Deliverable counts — parse from context string first, fall back to outputs
  const rawCode = designOutputs?.junior_output?.react_code;
  const componentCode = typeof rawCode === 'string' ? rawCode : null;
  const componentCount =
    parseCtxInt(ctx, /(\d+)\s+React\s+component/i) ??
    (componentCode
      ? (componentCode.match(/^export\s+(const|default|function)/gm) ?? []).length
      : null);

  const rawTokens = designOutputs?.visual_output?.design_tokens;
  const tokenCount =
    parseCtxInt(ctx, /(\d+)\s+(?:design\s+)?tokens?/i) ??
    (rawTokens && typeof rawTokens === 'object' ? countLeafNodes(rawTokens) : null);

  const flowCount = parseCtxInt(ctx, /(\d+)\s+flows?/i);
  const nodeCount = parseCtxInt(ctx, /(\d+)\s+nodes?/i);

  const deliverables = [
    {
      icon: Code2,
      label: componentCount != null
        ? `${componentCount} Component${componentCount === 1 ? '' : 's'}`
        : 'Components',
      detail: 'TypeScript · TSX',
      color: '#ef4444',
    },
    {
      icon: Palette,
      label: tokenCount != null ? `${tokenCount} Tokens` : 'Design Tokens',
      detail: 'CSS · Figma',
      color: '#EF52BA',
    },
    {
      icon: GitMerge,
      label: 'IA Specs',
      detail: flowCount != null && nodeCount != null
        ? `${flowCount} flows · ${nodeCount} nodes`
        : 'Flows & Nodes',
      color: '#22c55e',
    },
  ];

  // Confidence — backend review field > context string > derived from scores
  const rawConf = review.human_alignment_confidence;
  const confidence =
    (typeof rawConf === 'number' ? rawConf : null) ??
    parseCtxFloat(ctx, /Confidence:\s*([\d.]+)/i) ??
    qualityScores.reduce((s, q) => s + q.score, 0) / (qualityScores.length * 10);
  const confBars = Math.round(Math.min(1, Math.max(0, confidence)) * 10);
  const confDisplay = confidence.toFixed(2);

  const handleApprove = () => {
    if (!pendingConfirmation) return;
    setIsSubmitting(true);
    confirmDecision(pendingConfirmation.id, 'confirm');
  };

  const handleOverride = () => {
    if (!pendingConfirmation || !instruction.trim()) return;
    const targetLabel = AGENTS.find((a) => a.id === selectedTarget)?.label ?? selectedTarget;
    const feedback = `[${targetLabel.toUpperCase()}] ${instruction.trim()}`;
    setIsSubmitting(true);
    confirmDecision(pendingConfirmation.id, 'revise', feedback);
  };

  return (
    <motion.div
      className="h-full overflow-y-auto"
      style={{ background: '#fafafa' }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="p-4 space-y-3"
      >
            {/* ── Header ────────────────────────────────────────────────────── */}
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#111' }}>
                {pendingConfirmation?.title ?? 'Final Review'}
              </div>
              <div style={{ fontSize: 11, color: '#888', marginTop: 1 }}>
                Manager review complete · Awaiting your approval
              </div>
            </div>

            {/* ── Deliverables row ─────────────────────────────────────────── */}
            <div className="grid grid-cols-3 gap-2">
              {deliverables.map(({ icon: Icon, label, detail, color }) => (
                <div
                  key={label}
                  className="rounded-xl p-2.5 text-center"
                  style={{
                    background: `${color}08`,
                    border: `1px solid ${color}20`,
                  }}
                >
                  <div
                    className="flex items-center justify-center mx-auto mb-1.5 rounded-lg"
                    style={{ width: 26, height: 26, background: `${color}18` }}
                  >
                    <Icon size={12} color={color} />
                  </div>
                  <div style={{ fontSize: 10.5, fontWeight: 600, color: '#1a1a1a' }}>
                    {label}
                  </div>
                  <div style={{ fontSize: 9, color: '#999', marginTop: 1 }}>{detail}</div>
                </div>
              ))}
            </div>

            {/* ── Split view: wireframe + scores ───────────────────────────── */}
            <div className="grid grid-cols-2 gap-2">
              {/* Left: wireframe preview */}
              <div
                className="rounded-xl p-2 overflow-hidden"
                style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.07)' }}
              >
                <div
                  style={{ fontSize: 9, color: '#aaa', marginBottom: 5, letterSpacing: '0.06em' }}
                >
                  PREVIEW
                </div>
                <DashboardWireframe />
              </div>

              {/* Right: quality scores */}
              <div
                className="rounded-xl p-2.5 space-y-2"
                style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.07)' }}
              >
                <div
                  style={{ fontSize: 9, color: '#aaa', marginBottom: 5, letterSpacing: '0.06em' }}
                >
                  QUALITY
                </div>
                {qualityScores.map((s) => (
                  <ScoreBar key={s.label} label={s.label} score={s.score} />
                ))}
                <div
                  className="flex items-center justify-between pt-1"
                  style={{ borderTop: '1px solid #f1f5f9' }}
                >
                  <span style={{ fontSize: 9.5, color: '#666' }}>Overall</span>
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 800,
                      color: '#111',
                      fontFamily: 'ui-monospace, monospace',
                    }}
                  >
                    {overallScore}
                    <span style={{ fontSize: 9, color: '#999', fontWeight: 500 }}>/10</span>
                  </span>
                </div>
              </div>
            </div>

            {/* ── Divider ───────────────────────────────────────────────────── */}
            <div
              style={{
                height: 1,
                background: 'linear-gradient(90deg, transparent, #e2e8f0, transparent)',
                margin: '4px 0',
              }}
            />

            {/* ── APPROVE button ────────────────────────────────────────────── */}
            <motion.button
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleApprove}
              disabled={isSubmitting}
              className="w-full flex items-center justify-center gap-2 rounded-2xl py-3.5"
              style={{
                background: 'linear-gradient(135deg, #16a34a, #15803d)',
                color: '#fff',
                fontSize: 13,
                fontWeight: 700,
                border: 'none',
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                opacity: isSubmitting ? 0.6 : 1,
                boxShadow: '0 4px 20px #22c55e30',
                letterSpacing: '0.01em',
              }}
            >
              <CheckCircle2 size={16} />
              Approve &amp; Package
            </motion.button>

            {/* ── God Mode section ──────────────────────────────────────────── */}
            <div
              className="rounded-2xl overflow-hidden"
              style={{ border: '1px solid #fca5a540', background: '#fff5f520' }}
            >
              {/* God mode header */}
              <div
                className="flex items-center gap-2 px-3.5 py-2.5"
                style={{ borderBottom: '1px solid #fca5a530' }}
              >
                <div
                  className="flex items-center justify-center rounded-lg"
                  style={{ width: 24, height: 24, background: '#ef444415' }}
                >
                  <Zap size={12} color="#ef4444" />
                </div>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#991b1b' }}>
                  God Mode Override
                </span>
                <div
                  className="ml-auto px-2 py-0.5 rounded-full"
                  style={{ background: '#ef444410', border: '1px solid #ef444420' }}
                >
                  <span style={{ fontSize: 9, color: '#ef4444', fontWeight: 600 }}>
                    FORCE REVISE
                  </span>
                </div>
              </div>

              <div className="p-3 space-y-3">
                {/* Target agent selector */}
                <div>
                  <div style={{ fontSize: 10, color: '#888', marginBottom: 6 }}>
                    Target agent
                  </div>
                  <div className="grid grid-cols-3 gap-1.5">
                    {AGENTS.map(({ id, label, role, color, Icon }) => {
                      const isSelected = selectedTarget === id;
                      return (
                        <motion.button
                          key={id}
                          whileTap={{ scale: 0.96 }}
                          onClick={() => setSelectedTarget(id)}
                          className="flex flex-col items-center gap-1 rounded-xl py-2.5 px-1"
                          style={{
                            background: isSelected ? `${color}15` : '#f8f8f8',
                            border: `1.5px solid ${isSelected ? color + '50' : 'transparent'}`,
                            cursor: 'pointer',
                            transition: 'all 0.15s',
                          }}
                        >
                          <div
                            className="flex items-center justify-center rounded-lg"
                            style={{
                              width: 26,
                              height: 26,
                              background: isSelected ? `${color}20` : '#ebebeb',
                            }}
                          >
                            <Icon size={12} color={isSelected ? color : '#999'} />
                          </div>
                          <span
                            style={{
                              fontSize: 9.5,
                              fontWeight: isSelected ? 700 : 500,
                              color: isSelected ? color : '#888',
                              textAlign: 'center',
                              lineHeight: 1.2,
                            }}
                          >
                            {label}
                          </span>
                          <span
                            style={{ fontSize: 8, color: '#bbb', textAlign: 'center' }}
                          >
                            {role}
                          </span>
                        </motion.button>
                      );
                    })}
                  </div>
                </div>

                {/* Instruction textarea */}
                <div>
                  <div style={{ fontSize: 10, color: '#888', marginBottom: 6 }}>
                    Override instruction
                  </div>
                  <textarea
                    value={instruction}
                    onChange={(e) => setInstruction(e.target.value)}
                    placeholder={
                      selectedTarget === 'senior'
                        ? 'e.g. Add a notifications page to the IA…'
                        : selectedTarget === 'visual'
                          ? 'e.g. Change primary color to indigo palette…'
                          : 'e.g. Add error boundary to MetricCard component…'
                    }
                    rows={3}
                    className="w-full resize-none rounded-xl outline-none"
                    style={{
                      background: '#fff',
                      border: '1px solid #e5e7eb',
                      padding: '8px 10px',
                      fontSize: 11,
                      color: '#374151',
                      lineHeight: 1.5,
                      fontFamily: 'inherit',
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.border = '1px solid #ef444460';
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.border = '1px solid #e5e7eb';
                    }}
                  />
                </div>

                {/* Force override button */}
                <motion.button
                  whileHover={{ scale: instruction.trim() ? 1.01 : 1 }}
                  whileTap={{ scale: instruction.trim() ? 0.98 : 1 }}
                  onClick={handleOverride}
                  disabled={!instruction.trim() || isSubmitting}
                  className="w-full flex items-center justify-center gap-2 rounded-xl py-2.5"
                  style={{
                    background: instruction.trim()
                      ? 'linear-gradient(135deg, #dc2626, #b91c1c)'
                      : '#f3f4f6',
                    color: instruction.trim() ? '#fff' : '#bbb',
                    fontSize: 12,
                    fontWeight: 700,
                    border: 'none',
                    cursor: instruction.trim() && !isSubmitting ? 'pointer' : 'not-allowed',
                    boxShadow: instruction.trim() ? '0 4px 16px #ef444430' : 'none',
                    transition: 'all 0.2s',
                  }}
                >
                  <ShieldAlert size={14} />
                  Reject &amp; Force Override
                </motion.button>
              </div>
            </div>

            {/* ── Confidence indicator ─────────────────────────────────────── */}
            <div
              className="flex items-center justify-between px-3 py-2 rounded-xl"
              style={{ background: '#f8fafc', border: '1px solid #f1f5f9' }}
            >
              <div className="flex items-center gap-2">
                <div
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: '#7EACEA',
                  }}
                />
                <span style={{ fontSize: 10, color: '#666' }}>
                  Manager confidence
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex gap-0.5">
                  {[...Array(10)].map((_, i) => (
                    <div
                      key={i}
                      style={{
                        width: 4,
                        height: 10,
                        borderRadius: 2,
                        background: i < confBars ? '#7EACEA' : '#e2e8f0',
                      }}
                    />
                  ))}
                </div>
                <span
                  style={{
                    fontSize: 10.5,
                    fontWeight: 700,
                    color: '#7EACEA',
                    fontFamily: 'ui-monospace, monospace',
                  }}
                >
                  {confDisplay}
                </span>
              </div>
            </div>
      </motion.div>
    </motion.div>
  );
};

export default ReviewPhaseView;
