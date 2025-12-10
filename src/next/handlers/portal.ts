/**
 * Next.js API route handler for creating Stripe billing portal sessions.
 * Provides a secure server-side endpoint for portal session creation.
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import type { PaymentProvider } from '../../core/types';
import { PaymentError, ErrorCodes } from '../../core/errors';

/**
 * Request body for portal session creation.
 */
export interface CreatePortalRequest {
  /** Customer ID to create portal session for */
  customerId: string;
  /** URL to redirect after portal session ends */
  returnUrl: string;
}

/**
 * Response from portal session creation.
 */
export interface CreatePortalResponse {
  /** Portal session URL */
  url: string;
}

/**
 * Options for creating a portal handler.
 */
export interface CreatePortalHandlerOptions {
  /** Payment provider instance */
  provider: PaymentProvider;
}

/**
 * Creates a Next.js API route handler for billing portal session creation.
 * Validates the request body and creates a portal session using the provider.
 *
 * @param options - Handler configuration options
 * @returns Next.js route handler function
 *
 * @example
 * ```ts
 * import { createPortalHandler } from '@stripe-sdk/next';
 * import { stripe } from '@stripe-sdk/providers';
 *
 * const handler = createPortalHandler({
 *   provider: stripe({ cache: myCache }),
 * });
 *
 * export { handler as POST };
 * ```
 */
export function createPortalHandler(
  options: CreatePortalHandlerOptions
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
      const body = await request.json() as CreatePortalRequest;

      // Validate required fields
      if (!body.customerId || typeof body.customerId !== 'string') {
        return NextResponse.json(
          {
            error: 'Invalid request',
            message: 'customerId is required and must be a string',
          },
          { status: 400 }
        );
      }

      if (!body.returnUrl || typeof body.returnUrl !== 'string') {
        return NextResponse.json(
          {
            error: 'Invalid request',
            message: 'returnUrl is required and must be a string',
          },
          { status: 400 }
        );
      }

      // Validate returnUrl is a valid URL
      try {
        new URL(body.returnUrl);
      } catch {
        return NextResponse.json(
          {
            error: 'Invalid request',
            message: 'returnUrl must be a valid URL',
          },
          { status: 400 }
        );
      }

      // Create portal session
      const portalSession = await provider.createPortalSession(
        body.customerId,
        body.returnUrl
      );

      // Return success response
      const response: CreatePortalResponse = {
        url: portalSession.url,
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
      console.error('Portal handler error:', errorMessage);

      return NextResponse.json(
        {
          error: ErrorCodes.PAYMENT_FAILED,
          message: 'Failed to create portal session',
        },
        { status: 500 }
      );
    }
  };
}

