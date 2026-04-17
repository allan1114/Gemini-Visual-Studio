
import { GoogleGenAI, HarmCategory, HarmBlockThreshold, Type } from "@google/genai";
import { MODELS, STORAGE_KEYS } from "../constants";
import { AspectRatio, ImageSize, ModelChoice, ApiKeyRecord } from "../types";
import { ErrorHandler } from "../utils/errorHandler";

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

const SAFETY_SETTINGS = [
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE }
];

export interface GenResult {
  url: string;
  inputTokens: number;
  outputTokens: number;
  aiDescription?: string;
  aiTags?: string[];
}

export class GeminiService {
  private static async getClient(forceKey?: string) {
    if (forceKey) return new GoogleGenAI({ apiKey: forceKey });

    const keysRaw = localStorage.getItem(STORAGE_KEYS.API_KEYS);
    if (keysRaw) {
      const keys: ApiKeyRecord[] = JSON.parse(keysRaw);
      const activeKey = keys.find(k => k.isActive);
      if (activeKey) return new GoogleGenAI({ apiKey: activeKey.key });
    }

    const apiKey = (import.meta.env.VITE_GEMINI_API_KEY as string || '').trim();

    if (!apiKey) {
      console.warn("[Gemini] API key is missing. Set VITE_GEMINI_API_KEY in .env.local");
      throw new Error("API_KEY_MISSING");
    }

    return new GoogleGenAI({ apiKey });
  }

  public static preprocessPrompt(prompt: string): string {
    let p = prompt;
    const replacements: { [key: string]: string } = {
      '身材': 'anatomical proportions and structural silhouette',
      '胸部': 'upper torso volumetric contours',
      '性感': 'sophisticated fashion allure and elegant aesthetic',
      '裸露': 'artistic skin texture rendering',
      'sex': 'intimate high-fashion composition',
      'sexy': 'sultry editorial atmosphere',
      '大波': 'voluminous and sweeping curves',
      'NSFW': 'artistic figurative study',
      '淫': 'dramatic mood lighting',
      '曲線': 'fluid geometric silhouette',
      '誘惑': 'captivating and mysterious gaze',
      '豐滿': 'volumetric depth and structural form'
    };
    Object.keys(replacements).forEach(key => {
      p = p.replace(new RegExp(key, 'gi'), replacements[key]);
    });
    return p;
  }

  private static async withRetry<T>(fn: () => Promise<T>): Promise<T> {
    return ErrorHandler.withRetry(fn, 3, 2000);
  }

