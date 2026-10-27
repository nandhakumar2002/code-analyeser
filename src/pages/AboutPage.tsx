import React from 'react';
import {
  Activity,
  ArrowRight,
  BookOpen,
  Boxes,
  Braces,
  ChartLine,
  Code2,
  Cpu,
  Database,
  ExternalLink,
  Gauge,
  GitBranch,
  Globe,
  Layers,
  Lightbulb,
  Mail,
  MapPin,
  Network,
  Rocket,
  Terminal,
  Workflow,
} from 'lucide-react';
import BrandMark from '../components/BrandMark';
import { useDocumentMeta } from '../hooks/useDocumentMeta';
import { SITE } from '../site';

interface AboutPageProps {
  onNavigate: (route: 'home' | 'about' | 'contact') => void;
}

const FEATURES = [
  {
    icon: Workflow,
    title: 'Real step-by-step tracing',
    body: 'Every loop iteration, branch, function call and return becomes a frame you can scrub. JavaScript and TypeScript run through a custom Babel-AST interpreter, Python through a real sys.settrace harness.',
  },
  {
    icon: Layers,
    title: 'Live data-structure snapshots',
    body: 'Arrays, matrices, binary trees, linked lists, graphs, maps, sets, stacks and queues are detected automatically and redrawn at each step — plus input and final-result views.',
  },
  {
    icon: Gauge,
    title: 'Complexity with evidence',
    body: 'Big-O time and space estimates backed by justifications, runtime metrics, per-line hit counts, self time and storage, and the hot lines that dominate execution.',
  },
  {
    icon: Braces,
    title: 'Patterns and AST insight',
    body: 'Detected algorithm families with confidence scores, plus a filterable syntax-tree breakdown so you can see exactly which constructs drive the analysis.',
  },
  {
    icon: Network,
    title: 'Eight languages, one workbench',
    body: 'Trace JavaScript, TypeScript and Python in full detail. Java, C++, C, Go and Rust run in a real sandbox, with output-based steps, static analysis and structure visualisations.',
  },
  {
    icon: Lightbulb,
    title: 'Step comparison and share links',
    body: 'Compare the completed step with the current one, see which console lines are new, then share a permalink that restores your code, input and language for anyone.',
  },
];

const LANGUAGES = [
  { name: 'JavaScript', mode: 'Full AST trace', detail: 'Variables, call stack, structures, metrics, console' },
  { name: 'TypeScript', mode: 'Full AST trace', detail: 'Types stripped, then traced like JavaScript' },
  { name: 'Python', mode: 'Real trace', detail: 'sys.settrace harness with variables, structures and stdout' },
  { name: 'Java', mode: 'Sandbox + static', detail: 'Real execution output, output-based steps, static analysis' },
  { name: 'C / C++', mode: 'Sandbox + static', detail: 'Real execution output, output-based steps, static analysis' },
  { name: 'Go', mode: 'Sandbox + static', detail: 'Real execution output, output-based steps, static analysis' },
  { name: 'Rust', mode: 'Sandbox + static', detail: 'Real execution output, output-based steps, static analysis' },
];

const COMPARISON = [
  {
    tool: 'Python Tutor',
    strength: 'Excellent beginner-friendly stepping, call-stack and heap diagrams.',
    gap: 'Mostly Python/JS/C-family basics; no complexity, pattern or AST analysis.',
  },
  {
    tool: 'Algorithm Visualizer',
    strength: 'Beautiful curated animations for classic algorithms.',
    gap: 'Animates its own catalog rather than arbitrary code you paste.',
  },
  {
    tool: 'IDE debuggers',
    strength: 'Precise breakpoints and inspection inside real projects.',
    gap: 'Setup-heavy; little teaching context, complexity or structure snapshots.',
  },
  {
    tool: 'Big-O cheat sheets',
    strength: 'Quick reference for common growth classes.',
    gap: 'Static tables — not derived from the program in front of you.',
  },
];

