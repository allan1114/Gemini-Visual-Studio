/**
 * Centralized error handling utility for consistent error management across services
 */

export type ErrorCode =
  | 'NETWORK_ERROR'
  | 'API_ERROR'
  | 'VALIDATION_ERROR'
  | 'AUTH_ERROR'
  | 'SYNC_ERROR'
  | 'TIMEOUT_ERROR'
  | 'NOT_FOUND'
  | 'UNKNOWN_ERROR';

export interface ErrorInfo {
  code: ErrorCode;
  message: string;
  isRetryable: boolean;
  originalError?: unknown;
  details?: Record<string, unknown>;
}

export class ErrorHandler {
  /**
   * Classify an unknown error into a structured ErrorInfo object
   */
  static classify(error: unknown): ErrorInfo {
    if (error instanceof Error) {
      return this.classifyError(error);
    }

    if (typeof error === 'string') {
      return {
        code: 'UNKNOWN_ERROR',
        message: error,
        isRetryable: false,
      };
    }

    return {
      code: 'UNKNOWN_ERROR',
      message: 'An unknown error occurred',
      isRetryable: false,
      originalError: error,
    };
  }

  /**
   * Classify an Error object into structured ErrorInfo
   */
  private static classifyError(error: Error): ErrorInfo {
    const message = error.message || 'Unknown error';

    // Network errors
    if (
      message.includes('Failed to fetch') ||
      message.includes('Network') ||
      message.includes('CORS')
    ) {
      return {
        code: 'NETWORK_ERROR',
        message: `Network error: ${message}`,
        isRetryable: true,
        originalError: error,
      };
    }

    // Timeout errors
    if (message.includes('TIMEOUT') || message.includes('timeout')) {
      return {
        code: 'TIMEOUT_ERROR',
        message: `Request timeout: ${message}`,
        isRetryable: true,
        originalError: error,
      };
    }

    // Auth errors
    if (message.includes('AUTH') || message.includes('Unauthorized')) {
      return {
        code: 'AUTH_ERROR',
        message: `Authentication failed: ${message}`,
        isRetryable: false,
        originalError: error,
      };
    }

    // Rate limit errors (429, 503 - service temporarily unavailable)
    if (message.includes('429') || message.includes('503')) {
      return {
        code: 'API_ERROR',
        message: `API rate limit or service unavailable: ${message}`,
        isRetryable: true,
        originalError: error,
      };
    }

    // Validation errors
    if (message.includes('validation') || message.includes('invalid')) {
      return {
        code: 'VALIDATION_ERROR',
        message: `Validation failed: ${message}`,
        isRetryable: false,
        originalError: error,
      };
    }

    // Sync errors
    if (message.includes('SYNC')) {
      return {
        code: 'SYNC_ERROR',
        message: `Sync failed: ${message}`,
        isRetryable: true,
        originalError: error,
      };
    }

    // Not found errors
    if (message.includes('404') || message.includes('Not found')) {
      return {
        code: 'NOT_FOUND',
        message: `Resource not found: ${message}`,
        isRetryable: false,
        originalError: error,
      };
    }

    // API errors
    if (message.includes('API') || message.includes('error')) {
      return {
        code: 'API_ERROR',
        message: `API error: ${message}`,
        isRetryable: true,
        originalError: error,
      };
    }

    return {
      code: 'UNKNOWN_ERROR',
      message: message,
      isRetryable: false,
      originalError: error,
    };
  }

  /**
   * Get user-friendly error message with language support
   */
  static getUserMessage(errorInfo: ErrorInfo, language: 'en' | 'zh' = 'en'): string {
    const messages: Record<ErrorCode, Record<'en' | 'zh', string>> = {
      NETWORK_ERROR: {
        en: 'Network connection failed. Please check your internet connection.',
        zh: '网络连接失败。请检查您的网络连接。',
      },
      API_ERROR: {
        en: 'API request failed. Please try again later.',
        zh: 'API 请求失败。请稍后重试。',
      },
      VALIDATION_ERROR: {
        en: 'Invalid input. Please check your data and try again.',
        zh: '输入无效。请检查您的数据并重试。',
      },
      AUTH_ERROR: {
        en: 'Authentication failed. Please sign in again.',
        zh: '身份验证失败。请重新登录。',
      },
      SYNC_ERROR: {
        en: 'Synchronization failed. Some changes may not be synced.',
        zh: '同步失败。某些更改可能未同步。',
      },
      TIMEOUT_ERROR: {
        en: 'Request timed out. Please try again.',
        zh: '请求超时。请重试。',
      },
      NOT_FOUND: {
        en: 'Resource not found.',
        zh: '资源未找到。',
      },
      UNKNOWN_ERROR: {
        en: 'An unknown error occurred. Please try again.',
        zh: '发生未知错误。请重试。',
      },
    };

    return messages[errorInfo.code][language] || messages.UNKNOWN_ERROR[language];
  }

  /**
   * Retry a function with exponential backoff
   */
  static async withRetry<T>(
    fn: () => Promise<T>,
    maxRetries: number = 3,
    initialDelayMs: number = 1000
  ): Promise<T> {
    let lastError: ErrorInfo | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = this.classify(error);

        // Don't retry non-retryable errors
        if (!lastError.isRetryable) {
          throw error;
        }

        // Don't retry on last attempt
        if (attempt === maxRetries) {
          throw error;
        }

        // Calculate delay with exponential backoff and jitter
        const delay =
          initialDelayMs * Math.pow(2, attempt) + Math.random() * 1000;
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    // This should never be reached, but satisfy TypeScript
    throw lastError?.originalError || new Error('Max retries exceeded');
  }

  /**
   * Log error for debugging
   */
  static log(errorInfo: ErrorInfo, context?: string): void {
    const prefix = context ? `[${context}]` : '[Error]';
    console.error(
      `${prefix} ${errorInfo.code}: ${errorInfo.message}`,
      errorInfo.details
    );
  }
}
