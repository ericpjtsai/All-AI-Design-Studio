import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckSquare, RotateCcw } from 'lucide-react';
import { ConfirmationOption, ConfirmationPayload } from '../types';
import { useStore } from '../store/useStore';

/** Normalise option to its string id — handles both 'confirm' and { id: 'confirm', ... } */
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
    if (!showRevise) {
      setShowRevise(true);
      return;
    }
    confirmDecision(confirmation.id, 'revise', feedback);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -6, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ type: 'spring', stiffness: 380, damping: 28 }}
      className="mt-1.5 mb-1 rounded-xl border overflow-hidden"
      style={{
        borderColor: `${agentColor}40`,
        backgroundColor: `${agentColor}08`,
      }}
    >
      {/* Top accent line */}
      <div className="h-0.5 w-full" style={{ backgroundColor: agentColor }} />

      <div className="p-4">
        {/* "Awaiting" pill */}
        <div className="flex items-center gap-2 mb-3">
          <div
            className="w-3.5 h-3.5 rounded-full flex items-center justify-center"
            style={{ backgroundColor: `${agentColor}25`, border: `1px solid ${agentColor}80` }}
          >
            <div
              className="w-1.5 h-1.5 rounded-full animate-pulse"
              style={{ backgroundColor: agentColor }}
            />
          </div>
          <span
            className="text-[10px] font-black uppercase tracking-widest"
            style={{ color: agentColor }}
          >
            Awaiting Your Confirmation
          </span>
        </div>

        {/* Title */}
        <h3 className="text-white font-black text-sm mb-2">{confirmation.title}</h3>

        {/* Question */}
        <p className="text-zinc-400 text-xs leading-relaxed mb-3">{confirmation.question}</p>

        {/* Context block */}
        {confirmation.context && (
          <pre className="bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-[11px] text-zinc-300 font-mono leading-relaxed mb-3 whitespace-pre-wrap overflow-x-auto">
            {confirmation.context}
          </pre>
        )}

        {/* Revise text input */}
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
                className="w-full bg-zinc-950 border border-zinc-700 focus:border-zinc-500 rounded-xl px-3 py-2.5 text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none resize-none transition-colors"
                rows={3}
                autoFocus
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Action buttons */}
        <div className="flex gap-2">
          {confirmation.options.some((o) => optionId(o) === 'confirm') && (
            <button
              onClick={handleConfirm}
              disabled={confirmed}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest text-white transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-default"
              style={{ backgroundColor: confirmed ? `${agentColor}80` : agentColor }}
            >
              <CheckSquare size={12} strokeWidth={3} />
              {confirmed ? 'Confirmed ✓' : 'Confirm'}
            </button>
          )}

          {confirmation.options.some((o) => optionId(o) === 'revise') && (
            <button
              onClick={handleRevise}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-zinc-800 hover:bg-zinc-700 rounded-xl text-[11px] font-black uppercase tracking-widest text-zinc-300 transition-all active:scale-[0.98]"
            >
              <RotateCcw size={12} strokeWidth={3} />
              {showRevise ? 'Submit Changes' : 'Request Changes'}
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
};

export default ConfirmationPrompt;
