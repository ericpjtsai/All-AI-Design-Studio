import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useStore } from '../../store/useStore';
import { Loader2, CheckCircle2, Layers, Palette, GitBranch, ChevronDown } from 'lucide-react';

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


// ── Backend data extractors ───────────────────────────────────────────────────

function extractIANodes(seniorOutput: Record<string, unknown>): IANode[] {
  if (!seniorOutput || Object.keys(seniorOutput).length === 0) return [];

  type IAChild = { label?: string; children?: IAChild[] };
  type IARoot  = { label?: string; children?: IAChild[] };

  const iaMap = seniorOutput.ia_map as { root?: IARoot } | undefined;
  const flows = seniorOutput.user_flows as Array<{ id?: string; title?: string }> | undefined;
  const wireframes = seniorOutput.wireframes as Array<{ screen_name?: string }> | undefined;
  const specs = seniorOutput.interaction_specs as Record<string, unknown> | undefined;

  // Nothing useful — fall back
  if (!iaMap?.root && !Array.isArray(flows) && !Array.isArray(wireframes)) {
    return [];
  }

  const nodes: IANode[] = [];

  // ── ia_map root label → project name
  if (iaMap?.root?.label) {
    nodes.push({ key: 'project', value: `"${iaMap.root.label}"`, depth: 0, type: 'string' });
  }

  // ── ia_map children → pages / sections
  const children = iaMap?.root?.children ?? [];
  if (children.length > 0) {
    nodes.push({ key: 'pages', value: '', depth: 0, type: 'bracket' });
    for (const child of children.slice(0, 4)) {
      const sub = child.children ?? [];
      const val = sub.length > 0
        ? `{ path: "/${String(child.label ?? '').toLowerCase().replace(/\s+/g, '-')}", sections: ${sub.length} }`
        : `{ path: "/${String(child.label ?? '').toLowerCase().replace(/\s+/g, '-')}" }`;
      nodes.push({ key: String(child.label ?? 'page'), value: val, depth: 1 });
    }
  }

  // ── user_flows
  if (Array.isArray(flows) && flows.length > 0) {
    nodes.push({ key: 'userFlows', value: '', depth: 0, type: 'bracket' });
    for (const flow of flows.slice(0, 3)) {
      nodes.push({ key: String(flow.title ?? flow.id ?? 'flow'), value: '{ steps: ... }', depth: 1 });
    }
  }

  // ── wireframes count
  if (Array.isArray(wireframes) && wireframes.length > 0) {
    nodes.push({ key: 'screens', value: `${wireframes.length} total`, depth: 0, type: 'number' });
  }

  // ── interaction_specs component count
  if (specs && typeof specs === 'object') {
    const count = Object.keys(specs).length;
    nodes.push({ key: 'components', value: `${count} total`, depth: 0, type: 'number' });
  }

  return nodes;
}