  static async testKey(key: string): Promise<boolean> {
    const ai = await this.getClient(key);
    try {
      await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: 'hi',
        config: { maxOutputTokens: 50, thinkingConfig: { thinkingBudget: 0 } }
      });
      return true;
    } catch (e) {
      return false;
    }
  }

  static async describeSourceImage(base64Image: string, mimeType: string): Promise<string> {
    const ai = await this.getClient();
    const cleanBase64 = base64Image.split(',')[1] || base64Image;

    return this.withRetry(async () => {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: {
          parts: [
            { inlineData: { data: cleanBase64, mimeType } },
            { text: "Identity marker analysis: 1 sentence on hair, eyes, and skin tone for character consistency. Abstract and professional." }
          ]
        },
        config: { temperature: 0.1 }
      });
      return response.text?.trim() || "";
    });
  }

  static async analyzeMaskedRegion(originalBase64: string, maskBase64: string, instruction: string): Promise<string> {
    const ai = await this.getClient();
    const cleanOriginal = originalBase64.split(',')[1] || originalBase64;
    const cleanMask = maskBase64.split(',')[1] || maskBase64;

    return this.withRetry(async () => {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: {
          parts: [
            { text: `Analyze the white masked region in the second image relative to the first image. 
            1. Identify the specific object to be modified/removed.
            2. Identify the background texture/environment immediately surrounding the mask.
            Instruction: "${instruction}". 
            Output format: "Object: [name], Background: [environment]". Max 10 words.` },
            { inlineData: { data: cleanOriginal, mimeType: 'image/png' } },
            { inlineData: { data: cleanMask, mimeType: 'image/png' } }
          ]
        },
        config: { temperature: 0.1 }
      });
      return response.text?.trim() || "subject";
    });
  }

  static async generateDynamicNegativePrompt(prompt: string): Promise<string> {
    const ai = await this.getClient();
    return this.withRetry(async () => {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Excluded elements for: "${prompt}". List 5 keywords.`,
        config: { temperature: 0.2 }
      });
      return response.text?.trim() || "";
    });
  }

  static async expandPrompt(prompt: string): Promise<string> {
    const ai = await this.getClient();
    return this.withRetry(async () => {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
        config: {
          systemInstruction: PROMPT_EXPANSION_SYSTEM,
          temperature: 0.8,
          thinkingConfig: { thinkingBudget: 8000 }
        }
      });
      return response.text || prompt;
    });
  }

  private static processImageResponse(result: any) {
    const candidate = result.candidates?.[0];
    
    // Check for explicit safety block
    if (candidate?.finishReason === 'SAFETY') {
      throw new Error("SAFETY_BLOCK");
    }
    
    const parts = candidate?.content?.parts || [];
    let refusalText = "";
    
    for (const part of parts) {
      if (part.inlineData) {
        return {
          url: `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`,
          inputTokens: result.usageMetadata?.promptTokenCount || 0,
          outputTokens: result.usageMetadata?.candidatesTokenCount || 0
        };
      }
      if (part.text) refusalText += part.text;
    }
    
    if (refusalText) {
      throw new Error(`Model Refusal: ${refusalText.substring(0, 100)}...`);
    }

    // If we reach here and there's no candidate or no parts, it's likely a silent safety block or transient failure
    if (!candidate || parts.length === 0) {
      throw new Error("AI_REFUSAL_OR_EMPTY: The AI model refused to process this image. This often happens due to strict safety filters. Try switching to the 'Flash' engine if you are using 'Pro', or ensure the image content is not sensitive.");
    }

    throw new Error("EMPTY_RESPONSE: No image data was returned. Please try a different image or prompt.");
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
    const ai = await this.getClient();
    const modelName = modelChoice === 'pro' ? MODELS.PRO : MODELS.FLASH;
    
    let finalPrompt = this.preprocessPrompt(prompt);
    if (negativePrompt) finalPrompt += `. EXCLUDE: ${this.preprocessPrompt(negativePrompt)}`;

    return this.withRetry(async () => {
      const result = await ai.models.generateContent({
        model: modelName,
        contents: { parts: [{ text: finalPrompt }] },
        config: {
          systemInstruction: IMAGE_GEN_INSTRUCTION,
          seed,
          temperature,
          imageConfig: {
            aspectRatio,
            ...(modelChoice === 'pro' ? { imageSize } : {})
          },
          safetySettings: SAFETY_SETTINGS
        },
      });
      return this.processImageResponse(result);
    }, 2); // Reduced retries to 2 for image gen
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
    const ai = await this.getClient();
    const modelName = modelChoice === 'pro' ? MODELS.PRO : MODELS.FLASH;
    const cleanOriginal = originalBase64.split(',')[1] || originalBase64;
    const cleanMask = maskBase64.split(',')[1] || maskBase64;

    const targetContext = semanticTarget ? `The object to remove is: ${semanticTarget}.` : "The object in the masked area.";
    const promptText = `INPAINT TASK: ${targetContext} 
    ACTION: Completely remove this object and reconstruct the background by seamlessly extending the surrounding textures, patterns, and lighting.
    CRITICAL: Ensure the reconstructed area is indistinguishable from the original background. 
    The black area of the mask must remain 100% identical to the original image.
    Avoid: ${negativePrompt}`;

    return this.withRetry(async () => {
      const result = await ai.models.generateContent({
        model: modelName,
        contents: {
          parts: [
            { text: promptText },
            { inlineData: { data: cleanOriginal, mimeType } },
            { inlineData: { data: cleanMask, mimeType: 'image/png' } }
          ],
        },
        config: {
          systemInstruction: INPAINT_SYSTEM_INSTRUCTION,
          seed, 
          // Lower temperature for healing/inpainting to be more deterministic and realistic
          temperature: Math.min(temperature, 0.4),
          imageConfig: {
            aspectRatio,
            ...(modelChoice === 'pro' ? { imageSize } : {})
          },
          safetySettings: SAFETY_SETTINGS
        },
      });
      return this.processImageResponse(result);
    }, 2); // Reduced retries to 2 for inpaint
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
    const ai = await this.getClient();
    const modelName = modelChoice === 'pro' ? MODELS.PRO : MODELS.FLASH;
    const cleanBase64 = base64Image.split(',')[1] || base64Image;

    const editInstruction = `Editorial Creative Director: Synthesize variations with absolute identity consistency. Features to maintain: ${identityContext || 'original subject features'}. High-fashion professional quality.`;
    const promptText = `Task: ${this.preprocessPrompt(instruction)}. Logic: ${this.preprocessPrompt(contextPrompt)}. Avoid: ${negativePrompt}`;

    return this.withRetry(async () => {
      const result = await ai.models.generateContent({
        model: modelName,
        contents: {
          parts: [
            { text: promptText },
            { inlineData: { data: cleanBase64, mimeType } }
          ],
        },
        config: {
          systemInstruction: editInstruction,
          seed, 
          temperature,
          imageConfig: {
            aspectRatio,
            ...(modelChoice === 'pro' ? { imageSize } : {})
          },
          safetySettings: SAFETY_SETTINGS
        },
      });
      return this.processImageResponse(result);
    }, 2); // Reduced retries to 2 for edit
  }

  static async generateMetadata(base64Image: string, mimeType: string): Promise<{ tags: string[], description: string }> {
    const ai = await this.getClient();
    const cleanBase64 = base64Image.split(',')[1] || base64Image;

    return this.withRetry(async () => {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: {
          parts: [
            { inlineData: { data: cleanBase64, mimeType } },
            { text: "Return JSON: {description: string, tags: string[]}" }
          ]
        },
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              description: { type: Type.STRING },
              tags: { type: Type.ARRAY, items: { type: Type.STRING } }
            }
          }
        }
      });
      const data = JSON.parse(response.text || '{}');
      return { tags: data.tags || [], description: data.description || "" };
    });
  }

  static async suggestPrompt(): Promise<string> {
    const ai = await this.getClient();
    return this.withRetry(async () => {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: "Suggest 1 artistic cinematic prompt.",
      });
      return response.text || "A cinematic scene.";
    });
  }

  static async suggestEditPrompt(base64Image: string, mimeType: string): Promise<string> {
    const ai = await this.getClient();
    const cleanBase64 = base64Image.split(',')[1] || base64Image;
    return this.withRetry(async () => {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: {
          parts: [
            { inlineData: { data: cleanBase64, mimeType } },
            { text: "Analyze this image and suggest 1 creative editing instruction (e.g., 'Change the background to a sunset beach', 'Add a futuristic neon jacket'). Output ONLY the instruction." }
          ]
        },
      });
      return response.text?.trim() || "Enhance the lighting and mood.";
    });
  }

  static async suggestInpaintPrompt(base64Image: string, maskBase64: string): Promise<string> {
    const ai = await this.getClient();
    const cleanBase64 = base64Image.split(',')[1] || base64Image;
    const cleanMask = maskBase64.split(',')[1] || maskBase64;
    return this.withRetry(async () => {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: {
          parts: [
            { inlineData: { data: cleanBase64, mimeType: 'image/png' } },
            { inlineData: { data: cleanMask, mimeType: 'image/png' } },
            { text: "Analyze the masked area and suggest 1 specific inpainting instruction (e.g., 'Replace with a bouquet of flowers', 'Change the hair color to platinum blonde'). Output ONLY the instruction." }
          ]
        },
      });
      return response.text?.trim() || "Reconstruct the background.";
    });
  }

  static async removeBackground(
    base64Image: string, 
    mimeType: string,
    modelChoice: ModelChoice,
    aspectRatio: AspectRatio = '1:1',
    imageSize: ImageSize = '1K'
  ): Promise<GenResult> {
    const ai = await this.getClient();
    const modelName = modelChoice === 'pro' ? MODELS.PRO : MODELS.FLASH;
    const cleanBase64 = base64Image.split(',')[1] || base64Image;

    const prompt = "Subject isolation task: Extract the primary foreground object and place it on a clean, uniform studio white background (#FFFFFF). Ensure pixel-perfect edge reconstruction and maintain original subject lighting and texture. Output ONLY the isolated subject image.";

    return this.withRetry(async () => {
      const result = await ai.models.generateContent({
        model: modelName,
        contents: {
          parts: [
            { text: prompt },
            { inlineData: { data: cleanBase64, mimeType } }
          ],
        },
        config: {
          systemInstruction: "You are a professional background removal specialist. Output ONLY the resulting image with the subject isolated on a pure white background.",
          temperature: 0.1,
          imageConfig: {
            aspectRatio,
            ...(modelChoice === 'pro' ? { imageSize } : {})
          },
          safetySettings: SAFETY_SETTINGS
        },
      });
      return this.processImageResponse(result);
    });
  }
}
