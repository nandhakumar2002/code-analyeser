import * as parser from '@babel/parser';
import * as t from '@babel/types';
import type {
  CallFrame,
  DataStructureView,
  ExecutionStep,
  LineMetric,
  TreeNodeSnapshot,
  VariableScope,
  VariableState,
} from '../types';

/* ------------------------------------------------------------------ */
/* Control-flow signals                                                */
/* ------------------------------------------------------------------ */

class BreakSignal {
  label?: string;
  constructor(label?: string) {
    this.label = label;
  }
}
class ContinueSignal {
  label?: string;
  constructor(label?: string) {
    this.label = label;
  }
}
class ReturnSignal {
  value: any;
  constructor(value: any) {
    this.value = value;
  }
}
class ThrowSignal {
  value: any;
  constructor(value: any) {
    this.value = value;
  }
}
class HaltSignal {
  reason: 'steps' | 'timeout' | 'depth';
  constructor(reason: 'steps' | 'timeout' | 'depth') {
    this.reason = reason;
  }
}

interface Scope {
  name: string;
  vars: Map<string, any>;
  parent: Scope | null;
  thisVal?: any;
}

interface LoopFrame {
  type: string;
  iteration: number;
  condition: string;
  label?: string;
}

export interface InterpretOptions {
  maxSteps?: number;
  timeoutMs?: number;
  maxDepth?: number;
}

export interface InterpretResult {
  steps: ExecutionStep[];
  lineMetrics: LineMetric[];
  outputs: string[];
  outputCountTotal: number;
  error?: string;
  errorLine?: number;
  returnValue?: VariableState | null;
  entryPoint?: string;
  truncated?: boolean;
  peakCallDepth: number;
  functionCalls: number;
  iterations: number;
  executedLines: number;
}

const POINTER_NAMES = new Set([
  'i', 'j', 'k', 'l', 'r', 'c', 'm', 'n', 'p', 'q', 'x', 'y',
  'left', 'right', 'lo', 'hi', 'low', 'high', 'mid', 'middle',
  'start', 'end', 'slow', 'fast', 'head', 'tail', 'curr', 'cur',
  'current', 'prev', 'next', 'row', 'col', 'r1', 'c1', 'r2', 'c2',
  'first', 'last', 'begin', 'finish', 'idx', 'index', 'ptr', 'pos',
]);

const FORMAT_MAX_ITEMS = 60;
const FORMAT_MAX_DEPTH = 4;

export function formatPreview(value: any, depth = 0, seen?: WeakSet<object>): string {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  const type = typeof value;
  if (type === 'string') return JSON.stringify(value);
  if (type === 'number') {
    if (Number.isNaN(value)) return 'NaN';
    if (value === Infinity) return 'Infinity';
    if (value === -Infinity) return '-Infinity';
    return String(value);
  }
  if (type === 'boolean') return String(value);
  if (type === 'bigint') return `${value}n`;
  if (type === 'symbol') return value.toString();
  if (type === 'function') return `ƒ ${value.name || 'anonymous'}()`;

  const visited = seen || new WeakSet<object>();
  if (visited.has(value)) return '[Circular]';
  if (depth > FORMAT_MAX_DEPTH) return Array.isArray(value) ? '[…]' : '{…}';

  if (value instanceof Date) return value.toISOString();
  if (value instanceof RegExp) return String(value);
  if (value instanceof Error) return `${value.name}: ${value.message}`;

  visited.add(value);
  try {
    if (Array.isArray(value)) {
      const items = value.slice(0, FORMAT_MAX_ITEMS).map((v) => formatPreview(v, depth + 1, visited));
      if (value.length > FORMAT_MAX_ITEMS) items.push(`… +${value.length - FORMAT_MAX_ITEMS}`);
      return `[${items.join(', ')}]`;
    }
    if (value instanceof Map) {
      const items: string[] = [];
      let count = 0;
      for (const [k, v] of value.entries()) {
        if (count >= 20) {
          items.push('…');
          break;
        }
        items.push(`${formatPreview(k, depth + 1, visited)} => ${formatPreview(v, depth + 1, visited)}`);
        count++;
      }
      return `Map(${value.size}) {${items.length ? ' ' + items.join(', ') + ' ' : ''}}`;
    }
    if (value instanceof Set) {
      const items: string[] = [];
      let count = 0;
      for (const v of value.values()) {
        if (count >= 30) {
          items.push('…');
          break;
        }
        items.push(formatPreview(v, depth + 1, visited));
        count++;
      }
      return `Set(${value.size}) {${items.length ? ' ' + items.join(', ') + ' ' : ''}}`;
    }
    const keys = Object.keys(value);
    const items = keys.slice(0, 20).map((k) => {
      let v: any;
      try {
        v = value[k];
      } catch {
        v = '[Getter]';
      }
      return `${k}: ${formatPreview(v, depth + 1, visited)}`;
    });
    if (keys.length > 20) items.push(`… +${keys.length - 20} more`);
    return `{${items.length ? ' ' + items.join(', ') + ' ' : ''}}`;
  } finally {
    visited.delete(value);
  }
}

function shortPreview(value: any, max = 60): string {
  const text = formatPreview(value, 0);
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

/** Tracks the implicit `arguments` array so the inspector can label it correctly. */
const ARGUMENTS_OBJECTS = new WeakSet<object>();

function isTreeNodeLike(value: any): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  if (value instanceof Map || value instanceof Set) return false;
  if (!('val' in value)) return false;
  if ('left' in value || 'right' in value) return true;
  return false;
}

function isListNodeLike(value: any): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  if (value instanceof Map || value instanceof Set) return false;
  if (!('val' in value)) return false;
  return 'next' in value && !('left' in value) && !('right' in value);
}

let treeIdCounter = 0;
function buildTreeSnapshot(node: any, depth = 0, seen?: WeakSet<object>): TreeNodeSnapshot | null {
  if (!node || typeof node !== 'object' || depth > 12) return null;
  const visited = seen || new WeakSet<object>();
  if (visited.has(node)) return null;
  visited.add(node);
  return {
    val: node.val,
    id: treeIdCounter++,
    left: node.left ? buildTreeSnapshot(node.left, depth + 1, visited) : null,
    right: node.right ? buildTreeSnapshot(node.right, depth + 1, visited) : null,
  };
}

function typeOfValue(value: any): string {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (Array.isArray(value)) return 'array';
  if (value instanceof Map) return 'map';
  if (value instanceof Set) return 'set';
  if (value instanceof Date) return 'date';
  if (value instanceof RegExp) return 'regexp';
  if (value instanceof Error) return 'error';
  if (typeof value === 'function') return 'function';
  if (isTreeNodeLike(value)) return 'TreeNode';
  if (isListNodeLike(value)) return 'ListNode';
  return typeof value;
}

function safeJson(value: any, depth = 0, seen?: WeakSet<object>): any {
  if (value === null || value === undefined) return value;
  const type = typeof value;
  if (type === 'number') return Number.isFinite(value) ? value : String(value);
  if (type === 'string' || type === 'boolean') return value;
  if (type === 'bigint') return `${value}n`;
  if (type === 'function') return `ƒ ${value.name || 'anonymous'}()`;
  if (type !== 'object') return String(value);
  if (depth > 8) return '…';
  const visited = seen || new WeakSet<object>();
  if (visited.has(value)) return '[Circular]';
  visited.add(value);
  try {
    if (Array.isArray(value)) {
      return value.slice(0, 500).map((v) => safeJson(v, depth + 1, visited));
    }
    if (value instanceof Map) {
      return {
        __kind: 'map',
        entries: Array.from(value.entries())
          .slice(0, 200)
          .map(([k, v]) => [formatPreview(k, 0), safeJson(v, depth + 1, visited)]),
      };
    }
    if (value instanceof Set) {
      return {
        __kind: 'set',
        values: Array.from(value.values())
          .slice(0, 200)
          .map((v) => safeJson(v, depth + 1, visited)),
      };
    }
    if (isTreeNodeLike(value)) {
      return { __kind: 'tree', data: buildTreeSnapshot(value) };
    }
    if (isListNodeLike(value)) {
      const nodes: any[] = [];
      let cur: any = value;
      let guard = 0;
      while (cur && guard < 300) {
        nodes.push(cur.val);
        cur = cur.next;
        guard++;
      }
      return { __kind: 'list', values: nodes };
    }
    const out: Record<string, any> = {};
    for (const key of Object.keys(value).slice(0, 100)) {
      try {
        out[key] = safeJson(value[key], depth + 1, visited);
      } catch {
        out[key] = '[Unreadable]';
      }
    }
    return out;
  } finally {
    visited.delete(value);
  }
}

