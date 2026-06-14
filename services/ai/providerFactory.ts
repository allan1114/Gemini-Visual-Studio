import { resolveActiveEndpoint, ForcedEndpoint } from './endpointResolver';
import { GeminiProvider } from './GeminiProvider';
import { OpenAICompatibleProvider } from './OpenAICompatibleProvider';
import { FALProvider } from './FALProvider';
import { MinimaxProvider } from './MinimaxProvider';
import { AIProvider, ProviderType, ResolvedEndpoint } from './types';

const registry: Record<ProviderType, (e: ResolvedEndpoint) => AIProvider> = {
  gemini: (e) => new GeminiProvider(e),
  'openai-compatible': (e) => new OpenAICompatibleProvider(e),
  fal: (e) => new FALProvider(e),
  minimax: (e) => new MinimaxProvider(e),
};

/**
 * Resolves the active endpoint and instantiates the matching provider. Throws
 * "API_KEY_MISSING" when no key is configured (preserved sentinel).
 */
export async function getActiveProvider(forced?: ForcedEndpoint): Promise<AIProvider> {
  const endpoint = await resolveActiveEndpoint(forced);
  const factory = registry[endpoint.type] || registry.gemini;
  return factory(endpoint);
}
