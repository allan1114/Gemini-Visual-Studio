/**
 * Simple client-side token-bucket rate limiter. Prevents a runaway loop or
 * impatient user from hammering the AI provider and burning quota. This is a
 * courtesy guard only — authoritative rate limiting lives at the provider.
 */

export class RateLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RateLimitError';
  }
}

export class TokenBucket {
  private tokens: number;
  private lastRefill: number;

  constructor(
    private readonly capacity: number,
    private readonly refillPerSec: number
  ) {
    this.tokens = capacity;
    this.lastRefill = Date.now();
  }

  private refill(): void {
    const now = Date.now();
    const elapsedSec = (now - this.lastRefill) / 1000;
    if (elapsedSec <= 0) return;
    this.tokens = Math.min(this.capacity, this.tokens + elapsedSec * this.refillPerSec);
    this.lastRefill = now;
  }

  /** Attempts to consume one token. Returns false when none are available. */
  tryRemove(): boolean {
    this.refill();
    if (this.tokens >= 1) {
      this.tokens -= 1;
      return true;
    }
    return false;
  }

  /** Consumes one token or throws RateLimitError. */
  consume(label = 'requests'): void {
    if (!this.tryRemove()) {
      throw new RateLimitError(
        `Rate limit reached for ${label}. Please wait a moment before trying again.`
      );
    }
  }
}

/**
 * Shared bucket for image generation: bursts of up to 10, refilling at one
 * token every ~3 seconds (≈20/min sustained).
 */
export const imageGenerationLimiter = new TokenBucket(10, 1 / 3);
