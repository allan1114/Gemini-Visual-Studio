import { describe, expect, it } from 'vitest';
import { UsageStats } from '../types';
import { getUsagePresentation } from './usageStats';

const stats: UsageStats = {
  sessionCount: 8,
  lastInputTokens: 120,
  lastOutputTokens: 80,
  totalTokens: 2_500,
  providerGenerationCounts: { gemini: 4, minimax: 3, fal: 1 },
};

describe('getUsagePresentation', () => {
  it('shows provider-specific successful generations for MiniMax', () => {
    expect(getUsagePresentation(stats, 'minimax')).toEqual({
      usesImageUsage: true,
      generationCount: 3,
      lastInput: 1,
      lastOutput: 1,
      total: 3,
    });
  });

  it('keeps fal usage separate from MiniMax usage', () => {
    expect(getUsagePresentation(stats, 'fal')).toEqual({
      usesImageUsage: true,
      generationCount: 1,
      lastInput: 1,
      lastOutput: 1,
      total: 1,
    });
  });

  it('retains token reporting for token-aware providers', () => {
    expect(getUsagePresentation(stats, 'gemini')).toEqual({
      usesImageUsage: false,
      generationCount: 8,
      lastInput: 120,
      lastOutput: 80,
      total: 2_500,
    });
  });
});
