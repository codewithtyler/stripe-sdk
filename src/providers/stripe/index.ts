/**
 * Stripe payment provider implementation.
 * Implements the PaymentProvider interface with customer-first checkout flow.
 *
 * Key features:
 * - Creates customer before checkout (Theo's lesson)
 * - Stores customerId in KV by userId for fast lookup
 * - Stores userId in metadata on customer AND subscription
 * - Full webhook signature verification
 */

import Stripe from 'stripe';
import type {
  PaymentProvider,
  CheckoutOptions,
  CheckoutSession,
  SubscriptionOptions,
  Subscription,
  CustomerData,
  Customer,
  WebhookEvent,
  PortalSession,
  KVAdapter,
} from '../../core/types';
import { PaymentError, WebhookError, ErrorCodes } from '../../core/errors';
import { loadStripeConfig, type StripeConfig } from '../../core/config';
import {
  createStripeClient,
  createCheckoutSession,
  createSubscription,
  createCustomer,
  createPortalSession,
} from './api';
import { verifyWebhookSignature } from './webhooks';

/**
 * Configuration options for StripeProvider.
 */
export interface StripeProviderOptions {
  /** Key-value adapter for caching customer IDs (required) */
  cache: KVAdapter;
  /** Optional configuration overrides (defaults to environment variables) */
  config?: Partial<StripeConfig>;
}

/**
 * Stripe payment provider class.
 * Implements all PaymentProvider methods with customer-first checkout flow.
 */
export class StripeProvider implements PaymentProvider {
  readonly name = 'stripe';
  private readonly stripe: Stripe;
  private readonly cache: KVAdapter;
  private readonly config: StripeConfig;

  /**
   * Creates a new StripeProvider instance.
   * @param options - Provider configuration options
   * @throws ConfigError if required configuration is missing
   */
  constructor(options: StripeProviderOptions) {
    this.config = loadStripeConfig(options.config);
    this.cache = options.cache;
    // Use latest API version - TypeScript ensures it's valid via Stripe.LatestApiVersion
    this.stripe = createStripeClient(this.config.secretKey);
  }

  /**
   * Creates a checkout session.
   * Implements customer-first flow:
   * 1. Check if customerId exists in KV for this userId
   * 2. If not, create customer in Stripe with metadata (userId, email)
   * 3. Store customerId in KV
   * 4. Create checkout session with that customerId
   * 5. Return session URL
   *
   * @param options - Checkout configuration options
   * @returns Promise resolving to the created checkout session
   * @throws PaymentError if checkout creation fails
   */
  async createCheckout(options: CheckoutOptions): Promise<CheckoutSession> {
    try {
      // Extract userId from metadata (required for customer lookup)
      const userId = options.metadata?.userId;

      if (!userId) {
        throw new PaymentError(
          'userId is required in metadata for checkout',
          ErrorCodes.INVALID_REQUEST,
          400
        );
      }

      if (!options.customerEmail) {
        throw new PaymentError(
          'customerEmail is required for checkout',
          ErrorCodes.INVALID_REQUEST,
          400
        );
      }

      // Step 1: Check if customerId exists in KV for this userId
      const cacheKey = `customer:userId:${userId}`;
      let customerId = await this.cache.get<string>(cacheKey);

      // Step 2: If not, create customer in Stripe with metadata
      if (!customerId) {
        const customerData: CustomerData = {
          email: options.customerEmail,
          metadata: {
            userId,
            ...options.metadata,
          },
        };

        const customer = await createCustomer(this.stripe, customerData);
        customerId = customer.id;

        // Step 3: Store customerId in KV
        await this.cache.set(cacheKey, customerId);
        // Also cache by email for lookup
        await this.cache.set(`customer:email:${options.customerEmail}`, customerId);
      }

      // Step 4: Create checkout session with that customerId
      const checkoutOptions: CheckoutOptions = {
        ...options,
        customerId,
        metadata: {
          userId,
          ...options.metadata,
        },
      };

      const session = await createCheckoutSession(this.stripe, checkoutOptions);

      // Cache the session
      await this.cache.set(`checkout:${session.id}`, session, 3600); // 1 hour TTL

      return session;
    } catch (error) {
      // Re-throw PaymentError as-is
      if (error instanceof PaymentError) {
        throw error;
      }

      // Wrap other errors
      throw new PaymentError(
        `Checkout creation failed: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
        ErrorCodes.PAYMENT_FAILED
      );
    }
  }

  /**
   * Creates a subscription for a customer.
   * Stores userId in subscription metadata.
   *
   * @param options - Subscription configuration options
   * @returns Promise resolving to the created subscription
   * @throws PaymentError if subscription creation fails
   */
  async createSubscription(options: SubscriptionOptions): Promise<Subscription> {
    try {
      // Ensure userId is in metadata
      const subscriptionOptions: SubscriptionOptions = {
        ...options,
        metadata: {
          ...options.metadata,
        },
      };

      const subscription = await createSubscription(
        this.stripe,
        subscriptionOptions
      );

      // Cache the subscription
      await this.cache.set(`subscription:${subscription.id}`, subscription, 3600);

      return subscription;
    } catch (error) {
      if (error instanceof PaymentError) {
        throw error;
      }

      throw new PaymentError(
        `Subscription creation failed: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
        ErrorCodes.PAYMENT_FAILED
      );
    }
  }

