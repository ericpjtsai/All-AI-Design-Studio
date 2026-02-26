import React from 'react';
import { AgentData } from '../data/agents';
import { AgentRuntimeState, AgentStatus } from '../types';

const STATUS_CONFIG: Record<
  AgentStatus,
  { label: string; textColor: string; dotClass: string }
> = {
  idle:      { label: 'Idle',      textColor: 'text-zinc-500',   dotClass: 'bg-zinc-600' },
  working:   { label: 'Working',   textColor: 'text-blue-400',   dotClass: 'bg-blue-400 animate-pulse' },
  reviewing: { label: 'Reviewing', textColor: 'text-yellow-400', dotClass: 'bg-yellow-400 animate-pulse' },
  waiting:   { label: 'Waiting',   textColor: 'text-orange-400', dotClass: 'bg-orange-400 animate-pulse' },
  done:      { label: 'Done',      textColor: 'text-green-400',  dotClass: 'bg-green-400' },
};

interface Props {
  agent: AgentData;
  runtimeState: AgentRuntimeState;
}

const AgentCard: React.FC<Props> = ({ agent, runtimeState }) => {
  const cfg = STATUS_CONFIG[runtimeState.status];
  const showProgress =
    (runtimeState.status === 'working' || runtimeState.status === 'reviewing') &&
    runtimeState.progress > 0;

  return (
    <div className="bg-zinc-900 rounded-2xl p-4 border border-zinc-800 hover:border-zinc-700 transition-colors duration-200">
      <div className="flex items-start gap-3">
        {/* Color accent bar */}
        <div
          className="w-1.5 rounded-full shrink-0"
          style={{
            backgroundColor: agent.color,
            height: agent.isOrchestrator ? '44px' : '34px',
          }}
        />

        <div className="flex-1 min-w-0">
          {/* Header row */}
          <div className="flex items-center justify-between gap-2 mb-1">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-white font-black text-sm truncate">{agent.role}</span>
              {agent.isOrchestrator && (
                <span className="shrink-0 text-[9px] font-black uppercase tracking-widest text-zinc-500 bg-zinc-800 px-1.5 py-0.5 rounded-full">
                  Hub
                </span>
              )}
            </div>

            {/* Status badge */}
            <div className={`flex items-center gap-1.5 shrink-0 ${cfg.textColor}`}>
              <div className={`w-1.5 h-1.5 rounded-full ${cfg.dotClass}`} />
              <span className="text-[10px] font-black uppercase tracking-wider">{cfg.label}</span>
            </div>
          </div>

          {/* Department + expertise */}
          <p className="text-[10px] text-zinc-600 font-medium uppercase tracking-wider mb-1.5">
            {agent.department}&nbsp;·&nbsp;{agent.expertise.slice(0, 2).join(', ')}
          </p>

          {/* Current task */}
          <p className="text-xs text-zinc-400 leading-relaxed">{runtimeState.currentTask}</p>

          {/* Progress bar */}
          {showProgress && (
            <div className="mt-2 h-1 bg-zinc-800 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-1000 ease-out"
                style={{ width: `${runtimeState.progress}%`, backgroundColor: agent.color }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AgentCard;
