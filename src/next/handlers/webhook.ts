/**
 * Next.js API route handler for Stripe webhooks.
 * Implements secure webhook processing with signature verification,
 * fresh data fetching, KV cache updates, and sync adapter support.
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import type {
  PaymentProvider,
  WebhookEvent,
  Customer,
  Subscription,
  CheckoutSession,
  KVAdapter,
  SyncAdapter,
} from '../../core/types';
import { WebhookError, PaymentError, ErrorCodes } from '../../core/errors';
import { loadStripeConfig } from '../../core/config';
import { createStripeClient } from '../../providers/stripe/api';

/**
 * User-defined webhook event handlers.
 */
export interface WebhookEventHandlers {
  /** Called when a checkout session is completed */
  onCheckoutComplete?: (session: CheckoutSession) => Promise<void>;
  /** Called when a subscription is created */
  onSubscriptionCreated?: (subscription: Subscription) => Promise<void>;
  /** Called when a subscription is updated */
  onSubscriptionUpdated?: (subscription: Subscription) => Promise<void>;
  /** Called when a subscription is canceled/deleted */
  onSubscriptionCanceled?: (subscription: Subscription) => Promise<void>;
}

/**
 * Options for creating a webhook handler.
 */
export interface CreateWebhookHandlerOptions {
  /** Payment provider instance */
  provider: PaymentProvider;
  /** Key-value adapter for caching (required for KV updates) */
  cache: KVAdapter;
  /** Optional sync adapter for real-time updates */
  sync?: SyncAdapter;
  /** User-defined event handlers */
  handlers?: WebhookEventHandlers;
}

/**
 * Fetches the latest checkout session from Stripe.
 * @param stripe - Stripe client instance
 * @param sessionId - Checkout session ID
 * @returns Latest checkout session data
 */
async function fetchLatestCheckoutSession(
  stripe: Stripe,
  sessionId: string
): Promise<CheckoutSession> {
  const session = await stripe.checkout.sessions.retrieve(sessionId, {
    expand: ['customer', 'subscription'],
  });

  return {
    id: session.id,
    url: session.url ?? '',
    status: (session.status ?? 'open') as 'open' | 'complete' | 'expired',
    customerId:
      typeof session.customer === 'string'
        ? session.customer
        : session.customer?.id,
    metadata: session.metadata ?? undefined,
    createdAt: new Date(session.created * 1000),
  };
}

/**
 * Fetches the latest subscription from Stripe.
 * @param stripe - Stripe client instance
 * @param subscriptionId - Subscription ID
 * @returns Latest subscription data
 */
async function fetchLatestSubscription(
  stripe: Stripe,
  subscriptionId: string
): Promise<Subscription> {
  const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
    expand: ['customer'],
  });

  return {
    id: subscription.id,
    customerId:
      typeof subscription.customer === 'string'
        ? subscription.customer
        : subscription.customer?.id ?? '',
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
}

/**
 * Fetches the latest customer from Stripe.
 * @param stripe - Stripe client instance
 * @param customerId - Customer ID
 * @returns Latest customer data
 */
async function fetchLatestCustomer(
  stripe: Stripe,
  customerId: string
): Promise<Customer> {
  const customer = await stripe.customers.retrieve(customerId);

  if (customer.deleted) {
    throw new PaymentError(
      `Customer ${customerId} has been deleted`,
      ErrorCodes.CUSTOMER_NOT_FOUND,
      404
    );
  }

  return {
    id: customer.id,
    email: customer.email ?? '',
    name: customer.name ?? undefined,
    metadata: customer.metadata ?? undefined,
    createdAt: new Date(customer.created * 1000),
  };
}

/**
 * Creates a Next.js API route handler for Stripe webhooks.
 * Implements the complete webhook processing flow:
 * 1. Verify signature
 * 2. Parse event
 * 3. Fetch LATEST data from Stripe (don't trust event payload)
 * 4. Update KV cache
 * 5. If sync adapter configured, call appropriate method
 * 6. Call user's event handlers
 * 7. Return 200
 *
 * @param options - Handler configuration options
 * @returns Next.js route handler function
 *
 * @example
 * ```ts
 * import { createWebhookHandler } from '@stripe-sdk/next';
 * import { stripe } from '@stripe-sdk/providers';
 *
 * const handler = createWebhookHandler({
 *   provider: stripe({ cache: myCache }),
 *   cache: myCache,
 *   sync: mySyncAdapter,
 *   handlers: {
 *     onCheckoutComplete: async (session) => {
 *       await updateDatabase(session);
 *     },
 *     onSubscriptionCreated: async (subscription) => {
 *       await activateUser(subscription);
 *     },
 *   },
 * });
 *
 * export { handler as POST };
 * ```
 */
