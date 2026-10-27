import type { DataStructureView, TreeNodeSnapshot } from '../types';

/* ------------------------------------------------------------------ */
/* shape detection                                                     */
/* ------------------------------------------------------------------ */

function isObject(value: unknown): value is Record<string, any> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isTreeObject(value: unknown): boolean {
  if (!isObject(value)) return false;
  if (value.__kind === 'tree') return true;
  return 'val' in value && ('left' in value || 'right' in value);
}

function isListNodeObject(value: unknown): boolean {
  if (!isObject(value)) return false;
  if (value.__kind === 'list') return true;
  return 'val' in value && 'next' in value && !('left' in value) && !('right' in value);
}

function isMatrix(value: unknown): value is any[][] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every((row) => Array.isArray(row))
  );
}

function preview(value: unknown, limit = 40): string {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (typeof value === 'string') return value.length > limit ? `${value.slice(0, limit - 1)}…` : value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  try {
    const text = JSON.stringify(value);
    if (!text) return String(value);
    return text.length > limit ? `${text.slice(0, limit - 1)}…` : text;
  } catch {
    return String(value);
  }
}

let treeId = 0;

/** Build a tree snapshot from a LeetCode level-order array (null marks gaps). */
export function treeFromLevelOrder(values: unknown[]): TreeNodeSnapshot | null {
  if (!Array.isArray(values) || values.length === 0 || values[0] === null || values[0] === undefined) {
    return null;
  }
  const make = (val: unknown): TreeNodeSnapshot => ({ val, id: treeId++ });
  const root = make(values[0]);
  const queue: TreeNodeSnapshot[] = [root];
  let index = 1;
  while (queue.length > 0 && index < values.length) {
    const node = queue.shift()!;
    const left = values[index++];
    if (left !== null && left !== undefined) {
      node.left = make(left);
      queue.push(node.left);
    }
    if (index >= values.length) break;
    const right = values[index++];
    if (right !== null && right !== undefined) {
      node.right = make(right);
      queue.push(node.right);
    }
  }
  return root;
}

/** Convert a `{ val, left, right }` object into a snapshot. */
function treeFromObject(value: any, depth = 0, seen = new Set<any>()): TreeNodeSnapshot | null {
  if (!isObject(value) || depth > 12 || seen.has(value)) return null;
  seen.add(value);
  const node: TreeNodeSnapshot = {
    val: value.val,
    id: treeId++,
    left: treeFromObject(value.left, depth + 1, seen),
    right: treeFromObject(value.right, depth + 1, seen),
  };
  return node;
}

function listValues(value: any): any[] {
  if (value?.__kind === 'list') {
    return Array.isArray(value.values) ? value.values : [];
  }
  const values: any[] = [];
  let current = value;
  const seen = new Set<any>();
  let guard = 0;
  while (isObject(current) && !seen.has(current) && guard < 200) {
    seen.add(current);
    values.push(current.val);
    current = current.next;
    guard += 1;
  }
  return values;
}

/* ------------------------------------------------------------------ */
/* view builders                                                       */
/* ------------------------------------------------------------------ */

function arrayView(name: string, values: unknown[], note = 'Array / list'): DataStructureView {
  return {
    kind: 'array',
    name,
    values,
    pointers: {},
    highlights: [],
    note,
  };
}

function matrixView(name: string, values: unknown[][], note = 'Grid / 2D matrix'): DataStructureView {
  return {
    kind: 'matrix',
    name,
    values,
    pointers: {},
    pointerLabels: {},
    highlights: [],
    note,
  };
}

function mapView(name: string, value: Record<string, any>): DataStructureView {
  const entries =
    value.__kind === 'map' && Array.isArray(value.entries)
      ? value.entries.map((entry: any) =>
          Array.isArray(entry)
            ? { key: String(entry[0]), value: String(entry[1]) }
            : { key: String(entry?.key ?? ''), value: String(entry?.value ?? '') },
        )
      : Object.entries(value).map(([key, entry]) => ({ key, value: preview(entry) }));
  return { kind: 'map', name, entries, note: 'Hash map / dictionary' };
}

