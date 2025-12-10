/**
 * Next.js API route handler for creating Stripe checkout sessions.
 * Provides a secure server-side endpoint for checkout session creation.
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import type { PaymentProvider, CheckoutOptions, KVAdapter } from '../../core/types';
import { PaymentError, ErrorCodes } from '../../core/errors';

/**
 * Request body for checkout creation.
 */
export interface CreateCheckoutRequest {
  /** Stripe Price ID to charge */
  priceId: string;
  /** URL to redirect after successful payment */
  successUrl: string;
  /** URL to redirect if payment is cancelled */
  cancelUrl: string;
  /** Optional customer email */
  customerEmail?: string;
  /** Optional customer ID (for existing customers) */
  customerId?: string;
  /** Optional metadata to attach to the session */
  metadata?: Record<string, string>;
  /** Checkout mode: payment (one-time), subscription, or setup */
  mode?: 'payment' | 'subscription' | 'setup';
  /** Optional quantity for the line item */
  quantity?: number;
  /** Optional trial period in days (subscription mode only) */
  trialDays?: number;
}

/**
 * Response from checkout creation.
 */
export interface CreateCheckoutResponse {
  /** Checkout session URL */
  url: string;
  /** Checkout session ID */
  sessionId: string;
}

/**
 * Options for creating a checkout handler.
 */
export interface CreateCheckoutHandlerOptions {
  /** Payment provider instance */
  provider: PaymentProvider;
  /** Optional key-value adapter for caching (if provider doesn't have one) */
  cache?: KVAdapter;
}

/**
 * Creates a Next.js API route handler for checkout session creation.
 * Validates the request body and creates a checkout session using the provider.
 *
 * @param options - Handler configuration options
 * @returns Next.js route handler function
 *
 * @example
 * ```ts
 * import { createCheckoutHandler } from '@stripe-sdk/next';
 * import { stripe } from '@stripe-sdk/providers';
 *
 * const handler = createCheckoutHandler({
 *   provider: stripe({ cache: myCache }),
 * });
 *
 * export { handler as POST };
 * ```
 */
export function createCheckoutHandler(
  options: CreateCheckoutHandlerOptions
): (request: NextRequest) => Promise<NextResponse> {
  const { provider } = options;

  return async (request: NextRequest): Promise<NextResponse> => {
    // Only allow POST requests
    if (request.method !== 'POST') {
      return NextResponse.json(
        { error: 'Method not allowed' },
        { status: 405 }
      );
    }

    try {
      // Parse and validate request body
      const body = await request.json() as CreateCheckoutRequest;

      // Validate required fields
      if (!body.priceId || typeof body.priceId !== 'string') {
        return NextResponse.json(
          {
            error: 'Invalid request',
            message: 'priceId is required and must be a string',
          },
          { status: 400 }
        );
      }

      if (!body.successUrl || typeof body.successUrl !== 'string') {
        return NextResponse.json(
          {
            error: 'Invalid request',
            message: 'successUrl is required and must be a string',
          },
          { status: 400 }
        );
      }

      if (!body.cancelUrl || typeof body.cancelUrl !== 'string') {
        return NextResponse.json(
          {
            error: 'Invalid request',
            message: 'cancelUrl is required and must be a string',
          },
          { status: 400 }
        );
      }

      // Build checkout options
      const checkoutOptions: CheckoutOptions = {
        priceId: body.priceId,
        successUrl: body.successUrl,
        cancelUrl: body.cancelUrl,
        customerEmail: body.customerEmail,
        customerId: body.customerId,
        metadata: body.metadata,
        mode: body.mode,
        quantity: body.quantity,
        trialDays: body.trialDays,
      };

      // Create checkout session
      const session = await provider.createCheckout(checkoutOptions);

      // Return success response
      const response: CreateCheckoutResponse = {
        url: session.url,
        sessionId: session.id,
      };

      return NextResponse.json(response, { status: 200 });
    } catch (error) {
      // Handle PaymentError with proper status code
      if (error instanceof PaymentError) {
        return NextResponse.json(
          {
            error: error.code,
            message: error.message,
          },
          { status: error.statusCode }
        );
      }

      // Handle other errors
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      console.error('Checkout handler error:', errorMessage);

      return NextResponse.json(
        {
          error: ErrorCodes.PAYMENT_FAILED,
          message: 'Failed to create checkout session',
        },
        { status: 500 }
      );
    }
  };
}

