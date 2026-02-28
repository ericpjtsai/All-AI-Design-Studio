import React, { useEffect, useRef, useState } from 'react';
import { PlaygroundScene } from '../three/playground/PlaygroundScene';
import PlaygroundOverlay from './playground/PlaygroundOverlay';

const PlaygroundPanel: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<PlaygroundScene | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // Defer to next frame so the container has actual dimensions after layout
    const rafId = requestAnimationFrame(() => {
      if (containerRef.current && !sceneRef.current) {
        sceneRef.current = new PlaygroundScene(containerRef.current);
        setTimeout(() => setIsReady(true), 100);
      }
    });

    return () => {
      cancelAnimationFrame(rafId);
      if (sceneRef.current) {
        sceneRef.current.dispose();
        sceneRef.current = null;
      }
    };
  }, []);

  return (
    <div
      className="w-[480px] h-full shrink-0 relative overflow-hidden bg-white"
      style={{
        borderRadius: 32,
        border: '1px solid rgba(0,0,0,0.05)',
        boxShadow: '0 8px 40px rgba(0,0,0,0.08)',
      }}
    >
      {/* Three.js canvas container */}
      <div ref={containerRef} className="absolute inset-0 w-full h-full" />

      {/* Loading overlay */}
      {!isReady && (
        <div className="absolute inset-0 flex items-center justify-center bg-white z-20">
          <div className="text-center">
            <div className="w-12 h-12 border-2 border-zinc-200 border-t-[#7EACEA] rounded-full animate-spin mx-auto mb-4" />
            <p className="text-[11px] font-black uppercase tracking-widest text-zinc-400">
              Initializing WebGPU…
            </p>
          </div>
        </div>
      )}

      {/* UI Overlay */}
      {isReady && <PlaygroundOverlay />}
    </div>
  );
};

export default PlaygroundPanel;
