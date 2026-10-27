# CodeReel — Product & Engineering Context

> **CodeReel** · _Code Debugger & Analyser_ · version **2.0.1**
>
> Understand code, one frame at a time.

This document is the single, complete context for the project: what it is, who it is for, how it is built, how it behaves, what it deliberately does not do, and where it can go next. It is written to be useful both to a new contributor and to the product owner returning after a break.

---

## 1. Identity

| Field | Value |
| --- | --- |
| Product name | **CodeReel** |
| Tagline | **Code Debugger & Analyser** |
| Primary search terms | “code debugger”, “code analyser”, “code analyzer”, “visual code debugger”, “step-by-step code execution” |
| Canonical URL | `https://codereel.dev` |
| Repository | `https://github.com/your-handle/codereel` (placeholder) |
| Version | `2.0.1` |
| Storage prefix | `codereel` (theme + session keys) |
| Default theme | Dark |
| Account model | None |

The name is a coined combination of **code** and **reel** — execution as a filmstrip you can scrub. It replaced the earlier working name **AlgoLens**, which collided with existing tools and was hard to rank for. Branding is centralised in `src/site.ts`; the static tags in `index.html`, `public/robots.txt`, `public/sitemap.xml`, `public/site.webmanifest` and the social image repeat the name intentionally, because crawlers and social scrapers do not execute the app.

---

## 2. The problem

Understanding a program is a different task from running it.

- **IDE debuggers** are precise but assume a project, a toolchain and a build step. They show state; they rarely explain it, and they do not teach complexity or recognise algorithm families.
- **Beginner visualisers** such as Python Tutor are excellent at stepping, but typically cover a narrow set of languages and stop at state. There is no complexity evidence, no pattern detection and no arbitrary multi-language support.
- **Algorithm animation sites** are beautiful but animate a fixed catalogue. They cannot answer “what does *my* solution do?”
- **Big-O cheat sheets** are static tables. They cannot tell you what *this* program’s structure implies.
- **Online judges** tell you pass/fail. They do not show the journey.

The result is a fragmented workflow: run here, visualise there, look up complexity somewhere else, and guess at the algorithm family.

## 3. The product idea

CodeReel connects those fragments around **the user’s own code**:

1. Paste a program (or pick a preset) and provide JSON test input.
2. Execute it for real — interpreted in the browser for JS/TS, instrumented in a sandbox for Python, compiled and run in a sandbox for the rest.
3. Turn execution into a replayable timeline.
4. Capture state at every step: variables, scopes, call stack, console output, data structures.
5. Analyse the AST statically for complexity and algorithm patterns.
6. Let the user **scrub, compare, visualise, export and share** the whole thing.

The guiding promise: **show the evidence, never fake precision.**

---

## 4. Target users

| Persona | Need | How CodeReel helps |
| --- | --- | --- |
| **Learner / student** | See what a loop or recursion actually does | Step explanations, call stack, live variables, structure snapshots |
| **Interview candidate** | Understand why a LeetCode solution works and its complexity | LeetCode-style auto-invocation, Big-O evidence, pattern detection, compare steps |
| **Teacher / workshop host** | Demonstrate a program without setup | Share links that restore code + input + language, no account needed |
| **Reviewer / mentor** | Explain a bug or a hot loop | Timeline filters, completed-vs-current comparison, per-line hot spots |
| **Polyglot developer** | Quickly inspect a snippet in another language | Eight languages behind one editor, honest output-only labelling for compiled languages |
| **Tool builder** | Reuse trace data elsewhere | JSON trace export with steps, metrics, AST, patterns and complexity |

### Non-goals

- Replacing a production debugger with breakpoints, watches and memory inspection.
- Formal complexity proofs.
- Running arbitrary compiled binaries at scale or storing user programs.
- Being a full IDE (no multi-file projects, no package management, no build system).

---

## 5. Core vocabulary

| Term | Meaning |
| --- | --- |
| **Step** | One recorded moment in execution, with line, explanation, variables, call stack, output count and structures. |
| **Trace** | The ordered list of steps produced by one run. |
| **Completed step** | The step immediately before the current one — the state you came from. |
| **Current step** | The step being inspected. |
| **Output-only** | A run where real program output forms the steps but variables are not captured line by line (compiled languages). |
| **Structure** | A detected visualisable value: array, matrix, tree, list, graph, map, set, stack or queue. |
| **Pattern** | A recognised algorithm family with a confidence score and reason. |
| **Entry point** | The function CodeReel decided to invoke with the test input. |
| **Hot line** | A source line with the highest self execution time. |
| **Self time** | Time attributed to a line excluding nested statements. |

---

## 6. Feature inventory

### 6.1 Editor panel

