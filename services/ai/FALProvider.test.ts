import { describe, it, expect, vi, afterEach } from 'vitest';
import { FALProvider, IMAGE_SIZE_MAP } from './FALProvider';
import { PROVIDERS } from '../../constants';

describe('IMAGE_SIZE_MAP', () => {
  it('maps every app aspect ratio to a fal image_size enum value', () => {
    expect(IMAGE_SIZE_MAP).toEqual({
      '1:1': 'square_hd',
      '3:4': 'portrait_4_3',
      '4:3': 'landscape_4_3',
      '9:16': 'portrait_16_9',
      '16:9': 'landscape_16_9',
    });
  });
});

describe('FALProvider.generateImage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('POSTs to the model endpoint with Key auth + mapped size, and inlines the image', async () => {
    const fetchMock = vi
      .fn()
      // 1st call: the fal model endpoint returns a hosted image URL.
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ images: [{ url: 'https://fal.media/out.png' }] }),
      })
      // 2nd call: re-fetching that URL to inline as a data URL.
      .mockResolvedValueOnce({
        ok: true,
        blob: async () => new Blob(['x'], { type: 'image/png' }),
      });
    vi.stubGlobal('fetch', fetchMock);
    // jsdom lacks a spec-complete FileReader.readAsDataURL; stub a deterministic one.
    vi.stubGlobal(
      'FileReader',
      class {
        result = 'data:image/png;base64,eA==';
        onloadend: (() => void) | null = null;
        onerror: (() => void) | null = null;
        readAsDataURL() {
          this.onloadend?.();
        }
      } as unknown as typeof FileReader
    );

    const provider = new FALProvider({ type: 'fal', apiKey: 'fal-key-123' });
    const result = await provider.generateImage({
      prompt: 'a cat',
      aspectRatio: '16:9',
      imageSize: '1K',
      model: 'flash',
    });

    expect(result.url).toBe('data:image/png;base64,eA==');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${PROVIDERS.fal.defaultBaseUrl}/${PROVIDERS.fal.defaultImageModel}`);
    expect((init.headers as Record<string, string>).Authorization).toBe('Key fal-key-123');
    expect(JSON.parse(init.body)).toMatchObject({ image_size: 'landscape_16_9', num_images: 1 });
  });

  it('routes through the /api/fal proxy when running in a browser with the default endpoint', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ images: [{ url: 'https://fal.media/out.png' }] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        blob: async () => new Blob(['x'], { type: 'image/png' }),
      });
    vi.stubGlobal('fetch', fetchMock);
    // Simulate a browser so the provider chooses the same-origin proxy path.
    vi.stubGlobal('window', {} as Window & typeof globalThis);
    vi.stubGlobal(
      'FileReader',
      class {
        result = 'data:image/png;base64,eA==';
        onloadend: (() => void) | null = null;
        onerror: (() => void) | null = null;
        readAsDataURL() {
          this.onloadend?.();
        }
      } as unknown as typeof FileReader
    );

    const provider = new FALProvider({ type: 'fal', apiKey: 'fal-key-123' });
    await provider.generateImage({
      prompt: 'a cat',
      aspectRatio: '1:1',
      imageSize: '1K',
      model: 'flash',
    });

    const [postUrl, init] = fetchMock.mock.calls[0];
    expect(postUrl).toBe('/api/fal');
    const headers = init.headers as Record<string, string>;
    expect(headers['x-fal-key']).toBe('fal-key-123');
    expect(headers['x-fal-target']).toBe(PROVIDERS.fal.defaultImageModel);
    // The image is re-fetched through the proxy's GET passthrough.
    const [imgUrl] = fetchMock.mock.calls[1];
    expect(imgUrl).toBe(`/api/fal?image=${encodeURIComponent('https://fal.media/out.png')}`);
  });

  it('throws EMPTY_RESPONSE when no image url is returned', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ images: [] }) })
    );
    const provider = new FALProvider({ type: 'fal', apiKey: 'k' });
    await expect(
      provider.generateImage({ prompt: 'x', aspectRatio: '1:1', imageSize: '1K', model: 'flash' })
    ).rejects.toThrow(/EMPTY_RESPONSE/);
  });
});
