import React from 'react';
import Editor from '@monaco-editor/react';
import { CircleAlert, Loader2, Play, RotateCcw, SkipBack, SkipForward, Square } from 'lucide-react';
import type { Preset } from '../utils/presets';
import { detectLanguage } from '../utils/languageDetect';
import { useTheme } from '../theme/ThemeProvider';

interface CodeEditorProps {
  code: string;
  onChange: (value: string | undefined) => void;
  onRunTrace: () => void;
  onStepForward: () => void;
  onStepBack: () => void;
  onReset: () => void;
  testInput: string;
  onTestInputChange: (value: string) => void;
  currentLine?: number;
  language: string;
  onLanguageChange: (lang: string) => void;
  isPlaying: boolean;
  onTogglePlay: () => void;
  playSpeed: number;
  onPlaySpeedChange: (speed: number) => void;
  onLanguageDetected?: (language: string) => void;
  presets: Preset[];
  presetId: string;
  onPresetSelect: (id: string) => void;
  isRunning: boolean;
  runError?: string | null;
}

const LANGUAGES: Array<{ id: string; label: string; traced: boolean }> = [
  { id: 'javascript', label: 'JavaScript', traced: true },
  { id: 'typescript', label: 'TypeScript', traced: true },
  { id: 'python', label: 'Python', traced: true },
  { id: 'java', label: 'Java', traced: false },
  { id: 'cpp', label: 'C++', traced: false },
  { id: 'c', label: 'C', traced: false },
  { id: 'go', label: 'Go', traced: false },
  { id: 'rust', label: 'Rust', traced: false },
];

