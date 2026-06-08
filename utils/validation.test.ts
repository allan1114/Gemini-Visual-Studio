import { describe, it, expect } from 'vitest';
import {
  validatePrompt,
  validatePresetName,
  sanitizeTags,
  validateImageSize,
  base64SizeMB,
  ValidationError,
  LIMITS,
} from './validation';

describe('validatePrompt', () => {
  it('trims and returns a valid prompt', () => {
    expect(validatePrompt('  a cat  ')).toBe('a cat');
  });

  it('throws on empty input', () => {
    expect(() => validatePrompt('   ')).toThrow(ValidationError);
  });

  it('throws when over the character limit', () => {
    const long = 'x'.repeat(LIMITS.PROMPT_MAX_CHARS + 1);
    expect(() => validatePrompt(long)).toThrow(ValidationError);
  });
});

describe('validatePresetName', () => {
  it('accepts a normal name', () => {
    expect(validatePresetName(' Portrait ')).toBe('Portrait');
  });

  it('rejects empty names', () => {
    expect(() => validatePresetName('')).toThrow(ValidationError);
  });
});

describe('sanitizeTags', () => {
  it('drops empties and trims', () => {
    expect(sanitizeTags([' a ', '', 'b'])).toEqual(['a', 'b']);
  });

  it('returns [] for non-arrays', () => {
    expect(sanitizeTags(undefined)).toEqual([]);
  });

  it('truncates over-long tags', () => {
    const long = 'y'.repeat(LIMITS.TAG_MAX_CHARS + 5);
    expect(sanitizeTags([long])[0].length).toBe(LIMITS.TAG_MAX_CHARS);
  });
});

describe('validateImageSize', () => {
  it('passes small images', () => {
    expect(() => validateImageSize('data:image/png;base64,AAAA')).not.toThrow();
  });

  it('throws on oversized images', () => {
    const bigPayload = 'A'.repeat(Math.ceil(LIMITS.IMAGE_MAX_MB * 1024 * 1024 * (4 / 3)) + 10);
    expect(() => validateImageSize(`data:image/png;base64,${bigPayload}`)).toThrow(ValidationError);
  });
});

describe('base64SizeMB', () => {
  it('approximates decoded size', () => {
    const payload = 'A'.repeat(4 * 1024 * 1024); // ~3MB decoded
    const mb = base64SizeMB(`data:image/png;base64,${payload}`);
    expect(mb).toBeGreaterThan(2.5);
    expect(mb).toBeLessThan(3.5);
  });
});
