import { describe, it, expect } from 'vitest';
import { ErrorHandler, ErrorCode } from './errorHandler';

describe('ErrorHandler', () => {
  describe('classify', () => {
    it('should classify network errors', () => {
      const error = new Error('Failed to fetch');
      const result = ErrorHandler.classify(error);
      expect(result.code).toBe('NETWORK_ERROR');
      expect(result.isRetryable).toBe(true);
    });

    it('should classify timeout errors', () => {
      const error = new Error('Request timeout');
      const result = ErrorHandler.classify(error);
      expect(result.code).toBe('TIMEOUT_ERROR');
      expect(result.isRetryable).toBe(true);
    });

    it('should classify auth errors', () => {
      const error = new Error('Unauthorized');
      const result = ErrorHandler.classify(error);
      expect(result.code).toBe('AUTH_ERROR');
      expect(result.isRetryable).toBe(false);
    });

    it('should classify validation errors', () => {
      const error = new Error('validation failed');
      const result = ErrorHandler.classify(error);
      expect(result.code).toBe('VALIDATION_ERROR');
      expect(result.isRetryable).toBe(false);
    });

    it('should classify rate limit errors', () => {
      const error = new Error('429 Too Many Requests');
      const result = ErrorHandler.classify(error);
      expect(result.code).toBe('API_ERROR');
      expect(result.isRetryable).toBe(true);
    });

    it('should handle non-Error objects', () => {
      const result = ErrorHandler.classify('string error');
      expect(result.code).toBe('UNKNOWN_ERROR');
      expect(result.isRetryable).toBe(false);
    });

    it('should handle unknown errors', () => {
      const result = ErrorHandler.classify(null);
      expect(result.code).toBe('UNKNOWN_ERROR');
    });
  });

  describe('getUserMessage', () => {
    it('should return English message by default', () => {
      const errorInfo = {
        code: 'NETWORK_ERROR' as ErrorCode,
        message: 'Network failed',
        isRetryable: true,
      };
      const msg = ErrorHandler.getUserMessage(errorInfo, 'en');
      expect(msg).toContain('Network connection failed');
    });

    it('should return Chinese message when requested', () => {
      const errorInfo = {
        code: 'NETWORK_ERROR' as ErrorCode,
        message: 'Network failed',
        isRetryable: true,
      };
      const msg = ErrorHandler.getUserMessage(errorInfo, 'zh');
      expect(msg).toContain('网络');
    });

    it('should return message for all error codes', () => {
      const codes: ErrorCode[] = [
        'NETWORK_ERROR',
        'API_ERROR',
        'VALIDATION_ERROR',
        'AUTH_ERROR',
        'SYNC_ERROR',
        'TIMEOUT_ERROR',
        'NOT_FOUND',
        'UNKNOWN_ERROR',
      ];

      codes.forEach((code) => {
        const errorInfo = {
          code,
          message: 'test',
          isRetryable: false,
        };
        const msg = ErrorHandler.getUserMessage(errorInfo, 'en');
        expect(msg).toBeTruthy();
        expect(msg.length).toBeGreaterThan(0);
      });
    });
  });

  describe('withRetry', () => {
    it('should return result on success', async () => {
      const fn = async () => 'success';
      const result = await ErrorHandler.withRetry(fn);
      expect(result).toBe('success');
    });

    it('should retry on transient errors', async () => {
      let attempts = 0;
      const fn = async () => {
        attempts++;
        if (attempts < 2) {
          throw new Error('429 rate limit');
        }
        return 'success';
      };

      const result = await ErrorHandler.withRetry(fn, 3, 10);
      expect(result).toBe('success');
      expect(attempts).toBe(2);
    });

    it('should not retry on permanent errors', async () => {
      let attempts = 0;
      const fn = async () => {
        attempts++;
        throw new Error('validation error');
      };

      try {
        await ErrorHandler.withRetry(fn, 3, 10);
      } catch (e) {
        // expected
      }
      expect(attempts).toBe(1);
    });

    it('should fail after max retries', async () => {
      const fn = async () => {
        throw new Error('429 rate limit');
      };

      try {
        await ErrorHandler.withRetry(fn, 2, 10);
        expect.fail('should have thrown');
      } catch (e) {
        expect(e).toBeDefined();
      }
    });
  });
});