/* ------------------------------------------------------------------ */
/* Interpreter                                                         */
/* ------------------------------------------------------------------ */

export class JsInterpreter {
  private code: string;
  private lines: string[];
  steps: ExecutionStep[] = [];
  outputs: string[] = [];
  private currentScope: Scope | null = null;
  private callStack: CallFrame[] = [];
  private loopStack: LoopFrame[] = [];
  private maxSteps: number;
  private timeoutMs: number;
  private maxDepth: number;
  private startedAt = 0;
  private lastRecordAt = 0;
  private lastRecordLine = 0;
  private stepLimitHit = false;
  truncated = false;
  private depth = 0;
  private functionCalls = 0;
  private iterations = 0;
  private peakCallDepth = 0;
  private executedLines = new Set<number>();
  lineHits = new Map<number, { hits: number; selfMs: number; peakBytes: number }>();
  private entryPoint = '';
  private returnValue: any = undefined;
  private hasReturn = false;
  inputAliasNames = new Set<string>();

  constructor(code: string, options: InterpretOptions = {}) {
    this.code = code;
    this.lines = code.split('\n');
    this.maxSteps = options.maxSteps ?? 20000;
    this.timeoutMs = options.timeoutMs ?? 5000;
    this.maxDepth = options.maxDepth ?? 200;
  }

  /* ---------------------------- helpers ---------------------------- */

  private now(): number {
    return typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now();
  }

  private newScope(name: string, parent: Scope | null, thisVal?: any): Scope {
    return { name, vars: new Map(), parent, thisVal };
  }

  private lookup(name: string, scope: Scope | null): any {
    let cur = scope;
    while (cur) {
      if (cur.vars.has(name)) return cur.vars.get(name);
      cur = cur.parent;
    }
    if (name === 'undefined') return undefined;
    if (name === 'NaN') return NaN;
    if (name === 'Infinity') return Infinity;
    if (name in GLOBALS) return (GLOBALS as any)[name];
    throw new ReferenceError(`${name} is not defined`);
  }

  private assignVar(name: string, value: any, scope: Scope | null): void {
    let cur = scope;
    while (cur) {
      if (cur.vars.has(name)) {
        cur.vars.set(name, value);
        return;
      }
      cur = cur.parent;
    }
    // implicit global
    let root = scope;
    while (root && root.parent) root = root.parent;
    if (root) root.vars.set(name, value);
  }

  private declareVar(name: string, value: any, scope: Scope): void {
    scope.vars.set(name, value);
  }

  /* ------------------------- introspection ------------------------- */

  private visibleBindings(
    scope: Scope | null,
  ): Array<{ name: string; value: any; scope: VariableScope; root: boolean }> {
    const result: Array<{ name: string; value: any; scope: VariableScope; root: boolean }> = [];
    const seen = new Set<string>();
    let cur = scope;
    let level = 0;
    while (cur) {
      const isRoot = cur.parent === null;
      for (const [name, value] of cur.vars.entries()) {
        if (seen.has(name)) continue;
        seen.add(name);
        if (name.startsWith('__')) continue;
        // The root scope is the global scope, regardless of how deep the
        // current frame is. Only intermediate scopes are closures.
        const label: VariableScope = isRoot ? 'global' : level === 0 ? 'local' : 'closure';
        result.push({ name, value, scope: label, root: isRoot });
      }
      cur = cur.parent;
      level++;
    }
    return result;
  }

  private snapshotVariables(prev?: VariableState[]): VariableState[] {
    const prevMap = new Map<string, string>();
    if (prev) for (const v of prev) prevMap.set(v.name, v.display ?? '');
    return this.visibleBindings(this.currentScope).map(({ name, value, scope }) => {
      let display = shortPreview(value, 80);
      let type = typeOfValue(value);

      if (ARGUMENTS_OBJECTS.has(value)) {
        // `arguments` is an array internally; present it like a debugger would.
        const items = value.slice(0, 5).map((item: any) => shortPreview(item, 32));
        const more = value.length > items.length ? ', …' : '';
        display = `Arguments(${value.length})${items.length ? ` [${items.join(', ')}${more}]` : ''}`;
        type = 'arguments';
      } else if (typeof value === 'function') {
        // Anonymous function expressions inherit the name of their binding.
        const fnName = value.name && value.name !== 'anonymous' ? value.name : name;
        display = `ƒ ${fnName}()`;
      }

      return {
        name,
        value: safeJson(value),
        display,
        type,
        scope,
        kind: isTreeNodeLike(value) ? 'tree' : isListNodeLike(value) ? 'list' : undefined,
        changed: prevMap.has(name) ? prevMap.get(name) !== display : false,
      };
    });
  }

  /* ------------------------- data structures ----------------------- */

