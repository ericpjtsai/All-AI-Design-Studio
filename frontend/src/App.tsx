import React, { useState, useRef, useEffect } from 'react';
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
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    // Auto-focus the textarea on mount
    const t = setTimeout(() => textareaRef.current?.focus(), 400);
    return () => clearTimeout(t);
  }, []);

  const handleStart = async () => {
    if (!brief.trim() || launching) return;
    setLaunching(true);
    await startSession(brief.trim());
  };

  return (
    <motion.div
      key="briefing"
      className="absolute inset-0 z-50 flex flex-col items-center"
      style={{ background: '#f4f4f5' }}
      exit={{ opacity: 0, y: -60, scale: 0.96 }}
      transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
    >
      {/* Title — positioned at ~38% from top */}
      <div className="flex flex-col items-center" style={{ marginTop: '30vh' }}>
        <motion.div
          className="w-1.5 h-7 rounded-full mb-5"
          style={{ background: '#7EACEA' }}
          initial={{ scaleY: 0, opacity: 0 }}
          animate={{ scaleY: 1, opacity: 1 }}
          transition={{ delay: 0.1, duration: 0.5, ease: 'easeOut' }}
        />
        <motion.h1
          className="text-[24px] font-black tracking-tight mb-1"
          style={{ color: '#18181b' }}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.5 }}
        >
          AI Design Studio
        </motion.h1>
        <motion.p
          className="text-[12px] font-medium"
          style={{ color: '#a1a1aa' }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.35, duration: 0.5 }}
        >
          Multi-agent design workflow
        </motion.p>
      </div>

      {/* Input — positioned below center with breathing room */}
      <motion.div
        className="w-full max-w-lg px-6 mt-12"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.45, duration: 0.5 }}
      >
        <div
          className="rounded-2xl overflow-hidden"
          style={{
            background: '#ffffff',
            border: '1px solid rgba(0,0,0,0.06)',
            boxShadow: '0 2px 16px rgba(0,0,0,0.05)',
          }}
        >
          <textarea
            ref={textareaRef}
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
          <div className="flex items-center justify-between px-3 pb-3">
            <span className="text-[9px] font-medium" style={{ color: '#d4d4d8' }}>
              {brief.trim() ? '⌘ Enter' : ''}
            </span>
            <button
              onClick={handleStart}
              disabled={!brief.trim() || launching}
              className="px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest text-white transition-all active:scale-[0.98] disabled:opacity-20 disabled:cursor-default"
              style={{ background: '#18181b' }}
            >
              {launching ? 'Launching...' : 'Start Project'}
            </button>
          </div>
        </div>
      </motion.div>
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
