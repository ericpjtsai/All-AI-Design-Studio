import React from 'react';
import { motion } from 'motion/react';
import { AgentData } from '../../data/agents';
import { AgentRuntimeState } from '../../types';

interface AgentAvatarProps {
  agent: AgentData;
  runtimeState: AgentRuntimeState;
}

const AgentAvatar: React.FC<AgentAvatarProps> = ({ agent, runtimeState }) => {
  const isActive = runtimeState.status === 'working' || runtimeState.isActive;
  const isDone = runtimeState.status === 'complete';
  const initial = agent.role.charAt(0);

  return (
    <div className="flex flex-col items-center gap-1.5 w-16">
      {/* Avatar circle */}
      <motion.div
        className="relative w-12 h-12 rounded-full flex items-center justify-center text-[16px] font-black"
        style={{
          background: `${agent.color}15`,
          border: `2px solid ${agent.color}`,
          color: agent.color,
        }}
        animate={
          isActive
            ? {
                boxShadow: [
                  `0 0 0 0 ${agent.color}00`,
                  `0 0 20px 4px ${agent.color}40`,
                  `0 0 0 0 ${agent.color}00`,
                ],
                scale: [1, 1.05, 1],
              }
            : {
                boxShadow: `0 0 0 0 ${agent.color}00`,
                scale: 1,
                opacity: isDone ? 0.7 : 0.4,
              }
        }
        transition={
          isActive
            ? { repeat: Infinity, duration: 2, ease: 'easeInOut' }
            : { duration: 0.3 }
        }
      >
        {initial}

        {/* Status dot */}
        <div
          className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white"
          style={{
            background:
              runtimeState.status === 'working' ? '#22c55e' :
              runtimeState.status === 'reviewing' ? '#f59e0b' :
              runtimeState.status === 'complete' ? '#7EACEA' :
              runtimeState.status === 'error' ? '#ef4444' :
              '#d4d4d8',
          }}
        />
      </motion.div>

      {/* Role label */}
      <p
        className="text-[8px] font-black uppercase tracking-widest text-center leading-tight truncate w-full"
        style={{ color: isActive ? agent.color : '#a1a1aa' }}
      >
        {agent.role.replace(' Designer', '').replace(' Manager', ' Mgr')}
      </p>

      {/* Status text */}
      <p
        className="text-[8px] font-medium text-center leading-tight truncate w-full"
        style={{ color: '#d4d4d8' }}
      >
        {runtimeState.status === 'idle' ? 'Standby' :
         runtimeState.status === 'working' ? 'Working' :
         runtimeState.status === 'reviewing' ? 'Reviewing' :
         runtimeState.status === 'complete' ? 'Done' :
         runtimeState.status === 'error' ? 'Error' : '—'}
      </p>

      {/* Progress bar */}
      {runtimeState.status === 'working' && (
        <div className="w-full h-0.5 rounded-full overflow-hidden" style={{ background: '#f4f4f5' }}>
          <motion.div
            className="h-full rounded-full"
            style={{ background: agent.color }}
            animate={{ width: `${runtimeState.progress}%` }}
            transition={{ duration: 0.5 }}
          />
        </div>
      )}
    </div>
  );
};

export default AgentAvatar;
