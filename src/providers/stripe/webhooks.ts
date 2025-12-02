/**
 * Webhook signature verification and event parsing.
 * Provides secure webhook handling for Stripe events.
 */

import Stripe from 'stripe';
import type { WebhookEvent } from '../../core/types';
import { WebhookError, ErrorCodes } from '../../core/errors';

/**
 * Verifies a webhook payload signature and returns the parsed event.
 * Uses constant-time comparison to prevent timing attacks.
 *
 * @param stripe - Stripe client instance
 * @param payload - Raw webhook payload string (must be raw body, not parsed JSON)
 * @param signature - Webhook signature from Stripe-Signature header
 * @param webhookSecret - Webhook signing secret from Stripe dashboard
 * @returns Parsed and verified webhook event
 * @throws WebhookError if signature verification fails
 *
 * @example
 * ```ts
 * const event = verifyWebhookSignature(
 *   stripe,
 *   rawBody,
 *   req.headers['stripe-signature'],
 *   process.env.STRIPE_WEBHOOK_SECRET!
 * );
 * ```
 */
export function verifyWebhookSignature(
  stripe: Stripe,
  payload: string,
  signature: string,
  webhookSecret: string
): WebhookEvent {
  if (!webhookSecret) {
    throw new WebhookError(
      'Webhook secret is required for signature verification',
      ErrorCodes.WEBHOOK_SIGNATURE_INVALID
    );
  }

  if (!signature) {
    throw new WebhookError(
      'Missing webhook signature in request headers',
      ErrorCodes.WEBHOOK_SIGNATURE_INVALID
    );
  }

  try {
    const event = stripe.webhooks.constructEvent(
      payload,
      signature,
      webhookSecret
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
      `Webhook verification failed: ${
        error instanceof Error ? error.message : 'Unknown error'
      }`,
      ErrorCodes.WEBHOOK_SIGNATURE_INVALID
    );
  }
}

/**
 * Validates that a webhook event has the expected structure.
 * @param event - Webhook event to validate
 * @returns true if event is valid
 * @throws WebhookError if event is invalid
 */
export function validateWebhookEvent(event: WebhookEvent): boolean {
  if (!event.id || typeof event.id !== 'string') {
    throw new WebhookError(
      'Invalid webhook event: missing or invalid event ID',
      ErrorCodes.WEBHOOK_SIGNATURE_INVALID
    );
  }

  if (!event.type || typeof event.type !== 'string') {
    throw new WebhookError(
      'Invalid webhook event: missing or invalid event type',
      ErrorCodes.WEBHOOK_SIGNATURE_INVALID
    );
  }

  if (!event.data) {
    throw new WebhookError(
      'Invalid webhook event: missing event data',
      ErrorCodes.WEBHOOK_SIGNATURE_INVALID
    );
  }

  if (!(event.created instanceof Date)) {
    throw new WebhookError(
      'Invalid webhook event: invalid created timestamp',
      ErrorCodes.WEBHOOK_SIGNATURE_INVALID
    );
  }

  return true;
}

/**
 * Parses common webhook event types for type safety.
 * @param event - Webhook event to parse
 * @returns Typed event data based on event type
 */
export function parseWebhookEvent<T = unknown>(event: WebhookEvent): {
  id: string;
  type: string;
  data: T;
  created: Date;
} {
  validateWebhookEvent(event);
  return {
    id: event.id,
    type: event.type,
    data: event.data as T,
    created: event.created,
  };
}

