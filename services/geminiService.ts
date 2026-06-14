import { ImageSize, AspectRatio, ModelChoice, ApiKeyRecord } from '../types';
import { ErrorHandler } from '../utils/errorHandler';
import { validatePrompt, validateImageSize } from '../utils/validation';
import { imageGenerationLimiter } from '../utils/rateLimiter';
import { getActiveProvider } from './ai/providerFactory';
import { JsonSchema } from './ai/types';

const IMAGE_GEN_INSTRUCTION = `You are a high-end visual synthesizer.
Focus on cinematic lighting, professional textures, and photorealistic rendering.
CRITICAL: Always output the result as an image part. No text response.`;

const PROMPT_EXPANSION_SYSTEM = `You are a professional Prompt Alchemist.
Transform simple user descriptions into high-end, detailed prompts for AI image generation.
Utilize complex reasoning to determine the best lighting (e.g., volumetric, cinematic), camera settings (e.g., 85mm f/1.8),
texture (e.g., hyper-detailed pores, silk fabric), and mood for the specific subject.
Output ONLY the final expanded prompt. No explanations.`;

const INPAINT_SYSTEM_INSTRUCTION = `You are an expert Image In-painter.
CRITICAL: The white area of the mask indicates the region to be modified.
The black area must remain ABSOLUTELY UNTOUCHED.
Your task is to seamlessly fill the white area based on the surrounding context and the user's instruction.
Maintain perfect continuity of textures, lighting, and perspective from the surrounding unmasked regions.`;

const BG_REMOVAL_SYSTEM_INSTRUCTION =
  'You are a professional background removal specialist. Output ONLY the resulting image with the subject isolated on a pure white background.';

const METADATA_SCHEMA: JsonSchema = {
  type: 'object',
  properties: {
    description: { type: 'string' },
    tags: { type: 'array', items: { type: 'string' } },
  },
};

export interface GenResult {
  url: string;
  inputTokens: number;
  outputTokens: number;
  aiDescription?: string;
  aiTags?: string[];
}

/**
 * Facade over the pluggable AI provider layer (services/ai/*). Public method
 * signatures are intentionally unchanged so existing callers and the UI are
 * untouched. Prompt composition (preprocessPrompt, system instructions,
 * EXCLUDE/Avoid concatenation) lives here; transport/parsing lives in the
 * providers. Error strings emitted by providers (API_KEY_MISSING, SAFETY_BLOCK,
 * Model Refusal:) are preserved so useImageSynthesis's Pro->Flash fallback
 * keeps working.
 */
export class GeminiService {
  /** Softens sensitive terms into artistic language. Behaviour preserved as-is. */
  public static preprocessPrompt(prompt: string): string {
    let p = prompt;
    const replacements: { [key: string]: string } = {
      身材: 'anatomical proportions and structural silhouette',
      胸部: 'upper torso volumetric contours',
      性感: 'sophisticated fashion allure and elegant aesthetic',
      裸露: 'artistic skin texture rendering',
      sex: 'intimate high-fashion composition',
      sexy: 'sultry editorial atmosphere',
      大波: 'voluminous and sweeping curves',
      NSFW: 'artistic figurative study',
      淫: 'dramatic mood lighting',
      曲線: 'fluid geometric silhouette',
      誘惑: 'captivating and mysterious gaze',
      豐滿: 'volumetric depth and structural form',
    };
    Object.keys(replacements).forEach((key) => {
      p = p.replace(new RegExp(key, 'gi'), replacements[key]);
    });
    return p;
  }

  private static withRetry<T>(fn: () => Promise<T>, maxRetries: number = 3): Promise<T> {
    return ErrorHandler.withRetry(fn, maxRetries, 2000);
  }

  static async testKey(record: ApiKeyRecord | string): Promise<boolean> {
    // A bare string is a Gemini key (back-compat). A record carries its provider
    // and endpoint settings so non-Gemini keys are tested against the right backend.
    const forced =
      typeof record === 'string'
        ? record
        : {
            apiKey: record.key,
            type: record.provider,
            baseUrl: record.baseUrl,
            imageModelId: record.imageModelId,
            textModelId: record.textModelId,
          };
    const provider = await getActiveProvider(forced);
    return provider.testKey();
  }

