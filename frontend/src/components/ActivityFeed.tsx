import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useStore } from '../store/useStore';
import { AGENTS } from '../data/agents';

const ActivityFeed: React.FC = () => {
  const activities = useStore((s) => s.activities);

  return (
    <div className="p-4">
      <h3 className="text-[10px] font-black uppercase tracking-widest text-zinc-600 mb-3">
        Activity Feed
      </h3>

      <div className="space-y-2 max-h-[160px] overflow-y-auto [scrollbar-width:thin] [scrollbar-color:theme(colors.zinc.700)_transparent]">
        <AnimatePresence initial={false}>
          {activities.slice(0, 14).map((entry) => {
            const agent = AGENTS[entry.agentIndex];
            const levelColor =
              entry.level === 'success'
                ? 'text-green-400'
                : entry.level === 'warn'
                ? 'text-yellow-400'
                : 'text-zinc-400';

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
                  style={{ backgroundColor: agent?.color ?? '#64748b' }}
                />
                <p className={`flex-1 text-[11px] leading-relaxed ${levelColor}`}>
                  {entry.message}
                </p>
                <span className="text-[9px] text-zinc-700 shrink-0 mt-0.5 tabular-nums">
                  {entry.timestamp}
                </span>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default ActivityFeed;
