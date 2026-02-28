import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import PlaygroundPanel from './components/PlaygroundPanel';
import RightPanel from './components/RightPanel';
import { useStore } from './store/useStore';
import { useSSEStream } from './hooks/useSSEStream';

// ── Full-screen briefing overlay ─────────────────────────────────────────────

const BriefingOverlay: React.FC = () => {
  const startSession = useStore((s) => s.startSession);
  const [brief, setBrief] = useState('');
  const [launching, setLaunching] = useState(false);

  const handleStart = async () => {
    if (!brief.trim() || launching) return;
    setLaunching(true);
    await startSession(brief.trim());
  };

  return (
    <motion.div
      key="briefing"
      className="absolute inset-0 z-50 flex flex-col items-center justify-center"
      style={{ background: '#f4f4f5' }}
      exit={{ opacity: 0, y: -40, scale: 0.97 }}
      transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
    >
      {/* Centered content */}
      <div className="flex flex-col items-center flex-1 justify-center">
        <div className="w-1.5 h-8 bg-[#7EACEA] rounded-full mb-4" />
        <h1 className="text-[22px] font-black text-zinc-900 tracking-tight mb-1">
          AI Design Studio
        </h1>
        <p className="text-[12px] font-medium" style={{ color: '#a1a1aa' }}>
          Multi-agent design workflow
        </p>
      </div>

      {/* Input pinned to bottom center */}
      <div className="w-full max-w-lg px-6 pb-10">
        <div
          className="rounded-2xl overflow-hidden"
          style={{ background: '#ffffff', border: '1px solid rgba(0,0,0,0.06)', boxShadow: '0 4px 24px rgba(0,0,0,0.06)' }}
        >
          <textarea
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
            placeholder="Describe what you want the team to design..."
            className="w-full px-4 pt-3.5 pb-2 text-[13px] font-medium placeholder:font-medium focus:outline-none resize-none leading-relaxed bg-transparent"
            style={{ color: '#18181b' }}
            rows={2}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleStart();
            }}
          />
          <div className="flex items-center justify-end px-3 pb-3">
            <button
              onClick={handleStart}
              disabled={!brief.trim() || launching}
              className="px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest text-white transition-all active:scale-[0.98] disabled:opacity-30 disabled:cursor-default"
              style={{ background: '#18181b' }}
            >
              {launching ? 'Launching...' : 'Start Project'}
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

// ── App ──────────────────────────────────────────────────────────────────────

const App: React.FC = () => {
  const sessionId = useStore((s) => s.sessionId);
  const workflowPhase = useStore((s) => s.workflowPhase);
  useSSEStream(sessionId);

  const isBriefing = workflowPhase === 'briefing';

  return (
    <div className="relative w-screen h-screen overflow-hidden" style={{ background: '#f4f4f5' }}>
      {/* Studio layout — always mounted so Three.js can initialize */}
      <div className="absolute inset-0 flex p-4 gap-3">
        <PlaygroundPanel />
        <RightPanel />
      </div>

      {/* Full-screen briefing overlay */}
      <AnimatePresence>
        {isBriefing && <BriefingOverlay />}
      </AnimatePresence>
    </div>
  );
};

export default App;
