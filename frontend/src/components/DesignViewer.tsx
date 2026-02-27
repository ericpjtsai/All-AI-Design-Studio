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
    <div className="border border-zinc-800 rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-zinc-900/60 hover:bg-zinc-900 transition-colors text-left"
      >
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-zinc-200">{title}</span>
          {badge && (
            <span
              className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-full"
              style={{ backgroundColor: `${badgeColor}20`, color: badgeColor }}
            >
              {badge}
            </span>
          )}
        </div>
        <span className="text-zinc-500 text-[11px]">{open ? '▲' : '▼'}</span>
      </button>
      {open && <div className="p-4">{children}</div>}
    </div>
  );
};

// ── Score pill ────────────────────────────────────────────────────────────────

const ScorePill: React.FC<{ label: string; value: number | null | undefined }> = ({ label, value }) => {
  const color = !value ? '#52525b' : value >= 8 ? '#22c55e' : value >= 6 ? '#eab308' : '#ef4444';
  return (
    <div className="flex items-center justify-between py-1 border-b border-zinc-800 last:border-0">
      <span className="text-[11px] text-zinc-400">{label}</span>
      <span className="text-[11px] font-bold tabular-nums" style={{ color }}>
        {value != null ? `${value}/10` : '—'}
      </span>
    </div>
  );
};

// ── Color swatch ──────────────────────────────────────────────────────────────

const ColorSwatch: React.FC<{ name: string; value: string }> = ({ name, value }) => (
  <div className="flex items-center gap-2">
    <div
      className="w-5 h-5 rounded border border-zinc-700 shrink-0"
      style={{ backgroundColor: value }}
    />
    <span className="text-[10px] text-zinc-400 truncate flex-1">{name}</span>
    <span className="text-[9px] text-zinc-600 tabular-nums font-mono">{value}</span>
  </div>
);

// ── Main component ────────────────────────────────────────────────────────────

