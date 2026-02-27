import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckSquare, RotateCcw } from 'lucide-react';
import { ConfirmationOption, ConfirmationPayload } from '../types';
import { useStore } from '../store/useStore';

function optionId(opt: ConfirmationOption): string {
  return typeof opt === 'string' ? opt : opt.id;
}

interface Props {
  confirmation: ConfirmationPayload;
  agentColor: string;
}

const ConfirmationPrompt: React.FC<Props> = ({ confirmation, agentColor }) => {
  const { confirmDecision } = useStore();
  const [showRevise, setShowRevise] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [confirmed, setConfirmed] = useState(false);

  const handleConfirm = () => {
    setConfirmed(true);
    confirmDecision(confirmation.id, 'confirm');
  };

  const handleRevise = () => {
    if (!showRevise) { setShowRevise(true); return; }
    confirmDecision(confirmation.id, 'revise', feedback);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -6, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ type: 'spring', stiffness: 380, damping: 28 }}
      className="mt-3 mb-1 overflow-hidden"
      style={{ borderRadius: 20, border: '1px solid rgba(0,0,0,0.07)', boxShadow: '0 4px 20px rgba(0,0,0,0.06)' }}
    >
      {/* Accent bar */}
      <div className="h-1 w-full" style={{ background: agentColor }} />

      <div className="p-4 bg-white">
        {/* Awaiting pill */}
        <div className="flex items-center gap-2 mb-3">
          <div
            className="w-3.5 h-3.5 rounded-full flex items-center justify-center shrink-0"
            style={{ background: `${agentColor}18`, border: `1.5px solid ${agentColor}50` }}
          >
            <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: agentColor }} />
          </div>
          <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: agentColor }}>
            Awaiting Your Confirmation
          </span>
        </div>

        {/* Title */}
        <h3 className="text-[14px] font-black text-zinc-900 mb-1.5 leading-tight">{confirmation.title}</h3>

        {/* Question */}
        <p className="text-[12px] font-medium leading-relaxed mb-3" style={{ color: '#71717a' }}>
          {confirmation.question}
        </p>

        {/* Context block */}
        {confirmation.context && (
          <pre
            className="rounded-xl p-3 text-[10px] font-mono leading-relaxed mb-3 whitespace-pre-wrap overflow-x-auto"
            style={{ background: '#f9f9f9', border: '1px solid #f0f0f0', color: '#52525b' }}
          >
            {confirmation.context}
          </pre>
        )}

        {/* Revise textarea */}
        <AnimatePresence>
          {showRevise && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-3 overflow-hidden"
            >
              <textarea
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder="Describe what should be changed… (optional)"
                className="w-full rounded-xl px-3 py-2.5 text-[12px] font-medium placeholder:font-medium focus:outline-none resize-none transition-colors"
                style={{ background: '#f9f9f9', border: '1.5px solid #e4e4e7', color: '#18181b' }}
                rows={3}
                autoFocus
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Buttons */}
        <div className="flex gap-2">
          {confirmation.options.some((o) => optionId(o) === 'confirm') && (
            <button
              onClick={handleConfirm}
              disabled={confirmed}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest text-white transition-all active:scale-[0.98] disabled:opacity-50"
              style={{ background: confirmed ? `${agentColor}80` : agentColor }}
            >
              <CheckSquare size={11} strokeWidth={3} />
              {confirmed ? 'Confirmed ✓' : 'Confirm'}
            </button>
          )}
          {confirmation.options.some((o) => optionId(o) === 'revise') && (
            <button
              onClick={handleRevise}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-[0.98]"
              style={{ background: '#f4f4f5', color: '#52525b' }}
            >
              <RotateCcw size={11} strokeWidth={3} />
              {showRevise ? 'Submit' : 'Revise'}
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
};

export default ConfirmationPrompt;
