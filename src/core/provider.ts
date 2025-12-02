/**
 * Core provider factory for creating Stripe payment providers.
 * This factory creates a fully configured PaymentProvider instance with caching and optional sync support.
 */

import Stripe from 'stripe';
import type {
  PaymentProvider,
  CheckoutOptions,
  CheckoutSession,
  SubscriptionOptions,
  Subscription,
  SubscriptionState,
  CustomerData,
  Customer,
  WebhookEvent,
  PortalSession,
  KVAdapter,
  SyncAdapter,
} from './types';
import { PaymentError, WebhookError, ErrorCodes } from './errors';
import { loadStripeConfig, validateWebhookSecret, type StripeConfig } from './config';

/**
 * Options for creating a Stripe provider.
 */
export interface CreateStripeProviderOptions {
  /** Key-value adapter for caching (required) */
  cache: KVAdapter;
  /** Optional sync adapter for real-time updates (paid feature) */
  sync?: SyncAdapter;
  /** Optional configuration overrides (defaults to environment variables) */
  config?: Partial<StripeConfig>;
}

/**
 * Creates a fully configured Stripe payment provider.
 * The provider implements all PaymentProvider methods with caching and optional sync support.
 *
 * @param options - Provider configuration options
 * @returns Configured PaymentProvider instance
 * @throws ConfigError if required configuration is missing
 *
 * @example
 * ```ts
 * import { createStripeProvider } from '@stripe-sdk/core';
 * import { memoryCache } from '@stripe-sdk/adapters';
 *
 * const provider = createStripeProvider({
 *   cache: memoryCache(),
 *   sync: {
 *     onCustomerCreated: async (customer) => {
 *       await syncToDatabase(customer);
 *     }
 *   }
 * });
 * ```
 */
