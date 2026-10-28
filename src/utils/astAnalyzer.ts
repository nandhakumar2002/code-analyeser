import * as parser from '@babel/parser';
import traverse from '@babel/traverse';
import type {
  ASTNodeInfo,
  ComplexityInfo,
  DataStructureView,
  ExecutionMetrics,
  ExecutionStep,
  LineMetric,
  PatternInfo,
} from '../types';
import { buildInputStructures, buildResultStructures, inferStructuresFromOutputs, mergeStructures } from './structureBuilder';

/* ------------------------------------------------------------------ */
/* AST collection                                                      */
/* ------------------------------------------------------------------ */

interface LoopInfo {
  line: number;
  depth: number;
  type: string;
  condition?: string;
}

interface FnInfo {
  name: string;
  line: number;
  paramCount: number;
  recursiveCalls: number;
  calls: Set<string>;
  hasMemo: boolean;
  halving: boolean;
  lineStart: number;
  lineEnd: number;
}

interface AnalysisFacts {
  loops: LoopInfo[];
  maxLoopDepth: number;
  functions: FnInfo[];
  hasSort: boolean;
  hasMap: boolean;
  hasSet: boolean;
  arrayAllocations: number;
  matrixAllocations: number;
  objectAllocations: number;
  hasBinarySearch: boolean;
  hasTwoPointers: boolean;
  hasSlidingWindow: boolean;
  hasQueue: boolean;
  hasStack: boolean;
  hasVisited: boolean;
  hasDpIdentifier: boolean;
  hasMemo: boolean;
  hasBacktracking: boolean;
  hasSwap: boolean;
  hasGridTraversal: boolean;
  hasDivideConquer: boolean;
  hasGraphRefs: boolean;
  hasTreeRefs: boolean;
  hasGridRefs: boolean;
  identifiers: Set<string>;
  astNodes: ASTNodeInfo[];
}

function parseJS(code: string) {
  return parser.parse(code, {
    sourceType: 'module',
    allowReturnOutsideFunction: true,
    errorRecovery: true,
    plugins: ['typescript', 'jsx'] as any,
  });
}

