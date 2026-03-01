import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useStore } from '../../store/useStore';
import { Loader2, CheckCircle2, Layers, Palette, GitBranch } from 'lucide-react';

// ── Agent colors ──────────────────────────────────────────────────────────────
const SENIOR_COLOR = '#22c55e';
const VISUAL_COLOR = '#EF52BA';
const MANAGER_COLOR = '#7EACEA';

// ── Data types ────────────────────────────────────────────────────────────────

interface IANode {
  key: string;
  value: string;
  depth: number;
  type?: 'bracket' | 'string' | 'number' | 'key';
}

interface TokenGroup {
  name: string;
  tokens: number;
  shades: string[];
}

// ── Fallback mock data (used when backend hasn't responded yet) ────────────────

const FALLBACK_IA_NODES: IANode[] = [
  { key: 'project', value: '"Analytics Dashboard"', depth: 0, type: 'string' },
  { key: 'pages', value: '', depth: 0, type: 'bracket' },
  { key: 'dashboard', value: '{ path: "/", components: 6 }', depth: 1 },
  { key: 'reports', value: '{ path: "/reports", components: 3 }', depth: 1 },
  { key: 'settings', value: '{ path: "/settings", components: 2 }', depth: 1 },
  { key: 'navigation', value: '', depth: 0, type: 'bracket' },
  { key: 'primary', value: '[Dashboard, Reports, Analytics, Export]', depth: 1 },
  { key: 'secondary', value: '[Settings, Help]', depth: 1 },
  { key: 'userFlows', value: '', depth: 0, type: 'bracket' },
  { key: 'onboarding', value: '{ steps: 4, modal: true }', depth: 1 },
  { key: 'data-explore', value: '{ steps: 3, filters: true }', depth: 1 },
  { key: 'wcag', value: '"AA"', depth: 0, type: 'string' },
  { key: 'components', value: '11 total', depth: 0, type: 'number' },
];

const FALLBACK_groups: TokenGroup[] = [
  { name: 'Primary', tokens: 5, shades: ['#EFF6FF', '#93C5FD', '#3B82F6', '#1D4ED8', '#1E3A8A'] },
  { name: 'Success', tokens: 4, shades: ['#F0FDF4', '#86EFAC', '#22C55E', '#15803D'] },
  { name: 'Warning', tokens: 4, shades: ['#FFFBEB', '#FCD34D', '#F59E0B', '#B45309'] },
  { name: 'Danger',  tokens: 4, shades: ['#FEF2F2', '#FCA5A5', '#EF4444', '#B91C1C'] },
  { name: 'Neutral', tokens: 6, shades: ['#F8FAFC', '#E2E8F0', '#94A3B8', '#475569', '#1E293B', '#0F172A'] },
];

// ── Backend data extractors ───────────────────────────────────────────────────

function extractIANodes(seniorOutput: Record<string, unknown>): IANode[] {
  if (!seniorOutput || Object.keys(seniorOutput).length === 0) return FALLBACK_IA_NODES;
  const nodes: IANode[] = [];
  for (const [key, value] of Object.entries(seniorOutput)) {
    if (nodes.length >= 13) break;
    if (value === null || value === undefined) continue;
    if (typeof value === 'object' && !Array.isArray(value)) {
      nodes.push({ key, value: '', depth: 0, type: 'bracket' });
      for (const [k, v] of Object.entries(value as Record<string, unknown>).slice(0, 3)) {
        const display =
          typeof v === 'string' ? `"${v}"` :
          typeof v === 'number' ? String(v) :
          Array.isArray(v) ? `[${(v as unknown[]).length} items]` : '{...}';
        nodes.push({ key: k, value: display, depth: 1 });
      }
    } else {
      const display =
        typeof value === 'string' ? `"${value}"` : String(value);
      const type: IANode['type'] =
        typeof value === 'string' ? 'string' :
        typeof value === 'number' ? 'number' : undefined;
      nodes.push({ key, value: display, depth: 0, type });
    }
  }
  return nodes.length > 0 ? nodes : FALLBACK_IA_NODES;
}