- Monaco editor with language-aware highlighting, line numbers and a glyph margin.
- Jump-to-line decoration for the current step, themed for light and dark modes.
- Language selector for eight languages, with an `(output only)` hint for compiled languages.
- **Auto-detect** on paste and on demand (`src/utils/languageDetect.ts`).
- Preset algorithm catalogue (Two Sum, Invert Binary Tree, Number of Islands, Valid Anagram, Binary Search, Fibonacci memoised, Reverse Linked List, Best Time to Buy & Sell Stock).
- JSON test input field.
- Run & Trace, Auto Play/Stop, step back, step forward and reset controls.
- Playback speed slider (80–1200 ms).
- Inline run-error banner that never replaces the editor.

### 6.2 Debugger panel — five tabs

1. **Trace**
   - Step number, source line and status chips (`call`, `return`, `error`, `n changed`).
   - Plain-language explanation, source snippet, loop info and condition result.
   - Call stack (top frame highlighted).
   - **Variable state** with two modes:
     - **Current** — name, value, type, scope, changed marker, filter.
     - **Compare** — completed value vs current value, with `new` / `gone` markers and a dedicated scope column.
   - Function bindings keep their declared name (`ƒ containsDuplicate()`), and the implicit `arguments` object is labelled honestly as `Arguments(n) [...]` rather than looking like an ordinary array.
   - Scope labels are accurate: `local` for the active frame, `closure` for intermediate scopes and `global` for the root, including implicit globals created by unqualified assignment.
   - Console with **completed**, **current-step** and **later-step** line marking, plus “All output” / “Up to step” scope. Each line carries a **jump-to-step** chip, names the step that produced it, auto-scrolls into view while stepping, and can be copied.
   - Quick structure preview.
   - Final return value.

2. **Timeline** (own tab, as requested)
   - Current step summary.
   - Trace metrics: steps, executed lines, function calls, peak depth, iterations, console lines, runtime.
   - Filters: **All**, **Calls**, **Returns**, **Output**, **Errors**.
   - Click any row to seek; the active row auto-scrolls into view.
   - Guard rail: first 400 matching rows rendered, with a note and the scrubber for the rest.

3. **Visualizer**
   - Three modes: **Current step**, **Full result**, **Input**.
   - Slider to scrub steps without leaving the tab.
   - Renderers: array (pointer labels, highlights), matrix (active cell, land/water tint), binary tree (SVG), linked list, graph (visited nodes), map, set, stack, queue.
   - “Seen in trace” chips summarising structure kinds.

4. **Complexity**
   - Execution metrics: time, peak storage, steps, calls, iterations.
   - **Big-O time** and **space** with justifications and a log-scaled growth curve.
   - Per-line metrics table: hits, self time, average time, storage; optional unexecuted lines.
   - **Hot lines** ranked by self time.

5. **Patterns & AST**
   - Detected algorithm patterns with confidence bars, reasons and source lines.
   - AST structure with larger typography (the previous “too small” complaint) and category filters (`loop`, `conditional`, `declaration`, `function`, `call`, `other`), counts and depth labels.

### 6.3 Transport bar

Always-visible scrubber with previous, play/pause, next, reset and a `step / total` counter.

### 6.4 Header

- Brand mark and name/tagline.
- Navigation: Playground, About, Contact (hash routes).
- Live trace summary: steps, time complexity, space complexity and runtime.
- Share, Run & Trace, shortcut reference and theme toggle.

### 6.5 Footer (functional)

The footer is not decorative. It reports execution mode (local JS/TS vs Wandbox sandbox), shows the step/play keyboard hints on the playground, and links to **About the developer**, **Contact**, source, shortcuts and the version label.

### 6.6 About page (`#/about`)

Project story, six capability cards, full language coverage table, four-stage “how a trace is built” explanation, competitor comparison with strengths and gaps, FAQ, developer profile and a launch CTA. It also links to this document.

### 6.7 Contact page (`#/contact`)

- No backend: the form composes a message and opens the user’s mail app via `mailto:`.
- Copy-message fallback with clipboard API + legacy `execCommand` path.
- Direct links (email, GitHub, LinkedIn), location, “what to include” guidance and feedback cards.
- Placeholder developer details live in `src/site.ts`.

### 6.8 Cross-cutting

- **Dark / light themes** with `localStorage` persistence, `prefers-color-scheme` default, pre-paint theme script and `theme-color` meta update.
- **Share permalink** — code, input and language base64url-encoded into the URL fragment.
- **Session restore** — code, input and language persisted with a 600 ms debounce.
- **JSON export** — full trace, metrics, AST, patterns, complexity, outputs, error and return value.
- **Shortcut modal** and global shortcuts with input-guarding.
- **Toast notifications** for share/restore feedback.
- **Reduced-motion** support and visible focus rings.

---

## 7. UX map

```text
#/            Playground
              ├─ Editor panel (Monaco, language, presets, input, transport)
              └─ Debugger panel
                 ├─ Trace
                 ├─ Timeline
                 ├─ Visualizer
                 ├─ Complexity
                 └─ Patterns & AST

#/about       About the developer + product + comparison + FAQ
#/contact     Contact form + direct links + guidance
```

