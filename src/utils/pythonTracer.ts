import template from './pythonTracerTemplate.py?raw';
import { runSandbox } from './wandboxRunner';
import type { ASTNodeInfo, DataStructureView, ExecutionStep, VariableState } from '../types';

const MARK = '__CODEREEL_TRACE__';
const END = '__CODEREEL_END__';

export interface PythonTracePayload {
  steps: ExecutionStep[];
  outputs: string[];
  error: string | null;
  errorLine?: number;
  truncated: boolean;
  entryPoint: string;
  returnValue: VariableState | null;
  finalStructures: DataStructureView[];
  astNodes: ASTNodeInfo[];
  elapsedMs: number;
}

export interface PythonTraceOutcome {
  payload?: PythonTracePayload;
  error?: string;
  /** Set for sandbox failures that callers should surface verbatim. */
  fatal?: boolean;
  /** Sandbox/transport failure - retrying with a plain run is pointless. */
  transport?: boolean;
}

function toBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

/**
 * Build the `sys.settrace` harness with the user's source and test input
 * embedded as base64 (safe for arbitrary Unicode / quotes / newlines).
 */
export function buildPythonHarness(code: string, input: unknown): string {
  const codeB64 = toBase64(code);
  const inputExpr =
    input === undefined
      ? 'None'
      : `json.loads(base64.b64decode("${toBase64(JSON.stringify(input))}").decode("utf-8"))`;
  return template.replace('__AL_USER_CODE_B64__', codeB64).replace('__AL_INPUT_DATA__', inputExpr);
}

export async function tracePython(code: string, input: unknown): Promise<PythonTraceOutcome> {
  const harness = buildPythonHarness(code, input);
  const result = await runSandbox('python', harness, '', { timeoutMs: 40000, retries: 3 });

  if (result.rateLimited || result.timedOut || result.error) {
    return { error: result.error || 'Python sandbox request failed.', fatal: true, transport: true };
  }

  if (result.compilerError.trim()) {
    return { error: `Python tracer failed to compile:\n${result.compilerError.trim()}`, fatal: true };
  }

  const start = result.stdout.lastIndexOf(MARK);
  const end = start >= 0 ? result.stdout.indexOf(END, start + MARK.length) : -1;
  if (start < 0 || end < 0) {
    const stderr = result.stderr.trim();
    return {
      error: stderr
        ? `Python tracer returned no trace:\n${stderr.slice(0, 500)}`
        : 'Python tracer returned no trace data.',
      fatal: true,
    };
  }

  try {
    const parsed = JSON.parse(result.stdout.slice(start + MARK.length, end)) as PythonTracePayload;
    return {
      payload: {
        steps: Array.isArray(parsed.steps) ? parsed.steps : [],
        outputs: Array.isArray(parsed.outputs) ? parsed.outputs : [],
        error: parsed.error ?? null,
        errorLine: parsed.errorLine,
        truncated: Boolean(parsed.truncated),
        entryPoint: parsed.entryPoint || '',
        returnValue: parsed.returnValue ?? null,
        finalStructures: Array.isArray(parsed.finalStructures) ? parsed.finalStructures : [],
        astNodes: Array.isArray(parsed.astNodes) ? parsed.astNodes : [],
        elapsedMs: Number(parsed.elapsedMs) || 0,
      },
    };
  } catch (error: any) {
    return { error: `Could not parse the Python trace: ${error?.message || error}`, fatal: true };
  }
}
