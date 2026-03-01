import React, { useRef, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useStore } from '../../store/useStore';
import { AGENTS } from '../../data/agents';
import { ActivityEntry } from '../../types';

// ── Helpers ───────────────────────────────────────────────────────────────────

function cleanMessage(msg: string): string {
  const trimmed = msg.trim();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) return '[structured output]';
  return trimmed.length > 160 ? trimmed.slice(0, 157) + '…' : trimmed;
}

function findReviewTarget(task: string): number | null {
  if (task.includes('Senior')) return 1;
  if (task.includes('Junior')) return 2;
  if (task.includes('Visual')) return 3;
  return null;
}

// ── Thread grouping ───────────────────────────────────────────────────────────

interface MessageThread {
  id: string;
  agentIndex: number;
  entries: ActivityEntry[];
}

function buildThreads(activities: ActivityEntry[]): MessageThread[] {
  const ordered = [...activities].reverse(); // oldest → newest
  const threads: MessageThread[] = [];
  for (const entry of ordered) {
    const last = threads[threads.length - 1];
    if (last && last.agentIndex === entry.agentIndex) {
      last.entries.push(entry);
    } else {
      threads.push({ id: entry.id, agentIndex: entry.agentIndex, entries: [entry] });
    }
  }
  return threads;
}

// ── Level styles ──────────────────────────────────────────────────────────────

const LEVEL_ICON: Record<string, string> = { success: '✓', warn: '⚠', error: '✕', info: '›' };

function levelColor(lvl: string, agentColor: string): string {
  if (lvl === 'success') return agentColor;
  if (lvl === 'warn')    return '#fbbf24';
  if (lvl === 'error')   return '#f87171';
  return '#52525b';
}

// ── Pulsing dot ───────────────────────────────────────────────────────────────

const PulseDot: React.FC<{ color: string; glow?: boolean }> = ({ color, glow }) => (
  <div className="relative shrink-0">
    <div
      className="w-2 h-2 rounded-full"
      style={{
        background: color,
        boxShadow: glow ? `0 0 8px ${color}` : 'none',
      }}
    />
    {glow && (
      <motion.div
        className="absolute inset-0 rounded-full"
        style={{ background: color }}
        animate={{ scale: [1, 1.8, 1], opacity: [0.6, 0, 0.6] }}
        transition={{ repeat: Infinity, duration: 1.8 }}
      />
    )}
  </div>
);

// ── Agent avatar ──────────────────────────────────────────────────────────────

const AgentAvatar: React.FC<{ agent: typeof AGENTS[0]; active?: boolean; size?: number }> = ({
  agent, active, size = 32,
}) => (
  <div
    className="shrink-0 flex items-center justify-center font-black rounded-full"
    style={{
      width: size,
      height: size,
      fontSize: size * 0.36,
      background: `${agent.color}18`,
      border: `2px solid ${active ? agent.color : agent.color + '40'}`,
      color: agent.color,
      boxShadow: active ? `0 0 12px ${agent.color}50` : 'none',
    }}
  >
    {agent.role.charAt(0)}
  </div>
);

// ── Thread connector ──────────────────────────────────────────────────────────

const ThreadConnector: React.FC<{
  fromColor: string;
  toColor: string;
  isActive?: boolean;
}> = ({ fromColor, toColor, isActive }) => (
  <div className="flex items-center gap-2 px-6 py-1.5">
    <div className="w-4 h-4 opacity-20 shrink-0" />
    <div className="flex-1 flex flex-col gap-1">
      <div className="flex items-center gap-1.5">
        <div className="w-8" />
        <div className="flex-1 flex items-center">
          {Array.from({ length: 6 }).map((_, i) => (
            <motion.div
              key={i}
              className="h-px flex-1 rounded-full"
              style={{ background: `linear-gradient(to right, ${fromColor}, ${toColor})`, opacity: 0.2 }}
              animate={isActive ? { opacity: [0.1, 0.5, 0.1] } : { opacity: 0.15 }}
              transition={{ repeat: isActive ? Infinity : 0, duration: 1.2, delay: i * 0.1 }}
            />
          ))}
          <motion.div
            className="ml-1 text-[10px]"
            style={{ color: toColor, opacity: 0.5 }}
          >
            ↓
          </motion.div>
        </div>
      </div>
    </div>
  </div>
);

// ── Message Thread Card ───────────────────────────────────────────────────────

