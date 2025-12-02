/**
 * Stripe API call wrappers with error handling.
 * Provides a clean interface for all Stripe API operations.
 */

import Stripe from 'stripe';
import type {
  CheckoutOptions,
  CheckoutSession,
  SubscriptionOptions,
  Subscription,
  SubscriptionState,
  CustomerData,
  Customer,
  PortalSession,
} from '../../core/types';
import { PaymentError, ErrorCodes } from '../../core/errors';

/**
 * Latest Stripe API version.
 *
 * This constant is typed as Stripe.LatestApiVersion, which means:
 * - When you upgrade the Stripe package, TypeScript will error if this value
 *   doesn't match the new LatestApiVersion type
 * - This ensures you're always using the latest API version
 * - Update this value when upgrading the Stripe package
 *
 * @example
 * After upgrading stripe package, TypeScript will show an error here
 * if the version doesn't match. Update to the new version shown in the error.
 */
const LATEST_API_VERSION: Stripe.LatestApiVersion = '2025-02-24.acacia';

/**
 * Creates a Stripe client instance.
 * Uses the latest API version from the Stripe package.
 *
 * @param apiKey - Stripe secret API key
 * @returns Configured Stripe client
 */
export function createStripeClient(apiKey: string): Stripe {
  return new Stripe(apiKey, {
    apiVersion: LATEST_API_VERSION,
    typescript: true,
  });
}

/**
 * Creates a checkout session in Stripe.
 * @param stripe - Stripe client instance
 * @param options - Checkout configuration options
 * @returns Promise resolving to the created checkout session
 * @throws PaymentError if session creation fails
 */
export async function createCheckoutSession(
  stripe: Stripe,
  options: CheckoutOptions
): Promise<CheckoutSession> {
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

    // Use customer ID if provided
    if (options.customerId) {
      sessionParams.customer = options.customerId;
    } else if (options.customerEmail) {
      sessionParams.customer_email = options.customerEmail;
    }

    // Add trial period if specified (subscription mode only)
    if (options.mode === 'subscription' && options.trialDays) {
      sessionParams.subscription_data = {
        trial_period_days: options.trialDays,
        metadata: options.metadata, // Store userId in subscription metadata
      };
    }

    const session = await stripe.checkout.sessions.create(sessionParams);

    return {
      id: session.id,
      url: session.url!,
      status: (session.status ?? 'open') as 'open' | 'complete' | 'expired',
      customerId:
        typeof session.customer === 'string'
          ? session.customer
          : session.customer?.id,
      metadata: session.metadata ?? undefined,
      createdAt: new Date(session.created * 1000),
    };
  } catch (error) {
    if (error instanceof Stripe.errors.StripeError) {
      throw new PaymentError(
        `Checkout session creation failed: ${error.message}`,
        ErrorCodes.PAYMENT_FAILED,
        error.statusCode ?? 500
      );
    }
    throw new PaymentError(
      `Checkout session creation failed: ${
        error instanceof Error ? error.message : 'Unknown error'
      }`,
      ErrorCodes.PAYMENT_FAILED
    );
  }
}

/**
 * Creates a subscription in Stripe.
 * @param stripe - Stripe client instance
 * @param options - Subscription configuration options
 * @returns Promise resolving to the created subscription
 * @throws PaymentError if subscription creation fails
 */
export async function createSubscription(
  stripe: Stripe,
  options: SubscriptionOptions
): Promise<Subscription> {
  try {
    const subscriptionParams: Stripe.SubscriptionCreateParams = {
      customer: options.customerId,
      items: [
        {
          price: options.priceId,
          quantity: options.quantity ?? 1,
        },
      ],
      metadata: options.metadata, // Store userId in subscription metadata
    };

    if (options.trialDays) {
      subscriptionParams.trial_period_days = options.trialDays;
    }

    const subscription = await stripe.subscriptions.create(subscriptionParams);

    return {
      id: subscription.id,
      customerId:
        typeof subscription.customer === 'string'
          ? subscription.customer
          : subscription.customer?.id ?? '',
      status: subscription.status as SubscriptionState,
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
  } catch (error) {
    if (error instanceof Stripe.errors.StripeError) {
      throw new PaymentError(
        `Subscription creation failed: ${error.message}`,
        ErrorCodes.PAYMENT_FAILED,
        error.statusCode ?? 500
      );
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
 * Creates a customer in Stripe.
 * @param stripe - Stripe client instance
 * @param data - Customer information
 * @returns Promise resolving to the created customer
 * @throws PaymentError if customer creation fails
 */
export async function createCustomer(
  stripe: Stripe,
  data: CustomerData
): Promise<Customer> {
  try {
    const customer = await stripe.customers.create({
      email: data.email,
      name: data.name,
      metadata: data.metadata, // Store userId in customer metadata
    });

    return {
      id: customer.id,
      email: customer.email!,
      name: customer.name ?? undefined,
      metadata: customer.metadata ?? undefined,
      createdAt: new Date(customer.created * 1000),
    };
  } catch (error) {
    if (error instanceof Stripe.errors.StripeError) {
      throw new PaymentError(
        `Customer creation failed: ${error.message}`,
        ErrorCodes.PAYMENT_FAILED,
        error.statusCode ?? 500
      );
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
 * Creates a billing portal session in Stripe.
 * @param stripe - Stripe client instance
 * @param customerId - Customer identifier
 * @param returnUrl - URL to redirect after portal session ends
 * @returns Promise resolving to portal session with URL
 * @throws PaymentError if portal session creation fails
 */
export async function createPortalSession(
  stripe: Stripe,
  customerId: string,
  returnUrl: string
): Promise<PortalSession> {
  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    });

    return {
      url: session.url!,
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
      `Portal session creation failed: ${
        error instanceof Error ? error.message : 'Unknown error'
      }`,
      ErrorCodes.PAYMENT_FAILED
    );
  }
}