function collectFacts(ast: any): AnalysisFacts {
  const facts: AnalysisFacts = {
    loops: [],
    maxLoopDepth: 0,
    functions: [],
    hasSort: false,
    hasMap: false,
    hasSet: false,
    arrayAllocations: 0,
    matrixAllocations: 0,
    objectAllocations: 0,
    hasBinarySearch: false,
    hasTwoPointers: false,
    hasSlidingWindow: false,
    hasQueue: false,
    hasStack: false,
    hasVisited: false,
    hasDpIdentifier: false,
    hasMemo: false,
    hasBacktracking: false,
    hasSwap: false,
    hasGridTraversal: false,
    hasDivideConquer: false,
    hasGraphRefs: false,
    hasTreeRefs: false,
    hasGridRefs: false,
    identifiers: new Set(),
    astNodes: [],
  };

  let loopDepth = 0;
  let currentFn: FnInfo | null = null;
  const fnStack: FnInfo[] = [];

  const pushNode = (type: string, category: ASTNodeInfo['category'], node: any, details: string, depth?: number) => {
    if (facts.astNodes.length >= 250) return;
    facts.astNodes.push({
      type,
      category,
      line: node.loc?.start.line ?? 0,
      details,
      depth,
    });
  };

  traverse(ast, {
    Identifier(path: any) {
      facts.identifiers.add(path.node.name);
    },
    FunctionDeclaration(path: any) {
      if (!path.node.id) return;
      const fn: FnInfo = {
        name: path.node.id.name,
        line: path.node.loc?.start.line ?? 0,
        paramCount: path.node.params.length,
        recursiveCalls: 0,
        calls: new Set(),
        hasMemo: false,
        halving: false,
        lineStart: path.node.loc?.start.line ?? 0,
        lineEnd: path.node.loc?.end.line ?? 0,
      };
      facts.functions.push(fn);
      pushNode('FunctionDeclaration', 'function', path.node, `${fn.name}(${path.node.params.length} params)`);
    },
    VariableDeclarator(path: any) {
      const init = path.node.init;
      if (!init) return;
      if (init.type === 'ArrowFunctionExpression' || init.type === 'FunctionExpression') {
        if (path.node.id?.type === 'Identifier') {
          facts.functions.push({
            name: path.node.id.name,
            line: path.node.loc?.start.line ?? 0,
            paramCount: init.params.length,
            recursiveCalls: 0,
            calls: new Set(),
            hasMemo: false,
            halving: false,
            lineStart: path.node.loc?.start.line ?? 0,
            lineEnd: path.node.loc?.end.line ?? 0,
          });
        }
      }
      if (init.type === 'ArrayExpression') {
        facts.arrayAllocations++;
        const isMatrix = init.elements.some(
          (el: any) => el && el.type === 'ArrayExpression',
        );
        if (isMatrix) facts.matrixAllocations++;
        pushNode('ArrayExpression', 'declaration', path.node, 'Array allocation — O(n) space', loopDepth);
      }
      if (init.type === 'ObjectExpression') {
        facts.objectAllocations++;
        pushNode('ObjectExpression', 'declaration', path.node, 'Object allocation — O(n) space', loopDepth);
      }
      if (init.type === 'NewExpression' && init.callee?.type === 'Identifier') {
        const name = init.callee.name;
        if (name === 'Array') facts.arrayAllocations++;
        if (name === 'Map') facts.hasMap = true;
        if (name === 'Set') facts.hasSet = true;
      }
    },
    AssignmentExpression(path: any) {
      if (path.node.left?.type === 'MemberExpression') {
        const objectName = path.node.left.object?.name;
        if (objectName === 'dp' || objectName === 'memo' || objectName === 'cache') {
          facts.hasMemo = true;
        }
      }
    },
    CallExpression(path: any) {
      const callee = path.node.callee;
      if (callee?.type === 'Identifier') {
        const name = callee.name;
        if (currentFn) {
          const fn: FnInfo = currentFn;
          fn.calls.add(name);
          if (name === fn.name) fn.recursiveCalls++;
          fnStack.forEach((f) => {
            if (f.name === name && f !== fn) {
              fn.calls.add(name);
            }
          });
        }
      }
      if (callee?.type === 'MemberExpression') {
        const method = callee.property?.name;
        const objectName = callee.object?.name;
        if (method === 'sort') facts.hasSort = true;
        if (method === 'push' && (objectName === 'queue' || objectName === 'q')) facts.hasQueue = true;
        if (method === 'shift' && (objectName === 'queue' || objectName === 'q')) facts.hasQueue = true;
        if (method === 'push' && (objectName === 'stack' || objectName === 'st')) facts.hasStack = true;
        if (method === 'pop' && (objectName === 'stack' || objectName === 'st')) facts.hasStack = true;
        if (method === 'push' && objectName === 'path') facts.hasBacktracking = true;
        if (method === 'pop' && objectName === 'path') facts.hasBacktracking = true;
        if (method === 'has' || method === 'get' || method === 'set') {
          facts.hasMap = facts.hasMap || false;
        }
      }
      if (callee?.type === 'Identifier' && (callee.name === 'swap')) facts.hasSwap = true;
    },
    Function: {
      enter(path: any) {
        const node = path.node;
        const name = node.id?.name || 'anonymous';
        let info = facts.functions.find((f) => f.name === name && f.line === (node.loc?.start.line ?? 0));
        if (!info) {
          info = {
            name,
            line: node.loc?.start.line ?? 0,
            paramCount: node.params.length,
            recursiveCalls: 0,
            calls: new Set(),
            hasMemo: false,
            halving: false,
            lineStart: node.loc?.start.line ?? 0,
            lineEnd: node.loc?.end.line ?? 0,
          };
          if (name !== 'anonymous') facts.functions.push(info);
        }
        fnStack.push(info);
        currentFn = info;
      },
      exit() {
        fnStack.pop();
        currentFn = fnStack[fnStack.length - 1] || null;
      },
    },
    ForStatement: {
      enter(path: any) {
        loopDepth++;
        facts.maxLoopDepth = Math.max(facts.maxLoopDepth, loopDepth);
        facts.loops.push({
          line: path.node.loc?.start.line ?? 0,
          depth: loopDepth,
          type: 'for',
          condition: sliceCode(path, path.node.test),
        });
        pushNode('ForStatement', 'loop', path.node, `for loop — nesting depth ${loopDepth}`, loopDepth);
      },
      exit() {
        loopDepth = Math.max(0, loopDepth - 1);
      },
    },
    WhileStatement: {
      enter(path: any) {
        loopDepth++;
        facts.maxLoopDepth = Math.max(facts.maxLoopDepth, loopDepth);
        facts.loops.push({
          line: path.node.loc?.start.line ?? 0,
          depth: loopDepth,
          type: 'while',
          condition: sliceCode(path, path.node.test),
        });
        pushNode('WhileStatement', 'loop', path.node, `while loop — nesting depth ${loopDepth}`, loopDepth);
      },
      exit() {
        loopDepth = Math.max(0, loopDepth - 1);
      },
    },
    DoWhileStatement: {
      enter(path: any) {
        loopDepth++;
        facts.maxLoopDepth = Math.max(facts.maxLoopDepth, loopDepth);
        facts.loops.push({
          line: path.node.loc?.start.line ?? 0,
          depth: loopDepth,
          type: 'do-while',
          condition: sliceCode(path, path.node.test),
        });
        pushNode('DoWhileStatement', 'loop', path.node, `do/while loop — nesting depth ${loopDepth}`, loopDepth);
      },
      exit() {
        loopDepth = Math.max(0, loopDepth - 1);
      },
    },
    ForOfStatement: {
      enter(path: any) {
        loopDepth++;
        facts.maxLoopDepth = Math.max(facts.maxLoopDepth, loopDepth);
        facts.loops.push({
          line: path.node.loc?.start.line ?? 0,
          depth: loopDepth,
          type: 'for-of',
          condition: sliceCode(path, path.node.right),
        });
        pushNode('ForOfStatement', 'loop', path.node, `for…of loop — nesting depth ${loopDepth}`, loopDepth);
      },
      exit() {
        loopDepth = Math.max(0, loopDepth - 1);
      },
    },
    ForInStatement: {
      enter(path: any) {
        loopDepth++;
        facts.maxLoopDepth = Math.max(facts.maxLoopDepth, loopDepth);
        facts.loops.push({
          line: path.node.loc?.start.line ?? 0,
          depth: loopDepth,
          type: 'for-in',
          condition: sliceCode(path, path.node.right),
        });
        pushNode('ForInStatement', 'loop', path.node, `for…in loop — nesting depth ${loopDepth}`, loopDepth);
      },
      exit() {
        loopDepth = Math.max(0, loopDepth - 1);
      },
    },
    IfStatement(path: any) {
      pushNode('IfStatement', 'conditional', path.node, 'Conditional branch — O(1)');
    },
    SwitchStatement(path: any) {
      pushNode('SwitchStatement', 'conditional', path.node, 'Switch branch — O(k)');
    },
    VariableDeclaration(path: any) {
      pushNode('VariableDeclaration', 'declaration', path.node, `${path.node.kind} declaration`);
    },
    ReturnStatement(path: any) {
      pushNode('ReturnStatement', 'other', path.node, 'Returns control to the caller');
    },
  });

  // identifier-based signals
  const ids = facts.identifiers;
  facts.hasDpIdentifier = ['dp', 'memo', 'cache', 'table', 'memoize'].some((n) => ids.has(n));
  if (ids.has('dp')) facts.hasDpIdentifier = true;
  facts.hasVisited = ids.has('visited');
  facts.hasGraphRefs = ids.has('graph') || ids.has('adj') || ids.has('edges') || ids.has('neighbors');
  if (['queue', 'q', 'deque'].some((n) => ids.has(n))) facts.hasQueue = true;
  if (['stack', 'st', 'monoStack'].some((n) => ids.has(n))) facts.hasStack = true;

  const hasPairPointers =
    (ids.has('left') && ids.has('right')) || (ids.has('low') && ids.has('high')) || (ids.has('lo') && ids.has('hi'));
  const hasMid = ids.has('mid') || ids.has('middle');
  facts.hasTreeRefs =
    ids.has('root') ||
    ids.has('TreeNode') ||
    (ids.has('left') && ids.has('right') && (ids.has('val') || ids.has('node')));
  facts.hasGridRefs =
    ids.has('grid') || ids.has('board') || ids.has('matrix') || ids.has('rows') || ids.has('cols');
  facts.hasBinarySearch = hasMid && (ids.has('low') || ids.has('high') || ids.has('left') || ids.has('right'));
  facts.hasTwoPointers = hasPairPointers && !facts.hasBinarySearch && !facts.hasTreeRefs;
  facts.hasSlidingWindow =
    ids.has('window') || (ids.has('start') && ids.has('end')) || (ids.has('left') && ids.has('right') && ids.has('maxLen'));
  facts.hasGridTraversal = facts.loops.some((l) => l.depth >= 2) && facts.hasGridRefs;

  // recursion metadata
  for (const fn of facts.functions) {
    const body = fn.lineEnd - fn.lineStart;
    fn.hasMemo = fn.paramCount > 0 && facts.hasDpIdentifier;
    const callsSelf = fn.calls.has(fn.name);
    if (callsSelf) {
      fn.halving =
        ids.has('mid') ||
        ids.has('middle') ||
        ((fn.lineEnd - fn.lineStart) < 60 && /slice|substring|substr/.test('')) ||
        false;
      if (fn.recursiveCalls >= 2 && (ids.has('mid') || ids.has('middle'))) {
        facts.hasDivideConquer = true;
      }
      if (body > 0) {
        // no-op
      }
    }
  }

  return facts;
}

