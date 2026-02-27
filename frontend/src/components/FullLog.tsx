import React, { useState, useRef, useEffect } from 'react';
import { useStore } from '../store/useStore';
import { AGENTS } from '../data/agents';

const LEVEL_ICON: Record<string, string> = {
  info: '·',
  success: '✓',
  warn: '⚠',
  error: '✕',
};

const LEVEL_COLOR: Record<string, string> = {
  info: 'text-zinc-400',
  success: 'text-green-400',
  warn: 'text-yellow-400',
  error: 'text-red-400',
};

const agentName = (index: number) => AGENTS[index]?.role ?? `Agent ${index}`;
const agentColor = (index: number) => AGENTS[index]?.color ?? '#71717a';

export const FullLog: React.FC = () => {
  const activities = useStore((s) => s.activities);
  const [agentFilter, setAgentFilter] = useState<number | 'all'>('all');
  const [levelFilter, setLevelFilter] = useState<string>('all');
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  // Auto-scroll to latest only if user is already near the bottom
  useEffect(() => {
    if (!autoScroll) return;
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activities.length, autoScroll]);

  const handleScroll = () => {
    const el = containerRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    setAutoScroll(nearBottom);
  };

  const filtered = activities.filter((a) => {
    if (agentFilter !== 'all' && a.agentIndex !== agentFilter) return false;
    if (levelFilter !== 'all' && a.level !== levelFilter) return false;
    return true;
  });

  // Reverse so newest is at top (activities array is newest-first)
  // but we want oldest at top for a natural log reading order
  const ordered = [...filtered].reverse();

  return (
    <div className="flex flex-col h-full">
      {/* Filter bar */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-zinc-800 shrink-0 flex-wrap">
        <span className="text-[9px] font-black uppercase tracking-widest text-zinc-600">Filter:</span>

        <select
          value={agentFilter === 'all' ? 'all' : String(agentFilter)}
          onChange={(e) => setAgentFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))}
          className="text-[10px] bg-zinc-900 border border-zinc-800 text-zinc-300 rounded px-1.5 py-0.5 focus:outline-none"
        >
          <option value="all">All Agents</option>
          {AGENTS.map((a) => (
            <option key={a.index} value={a.index}>{a.role}</option>
          ))}
        </select>

        <select
          value={levelFilter}
          onChange={(e) => setLevelFilter(e.target.value)}
          className="text-[10px] bg-zinc-900 border border-zinc-800 text-zinc-300 rounded px-1.5 py-0.5 focus:outline-none"
        >
          <option value="all">All Levels</option>
          <option value="info">Info</option>
          <option value="success">Success</option>
          <option value="warn">Warning</option>
          <option value="error">Error</option>
        </select>

        <span className="ml-auto text-[9px] text-zinc-600 tabular-nums">
          {filtered.length} / {activities.length} entries
        </span>
      </div>

      {/* Log entries */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-4 py-2 space-y-0.5 [scrollbar-width:thin] [scrollbar-color:#3f3f46_transparent]"
      >
        {ordered.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-zinc-600 text-xs">No log entries yet. Start a session to see activity.</p>
          </div>
        ) : (
          ordered.map((entry) => (
            <div
              key={entry.id}
              className="flex items-start gap-2 py-0.5 group"
            >
              {/* Agent color dot */}
              <div
                className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0"
                style={{ backgroundColor: agentColor(entry.agentIndex) }}
              />

              {/* Level icon */}
              <span className={`text-[10px] font-bold shrink-0 mt-0.5 w-3 ${LEVEL_COLOR[entry.level ?? 'info']}`}>
                {LEVEL_ICON[entry.level ?? 'info']}
              </span>

              {/* Message */}
              <span className={`text-[11px] leading-snug flex-1 min-w-0 break-words ${LEVEL_COLOR[entry.level ?? 'info']}`}>
                {entry.message}
              </span>

              {/* Right side: agent name + timestamp */}
              <div className="shrink-0 text-right hidden group-hover:flex flex-col items-end gap-0 min-w-[80px]">
                <span className="text-[9px] font-semibold" style={{ color: agentColor(entry.agentIndex) }}>
                  {agentName(entry.agentIndex)}
                </span>
                <span className="text-[9px] text-zinc-600 tabular-nums">{entry.timestamp}</span>
              </div>
              <div className="shrink-0 group-hover:hidden">
                <span className="text-[9px] text-zinc-600 tabular-nums">{entry.timestamp}</span>
              </div>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* Auto-scroll indicator */}
      {!autoScroll && (
        <button
          type="button"
          onClick={() => {
            setAutoScroll(true);
            bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
          }}
          className="shrink-0 mx-4 mb-2 py-1 rounded-lg bg-zinc-800 text-[10px] text-zinc-400 hover:text-white transition-colors"
        >
          ↓ Jump to latest
        </button>
      )}
    </div>
  );
};

export default FullLog;
