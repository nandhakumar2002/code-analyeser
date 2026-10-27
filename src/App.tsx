import React from 'react';
import { Check, Info, X } from 'lucide-react';
import CodeEditor from './components/CodeEditor';
import DebuggerPanel from './components/DebuggerPanel';
import Footer from './components/Footer';
import Header from './components/Header';
import ShortcutsModal from './components/ShortcutsModal';
import AboutPage from './pages/AboutPage';
import ContactPage from './pages/ContactPage';
import { useHashRoute } from './hooks/useHashRoute';
import { useTheme } from './theme/ThemeProvider';
import { SITE } from './site';
import type { TraceResult } from './types';
import { analyzeAST, generateTrace } from './utils/astAnalyzer';
import { PRESETS, PRESET_LOOKUP } from './utils/presets';
import { LANGUAGE_TEMPLATES } from './utils/templates';
import { buildShareUrl, readShareFromLocation } from './utils/share';
import { copyText } from './utils/clipboard';

const DEFAULT_PRESET = 'two-sum';
const SESSION_KEY = `${SITE.storagePrefix}:session`;
const VALID_LANGUAGES = new Set(Object.keys(LANGUAGE_TEMPLATES));

interface SessionSnapshot {
  code: string;
  testInput: string;
  language: string;
}

interface BootstrapState extends SessionSnapshot {
  presetId: string;
  shared: boolean;
}

function readSession(): SessionSnapshot | null {
  try {
    const raw = window.localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SessionSnapshot>;
    if (typeof parsed.code !== 'string' || typeof parsed.language !== 'string') return null;
    if (!VALID_LANGUAGES.has(parsed.language)) return null;
    return {
      code: parsed.code,
      testInput: typeof parsed.testInput === 'string' ? parsed.testInput : '',
      language: parsed.language,
    };
  } catch {
    return null;
  }
}

function readBootstrap(): BootstrapState {
  const shared = readShareFromLocation();
  if (shared) {
    return {
      code: shared.code,
      testInput: shared.input,
      language: VALID_LANGUAGES.has(shared.language) ? shared.language : 'javascript',
      presetId: 'custom',
      shared: true,
    };
  }
  const session = readSession();
  if (session) return { ...session, presetId: 'custom', shared: false };
  const preset = PRESET_LOOKUP[DEFAULT_PRESET];
  return {
    code: preset.code,
    testInput: preset.testInput,
    language: preset.language,
    presetId: DEFAULT_PRESET,
    shared: false,
  };
}

