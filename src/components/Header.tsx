import React from 'react';
import BrandMark from './BrandMark';

export type ThemeName = 'dark' | 'light';

interface HeaderProps {
  route: 'home' | 'about' | 'contact';
  onNavigate: (route: 'home' | 'about' | 'contact') => void;
  onRun: () => void;
  onShare: () => void;
  shareLabel: string;
  isRunning: boolean;
  theme: ThemeName;
  onToggleTheme: () => void;
  onOpenShortcuts: () => void;
  summary?: {
    steps: number;
    time: string;
    space: string;
    ms?: number;
  } | null;
}

const NAV: Array<{ id: 'home' | 'about' | 'contact'; label: string }> = [
  { id: 'home', label: 'Playground' },
  { id: 'about', label: 'About' },
  { id: 'contact', label: 'Contact' },
];

const Header: React.FC<HeaderProps> = ({
  route,
  onNavigate,
  onRun,
  onShare,
  shareLabel,
  isRunning,
  theme,
  onToggleTheme,
  onOpenShortcuts,
  summary,
}) => {
  return (
    <header className='app-header'>
      <a
        href='#/'
        className='brand'
        onClick={(event) => {
          event.preventDefault();
          onNavigate('home');
        }}
        aria-label='CodeReel home'
      >
        <BrandMark size={36} />
        <span className='brand-copy'>
          <h1 className='brand-name'>
            CodeReel
            <span className='brand-tagline'>Code Debugger &amp; Analyser</span>
            <span className='brand-beta'>beta</span>
          </h1>
          <p className='brand-sub'>
            Execution tracing · data-structure snapshots · Big-O heuristics · pattern detection
          </p>
        </span>
      </a>

      <nav className='header-nav' aria-label='Primary'>
        {NAV.map((item) => (
          <button
            key={item.id}
            type='button'
            className={`nav-link${route === item.id ? ' active' : ''}`}
            aria-current={route === item.id ? 'page' : undefined}
            onClick={() => onNavigate(item.id)}
          >
            {item.label}
          </button>
        ))}
      </nav>

      <div className='header-stats' aria-live='polite'>
        {summary ? (
          <>
            <span>
              <b style={{ color: 'var(--accent)' }}>{summary.steps}</b> steps
            </span>
            <span>
              <b style={{ color: 'var(--green)' }}>{summary.time}</b> time
            </span>
            <span>
              <b style={{ color: 'var(--purple)' }}>{summary.space}</b> space
            </span>
            {summary.ms !== undefined && (
              <span>
                <b style={{ color: 'var(--yellow)' }}>{summary.ms} ms</b>
              </span>
            )}
          </>
        ) : (
          <span className='chip'>Ready when you are</span>
        )}
      </div>

      <div className='header-actions'>
        {route === 'home' && (
          <>
            <button
              type='button'
              className='btn btn-ghost'
              onClick={onShare}
              title='Copy a shareable link to this code and input'
            >
              <svg width='13' height='13' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' aria-hidden='true'>
                <circle cx='18' cy='5' r='3' />
                <circle cx='6' cy='12' r='3' />
                <circle cx='18' cy='19' r='3' />
                <path d='M8.6 10.6 15.4 6.4M8.6 13.4 15.4 17.6' />
              </svg>
              {shareLabel}
            </button>
            <button
              type='button'
              className='btn btn-primary'
              onClick={onRun}
              disabled={isRunning}
              title='Run and trace (Ctrl/Cmd + Enter)'
            >
              {isRunning ? (
                <span className='cr-spin' aria-hidden='true'>
                  <svg width='13' height='13' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2.4'>
                    <path d='M12 3a9 9 0 1 0 9 9' strokeLinecap='round' />
                  </svg>
                </span>
              ) : (
                <svg width='13' height='13' viewBox='0 0 24 24' fill='currentColor' aria-hidden='true'>
                  <path d='M7 4.5 19 12 7 19.5Z' />
                </svg>
              )}
              {isRunning ? 'Tracing…' : 'Run & Trace'}
            </button>
          </>
        )}

        <button
          type='button'
          className='icon-btn'
          onClick={onOpenShortcuts}
          title='Keyboard shortcuts (?)'
          aria-label='Keyboard shortcuts'
        >
          <svg width='15' height='15' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='1.9' aria-hidden='true'>
            <rect x='2' y='6' width='20' height='12' rx='2.5' />
            <path d='M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10' strokeLinecap='round' />
          </svg>
        </button>

        <button
          type='button'
          className='icon-btn'
          onClick={onToggleTheme}
          title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
          aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
        >
          {theme === 'dark' ? (
            <svg width='15' height='15' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='1.9' aria-hidden='true'>
              <circle cx='12' cy='12' r='4' />
              <path d='M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4' strokeLinecap='round' />
            </svg>
          ) : (
            <svg width='15' height='15' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='1.9' aria-hidden='true'>
              <path d='M20.5 14.3A8.5 8.5 0 0 1 9.7 3.5 8.5 8.5 0 1 0 20.5 14.3Z' strokeLinejoin='round' />
            </svg>
          )}
        </button>
      </div>
    </header>
  );
};

export default Header;