  private detectDataStructures(scope: Scope | null): DataStructureView[] {
    const isRootInputAlias = (binding: { name: string; value: any; root: boolean }) => {
      if (!binding.root) return false;
      return (
        binding.name === 'input' ||
        binding.name === 'args' ||
        this.inputAliasNames.has(binding.name)
      );
    };

    const bindings = this.visibleBindings(scope).filter((b) => !isRootInputAlias(b));
    const views: DataStructureView[] = [];

    const numericPointers: Record<string, number> = {};
    for (const b of bindings) {
      if (typeof b.value === 'number' && Number.isFinite(b.value) && b.value >= 0 && b.value < 1000 && POINTER_NAMES.has(b.name)) {
        numericPointers[b.name] = b.value;
      }
    }

    // Trees
    for (const b of bindings) {
      if (isTreeNodeLike(b.value)) {
        views.push({
          kind: 'tree',
          name: b.name,
          root: buildTreeSnapshot(b.value),
          note: 'LeetCode binary tree (level-order build supported)',
        });
        break;
      }
    }

    // Linked lists — show the longest chain so the most complete view wins
    let bestList: { name: string; nodes: Array<{ val: any }>; pointers: Record<string, number> } | null = null;
    for (const b of bindings) {
      if (!isListNodeLike(b.value)) continue;
      const nodes: Array<{ val: any }> = [];
      const refs: any[] = [];
      let cur: any = b.value;
      let guard = 0;
      while (cur && guard < 200) {
        nodes.push({ val: cur.val });
        refs.push(cur);
        cur = cur.next;
        guard++;
      }
      // Find variables that reference specific list nodes (by identity, not value)
      const nodePointers: Record<string, number> = {};
      for (const other of bindings) {
        if (!other.value || typeof other.value !== 'object') continue;
        const idx = refs.indexOf(other.value);
        if (idx >= 0) nodePointers[other.name] = idx;
      }
      if (!bestList || nodes.length > bestList.nodes.length) {
        bestList = { name: b.name, nodes, pointers: nodePointers };
      }
      if (nodes.length >= 200) break;
    }
    if (bestList) {
      views.push({
        kind: 'list',
        name: bestList.name,
        nodes: bestList.nodes,
        pointers: bestList.pointers,
        note: 'Traverse with head / curr / next pointers',
      });
    }

    // Graph (adjacency object) or Map/Set
    for (const b of bindings) {
      const v = b.value;
      if (v instanceof Map) {
        const entries: Array<{ key: string; value: string }> = [];
        let count = 0;
        for (const [k, val] of v.entries()) {
          if (count++ > 80) break;
          entries.push({ key: formatPreview(k, 0), value: shortPreview(val, 40) });
        }
        views.push({ kind: 'map', name: b.name, entries, note: 'Hash map buckets' });
        break;
      }
    }
    for (const b of bindings) {
      const v = b.value;
      if (v instanceof Set) {
        views.push({
          kind: 'set',
          name: b.name,
          values: Array.from(v.values()).slice(0, 100).map((x) => formatPreview(x, 0)),
          note: 'Visited / membership set',
        });
        break;
      }
    }
    for (const b of bindings) {
      const v = b.value;
      if (!v || typeof v !== 'object' || Array.isArray(v) || v instanceof Map || v instanceof Set || v instanceof Date) continue;
      const keys = Object.keys(v);
      if (keys.length === 0) continue;
      const allArrays = keys.every((k) => Array.isArray(v[k]));
      if (allArrays && keys.length <= 60) {
        const nodeSet = new Set<string>(keys);
        const edges: Array<[string, string]> = [];
        for (const k of keys) {
          for (const nb of v[k]) {
            const target = String(nb);
            nodeSet.add(target);
            edges.push([k, target]);
          }
        }
        const visitedSet = bindings.find((x) => x.name === 'visited' && x.value instanceof Set)?.value as Set<any> | undefined;
        views.push({
          kind: 'graph',
          name: b.name,
          nodes: Array.from(nodeSet).slice(0, 80),
          edges: edges.slice(0, 160),
          visited: visitedSet ? Array.from(visitedSet.values()).slice(0, 80).map(String) : [],
          note: 'Adjacency list — BFS/DFS traversal',
        });
        break;
      }
    }
    // Plain object as hash map
    if (!views.some((v) => v.kind === 'map')) {
      for (const b of bindings) {
        const v = b.value;
        if (!v || typeof v !== 'object' || Array.isArray(v) || v instanceof Map || v instanceof Set || v instanceof Date) continue;
        const keys = Object.keys(v);
        if (keys.length === 0) continue;
        if (isTreeNodeLike(v) || isListNodeLike(v)) continue;
        views.push({
          kind: 'map',
          name: b.name,
          entries: keys.slice(0, 60).map((k) => ({ key: k, value: shortPreview(v[k], 40) })),
          note: 'Object used as a hash map',
        });
        break;
      }
    }

    // Matrices
    const matrixCandidate = bindings.find(
      (b) =>
        b.name !== 'arguments' &&
        Array.isArray(b.value) &&
        b.value.length > 0 &&
        Array.isArray(b.value[0]) &&
        b.value.every((row: any) => Array.isArray(row)),
    );
    if (matrixCandidate) {
      const values = (matrixCandidate.value as any[][]).slice(0, 60).map((row) => row.slice(0, 60));
      const rowCount = values.length;
      const colCount = values.reduce((max, row) => Math.max(max, row.length), 0);
      const matrixPointers: Record<string, number> = {};
      for (const [name, idx] of Object.entries(numericPointers)) {
        if (['i', 'row', 'r'].includes(name) && idx >= rowCount) continue;
        if (['j', 'col', 'c'].includes(name) && idx >= colCount) continue;
        matrixPointers[name] = idx;
      }
      const pointerLabels: Record<string, [number, number]> = {};
      const rowKeys = ['i', 'row', 'r'];
      const colKeys = ['j', 'col', 'c'];
      const rowVar = bindings.find((b) => typeof b.value === 'number' && rowKeys.includes(b.name));
      const colVar = bindings.find((b) => typeof b.value === 'number' && colKeys.includes(b.name));
      if (rowVar && colVar && rowVar.value < rowCount && colVar.value < colCount) {
        pointerLabels[`${rowVar.name}, ${colVar.name}`] = [rowVar.value as number, colVar.value as number];
      }
      views.push({
        kind: 'matrix',
        name: matrixCandidate.name,
        values,
        pointers: matrixPointers,
        pointerLabels,
        note: 'Grid / 2D matrix — active cell tracked by (row, col) / (i, j)',
      });
    }

    // Stack / Queue
    const specialArrayNames = new Set<string>();
    for (const b of bindings) {
      if (!Array.isArray(b.value)) continue;
      if (b.name === 'stack' || b.name === 'queue' || b.name === 'st' || b.name === 'q' || b.name === 'dq') {
        specialArrayNames.add(b.name);
        views.push({
          kind: b.name === 'queue' || b.name === 'q' || b.name === 'dq' ? 'queue' : 'stack',
          name: b.name,
          values: b.value.slice(-40),
          note: b.name === 'stack' || b.name === 'st' ? 'LIFO — top is last element' : 'FIFO — front is first element',
        });
      }
    }

    // Plain arrays (skip matrices, stack/queue views and the implicit arguments object)
    const arrayCandidate = bindings
      .filter(
        (b) =>
          Array.isArray(b.value) &&
          !Array.isArray(b.value[0]) &&
          b.name !== 'visited' &&
          b.name !== 'arguments' &&
          !specialArrayNames.has(b.name),
      )
      .sort((a, b) => (b.value as any[]).length - (a.value as any[]).length)[0];
    if (arrayCandidate) {
      const values = (arrayCandidate.value as any[]).slice(0, 200);
      const pointers: Record<string, number> = {};
      for (const [name, idx] of Object.entries(numericPointers)) {
        if (idx < values.length) pointers[name] = idx;
      }
      const highlights: number[] = [];
      if (typeof arrayCandidate.value.length === 'number') {
        // no-op
      }
      views.push({
        kind: 'array',
        name: arrayCandidate.name,
        values,
        pointers,
        highlights,
        note: 'Array / buffer with live pointer tracking',
      });
    }

    return views.slice(0, 4);
  }

  /* ---------------------------- recording -------------------------- */

  private record(node: any, extra: Partial<ExecutionStep> & { explanation: string }): ExecutionStep {
    if (this.stepLimitHit) throw new HaltSignal('steps');
    if (this.steps.length >= this.maxSteps) {
      this.stepLimitHit = true;
      throw new HaltSignal('steps');
    }
    if (this.now() - this.startedAt > this.timeoutMs) {
      throw new HaltSignal('timeout');
    }

    const line = node?.loc?.start?.line ?? this.lastRecordLine;
    const now = this.now();
    const selfMs = this.lastRecordAt ? now - this.lastRecordAt : 0;

    if (this.lastRecordLine) {
      const entry = this.lineHits.get(this.lastRecordLine) || { hits: 0, selfMs: 0, peakBytes: 0 };
      entry.hits += 1;
      entry.selfMs += selfMs;
      this.lineHits.set(this.lastRecordLine, entry);
    }
    this.lastRecordAt = now;
    this.lastRecordLine = line;

    if (this.callStack.length > 0) {
      this.callStack[this.callStack.length - 1].line = line;
    }

    const variables = this.snapshotVariables(this.steps[this.steps.length - 1]?.variables);
    const structures = this.detectDataStructures(this.currentScope);
    const source = (this.lines[line - 1] || '').trim();

    if (line > 0) this.executedLines.add(line);

    const step: ExecutionStep = {
      ...extra,
      line,
      variables,
      callStack: this.callStack.map((f) => ({ ...f })),
      source,
      outputCount: this.outputs.length,
      dataStructure: structures[0],
    };
    if (structures.length > 1) step.dataStructures = structures;
    if (this.loopStack.length > 1) {
      step.explanation = `[nested loop depth ${this.loopStack.length}] ${step.explanation}`;
    }

    // update peak bytes for step line
    try {
      const bytes = new Blob([JSON.stringify(variables)]).size;
      const entry = this.lineHits.get(line) || { hits: 0, selfMs: 0, peakBytes: 0 };
      entry.peakBytes = Math.max(entry.peakBytes, bytes);
      this.lineHits.set(line, entry);
    } catch {
      /* ignore */
    }

    this.steps.push(step);
    return step;
  }

  /* ------------------------------ run ------------------------------ */

