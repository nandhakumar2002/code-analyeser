# CodeReel — Visual Code Debugger & Code Analyser

**CodeReel** is a browser-based **code debugger and code analyser**. Paste a program, run it, and replay the execution frame by frame with live variables, data-structure snapshots, Big-O complexity evidence and algorithm pattern detection — in eight languages, with no account and no install.

> Understand code, one frame at a time.

- **Product context & architecture:** [`About.md`](./About.md)
- **Playground:** `#/`
- **About the developer:** `#/about`
- **Contact:** `#/contact`

---

## Highlights

| Capability | What you get |
| --- | --- |
| **Step-by-step tracing** | Every loop iteration, branch, call and return becomes a replayable frame with a plain-language explanation. |
| **Live variable inspection** | Current values, types and scopes, changed-value markers, filtering, and a completed-vs-current comparison table. Function bindings keep their name, the implicit `arguments` object is labelled honestly, and implicit globals are marked `global`. |
| **Data-structure visualiser** | Arrays, matrices, binary trees, linked lists, graphs, maps, sets, stacks and queues — at the current step, the final result, or the parsed input. |
| **Console provenance** | Every console line is marked completed, current or upcoming for the step, shows the step that produced it (click to jump), and can be filtered to the current step or copied. |
| **Complexity analysis** | Big-O time and space estimates with justifications, a log-scaled growth curve, runtime metrics, per-line hits/self time/storage and hot lines. |
| **Patterns & AST** | Detected algorithm families with confidence scores and a filterable syntax-tree breakdown. |
| **Share & export** | Permalinks that encode code, input and language in the URL; one-click JSON trace export. |
| **Eight languages** | JavaScript, TypeScript, Python, Java, C++, C, Go and Rust. |
| **Light & dark themes** | Cinematic dark default and a paper-light counterpart, remembered per browser. |
| **Session restore** | The editor restores your last code, input and language after a reload. |

---

## Language coverage

| Language | Execution mode | What you get |
| --- | --- | --- |
| **JavaScript** | Full AST trace (in-browser) | Steps, variables, call stack, structures, metrics, console |
| **TypeScript** | Full AST trace (in-browser) | Types stripped, then traced like JavaScript |
| **Python** | Real `sys.settrace` harness (sandbox) | Steps, variables, structures, stdout, return value |
| **Java, C++, C, Go, Rust** | Real execution in the Wandbox sandbox | Genuine program output as steps, static analysis, input/result structures |

CodeReel is explicit about the difference: languages without a variable-level tracer are labelled **output only** in the UI rather than pretending to know more than they do.

---

## Getting started

```bash
npm install
npm run dev      # Vite dev server
npm run build    # type-check + production build
npm run preview  # serve the production build
npm run lint     # oxlint
```

The app is a static single-page site. The built `dist/` folder can be hosted on any static host.

### Configuration

Product name, tagline, SEO defaults, version and the developer profile all live in **`src/site.ts`**. Renaming the product or replacing the developer placeholders is a single-file change (plus the static tags in `index.html`).

---

## Keyboard shortcuts

| Keys | Action |
| --- | --- |
| `←` / `→` | Previous / next execution step |
| `Space` | Play / pause the trace |
| `Ctrl` / `Cmd` + `Enter` | Run and trace |
| `T` | Toggle dark / light theme |
| `?` | Open the shortcut reference |
| `Esc` | Close dialogs |

Shortcuts are paused while typing in the editor, an input, a textarea or a select.

---

## How it works

### JavaScript / TypeScript

`src/utils/jsInterpreter.ts` walks the Babel AST and interprets the program statement by statement. After each executed statement it records a step containing the post-state of every visible binding, the call stack, loop/condition metadata, captured console output and auto-detected data structures. LeetCode-style standalone functions, class methods, `var fn = function` solutions and arrow-function exports are detected and invoked automatically with the JSON test input.

### Python

