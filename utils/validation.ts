/**
 * Lightweight input validation for user-supplied text and images before they
 * are sent to an AI provider or persisted. This is a client-side guard rail to
 * catch obviously bad input early (huge prompts, oversized images) — real
 * enforcement still happens server-side / at the provider.
 */

export const LIMITS = {
  PROMPT_MAX_CHARS: 4000,
  PRESET_NAME_MAX_CHARS: 80,
  TAG_MAX_CHARS: 40,
  /** Max decoded image size accepted for upload/edit, in megabytes. */
  IMAGE_MAX_MB: 20,
};

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

/** Validates and trims a generation/edit prompt. Throws ValidationError on failure. */
export function validatePrompt(prompt: string): string {
  const trimmed = (prompt ?? '').trim();
  if (!trimmed) throw new ValidationError('Prompt cannot be empty.');
  if (trimmed.length > LIMITS.PROMPT_MAX_CHARS) {
    throw new ValidationError(`Prompt exceeds ${LIMITS.PROMPT_MAX_CHARS} characters.`);
  }
  return trimmed;
}

/** Validates a preset name. */
export function validatePresetName(name: string): string {
  const trimmed = (name ?? '').trim();
  if (!trimmed) throw new ValidationError('Preset name cannot be empty.');
  if (trimmed.length > LIMITS.PRESET_NAME_MAX_CHARS) {
    throw new ValidationError(`Preset name exceeds ${LIMITS.PRESET_NAME_MAX_CHARS} characters.`);
  }
  return trimmed;
}

/** Normalizes and bounds a list of tags. */
export function sanitizeTags(tags: string[] | undefined): string[] {
  if (!Array.isArray(tags)) return [];
  return tags
    .map((t) => (t ?? '').trim())
    .filter(Boolean)
    .map((t) => (t.length > LIMITS.TAG_MAX_CHARS ? t.slice(0, LIMITS.TAG_MAX_CHARS) : t));
}

/** Estimates the decoded size (MB) of a base64 data URL. */
export function base64SizeMB(base64Str: string): number {
  const commaIdx = base64Str.indexOf(',');
  const len = base64Str.length - (commaIdx + 1);
  return (len * 3) / 4 / (1024 * 1024);
}

/** Throws if a base64 image exceeds the configured maximum size. */
export function validateImageSize(base64Str: string): void {
  if (!base64Str) return;
  const sizeMB = base64SizeMB(base64Str);
  if (sizeMB > LIMITS.IMAGE_MAX_MB) {
    throw new ValidationError(
      `Image is too large (${sizeMB.toFixed(1)} MB > ${LIMITS.IMAGE_MAX_MB} MB).`
    );
  }
}
