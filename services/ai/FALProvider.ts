import { PROVIDERS } from '../../constants';
import { AspectRatio } from '../../types';
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
 * Provider for fal.ai (https://fal.ai). Unlike OpenAI-compatible gateways, fal
 * exposes one HTTP endpoint per model at `https://fal.run/{model-id}` and
 * authenticates with an `Authorization: Key <FAL_KEY>` header (verified against
 * fal's synchronous-request docs).
 *
 * - Image generation maps to the configured image model (default
 *   `fal-ai/flux/dev`), which returns hosted image URLs we re-fetch into data
 *   URLs so the downstream WebP pipeline isn't tripped up by CORS/canvas taint.
 * - Text + vision route through `fal-ai/any-llm` / `fal-ai/any-llm/vision`,
 *   whose `model` field selects the underlying LLM (default
 *   `google/gemini-flash-1.5`) and whose response carries the text in `output`.
 * - Mask-based editing / inpainting / background removal are documented stubs
 *   (FAL is text-to-image first); failures are normalized to the shared
 *   SAFETY_BLOCK / Model Refusal contract so the Pro->Flash fallback still holds.
 */

/** Maps the app's aspect ratios to fal's `image_size` enum values. */
export const IMAGE_SIZE_MAP: Record<AspectRatio, string> = {
  '1:1': 'square_hd',
  '3:4': 'portrait_4_3',
  '4:3': 'landscape_4_3',
  '9:16': 'portrait_16_9',
  '16:9': 'landscape_16_9',
};

function clean(base64: string): string {
  return base64.split(',')[1] || base64;
}

/** Same-origin Vercel proxy that forwards to fal.run (see api/fal.ts). */
const FAL_PROXY_PATH = '/api/fal';

/** Reads a Blob into a base64 data URL. */
function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('EMPTY_RESPONSE: could not read generated image.'));
    reader.readAsDataURL(blob);
  });
}

export class FALProvider implements AIProvider {
  readonly type = 'fal' as const;
  private baseUrl: string;
  private imageModelId: string;
  private textModelId: string;
  private useProxy: boolean;

  constructor(private endpoint: ResolvedEndpoint) {
    this.baseUrl = (endpoint.baseUrl || PROVIDERS.fal.defaultBaseUrl).replace(/\/$/, '');
    this.imageModelId = endpoint.imageModelId || PROVIDERS.fal.defaultImageModel;
    this.textModelId = endpoint.textModelId || PROVIDERS.fal.defaultTextModel;
    // Browsers can't call fal.run directly (no CORS). When using the default
    // fal endpoint in a browser, route through the bundled /api/fal proxy. A
    // custom baseUrl is treated as the user's own CORS-enabled proxy and called
    // directly with an Authorization header.
    this.useProxy = typeof window !== 'undefined' && this.baseUrl === PROVIDERS.fal.defaultBaseUrl;
  }

  private headers(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      Authorization: `Key ${this.endpoint.apiKey}`,
    };
  }

  /** POSTs to a fal model endpoint, normalizing failures to the shared contract. */
  private async run(modelId: string, body: unknown): Promise<any> {
    const res = this.useProxy
      ? await fetch(FAL_PROXY_PATH, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-fal-key': this.endpoint.apiKey,
            'x-fal-target': modelId,
          },
          body: JSON.stringify(body),
        })
      : await fetch(`${this.baseUrl}/${modelId}`, {
          method: 'POST',
          headers: this.headers(),
          body: JSON.stringify(body),
        });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      if (
        (res.status === 400 || res.status === 422) &&
        /nsfw|safety|content[_ ]?policy/i.test(text)
      ) {
        throw new Error('SAFETY_BLOCK');
      }
      throw new Error(`Model Refusal: ${text.slice(0, 120)}...`);
    }
    return res.json();
  }

  /** Fetches a fal-hosted result image (via the proxy when enabled) as a data URL. */
  private async fetchImage(url: string): Promise<string> {
    const target = this.useProxy ? `${FAL_PROXY_PATH}?image=${encodeURIComponent(url)}` : url;
    const res = await fetch(target);
    if (!res.ok) throw new Error(`Model Refusal: failed to fetch generated image (${res.status})`);
    return blobToDataUrl(await res.blob());
  }

  async generateImage(req: ImageGenRequest): Promise<ImageGenResult> {
    // FAL image models have no system-instruction field — fold it into the prompt.
    const prompt = req.systemInstruction ? `${req.systemInstruction}\n\n${req.prompt}` : req.prompt;
    const json = await this.run(this.imageModelId, {
      prompt,
      image_size: IMAGE_SIZE_MAP[req.aspectRatio] || 'square_hd',
      num_images: 1,
      ...(req.seed != null ? { seed: req.seed } : {}),
    });
    const url = json?.images?.[0]?.url;
    if (!url) throw new Error('EMPTY_RESPONSE: No image data was returned.');
    // fal returns hosted URLs; inline so the WebP pipeline isn't CORS-blocked.
    const dataUrl = await this.fetchImage(url);
    // fal image endpoints report no token usage.
    return { url: dataUrl, inputTokens: 0, outputTokens: 0 };
  }

  async editImage(_req: ImageEditRequest): Promise<ImageGenResult> {
    throw new Error('NOT_SUPPORTED: Image editing is not yet implemented for fal.ai providers.');
  }

  async inpaintImage(_req: ImageInpaintRequest): Promise<ImageGenResult> {
    throw new Error('NOT_SUPPORTED: Inpainting is not yet implemented for fal.ai providers.');
  }

  async removeBackground(_req: ImageEditRequest): Promise<ImageGenResult> {
    throw new Error(
      'NOT_SUPPORTED: Background removal is not yet implemented for fal.ai providers.'
    );
  }

  /** Runs a text/vision request through fal-ai/any-llm, returning raw output text. */
  private async runAnyLlm(req: TextRequest): Promise<string> {
    const hasImages = (req.images?.length ?? 0) > 0;
    const modelEndpoint = hasImages ? 'fal-ai/any-llm/vision' : 'fal-ai/any-llm';
    const body: Record<string, unknown> = {
      model: this.textModelId,
      prompt: req.prompt,
      ...(req.systemInstruction ? { system_prompt: req.systemInstruction } : {}),
    };
    if (hasImages) {
      const img = req.images![0];
      // any-llm/vision takes a single image_url; pass it as an inline data URL.
      body.image_url = `data:${img.mimeType};base64,${clean(img.base64)}`;
    }
    const json = await this.run(modelEndpoint, body);
    return json?.output || '';
  }

  async generateText(req: TextRequest): Promise<TextResult> {
    const text = await this.runAnyLlm(req);
    // any-llm does not report token usage.
    return { text, inputTokens: 0, outputTokens: 0 };
  }

  async generateJson<T>(
    req: TextRequest
  ): Promise<{ data: T; inputTokens: number; outputTokens: number }> {
    // any-llm has no structured-output mode; steer it and parse defensively.
    const steer = `${req.prompt}\n\nReturn ONLY valid JSON with no commentary or code fences.`;
    const raw = await this.runAnyLlm({ ...req, prompt: steer });
    const match = raw.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    const data = JSON.parse(match ? match[0] : raw) as T;
    return { data, inputTokens: 0, outputTokens: 0 };
  }

  async testKey(): Promise<boolean> {
    try {
      await this.run('fal-ai/any-llm', { model: this.textModelId, prompt: 'ping' });
      return true;
    } catch {
      return false;
    }
  }
}