function sliceCode(path: any, node: any): string {
  if (!node) return '';
  try {
    const src = path.hub?.file?.code;
    if (typeof src === 'string' && node.start != null && node.end != null) {
      const text = src.slice(node.start, node.end).replace(/\s+/g, ' ').trim();
      return text.length > 50 ? `${text.slice(0, 49)}…` : text;
    }
  } catch {
    /* ignore */
  }
  return '';
}

/* ------------------------------------------------------------------ */
/* Complexity                                                          */
/* ------------------------------------------------------------------ */

function buildComplexity(facts: AnalysisFacts): ComplexityInfo {
  const timeJustification: string[] = [];
  const spaceJustification: string[] = [];

  const recursiveFns = facts.functions.filter((f) => f.calls.has(f.name));
  const branching = recursiveFns.length ? Math.max(...recursiveFns.map((f) => f.recursiveCalls)) : 0;
  const hasMemo = facts.hasDpIdentifier || facts.hasMemo;
  const hasHalving = facts.hasDivideConquer || facts.functions.some((f) => f.calls.has(f.name) && (facts.identifiers.has('mid') || facts.identifiers.has('middle')));
  const recursive = recursiveFns.length > 0;
  const isTreeRecursion = recursive && facts.hasTreeRefs && !facts.hasGridRefs;
  const isGridRecursion = recursive && facts.hasGridRefs && facts.maxLoopDepth >= 1;

  let timeClass: ComplexityInfo['timeClass'] = 'constant';
  let time = 'O(1)';

  if (recursive && !hasMemo) {
    if (branching >= 3 && (facts.hasSwap || facts.identifiers.has('permutations') || facts.identifiers.has('queens'))) {
      time = 'O(n!)';
      timeClass = 'factorial';
      timeJustification.push('Recursive branching with permutation/backtracking — factorial growth');
    } else if (isTreeRecursion) {
      time = 'O(n)';
      timeClass = 'linear';
      timeJustification.push('Tree recursion — every node is visited exactly once');
      if (branching > 1) {
        timeJustification.push(`Two recursive calls split the left and right subtrees (${branching} calls per node)`);
      }
    } else if (isGridRecursion) {
      time = 'O(m·n)';
      timeClass = 'quadratic';
      timeJustification.push('Grid DFS/flood fill — each cell is processed at most once');
      timeJustification.push('Every cell is checked by the outer loops and visited by the recursive walk');
    } else if (branching >= 2 && hasHalving) {
      time = 'O(n log n)';
      timeClass = 'linearithmic';
      timeJustification.push('Divide & conquer recursion (halving with two recursive calls) — O(n log n)');
    } else if (branching >= 2) {
      time = 'O(2^n)';
      timeClass = 'exponential';
      timeJustification.push(`Recursive function makes ${branching} recursive call(s) per level without memoization — exponential`);
    } else if (hasHalving) {
      time = 'O(log n)';
      timeClass = 'logarithmic';
      timeJustification.push('Single recursive call that halves the search space — logarithmic');
    } else {
      time = 'O(n)';
      timeClass = 'linear';
      timeJustification.push('Linear recursion — one recursive call per level');
    }
  } else if (recursive && hasMemo) {
    time = facts.maxLoopDepth >= 2 ? 'O(n²)' : 'O(n)';
    timeClass = facts.maxLoopDepth >= 2 ? 'quadratic' : 'linear';
    timeJustification.push('Recursion combined with memoization/DP table — each subproblem solved once');
  } else if (facts.hasBinarySearch && facts.maxLoopDepth <= 1) {
    time = 'O(log n)';
    timeClass = 'logarithmic';
    timeJustification.push('Binary search — search space halved every iteration (mid/low/high)');
  } else if (facts.maxLoopDepth === 0) {
    time = 'O(1)';
    timeClass = 'constant';
    timeJustification.push('No loops or recursion — constant time operations');
    if (facts.hasSort) {
      time = 'O(n log n)';
      timeClass = 'linearithmic';
      timeJustification.push('Built-in sort detected — O(n log n)');
    }
  } else if (facts.maxLoopDepth === 1) {
    time = 'O(n)';
    timeClass = 'linear';
    timeJustification.push(`Single loop level (${facts.loops.length} loop${facts.loops.length === 1 ? '' : 's'}) — linear time`);
    if (facts.hasSort) {
      time = 'O(n log n)';
      timeClass = 'linearithmic';
      timeJustification.push('Sorting inside the algorithm raises the bound to O(n log n)');
    }
  } else if (facts.maxLoopDepth === 2) {
    time = 'O(n²)';
    timeClass = 'quadratic';
    timeJustification.push('Two nested loop levels — quadratic time');
  } else if (facts.maxLoopDepth === 3) {
    time = 'O(n³)';
    timeClass = 'cubic';
    timeJustification.push('Three nested loop levels — cubic time');
  } else {
    time = `O(n^${facts.maxLoopDepth})`;
    timeClass = 'cubic';
    timeJustification.push(`${facts.maxLoopDepth} nested loop levels — polynomial time`);
  }

  if (facts.hasTwoPointers && !recursive && timeClass === 'constant') {
    time = 'O(n)';
    timeClass = 'linear';
    timeJustification.push('Two-pointer scan visits each element at most once');
  }

  for (const loop of facts.loops.slice(0, 12)) {
    timeJustification.push(`Line ${loop.line}: ${loop.type} loop at nesting depth ${loop.depth}${loop.condition ? ` (${loop.condition})` : ''}`);
  }
  for (const fn of recursiveFns.slice(0, 4)) {
    timeJustification.push(`Line ${fn.line}: ${fn.name}() calls itself ${fn.recursiveCalls}× per invocation`);
  }

  let spaceClass: ComplexityInfo['spaceClass'] = 'constant';
  let space = 'O(1)';

  if (facts.matrixAllocations > 0 || (facts.hasDpIdentifier && facts.maxLoopDepth >= 2)) {
    space = 'O(n²)';
    spaceClass = 'quadratic';
    spaceJustification.push('2D matrix / DP table allocation — quadratic auxiliary space');
  } else if (recursive) {
    space = hasHalving ? 'O(log n)' : 'O(n)';
    spaceClass = 'linear';
    spaceJustification.push(`Recursion call stack — ${hasHalving ? 'logarithmic depth (halving)' : 'up to linear depth'}`);
  }

  if (facts.arrayAllocations > 0 && spaceClass === 'constant') {
    space = 'O(n)';
    spaceClass = 'linear';
    spaceJustification.push(`${facts.arrayAllocations} array allocation(s) — linear auxiliary space`);
  }
  if (facts.objectAllocations > 0 && spaceClass === 'constant') {
    space = 'O(n)';
    spaceClass = 'linear';
    spaceJustification.push(`${facts.objectAllocations} object allocation(s) — linear auxiliary space`);
  }
  if ((facts.hasMap || facts.hasSet) && spaceClass === 'constant') {
    space = 'O(n)';
    spaceClass = 'linear';
    spaceJustification.push('Hash map / set grows with input — linear auxiliary space');
  }
  if (spaceClass === 'constant') {
    spaceJustification.push('Only primitive scalars — constant auxiliary space');
  }

  for (const node of facts.astNodes.filter((n) => n.category === 'declaration').slice(0, 8)) {
    if (/Array|Object/.test(node.type)) {
      spaceJustification.push(`Line ${node.line}: ${node.details}`);
    }
  }

  return { timeComplexity: time, timeJustification, spaceComplexity: space, spaceJustification, timeClass, spaceClass };
}

