import React, { useState } from 'react';
import { usePlaygroundStore } from '../../playground/store';
import { useStore } from '../../store/useStore';
import { AGENTS } from '../../playground/agents';
import { AGENTS as STUDIO_AGENTS } from '../../data/agents';
import { AnimatePresence } from 'motion/react';
import PlaygroundChat from './PlaygroundChat';
import ActivityFeed from '../ActivityFeed';

const PHASE_LABELS = ['Brief', 'Scope', 'Design', 'Build', 'Review', 'Done'];
const PHASE_INDEX: Record<string, number> = {
  briefing: 0, scoping: 1, designing: 2, implementing: 3, reviewing: 4, complete: 5,
};

const PlaygroundOverlay: React.FC = () => {
  const {
    selectedNpcIndex,
    selectedPosition,
    hoveredNpcIndex,
    hoverPosition,
    startChat,
    endChat,
    isChatting,
    performance,
    boidsParams,
    setBoidsParams,
    worldSize,
    setWorldSize,
  } = usePlaygroundStore();

  // Studio state
  const workflowPhase = useStore((s) => s.workflowPhase);
  const sessionId = useStore((s) => s.sessionId);
  const sessionError = useStore((s) => s.sessionError);
  const agentTrust = useStore((s) => s.agentTrust);
  const resetSession = useStore((s) => s.resetSession);
  const setAgentTrust = useStore((s) => s.setAgentTrust);

  const [showControls, setShowControls] = useState(false);
  const [showActivity, setShowActivity] = useState(false);

  const phaseIdx = PHASE_INDEX[workflowPhase] ?? 0;
  const selectedAgent = selectedNpcIndex != null ? AGENTS[selectedNpcIndex] ?? null : null;
  const hoveredAgent = hoveredNpcIndex != null ? AGENTS[hoveredNpcIndex] ?? null : null;

  return (
    <div className="absolute inset-0 pointer-events-none z-10">
      <AnimatePresence>
        <PlaygroundChat />
      </AnimatePresence>

      {/* Selected bubble */}
      {selectedAgent && selectedPosition && (
        <div
          className="absolute z-10 pointer-events-none"
          style={{
            left: selectedPosition.x,
            top: selectedPosition.y,
            transform: 'translate(-50%, -100%) translateY(-10px)',
          }}
        >
          <div className="bg-zinc-800/90 backdrop-blur-md px-2.5 py-1 rounded-full border border-white/10 shadow-xl flex items-center gap-1.5 whitespace-nowrap">
            <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: selectedAgent.color }} />
            {selectedAgent.isPlayer ? (
              <span className="text-[9px] font-black uppercase tracking-widest text-white">CEO (You)</span>
            ) : (
              <>
                <span className="text-[9px] font-black uppercase tracking-widest text-white">{selectedAgent.role}</span>
                <span className="text-[9px] text-white/40">·</span>
                <span className="text-[9px] font-bold uppercase tracking-widest text-white/70">{selectedAgent.department}</span>
              </>
            )}
          </div>
        </div>
      )}

      {/* Hover bubble */}
      {hoveredAgent && hoverPosition && hoveredNpcIndex !== selectedNpcIndex && (
        <div
          className="absolute z-10 pointer-events-none"
          style={{
            left: hoverPosition.x,
            top: hoverPosition.y,
            transform: 'translate(-50%, -100%) translateY(-10px)',
          }}
        >
          <div className="bg-zinc-800/90 backdrop-blur-md px-2.5 py-1 rounded-full border border-white/10 shadow-xl flex items-center gap-1.5 whitespace-nowrap">
            <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: hoveredAgent.color }} />
            <span className="text-[9px] font-black uppercase tracking-widest text-white">{hoveredAgent.role}</span>
            <span className="text-[9px] text-white/40">·</span>
            <span className="text-[9px] font-bold uppercase tracking-widest text-white/70">{hoveredAgent.department}</span>
          </div>
        </div>
      )}

      {/* ─── Top bar ─── */}
      <div className="absolute top-3 left-3 right-3 flex justify-between items-start pointer-events-auto">
        {/* Title + Phase */}
        <div className="bg-white/90 backdrop-blur-xl p-3 rounded-2xl border border-black/5 shadow-lg max-w-[240px]">
          <div className="flex items-start gap-2 mb-2">
            <div className="w-1.5 h-6 bg-[#7EACEA] rounded-full shrink-0 mt-0.5" />
            <div className="min-w-0">
              <h1 className="text-sm font-black text-zinc-900 tracking-tight leading-tight">AI Design Studio</h1>
              <p className="text-[9px] text-zinc-400 font-medium">Multi-agent design workflow</p>
            </div>
            <div
              className="px-1.5 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider shrink-0"
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
          <div className="space-y-1">
            <div className="flex items-center gap-0.5">
              {PHASE_LABELS.map((_, i) => (
                <div
                  key={i}
                  className="h-0.5 rounded-full flex-1 transition-all duration-500"
                  style={{ background: i <= phaseIdx ? '#7EACEA' : '#e4e4e7' }}
                />
              ))}
            </div>
            <div className="flex justify-between">
              {PHASE_LABELS.map((label, i) => (
                <span
                  key={label}
                  className="text-[7px] font-bold uppercase tracking-wider"
                  style={{ color: i === phaseIdx ? '#7EACEA' : i < phaseIdx ? '#a1a1aa' : '#d4d4d8' }}
                >
                  {label}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Control buttons */}
        <div className="flex gap-1.5">
          <button
            onClick={() => setShowActivity(!showActivity)}
            className={`px-2 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all border ${
              showActivity
                ? 'bg-zinc-900 text-white border-zinc-900'
                : 'bg-white/90 text-zinc-500 border-black/5 hover:bg-white hover:text-zinc-900'
            }`}
          >
            Log
          </button>
          <button
            onClick={() => setShowControls(!showControls)}
            className={`px-2 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all border ${
              showControls
                ? 'bg-zinc-900 text-white border-zinc-900'
                : 'bg-white/90 text-zinc-500 border-black/5 hover:bg-white hover:text-zinc-900'
            }`}
          >
            Controls
          </button>
        </div>
      </div>

      {/* ─── Error banner ─── */}
      {sessionError && (
        <div className="absolute top-16 left-3 right-3 pointer-events-auto">
          <div className="p-2.5 rounded-xl flex items-start gap-2" style={{ background: '#fef2f2', border: '1px solid #fee2e2' }}>
            <span className="text-xs leading-none mt-0.5" style={{ color: '#ef4444' }}>⚠</span>
            <p className="flex-1 text-[10px] font-semibold leading-snug min-w-0" style={{ color: '#dc2626' }}>{sessionError}</p>
            <button onClick={resetSession} className="shrink-0 text-[9px] font-black uppercase tracking-wider hover:opacity-70" style={{ color: '#ef4444' }}>
              Reset
            </button>
          </div>
        </div>
      )}

      {/* ─── Controls panel ─── */}
      {showControls && (
        <div className="absolute top-14 right-3 w-52 bg-white/95 backdrop-blur-xl rounded-2xl border border-black/5 shadow-2xl p-3 pointer-events-auto overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-0.5 bg-[#7EACEA] rounded-t-2xl" />
          <h3 className="text-[8px] font-black uppercase tracking-widest text-zinc-400 mb-2 mt-0.5">Simulation</h3>

          <div className="space-y-2">
            {/* World Size */}
            <div>
              <div className="flex justify-between mb-0.5">
                <span className="text-[9px] font-bold uppercase tracking-wider text-zinc-500">World Size</span>
                <span className="text-[9px] font-bold text-zinc-900 tabular-nums">{worldSize}</span>
              </div>
              <input
                type="range" min={10} max={50} step={5} value={worldSize}
                onChange={(e) => setWorldSize(Number(e.target.value))}
                className="w-full accent-[#7EACEA] h-1"
              />
            </div>
            {/* Speed */}
            <div>
              <div className="flex justify-between mb-0.5">
                <span className="text-[9px] font-bold uppercase tracking-wider text-zinc-500">Speed</span>
                <span className="text-[9px] font-bold text-zinc-900 tabular-nums">{boidsParams.speed.toFixed(3)}</span>
              </div>
              <input
                type="range" min={0.005} max={0.08} step={0.005} value={boidsParams.speed}
                onChange={(e) => setBoidsParams({ speed: Number(e.target.value) })}
                className="w-full accent-[#7EACEA] h-1"
              />
            </div>
            {/* Separation */}
            <div>
              <div className="flex justify-between mb-0.5">
                <span className="text-[9px] font-bold uppercase tracking-wider text-zinc-500">Separation</span>
                <span className="text-[9px] font-bold text-zinc-900 tabular-nums">{boidsParams.separationRadius.toFixed(1)}</span>
              </div>
              <input
                type="range" min={0.3} max={2.0} step={0.1} value={boidsParams.separationRadius}
                onChange={(e) => setBoidsParams({ separationRadius: Number(e.target.value) })}
                className="w-full accent-[#7EACEA] h-1"
              />
            </div>
          </div>

          {/* Stats */}
          <div className="mt-2 pt-2 border-t border-zinc-100 grid grid-cols-3 gap-1">
            {[
              { label: 'FPS', value: performance.fps },
              { label: 'Draw', value: performance.drawCalls },
              { label: 'Tris', value: (performance.triangles / 1000).toFixed(0) + 'k' },
            ].map(({ label, value }) => (
              <div key={label} className="text-center">
                <p className="text-[7px] font-black uppercase tracking-widest text-zinc-400">{label}</p>
                <p className="text-[11px] font-black text-zinc-900">{value}</p>
              </div>
            ))}
          </div>

          {/* Trust Levels */}
          <div className="mt-2 pt-2 border-t border-zinc-100">
            <h3 className="text-[8px] font-black uppercase tracking-widest text-zinc-400 mb-2">Trust Levels</h3>
            <div className="space-y-1.5">
              {STUDIO_AGENTS.map((agent) => {
                const pct = Math.round(agentTrust[agent.index] * 100);
                return (
                  <div key={agent.index} className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: agent.color }} />
                    <span className="text-[8px] font-medium w-[60px] shrink-0 truncate" style={{ color: '#71717a' }}>
                      {agent.role.replace(' Designer', '').replace(' Manager', ' Mgr')}
                    </span>
                    <input
                      type="range" min="0" max="100" value={pct}
                      disabled={!!sessionId}
                      aria-label={`${agent.role} trust level: ${pct}%`}
                      onChange={(e) => setAgentTrust(agent.index, Number(e.target.value) / 100)}
                      className="flex-1 h-0.5 rounded-full appearance-none cursor-pointer disabled:cursor-default disabled:opacity-40"
                      style={{
                        background: `linear-gradient(to right, ${agent.color} 0%, ${agent.color} ${pct}%, #e4e4e7 ${pct}%, #e4e4e7 100%)`,
                        accentColor: agent.color,
                      }}
                    />
                    <span
                      className="text-[8px] font-bold tabular-nums w-6 text-right shrink-0"
                      style={{ color: pct >= 70 ? agent.color : '#d4d4d8' }}
                    >
                      {pct}%
                    </span>
                  </div>
                );
              })}
            </div>
            {sessionId && (
              <p className="text-[7px] mt-1.5" style={{ color: '#d4d4d8' }}>Locked during active session.</p>
            )}
          </div>
        </div>
      )}

      {/* ─── Activity Feed panel ─── */}
      {showActivity && (
        <div className="absolute top-14 left-3 w-56 max-h-[50%] bg-white/95 backdrop-blur-xl rounded-2xl border border-black/5 shadow-2xl overflow-hidden pointer-events-auto">
          <div className="absolute top-0 left-0 w-full h-0.5 bg-[#7EACEA] rounded-t-2xl" />
          <div className="scale-[0.85] origin-top-left">
            <ActivityFeed />
          </div>
        </div>
      )}

      {/* ─── NPC info panel ─── */}
      {selectedAgent && !selectedAgent.isPlayer && (
        <div className="absolute bottom-4 left-3 w-56 bg-white/85 backdrop-blur-2xl rounded-2xl border border-black/5 shadow-2xl p-4 pointer-events-auto overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-0.5" style={{ backgroundColor: selectedAgent.color }} />
          <div className="mb-2">
            <p className="text-[8px] font-black uppercase tracking-widest text-zinc-400 mb-0.5">{selectedAgent.department}</p>
            <h2 className="text-sm font-black text-zinc-900 leading-tight">{selectedAgent.role}</h2>
          </div>
          <p className="text-[10px] text-zinc-600 leading-relaxed mb-2 italic">"{selectedAgent.mission}"</p>
          <div className="flex flex-wrap gap-0.5 mb-2">
            {selectedAgent.expertise.map((tag) => (
              <span key={tag} className="text-[8px] font-bold bg-zinc-100 text-zinc-500 px-1.5 py-0.5 rounded-full">{tag}</span>
            ))}
          </div>
          <p className="text-[9px] text-zinc-400 leading-snug mb-3">{selectedAgent.personality}</p>
          {isChatting ? (
            <button
              onClick={() => endChat()}
              style={{ backgroundColor: selectedAgent.color }}
              className="w-full py-2 text-white rounded-xl text-[9px] font-black uppercase tracking-widest hover:brightness-90 active:scale-[0.98] transition-all"
            >
              End Chat
            </button>
          ) : (
            <button
              onClick={() => selectedNpcIndex !== null && startChat(selectedNpcIndex)}
              className="w-full py-2 bg-zinc-900 text-white rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-black active:scale-[0.98] transition-all"
            >
              Start Chat
            </button>
          )}
        </div>
      )}

      {/* ─── Controls hint ─── */}
      <div className="absolute bottom-3 right-3 pointer-events-none">
        <div className="bg-white/60 backdrop-blur-sm border border-black/5 rounded-xl px-2.5 py-2 text-[8px] text-zinc-400 font-medium leading-relaxed">
          <p className="font-black text-zinc-500 uppercase tracking-widest mb-0.5 text-[7px]">Controls</p>
          <p>Click floor → move</p>
          <p>Click agent → select</p>
          <p>Drag → orbit</p>
          <p>Scroll → zoom</p>
        </div>
      </div>
    </div>
  );
};

export default PlaygroundOverlay;
