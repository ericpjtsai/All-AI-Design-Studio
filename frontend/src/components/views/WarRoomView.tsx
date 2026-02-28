import React, { useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { useStore } from '../../store/useStore';
import { AGENTS } from '../../data/agents';
import AgentAvatar from './AgentAvatar';

const WarRoomView: React.FC = () => {
  const agentStates = useStore((s) => s.agentStates);
  const activities = useStore((s) => s.activities);
  const workflowPhase = useStore((s) => s.workflowPhase);
  const logEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to latest entry
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activities.length]);

  const phaseLabel =
    workflowPhase === 'designing' ? 'Design Phase' :
    workflowPhase === 'implementing' ? 'Implementation Phase' :
    workflowPhase === 'reviewing' ? 'Review Phase' : 'Working';

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ type: 'spring', stiffness: 380, damping: 28 }}
      className="flex flex-col h-full"
    >
      {/* Agent strip */}
      <div className="shrink-0 px-6 pt-5 pb-4">
        <div className="flex items-center justify-between mb-4">
          <p className="text-[9px] font-black uppercase tracking-widest" style={{ color: '#a1a1aa' }}>
            Agent Status
          </p>
          <span
            className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full"
            style={{ background: '#22c55e15', color: '#22c55e' }}
          >
            {phaseLabel}
          </span>
        </div>

        <div className="flex justify-center gap-5">
          {AGENTS.map((agent) => {
            const runtime = agentStates.find((s) => s.index === agent.index);
            return (
              <AgentAvatar
                key={agent.index}
                agent={agent}
                runtimeState={runtime!}
              />
            );
          })}
        </div>
      </div>

      {/* Divider */}
      <div className="shrink-0 mx-6" style={{ height: 1, background: '#f4f4f5' }} />

      {/* Activity log */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        <p className="text-[9px] font-black uppercase tracking-widest mb-3" style={{ color: '#a1a1aa' }}>
          Execution Log
        </p>

        {activities.length === 0 ? (
          <div className="flex items-center gap-2.5 mt-8 justify-center">
            <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: '#7EACEA' }} />
            <p className="text-[12px] font-medium" style={{ color: '#a1a1aa' }}>
              Waiting for activity...
            </p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {/* Show newest at bottom (activities are stored newest-first) */}
            {[...activities].reverse().map((entry) => {
              const agent = AGENTS[entry.agentIndex];
              const color = agent?.color ?? '#a1a1aa';
              const levelColor =
                entry.level === 'success' ? '#22c55e' :
                entry.level === 'warn' ? '#f59e0b' : color;

              return (
                <div key={entry.id} className="flex items-start gap-2 group">
                  <div
                    className="w-1.5 h-1.5 rounded-full shrink-0 mt-1.5"
                    style={{ background: color }}
                  />
                  <span
                    className="text-[9px] font-bold shrink-0 tabular-nums mt-0.5"
                    style={{ color: '#d4d4d8' }}
                  >
                    {entry.timestamp}
                  </span>
                  <p
                    className="text-[11px] font-medium leading-relaxed flex-1 min-w-0"
                    style={{ color: levelColor }}
                  >
                    {entry.message}
                  </p>
                </div>
              );
            })}
            <div ref={logEndRef} />
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default WarRoomView;