export function createWebhookHandler(
  options: CreateWebhookHandlerOptions
): (request: NextRequest) => Promise<NextResponse> {
  const { provider, cache, sync, handlers } = options;

  return async (request: NextRequest): Promise<NextResponse> => {
    // Only allow POST requests
    if (request.method !== 'POST') {
      return NextResponse.json(
        { error: 'Method not allowed' },
        { status: 405 }
      );
    }

    try {
      // Step 1: Get raw body (required for signature verification)
      const body = await request.text();

      // Step 2: Get signature from headers
      const signature = request.headers.get('stripe-signature');
      if (!signature) {
        return NextResponse.json(
          {
            error: 'Missing signature',
            message: 'stripe-signature header is required',
          },
          { status: 401 }
        );
      }

      // Step 3: Verify signature and parse event
      let event: WebhookEvent;
      try {
        event = provider.verifyWebhook(body, signature);
      } catch (error) {
        if (error instanceof WebhookError) {
          console.error('Webhook signature verification failed:', error.message);
          return NextResponse.json(
            {
              error: error.code,
              message: error.message,
            },
            { status: 401 }
          );
        }
        throw error;
      }

      // Step 4: Create Stripe client to fetch fresh data
      // Load config to get API key for fetching latest data
      const config = loadStripeConfig();
      const stripe = createStripeClient(config.secretKey);

      // Step 5: Fetch LATEST data from Stripe (don't trust event payload)
      // This is critical - always fetch fresh data per Theo's lesson
      let latestData: Customer | Subscription | CheckoutSession | null = null;
      let eventType = event.type;

      if (eventType === 'checkout.session.completed') {
        const sessionData = event.data as { id: string };
        latestData = await fetchLatestCheckoutSession(stripe, sessionData.id);

        // Update KV cache with latest checkout session
        await cache.set(`checkout:${latestData.id}`, latestData, 3600); // 1 hour TTL

        // If customer was created, also cache customer lookup
        if (latestData.customerId) {
          const customer = await fetchLatestCustomer(stripe, latestData.customerId);
          await cache.set(`customer:${customer.id}`, customer, 86400); // 24 hours
          
          // Cache by email if available
          if (customer.email) {
            await cache.set(`customer:email:${customer.email}`, customer, 86400);
          }
          
          // Cache by userId if in metadata
          if (customer.metadata?.userId) {
            await cache.set(
              `customer:userId:${customer.metadata.userId}`,
              customer.id,
              86400
            );
          }
        }

        // Call sync adapter if configured (after KV update)
        if (sync?.onCustomerCreated && latestData.customerId) {
          const customer = await fetchLatestCustomer(stripe, latestData.customerId);
          await sync.onCustomerCreated(customer);
        }

        // Call user's checkout complete handler
        if (handlers?.onCheckoutComplete) {
          await handlers.onCheckoutComplete(latestData);
        }
      } else if (eventType === 'customer.subscription.created') {
        const subscriptionData = event.data as { id: string };
        latestData = await fetchLatestSubscription(stripe, subscriptionData.id);

        // Update KV cache with latest subscription
        await cache.set(`subscription:${latestData.id}`, latestData, 3600); // 1 hour TTL

        // Also cache by customer ID for lookup
        await cache.set(
          `subscription:customer:${latestData.customerId}`,
          latestData.id,
          3600
        );

        // Call sync adapter if configured (after KV update)
        if (sync?.onSubscriptionUpdated) {
          await sync.onSubscriptionUpdated(latestData);
        }

        // Call user's subscription created handler
        if (handlers?.onSubscriptionCreated) {
          await handlers.onSubscriptionCreated(latestData);
        }
      } else if (eventType === 'customer.subscription.updated') {
        const subscriptionData = event.data as { id: string };
        latestData = await fetchLatestSubscription(stripe, subscriptionData.id);

        // Update KV cache with latest subscription
        await cache.set(`subscription:${latestData.id}`, latestData, 3600);

        // Also update customer lookup cache
        await cache.set(
          `subscription:customer:${latestData.customerId}`,
          latestData.id,
          3600
        );

        // Call sync adapter if configured (after KV update)
        if (sync?.onSubscriptionUpdated) {
          await sync.onSubscriptionUpdated(latestData);
        }

        // Call user's subscription updated handler
        if (handlers?.onSubscriptionUpdated) {
          await handlers.onSubscriptionUpdated(latestData);
        }
      } else if (
        eventType === 'customer.subscription.deleted' ||
        eventType === 'customer.subscription.canceled'
      ) {
        const subscriptionData = event.data as { id: string };
        latestData = await fetchLatestSubscription(stripe, subscriptionData.id);

        // Update KV cache with latest subscription (even if canceled, keep for history)
        await cache.set(`subscription:${latestData.id}`, latestData, 86400); // 24 hours for canceled

        // Call sync adapter if configured (after KV update)
        if (sync?.onSubscriptionCanceled) {
          await sync.onSubscriptionCanceled(latestData);
        }

        // Call user's subscription canceled handler
        if (handlers?.onSubscriptionCanceled) {
          await handlers.onSubscriptionCanceled(latestData);
        }
      } else {
        // Unhandled event type - log but don't fail
        console.log(`Unhandled webhook event type: ${eventType}`);
      }

      // Step 6: Always return 200 to acknowledge receipt
      // Stripe will retry if we return an error status
      return NextResponse.json({ received: true }, { status: 200 });
    } catch (error) {
      // Log error but still return 200 to prevent Stripe retries
      // User handlers and sync adapters should handle their own errors
      console.error('Webhook handler error:', error);

      // Only return error for signature verification failures
      if (error instanceof WebhookError) {
        return NextResponse.json(
          {
            error: error.code,
            message: error.message,
          },
          { status: 401 }
        );
      }

      // For other errors, log but return 200 to prevent infinite retries
      // The error has been logged for debugging
      return NextResponse.json(
        { received: true, error: 'Handler error logged' },
        { status: 200 }
      );
    }
  };
}

