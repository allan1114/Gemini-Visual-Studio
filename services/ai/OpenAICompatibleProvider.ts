import { PROVIDERS } from '../../constants';
import {
  AIProvider,
  AspectRatioSizeMap,
  ImageEditRequest,
  ImageGenRequest,
  ImageGenResult,
  ImageInpaintRequest,
  ResolvedEndpoint,
  TextRequest,
  TextResult,
} from './types';

/**
 * Provider for OpenAI-compatible HTTP endpoints (OpenAI, or any gateway that
 * mirrors `/images/generations`, `/chat/completions`, `/models`). Implemented
 * with `fetch` so it adds no SDK weight.
 *
 * Scope note: text + image generation + key test are wired; mask-based
 * editing/inpainting and background removal are documented stubs because their
 * semantics diverge sharply from Gemini (see below) and need real endpoints to
 * validate against. Failures are normalized to the SAFETY_BLOCK / Model Refusal
 * error strings so the Pro->Flash fallback contract still holds.
 */

/** Maps the app's aspect ratios to the nearest OpenAI-supported size string. */
const SIZE_MAP: AspectRatioSizeMap = {
  '1:1': '1024x1024',
  '3:4': '1024x1536',
  '4:3': '1536x1024',
  '9:16': '1024x1792',
  '16:9': '1792x1024',
};

function clean(base64: string): string {
  return base64.split(',')[1] || base64;
}

export class OpenAICompatibleProvider implements AIProvider {
  readonly type = 'openai-compatible' as const;
  private baseUrl: string;
  private imageModelId: string;
  private textModelId: string;

  constructor(private endpoint: ResolvedEndpoint) {
    this.baseUrl = (endpoint.baseUrl || PROVIDERS['openai-compatible'].defaultBaseUrl).replace(
      /\/$/,
      ''
    );
    this.imageModelId = endpoint.imageModelId || PROVIDERS['openai-compatible'].defaultImageModel;
    this.textModelId = endpoint.textModelId || PROVIDERS['openai-compatible'].defaultTextModel;
  }

  private headers(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.endpoint.apiKey}`,
    };
  }

  private async post(path: string, body: unknown): Promise<any> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      // Normalize content-policy rejections to the shared safety contract.
      if (res.status === 400 && /content[_ ]?policy|safety|moderation/i.test(text)) {
        throw new Error('SAFETY_BLOCK');
      }
      throw new Error(`Model Refusal: ${text.slice(0, 100)}...`);
    }
    return res.json();
  }

  async generateImage(req: ImageGenRequest): Promise<ImageGenResult> {
    // OpenAI images API has no system instruction / seed / temperature — fold
    // the system instruction into the prompt text.
    const prompt = req.systemInstruction ? `${req.systemInstruction}\n\n${req.prompt}` : req.prompt;
    const json = await this.post('/images/generations', {
      model: this.imageModelId,
      prompt,
      size: SIZE_MAP[req.aspectRatio] || '1024x1024',
      n: 1,
      response_format: 'b64_json',
    });
    const b64 = json?.data?.[0]?.b64_json;
    if (!b64) throw new Error('EMPTY_RESPONSE: No image data was returned.');
    // Images API returns no token usage.
    return { url: `data:image/png;base64,${b64}`, inputTokens: 0, outputTokens: 0 };
  }

  async editImage(_req: ImageEditRequest): Promise<ImageGenResult> {
    // OpenAI /images/edits is multipart and does not support free-form
    // "edit the whole image with this instruction" like Gemini. Needs a real
    // endpoint + multipart handling to implement faithfully.
    throw new Error(
      'NOT_SUPPORTED: Image editing is not yet implemented for OpenAI-compatible providers.'
    );
  }

  async inpaintImage(_req: ImageInpaintRequest): Promise<ImageGenResult> {
    // CRITICAL divergence: OpenAI expects the mask's TRANSPARENT pixels to be
    // the region to change, the inverse of Gemini (white = change). A faithful
    // implementation must invert+alpha-convert the mask before upload.
    throw new Error(
      'NOT_SUPPORTED: Inpainting is not yet implemented for OpenAI-compatible providers.'
    );
  }

  async removeBackground(_req: ImageEditRequest): Promise<ImageGenResult> {
    throw new Error(
      'NOT_SUPPORTED: Background removal is not yet implemented for OpenAI-compatible providers.'
    );
  }

  private buildMessages(req: TextRequest) {
    const content: any[] = [{ type: 'text', text: req.prompt }];
    for (const img of req.images || []) {
      content.push({
        type: 'image_url',
        image_url: { url: `data:${img.mimeType};base64,${clean(img.base64)}` },
      });
    }
    const messages: any[] = [];
    if (req.systemInstruction) messages.push({ role: 'system', content: req.systemInstruction });
    messages.push({ role: 'user', content });
    return messages;
  }

  async generateText(req: TextRequest): Promise<TextResult> {
    const json = await this.post('/chat/completions', {
      model: this.textModelId,
      messages: this.buildMessages(req),
      ...(req.temperature != null ? { temperature: req.temperature } : {}),
      ...(req.maxOutputTokens ? { max_tokens: req.maxOutputTokens } : {}),
    });
    return {
      text: json?.choices?.[0]?.message?.content || '',
      inputTokens: json?.usage?.prompt_tokens || 0,
      outputTokens: json?.usage?.completion_tokens || 0,
    };
  }

  async generateJson<T>(
    req: TextRequest
  ): Promise<{ data: T; inputTokens: number; outputTokens: number }> {
    const json = await this.post('/chat/completions', {
      model: this.textModelId,
      messages: this.buildMessages(req),
      response_format: { type: 'json_object' },
      ...(req.temperature != null ? { temperature: req.temperature } : {}),
    });
    const text = json?.choices?.[0]?.message?.content || '{}';
    return {
      data: JSON.parse(text) as T,
      inputTokens: json?.usage?.prompt_tokens || 0,
      outputTokens: json?.usage?.completion_tokens || 0,
    };
  }

  async testKey(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/models`, { headers: this.headers() });
      return res.ok;
    } catch {
      return false;
    }
  }
}