function dedupe(patterns: PatternInfo[]): PatternInfo[] {
  const map = new Map<string, PatternInfo>();
  for (const p of patterns) {
    const existing = map.get(p.pattern);
    if (!existing || existing.confidence < p.confidence) map.set(p.pattern, p);
  }
  return Array.from(map.values()).sort((a, b) => b.confidence - a.confidence);
}

function detectPatterns(facts: AnalysisFacts): PatternInfo[] {
  const patterns: PatternInfo[] = [];
  const ids = facts.identifiers;
  const recursiveFns = facts.functions.filter((f) => f.calls.has(f.name));

  if (facts.hasTwoPointers) {
    patterns.push({
      pattern: 'Two Pointers',
      confidence: 0.92,
      reason: 'Paired pointers (left/right or i/j) move toward or away from each other in a single pass',
    });
  }
  if (facts.hasSlidingWindow) {
    patterns.push({
      pattern: 'Sliding Window',
      confidence: 0.9,
      reason: 'A window is expanded and shrunk with start/end (or left/right) while tracking an aggregate',
    });
  }
  if (facts.hasBinarySearch) {
    patterns.push({
      pattern: 'Binary Search',
      confidence: 0.92,
      reason: 'Search space is halved using mid/low/high on a sorted range',
    });
  }
  if (facts.hasDpIdentifier) {
    patterns.push({
      pattern: 'Dynamic Programming / Memoization',
      confidence: 0.9,
      reason: 'dp / memo / cache table stores results of overlapping subproblems',
    });
  }
  if (facts.hasBacktracking || (recursiveFns.length > 0 && ids.has('path') && ids.has('result'))) {
    patterns.push({
      pattern: 'Backtracking',
      confidence: 0.85,
      reason: 'Recursive exploration with path push/pop (choose ? explore ? un-choose)',
    });
  }
  if (facts.hasQueue) {
    patterns.push({
      pattern: 'BFS (Queue)',
      confidence: 0.85,
      reason: 'FIFO queue drives level-by-level traversal',
    });
  }
  if (recursiveFns.length > 0 && (ids.has('visited') || facts.hasGraphRefs)) {
    patterns.push({
      pattern: 'DFS (Recursive)',
      confidence: 0.85,
      reason: 'Recursive descent with visited tracking over a graph/tree',
    });
  }
  if (recursiveFns.length > 0 && facts.hasTreeRefs && !facts.hasGridRefs) {
    patterns.push({
      pattern: 'Tree Traversal (Recursive)',
      confidence: 0.88,
      reason: 'Recursive descent over left/right child pointers visits every node once',
    });
  }
  if (ids.has('next') && (ids.has('prev') || ids.has('curr') || ids.has('cur') || ids.has('head'))) {
    patterns.push({
      pattern: 'Linked List Traversal',
      confidence: 0.85,
      reason: 'next/prev pointers walk the list node by node (optionally re-linking in place)',
    });
  }
  if (facts.hasStack) {
    patterns.push({
      pattern: 'Stack / Monotonic Stack',
      confidence: 0.8,
      reason: 'push/pop stack maintains order or a monotonic invariant',
    });
  }
  if (recursiveFns.length > 0 && (facts.hasDivideConquer || ids.has('merge'))) {
    patterns.push({
      pattern: 'Divide & Conquer',
      confidence: 0.85,
      reason: 'Splits the input, solves subproblems recursively, then combines',
    });
  }
  if (facts.hasGridTraversal) {
    patterns.push({
      pattern: 'Matrix / Grid Traversal',
      confidence: 0.8,
      reason: 'Nested loops over rows and columns with directional neighbours',
    });
  }
  if (facts.hasMap && !facts.hasDpIdentifier) {
    patterns.push({
      pattern: 'Hash Map Lookup',
      confidence: 0.8,
      reason: 'Map/object membership lookups give O(1) average access',
    });
  }
  if (facts.hasSet) {
    patterns.push({
      pattern: 'Hash Set Membership',
      confidence: 0.75,
      reason: 'Set is used for deduplication / visited tracking',
    });
  }
  if (facts.hasSort && facts.maxLoopDepth <= 1) {
    patterns.push({
      pattern: 'Sorting',
      confidence: 0.8,
      reason: 'Sorting dominates the runtime at O(n log n)',
    });
  }
  if (facts.hasSwap && facts.maxLoopDepth >= 1 && !facts.hasBacktracking) {
    patterns.push({
      pattern: 'In-place Swapping',
      confidence: 0.7,
      reason: 'Elements are swapped in place (reverse / partition / cyclic sort)',
    });
  }
  if (patterns.length === 0) {
    patterns.push({
      pattern: 'Linear Scan',
      confidence: 0.6,
      reason: 'Straightforward iteration without a specialised pattern',
    });
  }
  return dedupe(patterns);
}

