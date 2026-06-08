import { STORAGE_KEYS, PROVIDERS } from '../../constants';
import { ApiKeyRecord, ProviderType } from '../../types';
import { decryptString } from '../../utils/secureStore';
import { ResolvedEndpoint } from './types';

/**
 * Resolves the active AI endpoint configuration from (in priority order):
 *   1. an explicitly forced key (used by Key Wallet "test"),
 *   2. the active record in localStorage (STORAGE_KEYS.API_KEYS),
 *   3. the VITE_GEMINI_API_KEY build-time env var.
 *
 * Records stored by older versions lack a `provider` field; they are treated as
 * Gemini (read-time defaulting — no destructive migration). Throws the
 * "API_KEY_MISSING" sentinel (matched downstream by useImageSynthesis) when no
 * key can be found.
 */
export async function resolveActiveEndpoint(forceKey?: string): Promise<ResolvedEndpoint> {
  if (forceKey) {
    return { type: 'gemini', apiKey: forceKey };
  }

  const keysRaw = localStorage.getItem(STORAGE_KEYS.API_KEYS);
  if (keysRaw) {
    try {
      const keys: ApiKeyRecord[] = JSON.parse(keysRaw);
      const active = keys.find((k) => k.isActive);
      if (active && active.key) {
        const provider: ProviderType = active.provider ?? 'gemini';
        const decryptedKey = await decryptString(active.key);
        return {
          type: provider,
          apiKey: decryptedKey,
          baseUrl: active.baseUrl || PROVIDERS[provider]?.defaultBaseUrl || undefined,
          imageModelId: active.imageModelId,
          textModelId: active.textModelId,
        };
      }
    } catch {
      // Malformed storage — fall through to env var.
    }
  }

  const envKey = (import.meta.env.VITE_GEMINI_API_KEY as string | undefined)?.trim() || '';
  if (envKey) {
    if (import.meta.env.PROD) {
      console.warn(
        '[Security] VITE_GEMINI_API_KEY is embedded in the production bundle and is publicly visible. Prefer a per-user key in the Key Wallet or a backend proxy.'
      );
    }
    return { type: 'gemini', apiKey: envKey };
  }

  console.warn(
    '[Gemini] API key is missing. Set VITE_GEMINI_API_KEY in .env.local or add one in the Key Wallet.'
  );
  throw new Error('API_KEY_MISSING');
}
