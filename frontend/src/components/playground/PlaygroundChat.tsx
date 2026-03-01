import React, { useState, useRef, useEffect } from 'react';
import { usePlaygroundStore } from '../../playground/store';
import { useStore } from '../../store/useStore';
import { AGENTS } from '../../playground/agents';
import { Send } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// ── Shared header ─────────────────────────────────────────────────────────────

const AgentHeader: React.FC<{ color: string; role: string; department: string }> = ({
  color, role, department,
}) => (
  <div className="p-5 border-b border-zinc-100 flex justify-between items-end bg-white/80 backdrop-blur-md sticky top-0 z-10 pt-7" style={{ position: 'sticky' }}>
    <div className="absolute top-0 left-0 w-full h-1.5" style={{ backgroundColor: color }} />
    <h2 className="text-xl font-black text-zinc-900 tracking-tight">Chat</h2>
    <div className="text-right">
      <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-0.5">{department}</p>
      <h3 className="text-sm font-black text-zinc-900 leading-tight">{role}</h3>
    </div>
  </div>
);

// ── Manager bubble ────────────────────────────────────────────────────────────

const ManagerBubble: React.FC<{ text: string }> = ({ text }) => (
  <motion.div
    initial={{ opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
    className="flex items-start gap-2.5"
  >
    <div className="w-4 h-4 text-zinc-300 mt-0.5 shrink-0">
      <svg viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2L14.85 9.15L22 12L14.85 14.85L12 22L9.15 14.85L2 12L9.15 9.15L12 2Z" />
      </svg>
    </div>
    <div className="bg-zinc-50 border border-zinc-100 px-3 py-2 rounded-2xl rounded-tl-none text-[13px] leading-relaxed text-zinc-800 max-w-[85%]">
      {text}
    </div>
  </motion.div>
);

// ── User bubble ───────────────────────────────────────────────────────────────

const UserBubble: React.FC<{ text: string }> = ({ text }) => (
  <motion.div
    initial={{ opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
    className="flex justify-end"
  >
    <div className="bg-blue-50/60 border border-blue-100/60 px-3 py-2 rounded-2xl rounded-tr-none text-[13px] leading-relaxed text-zinc-800 max-w-[85%]">
      {text}
    </div>
  </motion.div>
);

// ── Thinking dots ─────────────────────────────────────────────────────────────

const ThinkingDots: React.FC = () => (
  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-start gap-2.5">
    <div className="w-4 h-4 text-zinc-300 mt-0.5 animate-pulse shrink-0">
      <svg viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2L14.85 9.15L22 12L14.85 14.85L12 22L9.15 14.85L2 12L9.15 9.15L12 2Z" />
      </svg>
    </div>
    <div className="bg-zinc-50 border border-zinc-100 px-3 py-2.5 rounded-2xl rounded-tl-none">
      <div className="flex gap-1">
        {[0, 150, 300].map((d) => (
          <div key={d} className="w-1.5 h-1.5 bg-zinc-300 rounded-full animate-bounce" style={{ animationDelay: `${d}ms` }} />
        ))}
      </div>
    </div>
  </motion.div>
);

// ── Normal free-form chat panel ───────────────────────────────────────────────

const NormalChatPanel: React.FC<{ agent: typeof AGENTS[0] }> = ({ agent }) => {
  const { chatMessages, sendMessage, isThinking, setIsTyping } = usePlaygroundStore();
  const pendingConfirmation = useStore((s) => s.pendingConfirmation);
  const confirmDecision = useStore((s) => s.confirmDecision);
  const [input, setInput] = useState('');
  const [lastUserText, setLastUserText] = useState('');
  const [directiveApplied, setDirectiveApplied] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const stopTypingRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset directive state when checkpoint changes
  useEffect(() => { setDirectiveApplied(false); }, [pendingConfirmation?.id]);

  useEffect(() => () => { if (stopTypingRef.current) clearTimeout(stopTypingRef.current); }, []);
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [chatMessages, isThinking]);

  const handleSend = async () => {
    if (!input.trim() || isThinking) return;
    if (stopTypingRef.current) clearTimeout(stopTypingRef.current);
    setIsTyping(false);
    const text = input;
    setInput('');
    setLastUserText(text);
    await sendMessage(text);
  };

  const handleApplyDirective = () => {
    if (!pendingConfirmation || !lastUserText) return;
    setDirectiveApplied(true);
    confirmDecision(pendingConfirmation.id, 'revise', lastUserText);
  };

  // Show "Apply as Directive" when: at a checkpoint, user sent a message, agent replied
  const lastMsg = chatMessages[chatMessages.length - 1];
  const showDirectiveBanner = (
    !!pendingConfirmation &&
    !!lastUserText &&
    !directiveApplied &&
    !isThinking &&
    lastMsg?.role === 'model'
  );

  return (
    <div className="flex flex-col h-full">
      <AgentHeader color={agent.color} role={agent.role} department={agent.department} />

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-5 space-y-5" style={{ scrollbarWidth: 'none' }}>
        <AnimatePresence initial={false}>
          {chatMessages.map((msg, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
            >
              <div className={`flex items-start gap-2.5 ${msg.role === 'user' ? 'flex-row-reverse' : ''} max-w-[90%]`}>
                <div className="shrink-0 mt-0.5">
                  {msg.role === 'model' ? (
                    <div className="w-4 h-4 text-zinc-400">
                      <svg viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 2L14.85 9.15L22 12L14.85 14.85L12 22L9.15 14.85L2 12L9.15 9.15L12 2Z" />
                      </svg>
                    </div>
                  ) : (
                    <div className="w-7 h-7 rounded-xl bg-blue-50 flex items-center justify-center border border-blue-100">
                      <span className="text-[10px] font-black text-[#7EACEA]">U</span>
                    </div>
                  )}
                </div>
                <div className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                  <div className={`px-3 py-2 rounded-2xl text-[13px] leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-blue-50/50 text-zinc-800 rounded-tr-none border border-blue-100/50'
                      : 'bg-zinc-50 text-zinc-800 rounded-tl-none border border-zinc-100'
                  }`}>
                    {msg.text}
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5 px-1">
                    <span className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">
                      {msg.role === 'user' ? 'You' : agent.role.split(' ')[0]}
                    </span>
                    <span className="text-[9px] text-zinc-300">{msg.timestamp}</span>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {isThinking && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-start gap-2.5">
            <div className="w-4 h-4 text-zinc-300 animate-pulse mt-0.5 shrink-0">
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2L14.85 9.15L22 12L14.85 14.85L12 22L9.15 14.85L2 12L9.15 9.15L12 2Z" />
              </svg>
            </div>
            <div className="bg-zinc-50 px-3 py-2.5 rounded-2xl rounded-tl-none border border-zinc-100">
              <div className="flex gap-1">
                {[0, 150, 300].map((d) => (
                  <div key={d} className="w-1.5 h-1.5 bg-zinc-300 rounded-full animate-bounce" style={{ animationDelay: `${d}ms` }} />
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </div>

      {/* Apply as Directive banner */}
      <AnimatePresence>
        {showDirectiveBanner && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className="mx-4 mb-2 rounded-xl overflow-hidden border"
            style={{ borderColor: `${agent.color}40`, background: `${agent.color}08` }}
          >
            <div className="px-3 py-2 flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full animate-pulse shrink-0" style={{ background: agent.color }} />
              <p className="text-[10px] font-bold text-zinc-600 flex-1 leading-snug">
                Apply your message as a revision directive?
              </p>
              <button
                onClick={handleApplyDirective}
                className="text-[10px] font-black px-2.5 py-1 rounded-lg shrink-0 transition-all active:scale-95 hover:brightness-90"
                style={{ background: agent.color, color: 'white' }}
              >
                Apply →
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="p-4 border-t border-zinc-50">
        <div className="flex items-center gap-2">
          <textarea
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              if (e.target.value.length > 0) {
                setIsTyping(true);
                if (stopTypingRef.current) clearTimeout(stopTypingRef.current);
                stopTypingRef.current = setTimeout(() => setIsTyping(false), 1000);
              } else {
                setIsTyping(false);
              }
            }}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            placeholder="Message (↵ to send)"
            className="flex-1 bg-white border border-zinc-200 rounded-xl px-3 py-2.5 text-[13px] focus:outline-none transition-all resize-none h-11"
            style={{ scrollbarWidth: 'none' }}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isThinking}
            style={{ backgroundColor: !input.trim() || isThinking ? undefined : agent.color }}
            className={`h-11 w-11 rounded-xl flex items-center justify-center transition-all active:scale-95 ${
              !input.trim() || isThinking ? 'bg-zinc-100' : 'shadow-lg hover:brightness-90'
            }`}
          >
            <Send size={13} strokeWidth={3} color={!input.trim() || isThinking ? '#a1a1aa' : 'white'} />
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Root ──────────────────────────────────────────────────────────────────────

const PlaygroundChat: React.FC = () => {
  const { isChatting, selectedNpcIndex } = usePlaygroundStore();
  const workflowPhase = useStore((s) => s.workflowPhase);

  const agent = selectedNpcIndex !== null ? AGENTS[selectedNpcIndex] : null;
  if (!isChatting || !agent) return null;

  // During scoping the right panel becomes the conversation view — no chat overlay needed
  const isScopeMode = workflowPhase === 'scoping' && selectedNpcIndex === 1;
  if (isScopeMode) return null;

  return (
    <motion.div
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
      className="absolute top-0 right-0 w-72 h-full bg-white border-l border-zinc-100 shadow-2xl z-50 flex flex-col pointer-events-auto overflow-hidden"
    >
      <NormalChatPanel agent={agent} />
    </motion.div>
  );
};

export default PlaygroundChat;
