import { PROVIDERS } from '../../constants';
import {
  AIProvider,
  ImageEditRequest,
  ImageGenRequest,
  ImageGenResult,
  ImageInpaintRequest,
  ResolvedEndpoint,
  TextRequest,
  TextResult,
} from './types';

/**
 * Provider for MiniMax (international edition, https://api.minimax.io). Built
 * with `fetch` so it adds no SDK weight.
 *
 * - Image generation POSTs to `/image_generation` with MiniMax's own request
 *   shape (`model` / `prompt` / `aspect_ratio` / `response_format`). MiniMax
 *   accepts the app's aspect ratios verbatim (`1:1`, `3:4`, `4:3`, `9:16`,
 *   `16:9`), so no size-string mapping is needed. The response carries an array
 *   of raw base64 strings in `data.image_base64`, which we wrap into a data URL
 *   so the downstream WebP pipeline isn't tripped up.
 * - Text + vision route through the OpenAI-compatible `/text/chatcompletion_v2`
 *   endpoint, whose `model` field selects the LLM (default `MiniMax-Text-01`).
 * - Mask-based editing / inpainting / background removal are documented stubs
 *   (MiniMax is text-to-image first); failures are normalized to the shared
 *   SAFETY_BLOCK / Model Refusal contract so the Pro->Flash fallback still holds.
 *
 * Note: like the OpenAI-compatible provider, this calls the vendor host directly
 * from the browser. If `api.minimax.io` lacks permissive CORS headers, hosted
 * builds may be blocked — users can point the Key Wallet "Base URL" override at
 * their own CORS-enabled proxy.
 */

function clean(base64: string): string {
  return base64.split(',')[1] || base64;
}

/** MiniMax wraps successful HTTP 200 responses in a status envelope. */
interface MinimaxBaseResp {
  status_code?: number;
  status_msg?: string;
}

export class MinimaxProvider implements AIProvider {
  readonly type = 'minimax' as const;
  private baseUrl: string;
  private imageModelId: string;
  private textModelId: string;

  constructor(private endpoint: ResolvedEndpoint) {
    this.baseUrl = (endpoint.baseUrl || PROVIDERS.minimax.defaultBaseUrl).replace(/\/$/, '');
    this.imageModelId = endpoint.imageModelId || PROVIDERS.minimax.defaultImageModel;
    this.textModelId = endpoint.textModelId || PROVIDERS.minimax.defaultTextModel;
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
      if (res.status === 400 && /content[_ ]?policy|safety|moderation|sensitive/i.test(text)) {
        throw new Error('SAFETY_BLOCK');
      }
      throw new Error(`Model Refusal: ${text.slice(0, 120)}...`);
    }
    const json = await res.json();
    // MiniMax returns HTTP 200 even for logical failures; the real status is in
    // base_resp (status_code 0 = success).
    const base: MinimaxBaseResp | undefined = json?.base_resp;
    if (base && base.status_code != null && base.status_code !== 0) {
      const msg = base.status_msg || '';
      if (/safety|sensitive|content[_ ]?policy|moderation/i.test(msg)) {
        throw new Error('SAFETY_BLOCK');
      }
      throw new Error(`Model Refusal: ${msg.slice(0, 120)}`);
    }
    return json;
  }

  async generateImage(req: ImageGenRequest): Promise<ImageGenResult> {
    // MiniMax's image API has no system-instruction field — fold it into the prompt.
    const prompt = req.systemInstruction ? `${req.systemInstruction}\n\n${req.prompt}` : req.prompt;
    const json = await this.post('/image_generation', {
      model: this.imageModelId,
      prompt,
      aspect_ratio: req.aspectRatio,
      response_format: 'base64',
      n: 1,
      ...(req.seed != null ? { seed: req.seed } : {}),
    });
    const b64 = json?.data?.image_base64?.[0];
    if (!b64) throw new Error('EMPTY_RESPONSE: No image data was returned.');
    // MiniMax returns raw base64 (JPEG); inline as a data URL. No token usage reported.
    return { url: `data:image/jpeg;base64,${clean(b64)}`, inputTokens: 0, outputTokens: 0 };
  }

  async editImage(_req: ImageEditRequest): Promise<ImageGenResult> {
    throw new Error('NOT_SUPPORTED: Image editing is not yet implemented for MiniMax.');
  }

  async inpaintImage(_req: ImageInpaintRequest): Promise<ImageGenResult> {
    throw new Error('NOT_SUPPORTED: Inpainting is not yet implemented for MiniMax.');
  }

  async removeBackground(_req: ImageEditRequest): Promise<ImageGenResult> {
    throw new Error('NOT_SUPPORTED: Background removal is not yet implemented for MiniMax.');
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
    const json = await this.post('/text/chatcompletion_v2', {
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
    // MiniMax v2 chat may not honor response_format reliably — steer to JSON and
    // parse defensively.
    const steer = `${req.prompt}\n\nReturn ONLY valid JSON with no commentary or code fences.`;
    const json = await this.post('/text/chatcompletion_v2', {
      model: this.textModelId,
      messages: this.buildMessages({ ...req, prompt: steer }),
      ...(req.temperature != null ? { temperature: req.temperature } : {}),
    });
    const raw = json?.choices?.[0]?.message?.content || '';
    const match = raw.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    return {
      data: JSON.parse(match ? match[0] : raw) as T,
      inputTokens: json?.usage?.prompt_tokens || 0,
      outputTokens: json?.usage?.completion_tokens || 0,
    };
  }

  async testKey(): Promise<boolean> {
    try {
      await this.post('/text/chatcompletion_v2', {
        model: this.textModelId,
        messages: [{ role: 'user', content: 'ping' }],
      });
      return true;
    } catch {
      return false;
    }
  }
}