export const DesignViewer: React.FC = () => {
  const sessionId = useStore((s) => s.sessionId);
  const workflowPhase = useStore((s) => s.workflowPhase);
  const designOutputs = useStore((s) => s.designOutputs);
  const setDesignOutputs = useStore((s) => s.setDesignOutputs);

  const [protoFullscreen, setProtoFullscreen] = useState(false);
  const [selectedComponent, setSelectedComponent] = useState<string | null>(null);

  // Poll outputs every 5s when a session is active
  useEffect(() => {
    if (!sessionId) return;

    const fetchOutputs = async () => {
      try {
        const res = await fetch(`/api/sessions/${sessionId}/outputs`);
        if (res.ok) {
          const data = await res.json() as DesignOutputs;
          setDesignOutputs(data);
        }
      } catch {
        // Ignore fetch errors — backend might not be ready yet
      }
    };

    fetchOutputs();
    const interval = setInterval(fetchOutputs, 5000);
    return () => clearInterval(interval);
  }, [sessionId, setDesignOutputs]);

  if (!sessionId && !designOutputs) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-8">
        <div className="w-12 h-12 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-2xl">
          🎨
        </div>
        <p className="text-zinc-400 text-sm font-medium">No session active</p>
        <p className="text-zinc-600 text-xs leading-relaxed">
          Enter a design brief on the left and start a session to see real-time design outputs here.
        </p>
      </div>
    );
  }

  const outputs = designOutputs;

  if (!outputs || Object.keys(outputs.scope_doc ?? {}).length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-[#7EACEA] animate-pulse" />
          <p className="text-zinc-400 text-sm">
            {workflowPhase === 'scoping' ? 'Analyzing brief…' : 'Waiting for outputs…'}
          </p>
        </div>
        <p className="text-zinc-600 text-xs">Outputs will appear here as agents complete their work.</p>
      </div>
    );
  }

  const scopeDoc = outputs.scope_doc ?? {};
  const seniorOut = outputs.senior_output ?? {};
  const visualOut = outputs.visual_output ?? {};
  const juniorOut = outputs.junior_output ?? {};
  const review = outputs.review ?? {};
  const seniorImplReview = outputs.senior_impl_review ?? {};

  // Extract tokens
  const tokens = (visualOut.design_tokens as Record<string, unknown>) ?? {};
  const colorPrimitives = (tokens.color as Record<string, unknown> ?? {}).primitives as Record<string, string> | undefined;
  const colorSemantic = (tokens.color as Record<string, unknown> ?? {}).semantic as Record<string, string> | undefined;

  // Extract components
  const components = (juniorOut.components as Array<Record<string, unknown>>) ?? [];
  const htmlPrototype = (juniorOut.html_prototype as string) ?? '';

  // Selected component code
  const selectedComp = components.find((c) => c.name === selectedComponent);

  return (
    <div className="flex flex-col h-full overflow-y-auto px-4 py-4 gap-3 [scrollbar-width:thin] [scrollbar-color:#3f3f46_transparent]">

      {/* Scope Document */}
      <Card title="Design Scope" badge="Confirmed" badgeColor="#22c55e" defaultOpen>
        <div className="space-y-2">
          {!!scopeDoc.project_overview && (
            <p className="text-xs text-zinc-300 leading-relaxed">{String(scopeDoc.project_overview)}</p>
          )}
          <div className="grid grid-cols-2 gap-2 mt-2">
            {!!scopeDoc.target_users && (
              <div>
                <p className="text-[9px] font-black uppercase tracking-wider text-zinc-600 mb-1">Users</p>
                <p className="text-[10px] text-zinc-400">{String(scopeDoc.target_users)}</p>
              </div>
            )}
            {!!scopeDoc.visual_direction && (
              <div>
                <p className="text-[9px] font-black uppercase tracking-wider text-zinc-600 mb-1">Visual</p>
                <p className="text-[10px] text-zinc-400">{String(scopeDoc.visual_direction)}</p>
              </div>
            )}
          </div>
          {Array.isArray(scopeDoc.in_scope) && scopeDoc.in_scope.length > 0 && (
            <div>
              <p className="text-[9px] font-black uppercase tracking-wider text-zinc-600 mb-1">In Scope</p>
              <ul className="space-y-0.5">
                {(scopeDoc.in_scope as string[]).map((item, i) => (
                  <li key={i} className="text-[10px] text-zinc-400 flex gap-1">
                    <span className="text-green-500">✓</span>{item}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </Card>

      {/* Wireframes */}
      {!!seniorOut.wireframes && (
        <Card title="Wireframes" badge={`${(seniorOut.wireframes as unknown[]).length} screens`}>
          <div className="space-y-2">
            {((seniorOut.wireframes as Array<Record<string, unknown>>) ?? []).map((w, i) => (
              <div key={i} className="border border-zinc-800 rounded-lg p-3">
                <p className="text-[11px] font-bold text-zinc-200 mb-1">
                  {String(w.screen_name ?? w.screen_id ?? `Screen ${i + 1}`)}
                </p>
                {!!w.layout_props && (
                  <p className="text-[10px] text-zinc-500 font-mono">
                    {JSON.stringify(w.layout_props).slice(0, 80)}
                  </p>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Design Tokens */}
      {Object.keys(tokens).length > 0 && (
        <Card title="Design Tokens" badge={`${Object.keys(tokens).length} categories`} badgeColor="#EF52BA">
          <div className="space-y-3">
            {colorPrimitives && (
              <div>
                <p className="text-[9px] font-black uppercase tracking-wider text-zinc-600 mb-2">Color Primitives</p>
                <div className="space-y-1">
                  {Object.entries(colorPrimitives).slice(0, 8).map(([k, v]) => (
                    <ColorSwatch key={k} name={k} value={String(v)} />
                  ))}
                  {Object.keys(colorPrimitives).length > 8 && (
                    <p className="text-[9px] text-zinc-600">+{Object.keys(colorPrimitives).length - 8} more</p>
                  )}
                </div>
              </div>
            )}
            {colorSemantic && (
              <div>
                <p className="text-[9px] font-black uppercase tracking-wider text-zinc-600 mb-2">Semantic Colors</p>
                <div className="space-y-1">
                  {Object.entries(colorSemantic).slice(0, 6).map(([k, v]) => (
                    <ColorSwatch key={k} name={k} value={String(v)} />
                  ))}
                </div>
              </div>
            )}
            {!!tokens.typography && (
              <div>
                <p className="text-[9px] font-black uppercase tracking-wider text-zinc-600 mb-1">Typography</p>
                <pre className="text-[9px] text-zinc-500 font-mono overflow-x-auto">
                  {JSON.stringify(tokens.typography, null, 2).slice(0, 200)}
                </pre>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* React Components */}
      {components.length > 0 && (
        <Card title="React Components" badge={`${components.length} built`} badgeColor="#ef4444">
          <div className="space-y-2">
            <div className="flex flex-wrap gap-1.5 mb-3">
              {components.map((c) => (
                <button
                  key={String(c.name)}
                  type="button"
                  onClick={() => setSelectedComponent(selectedComponent === c.name ? null : String(c.name))}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-colors ${
                    selectedComponent === c.name
                      ? 'bg-[#ef4444]/20 text-[#ef4444] border border-[#ef4444]/40'
                      : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200 border border-zinc-700'
                  }`}
                >
                  {String(c.name)}
                </button>
              ))}
            </div>

            {selectedComp && (
              <div className="rounded-lg bg-zinc-950 border border-zinc-800 overflow-hidden">
                <div className="flex items-center justify-between px-3 py-1.5 border-b border-zinc-800">
                  <span className="text-[10px] font-bold text-zinc-300">{String(selectedComp.name)}.tsx</span>
                  <span className="text-[9px] text-zinc-600">TypeScript · React</span>
                </div>
                <pre className="text-[9px] text-zinc-400 font-mono p-3 overflow-x-auto max-h-64 overflow-y-auto leading-relaxed">
                  {String(selectedComp.tsx_code ?? '')}
                </pre>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* HTML Prototype */}
      {htmlPrototype && (
        <Card title="HTML Prototype" badge="Live Preview" badgeColor="#7EACEA">
          <div className="space-y-2">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] text-zinc-500">Rendered in sandboxed iframe</p>
              <button
                type="button"
                onClick={() => setProtoFullscreen(true)}
                className="text-[10px] text-[#7EACEA] hover:text-white transition-colors"
              >
                ⤢ Full screen
              </button>
            </div>
            <div className="rounded-lg overflow-hidden border border-zinc-800 bg-white" style={{ height: '300px' }}>
              <iframe
                srcDoc={htmlPrototype}
                sandbox="allow-scripts allow-same-origin"
                className="w-full h-full"
                title="HTML Prototype"
              />
            </div>
          </div>
        </Card>
      )}

      {/* Senior Implementation Review */}
      {Object.keys(seniorImplReview).length > 0 && (
        <Card title="Senior Review" badge="UX Audit" badgeColor="#22c55e">
          <div className="space-y-2">
            <div className="space-y-0.5">
              <ScorePill label="UX Adherence" value={seniorImplReview.ux_adherence_score as number} />
              <ScorePill label="Token Usage" value={seniorImplReview.token_usage_score as number} />
            </div>
            {Array.isArray(seniorImplReview.positive_highlights) && seniorImplReview.positive_highlights.length > 0 && (
              <div>
                <p className="text-[9px] font-black uppercase tracking-wider text-zinc-600 mb-1">Highlights</p>
                {(seniorImplReview.positive_highlights as string[]).map((h, i) => (
                  <p key={i} className="text-[10px] text-green-400 flex gap-1"><span>✓</span>{h}</p>
                ))}
              </div>
            )}
            {Array.isArray(seniorImplReview.component_issues) && seniorImplReview.component_issues.length > 0 && (
              <div>
                <p className="text-[9px] font-black uppercase tracking-wider text-zinc-600 mb-1">Issues</p>
                {(seniorImplReview.component_issues as string[]).map((issue, i) => (
                  <p key={i} className="text-[10px] text-yellow-400 flex gap-1"><span>⚠</span>{issue}</p>
                ))}
              </div>
            )}
            {!!seniorImplReview.overall_assessment && (
              <p className="text-[10px] text-zinc-400 leading-relaxed">{String(seniorImplReview.overall_assessment)}</p>
            )}
          </div>
        </Card>
      )}

      {/* Quality Review */}
      {Object.keys(review).length > 0 && (
        <Card title="Quality Review" badge={`${review.overall_score ?? '—'}/10`} badgeColor="#7EACEA" defaultOpen>
          <div className="space-y-2">
            <div className="space-y-0.5">
              <ScorePill label="Overall" value={review.overall_score as number} />
              <ScorePill label="Scope Alignment" value={review.scope_alignment as number} />
              <ScorePill label="Completeness" value={review.completeness as number} />
              <ScorePill label="Coherence" value={review.coherence as number} />
              <ScorePill label="Production Readiness" value={review.production_readiness as number} />
            </div>
            {!!review.summary && (
              <p className="text-[10px] text-zinc-400 leading-relaxed mt-2">{String(review.summary)}</p>
            )}
          </div>
        </Card>
      )}

      {/* Fullscreen prototype modal */}
      {protoFullscreen && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex flex-col"
          onClick={() => setProtoFullscreen(false)}
        >
          <div className="flex items-center justify-between p-4">
            <span className="text-zinc-300 text-sm font-bold">HTML Prototype — Full Screen</span>
            <button type="button" className="text-zinc-400 hover:text-white text-xl">✕</button>
          </div>
          <div className="flex-1 m-4 rounded-xl overflow-hidden bg-white" onClick={(e) => e.stopPropagation()}>
            <iframe
              srcDoc={htmlPrototype}
              sandbox="allow-scripts allow-same-origin"
              className="w-full h-full"
              title="HTML Prototype Full"
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default DesignViewer;
