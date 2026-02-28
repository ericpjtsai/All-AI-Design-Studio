import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckSquare, RotateCcw, Send } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { AGENTS } from '../../data/agents';
import { ClarifyingQuestion } from '../../playground/types';

const manager = AGENTS[0]; // Design Manager

// ── Bubbles ───────────────────────────────────────────────────────────────────

const ManagerBubble: React.FC<{ text: string }> = ({ text }) => (
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
    className="flex items-start gap-3"
  >
    <div
      className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-black shrink-0 mt-0.5"
      style={{ background: `${manager.color}18`, border: `1.5px solid ${manager.color}40`, color: manager.color }}
    >
      D
    </div>
    <div
      className="px-4 py-2.5 rounded-2xl rounded-tl-none text-[13px] leading-relaxed max-w-[80%]"
      style={{ background: '#f4f4f5', color: '#18181b' }}
    >
      {text}
    </div>
  </motion.div>
);

const UserBubble: React.FC<{ text: string }> = ({ text }) => (
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
    className="flex justify-end"
  >
    <div
      className="px-4 py-2.5 rounded-2xl rounded-tr-none text-[13px] leading-relaxed max-w-[80%]"
      style={{ background: `${manager.color}18`, color: '#18181b', border: `1px solid ${manager.color}30` }}
    >
      {text}
    </div>
  </motion.div>
);

const ThinkingDots: React.FC = () => (
  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-start gap-3">
    <div
      className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-black shrink-0"
      style={{ background: `${manager.color}18`, border: `1.5px solid ${manager.color}40`, color: manager.color }}
    >
      D
    </div>
    <div className="px-4 py-2.5 rounded-2xl rounded-tl-none" style={{ background: '#f4f4f5' }}>
      <div className="flex gap-1.5 items-center">
        {[0, 150, 300].map((d) => (
          <div
            key={d}
            className="w-1.5 h-1.5 rounded-full animate-bounce"
            style={{ background: '#a1a1aa', animationDelay: `${d}ms` }}
          />
        ))}
      </div>
    </div>
  </motion.div>
);

// ── Main view ─────────────────────────────────────────────────────────────────

interface QAEntry { question: string; answer: string }

