import React, { useMemo } from 'react';
import { useStore } from '../store/useStore';
import { AGENTS } from '../data/agents';

const NODE_POSITIONS: Record<number, { cx: number; cy: number }> = {
  0: { cx: 130, cy: 36 },
  1: { cx: 42,  cy: 138 },
  2: { cx: 218, cy: 138 },
  3: { cx: 130, cy: 138 },
};

const EDGES: [number, number][] = [
  [0, 1], [0, 2], [0, 3],
  [1, 3], [3, 2], [1, 2],
];

const HUB_R = 18;
const NODE_R = 13;

function nodeFill(status: string, color: string): string {
  if (status === 'working' || status === 'reviewing') return color;
  if (status === 'complete') return '#dcfce7';
  if (status === 'error') return '#fee2e2';
  return '#f4f4f5';
}

function nodeStroke(status: string, color: string): string {
  if (status === 'working' || status === 'reviewing') return color;
  if (status === 'complete') return '#22c55e';
  if (status === 'error') return '#ef4444';
  return color;
}

function nodeStrokeOpacity(status: string): number {
  if (status === 'idle') return 0.25;
  return 0.9;
}

function textFill(status: string): string {
  if (status === 'working' || status === 'reviewing') return '#ffffff';
  if (status === 'complete') return '#16a34a';
  if (status === 'error') return '#dc2626';
  return '#a1a1aa';
}

const STATUS_LABEL: Record<string, string> = {
  idle: '',
  working: 'Working',
  reviewing: 'Reviewing',
  waiting: 'Waiting',
  complete: 'Done',
  error: 'Error',
};

const AgentGraph: React.FC = () => {
  const agentStates = useStore((s) => s.agentStates);

  const stateByIndex = useMemo(() => {
    const m: Record<number, (typeof agentStates)[0]> = {};
    agentStates.forEach((a) => { m[a.index] = a; });
    return m;
  }, [agentStates]);

  return (
    <div className="px-6 pt-4 pb-2">
      <p className="text-[10px] font-black uppercase tracking-widest mb-2" style={{ color: '#a1a1aa' }}>
        Agent Graph
      </p>
      <svg
        viewBox="0 0 260 180"
        className="w-full"
        style={{ height: '158px' }}
        aria-label="Agent interaction graph"
      >
        <defs>
          {AGENTS.map((agent) => {
            const state = stateByIndex[agent.index];
            const active = state?.status === 'working' || state?.status === 'reviewing';
            return (
              <filter key={`glow-${agent.index}`} id={`glow-${agent.index}`} x="-60%" y="-60%" width="220%" height="220%">
                <feGaussianBlur stdDeviation={active ? '3.5' : '0'} result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            );
          })}
        </defs>

        {/* Edges */}
        {EDGES.map(([from, to]) => {
          const a = NODE_POSITIONS[from];
          const b = NODE_POSITIONS[to];
          const fromState = stateByIndex[from];
          const toState = stateByIndex[to];
          const fromActive = fromState?.isActive || fromState?.status === 'working';
          const toActive = toState?.isActive || toState?.status === 'working';
          const activeAgent = fromActive ? AGENTS[from] : toActive ? AGENTS[to] : null;

          return (
            <line
              key={`edge-${from}-${to}`}
              x1={a.cx} y1={a.cy}
              x2={b.cx} y2={b.cy}
              stroke={activeAgent ? activeAgent.color : '#e4e4e7'}
              strokeWidth={activeAgent ? 1.5 : 1}
              strokeOpacity={activeAgent ? 0.8 : 1}
              strokeDasharray={activeAgent ? 'none' : '3 4'}
            />
          );
        })}

        {/* Nodes */}
        {AGENTS.map((agent) => {
          const state = stateByIndex[agent.index];
          const status = state?.status ?? 'idle';
          const isHub = agent.isOrchestrator;
          const r = isHub ? HUB_R : NODE_R;
          const pos = NODE_POSITIONS[agent.index];
          const isAnimating = status === 'working' || status === 'reviewing';

          return (
            <g key={agent.index} filter={isAnimating ? `url(#glow-${agent.index})` : undefined}>
              {/* Pulse ring */}
              {isAnimating && (
                <circle cx={pos.cx} cy={pos.cy} r={r + 5} fill="none" stroke={agent.color} strokeWidth="1" strokeOpacity="0.3">
                  <animate attributeName="r" values={`${r + 4};${r + 11};${r + 4}`} dur="2s" repeatCount="indefinite" />
                  <animate attributeName="stroke-opacity" values="0.4;0;0.4" dur="2s" repeatCount="indefinite" />
                </circle>
              )}

              {/* Node */}
              <circle
                cx={pos.cx} cy={pos.cy} r={r}
                fill={nodeFill(status, agent.color)}
                stroke={nodeStroke(status, agent.color)}
                strokeWidth={isHub ? 2 : 1.5}
                strokeOpacity={nodeStrokeOpacity(status)}
              />

              {/* Initials */}
              <text
                x={pos.cx} y={pos.cy + 1}
                textAnchor="middle"
                dominantBaseline="middle"
                fill={textFill(status)}
                fontSize={isHub ? '9' : '7.5'}
                fontWeight="800"
                fontFamily="Space Grotesk, sans-serif"
              >
                {agent.role.split(' ').map((w) => w[0]).join('').slice(0, 2)}
              </text>

              {/* Label */}
              <text
                x={pos.cx} y={pos.cy + r + 9}
                textAnchor="middle"
                fill={status === 'idle' ? '#a1a1aa' : '#3f3f46'}
                fontSize="7"
                fontWeight="700"
                fontFamily="Space Grotesk, sans-serif"
              >
                {agent.role.replace('Designer', 'Des.').replace('Manager', 'Mgr.')}
              </text>

              {/* Status badge */}
              {status !== 'idle' && STATUS_LABEL[status] && (
                <text
                  x={pos.cx} y={pos.cy + r + 18}
                  textAnchor="middle"
                  fill={agent.color}
                  fontSize="6"
                  fontWeight="700"
                  fontFamily="Space Grotesk, sans-serif"
                >
                  {STATUS_LABEL[status]}
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
