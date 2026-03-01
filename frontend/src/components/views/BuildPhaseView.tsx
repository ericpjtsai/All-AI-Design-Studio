import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { useStore } from '../../store/useStore';
import { CheckCircle2, Circle, Loader2, Zap, Eye, Code2, Download } from 'lucide-react';

// ── Design tokens ─────────────────────────────────────────────────────────────

const VS = {
  bg: '#0d1117',
  surface: '#161b22',
  elevated: '#1c2128',
  border: '#30363d',
  borderSubtle: '#21262d',
  text: '#e6edf3',
  muted: '#8b949e',
  lineNum: '#464d55',
  cursor: '#58a6ff',
  selection: '#1c2b3a',
};

const SYN = {
  keyword: '#ff7b72',
  string: '#a5d6ff',
  comment: '#8b949e',
  type: '#d2a8ff',
  func: '#d2a8ff',
  prop: '#79c0ff',
  constant: '#ffa657',
  punct: '#e6edf3',
};

const JUNIOR_COLOR = '#ef4444';


// ── Component tree ────────────────────────────────────────────────────────────

const TREE_ITEMS = [
  { name: 'Dashboard', file: 'Dashboard.tsx', startPct: 0.0 },
  { name: 'Sidebar', file: 'Sidebar.tsx', startPct: 0.08 },
  { name: 'TopHeader', file: 'Header.tsx', startPct: 0.22 },
  { name: 'MetricCard', file: 'MetricCard.tsx', startPct: 0.42 },
  { name: 'ChartPanel', file: 'ChartPanel.tsx', startPct: 0.68 },
];

function getItemStatus(pct: number, startPct: number): 'done' | 'active' | 'pending' {
  if (pct >= startPct + 0.20) return 'done';
  if (pct >= startPct) return 'active';
  return 'pending';
}

// ── Syntax highlighter ────────────────────────────────────────────────────────