function structuresForValue(name: string, value: unknown, hint?: string): DataStructureView[] {
  if (value === null || value === undefined) return [];
  const record = value as Record<string, any>;

  if (isTreeObject(value)) {
    const root = record.__kind === 'tree' ? (record.data as TreeNodeSnapshot | null) : treeFromObject(value);
    return [{ kind: 'tree', name, root, note: 'Binary tree - recursive left/right structure' }];
  }

  if (isListNodeObject(value)) {
    const values = listValues(value);
    return [
      {
        kind: 'list',
        name,
        nodes: values.map((entry) => ({ val: entry })),
        pointers: {},
        note: 'Linked list - follow next pointers',
      },
    ];
  }

  if (record.__kind === 'set' && Array.isArray(record.values)) {
    return [{ kind: 'set', name, values: record.values.map((entry: any) => preview(entry)), note: 'Hash set' }];
  }

  if (isObject(value) && value.__kind === 'map') {
    return [mapView(name, value)];
  }

  if (Array.isArray(value)) {
    const lower = name.toLowerCase();
    if (isMatrix(value)) {
      return [matrixView(name, value)];
    }
    if (['root', 'tree', 'node', 'bst'].includes(lower)) {
      const root = treeFromLevelOrder(value);
      if (root) {
        return [
          {
            kind: 'tree',
            name,
            root,
            note: 'Binary tree built from a level-order input array',
          },
        ];
      }
    }
    if (['head', 'list', 'linkedlist', 'l1', 'l2'].includes(lower)) {
      return [
        {
          kind: 'list',
          name,
          nodes: value.map((entry) => ({ val: entry })),
          pointers: {},
          note: 'Linked list built from the input array',
        },
      ];
    }
    return [arrayView(name, value, hint || 'Array / list')];
  }

  if (typeof value === 'string') {
    return [arrayView(name, Array.from(value), 'String shown character by character')];
  }

  if (isObject(value)) {
    return [mapView(name, value)];
  }

  return [];
}

/* ------------------------------------------------------------------ */
/* public API                                                          */
/* ------------------------------------------------------------------ */

/**
 * Derive visualisable structures from the user's JSON test input.
 * Works for every language because it only inspects the input payload.
 */
export function buildInputStructures(input: unknown): DataStructureView[] {
  if (input === null || input === undefined) return [];

  if (Array.isArray(input)) {
    return structuresForValue('input', input, 'Input array');
  }

  if (isObject(input)) {
    if ('args' in input && Array.isArray(input.args)) {
      return structuresForValue('args', input.args, 'Positional arguments');
    }
    const views: DataStructureView[] = [];
    const seen = new Set<string>();
    for (const [key, value] of Object.entries(input)) {
      const candidate = structuresForValue(key, value);
      for (const view of candidate) {
        const id = `${view.kind}:${view.name}`;
        if (seen.has(id)) continue;
        seen.add(id);
        views.push(view);
      }
      if (views.length >= 6) break;
    }
    return views;
  }

  if (typeof input === 'string') {
    return [arrayView('input', Array.from(input), 'Input string shown character by character')];
  }

  return [];
}

/**
 * Build views for a final returned value (JS/Python objects, arrays, trees,
 * linked lists and `__kind` wrappers produced by the Python harness).
 */
export function buildResultStructures(value: unknown, name = 'return'): DataStructureView[] {
  return structuresForValue(name, value);
}

/** Pull the final result out of stdout when real variable tracing is unavailable. */
export function inferStructuresFromOutputs(outputs: string[]): DataStructureView[] {
  for (let index = outputs.length - 1; index >= 0; index--) {
    const line = (outputs[index] || '').trim();
    if (!line) continue;
    const start = line.search(/[[{]/);
    if (start < 0) continue;
    const snippet = line.slice(start);
    try {
      const parsed = JSON.parse(snippet);
      const views = buildResultStructures(parsed, 'output');
      if (views.length > 0) return views;
    } catch {
      // Not JSON - keep looking at earlier output lines.
    }
  }
  return [];
}

/** Deduplicate views by kind + name, preserving order. */
export function mergeStructures(...groups: DataStructureView[][]): DataStructureView[] {
  const merged: DataStructureView[] = [];
  const seen = new Set<string>();
  for (const group of groups) {
    for (const view of group) {
      const id = `${view.kind}:${view.name}`;
      if (seen.has(id)) continue;
      seen.add(id);
      merged.push(view);
    }
  }
  return merged.slice(0, 10);
}