function App() {
  const { theme, toggleTheme } = useTheme();
  const { route, navigate } = useHashRoute();
  const [bootstrap] = React.useState(readBootstrap);
  const [code, setCode] = React.useState(bootstrap.code);
  const [testInput, setTestInput] = React.useState(bootstrap.testInput);
  const [traceResult, setTraceResult] = React.useState<TraceResult | null>(null);
  const [currentStepIndex, setCurrentStepIndex] = React.useState(0);
  const [language, setLanguage] = React.useState<string>(bootstrap.language);
  const [presetId, setPresetId] = React.useState(bootstrap.presetId);
  const [isPlaying, setIsPlaying] = React.useState(false);
  const [playSpeed, setPlaySpeed] = React.useState(420);
  const [isRunning, setIsRunning] = React.useState(false);
  const [runError, setRunError] = React.useState<string | null>(null);
  const [shortcutsOpen, setShortcutsOpen] = React.useState(false);
  const [shareLabel, setShareLabel] = React.useState('Share');
  const [toast, setToast] = React.useState<{ message: string; tone: 'info' | 'success' } | null>(
    bootstrap.shared
      ? {
          message: 'Shared program loaded. Press Run & Trace to rebuild the execution timeline.',
          tone: 'info',
        }
      : null,
  );
  const playIntervalRef = React.useRef<number | null>(null);

  const stopPlayback = React.useCallback(() => {
    setIsPlaying(false);
    if (playIntervalRef.current) {
      clearInterval(playIntervalRef.current);
      playIntervalRef.current = null;
    }
  }, []);

  const handleRunTrace = React.useCallback(async () => {
    stopPlayback();
    if (route !== 'home') navigate('home');
    setRunError(null);
    setIsRunning(true);
    await new Promise<void>((resolve) => setTimeout(resolve, 30));
    try {
      const analysis = analyzeAST(code, language);
      const trace = await generateTrace(code, testInput, language);
      const result: TraceResult = {
        steps: trace.steps,
        complexity: analysis.complexity,
        astNodes: trace.astNodes && trace.astNodes.length > 0 ? trace.astNodes : analysis.astNodes,
        patterns: analysis.patterns,
        metrics: trace.metrics,
        lineMetrics: trace.lineMetrics,
        error: trace.error,
        errorLine: trace.errorLine,
        outputs: trace.outputs,
        returnValue: trace.returnValue ?? null,
        entryPoint: trace.entryPoint,
        truncated: trace.truncated,
        outputOnly: trace.outputOnly,
        language,
        finalStructures: trace.finalStructures || [],
        inputStructures: trace.inputStructures || [],
      };
      setTraceResult(result);
      setCurrentStepIndex(0);
      if (trace.error) setRunError(trace.error);
    } catch (e: any) {
      const message = e?.message ?? 'Execution failed';
      setTraceResult(null);
      setRunError(message);
    } finally {
      setIsRunning(false);
    }
  }, [code, testInput, language, route, navigate, stopPlayback]);

  const handleStepForward = React.useCallback(() => {
    if (!traceResult) return;
    setCurrentStepIndex((prev) => {
      if (prev < traceResult.steps.length - 1) return prev + 1;
      stopPlayback();
      return prev;
    });
  }, [traceResult, stopPlayback]);

  const handleStepBack = React.useCallback(() => {
    stopPlayback();
    setCurrentStepIndex((prev) => Math.max(0, prev - 1));
  }, [stopPlayback]);

  const handleReset = React.useCallback(() => {
    stopPlayback();
    setCurrentStepIndex(0);
  }, [stopPlayback]);

  const handleTogglePlay = React.useCallback(() => {
    if (!traceResult || traceResult.steps.length === 0) return;
    if (isPlaying) {
      stopPlayback();
    } else {
      if (currentStepIndex >= traceResult.steps.length - 1) setCurrentStepIndex(0);
      setIsPlaying(true);
    }
  }, [traceResult, isPlaying, currentStepIndex, stopPlayback]);

  const handleSeek = React.useCallback(
    (index: number) => {
      if (!traceResult) return;
      stopPlayback();
      setCurrentStepIndex(Math.max(0, Math.min(index, traceResult.steps.length - 1)));
    },
    [traceResult, stopPlayback],
  );

  const handleNavigate = React.useCallback(
    (next: 'home' | 'about' | 'contact') => {
      if (next !== 'home') stopPlayback();
      navigate(next);
    },
    [navigate, stopPlayback],
  );

  const handleShare = React.useCallback(async () => {
    const url = buildShareUrl({ code, input: testInput, language });
    if (!url) {
      setToast({
        message: 'This program is too large for a share link. Copy the code and input instead.',
        tone: 'info',
      });
      return;
    }
    const copied = await copyText(url);
    if (copied) {
      setShareLabel('Link copied');
      window.setTimeout(() => setShareLabel('Share'), 2400);
    } else {
      setToast({ message: 'Could not copy the link — clipboard access was blocked.', tone: 'info' });
    }
  }, [code, testInput, language]);

  React.useEffect(() => {
    if (isPlaying && traceResult && traceResult.steps.length > 0) {
      if (playIntervalRef.current) clearInterval(playIntervalRef.current);
      playIntervalRef.current = window.setInterval(() => {
        setCurrentStepIndex((prev) => {
          if (prev < traceResult.steps.length - 1) return prev + 1;
          setIsPlaying(false);
          if (playIntervalRef.current) {
            clearInterval(playIntervalRef.current);
            playIntervalRef.current = null;
          }
          return prev;
        });
      }, playSpeed);
    } else if (playIntervalRef.current) {
      clearInterval(playIntervalRef.current);
      playIntervalRef.current = null;
    }
    return () => {
      if (playIntervalRef.current) {
        clearInterval(playIntervalRef.current);
        playIntervalRef.current = null;
      }
    };
  }, [isPlaying, playSpeed, traceResult]);

  React.useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        window.localStorage.setItem(
          SESSION_KEY,
          JSON.stringify({ code, testInput, language } satisfies SessionSnapshot),
        );
      } catch {
        // Ignore quota / private mode failures.
      }
    }, 600);
    return () => window.clearTimeout(timer);
  }, [code, testInput, language]);

  // A share link pasted into an already-open tab only changes the hash, so the
  // initial bootstrap never sees it. Apply it when the fragment changes.
  React.useEffect(() => {
    const onHashChange = () => {
      const shared = readShareFromLocation();
      if (!shared) return;
      const sharedLanguage = VALID_LANGUAGES.has(shared.language) ? shared.language : 'javascript';
      if (shared.code === code && shared.input === testInput && sharedLanguage === language) return;
      stopPlayback();
      setCode(shared.code);
      setTestInput(shared.input);
      setLanguage(sharedLanguage);
      setPresetId('custom');
      setTraceResult(null);
      setCurrentStepIndex(0);
      setRunError(null);
      setToast({
        message: 'Shared program loaded. Press Run & Trace to rebuild the execution timeline.',
        tone: 'info',
      });
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, [code, testInput, language, stopPlayback]);

  React.useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 4200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
        event.preventDefault();
        void handleRunTrace();
        return;
      }

      // Leave browser and OS shortcuts alone (Ctrl/Cmd/Alt combinations).
      if (event.ctrlKey || event.metaKey || event.altKey) return;

      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable ||
          target.closest('.monaco-editor'))
      ) {
        return;
      }

      if (event.key === 'ArrowRight') {
        event.preventDefault();
        handleStepForward();
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        handleStepBack();
      } else if (event.key === ' ') {
        event.preventDefault();
        handleTogglePlay();
      } else if (event.key === '?') {
        event.preventDefault();
        setShortcutsOpen(true);
      } else if (event.key.toLowerCase() === 't') {
        toggleTheme();
      } else if (event.key === 'Escape') {
        setShortcutsOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleStepForward, handleStepBack, handleTogglePlay, handleRunTrace, toggleTheme]);

  const handlePresetSelect = (id: string) => {
    setPresetId(id);
    if (id === 'custom') return;
    const preset = PRESET_LOOKUP[id];
    if (!preset) return;
    stopPlayback();
    setCode(preset.code);
    setTestInput(preset.testInput);
    setLanguage(preset.language);
    setTraceResult(null);
    setCurrentStepIndex(0);
    setRunError(null);
  };

  const handleCodeChange = (value: string | undefined) => {
    const next = value || '';
    setCode(next);
    const preset = PRESET_LOOKUP[presetId];
    if (preset && next !== preset.code) setPresetId('custom');
  };

  const handleLanguageChange = (nextLanguage: string) => {
    const knownSnippets = [...Object.values(LANGUAGE_TEMPLATES), ...PRESETS.map((p) => p.code)];
    const shouldLoadTemplate = !code.trim() || knownSnippets.includes(code);
    stopPlayback();
    setLanguage(nextLanguage);
    setTraceResult(null);
    setCurrentStepIndex(0);
    setRunError(null);
    if (shouldLoadTemplate && LANGUAGE_TEMPLATES[nextLanguage]) {
      setCode(LANGUAGE_TEMPLATES[nextLanguage]);
      setPresetId('custom');
    } else if (nextLanguage === 'javascript' || nextLanguage === 'typescript') {
      // Keep the user's code as-is; it will trace with the selected parser.
    } else {
      setPresetId('custom');
    }
  };

  const handleDetectedLanguage = (detected: string) => {
    if (detected === language) return;
    stopPlayback();
    setLanguage(detected);
    setPresetId('custom');
    setTraceResult(null);
    setCurrentStepIndex(0);
    setRunError(null);
  };

  const currentStep = traceResult?.steps[currentStepIndex];
  const traced = Boolean(traceResult && traceResult.steps.length > 0);
  const headerSummary =
    traced && traceResult
      ? {
          steps: traceResult.steps.length,
          time: traceResult.complexity.timeComplexity,
          space: traceResult.complexity.spaceComplexity,
          ms: traceResult.metrics?.executionTimeMs,
        }
      : null;

  return (
    <div className='app-shell'>
      <Header
        route={route}
        onNavigate={handleNavigate}
        onRun={() => void handleRunTrace()}
        onShare={() => void handleShare()}
        shareLabel={shareLabel}
        isRunning={isRunning}
        theme={theme}
        onToggleTheme={toggleTheme}
        onOpenShortcuts={() => setShortcutsOpen(true)}
        summary={headerSummary}
      />

      <main className='app-main'>
        {route === 'home' && (
          <div className='workspace'>
            <div className='workspace-editor'>
              <CodeEditor
                code={code}
                onChange={handleCodeChange}
                onRunTrace={() => void handleRunTrace()}
                onStepForward={handleStepForward}
                onStepBack={handleStepBack}
                onReset={handleReset}
                testInput={testInput}
                onTestInputChange={setTestInput}
                currentLine={currentStep?.line}
                language={language}
                onLanguageChange={handleLanguageChange}
                isPlaying={isPlaying}
                onTogglePlay={handleTogglePlay}
                playSpeed={playSpeed}
                onPlaySpeedChange={setPlaySpeed}
                onLanguageDetected={handleDetectedLanguage}
                presets={PRESETS}
                presetId={presetId}
                onPresetSelect={handlePresetSelect}
                isRunning={isRunning}
                runError={runError}
              />
            </div>

            <div className='workspace-debugger'>
              <DebuggerPanel
                steps={traceResult?.steps || []}
                currentStepIndex={currentStepIndex}
                complexity={traceResult?.complexity || null}
                astNodes={traceResult?.astNodes || []}
                patterns={traceResult?.patterns || []}
                metrics={traceResult?.metrics || null}
                lineMetrics={traceResult?.lineMetrics || null}
                outputs={traceResult?.outputs || []}
                error={traceResult?.error || null}
                returnValue={traceResult?.returnValue || null}
                entryPoint={traceResult?.entryPoint}
                truncated={traceResult?.truncated}
                outputOnly={traceResult?.outputOnly}
                finalStructures={traceResult?.finalStructures || []}
                inputStructures={traceResult?.inputStructures || []}
                language={language}
                isPlaying={isPlaying}
                onTogglePlay={handleTogglePlay}
                onStepForward={handleStepForward}
                onStepBack={handleStepBack}
                onSeek={handleSeek}
              />
            </div>
          </div>
        )}

        {route === 'about' && <AboutPage onNavigate={handleNavigate} />}
        {route === 'contact' && <ContactPage onNavigate={handleNavigate} />}
      </main>

      <Footer
        route={route}
        onNavigate={handleNavigate}
        onOpenShortcuts={() => setShortcutsOpen(true)}
        isRunning={isRunning}
      />

      <ShortcutsModal open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />

      {toast && (
        <div className='toast' role='status' aria-live='polite'>
          {toast.tone === 'success' ? (
            <Check size={15} style={{ color: 'var(--green)', flexShrink: 0 }} />
          ) : (
            <Info size={15} style={{ color: 'var(--accent)', flexShrink: 0 }} />
          )}
          <span>{toast.message}</span>
          <button
            type='button'
            className='icon-btn small'
            onClick={() => setToast(null)}
            aria-label='Dismiss notification'
            style={{ marginLeft: 'auto' }}
          >
            <X size={12} />
          </button>
        </div>
      )}
    </div>
  );
}

export default App;
