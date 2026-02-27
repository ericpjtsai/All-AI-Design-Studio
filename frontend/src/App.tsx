import React from 'react';
import LeftPanel from './components/LeftPanel';
import RightPanel from './components/RightPanel';
import { useStore } from './store/useStore';
import { useSSEStream } from './hooks/useSSEStream';

const App: React.FC = () => {
  const sessionId = useStore((s) => s.sessionId);

  // Wire SSE events → Zustand store whenever a live session is active
  useSSEStream(sessionId);

  return (
    <div className="flex w-screen h-screen bg-zinc-950 overflow-hidden">
      {/* Left panel — agent graph, trust controls, brief input, confirmations */}
      <LeftPanel />

      {/* Panel divider */}
      <div className="w-px bg-zinc-800 shrink-0" />

      {/* Right panel — design outputs and activity log */}
      <RightPanel />
    </div>
  );
};

export default App;
