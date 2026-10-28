import React from 'react';
import {
  Braces,
  Check,
  ChevronDown,
  ChevronUp,
  CircleAlert,
  Clock,
  Copy,
  Download,
  Gauge,
  Layers,
  Pause,
  Play,
  RotateCcw,
  SkipBack,
  SkipForward,
  Sparkles,
  Terminal,
  Workflow,
} from 'lucide-react';
import type {
  ASTNodeInfo,
  ComplexityInfo,
  DataStructureView,
  ExecutionMetrics,
  ExecutionStep,
  LineMetric,
  PatternInfo,
  VariableScope,
  VariableState,
} from '../types';
import { SITE } from '../site';
import { downloadJson } from '../utils/share';
import { copyText } from '../utils/clipboard';
import DataStructureVisualizer from './DataStructureVisualizer';

type TabId = 'trace' | 'timeline' | 'visualizer' | 'complexity' | 'patterns';
type TraceSubTab = 'variables' | 'visualizer' | 'console' | 'callstack';
type TimelineFilter = 'all' | 'calls' | 'returns' | 'errors' | 'output';

interface DebuggerPanelProps {
  steps: ExecutionStep[];
  currentStepIndex: number;
  complexity: ComplexityInfo | null;
  astNodes: ASTNodeInfo[];
  patterns: PatternInfo[];
  metrics?: ExecutionMetrics | null;
  lineMetrics?: LineMetric[] | null;
  outputs?: string[];
  error?: string | null;
  returnValue?: VariableState | null;
  entryPoint?: string;
  truncated?: boolean;
  outputOnly?: boolean;
  finalStructures?: DataStructureView[];
  inputStructures?: DataStructureView[];
  language?: string;
  isPlaying?: boolean;
  onTogglePlay?: () => void;
  onStepForward?: () => void;
  onStepBack?: () => void;
  onSeek?: (index: number) => void;
}

const TABS: Array<{ id: TabId; label: string; icon: typeof Workflow; title: string }> = [
  { id: 'trace', label: 'Trace', icon: Workflow, title: 'Step explanation, call stack, variables and console' },
  { id: 'timeline', label: 'Timeline', icon: Clock, title: 'Full execution timeline, filters and trace metrics' },
  { id: 'complexity', label: 'Complexity', icon: Gauge, title: 'Big-O analysis, growth curve and line metrics' },
  { id: 'patterns', label: 'Patterns & AST', icon: Braces, title: 'Detected algorithm patterns and AST breakdown' },
];

const TRACE_SUB_TABS: Array<{ id: TraceSubTab; label: string; icon: typeof Braces; title: string }> = [
  { id: 'variables', label: 'Variables', icon: Braces, title: 'Variable state with compare and expandable values' },
  { id: 'visualizer', label: 'Visualizer', icon: Layers, title: 'Data structure visualizations for current step' },
  { id: 'console', label: 'Console', icon: Terminal, title: 'Console output with step mapping' },
  { id: 'callstack', label: 'Call Stack', icon: Workflow, title: 'Call stack with micro/macro task queues' },
];

const SCOPE_LABEL: Record<VariableScope, string> = {
  local: 'Local',
  closure: 'Closure',
  global: 'Global',
};

const COMPLEXITY_CURVES: Record<string, (n: number) => number> = {
  constant: () => 1,
  logarithmic: (n) => Math.log2(n + 1),
  linear: (n) => n,
  linearithmic: (n) => n * Math.log2(n + 1),
  quadratic: (n) => n * n,
  cubic: (n) => n * n * n,
  exponential: (n) => Math.pow(2, n),
  factorial: (n) => {
    let total = 1;
    for (let i = 2; i <= n; i += 1) total *= i;
    return total;
  },
};

function structuresOf(step: ExecutionStep | undefined): DataStructureView[] {
  if (!step) return [];
  if (step.dataStructures && step.dataStructures.length > 0) return step.dataStructures;
  return step.dataStructure ? [step.dataStructure] : [];
}

function formatValue(value: any, display?: string): string {
  if (display) return display;
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'function') return 'ƒ function';
  try {
    const text = JSON.stringify(value);
    if (!text) return String(value);
    return text.length > 120 ? `${text.slice(0, 119)}…` : text;
  } catch {
    return String(value);
  }
}

function complexityColor(timeClass?: ComplexityInfo['timeClass']): string {
  switch (timeClass) {
    case 'constant':
      return 'var(--green)';
    case 'logarithmic':
      return 'var(--accent)';
    case 'linear':
      return 'var(--yellow)';
    case 'linearithmic':
      return 'var(--purple)';
    case 'quadratic':
      return 'var(--orange)';
    case 'cubic':
      return 'var(--orange)';
    case 'exponential':
      return 'var(--red)';
    case 'factorial':
      return 'var(--red)';
    default:
      return 'var(--accent)';
  }
}

function categoryColor(category: ASTNodeInfo['category']): string {
  switch (category) {
    case 'loop':
      return 'var(--accent)';
    case 'conditional':
      return 'var(--yellow)';
    case 'declaration':
      return 'var(--green)';
    case 'function':
      return 'var(--purple)';
    case 'call':
      return 'var(--orange)';
    default:
      return 'var(--text-muted)';
  }
}

const CATEGORY_LABEL: Record<ASTNodeInfo['category'], string> = {
  loop: 'Loop',
  conditional: 'Conditional',
  declaration: 'Declaration',
  function: 'Function',
  call: 'Call',
  other: 'Other',
};

const SectionTitle: React.FC<{
  children: React.ReactNode;
  hint?: string;
  emphasis?: boolean;
  action?: React.ReactNode;
}> = ({ children, hint, emphasis, action }) => (
  <div className='panel-title' style={emphasis ? { marginTop: 22 } : undefined}>
    <h4 style={emphasis ? { fontSize: 17, letterSpacing: '-0.3px' } : undefined}>{children}</h4>
    {hint && <span className='hint' style={emphasis ? { fontSize: 11 } : undefined}>{hint}</span>}
    {action && <span style={{ marginLeft: 'auto' }}>{action}</span>}
  </div>
);

const EmptyState: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div
    style={{
      border: '1px dashed var(--border)',
      borderRadius: 10,
      padding: 22,
      textAlign: 'center',
      color: 'var(--text-muted)',
      fontSize: 12,
      background: 'var(--grain)',
    }}
  >
    <div style={{ color: 'var(--text-strong)', fontSize: 13.5, fontWeight: 650, marginBottom: 6 }}>
      {title}
    </div>
    {children}
  </div>
);

const MetricCard: React.FC<{ label: string; value: string; sub?: string; color: string }> = ({
  label,
  value,
  sub,
  color,
}) => (
  <div
    style={{
      padding: '9px 11px',
      background: 'var(--bg-panel)',
      borderRadius: 8,
      border: '1px solid var(--border)',
      borderTop: `2px solid ${color}`,
      minWidth: 0,
    }}
  >
    <div
      style={{
        color: 'var(--text-muted)',
        fontSize: 9.5,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        fontWeight: 650,
      }}
    >
      {label}
    </div>
    <div style={{ color, fontSize: 16, fontWeight: 750, marginTop: 2, letterSpacing: '-0.2px' }}>{value}</div>
    {sub && <div style={{ color: 'var(--text-muted)', fontSize: 9.5, marginTop: 1 }}>{sub}</div>}
  </div>
);

