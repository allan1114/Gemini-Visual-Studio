import { describe, it, expect, vi, afterEach } from 'vitest';
import { MinimaxProvider } from './MinimaxProvider';
import { PROVIDERS } from '../../constants';

describe('MinimaxProvider.generateImage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('POSTs to /image_generation with Bearer auth + aspect_ratio and returns a data URL', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: { image_base64: ['abc123'] }, base_resp: { status_code: 0 } }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const provider = new MinimaxProvider({ type: 'minimax', apiKey: 'mm-key-123' });
    const result = await provider.generateImage({
      prompt: 'a cat',
      aspectRatio: '16:9',
      imageSize: '1K',
      model: 'flash',
    });

    expect(result.url).toBe('data:image/jpeg;base64,abc123');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${PROVIDERS.minimax.defaultBaseUrl}/image_generation`);
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer mm-key-123');
    expect(JSON.parse(init.body)).toMatchObject({
      model: PROVIDERS.minimax.defaultImageModel,
      aspect_ratio: '16:9',
      response_format: 'base64',
    });
  });

  it('routes through the /api/minimax proxy when running in a browser with the default endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: { image_base64: ['abc123'] }, base_resp: { status_code: 0 } }),
    });
    vi.stubGlobal('fetch', fetchMock);
    // Simulate a browser so the provider chooses the same-origin proxy path.
    vi.stubGlobal('window', {} as typeof globalThis);

    const provider = new MinimaxProvider({ type: 'minimax', apiKey: 'mm-key-123' });
    await provider.generateImage({
      prompt: 'a cat',
      aspectRatio: '1:1',
      imageSize: '1K',
      model: 'flash',
    });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/minimax');
    const headers = init.headers as Record<string, string>;
    expect(headers['x-mm-key']).toBe('mm-key-123');
    expect(headers['x-mm-path']).toBe('image_generation');
  });

  it('truncates image prompts to the MiniMax 1500-character limit', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: { image_base64: ['abc123'] }, base_resp: { status_code: 0 } }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const provider = new MinimaxProvider({ type: 'minimax', apiKey: 'k' });
    await provider.generateImage({
      prompt: 'x'.repeat(2000),
      aspectRatio: '1:1',
      imageSize: '1K',
      model: 'flash',
    });

    const [, init] = fetchMock.mock.calls[0];
    const body = JSON.parse(init.body);
    expect(body.prompt).toHaveLength(1499);
  });

  it('throws SAFETY_BLOCK on a 400 with content-policy text', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        text: async () => 'request blocked by content policy',
      })
    );
    const provider = new MinimaxProvider({ type: 'minimax', apiKey: 'k' });
    await expect(
      provider.generateImage({ prompt: 'x', aspectRatio: '1:1', imageSize: '1K', model: 'flash' })
    ).rejects.toThrow(/SAFETY_BLOCK/);
  });

  it('treats a non-zero base_resp.status_code as a Model Refusal', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ base_resp: { status_code: 1004, status_msg: 'invalid api key' } }),
      })
    );
    const provider = new MinimaxProvider({ type: 'minimax', apiKey: 'k' });
    await expect(
      provider.generateImage({ prompt: 'x', aspectRatio: '1:1', imageSize: '1K', model: 'flash' })
    ).rejects.toThrow(/Model Refusal/);
  });

  it('throws EMPTY_RESPONSE when no image is returned', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: { image_base64: [] }, base_resp: { status_code: 0 } }),
      })
    );
    const provider = new MinimaxProvider({ type: 'minimax', apiKey: 'k' });
    await expect(
      provider.generateImage({ prompt: 'x', aspectRatio: '1:1', imageSize: '1K', model: 'flash' })
    ).rejects.toThrow(/EMPTY_RESPONSE/);
  });
});

describe('MinimaxProvider.editImage (subject-reference generation)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  const okResponse = () => ({
    ok: true,
    json: async () => ({ data: { image_base64: ['ref123'] }, base_resp: { status_code: 0 } }),
  });

  it('POSTs to /image_generation with a single character subject_reference', async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse());
    vi.stubGlobal('fetch', fetchMock);

    const provider = new MinimaxProvider({ type: 'minimax', apiKey: 'mm-key-123' });
    const result = await provider.editImage({
      prompt: 'the same girl by a library window',
      aspectRatio: '16:9',
      imageSize: '1K',
      model: 'flash',
      image: { base64: 'aGVsbG8=', mimeType: 'image/png' },
    });

    expect(result.url).toBe('data:image/jpeg;base64,ref123');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${PROVIDERS.minimax.defaultBaseUrl}/image_generation`);
    const body = JSON.parse(init.body);
    expect(body.subject_reference).toEqual([
      { type: 'character', image_file: 'data:image/png;base64,aGVsbG8=' },
    ]);
    expect(body).toMatchObject({
      model: PROVIDERS.minimax.defaultImageModel,
      aspect_ratio: '16:9',
      response_format: 'base64',
    });
  });

  it('strips an existing data-URL prefix instead of double-wrapping it', async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse());
    vi.stubGlobal('fetch', fetchMock);

    const provider = new MinimaxProvider({ type: 'minimax', apiKey: 'k' });
    await provider.editImage({
      prompt: 'p',
      aspectRatio: '1:1',
      imageSize: '1K',
      model: 'flash',
      image: { base64: 'data:image/jpeg;base64,Zm9v', mimeType: 'image/jpeg' },
    });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.subject_reference[0].image_file).toBe('data:image/jpeg;base64,Zm9v');
  });

  it('folds the system instruction into the prompt (no system field in the image API)', async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse());
    vi.stubGlobal('fetch', fetchMock);

    const provider = new MinimaxProvider({ type: 'minimax', apiKey: 'k' });
    await provider.editImage({
      prompt: 'user prompt',
      systemInstruction: 'stay consistent',
      aspectRatio: '1:1',
      imageSize: '1K',
      model: 'flash',
      image: { base64: 'Zm9v', mimeType: 'image/png' },
    });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.prompt).toBe('stay consistent\n\nuser prompt');
  });

  it('passes a WebP reference through unchanged outside the browser (no canvas)', async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse());
    vi.stubGlobal('fetch', fetchMock);

    const provider = new MinimaxProvider({ type: 'minimax', apiKey: 'k' });
    await provider.editImage({
      prompt: 'p',
      aspectRatio: '1:1',
      imageSize: '1K',
      model: 'flash',
      image: { base64: 'd2VicA==', mimeType: 'image/webp' },
    });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.subject_reference[0].image_file).toBe('data:image/webp;base64,d2VicA==');
  });
});

describe('MinimaxProvider.testKey', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('returns true on a successful chat ping', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ choices: [{ message: { content: 'pong' } }] }),
      })
    );
    const provider = new MinimaxProvider({ type: 'minimax', apiKey: 'valid' });
    await expect(provider.testKey()).resolves.toBe(true);
  });

  it('returns false when the request fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 401, text: async () => 'unauthorized' })
    );
    const provider = new MinimaxProvider({ type: 'minimax', apiKey: 'bad' });
    await expect(provider.testKey()).resolves.toBe(false);
  });
});
