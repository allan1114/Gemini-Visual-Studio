import { AspectRatio, ImageSize } from './types';
import pkg from './package.json';

/** Application version, sourced from package.json (single source of truth). */
export const APP_VERSION: string = pkg.version;

export const MODELS = {
  PRO: 'gemini-3-pro-image-preview',
  FLASH: 'gemini-2.5-flash-image',
  /** Text/vision model used for prompt expansion, metadata, suggestions. */
  TEXT: 'gemini-3-flash-preview',
  // Imagen 4 text-to-image models. Unlike the Nano Banana (*-image) models
  // above, these have a free-tier quota and use the predict/generateImages API.
  IMAGEN: 'imagen-4.0-generate-001',
  IMAGEN_FAST: 'imagen-4.0-fast-generate-001',
  IMAGEN_ULTRA: 'imagen-4.0-ultra-generate-001',
};

/**
 * Descriptors for the AI provider backends the app can route to. Used by the
 * provider factory for defaults and (later) by the Key Wallet UI.
 */
export const PROVIDERS = {
  gemini: {
    label: 'Google Gemini',
    defaultBaseUrl: '',
    defaultImageModel: MODELS.PRO,
    defaultTextModel: MODELS.TEXT,
  },
  'openai-compatible': {
    label: 'OpenAI Compatible',
    defaultBaseUrl: 'https://api.openai.com/v1',
    defaultImageModel: 'gpt-image-1',
    defaultTextModel: 'gpt-4o-mini',
  },
} as const;

export const ASPECT_RATIOS: AspectRatio[] = ['1:1', '3:4', '4:3', '9:16', '16:9'];
export const IMAGE_SIZES: ImageSize[] = ['1K', '2K', '4K'];

export const STORAGE_KEYS = {
  HISTORY: 'gvs_history_v2',
  USERS: 'gvs_users_v2',
  SESSION: 'gvs_session_v2',
  PRESETS: 'gvs_presets_v2',
  API_KEYS: 'gvs_api_keys_v1',
};

export const EDIT_FILTERS = [
  { id: 'none', label: { en: 'None', zh: '無' }, prompt: '' },
  {
    id: 'vintage',
    label: { en: 'Vintage', zh: '復古底片' },
    prompt: 'vintage film look, grainy texture, 70s aesthetic, faded colors',
  },
  {
    id: 'bw',
    label: { en: 'B&W', zh: '黑白經典' },
    prompt: 'professional black and white, monochrome, high contrast, film noir style',
  },
  {
    id: 'cinematic',
    label: { en: 'Cinematic', zh: '電影質感' },
    prompt: 'cinematic lighting, anamorphic lens, movie still, teal and orange grade',
  },
  {
    id: 'sketch',
    label: { en: 'Sketch', zh: '素描' },
    prompt: 'detailed pencil sketch, hand-drawn, charcoal art, artistic lines',
  },
  {
    id: 'vivid',
    label: { en: 'Vivid', zh: '鮮艷' },
    prompt: 'vivid colors, high saturation, vibrant, sharp and crisp details',
  },
  {
    id: 'watercolor',
    label: { en: 'Watercolor', zh: '水彩' },
    prompt: 'soft watercolor painting, bleeding colors, artistic paper texture',
  },
  {
    id: 'cyberpunk',
    label: { en: 'Cyberpunk', zh: '賽博朋克' },
    prompt: 'cyberpunk aesthetic, neon lights, purple and blue atmosphere, futuristic',
  },
];

export const AVATAR_STYLES = [
  {
    id: 'pixar',
    label: { en: '3D Pixar', zh: '3D 皮克斯' },
    prompt:
      'Pixar style 3D character, big expressive eyes, soft lighting, high-quality rendering, cute aesthetic',
  },
  {
    id: 'anime',
    label: { en: 'Anime', zh: '日系動漫' },
    prompt:
      'vibrant anime style, high quality hand-drawn aesthetic, expressive features, cell shaded',
  },
  {
    id: 'cyber',
    label: { en: 'Cyberpunk', zh: '賽博朋克' },
    prompt:
      'cyberpunk avatar, neon highlights, futuristic tech elements, glowing eyes, dark cinematic mood',
  },
  {
    id: 'pencil',
    label: { en: 'Hand Sketch', zh: '手繪素描' },
    prompt: 'artistic charcoal sketch, detailed pencil lines, hand-drawn portrait, high contrast',
  },
  {
    id: 'voxel',
    label: { en: 'Voxel Art', zh: '方塊藝術' },
    prompt: 'Minecraft-style voxel art, blocky 3D avatar, 8-bit aesthetic, digital toy look',
  },
  {
    id: 'oil',
    label: { en: 'Oil Painting', zh: '古典油畫' },
    prompt: 'classical oil painting portrait, heavy brushstrokes, rich textures, museum quality',
  },
  {
    id: 'pop',
    label: { en: 'Pop Art', zh: '波普藝術' },
    prompt: 'Andy Warhol style pop art, vibrant flat colors, comic book style, bold outlines',
  },
  {
    id: 'vector',
    label: { en: 'Flat Vector', zh: '扁平插畫' },
    prompt: 'modern flat vector illustration, minimal design, clean shapes, corporate aesthetic',
  },
];
