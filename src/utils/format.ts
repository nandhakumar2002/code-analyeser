import type { VariableState } from '../types';

const textEncoder =
  typeof TextEncoder !== 'undefined' ? new TextEncoder() : null;

export interface FormatOptions {
  maxDepth?: number;
  maxItems?: number;
  maxLength?: number;
  quoteStrings?: boolean;
}

export function classNameOf(value: any): string | undefined {
  if (value === null || typeof value !== 'object') return undefined;
  try {
    const ctor = value.constructor;
    const name = ctor && typeof ctor.name === 'string' ? ctor.name : '';
    if (!name || name === 'Object') return undefined;
    return name;
  } catch {
    return undefined;
  }
}

export function typeOfValue(value: any): string {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (Array.isArray(value)) return 'array';
  if (value instanceof Map) return 'map';
  if (value instanceof Set) return 'set';
  if (value instanceof Date) return 'date';
  if (value instanceof RegExp) return 'regexp';
  if (value instanceof Error) return 'error';
  if (typeof Promise !== 'undefined' && value instanceof Promise) return 'promise';
  if (typeof ArrayBuffer !== 'undefined' && ArrayBuffer.isView(value)) return 'typed-array';
  if (typeof value === 'object') return 'object';
  return typeof value;
}

export function isPlainObject(value: any): boolean {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function quote(value: string): string {
  try {
    return JSON.stringify(value);
  } catch {
    return `"${value.replace(/"/g, '\\"')}"`;
  }
}

function formatKey(key: string): string {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key) ? key : quote(key);
}

function functionLabel(value: Function): string {
  const name = value.name;
  return name ? `ƒ ${name}()` : 'ƒ anonymous()';
}

function ownEntries(value: object): Array<[string, any]> {
  const entries: Array<[string, any]> = [];
  let keys: string[] = [];
  try {
    keys = Object.keys(value);
  } catch {
    return entries;
  }
  for (const key of keys) {
    try {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor) continue;
      if ('value' in descriptor) entries.push([key, descriptor.value]);
      else entries.push([key, '[Getter]']);
    } catch {
      entries.push([key, '[Unreadable]']);
    }
  }
  return entries;
}

function formatInner(
  value: any,
  depth: number,
  seen: WeakSet<object>,
  maxDepth: number,
  maxItems: number,
  quoteStrings: boolean,
): string {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';

  const primitiveType = typeof value;
  if (primitiveType === 'string') return quoteStrings ? quote(value) : value;
  if (primitiveType === 'number') {
    if (Number.isNaN(value)) return 'NaN';
    if (value === Infinity) return 'Infinity';
    if (value === -Infinity) return '-Infinity';
    if (Object.is(value, -0)) return '-0';
    return String(value);
  }
  if (primitiveType === 'bigint') return `${value.toString()}n`;
  if (primitiveType === 'boolean') return value ? 'true' : 'false';
  if (primitiveType === 'symbol') return value.toString();
  if (primitiveType === 'function') return functionLabel(value as Function);

  if (seen.has(value)) return '[Circular]';
  const isContainer =
    Array.isArray(value) ||
    value instanceof Map ||
    value instanceof Set ||
    value instanceof Date ||
    value instanceof RegExp ||
    value instanceof Error ||
    (typeof ArrayBuffer !== 'undefined' && ArrayBuffer.isView(value)) ||
    primitiveType === 'object';
  if (!isContainer) return String(value);

  if (value instanceof Date) return `Date(${value.toISOString()})`;
  if (value instanceof RegExp) return String(value);
  if (value instanceof Error) return `${value.name}: ${value.message}`;
  if (typeof ArrayBuffer !== 'undefined' && ArrayBuffer.isView(value)) {
    const items = Array.from(value as unknown as ArrayLike<number>);
    return `${value.constructor.name} [${items.slice(0, maxItems).join(', ')}${
      items.length > maxItems ? ', …' : ''
    }]`;
  }

  if (depth >= maxDepth) {
    if (Array.isArray(value)) return `[…] (${value.length})`;
    if (value instanceof Map) return `Map(…)`;
    if (value instanceof Set) return `Set(…)`;
    return '{…}';
  }

  seen.add(value);
  try {
    if (Array.isArray(value)) {
      const shown = value.slice(0, maxItems).map((item) =>
        formatInner(item, depth + 1, seen, maxDepth, maxItems, quoteStrings),
      );
      if (value.length > maxItems) shown.push(`… +${value.length - maxItems} more`);
      return `[${shown.join(', ')}]`;
    }

    if (value instanceof Map) {
      const parts: string[] = [];
      let index = 0;
      for (const [key, item] of value.entries()) {
        if (index >= maxItems) {
          parts.push(`… +${value.size - maxItems} more`);
          break;
        }
        parts.push(
          `${formatInner(key, depth + 1, seen, maxDepth, maxItems, quoteStrings)} => ${formatInner(
            item,
            depth + 1,
            seen,
            maxDepth,
            maxItems,
            quoteStrings,
          )}`,
        );
        index++;
      }
      return `Map(${value.size}) {${parts.length ? ' ' + parts.join(', ') + ' ' : ''}}`;
    }

    if (value instanceof Set) {
      const parts: string[] = [];
      let index = 0;
      for (const item of value.values()) {
        if (index >= maxItems) {
          parts.push(`… +${value.size - maxItems} more`);
          break;
        }
        parts.push(formatInner(item, depth + 1, seen, maxDepth, maxItems, quoteStrings));
        index++;
      }
      return `Set(${value.size}) {${parts.length ? ' ' + parts.join(', ') + ' ' : ''}}`;
    }

    if (typeof ArrayBuffer !== 'undefined' && value instanceof ArrayBuffer) {
      return `ArrayBuffer(${value.byteLength})`;
    }

    const entries = ownEntries(value);
    const shown = entries.slice(0, maxItems).map(([key, item]) => {
      const formatted = formatInner(item, depth + 1, seen, maxDepth, maxItems, quoteStrings);
      return `${formatKey(key)}: ${formatted}`;
    });
    if (entries.length > maxItems) {
      shown.push(`… +${entries.length - maxItems} more`);
    }
    const className = classNameOf(value);
    const prefix = className ? `${className} ` : '';
    return `${prefix}{${shown.length ? ' ' + shown.join(', ') + ' ' : ''}}`;
  } finally {
    seen.delete(value);
  }
}