Navigation is a tiny hash router (`src/hooks/useHashRoute.ts`) so deep links work on static hosts without server rewrites. Each route updates the document title, description, canonical URL and social tags through `src/hooks/useDocumentMeta.ts`.

---

## 8. Architecture

```text
┌──────────────────────────────────────────────────────────────────┐
│ index.html                                                       │
│  · SEO tags, JSON-LD, pre-paint theme script                     │
└───────────────────────────────┬──────────────────────────────────┘
                                │
┌───────────────────────────────▼──────────────────────────────────┐
│ main.tsx  →  ThemeProvider  →  App.tsx                           │
│  · hash route  · session restore  · share bootstrap              │
│  · keyboard shortcuts  · playback engine  · toast                │
└───────┬───────────────────────────────────────────┬──────────────┘
        │                                           │
┌───────▼────────────┐                   ┌──────────▼──────────────┐
│ Header / Footer    │                   │ Pages                   │
│ ShortcutsModal     │                   │ AboutPage, ContactPage  │
└────────────────────┘                   └─────────────────────────┘
        │
┌───────▼──────────────────────────────────────────────────────────┐
│ Workspace                                                         │
│  ├─ CodeEditor (Monaco + controls)                                │
│  └─ DebuggerPanel (5 tabs)                                        │
│       └─ DataStructureVisualizer                                  │
└───────────────────────────────┬──────────────────────────────────┘
                                │ run
┌───────────────────────────────▼──────────────────────────────────┐
│ Execution & analysis                                              │
│  ├─ astAnalyzer.ts        static facts → complexity + patterns    │
│  ├─ generateTrace()       language dispatch                       │
│  │   ├─ jsInterpreter.ts  Babel AST interpreter (JS/TS)           │
│  │   ├─ pythonTracer.ts   sandbox harness (Python)                │
│  │   └─ wandboxRunner.ts  compiled languages                      │
│  └─ structureBuilder.ts   input + final structures                │
└──────────────────────────────────────────────────────────────────┘
```

### Module responsibilities

| File | Responsibility |
| --- | --- |
| `src/site.ts` | Brand, SEO defaults, version, storage prefix, developer profile |
| `src/theme/ThemeProvider.tsx` | Theme state, persistence, document attributes, theme-color meta |
| `src/hooks/useHashRoute.ts` | Route parsing and navigation |
| `src/hooks/useDocumentMeta.ts` | Per-route title/description/canonical/OG/Twitter tags |
| `src/App.tsx` | Shell, state, playback, session, share, shortcuts, toast, run orchestration |
| `src/components/Header.tsx` | Brand, navigation, live summary, share/run/theme/shortcuts |
| `src/components/Footer.tsx` | Runtime status, hints, navigation and version |
| `src/components/CodeEditor.tsx` | Monaco, decorations, language/preset/input controls |
| `src/components/DebuggerPanel.tsx` | Five-tab debugger, compare tables, timeline, export |
| `src/components/DataStructureVisualizer.tsx` | Themed SVG/DOM renderers for every structure kind |
| `src/components/ShortcutsModal.tsx` | Accessible shortcut reference |
| `src/pages/AboutPage.tsx` | Product/developer/about page |
| `src/pages/ContactPage.tsx` | Mailto contact flow with copy fallback |
| `src/utils/astAnalyzer.ts` | Static facts, complexity, patterns, AST node extraction, trace dispatch |
| `src/utils/jsInterpreter.ts` | Babel-AST step interpreter |
| `src/utils/pythonTracer.ts` | Python harness construction and payload parsing |
| `src/utils/pythonTracerTemplate.py` | `sys.settrace` harness (raw import) |
| `src/utils/wandboxRunner.ts` | Wandbox transport, retries, Java preparation, timeout handling |
| `src/utils/structureBuilder.ts` | Input/result structure derivation |
| `src/utils/languageDetect.ts` | Paste/detect language heuristics |
| `src/utils/share.ts` | Base64url share links + JSON download |
| `src/utils/clipboard.ts` | Clipboard with legacy fallback |
| `src/utils/presets.ts`, `templates.ts` | Preset catalogue and per-language starters |
| `src/types/index.ts` | Shared types |

---

## 9. Execution engines

### 9.1 JavaScript / TypeScript — custom Babel-AST interpreter

- Parses with `@babel/parser`, traverses with `@babel/traverse` and produces a step after every executed statement.
- Supports loops, `if/else`, `switch`, recursion, closures, classes, `Map`/`Set`, array methods and LeetCode-style node objects.
- Auto-invokes LeetCode-style solutions: standalone functions, class methods, `var fn = function (...) {}` and arrow-function exports.
- Default parameters and trailing expressions are captured for entry display and return values.
- Safety limits: **20,000 steps** and **5,000 ms** (configurable), with a `HaltSignal` for step/timeout/depth.
- Time is measured per line for self-time metrics; storage is estimated from captured values.
- Runs entirely client-side. No network call.