const CodeEditor: React.FC<CodeEditorProps> = ({
  code,
  onChange,
  onRunTrace,
  onStepForward,
  onStepBack,
  onReset,
  testInput,
  onTestInputChange,
  currentLine,
  language,
  onLanguageChange,
  isPlaying,
  onTogglePlay,
  playSpeed,
  onPlaySpeedChange,
  onLanguageDetected,
  presets,
  presetId,
  onPresetSelect,
  isRunning,
  runError,
}) => {
  const editorRef = React.useRef<any>(null);
  const monacoRef = React.useRef<any>(null);
  const decorationsRef = React.useRef<any>(null);
  const detectRef = React.useRef(onLanguageDetected);
  const { isDark } = useTheme();

  React.useEffect(() => {
    detectRef.current = onLanguageDetected;
  }, [onLanguageDetected]);

  const handleEditorDidMount = (editor: any, monaco: any) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
    // Detect the language whenever the user pastes a snippet.
    editor.onDidPaste?.(() => {
      window.setTimeout(() => {
        const detected = detectLanguage(editor.getValue());
        if (detected) detectRef.current?.(detected);
      }, 0);
    });
  };

  const handleAutoDetect = () => {
    const detected = detectLanguage(code);
    if (detected) onLanguageDetected?.(detected);
  };

  React.useEffect(() => {
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    if (!editor || !monaco || !currentLine || currentLine < 1) {
      decorationsRef.current?.clear?.();
      return;
    }
    const range = new monaco.Range(currentLine, 1, currentLine, 1);
    const decorations = [
      {
        range,
        options: {
          isWholeLine: true,
          className: 'codereel-current-line',
          glyphMarginClassName: 'codereel-current-glyph',
        },
      },
    ];
    if (!decorationsRef.current) {
      decorationsRef.current = editor.createDecorationsCollection(decorations);
    } else {
      decorationsRef.current.set(decorations);
    }
    editor.revealLineInCenterIfOutsideViewport(currentLine);
  }, [currentLine]);

  const activeLanguage = LANGUAGES.find((lang) => lang.id === language);
  const activePreset = presets.find((preset) => preset.id === presetId);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <div style={{ flex: 1, minHeight: 180, background: 'var(--editor-bg)' }}>
        <Editor
          height='100%'
          defaultLanguage='javascript'
          language={language === 'cpp' ? 'cpp' : language === 'c' ? 'c' : language}
          value={code}
          onChange={onChange}
          onMount={handleEditorDidMount}
          theme={isDark ? 'vs-dark' : 'vs'}
          options={{
            minimap: { enabled: false },
            fontSize: 13,
            lineNumbers: 'on',
            scrollBeyondLastLine: false,
            automaticLayout: true,
            glyphMargin: true,
            renderLineHighlight: 'none',
            padding: { top: 10, bottom: 10 },
            smoothScrolling: true,
            tabSize: 2,
            fontFamily: "'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace",
          }}
        />
      </div>

      <div
        style={{
          borderTop: '1px solid var(--border)',
          background: 'var(--bg-panel)',
          padding: 10,
          maxHeight: '48%',
          overflow: 'auto',
          flexShrink: 0,
        }}
        className='custom-scroll'
      >
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 8, marginBottom: 8 }}>
          <div>
            <label className='field-label' htmlFor='preset-select'>
              Preset algorithm
            </label>
            <select
              id='preset-select'
              value={presetId}
              onChange={(e) => onPresetSelect(e.target.value)}
              className='field'
            >
              <option value='custom'>Custom code (editable)</option>
              {presets.map((preset) => (
                <option key={preset.id} value={preset.id}>
                  {preset.name} — {preset.category}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label
              className='field-label'
              htmlFor='language-select'
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 6 }}
            >
              <span>
                Language
                {activeLanguage && !activeLanguage.traced && (
                  <span style={{ color: 'var(--yellow)', marginLeft: 6, fontSize: 10 }}>(output only)</span>
                )}
              </span>
              <button
                type='button'
                onClick={handleAutoDetect}
                title='Detect the language from the current code'
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--accent)',
                  cursor: 'pointer',
                  fontSize: 10,
                  padding: 0,
                  fontWeight: 650,
                }}
              >
                auto-detect
              </button>
            </label>
            <select
              id='language-select'
              value={language}
              onChange={(e) => onLanguageChange(e.target.value)}
              className='field'
            >
              {LANGUAGES.map((lang) => (
                <option key={lang.id} value={lang.id}>
                  {lang.label}
                  {lang.traced ? '' : ' — sandbox'}
                </option>
              ))}
            </select>
          </div>
        </div>

        {activePreset && (
          <div
            style={{
              color: 'var(--text-muted)',
              fontSize: 10.5,
              marginBottom: 8,
              lineHeight: 1.45,
            }}
          >
            {activePreset.description}
            {activePreset.expected && (
              <span style={{ color: 'var(--green)', marginLeft: 4 }}>
                Expected: {activePreset.expected}
              </span>
            )}
          </div>
        )}

        <label className='field-label' htmlFor='test-input'>
          Test input (JSON)
        </label>
        <input
          id='test-input'
          type='text'
          value={testInput}
          onChange={(e) => onTestInputChange(e.target.value)}
          className='field mono'
          style={{ marginBottom: 8 }}
          placeholder='e.g. {"nums": [2, 7, 11, 15], "target": 9}'
        />

        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          <button
            type='button'
            onClick={onRunTrace}
            disabled={isRunning}
            className='btn btn-primary'
            title='Run and trace (Ctrl/Cmd + Enter)'
          >
            {isRunning ? <Loader2 size={13} className='cr-spin' /> : <Play size={13} />}
            {isRunning ? 'Tracing…' : 'Run & Trace'}
          </button>
          <button
            type='button'
            onClick={onTogglePlay}
            className='btn btn-ghost'
            title='Auto play the trace'
          >
            {isPlaying ? <Square size={12} /> : <Play size={12} />}
            {isPlaying ? 'Stop' : 'Auto Play'}
          </button>
          <button type='button' onClick={onStepBack} className='icon-btn' title='Step back' aria-label='Step back'>
            <SkipBack size={13} />
          </button>
          <button
            type='button'
            onClick={onStepForward}
            className='icon-btn'
            title='Step forward'
            aria-label='Step forward'
          >
            <SkipForward size={13} />
          </button>
          <button
            type='button'
            onClick={onReset}
            className='icon-btn'
            title='Reset to first step'
            aria-label='Reset to first step'
          >
            <RotateCcw size={13} />
          </button>
        </div>

        {runError && (
          <div
            style={{
              marginTop: 8,
              display: 'flex',
              gap: 6,
              alignItems: 'flex-start',
              background: 'var(--red-soft)',
              border: '1px solid var(--red-border)',
              borderRadius: 6,
              padding: '6px 8px',
              color: 'var(--red)',
              fontSize: 11,
              lineHeight: 1.5,
            }}
          >
            <CircleAlert size={13} style={{ flexShrink: 0, marginTop: 1 }} />
            <span>{runError}</span>
          </div>
        )}

        <div style={{ marginTop: 8 }}>
          <label className='field-label' htmlFor='playback-speed'>
            Playback speed <span style={{ color: 'var(--accent)' }}>{playSpeed} ms</span>
          </label>
          <input
            id='playback-speed'
            type='range'
            min='80'
            max='1200'
            step='20'
            value={playSpeed}
            onChange={(e) => onPlaySpeedChange(Number(e.target.value))}
            style={{ width: '100%', accentColor: 'var(--accent-strong)' }}
          />
        </div>
      </div>
    </div>
  );
};

export default CodeEditor;
