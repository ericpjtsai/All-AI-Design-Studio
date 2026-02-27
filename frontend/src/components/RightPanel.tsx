import React, { useState } from 'react';
import DesignViewer from './DesignViewer';
import FullLog from './FullLog';
import { useStore } from '../store/useStore';

type Tab = 'output' | 'log';

const RightPanel: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('output');
  const activities = useStore((s) => s.activities);

  return (
    <div className="flex-1 flex flex-col bg-zinc-950 overflow-hidden min-w-0">
      {/* ── Tab bar ── */}
      <div className="flex items-center gap-1 px-4 pt-4 pb-0 border-b border-zinc-800 shrink-0">
        <button
          type="button"
          onClick={() => setActiveTab('output')}
          className={`px-4 py-2 text-[11px] font-black uppercase tracking-widest rounded-t-lg transition-colors ${
            activeTab === 'output'
              ? 'text-[#7EACEA] border-b-2 border-[#7EACEA] -mb-px'
              : 'text-zinc-600 hover:text-zinc-400'
          }`}
        >
          Output
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('log')}
          className={`flex items-center gap-1.5 px-4 py-2 text-[11px] font-black uppercase tracking-widest rounded-t-lg transition-colors ${
            activeTab === 'log'
              ? 'text-[#7EACEA] border-b-2 border-[#7EACEA] -mb-px'
              : 'text-zinc-600 hover:text-zinc-400'
          }`}
        >
          Log
          {activities.length > 0 && (
            <span className="px-1.5 py-0.5 rounded-full bg-zinc-800 text-zinc-400 text-[9px] font-bold tabular-nums">
              {activities.length}
            </span>
          )}
        </button>
      </div>

      {/* ── Tab content ── */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'output' ? <DesignViewer /> : <FullLog />}
      </div>
    </div>
  );
};

export default RightPanel;
