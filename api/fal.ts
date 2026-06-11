/**
 * fal.ai serverless proxy (Vercel Edge Function).
 *
 * fal.ai does not send CORS headers, so the browser cannot call `fal.run`
 * directly. This same-origin endpoint forwards requests server-side:
 *
 *   POST /api/fal           — body is the fal payload; `x-fal-target` selects
 *                             the model (e.g. "fal-ai/flux/dev") and `x-fal-key`
 *                             carries the user's fal key. Forwarded to
 *                             https://fal.run/{target} with an Authorization header.
 *   GET  /api/fal?image=URL — streams a fal-hosted result image back so the
 *                             client can inline it without tripping CORS/canvas.
 *
 * The key is supplied per-request by the client (kept in the user's browser);
 * it is never stored on the server.
 */

export const config = { runtime: 'edge' };

/** Only fal-owned hosts may be proxied (prevents this acting as an open proxy). */
function isAllowedImageHost(hostname: string): boolean {
  return /(^|\.)fal\.(media|run|ai)$/.test(hostname);
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method === 'POST') {
    const target = req.headers.get('x-fal-target');
    const key = req.headers.get('x-fal-key');
    if (!target || !key) {
      return new Response('Missing x-fal-target or x-fal-key header.', { status: 400 });
    }
    // Disallow absolute URLs / path traversal in the target.
    if (/^https?:|\.\./i.test(target)) {
      return new Response('Invalid target.', { status: 400 });
    }
    const body = await req.text();
    const upstream = await fetch(`https://fal.run/${target}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Key ${key}` },
      body,
    });
    const text = await upstream.text();
    return new Response(text, {
      status: upstream.status,
      headers: { 'Content-Type': upstream.headers.get('Content-Type') || 'application/json' },
    });
  }

  if (req.method === 'GET') {
    const image = new URL(req.url).searchParams.get('image');
    if (!image) return new Response('Missing image parameter.', { status: 400 });
    let parsed: URL;
    try {
      parsed = new URL(image);
    } catch {
      return new Response('Invalid image URL.', { status: 400 });
    }
    if (!isAllowedImageHost(parsed.hostname)) {
      return new Response('Image host not allowed.', { status: 400 });
    }
    const upstream = await fetch(parsed.toString());
    const buf = await upstream.arrayBuffer();
    return new Response(buf, {
      status: upstream.status,
      headers: {
        'Content-Type': upstream.headers.get('Content-Type') || 'image/png',
        'Cache-Control': 'public, max-age=3600',
      },
    });
  }

  return new Response('Method not allowed.', { status: 405 });
}