  static async describeSourceImage(base64Image: string, mimeType: string): Promise<string> {
    return this.withRetry(async () => {
      const provider = await getActiveProvider();
      const { text } = await provider.generateText({
        prompt:
          'Identity marker analysis: 1 sentence on hair, eyes, and skin tone for character consistency. Abstract and professional.',
        images: [{ base64: base64Image, mimeType }],
        textPosition: 'after',
        temperature: 0.1,
      });
      return text?.trim() || '';
    });
  }

  static async analyzeMaskedRegion(
    originalBase64: string,
    maskBase64: string,
    instruction: string
  ): Promise<string> {
    return this.withRetry(async () => {
      const provider = await getActiveProvider();
      const { text } = await provider.generateText({
        prompt: `Analyze the white masked region in the second image relative to the first image.
            1. Identify the specific object to be modified/removed.
            2. Identify the background texture/environment immediately surrounding the mask.
            Instruction: "${instruction}".
            Output format: "Object: [name], Background: [environment]". Max 10 words.`,
        images: [
          { base64: originalBase64, mimeType: 'image/png' },
          { base64: maskBase64, mimeType: 'image/png' },
        ],
        textPosition: 'before',
        temperature: 0.1,
      });
      return text?.trim() || 'subject';
    });
  }

  static async generateDynamicNegativePrompt(prompt: string): Promise<string> {
    return this.withRetry(async () => {
      const provider = await getActiveProvider();
      const { text } = await provider.generateText({
        prompt: `Excluded elements for: "${prompt}". List 5 keywords.`,
        temperature: 0.2,
      });
      return text?.trim() || '';
    });
  }

  static async expandPrompt(prompt: string): Promise<string> {
    return this.withRetry(async () => {
      const provider = await getActiveProvider();
      const { text } = await provider.generateText({
        prompt,
        systemInstruction: PROMPT_EXPANSION_SYSTEM,
        temperature: 0.8,
        thinkingBudget: 8000,
      });
      return text || prompt;
    });
  }

  static async generateImage(
    prompt: string,
    aspectRatio: AspectRatio,
    imageSize: ImageSize,
    modelChoice: ModelChoice,
    negativePrompt?: string,
    seed?: number,
    temperature: number = 1.0
  ): Promise<GenResult> {
    validatePrompt(prompt);
    imageGenerationLimiter.consume('image generation');

    let finalPrompt = this.preprocessPrompt(prompt);
    if (negativePrompt) finalPrompt += `. EXCLUDE: ${this.preprocessPrompt(negativePrompt)}`;

    return this.withRetry(async () => {
      const provider = await getActiveProvider();
      return provider.generateImage({
        prompt: finalPrompt,
        aspectRatio,
        imageSize,
        model: modelChoice,
        seed,
        temperature,
        systemInstruction: IMAGE_GEN_INSTRUCTION,
      });
    }, 2);
  }

  static async inpaintImage(
    instruction: string,
    originalBase64: string,
    maskBase64: string,
    mimeType: string,
    modelChoice: ModelChoice,
    aspectRatio: AspectRatio = '1:1',
    imageSize: ImageSize = '1K',
    negativePrompt?: string,
    seed?: number,
    temperature: number = 1.0,
    semanticTarget?: string
  ): Promise<GenResult> {
    validateImageSize(originalBase64);
    imageGenerationLimiter.consume('inpainting');

    const targetContext = semanticTarget
      ? `The object to remove is: ${semanticTarget}.`
      : 'The object in the masked area.';
    const promptText = `INPAINT TASK: ${targetContext}
    ACTION: Completely remove this object and reconstruct the background by seamlessly extending the surrounding textures, patterns, and lighting.
    CRITICAL: Ensure the reconstructed area is indistinguishable from the original background.
    The black area of the mask must remain 100% identical to the original image.
    Avoid: ${negativePrompt}`;

    return this.withRetry(async () => {
      const provider = await getActiveProvider();
      return provider.inpaintImage({
        prompt: promptText,
        image: { base64: originalBase64, mimeType },
        mask: { base64: maskBase64, mimeType: 'image/png' },
        model: modelChoice,
        aspectRatio,
        imageSize,
        seed,
        // Lower temperature for healing/inpainting to be more deterministic.
        temperature: Math.min(temperature, 0.4),
        systemInstruction: INPAINT_SYSTEM_INSTRUCTION,
      });
    }, 2);
  }