  run(program: any, injected: Record<string, any> = {}): InterpretResult {
    this.startedAt = this.now();
    this.lastRecordAt = this.startedAt;

    const globalScope = this.newScope('global', null, undefined);
    for (const [name, value] of Object.entries(injected)) {
      globalScope.vars.set(name, value);
    }
    this.currentScope = globalScope;

    let error: string | undefined;
    let errorLine: number | undefined;

    try {
      const body: any[] = program?.program?.body ?? program?.body ?? [];
      this.hoist(body, globalScope);
      for (const stmt of body) {
        this.execStmt(stmt, globalScope);
      }
      if (!this.hasReturn && !this.containsCall(body)) {
        const auto = this.tryAutoInvoke(body, globalScope, injected);
        if (auto !== undefined) {
          this.returnValue = auto;
          this.hasReturn = true;
        }
      }
    } catch (e: any) {
      if (e instanceof ReturnSignal) {
        this.returnValue = e.value;
        this.hasReturn = true;
      } else if (e instanceof HaltSignal) {
        const messages: Record<string, string> = {
          steps: `Execution stopped after ${this.maxSteps} steps (possible infinite loop).`,
          timeout: `Execution stopped after ${this.timeoutMs}ms (possible infinite loop).`,
          depth: `Maximum call depth (${this.maxDepth}) exceeded — possible infinite recursion.`,
        };
        error = messages[e.reason];
        this.truncated = true;
        this.steps.push({
          line: this.lastRecordLine,
          variables: this.snapshotVariables(),
          callStack: this.callStack.map((f) => ({ ...f })),
          explanation: error,
          isError: true,
          errorMessage: error,
          outputCount: this.outputs.length,
        });
      } else if (e instanceof ThrowSignal) {
        error = e.value instanceof Error ? `${e.value.name}: ${e.value.message}` : formatPreview(e.value);
        errorLine = this.lastRecordLine;
        this.steps.push({
          line: this.lastRecordLine,
          variables: this.snapshotVariables(),
          callStack: this.callStack.map((f) => ({ ...f })),
          explanation: `Uncaught: ${error}`,
          isError: true,
          errorMessage: error,
          outputCount: this.outputs.length,
        });
      } else {
        error = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
        errorLine = this.lastRecordLine;
        this.steps.push({
          line: this.lastRecordLine,
          variables: this.snapshotVariables(),
          callStack: this.callStack.map((f) => ({ ...f })),
          explanation: `Runtime error: ${error}`,
          isError: true,
          errorMessage: error,
          outputCount: this.outputs.length,
        });
      }
    }

    // append final state step
    if (!error && this.steps.length > 0) {
      const lastStep = this.steps[this.steps.length - 1];
      this.steps.push({
        line: lastStep.line,
        variables: this.snapshotVariables(),
        callStack: [],
        explanation: this.hasReturn
          ? `Program finished — returned ${shortPreview(this.returnValue, 80)}`
          : 'Program finished',
        outputCount: this.outputs.length,
        returnValue: this.hasReturn
          ? { name: 'return', value: safeJson(this.returnValue), display: shortPreview(this.returnValue), type: typeOfValue(this.returnValue) }
          : undefined,
        dataStructure: lastStep.dataStructure,
        dataStructures: lastStep.dataStructures,
      });
    }

    const lineMetrics: LineMetric[] = [];
    for (const [line, data] of this.lineHits.entries()) {
      lineMetrics.push({
        line,
        hits: data.hits,
        executionTimeMs: Number(data.selfMs.toFixed(3)),
        executionTimeSec: Number((data.selfMs / 1000).toFixed(6)),
        avgTimeMs: Number((data.selfMs / Math.max(1, data.hits)).toFixed(3)),
        storageSizeBytes: data.peakBytes,
        storageSizeKB: Number((data.peakBytes / 1024).toFixed(4)),
        code: this.lines[line - 1],
        executed: true,
      });
    }
    lineMetrics.sort((a, b) => a.line - b.line);

    return {
      steps: this.steps,
      lineMetrics,
      outputs: this.outputs,
      outputCountTotal: this.outputs.length,
      error,
      errorLine,
      returnValue: this.hasReturn
        ? { name: 'return', value: safeJson(this.returnValue), display: shortPreview(this.returnValue), type: typeOfValue(this.returnValue) }
        : null,
      entryPoint: this.entryPoint,
      truncated: this.stepLimitHit,
      peakCallDepth: this.peakCallDepth,
      functionCalls: this.functionCalls,
      iterations: this.iterations,
      executedLines: this.executedLines.size,
    };
  }

  private containsCall(nodes: any[]): boolean {
    return nodes.some(
      (stmt: any) =>
        t.isExpressionStatement(stmt) &&
        (t.isCallExpression(stmt.expression) ||
          t.isOptionalCallExpression(stmt.expression) ||
          t.isNewExpression(stmt.expression) ||
          t.isAssignmentExpression(stmt.expression) ||
          t.isUpdateExpression(stmt.expression)),
    );
  }

  private tryAutoInvoke(body: any[], scope: Scope, injected: Record<string, any>): any {
    const candidates: Array<{ node: any; name: string }> = [];
    const isFunctionValue = (node: any) =>
      t.isFunctionExpression(node) || t.isArrowFunctionExpression(node);

    for (const stmt of body) {
      if (t.isFunctionDeclaration(stmt) && stmt.id) {
        candidates.push({ node: stmt, name: stmt.id.name });
      } else if (t.isVariableDeclaration(stmt)) {
        // LeetCode-style: const fn = function (...) {...} / const fn = (...) => {...}
        for (const decl of stmt.declarations) {
          if (t.isIdentifier(decl.id) && decl.init && isFunctionValue(decl.init)) {
            candidates.push({ node: decl.init, name: decl.id.name });
          }
        }
      } else if (t.isExpressionStatement(stmt) && t.isAssignmentExpression(stmt.expression)) {
        const { left, right } = stmt.expression;
        if (t.isIdentifier(left) && isFunctionValue(right)) {
          candidates.push({ node: right, name: left.name });
        }
      }
    }

    if (candidates.length === 0) return undefined;
    const target = candidates[candidates.length - 1];
    const input = injected.__input ?? injected.input ?? injected.args;
    const args = this.deriveArgs(target.node, input);
    this.entryPoint = `${target.name}(${args.map((a) => shortPreview(a, 30)).join(', ')})`;
    return this.invoke(target.node, scope, target.name, args, undefined);
  }

  private deriveArgs(fnNode: any, input: any): any[] {
    if (input === undefined) return [];
    if (input && typeof input === 'object' && !Array.isArray(input)) {
      if (Array.isArray(input.args)) return input.args;
      const params = fnNode.params;
      const args = params.map((p: any, idx: number) => {
        const name = t.isIdentifier(p) ? p.name : `arg${idx}`;
        if (name in input) return this.coerceForParam(name, input[name]);
        const values = Object.values(input);
        return this.coerceForParam(name, values[idx]);
      });
      // Don't show (or pass) trailing `undefined` for defaulted parameters.
      while (
        args.length > 0 &&
        args[args.length - 1] === undefined &&
        t.isAssignmentPattern(params[args.length - 1])
      ) {
        args.pop();
      }
      return args;
    }
    if (Array.isArray(input)) {
      const params = fnNode.params;
      if (params.length === 1) {
        const name = t.isIdentifier(params[0]) ? params[0].name : 'arg';
        return [this.coerceForParam(name, input)];
      }
      if (input.length === params.length) {
        return input.map((v, i) => {
          const name = t.isIdentifier(params[i]) ? params[i].name : `arg${i}`;
          return this.coerceForParam(name, v);
        });
      }
      const name = params.length ? (t.isIdentifier(params[0]) ? params[0].name : 'arg') : 'arg';
      return [this.coerceForParam(name, input), ...params.slice(1).map(() => undefined)];
    }
    return [this.coerceForParam('arg', input)];
  }

  private coerceForParam(name: string, value: any): any {
    if (!Array.isArray(value)) return value;
    const lower = name.toLowerCase();
    if (['root', 'tree', 'node', 'bst'].includes(lower)) return this.treeFromArray(value);
    if (['head', 'list', 'linkedlist', 'head1', 'l1', 'l2'].includes(lower)) return this.listFromArray(value);
    return value;
  }

  private treeFromArray(arr: any[]): any {
    if (!arr.length || arr[0] === null || arr[0] === undefined) return null;
    const make = (val: any) => ({ val, left: null, right: null });
    const root = make(arr[0]);
    const queue: any[] = [root];
    let i = 1;
    while (queue.length && i < arr.length) {
      const node = queue.shift();
      if (arr[i] !== null && arr[i] !== undefined) {
        node.left = make(arr[i]);
        queue.push(node.left);
      }
      i++;
      if (i < arr.length && arr[i] !== null && arr[i] !== undefined) {
        node.right = make(arr[i]);
        queue.push(node.right);
      }
      i++;
    }
    return root;
  }

  private listFromArray(arr: any[]): any {
    let head: any = null;
    let tail: any = null;
    for (const val of arr) {
      const node = { val, next: null };
      if (!head) {
        head = node;
        tail = node;
      } else {
        tail.next = node;
        tail = node;
      }
    }
    return head;
  }

