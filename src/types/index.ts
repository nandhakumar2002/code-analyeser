export type VariableScope = 'local' | 'closure' | 'global';

export interface VariableState {
  name: string;
  value: any;
  type: string;
  display?: string;
  scope?: VariableScope;
  kind?: string;
  className?: string;
  changed?: boolean;
}

export interface CallFrame {
  name: string;
  line: number;
  args?: string;
}

export type DataStructureView =
  | {
      kind: 'array';
      name: string;
      values: any[];
      pointers: Record<string, number>;
      highlights?: number[];
      note?: string;
    }
  | {
      kind: 'matrix';
      name: string;
      values: any[][];
      pointers: Record<string, number>;
      pointerLabels?: Record<string, [number, number]>;
      highlights?: Array<[number, number]>;
      note?: string;
    }
  | {
      kind: 'tree';
      name: string;
      root: TreeNodeSnapshot | null;
      activePath?: number[];
      note?: string;
    }
  | {
      kind: 'list';
      name: string;
      nodes: Array<{ val: any; active?: boolean; label?: string }>;
      pointers: Record<string, number>;
      note?: string;
    }
  | {
      kind: 'graph';
      name: string;
      nodes: string[];
      edges: Array<[string, string]>;
      visited?: string[];
      active?: string | null;
      note?: string;
    }
  | {
      kind: 'map';
      name: string;
      entries: Array<{ key: string; value: string; active?: boolean }>;
      note?: string;
    }
  | {
      kind: 'set';
      name: string;
      values: string[];
      note?: string;
    }
  | {
      kind: 'stack' | 'queue';
      name: string;
      values: any[];
      top?: number;
      note?: string;
    };

export interface TreeNodeSnapshot {
  val: any;
  left?: TreeNodeSnapshot | null;
  right?: TreeNodeSnapshot | null;
  id?: number;
  active?: boolean;
}

export interface ExecutionStep {
  line: number;
  variables: VariableState[];
  callStack?: CallFrame[];
  conditionResult?: boolean;
  loopInfo?: {
    type: string;
    iteration: number;
    condition: string;
  };
  explanation: string;
  /** Source line shown with the step. */
  source?: string;
  /** Present when this step is the evaluation of a return statement or a call result. */
  returnValue?: VariableState;
  /** Number of console outputs emitted up to and including this step. */
  outputCount?: number;
  /** Marks a step produced while entering a function call. */
  isCall?: boolean;
  /** Marks a runtime error step. */
  isError?: boolean;
  errorMessage?: string;
  dataStructure?: DataStructureView;
  dataStructures?: DataStructureView[];
  lineMetrics?: LineMetric;
}

export interface ComplexityInfo {
  timeComplexity: string;
  timeJustification: string[];
  spaceComplexity: string;
  spaceJustification: string[];
  timeClass?: 'constant' | 'logarithmic' | 'linear' | 'linearithmic' | 'quadratic' | 'cubic' | 'exponential' | 'factorial';
  spaceClass?: 'constant' | 'linear' | 'quadratic' | 'exponential';
}

export interface ASTNodeInfo {
  type: string;
  category: 'loop' | 'conditional' | 'declaration' | 'function' | 'call' | 'other';
  line: number;
  details: string;
  depth?: number;
}

export interface PatternInfo {
  pattern: string;
  confidence: number;
  reason: string;
  line?: number;
}

export interface ExecutionMetrics {
  executionTimeMs: number;
  executionTimeSec: number;
  storageSizeBytes: number;
  storageSizeKB: number;
  totalSteps?: number;
  executedLines?: number;
  totalLines?: number;
  functionCalls?: number;
  parseTimeMs?: number;
  peakCallDepth?: number;
  iterations?: number;
}

export interface LineMetric {
  line: number;
  /** Total number of times the line was executed. */
  hits: number;
  /** Total self time attributed to the line (nested statement time excluded). */
  executionTimeMs: number;
  executionTimeSec: number;
  /** Average self time per hit. */
  avgTimeMs: number;
  /** Peak size of the live variable state while this line was executing. */
  storageSizeBytes: number;
  storageSizeKB: number;
  code?: string;
  executed?: boolean;
}

export interface TraceResult {
  steps: ExecutionStep[];
  complexity: ComplexityInfo;
  astNodes: ASTNodeInfo[];
  patterns: PatternInfo[];
  metrics?: ExecutionMetrics;
  lineMetrics?: LineMetric[];
  error?: string;
  errorLine?: number;
  warnings?: string[];
  outputs?: string[];
  returnValue?: VariableState | null;
  entryPoint?: string;
  truncated?: boolean;
  language?: string;
  /** True when only program output is available (non-JS languages). */
  outputOnly?: boolean;
  /** Data structures representing the final result (works for every language). */
  finalStructures?: DataStructureView[];
  /** Data structures derived from the test input (works for every language). */
  inputStructures?: DataStructureView[];
}
