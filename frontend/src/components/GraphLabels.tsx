import React from 'react';
import { useStore } from '../store/useStore';
import { AGENTS } from '../data/agents';

const GraphLabels: React.FC = () => {
  const { graphNodeScreenPositions, agentStates } = useStore();

  return (
    <div className="absolute inset-0 pointer-events-none z-10">
      {AGENTS.map((agent, i) => {
        const pos = graphNodeScreenPositions[i];
        if (!pos) return null;

        const runtime = agentStates.find((a) => a.index === i);
        const isActive =
          runtime?.status === 'working' || runtime?.status === 'reviewing';

        return (
          <div
            key={agent.index}
            className="absolute transition-all duration-75 ease-out"
            style={{
              left: pos.x,
              top: pos.y,
              transform: 'translate(-50%, calc(-100% - 14px))',
            }}
          >
            <div
              className="px-2.5 py-1.5 rounded-xl border backdrop-blur-sm whitespace-nowrap"
              style={{
                backgroundColor: `${agent.color}12`,
                borderColor: isActive ? `${agent.color}55` : `${agent.color}25`,
                boxShadow: isActive ? `0 0 16px ${agent.color}28` : 'none',
                transition: 'border-color 0.4s, box-shadow 0.4s',
              }}
            >
              <div className="flex items-center gap-1.5">
                <div
                  className={`w-1.5 h-1.5 rounded-full ${isActive ? 'animate-pulse' : ''}`}
                  style={{ backgroundColor: agent.color }}
                />
                <span
                  className="text-[11px] font-black uppercase tracking-widest"
                  style={{ color: agent.color }}
                >
                  {agent.role}
                </span>
              </div>
              <p className="text-[9px] text-zinc-500 font-medium mt-0.5">{agent.department}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default GraphLabels;