### 9.2 Python — real `sys.settrace` harness

- The user program and test input are base64-encoded into a generated harness and executed on Wandbox (`cpython-3.13.8`).
- Emits a JSON payload between `__CODEREEL_TRACE__` and `__CODEREEL_END__`.
- Captures steps, stdout, errors, error line, truncation, entry point, return value, final structures, AST nodes and elapsed time.
- Harness budgets: **800 steps**, **4.0 s**, **78,000 bytes** of serialised payload (headroom under Wandbox’s 131,072-byte output cap).
- ASCII-only harness; Unicode source and input survive base64.
- Transport failures (429, 5xx, timeout, unreachable) are returned as fatal/transport errors and surfaced without retrying the tracer as a plain run.

### 9.3 Compiled languages — Wandbox

- Verified compilers: Java `openjdk-jdk-22+36`, C++ `gcc-13.2.0`, C `gcc-13.2.0-c`, Go `go-1.23.2`, Rust `rust-1.82.0`.
- Java sources are prepared for Wandbox’s expected filename.
- `program_message` is treated as mirror output, not stderr.
- Rate-limited (429) and 5xx responses retry with backoff; aborts are reported as timeouts.
- Steps are built from real stdout, so they are **output only**; AST, complexity, patterns and input/result structures still apply.
- Errors never blank the UI: the debugger shows a banner and keeps prior analysis visible where possible.

### 9.4 Static analysis

`analyzeAST()` extracts facts such as:

- loop nesting depth and loop kinds;
- recursion presence, branching factor and halving patterns;
- memoisation identifiers (`dp`, `memo`, `cache`, `memoize`, `table`);
- divide-and-conquer splits;
- pointer/two-pointer patterns;
- grid and tree references;
- function param counts, call graph and source lines.

Those facts feed complexity classification and pattern confidence. Complexity is cross-checked against runtime evidence (steps, iterations, calls, line metrics) and is presented as a reasoned estimate.

### 9.5 Heuristic nesting for sandbox languages

Where a language cannot be instrumented, indentation (Python-like) or brace depth (C-like) provides a best-effort loop-nesting signal. Memoised recursion is classified as linear rather than exponential.

### 9.6 Structure builder

Derives structures from:

- the JSON test input (`nums`, `target`, `root`, `head`, grids, objects);
- the final return value or output value;
- live bindings for traced languages.

This is why the **Input** and **Full result** views exist for every language, including output-only ones.

---

## 10. Data model (summary)

```ts
interface ExecutionStep {
  line: number;
  explanation: string;
  source?: string;
  variables: VariableState[];
  callStack?: CallFrame[];
  dataStructure?: DataStructureView;
  dataStructures?: DataStructureView[];
  outputCount?: number;
  isCall?: boolean;
  isError?: boolean;
  returnValue?: VariableState;
  loopInfo?: { type: string; iteration: number; condition: string };
  conditionResult?: boolean;
}

interface VariableState {
  name: string;
  value: any;
  type: string;
  display?: string;
  scope?: 'local' | 'closure' | 'global';
  changed?: boolean;
}

type DataStructureView =
  | { kind: 'array'; name; values; pointers; highlights? }
  | { kind: 'matrix'; name; values; pointers; pointerLabels?; highlights? }
  | { kind: 'tree'; name; root }
  | { kind: 'list'; name; nodes; pointers }
  | { kind: 'graph'; name; nodes; edges; visited }
  | { kind: 'map'; name; entries }
  | { kind: 'set'; name; values }
  | { kind: 'stack' | 'queue'; name; values };
```

A `TraceResult` bundles steps, complexity, AST nodes, patterns, metrics, line metrics, outputs, error/error line, return value, entry point, truncation flag, output-only flag, language, and final/input structures.

---

## 11. Complexity model

| Signal | Effect |
| --- | --- |
| No loops, no recursion | `O(1)` |
| One loop over input | `O(n)` |
| Nested loops | `O(n²)`, `O(n³)` |
| Halving loops / binary search | `O(log n)` |
| Sort present | at least `O(n log n)` |
| Divide & conquer with halving and two calls | `O(n log n)` |
| Recursion without memoisation | exponential (branching-dependent) |
| Recursion with memoisation | linear (or polynomial) |
| Permutation-style branching | `O(n!)` |

Space follows allocation signals: auxiliary arrays/maps/sets, recursion depth, matrix allocation and output structures. Every class is accompanied by human-readable justifications, and the UI shows measured metrics alongside the estimate.

---

## 12. Pattern detection

Patterns are matched from AST signatures with confidence scores. The current detector recognises:

- two pointers;
- sliding window;
- binary search;
- dynamic programming / memoisation;
- backtracking;
- recursion (generic);
- BFS (queue);
- DFS (recursive);
- tree traversal (recursive);
- linked-list traversal;
- stack / monotonic stack;
- divide & conquer;
- matrix / grid traversal;
- hash-map lookup;
- hash-set membership;
- sorting;
- in-place swapping;
- linear scan (fallback).

