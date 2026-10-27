import React from 'react';
import type { DataStructureView, TreeNodeSnapshot } from '../types';

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */

function preview(value: any): string {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (typeof value === 'function') return 'ƒ';
  try {
    const text = JSON.stringify(value);
    return text && text.length > 28 ? `${text.slice(0, 27)}…` : text ?? String(value);
  } catch {
    return String(value);
  }
}

const COLORS = {
  cell: 'var(--bg-elevated)',
  border: 'var(--border)',
  text: 'var(--text-body)',
  strong: 'var(--text-strong)',
  accent: 'var(--accent-strong)',
  pointer: 'var(--accent)',
  active: 'var(--yellow)',
  highlight: 'var(--bg-active)',
  land: 'var(--green-soft)',
  landText: 'var(--green)',
  water: 'var(--info-soft)',
  muted: 'var(--text-muted)',
  surface: 'var(--bg-inset)',
};

/* ------------------------------------------------------------------ */
/* array                                                               */
/* ------------------------------------------------------------------ */

const ArrayView: React.FC<Extract<DataStructureView, { kind: 'array' }>> = ({ values, pointers, highlights }) => {
  const pointerBuckets = new Map<number, string[]>();
  for (const [name, idx] of Object.entries(pointers || {})) {
    if (idx < 0 || idx >= values.length) continue;
    const list = pointerBuckets.get(idx) || [];
    list.push(name);
    pointerBuckets.set(idx, list);
  }
  const highlightsSet = new Set(highlights || []);

  return (
    <div style={{ overflowX: 'auto', paddingBottom: 6 }}>
      <div style={{ display: 'flex', gap: 4, minWidth: 'min-content', paddingTop: 22 }}>
        {values.map((value, idx) => {
          const labels = pointerBuckets.get(idx) || [];
          const active = highlightsSet.has(idx) || labels.length > 0;
          return (
            <div key={idx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 34 }}>
              <div style={{ height: 18, color: COLORS.pointer, fontSize: 10, fontWeight: 700, whiteSpace: 'nowrap' }}>
                {labels.length ? `${labels.join(',')}↓` : ''}
              </div>
              <div
                style={{
                  minWidth: 34,
                  padding: '7px 6px',
                  textAlign: 'center',
                  background: active ? COLORS.highlight : COLORS.cell,
                  border: `1px solid ${active ? COLORS.pointer : COLORS.border}`,
                  borderRadius: 4,
                  color: active ? COLORS.strong : COLORS.text,
                  fontSize: 12,
                  fontFamily: 'monospace',
                  transition: 'all 120ms ease',
                }}
                title={preview(value)}
              >
                {preview(value)}
              </div>
              <div style={{ color: COLORS.muted, fontSize: 9, marginTop: 2 }}>{idx}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* matrix                                                              */
/* ------------------------------------------------------------------ */

const MatrixView: React.FC<Extract<DataStructureView, { kind: 'matrix' }>> = ({
  values,
  pointers,
  pointerLabels,
}) => {
  const activeCells = new Set<string>();
  for (const [, pos] of Object.entries(pointerLabels || {})) {
    if (Array.isArray(pos)) activeCells.add(`${pos[0]},${pos[1]}`);
  }
  const rowPointer = pointers?.i ?? pointers?.r ?? pointers?.row;
  const colPointer = pointers?.j ?? pointers?.c ?? pointers?.col;
  if (rowPointer !== undefined && colPointer !== undefined) {
    activeCells.add(`${rowPointer},${colPointer}`);
  }

  return (
    <div style={{ overflowX: 'auto', paddingBottom: 6 }}>
      <table style={{ borderCollapse: 'separate', borderSpacing: 3 }}>
        <thead>
          <tr>
            <th />
            {values[0]?.map((_, c) => (
              <th key={c} style={{ color: COLORS.muted, fontSize: 9, fontWeight: 400, paddingBottom: 2 }}>
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {values.map((row, r) => (
            <tr key={r}>
              <td style={{ color: COLORS.muted, fontSize: 9, textAlign: 'right', paddingRight: 4 }}>{r}</td>
              {row.map((cell, c) => {
                const active = activeCells.has(`${r},${c}`);
                const land = cell === '1' || cell === 1 || cell === true;
                return (
                  <td
                    key={c}
                    style={{
                      minWidth: 30,
                      height: 30,
                      textAlign: 'center',
                      fontSize: 11,
                      fontFamily: 'monospace',
                      borderRadius: 3,
                      border: `1px solid ${active ? COLORS.active : COLORS.border}`,
                      outline: active ? `2px solid ${COLORS.active}` : 'none',
                      background: active ? COLORS.highlight : land ? COLORS.land : COLORS.cell,
                      color: land ? COLORS.landText : COLORS.text,
                      transition: 'all 120ms ease',
                    }}
                    title={`[${r}][${c}] = ${preview(cell)}`}
                  >
                    {preview(cell)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      {activeCells.size > 0 && (
        <div style={{ color: COLORS.active, fontSize: 10, marginTop: 4 }}>
          active cell: {Array.from(activeCells).join(' · ')}
        </div>
      )}
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* tree                                                                */
/* ------------------------------------------------------------------ */

interface PositionedNode {
  val: any;
  x: number;
  y: number;
  id: string;
}

function layoutTree(root: TreeNodeSnapshot | null): {
  nodes: PositionedNode[];
  edges: Array<{ from: PositionedNode; to: PositionedNode }>;
  width: number;
  height: number;
} {
  const nodes: PositionedNode[] = [];
  const edges: Array<{ from: PositionedNode; to: PositionedNode }> = [];
  let cursor = 0;

  const walk = (node: TreeNodeSnapshot | null, depth: number): PositionedNode | null => {
    if (!node) return null;
    const left = walk(node.left || null, depth + 1);
    const current: PositionedNode = {
      val: node.val,
      x: cursor++,
      y: depth,
      id: `${depth}-${cursor}`,
    };
    nodes.push(current);
    if (left) edges.push({ from: current, to: left });
    const right = walk(node.right || null, depth + 1);
    if (right) edges.push({ from: current, to: right });
    return current;
  };

  walk(root, 0);
  const maxDepth = nodes.reduce((acc, n) => Math.max(acc, n.y), 0);
  const columnWidth = 46;
  const rowHeight = 62;
  const width = Math.max(120, nodes.length * columnWidth);
  const height = Math.max(80, (maxDepth + 1) * rowHeight);
  return { nodes, edges, width, height };
}

const TreeView: React.FC<Extract<DataStructureView, { kind: 'tree' }>> = ({ root }) => {
  if (!root) {
    return <div style={{ color: COLORS.muted, fontSize: 12, padding: 12 }}>root is null</div>;
  }
  const layout = layoutTree(root);
  const x = (n: PositionedNode) => 30 + n.x * 46;
  const y = (n: PositionedNode) => 28 + n.y * 62;

  return (
    <div style={{ overflowX: 'auto' }}>
      <svg width={layout.width + 20} height={layout.height + 10} role='img' aria-label='binary tree'>
        {layout.edges.map((edge, i) => (
          <line
            key={i}
            x1={x(edge.from)}
            y1={y(edge.from)}
            x2={x(edge.to)}
            y2={y(edge.to)}
            style={{ stroke: 'var(--border-strong)' }}
            strokeWidth={1.5}
          />
        ))}
        {layout.nodes.map((node, i) => (
          <g key={i}>
            <circle
              cx={x(node)}
              cy={y(node)}
              r={16}
              style={{ fill: 'var(--bg-elevated)', stroke: 'var(--accent)' }}
              strokeWidth={1.5}
            />
            <text
              x={x(node)}
              y={y(node) + 4}
              textAnchor='middle'
              style={{ fill: 'var(--text-strong)' }}
              fontSize={11}
              fontFamily='monospace'
            >
              {preview(node.val)}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* linked list                                                         */
/* ------------------------------------------------------------------ */

const ListView: React.FC<Extract<DataStructureView, { kind: 'list' }>> = ({ nodes, pointers }) => {
  const labelsByIndex = new Map<number, string[]>();
  for (const [name, idx] of Object.entries(pointers || {})) {
    const list = labelsByIndex.get(idx) || [];
    list.push(name);
    labelsByIndex.set(idx, list);
  }
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 0, overflowX: 'auto', padding: '20px 4px 6px' }}>
      {nodes.map((node, idx) => {
        const labels = labelsByIndex.get(idx) || [];
        return (
          <React.Fragment key={idx}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{ height: 16, color: COLORS.pointer, fontSize: 10, fontWeight: 700 }}>
                {labels.length ? labels.join(',') : ''}
              </div>
              <div
                style={{
                  minWidth: 42,
                  padding: '7px 9px',
                  borderRadius: 4,
                  background: labels.length ? COLORS.highlight : COLORS.cell,
                  border: `1px solid ${labels.length ? COLORS.pointer : COLORS.border}`,
                  color: COLORS.strong,
                  fontFamily: 'monospace',
                  fontSize: 12,
                  textAlign: 'center',
                }}
              >
                {preview(node.val)}
              </div>
            </div>
            {idx < nodes.length - 1 && (
              <div style={{ color: COLORS.muted, alignSelf: 'flex-end', padding: '0 4px 10px', fontSize: 14 }}>→</div>
            )}
          </React.Fragment>
        );
      })}
      <div style={{ color: COLORS.muted, alignSelf: 'flex-end', padding: '0 0 10px 6px', fontSize: 11 }}>null</div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* graph                                                               */
/* ------------------------------------------------------------------ */

const GraphView: React.FC<Extract<DataStructureView, { kind: 'graph' }>> = ({ nodes, edges, visited }) => {
  const visitedSet = new Set(visited || []);
  const radius = Math.max(80, Math.min(180, nodes.length * 22));
  const centerX = radius + 40;
  const centerY = radius + 30;
  const positions = new Map<string, { x: number; y: number }>();
  nodes.forEach((node, idx) => {
    const angle = (idx / Math.max(1, nodes.length)) * Math.PI * 2 - Math.PI / 2;
    positions.set(node, {
      x: centerX + radius * Math.cos(angle),
      y: centerY + radius * Math.sin(angle),
    });
  });

  return (
    <div style={{ overflowX: 'auto' }}>
      <svg width={centerX * 2} height={centerY * 2} role='img' aria-label='graph'>
        {edges.map((edge, i) => {
          const a = positions.get(edge[0]);
          const b = positions.get(edge[1]);
          if (!a || !b) return null;
          return (
            <line
              key={i}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              style={{ stroke: 'var(--border-strong)' }}
              strokeWidth={1.2}
            />
          );
        })}
        {nodes.map((node) => {
          const pos = positions.get(node);
          if (!pos) return null;
          const isVisited = visitedSet.has(node);
          return (
            <g key={node}>
              <circle
                cx={pos.x}
                cy={pos.y}
                r={15}
                style={{
                  fill: isVisited ? 'var(--bg-active)' : 'var(--bg-elevated)',
                  stroke: isVisited ? 'var(--accent)' : 'var(--border-strong)',
                }}
                strokeWidth={1.5}
              />
              <text
                x={pos.x}
                y={pos.y + 4}
                textAnchor='middle'
                style={{ fill: 'var(--text-strong)' }}
                fontSize={10}
                fontFamily='monospace'
              >
                {node.length > 4 ? `${node.slice(0, 3)}…` : node}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* map / set / stack / queue                                           */
/* ------------------------------------------------------------------ */

const MapView: React.FC<Extract<DataStructureView, { kind: 'map' }>> = ({ entries }) => {
  if (!entries.length) return <div style={{ color: COLORS.muted, fontSize: 12, padding: 10 }}>empty map</div>;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 260, overflow: 'auto' }}>
      {entries.map((entry, idx) => (
        <div
          key={`${entry.key}-${idx}`}
          style={{
            display: 'flex',
            alignItems: 'center',
            background: COLORS.cell,
            border: `1px solid ${COLORS.border}`,
            borderRadius: 4,
            overflow: 'hidden',
            fontSize: 12,
          }}
        >
          <div
            style={{
              padding: '6px 10px',
              minWidth: 70,
              color: 'var(--info)',
              fontFamily: 'monospace',
              borderRight: `1px solid ${COLORS.border}`,
              background: COLORS.surface,
            }}
          >
            {entry.key}
          </div>
          <div style={{ padding: '6px 10px', color: 'var(--orange)', fontFamily: 'monospace', wordBreak: 'break-all' }}>
            {entry.value}
          </div>
        </div>
      ))}
    </div>
  );
};

const SetView: React.FC<Extract<DataStructureView, { kind: 'set' }>> = ({ values }) => {
  if (!values.length) return <div style={{ color: COLORS.muted, fontSize: 12, padding: 10 }}>empty set</div>;
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {values.map((value, idx) => (
        <span
          key={`${value}-${idx}`}
          style={{
            padding: '4px 9px',
            background: COLORS.cell,
            border: `1px solid ${COLORS.border}`,
            borderRadius: 999,
            color: 'var(--info)',
            fontSize: 12,
            fontFamily: 'monospace',
          }}
        >
          {value}
        </span>
      ))}
    </div>
  );
};

const StackQueueView: React.FC<Extract<DataStructureView, { kind: 'stack' | 'queue' }>> = ({
  kind,
  values,
}) => {
  const isStack = kind === 'stack';
  const ordered = values;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-start' }}>
      {ordered.length === 0 && <div style={{ color: COLORS.muted, fontSize: 12 }}>empty {kind}</div>}
      {ordered.map((value, idx) => {
        const isFront = idx === 0;
        const isTop = idx === ordered.length - 1;
        const active = isStack ? isTop : isFront;
        return (
          <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div
              style={{
                minWidth: 54,
                padding: '5px 10px',
                textAlign: 'center',
                background: active ? COLORS.highlight : COLORS.cell,
                border: `1px solid ${active ? COLORS.pointer : COLORS.border}`,
                borderRadius: 4,
                color: COLORS.strong,
                fontFamily: 'monospace',
                fontSize: 12,
              }}
            >
              {preview(value)}
            </div>
            {active && (
              <span style={{ color: COLORS.pointer, fontSize: 10, fontWeight: 700 }}>
                {isStack ? '← top' : '← front'}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* dispatcher                                                          */
/* ------------------------------------------------------------------ */

function kindLabel(kind: DataStructureView['kind']): string {
  switch (kind) {
    case 'array':
      return 'Array';
    case 'matrix':
      return 'Matrix';
    case 'tree':
      return 'Binary Tree';
    case 'list':
      return 'Linked List';
    case 'graph':
      return 'Graph';
    case 'map':
      return 'Hash Map';
    case 'set':
      return 'Set';
    case 'stack':
      return 'Stack';
    case 'queue':
      return 'Queue';
    default:
      return kind;
  }
}

function renderView(view: DataStructureView) {
  switch (view.kind) {
    case 'array':
      return <ArrayView {...view} />;
    case 'matrix':
      return <MatrixView {...view} />;
    case 'tree':
      return <TreeView {...view} />;
    case 'list':
      return <ListView {...view} />;
    case 'graph':
      return <GraphView {...view} />;
    case 'map':
      return <MapView {...view} />;
    case 'set':
      return <SetView {...view} />;
    case 'stack':
    case 'queue':
      return <StackQueueView {...view} />;
    default:
      return null;
  }
}

interface DataStructureVisualizerProps {
  structures: DataStructureView[];
  compact?: boolean;
}

export const DataStructureVisualizer: React.FC<DataStructureVisualizerProps> = ({ structures, compact }) => {
  const [selected, setSelected] = React.useState(0);

  if (!structures.length) {
    return (
      <div
        style={{
          border: `1px dashed ${COLORS.border}`,
          borderRadius: 8,
          padding: 18,
          color: COLORS.muted,
          fontSize: 12,
          textAlign: 'center',
          background: 'var(--grain)',
        }}
      >
        No live data structure detected at this step.
        <div style={{ fontSize: 11, marginTop: 6 }}>
          Arrays, matrices, trees, linked lists, maps, sets, stacks and queues are detected automatically.
        </div>
      </div>
    );
  }

  const index = selected < structures.length ? selected : 0;
  const view = structures[index];

  return (
    <div>
      {structures.length > 1 && (
        <div style={{ display: 'flex', gap: 4, marginBottom: 8, flexWrap: 'wrap' }}>
          {structures.map((entry, idx) => (
            <button
              key={`${entry.kind}-${entry.name}`}
              type='button'
              onClick={() => setSelected(idx)}
              style={{
                padding: '3px 9px',
                fontSize: 10,
                borderRadius: 999,
                cursor: 'pointer',
                border: `1px solid ${idx === index ? COLORS.pointer : COLORS.border}`,
                background: idx === index ? COLORS.highlight : 'transparent',
                color: idx === index ? COLORS.strong : COLORS.muted,
              }}
            >
              {entry.name}
            </button>
          ))}
        </div>
      )}

      <div
        style={{
          background: COLORS.surface,
          border: `1px solid ${COLORS.border}`,
          borderRadius: 8,
          padding: 10,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
          <div style={{ color: COLORS.strong, fontSize: 12, fontWeight: 700 }}>
            {view.name}
            <span style={{ color: COLORS.muted, fontWeight: 400, fontSize: 10, marginLeft: 6 }}>
              {kindLabel(view.kind)}
            </span>
          </div>
          {!compact && view.note && (
            <div style={{ color: COLORS.muted, fontSize: 10, textAlign: 'right', flex: 1 }}>{view.note}</div>
          )}
        </div>
        {renderView(view)}
      </div>
    </div>
  );
};

export default DataStructureVisualizer;
