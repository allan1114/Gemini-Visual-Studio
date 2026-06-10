import { describe, it, expect } from 'vitest';
import { resolveGeminiImageModel } from './GeminiProvider';
import { MODELS } from '../../constants';

describe('resolveGeminiImageModel', () => {
  it('maps flash to the Nano Banana flash model (gemini kind)', () => {
    expect(resolveGeminiImageModel('flash')).toEqual({ id: MODELS.FLASH, kind: 'gemini' });
  });

  it('maps pro to the Pro model, honouring an override', () => {
    expect(resolveGeminiImageModel('pro')).toEqual({ id: MODELS.PRO, kind: 'gemini' });
    expect(resolveGeminiImageModel('pro', 'custom-pro')).toEqual({
      id: 'custom-pro',
      kind: 'gemini',
    });
  });

  it('maps the three Imagen choices to imagen ids with imagen kind', () => {
    expect(resolveGeminiImageModel('imagen-4')).toEqual({ id: MODELS.IMAGEN, kind: 'imagen' });
    expect(resolveGeminiImageModel('imagen-4-fast')).toEqual({
      id: MODELS.IMAGEN_FAST,
      kind: 'imagen',
    });
    expect(resolveGeminiImageModel('imagen-4-ultra')).toEqual({
      id: MODELS.IMAGEN_ULTRA,
      kind: 'imagen',
    });
  });
});