  static async editImage(
    instruction: string,
    contextPrompt: string,
    base64Image: string,
    mimeType: string,
    modelChoice: ModelChoice,
    aspectRatio: AspectRatio = '1:1',
    imageSize: ImageSize = '1K',
    negativePrompt?: string,
    seed?: number,
    temperature: number = 1.0,
    identityContext?: string
  ): Promise<GenResult> {
    validateImageSize(base64Image);
    imageGenerationLimiter.consume('image editing');

    const editInstruction = `Editorial Creative Director: Synthesize variations with absolute identity consistency. Features to maintain: ${identityContext || 'original subject features'}. High-fashion professional quality.`;
    const promptText = `Task: ${this.preprocessPrompt(instruction)}. Logic: ${this.preprocessPrompt(contextPrompt)}. Avoid: ${negativePrompt}`;

    return this.withRetry(async () => {
      const provider = await getActiveProvider();
      return provider.editImage({
        prompt: promptText,
        image: { base64: base64Image, mimeType },
        model: modelChoice,
        aspectRatio,
        imageSize,
        seed,
        temperature,
        systemInstruction: editInstruction,
      });
    }, 2);
  }

  static async generateMetadata(
    base64Image: string,
    mimeType: string
  ): Promise<{ tags: string[]; description: string }> {
    return this.withRetry(async () => {
      const provider = await getActiveProvider();
      const { data } = await provider.generateJson<{ description?: string; tags?: string[] }>({
        prompt: 'Return JSON: {description: string, tags: string[]}',
        images: [{ base64: base64Image, mimeType }],
        textPosition: 'after',
        jsonSchema: METADATA_SCHEMA,
      });
      return { tags: data.tags || [], description: data.description || '' };
    });
  }

  static async suggestPrompt(): Promise<string> {
    return this.withRetry(async () => {
      const provider = await getActiveProvider();
      const { text } = await provider.generateText({
        prompt: 'Suggest 1 artistic cinematic prompt.',
      });
      return text || 'A cinematic scene.';
    });
  }

  static async suggestEditPrompt(base64Image: string, mimeType: string): Promise<string> {
    return this.withRetry(async () => {
      const provider = await getActiveProvider();
      const { text } = await provider.generateText({
        prompt:
          "Analyze this image and suggest 1 creative editing instruction (e.g., 'Change the background to a sunset beach', 'Add a futuristic neon jacket'). Output ONLY the instruction.",
        images: [{ base64: base64Image, mimeType }],
        textPosition: 'after',
      });
      return text?.trim() || 'Enhance the lighting and mood.';
    });
  }

  static async suggestInpaintPrompt(base64Image: string, maskBase64: string): Promise<string> {
    return this.withRetry(async () => {
      const provider = await getActiveProvider();
      const { text } = await provider.generateText({
        prompt:
          "Analyze the masked area and suggest 1 specific inpainting instruction (e.g., 'Replace with a bouquet of flowers', 'Change the hair color to platinum blonde'). Output ONLY the instruction.",
        images: [
          { base64: base64Image, mimeType: 'image/png' },
          { base64: maskBase64, mimeType: 'image/png' },
        ],
        textPosition: 'after',
      });
      return text?.trim() || 'Reconstruct the background.';
    });
  }

  static async removeBackground(
    base64Image: string,
    mimeType: string,
    modelChoice: ModelChoice,
    aspectRatio: AspectRatio = '1:1',
    imageSize: ImageSize = '1K'
  ): Promise<GenResult> {
    validateImageSize(base64Image);
    imageGenerationLimiter.consume('background removal');

    const prompt =
      'Subject isolation task: Extract the primary foreground object and place it on a clean, uniform studio white background (#FFFFFF). Ensure pixel-perfect edge reconstruction and maintain original subject lighting and texture. Output ONLY the isolated subject image.';

    return this.withRetry(async () => {
      const provider = await getActiveProvider();
      return provider.removeBackground({
        prompt,
        image: { base64: base64Image, mimeType },
        model: modelChoice,
        aspectRatio,
        imageSize,
        temperature: 0.1,
        systemInstruction: BG_REMOVAL_SYSTEM_INSTRUCTION,
      });
    });
  }
}
