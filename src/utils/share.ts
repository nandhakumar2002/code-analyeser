export interface SharePayload {
  code: string;
  input: string;
  language: string;
}

const PARAM = 's';
const MAX_ENCODED_LENGTH = 7000;

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(value: string): Uint8Array {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

export function encodeShare(payload: SharePayload): string | null {
  try {
    const json = JSON.stringify(payload);
    const encoded = toBase64Url(new TextEncoder().encode(json));
    if (encoded.length > MAX_ENCODED_LENGTH) return null;
    return encoded;
  } catch {
    return null;
  }
}

export function decodeShare(value: string): SharePayload | null {
  try {
    const json = new TextDecoder().decode(fromBase64Url(value));
    const parsed = JSON.parse(json) as Partial<SharePayload>;
    if (typeof parsed.code !== 'string' || typeof parsed.language !== 'string') return null;
    return {
      code: parsed.code,
      input: typeof parsed.input === 'string' ? parsed.input : '',
      language: parsed.language,
    };
  } catch {
    return null;
  }
}

export function readShareFromLocation(): SharePayload | null {
  if (typeof window === 'undefined') return null;
  const hash = window.location.hash;
  const queryIndex = hash.indexOf('?');
  if (queryIndex === -1) return null;
  const params = new URLSearchParams(hash.slice(queryIndex + 1));
  const value = params.get(PARAM);
  return value ? decodeShare(value) : null;
}

export function buildShareUrl(payload: SharePayload): string | null {
  const encoded = encodeShare(payload);
  if (!encoded) return null;
  const base = `${window.location.origin}${window.location.pathname}`;
  return `${base}#/?${PARAM}=${encoded}`;
}

export function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
