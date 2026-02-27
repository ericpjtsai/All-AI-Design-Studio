import React, { useState } from 'react';
import { usePlaygroundStore } from '../../playground/store';
import { AGENTS } from '../../playground/agents';
import { AnimatePresence } from 'motion/react';
import PlaygroundChat from './PlaygroundChat';

interface PlaygroundOverlayProps {
  onExit: () => void;
}

const PlaygroundOverlay: React.FC<PlaygroundOverlayProps> = ({ onExit }) => {
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

  const [showControls, setShowControls] = useState(false);

  const selectedAgent = selectedNpcIndex != null ? AGENTS[selectedNpcIndex] ?? null : null;
  const hoveredAgent = hoveredNpcIndex != null ? AGENTS[hoveredNpcIndex] ?? null : null;

  return (
    <div className="fixed inset-0 pointer-events-none z-10">
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
            transform: 'translate(-50%, -100%) translateY(-10px)'
          }}
        >
          <div className="bg-zinc-800/90 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 shadow-xl flex items-center gap-2 whitespace-nowrap">
            <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: selectedAgent.color }} />
            <div className="flex items-center gap-1.5">
              {selectedAgent.isPlayer ? (
                <span className="text-[10px] font-black uppercase tracking-widest text-white">CEO (You)</span>
              ) : (
                <>
                  <span className="text-[10px] font-black uppercase tracking-widest text-white">{selectedAgent.role}</span>
                  <span className="text-[10px] font-medium uppercase tracking-widest text-white/40">·</span>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-white/70">{selectedAgent.department}</span>
                </>
              )}
            </div>
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
            transform: 'translate(-50%, -100%) translateY(-10px)'
          }}
        >
          <div className="bg-zinc-800/90 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 shadow-xl flex items-center gap-2 whitespace-nowrap">
            <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: hoveredAgent.color }} />
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-black uppercase tracking-widest text-white">{hoveredAgent.role}</span>
              <span className="text-[10px] font-medium uppercase tracking-widest text-white/40">·</span>
              <span className="text-[10px] font-bold uppercase tracking-widest text-white/70">{hoveredAgent.department}</span>
            </div>
          </div>
        </div>
      )}

      {/* Top bar */}
      <div className="absolute top-4 left-4 right-4 flex justify-between items-start pointer-events-auto">
        {/* Title card */}
        <div className="bg-white p-4 rounded-[24px] border border-black/5 shadow-xl flex gap-3 items-start">
          <div className="w-2 h-8 bg-[#7EACEA] rounded-full shrink-0 mt-0.5" />
          <div>
            <h1 className="text-lg font-black text-zinc-900 tracking-tight leading-tight">Avatar Playground</h1>
            <p className="text-[11px] text-zinc-400 font-medium leading-snug">Three.js WebGPU · 4 agents · {performance.fps} fps</p>
          </div>
        </div>

        {/* Controls */}
        <div className="flex gap-2">
          <button
            onClick={() => setShowControls(!showControls)}
            className={`px-3 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all border ${
              showControls
                ? 'bg-zinc-900 text-white border-zinc-900'
                : 'bg-white/90 text-zinc-500 border-black/5 hover:bg-white hover:text-zinc-900'
            }`}
          >
            Controls
          </button>
          <button
            onClick={onExit}
            className="px-3 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all bg-white/90 text-zinc-500 border border-black/5 hover:bg-white hover:text-zinc-900"
          >
            ← Studio
          </button>
        </div>
      </div>

      {/* Controls panel */}
      {showControls && (
        <div className="absolute top-20 right-4 w-72 bg-white rounded-[24px] border border-black/5 shadow-2xl p-5 pointer-events-auto overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-[#7EACEA] rounded-t-[24px]" />
          <h3 className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-4 mt-1">Simulation Controls</h3>

          <div className="space-y-4">
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-[11px] font-black uppercase tracking-widest text-zinc-500">World Size</span>
                <span className="text-[11px] font-bold text-zinc-900">{worldSize}</span>
              </div>
              <input
                type="range" min={10} max={50} step={5} value={worldSize}
                onChange={(e) => setWorldSize(Number(e.target.value))}
                className="w-full accent-[#7EACEA]"
              />
            </div>

            <div>
              <div className="flex justify-between mb-1">
                <span className="text-[11px] font-black uppercase tracking-widest text-zinc-500">Speed</span>
                <span className="text-[11px] font-bold text-zinc-900">{boidsParams.speed.toFixed(3)}</span>
              </div>
              <input
                type="range" min={0.005} max={0.08} step={0.005} value={boidsParams.speed}
                onChange={(e) => setBoidsParams({ speed: Number(e.target.value) })}
                className="w-full accent-[#7EACEA]"
              />
            </div>

            <div>
              <div className="flex justify-between mb-1">
                <span className="text-[11px] font-black uppercase tracking-widest text-zinc-500">Separation</span>
                <span className="text-[11px] font-bold text-zinc-900">{boidsParams.separationRadius.toFixed(1)}</span>
              </div>
              <input
                type="range" min={0.3} max={2.0} step={0.1} value={boidsParams.separationRadius}
                onChange={(e) => setBoidsParams({ separationRadius: Number(e.target.value) })}
                className="w-full accent-[#7EACEA]"
              />
            </div>
          </div>

          {/* Stats */}
          <div className="mt-4 pt-4 border-t border-zinc-100 grid grid-cols-3 gap-2">
            {[
              { label: 'FPS', value: performance.fps },
              { label: 'Draw', value: performance.drawCalls },
              { label: 'Tris', value: (performance.triangles / 1000).toFixed(0) + 'k' },
            ].map(({ label, value }) => (
              <div key={label} className="text-center">
                <p className="text-[9px] font-black uppercase tracking-widest text-zinc-400">{label}</p>
                <p className="text-sm font-black text-zinc-900">{value}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* NPC info panel */}
      {selectedAgent && !selectedAgent.isPlayer && (
        <div className="absolute bottom-6 left-6 w-68 bg-white/85 backdrop-blur-2xl rounded-2xl border border-black/5 shadow-2xl p-5 pointer-events-auto overflow-hidden">
          <div
            className="absolute top-0 left-0 w-full h-1"
            style={{ backgroundColor: selectedAgent.color }}
          />
          <div className="flex items-start justify-between mb-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-0.5">{selectedAgent.department}</p>
              <h2 className="text-lg font-black text-zinc-900 leading-tight">{selectedAgent.role}</h2>
            </div>
          </div>

          <p className="text-xs text-zinc-600 leading-relaxed mb-3 italic">"{selectedAgent.mission}"</p>

          <div className="flex flex-wrap gap-1 mb-3">
            {selectedAgent.expertise.map((tag) => (
              <span key={tag} className="text-[10px] font-bold bg-zinc-100 text-zinc-500 px-2 py-0.5 rounded-full">{tag}</span>
            ))}
          </div>

          <p className="text-[11px] text-zinc-400 leading-snug mb-4">{selectedAgent.personality}</p>

          {isChatting ? (
            <button
              onClick={() => endChat()}
              style={{ backgroundColor: selectedAgent.color }}
              className="w-full py-2.5 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:brightness-90 active:scale-[0.98] transition-all"
            >
              End Chat
            </button>
          ) : (
            <button
              onClick={() => selectedNpcIndex !== null && startChat(selectedNpcIndex)}
              className="w-full py-2.5 bg-zinc-900 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-black active:scale-[0.98] transition-all"
            >
              Start Chat
            </button>
          )}
        </div>
      )}

      {/* Instructions hint */}
      <div className="absolute bottom-6 right-6 pointer-events-none">
        <div className="bg-white/70 backdrop-blur-sm border border-black/5 rounded-2xl px-4 py-3 text-[10px] text-zinc-400 font-medium leading-relaxed">
          <p className="font-black text-zinc-500 uppercase tracking-widest mb-1">Controls</p>
          <p>Click floor → move player</p>
          <p>Click agent → select / chat</p>
          <p>Drag → orbit camera</p>
          <p>Scroll → zoom</p>
        </div>
      </div>
    </div>
  );
};

export default PlaygroundOverlay;