`src/utils/pythonTracerTemplate.py` is bundled as a raw string and executed on Wandbox. It base64-encodes the user program and test input, installs a real `sys.settrace` hook, captures stdout, and emits a bounded JSON trace between `__CODEREEL_TRACE__` and `__CODEREEL_END__` markers. Step, time, size and output budgets keep the payload under Wandbox's response limit.

### Compiled languages

`src/utils/wandboxRunner.ts` posts the editor contents to the public [Wandbox](https://wandbox.org/) API (CORS enabled, no key required). Execution output becomes the step list; the same static analyser and structure builder used elsewhere provide complexity, patterns, AST nodes and input/result structures. If Wandbox is rate limited, unreachable or times out, the error is reported inside the debugger and the UI keeps working.

### Static analysis

`src/utils/astAnalyzer.ts` collects structural facts — loop nesting, recursion shape, divide-and-conquer splits, memoisation, pointer patterns, grid/tree references and data-structure use — to produce Big-O estimates, justifications and algorithm-pattern confidence scores.

### Structures

`src/utils/structureBuilder.ts` derives visualisable structures from the test input and from the returned/output value, so every language gets the **Input** and **Full result** views even when variable-level tracing is not available.

---

## Privacy

- JavaScript and TypeScript are traced **entirely in your browser**.
- Python, Java, C++, C, Go and Rust are sent to the public Wandbox sandbox for execution, because a browser cannot run those runtimes natively.
- CodeReel has no accounts, no analytics beacons and no server-side history. The last session and theme preference are stored in `localStorage`; share links encode the program directly in the URL fragment.

See [`About.md`](./About.md) for the complete privacy and security notes.

---

## SEO & deployment

`index.html` ships with:

- descriptive title, meta description and keywords;
- canonical URL, Open Graph and Twitter card metadata;
- `WebApplication` JSON-LD structured data;
- `robots.txt`, `sitemap.xml`, `site.webmanifest` and a 1200×630 `og-image.png` in `public/`.

The canonical host is `https://codereel.dev` (change `SITE.url` in `src/site.ts` and the static tags in `index.html` / `public/` if you deploy elsewhere). Hash routes keep deep links working on static hosts without server rewrites. Route-specific titles and descriptions are applied at runtime by `src/hooks/useDocumentMeta.ts`.

---

## Project structure

```text
src/
  App.tsx                  app shell, routing, share/session/shortcuts wiring
  site.ts                  brand, SEO and developer configuration
  index.css                themed design tokens and all layout styles
  theme/ThemeProvider.tsx  dark/light theme context
  hooks/                   hash routing and document metadata
  components/
    Header.tsx Footer.tsx BrandMark.tsx ShortcutsModal.tsx
    CodeEditor.tsx         Monaco editor + program controls
    DebuggerPanel.tsx      Trace / Timeline / Visualizer / Complexity / Patterns tabs
    DataStructureVisualizer.tsx
  pages/                   AboutPage.tsx ContactPage.tsx
  utils/                   AST interpreter, analyser, Python tracer, Wandbox runner,
                           structure builder, templates, presets, share, clipboard
  types/                   shared TypeScript types
public/                    favicon, manifest, robots, sitemap, social image
```

---

## Limitations

- Variable-level tracing is available for JavaScript, TypeScript and Python. Compiled languages expose real output-based steps plus static analysis.
- Complexity estimates are well-reasoned heuristics derived from AST structure and runtime evidence, not formal proofs.
- The public Wandbox sandbox may be rate limited; CodeReel retries with backoff and surfaces the error instead of failing silently.
- Trace size is bounded (steps, time, storage and output) to keep the UI responsive; truncated traces are clearly marked.

---

## Documentation

- [`About.md`](./About.md) — product vision, personas, UX map, architecture, execution engines, design system, competitor analysis, roadmap and glossary.

---

## Contact

The developer profile and contact email are placeholders in `src/site.ts`. Replace them before publishing. Feedback, bug reports and language requests are welcome through the in-app **Contact** page.
