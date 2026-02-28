import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Download, RotateCcw, Maximize2, Minimize2 } from 'lucide-react';
import { useStore } from '../../store/useStore';

const OutputView: React.FC = () => {
  const resetSession = useStore((s) => s.resetSession);
  const designOutputs = useStore((s) => s.designOutputs);
  const [expanded, setExpanded] = useState(false);

  const htmlPrototype = designOutputs?.junior_output?.html_prototype as string | undefined;
  const scopeDoc = designOutputs?.scope_doc ?? {};
  const projectOverview = scopeDoc.project_overview as string | undefined;
  const review = designOutputs?.review ?? {};
  const score = review.overall_score as number | undefined;

  const handleExport = () => {
    if (!htmlPrototype) return;
    const blob = new Blob([htmlPrototype], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'prototype.html';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ type: 'spring', stiffness: 380, damping: 28 }}
      className="flex flex-col h-full"
    >
      {/* ── Toolbar ── */}
      <div
        className="shrink-0 flex items-center gap-3 px-4 py-3"
        style={{ borderBottom: '1px solid #f4f4f5' }}
      >
        {/* Branding + project name */}
        <div className="flex items-center gap-2 flex-1 min-w-0 overflow-hidden">
          <div className="w-1 h-4 rounded-full shrink-0" style={{ background: '#7EACEA' }} />
          <span
            className="text-[9px] font-black uppercase tracking-widest shrink-0"
            style={{ color: '#a1a1aa' }}
          >
            AI Design Studio
          </span>
          {projectOverview && (
            <>
              <span style={{ color: '#e4e4e7' }}>·</span>
              <span
                className="text-[11px] font-medium truncate"
                style={{ color: '#71717a' }}
                title={projectOverview}
              >
                {projectOverview}
              </span>
            </>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 shrink-0">
          {score !== undefined && (
            <span
              className="text-[9px] font-black tabular-nums px-2 py-0.5 rounded-full"
              style={{ background: '#dcfce7', color: '#16a34a' }}
            >
              {score}/10
            </span>
          )}

          <button
            onClick={() => setExpanded((v) => !v)}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all active:scale-[0.97]"
            style={{ background: '#f4f4f5', color: '#71717a' }}
            title={expanded ? 'Collapse' : 'Expand'}
          >
            {expanded ? <Minimize2 size={10} strokeWidth={3} /> : <Maximize2 size={10} strokeWidth={3} />}
          </button>

          <button
            onClick={handleExport}
            disabled={!htmlPrototype}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all active:scale-[0.97] disabled:opacity-30 disabled:cursor-default"
            style={{ background: '#f4f4f5', color: '#71717a' }}
          >
            <Download size={10} strokeWidth={3} />
            Export
          </button>

          <button
            onClick={resetSession}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all active:scale-[0.97]"
            style={{ background: '#18181b', color: '#ffffff' }}
          >
            <RotateCcw size={10} strokeWidth={3} />
            New
          </button>
        </div>
      </div>

      {/* ── iframe ── */}
      <div className="flex-1 overflow-hidden relative">
        {htmlPrototype ? (
          <iframe
            srcDoc={htmlPrototype}
            className="absolute inset-0 w-full h-full border-none"
            sandbox="allow-scripts allow-same-origin"
            title="Generated Prototype"
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center"
              style={{ background: '#f4f4f5' }}
            >
              <span className="text-2xl">🎨</span>
            </div>
            <p className="text-[12px] font-medium" style={{ color: '#a1a1aa' }}>
              No prototype generated yet.
            </p>
          </div>
        )}
      </div>

      {/* ── Expanded overlay (fills the entire right panel) ── */}
      {expanded && htmlPrototype && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 z-50 flex flex-col"
          style={{ background: '#ffffff', borderRadius: 32, overflow: 'hidden' }}
        >
          {/* mini close bar */}
          <div
            className="shrink-0 flex items-center justify-between px-4 py-2.5"
            style={{ borderBottom: '1px solid #f4f4f5' }}
          >
            <div className="flex items-center gap-2">
              <div className="w-1 h-4 rounded-full" style={{ background: '#7EACEA' }} />
              <span className="text-[9px] font-black uppercase tracking-widest" style={{ color: '#a1a1aa' }}>
                Prototype Preview
              </span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleExport}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest"
                style={{ background: '#f4f4f5', color: '#71717a' }}
              >
                <Download size={10} strokeWidth={3} />
                Export
              </button>
              <button
                onClick={() => setExpanded(false)}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest"
                style={{ background: '#18181b', color: '#ffffff' }}
              >
                <Minimize2 size={10} strokeWidth={3} />
                Close
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-hidden relative">
            <iframe
              srcDoc={htmlPrototype}
              className="absolute inset-0 w-full h-full border-none"
              sandbox="allow-scripts allow-same-origin"
              title="Generated Prototype (expanded)"
            />
          </div>
        </motion.div>
      )}
    </motion.div>
  );
};

export default OutputView;