Each pattern carries a reason and a confidence percentage, so users can judge the signal rather than treating it as a verdict. The list is intentionally conservative: a pattern is only reported when its structural evidence is present, and `Linear Scan` is the low-confidence fallback for plain iteration.

---

## 13. Design system

### Themes

Two complete token sets on `:root[data-theme='dark' | 'light']`:

- Core surfaces: `--bg-app`, `--bg-canvas`, `--bg-panel`, `--bg-elevated`, `--bg-inset`, `--bg-hover`, `--bg-active`.
- Text: `--text-strong`, `--text-body`, `--text-secondary`, `--text-muted`.
- Accents and semantics: `--accent*`, `--green*`, `--yellow*`, `--purple*`, `--orange*`, `--red*`, `--info*`, `--gold`.
- Chrome: `--header-bg`, `--header-gradient`, `--page-gradient`, `--editor-bg`, shadows, glow and grain.

All components consume tokens; no component hard-codes a palette. Monaco switches between `vs-dark` and `vs` in step with the theme.

### Typography and layout

- System UI stack for prose, SFMono/Consolas stack for code and tables.
- Desktop: 46% editor / 54% debugger split.
- ≤1024 px: stacked editor and debugger.
- ≤860 px: single-column About/Contact layouts, static profile card.
- ≤640 px: compact header, smaller tabs, single-column feature grid.
- `prefers-reduced-motion` disables animation and smooth scrolling.

### Motion

Short, functional transitions only: 120–200 ms fades, slide-ups for modals/toasts, a subtle brand-mark tilt on hover and a spinning loader. No decorative animation competes with the trace.

---

## 14. SEO and metadata

- Descriptive `<title>` and meta description targeting **code debugger** and **code analyser/analyzer**.
- Keywords meta, robots directives, canonical URL.
- Open Graph and Twitter card tags, with a generated 1200×630 social image (`public/og-image.png`; source `public/og-image.svg`).
- `WebApplication` JSON-LD with free offer, feature list and category.
- `robots.txt` and `sitemap.xml` covering `#/`, `#/about`, `#/contact`.
- `site.webmanifest` with name, short name, theme colours and SVG icons.
- Runtime route metadata updates so each page has its own title/description/canonical.
- Pre-paint theme script prevents a flash of the wrong palette.

When deploying to a different host, update `SITE.url`, the static tags in `index.html`, `public/robots.txt` and `public/sitemap.xml`.

---

## 15. Sharing, persistence and export

| Mechanism | Details |
| --- | --- |
| **Share link** | `#/?s=<base64url>` contains `{ code, input, language }`. Links over ~7,000 encoded characters are refused with a toast rather than producing a broken URL. |
| **Share bootstrap** | On load, a valid share payload overrides the saved session and shows a restore toast. |
| **Session restore** | `localStorage['codereel:session']` stores code, input and language (debounced 600 ms). Invalid or unknown languages are ignored. |
| **Theme** | `localStorage['codereel:theme']`, with OS preference as fallback. |
| **Export** | Downloads `codereel-trace-<timestamp>.json` containing product, version, timestamp, language, entry point, steps, complexity, AST, patterns, metrics, line metrics, outputs, error and return value. |

No program data is stored server-side.

---

## 16. Error handling and resilience

- **Parse / syntax errors** — reported as a syntax error banner; editor and previous result remain intact.
- **Runtime errors** — surfaced with the failing line where available.
- **Sandbox errors** — 429, 5xx, timeouts and unreachable endpoints retry with backoff, then report a clear sandbox error.
- **Python transport errors** — classified as fatal so the app does not retry as a plain run.
- **Infinite loops** — step and time limits halt execution and mark the trace truncated.
- **Oversized payloads** — Python size budget stops the harness before Wandbox truncates the response.
- **Clipboard failures** — share and contact copy paths fall back and show guidance.
- **Invalid share links** — silently ignored; the normal bootstrap path runs.
- **Unknown language in storage/share** — rejected and replaced with a safe default.
- **No execution yet** — every tab has a purposeful empty state rather than a blank panel.

Principle: **a failure changes the message, never the layout.**

---

## 17. Performance and limits

| Area | Limit |
| --- | --- |
| JS/TS steps | 20,000 |
| JS/TS wall clock | 5,000 ms |
| Python steps | 800 |
| Python wall clock | 4.0 s |
| Python serialised payload | 78,000 bytes (headroom under 131,072) |
| Sandbox request timeout | 30 s default (Python 40 s), with retries |
| Timeline rendering | first 400 matching rows |
| AST rendering | first 140 filtered nodes |
| Value preview | 60 items / depth 4 in the interpreter; 120 chars in the debugger |
| Share link | 7,000 encoded characters |
| Session save | debounced 600 ms |

Large traces remain usable because rendering is windowed and the scrubber seeks by index.

---

## 18. Privacy and security