const ComplexityCurve: React.FC<{ timeClass?: ComplexityInfo['timeClass']; label: string }> = ({
  timeClass,
  label,
}) => {
  const curve = COMPLEXITY_CURVES[timeClass || 'linear'] || COMPLEXITY_CURVES.linear;
  const points = React.useMemo(() => {
    const samples: Array<{ n: number; value: number }> = [];
    for (let n = 2; n <= 32; n += 2) samples.push({ n, value: Math.log10(curve(n) + 1) });
    const max = Math.max(...samples.map((sample) => sample.value), 1);
    return samples.map((sample, index) => ({
      x: 26 + (index / (samples.length - 1)) * 264,
      y: 96 - (sample.value / max) * 74,
    }));
  }, [curve]);

  const path = points.map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(' ');
  const area = `${path} L290 100 L26 100 Z`;
  const gradientId = `curve-${React.useId().replace(/[^a-zA-Z0-9]/g, '')}`;

  return (
    <div
      className='card'
      style={{ padding: '10px 12px 6px', marginTop: 10, background: 'var(--bg-inset)' }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
        <span style={{ color: 'var(--text-muted)', fontSize: 10.5, fontWeight: 600 }}>
          Growth curve · log-scaled
        </span>
        <span style={{ color: complexityColor(timeClass), fontSize: 11.5, fontWeight: 750 }}>{label}</span>
      </div>
      <svg viewBox='0 0 300 112' width='100%' height='112' role='img' aria-label={`${label} growth curve`}>
        <defs>
          <linearGradient id={gradientId} x1='0' y1='0' x2='0' y2='1'>
            <stop offset='0%' stopColor={complexityColor(timeClass)} stopOpacity='0.28' />
            <stop offset='100%' stopColor={complexityColor(timeClass)} stopOpacity='0' />
          </linearGradient>
        </defs>
        {[26, 58, 96].map((y) => (
          <line key={y} x1='26' y1={y} x2='290' y2={y} stroke='var(--border-subtle)' strokeWidth='1' />
        ))}
        <path d={area} fill={`url(#${gradientId})`} />
        <path d={path} fill='none' stroke={complexityColor(timeClass)} strokeWidth='2' strokeLinecap='round' />
        <text x='26' y='110' fill='var(--text-muted)' fontSize='8.5'>n=2</text>
        <text x='256' y='110' fill='var(--text-muted)' fontSize='8.5'>n=32</text>
        <text x='27' y='20' fill='var(--text-muted)' fontSize='8.5'>ops (log)</text>
      </svg>
    </div>
  );
};

const DebuggerPanel: React.FC<DebuggerPanelProps> = ({
  steps,
  currentStepIndex,
  complexity,
  astNodes,
  patterns,
  metrics,
  lineMetrics,
  outputs = [],
  error,
  returnValue,
  entryPoint,
  truncated,
  outputOnly,
  finalStructures = [],
  inputStructures = [],
  language,
  isPlaying = false,
  onTogglePlay,
  onStepForward,
  onStepBack,
  onSeek,
}) => {
  const [activeTab, setActiveTab] = React.useState<TabId>('trace');
  const [traceSubTab, setTraceSubTab] = React.useState<TraceSubTab>('variables');
  const [varViewMode, setVarViewMode] = React.useState<'current' | 'final' | 'compare'>('current');
  const [viewMode, setViewMode] = React.useState<'step' | 'final' | 'input'>('step');
  const [varFilter, setVarFilter] = React.useState('');
  const [timelineFilter, setTimelineFilter] = React.useState<TimelineFilter>('all');
  const [astCategory, setAstCategory] = React.useState<string>('all');
  const [showUnexecuted, setShowUnexecuted] = React.useState(false);
  const [consoleCopied, setConsoleCopied] = React.useState(false);
  const [expandedVars, setExpandedVars] = React.useState<Set<string>>(new Set());
  const activeStepRef = React.useRef<HTMLButtonElement | null>(null);
  const consoleRef = React.useRef<HTMLDivElement | null>(null);
  const variablesRef = React.useRef<HTMLDivElement | null>(null);

  // Get final step variables for "Final Result" view
  // const finalStep = steps.length > 0 ? steps[steps.length - 1] : undefined;

  // Keep the console scrolled to the line emitted by the current step.
  React.useEffect(() => {
    if (activeTab !== 'trace' || traceSubTab !== 'console') return;
    const currentNode = consoleRef.current?.querySelector('.output-line.current') as HTMLElement | null;
    currentNode?.scrollIntoView({ block: 'nearest' });
  }, [activeTab, traceSubTab, currentStepIndex]);

  // Prevent auto-scroll when switching steps in variables tab
  React.useEffect(() => {
    if (activeTab !== 'trace' || traceSubTab !== 'variables') return;
    // Don't auto-scroll variables panel
  }, [activeTab, traceSubTab, currentStepIndex]);

  const totalSteps = steps.length;
  const safeIndex = totalSteps > 0 ? Math.min(Math.max(currentStepIndex, 0), totalSteps - 1) : 0;
  const currentStep = steps[safeIndex];
  const previousStep = safeIndex > 0 ? steps[safeIndex - 1] : undefined;
  const structures = structuresOf(currentStep);
  const lastStepStructures = structuresOf(steps[totalSteps - 1]);
  const displayedStructures =
    viewMode === 'final'
      ? finalStructures.length > 0
        ? finalStructures
        : lastStepStructures
      : viewMode === 'input'
        ? inputStructures
        : structures;

  const currentVars = currentStep?.variables || [];
  const previousVars = previousStep?.variables || [];
  const previousVarMap = new Map(previousVars.map((variable) => [variable.name, variable]));
  const filterText = varFilter.trim().toLowerCase();

  const mergedVariables: Array<{ name: string; current?: VariableState; previous?: VariableState }> = [];
  for (const variable of currentVars) {
    mergedVariables.push({
      name: variable.name,
      current: variable,
      previous: previousVarMap.get(variable.name),
    });
  }
  const currentVarNames = new Set(currentVars.map((variable) => variable.name));
  for (const variable of previousVars) {
    if (!currentVarNames.has(variable.name)) mergedVariables.push({ name: variable.name, previous: variable });
  }
  const visibleCompared = mergedVariables.filter((entry) => entry.name.toLowerCase().includes(filterText));
  const visibleVariables = currentVars.filter((variable) => variable.name.toLowerCase().includes(filterText));
  const changedCount = currentVars.filter((variable) => variable.changed).length;

  const executedLines = (lineMetrics || []).filter((metric) => metric.hits > 0);
  const tableLines = showUnexecuted ? lineMetrics || [] : executedLines;
  const maxLineTime = executedLines.reduce((acc, metric) => Math.max(acc, metric.executionTimeMs), 0);
  const hotLines = [...executedLines]
    .sort((a, b) => b.executionTimeMs - a.executionTimeMs)
    .slice(0, 5);

  const structureKinds = React.useMemo(
    () =>
      Array.from(
        new Set(
          steps.flatMap((step) =>
            (step.dataStructures || (step.dataStructure ? [step.dataStructure] : [])).map(
              (structure) => structure.kind,
            ),
          ),
        ),
      ),
    [steps],
  );

  const previousOutputCount = previousStep?.outputCount ?? 0;
  const currentOutputCount = currentStep?.outputCount ?? outputs.length;
  const newOutputStart = Math.min(previousOutputCount, outputs.length);
  const newOutputEnd = Math.min(Math.max(currentOutputCount, newOutputStart), outputs.length);
  const newOutputCount = Math.max(0, newOutputEnd - newOutputStart);
  const visibleOutputs = outputs;

  // For every console line, find the first step that reported it.
  const outputProducers = React.useMemo(() => {
    const producers: number[] = [];
    let produced = 0;
    steps.forEach((step, index) => {
      const count = Math.min(step.outputCount ?? 0, outputs.length);
      for (let i = produced; i < count; i += 1) producers[i] = index;
      produced = Math.max(produced, count);
    });
    return producers;
  }, [steps, outputs.length]);

  const handleCopyConsole = async () => {
    const copied = await copyText(visibleOutputs.join('\n'));
    if (!copied) return;
    setConsoleCopied(true);
    window.setTimeout(() => setConsoleCopied(false), 1500);
  };

  const timelineItems = steps
    .map((step, index) => ({ step, index }))
    .filter(({ step, index }) => {
      if (timelineFilter === 'calls') return Boolean(step.isCall);
      if (timelineFilter === 'returns') return Boolean(step.returnValue);
      if (timelineFilter === 'errors') return Boolean(step.isError);
      if (timelineFilter === 'output') {
        return (step.outputCount ?? 0) !== (steps[index - 1]?.outputCount ?? 0);
      }
      return true;
    });
  const visibleTimeline = timelineItems.slice(0, 400);

  const astCategories = ['all', 'loop', 'conditional', 'declaration', 'function', 'call', 'other'];
  const filteredAst =
    astCategory === 'all' ? astNodes : astNodes.filter((node) => node.category === astCategory);

  const status = error
    ? 'error'
    : truncated
      ? 'truncated'
      : steps.length > 0
        ? 'ok'
        : 'idle';

  const statusMeta =
    status === 'error'
      ? {
          label:
            error && /rate limit|sandbox|unavailable|HTTP \d|exceeded \d+s/i.test(error)
              ? 'Sandbox error'
              : error && /syntax|compil|parse|unexpected token/i.test(error)
                ? 'Syntax error'
                : 'Runtime error',
          color: 'var(--red)',
          bg: 'var(--red-soft)',
        }
      : status === 'truncated'
        ? { label: 'Truncated', color: 'var(--yellow)', bg: 'var(--yellow-soft)' }
        : status === 'ok'
          ? {
              label: outputOnly ? 'Output only' : 'Completed',
              color: 'var(--green)',
              bg: 'var(--green-soft)',
            }
          : { label: 'Not run', color: 'var(--text-muted)', bg: 'var(--grain)' };

  React.useEffect(() => {
    if (activeTab !== 'timeline') return;
    if (timelineFilter !== 'all' && timelineItems.length === 0) return;
    activeStepRef.current?.scrollIntoView({ block: 'nearest' });
  }, [safeIndex, activeTab, timelineFilter, timelineItems.length]);

  const handleExport = () => {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    downloadJson(`${SITE.storagePrefix}-trace-${stamp}.json`, {
      product: SITE.name,
      version: SITE.version,
      exportedAt: new Date().toISOString(),
      language: language || 'unknown',
      entryPoint,
      steps,
      complexity,
      astNodes,
      patterns,
      metrics,
      lineMetrics,
      outputs,
      error,
      returnValue,
    });
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: 'var(--bg-app)',
        minWidth: 0,
      }}
    >
      {/* header */}
      <div
        style={{
          padding: '9px 14px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          flexWrap: 'wrap',
          background: 'var(--bg-panel)',
          flexShrink: 0,
        }}
      >
        <span style={{ color: 'var(--text-strong)', fontSize: 13.5, fontWeight: 750, letterSpacing: '-0.2px' }}>
          Debugger
        </span>
        <span
          className='chip'
          style={{
            color: statusMeta.color,
            background: statusMeta.bg,
            borderColor: statusMeta.color,
            fontSize: 9.5,
            fontWeight: 800,
            letterSpacing: 0.5,
            textTransform: 'uppercase',
          }}
        >
          {statusMeta.label}
        </span>
        {entryPoint && (
          <span
            style={{
              color: 'var(--info)',
              fontFamily: 'monospace',
              fontSize: 11,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              maxWidth: 280,
            }}
            title={entryPoint}
          >
            {entryPoint}
          </span>
        )}
        <span
          style={{
            marginLeft: 'auto',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            color: 'var(--text-muted)',
            fontSize: 11,
          }}
        >
          {totalSteps > 0 ? `${totalSteps} steps` : 'no trace yet'}
          <button
            type='button'
            className='icon-btn small'
            onClick={handleExport}
            disabled={totalSteps === 0}
            title='Export the full trace as JSON'
            aria-label='Export trace as JSON'
          >
            <Download size={12} />
          </button>
        </span>
      </div>

      {/* tabs */}
      <div className='tab-bar' role='tablist' aria-label='Debugger sections'>
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type='button'
              role='tab'
              aria-selected={active}
              onClick={() => setActiveTab(tab.id)}
              title={tab.title}
              className={`tab-btn${active ? ' active' : ''}`}
            >
              <Icon size={13} />
              <span>{tab.label}</span>
              {tab.id === 'timeline' && totalSteps > 0 && <span className='tab-count'>{totalSteps}</span>}
              {tab.id === 'patterns' && patterns.length > 0 && (
                <span className='tab-count'>{patterns.length}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* error banner */}
      {error && (
        <div
          style={{
            display: 'flex',
            gap: 8,
            alignItems: 'flex-start',
            padding: '8px 14px',
            background: 'var(--red-soft)',
            borderBottom: '1px solid var(--red-border)',
            color: 'var(--red)',
            fontSize: 11,
            fontFamily: 'monospace',
            whiteSpace: 'pre-wrap',
            flexShrink: 0,
          }}
        >
          <CircleAlert size={14} style={{ flexShrink: 0, marginTop: 1 }} />
          <span>{error}</span>
        </div>
      )}

      {/* content */}
      <div style={{ flex: 1, overflow: 'auto', padding: '0 14px 16px' }}>
        {outputOnly && (
          <div
            style={{
              marginTop: 12,
              padding: '9px 11px',
              borderRadius: 8,
              background: 'var(--info-soft)',
              border: '1px solid var(--accent-border)',
              color: 'var(--info)',
              fontSize: 11.5,
              lineHeight: 1.55,
            }}
          >
            This language runs in a remote sandbox, so steps come from real program output rather than
            variable-level tracing. AST, complexity, patterns and input/result visualisations are still
            available. Use JavaScript, TypeScript or Python for full step-by-step variable tracing.
          </div>
        )}

        {/* ---------------------------- TRACE ---------------------------- */}
        {activeTab === 'trace' && (
          <div className='fade-in'>
            {currentStep ? (
              <>
                {/* Step header */}
                <div
                  className='card'
                  style={{
                    marginTop: 12,
                    padding: 12,
                    borderColor: currentStep.isError ? 'var(--red-border)' : 'var(--border)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ color: 'var(--accent)', fontWeight: 750, fontSize: 12.5 }}>
                      Step {safeIndex + 1} / {totalSteps}
                    </span>
                    <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>
                      Line {currentStep.line > 0 ? currentStep.line : '—'}
                    </span>
                    {previousStep && (
                      <span style={{ color: 'var(--text-muted)', fontSize: 10.5 }}>
                        after step {safeIndex}
                      </span>
                    )}
                    {currentStep.isCall && <span className='chip' style={{ color: 'var(--purple)' }}>call</span>}
                    {currentStep.returnValue && (
                      <span className='chip' style={{ color: 'var(--green)' }}>return</span>
                    )}
                    {currentStep.isError && <span className='chip chip-red'>error</span>}
                    {changedCount > 0 && (
                      <span className='chip chip-yellow'>{changedCount} changed</span>
                    )}
                  </div>
                  <div
                    style={{
                      color: 'var(--text-body)',
                      marginTop: 7,
                      fontSize: 12.5,
                      lineHeight: 1.6,
                      whiteSpace: 'pre-wrap',
                    }}
                  >
                    {currentStep.explanation}
                  </div>
                  {currentStep.source && (
                    <div
                      style={{
                        marginTop: 9,
                        padding: '6px 9px',
                        background: 'var(--bg-inset)',
                        borderRadius: 5,
                        borderLeft: '3px solid var(--accent)',
                        color: 'var(--text-body)',
                        fontFamily: 'monospace',
                        fontSize: 11.5,
                        overflowX: 'auto',
                        whiteSpace: 'pre',
                      }}
                    >
                      {currentStep.source}
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                    {currentStep.loopInfo && (
                      <span
                        style={{
                          color: 'var(--orange)',
                          background: 'var(--orange-soft)',
                          borderRadius: 5,
                          padding: '2px 7px',
                          fontSize: 10.5,
                        }}
                      >
                        {currentStep.loopInfo.type} · iteration {currentStep.loopInfo.iteration} ·{' '}
                        {currentStep.loopInfo.condition}
                      </span>
                    )}
                    {currentStep.conditionResult !== undefined && (
                      <span
                        style={{
                          color: currentStep.conditionResult ? 'var(--green)' : 'var(--red)',
                          background: currentStep.conditionResult ? 'var(--green-soft)' : 'var(--red-soft)',
                          borderRadius: 5,
                          padding: '2px 7px',
                          fontSize: 10.5,
                        }}
                      >
                        condition → {String(currentStep.conditionResult)}
                      </span>
                    )}
                  </div>
                </div>

                {currentStep.returnValue && (
                  <div
                    style={{
                      marginTop: 8,
                      padding: '8px 10px',
                      background: 'var(--green-soft)',
                      border: '1px solid var(--green-border)',
                      borderRadius: 7,
                      color: 'var(--green)',
                      fontSize: 11.5,
                      fontFamily: 'monospace',
                      wordBreak: 'break-all',
                    }}
                  >
                    ↩ return {formatValue(currentStep.returnValue.value, currentStep.returnValue.display)}
                  </div>
                )}

                {/* Final return value (shown in all trace sub-tabs) */}
                {returnValue && (
                  <div style={{ marginTop: 12 }}>
                    <SectionTitle>Final return value</SectionTitle>
                    <div style={{ marginBottom: 8 }}>
                      <div
                        style={{
                          padding: '8px 10px',
                          background: 'var(--bg-panel)',
                          border: '1px solid var(--border)',
                          borderRadius: 7,
                          color: 'var(--green)',
                          fontFamily: 'monospace',
                          fontSize: 11.5,
                          wordBreak: 'break-all',
                        }}
                      >
                        {formatValue(returnValue.value, returnValue.display)}
                      </div>
                      {returnValue.fullDisplay && (
                        <details style={{ marginTop: 8 }}>
                          <summary style={{ cursor: 'pointer', color: 'var(--accent)', fontSize: 11, fontWeight: 600 }}>
                            Show full value
                          </summary>
                          <pre style={{ margin: '8px 0 0', whiteSpace: 'pre-wrap', wordBreak: 'break-all', color: 'var(--green)', background: 'var(--bg-panel)', padding: 8, borderRadius: 4, fontSize: 11 }}>
                            {returnValue.fullDisplay}
                          </pre>
                        </details>
                      )}
                    </div>
                  </div>
                )}

                {/* Trace sub-tabs */}
                <div style={{ marginTop: 12 }}>
                  <div className='tab-bar' role='tablist' aria-label='Trace sections' style={{ marginBottom: 8 }}>
                    {TRACE_SUB_TABS.map((tab) => {
                      const Icon = tab.icon;
                      const active = traceSubTab === tab.id;
                      return (
                        <button
                          key={tab.id}
                          type='button'
                          role='tab'
                          aria-selected={active}
                          onClick={() => setTraceSubTab(tab.id)}
                          title={tab.title}
                          className={`tab-btn${active ? ' active' : ''}`}
                        >
                          <Icon size={13} />
                          <span>{tab.label}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Variables sub-tab */}
                  {traceSubTab === 'variables' && (
                    <div ref={variablesRef} style={{ maxHeight: 'calc(100vh - 400px)', overflow: 'auto' }}>
                      <SectionTitle
                        hint={
                          varViewMode === 'compare'
                            ? `${visibleCompared.length} tracked · completed vs current`
                            : `${visibleVariables.length} visible · ${changedCount} changed`
                        }
                        action={
                          <div className='segmented'>
                            <button
                              type='button'
                              className={`seg-btn${varViewMode === 'current' ? ' active' : ''}`}
                              onClick={() => setVarViewMode('current')}
                            >
                              Current
                            </button>
                            <button
                              type='button'
                              className={`seg-btn${varViewMode === 'compare' ? ' active' : ''}`}
                              onClick={() => setVarViewMode('compare')}
                              disabled={!previousStep}
                              title={previousStep ? 'Compare completed and current step' : 'No previous step yet'}
                            >
                              Compare
                            </button>
                          </div>
                        }
                      >
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                          <Sparkles size={13} /> Variable state
                        </span>
                      </SectionTitle>
                      <input
                        value={varFilter}
                        onChange={(event) => setVarFilter(event.target.value)}
                        placeholder='Filter variables…'
                        className='field'
                        style={{ marginBottom: 8 }}
                        aria-label='Filter variables'
                      />

                      {varViewMode === 'compare' && (
                        <div className='compare-head'>
                          <div className='compare-column'>
                            <span className='compare-label'>Completed</span>
                            <span className='compare-value'>Step {safeIndex} · L{previousStep?.line || '—'}</span>
                          </div>
                          <div className='compare-column current'>
                            <span className='compare-label'>Current</span>
                            <span className='compare-value'>Step {safeIndex + 1} · L{currentStep.line || '—'}</span>
                          </div>
                        </div>
                      )}

                      <div className='card' style={{ overflow: 'hidden' }}>
                        <table className='data-table'>
                          <thead>
                            <tr>
                              {varViewMode === 'compare' ? (
                                <>
                                  <th>Variable</th>
                                  <th>Completed</th>
                                  <th>Current</th>
                                  <th>Type</th>
                                  <th>Scope</th>
                                  <th style={{ width: 36 }}></th>
                                </>
                              ) : (
                                <>
                                  <th>Variable</th>
                                  <th>Value</th>
                                  <th>Type</th>
                                  <th>Scope</th>
                                  <th style={{ width: 36 }}></th>
                                </>
                              )}
                            </tr>
                          </thead>
                          <tbody>
                            {varViewMode === 'compare'
                              ? visibleCompared.map((entry) => {
                                  const typeSource = entry.current || entry.previous;
                                  const changed = Boolean(entry.current?.changed);
                                  const added = !entry.previous && Boolean(entry.current);
                                  const removed = Boolean(entry.previous) && !entry.current;
                                  const isExpanded = expandedVars.has(entry.name);
                                  return (
                                    <React.Fragment key={entry.name}>
                                      <tr
                                        style={{
                                          background: isExpanded ? 'var(--bg-active)' : undefined,
                                        }}
                                      >
                                        <td
                                          style={{
                                            color: 'var(--info)',
                                            fontFamily: 'monospace',
                                            fontWeight: 600,
                                            whiteSpace: 'nowrap',
                                          }}
                                        >
                                          {changed && (
                                            <span
                                              title='changed since the completed step'
                                              style={{ color: 'var(--yellow)', marginRight: 4 }}
                                            >
                                              ●
                                            </span>
                                          )}
                                          {entry.name}
                                          {added && (
                                            <span
                                              className='chip chip-accent'
                                              style={{ marginLeft: 5 }}
                                              title='added since the completed step'
                                            >
                                              new
                                            </span>
                                          )}
                                          {removed && (
                                            <span
                                              className='chip chip-red'
                                              style={{ marginLeft: 5 }}
                                              title='no longer in scope at the current step'
                                            >
                                              gone
                                            </span>
                                          )}
                                        </td>
                                        <td
                                          style={{
                                            fontFamily: 'monospace',
                                            fontSize: 11,
                                            color: 'var(--text-muted)',
                                            wordBreak: 'break-all',
                                            maxWidth: 170,
                                            opacity: entry.previous ? 1 : 0.5,
                                          }}
                                          title={entry.previous ? formatValue(entry.previous.value, entry.previous.display) : 'not in scope'}
                                        >
                                          {entry.previous
                                            ? formatValue(entry.previous.value, entry.previous.display)
                                            : '—'}
                                        </td>
                                        <td
                                          style={{
                                            fontFamily: 'monospace',
                                            fontSize: 11,
                                            color: changed
                                              ? 'var(--yellow)'
                                              : entry.current
                                                ? 'var(--orange)'
                                                : 'var(--text-muted)',
                                            wordBreak: 'break-all',
                                            maxWidth: 170,
                                            opacity: entry.current ? 1 : 0.6,
                                          }}
                                          title={entry.current ? formatValue(entry.current.value, entry.current.display) : 'out of scope'}
                                        >
                                          {entry.current
                                            ? formatValue(entry.current.value, entry.current.display)
                                            : '—'}
                                        </td>
                                        <td style={{ color: 'var(--green)', fontSize: 10 }}>
                                          {typeSource?.type ?? '—'}
                                        </td>
                                        <td style={{ color: 'var(--text-muted)', fontSize: 10 }}>
                                          {typeSource ? SCOPE_LABEL[typeSource.scope || 'local'] : '—'}
                                        </td>
                                        <td style={{ textAlign: 'center', padding: '0 4px' }}>
                                          {(entry.current?.fullDisplay || entry.previous?.fullDisplay) && (
                                            <button
                                              type='button'
                                              className='icon-btn small'
                                              onClick={() => setExpandedVars(prev => {
                                                const next = new Set(prev);
                                                if (next.has(entry.name)) next.delete(entry.name);
                                                else next.add(entry.name);
                                                return next;
                                              })}
                                              title={isExpanded ? 'Collapse' : 'Expand'}
                                              style={{ padding: 2 }}
                                            >
                                              {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                                            </button>
                                          )}
                                        </td>
                                      </tr>
                                      {isExpanded && (
                                        <tr style={{ background: 'var(--bg-inset)' }}>
                                          <td colSpan={6} style={{ padding: '8px 12px' }}>
                                            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 11, fontFamily: 'monospace' }}>
                                              {entry.previous && (
                                                <div style={{ flex: 1, minWidth: 200 }}>
                                                  <div style={{ color: 'var(--text-muted)', fontSize: 10, marginBottom: 4 }}>Completed (Step {safeIndex})</div>
                                                  <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all', color: 'var(--text-muted)', background: 'var(--bg-panel)', padding: 8, borderRadius: 4 }}>
                                                    {entry.previous.fullDisplay ?? formatValue(entry.previous.value, entry.previous.display)}
                                                  </pre>
                                                </div>
                                              )}
                                              {entry.current && (
                                                <div style={{ flex: 1, minWidth: 200 }}>
                                                  <div style={{ color: 'var(--text-muted)', fontSize: 10, marginBottom: 4 }}>Current (Step {safeIndex + 1})</div>
                                                  <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all', color: 'var(--orange)', background: 'var(--bg-panel)', padding: 8, borderRadius: 4 }}>
                                                    {entry.current.fullDisplay ?? formatValue(entry.current.value, entry.current.display)}
                                                  </pre>
                                                </div>
                                              )}
                                            </div>
                                          </td>
                                        </tr>
                                      )}
                                    </React.Fragment>
                                  );
                                })
                              : visibleVariables.map((variable) => {
                                    const isExpanded = expandedVars.has(variable.name);
                                    return (
                                      <React.Fragment key={`${variable.scope || 'local'}-${variable.name}`}>
                                        <tr
                                          style={{
                                            background: isExpanded ? 'var(--bg-active)' : undefined,
                                          }}
                                        >
                                          <td
                                            style={{
                                              color: 'var(--info)',
                                              fontFamily: 'monospace',
                                              fontWeight: 600,
                                              whiteSpace: 'nowrap',
                                            }}
                                          >
                                            {variable.changed && (
                                              <span
                                                title='changed since last step'
                                                style={{ color: 'var(--yellow)', marginRight: 4 }}
                                              >
                                                ●
                                              </span>
                                            )}
                                            {variable.name}
                                          </td>
                                          <td
                                            style={{
                                              padding: '6px 9px',
                                              color: variable.changed ? 'var(--yellow)' : 'var(--orange)',
                                              fontSize: 11,
                                              fontFamily: 'monospace',
                                              wordBreak: 'break-all',
                                              maxWidth: 220,
                                            }}
                                            title={formatValue(variable.value, variable.display)}
                                          >
                                            {formatValue(variable.value, variable.display)}
                                          </td>
                                          <td style={{ color: 'var(--green)', fontSize: 10 }}>{variable.type}</td>
                                          <td style={{ color: 'var(--text-muted)', fontSize: 10 }}>
                                            {SCOPE_LABEL[variable.scope || 'local']}
                                          </td>
                                          <td style={{ textAlign: 'center', padding: '0 4px' }}>
                                            {variable.fullDisplay && (
                                              <button
                                                type='button'
                                                className='icon-btn small'
                                                onClick={() => setExpandedVars(prev => {
                                                  const next = new Set(prev);
                                                  if (next.has(variable.name)) next.delete(variable.name);
                                                  else next.add(variable.name);
                                                  return next;
                                                })}
                                                title={isExpanded ? 'Collapse' : 'Expand'}
                                                style={{ padding: 2 }}
                                              >
                                                {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                                              </button>
                                            )}
                                          </td>
                                        </tr>
                                        {isExpanded && (
                                          <tr style={{ background: 'var(--bg-inset)' }}>
                                            <td colSpan={5} style={{ padding: '8px 12px' }}>
                                              <div style={{ flex: 1, minWidth: 200 }}>
                                                <div style={{ color: 'var(--text-muted)', fontSize: 10, marginBottom: 4 }}>Full Value</div>
                                                <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all', color: 'var(--orange)', background: 'var(--bg-panel)', padding: 8, borderRadius: 4 }}>
                                                  {variable.fullDisplay}
                                                </pre>
                                              </div>
                                            </td>
                                          </tr>
                                        )}
                                      </React.Fragment>
                                    );
                                  })}
                            {((varViewMode === 'compare' ? visibleCompared.length : visibleVariables.length) === 0) && (
                              <tr>
                                <td
                                  colSpan={varViewMode === 'compare' ? 6 : 5}
                                  style={{
                                    padding: 10,
                                    color: 'var(--text-muted)',
                                    textAlign: 'center',
                                    fontSize: 11,
                                  }}
                                >
                                  No variables in scope
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Visualizer sub-tab */}
                  {traceSubTab === 'visualizer' && (
                    <div style={{ maxHeight: 'calc(100vh - 400px)', overflow: 'auto' }}>
                      <SectionTitle
                        hint={`${displayedStructures.length} structure(s) · ${viewMode} view`}
                        action={
                          <div className='segmented' style={{ flexWrap: 'wrap' }}>
                            <button
                              type='button'
                              className={`seg-btn${viewMode === 'step' ? ' active' : ''}`}
                              onClick={() => setViewMode('step')}
                              disabled={structures.length === 0}
                              title='Data structures at current step'
                            >
                              Current Step
                            </button>
                            <button
                              type='button'
                              className={`seg-btn${viewMode === 'final' ? ' active' : ''}`}
                              onClick={() => setViewMode('final')}
                              disabled={finalStructures.length === 0 && lastStepStructures.length === 0}
                              title='Final data structures after execution'
                            >
                              Final Result
                            </button>
                            <button
                              type='button'
                              className={`seg-btn${viewMode === 'input' ? ' active' : ''}`}
                              onClick={() => setViewMode('input')}
                              disabled={inputStructures.length === 0}
                              title='Data structures derived from test input'
                            >
                              Input
                            </button>
                          </div>
                        }
                      >
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                          <Layers size={13} /> Data Structures
                        </span>
                      </SectionTitle>
                      {displayedStructures.length > 0 ? (
                        <DataStructureVisualizer structures={displayedStructures} />
                      ) : (
                        <div
                          style={{
                            border: `1px dashed var(--border)`,
                            borderRadius: 8,
                            padding: 18,
                            color: 'var(--text-muted)',
                            fontSize: 12,
                            textAlign: 'center',
                            background: 'var(--grain)',
                          }}
                        >
                          No data structures detected for this view.
                        </div>
                      )}
                    </div>
                  )}

                  {/* Console sub-tab */}
                  {traceSubTab === 'console' && (
                    <div style={{ maxHeight: 'calc(100vh - 400px)', overflow: 'auto' }}>
                      <SectionTitle
                        hint={`${visibleOutputs.length} line(s) · ${newOutputCount} new this step`}
                        action={
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <div className='segmented'>
                              <button
                                type='button'
                                className='seg-btn active'
                              >
                                All output
                              </button>
                            </div>
                            <button
                              type='button'
                              className='icon-btn small'
                              onClick={() => void handleCopyConsole()}
                              disabled={visibleOutputs.length === 0}
                              title={consoleCopied ? 'Console copied' : 'Copy visible console output'}
                              aria-label='Copy visible console output'
                            >
                              {consoleCopied ? <Check size={12} /> : <Copy size={12} />}
                            </button>
                          </div>
                        }
                      >
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                          <Terminal size={13} /> Console
                        </span>
                      </SectionTitle>
                      <div
                        style={{
                          display: 'flex',
                          gap: 10,
                          flexWrap: 'wrap',
                          marginBottom: 6,
                          fontSize: 9.5,
                          color: 'var(--text-muted)',
                        }}
                      >
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <span style={{ width: 6, height: 6, borderRadius: 999, background: 'var(--text-muted)' }} />
                          completed steps
                        </span>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <span style={{ width: 6, height: 6, borderRadius: 999, background: 'var(--green)' }} />
                          this step
                        </span>
                      </div>
                      <div
                        ref={consoleRef}
                        style={{
                          background: 'var(--bg-inset)',
                          border: '1px solid var(--border)',
                          borderRadius: 8,
                          padding: '8px 10px',
                          maxHeight: 300,
                          overflow: 'auto',
                        }}
                      >
                        {visibleOutputs.length > 0 ? (
                          visibleOutputs.map((line, index) => {
                            const isCompleted = index < newOutputStart;
                            const isCurrent = index >= newOutputStart && index < newOutputEnd;
                            return (
                              <div
                                key={index}
                                className={`output-line ${isCurrent ? 'current' : isCompleted ? 'completed' : ''}`}
                              >
                                <span
                                  className='marker'
                                  style={{
                                    color: isCurrent
                                      ? 'var(--green)'
                                      : isCompleted
                                        ? 'var(--text-muted)'
                                        : 'var(--border-strong)',
                                  }}
                                >
                                  {isCurrent ? '+' : '›'}
                                </span>
                                <span>{line}</span>
                                {outputProducers[index] !== undefined && (
                                  <button
                                    type='button'
                                    className='output-step'
                                    onClick={() => onSeek?.(outputProducers[index])}
                                    title={`Produced at step ${outputProducers[index] + 1} — click to jump there`}
                                  >
                                    step {outputProducers[index] + 1}
                                  </button>
                                )}
                                {isCurrent && (
                                  <span
                                    style={{
                                      marginLeft: 2,
                                      fontSize: 8.5,
                                      color: 'var(--green)',
                                      letterSpacing: 0.5,
                                      textTransform: 'uppercase',
                                      flexShrink: 0,
                                    }}
                                  >
                                    new
                                  </span>
                                )}
                              </div>
                            );
                          })
                        ) : (
                          <span style={{ color: 'var(--text-muted)', fontSize: 11.5 }}>
                            {outputs.length > 0
                              ? 'No console output for this step yet.'
                              : 'No console output yet. Use console.log() / print() to write values here.'}
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Call Stack sub-tab */}
                  {traceSubTab === 'callstack' && (
                    <div style={{ maxHeight: 'calc(100vh - 400px)', overflow: 'auto' }}>
                      <SectionTitle hint='Synchronous call stack (top of stack first)'>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                          <Workflow size={13} /> Call Stack
                        </span>
                      </SectionTitle>
                      {currentStep.callStack && currentStep.callStack.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                          {[...currentStep.callStack].reverse().map((frame, idx) => (
                            <div
                              key={`${frame.name}-${idx}`}
                              style={{
                                display: 'flex',
                                gap: 8,
                                alignItems: 'baseline',
                                padding: '5px 9px',
                                background: idx === 0 ? 'var(--bg-active)' : 'var(--bg-panel)',
                                border: `1px solid ${idx === 0 ? 'var(--accent-border)' : 'var(--border-subtle)'}`,
                                borderRadius: 6,
                                fontSize: 11.5,
                                fontFamily: 'monospace',
                              }}
                            >
                              <span
                                style={{
                                  color:
                                    frame.frameType === 'microtask'
                                      ? 'var(--purple)'
                                      : frame.frameType === 'macrotask'
                                      ? 'var(--orange)'
                                      : idx === 0
                                      ? 'var(--text-strong)'
                                      : 'var(--info)',
                                }}
                              >
                                {frame.name}()
                                {frame.frameType === 'microtask' && <span className='chip' style={{ color: 'var(--purple)', fontSize: 8 }}>microtask</span>}
                                {frame.frameType === 'macrotask' && <span className='chip' style={{ color: 'var(--orange)', fontSize: 8 }}>macrotask</span>}
                              </span>
                              {frame.args && (
                                <span
                                  style={{
                                    color: 'var(--text-muted)',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                  }}
                                >
                                  {frame.args}
                                </span>
                              )}
                              {frame.asyncSource && (
                                <span style={{ color: 'var(--text-muted)', fontSize: 10, marginLeft: 4 }}>
                                  via {frame.asyncSource}
                                </span>
                              )}
                              <span style={{ marginLeft: 'auto', color: 'var(--text-muted)' }}>L{frame.line}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div
                          style={{
                            border: `1px dashed var(--border)`,
                            borderRadius: 8,
                            padding: 18,
                            color: 'var(--text-muted)',
                            fontSize: 12,
                            textAlign: 'center',
                            background: 'var(--grain)',
                          }}
                        >
                          No call stack at this step.
                        </div>
                      )}

                      {currentStep.microtaskQueue && currentStep.microtaskQueue.length > 0 && (
                        <>
                          <SectionTitle hint='Microtask queue (Promise callbacks, queueMicrotask)' emphasis>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                              <Sparkles size={13} style={{ color: 'var(--purple)' }} /> Microtasks
                            </span>
                          </SectionTitle>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                            {currentStep.microtaskQueue.map((frame, idx) => (
                              <div
                                key={`microtask-${frame.name}-${idx}`}
                                style={{
                                  display: 'flex',
                                  gap: 8,
                                  alignItems: 'baseline',
                                  padding: '5px 9px',
                                  background: 'var(--purple-soft)',
                                  border: '1px solid var(--purple-border)',
                                  borderRadius: 6,
                                  fontSize: 11.5,
                                  fontFamily: 'monospace',
                                }}
                              >
                                <span style={{ color: 'var(--purple)' }}>{frame.name}</span>
                                {frame.args && (
                                  <span
                                    style={{
                                      color: 'var(--text-muted)',
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis',
                                      whiteSpace: 'nowrap',
                                    }}
                                  >
                                    {frame.args}
                                  </span>
                                )}
                                <span style={{ marginLeft: 'auto', color: 'var(--text-muted)', fontSize: 10 }}>
                                  {frame.asyncSource}
                                </span>
                              </div>
                            ))}
                          </div>
                        </>
                      )}

                      {currentStep.macrotaskQueue && currentStep.macrotaskQueue.length > 0 && (
                        <>
                          <SectionTitle hint='Macrotask queue (setTimeout, setInterval, I/O)' emphasis>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                              <Clock size={13} style={{ color: 'var(--orange)' }} /> Macrotasks
                            </span>
                          </SectionTitle>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                            {currentStep.macrotaskQueue.map((frame, idx) => (
                              <div
                                key={`macrotask-${frame.name}-${idx}`}
                                style={{
                                  display: 'flex',
                                  gap: 8,
                                  alignItems: 'baseline',
                                  padding: '5px 9px',
                                  background: 'var(--orange-soft)',
                                  border: '1px solid var(--orange-border)',
                                  borderRadius: 6,
                                  fontSize: 11.5,
                                  fontFamily: 'monospace',
                                }}
                              >
                                <span style={{ color: 'var(--orange)' }}>{frame.name}</span>
                                {frame.args && (
                                  <span
                                    style={{
                                      color: 'var(--text-muted)',
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis',
                                      whiteSpace: 'nowrap',
                                    }}
                                  >
                                    {frame.args}
                                  </span>
                                )}
                                <span style={{ marginLeft: 'auto', color: 'var(--text-muted)', fontSize: 10 }}>
                                  {frame.asyncSource}
                                </span>
                              </div>
                            ))}
                          </div>
                        </>
                      )}

                      {!currentStep.callStack?.length && !currentStep.microtaskQueue?.length && !currentStep.macrotaskQueue?.length && (
                        <div
                          style={{
                            border: `1px dashed var(--border)`,
                            borderRadius: 8,
                            padding: 18,
                            color: 'var(--text-muted)',
                            fontSize: 12,
                            textAlign: 'center',
                            background: 'var(--grain)',
                            marginTop: 16,
                          }}
                        >
                          No async tasks scheduled at this step.
                        </div>
                      )}
                    </div>
                  )}

                </div>
              </>
            ) : (
              <div style={{ marginTop: 16 }}>
                <EmptyState title='No execution trace yet'>
                  Press <strong style={{ color: 'var(--accent)' }}>Run & Trace</strong> to interpret
                  your program. Every loop iteration, branch and recursive call becomes a step you can
                  replay.
                </EmptyState>
              </div>
            )}
          </div>
        )}

        {/* --------------------------- TIMELINE --------------------------- */}
        {activeTab === 'timeline' && (
          <div className='fade-in'>
            {currentStep ? (
              <>
                <div className='card' style={{ marginTop: 12, padding: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ color: 'var(--accent)', fontWeight: 750, fontSize: 12.5 }}>
                      Step {safeIndex + 1} of {totalSteps}
                    </span>
                    <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>
                      Line {currentStep.line || '—'}
                    </span>
                    {currentStep.isCall && <span className='chip' style={{ color: 'var(--purple)' }}>call</span>}
                    {currentStep.isError && <span className='chip chip-red'>error</span>}
                  </div>
                  <div
                    style={{
                      color: 'var(--text-body)',
                      marginTop: 6,
                      fontSize: 12.5,
                      lineHeight: 1.55,
                    }}
                  >
                    {currentStep.explanation}
                  </div>
                </div>

                <SectionTitle hint='derived from this trace'>Trace summary</SectionTitle>
                <div className='stat-grid'>
                  <MetricCard
                    label='Steps'
                    value={String(metrics?.totalSteps ?? totalSteps)}
                    sub={`${metrics?.executedLines ?? executedLines.length} lines executed`}
                    color='var(--accent)'
                  />
                  <MetricCard
                    label='Function calls'
                    value={String(metrics?.functionCalls ?? steps.filter((step) => step.isCall).length)}
                    sub={`peak depth ${metrics?.peakCallDepth ?? 0}`}
                    color='var(--purple)'
                  />
                  <MetricCard
                    label='Iterations'
                    value={String(metrics?.iterations ?? 0)}
                    sub='loop bodies entered'
                    color='var(--orange)'
                  />
                  <MetricCard
                    label='Console lines'
                    value={String(outputs.length)}
                    sub={`${newOutputCount} in this step`}
                    color='var(--green)'
                  />
                  {metrics && (
                    <MetricCard
                      label='Runtime'
                      value={`${metrics.executionTimeMs} ms`}
                      sub={`${metrics.executionTimeSec.toFixed(4)} s`}
                      color='var(--yellow)'
                    />
                  )}
                </div>

                <SectionTitle
                  hint={`${timelineItems.length} matching step(s) · click to jump`}
                  action={
                    <div className='segmented' style={{ flexWrap: 'wrap' }}>
                      {(
                        [
                          ['all', 'All'],
                          ['calls', 'Calls'],
                          ['returns', 'Returns'],
                          ['output', 'Output'],
                          ['errors', 'Errors'],
                        ] as Array<[TimelineFilter, string]>
                      ).map(([filter, label]) => (
                        <button
                          key={filter}
                          type='button'
                          className={`seg-btn${timelineFilter === filter ? ' active' : ''}`}
                          onClick={() => setTimelineFilter(filter)}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  }
                >
                  Execution timeline
                </SectionTitle>

                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 3,
                    maxHeight: 430,
                    overflow: 'auto',
                    paddingRight: 2,
                  }}
                  className='custom-scroll'
                >
                  {visibleTimeline.map(({ step, index }) => {
                    const isActive = index === safeIndex;
                    const outputDelta = (step.outputCount ?? 0) - (steps[index - 1]?.outputCount ?? 0);
                    return (
                      <button
                        key={index}
                        type='button'
                        ref={isActive ? activeStepRef : undefined}
                        onClick={() => onSeek?.(index)}
                        className={`timeline-row${isActive ? ' active' : ''}${step.isError ? ' is-error' : ''}`}
                        title={step.explanation}
                      >
                        <span
                          style={{
                            color: isActive ? 'var(--accent)' : 'var(--text-muted)',
                            minWidth: 38,
                            fontWeight: 700,
                          }}
                        >
                          #{index + 1}
                        </span>
                        <span
                          style={{
                            color: isActive ? 'var(--info)' : 'var(--text-secondary)',
                            minWidth: 36,
                          }}
                        >
                          L{step.line || '—'}
                        </span>
                        <span
                          style={{
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            flex: 1,
                          }}
                        >
                          {step.explanation}
                        </span>
                        {step.isCall && (
                          <span className='chip' style={{ color: 'var(--purple)', padding: '0 6px' }}>
                            call
                          </span>
                        )}
                        {step.returnValue && (
                          <span className='chip' style={{ color: 'var(--green)', padding: '0 6px' }}>
                            return
                          </span>
                        )}
                        {outputDelta > 0 && (
                          <span className='chip chip-green' style={{ padding: '0 6px' }}>
                            +{outputDelta} out
                          </span>
                        )}
                        {step.isError && (
                          <span className='chip chip-red' style={{ padding: '0 6px' }}>
                            error
                          </span>
                        )}
                      </button>
                    );
                  })}
                  {timelineItems.length === 0 && (
                    <EmptyState title='No steps match this filter'>
                      Switch back to <strong style={{ color: 'var(--accent)' }}>All</strong> to see the
                      complete execution timeline.
                    </EmptyState>
                  )}
                  {timelineItems.length > visibleTimeline.length && (
                    <div style={{ padding: 8, textAlign: 'center', color: 'var(--text-muted)', fontSize: 10.5 }}>
                      Showing the first {visibleTimeline.length} of {timelineItems.length} matching steps —
                      use the scrubber below to jump further.
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div style={{ marginTop: 16 }}>
                <EmptyState title='No timeline yet'>
                  Run a trace to build a replayable timeline. You will be able to filter calls, returns,
                  output and errors.
                </EmptyState>
              </div>
            )}
          </div>
        )}

        {/* -------------------------- VISUALIZER ------------------------- */}
        {activeTab === 'visualizer' && (
          <div className='fade-in'>
            <SectionTitle
              hint={
                viewMode === 'step'
                  ? currentStep
                    ? `at step ${safeIndex + 1}`
                    : undefined
                  : viewMode === 'final'
                    ? 'final returned state'
                    : 'derived from test input'
              }
            >
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <Layers size={13} /> Data structures
              </span>
            </SectionTitle>
            {steps.length === 0 ? (
              <EmptyState title='Nothing to visualise yet'>
                Run a trace to inspect arrays, trees, grids, maps and sets.
              </EmptyState>
            ) : (
              <>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 8 }}>
                  {[
                    { id: 'step' as const, label: `Current step (${structures.length})` },
                    {
                      id: 'final' as const,
                      label: `Full result (${finalStructures.length || lastStepStructures.length})`,
                    },
                    { id: 'input' as const, label: `Input (${inputStructures.length})` },
                  ].map((mode) => (
                    <button
                      key={mode.id}
                      type='button'
                      onClick={() => setViewMode(mode.id)}
                      className={`seg-btn${viewMode === mode.id ? ' active' : ''}`}
                      style={{ border: '1px solid var(--border)', padding: '4px 10px' }}
                    >
                      {mode.label}
                    </button>
                  ))}
                </div>

                {viewMode === 'step' && (
                  <>
                    <input
                      type='range'
                      min={0}
                      max={Math.max(0, totalSteps - 1)}
                      value={safeIndex}
                      onChange={(event) => onSeek?.(Number(event.target.value))}
                      style={{ width: '100%', marginBottom: 4 }}
                      aria-label='Trace step'
                    />
                    {currentStep && (
                      <div
                        style={{
                          color: 'var(--text-muted)',
                          fontSize: 11,
                          marginBottom: 8,
                          fontFamily: 'monospace',
                        }}
                      >
                        Step {safeIndex + 1}/{totalSteps} · Line {currentStep.line || '—'} ·{' '}
                        {currentStep.explanation}
                      </div>
                    )}
                  </>
                )}

                {viewMode === 'final' && returnValue && (
                  <div
                    style={{
                      marginBottom: 8,
                      padding: '7px 10px',
                      background: 'var(--green-soft)',
                      border: '1px solid var(--green-border)',
                      borderRadius: 7,
                      color: 'var(--green)',
                      fontFamily: 'monospace',
                      fontSize: 11.5,
                      wordBreak: 'break-all',
                    }}
                  >
                    ↩ return {formatValue(returnValue.value, returnValue.display)}
                  </div>
                )}

                {viewMode === 'input' && (
                  <div style={{ color: 'var(--text-muted)', fontSize: 10.5, marginBottom: 8 }}>
                    Structures derived from the JSON test input.
                  </div>
                )}

                {displayedStructures.length > 0 ? (
                  <DataStructureVisualizer structures={displayedStructures} />
                ) : (
                  <EmptyState title={viewMode === 'input' ? 'No input structures' : 'No structures in this view'}>
                    {viewMode === 'input'
                      ? 'Use a JSON test input with an array, matrix, tree (root), linked list (head) or object.'
                      : 'Switch to another view or step. Arrays, matrices, trees, linked lists, maps and sets are detected automatically.'}
                  </EmptyState>
                )}

                {structureKinds.length > 0 && (
                  <div style={{ marginTop: 12, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <span style={{ color: 'var(--text-muted)', fontSize: 10, alignSelf: 'center' }}>
                      seen in trace:
                    </span>
                    {structureKinds.map((kind) => (
                      <span
                        key={kind}
                        className='chip'
                        style={{ color: 'var(--info)', textTransform: 'capitalize' }}
                      >
                        {kind}
                      </span>
                    ))}
                  </div>
                )}
                {viewMode === 'step' && currentStep && structures.length === 0 && (
                  <div style={{ marginTop: 10, color: 'var(--text-muted)', fontSize: 11 }}>
                    Tip: declare arrays/matrices, build tree nodes with <code>val/left/right</code>, or use{' '}
                    <code>Map</code>/<code>Set</code> — detection happens automatically on every step.
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* -------------------------- COMPLEXITY ------------------------- */}
        {activeTab === 'complexity' && (
          <div className='fade-in'>
            {metrics && (
              <>
                <SectionTitle>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <Clock size={13} /> Execution metrics
                  </span>
                </SectionTitle>
                <div className='stat-grid'>
                  <MetricCard
                    label='Execution time'
                    value={`${metrics.executionTimeMs} ms`}
                    sub={`${metrics.executionTimeSec.toFixed(4)} s`}
                    color='var(--accent)'
                  />
                  <MetricCard
                    label='Peak storage'
                    value={`${metrics.storageSizeKB.toFixed(3)} KB`}
                    sub={`${metrics.storageSizeBytes} bytes`}
                    color='var(--purple)'
                  />
                  <MetricCard
                    label='Steps'
                    value={String(metrics.totalSteps ?? steps.length)}
                    sub={`${metrics.executedLines ?? 0}/${metrics.totalLines ?? 0} lines`}
                    color='var(--green)'
                  />
                  <MetricCard
                    label='Function calls'
                    value={String(metrics.functionCalls ?? 0)}
                    sub={`max depth ${metrics.peakCallDepth ?? 0}`}
                    color='var(--yellow)'
                  />
                  <MetricCard
                    label='Iterations'
                    value={String(metrics.iterations ?? 0)}
                    sub='loop bodies entered'
                    color='var(--orange)'
                  />
                </div>
              </>
            )}

            <SectionTitle hint='static estimate + runtime evidence'>Big-O analysis</SectionTitle>
            {complexity ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div
                  style={{
                    padding: 12,
                    background: 'var(--bg-panel)',
                    borderRadius: 9,
                    border: '1px solid var(--border)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                    <span
                      style={{
                        color: 'var(--text-muted)',
                        fontSize: 10,
                        textTransform: 'uppercase',
                        letterSpacing: 0.6,
                        fontWeight: 650,
                      }}
                    >
                      Time complexity
                    </span>
                    <span
                      style={{
                        color: complexityColor(complexity.timeClass),
                        fontSize: 22,
                        fontWeight: 800,
                        letterSpacing: '-0.5px',
                      }}
                    >
                      {complexity.timeComplexity}
                    </span>
                  </div>
                  <ul
                    style={{
                      margin: '8px 0 0',
                      paddingLeft: 17,
                      color: 'var(--text-body)',
                      fontSize: 11.5,
                      lineHeight: 1.65,
                    }}
                  >
                    {complexity.timeJustification.slice(0, 8).map((item, index) => (
                      <li key={index}>{item}</li>
                    ))}
                  </ul>
                  <ComplexityCurve timeClass={complexity.timeClass} label={complexity.timeComplexity} />
                </div>
                <div
                  style={{
                    padding: 12,
                    background: 'var(--bg-panel)',
                    borderRadius: 9,
                    border: '1px solid var(--border)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                    <span
                      style={{
                        color: 'var(--text-muted)',
                        fontSize: 10,
                        textTransform: 'uppercase',
                        letterSpacing: 0.6,
                        fontWeight: 650,
                      }}
                    >
                      Space complexity
                    </span>
                    <span style={{ color: 'var(--yellow)', fontSize: 22, fontWeight: 800, letterSpacing: '-0.5px' }}>
                      {complexity.spaceComplexity}
                    </span>
                  </div>
                  <ul
                    style={{
                      margin: '8px 0 0',
                      paddingLeft: 17,
                      color: 'var(--text-body)',
                      fontSize: 11.5,
                      lineHeight: 1.65,
                    }}
                  >
                    {complexity.spaceJustification.slice(0, 8).map((item, index) => (
                      <li key={index}>{item}</li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : (
              <EmptyState title='No complexity report'>
                Run a trace to analyse time and space complexity.
              </EmptyState>
            )}

            <SectionTitle hint='self time excludes nested statements'>Line metrics</SectionTitle>
            {executedLines.length === 0 ? (
              <EmptyState title='No line metrics'>
                Line timing is captured for traced JavaScript/TypeScript programs.
              </EmptyState>
            ) : (
              <>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 6 }}>
                  <label
                    style={{
                      color: 'var(--text-muted)',
                      fontSize: 10.5,
                      display: 'flex',
                      gap: 5,
                      alignItems: 'center',
                    }}
                  >
                    <input
                      type='checkbox'
                      checked={showUnexecuted}
                      onChange={(event) => setShowUnexecuted(event.target.checked)}
                    />
                    show unexecuted lines
                  </label>
                </div>
                <div className='card' style={{ overflow: 'hidden' }}>
                  <table className='data-table'>
                    <thead>
                      <tr>
                        {['Line', 'Code', 'Hits', 'Self', 'Avg', 'Storage'].map((head) => (
                          <th key={head}>{head}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {tableLines.map((line) => (
                        <tr key={line.line} style={{ opacity: line.hits ? 1 : 0.45 }}>
                          <td style={{ color: 'var(--accent)', fontFamily: 'monospace' }}>{line.line}</td>
                          <td
                            style={{
                              color: 'var(--text-body)',
                              fontFamily: 'monospace',
                              fontSize: 10.5,
                              maxWidth: 170,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                            title={line.code}
                          >
                            {(line.code || '').trim() || '—'}
                          </td>
                          <td style={{ color: 'var(--yellow)' }}>{line.hits}</td>
                          <td style={{ color: 'var(--orange)', minWidth: 64 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                              <span style={{ minWidth: 34, fontSize: 10.5 }}>{line.executionTimeMs} ms</span>
                              <span
                                style={{
                                  height: 3,
                                  borderRadius: 2,
                                  background: 'var(--orange)',
                                  width: `${maxLineTime ? Math.max(2, (line.executionTimeMs / maxLineTime) * 34) : 0}px`,
                                }}
                              />
                            </div>
                          </td>
                          <td style={{ color: 'var(--info)', fontSize: 10.5 }}>{line.avgTimeMs} ms</td>
                          <td style={{ color: 'var(--purple)', fontSize: 10.5 }}>
                            {line.storageSizeKB.toFixed(3)} KB
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {hotLines.length > 0 && (
                  <>
                    <SectionTitle hint='most self time'>Hot lines</SectionTitle>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {hotLines.map((line) => (
                        <div
                          key={line.line}
                          style={{
                            display: 'flex',
                            gap: 8,
                            alignItems: 'center',
                            background: 'var(--bg-panel)',
                            border: '1px solid var(--border-subtle)',
                            borderRadius: 6,
                            padding: '5px 9px',
                            fontSize: 11,
                          }}
                        >
                          <span style={{ color: 'var(--accent)', fontFamily: 'monospace', minWidth: 42 }}>
                            L{line.line}
                          </span>
                          <span
                            style={{
                              color: 'var(--text-body)',
                              fontFamily: 'monospace',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              flex: 1,
                            }}
                          >
                            {(line.code || '').trim()}
                          </span>
                          <span style={{ color: 'var(--orange)', minWidth: 56, textAlign: 'right' }}>
                            {line.executionTimeMs} ms
                          </span>
                          <span style={{ color: 'var(--text-muted)', minWidth: 44, textAlign: 'right' }}>
                            {line.hits}×
                          </span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        )}

        {/* --------------------------- AST/PATTERNS ---------------------- */}
        {activeTab === 'patterns' && (
          <div className='fade-in'>
            <SectionTitle hint={`${patterns.length} detected`} emphasis>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
                <Sparkles size={15} /> Algorithm patterns
              </span>
            </SectionTitle>
            {patterns.length === 0 ? (
              <EmptyState title='No patterns yet'>Run a trace to classify the algorithm family.</EmptyState>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {patterns.map((pattern, index) => (
                  <div
                    key={`${pattern.pattern}-${index}`}
                    style={{
                      padding: '9px 11px',
                      background: 'var(--bg-panel)',
                      borderRadius: 8,
                      border: '1px solid var(--border-subtle)',
                      borderLeft: '3px solid var(--purple)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'baseline' }}>
                      <span style={{ color: 'var(--purple)', fontWeight: 750, fontSize: 13 }}>
                        {pattern.pattern}
                      </span>
                      <span style={{ color: 'var(--text-muted)', fontSize: 10.5 }}>
                        {Math.round(pattern.confidence * 100)}% confidence
                      </span>
                    </div>
                    <div
                      style={{
                        height: 3,
                        background: 'var(--bg-inset)',
                        borderRadius: 2,
                        margin: '6px 0 7px',
                      }}
                    >
                      <div
                        style={{
                          width: `${Math.round(pattern.confidence * 100)}%`,
                          height: '100%',
                          borderRadius: 2,
                          background: 'var(--purple)',
                        }}
                      />
                    </div>
                    <div style={{ color: 'var(--text-body)', fontSize: 11.5, lineHeight: 1.55 }}>
                      {pattern.reason}
                    </div>
                    {pattern.line !== undefined && (
                      <div style={{ color: 'var(--text-muted)', fontSize: 10.5, marginTop: 3 }}>
                        line {pattern.line}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            <SectionTitle hint={`${astNodes.length} nodes · filter by construct`} emphasis>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
                <Braces size={15} /> AST structure
              </span>
            </SectionTitle>
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 9 }}>
              {astCategories.map((category) => {
                const count =
                  category === 'all'
                    ? astNodes.length
                    : astNodes.filter((node) => node.category === category).length;
                const active = astCategory === category;
                return (
                  <button
                    key={category}
                    type='button'
                    onClick={() => setAstCategory(category)}
                    className={`seg-btn${active ? ' active' : ''}`}
                    style={{
                      border: `1px solid ${active ? 'var(--accent-border)' : 'var(--border)'}`,
                      padding: '4px 10px',
                      fontSize: 11.5,
                    }}
                  >
                    {CATEGORY_LABEL[category as ASTNodeInfo['category']] || category} ({count})
                  </button>
                );
              })}
            </div>

            {filteredAst.length === 0 ? (
              <EmptyState title='No AST nodes'>Run a trace to inspect the syntax tree.</EmptyState>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table className='data-table' style={{ minWidth: 600 }}>
                  <thead>
                    <tr>
                      <th style={{ minWidth: 80 }}>Category</th>
                      <th style={{ minWidth: 50 }}>Line</th>
                      <th style={{ minWidth: 140 }}>Type</th>
                      <th>Details</th>
                      <th style={{ minWidth: 70 }}>Depth</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAst.slice(0, 140).map((node, index) => (
                      <tr key={`${node.line}-${node.type}-${index}`} style={{ fontSize: 12 }}>
                        <td style={{ textAlign: 'center' }}>
                          <span
                            style={{
                              padding: '2px 7px',
                              borderRadius: 4,
                              background: 'var(--bg-inset)',
                              color: categoryColor(node.category),
                              border: `1px solid ${categoryColor(node.category)}`,
                              fontWeight: 800,
                              fontSize: 10,
                              textTransform: 'uppercase',
                              letterSpacing: 0.4,
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {CATEGORY_LABEL[node.category] || node.category}
                          </span>
                        </td>
                        <td style={{ color: 'var(--accent)', fontFamily: 'monospace', fontWeight: 600 }}>
                          L{node.line}
                        </td>
                        <td style={{ color: 'var(--yellow)', fontFamily: 'monospace', fontWeight: 600, fontSize: 11.5 }}>
                          {node.type}
                        </td>
                        <td style={{ color: 'var(--text-secondary)', fontSize: 11.5 }}>
                          {node.details}
                        </td>
                        <td style={{ color: 'var(--purple)', fontSize: 10.5, textAlign: 'center' }}>
                          {node.depth !== undefined && node.depth > 0 ? node.depth : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* transport */}
      <div
        style={{
          borderTop: '1px solid var(--border)',
          background: 'var(--bg-panel)',
          padding: '7px 12px 9px',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button type='button' onClick={onStepBack} style={transportButton} title='Previous step' aria-label='Previous step'>
            <SkipBack size={12} />
          </button>
          <button
            type='button'
            onClick={onTogglePlay}
            style={{
              ...transportButton,
              background: isPlaying ? 'var(--danger-bg)' : 'var(--accent-strong)',
              borderColor: 'transparent',
              color: 'var(--on-accent)',
            }}
            title={isPlaying ? 'Pause' : 'Play'}
            aria-label={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? <Pause size={12} /> : <Play size={12} />}
          </button>
          <button type='button' onClick={onStepForward} style={transportButton} title='Next step' aria-label='Next step'>
            <SkipForward size={12} />
          </button>
          <input
            type='range'
            min={0}
            max={Math.max(0, totalSteps - 1)}
            value={Math.min(safeIndex, Math.max(0, totalSteps - 1))}
            onChange={(event) => onSeek?.(Number(event.target.value))}
            style={{ flex: 1 }}
            disabled={totalSteps === 0}
            aria-label='Scrub execution timeline'
          />
          <span
            style={{
              color: 'var(--text-muted)',
              fontSize: 10.5,
              fontFamily: 'monospace',
              minWidth: 56,
              textAlign: 'right',
            }}
          >
            {totalSteps > 0 ? `${safeIndex + 1} / ${totalSteps}` : '0 / 0'}
          </span>
          <button type='button' onClick={() => onSeek?.(0)} style={transportButton} title='Back to first step' aria-label='Back to first step'>
            <RotateCcw size={12} />
          </button>
        </div>
      </div>
    </div>
  );
};

const transportButton: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 28,
  height: 26,
  background: 'var(--bg-elevated)',
  color: 'var(--text-strong)',
  border: '1px solid var(--border)',
  borderRadius: 6,
  cursor: 'pointer',
};

export default DebuggerPanel;