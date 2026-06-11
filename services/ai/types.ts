import { AspectRatio, ImageSize, ModelChoice } from '../../types';

/**
 * Supported AI provider backends. The app historically only spoke to Google
 * Gemini; this enum is the seam that lets the UI stay identical while routing
 * requests to different endpoints under the hood.
 */
export type ProviderType = 'gemini' | 'openai-compatible' | 'fal';

/** Normalized image result returned by every provider. */
export interface ImageGenResult {
  url: string;
  inputTokens: number;
  outputTokens: number;
}

/** Image part used by edit/inpaint requests. */
export interface ImagePart {
  base64: string;
  mimeType: string;
}

export interface ImageGenRequest {
  /** Fully composed prompt — the facade has already run preprocessPrompt etc. */
  prompt: string;
  aspectRatio: AspectRatio;
  imageSize: ImageSize;
  model: ModelChoice;
  seed?: number;
  temperature?: number;
  systemInstruction?: string;
}

export interface ImageEditRequest extends ImageGenRequest {
  image: ImagePart;
}

export interface ImageInpaintRequest extends ImageEditRequest {
  mask: ImagePart;
}

/**
 * Minimal, provider-agnostic JSON schema description. Providers translate this
 * to their own structured-output mechanism (Gemini responseSchema / OpenAI
 * json_schema). Only the subset the app needs is modelled.
 */
export interface JsonSchema {
  type: 'object' | 'string' | 'array' | 'number' | 'boolean';
  properties?: Record<string, JsonSchema>;
  items?: JsonSchema;
}

export interface TextRequest {
  prompt: string;
  systemInstruction?: string;
  temperature?: number;
  /** Gemini thinking budget; ignored by providers without an equivalent. */
  thinkingBudget?: number;
  maxOutputTokens?: number;
  images?: ImagePart[];
  /** Where to place the text part relative to images. Defaults to 'after'. */
  textPosition?: 'before' | 'after';
  /** When set, request structured JSON output matching this schema. */
  jsonSchema?: JsonSchema;
}

export interface TextResult {
  text: string;
  inputTokens: number;
  outputTokens: number;
}

/**
 * Common contract every provider implements. Image methods map to image
 * models; text methods (used by prompt expansion, metadata, suggestions, image
 * description) map to a text/vision model.
 */
export interface AIProvider {
  readonly type: ProviderType;
  generateImage(req: ImageGenRequest): Promise<ImageGenResult>;
  editImage(req: ImageEditRequest): Promise<ImageGenResult>;
  inpaintImage(req: ImageInpaintRequest): Promise<ImageGenResult>;
  removeBackground(req: ImageEditRequest): Promise<ImageGenResult>;
  generateText(req: TextRequest): Promise<TextResult>;
  generateJson<T>(req: TextRequest): Promise<{ data: T } & Omit<TextResult, 'text'>>;
  testKey(): Promise<boolean>;
}

/** Maps each supported aspect ratio to a provider-specific size string. */
export type AspectRatioSizeMap = Record<AspectRatio, string>;

/** Resolved endpoint configuration used to construct a provider instance. */
export interface ResolvedEndpoint {
  type: ProviderType;
  apiKey: string;
  /** OpenAI-compatible custom base URL (e.g. https://api.openai.com/v1). */
  baseUrl?: string;
  /** Overrides the default Pro image model id for this provider. */
  imageModelId?: string;
  /** Overrides the default text model id for this provider. */
  textModelId?: string;
}
