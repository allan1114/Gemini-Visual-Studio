import { resolveActiveEndpoint } from './endpointResolver';
import { GeminiProvider } from './GeminiProvider';
import { OpenAICompatibleProvider } from './OpenAICompatibleProvider';
import { AIProvider, ProviderType, ResolvedEndpoint } from './types';

const registry: Record<ProviderType, (e: ResolvedEndpoint) => AIProvider> = {
  gemini: (e) => new GeminiProvider(e),
  'openai-compatible': (e) => new OpenAICompatibleProvider(e),
};

/**
 * Resolves the active endpoint and instantiates the matching provider. Throws
 * "API_KEY_MISSING" when no key is configured (preserved sentinel).
 */
export async function getActiveProvider(forceKey?: string): Promise<AIProvider> {
  const endpoint = await resolveActiveEndpoint(forceKey);
  const factory = registry[endpoint.type] || registry.gemini;
  return factory(endpoint);
}
