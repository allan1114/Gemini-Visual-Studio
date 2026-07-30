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

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return new Response('Method not allowed.', { status: 405 });
  }

  const path = req.headers.get('x-mm-path');
  const key = req.headers.get('x-mm-key');
  if (!path || !key) {
    return new Response('Missing x-mm-path or x-mm-key header.', { status: 400 });
  }
  // Disallow absolute URLs / path traversal, then enforce the allowlist.
  if (/^https?:|\.\./i.test(path) || !ALLOWED_PATHS.has(path)) {
    return new Response('Invalid path.', { status: 400 });
  }

  const body = await req.text();
  const upstream = await fetch(`${MINIMAX_BASE}/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body,
  });
  const text = await upstream.text();
  return new Response(text, {
    status: upstream.status,
    headers: { 'Content-Type': upstream.headers.get('Content-Type') || 'application/json' },
  });
}
