import React, { useEffect, useRef } from 'react';
import { Network } from 'lucide-react';
import { SceneManager } from '../three/SceneManager';
import { useStore } from '../store/useStore';
import GraphLabels from './GraphLabels';

const RightPanel: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<SceneManager | null>(null);
  const { graphVisible, toggleGraph } = useStore();

  useEffect(() => {
    if (containerRef.current && !sceneRef.current) {
      sceneRef.current = new SceneManager(containerRef.current);
    }
    return () => {
      sceneRef.current?.dispose();
      sceneRef.current = null;
    };
  }, []);

  return (
    <div className="flex-1 relative overflow-hidden bg-zinc-950">
      {/* Three.js canvas — fills the panel */}
      <div ref={containerRef} className="absolute inset-0" />

      {/* HTML label overlay for 3D nodes */}
      {graphVisible && <GraphLabels />}

      {/* Top-left panel label */}
      <div className="absolute top-5 left-5 z-10 pointer-events-none">
        <div className="bg-zinc-900/70 backdrop-blur-md border border-zinc-800 rounded-xl px-3 py-2">
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
            Agent Interaction Graph
          </p>
          <p className="text-[9px] text-zinc-700 mt-0.5">Drag to orbit · Scroll to zoom</p>
        </div>
      </div>

      {/* Top-right graph toggle */}
      <div className="absolute top-5 right-5 z-10">
        <button
          onClick={toggleGraph}
          className={`flex items-center gap-2 px-3 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest border transition-all ${
            graphVisible
              ? 'bg-white/8 border-white/15 text-zinc-300 hover:bg-white/12'
              : 'bg-zinc-900 border-zinc-700 text-zinc-600 hover:bg-zinc-800'
          }`}
        >
          <Network size={12} strokeWidth={3} />
          {graphVisible ? 'Graph On' : 'Graph Off'}
        </button>
      </div>

      {/* Corner legend */}
      <div className="absolute bottom-5 left-5 z-10 pointer-events-none space-y-1.5">
        {[
          { color: '#7EACEA', label: 'Design Manager (Hub)' },
          { color: '#22c55e', label: 'Senior Designer' },
          { color: '#ef4444', label: 'Junior Designer' },
          { color: '#EF52BA', label: 'Visual Designer' },
        ].map(({ color, label }) => (
          <div key={label} className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
            <span className="text-[10px] text-zinc-600 font-medium">{label}</span>
          </div>
        ))}
        <div className="flex items-center gap-2 mt-2">
          <div className="w-4 h-px bg-zinc-600" />
          <span className="text-[10px] text-zinc-700 font-medium">Idle connection</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-0.5 bg-[#7EACEA]" />
          <span className="text-[10px] text-zinc-700 font-medium">Active delegation</span>
        </div>
      </div>
    </div>
  );
};

export default RightPanel;