function extractTokenGroups(visualOutput: Record<string, unknown>): TokenGroup[] {
  if (!visualOutput || Object.keys(visualOutput).length === 0) return FALLBACK_groups;
  // Look for color tokens nested under common keys
  const colorSource =
    (visualOutput.design_tokens as Record<string, unknown> | undefined)?.colors ??
    (visualOutput.design_tokens as Record<string, unknown> | undefined)?.color ??
    visualOutput.colors ??
    visualOutput.color;
  if (!colorSource || typeof colorSource !== 'object') return FALLBACK_groups;
  const groups: TokenGroup[] = Object.entries(colorSource as Record<string, unknown>)
    .slice(0, 5)
    .map(([name, shades]) => {
      const shadesArr =
        typeof shades === 'object' && shades !== null
          ? Object.values(shades as Record<string, string>)
              .filter((v) => typeof v === 'string' && v.startsWith('#'))
              .slice(0, 6)
          : [];
      return { name: name.charAt(0).toUpperCase() + name.slice(1), tokens: shadesArr.length, shades: shadesArr };
    })
    .filter((g) => g.shades.length > 0);
  return groups.length > 0 ? groups : FALLBACK_groups;
}

const TYPE_SCALE = [
  { label: '2xl', size: 24, weight: 700 },
  { label: 'xl', size: 20, weight: 600 },
  { label: 'lg', size: 18, weight: 500 },
  { label: 'base', size: 16, weight: 400 },
  { label: 'sm', size: 14, weight: 400 },
  { label: 'xs', size: 12, weight: 400 },
];

function nodeValueColor(type: IANode['type']): string {
  if (type === 'string') return '#a5d6ff';
  if (type === 'number') return '#ffa657';
  return '#e2e8f0';
}

// ── Sub-components ────────────────────────────────────────────────────────────

interface CardProps {
  isWorking: boolean;
  isComplete: boolean;
  color: string;
}

const SeniorCard: React.FC<CardProps & { revealCount: number; nodes: IANode[] }> = ({
  isWorking,
  isComplete,
  color,
  revealCount,
  nodes,
}) => {
  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{
        border: `1px solid ${color}30`,
        background: `${color}06`,
      }}
    >
      {/* Card header */}
      <div
        className="flex items-center justify-between px-4 py-3"
        style={{
          borderBottom: `1px solid ${color}20`,
          background: `${color}10`,
        }}
      >
        <div className="flex items-center gap-2">
          <div
            className="flex items-center justify-center rounded-lg"
            style={{ background: `${color}20`, width: 28, height: 28 }}
          >
            <GitBranch size={13} color={color} />
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#1a1a1a' }}>
              Senior Designer
            </div>
            <div style={{ fontSize: 9.5, color: '#888', marginTop: 1 }}>
              IA &amp; Information Architecture
            </div>
          </div>
        </div>

        {isWorking && !isComplete && (
          <div className="flex items-center gap-1.5">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
            >
              <Loader2 size={12} color={color} />
            </motion.div>
            <span style={{ fontSize: 9.5, color, fontWeight: 500 }}>Working</span>
          </div>
        )}
        {isComplete && (
          <div className="flex items-center gap-1">
            <CheckCircle2 size={12} color={color} />
            <span style={{ fontSize: 9.5, color, fontWeight: 500 }}>Done</span>
          </div>
        )}
      </div>

      {/* IA JSON tree */}
      <div
        className="px-3 py-2.5 overflow-hidden"
        style={{
          fontFamily: 'ui-monospace, "Fira Code", monospace',
          fontSize: 10.5,
          lineHeight: 1.7,
          minHeight: 120,
        }}
      >
        <AnimatePresence mode="popLayout">
          {nodes.slice(0, revealCount).map((node, i) => (
            <motion.div
              key={`${node.key}-${i}`}
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.2 }}
              style={{ paddingLeft: node.depth * 14 }}
              className="flex items-baseline gap-1 flex-wrap"
            >
              <span style={{ color: '#7EACEA', fontWeight: 500 }}>{node.key}</span>
              {node.value && (
                <>
                  <span style={{ color: '#94a3b8' }}>:</span>
                  <span
                    style={{ color: nodeValueColor(node.type) }}
                  >
                    {node.value}
                  </span>
                </>
              )}
              {node.type === 'bracket' && (
                <span style={{ color: '#64748b' }}>{'{...}'}</span>
              )}
            </motion.div>
          ))}
        </AnimatePresence>

        {isWorking && !isComplete && revealCount < nodes.length && (
          <motion.div
            animate={{ opacity: [0.3, 1, 0.3] }}
            transition={{ duration: 1.2, repeat: Infinity }}
            style={{ color: '#475569', fontSize: 10 }}
          >
            …structuring
          </motion.div>
        )}

        {isComplete && revealCount >= nodes.length && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-2 flex items-center gap-1.5 rounded-lg px-2 py-1"
            style={{ background: `${SENIOR_COLOR}15`, display: 'inline-flex' }}
          >
            <CheckCircle2 size={10} color={SENIOR_COLOR} />
            <span style={{ fontSize: 9.5, color: SENIOR_COLOR }}>
              {nodes.length} nodes · 3 user flows
            </span>
          </motion.div>
        )}
      </div>
    </div>
  );
};

