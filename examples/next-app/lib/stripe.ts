/**
 * Stripe provider configuration with Upstash adapter.
 * This file sets up the payment provider for use throughout the app.
 */

import { stripe } from '@stripe-sdk/providers';
import { createUpstashAdapter } from '@stripe-sdk/adapters';
import { createMemoryAdapter } from '@stripe-sdk/adapters';
import type { PaymentProvider } from '@stripe-sdk/providers';

// Create cache adapter - use Upstash in production, memory adapter as fallback
function createCacheAdapter() {
  const upstashUrl = process.env.UPSTASH_REDIS_REST_URL;
  const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN;

  // Check if Upstash credentials are provided and valid (not placeholders)
  if (
    upstashUrl &&
    upstashToken &&
    upstashUrl !== 'https://...' &&
    upstashToken !== '...' &&
    upstashUrl.startsWith('https://')
  ) {
    try {
      return createUpstashAdapter({
        url: upstashUrl,
        token: upstashToken,
      });
    } catch (error) {
      console.warn('Failed to create Upstash adapter, falling back to memory adapter:', error);
      return createMemoryAdapter();
    }
  }

  // Fallback to memory adapter if Upstash not configured
  console.warn(
    'Upstash Redis not configured. Using in-memory cache (data will be lost on restart). ' +
    'Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN in .env.local for production.'
  );
  return createMemoryAdapter();
}

// Check if Stripe is configured
function isStripeConfigured(): boolean {
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  return !!(
    stripeKey &&
    stripeKey !== 'sk_test_...' &&
    stripeKey !== 'sk_live_...' &&
    (stripeKey.startsWith('sk_test_') || stripeKey.startsWith('sk_live_'))
  );
}

// Create Stripe provider or return null if not configured
function createStripeProvider(): PaymentProvider | null {
  if (!isStripeConfigured()) {
    console.warn(
      '⚠️  STRIPE_SECRET_KEY is not configured.\n' +
      '   The app will load but payment features will not work.\n' +
      '   Set STRIPE_SECRET_KEY in .env.local to enable payments.\n' +
      '   Get your key from: https://dashboard.stripe.com/test/apikeys'
    );
    return null;
  }

  try {
    return stripe({
      cache: createCacheAdapter(),
    });
  } catch (error) {
    console.error(
      'Failed to create Stripe provider:',
      error instanceof Error ? error.message : 'Unknown error'
    );
    return null;
  }
}

// Create a dummy provider that throws helpful errors when used
function createDummyProvider(): PaymentProvider {
  const errorMessage = 'Stripe is not configured. Set STRIPE_SECRET_KEY in .env.local';
  
  return {
    name: 'stripe',
    async createCheckout() {
      throw new Error(errorMessage);
    },
    async createSubscription() {
      throw new Error(errorMessage);
    },
    async createCustomer() {
      throw new Error(errorMessage);
    },
    verifyWebhook() {
      throw new Error(errorMessage);
    },
    async createPortalSession() {
      throw new Error(errorMessage);
    },
  };
}

// Create and export the configured Stripe provider (uses dummy if not configured)
export const stripeProvider: PaymentProvider = createStripeProvider() || createDummyProvider();

// Export a flag to check if Stripe is configured
export const isStripeReady = isStripeConfigured();

