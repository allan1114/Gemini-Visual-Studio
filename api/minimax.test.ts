import { afterEach, describe, expect, it, vi } from 'vitest';
import handler, { maxDuration } from './minimax';

function responseRecorder() {
  const result = { status: 0, headers: {} as Record<string, string>, body: '' };
  return {
    result,
    response: {
      status(code: number) {
        result.status = code;
        return this;
      },
      setHeader(name: string, value: string) {
        result.headers[name] = value;
      },
      send(body: string) {
        result.body = body;
      },
    },
  };
}

describe('MiniMax Vercel proxy', () => {
  afterEach(() => vi.restoreAllMocks());

  it('uses an extended Node.js function duration', () => {
    expect(maxDuration).toBe(300);
  });

  it('forwards a Vercel-parsed JSON body and returns the upstream response', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('{"data":{"image_base64":["result"]}}', {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );
    const { response, result } = responseRecorder();

    await handler(
      {
        method: 'POST',
        headers: { 'x-mm-path': 'image_generation', 'x-mm-key': 'secret' },
        body: { model: 'image-01', prompt: 'portrait' },
      },
      response
    );

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.minimax.io/v1/image_generation',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer secret' },
        body: JSON.stringify({ model: 'image-01', prompt: 'portrait' }),
      })
    );
    expect(result).toEqual({
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: '{"data":{"image_base64":["result"]}}',
    });
  });

  it('returns a controlled 502 when the upstream request throws', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('connection reset'));
    const { response, result } = responseRecorder();

    await handler(
      {
        method: 'POST',
        headers: { 'x-mm-path': 'image_generation', 'x-mm-key': 'secret' },
        body: '{}',
      },
      response
    );

    expect(result.status).toBe(502);
    expect(JSON.parse(result.body)).toEqual({
      error: 'MiniMax upstream request failed',
      detail: 'connection reset',
    });
  });
});