  /* ---------------------------- hoisting --------------------------- */

  private hoist(statements: any[], scope: Scope): void {
    for (const stmt of statements) {
      if (t.isFunctionDeclaration(stmt) && stmt.id) {
        scope.vars.set(stmt.id.name, this.makeCallable(stmt, scope, stmt.id.name));
      }
      if (t.isVariableDeclaration(stmt) && stmt.kind === 'var') {
        for (const decl of stmt.declarations) {
          if (t.isIdentifier(decl.id) && !scope.vars.has(decl.id.name)) {
            scope.vars.set(decl.id.name, undefined);
          }
        }
      }
      if (t.isClassDeclaration(stmt) && stmt.id) {
        scope.vars.set(stmt.id.name, this.makeClass(stmt, scope, stmt.id.name));
      }
    }
  }

  /* --------------------------- statements -------------------------- */

  private execStatements(statements: any[], scope: Scope): void {
    for (const stmt of statements) this.execStmt(stmt, scope);
  }

  private execStmt(node: any, scope: Scope): void {
    if (!node) return;

    if (t.isBlockStatement(node)) {
      this.hoist(node.body, scope);
      this.execStatements(node.body, scope);
      return;
    }

    if (t.isEmptyStatement(node) || t.isDebuggerStatement(node)) return;

    if (t.isExpressionStatement(node)) {
      const value = this.evalExpr(node.expression, scope);
      const expr = node.expression;
      if (t.isCallExpression(expr) || t.isOptionalCallExpression(expr)) {
        const label = this.calleeLabel(expr);
        this.record(node, {
          explanation: `${label} → ${shortPreview(value, 50)}`,
          isCall: true,
        });
      } else if (t.isAssignmentExpression(expr)) {
        this.record(node, { explanation: `Updated ${this.assignmentLabel(expr)}` });
      } else if (t.isUpdateExpression(expr)) {
        this.record(node, { explanation: `Updated ${this.assignmentLabel(expr)}` });
      }
      return;
    }

    if (t.isVariableDeclaration(node)) {
      const names: string[] = [];
      for (const decl of node.declarations) {
        const value = decl.init ? this.evalExpr(decl.init, scope) : undefined;
        names.push(...this.bindPattern(decl.id, value, scope, node.kind));
      }
      if (names.length > 0) {
        const rendered = names.map((n) => `${n} = ${shortPreview(scope.vars.get(n), 40)}`).join(', ');
        this.record(node, {
          explanation: `${node.kind} ${rendered}`,
        });
      }
      return;
    }

    if (t.isFunctionDeclaration(node)) {
      // already hoisted — record only at top level for context
      if (this.depth === 0) {
        this.record(node, {
          explanation: `Declared function ${node.id?.name || 'anonymous'}(${(node.params || [])
            .map((p: any) => (t.isIdentifier(p) ? p.name : '…'))
            .join(', ')})`,
        });
      }
      return;
    }

    if (t.isClassDeclaration(node)) {
      if (this.depth === 0 && node.id) {
        this.record(node, { explanation: `Declared class ${node.id.name}` });
      }
      return;
    }

    if (t.isIfStatement(node)) {
      const test = this.evalExpr(node.test, scope);
      const truthy = !!test;
      this.record(node, {
        explanation: `if (${this.sourceSnippet(node.test)}) → ${truthy}`,
        conditionResult: truthy,
      });
      if (truthy) {
        this.execStmt(node.consequent, scope);
      } else if (node.alternate) {
        this.execStmt(node.alternate, scope);
      }
      return;
    }

    if (t.isForStatement(node)) {
      const loopScope = scope;
      if (node.init) {
        if (t.isVariableDeclaration(node.init)) this.execStmt(node.init, loopScope);
        else this.evalExpr(node.init, loopScope);
      }
      let iteration = 0;
      while (true) {
        if (this.now() - this.startedAt > this.timeoutMs) throw new HaltSignal('timeout');
        const test = node.test ? !!this.evalExpr(node.test, loopScope) : true;
        if (!test) {
          this.record(node, {
            explanation: `for loop finished after ${iteration} iteration(s)`,
            loopInfo: { type: 'for', iteration, condition: node.test ? this.sourceSnippet(node.test) : 'true' },
            conditionResult: false,
          });
          break;
        }
        iteration++;
        this.iterations++;
        this.loopStack.push({ type: 'for', iteration, condition: this.sourceSnippet(node.test) });
        this.record(node, {
          explanation: `for iteration ${iteration} — (${this.sourceSnippet(node.test)}) is true`,
          loopInfo: { type: 'for', iteration, condition: this.sourceSnippet(node.test) },
          conditionResult: true,
        });
        try {
          this.execStmt(node.body, loopScope);
        } catch (e) {
          if (e instanceof HaltSignal) {
            this.loopStack.pop();
            throw e;
          }
          if (e instanceof BreakSignal) {
            this.loopStack.pop();
            break;
          }
          if (e instanceof ContinueSignal) {
            // fall through to the update expression
          } else {
            this.loopStack.pop();
            throw e;
          }
        }
        this.loopStack.pop();
        if (node.update) this.evalExpr(node.update, loopScope);
      }
      return;
    }

    if (t.isWhileStatement(node) || t.isDoWhileStatement(node)) {
      let iteration = 0;
      const isDo = t.isDoWhileStatement(node);
      while (true) {
        if (this.now() - this.startedAt > this.timeoutMs) throw new HaltSignal('timeout');
        const test = isDo && iteration === 0 ? true : !!this.evalExpr(node.test, scope);
        if (!test) {
          this.record(node, {
            explanation: `while loop finished after ${iteration} iteration(s)`,
            loopInfo: { type: 'while', iteration, condition: this.sourceSnippet(node.test) },
            conditionResult: false,
          });
          break;
        }
        iteration++;
        this.iterations++;
        this.loopStack.push({ type: 'while', iteration, condition: this.sourceSnippet(node.test) });
        this.record(node, {
          explanation: `while iteration ${iteration} — (${this.sourceSnippet(node.test)}) is true`,
          loopInfo: { type: 'while', iteration, condition: this.sourceSnippet(node.test) },
          conditionResult: true,
        });
        try {
          this.execStmt(node.body, scope);
        } catch (e) {
          if (e instanceof HaltSignal) {
            this.loopStack.pop();
            throw e;
          }
          if (e instanceof BreakSignal) {
            this.loopStack.pop();
            break;
          }
          if (e instanceof ContinueSignal) {
            // continue to next test
          } else {
            this.loopStack.pop();
            throw e;
          }
        }
        this.loopStack.pop();
      }
      return;
    }

    if (t.isForOfStatement(node) || t.isForInStatement(node)) {
      const isOf = t.isForOfStatement(node);
      const iterable = this.evalExpr(node.right, scope);
      const items: any[] = [];
      if (isOf) {
        if (iterable == null) throw new TypeError('Right-hand side of for...of is not iterable');
        if (typeof iterable[Symbol.iterator] === 'function') {
          for (const v of iterable) items.push(v);
        } else {
          throw new TypeError('Right-hand side of for...of is not iterable');
        }
      } else {
        const keys = iterable == null ? [] : Object.keys(iterable);
        items.push(...keys);
      }
      let iteration = 0;
      for (const item of items) {
        if (this.now() - this.startedAt > this.timeoutMs) throw new HaltSignal('timeout');
        iteration++;
        this.iterations++;
        if (t.isVariableDeclaration(node.left)) {
          const decl = node.left.declarations[0];
          if (decl && t.isIdentifier(decl.id)) this.declareVar(decl.id.name, item, scope);
        } else if (t.isIdentifier(node.left)) {
          this.assignVar(node.left.name, item, scope);
        }
        this.record(node, {
          explanation: `${isOf ? 'for…of' : 'for…in'} iteration ${iteration} → ${shortPreview(item, 40)}`,
          loopInfo: { type: isOf ? 'for-of' : 'for-in', iteration, condition: this.sourceSnippet(node.right) },
        });
        try {
          this.execStmt(node.body, scope);
        } catch (e) {
          if (e instanceof HaltSignal) throw e;
          if (e instanceof BreakSignal) break;
          if (e instanceof ContinueSignal) continue;
          throw e;
        }
      }
      return;
    }

    if (t.isSwitchStatement(node)) {
      const discriminant = this.evalExpr(node.discriminant, scope);
      let matched = false;
      for (const caseNode of node.cases) {
        if (!matched) {
          if (!caseNode.test) {
            matched = true;
          } else {
            matched = this.looseEqual(discriminant, this.evalExpr(caseNode.test, scope));
          }
        }
        if (matched) {
          this.record(caseNode, {
            explanation: caseNode.test
              ? `case ${this.sourceSnippet(caseNode.test)} matched`
              : 'default branch',
          });
          try {
            this.execStatements(caseNode.consequent, scope);
          } catch (e) {
            if (e instanceof BreakSignal) return;
            throw e;
          }
        }
      }
      return;
    }

    if (t.isBreakStatement(node)) {
      throw new BreakSignal(node.label?.name);
    }
    if (t.isContinueStatement(node)) {
      throw new ContinueSignal(node.label?.name);
    }
    if (t.isLabeledStatement(node)) {
      try {
        this.execStmt(node.body, scope);
      } catch (e) {
        if (e instanceof BreakSignal && e.label === node.label.name) return;
        throw e;
      }
      return;
    }

    if (t.isReturnStatement(node)) {
      const value = node.argument ? this.evalExpr(node.argument, scope) : undefined;
      this.record(node, {
        explanation: `return ${shortPreview(value, 60)}`,
        returnValue: {
          name: 'return',
          value: safeJson(value),
          display: shortPreview(value, 80),
          type: typeOfValue(value),
        },
      });
      if (this.depth === 0) {
        this.returnValue = value;
        this.hasReturn = true;
      }
      throw new ReturnSignal(value);
    }

    if (t.isThrowStatement(node)) {
      const value = this.evalExpr(node.argument, scope);
      throw new ThrowSignal(value);
    }

    if (t.isTryStatement(node)) {
      try {
        this.execStmt(node.block, scope);
      } catch (e) {
        if (e instanceof ReturnSignal || e instanceof BreakSignal || e instanceof ContinueSignal || e instanceof HaltSignal) {
          throw e;
        }
        if (e instanceof ThrowSignal) {
          if (node.handler) {
            const catchScope = this.newScope('catch', scope, scope.thisVal);
            if (node.handler.param) this.bindPattern(node.handler.param, e.value, catchScope, 'let');
            this.record(node.handler, { explanation: `Caught ${formatPreview(e.value)}` });
            this.execStmt(node.handler.body, catchScope);
          } else {
            throw e;
          }
        } else {
          if (node.handler) {
            const catchScope = this.newScope('catch', scope, scope.thisVal);
            if (node.handler.param) this.bindPattern(node.handler.param, e, catchScope, 'let');
            this.record(node.handler, { explanation: `Caught ${(e as Error)?.message ?? String(e)}` });
            this.execStmt(node.handler.body, catchScope);
          } else {
            throw e;
          }
        }
      } finally {
        if (node.finalizer) this.execStmt(node.finalizer, scope);
      }
      return;
    }

    // Expression-like fallback
    if (t.isExpression(node)) {
      this.evalExpr(node, scope);
      return;
    }
  }

