import React, { useState, useEffect } from 'react';
import { useStore, DesignOutputs } from '../store/useStore';

// ── Collapsible card ──────────────────────────────────────────────────────────

const Card: React.FC<{
  title: string;
  badge?: string;
  badgeColor?: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}> = ({ title, badge, badgeColor = '#7EACEA', children, defaultOpen = false }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="overflow-hidden" style={{ border: '1px solid rgba(0,0,0,0.06)', borderRadius: 16 }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-5 py-3.5 text-left transition-colors"
        style={{ background: open ? '#fff' : '#fafafa' }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '#f4f4f5'; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = open ? '#fff' : '#fafafa'; }}
      >
        <div className="flex items-center gap-2.5">
          <span className="text-[12px] font-black text-zinc-900">{title}</span>
          {badge && (
            <span
              className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full"
              style={{ background: `${badgeColor}15`, color: badgeColor }}
            >
              {badge}
            </span>
          )}
        </div>
        <span className="text-[10px]" style={{ color: '#a1a1aa' }}>{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="px-5 pb-5 pt-1 bg-white" style={{ borderTop: '1px solid #f4f4f5' }}>
          {children}
        </div>
      )}
    </div>
  );
};

// ── Score pill ────────────────────────────────────────────────────────────────

const ScorePill: React.FC<{ label: string; value: number | null | undefined }> = ({ label, value }) => {
  const color = !value ? '#d4d4d8' : value >= 8 ? '#22c55e' : value >= 6 ? '#f59e0b' : '#ef4444';
  return (
    <div className="flex items-center justify-between py-1.5" style={{ borderBottom: '1px solid #f4f4f5' }}>
      <span className="text-[11px] font-medium" style={{ color: '#71717a' }}>{label}</span>
      <span className="text-[11px] font-black tabular-nums" style={{ color }}>
        {value != null ? `${value}/10` : '—'}
      </span>
    </div>
  );
};

// ── Color swatch ──────────────────────────────────────────────────────────────