const FAQ = [
  {
    question: 'Is my code uploaded anywhere?',
    answer:
      'JavaScript and TypeScript are traced entirely in your browser. Python and the compiled languages are sent to the public Wandbox sandbox for execution, because a browser cannot run those runtimes natively. Nothing is stored by CodeReel.',
  },
  {
    question: 'Which languages support full variable-level tracing?',
    answer:
      'JavaScript, TypeScript and Python do. Java, C++, C, Go and Rust execute for real in a remote sandbox, so CodeReel shows genuine program output as steps, and combines it with static AST analysis and input/result structure visualisations.',
  },
  {
    question: 'How accurate is the Big-O analysis?',
    answer:
      'Complexity is inferred from AST structure — loop nesting, recursion shape, memoisation, divide-and-conquer splits and data-structure use — and cross-checked against runtime metrics. It is a well-reasoned estimate, not a formal proof.',
  },
  {
    question: 'Does it work with LeetCode-style solutions?',
    answer:
      'Yes. Standalone functions, class methods, var fn = function style solutions and arrow-function exports are detected and invoked with the JSON test input you provide.',
  },
  {
    question: 'Do I need an account?',
    answer:
      'No. CodeReel is a client-side workbench with no sign-up, no tracking pixels and no server-side history. Share links encode code and input directly in the URL.',
  },
];