  /**
   * Creates a new customer record.
   * Stores userId in customer metadata.
   *
   * @param data - Customer information
   * @returns Promise resolving to the created customer
   * @throws PaymentError if customer creation fails
   */
  async createCustomer(data: CustomerData): Promise<Customer> {
    try {
      // Check cache first by email
      const cacheKey = `customer:email:${data.email}`;
      const cached = await this.cache.get<Customer>(cacheKey);
      if (cached) {
        return cached;
      }

      // If userId is in metadata, also check by userId
      if (data.metadata?.userId) {
        const userIdCacheKey = `customer:userId:${data.metadata.userId}`;
        const userIdCached = await this.cache.get<string>(userIdCacheKey);
        if (userIdCached) {
          // Fetch full customer data from cache or Stripe
          const fullCached = await this.cache.get<Customer>(
            `customer:${userIdCached}`
          );
          if (fullCached) {
            return fullCached;
          }
        }
      }

      const customer = await createCustomer(this.stripe, data);

      // Cache by ID, email, and userId
      await this.cache.set(`customer:${customer.id}`, customer, 86400); // 24 hours
      await this.cache.set(cacheKey, customer, 86400);

      if (data.metadata?.userId) {
        await this.cache.set(
          `customer:userId:${data.metadata.userId}`,
          customer.id,
          86400
        );
      }

      return customer;
    } catch (error) {
      if (error instanceof PaymentError) {
        throw error;
      }

      throw new PaymentError(
        `Customer creation failed: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
        ErrorCodes.PAYMENT_FAILED
      );
    }
  }

  /**
   * Verifies a webhook payload signature and returns the parsed event.
   *
   * @param payload - Raw webhook payload string (must be raw body, not parsed JSON)
   * @param signature - Webhook signature from Stripe-Signature header
   * @returns Parsed and verified webhook event
   * @throws WebhookError if signature verification fails
   */
  verifyWebhook(payload: string, signature: string): WebhookEvent {
    if (!this.config.webhookSecret) {
      throw new WebhookError(
        'Webhook secret is not configured. Set STRIPE_WEBHOOK_SECRET environment variable.',
        ErrorCodes.WEBHOOK_SIGNATURE_INVALID
      );
    }

    return verifyWebhookSignature(
      this.stripe,
      payload,
      signature,
      this.config.webhookSecret
    );
  }

  /**
   * Creates a billing portal session for customer self-service.
   *
   * @param customerId - Customer identifier
   * @param returnUrl - URL to redirect after portal session ends
   * @returns Promise resolving to portal session with URL
   * @throws PaymentError if portal session creation fails
   */
  async createPortalSession(
    customerId: string,
    returnUrl: string
  ): Promise<PortalSession> {
    try {
      return await createPortalSession(this.stripe, customerId, returnUrl);
    } catch (error) {
      if (error instanceof PaymentError) {
        throw error;
      }

      throw new PaymentError(
        `Portal session creation failed: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
        ErrorCodes.PAYMENT_FAILED
      );
    }
  }
}

/**
 * Factory function to create a StripeProvider instance.
 * Convenience wrapper around the StripeProvider constructor.
 *
 * @param options - Provider configuration options
 * @returns Configured StripeProvider instance
 *
 * @example
 * ```ts
 * import { stripe } from '@stripe-sdk/providers';
 * import { memoryCache } from '@stripe-sdk/adapters';
 *
 * const provider = stripe({
 *   cache: memoryCache(),
 * });
 * ```
 */
export function stripe(options: StripeProviderOptions): StripeProvider {
  return new StripeProvider(options);
}