- JS/TS tracing never leaves the browser.
- Python and compiled languages are sent to the public Wandbox sandbox for execution. Users are told this in the UI and in the FAQ.
- No accounts, no tracking, no mailing list, no server-side history.
- Share links store code in the URL fragment, which is not sent to the server on navigation.
- `localStorage` is used only for theme and session restore.
- Contact uses `mailto:` — the developer never receives data through a hidden backend.
- Clipboard writes are attempted only in response to an explicit user action.
- External links use `rel="noreferrer noopener"`.

---

## 19. Accessibility

- Semantic landmarks (`header`, `main`, `footer`, `nav`), labelled sections and ARIA-labelled tabs.
- `aria-selected`, `aria-current`, `aria-live` for status and toast messages.
- Visible `:focus-visible` outlines.
- Keyboard-operable tabs, timeline rows, filters and transport controls.
- Shortcut guarding so typing in inputs/editor never triggers playback.
- Reduced-motion support.
- Colour is always paired with text or icons (status labels, `changed` markers, `new`/`gone` chips).
- Contrast targets met in both themes through dedicated light token values rather than simple inversion.

---

## 20. Competitor landscape and differentiators

| Tool | Strength | Gap CodeReel addresses |
| --- | --- | --- |
| **Python Tutor** | Beginner-friendly stepping, call stack, heap diagrams | Narrow language coverage; no complexity, patterns or AST analysis |
| **Algorithm Visualizer** | Beautiful curated animations | Animates its own catalogue; cannot run arbitrary pasted code |
| **IDE debuggers** | Precise breakpoints and inspection | Setup-heavy; little teaching context, complexity or structure snapshots |
| **Big-O cheat sheets** | Quick growth-class reference | Static; not derived from the program in front of you |
| **Online judges** | Objective pass/fail | No journey, no state, no explanation |
| **Notebook visualisers** | Rich inline output | Not step-oriented; weak on call stacks and structure evolution |

CodeReel’s differentiation:

1. **Arbitrary code, not a catalogue.**
2. **Eight languages behind one workflow.**
3. **State + structure + complexity + patterns in one screen.**
4. **Completed-vs-current comparison** rather than a single snapshot.
5. **Honest output-only mode** for languages it cannot instrument.
6. **Shareable traces** with zero setup.
7. **Evidence-first complexity** with justifications and measured line costs.
8. **Theme-complete, accessible, SEO-ready shell.**

---

## 21. Configuration and branding

Edit `src/site.ts`:

```ts
export const SITE = {
  name: 'CodeReel',
  tagline: 'Code Debugger & Analyser',
  title: 'CodeReel — Visual Code Debugger & Code Analyser',
  description: '…',
  url: 'https://codereel.dev',
  repo: 'https://github.com/your-handle/codereel',
  version: '2.0.1',
  storagePrefix: 'codereel',
  developer: {
    name: 'Your Name',
    handle: '@your-handle',
    role: 'Independent developer & maintainer',
    location: 'Remote',
    bio: '…',
    email: 'hello@example.com',
    github: 'https://github.com/your-handle',
    linkedin: 'https://www.linkedin.com/in/your-handle',
    site: 'https://your-site.example.com',
  },
};
```

The developer fields are **placeholders**. Replace name, email and links before publishing. The About and Contact pages read directly from this object.

To rename the product: change `name`, `tagline`, `title`, `description`, `url`, `repo` and `storagePrefix`, then update the static tags in `index.html`, `public/robots.txt`, `public/sitemap.xml`, `public/site.webmanifest` and regenerate the social image.

---

## 22. Development workflow

```bash
npm install
npm run dev
npm run build      # tsc -b && vite build
npm run lint       # oxlint
npm run preview
```

### Type checking

The root `tsconfig.json` is references-only. Type-check the app directly:

```bash
npx tsc --noEmit -p tsconfig.app.json
```

`tsconfig.app.json` enables `noUnusedLocals`, `noUnusedParameters`, `verbatimModuleSyntax` and `noFallthroughCasesInSwitch`, so unused imports and implicit fallthrough fail the build.

### Regenerating the social image

`public/og-image.svg` is the source. The PNG can be regenerated headlessly:

```powershell
& 'C:\Program Files\Google\Chrome\Application\chrome.exe' --headless=new --disable-gpu `
  --hide-scrollbars --force-device-scale-factor=1 --window-size=1200,630 `
  --screenshot="public\og-image.png" "file:///<absolute-path>/public/og-image.svg"
```

---

## 23. QA checklist

**Theme**
- [ ] Toggle dark/light in the header; verify editor, tables, visualiser, timeline, modals and pages all follow.
- [ ] Reload; the chosen theme persists and no flash occurs.
- [ ] Resize to 1024/860/640 px; no horizontal overflow.