const AboutPage: React.FC<AboutPageProps> = ({ onNavigate }) => {
  useDocumentMeta({
    title: `About the developer · ${SITE.name} — ${SITE.tagline}`,
    description:
      'Why CodeReel exists, how the visual code debugger works, how it compares with Python Tutor, Algorithm Visualizer and IDE debuggers, and who builds it.',
    path: '/#/about',
    keywords:
      'about CodeReel, visual code debugger, code analyser, execution tracer, algorithm visualizer, Big-O complexity, developer profile',
  });

  const dev = SITE.developer;

  return (
    <div className='page'>
      <div className='page-inner'>
        <section className='page-hero'>
          <span className='eyebrow'>
            <BrandMark size={18} /> About the project
          </span>
          <h1>
            Understand code, <span className='grad'>one frame at a time.</span>
          </h1>
          <p>
            {SITE.name} is a browser-based <strong>code debugger and code analyser</strong> for
            people who want to see what a program actually does — not just whether it passes.
            Paste a solution, run it, and replay every step with live variables, data structures,
            Big-O analysis and algorithm patterns side by side.
          </p>
          <div style={{ display: 'flex', gap: 8, marginTop: 20, flexWrap: 'wrap' }}>
            <button type='button' className='btn btn-primary' onClick={() => onNavigate('home')}>
              Open the playground <ArrowRight size={13} />
            </button>
            <button type='button' className='btn btn-ghost' onClick={() => onNavigate('contact')}>
              Contact the developer
            </button>
          </div>
        </section>

        <section className='page-section' aria-labelledby='features-heading'>
          <h2 id='features-heading'>What it does</h2>
          <p className='section-lead'>
            Six capabilities that normally live in separate tools, wired into a single replayable
            trace.
          </p>
          <div className='feature-grid'>
            {FEATURES.map((feature) => {
              const Icon = feature.icon;
              return (
                <article className='feature-card' key={feature.title}>
                  <div className='feature-icon'>
                    <Icon size={17} />
                  </div>
                  <h3>{feature.title}</h3>
                  <p>{feature.body}</p>
                </article>
              );
            })}
          </div>
        </section>

        <section className='page-section' aria-labelledby='languages-heading'>
          <h2 id='languages-heading'>Language coverage</h2>
          <p className='section-lead'>
            Full tracing where the browser can interpret or instrument the language; honest,
            output-based steps plus static analysis where it cannot.
          </p>
          <div className='card' style={{ overflow: 'hidden' }}>
            <table className='data-table'>
              <thead>
                <tr>
                  <th>Language</th>
                  <th>Execution mode</th>
                  <th>What you get</th>
                </tr>
              </thead>
              <tbody>
                {LANGUAGES.map((language) => (
                  <tr key={language.name}>
                    <td style={{ color: 'var(--text-strong)', fontWeight: 700 }}>{language.name}</td>
                    <td>
                      <span className={`chip ${language.mode === 'Full AST trace' ? 'chip-accent' : ''}`}>
                        {language.mode}
                      </span>
                    </td>
                    <td style={{ color: 'var(--text-secondary)' }}>{language.detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className='page-section' aria-labelledby='how-heading'>
          <h2 id='how-heading'>How a trace is built</h2>
          <div className='feature-grid' style={{ marginTop: 16 }}>
            <article className='feature-card'>
              <div className='feature-icon'>
                <Terminal size={17} />
              </div>
              <h3>1 · Execute for real</h3>
              <p>
                JavaScript and TypeScript are interpreted statement by statement from their Babel
                AST. Python runs under a tracing hook in a sandbox. Compiled languages execute on
                Wandbox.
              </p>
            </article>
            <article className='feature-card'>
              <div className='feature-icon'>
                <Database size={17} />
              </div>
              <h3>2 · Capture state</h3>
              <p>
                Each step records visible bindings, their scope, changed markers, the call stack,
                console output count and any data structure that can be reconstructed.
              </p>
            </article>
            <article className='feature-card'>
              <div className='feature-icon'>
                <ChartLine size={17} />
              </div>
              <h3>3 · Analyse statically</h3>
              <p>
                The AST is scanned for loop nesting, recursion shape, memoisation, pointer patterns
                and algorithm signatures, producing complexity estimates and pattern confidence.
              </p>
            </article>
            <article className='feature-card'>
              <div className='feature-icon'>
                <Activity size={17} />
              </div>
              <h3>4 · Replay and compare</h3>
              <p>
                Scrub the timeline, compare completed and current variable values, inspect per-line
                cost and export or share the whole trace.
              </p>
            </article>
          </div>
        </section>

        <section className='page-section' aria-labelledby='compare-heading'>
          <h2 id='compare-heading'>How it compares</h2>
          <p className='section-lead'>
            The best existing tools each solve one slice of the problem. {SITE.name} connects them
            around <em>your</em> code rather than a fixed catalog.
          </p>
          <div className='feature-grid'>
            {COMPARISON.map((item) => (
              <article className='feature-card' key={item.tool}>
                <h3 style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Boxes size={14} style={{ color: 'var(--accent)' }} /> {item.tool}
                </h3>
                <p>
                  <strong style={{ color: 'var(--green)' }}>Strength:</strong> {item.strength}
                </p>
                <p style={{ marginTop: 6 }}>
                  <strong style={{ color: 'var(--orange)' }}>Gap:</strong> {item.gap}
                </p>
              </article>
            ))}
          </div>
          <div className='notice' style={{ marginTop: 14 }}>
            <Rocket size={15} style={{ color: 'var(--accent)', flexShrink: 0 }} />
            <span>
              <strong style={{ color: 'var(--text-strong)' }}>What {SITE.name} adds:</strong>{' '}
              arbitrary multi-language code, variable-level replay, side-by-side step comparison,
              structure snapshots, complexity evidence, AST patterns and shareable links — in one
              screen with no setup.
            </span>
          </div>
        </section>

        <section className='page-section' aria-labelledby='faq-heading'>
          <h2 id='faq-heading'>Frequently asked questions</h2>
          <div style={{ display: 'grid', gap: 10, marginTop: 16 }}>
            {FAQ.map((item) => (
              <details
                className='card'
                key={item.question}
                style={{ padding: '12px 15px' }}
              >
                <summary
                  style={{
                    cursor: 'pointer',
                    color: 'var(--text-strong)',
                    fontWeight: 650,
                    fontSize: 13,
                  }}
                >
                  {item.question}
                </summary>
                <p style={{ margin: '9px 0 0', color: 'var(--text-secondary)', fontSize: 12.5, lineHeight: 1.7 }}>
                  {item.answer}
                </p>
              </details>
            ))}
          </div>
        </section>

        <section className='page-section' aria-labelledby='developer-heading'>
          <h2 id='developer-heading'>About the developer</h2>
          <div className='info-grid' style={{ marginTop: 16 }}>
            <div className='prose'>
              <p>
                {SITE.name} is an independent project by <strong>{dev.name}</strong>. It exists
                because the tools available for understanding a program were split between
                step-through debuggers that assume a full project setup and visualisers that only
                animate their own examples.
              </p>
              <h3>Design principles</h3>
              <ul>
                <li>
                  <strong>Show the evidence.</strong> Complexity estimates ship with the reasons and
                  the measured line costs that produced them.
                </li>
                <li>
                  <strong>Never fake precision.</strong> Languages without variable-level tracing are
                  labelled output-only rather than pretending to know more than they do.
                </li>
                <li>
                  <strong>Stay out of the way.</strong> No account, no upload of JS/TS code, graceful
                  errors for sandboxes, timeouts and infinite loops.
                </li>
                <li>
                  <strong>Teach, don’t just display.</strong> Every frame carries a plain-language
                  explanation, source line, call stack and change markers.
                </li>
              </ul>
              <h3>Built with</h3>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                {['React', 'TypeScript', 'Monaco Editor', 'Babel AST', 'Vite', 'Wandbox'].map((tech) => (
                  <span className='chip' key={tech}>
                    {tech}
                  </span>
                ))}
              </div>
            </div>

            <aside className='profile-card'>
              <div className='avatar' aria-hidden='true'>
                {dev.name
                  .split(' ')
                  .filter(Boolean)
                  .slice(0, 2)
                  .map((part) => part[0])
                  .join('')
                  .toUpperCase() || 'CR'}
              </div>
              <h3>{dev.name}</h3>
              <p className='profile-role'>{dev.role}</p>
              <p style={{ margin: 0, fontSize: 12, lineHeight: 1.65, color: 'var(--text-secondary)' }}>
                {dev.bio}
              </p>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  marginTop: 10,
                  color: 'var(--text-muted)',
                  fontSize: 11,
                }}
              >
                <MapPin size={12} /> {dev.location}
              </div>
              <div className='profile-links'>
                <a className='profile-link' href={`mailto:${dev.email}`}>
                  <Mail size={13} /> {dev.email}
                </a>
                <a className='profile-link' href={dev.github} target='_blank' rel='noreferrer noopener'>
                  <Code2 size={13} /> {dev.handle} on GitHub <ExternalLink size={11} style={{ marginLeft: 'auto' }} />
                </a>
                <a className='profile-link' href={dev.site} target='_blank' rel='noreferrer noopener'>
                  <Globe size={13} /> Personal site <ExternalLink size={11} style={{ marginLeft: 'auto' }} />
                </a>
              </div>
              <button
                type='button'
                className='btn btn-ghost'
                style={{ width: '100%', marginTop: 12 }}
                onClick={() => onNavigate('contact')}
              >
                <Mail size={12} /> Get in touch
              </button>
            </aside>
          </div>
        </section>

        <section className='page-section' aria-labelledby='cta-heading'>
          <div
            className='card'
            style={{
              padding: '22px 22px',
              display: 'flex',
              gap: 16,
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              background: 'linear-gradient(120deg, var(--bg-panel), var(--accent-soft))',
            }}
          >
            <div>
              <h2 id='cta-heading' style={{ margin: 0, fontSize: 18 }}>
                Ready to see your code run?
              </h2>
              <p style={{ margin: '4px 0 0', color: 'var(--text-secondary)', fontSize: 12.5 }}>
                Pick a preset or paste your own solution. No account needed.
              </p>
            </div>
            <button type='button' className='btn btn-primary' onClick={() => onNavigate('home')}>
              <Rocket size={13} /> Launch playground
            </button>
          </div>
        </section>

        <p style={{ marginTop: 26, fontSize: 10.5, color: 'var(--text-muted)' }}>
          <BookOpen size={11} style={{ display: 'inline', verticalAlign: -1 }} /> Product, architecture
          and design notes live in <code>About.md</code> in the repository. Also see{' '}
          <button
            type='button'
            className='footer-link'
            style={{ display: 'inline', padding: 0 }}
            onClick={() => onNavigate('contact')}
          >
            contact
          </button>{' '}
          · <span className='chip'><Cpu size={10} /> client-side first</span> ·{' '}
          <span className='chip'><GitBranch size={10} /> open architecture</span>
        </p>
      </div>
    </div>
  );
};

export default AboutPage;