const ColorSwatch: React.FC<{ name: string; value: string }> = ({ name, value }) => (
  <div className="flex items-center gap-2.5">
    <div
      className="w-5 h-5 rounded-md shrink-0"
      style={{ background: value, border: '1px solid rgba(0,0,0,0.08)', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}
    />
    <span className="text-[10px] font-medium truncate flex-1" style={{ color: '#71717a' }}>{name}</span>
    <span className="text-[9px] tabular-nums font-mono" style={{ color: '#a1a1aa' }}>{value}</span>
  </div>
);

// ── Main component ────────────────────────────────────────────────────────────

interface DesignViewerProps {
  agentFilter?: string | null; // 'manager' | 'senior' | 'junior' | 'visual' | null (show all)
}

export const DesignViewer: React.FC<DesignViewerProps> = ({ agentFilter }) => {
  const sessionId = useStore((s) => s.sessionId);
  const workflowPhase = useStore((s) => s.workflowPhase);
  const designOutputs = useStore((s) => s.designOutputs);
  const setDesignOutputs = useStore((s) => s.setDesignOutputs);

  const [protoFullscreen, setProtoFullscreen] = useState(false);
  const [selectedComponent, setSelectedComponent] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionId) return;
    const fetchOutputs = async () => {
      try {
        const res = await fetch(`/api/sessions/${sessionId}/outputs`);
        if (res.ok) {
          const data = await res.json() as DesignOutputs;
          setDesignOutputs(data);
        }
      } catch { /* ignore */ }
    };
    fetchOutputs();
    const interval = setInterval(fetchOutputs, 5000);
    return () => clearInterval(interval);
  }, [sessionId, setDesignOutputs]);

  if (!sessionId && !designOutputs) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-12">
        <div className="w-14 h-14 rounded-[20px] flex items-center justify-center text-2xl" style={{ background: '#f4f4f5', border: '1px solid rgba(0,0,0,0.05)' }}>
          🎨
        </div>
        <div>
          <p className="text-[14px] font-black text-zinc-900 mb-1">No session active</p>
          <p className="text-[12px] font-medium leading-relaxed" style={{ color: '#a1a1aa' }}>
            Enter a design brief on the left and start a session to see real-time design outputs here.
          </p>
        </div>
      </div>
    );
  }

  const outputs = designOutputs;

  if (!outputs || Object.keys(outputs.scope_doc ?? {}).length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: '#7EACEA' }} />
          <p className="text-[13px] font-medium" style={{ color: '#71717a' }}>
            {workflowPhase === 'scoping' ? 'Analyzing brief…' : 'Waiting for outputs…'}
          </p>
        </div>
        <p className="text-[11px] font-medium" style={{ color: '#d4d4d8' }}>
          Outputs appear here as agents complete their work.
        </p>
      </div>
    );
  }

  const scopeDoc = outputs.scope_doc ?? {};
  const seniorOut = outputs.senior_output ?? {};
  const visualOut = outputs.visual_output ?? {};
  const juniorOut = outputs.junior_output ?? {};
  const review = outputs.review ?? {};
  const seniorImplReview = outputs.senior_impl_review ?? {};

  const tokens = (visualOut.design_tokens as Record<string, unknown>) ?? {};
  const colorPrimitives = (tokens.color as Record<string, unknown> ?? {}).primitives as Record<string, string> | undefined;
  const colorSemantic = (tokens.color as Record<string, unknown> ?? {}).semantic as Record<string, string> | undefined;
  const components = (juniorOut.components as Array<Record<string, unknown>>) ?? [];
  const htmlPrototype = (juniorOut.html_prototype as string) ?? '';
  const selectedComp = components.find((c) => c.name === selectedComponent);

  // Agent filter: which sections to show per agent role
  // null = show all, 'manager' = scope + quality, 'senior' = wireframes + senior review,
  // 'junior' = components + prototype, 'visual' = tokens
  const show = (owners: string[]) => !agentFilter || owners.includes(agentFilter);

  return (
    <div className="flex flex-col h-full overflow-y-auto px-6 py-5 gap-3">

      {/* Scope Document — owned by manager */}
      {show(['manager']) && <Card title="Design Scope" badge="Confirmed" badgeColor="#22c55e" defaultOpen>
        <div className="space-y-3 pt-3">
          {!!scopeDoc.project_overview && (
            <p className="text-[12px] font-medium leading-relaxed" style={{ color: '#52525b' }}>{String(scopeDoc.project_overview)}</p>
          )}
          <div className="grid grid-cols-2 gap-3">
            {!!scopeDoc.target_users && (
              <div>
                <p className="text-[9px] font-black uppercase tracking-wider mb-1" style={{ color: '#a1a1aa' }}>Users</p>
                <p className="text-[11px] font-medium" style={{ color: '#71717a' }}>{String(scopeDoc.target_users)}</p>
              </div>
            )}
            {!!scopeDoc.visual_direction && (
              <div>
                <p className="text-[9px] font-black uppercase tracking-wider mb-1" style={{ color: '#a1a1aa' }}>Visual</p>
                <p className="text-[11px] font-medium" style={{ color: '#71717a' }}>{String(scopeDoc.visual_direction)}</p>
              </div>
            )}
          </div>
          {Array.isArray(scopeDoc.in_scope) && scopeDoc.in_scope.length > 0 && (
            <div>
              <p className="text-[9px] font-black uppercase tracking-wider mb-2" style={{ color: '#a1a1aa' }}>In Scope</p>
              <ul className="space-y-1">
                {(scopeDoc.in_scope as string[]).map((item, i) => (
                  <li key={i} className="text-[11px] font-medium flex gap-1.5" style={{ color: '#71717a' }}>
                    <span style={{ color: '#22c55e' }}>✓</span>{item}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </Card>}

      {/* Wireframes — owned by senior */}
      {show(['senior']) && !!seniorOut.wireframes && (
        <Card title="Wireframes" badge={`${(seniorOut.wireframes as unknown[]).length} screens`}>
          <div className="space-y-2 pt-3">
            {((seniorOut.wireframes as Array<Record<string, unknown>>) ?? []).map((w, i) => (
              <div key={i} className="rounded-xl p-3" style={{ background: '#fafafa', border: '1px solid #f0f0f0' }}>
                <p className="text-[12px] font-black text-zinc-900 mb-1">
                  {String(w.screen_name ?? w.screen_id ?? `Screen ${i + 1}`)}
                </p>
                {!!w.layout_props && (
                  <p className="text-[10px] font-mono" style={{ color: '#a1a1aa' }}>
                    {JSON.stringify(w.layout_props).slice(0, 80)}
                  </p>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Design Tokens — owned by visual */}
      {show(['visual']) && Object.keys(tokens).length > 0 && (
        <Card title="Design Tokens" badge={`${Object.keys(tokens).length} categories`} badgeColor="#EF52BA">
          <div className="space-y-4 pt-3">
            {colorPrimitives && (
              <div>
                <p className="text-[9px] font-black uppercase tracking-wider mb-2" style={{ color: '#a1a1aa' }}>Color Primitives</p>
                <div className="space-y-1.5">
                  {Object.entries(colorPrimitives).slice(0, 8).map(([k, v]) => (
                    <ColorSwatch key={k} name={k} value={String(v)} />
                  ))}
                  {Object.keys(colorPrimitives).length > 8 && (
                    <p className="text-[9px] font-medium" style={{ color: '#d4d4d8' }}>+{Object.keys(colorPrimitives).length - 8} more</p>
                  )}
                </div>
              </div>
            )}
            {colorSemantic && (
              <div>
                <p className="text-[9px] font-black uppercase tracking-wider mb-2" style={{ color: '#a1a1aa' }}>Semantic Colors</p>
                <div className="space-y-1.5">
                  {Object.entries(colorSemantic).slice(0, 6).map(([k, v]) => (
                    <ColorSwatch key={k} name={k} value={String(v)} />
                  ))}
                </div>
              </div>
            )}
            {!!tokens.typography && (
              <div>
                <p className="text-[9px] font-black uppercase tracking-wider mb-1.5" style={{ color: '#a1a1aa' }}>Typography</p>
                <pre className="text-[9px] font-mono overflow-x-auto rounded-xl p-3" style={{ background: '#fafafa', color: '#71717a' }}>
                  {JSON.stringify(tokens.typography, null, 2).slice(0, 200)}
                </pre>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* React Components — owned by junior */}
      {show(['junior']) && components.length > 0 && (
        <Card title="React Components" badge={`${components.length} built`} badgeColor="#ef4444">
          <div className="space-y-2 pt-3">
            <div className="flex flex-wrap gap-1.5 mb-3">
              {components.map((c) => (
                <button
                  key={String(c.name)}
                  type="button"
                  onClick={() => setSelectedComponent(selectedComponent === c.name ? null : String(c.name))}
                  className="px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wide transition-all"
                  style={
                    selectedComponent === c.name
                      ? { background: '#fff0f0', color: '#ef4444', border: '1.5px solid #fecaca' }
                      : { background: '#f4f4f5', color: '#71717a', border: '1.5px solid transparent' }
                  }
                >
                  {String(c.name)}
                </button>
              ))}
            </div>
            {selectedComp && (
              <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #f0f0f0' }}>
                <div className="flex items-center justify-between px-3 py-2" style={{ background: '#fafafa', borderBottom: '1px solid #f0f0f0' }}>
                  <span className="text-[10px] font-black text-zinc-900">{String(selectedComp.name)}.tsx</span>
                  <span className="text-[9px] font-medium" style={{ color: '#a1a1aa' }}>TypeScript · React</span>
                </div>
                <pre className="text-[9px] font-mono p-3 overflow-x-auto max-h-64 overflow-y-auto leading-relaxed bg-white" style={{ color: '#52525b' }}>
                  {String(selectedComp.tsx_code ?? '')}
                </pre>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* HTML Prototype — owned by junior */}
      {show(['junior']) && htmlPrototype && (
        <Card title="HTML Prototype" badge="Live Preview" badgeColor="#7EACEA">
          <div className="space-y-2 pt-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-medium" style={{ color: '#a1a1aa' }}>Rendered in sandboxed iframe</p>
              <button
                type="button"
                onClick={() => setProtoFullscreen(true)}
                className="text-[10px] font-black uppercase tracking-wide transition-colors hover:opacity-70"
                style={{ color: '#7EACEA' }}
              >
                ⤢ Full Screen
              </button>
            </div>
            <div className="rounded-xl overflow-hidden bg-white" style={{ height: 280, border: '1px solid #f0f0f0' }}>
              <iframe srcDoc={htmlPrototype} sandbox="allow-scripts allow-same-origin" className="w-full h-full" title="HTML Prototype" />
            </div>
          </div>
        </Card>
      )}

      {/* Senior Review — owned by senior */}
      {show(['senior']) && Object.keys(seniorImplReview).length > 0 && (
        <Card title="Senior Review" badge="UX Audit" badgeColor="#22c55e">
          <div className="space-y-3 pt-3">
            <ScorePill label="UX Adherence" value={seniorImplReview.ux_adherence_score as number} />
            <ScorePill label="Token Usage" value={seniorImplReview.token_usage_score as number} />
            {Array.isArray(seniorImplReview.positive_highlights) && seniorImplReview.positive_highlights.length > 0 && (
              <div>
                <p className="text-[9px] font-black uppercase tracking-wider mb-1.5" style={{ color: '#a1a1aa' }}>Highlights</p>
                {(seniorImplReview.positive_highlights as string[]).map((h, i) => (
                  <p key={i} className="text-[11px] font-medium flex gap-1.5" style={{ color: '#22c55e' }}><span>✓</span>{h}</p>
                ))}
              </div>
            )}
            {Array.isArray(seniorImplReview.component_issues) && seniorImplReview.component_issues.length > 0 && (
              <div>
                <p className="text-[9px] font-black uppercase tracking-wider mb-1.5" style={{ color: '#a1a1aa' }}>Issues</p>
                {(seniorImplReview.component_issues as string[]).map((issue, i) => (
                  <p key={i} className="text-[11px] font-medium flex gap-1.5" style={{ color: '#f59e0b' }}><span>⚠</span>{issue}</p>
                ))}
              </div>
            )}
            {!!seniorImplReview.overall_assessment && (
              <p className="text-[11px] font-medium leading-relaxed" style={{ color: '#71717a' }}>{String(seniorImplReview.overall_assessment)}</p>
            )}
          </div>
        </Card>
      )}

      {/* Quality Review — owned by manager */}
      {show(['manager']) && Object.keys(review).length > 0 && (
        <Card title="Quality Review" badge={`${review.overall_score ?? '—'}/10`} badgeColor="#7EACEA" defaultOpen>
          <div className="space-y-1 pt-3">
            <ScorePill label="Overall" value={review.overall_score as number} />
            <ScorePill label="Scope Alignment" value={review.scope_alignment as number} />
            <ScorePill label="Completeness" value={review.completeness as number} />
            <ScorePill label="Coherence" value={review.coherence as number} />
            <ScorePill label="Production Readiness" value={review.production_readiness as number} />
            {!!review.summary && (
              <p className="text-[11px] font-medium leading-relaxed pt-2" style={{ color: '#71717a' }}>{String(review.summary)}</p>
            )}
          </div>
        </Card>
      )}

      {/* Fullscreen modal */}
      {protoFullscreen && (
        <div className="fixed inset-0 z-50 flex flex-col" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }} onClick={() => setProtoFullscreen(false)}>
          <div className="flex items-center justify-between p-5">
            <span className="text-sm font-black text-white">HTML Prototype — Full Screen</span>
            <button type="button" className="text-white/60 hover:text-white text-xl transition-colors">✕</button>
          </div>
          <div className="flex-1 m-5 mt-0 rounded-2xl overflow-hidden bg-white" onClick={(e) => e.stopPropagation()}>
            <iframe srcDoc={htmlPrototype} sandbox="allow-scripts allow-same-origin" className="w-full h-full" title="HTML Prototype Full" />
          </div>
        </div>
      )}
    </div>
  );
};

export default DesignViewer;