  private bindPattern(pattern: any, value: any, scope: Scope, kind: string): string[] {
    if (!pattern) return [];
    if (t.isIdentifier(pattern)) {
      if (kind === 'var') this.assignVar(pattern.name, value, scope);
      else this.declareVar(pattern.name, value, scope);
      return [pattern.name];
    }
    if (t.isAssignmentPattern(pattern)) {
      const v = value === undefined ? this.evalExpr(pattern.right, scope) : value;
      return this.bindPattern(pattern.left, v, scope, kind);
    }
    if (t.isArrayPattern(pattern)) {
      const items = Array.isArray(value) ? value : value != null ? Array.from(value) : [];
      const names: string[] = [];
      pattern.elements.forEach((el: any, i: number) => {
        if (!el) return;
        if (t.isRestElement(el)) {
          names.push(...this.bindPattern(el.argument, items.slice(i), scope, kind));
        } else {
          names.push(...this.bindPattern(el, items[i], scope, kind));
        }
      });
      return names;
    }
    if (t.isObjectPattern(pattern)) {
      const names: string[] = [];
      for (const prop of pattern.properties) {
        if (t.isRestElement(prop)) {
          const rest: Record<string, any> = {};
          const used = pattern.properties
            .filter((p: any) => t.isObjectProperty(p) && t.isIdentifier(p.key))
            .map((p: any) => p.key.name);
          for (const k of Object.keys(value || {})) if (!used.includes(k)) rest[k] = value[k];
          names.push(...this.bindPattern(prop.argument, rest, scope, kind));
        } else if (t.isObjectProperty(prop)) {
          const key = this.propKey(prop.key);
          names.push(...this.bindPattern(prop.value, value == null ? undefined : value[key], scope, kind));
        }
      }
      return names;
    }
    return [];
  }

  /* --------------------------- expressions ------------------------- */

  private looseEqual(a: any, b: any): boolean {
    // eslint-disable-next-line eqeqeq
    return a == b;
  }

  private propKey(prop: any): any {
    if (prop == null) return undefined;
    if (t.isIdentifier(prop)) return prop.name;
    if (t.isPrivateName(prop)) return prop.id?.name;
    if (t.isStringLiteral(prop) || t.isNumericLiteral(prop)) return prop.value;
    return (prop as any).name;
  }

  private sourceSnippet(node: any): string {
    if (!node) return '';
    try {
      const start = node.start ?? 0;
      const end = node.end ?? start;
      const text = this.code.slice(start, end).replace(/\s+/g, ' ').trim();
      return text.length > 64 ? `${text.slice(0, 63)}…` : text;
    } catch {
      return '';
    }
  }

  private calleeLabel(node: any): string {
    try {
      const callee = node.callee;
      if (t.isIdentifier(callee)) return `${callee.name}(…)`;
      if (t.isMemberExpression(callee)) {
        return `${this.sourceSnippet(callee)}(…)`;
      }
      return 'call(…)';
    } catch {
      return 'call(…)';
    }
  }

  private assignmentLabel(node: any): string {
    if (t.isUpdateExpression(node)) {
      const target = t.isIdentifier(node.argument) ? node.argument.name : this.sourceSnippet(node.argument);
      return `${target}${node.operator}`;
    }
    if (t.isAssignmentExpression(node)) {
      const target = t.isIdentifier(node.left) ? node.left.name : this.sourceSnippet(node.left);
      return target;
    }
    if (t.isMemberExpression(node)) return this.sourceSnippet(node);
    if (t.isIdentifier(node)) return node.name;
    return 'value';
  }