function highlight(raw: string): string {
  if (!raw.trim()) return '\u00a0';
  const e = raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  return e
    .replace(/(\/\/[^\n]*)$/, `<span style="color:${SYN.comment};font-style:italic">$1</span>`)
    .replace(/('[^']*'|"[^"]*")/g, `<span style="color:${SYN.string}">$1</span>`)
    .replace(
      /\b(import|export|from|const|let|var|return|interface|type|extends|async|await|true|false|null|undefined|default)\b/g,
      `<span style="color:${SYN.keyword}">$1</span>`,
    )
    .replace(
      /\b(React|FC|useState|useEffect|useRef|motion|ReactNode)\b/g,
      `<span style="color:${SYN.type}">$1</span>`,
    )
    .replace(
      /\b(MetricCard|TrendBadge|Skeleton|header)\b/g,
      `<span style="color:${SYN.prop}">$1</span>`,
    );
}

// ── StatusBadge ───────────────────────────────────────────────────────────────

const PulseDot: React.FC = () => (
  <span className="relative inline-flex items-center justify-center w-2 h-2 mr-1.5">
    <span
      className="absolute inline-flex w-full h-full rounded-full animate-ping opacity-60"
      style={{ background: JUNIOR_COLOR }}
    />
    <span
      className="relative inline-flex rounded-full w-1.5 h-1.5"
      style={{ background: JUNIOR_COLOR }}
    />
  </span>
);

// ── Main component ────────────────────────────────────────────────────────────

const BuildPhaseView: React.FC = () => {
  const agentStates = useStore((s) => s.agentStates);
  const designOutputs = useStore((s) => s.designOutputs);
  const streamingPrototype = useStore((s) => s.streamingPrototype);
  const juniorState = agentStates[2];
  const isComplete = juniorState?.status === 'complete' || juniorState?.status === 'done';

  const htmlPrototype = designOutputs?.junior_output?.html_prototype as string | undefined;
  const [tab, setTab] = useState<'code' | 'preview'>('code');

  // Debounced iframe HTML — update at most every 600 ms to avoid excessive reloads
  const [iframeHtml, setIframeHtml] = useState('');
  useEffect(() => {
    const candidate = htmlPrototype || streamingPrototype;
    if (!candidate) return;
    const t = setTimeout(() => setIframeHtml(candidate), 600);
    return () => clearTimeout(t);
  }, [htmlPrototype, streamingPrototype]);

  // Auto-switch to preview as soon as streaming begins or build completes
  const didAutoSwitch = useRef(false);
  useEffect(() => {
    if (!didAutoSwitch.current && (streamingPrototype.length > 100 || (isComplete && htmlPrototype))) {
      didAutoSwitch.current = true;
      setTab('preview');
    }
  }, [streamingPrototype, isComplete, htmlPrototype]);

  const isStreaming = streamingPrototype.length > 0 && !isComplete;

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

  // Backend sends junior_output.components[].tsx_code — join them into one stream
  const rawComponents = designOutputs?.junior_output?.components;
  const backendCode = Array.isArray(rawComponents) && rawComponents.length > 0
    ? (rawComponents as Record<string, unknown>[])
        .map((c) => `// ── ${String(c.name ?? 'Component')} ──\n${String(c.tsx_code ?? '')}`)
        .join('\n\n')
    : null;
  const activeLines: string[] =
    backendCode != null && backendCode.trim().length > 0
      ? backendCode.split('\n')
      : [];

  // Build component tree from backend data, fall back to mock
  interface TreeItem { name: string; file: string; startPct: number; }
  const treeItems: TreeItem[] = Array.isArray(rawComponents) && rawComponents.length > 0
    ? (rawComponents as Record<string, unknown>[]).map((c, i, arr) => ({
        name: String(c.name ?? `Component${i + 1}`),
        file: `${String(c.name ?? `Component${i + 1}`)}.tsx`,
        startPct: i / arr.length,
      }))
    : TREE_ITEMS;

  const [visibleLines, setVisibleLines] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const codeRef = useRef<HTMLDivElement>(null);

  const totalLines = activeLines.length;
  const pct = visibleLines / totalLines;

  // Streaming animation — 2 lines per 120 ms
  useEffect(() => {
    if (isComplete) {
      setVisibleLines(totalLines);
      return;
    }
    if (visibleLines < totalLines) {
      timerRef.current = setTimeout(() => {
        setVisibleLines((c) => Math.min(c + 2, totalLines));
      }, 120);
    }
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [visibleLines, totalLines, isComplete]);

  // When real backend code first arrives, restart stream from line 0
  const prevBackendCode = useRef<string | null>(null);
  useEffect(() => {
    if (backendCode !== null && backendCode !== prevBackendCode.current) {
      prevBackendCode.current = backendCode;
      if (!isComplete) setVisibleLines(0);
    }
  }, [backendCode, isComplete]);

  // Auto-scroll code area
  useEffect(() => {
    if (codeRef.current) {
      codeRef.current.scrollTop = codeRef.current.scrollHeight;
    }
  }, [visibleLines]);

  const currentFile = (() => {
    const active = treeItems.slice().reverse().find(
      (t) => pct >= t.startPct,
    );
    return active?.file ?? 'Dashboard.tsx';
  })();

  return (
    <motion.div
      className="h-full flex flex-col overflow-hidden"
      style={{ background: VS.bg }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* ── Tab bar ─────────────────────────────────────────────────────── */}
      <div
        className="flex items-center gap-0 shrink-0 select-none"
        style={{
          background: VS.surface,
          borderBottom: `1px solid ${VS.border}`,
          height: 38,
          paddingLeft: 0,
        }}
      >
        {/* Code tab */}
        <button
          onClick={() => setTab('code')}
          className="flex items-center gap-1.5 px-4 h-full"
          style={{
            background: tab === 'code' ? VS.bg : 'transparent',
            borderRight: `1px solid ${VS.border}`,
            borderBottom: tab === 'code' ? `2px solid ${JUNIOR_COLOR}` : '2px solid transparent',
            marginBottom: -1,
            cursor: 'pointer',
            border: 'none',
            outline: 'none',
          }}
        >
          <Code2 size={11} color={tab === 'code' ? SYN.prop : VS.muted} />
          <span style={{ color: tab === 'code' ? VS.text : VS.muted, fontSize: 12, fontFamily: 'ui-monospace, "Cascadia Code", "Fira Code", monospace' }}>
            {currentFile}
          </span>
          {!isComplete && tab === 'code' && (
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: JUNIOR_COLOR, display: 'inline-block', marginLeft: 2 }} />
          )}
        </button>

        {/* Preview tab — shows during streaming or when complete */}
        {(isStreaming || (isComplete && htmlPrototype)) && (
          <button
            onClick={() => setTab('preview')}
            className="flex items-center gap-1.5 px-4 h-full"
            style={{
              background: tab === 'preview' ? VS.bg : 'transparent',
              borderRight: `1px solid ${VS.border}`,
              borderBottom: tab === 'preview' ? `2px solid #22c55e` : '2px solid transparent',
              marginBottom: -1,
              cursor: 'pointer',
              border: 'none',
              outline: 'none',
            }}
          >
            <Eye size={11} color={tab === 'preview' ? '#22c55e' : VS.muted} />
            <span style={{ color: tab === 'preview' ? '#22c55e' : VS.muted, fontSize: 12, fontFamily: 'ui-monospace, "Cascadia Code", "Fira Code", monospace' }}>
              Preview
            </span>
            {isStreaming && (
              <span style={{
                fontSize: 8,
                fontWeight: 700,
                letterSpacing: '0.06em',
                color: '#22c55e',
                background: '#22c55e18',
                border: '1px solid #22c55e40',
                borderRadius: 4,
                padding: '1px 4px',
                marginLeft: 2,
              }}>
                LIVE
              </span>
            )}
          </button>
        )}

        {/* Right side */}
        <div className="ml-auto flex items-center gap-2 pr-3">
          {isComplete && htmlPrototype && tab === 'preview' && (
            <button
              onClick={handleExport}
              className="flex items-center gap-1.5"
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: VS.muted, fontSize: 10, fontFamily: 'ui-monospace, monospace' }}
            >
              <Download size={10} />
              export
            </button>
          )}
          {!isComplete ? (
            <div className="flex items-center" style={{ background: `${JUNIOR_COLOR}15`, border: `1px solid ${JUNIOR_COLOR}40`, borderRadius: 20, padding: '3px 10px', fontSize: 10, color: JUNIOR_COLOR, fontFamily: 'ui-monospace, monospace', letterSpacing: '0.02em' }}>
              <PulseDot />
              Junior Compiling…
            </div>
          ) : (
            <div className="flex items-center gap-1.5" style={{ background: '#22c55e15', border: '1px solid #22c55e40', borderRadius: 20, padding: '3px 10px', fontSize: 10, color: '#22c55e', fontFamily: 'ui-monospace, monospace' }}>
              <CheckCircle2 size={10} />
              Build Complete
            </div>
          )}
        </div>
      </div>

      {/* ── Preview pane — live during streaming, final when complete ─────── */}
      {tab === 'preview' && iframeHtml && (
        <iframe
          className="flex-1 w-full border-0"
          srcDoc={iframeHtml}
          title="Prototype Preview"
          sandbox="allow-scripts allow-same-origin"
          style={{ background: '#fff' }}
        />
      )}
      {tab === 'preview' && !iframeHtml && (
        <div className="flex-1 flex items-center justify-center" style={{ background: VS.bg }}>
          <motion.div
            animate={{ opacity: [0.3, 0.8, 0.3] }}
            transition={{ duration: 1.5, repeat: Infinity }}
            style={{ fontSize: 11, color: VS.lineNum, fontFamily: 'ui-monospace, monospace' }}
          >
            {'// Waiting for prototype…'}
          </motion.div>
        </div>
      )}

      {/* ── Editor area ──────────────────────────────────────────────────── */}
      {tab === 'code' && activeLines.length === 0 && (
        <div
          className="flex-1 flex flex-col items-center justify-center gap-3"
          style={{ background: VS.bg }}
        >
          <motion.div
            style={{
              fontFamily: 'ui-monospace, "Cascadia Code", monospace',
              fontSize: 11,
              color: VS.lineNum,
              textAlign: 'center',
            }}
          >
            <motion.div
              animate={{ opacity: [0.3, 0.8, 0.3] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              {'// Junior Designer is writing components…'}
            </motion.div>
            <div className="flex justify-center gap-1.5 mt-4">
              {[0, 0.3, 0.6].map((delay, i) => (
                <motion.span
                  key={i}
                  animate={{ opacity: [0.2, 1, 0.2] }}
                  transition={{ duration: 0.8, repeat: Infinity, delay }}
                  style={{
                    width: 4,
                    height: 4,
                    borderRadius: '50%',
                    background: JUNIOR_COLOR,
                    display: 'inline-block',
                  }}
                />
              ))}
            </div>
          </motion.div>
        </div>
      )}
      <div
        ref={codeRef}
        className="flex-1 overflow-y-auto overflow-x-hidden"
        style={{
          display: (activeLines.length === 0 || tab === 'preview') ? 'none' : undefined,
          fontFamily: 'ui-monospace, "Cascadia Code", "Fira Code", "JetBrains Mono", monospace',
          fontSize: 11.5,
          lineHeight: '1.75',
        }}
      >
        <div className="flex" style={{ paddingTop: 12, paddingBottom: 12 }}>
          {/* Line numbers */}
          <div
            className="select-none shrink-0 text-right"
            style={{
              width: 44,
              paddingRight: 16,
              color: VS.lineNum,
              userSelect: 'none',
            }}
          >
            {activeLines.slice(0, visibleLines).map((_, i) => (
              <div key={i} style={{ height: '1.75em' }}>
                {i + 1}
              </div>
            ))}
          </div>

          {/* Code */}
          <div className="flex-1 pr-4 min-w-0">
            {activeLines.slice(0, visibleLines).map((line, i) => {
              const isLast = i === visibleLines - 1 && !isComplete;
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.1 }}
                  style={{
                    height: '1.75em',
                    whiteSpace: 'pre',
                    overflow: 'visible',
                    background: isLast ? VS.selection : 'transparent',
                    position: 'relative',
                  }}
                >
                  <span
                    dangerouslySetInnerHTML={{ __html: highlight(line) }}
                    style={{ color: VS.text }}
                  />
                  {isLast && (
                    <motion.span
                      animate={{ opacity: [1, 0, 1] }}
                      transition={{ duration: 0.9, repeat: Infinity }}
                      style={{
                        display: 'inline-block',
                        width: 2,
                        height: '1em',
                        background: VS.cursor,
                        marginLeft: 1,
                        verticalAlign: 'text-bottom',
                      }}
                    />
                  )}
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Component tree strip ─────────────────────────────────────────── */}
      {tab === 'code' && <div
        className="shrink-0"
        style={{
          background: VS.surface,
          borderTop: `1px solid ${VS.border}`,
          padding: '10px 14px 12px',
        }}
      >
        <div
          className="flex items-center gap-1.5 mb-2"
          style={{ color: VS.muted, fontSize: 10, fontFamily: 'ui-monospace, monospace', letterSpacing: '0.08em' }}
        >
          <Zap size={9} />
          COMPONENT TREE
        </div>

        <div className="grid grid-cols-2 gap-x-3 gap-y-1">
          {treeItems.map((item) => {
            const status = getItemStatus(pct, item.startPct);
            return (
              <div key={item.name} className="flex items-center gap-2">
                {status === 'done' && (
                  <CheckCircle2 size={11} color="#22c55e" />
                )}
                {status === 'active' && (
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                  >
                    <Loader2 size={11} color={JUNIOR_COLOR} />
                  </motion.div>
                )}
                {status === 'pending' && (
                  <Circle size={11} color={VS.lineNum} />
                )}
                <span
                  style={{
                    fontFamily: 'ui-monospace, monospace',
                    fontSize: 10.5,
                    color:
                      status === 'done'
                        ? VS.muted
                        : status === 'active'
                          ? VS.text
                          : VS.lineNum,
                    textDecoration: status === 'done' ? 'line-through' : 'none',
                  }}
                >
                  {item.file}
                </span>
              </div>
            );
          })}
        </div>

        {/* Mini progress bar */}
        <div
          className="mt-3 rounded-full overflow-hidden"
          style={{ height: 2, background: VS.border }}
        >
          <motion.div
            className="h-full rounded-full"
            style={{ background: JUNIOR_COLOR }}
            animate={{ width: `${Math.round(pct * 100)}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>

        <div
          className="flex justify-between mt-1.5"
          style={{ fontSize: 9.5, fontFamily: 'ui-monospace, monospace', color: VS.lineNum }}
        >
          <span>{Math.round(pct * 100)}% compiled</span>
          <span>{visibleLines} / {totalLines} lines</span>
        </div>
      </div>}
    </motion.div>
  );
};

export default BuildPhaseView;
