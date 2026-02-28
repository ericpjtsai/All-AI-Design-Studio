import React from 'react';
import { motion } from 'motion/react';
import { useStore } from '../../store/useStore';
import { AGENTS } from '../../data/agents';

const manager = AGENTS[0]; // Design Manager

const ManagersOfficeView: React.FC = () => {
  const designOutputs = useStore((s) => s.designOutputs);
  const agentStates = useStore((s) => s.agentStates);

  const managerState = agentStates[0];
  const scopeDoc = designOutputs?.scope_doc ?? {};
  const hasScopeDoc = Object.keys(scopeDoc).length > 0;

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
        {managerState && (
          <span
            className="ml-auto text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full shrink-0"
            style={{
              background: managerState.status === 'working' ? '#7EACEA15' : '#f4f4f5',
              color: managerState.status === 'working' ? '#7EACEA' : '#a1a1aa',
            }}
          >
            {managerState.status === 'working' ? 'Analyzing...' : managerState.status}
          </span>
        )}
      </div>

      {/* Divider */}
      <div className="shrink-0 mx-6" style={{ height: 1, background: '#f4f4f5' }} />

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-6 py-5">
        {!hasScopeDoc ? (
          /* Loading state */
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: '#7EACEA' }} />
              <p className="text-[13px] font-medium" style={{ color: '#71717a' }}>
                Analyzing design brief...
              </p>
            </div>
            <p className="text-[11px] font-medium text-center" style={{ color: '#d4d4d8' }}>
              The Design Manager is reviewing your brief and preparing a scope document.
            </p>
          </div>
        ) : (
          /* Scope document display */
          <motion.div
            initial="hidden"
            animate="visible"
            variants={{ visible: { transition: { staggerChildren: 0.08 } } }}
            className="space-y-3"
          >
            {/* Project overview */}
            {!!scopeDoc.project_overview && (
              <motion.div
                variants={{ hidden: { opacity: 0, y: 8 }, visible: { opacity: 1, y: 0 } }}
                className="rounded-2xl p-4"
                style={{ background: '#fafafa', border: '1px solid rgba(0,0,0,0.06)' }}
              >
                <p className="text-[9px] font-black uppercase tracking-widest mb-2" style={{ color: '#a1a1aa' }}>
                  Project Overview
                </p>
                <p className="text-[12px] font-medium leading-relaxed" style={{ color: '#52525b' }}>
                  {String(scopeDoc.project_overview)}
                </p>
              </motion.div>
            )}

            {/* Grid: users + visual direction */}
            <div className="grid grid-cols-2 gap-3">
              {!!scopeDoc.target_users && (
                <motion.div
                  variants={{ hidden: { opacity: 0, y: 8 }, visible: { opacity: 1, y: 0 } }}
                  className="rounded-2xl p-4"
                  style={{ background: '#fafafa', border: '1px solid rgba(0,0,0,0.06)' }}
                >
                  <p className="text-[9px] font-black uppercase tracking-widest mb-2" style={{ color: '#a1a1aa' }}>
                    Target Users
                  </p>
                  <p className="text-[11px] font-medium leading-relaxed" style={{ color: '#71717a' }}>
                    {String(scopeDoc.target_users)}
                  </p>
                </motion.div>
              )}
              {!!scopeDoc.visual_direction && (
                <motion.div
                  variants={{ hidden: { opacity: 0, y: 8 }, visible: { opacity: 1, y: 0 } }}
                  className="rounded-2xl p-4"
                  style={{ background: '#fafafa', border: '1px solid rgba(0,0,0,0.06)' }}
                >
                  <p className="text-[9px] font-black uppercase tracking-widest mb-2" style={{ color: '#a1a1aa' }}>
                    Visual Direction
                  </p>
                  <p className="text-[11px] font-medium leading-relaxed" style={{ color: '#71717a' }}>
                    {String(scopeDoc.visual_direction)}
                  </p>
                </motion.div>
              )}
            </div>

            {/* In scope */}
            {Array.isArray(scopeDoc.in_scope) && scopeDoc.in_scope.length > 0 && (
              <motion.div
                variants={{ hidden: { opacity: 0, y: 8 }, visible: { opacity: 1, y: 0 } }}
                className="rounded-2xl p-4"
                style={{ background: '#fafafa', border: '1px solid rgba(0,0,0,0.06)' }}
              >
                <p className="text-[9px] font-black uppercase tracking-widest mb-2" style={{ color: '#a1a1aa' }}>
                  In Scope
                </p>
                <ul className="space-y-1.5">
                  {(scopeDoc.in_scope as string[]).map((item, i) => (
                    <li key={i} className="text-[11px] font-medium flex gap-2" style={{ color: '#71717a' }}>
                      <span style={{ color: '#22c55e' }}>✓</span>{item}
                    </li>
                  ))}
                </ul>
              </motion.div>
            )}

            {/* Out of scope */}
            {Array.isArray(scopeDoc.out_of_scope) && scopeDoc.out_of_scope.length > 0 && (
              <motion.div
                variants={{ hidden: { opacity: 0, y: 8 }, visible: { opacity: 1, y: 0 } }}
                className="rounded-2xl p-4"
                style={{ background: '#fafafa', border: '1px solid rgba(0,0,0,0.06)' }}
              >
                <p className="text-[9px] font-black uppercase tracking-widest mb-2" style={{ color: '#a1a1aa' }}>
                  Out of Scope
                </p>
                <ul className="space-y-1.5">
                  {(scopeDoc.out_of_scope as string[]).map((item, i) => (
                    <li key={i} className="text-[11px] font-medium flex gap-2" style={{ color: '#a1a1aa' }}>
                      <span style={{ color: '#d4d4d8' }}>✕</span>{item}
                    </li>
                  ))}
                </ul>
              </motion.div>
            )}

            {/* Technical constraints */}
            {!!scopeDoc.technical_constraints && (
              <motion.div
                variants={{ hidden: { opacity: 0, y: 8 }, visible: { opacity: 1, y: 0 } }}
                className="rounded-2xl p-4"
                style={{ background: '#fafafa', border: '1px solid rgba(0,0,0,0.06)' }}
              >
                <p className="text-[9px] font-black uppercase tracking-widest mb-2" style={{ color: '#a1a1aa' }}>
                  Technical Constraints
                </p>
                <p className="text-[11px] font-medium leading-relaxed" style={{ color: '#71717a' }}>
                  {String(scopeDoc.technical_constraints)}
                </p>
              </motion.div>
            )}

            {/* Priority stack */}
            {Array.isArray(scopeDoc.priority_stack) && scopeDoc.priority_stack.length > 0 && (
              <motion.div
                variants={{ hidden: { opacity: 0, y: 8 }, visible: { opacity: 1, y: 0 } }}
                className="rounded-2xl p-4"
                style={{ background: '#fafafa', border: '1px solid rgba(0,0,0,0.06)' }}
              >
                <p className="text-[9px] font-black uppercase tracking-widest mb-2" style={{ color: '#a1a1aa' }}>
                  Priority Stack
                </p>
                <div className="space-y-1.5">
                  {(scopeDoc.priority_stack as string[]).map((item, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span
                        className="text-[9px] font-black w-5 h-5 rounded-md flex items-center justify-center shrink-0"
                        style={{ background: '#7EACEA15', color: '#7EACEA' }}
                      >
                        {i + 1}
                      </span>
                      <p className="text-[11px] font-medium" style={{ color: '#71717a' }}>{item}</p>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Clarifying questions */}
            {Array.isArray(scopeDoc.clarifying_questions) && scopeDoc.clarifying_questions.length > 0 && (
              <motion.div
                variants={{ hidden: { opacity: 0, y: 8 }, visible: { opacity: 1, y: 0 } }}
                className="rounded-2xl p-4"
                style={{ background: '#fffbeb', border: '1px solid #fef3c7' }}
              >
                <p className="text-[9px] font-black uppercase tracking-widest mb-2" style={{ color: '#f59e0b' }}>
                  Clarifying Questions
                </p>
                <ul className="space-y-1.5">
                  {(scopeDoc.clarifying_questions as string[]).map((q, i) => (
                    <li key={i} className="text-[11px] font-medium flex gap-2" style={{ color: '#92400e' }}>
                      <span style={{ color: '#f59e0b' }}>?</span>{q}
                    </li>
                  ))}
                </ul>
              </motion.div>
            )}
          </motion.div>
        )}
      </div>
    </motion.div>
  );
};

export default ManagersOfficeView;
