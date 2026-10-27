export type SupportedLanguage =
  | 'javascript'
  | 'typescript'
  | 'python'
  | 'java'
  | 'cpp'
  | 'c'
  | 'go'
  | 'rust';

/**
 * Lightweight, dependency-free language detection for pasted snippets.
 * Returns `null` when there is not enough signal to make a confident call.
 */
export function detectLanguage(code: string): SupportedLanguage | null {
  const text = code || '';
  if (text.trim().length < 12) return null;

  const has = (re: RegExp) => re.test(text);
  const score: Record<SupportedLanguage, number> = {
    javascript: 0,
    typescript: 0,
    python: 0,
    java: 0,
    cpp: 0,
    c: 0,
    go: 0,
    rust: 0,
  };

  /* ------------------------------- Go ------------------------------- */
  if (has(/^\s*package\s+\w+/m)) score.go += 6;
  if (has(/\bfunc\s+\w+\s*\(/)) score.go += 3;
  if (has(/\bfmt\./)) score.go += 3;
  if (has(/:=\s*/)) score.go += 2;
  if (has(/^\s*import\s+\(/m)) score.go += 2;
  if (has(/\btype\s+\w+\s+struct\b/)) score.go += 2;

  /* ------------------------------ Rust ------------------------------ */
  if (has(/\bfn\s+\w+\s*\(/)) score.rust += 4;
  if (has(/\bprintln!\s*\(/)) score.rust += 4;
  if (has(/\blet\s+mut\b/)) score.rust += 3;
  if (has(/\bimpl\s+\w+/)) score.rust += 3;
  if (has(/\buse\s+std::/)) score.rust += 3;
  if (has(/->\s*(?:i32|u32|i64|u64|usize|String|bool|Vec<)/)) score.rust += 2;

  /* --------------------------- C / C++ ----------------------------- */
  if (has(/#\s*include\s*<iostream>/)) score.cpp += 6;
  if (has(/\bstd::/)) score.cpp += 4;
  if (has(/\busing\s+namespace\s+std\b/)) score.cpp += 4;
  if (has(/\bcout\s*<</)) score.cpp += 3;
  if (has(/\bvector\s*</)) score.cpp += 3;
  if (has(/\bclass\s+\w+/)) score.cpp += 1;
  if (has(/#\s*include\s*<stdio\.h>/)) score.c += 6;
  if (has(/\bprintf\s*\(/)) score.c += 3;
  if (has(/\bscanf\s*\(/)) score.c += 3;
  if (has(/#\s*include\s*</)) {
    score.c += 1;
    score.cpp += 1;
  }
  if (has(/\bint\s+main\s*\(/)) {
    score.c += 3;
    score.cpp += 3;
  }
  if (has(/\bmalloc\s*\(/)) score.c += 3;

  /* ------------------------------ Java ----------------------------- */
  if (has(/\bpublic\s+(?:final\s+|abstract\s+)?class\b/)) score.java += 6;
  if (has(/\bSystem\.out\./)) score.java += 5;
  if (has(/\bpublic\s+static\s+void\s+main\s*\(/)) score.java += 5;
  if (has(/^\s*import\s+java\./m)) score.java += 4;
  if (has(/\bprivate\s+(?:static\s+)?\w+\s+\w+/)) score.java += 2;
  if (has(/\b(?:int|double|boolean|String)\[\]\s+\w+/)) score.java += 2;
  if (has(/\bnew\s+int\s*\[/)) score.java += 2;
  if (has(/\bclass\s+\w+/) && !has(/\bstd::|#\s*include/)) score.java += 3;

  /* ----------------------------- Python ---------------------------- */
  if (has(/^\s*def\s+\w+\s*\(.*\)\s*:/m)) score.python += 6;
  if (has(/^\s*class\s+\w+(?:\([^)]*\))?\s*:/m)) score.python += 4;
  if (has(/^\s*(?:from\s+[\w.]+\s+)?import\s+/m)) score.python += 3;
  if (has(/\bprint\s*\(/)) score.python += 3;
  if (has(/\bself\./)) score.python += 3;
  if (has(/\b(?:elif|None|True|False)\b/)) score.python += 2;
  if (has(/^\s*#/m)) score.python += 1;
  if (has(/:\s*$/m) && has(/^\s{2,}\S/m)) score.python += 2;

  /* --------------------------- TypeScript -------------------------- */
  if (has(/\binterface\s+\w+\s*\{/)) score.typescript += 5;
  if (has(/\btype\s+\w+\s*=/)) score.typescript += 4;
  if (has(/:\s*(?:number|string|boolean|void|any|unknown|never|bigint)\b/)) score.typescript += 4;
  if (has(/\b(?:const|let|var)\s+\w+\s*:\s*/)) score.typescript += 3;
  if (has(/\bas\s+(?:const|number|string|unknown)\b/)) score.typescript += 3;
  if (has(/\benum\s+\w+\s*\{/)) score.typescript += 2;
  if (has(/<\w+(?:,\s*\w+)*>\s*\(/)) score.typescript += 1;
  if (score.typescript >= 4) score.typescript += 2;

  /* --------------------------- JavaScript -------------------------- */
  if (has(/\bconsole\.(?:log|error|warn|table)\s*\(/)) score.javascript += 5;
  if (has(/\bfunction\s+\w+\s*\(/)) score.javascript += 3;
  if (has(/=>/)) score.javascript += 3;
  if (has(/\b(?:const|let|var)\s+\w+\s*=/)) score.javascript += 2;
  if (has(/\b(?:Map|Set|Math|JSON)\./)) score.javascript += 2;
  if (has(/\bmodule\.exports\b|\brequire\s*\(/)) score.javascript += 3;
  if (has(/\b(?:var|let|const)\s+\w+\s*=\s*function\b/)) score.javascript += 3;
  if (has(/@param\s*\{/) || has(/@return\s*\{/)) score.javascript += 2;

  let best: SupportedLanguage = 'javascript';
  let bestScore = 0;
  (Object.keys(score) as SupportedLanguage[]).forEach((language) => {
    if (score[language] > bestScore) {
      best = language;
      bestScore = score[language];
    }
  });

  return bestScore >= 3 ? best : null;
}