**Trace**
- [ ] Run a JS preset; step forward/back; verify variables, call stack, console and line highlight.
- [ ] Switch variables to **Compare**; verify completed vs current values, `new` / `gone` markers and the scope column.
- [ ] Verify console distinguishes completed, current and later lines, and that the hint reports the right number of new lines.
- [ ] Verify each console line shows its producing step, and clicking that chip seeks there.
- [ ] Verify function names and the `arguments` object are labelled correctly for `var fn = function (...) {}` code.
- [ ] Verify implicit globals are labelled `global`, parameters/`arguments` `local`.

**Timeline**
- [ ] Timeline is its own tab; filters work; clicking a row seeks.
- [ ] Active row scrolls into view.

**Visualizer**
- [ ] Current step, Full result and Input modes show the expected structures.
- [ ] Arrays, matrices, trees and lists render correctly in both themes.

**Complexity / Patterns**
- [ ] Big-O cards show justifications and the growth curve.
- [ ] Line metrics and hot lines populate for JS.
- [ ] AST labels are legible; category filters and counts work.

**Languages**
- [ ] Python trace returns variables and output.
- [ ] Each compiled language runs and is labelled output only.
- [ ] Sandbox failure shows an error without breaking the layout.

**Navigation & shell**
- [ ] Header links reach Playground / About / Contact; browser back works.
- [ ] Footer links work (About, Contact, Source, Shortcuts, version).
- [ ] Shortcut modal opens with `?` and closes with `Esc`.

**Share / session / export**
- [ ] Share copies a link; opening it restores code, input and language.
- [ ] Oversized program shows a clear toast instead of a broken link.
- [ ] Reload restores the last session.
- [ ] JSON export downloads a complete trace.

**Accessibility**
- [ ] Tab order is logical; focus rings visible.
- [ ] Typing in the editor does not trigger step/play shortcuts.
- [ ] Reduced-motion preference disables animation.

---

## 24. Known limitations

1. **No variable-level tracing for compiled languages.** Java, C++, C, Go and Rust expose real output-based steps plus static analysis and input/result structures. This is a hard constraint of running them in a remote sandbox without a language-specific instrumentation harness.
2. **Heuristic complexity.** Estimates are AST-driven and cross-checked with runtime evidence, but they are not proofs. Unusual control flow can mislead them.
3. **Public sandbox dependency.** Wandbox can be rate limited or unavailable. Retries and clear errors mitigate this, but it is a shared external service.
4. **Single-file programs.** There is no multi-file project, package manager or build system.
5. **Bounded traces.** Very large or long-running programs are truncated by design; the UI marks this.
6. **Python capture scope.** The harness intentionally budgets steps, time and payload size; extremely large object graphs are summarised rather than fully serialised.
7. **Hash routing.** Deep links work on static hosts, but servers never see the route (and crawlers see the base document plus runtime metadata). For maximal SEO on separate URLs, a static multi-page build or prerendering step would be needed.

---

## 25. Roadmap

**Near term**
- Shareable trace snapshots that include the selected step, not just the program.
- Prerendered `/about` and `/contact` pages for crawlers.
- Configurable trace limits in the UI.
- More presets and per-language idiom templates.
- Export to Markdown/HTML for teaching notes.

**Medium term**
- Java instrumentation harness for variable-level steps.
- Go/Rust AST heuristics using tree-sitter WASM.
- Custom structure registration for user-defined types.
- Timeline bookmarks and annotations.
- Diff two runs side by side.

**Longer term**
- Collaborative trace sessions.
- Optional self-hosted sandbox for privacy-sensitive deployments.
- Course/worksheet mode with guided exercises.
- Plugin API for language engines and visualisers.

---

## 26. File map

```text
.
├─ index.html                       SEO, JSON-LD, pre-paint theme
├─ package.json                     name codereel, version 2.0.1
├─ README.md                        quick start + overview
├─ About.md                         this document
├─ public/
│  ├─ favicon.svg                   brand mark
│  ├─ og-image.svg / og-image.png   1200×630 social card
│  ├─ robots.txt
│  ├─ sitemap.xml
│  └─ site.webmanifest
├─ scripts/
│  └─ babel-test.mjs                scratch script (pre-existing)
└─ src/
   ├─ App.tsx
   ├─ main.tsx
   ├─ index.css
   ├─ site.ts
   ├─ theme/ThemeProvider.tsx
   ├─ hooks/useHashRoute.ts
   ├─ hooks/useDocumentMeta.ts
   ├─ components/
   │  ├─ BrandMark.tsx
   │  ├─ Header.tsx
   │  ├─ Footer.tsx
   │  ├─ ShortcutsModal.tsx
   │  ├─ CodeEditor.tsx
   │  ├─ DebuggerPanel.tsx
   │  └─ DataStructureVisualizer.tsx
   ├─ pages/
   │  ├─ AboutPage.tsx
   │  └─ ContactPage.tsx
   ├─ types/index.ts
   └─ utils/
      ├─ astAnalyzer.ts
      ├─ jsInterpreter.ts
      ├─ pythonTracer.ts
      ├─ pythonTracerTemplate.py
      ├─ wandboxRunner.ts
      ├─ structureBuilder.ts
      ├─ languageDetect.ts
      ├─ presets.ts
      ├─ templates.ts
      ├─ format.ts
      ├─ share.ts
      └─ clipboard.ts
```

