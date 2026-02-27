import React, { useState } from 'react';
import LeftPanel from './components/LeftPanel';
import RightPanel from './components/RightPanel';
import AvatarPlayground from './components/AvatarPlayground';
import { useStore } from './store/useStore';
import { useSSEStream } from './hooks/useSSEStream';

const App: React.FC = () => {
  const sessionId = useStore((s) => s.sessionId);
  useSSEStream(sessionId);

  const [showPlayground, setShowPlayground] = useState(false);

  if (showPlayground) {
    return <AvatarPlayground onExit={() => setShowPlayground(false)} />;
  }

  return (
    <div className="flex w-screen h-screen overflow-hidden p-4 gap-3" style={{ background: '#f4f4f5' }}>
      <LeftPanel />
      <RightPanel />

      {/* Playground entry button */}
      <button
        onClick={() => setShowPlayground(true)}
        className="fixed bottom-5 right-5 z-50 flex items-center gap-2 px-4 py-2.5 bg-white border border-black/8 rounded-2xl shadow-lg hover:shadow-xl transition-all hover:-translate-y-0.5 group"
      >
        <div className="w-2 h-2 rounded-full bg-[#7EACEA] group-hover:scale-125 transition-transform" />
        <span className="text-[11px] font-black uppercase tracking-widest text-zinc-600 group-hover:text-zinc-900 transition-colors">
          3D Playground
        </span>
      </button>
    </div>
  );
};

export default App;
