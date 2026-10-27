import React from 'react';
import { SITE } from '../site';

interface FooterProps {
  route: 'home' | 'about' | 'contact';
  onNavigate: (route: 'home' | 'about' | 'contact') => void;
  onOpenShortcuts: () => void;
  isRunning?: boolean;
}

const Footer: React.FC<FooterProps> = ({ route, onNavigate, onOpenShortcuts, isRunning }) => {
  return (
    <footer className='app-footer'>
      <span className='footer-status'>
        <span
          className='status-dot'
          style={{
            background: isRunning ? 'var(--yellow)' : 'var(--green)',
            boxShadow: isRunning ? '0 0 8px var(--yellow)' : '0 0 8px var(--green)',
          }}
          aria-hidden='true'
        />
        {isRunning
          ? 'Tracing in progress…'
          : 'JS/TS trace locally · Python & compiled languages use the Wandbox sandbox'}
      </span>

      {route === 'home' && (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <kbd className='kbd'>←</kbd>
          <kbd className='kbd'>→</kbd>
          step
          <kbd className='kbd' style={{ marginLeft: 4 }}>Space</kbd>
          play
        </span>
      )}

      <span className='footer-links'>
        <button type='button' className='footer-link' onClick={() => onNavigate('about')}>
          About the developer
        </button>
        <button type='button' className='footer-link' onClick={() => onNavigate('contact')}>
          Contact
        </button>
        <a className='footer-link' href={SITE.repo} target='_blank' rel='noreferrer noopener'>
          Source
        </a>
        <button type='button' className='footer-link' onClick={onOpenShortcuts}>
          Shortcuts
        </button>
        <span className='footer-sep' aria-hidden='true' />
        <span className='footer-link' style={{ cursor: 'default' }} title='Release version'>
          {SITE.name} v{SITE.version}
        </span>
      </span>
    </footer>
  );
};

export default Footer;