const ScopeConversationView: React.FC = () => {
  const designOutputs = useStore((s) => s.designOutputs);
  const pendingConfirmation = useStore((s) => s.pendingConfirmation);
  const confirmDecision = useStore((s) => s.confirmDecision);

  const [qaHistory, setQaHistory] = useState<QAEntry[]>([]);
  const [showCustom, setShowCustom] = useState(false);
  const [customText, setCustomText] = useState('');
  const [showRevise, setShowRevise] = useState(false);
  const [reviseText, setReviseText] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const scopeDoc = designOutputs?.scope_doc ?? {};
  const rawQs = scopeDoc.clarifying_questions;
  const questions: ClarifyingQuestion[] = Array.isArray(rawQs)
    ? (rawQs as ClarifyingQuestion[]).filter((q) => q && typeof q.question === 'string')
    : [];

  const currentIndex = qaHistory.length;
  const currentQ = questions[currentIndex] as ClarifyingQuestion | undefined;
  const allAnswered = currentIndex >= questions.length;
  const scopeReady = Object.keys(scopeDoc).length > 0;
  const checkpointReady = pendingConfirmation?.id === 'scope';
  const canConfirm = checkpointReady && allAnswered;

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [qaHistory.length, checkpointReady, showCustom, allAnswered, showRevise]);

  const submitAnswer = (answer: string) => {
    if (!currentQ) return;
    setQaHistory((prev) => [...prev, { question: currentQ.question, answer }]);
    setShowCustom(false);
    setCustomText('');
  };

  const handleConfirm = () => {
    if (!pendingConfirmation) return;
    setConfirmed(true);
    const note = qaHistory.map((e) => `${e.question}: ${e.answer}`).join(' | ');
    confirmDecision(pendingConfirmation.id, 'confirm', note || undefined);
  };

  const handleRevise = () => {
    if (!showRevise) { setShowRevise(true); return; }
    if (!pendingConfirmation || !reviseText.trim()) return;
    confirmDecision(pendingConfirmation.id, 'revise', reviseText.trim());
  };

  const projectOverview = typeof scopeDoc.project_overview === 'string'
    ? scopeDoc.project_overview : '';

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ type: 'spring', stiffness: 380, damping: 28 }}
      className="flex flex-col h-full"
    >
      {/* Header */}
      <div className="shrink-0 px-6 pt-5 pb-4 flex items-center gap-3">
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center text-[14px] font-black shrink-0"
          style={{ background: `${manager.color}15`, border: `2px solid ${manager.color}`, color: manager.color }}
        >
          D
        </div>
        <div className="min-w-0">
          <h2 className="text-[14px] font-black text-zinc-900 leading-tight">{manager.role}</h2>
          <p className="text-[9px] font-black uppercase tracking-widest" style={{ color: '#a1a1aa' }}>
            Scope Clarification
          </p>
        </div>
        <span
          className="ml-auto text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full shrink-0"
          style={{
            background: canConfirm ? '#dcfce7' : '#7EACEA15',
            color: canConfirm ? '#16a34a' : '#7EACEA',
          }}
        >
          {canConfirm ? 'Ready' : 'Analyzing…'}
        </span>
      </div>

      <div className="shrink-0 mx-6" style={{ height: 1, background: '#f4f4f5' }} />

      {/* Conversation body */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-6 py-5 space-y-4"
        style={{ scrollbarWidth: 'none' }}
      >
        {/* Greeting */}
        <ManagerBubble text="Hey! Before we kick off, I have a couple of quick questions to make sure we build exactly what you need." />

        {/* Q&A history */}
        {qaHistory.map((entry, i) => (
          <React.Fragment key={entry.question}>
            <ManagerBubble text={entry.question} />
            <UserBubble text={entry.answer} />
            {i < qaHistory.length - 1 && <ManagerBubble text="Got it." />}
          </React.Fragment>
        ))}

        {/* Waiting for scope_doc */}
        {!scopeReady && <ThinkingDots />}

        {/* Current question */}
        {scopeReady && !allAnswered && currentQ && (
          <>
            {qaHistory.length > 0 && <ManagerBubble text="Got it." />}
            <ManagerBubble text={currentQ.question} />

            {/* Option chips */}
            <AnimatePresence>
              {!showCustom && (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex flex-wrap gap-2 pl-10"
                >
                  {currentQ.options.map((opt) => (
                    <button
                      key={opt}
                      onClick={() => opt === 'Custom...' ? setShowCustom(true) : submitAnswer(opt)}
                      className="px-3.5 py-2 rounded-full text-[12px] font-semibold border transition-all active:scale-[0.97]"
                      style={{ borderColor: '#e4e4e7', color: '#52525b', background: '#fafafa' }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = manager.color;
                        e.currentTarget.style.color = manager.color;
                        e.currentTarget.style.background = `${manager.color}08`;
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = '#e4e4e7';
                        e.currentTarget.style.color = '#52525b';
                        e.currentTarget.style.background = '#fafafa';
                      }}
                    >
                      {opt}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Custom input */}
            <AnimatePresence>
              {showCustom && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="pl-10 overflow-hidden"
                >
                  <div className="flex gap-2">
                    <input
                      autoFocus
                      value={customText}
                      onChange={(e) => setCustomText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && customText.trim()) submitAnswer(customText.trim());
                      }}
                      placeholder="Type your answer…"
                      className="flex-1 text-[13px] px-4 py-2.5 rounded-xl border focus:outline-none"
                      style={{ borderColor: '#e4e4e7', color: '#18181b' }}
                    />
                    <button
                      onClick={() => customText.trim() && submitAnswer(customText.trim())}
                      disabled={!customText.trim()}
                      className="px-4 py-2.5 rounded-xl flex items-center justify-center transition-all active:scale-95 disabled:opacity-30"
                      style={{ background: manager.color }}
                    >
                      <Send size={13} strokeWidth={2.5} color="white" />
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}

        {/* All answered — waiting for backend */}
        {scopeReady && allAnswered && !checkpointReady && (
          <>
            {qaHistory.length > 0 && <ManagerBubble text="Got it." />}
            <ManagerBubble text="Give me a moment to put the scope document together…" />
            <ThinkingDots />
          </>
        )}

        {/* Scope with no questions — waiting */}
        {scopeReady && questions.length === 0 && !checkpointReady && (
          <ThinkingDots />
        )}

        {/* Final confirm */}
        {canConfirm && (
          <>
            {qaHistory.length > 0 && <ManagerBubble text="Got it." />}
            <ManagerBubble
              text={
                projectOverview
                  ? `Here's what I've put together: "${projectOverview}". Does this capture what you're after?`
                  : 'Scope document is ready. Does everything look right?'
              }
            />

            <AnimatePresence>
              {showRevise && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="pl-10 overflow-hidden"
                >
                  <textarea
                    autoFocus
                    value={reviseText}
                    onChange={(e) => setReviseText(e.target.value)}
                    placeholder="What should be changed?"
                    rows={3}
                    className="w-full text-[13px] px-4 py-3 rounded-xl border focus:outline-none resize-none"
                    style={{ borderColor: '#e4e4e7', color: '#18181b' }}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}
      </div>

      {/* Action bar */}
      {canConfirm && (
        <div className="shrink-0 px-6 pb-6 pt-4 flex gap-3" style={{ borderTop: '1px solid #f4f4f5' }}>
          <button
            onClick={handleConfirm}
            disabled={confirmed}
            className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl text-[11px] font-black uppercase tracking-widest text-white transition-all active:scale-[0.98] disabled:opacity-50"
            style={{ background: confirmed ? '#22c55e80' : '#22c55e' }}
          >
            <CheckSquare size={12} strokeWidth={3} />
            {confirmed ? 'Starting…' : "Let's go!"}
          </button>
          <button
            onClick={handleRevise}
            disabled={showRevise && !reviseText.trim()}
            className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all active:scale-[0.98] disabled:opacity-40"
            style={{ background: '#f4f4f5', color: '#52525b' }}
          >
            <RotateCcw size={12} strokeWidth={3} />
            {showRevise ? 'Submit' : 'Revise'}
          </button>
        </div>
      )}
    </motion.div>
  );
};

export default ScopeConversationView;