// Accepts hex, rgb(), rgba(), hsl(), hsla() — or Style Dictionary {value: "..."} wrappers
const CSS_COLOR_RE = /^(#[0-9a-fA-F]{3,8}|rgba?\s*\(|hsla?\s*\(|color\s*\()/i;

function isCssColor(v: unknown): v is string {
  return typeof v === 'string' && CSS_COLOR_RE.test(v.trim());
}

function resolveColor(v: unknown): string | null {
  if (isCssColor(v)) return (v as string).trim();
  if (typeof v === 'object' && v !== null) {
    const obj = v as Record<string, unknown>;
    if (isCssColor(obj.value)) return (obj.value as string).trim();
    if (isCssColor(obj.$value)) return (obj.$value as string).trim();
    if (isCssColor(obj.hex)) return (obj.hex as string).trim();
  }
  return null;
}

/** Recursively collect all CSS color strings from an arbitrary nested object. */
function collectColors(obj: unknown, depth = 0): string[] {
  if (depth > 4 || !obj || typeof obj !== 'object') return [];
  const colors: string[] = [];
  for (const v of Object.values(obj as Record<string, unknown>)) {
    const resolved = resolveColor(v);
    if (resolved) {
      colors.push(resolved);
    } else if (typeof v === 'object' && v !== null) {
      colors.push(...collectColors(v, depth + 1));
    }
  }
  return colors;
}

function extractTokenGroups(visualOutput: Record<string, unknown>): TokenGroup[] {
  if (!visualOutput || Object.keys(visualOutput).length === 0) return [];

  const designTokens = visualOutput.design_tokens as Record<string, unknown> | undefined;
  const colorObj = designTokens?.color as Record<string, unknown> | undefined;

  // Try well-known nesting paths first, then fall back to broader search
  const colorSource: Record<string, unknown> | undefined =
    (colorObj?.primitive as Record<string, unknown> | undefined) ??
    (colorObj?.palette   as Record<string, unknown> | undefined) ??
    (colorObj?.colors    as Record<string, unknown> | undefined) ??
    colorObj ??
    (designTokens?.colors as Record<string, unknown> | undefined) ??
    (visualOutput.colors  as Record<string, unknown> | undefined);

  let groups: TokenGroup[] = [];

  if (colorSource && typeof colorSource === 'object') {
    groups = Object.entries(colorSource)
      .slice(0, 6)
      .map(([name, shades]) => {
        let shadesArr: string[];
        if (typeof shades === 'object' && shades !== null) {
          shadesArr = Object.values(shades as Record<string, unknown>)
            .map(resolveColor)
            .filter((x): x is string => x !== null)
            .slice(0, 7);
        } else {
          const single = resolveColor(shades);
          shadesArr = single ? [single] : [];
        }
        return { name: name.charAt(0).toUpperCase() + name.slice(1), tokens: shadesArr.length, shades: shadesArr };
      })
      .filter((g) => g.shades.length > 0);
  }

  // Deep-search fallback: if we still have nothing, find any color values in the output
  if (groups.length === 0) {
    const allColors = [...new Set(collectColors(visualOutput))].slice(0, 18);
    if (allColors.length > 0) {
      // Group into chunks of ~6 to simulate palette groups
      const chunkSize = 6;
      for (let i = 0; i < allColors.length && groups.length < 3; i += chunkSize) {
        const chunk = allColors.slice(i, i + chunkSize);
        groups.push({ name: i === 0 ? 'Palette' : `Set ${i / chunkSize + 1}`, tokens: chunk.length, shades: chunk });
      }
    }
  }

  return groups;
}

/** Count all leaf values inside an arbitrary nested object (design_tokens tree). */
function countTokenLeaves(obj: unknown, depth = 0): number {
  if (depth > 6 || obj === null || obj === undefined) return 0;
  if (typeof obj !== 'object') return 1;
  const vals = Object.values(obj as Record<string, unknown>);
  if (vals.length === 0) return 0;
  return vals.reduce((sum: number, v) => sum + countTokenLeaves(v, depth + 1), 0);
}

interface TypeScaleItem { label: string; size: number; weight: number; }

const WEIGHT_MAP: Record<string, number> = {
  '3xl': 700, '2xl': 700, 'xl': 600, 'lg': 500, 'base': 400, 'sm': 400, 'xs': 400,
};

function extractTypeScale(visualOutput: Record<string, unknown>): TypeScaleItem[] {
  const designTokens = visualOutput.design_tokens as Record<string, unknown> | undefined;

  // Try multiple paths for typography/fontSize
  const typo =
    (designTokens?.typography as Record<string, unknown> | undefined) ??
    (visualOutput.typography  as Record<string, unknown> | undefined);

  const fontSize: Record<string, unknown> | undefined =
    (typo?.fontSize   as Record<string, unknown> | undefined) ??
    (typo?.font_size  as Record<string, unknown> | undefined) ??
    (typo?.sizes      as Record<string, unknown> | undefined) ??
    (typo?.scale      as Record<string, unknown> | undefined);

  if (!fontSize || typeof fontSize !== 'object') return [];

  const items = Object.entries(fontSize)
    .map(([label, sizeVal]) => {
      // Accept "16px", "1rem", 16, "16", {value: "16px"}, etc.
      let raw = '';
      if (typeof sizeVal === 'object' && sizeVal !== null) {
        const obj = sizeVal as Record<string, unknown>;
        const inner = obj.value ?? obj.$value;
        raw = typeof inner === 'string' || typeof inner === 'number' ? String(inner) : '';
      } else if (typeof sizeVal === 'string' || typeof sizeVal === 'number') {
        raw = String(sizeVal);
      }
      const px = Number.parseFloat(raw) * (raw.includes('rem') ? 16 : 1);
      return { label, size: Number.isNaN(px) || px <= 0 ? 0 : Math.round(px), weight: WEIGHT_MAP[label] ?? 400 };
    })
    .filter((t) => t.size > 0)
    .sort((a, b) => b.size - a.size)
    .slice(0, 6);

  return items;
}

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

const SeniorCard: React.FC<CardProps & {
  revealCount: number;
  nodes: IANode[];
  flowCount: number;
  seniorOutput: Record<string, unknown>;
}> = ({ isWorking, isComplete, color, revealCount, nodes, flowCount, seniorOutput }) => {
  const [expanded, setExpanded] = useState(false);

  const flows = seniorOutput.user_flows as Array<{ id?: string; title?: string; steps?: string[] }> | undefined;
  const wireframes = seniorOutput.wireframes as Array<{ screen_id?: string; screen_name?: string }> | undefined;
  const specs = seniorOutput.interaction_specs as Record<string, string> | undefined;
  const handoff = seniorOutput.handoff_notes as string | undefined;

  const canExpand = isComplete && (
    (Array.isArray(flows) && flows.length > 0) ||
    (Array.isArray(wireframes) && wireframes.length > 0)
  );

  const firstFlow = Array.isArray(flows) && flows.length > 0 ? flows[0] : null;
  const pipelineSteps = Array.isArray(firstFlow?.steps) ? firstFlow!.steps.slice(0, 5) : [];
  const screenCount = Array.isArray(wireframes) ? wireframes.length : 0;
  const specCount = specs ? Object.keys(specs).length : 0;

  const cardShadow = isWorking && !isComplete
    ? `0 0 0 1.5px ${color}38, 0 4px 20px ${color}16, 0 1px 3px rgba(0,0,0,0.06)`
    : `0 2px 10px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.04)`;

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ background: '#fff', boxShadow: cardShadow, transition: 'box-shadow 0.4s ease' }}
    >
      {/* Colored top stripe */}
      <div style={{ height: 3, background: `linear-gradient(90deg, ${color}, ${color}70, transparent)` }} />

      {/* Card header */}
      <div
        className="flex items-center justify-between px-4 py-3"
        style={{ borderBottom: '1px solid rgba(0,0,0,0.05)' }}
      >
        <div className="flex items-center gap-2.5">
          <div
            className="flex items-center justify-center rounded-full"
            style={{
              background: isWorking || isComplete ? `${color}14` : '#f4f5f7',
              width: 30, height: 30,
              border: `1px solid ${isWorking || isComplete ? `${color}28` : 'rgba(0,0,0,0.07)'}`,
            }}
          >
            <GitBranch size={13} color={isWorking || isComplete ? color : '#9ca3af'} />
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#111', letterSpacing: '-0.01em' }}>Senior Designer</div>
            <div style={{ fontSize: 9.5, color: '#b0b8c8', marginTop: 1 }}>UX · IA · Information Architecture</div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isWorking && !isComplete && (
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full" style={{ background: `${color}10`, border: `1px solid ${color}22` }}>
              <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}>
                <Loader2 size={9} color={color} />
              </motion.div>
              <span style={{ fontSize: 9, color, fontWeight: 600, letterSpacing: '0.05em' }}>WORKING</span>
            </div>
          )}
          {isComplete && (
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-full" style={{ background: `${color}10` }}>
              <CheckCircle2 size={9} color={color} />
              <span style={{ fontSize: 9, color, fontWeight: 600, letterSpacing: '0.05em' }}>DONE</span>
            </div>
          )}
        </div>
      </div>

      {/* Flow Pipeline — first flow steps as connected pills */}
      <AnimatePresence>
        {pipelineSteps.length > 0 && isComplete && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="px-3 pt-2.5 pb-2"
            style={{ borderBottom: '1px solid rgba(0,0,0,0.04)', background: 'rgba(0,0,0,0.012)' }}
          >
            <div style={{ fontSize: 8.5, color: '#bcc4d0', fontFamily: 'ui-monospace, monospace', letterSpacing: '0.09em', marginBottom: 5 }}>
              {firstFlow?.title ? String(firstFlow.title).toUpperCase() : 'PRIMARY FLOW'}
            </div>
            <div className="flex items-center gap-0.5 flex-wrap">
              {pipelineSteps.map((step, i) => (
                <React.Fragment key={i}>
                  <motion.div
                    initial={{ opacity: 0, x: -4 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.07 }}
                    style={{
                      fontSize: 9,
                      color: i === 0 ? color : '#4b5563',
                      background: i === 0 ? `${color}10` : '#f4f5f7',
                      border: `1px solid ${i === 0 ? `${color}28` : 'rgba(0,0,0,0.07)'}`,
                      borderRadius: 20,
                      padding: '2px 8px',
                      fontWeight: i === 0 ? 600 : 400,
                      whiteSpace: 'nowrap',
                      maxWidth: 110,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {step}
                  </motion.div>
                  {i < pipelineSteps.length - 1 && (
                    <span style={{ color: '#d1d5db', fontSize: 10, margin: '0 1px' }}>→</span>
                  )}
                </React.Fragment>
              ))}
              {firstFlow?.steps && firstFlow.steps.length > 5 && (
                <span style={{ fontSize: 9, color: '#9ca3af', marginLeft: 3 }}>+{firstFlow.steps.length - 5}</span>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* IA JSON tree */}
      <div
        className="px-3 py-2.5 overflow-hidden"
        style={{
          fontFamily: 'ui-monospace, "Fira Code", monospace',
          fontSize: 10.5,
          lineHeight: 1.7,
          minHeight: 108,
          background: nodes.length > 0
            ? 'radial-gradient(circle, rgba(0,0,0,0.028) 1px, transparent 1px)'
            : 'transparent',
          backgroundSize: '12px 12px',
        }}
      >
        {nodes.length === 0 && (
          <div style={{ paddingTop: 4 }}>
            {[70, 46, 56, 40, 62, 34, 52].map((w, i) => (
              <motion.div
                key={i}
                animate={{ opacity: [0.1, 0.3, 0.1] }}
                transition={{ duration: 1.9, repeat: Infinity, delay: i * 0.15 }}
                style={{
                  height: 8, width: `${w}%`, borderRadius: 3,
                  background: `${color}28`, marginLeft: i % 3 !== 0 ? 16 : 0, marginBottom: 8,
                }}
              />
            ))}
          </div>
        )}

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
                  <span style={{ color: '#cbd5e1' }}>:</span>
                  <span style={{ color: nodeValueColor(node.type) }}>{node.value}</span>
                </>
              )}
              {node.type === 'bracket' && <span style={{ color: '#94a3b8' }}>{'{...}'}</span>}
            </motion.div>
          ))}
        </AnimatePresence>

        {isWorking && !isComplete && revealCount < nodes.length && (
          <motion.div
            animate={{ opacity: [0.3, 1, 0.3] }}
            transition={{ duration: 1.2, repeat: Infinity }}
            style={{ color: '#94a3b8', fontSize: 10 }}
          >
            …structuring
          </motion.div>
        )}
      </div>

      {/* Stats footer */}
      {isComplete && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="px-4 pb-3 pt-2 flex items-center"
          style={{ borderTop: '1px solid rgba(0,0,0,0.05)' }}
        >
          {[
            { label: 'screens', value: screenCount || '–' },
            { label: 'flows', value: flowCount || '–' },
            { label: 'specs', value: specCount || '–' },
          ].map((stat, i) => (
            <React.Fragment key={stat.label}>
              {i > 0 && <div style={{ width: 1, height: 22, background: 'rgba(0,0,0,0.07)', margin: '0 14px' }} />}
              <div className="flex flex-col items-center" style={{ minWidth: 28 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#111', lineHeight: 1, letterSpacing: '-0.04em' }}>
                  {stat.value}
                </div>
                <div style={{ fontSize: 8, color: '#b0b8c8', marginTop: 2.5, letterSpacing: '0.05em' }}>
                  {stat.label}
                </div>
              </div>
            </React.Fragment>
          ))}

          {canExpand && (
            <motion.div
              className="ml-auto flex items-center gap-1 px-2.5 py-1 rounded-lg"
              style={{ background: `${color}08`, border: `1px solid ${color}18`, cursor: 'pointer' }}
              whileHover={{ background: `${color}14` }}
              onClick={() => setExpanded((v) => !v)}
            >
              <span style={{ fontSize: 9, color, fontWeight: 500 }}>
                {expanded ? 'collapse' : 'expand'}
              </span>
              <motion.div animate={{ rotate: expanded ? 180 : 0 }} transition={{ duration: 0.22 }}>
                <ChevronDown size={9} color={color} />
              </motion.div>
            </motion.div>
          )}
        </motion.div>
      )}

      {/* Expanded detail panel */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
            style={{ borderTop: `1px solid ${color}12` }}
          >
            <div className="px-3 py-3 space-y-3">
              {/* User flows */}
              {Array.isArray(flows) && flows.length > 0 && (
                <div>
                  <div style={{ fontSize: 8.5, color: '#bcc4d0', fontFamily: 'ui-monospace, monospace', letterSpacing: '0.1em', marginBottom: 6 }}>
                    USER FLOWS
                  </div>
                  <div className="space-y-1.5">
                    {flows.map((f, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <span
                          style={{
                            fontSize: 7.5, color, fontFamily: 'ui-monospace, monospace',
                            background: `${color}10`, borderRadius: 4, padding: '2px 5px',
                            flexShrink: 0, marginTop: 1.5, letterSpacing: '0.07em',
                            border: `1px solid ${color}22`,
                          }}
                        >
                          {String(f.id ?? `F${i + 1}`).toUpperCase()}
                        </span>
                        <div>
                          <div style={{ fontSize: 10, color: '#374151', fontWeight: 600, lineHeight: 1.3 }}>
                            {f.title ?? `Flow ${i + 1}`}
                          </div>
                          {Array.isArray(f.steps) && f.steps.length > 0 && (
                            <div style={{ fontSize: 8.5, color: '#9ca3af', marginTop: 2, lineHeight: 1.4 }}>
                              {f.steps.slice(0, 4).join(' → ')}{f.steps.length > 4 ? ' →…' : ''}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Wireframe screens */}
              {Array.isArray(wireframes) && wireframes.length > 0 && (
                <div>
                  <div style={{ fontSize: 8.5, color: '#bcc4d0', fontFamily: 'ui-monospace, monospace', letterSpacing: '0.1em', marginBottom: 6 }}>
                    SCREENS ({wireframes.length})
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {wireframes.map((w, i) => (
                      <span
                        key={i}
                        style={{
                          fontSize: 9, background: '#f4f5f7', color: '#4b5563',
                          borderRadius: 5, padding: '2px 7px',
                          border: '1px solid rgba(0,0,0,0.07)',
                        }}
                      >
                        {w.screen_name ?? w.screen_id ?? `Screen ${i + 1}`}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Handoff notes */}
              {handoff && (
                <div
                  style={{
                    fontSize: 9.5, color: '#6b7280', lineHeight: 1.55,
                    borderTop: '1px solid rgba(0,0,0,0.05)', paddingTop: 8,
                    borderLeft: `2px solid ${color}28`, paddingLeft: 8,
                  }}
                >
                  <div style={{ fontWeight: 700, color: '#bcc4d0', fontSize: 8, letterSpacing: '0.1em', marginBottom: 3 }}>HANDOFF</div>
                  {handoff.slice(0, 220)}{handoff.length > 220 ? '…' : ''}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const VisualCard: React.FC<CardProps & {
  revealCount: number;
  groups: TokenGroup[];
  typeScale: TypeScaleItem[];
  visualOutput: Record<string, unknown>;
}> = ({ isWorking, isComplete, color, revealCount, groups, typeScale, visualOutput }) => {
  const designTokens = visualOutput.design_tokens as Record<string, unknown> | undefined;
  const totalTokenCount = designTokens && Object.keys(designTokens).length > 0
    ? countTokenLeaves(designTokens)
    : groups.reduce((s, g) => s + g.tokens, 0) || typeScale.length;

  const tokenCategories = designTokens ? Object.keys(designTokens) : [];
  const allPaletteColors = groups.flatMap((g) => g.shades).slice(0, 20);

  const cardShadow = isWorking && !isComplete
    ? `0 0 0 1.5px ${color}38, 0 4px 20px ${color}16, 0 1px 3px rgba(0,0,0,0.06)`
    : `0 2px 10px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.04)`;

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ background: '#fff', boxShadow: cardShadow, transition: 'box-shadow 0.4s ease' }}
    >
      {/* Colored top stripe — uses actual palette colors when available */}
      <div
        style={{
          height: 3,
          background: allPaletteColors.length >= 3
            ? `linear-gradient(90deg, ${allPaletteColors.slice(0, 10).join(', ')})`
            : `linear-gradient(90deg, ${color}, ${color}70, transparent)`,
        }}
      />

      {/* Card header */}
      <div
        className="flex items-center justify-between px-4 py-3"
        style={{ borderBottom: '1px solid rgba(0,0,0,0.05)' }}
      >
        <div className="flex items-center gap-2.5">
          <div
            className="flex items-center justify-center rounded-full"
            style={{
              background: isWorking || isComplete ? `${color}14` : '#f4f5f7',
              width: 30, height: 30,
              border: `1px solid ${isWorking || isComplete ? `${color}28` : 'rgba(0,0,0,0.07)'}`,
            }}
          >
            <Palette size={13} color={isWorking || isComplete ? color : '#9ca3af'} />
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#111', letterSpacing: '-0.01em' }}>Visual Designer</div>
            <div style={{ fontSize: 9.5, color: '#b0b8c8', marginTop: 1 }}>Design Tokens · System · Palette</div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isWorking && !isComplete && (
            <motion.div
              animate={{ scale: [1, 1.14, 1] }}
              transition={{ duration: 1.6, repeat: Infinity }}
              className="flex items-center gap-1.5 px-2 py-0.5 rounded-full"
              style={{ background: `${color}10`, border: `1px solid ${color}22` }}
            >
              <div className="rounded-full" style={{ width: 6, height: 6, background: color }} />
              <span style={{ fontSize: 9, color, fontWeight: 600, letterSpacing: '0.05em' }}>BUILDING</span>
            </motion.div>
          )}
          {isComplete && (
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-full" style={{ background: `${color}10` }}>
              <CheckCircle2 size={9} color={color} />
              <span style={{ fontSize: 9, color, fontWeight: 600, letterSpacing: '0.05em' }}>DONE</span>
            </div>
          )}
        </div>
      </div>

      {/* Full-width palette color band */}
      <AnimatePresence>
        {allPaletteColors.length > 0 && (
          <motion.div
            initial={{ opacity: 0, scaleX: 0 }}
            animate={{ opacity: 1, scaleX: 1 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            className="flex"
            style={{ height: 7, transformOrigin: 'left' }}
          >
            {allPaletteColors.map((hex, i) => (
              <div key={`${hex}-${i}`} style={{ flex: 1, background: hex }} title={hex} />
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Token swatches */}
      <div className="px-3 py-2.5 space-y-2">
        {groups.length === 0 && (
          isComplete && tokenCategories.length > 0 ? (
            <div>
              <div style={{ fontSize: 8.5, color: '#bcc4d0', fontFamily: 'ui-monospace, monospace', letterSpacing: '0.1em', marginBottom: 8 }}>
                TOKEN CATEGORIES
              </div>
              <div className="flex flex-wrap gap-1.5">
                {tokenCategories.map((cat) => (
                  <motion.span
                    key={cat}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    style={{
                      fontSize: 9.5, color, background: `${color}10`,
                      borderRadius: 5, padding: '3px 8px',
                      fontFamily: 'ui-monospace, monospace',
                      border: `1px solid ${color}20`,
                    }}
                  >
                    {cat}
                  </motion.span>
                ))}
              </div>
            </div>
          ) : (
            <div>
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-2" style={{ marginBottom: 8 }}>
                  <motion.div
                    animate={{ opacity: [0.1, 0.32, 0.1] }}
                    transition={{ duration: 1.9, repeat: Infinity, delay: i * 0.2 }}
                    style={{ width: 44, height: 8, borderRadius: 3, background: `${color}26`, flexShrink: 0 }}
                  />
                  <div className="flex gap-1">
                    {[...Array(7)].map((_, j) => (
                      <motion.div
                        key={j}
                        animate={{ opacity: [0.07, 0.28, 0.07] }}
                        transition={{ duration: 1.9, repeat: Infinity, delay: i * 0.2 + j * 0.07 }}
                        style={{ width: 18, height: 18, borderRadius: 5, background: `${color}20` }}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )
        )}

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
                  fontSize: 9,
                  color: '#9ca3af',
                  fontFamily: 'ui-monospace, monospace',
                  width: 44,
                  flexShrink: 0,
                }}
              >
                {group.name}
              </span>
              <div className="flex gap-0.5 flex-1">
                {group.shades.map((hex, si) => (
                  <motion.div
                    key={`${hex}-${si}`}
                    initial={{ scale: 0.4, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ duration: 0.2, delay: si * 0.04 }}
                    title={hex}
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: 5,
                      background: hex,
                      border: '1px solid rgba(0,0,0,0.08)',
                      flexShrink: 0,
                    }}
                  />
                ))}
              </div>
              <span style={{ fontSize: 8.5, color: '#bcc4d0', fontFamily: 'ui-monospace, monospace' }}>
                {group.tokens}
              </span>
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Type scale — Georgia serif samples */}
        <AnimatePresence>
          {revealCount >= groups.length && typeScale.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              style={{ borderTop: '1px solid rgba(0,0,0,0.05)', paddingTop: 8, marginTop: 4 }}
            >
              <div style={{ fontSize: 8.5, color: '#bcc4d0', fontFamily: 'ui-monospace, monospace', marginBottom: 7, letterSpacing: '0.1em' }}>
                TYPE SCALE
              </div>
              <div className="flex items-end gap-2.5 flex-wrap">
                {typeScale.map((t) => (
                  <div key={t.label} className="flex flex-col items-center gap-1">
                    <span
                      style={{
                        fontSize: Math.max(t.size * 0.46, 9),
                        fontWeight: t.weight,
                        color: '#1a1a1a',
                        lineHeight: 1,
                        fontFamily: 'Georgia, "Times New Roman", serif',
                      }}
                    >
                      Ag
                    </span>
                    <span style={{ fontSize: 7.5, color: '#bcc4d0', fontFamily: 'ui-monospace, monospace' }}>
                      {t.label}
                    </span>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Footer: token count + category chips */}
      {isComplete && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="px-3 pb-3 pt-1 flex items-center justify-between"
          style={{ borderTop: '1px solid rgba(0,0,0,0.05)' }}
        >
          <div className="flex items-center gap-1.5">
            <CheckCircle2 size={9} color={color} />
            <span style={{ fontSize: 9, color, fontWeight: 700, letterSpacing: '0.04em' }}>
              {totalTokenCount} TOKENS
            </span>
          </div>
          {tokenCategories.length > 0 && (
            <div className="flex items-center gap-1">
              {tokenCategories.slice(0, 4).map((cat) => (
                <span
                  key={cat}
                  style={{
                    fontSize: 7.5, color: '#9ca3af',
                    background: '#f4f5f7',
                    borderRadius: 3, padding: '1.5px 5px',
                    fontFamily: 'ui-monospace, monospace',
                  }}
                >
                  {cat}
                </span>
              ))}
              {tokenCategories.length > 4 && (
                <span style={{ fontSize: 7.5, color: '#bcc4d0' }}>+{tokenCategories.length - 4}</span>
              )}
            </div>
          )}
        </motion.div>
      )}
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
  const seniorOutput = (designOutputs?.senior_output ?? {}) as Record<string, unknown>;
  const visualOutput = (designOutputs?.visual_output ?? {}) as Record<string, unknown>;

  const iaNodes     = extractIANodes(seniorOutput);
  const tokenGroups = extractTokenGroups(visualOutput);
  const typeScale   = extractTypeScale(visualOutput);

  const rawFlows = seniorOutput.user_flows as unknown[] | undefined;
  const flowCount = Array.isArray(rawFlows) ? rawFlows.length : 0;

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
      style={{ background: '#f3f5f8' }}
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
          flowCount={flowCount}
          seniorOutput={seniorOutput}
        />

        {/* ── Visual card ──────────────────────────────────────────────────── */}
        <VisualCard
          isWorking={visualWorking}
          isComplete={visualDone}
          color={VISUAL_COLOR}
          revealCount={visualReveal}
          groups={tokenGroups}
          typeScale={typeScale}
          visualOutput={visualOutput}
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
                  IA specs · {countTokenLeaves((visualOutput.design_tokens as Record<string, unknown>) || {}) || tokenGroups.reduce((s, g) => s + g.tokens, 0) || '–'} tokens · {flowCount} flow{flowCount === 1 ? '' : 's'} — awaiting manager review
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
