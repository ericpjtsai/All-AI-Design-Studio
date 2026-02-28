import React, { useState, useRef, useEffect } from 'react';
import { usePlaygroundStore } from '../../playground/store';
import { AGENTS } from '../../playground/agents';
import { Send } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const PlaygroundChat: React.FC = () => {
  const {
    isChatting,
    chatMessages,
    sendMessage,
    isThinking,
    selectedNpcIndex,
    setIsTyping
  } = usePlaygroundStore();

  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const stopTypingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const agent = selectedNpcIndex !== null ? AGENTS[selectedNpcIndex] : null;

  useEffect(() => {
    return () => {
      if (stopTypingTimeoutRef.current) clearTimeout(stopTypingTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [chatMessages, isThinking]);

  const handleSend = async () => {
    if (!input.trim() || isThinking) return;
    if (stopTypingTimeoutRef.current) clearTimeout(stopTypingTimeoutRef.current);
    setIsTyping(false);
    const text = input;
    setInput('');
    await sendMessage(text);
  };

  if (!isChatting || !agent) return null;

  return (
    <motion.div
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
      className="absolute top-0 right-0 w-72 h-full bg-white border-l border-zinc-100 shadow-2xl z-50 flex flex-col pointer-events-auto overflow-hidden"
    >
      <div
        className="absolute top-0 left-0 w-full h-1.5 z-20"
        style={{ backgroundColor: agent.color }}
      />
      <div className="p-6 border-b border-zinc-100 flex justify-between items-end bg-white/80 backdrop-blur-md sticky top-0 z-10 pt-8">
        <div>
          <h2 className="text-2xl font-black text-zinc-900 tracking-tight">Chat</h2>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-1">{agent.department}</p>
          <h3 className="text-base font-black text-zinc-900 leading-tight">{agent.role}</h3>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-6 space-y-6"
        style={{ scrollbarWidth: 'none' }}
      >
        <AnimatePresence initial={false}>
          {chatMessages.map((msg, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
            >
              <div className={`flex items-start gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'} max-w-[90%]`}>
                <div className="shrink-0 mt-1">
                  {msg.role === 'model' ? (
                    <div className="w-5 h-5 text-zinc-400">
                      <svg viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 2L14.85 9.15L22 12L14.85 14.85L12 22L9.15 14.85L2 12L9.15 9.15L12 2Z" />
                      </svg>
                    </div>
                  ) : (
                    <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center border border-blue-100">
                      <span className="text-xs font-black text-[#7EACEA]">U</span>
                    </div>
                  )}
                </div>
                <div className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                  <div className={`px-3 py-2 rounded-2xl text-sm leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-blue-50/50 text-zinc-800 rounded-tr-none border border-blue-100/50'
                      : 'bg-zinc-50 text-zinc-800 rounded-tl-none border border-zinc-100'
                  }`}>
                    {msg.text}
                  </div>
                  <div className="flex items-center gap-2 mt-1 px-1">
                    <span className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">
                      {msg.role === 'user' ? 'You' : agent.role.split(' ')[0]}
                    </span>
                    <span className="text-[9px] font-bold text-zinc-300 uppercase tracking-widest">
                      {msg.timestamp}
                    </span>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {isThinking && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-start gap-3"
          >
            <div className="w-4 h-4 text-zinc-300 animate-pulse mt-1">
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2L14.85 9.15L22 12L14.85 14.85L12 22L9.15 14.85L2 12L9.15 9.15L12 2Z" />
              </svg>
            </div>
            <div className="bg-zinc-50 px-3 py-2.5 rounded-2xl rounded-tl-none border border-zinc-100">
              <div className="flex gap-1">
                <div className="w-1.5 h-1.5 bg-zinc-300 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-1.5 h-1.5 bg-zinc-300 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-1.5 h-1.5 bg-zinc-300 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </motion.div>
        )}
      </div>

      <div className="p-5 border-t border-zinc-50">
        <div className="flex items-center gap-2">
          <textarea
            value={input}
            onChange={(e) => {
              const val = e.target.value;
              setInput(val);
              if (val.length > 0) {
                setIsTyping(true);
                if (stopTypingTimeoutRef.current) clearTimeout(stopTypingTimeoutRef.current);
                stopTypingTimeoutRef.current = setTimeout(() => setIsTyping(false), 1000);
              } else {
                setIsTyping(false);
              }
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Message (↵ to send)"
            className="flex-1 bg-white border border-zinc-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 transition-all resize-none h-12"
            style={{ scrollbarWidth: 'none' }}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isThinking}
            style={{ backgroundColor: !input.trim() || isThinking ? undefined : agent.color }}
            className={`h-12 px-4 rounded-xl flex items-center gap-1.5 font-black text-xs uppercase tracking-widest transition-all active:scale-95 ${
              !input.trim() || isThinking
                ? 'bg-zinc-100 text-zinc-400 cursor-not-allowed'
                : 'text-white shadow-lg hover:brightness-90'
            }`}
          >
            <Send size={13} strokeWidth={3} />
          </button>
        </div>
      </div>
    </motion.div>
  );
};

export default PlaygroundChat;
