export interface Preset {
  id: string;
  name: string;
  category: string;
  description: string;
  language: string;
  code: string;
  testInput: string;
  expected?: string;
  structures: string[];
}

export const PRESETS: Preset[] = [
  {
    id: 'two-sum',
    name: 'Two Sum',
    category: 'Hash Map',
    description: 'Find two indices that add up to a target using a hash map for O(1) lookups.',
    language: 'javascript',
    expected: '[0, 1]',
    structures: ['map', 'array'],
    code: `function twoSum(nums, target) {
  const seen = new Map();
  for (let i = 0; i < nums.length; i++) {
    const complement = target - nums[i];
    if (seen.has(complement)) {
      return [seen.get(complement), i];
    }
    seen.set(nums[i], i);
  }
  return [];
}`,
    testInput: '{"nums": [2, 7, 11, 15], "target": 9}',
  },
  {
    id: 'best-time-stock',
    name: 'Best Time to Buy & Sell Stock',
    category: 'Arrays / Greedy',
    description:
      'LeetCode-style function expression: track the running minimum and best profit in a single pass.',
    language: 'javascript',
    expected: '5',
    structures: ['array'],
    code: `/**
 * @param {number[]} prices
 * @return {number}
 */
var maxProfit = function(prices) {
  let minimum = prices[0];
  let profit = 0;

  for (let i = 1; i < prices.length; i++) {
    if (prices[i] < minimum) {
      minimum = prices[i];
    } else {
      profit = Math.max(profit, prices[i] - minimum);
    }
  }

  console.log('min', minimum, 'profit', profit);
  return profit;
};`,
    testInput: '{"prices": [7, 1, 5, 3, 6, 4]}',
  },
  {
    id: 'invert-tree',
    name: 'Invert Binary Tree',
    category: 'Binary Tree',
    description: 'Recursively swap every left and right child. Watch the call stack unwind.',
    language: 'javascript',
    expected: '[4, 7, 2, 9, 6, 3, 1]',
    structures: ['tree'],
    code: `function invertTree(root) {
  if (!root) return null;
  const temp = root.left;
  root.left = invertTree(root.right);
  root.right = invertTree(temp);
  return root;
}`,
    testInput: '{"root": [4, 2, 7, 1, 3, 6, 9]}',
  },
  {
    id: 'number-of-islands',
    name: 'Number of Islands',
    category: 'Matrix / DFS',
    description: 'Flood-fill each unvisited land cell with DFS and count connected components.',
    language: 'javascript',
    expected: '3',
    structures: ['matrix'],
    code: `function numIslands(grid) {
  const rows = grid.length;
  const cols = grid[0].length;
  let count = 0;

  function dfs(r, c) {
    if (r < 0 || c < 0 || r >= rows || c >= cols || grid[r][c] !== '1') {
      return;
    }
    grid[r][c] = '0';
    dfs(r + 1, c);
    dfs(r - 1, c);
    dfs(r, c + 1);
    dfs(r, c - 1);
  }

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (grid[r][c] === '1') {
        count++;
        dfs(r, c);
      }
    }
  }
  return count;
}`,
    testInput:
      '{"grid": [["1","1","0","0","0"],["1","1","0","0","0"],["0","0","1","0","0"],["0","0","0","1","1"]]}',
  },
  {
    id: 'valid-anagram',
    name: 'Valid Anagram',
    category: 'Strings',
    description: 'Count character frequencies in both strings and compare the tallies.',
    language: 'javascript',
    expected: 'true',
    structures: ['map'],
    code: `function isAnagram(s, t) {
  if (s.length !== t.length) return false;
  const counts = new Map();
  for (const ch of s) {
    counts.set(ch, (counts.get(ch) || 0) + 1);
  }
  for (const ch of t) {
    if (!counts.has(ch)) return false;
    const next = counts.get(ch) - 1;
    if (next === 0) counts.delete(ch);
    else counts.set(ch, next);
  }
  return counts.size === 0;
}`,
    testInput: '{"s": "anagram", "t": "nagaram"}',
  },
  {
    id: 'binary-search',
    name: 'Binary Search',
    category: 'Search',
    description: 'Halve the search space each iteration with low / mid / high pointers.',
    language: 'javascript',
    expected: '4',
    structures: ['array'],
    code: `function binarySearch(nums, target) {
  let low = 0;
  let high = nums.length - 1;
  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    if (nums[mid] === target) return mid;
    if (nums[mid] < target) {
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  return -1;
}`,
    testInput: '{"nums": [-1, 0, 3, 5, 9, 12], "target": 9}',
  },
  {
    id: 'fibonacci-memo',
    name: 'Fibonacci (Memoised)',
    category: 'Dynamic Programming',
    description: 'Compare overlapping subproblems resolved once via a memo table.',
    language: 'javascript',
    expected: '55',
    structures: ['map'],
    code: `function fib(n, memo = new Map()) {
  if (n <= 1) return n;
  if (memo.has(n)) return memo.get(n);
  const value = fib(n - 1, memo) + fib(n - 2, memo);
  memo.set(n, value);
  return value;
}`,
    testInput: '{"n": 10}',
  },
  {
    id: 'reverse-list',
    name: 'Reverse Linked List',
    category: 'Linked List',
    description: 'Walk the list once, reversing each next pointer with prev / curr.',
    language: 'javascript',
    expected: '[5, 4, 3, 2, 1]',
    structures: ['list'],
    code: `function reverseList(head) {
  let prev = null;
  let curr = head;
  while (curr) {
    const next = curr.next;
    curr.next = prev;
    prev = curr;
    curr = next;
  }
  return prev;
}`,
    testInput: '{"head": [1, 2, 3, 4, 5]}',
  },
];

export const PRESET_LOOKUP: Record<string, Preset> = Object.fromEntries(
  PRESETS.map((p) => [p.id, p]),
);