---

## 27. FAQ

**Is my code uploaded anywhere?**
JavaScript and TypeScript stay in the browser. Python and compiled languages are sent to the public Wandbox sandbox for execution. CodeReel stores nothing server-side.

**Which languages support full variable-level tracing?**
JavaScript, TypeScript and Python. The other five execute for real and are labelled output only.

**How accurate is the Big-O analysis?**
It is a structural estimate with justifications and runtime evidence — not a formal proof.

**Does it work with LeetCode-style solutions?**
Yes. Standalone functions, class methods, `var fn = function` solutions and arrow-function exports are detected and invoked with the JSON input.

**Do I need an account?**
No.

**Why is the compiled-language trace only output?**
A browser cannot run those runtimes, and the remote sandbox does not expose a portable per-line debug protocol. Rather than fabricate variables, CodeReel shows real output and clearly labels the mode.

**Can I share a trace?**
Yes — the Share button encodes code, input and language into a permalink. The full trace itself can be exported as JSON.

---

## 28. Glossary

| Term | Definition |
| --- | --- |
| **AST** | Abstract Syntax Tree — the structural representation of source code. |
| **Babel** | JavaScript parser/traverser used to build and walk the AST. |
| **Wandbox** | Public multi-language compile-and-run sandbox used for non-JS execution. |
| **`sys.settrace`** | CPython hook used to observe line execution for the Python tracer. |
| **Base64url** | URL-safe base64 encoding used for share payloads. |
| **Self time** | Time spent on a line excluding nested statements. |
| **Hot line** | A line with the highest self time. |
| **Output-only** | Real execution output with no per-line variable capture. |
| **Truncated** | A trace stopped early by a step/time/size budget. |
| **Permalink** | A URL that restores code, input and language. |
| **Hash route** | A client-side route after `#`, requiring no server rewrites. |

---

## 29. Changelog

### 2.0.1 — Console & inspector accuracy

- Fixed per-step console attribution: console writes now land in the interpreter's own output buffer, so **output counts, line marking and the timeline Output filter** are correct (previously every step reported zero output).
- Console lines now show the **step that produced them** with a clickable jump chip, auto-scroll to the current line while stepping, and a **copy visible output** button.
- The console hint reports the true number of **new lines this step**, and the empty state explains when output belongs to later steps.
- Fixed the implicit `arguments` object: shown as **`Arguments(n) [...]`** with type `arguments` instead of an ordinary array, and no longer reported as removed.
- Anonymous function expressions now display their **binding name** (`ƒ containsDuplicate()`).
- Corrected scope labels: `global` for the root scope, `local` for the active frame, `closure` only for intermediate scopes.
- Compare mode gained a dedicated **Scope** column, with tooltips on the `new` / `gone` chips.

### 2.0.0 — CodeReel rebrand and workbench release

- Renamed from **AlgoLens** to **CodeReel** with centralised branding in `src/site.ts`.
- Added full **dark and light** themes with tokens, persistence, pre-paint script and Monaco theme switching.
- Moved the execution timeline into its **own debugger tab** with filters, metrics and auto-scroll.
- Variable state now shows **completed and current** values side by side, with `new`/`gone` markers.
- Console now distinguishes **completed**, **current-step** and **later-step** lines.
- Enlarged **AST structure** typography and added category filters with counts.
- Fixed and made the **footer** functional (status, hints, navigation, source, shortcuts, version).
- Added **About the developer** (`#/about`) and **Contact** (`#/contact`) pages with header navigation.
- Added SEO foundations: title/description/keywords, canonical, Open Graph, Twitter cards, JSON-LD, manifest, robots, sitemap and a generated social image.
- Redesigned the shell: themed header/footer, brand mark, refined tabs, cards, tables, chips and modals.
- Added **share permalinks**, **JSON trace export**, **session restore**, a **shortcut modal** and **toast notifications**.
- Added a **log-scaled Big-O growth curve** and line hot-spot bars.
- Refactored the visualiser and editor onto theme tokens; removed hard-coded palettes.
- Rebranded Python harness markers, filenames and CSS classes to `codereel`.
- Added `About.md` (this document) and rewrote `README.md`.

### Earlier work (pre-2.0)

- Custom Babel-AST interpreter with LeetCode-style auto-invocation.
- Real Python `sys.settrace` harness with bounded JSON payloads.
- Wandbox integration replacing Piston, with retry/backoff and Java preparation.
- Multi-language static analysis, pattern detection, AST extraction and structure building.
- Visual tree/list/graph/map/set renderers and Input/Result views.
- Step and full-result visualizer modes, complete console capture and paste language detection.
- Graceful handling of syntax errors, sandboxes, timeouts, rate limits and infinite loops.
