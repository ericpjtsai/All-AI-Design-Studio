import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useStore } from '../store/useStore';
import { AGENTS } from '../data/agents';

const ActivityFeed: React.FC = () => {
  const activities = useStore((s) => s.activities);

  return (
    <div className="p-6 h-full flex flex-col">
      <p className="text-[10px] font-black uppercase tracking-widest mb-3 shrink-0" style={{ color: '#a1a1aa' }}>
        Activity Feed
      </p>

      <div className="space-y-2 overflow-y-auto flex-1 min-h-0 pr-1">
        <AnimatePresence initial={false}>
          {activities.slice(0, 14).map((entry) => {
            const agent = AGENTS[entry.agentIndex];
            const levelColor =
              entry.level === 'success'
                ? '#22c55e'
                : entry.level === 'warn'
                ? '#f59e0b'
                : (entry.level as string) === 'error'
                ? '#ef4444'
                : '#a1a1aa';

            return (
              <motion.div
                key={entry.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.2 }}
                className="flex items-start gap-2"
              >
                <div
                  className="w-1.5 h-1.5 rounded-full shrink-0 mt-1.5"
                  style={{ background: agent?.color ?? '#a1a1aa' }}
                />
                <p className="flex-1 text-[11px] leading-relaxed font-medium" style={{ color: levelColor }}>
                  {entry.message}
                </p>
                <span className="text-[9px] shrink-0 mt-0.5 tabular-nums" style={{ color: '#d4d4d8' }}>
                  {entry.timestamp}
                </span>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {activities.length === 0 && (
          <p className="text-[11px] font-medium" style={{ color: '#d4d4d8' }}>
            Activity will appear here once a session starts.
          </p>
        )}
      </div>
    </div>
  );
};

export default ActivityFeed;