/* ------------------------------------------------------------------ */
/* Heuristic analysis for non-JS languages                             */
/* ------------------------------------------------------------------ */

const FUNCTION_RE = /(?:def|function|fn|func)\s+([A-Za-z_$][\w$]*)/g;

export function analyzeHeuristic(code: string, language: string): {
  astNodes: ASTNodeInfo[];
  complexity: ComplexityInfo;
  patterns: PatternInfo[];
} {
  const lines = code.split('\n');
  const astNodes: ASTNodeInfo[] = [];

  const braceLanguage = ['javascript', 'typescript', 'java', 'cpp', 'c', 'go', 'rust'].includes(language);
  let braceDepth = 0;
  let maxDepth = 0;
  const loopStack: number[] = [];
  const loopLines: Array<{ line: number; depth: number }> = [];

  lines.forEach((line, idx) => {
    const trimmed = line.trim();
    if (
      !trimmed ||
      trimmed.startsWith('//') ||
      trimmed.startsWith('#') ||
      trimmed.startsWith('/*') ||
      trimmed.startsWith('*')
    ) {
      return;
    }

    const indent = (line.match(/^[ \t]*/)?.[0] || '').replace(/\t/g, '    ').length;
    const isLoop = /\b(for|while)\b/.test(trimmed);
    const isConditional = /\b(if|elif|else if|switch|match)\b/.test(trimmed);

    if (isLoop) {
      let depth: number;
      if (braceLanguage) {
        // A loop started at brace depth D owns its body at depth D+1, so a
        // loop seen at the same depth is a sibling and anything deeper nests.
        while (loopStack.length > 0 && loopStack[loopStack.length - 1] >= braceDepth) {
          loopStack.pop();
        }
        depth = loopStack.length + 1;
        loopStack.push(braceDepth);
      } else {
        // Python-style: nesting is indentation based.
        while (loopStack.length > 0 && loopStack[loopStack.length - 1] >= indent) {
          loopStack.pop();
        }
        depth = loopStack.length + 1;
        loopStack.push(indent);
      }
      maxDepth = Math.max(maxDepth, depth);
      loopLines.push({ line: idx + 1, depth });
      astNodes.push({
        type: language === 'python' ? 'for/while' : 'LoopStatement',
        category: 'loop',
        line: idx + 1,
        details: `${language} loop at nesting depth ${depth}`,
        depth,
      });
    } else if (isConditional) {
      astNodes.push({
        type: 'Conditional',
        category: 'conditional',
        line: idx + 1,
        details: 'Conditional branch',
        depth: loopStack.length,
      });
    }

    if (/^\s*(?:int|let|var|const|auto|val|mut|String|double|float|long|char|bool|list|dict|vector|map|HashMap)\b/.test(trimmed)) {
      astNodes.push({
        type: 'Declaration',
        category: 'declaration',
        line: idx + 1,
        details: 'Variable / collection declaration',
      });
    }
    const fnMatch = trimmed.match(/(?:def|function|fn|func|public|private|static).*\b([A-Za-z_$][\w$]*)\s*\(/);
    if (fnMatch && !/\b(if|for|while|switch|return|new)\b/.test(fnMatch[1])) {
      astNodes.push({
        type: 'Function',
        category: 'function',
        line: idx + 1,
        details: `Function ${fnMatch[1]}()`,
      });
    }

    if (braceLanguage) {
      const opens = (line.match(/\{/g) || []).length;
      const closes = (line.match(/\}/g) || []).length;
      braceDepth = Math.max(0, braceDepth + opens - closes);
    }
  });

  // recursion: function calls its own name inside its body
  const fnNames = Array.from(code.matchAll(FUNCTION_RE)).map((m) => m[1]);
  const recursive = fnNames.filter((name) => {
    const occurrences = code.split(new RegExp(`\\b${name}\\s*\\(`, 'g')).length - 1;
    return occurrences > 1;
  });

  const memoized = /\bmemo\b|lru_cache|@cache|memoize|memoization|\bdp\b/i.test(code);
  let time = 'O(1)';
  let timeClass: ComplexityInfo['timeClass'] = 'constant';
  const timeJustification: string[] = [];

  if (recursive.length > 0 && memoized) {
    time = 'O(n)';
    timeClass = 'linear';
    timeJustification.push(`Recursive function(s) with memoization: ${recursive.join(', ')}`);
  } else if (recursive.length > 0) {
    time = 'O(2^n)';
    timeClass = 'exponential';
    timeJustification.push(`Recursive function(s) detected: ${recursive.join(', ')}`);
  } else if (maxDepth === 0) {
    timeJustification.push('No loops detected — constant time');
  } else if (maxDepth === 1) {
    time = 'O(n)';
    timeClass = 'linear';
    timeJustification.push('Single loop level — linear time');
  } else if (maxDepth === 2) {
    time = 'O(n²)';
    timeClass = 'quadratic';
    timeJustification.push('Nested loops — quadratic time');
  } else {
    time = `O(n^${maxDepth})`;
    timeClass = 'cubic';
    timeJustification.push(`${maxDepth} nested loop levels`);
  }
  for (const loop of loopLines.slice(0, 12)) {
    timeJustification.push(`Line ${loop.line}: loop nesting depth ${loop.depth}`);
  }

  const spaceJustification: string[] = [];
  let space = 'O(1)';
  let spaceClass: ComplexityInfo['spaceClass'] = 'constant';
  if (recursive.length > 0) {
    space = 'O(n)';
    spaceClass = 'linear';
    spaceJustification.push('Recursion stack usage');
  } else if (/new\s+\w+\[|\[\]|Array|vector<|HashMap|Map<|Set<|dict\(|list\(/.test(code)) {
    space = 'O(n)';
    spaceClass = 'linear';
    spaceJustification.push('Auxiliary collections detected');
  } else {
    spaceJustification.push('Only scalars — constant auxiliary space');
  }

  const patterns: PatternInfo[] = [];
  const has = (re: RegExp) => re.test(code);
  if (recursive.length > 0 && /visited/.test(code)) {
    patterns.push({ pattern: 'DFS (Recursive)', confidence: 0.85, reason: 'Recursion with visited tracking' });
  }
  if (has(/queue|Queue|deque|LinkedList/)) {
    patterns.push({ pattern: 'BFS (Queue)', confidence: 0.8, reason: 'Queue-based traversal detected' });
  }
  if (has(/left\s*[<>=].*right|right\s*[<>=].*left/i)) {
    patterns.push({ pattern: 'Two Pointers', confidence: 0.85, reason: 'Converging left/right pointers' });
  }
  if (has(/\bmid\b/)) {
    patterns.push({ pattern: 'Binary Search', confidence: 0.85, reason: 'mid index with halving search space' });
  }
  if (has(/\bdp\b|\bmemo\b|lru_cache|memoize|memoization|@cache/i)) {
    patterns.push({ pattern: 'Dynamic Programming / Memoization', confidence: 0.85, reason: 'dp/memo table detected' });
  }
  if (recursive.length > 0 && !patterns.some((p) => p.pattern.startsWith('DFS'))) {
    patterns.push({
      pattern: 'Recursion',
      confidence: 0.8,
      reason: `Function(s) call themselves: ${recursive.join(', ')}`,
    });
  }
  if (has(/backtrack|permut/i)) {
    patterns.push({ pattern: 'Backtracking', confidence: 0.8, reason: 'Backtracking search detected' });
  }
  if (has(/stack|Stack/)) {
    patterns.push({ pattern: 'Stack / Monotonic Stack', confidence: 0.7, reason: 'Stack operations detected' });
  }
  if (patterns.length === 0) {
    patterns.push({ pattern: 'Linear Scan', confidence: 0.6, reason: 'Basic iteration' });
  }

  return {
    astNodes: astNodes.slice(0, 200),
    complexity: { timeComplexity: time, timeJustification, spaceComplexity: space, spaceJustification, timeClass, spaceClass },
    patterns,
  };
}

/* ------------------------------------------------------------------ */
/* Public API                                                          */
/* ------------------------------------------------------------------ */

export function analyzeAST(code: string, language: string = 'javascript'): {
  astNodes: ASTNodeInfo[];
  complexity: ComplexityInfo;
  patterns: PatternInfo[];
} {
  if (language !== 'javascript' && language !== 'typescript') {
    return analyzeHeuristic(code, language);
  }
  try {
    const ast = parseJS(code);
    const facts = collectFacts(ast);
    return {
      astNodes: facts.astNodes,
      complexity: buildComplexity(facts),
      patterns: detectPatterns(facts),
    };
  } catch (e) {
    console.warn('AST parse error, falling back to heuristics:', e instanceof Error ? e.message : e);
    return analyzeHeuristic(code, language);
  }
}

export interface GeneratedTrace {
  steps: ExecutionStep[];
  metrics: ExecutionMetrics;
  lineMetrics: LineMetric[];
  error?: string;
  errorLine?: number;
  outputs?: string[];
  returnValue?: import('../types').VariableState | null;
  entryPoint?: string;
  truncated?: boolean;
  outputOnly?: boolean;
  astNodes?: ASTNodeInfo[];
  finalStructures?: DataStructureView[];
  inputStructures?: DataStructureView[];
}

export async function generateTrace(
  code: string,
  testInput?: string,
  language: string = 'javascript',
): Promise<GeneratedTrace> {
  const start = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const lines = code.split('\n');

  let parsedInput: any = undefined;
  if (testInput && testInput.trim()) {
    try {
      parsedInput = JSON.parse(testInput);
    } catch {
      parsedInput = testInput;
    }
  }

  if (language === 'javascript' || language === 'typescript') {
    const { traceJavaScript } = await import('./jsInterpreter');
    const result = traceJavaScript({
      code,
      input: parsedInput,
      language: language as 'javascript' | 'typescript',
      options: { maxSteps: 20000, timeoutMs: 5000, maxDepth: 250 },
    });

    const elapsed = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - start;
    const lineMetrics = completeLineMetrics(result.lineMetrics, lines);

    const storageBytes = lineMetrics.reduce((acc, lm) => Math.max(acc, lm.storageSizeBytes), 0);

    const metrics: ExecutionMetrics = {
      executionTimeMs: Math.max(1, Math.round(elapsed)),
      executionTimeSec: Number((elapsed / 1000).toFixed(6)),
      storageSizeBytes: storageBytes,
      storageSizeKB: Number((storageBytes / 1024).toFixed(4)),
      totalSteps: result.steps.length,
      executedLines: result.executedLines,
      totalLines: lines.filter((l) => l.trim()).length,
      functionCalls: result.functionCalls,
      peakCallDepth: result.peakCallDepth,
      iterations: result.iterations,
    };

    const inputStructures = buildInputStructures(parsedInput);
    const lastStep = result.steps[result.steps.length - 1];
    const lastStepStructures = lastStep?.dataStructures ?? (lastStep?.dataStructure ? [lastStep.dataStructure] : []);
    const resultStructures = result.returnValue
      ? buildResultStructures(result.returnValue.value, 'return')
      : [];
    const outputStructures = inferStructuresFromOutputs(result.outputs || []);
    const finalStructures = mergeStructures(resultStructures, outputStructures, lastStepStructures);

    return {
      steps: result.steps,
      metrics,
      lineMetrics,
      error: result.error,
      errorLine: result.errorLine,
      outputs: result.outputs,
      returnValue: result.returnValue,
      entryPoint: result.entryPoint,
      truncated: result.truncated,
      finalStructures,
      inputStructures,
    };
  }

  const inputStructures = buildInputStructures(parsedInput);
  const stdin =
    typeof parsedInput === 'string'
      ? parsedInput
      : parsedInput === undefined
        ? ''
        : JSON.stringify(parsedInput);

  // Python gets a real `sys.settrace` trace (steps, variables, structures, logs).
  if (language === 'python') {
    try {
      const { tracePython } = await import('./pythonTracer');
      const outcome = await tracePython(code, parsedInput);
      if (outcome.payload) {
        const payload = outcome.payload;
        const elapsed =
          payload.elapsedMs > 0
            ? payload.elapsedMs
            : (typeof performance !== 'undefined' ? performance.now() : Date.now()) - start;
        const lineMetrics = buildLineMetricsFromSteps(payload.steps, lines, elapsed);
        const executedLineCount = new Set(payload.steps.filter((s) => s.line > 0).map((s) => s.line)).size;
        const storageBytes = safeJsonLength(payload.steps);
        const peakCallDepth = payload.steps.reduce((max, s) => Math.max(max, s.callStack?.length ?? 0), 0);
        const heuristic = analyzeHeuristic(code, language);
        const finalStructures = mergeStructures(
          payload.finalStructures,
          inferStructuresFromOutputs(payload.outputs),
        );

        return {
          steps: payload.steps,
          metrics: {
            executionTimeMs: Math.max(1, Math.round(elapsed)),
            executionTimeSec: Number((elapsed / 1000).toFixed(6)),
            storageSizeBytes: storageBytes,
            storageSizeKB: Number((storageBytes / 1024).toFixed(4)),
            totalSteps: payload.steps.length,
            executedLines: executedLineCount,
            totalLines: lines.filter((l) => l.trim()).length,
            functionCalls: payload.steps.filter((s) => s.isCall).length,
            peakCallDepth,
            iterations: 0,
          },
          lineMetrics,
          error: payload.error ?? undefined,
          errorLine: payload.errorLine,
          outputs: payload.outputs,
          returnValue: payload.returnValue,
          entryPoint: payload.entryPoint || undefined,
          truncated: payload.truncated,
          astNodes: payload.astNodes.length > 0 ? payload.astNodes : heuristic.astNodes,
          finalStructures,
          inputStructures,
        };
      }
      if (outcome.transport) {
        const elapsed = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - start;
        const message = outcome.error || 'The Python sandbox is unavailable right now.';
        return {
          steps: [
            {
              line: 0,
              variables: [],
              callStack: [],
              explanation: message,
              isError: true,
              errorMessage: message,
              outputCount: 0,
            },
          ],
          metrics: {
            executionTimeMs: Math.max(1, Math.round(elapsed)),
            executionTimeSec: Number((elapsed / 1000).toFixed(6)),
            storageSizeBytes: 0,
            storageSizeKB: 0,
            totalSteps: 1,
            executedLines: 0,
            totalLines: lines.filter((l) => l.trim()).length,
          },
          lineMetrics: completeLineMetrics([], lines),
          error: message,
          outputOnly: true,
          finalStructures: [],
          inputStructures,
        };
      }
      // The harness failed - fall through to a plain sandbox run below.
    } catch {
      // Fall through to a plain sandbox run below.
    }
  }

  // Real execution for compiled languages (output-only trace) and Python fallback.
  try {
    const { runSandbox, LANGUAGE_LABELS } = await import('./wandboxRunner');
    const res = await runSandbox(language, code, stdin, { timeoutMs: 40000, retries: 3 });
    const elapsed = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - start;
    const label = LANGUAGE_LABELS[language] || language;
    const outLines = res.stdout.split(/\r?\n/).filter((line) => line.trim().length > 0);
    const steps: ExecutionStep[] = [];

    if (res.error) {
      steps.push({
        line: 0,
        variables: [],
        callStack: [],
        explanation: res.error,
        isError: true,
        errorMessage: res.error,
        outputCount: 0,
      });
    } else if (res.compilerError.trim()) {
      steps.push({
        line: 0,
        variables: [],
        callStack: [],
        explanation: `Compilation failed:\n${res.compilerError.trim()}`,
        isError: true,
        errorMessage: res.compilerError.trim(),
        outputCount: 0,
      });
    } else {
      outLines.forEach((line, idx) => {
        steps.push({
          line: 0,
          variables: [],
          callStack: [{ name: label, line: 0, args: '' }],
          explanation: line,
          outputCount: idx + 1,
        });
      });
      if (steps.length === 0) {
        steps.push({
          line: 0,
          variables: [],
          callStack: [],
          explanation: 'Program compiled and ran with no output. Add print/console statements to see values.',
          outputCount: 0,
        });
      }
      if (res.stderr.trim()) {
        steps.push({
          line: 0,
          variables: [],
          callStack: [],
          explanation: `Runtime error:\n${res.stderr.trim()}`,
          isError: true,
          errorMessage: res.stderr.trim(),
          outputCount: outLines.length,
        });
      } else {
        const lastLine = outLines[outLines.length - 1] || '';
        const parsedOutput = tryParseOutput(lastLine);
        steps.push({
          line: 0,
          variables: [],
          callStack: [],
          explanation:
            parsedOutput !== undefined ? `Program finished - returned ${lastLine}` : 'Program finished',
          outputCount: outLines.length,
          returnValue:
            parsedOutput !== undefined
              ? {
                  name: 'return',
                  value: parsedOutput,
                  display: lastLine,
                  type: outputTypeLabel(parsedOutput),
                }
              : undefined,
        });
      }
    }

    const lastReturn = steps[steps.length - 1]?.returnValue;
    const finalStructures = mergeStructures(
      inferStructuresFromOutputs(outLines),
      lastReturn ? buildResultStructures(lastReturn.value, 'return') : [],
    );
    const errorMessage = res.error || res.compilerError.trim() || res.stderr.trim() || undefined;

    return {
      steps,
      metrics: {
        executionTimeMs: Math.max(1, Math.round(elapsed)),
        executionTimeSec: Number((elapsed / 1000).toFixed(6)),
        storageSizeBytes: res.stdout.length + res.stderr.length,
        storageSizeKB: Number(((res.stdout.length + res.stderr.length) / 1024).toFixed(4)),
        totalSteps: steps.length,
        executedLines: 0,
        totalLines: lines.filter((l) => l.trim()).length,
        peakCallDepth: 1,
        iterations: 0,
      },
      lineMetrics: completeLineMetrics([], lines),
      error: errorMessage,
      outputs: outLines,
      returnValue: lastReturn ?? null,
      outputOnly: true,
      finalStructures,
      inputStructures,
    };
  } catch (e: any) {
    const elapsed = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - start;
    const message = e?.message ?? 'Execution failed';
    return {
      steps: [
        {
          line: 0,
          variables: [],
          callStack: [],
          explanation: message,
          isError: true,
          errorMessage: message,
        },
      ],
      metrics: {
        executionTimeMs: Math.max(1, Math.round(elapsed)),
        executionTimeSec: Number((elapsed / 1000).toFixed(6)),
        storageSizeBytes: 0,
        storageSizeKB: 0,
        totalSteps: 1,
      },
      lineMetrics: completeLineMetrics([], lines),
      error: message,
      outputOnly: true,
      finalStructures: [],
      inputStructures,
    };
  }
}

function safeJsonLength(value: unknown): number {
  try {
    return JSON.stringify(value)?.length ?? 0;
  } catch {
    return 0;
  }
}

function buildLineMetricsFromSteps(steps: ExecutionStep[], lines: string[], elapsedMs: number): LineMetric[] {
  const byLine = new Map<number, { hits: number; code?: string; bytes: number }>();
  for (const step of steps) {
    if (!step.line || step.line < 1) continue;
    const entry = byLine.get(step.line) ?? { hits: 0, code: step.source, bytes: 0 };
    entry.hits += 1;
    entry.code = entry.code || step.source;
    entry.bytes = Math.max(entry.bytes, safeJsonLength(step.variables));
    byLine.set(step.line, entry);
  }

  const totalHits = Array.from(byLine.values()).reduce((sum, entry) => sum + entry.hits, 0) || 1;
  const timePerHit = elapsedMs / totalHits;
  const result: LineMetric[] = [];

  for (let index = 0; index < lines.length; index++) {
    const line = index + 1;
    const entry = byLine.get(line);
    if (entry) {
      result.push({
        line,
        hits: entry.hits,
        executionTimeMs: Number((entry.hits * timePerHit).toFixed(3)),
        executionTimeSec: Number(((entry.hits * timePerHit) / 1000).toFixed(6)),
        avgTimeMs: Number(timePerHit.toFixed(3)),
        storageSizeBytes: entry.bytes,
        storageSizeKB: Number((entry.bytes / 1024).toFixed(4)),
        code: entry.code ?? lines[index],
        executed: true,
      });
    } else if (lines[index].trim()) {
      result.push({
        line,
        hits: 0,
        executionTimeMs: 0,
        executionTimeSec: 0,
        avgTimeMs: 0,
        storageSizeBytes: 0,
        storageSizeKB: 0,
        code: lines[index],
        executed: false,
      });
    }
  }

  return result;
}

function tryParseOutput(text: string): unknown {
  const trimmed = text.trim();
  if (!trimmed) return undefined;
  // Plain JSON scalars are common for LeetCode-style prints (`5`, `true`).
  try {
    return JSON.parse(trimmed);
  } catch {
    // Fall through to embedded JSON in a log line.
  }
  const start = trimmed.search(/[[{]/);
  if (start < 0) return undefined;
  try {
    return JSON.parse(trimmed.slice(start));
  } catch {
    return undefined;
  }
}

function outputTypeLabel(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  if (typeof value === 'object') return 'object';
  return typeof value;
}

function completeLineMetrics(metrics: LineMetric[], lines: string[]): LineMetric[] {
  const byLine = new Map<number, LineMetric>();
  for (const m of metrics) byLine.set(m.line, m);
  const result: LineMetric[] = [];
  let lastExecutedLine = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = i + 1;
    const existing = byLine.get(line);
    const trimmed = lines[i].trim();
    const isClosingBrace = /^[\}\]\),;]*$/.test(trimmed) && trimmed.length > 0;
    
    if (existing) {
      result.push({ ...existing, code: existing.code ?? lines[i], executed: true });
      lastExecutedLine = line;
    } else if (trimmed) {
      // If this line is just a closing brace and the previous line was executed,
      // consider it executed too (it's part of the same block)
      const executed = isClosingBrace && lastExecutedLine > 0 && lastExecutedLine < line;
      result.push({
        line,
        hits: executed ? 1 : 0,
        executionTimeMs: 0,
        executionTimeSec: 0,
        avgTimeMs: 0,
        storageSizeBytes: 0,
        storageSizeKB: 0,
        code: lines[i],
        executed,
      });
      if (executed) lastExecutedLine = line;
    }
  }
  return result;
}
