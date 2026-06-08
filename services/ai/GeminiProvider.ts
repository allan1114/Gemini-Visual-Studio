import { GoogleGenAI, HarmCategory, HarmBlockThreshold, Type } from '@google/genai';
import { MODELS } from '../../constants';
import {
  AIProvider,
  ImageEditRequest,
  ImageGenRequest,
  ImageGenResult,
  ImageInpaintRequest,
  JsonSchema,
  ResolvedEndpoint,
  TextRequest,
  TextResult,
} from './types';

/**
 * Gemini safety configuration. Preserved verbatim from the original
 * GeminiService — behaviour intentionally unchanged (see plan: safety filter
 * kept as-is).
 */
const SAFETY_SETTINGS = [
  {
    category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
    threshold: HarmBlockThreshold.BLOCK_NONE,
  },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
  {
    category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
    threshold: HarmBlockThreshold.BLOCK_NONE,
  },
];

const INPAINT_SYSTEM_INSTRUCTION = `You are an expert Image In-painter.
CRITICAL: The white area of the mask indicates the region to be modified.
The black area must remain ABSOLUTELY UNTOUCHED.
Your task is to seamlessly fill the white area based on the surrounding context and the user's instruction.
Maintain perfect continuity of textures, lighting, and perspective from the surrounding unmasked regions.`;

const BG_REMOVAL_SYSTEM_INSTRUCTION =
  'You are a professional background removal specialist. Output ONLY the resulting image with the subject isolated on a pure white background.';

function clean(base64: string): string {
  return base64.split(',')[1] || base64;
}

/** Translates the app's minimal JsonSchema into Gemini's Type-based schema. */
function toGeminiSchema(schema: JsonSchema): Record<string, unknown> {
  const map: Record<JsonSchema['type'], unknown> = {
    object: Type.OBJECT,
    string: Type.STRING,
    array: Type.ARRAY,
    number: Type.NUMBER,
    boolean: Type.BOOLEAN,
  };
  const out: Record<string, unknown> = { type: map[schema.type] };
  if (schema.properties) {
    out.properties = Object.fromEntries(
      Object.entries(schema.properties).map(([k, v]) => [k, toGeminiSchema(v)])
    );
  }
  if (schema.items) out.items = toGeminiSchema(schema.items);
  return out;
}

export class GeminiProvider implements AIProvider {
  readonly type = 'gemini' as const;
  private ai: GoogleGenAI;

  constructor(private endpoint: ResolvedEndpoint) {
    this.ai = new GoogleGenAI({ apiKey: endpoint.apiKey });
  }

  private imageModel(model: ImageGenRequest['model']): string {
    if (model === 'pro') return this.endpoint.imageModelId || MODELS.PRO;
    return MODELS.FLASH;
  }

  private textModel(): string {
    return this.endpoint.textModelId || MODELS.TEXT;
  }

  /**
   * Parses a Gemini image response. Ported verbatim from the original service
   * so the error-string contract (SAFETY_BLOCK / Model Refusal / AI_REFUSAL)
   * that useImageSynthesis matches on is preserved.
   */
  private processImageResponse(result: any): ImageGenResult {
    const candidate = result.candidates?.[0];

    if (candidate?.finishReason === 'SAFETY') {
      throw new Error('SAFETY_BLOCK');
    }

    const parts = candidate?.content?.parts || [];
    let refusalText = '';

    for (const part of parts) {
      if (part.inlineData) {
        return {
          url: `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`,
          inputTokens: result.usageMetadata?.promptTokenCount || 0,
          outputTokens: result.usageMetadata?.candidatesTokenCount || 0,
        };
      }
      if (part.text) refusalText += part.text;
    }

    if (refusalText) {
      throw new Error(`Model Refusal: ${refusalText.substring(0, 100)}...`);
    }

    if (!candidate || parts.length === 0) {
      throw new Error(
        "AI_REFUSAL_OR_EMPTY: The AI model refused to process this image. This often happens due to strict safety filters. Try switching to the 'Flash' engine if you are using 'Pro', or ensure the image content is not sensitive."
      );
    }

    throw new Error(
      'EMPTY_RESPONSE: No image data was returned. Please try a different image or prompt.'
    );
  }

  async generateImage(req: ImageGenRequest): Promise<ImageGenResult> {
    const result = await this.ai.models.generateContent({
      model: this.imageModel(req.model),
      contents: { parts: [{ text: req.prompt }] },
      config: {
        systemInstruction: req.systemInstruction,
        seed: req.seed,
        temperature: req.temperature,
        imageConfig: {
          aspectRatio: req.aspectRatio,
          ...(req.model === 'pro' ? { imageSize: req.imageSize } : {}),
        },
        safetySettings: SAFETY_SETTINGS,
      },
    });
    return this.processImageResponse(result);
  }