const VisualCard: React.FC<CardProps & { revealCount: number; groups: TokenGroup[] }> = ({
  isWorking,
  isComplete,
  color,
  revealCount,
  groups,
}) => {
  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{
        border: `1px solid ${color}30`,
        background: `${color}06`,
      }}
    >
      {/* Card header */}
      <div
        className="flex items-center justify-between px-4 py-3"
        style={{
          borderBottom: `1px solid ${color}20`,
          background: `${color}10`,
        }}
      >
        <div className="flex items-center gap-2">
          <div
            className="flex items-center justify-center rounded-lg"
            style={{ background: `${color}20`, width: 28, height: 28 }}
          >
            <Palette size={13} color={color} />
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#1a1a1a' }}>
              Visual Designer
            </div>
            <div style={{ fontSize: 9.5, color: '#888', marginTop: 1 }}>
              Design Tokens &amp; System
            </div>
          </div>
        </div>

        {isWorking && !isComplete && (
          <motion.div
            animate={{ scale: [1, 1.15, 1] }}
            transition={{ duration: 1.5, repeat: Infinity }}
            className="flex items-center gap-1.5"
          >
            <div
              className="rounded-full"
              style={{ width: 8, height: 8, background: color }}
            />
            <span style={{ fontSize: 9.5, color, fontWeight: 500 }}>Pulsing</span>
          </motion.div>
        )}
        {isComplete && (
          <div className="flex items-center gap-1">
            <CheckCircle2 size={12} color={color} />
            <span style={{ fontSize: 9.5, color, fontWeight: 500 }}>Done</span>
          </div>
        )}
      </div>

      {/* Token swatches */}
      <div className="px-3 py-2.5 space-y-2">
        <AnimatePresence mode="popLayout">
          {groups.slice(0, revealCount).map((group, i) => (
            <motion.div
              key={group.name}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: i * 0.05 }}
              className="flex items-center gap-2"
            >
              <span
                style={{
                  fontSize: 9.5,
                  color: '#888',
                  fontFamily: 'ui-monospace, monospace',
                  width: 42,
                  flexShrink: 0,
                }}
              >
                {group.name}
              </span>
              <div className="flex gap-0.5">
                {group.shades.map((hex, si) => (
                  <motion.div
                    key={hex}
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ duration: 0.2, delay: si * 0.04 }}
                    title={hex}
                    style={{
                      width: 16,
                      height: 16,
                      borderRadius: 4,
                      background: hex,
                      border: '1px solid rgba(0,0,0,0.06)',
                      flexShrink: 0,
                    }}
                  />
                ))}
              </div>
              <span
                style={{
                  fontSize: 9,
                  color: '#aaa',
                  fontFamily: 'ui-monospace, monospace',
                  marginLeft: 'auto',
                }}
              >
                {group.tokens}t
              </span>
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Type scale — shows after all palette groups */}
        <AnimatePresence>
          {revealCount >= groups.length && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              style={{
                borderTop: `1px solid ${color}20`,
                paddingTop: 8,
                marginTop: 4,
              }}
            >
              <div
                style={{
                  fontSize: 9.5,
                  color: '#888',
                  fontFamily: 'ui-monospace, monospace',
                  marginBottom: 6,
                  letterSpacing: '0.06em',
                }}
              >
                TYPE SCALE
              </div>
              <div className="flex items-end gap-1.5 flex-wrap">
                {TYPE_SCALE.map((t) => (
                  <span
                    key={t.label}
                    style={{
                      fontSize: Math.max(t.size * 0.42, 9),
                      fontWeight: t.weight,
                      color: '#374151',
                      lineHeight: 1,
                    }}
                  >
                    Ag
                  </span>
                ))}
              </div>
              <div className="flex items-center gap-1 mt-2">
                {TYPE_SCALE.map((t) => (
                  <span
                    key={t.label}
                    style={{
                      fontSize: 8.5,
                      color: '#9ca3af',
                      fontFamily: 'ui-monospace, monospace',
                    }}
                  >
                    {t.label}
                  </span>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {isComplete && revealCount >= groups.length && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center gap-1.5 rounded-lg px-2 py-1 mt-1"
            style={{ background: `${VISUAL_COLOR}15`, display: 'inline-flex' }}
          >
            <CheckCircle2 size={10} color={VISUAL_COLOR} />
            <span style={{ fontSize: 9.5, color: VISUAL_COLOR }}>
              34 tokens exported
            </span>
          </motion.div>
        )}
      </div>
    </div>
  );
};

// ── Main component ────────────────────────────────────────────────────────────

const DesignPhaseView: React.FC = () => {
  const agentStates = useStore((s) => s.agentStates);
  const designOutputs = useStore((s) => s.designOutputs);
  const seniorState = agentStates[1];
  const visualState = agentStates[3];

  const seniorWorking = seniorState?.status === 'working' || seniorState?.status === 'reviewing';
  const seniorDone = seniorState?.status === 'complete' || seniorState?.status === 'done';
  const visualWorking = visualState?.status === 'working' || visualState?.status === 'reviewing';
  const visualDone = visualState?.status === 'complete' || visualState?.status === 'done';

  // Derive display data — real backend output when available, fallback otherwise
  const iaNodes = extractIANodes(
    (designOutputs?.senior_output ?? {}) as Record<string, unknown>,
  );
  const tokenGroups = extractTokenGroups(
    (designOutputs?.visual_output ?? {}) as Record<string, unknown>,
  );

  const [seniorReveal, setSeniorReveal] = useState(0);
  const [visualReveal, setVisualReveal] = useState(0);

  // Stagger Senior items
  useEffect(() => {
    if ((seniorWorking || seniorDone) && seniorReveal < iaNodes.length) {
      const t = setTimeout(
        () => setSeniorReveal((c) => Math.min(c + 1, iaNodes.length)),
        seniorDone ? 80 : 400,
      );
      return () => clearTimeout(t);
    }
  }, [seniorReveal, seniorWorking, seniorDone, iaNodes.length]);

  // Stagger Visual items
  useEffect(() => {
    if ((visualWorking || visualDone) && visualReveal < tokenGroups.length + 1) {
      const t = setTimeout(
        () => setVisualReveal((c) => Math.min(c + 1, tokenGroups.length + 1)),
        visualDone ? 100 : 550,
      );
      return () => clearTimeout(t);
    }
  }, [visualReveal, visualWorking, visualDone, tokenGroups.length]);

  const activeCount = [seniorWorking, visualWorking].filter(Boolean).length;

  return (
    <motion.div
      className="h-full overflow-y-auto"
      style={{ background: '#fafafa' }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="p-4 space-y-3">
        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between">
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#111' }}>
              Design Phase
            </div>
            <div style={{ fontSize: 11, color: '#888', marginTop: 1 }}>
              Parallel execution — Senior &amp; Visual
            </div>
          </div>

          {activeCount > 0 && (
            <div
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full"
              style={{
                background: `${MANAGER_COLOR}15`,
                border: `1px solid ${MANAGER_COLOR}30`,
              }}
            >
              <motion.div
                animate={{ scale: [1, 1.3, 1] }}
                transition={{ duration: 1.8, repeat: Infinity }}
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: MANAGER_COLOR,
                }}
              />
              <span style={{ fontSize: 9.5, color: MANAGER_COLOR, fontWeight: 600 }}>
                {activeCount} agent{activeCount > 1 ? 's' : ''} running
              </span>
            </div>
          )}
        </div>

        {/* ── Parallelism indicator ────────────────────────────────────────── */}
        {(seniorWorking || visualWorking) && !(seniorDone && visualDone) && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-stretch rounded-xl overflow-hidden"
            style={{ border: '1px solid rgba(0,0,0,0.06)', height: 4 }}
          >
            <motion.div
              style={{
                background: `linear-gradient(90deg, ${SENIOR_COLOR}, ${SENIOR_COLOR}88)`,
                flex: 1,
              }}
              animate={{ opacity: seniorDone ? 0.4 : [0.7, 1, 0.7] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            />
            <div style={{ width: 1, background: '#fff' }} />
            <motion.div
              style={{
                background: `linear-gradient(90deg, ${VISUAL_COLOR}88, ${VISUAL_COLOR})`,
                flex: 1,
              }}
              animate={{ opacity: visualDone ? 0.4 : [0.7, 1, 0.7] }}
              transition={{ duration: 1.5, repeat: Infinity, delay: 0.3 }}
            />
          </motion.div>
        )}

        {/* ── Senior card ──────────────────────────────────────────────────── */}
        <SeniorCard
          isWorking={seniorWorking}
          isComplete={seniorDone}
          color={SENIOR_COLOR}
          revealCount={seniorReveal}
          nodes={iaNodes}
        />

        {/* ── Visual card ──────────────────────────────────────────────────── */}
        <VisualCard
          isWorking={visualWorking}
          isComplete={visualDone}
          color={VISUAL_COLOR}
          revealCount={visualReveal}
          groups={tokenGroups}
        />

        {/* ── Completion summary ───────────────────────────────────────────── */}
        <AnimatePresence>
          {seniorDone && visualDone && (
            <motion.div
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="rounded-2xl px-4 py-3 flex items-center gap-3"
              style={{
                background: 'linear-gradient(135deg, #f0fdf4, #fdf2fb)',
                border: '1px solid rgba(34,197,94,0.2)',
              }}
            >
              <div
                className="flex items-center justify-center rounded-xl shrink-0"
                style={{ width: 32, height: 32, background: '#22c55e20' }}
              >
                <Layers size={14} color={SENIOR_COLOR} />
              </div>
              <div>
                <div style={{ fontSize: 11.5, fontWeight: 700, color: '#111' }}>
                  Round 1 Complete
                </div>
                <div style={{ fontSize: 10, color: '#555', marginTop: 1 }}>
                  IA specs · 34 tokens · 3 flows — awaiting manager review
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};

export default DesignPhaseView;
