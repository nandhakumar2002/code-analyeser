/**
 * Single source of truth for product naming, metadata and the developer
 * profile shown on the About / Contact pages.
 *
 * Renaming the product only requires changing `name`, `tagline` and `url`
 * here (plus the static tags in `index.html`).
 */
export const SITE = {
  name: 'CodeReel',
  tagline: 'Code Debugger & Analyser',
  /** Used in <title>, Open Graph tags and share previews. */
  title: 'CodeReel — Visual Code Debugger & Code Analyser',
  description:
    'Trace code line by line with live variable state, data-structure visualisations, Big-O complexity analysis and algorithm pattern detection. JavaScript, TypeScript, Python, Java, C++, C, Go and Rust in one browser-based debugger.',
  shortDescription:
    'Step through code, watch data structures change and understand complexity — in eight languages, straight from the browser.',
  url: 'https://codereel.dev',
  repo: 'https://github.com/your-handle/codereel',
  version: '2.0.1',
  storagePrefix: 'codereel',

  /**
   * Replace these placeholders with your own details. Nothing else needs to
   * change — the About and Contact pages read from this object.
   */
  developer: {
    name: 'Your Name',
    handle: '@your-handle',
    role: 'Independent developer & maintainer',
    location: 'Remote',
    bio: 'I build developer tools that make programs easier to understand. CodeReel started as a weekend experiment in visualising execution and grew into a multi-language tracer, complexity analyser and data-structure workbench.',
    email: 'hello@example.com',
    github: 'https://github.com/your-handle',
    linkedin: 'https://www.linkedin.com/in/your-handle',
    site: 'https://your-site.example.com',
  },
} as const;

export type SiteRoute = 'home' | 'about' | 'contact';
