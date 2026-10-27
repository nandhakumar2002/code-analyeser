/**
 * Wandbox sandbox client.
 *
 * The public Piston API is whitelist-only now, so remote execution for the
 * non-JS languages goes through Wandbox (CORS enabled, no key required).
 */

export interface SandboxResult {
  stdout: string;
  stderr: string;
  compilerError: string;
  status: string;
  timedOut?: boolean;
  rateLimited?: boolean;
  error?: string;
}

interface WandboxResponse {
  status?: string;
  compiler_error?: string;
  program_output?: string;
  program_error?: string;
  program_message?: string;
  compiler_output?: string;
}

const WANDBOX_URL = 'https://wandbox.org/api/compile.json';

export const WANDBOX_COMPILERS: Record<string, string> = {
  python: 'cpython-3.13.8',
  java: 'openjdk-jdk-22+36',
  cpp: 'gcc-13.2.0',
  c: 'gcc-13.2.0-c',
  go: 'go-1.23.2',
  rust: 'rust-1.82.0',
  typescript: 'typescript-5.6.2',
  javascript: 'nodejs-20.17.0',
};

export const LANGUAGE_LABELS: Record<string, string> = {
  python: 'Python 3.13',
  java: 'Java 22',
  cpp: 'C++ (gcc 13)',
  c: 'C (gcc 13)',
  go: 'Go 1.23',
  rust: 'Rust 1.82',
  typescript: 'TypeScript 5.6',
  javascript: 'Node 20',
};

/**
 * Wandbox compiles Java sources as `prog.java`, which rejects any top-level
 * `public class X` unless the class is named `prog`. Dropping the `public`
 * modifier keeps the code valid for the usual LeetCode `class Solution { ... }`
 * shape and for a `class Main` + `Solution` pair.
 */
export function prepareJavaSource(code: string): string {
  return code.replace(/^([ \t]*)public[ \t]+(?=(?:final[ \t]+|abstract[ \t]+)?(?:class|interface|enum|record)\b)/gm, '$1');
}

export function prepareSource(language: string, code: string): string {
  return language === 'java' ? prepareJavaSource(code) : code;
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Compile + run a source file on Wandbox.
 *
 * Retries rate-limited (429) and server-side (5xx) responses with a short
 * backoff, and aborts requests that take too long.
 */
export async function runSandbox(
  language: string,
  code: string,
  stdin: string = '',
  options: { timeoutMs?: number; retries?: number } = {},
): Promise<SandboxResult> {
  const compiler = WANDBOX_COMPILERS[language];
  if (!compiler) {
    return {
      stdout: '',
      stderr: '',
      compilerError: '',
      status: 'error',
      error: `Unsupported language: ${language}`,
    };
  }

  const timeoutMs = options.timeoutMs ?? 30000;
  const retries = options.retries ?? 4;
  const payload: Record<string, string> = {
    compiler,
    code: prepareSource(language, code),
  };
  if (stdin) payload.stdin = stdin;

  let lastError = '';

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(WANDBOX_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (response.status === 429) {
        lastError = 'Too many requests';
        if (attempt < retries) {
          await sleep(3000 + attempt * 2000);
          continue;
        }
        return {
          stdout: '',
          stderr: '',
          compilerError: '',
          status: 'rate-limited',
          rateLimited: true,
          error: 'The Wandbox sandbox is rate limiting requests. Wait a few seconds and run again.',
        };
      }

      if (response.status >= 500) {
        lastError = `HTTP ${response.status}`;
        if (attempt < retries) {
          await sleep(1200 + attempt * 1200);
          continue;
        }
        return {
          stdout: '',
          stderr: '',
          compilerError: '',
          status: 'error',
          error: `The Wandbox sandbox returned HTTP ${response.status}. Try again shortly.`,
        };
      }

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        return {
          stdout: '',
          stderr: '',
          compilerError: text.slice(0, 500),
          status: `http-${response.status}`,
          error: `Sandbox request failed (HTTP ${response.status}).`,
        };
      }

      const data = (await response.json()) as WandboxResponse;
      const compilerError = data.compiler_error || '';
      const stdout = data.program_output ?? '';
      // `program_message` mirrors stdout on successful runs, so only use the
      // dedicated error channel here.
      const stderr = data.program_error || '';

      return {
        stdout,
        stderr,
        compilerError,
        status: String(data.status ?? '0'),
      };
    } catch (error: any) {
      if (error?.name === 'AbortError') {
        return {
          stdout: '',
          stderr: '',
          compilerError: '',
          status: 'timeout',
          timedOut: true,
          error: `Sandbox execution exceeded ${Math.round(timeoutMs / 1000)}s and was aborted.`,
        };
      }
      lastError = error?.message || String(error);
      if (attempt < retries) {
        await sleep(1000 + attempt * 1000);
        continue;
      }
      return {
        stdout: '',
        stderr: '',
        compilerError: '',
        status: 'error',
        error: `Sandbox unavailable: ${lastError}`,
      };
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    stdout: '',
    stderr: '',
    compilerError: '',
    status: 'error',
    error: `Sandbox unavailable: ${lastError || 'unknown error'}`,
  };
}
