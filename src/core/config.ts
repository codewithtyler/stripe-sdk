/**
 * Configuration loading and validation for the Stripe SDK.
 * Handles environment variable loading with helpful error messages.
 */

import { ConfigError } from './errors';

/**
 * Configuration object loaded from environment variables.
 */
export interface StripeConfig {
  /** Stripe secret API key */
  secretKey: string;
  /** Optional webhook secret for signature verification */
  webhookSecret?: string;
}

/**
 * Environment variable names used by the SDK.
 */
export const ENV_VARS = {
  /** Stripe secret key (required) */
  STRIPE_SECRET_KEY: 'STRIPE_SECRET_KEY',
  /** Stripe webhook secret (optional, required for webhook verification) */
  STRIPE_WEBHOOK_SECRET: 'STRIPE_WEBHOOK_SECRET',
} as const;

/**
 * Loads and validates Stripe configuration from environment variables.
 * Throws ConfigError with helpful message if required variables are missing.
 *
 * @param overrides - Optional overrides for testing or explicit configuration
 * @returns Validated configuration object
 * @throws ConfigError if STRIPE_SECRET_KEY is missing or invalid
 *
 * @example
 * ```ts
 * const config = loadStripeConfig();
 * // Uses process.env.STRIPE_SECRET_KEY
 *
 * const config = loadStripeConfig({ secretKey: 'sk_test_...' });
 * // Uses provided secret key
 * ```
 */
export function loadStripeConfig(overrides?: Partial<StripeConfig>): StripeConfig {
  const secretKey = overrides?.secretKey ?? process.env[ENV_VARS.STRIPE_SECRET_KEY];
  const webhookSecret = overrides?.webhookSecret ?? process.env[ENV_VARS.STRIPE_WEBHOOK_SECRET];

  if (!secretKey) {
    throw new ConfigError(
      `Missing required environment variable: ${ENV_VARS.STRIPE_SECRET_KEY}. ` +
        'Please set STRIPE_SECRET_KEY in your environment or provide it in the config.'
    );
  }

  if (typeof secretKey !== 'string' || secretKey.trim().length === 0) {
    throw new ConfigError(
      `Invalid ${ENV_VARS.STRIPE_SECRET_KEY}: must be a non-empty string.`
    );
  }

  // Validate Stripe key format (starts with sk_test_ or sk_live_)
  if (!secretKey.startsWith('sk_test_') && !secretKey.startsWith('sk_live_')) {
    throw new ConfigError(
      `Invalid ${ENV_VARS.STRIPE_SECRET_KEY} format. ` +
        'Stripe secret keys must start with "sk_test_" (test mode) or "sk_live_" (live mode).'
    );
  }

  return {
    secretKey: secretKey.trim(),
    webhookSecret: webhookSecret?.trim() || undefined,
  };
}

/**
 * Validates that a webhook secret is present in the configuration.
 * Throws ConfigError if webhook secret is required but missing.
 *
 * @param config - Configuration object to validate
 * @param required - Whether webhook secret is required (default: false)
 * @throws ConfigError if webhook secret is required but missing
 */
export function validateWebhookSecret(config: StripeConfig, required: boolean = false): void {
  if (required && !config.webhookSecret) {
    throw new ConfigError(
      `Missing required environment variable: ${ENV_VARS.STRIPE_WEBHOOK_SECRET}. ` +
        'Webhook secret is required for webhook signature verification. ' +
        'Get your webhook secret from the Stripe Dashboard > Webhooks > Your endpoint > Signing secret.'
    );
  }

  if (config.webhookSecret && !config.webhookSecret.startsWith('whsec_')) {
    throw new ConfigError(
      `Invalid ${ENV_VARS.STRIPE_WEBHOOK_SECRET} format. ` +
        'Stripe webhook secrets must start with "whsec_".'
    );
  }
}

