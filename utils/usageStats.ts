import { ProviderType, UsageStats } from '../types';

export interface UsagePresentation {
  usesImageUsage: boolean;
  generationCount: number;
  lastInput: number;
  lastOutput: number;
  total: number;
}

/**
 * MiniMax and fal image endpoints bill per image and do not return token usage.
 * Present successful image requests for those providers while retaining token
 * reporting for providers whose responses include token metadata.
 */
export function getUsagePresentation(stats: UsageStats, provider: ProviderType): UsagePresentation {
  const usesImageUsage = provider === 'minimax' || provider === 'fal';
  if (!usesImageUsage) {
    return {
      usesImageUsage,
      generationCount: stats.sessionCount,
      lastInput: stats.lastInputTokens,
      lastOutput: stats.lastOutputTokens,
      total: stats.totalTokens,
    };
  }

  const generationCount = stats.providerGenerationCounts[provider] || 0;
  return {
    usesImageUsage,
    generationCount,
    lastInput: generationCount > 0 ? 1 : 0,
    lastOutput: generationCount > 0 ? 1 : 0,
    total: generationCount,
  };
}
