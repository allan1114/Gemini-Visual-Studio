/**
 * MiniMax serverless proxy (Vercel Node.js Function).
 *
 * MiniMax's API (https://api.minimax.io) does not send CORS headers, so the
 * browser cannot call it directly. This same-origin endpoint forwards requests
 * server-side:
 *
 *   POST /api/minimax  — body is the MiniMax payload; `x-mm-path` selects the
 *                        API subpath (e.g. "image_generation" or
 *                        "text/chatcompletion_v2") and `x-mm-key` carries the
 *                        user's MiniMax key. Forwarded to
 *                        https://api.minimax.io/v1/{path} with a Bearer header.
 *
 * The key is supplied per-request by the client (kept in the user's browser);
 * it is never stored on the server. Only a fixed allowlist of subpaths may be
 * proxied so this can't act as an open proxy.
 */

// Image generation commonly takes longer than the Edge runtime's response-start
// limit. Use the Node.js runtime and give MiniMax enough time to finish instead
// of letting Vercel terminate otherwise healthy requests with a 504.
export const maxDuration = 300;

const MINIMAX_BASE = 'https://api.minimax.io/v1';

/** Subpaths the client is allowed to reach through this proxy. */
const ALLOWED_PATHS = new Set(['image_generation', 'text/chatcompletion_v2']);

interface VercelRequest {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  body?: unknown;
}

interface VercelResponse {
  status(code: number): VercelResponse;
  setHeader(name: string, value: string): void;
  send(body: string): void;
}

function header(req: VercelRequest, name: string): string | undefined {
  const value = req.headers[name] ?? req.headers[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : value;
}

function requestBody(body: unknown): string {
  if (typeof body === 'string') return body;
  if (body instanceof Uint8Array) return new TextDecoder().decode(body);
  return JSON.stringify(body ?? {});
}

function send(res: VercelResponse, status: number, body: string, contentType = 'text/plain') {
  res.status(status);
  res.setHeader('Content-Type', contentType);
  res.send(body);
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'POST') {
    send(res, 405, 'Method not allowed.');
    return;
  }

  const path = header(req, 'x-mm-path');
  const key = header(req, 'x-mm-key');
  if (!path || !key) {
    send(res, 400, 'Missing x-mm-path or x-mm-key header.');
    return;
  }
  // Disallow absolute URLs / path traversal, then enforce the allowlist.
  if (/^https?:|\.\./i.test(path) || !ALLOWED_PATHS.has(path)) {
    send(res, 400, 'Invalid path.');
    return;
  }

  try {
    const upstream = await fetch(`${MINIMAX_BASE}/${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: requestBody(req.body),
    });
    const text = await upstream.text();
    send(res, upstream.status, text, upstream.headers.get('Content-Type') || 'application/json');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown upstream error';
    send(
      res,
      502,
      JSON.stringify({ error: 'MiniMax upstream request failed', detail: message }),
      'application/json'
    );
  }
}
