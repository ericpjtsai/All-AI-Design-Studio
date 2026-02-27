import React, { useEffect, useRef, useState } from 'react';
import { PlaygroundScene } from '../three/playground/PlaygroundScene';
import PlaygroundOverlay from './playground/PlaygroundOverlay';

interface AvatarPlaygroundProps {
  onExit: () => void;
}

const AvatarPlayground: React.FC<AvatarPlaygroundProps> = ({ onExit }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<PlaygroundScene | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (containerRef.current && !sceneRef.current) {
      sceneRef.current = new PlaygroundScene(containerRef.current);
      // Give a brief delay to allow the scene to start initializing
      setTimeout(() => setIsReady(true), 100);
    }

    return () => {
      if (sceneRef.current) {
        sceneRef.current.dispose();
        sceneRef.current = null;
      }
    };
  }, []);

  return (
    <div className="relative w-screen h-screen bg-white overflow-hidden">
      {/* Three.js canvas container */}
      <div ref={containerRef} className="absolute inset-0 w-full h-full" />

      {/* Loading overlay */}
      {!isReady && (
        <div className="absolute inset-0 flex items-center justify-center bg-white z-20">
          <div className="text-center">
            <div className="w-12 h-12 border-2 border-zinc-200 border-t-[#7EACEA] rounded-full animate-spin mx-auto mb-4" />
            <p className="text-[11px] font-black uppercase tracking-widest text-zinc-400">Initializing WebGPU…</p>
          </div>
        </div>
      )}

      {/* UI Overlay */}
      {isReady && <PlaygroundOverlay onExit={onExit} />}
    </div>
  );
};

export default AvatarPlayground;
