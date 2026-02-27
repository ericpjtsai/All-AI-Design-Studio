import React, { useMemo } from 'react';
import { useStore } from '../store/useStore';
import { AGENTS } from '../data/agents';

// ── Node layout ───────────────────────────────────────────────────────────────
// SVG viewBox: 0 0 260 180
// Positions are (cx, cy)
const NODE_POSITIONS: Record<number, { cx: number; cy: number }> = {
  0: { cx: 130, cy: 36 },   // Design Manager — top center (hub)
  1: { cx: 42,  cy: 138 },  // Senior Designer — bottom left
  2: { cx: 218, cy: 138 },  // Junior Designer — bottom right
  3: { cx: 130, cy: 138 },  // Visual Designer — bottom center
};

// Edges: [fromIndex, toIndex]
const EDGES: [number, number][] = [
  [0, 1], [0, 2], [0, 3],   // hub → spokes
  [1, 3], [3, 2], [1, 2],   // cross-connections
];

const HUB_R = 18;
const NODE_R = 13;

function statusGlow(status: string, color: string): string {
  if (status === 'working' || status === 'reviewing') return color;
  if (status === 'complete') return '#22c55e';
  if (status === 'error') return '#ef4444';
  return '#3f3f46';
}

function statusOpacity(status: string): number {
  if (status === 'idle') return 0.35;
  if (status === 'complete') return 0.8;
  return 1;
}

const STATUS_LABEL: Record<string, string> = {
  idle: 'Idle',
  working: 'Working',
  reviewing: 'Reviewing',
  waiting: 'Waiting',
  complete: 'Done',
  error: 'Error',
};

export const AgentGraph: React.FC = () => {
  const agentStates = useStore((s) => s.agentStates);

  const stateByIndex = useMemo(() => {
    const m: Record<number, (typeof agentStates)[0]> = {};
    agentStates.forEach((a) => { m[a.index] = a; });
    return m;
  }, [agentStates]);

  return (
    <div className="px-3 pt-2 pb-1">
      <p className="text-[9px] font-black uppercase tracking-widest text-zinc-600 mb-1.5">
        Agent Graph
      </p>
      <svg
        viewBox="0 0 260 180"
        className="w-full"
        style={{ height: '160px' }}
        aria-label="Agent interaction graph"
      >
        <defs>
          {AGENTS.map((agent) => {
            const state = stateByIndex[agent.index];
            const active = state?.isActive || state?.status === 'working' || state?.status === 'reviewing';
            return (
              <filter key={`glow-${agent.index}`} id={`glow-${agent.index}`} x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation={active ? '4' : '2'} result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            );
          })}
        </defs>

        {/* ── Edges ── */}
        {EDGES.map(([from, to]) => {
          const a = NODE_POSITIONS[from];
          const b = NODE_POSITIONS[to];
          const fromState = stateByIndex[from];
          const toState = stateByIndex[to];
          const fromActive = fromState?.isActive;
          const toActive = toState?.isActive;
          const activeAgent = fromActive ? AGENTS[from] : toActive ? AGENTS[to] : null;

          return (
            <line
              key={`edge-${from}-${to}`}
              x1={a.cx} y1={a.cy}
              x2={b.cx} y2={b.cy}
              stroke={activeAgent ? activeAgent.color : '#27272a'}
              strokeWidth={activeAgent ? 1.5 : 1}
              strokeOpacity={activeAgent ? 0.75 : 0.4}
              strokeDasharray={activeAgent ? 'none' : '3 3'}
            />
          );
        })}

        {/* ── Nodes ── */}
        {AGENTS.map((agent) => {
          const state = stateByIndex[agent.index];
          const status = state?.status ?? 'idle';
          const isHub = agent.isOrchestrator;
          const r = isHub ? HUB_R : NODE_R;
          const pos = NODE_POSITIONS[agent.index];
          const fillColor = statusGlow(status, agent.color);
          const opacity = statusOpacity(status);
          const isAnimating = status === 'working' || status === 'reviewing';

          return (
            <g key={agent.index} filter={`url(#glow-${agent.index})`}>
              {/* Pulse ring */}
              {isAnimating && (
                <circle
                  cx={pos.cx}
                  cy={pos.cy}
                  r={r + 5}
                  fill="none"
                  stroke={agent.color}
                  strokeWidth="1"
                  strokeOpacity="0.4"
                >
                  <animate
                    attributeName="r"
                    values={`${r + 4};${r + 10};${r + 4}`}
                    dur="1.8s"
                    repeatCount="indefinite"
                  />
                  <animate
                    attributeName="stroke-opacity"
                    values="0.5;0;0.5"
                    dur="1.8s"
                    repeatCount="indefinite"
                  />
                </circle>
              )}

              {/* Node body */}
              <circle
                cx={pos.cx}
                cy={pos.cy}
                r={r}
                fill={fillColor}
                fillOpacity={opacity}
                stroke={agent.color}
                strokeWidth={isHub ? 2 : 1.5}
                strokeOpacity={opacity}
              />

              {/* Agent initial */}
              <text
                x={pos.cx}
                y={pos.cy + 1}
                textAnchor="middle"
                dominantBaseline="middle"
                fill="white"
                fontSize={isHub ? '9' : '7.5'}
                fontWeight="800"
                fontFamily="sans-serif"
                fillOpacity={opacity < 0.5 ? 0.5 : 1}
              >
                {agent.role.split(' ').map((w) => w[0]).join('').slice(0, 2)}
              </text>

              {/* Label below node */}
              <text
                x={pos.cx}
                y={pos.cy + r + 9}
                textAnchor="middle"
                fill={status === 'idle' ? '#52525b' : 'white'}
                fontSize="7"
                fontWeight="700"
                fontFamily="sans-serif"
              >
                {agent.role.replace('Designer', 'Des.').replace('Manager', 'Mgr.')}
              </text>

              {/* Status badge */}
              {status !== 'idle' && (
                <text
                  x={pos.cx}
                  y={pos.cy + r + 18}
                  textAnchor="middle"
                  fill={agent.color}
                  fontSize="6"
                  fontWeight="600"
                  fontFamily="sans-serif"
                  fillOpacity="0.9"
                >
                  {STATUS_LABEL[status] ?? status}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
};

export default AgentGraph;
