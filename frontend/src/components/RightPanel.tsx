import React, { useState } from 'react';
import DesignViewer from './DesignViewer';
import FullLog from './FullLog';
import { useStore } from '../store/useStore';

type Tab = 'output' | 'log';

const RightPanel: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('output');
  const activities = useStore((s) => s.activities);

  return (
    <div className="flex-1 flex flex-col bg-white overflow-hidden min-w-0" style={{ borderRadius: 32, border: '1px solid rgba(0,0,0,0.05)', boxShadow: '0 8px 40px rgba(0,0,0,0.08)' }}>
      {/* Accent bar */}
      <div className="h-1.5 w-full shrink-0" style={{ background: '#7EACEA' }} />

      {/* Tab bar */}
      <div className="flex items-center gap-1 px-7 pt-5 pb-0 shrink-0" style={{ borderBottom: '1px solid #f4f4f5' }}>
        <button
          type="button"
          onClick={() => setActiveTab('output')}
          className="px-1 pb-3.5 text-[10px] font-black uppercase tracking-widest transition-colors relative"
          style={{
            color: activeTab === 'output' ? '#18181b' : '#a1a1aa',
            marginRight: 20,
          }}
        >
          Output
          {activeTab === 'output' && (
            <span className="absolute bottom-0 left-0 w-full h-0.5 rounded-full" style={{ background: '#7EACEA' }} />
          )}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('log')}
          className="pb-3.5 text-[10px] font-black uppercase tracking-widest transition-colors relative flex items-center gap-1.5"
          style={{ color: activeTab === 'log' ? '#18181b' : '#a1a1aa' }}
        >
          Log
          {activities.length > 0 && (
            <span
              className="px-1.5 py-0.5 rounded-full text-[9px] font-bold tabular-nums"
              style={{ background: '#f4f4f5', color: '#71717a' }}
            >
              {activities.length}
            </span>
          )}
          {activeTab === 'log' && (
            <span className="absolute bottom-0 left-0 w-full h-0.5 rounded-full" style={{ background: '#7EACEA' }} />
          )}
        </button>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'output' ? <DesignViewer /> : <FullLog />}
      </div>
    </div>
  );
};

export default RightPanel;
