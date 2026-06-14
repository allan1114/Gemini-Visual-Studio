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
