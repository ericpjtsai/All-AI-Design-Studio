import React, { useState } from 'react';
import { AnimatePresence } from 'motion/react';
import { useStore } from '../store/useStore';
import { AGENTS } from '../data/agents';
import AgentGraph from './AgentGraph';
import ConfirmationPrompt from './ConfirmationPrompt';
import ActivityFeed from './ActivityFeed';

const PHASE_LABELS = ['Brief', 'Scope', 'Design', 'Build', 'Review', 'Done'];
const PHASE_INDEX: Record<string, number> = {
  briefing: 0,
  scoping: 1,
  designing: 2,
  implementing: 3,
  reviewing: 4,
  complete: 5,
};

const LeftPanel: React.FC = () => {
  const workflowPhase = useStore((s) => s.workflowPhase);
  const pendingConfirmation = useStore((s) => s.pendingConfirmation);
  const sessionId = useStore((s) => s.sessionId);
  const sessionError = useStore((s) => s.sessionError);
  const agentTrust = useStore((s) => s.agentTrust);
  const startSession = useStore((s) => s.startSession);
  const resetSession = useStore((s) => s.resetSession);
  const setAgentTrust = useStore((s) => s.setAgentTrust);

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
    <div className="w-[390px] shrink-0 flex flex-col bg-white overflow-hidden" style={{ borderRadius: 32, border: '1px solid rgba(0,0,0,0.05)', boxShadow: '0 8px 40px rgba(0,0,0,0.08)' }}>
      {/* Accent bar */}
      <div className="h-1.5 w-full shrink-0" style={{ background: '#7EACEA' }} />

      {/* Header */}
      <div className="px-7 pt-6 pb-5 shrink-0" style={{ borderBottom: '1px solid #f4f4f5' }}>
        <div className="flex items-start gap-3.5 mb-5">
          <div className="w-2.5 h-10 rounded-full shrink-0 mt-0.5" style={{ background: '#7EACEA' }} />
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-black text-zinc-900 tracking-tight leading-tight">AI Design Studio</h1>
            <p className="text-[12px] font-medium mt-0.5" style={{ color: '#a1a1aa' }}>Multi-agent design workflow</p>
          </div>
          <div
            className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider shrink-0 mt-1"
            style={
              workflowPhase === 'complete'
                ? { background: '#dcfce7', color: '#16a34a' }
                : { background: '#f4f4f5', color: '#71717a' }
            }
          >
            {workflowPhase}
          </div>
        </div>

        {/* Phase stepper */}
        <div className="space-y-2">
          <div className="flex items-center gap-0.5">
            {PHASE_LABELS.map((_, i) => (
              <div
                key={i}
                className="h-1 rounded-full flex-1 transition-all duration-500"
                style={{ background: i <= phaseIdx ? '#7EACEA' : '#e4e4e7' }}
              />
            ))}
          </div>
          <div className="flex justify-between">
            {PHASE_LABELS.map((label, i) => (
              <span
                key={label}
                className="text-[9px] font-black uppercase tracking-wider"
                style={{ color: i === phaseIdx ? '#7EACEA' : i < phaseIdx ? '#a1a1aa' : '#d4d4d8' }}
              >
                {label}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Error banner */}
      {sessionError && (
        <div className="mx-5 mt-4 p-3.5 rounded-2xl flex items-start gap-2.5 shrink-0" style={{ background: '#fef2f2', border: '1px solid #fee2e2' }}>
          <span className="text-sm leading-none mt-0.5" style={{ color: '#ef4444' }}>⚠</span>
          <p className="flex-1 text-[11px] font-semibold leading-snug min-w-0" style={{ color: '#dc2626' }}>{sessionError}</p>
          <button onClick={resetSession} className="shrink-0 text-[10px] font-black uppercase tracking-wider transition-colors hover:opacity-70" style={{ color: '#ef4444' }}>
            Reset
          </button>
        </div>
      )}

      {/* Brief input */}
      {!sessionId && workflowPhase === 'briefing' && (
        <div className="px-7 py-5 shrink-0" style={{ borderBottom: '1px solid #f4f4f5' }}>
          <p className="text-[10px] font-black uppercase tracking-widest mb-3" style={{ color: '#a1a1aa' }}>Design Brief</p>
          <textarea
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
            placeholder="Describe the product or UI you want the team to design…"
            className="w-full rounded-2xl px-4 py-3 text-[13px] font-medium placeholder:font-medium focus:outline-none resize-none transition-all leading-relaxed"
            style={{
              background: '#f9f9f9',
              border: '1.5px solid #e4e4e7',
              color: '#18181b',
            }}
            rows={3}
            onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleStart(); }}
          />
          <button
            onClick={handleStart}
            disabled={!brief.trim() || launching}
            className="mt-3 w-full py-3 rounded-xl text-[11px] font-black uppercase tracking-widest text-white transition-all active:scale-[0.98] disabled:opacity-30 disabled:cursor-default"
            style={{ background: '#18181b', boxShadow: '0 4px 16px rgba(0,0,0,0.12)' }}
          >
            {launching ? 'Launching…' : 'Start Session ⌘↵'}
          </button>
        </div>
      )}

      {/* Agent graph */}
      <div className="shrink-0" style={{ borderBottom: '1px solid #f4f4f5' }}>
        <AgentGraph />
      </div>

      {/* Trust levels */}
      <div className="px-7 py-4 shrink-0" style={{ borderBottom: '1px solid #f4f4f5' }}>
        <p className="text-[10px] font-black uppercase tracking-widest mb-3" style={{ color: '#a1a1aa' }}>Trust Levels</p>
        <div className="space-y-3">
          {AGENTS.map((agent) => {
            const pct = Math.round(agentTrust[agent.index] * 100);
            return (
              <div key={agent.index} className="flex items-center gap-2.5">
                <div className="w-2 h-2 rounded-full shrink-0" style={{ background: agent.color }} />
                <span className="text-[11px] font-medium w-[88px] shrink-0 truncate" style={{ color: '#71717a' }}>
                  {agent.role.replace(' Designer', '').replace(' Manager', ' Mgr')}
                </span>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={pct}
                  disabled={!!sessionId}
                  aria-label={`${agent.role} trust level: ${pct}%`}
                  title={`${agent.role} trust level`}
                  onChange={(e) => setAgentTrust(agent.index, Number(e.target.value) / 100)}
                  className="flex-1 h-1 rounded-full appearance-none cursor-pointer disabled:cursor-default disabled:opacity-40"
                  style={{
                    background: `linear-gradient(to right, ${agent.color} 0%, ${agent.color} ${pct}%, #e4e4e7 ${pct}%, #e4e4e7 100%)`,
                    accentColor: agent.color,
                    color: agent.color,
                  }}
                />
                <span
                  className="text-[10px] font-bold tabular-nums w-7 text-right shrink-0"
                  style={{ color: pct >= 70 ? agent.color : '#d4d4d8' }}
                >
                  {pct}%
                </span>
              </div>
            );
          })}
        </div>
        {sessionId && (
          <p className="text-[9px] mt-2.5" style={{ color: '#d4d4d8' }}>Trust levels locked during active session.</p>
        )}
      </div>

      {/* Confirmation prompt */}
      <div className="px-5 shrink-0">
        <AnimatePresence>
          {pendingConfirmation && (
            <ConfirmationPrompt confirmation={pendingConfirmation} agentColor={orchestrator.color} />
          )}
        </AnimatePresence>
      </div>

      {/* Activity feed */}
      <div className="flex-1 overflow-hidden min-h-0" style={{ borderTop: '1px solid #f4f4f5' }}>
        <ActivityFeed />
      </div>
    </div>
  );
};

export default LeftPanel;