export function formatValue(value: any, options: FormatOptions = {}): string {
  const maxDepth = options.maxDepth ?? 4;
  const maxItems = options.maxItems ?? 50;
  const maxLength = options.maxLength ?? 1500;
  const quoteStrings = options.quoteStrings ?? true;
  let text: string;
  try {
    text = formatInner(value, 0, new WeakSet<object>(), maxDepth, maxItems, quoteStrings);
  } catch {
    try {
      text = String(value);
    } catch {
      text = '[Unformattable]';
    }
  }
  if (text.length > maxLength) {
    return `${text.slice(0, Math.max(0, maxLength - 1))}…`;
  }
  return text;
}

export function formatConsoleValue(value: any): string {
  if (typeof value === 'string') {
    return value.length > 3000 ? `${value.slice(0, 2999)}…` : value;
  }
  return formatValue(value, {
    maxDepth: 5,
    maxItems: 80,
    maxLength: 3000,
    quoteStrings: true,
  });
}

export function formatVariableValue(value: any): string {
  return formatValue(value, {
    maxDepth: 4,
    maxItems: 40,
    maxLength: 900,
    quoteStrings: true,
  });
}

export interface SnapshotOptions {
  maxDepth?: number;
  maxNodes?: number;
}

/** Deep-copies a variable value so each trace step keeps its own historical state. */
export function snapshotValue(value: any, options: SnapshotOptions = {}): any {
  const maxDepth = options.maxDepth ?? 18;
  const maxNodes = options.maxNodes ?? 20000;
  const seen = new WeakSet<object>();
  const budget = { nodes: 0 };

  const clone = (input: any, depth: number): any => {
    if (input === null || typeof input !== 'object') return input;
    if (typeof input === 'function') return input;

    budget.nodes++;
    if (budget.nodes > maxNodes) return '[Object too large]';
    if (depth > maxDepth) return Array.isArray(input) ? '[…]' : '{…}';
    if (seen.has(input)) return '[Circular]';

    if (input instanceof Date) return new Date(input.getTime());
    if (input instanceof RegExp) return new RegExp(input.source, input.flags);
    if (input instanceof Error) return { name: input.name, message: input.message };
    if (typeof ArrayBuffer !== 'undefined' && ArrayBuffer.isView(input)) {
      try {
        return (input as any).slice();
      } catch {
        return Array.from(input as unknown as ArrayLike<number>);
      }
    }

    seen.add(input);
    try {
      if (Array.isArray(input)) {
        const result: any[] = new Array(input.length);
        for (let i = 0; i < input.length; i++) {
          result[i] = i in input ? clone(input[i], depth + 1) : undefined;
        }
        return result;
      }

      if (input instanceof Map) {
        const result = new Map<any, any>();
        for (const [key, item] of input.entries()) {
          result.set(clone(key, depth + 1), clone(item, depth + 1));
        }
        return result;
      }

      if (input instanceof Set) {
        const result = new Set<any>();
        for (const item of input.values()) {
          result.add(clone(item, depth + 1));
        }
        return result;
      }

      if (typeof ArrayBuffer !== 'undefined' && input instanceof ArrayBuffer) {
        return `ArrayBuffer(${input.byteLength})`;
      }

      if (input instanceof WeakMap) return '[WeakMap]';
      if (input instanceof WeakSet) return '[WeakSet]';
      if (typeof Promise !== 'undefined' && input instanceof Promise) return '[Promise]';

      const result: Record<string, any> = {};
      for (const key of Object.keys(input)) {
        try {
          const descriptor = Object.getOwnPropertyDescriptor(input, key);
          if (!descriptor) continue;
          result[key] = 'value' in descriptor ? clone(descriptor.value, depth + 1) : '[Getter]';
        } catch {
          result[key] = '[Unreadable]';
        }
      }
      return result;
    } finally {
      seen.delete(input);
    }
  };

  try {
    return clone(value, 0);
  } catch {
    return '[Unsnapshotable]';
  }
}

/** UTF-8 byte size of the serialized live variable state. */
export function measureVariableSize(variables: VariableState[]): number {
  try {
    const json = JSON.stringify(variables, (_key, value) => {
      if (typeof value === 'function') {
        return `[Function ${value.name || 'anonymous'}]`;
      }
      if (typeof value === 'bigint') {
        return `${value.toString()}n`;
      }
      if (typeof value === 'undefined') {
        return '__undefined__';
      }
      if (value instanceof Map) {
        return { __type: 'Map', entries: Array.from(value.entries()) };
      }
      if (value instanceof Set) {
        return { __type: 'Set', values: Array.from(value.values()) };
      }
      if (value instanceof Error) {
        return { name: value.name, message: value.message };
      }
      return value;
    });
    if (typeof json !== 'string') return 0;
    return textEncoder ? textEncoder.encode(json).length : json.length;
  } catch {
    return 0;
  }
}