const ThreadCard: React.FC<{
  thread: MessageThread;
  isLatest: boolean;
  nextAgentIdx?: number;
}> = ({ thread, isLatest, nextAgentIdx }) => {
  const agent = AGENTS[thread.agentIndex] ?? AGENTS[0];
  const agentState = useStore((s) => s.agentStates.find((a) => a.index === thread.agentIndex));
  const isActive = (agentState?.status === 'working' || agentState?.status === 'reviewing') && isLatest;
  const hasSuccess = thread.entries.some((e) => e.level === 'success');

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="px-5">
        {/* Agent header row */}
        <div className="flex items-center gap-2.5 mb-2">
          <AgentAvatar agent={agent} active={isActive} size={28} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span
                className="text-[10px] font-black uppercase tracking-widest truncate"
                style={{ color: isActive ? agent.color : agent.color + '99' }}
              >
                {agent.role.replace(' Designer', '').replace(' Manager', ' Mgr')}
              </span>
              {isActive && (
                <motion.span
                  className="text-[8px] font-black px-1.5 py-0.5 rounded-full shrink-0"
                  style={{ background: `${agent.color}18`, color: agent.color }}
                  animate={{ opacity: [1, 0.4, 1] }}
                  transition={{ repeat: Infinity, duration: 1.5 }}
                >
                  LIVE
                </motion.span>
              )}
              {!isActive && hasSuccess && (
                <span
                  className="text-[8px] font-black px-1.5 py-0.5 rounded-full shrink-0"
                  style={{ background: `${agent.color}12`, color: agent.color + '80' }}
                >
                  done
                </span>
              )}
            </div>
          </div>
          <span className="text-[8px] font-mono shrink-0" style={{ color: '#3f3f46' }}>
            {thread.entries[thread.entries.length - 1].timestamp}
          </span>
        </div>

        {/* Message bubble */}
        <div
          className="ml-9 rounded-2xl rounded-tl-sm px-3.5 py-2.5 space-y-1.5"
          style={{
            background: isActive
              ? `${agent.color}0e`
              : hasSuccess
              ? `${agent.color}08`
              : 'rgba(255,255,255,0.03)',
            border: `1px solid ${isActive ? agent.color + '28' : agent.color + '14'}`,
          }}
        >
          {thread.entries.map((entry) => {
            const icon  = LEVEL_ICON[entry.level] ?? '›';
            const color = levelColor(entry.level, agent.color);
            const text  = cleanMessage(entry.message);
            const isOut = entry.level === 'success';

            return (
              <div key={entry.id} className="flex items-start gap-2">
                <span
                  className="text-[10px] font-black shrink-0 mt-px w-3 text-center"
                  style={{ color }}
                >
                  {icon}
                </span>
                <p
                  className="text-[11px] leading-relaxed flex-1 min-w-0"
                  style={{ color: isOut ? '#d4d4d8' : '#71717a' }}
                >
                  {text}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Connector to next thread */}
      {nextAgentIdx !== undefined && nextAgentIdx !== thread.agentIndex && (
        <ThreadConnector
          fromColor={agent.color}
          toColor={AGENTS[nextAgentIdx]?.color ?? '#71717a'}
          isActive={isLatest}
        />
      )}
    </motion.div>
  );
};

// ── Live Review Panel ─────────────────────────────────────────────────────────

const LiveReviewPanel: React.FC<{
  targetAgentIdx: number | null;
  messages: ActivityEntry[];
}> = ({ targetAgentIdx, messages }) => {
  const dmAgent     = AGENTS[0];
  const targetAgent = targetAgentIdx !== null ? AGENTS[targetAgentIdx] : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="mx-5 rounded-2xl overflow-hidden"
      style={{
        background: 'rgba(251,191,36,0.06)',
        border: '1px solid rgba(251,191,36,0.22)',
      }}
    >
      {/* Header */}
      <div className="px-4 py-2 flex items-center gap-2" style={{ background: 'rgba(251,191,36,0.09)' }}>
        <PulseDot color="#fbbf24" glow />
        <span className="text-[9px] font-black uppercase tracking-widest" style={{ color: '#fbbf24' }}>
          Live Review Session
        </span>
        {targetAgent && (
          <span className="text-[9px] ml-auto" style={{ color: '#92400e' }}>
            {targetAgent.role.replace(' Designer', '').replace(' Manager', ' Mgr')}
          </span>
        )}
      </div>

      {/* Avatar connector */}
      <div className="px-4 pt-3 pb-2 flex items-center gap-2.5">
        <AgentAvatar agent={dmAgent} active size={30} />
        <div className="flex-1 flex items-center gap-0.5">
          {Array.from({ length: 12 }).map((_, i) => (
            <motion.div
              key={i}
              className="h-px flex-1 rounded-full"
              style={{ background: '#fbbf24' }}
              animate={{ opacity: [0.1, 0.9, 0.1] }}
              transition={{ repeat: Infinity, duration: 1.4, delay: i * 0.08 }}
            />
          ))}
        </div>
        {targetAgent ? (
          <AgentAvatar agent={targetAgent} active size={30} />
        ) : (
          <div
            className="w-[30px] h-[30px] rounded-full border border-dashed shrink-0"
            style={{ borderColor: 'rgba(251,191,36,0.3)' }}
          />
        )}
      </div>

      {/* Recent messages */}
      {messages.length > 0 && (
        <div className="px-4 pb-3 space-y-1">
          {messages.slice(0, 3).map((msg) => (
            <div key={msg.id} className="flex items-start gap-2">
              <span
                className="text-[9px] font-black mt-px shrink-0"
                style={{ color: msg.level === 'success' ? '#4ade80' : '#fbbf24' }}
              >
                {msg.level === 'success' ? '✓' : '→'}
              </span>
              <p className="text-[10px] leading-relaxed" style={{ color: '#a1a1aa' }}>
                {cleanMessage(msg.message)}
              </p>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
};

// ── Agent Status Bar ──────────────────────────────────────────────────────────

const AgentStatusBar: React.FC = () => {
  const agentStates = useStore((s) => s.agentStates);

  return (
    <div className="shrink-0 px-5 pb-3 grid grid-cols-4 gap-1.5">
      {AGENTS.map((agent) => {
        const state    = agentStates.find((s) => s.index === agent.index);
        const isActive = state?.status === 'working' || state?.status === 'reviewing';
        const isDone   = state?.status === 'complete';
        const pct      = state?.progress ?? 0;

        return (
          <motion.div
            key={agent.index}
            className="rounded-xl p-2 flex flex-col gap-1.5"
            animate={{
              background: isActive ? `${agent.color}12` : 'rgba(255,255,255,0.03)',
              borderColor: isActive ? `${agent.color}30` : 'rgba(255,255,255,0.06)',
            }}
            style={{ border: '1px solid' }}
            transition={{ duration: 0.4 }}
          >
            <div className="flex items-center gap-1.5">
              <PulseDot
                color={isDone ? '#3f3f46' : agent.color}
                glow={isActive}
              />
              <span
                className="text-[8px] font-black uppercase tracking-wide truncate"
                style={{ color: isActive ? agent.color : '#3f3f46' }}
              >
                {agent.role.split(' ')[0]}
              </span>
            </div>
            {isActive && pct > 0 && (
              <div className="h-0.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.07)' }}>
                <motion.div
                  className="h-full rounded-full"
                  style={{ background: agent.color }}
                  animate={{ width: `${pct}%` }}
                  transition={{ duration: 0.6 }}
                />
              </div>
            )}
            {!isActive && (
              <div
                className="h-0.5 rounded-full"
                style={{ background: isDone ? `${agent.color}30` : 'rgba(255,255,255,0.04)' }}
              />
            )}
          </motion.div>
        );
      })}
    </div>
  );
};

// ── Main View ─────────────────────────────────────────────────────────────────

const WarRoomView: React.FC = () => {
  const agentStates   = useStore((s) => s.agentStates);
  const activities    = useStore((s) => s.activities);
  const workflowPhase = useStore((s) => s.workflowPhase);
  const feedEndRef    = useRef<HTMLDivElement>(null);
  const scrollRef     = useRef<HTMLDivElement>(null);
  const [logFilter, setLogFilter]   = useState<'all' | 'key'>('all');
  const [autoScroll, setAutoScroll] = useState(true);

  const phaseLabel =
    workflowPhase === 'designing'    ? 'Design Phase' :
    workflowPhase === 'implementing' ? 'Build Phase'  :
    workflowPhase === 'reviewing'    ? 'Review Phase' : 'Active';

  const activeCount = agentStates.filter(
    (s) => s.status === 'working' || s.status === 'reviewing',
  ).length;

  // DM review state
  const dmState      = agentStates.find((s) => s.index === 0);
  const isReviewing  = dmState?.status === 'reviewing';
  const reviewTarget = isReviewing && dmState?.currentTask
    ? findReviewTarget(dmState.currentTask) : null;
  const dmActivities = [...activities].reverse().filter((e) => e.agentIndex === 0).slice(0, 3);

  // Build threads for conversation feed
  const filtered = activities
    .filter((e) => !isReviewing || e.agentIndex !== 0)   // DM shown in review panel
    .filter((e) => logFilter === 'all' || e.level === 'success' || e.level === 'warn')
    .slice(0, 100);

  const threads = buildThreads(filtered);

  // Auto-scroll to newest
  useEffect(() => {
    if (autoScroll && feedEndRef.current) {
      feedEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threads.length, autoScroll]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex flex-col h-full"
      style={{ background: '#09090b' }}
    >
      {/* ── Header ── */}
      <div className="shrink-0 px-5 pt-5 pb-3 flex items-start justify-between">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <PulseDot color={activeCount > 0 ? '#4ade80' : '#3f3f46'} glow={activeCount > 0} />
            <h2 className="text-[15px] font-black tracking-tight" style={{ color: '#fafafa' }}>
              War Room
            </h2>
          </div>
          <p className="text-[9px] font-bold uppercase tracking-widest pl-4" style={{ color: '#3f3f46' }}>
            {activeCount > 0 ? `${activeCount} agent${activeCount > 1 ? 's' : ''} active` : 'Standby'}
          </p>
        </div>

        <div className="flex flex-col items-end gap-2">
          <span
            className="text-[8px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full"
            style={{
              background: activeCount > 0 ? '#4ade8015' : 'rgba(255,255,255,0.05)',
              color:      activeCount > 0 ? '#4ade80'   : '#3f3f46',
              border:     `1px solid ${activeCount > 0 ? '#4ade8030' : 'rgba(255,255,255,0.08)'}`,
            }}
          >
            {phaseLabel}
          </span>

          <div className="flex items-center gap-1">
            {(['all', 'key'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setLogFilter(f)}
                className="text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full transition-all"
                style={{
                  background: logFilter === f ? '#27272a' : 'transparent',
                  color:      logFilter === f ? '#a1a1aa' : '#3f3f46',
                }}
              >
                {f === 'all' ? 'All' : 'Key'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Agent Status Bar ── */}
      <AgentStatusBar />

      {/* ── Separator ── */}
      <div className="shrink-0 mx-5 mb-3" style={{ height: 1, background: 'rgba(255,255,255,0.06)' }} />

      {/* ── Live Review Session (when DM is reviewing) ── */}
      <AnimatePresence>
        {isReviewing && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="shrink-0 overflow-hidden"
          >
            <div className="pb-3">
              <LiveReviewPanel targetAgentIdx={reviewTarget} messages={dmActivities} />
            </div>
            <div className="mx-5 mb-3" style={{ height: 1, background: 'rgba(255,255,255,0.06)' }} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Communication Feed label ── */}
      <div className="shrink-0 px-5 mb-3 flex items-center justify-between">
        <span className="text-[9px] font-black uppercase tracking-widest" style={{ color: '#3f3f46' }}>
          {isReviewing ? 'Team Activity' : 'Communication Feed'}
        </span>
        <button
          onClick={() => setAutoScroll((v) => !v)}
          className="text-[8px] font-bold uppercase tracking-wider"
          style={{ color: autoScroll ? '#4ade8070' : '#3f3f46' }}
        >
          {autoScroll ? '↓ auto' : 'paused'}
        </button>
      </div>

      {/* ── Conversation Threads ── */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto pb-6 min-h-0"
        style={{ scrollbarWidth: 'none' }}
        onScroll={(e) => {
          const el = e.currentTarget;
          const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
          setAutoScroll(nearBottom);
        }}
      >
        {threads.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16">
            <motion.div
              className="w-2 h-2 rounded-full"
              style={{ background: '#27272a' }}
              animate={{ opacity: [0.2, 1, 0.2] }}
              transition={{ repeat: Infinity, duration: 2 }}
            />
            <p className="text-[11px] text-center" style={{ color: '#3f3f46' }}>
              {activities.length === 0 ? 'Waiting for agents…' : 'No matching events'}
            </p>
          </div>
        ) : (
          <div className="space-y-1 pb-4">
            <AnimatePresence initial={false}>
              {threads.map((thread, i) => (
                <ThreadCard
                  key={thread.id}
                  thread={thread}
                  isLatest={i === threads.length - 1}
                  nextAgentIdx={
                    i < threads.length - 1 ? threads[i + 1].agentIndex : undefined
                  }
                />
              ))}
            </AnimatePresence>
            <div ref={feedEndRef} />
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default WarRoomView;