  private evalExpr(node: any, scope: Scope): any {
    if (!node) return undefined;

    if (t.isNumericLiteral(node)) return node.value;
    if (t.isStringLiteral(node)) return node.value;
    if (t.isBooleanLiteral(node)) return node.value;
    if (t.isNullLiteral(node)) return null;
    if (t.isRegExpLiteral(node)) return new RegExp(node.pattern, node.flags);
    if (t.isBigIntLiteral(node)) return BigInt(node.value);

    if (t.isIdentifier(node)) {
      return this.lookup(node.name, scope);
    }

    if (t.isThisExpression(node)) {
      let cur: Scope | null = scope;
      while (cur) {
        if (cur.thisVal !== undefined) return cur.thisVal;
        cur = cur.parent;
      }
      return undefined;
    }

    if (t.isTemplateLiteral(node)) {
      let out = '';
      node.quasis.forEach((q: any, i: number) => {
        out += q.value.cooked ?? q.value.raw;
        if (i < node.expressions.length) out += String(this.evalExpr(node.expressions[i], scope));
      });
      return out;
    }

    if (t.isArrayExpression(node)) {
      const arr: any[] = [];
      for (const el of node.elements) {
        if (!el) {
          arr.push(undefined);
          continue;
        }
        if (t.isSpreadElement(el)) {
          const v = this.evalExpr(el.argument, scope);
          if (v != null && typeof v[Symbol.iterator] === 'function') arr.push(...v);
          continue;
        }
        arr.push(this.evalExpr(el, scope));
      }
      return arr;
    }

    if (t.isObjectExpression(node)) {
      const obj: Record<string, any> = {};
      for (const prop of node.properties) {
        if (t.isSpreadElement(prop)) {
          const v = this.evalExpr(prop.argument, scope);
          if (v && typeof v === 'object') Object.assign(obj, v);
          continue;
        }
        if (t.isObjectProperty(prop)) {
          const key = t.isIdentifier(prop.key)
            ? prop.key.name
            : t.isStringLiteral(prop.key)
              ? prop.key.value
              : String(this.evalExpr(prop.key, scope));
          obj[key] = this.evalExpr(prop.value, scope);
        } else if (t.isObjectMethod(prop)) {
          const methodName = String(this.propKey(prop.key));
          obj[methodName] = this.makeCallable(prop, scope, methodName);
        }
      }
      return obj;
    }

    if (t.isFunctionExpression(node) || t.isArrowFunctionExpression(node)) {
      return this.makeCallable(node, scope, (node as any).id?.name || 'anonymous');
    }

    if (t.isClassExpression(node)) {
      return this.makeClass(node, scope, node.id?.name || 'AnonymousClass');
    }

    if (t.isBinaryExpression(node)) {
      const left = this.evalExpr(node.left, scope);
      const right = this.evalExpr(node.right, scope);
      switch (node.operator) {
        case '+':
          return left + right;
        case '-':
          return left - right;
        case '*':
          return left * right;
        case '/':
          return left / right;
        case '%':
          return left % right;
        case '**':
          return left ** right;
        case '<':
          return left < right;
        case '<=':
          return left <= right;
        case '>':
          return left > right;
        case '>=':
          return left >= right;
        case '==':
          // eslint-disable-next-line eqeqeq
          return left == right;
        case '!=':
          // eslint-disable-next-line eqeqeq
          return left != right;
        case '===':
          return left === right;
        case '!==':
          return left !== right;
        case '&':
          return left & right;
        case '|':
          return left | right;
        case '^':
          return left ^ right;
        case '<<':
          return left << right;
        case '>>':
          return left >> right;
        case '>>>':
          return left >>> right;
        case 'in':
          return right != null && left in right;
        case 'instanceof':
          return right != null && left instanceof right;
        default:
          throw new Error(`Unsupported operator ${node.operator}`);
      }
    }

    if (t.isLogicalExpression(node)) {
      const left = this.evalExpr(node.left, scope);
      if (node.operator === '&&') return left ? this.evalExpr(node.right, scope) : left;
      if (node.operator === '||') return left ? left : this.evalExpr(node.right, scope);
      if (node.operator === '??') return left ?? this.evalExpr(node.right, scope);
    }

    if (t.isUnaryExpression(node)) {
      if (node.operator === 'typeof') {
        if (t.isIdentifier(node.argument)) {
          try {
            const v = this.lookup(node.argument.name, scope);
            return typeof v;
          } catch {
            return 'undefined';
          }
        }
        return typeof this.evalExpr(node.argument, scope);
      }
      if (node.operator === 'delete') {
        if (t.isMemberExpression(node.argument)) {
          const obj = this.evalExpr(node.argument.object, scope);
          const key = node.argument.computed
            ? this.evalExpr(node.argument.property, scope)
            : this.propKey(node.argument.property);
          try {
            return delete obj[key];
          } catch {
            return false;
          }
        }
        return true;
      }
      const value = this.evalExpr(node.argument, scope);
      switch (node.operator) {
        case '-':
          return -value;
        case '+':
          return +value;
        case '!':
          return !value;
        case '~':
          return ~value;
        case 'void':
          return undefined;
        default:
          throw new Error(`Unsupported unary operator ${node.operator}`);
      }
    }

    if (t.isUpdateExpression(node)) {
      const delta = node.operator === '++' ? 1 : -1;
      if (t.isIdentifier(node.argument)) {
        const old = this.lookup(node.argument.name, scope);
        const next = Number(old) + delta;
        this.assignVar(node.argument.name, next, scope);
        return node.prefix ? next : old;
      }
      if (t.isMemberExpression(node.argument)) {
        const obj = this.evalExpr(node.argument.object, scope);
        const key = node.argument.computed
          ? this.evalExpr(node.argument.property, scope)
          : this.propKey(node.argument.property);
        const old = obj[key];
        const next = Number(old) + delta;
        obj[key] = next;
        return node.prefix ? next : old;
      }
      throw new Error('Invalid update target');
    }

    if (t.isAssignmentExpression(node)) {
      if (node.operator === '=') {
        if (t.isMemberExpression(node.left) || t.isOptionalMemberExpression(node.left)) {
          const obj = this.evalExpr(node.left.object, scope);
          const key = node.left.computed
            ? this.evalExpr(node.left.property, scope)
            : this.propKey(node.left.property);
          const value = this.evalExpr(node.right, scope);
          if (obj == null) throw new TypeError(`Cannot set property '${String(key)}' of ${obj}`);
          obj[key] = value;
          return value;
        }
        if (t.isIdentifier(node.left)) {
          const value = this.evalExpr(node.right, scope);
          this.assignVar(node.left.name, value, scope);
          return value;
        }
        if (t.isArrayPattern(node.left) || t.isObjectPattern(node.left)) {
          const value = this.evalExpr(node.right, scope);
          this.bindPattern(node.left, value, scope, 'let');
          return value;
        }
      }

      const current = this.evalExpr(node.left, scope);
      const right = this.evalExpr(node.right, scope);
      let next: any;
      switch (node.operator) {
        case '+=':
          next = current + right;
          break;
        case '-=':
          next = current - right;
          break;
        case '*=':
          next = current * right;
          break;
        case '/=':
          next = current / right;
          break;
        case '%=':
          next = current % right;
          break;
        case '**=':
          next = current ** right;
          break;
        case '&&=':
          next = current && right;
          break;
        case '||=':
          next = current || right;
          break;
        case '??=':
          next = current ?? right;
          break;
        case '&=':
          next = current & right;
          break;
        case '|=':
          next = current | right;
          break;
        case '^=':
          next = current ^ right;
          break;
        case '<<=':
          next = current << right;
          break;
        case '>>=':
          next = current >> right;
          break;
        case '>>>=':
          next = current >>> right;
          break;
        default:
          throw new Error(`Unsupported assignment operator ${node.operator}`);
      }
      if (t.isIdentifier(node.left)) {
        this.assignVar(node.left.name, next, scope);
        return next;
      }
      if (t.isMemberExpression(node.left)) {
        const obj = this.evalExpr(node.left.object, scope);
        const key = node.left.computed
          ? this.evalExpr(node.left.property, scope)
          : this.propKey(node.left.property);
        obj[key] = next;
        return next;
      }
      throw new Error('Invalid assignment target');
    }

    if (t.isConditionalExpression(node)) {
      return this.evalExpr(node.test, scope) ? this.evalExpr(node.consequent, scope) : this.evalExpr(node.alternate, scope);
    }

    if (t.isMemberExpression(node) || t.isOptionalMemberExpression(node)) {
      const obj = this.evalExpr(node.object, scope);
      if (obj == null && ((node as any).optional || t.isOptionalMemberExpression(node))) return undefined;
      const key = node.computed ? this.evalExpr(node.property, scope) : this.propKey(node.property);
      if (obj == null) throw new TypeError(`Cannot read properties of ${obj} (reading '${String(key)}')`);
      return obj[key];
    }

    if (t.isCallExpression(node) || t.isOptionalCallExpression(node) || t.isNewExpression(node)) {
      const isNew = t.isNewExpression(node);
      const args: any[] = [];
      for (const arg of node.arguments || []) {
        if (t.isSpreadElement(arg)) {
          const v = this.evalExpr(arg.argument, scope);
          if (v != null && typeof v[Symbol.iterator] === 'function') args.push(...v);
          else args.push(v);
        } else if (t.isArgumentPlaceholder?.(arg)) {
          args.push(undefined);
        } else {
          args.push(this.evalExpr(arg, scope));
        }
      }

      const callee = node.callee;
      let fn: any;
      let thisArg: any = undefined;

      if (t.isMemberExpression(callee) || t.isOptionalMemberExpression(callee)) {
        thisArg = this.evalExpr(callee.object, scope);
        const key = callee.computed ? this.evalExpr(callee.property, scope) : this.propKey(callee.property);
        if (thisArg == null && ((callee as any).optional || t.isOptionalMemberExpression(callee))) return undefined;
        fn = thisArg == null ? undefined : thisArg[key];
      } else if (t.isSuper(node)) {
        throw new Error('super() is not supported by the visual interpreter');
      } else {
        fn = this.evalExpr(callee, scope);
      }

      if (typeof fn !== 'function') {
        const label = t.isIdentifier(callee) ? callee.name : this.sourceSnippet(callee);
        throw new TypeError(`${label} is not a function`);
      }

      const result = isNew ? new fn(...args) : fn.apply(thisArg, args);
      return result;
    }

    if (t.isSequenceExpression(node)) {
      let value: any;
      for (const expr of node.expressions) value = this.evalExpr(expr, scope);
      return value;
    }

    if (
      t.isTSAsExpression?.(node) ||
      t.isTSNonNullExpression?.(node) ||
      t.isTSTypeAssertion?.(node) ||
      t.isTSSatisfiesExpression?.(node)
    ) {
      return this.evalExpr(node.expression, scope);
    }

    if (t.isAwaitExpression(node)) {
      throw new Error('await is not supported in the step tracer');
    }
    if (t.isYieldExpression(node)) {
      throw new Error('yield is not supported in the step tracer');
    }

    throw new Error(`Unsupported syntax: ${node.type}`);
  }

