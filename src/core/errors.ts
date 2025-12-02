/**
 * Error classes for the Stripe SDK.
 * All errors extend from base Error class with additional context.
 */

/**
 * Base error class for payment-related errors.
 * Includes error code and HTTP status code for proper error handling.
 */
export class PaymentError extends Error {
  /**
   * Creates a new PaymentError.
   * @param message - Human-readable error message
   * @param code - Machine-readable error code
   * @param statusCode - HTTP status code (default: 500)
   */
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 500
  ) {
    super(message);
    this.name = 'PaymentError';
    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, PaymentError);
    }
  }
}

/**
 * Error class for webhook-related failures.
 * Used when webhook signature verification fails or webhook processing errors occur.
 */
export class WebhookError extends Error {
  /**
   * Creates a new WebhookError.
   * @param message - Human-readable error message
   * @param code - Machine-readable error code
   */
  constructor(
    message: string,
    public readonly code: string
  ) {
    super(message);
    this.name = 'WebhookError';
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, WebhookError);
    }
  }
}

/**
 * Error class for configuration-related failures.
 * Used when required environment variables or configuration is missing or invalid.
 */
export class ConfigError extends Error {
  /**
   * Creates a new ConfigError.
   * @param message - Human-readable error message
   */
  constructor(message: string) {
    super(message);
    this.name = 'ConfigError';
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ConfigError);
    }
  }
}

/**
 * Standard error codes used throughout the SDK.
 */
export const ErrorCodes = {
  /** Missing or invalid configuration */
  INVALID_CONFIG: 'INVALID_CONFIG',
  /** Invalid request parameters */
  INVALID_REQUEST: 'INVALID_REQUEST',
  /** Webhook signature verification failed */
  WEBHOOK_SIGNATURE_INVALID: 'WEBHOOK_SIGNATURE_INVALID',
  /** Payment processing failed */
  PAYMENT_FAILED: 'PAYMENT_FAILED',
  /** Resource not found */
  NOT_FOUND: 'NOT_FOUND',
  /** Rate limit exceeded */
  RATE_LIMITED: 'RATE_LIMITED',
  /** Customer not found */
  CUSTOMER_NOT_FOUND: 'CUSTOMER_NOT_FOUND',
  /** Subscription not found */
  SUBSCRIPTION_NOT_FOUND: 'SUBSCRIPTION_NOT_FOUND',
  /** Checkout session not found */
  CHECKOUT_SESSION_NOT_FOUND: 'CHECKOUT_SESSION_NOT_FOUND',
} as const;

/**
 * Type for error codes.
 */
export type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes];