export function createStripeProvider(
  options: CreateStripeProviderOptions
): PaymentProvider {
  const config = loadStripeConfig(options.config);
  const { cache, sync } = options;

  // Initialize Stripe client
  const stripe = new Stripe(config.secretKey, {
    apiVersion: '2024-11-20.acacia',
    typescript: true,
  });

  return {
    name: 'stripe',

    async createCheckout(options: CheckoutOptions): Promise<CheckoutSession> {
      try {
        const sessionParams: Stripe.Checkout.SessionCreateParams = {
          line_items: [
            {
              price: options.priceId,
              quantity: options.quantity ?? 1,
            },
          ],
          mode: options.mode ?? 'subscription',
          success_url: options.successUrl,
          cancel_url: options.cancelUrl,
          metadata: options.metadata,
        };

        // Use customer ID if provided, otherwise use email
        if (options.customerId) {
          sessionParams.customer = options.customerId;
        } else if (options.customerEmail) {
          sessionParams.customer_email = options.customerEmail;
        }

        // Add trial period if specified (subscription mode only)
        if (options.mode === 'subscription' && options.trialDays) {
          sessionParams.subscription_data = {
            trial_period_days: options.trialDays,
          };
        }

        const session = await stripe.checkout.sessions.create(sessionParams);

        const checkoutSession: CheckoutSession = {
          id: session.id,
          url: session.url!,
          status: (session.status ?? 'open') as 'open' | 'complete' | 'expired',
          customerId: typeof session.customer === 'string' ? session.customer : undefined,
          metadata: session.metadata ?? undefined,
          createdAt: new Date(session.created * 1000),
        };

        // Cache the session
        await cache.set(`checkout:${session.id}`, checkoutSession, 3600); // 1 hour TTL

        return checkoutSession;
      } catch (error) {
        if (error instanceof Stripe.errors.StripeError) {
          throw new PaymentError(
            `Checkout creation failed: ${error.message}`,
            ErrorCodes.PAYMENT_FAILED,
            error.statusCode ?? 500
          );
        }
        throw new PaymentError(
          `Checkout creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          ErrorCodes.PAYMENT_FAILED
        );
      }
    },

    async createSubscription(options: SubscriptionOptions): Promise<Subscription> {
      try {
        const subscriptionParams: Stripe.SubscriptionCreateParams = {
          customer: options.customerId,
          items: [
            {
              price: options.priceId,
              quantity: options.quantity,
            },
          ],
          metadata: options.metadata,
        };

        if (options.trialDays) {
          subscriptionParams.trial_period_days = options.trialDays;
        }

        const subscription = await stripe.subscriptions.create(subscriptionParams);

        const subscriptionData: Subscription = {
          id: subscription.id,
          customerId: typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id,
          status: subscription.status as Subscription['status'],
          currentPeriodEnd: new Date(subscription.current_period_end * 1000),
          currentPeriodStart: new Date(subscription.current_period_start * 1000),
          cancelAtPeriodEnd: subscription.cancel_at_period_end,
          items: subscription.items.data.map((item) => ({
            id: item.id,
            priceId: item.price.id,
            quantity: item.quantity ?? 1,
          })),
          metadata: subscription.metadata ?? undefined,
          createdAt: new Date(subscription.created * 1000),
        };

        // Cache the subscription
        await cache.set(`subscription:${subscription.id}`, subscriptionData, 3600);

        // Sync if adapter is provided
        if (sync?.onSubscriptionUpdated) {
          await sync.onSubscriptionUpdated(subscriptionData);
        }

        return subscriptionData;
      } catch (error) {
        if (error instanceof Stripe.errors.StripeError) {
          throw new PaymentError(
            `Subscription creation failed: ${error.message}`,
            ErrorCodes.PAYMENT_FAILED,
            error.statusCode ?? 500
          );
        }
        throw new PaymentError(
          `Subscription creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          ErrorCodes.PAYMENT_FAILED
        );
      }
    },

    async createCustomer(data: CustomerData): Promise<Customer> {
      try {
        // Check cache first
        const cacheKey = `customer:email:${data.email}`;
        const cached = await cache.get<Customer>(cacheKey);
        if (cached) {
          return cached;
        }

        const customer = await stripe.customers.create({
          email: data.email,
          name: data.name,
          metadata: data.metadata,
        });

        const customerData: Customer = {
          id: customer.id,
          email: customer.email!,
          name: customer.name ?? undefined,
          metadata: customer.metadata ?? undefined,
          createdAt: new Date(customer.created * 1000),
        };

        // Cache by ID and email
        await cache.set(`customer:${customer.id}`, customerData, 86400); // 24 hours
        await cache.set(cacheKey, customerData, 86400);

        // Sync if adapter is provided
        if (sync?.onCustomerCreated) {
          await sync.onCustomerCreated(customerData);
        }

        return customerData;
      } catch (error) {
        if (error instanceof Stripe.errors.StripeError) {
          throw new PaymentError(
            `Customer creation failed: ${error.message}`,
            ErrorCodes.PAYMENT_FAILED,
            error.statusCode ?? 500
          );
        }
        throw new PaymentError(
          `Customer creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          ErrorCodes.PAYMENT_FAILED
        );
      }
    },

    verifyWebhook(payload: string, signature: string): WebhookEvent {
      validateWebhookSecret(config, true);

      try {
        const event = stripe.webhooks.constructEvent(
          payload,
          signature,
          config.webhookSecret!
        );

        return {
          id: event.id,
          type: event.type,
          data: event.data.object,
          created: new Date(event.created * 1000),
        };
      } catch (error) {
        if (error instanceof Stripe.errors.StripeSignatureVerificationError) {
          throw new WebhookError(
            `Webhook signature verification failed: ${error.message}`,
            ErrorCodes.WEBHOOK_SIGNATURE_INVALID
          );
        }
        throw new WebhookError(
          `Webhook verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          ErrorCodes.WEBHOOK_SIGNATURE_INVALID
        );
      }
    },

    async createPortalSession(customerId: string, returnUrl: string): Promise<PortalSession> {
      try {
        const session = await stripe.billingPortal.sessions.create({
          customer: customerId,
          return_url: returnUrl,
        });

        return {
          url: session.url,
        };
      } catch (error) {
        if (error instanceof Stripe.errors.StripeError) {
          if (error.statusCode === 404) {
            throw new PaymentError(
              `Customer not found: ${customerId}`,
              ErrorCodes.CUSTOMER_NOT_FOUND,
              404
            );
          }
          throw new PaymentError(
            `Portal session creation failed: ${error.message}`,
            ErrorCodes.PAYMENT_FAILED,
            error.statusCode ?? 500
          );
        }
        throw new PaymentError(
          `Portal session creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          ErrorCodes.PAYMENT_FAILED
        );
      }
    },
  };
}