  /* ---------------------------- functions -------------------------- */

  private makeCallable(fnNode: any, closure: Scope, name: string): any {
    const interp = this;
    const params: any[] = fnNode.params || [];

    const fn = function (this: any, ...args: any[]) {
      return interp.invoke(fnNode, closure, name, args, this, params);
    };

    Object.defineProperty(fn, 'name', { value: name, configurable: true });
    return fn;
  }

  private invoke(
    fnNode: any,
    closure: Scope,
    name: string,
    args: any[],
    thisVal: any,
    params?: any[],
  ): any {
    if (this.depth >= this.maxDepth) throw new HaltSignal('depth');
    this.depth++;
    this.functionCalls++;
    this.peakCallDepth = Math.max(this.peakCallDepth, this.depth);

    const fnParams = params || fnNode.params || [];
    const isArrow = t.isArrowFunctionExpression(fnNode);
    const scope = this.newScope(name || 'anonymous', closure, isArrow ? closure.thisVal : thisVal);

    // bind parameters
    fnParams.forEach((param: any, index: number) => {
      if (t.isRestElement(param)) {
        this.bindPattern(param.argument, args.slice(index), scope, 'let');
      } else {
        this.bindPattern(param, args[index], scope, 'let');
      }
    });

    // bind arguments object
    scope.vars.set('arguments', args);
    ARGUMENTS_OBJECTS.add(args);

    const savedScope = this.currentScope;
    this.currentScope = scope;
    const frame: CallFrame = {
      name: name || 'anonymous',
      line: fnNode.loc?.start?.line ?? 0,
      args: args.length ? args.map((a) => shortPreview(a, 24)).join(', ') : undefined,
    };
    this.callStack.push(frame);

    if (this.depth === 1) {
      this.entryPoint = `${name}(${args.map((a) => shortPreview(a, 24)).join(', ')})`;
    }

    const body = fnNode.body;
    let result: any;
    try {
      if (t.isBlockStatement(body)) {
        this.hoist(body.body, scope);
        this.execStatements(body.body, scope);
      } else {
        result = this.evalExpr(body, scope);
      }
    } catch (e) {
      if (e instanceof ReturnSignal) {
        result = e.value;
      } else {
        this.callStack.pop();
        this.currentScope = savedScope;
        this.depth--;
        throw e;
      }
    }
    this.callStack.pop();
    this.currentScope = savedScope;
    this.depth--;
    return result;
  }

  private makeClass(classNode: any, closure: Scope, name: string): any {
    const interp = this;
    const ctorNode =
      classNode.body.body.find((m: any) => t.isClassMethod(m) && m.kind === 'constructor') || null;

    const Ctor: any = function (this: any, ...args: any[]) {
      if (ctorNode) {
        interp.invoke(ctorNode, closure, name, args, this, ctorNode.params);
      }
      return this;
    };
    Object.defineProperty(Ctor, 'name', { value: name, configurable: true });

    for (const member of classNode.body.body) {
      if (t.isClassMethod(member) && member.kind !== 'constructor') {
        const methodName = String(this.propKey(member.key));
        if (member.static) {
          Ctor[methodName] = interp.makeCallable(member, closure, methodName);
        } else {
          Ctor.prototype[methodName] = interp.makeCallable(member, closure, methodName);
        }
      }
    }
    return Ctor;
  }
}

/* ------------------------------------------------------------------ */
/* Globals exposed to user code                                        */
/* ------------------------------------------------------------------ */

function makeGlobals(consoleLike: { log: (...a: any[]) => void; error: (...a: any[]) => void; warn: (...a: any[]) => void }) {
  return {
    console: consoleLike,
    Math,
    JSON,
    Object,
    Array,
    String,
    Number,
    Boolean,
    Map,
    Set,
    WeakMap,
    WeakSet,
    Date,
    RegExp,
    Error,
    TypeError,
    RangeError,
    SyntaxError,
    Promise,
    Symbol,
    parseInt,
    parseFloat,
    isNaN,
    isFinite,
    encodeURIComponent,
    decodeURIComponent,
    structuredClone,
  };
}

let GLOBALS: Record<string, any> = makeGlobals({
  log: () => {},
  error: () => {},
  warn: () => {},
});

export function setRuntimeConsole(consoleLike: { log: (...a: any[]) => void; error: (...a: any[]) => void; warn: (...a: any[]) => void }) {
  GLOBALS = makeGlobals(consoleLike);
}

/* ------------------------------------------------------------------ */
/* Public entry                                                        */
/* ------------------------------------------------------------------ */

export interface TraceInput {
  code: string;
  input?: any;
  language?: 'javascript' | 'typescript';
  options?: InterpretOptions;
}

export function traceJavaScript({ code, input, options }: TraceInput): InterpretResult {
  const interp = new JsInterpreter(code, options);

  // Console writes must land in the interpreter's own output buffer, because
  // every recorded step stores `this.outputs.length` as its outputCount. A
  // separate array here made every step claim zero output.
  const recordConsole = (...args: any[]) =>
    interp.outputs.push(args.map((a) => (typeof a === 'string' ? a : formatPreview(a, 0))).join(' '));
  setRuntimeConsole({ log: recordConsole, error: recordConsole, warn: recordConsole });

  let program: any;
  try {
    program = parser.parse(code, {
      sourceType: 'module',
      allowReturnOutsideFunction: true,
      plugins: ['typescript', 'jsx'] as any,
    });
  } catch (e: any) {
    const message = e?.message ?? String(e);
    const loc = e?.loc?.line;
    return {
      steps: [
        {
          line: loc ?? 1,
          variables: [],
          explanation: `Syntax error: ${message}`,
          isError: true,
          errorMessage: message,
          callStack: [],
        },
      ],
      lineMetrics: [],
      outputs: interp.outputs,
      outputCountTotal: 0,
      error: `Syntax error: ${message}`,
      errorLine: loc,
      returnValue: null,
      peakCallDepth: 0,
      functionCalls: 0,
      iterations: 0,
      executedLines: 0,
    };
  }

  const injected: Record<string, any> = {};
  const referenced = (name: string) => new RegExp(`\\b${name}\\b`).test(code);
  if (input !== undefined) {
    injected.__input = input;
    if (referenced('input')) injected.input = input;
    if (Array.isArray(input)) {
      for (const alias of ['nums', 'arr', 'array', 'prices', 'values', 'items', 'heights', 'num', 'target']) {
        if (referenced(alias)) injected[alias] = input;
      }
    } else if (input && typeof input === 'object') {
      for (const [k, v] of Object.entries(input)) {
        if (referenced(k)) injected[k] = v;
      }
      if (Array.isArray((input as any).args)) injected.args = (input as any).args;
    } else {
      if (referenced('n')) injected.n = input;
    }
  }

  interp.inputAliasNames = new Set(Object.keys(injected));
  const result = interp.run(program, injected);
  return {
    ...result,
    outputs: interp.outputs,
    outputCountTotal: interp.outputs.length,
  };
}
