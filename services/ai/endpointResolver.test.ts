import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { resolveActiveEndpoint } from './endpointResolver';
import { STORAGE_KEYS } from '../../constants';

describe('resolveActiveEndpoint', () => {
  beforeEach(() => {
    (localStorage.getItem as ReturnType<typeof vi.fn>).mockReset();
    vi.stubEnv('VITE_GEMINI_API_KEY', '');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('uses a forced key as a gemini endpoint', async () => {
    const ep = await resolveActiveEndpoint('forced-123');
    expect(ep).toEqual({ type: 'gemini', apiKey: 'forced-123' });
  });

  it('defaults legacy records without a provider to gemini', async () => {
    const record = [{ id: '1', label: 'k', key: 'plain-key', isActive: true, status: 'unknown' }];
    (localStorage.getItem as ReturnType<typeof vi.fn>).mockImplementation((k: string) =>
      k === STORAGE_KEYS.API_KEYS ? JSON.stringify(record) : null
    );
    const ep = await resolveActiveEndpoint();
    expect(ep.type).toBe('gemini');
    expect(ep.apiKey).toBe('plain-key');
  });

  it('honours an explicit openai-compatible provider with base url', async () => {
    const record = [
      {
        id: '2',
        label: 'oai',
        key: 'sk-1',
        isActive: true,
        status: 'unknown',
        provider: 'openai-compatible',
        baseUrl: 'https://proxy.example/v1',
      },
    ];
    (localStorage.getItem as ReturnType<typeof vi.fn>).mockImplementation((k: string) =>
      k === STORAGE_KEYS.API_KEYS ? JSON.stringify(record) : null
    );
    const ep = await resolveActiveEndpoint();
    expect(ep.type).toBe('openai-compatible');
    expect(ep.baseUrl).toBe('https://proxy.example/v1');
  });

  it('throws API_KEY_MISSING when nothing is configured', async () => {
    (localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue(null);
    await expect(resolveActiveEndpoint()).rejects.toThrow('API_KEY_MISSING');
  });
});
