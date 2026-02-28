import React from 'react';
import { motion } from 'motion/react';
import { RotateCcw, CheckCircle2 } from 'lucide-react';
import { useStore } from '../../store/useStore';

const DashboardView: React.FC = () => {
  const resetSession = useStore((s) => s.resetSession);
  const designOutputs = useStore((s) => s.designOutputs);

  const review = designOutputs?.review ?? {};
  const overallScore = review.overall_score as number | undefined;
  const juniorOut = designOutputs?.junior_output ?? {};
  const components = Array.isArray(juniorOut.components) ? juniorOut.components : [];
  const visualOut = designOutputs?.visual_output ?? {};
  const tokens = (visualOut.design_tokens as Record<string, unknown>) ?? {};
  const tokenCount = Object.keys(tokens).length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ type: 'spring', stiffness: 380, damping: 28 }}
      className="flex flex-col items-center justify-center h-full gap-6 px-12 text-center"
    >
      <div
        className="w-16 h-16 rounded-[20px] flex items-center justify-center"
        style={{ background: '#dcfce7', border: '1px solid #bbf7d0' }}
      >
        <CheckCircle2 size={28} strokeWidth={2.5} color="#22c55e" />
      </div>

      <div>
        <h2 className="text-[18px] font-black text-zinc-900 mb-1.5">Project Complete</h2>
        <p className="text-[12px] font-medium leading-relaxed" style={{ color: '#71717a' }}>
          All deliverables have been reviewed and approved.
        </p>
      </div>

      <div className="flex gap-4">
        {[
          { label: 'Components', value: components.length, color: '#ef4444' },
          { label: 'Token Sets', value: tokenCount, color: '#EF52BA' },
          { label: 'Score', value: overallScore ? `${overallScore}/10` : '—', color: '#7EACEA' },
        ].map(({ label, value, color }) => (
          <div key={label} className="text-center">
            <p className="text-[20px] font-black tabular-nums" style={{ color }}>{value}</p>
            <p className="text-[9px] font-black uppercase tracking-widest" style={{ color: '#a1a1aa' }}>{label}</p>
          </div>
        ))}
      </div>

      <button
        onClick={resetSession}
        className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-[0.98]"
        style={{ background: '#f4f4f5', color: '#52525b' }}
      >
        <RotateCcw size={11} strokeWidth={3} />
        Start New Project
      </button>
    </motion.div>
  );
};

export default DashboardView;
