import React, { useState } from 'react';
import { AnimatePresence } from 'motion/react';
import { useStore } from '../store/useStore';
import { AGENTS } from '../data/agents';
import AgentCard from './AgentCard';
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
  const { workflowPhase, agentStates, pendingConfirmation, sessionId, startSession } = useStore();
  const phaseIdx = PHASE_INDEX[workflowPhase] ?? 0;
  const orchestrator = AGENTS.find((a) => a.isOrchestrator)!;
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
      <div className="p-5 border-b border-zinc-800">
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
                style={{
                  backgroundColor: i <= phaseIdx ? '#7EACEA' : '#27272a',
                }}
              />
            ))}
          </div>
          <div className="flex justify-between">
            {PHASE_LABELS.map((label, i) => (
              <span
                key={label}
                className="text-[9px] font-bold uppercase tracking-wider"
                style={{
                  color:
                    i === phaseIdx ? '#7EACEA' : i < phaseIdx ? '#52525b' : '#3f3f46',
                }}
              >
                {label}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ── Brief input (shown only before session starts) ── */}
      {!sessionId && workflowPhase === 'briefing' && (
        <div className="p-4 border-b border-zinc-800">
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

      {/* ── Agent cards + confirmation prompts ── */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2 [scrollbar-width:thin] [scrollbar-color:#3f3f46_transparent]">
        {AGENTS.map((agent) => {
          const runtimeState = agentStates.find((a) => a.index === agent.index)!;
          const showConfirmation =
            agent.isOrchestrator && pendingConfirmation !== null;

          return (
            <div key={agent.index}>
              <AgentCard agent={agent} runtimeState={runtimeState} />

              {/* Confirmation prompt sits directly under the Design Manager card */}
              <AnimatePresence>
                {showConfirmation && (
                  <ConfirmationPrompt
                    confirmation={pendingConfirmation!}
                    agentColor={orchestrator.color}
                  />
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>

      {/* ── Activity feed ── */}
      <div className="border-t border-zinc-800">
        <ActivityFeed />
      </div>
    </div>
  );
};

export default LeftPanel;
