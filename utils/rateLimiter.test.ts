import { describe, it, expect, vi, afterEach } from 'vitest';
import { TokenBucket, RateLimitError } from './rateLimiter';

afterEach(() => {
  vi.useRealTimers();
});

describe('TokenBucket', () => {
  it('allows up to capacity, then blocks', () => {
    const bucket = new TokenBucket(3, 0); // no refill
    expect(bucket.tryRemove()).toBe(true);
    expect(bucket.tryRemove()).toBe(true);
    expect(bucket.tryRemove()).toBe(true);
    expect(bucket.tryRemove()).toBe(false);
  });

  it('consume() throws RateLimitError when empty', () => {
    const bucket = new TokenBucket(1, 0);
    bucket.consume();
    expect(() => bucket.consume('images')).toThrow(RateLimitError);
  });

  it('refills over time', () => {
    vi.useFakeTimers();
    const bucket = new TokenBucket(2, 1); // 1 token/sec
    bucket.consume();
    bucket.consume();
    expect(bucket.tryRemove()).toBe(false);
    vi.advanceTimersByTime(1100); // ~1 token back
    expect(bucket.tryRemove()).toBe(true);
  });
});
