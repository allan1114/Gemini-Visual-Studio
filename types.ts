
export type ImageSize = '1K' | '2K' | '4K';
export type AspectRatio = '1:1' | '3:4' | '4:3' | '9:16' | '16:9';
export type ModelChoice = 'flash' | 'pro';
export type Language = 'en' | 'zh';

export interface User {
  id: string;
  username: string;
  isAdmin: boolean;
}

export interface ApiKeyRecord {
  id: string;
  label: string;
  key: string;
  isActive: boolean;
  lastTested?: number;
  status: 'active' | 'invalid' | 'unknown';
}

export interface UsageStats {
  sessionCount: number;
  lastInputTokens: number;
  lastOutputTokens: number;
  totalTokens: number;
}

export interface GenerationConfig {
  size?: ImageSize;
  aspectRatio?: AspectRatio;
  seed?: number;
  temperature?: number;
}

export interface PromptEntry {
  id: string;
  userId: string;
  author: string;
  text: string;
  negativePrompt?: string;
  tags?: string[];
  timestamp: number;
  imageUrl?: string;
  type: 'generation' | 'edit' | 'avatar';
  model: ModelChoice;
  config?: GenerationConfig;
}

export interface Preset {
  id: string;
  userId: string;
  name: string;
  prompt: string;
  negativePrompt: string;
  chips: string[];
  aspectRatio: AspectRatio;
  imageSize: ImageSize;
  model: ModelChoice;
  temperature: number;
  timestamp: number;
}

export enum View {
  GENERATE = 'generate',
  EDIT = 'edit',
  AVATAR = 'avatar',
  STUDIO = 'studio',
  PROMPTS = 'prompts',
  GALLERY = 'gallery',
  PRESETS = 'presets',
  DATABASE = 'database',
  KEY_WALLET = 'key_wallet'
}

export interface Member {
  id: string;
  name: string;
  avatar?: string;
  bio?: string;
  createdAt: number;
}

export interface AppError extends Error {
  code?: string;
  isRetryable?: boolean;
}

export interface ImageGenerationResult {
  url: string;
  inputTokens: number;
  outputTokens: number;
  aiDescription?: string;
  aiTags?: string[];
}

declare global {
  interface Window {
    aistudio: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}