  async editImage(req: ImageEditRequest): Promise<ImageGenResult> {
    const result = await this.ai.models.generateContent({
      model: this.imageModel(req.model),
      contents: {
        parts: [
          { text: req.prompt },
          { inlineData: { data: clean(req.image.base64), mimeType: req.image.mimeType } },
        ],
      },
      config: {
        systemInstruction: req.systemInstruction,
        seed: req.seed,
        temperature: req.temperature,
        imageConfig: {
          aspectRatio: req.aspectRatio,
          ...(req.model === 'pro' ? { imageSize: req.imageSize } : {}),
        },
        safetySettings: SAFETY_SETTINGS,
      },
    });
    return this.processImageResponse(result);
  }

  async inpaintImage(req: ImageInpaintRequest): Promise<ImageGenResult> {
    const result = await this.ai.models.generateContent({
      model: this.imageModel(req.model),
      contents: {
        parts: [
          { text: req.prompt },
          { inlineData: { data: clean(req.image.base64), mimeType: req.image.mimeType } },
          { inlineData: { data: clean(req.mask.base64), mimeType: 'image/png' } },
        ],
      },
      config: {
        systemInstruction: req.systemInstruction || INPAINT_SYSTEM_INSTRUCTION,
        seed: req.seed,
        temperature: req.temperature,
        imageConfig: {
          aspectRatio: req.aspectRatio,
          ...(req.model === 'pro' ? { imageSize: req.imageSize } : {}),
        },
        safetySettings: SAFETY_SETTINGS,
      },
    });
    return this.processImageResponse(result);
  }

  async removeBackground(req: ImageEditRequest): Promise<ImageGenResult> {
    const result = await this.ai.models.generateContent({
      model: this.imageModel(req.model),
      contents: {
        parts: [
          { text: req.prompt },
          { inlineData: { data: clean(req.image.base64), mimeType: req.image.mimeType } },
        ],
      },
      config: {
        systemInstruction: req.systemInstruction || BG_REMOVAL_SYSTEM_INSTRUCTION,
        temperature: req.temperature ?? 0.1,
        imageConfig: {
          aspectRatio: req.aspectRatio,
          ...(req.model === 'pro' ? { imageSize: req.imageSize } : {}),
        },
        safetySettings: SAFETY_SETTINGS,
      },
    });
    return this.processImageResponse(result);
  }

  private buildContents(req: TextRequest): any {
    if (!req.images || req.images.length === 0) {
      return req.prompt;
    }
    const imageParts = req.images.map((img) => ({
      inlineData: { data: clean(img.base64), mimeType: img.mimeType },
    }));
    const textPart = { text: req.prompt };
    const parts =
      req.textPosition === 'before' ? [textPart, ...imageParts] : [...imageParts, textPart];
    return { parts };
  }

  async generateText(req: TextRequest): Promise<TextResult> {
    const response: any = await this.ai.models.generateContent({
      model: this.textModel(),
      contents: this.buildContents(req),
      config: {
        systemInstruction: req.systemInstruction,
        temperature: req.temperature,
        ...(req.maxOutputTokens ? { maxOutputTokens: req.maxOutputTokens } : {}),
        ...(req.thinkingBudget != null
          ? { thinkingConfig: { thinkingBudget: req.thinkingBudget } }
          : {}),
      },
    });
    return {
      text: response.text || '',
      inputTokens: response.usageMetadata?.promptTokenCount || 0,
      outputTokens: response.usageMetadata?.candidatesTokenCount || 0,
    };
  }

  async generateJson<T>(
    req: TextRequest
  ): Promise<{ data: T; inputTokens: number; outputTokens: number }> {
    const response: any = await this.ai.models.generateContent({
      model: this.textModel(),
      contents: this.buildContents(req),
      config: {
        systemInstruction: req.systemInstruction,
        temperature: req.temperature,
        responseMimeType: 'application/json',
        ...(req.jsonSchema ? { responseSchema: toGeminiSchema(req.jsonSchema) } : {}),
      },
    });
    const data = JSON.parse(response.text || '{}') as T;
    return {
      data,
      inputTokens: response.usageMetadata?.promptTokenCount || 0,
      outputTokens: response.usageMetadata?.candidatesTokenCount || 0,
    };
  }

  async testKey(): Promise<boolean> {
    try {
      await this.ai.models.generateContent({
        model: MODELS.TEXT,
        contents: 'hi',
        config: { maxOutputTokens: 50, thinkingConfig: { thinkingBudget: 0 } },
      });
      return true;
    } catch {
      return false;
    }
  }
}
