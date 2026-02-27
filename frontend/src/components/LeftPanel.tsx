import React, { useState } from 'react';
import { AnimatePresence } from 'motion/react';
import { useStore } from '../store/useStore';
import { AGENTS } from '../data/agents';
import AgentGraph from './AgentGraph';
import ConfirmationPrompt from './ConfirmationPrompt';
import ActivityFeed from './ActivityFeed';

const PHASE_LABELS = ['Briefing', 'Scoping', 'Designing', 'Implementing', 'Reviewing', 'Complete'];
const PHASE_INDEX: Record<string, number> = {
  briefing: 0,
  scoping: 1,
  designing: 2,
  implementing: 3,
  reviewing: 4,
  complete: 5,
};

const LeftPanel: React.FC = () => {
  const {
    workflowPhase,
    pendingConfirmation,
    sessionId,
    sessionError,
    agentTrust,
    startSession,
    resetSession,
    setAgentTrust,
  } = useStore();

  const orchestrator = AGENTS.find((a) => a.isOrchestrator)!;
  const phaseIdx = PHASE_INDEX[workflowPhase] ?? 0;
  const [brief, setBrief] = useState('');
  const [launching, setLaunching] = useState(false);

  const handleStart = async () => {
    if (!brief.trim() || launching) return;
    setLaunching(true);
    await startSession(brief.trim());
    setLaunching(false);
  };

  return (
    <div className="w-[380px] shrink-0 flex flex-col bg-zinc-950 overflow-hidden">
      {/* ── Header ── */}
      <div className="p-5 border-b border-zinc-800 shrink-0">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-2 h-8 rounded-full bg-[#7EACEA]" />
          <div>
            <h1 className="text-white font-black text-base tracking-tight">AI Design Studio</h1>
            <p className="text-zinc-600 text-[10px] font-medium uppercase tracking-wider">
              Multi-agent workflow
            </p>
          </div>
          <div className="ml-auto">
            <div
              className={`px-2 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                workflowPhase === 'complete'
                  ? 'bg-green-500/15 text-green-400'
                  : 'bg-[#7EACEA]/10 text-[#7EACEA]'
              }`}
            >
              {workflowPhase}
            </div>
          </div>
        </div>

        {/* Phase progress stepper */}
        <div className="space-y-1.5">
          <div className="flex items-center gap-0.5">
            {PHASE_LABELS.map((_, i) => (
              <div
                key={i}
                className="h-1 rounded-full flex-1 transition-all duration-500"
                style={{ backgroundColor: i <= phaseIdx ? '#7EACEA' : '#27272a' }}
              />
            ))}
          </div>
          <div className="flex justify-between">
            {PHASE_LABELS.map((label, i) => (
              <span
                key={label}
                className="text-[9px] font-bold uppercase tracking-wider"
                style={{
                  color: i === phaseIdx ? '#7EACEA' : i < phaseIdx ? '#52525b' : '#3f3f46',
                }}
              >
                {label}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ── Error banner ── */}
      {sessionError && (
        <div className="mx-4 mt-3 p-3 rounded-xl bg-red-500/10 border border-red-500/30 flex items-start gap-2.5 shrink-0">
          <span className="text-red-400 text-base leading-none mt-0.5">⚠</span>
          <div className="flex-1 min-w-0">
            <p className="text-red-400 text-[11px] font-semibold leading-snug">{sessionError}</p>
          </div>
          <button
            type="button"
            onClick={resetSession}
            className="shrink-0 text-[10px] font-black uppercase tracking-wider text-red-400 hover:text-red-300 transition-colors"
          >
            Reset
          </button>
        </div>
      )}

      {/* ── Brief input (shown only before session starts) ── */}
      {!sessionId && workflowPhase === 'briefing' && (
        <div className="p-4 border-b border-zinc-800 shrink-0">
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-600 mb-2">
            Design Brief
          </p>
          <textarea
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
            placeholder="Describe the product or UI you want the team to design…"
            className="w-full bg-zinc-900 border border-zinc-800 focus:border-zinc-600 rounded-xl px-3 py-2.5 text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none resize-none transition-colors leading-relaxed"
            rows={3}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleStart();
            }}
          />
          <button
            type="button"
            onClick={handleStart}
            disabled={!brief.trim() || launching}
            className="mt-2 w-full py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest text-zinc-950 bg-[#7EACEA] hover:bg-[#9DBDEE] disabled:opacity-40 disabled:cursor-default transition-all active:scale-[0.98]"
          >
            {launching ? 'Launching…' : 'Start Session ⌘↵'}
          </button>
        </div>
      )}

      {/* ── Agent interaction graph ── */}
      <div className="border-b border-zinc-800 shrink-0">
        <AgentGraph />
      </div>

      {/* ── Trust levels ── */}
      <div className="px-4 py-3 border-b border-zinc-800 shrink-0">
        <p className="text-[9px] font-black uppercase tracking-widest text-zinc-600 mb-2.5">
          Trust Levels
        </p>
        <div className="space-y-2">
          {AGENTS.map((agent) => {
            const pct = Math.round(agentTrust[agent.index] * 100);
            return (
              <div key={agent.index} className="flex items-center gap-2">
                {/* Color dot */}
                <div
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: agent.color }}
                />
                {/* Name */}
                <span className="text-[10px] text-zinc-400 w-[90px] shrink-0 truncate">
                  {agent.role.replace(' Designer', '').replace(' Manager', ' Mgr')}
                </span>
                {/* Slider */}
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={pct}
                  disabled={!!sessionId}
                  aria-label={`${agent.role} trust level: ${pct}%`}
                  title={`${agent.role} trust level`}
                  onChange={(e) => setAgentTrust(agent.index, Number(e.target.value) / 100)}
                  className="flex-1 h-1 rounded-full appearance-none cursor-pointer disabled:cursor-default disabled:opacity-50"
                  style={{
                    background: `linear-gradient(to right, ${agent.color} 0%, ${agent.color} ${pct}%, #27272a ${pct}%, #27272a 100%)`,
                    accentColor: agent.color,
                  }}
                />
                {/* Percentage */}
                <span
                  className="text-[10px] font-bold tabular-nums w-7 text-right shrink-0"
                  style={{ color: pct >= 70 ? agent.color : '#52525b' }}
                >
                  {pct}%
                </span>
              </div>
            );
          })}
        </div>
        {sessionId && (
          <p className="text-[9px] text-zinc-600 mt-1.5">Trust levels locked during session.</p>
        )}
      </div>

      {/* ── Confirmation prompt (when pending) ── */}
      <div className="px-4 shrink-0">
        <AnimatePresence>
          {pendingConfirmation && (
            <ConfirmationPrompt
              confirmation={pendingConfirmation}
              agentColor={orchestrator.color}
            />
          )}
        </AnimatePresence>
      </div>

      {/* ── Activity feed (compact latest entries) ── */}
      <div className="flex-1 overflow-hidden border-t border-zinc-800 min-h-0">
        <ActivityFeed />
      </div>
    </div>
  );
};

export default LeftPanel;
