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
  info: '#a1a1aa',
  success: '#22c55e',
  warn: '#f59e0b',
  error: '#ef4444',
};

const agentName = (index: number) => AGENTS[index]?.role ?? `Agent ${index}`;
const agentColor = (index: number) => AGENTS[index]?.color ?? '#a1a1aa';

export const FullLog: React.FC = () => {
  const activities = useStore((s) => s.activities);
  const [agentFilter, setAgentFilter] = useState<number | 'all'>('all');
  const [levelFilter, setLevelFilter] = useState<string>('all');
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  useEffect(() => {
    if (!autoScroll) return;
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activities.length, autoScroll]);

  const handleScroll = () => {
    const el = containerRef.current;
    if (!el) return;
    setAutoScroll(el.scrollHeight - el.scrollTop - el.clientHeight < 80);
  };

  const filtered = activities.filter((a) => {
    if (agentFilter !== 'all' && a.agentIndex !== agentFilter) return false;
    if (levelFilter !== 'all' && a.level !== levelFilter) return false;
    return true;
  });

  const ordered = [...filtered].reverse();

  const selectStyle: React.CSSProperties = {
    background: 'white',
    border: '1.5px solid #e4e4e7',
    color: '#52525b',
    borderRadius: 10,
    padding: '3px 8px',
    fontSize: 11,
    fontWeight: 600,
    fontFamily: 'Space Grotesk, sans-serif',
    outline: 'none',
    cursor: 'pointer',
  };

  return (
    <div className="flex flex-col h-full">
      {/* Filter bar */}
      <div className="flex items-center gap-2 px-6 py-3 shrink-0 flex-wrap" style={{ borderBottom: '1px solid #f4f4f5' }}>
        <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: '#a1a1aa' }}>Filter:</span>

        <select
          value={agentFilter === 'all' ? 'all' : String(agentFilter)}
          onChange={(e) => setAgentFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))}
          style={selectStyle}
        >
          <option value="all">All Agents</option>
          {AGENTS.map((a) => (
            <option key={a.index} value={a.index}>{a.role}</option>
          ))}
        </select>

        <select value={levelFilter} onChange={(e) => setLevelFilter(e.target.value)} style={selectStyle}>
          <option value="all">All Levels</option>
          <option value="info">Info</option>
          <option value="success">Success</option>
          <option value="warn">Warning</option>
          <option value="error">Error</option>
        </select>

        <span className="ml-auto text-[10px] font-medium tabular-nums" style={{ color: '#d4d4d8' }}>
          {filtered.length} / {activities.length}
        </span>
      </div>

      {/* Entries */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-6 py-3 space-y-0.5"
      >
        {ordered.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-[12px] font-medium" style={{ color: '#d4d4d8' }}>
              No entries yet. Start a session to see activity.
            </p>
          </div>
        ) : (
          ordered.map((entry) => (
            <div key={entry.id} className="flex items-start gap-2 py-1 group rounded-lg px-2 transition-colors hover:bg-zinc-50">
              {/* Agent dot */}
              <div
                className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0"
                style={{ background: agentColor(entry.agentIndex) }}
              />
              {/* Level icon */}
              <span className="text-[10px] font-bold shrink-0 mt-0.5 w-3" style={{ color: LEVEL_COLOR[entry.level ?? 'info'] }}>
                {LEVEL_ICON[entry.level ?? 'info']}
              </span>
              {/* Message */}
              <span className="text-[11px] font-medium leading-snug flex-1 min-w-0 break-words" style={{ color: LEVEL_COLOR[entry.level ?? 'info'] }}>
                {entry.message}
              </span>
              {/* Meta on hover */}
              <div className="shrink-0 text-right hidden group-hover:flex flex-col items-end gap-0 min-w-[80px]">
                <span className="text-[9px] font-black" style={{ color: agentColor(entry.agentIndex) }}>
                  {agentName(entry.agentIndex)}
                </span>
                <span className="text-[9px] tabular-nums" style={{ color: '#d4d4d8' }}>{entry.timestamp}</span>
              </div>
              <div className="shrink-0 group-hover:hidden">
                <span className="text-[9px] tabular-nums" style={{ color: '#d4d4d8' }}>{entry.timestamp}</span>
              </div>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* Jump to latest */}
      {!autoScroll && (
        <button
          type="button"
          onClick={() => { setAutoScroll(true); bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }}
          className="shrink-0 mx-6 mb-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors hover:opacity-70"
          style={{ background: '#f4f4f5', color: '#71717a' }}
        >
          ↓ Jump to Latest
        </button>
      )}
    </div>
  );
};

export default FullLog;
