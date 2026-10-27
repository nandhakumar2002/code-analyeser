import React from 'react';
import {
  ArrowLeft,
  Check,
  Clock,
  Code2,
  Copy,
  ExternalLink,
  Globe,
  Info,
  Mail,
  MapPin,
  MessageSquare,
  Send,
} from 'lucide-react';
import { useDocumentMeta } from '../hooks/useDocumentMeta';
import { SITE } from '../site';
import { copyText } from '../utils/clipboard';

interface ContactPageProps {
  onNavigate: (route: 'home' | 'about' | 'contact') => void;
}

const ContactPage: React.FC<ContactPageProps> = ({ onNavigate }) => {
  useDocumentMeta({
    title: `Contact · ${SITE.name} — ${SITE.tagline}`,
    description:
      'Report a bug, request a language or feature, or send feedback about the CodeReel visual code debugger and complexity analyser.',
    path: '/#/contact',
    keywords:
      'contact CodeReel, code debugger feedback, bug report, feature request, code analyser support',
  });

  const dev = SITE.developer;
  const [name, setName] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [topic, setTopic] = React.useState('Bug report');
  const [message, setMessage] = React.useState('');
  const [status, setStatus] = React.useState<'idle' | 'copied' | 'mailto' | 'error'>('idle');

  const composed = React.useMemo(() => {
    const lines = [
      `Topic: ${topic}`,
      name ? `From: ${name}${email ? ` <${email}>` : ''}` : email ? `From: ${email}` : '',
      '',
      message || '(no message yet)',
      '',
      '---',
      `Sent from ${SITE.name} · ${SITE.url}`,
    ];
    return lines.filter((line) => line !== '').join('\n');
  }, [topic, name, email, message]);

  const mailtoHref = React.useMemo(() => {
    const subject = `[${SITE.name}] ${topic}${name ? ` — ${name}` : ''}`;
    return `mailto:${dev.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(composed)}`;
  }, [dev.email, topic, name, composed]);

  const handleCopy = async () => {
    const copied = await copyText(composed);
    setStatus(copied ? 'copied' : 'error');
  };

  return (
    <div className='page'>
      <div className='page-inner' style={{ maxWidth: 980 }}>
        <button
          type='button'
          className='footer-link'
          style={{ marginBottom: 16, paddingLeft: 0 }}
          onClick={() => onNavigate('home')}
        >
          <ArrowLeft size={13} /> Back to the playground
        </button>

        <section className='page-hero'>
          <span className='eyebrow'>
            <MessageSquare size={13} /> Contact
          </span>
          <h1>
            Talk to the <span className='grad'>developer.</span>
          </h1>
          <p>
            Found a program that traces incorrectly? Want another language, a new visualiser or a
            different complexity model? Send the details — bug reports and concrete examples get
            priority.
          </p>
        </section>

        <div className='contact-grid' style={{ marginTop: 30 }}>
          <form
            className='card'
            style={{ padding: 20 }}
            onSubmit={(event) => {
              event.preventDefault();
              setStatus('mailto');
              window.location.href = mailtoHref;
            }}
          >
            <h2 style={{ margin: '0 0 4px', fontSize: 16 }}>Send a message</h2>
            <p style={{ margin: '0 0 16px', color: 'var(--text-muted)', fontSize: 11.5 }}>
              This form opens your email app with the message pre-filled. Nothing is sent to a
              server by {SITE.name}.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label className='field-label' htmlFor='contact-name'>
                  Your name
                </label>
                <input
                  id='contact-name'
                  className='field'
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder='Ada Lovelace'
                  autoComplete='name'
                />
              </div>
              <div>
                <label className='field-label' htmlFor='contact-email'>
                  Your email
                </label>
                <input
                  id='contact-email'
                  className='field'
                  type='email'
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder='you@example.com'
                  autoComplete='email'
                />
              </div>
            </div>

            <div style={{ marginTop: 10 }}>
              <label className='field-label' htmlFor='contact-topic'>
                Topic
              </label>
              <select
                id='contact-topic'
                className='field'
                value={topic}
                onChange={(event) => setTopic(event.target.value)}
              >
                <option>Bug report</option>
                <option>Feature request</option>
                <option>Language support</option>
                <option>Collaboration</option>
                <option>Something else</option>
              </select>
            </div>

            <div style={{ marginTop: 10 }}>
              <label className='field-label' htmlFor='contact-message'>
                Message
              </label>
              <textarea
                id='contact-message'
                className='field'
                rows={7}
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                placeholder={
                  'What happened?\n\nInclude the language, the code or a share link, the test input, and what you expected to see.'
                }
                style={{ resize: 'vertical', minHeight: 130, fontFamily: 'inherit' }}
              />
            </div>

            <div className='form-actions' style={{ marginTop: 12 }}>
              <button type='submit' className='btn btn-primary' disabled={!message.trim()}>
                <Send size={12} /> Open in email app
              </button>
              <button type='button' className='btn btn-ghost' onClick={handleCopy}>
                <Copy size={12} /> Copy message
              </button>
            </div>

            <div aria-live='polite' style={{ marginTop: 10 }}>
              {status === 'copied' && (
                <div className='notice success'>
                  <Check size={14} /> Message copied to your clipboard.
                </div>
              )}
              {status === 'mailto' && (
                <div className='notice'>
                  <Info size={14} /> Your email app should open. If nothing happens, copy the message
                  and send it to <strong>{dev.email}</strong>.
                </div>
              )}
              {status === 'error' && (
                <div className='notice'>
                  <Info size={14} /> Clipboard access was blocked. Select the message text and copy it
                  manually, or use the email link on the right.
                </div>
              )}
            </div>
          </form>

          <aside style={{ display: 'grid', gap: 14 }}>
            <div className='profile-card' style={{ position: 'static' }}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <Mail size={15} style={{ color: 'var(--accent)' }} /> Direct contact
              </h3>
              <div className='profile-links'>
                <a className='profile-link' href={`mailto:${dev.email}`}>
                  <Mail size={13} /> {dev.email}
                </a>
                <a className='profile-link' href={dev.github} target='_blank' rel='noreferrer noopener'>
                  <Code2 size={13} /> {dev.handle} on GitHub{' '}
                  <ExternalLink size={11} style={{ marginLeft: 'auto' }} />
                </a>
                <a className='profile-link' href={dev.linkedin} target='_blank' rel='noreferrer noopener'>
                  <Globe size={13} /> LinkedIn <ExternalLink size={11} style={{ marginLeft: 'auto' }} />
                </a>
              </div>
              <p
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  margin: '12px 0 0',
                  color: 'var(--text-muted)',
                  fontSize: 11,
                }}
              >
                <MapPin size={12} /> {dev.location}
              </p>
            </div>

            <div className='card' style={{ padding: 16 }}>
              <h3 style={{ margin: '0 0 8px', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Clock size={13} style={{ color: 'var(--accent)' }} /> Before you send
              </h3>
              <ul
                style={{
                  margin: 0,
                  paddingLeft: 17,
                  color: 'var(--text-secondary)',
                  fontSize: 11.5,
                  lineHeight: 1.7,
                }}
              >
                <li>Include the language and the smallest code that reproduces the issue.</li>
                <li>Paste the JSON test input, or use the Share button to generate a link.</li>
                <li>Say whether the problem is a wrong step, a wrong value, or a crash.</li>
                <li>Sandbox errors should include the exact message shown in the debugger.</li>
              </ul>
            </div>

            <div className='notice'>
              <Info size={14} style={{ flexShrink: 0 }} />
              <span>
                {SITE.name} has no account system or backend inbox. Messages go straight to the
                developer’s email — there is no tracking and no mailing list.
              </span>
            </div>
          </aside>
        </div>

        <section className='page-section' aria-labelledby='feedback-heading'>
          <h2 id='feedback-heading'>What kind of feedback helps most</h2>
          <div className='feature-grid' style={{ marginTop: 14 }}>
            <article className='feature-card'>
              <div className='feature-icon'>
                <Code2 size={16} />
              </div>
              <h3>Reproductions</h3>
              <p>
                A share link plus one sentence about what looked wrong is enough to debug most trace
                issues.
              </p>
            </article>
            <article className='feature-card'>
              <div className='feature-icon'>
                <Globe size={16} />
              </div>
              <h3>Language gaps</h3>
              <p>
                Tell me which construct failed — classes, generators, async, templates, ownership —
                and what output you expected.
              </p>
            </article>
            <article className='feature-card'>
              <div className='feature-icon'>
                <MessageSquare size={16} />
              </div>
              <h3>Teaching use cases</h3>
              <p>
                If you run workshops or courses, describe the exercise. Example-driven requests shape
                the roadmap.
              </p>
            </article>
          </div>
        </section>
      </div>
    </div>
  );
};

export default ContactPage;
