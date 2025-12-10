/**
 * Tests for Next.js API route handlers (webhook, checkout).
 * Tests request/response handling, error cases, and edge cases.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest, NextResponse } from '../__mocks__/next-server';
import { createWebhookHandler } from '../../src/next/handlers/webhook';
import { createCheckoutHandler } from '../../src/next/handlers/checkout';
import { StripeProvider } from '../../src/providers/stripe/index';
import { createMemoryAdapter } from '../../src/adapters/memory';
import { WebhookError, PaymentError, ErrorCodes } from '../../src/core/errors';
import { mockStripeClient } from '../setup';

describe('Next.js Handlers', () => {
  let provider: StripeProvider;
  let cache: ReturnType<typeof createMemoryAdapter>;

  beforeEach(() => {
    cache = createMemoryAdapter();
    provider = new StripeProvider({
      cache,
      config: {
        secretKey: 'sk_test_mock_key_1234567890',
        webhookSecret: 'whsec_mock_webhook_secret_1234567890',
      },
    });

    vi.clearAllMocks();
  });

  describe('createWebhookHandler', () => {
    it('should handle checkout.session.completed event', async () => {
      const payload = JSON.stringify({
        id: 'evt_123',
        type: 'checkout.session.completed',
        data: { object: { id: 'cs_test_123' } },
        created: Math.floor(Date.now() / 1000),
      });

      const signature = 't=1234567890,v1=signature';

      const mockEvent = {
        id: 'evt_123',
        type: 'checkout.session.completed',
        data: { object: { id: 'cs_test_123' } },
        created: Math.floor(Date.now() / 1000),
      };

      const mockSession = {
        id: 'cs_test_123',
        url: 'https://checkout.stripe.com/c/pay/cs_test_123',
        status: 'complete',
        customer: 'cus_test_123',
        metadata: { userId: 'user_123' },
        created: Math.floor(Date.now() / 1000),
      };

      const mockCustomer = {
        id: 'cus_test_123',
        email: 'test@example.com',
        name: null,
        metadata: { userId: 'user_123' },
        created: Math.floor(Date.now() / 1000),
        deleted: false,
      };

      (mockStripeClient.webhooks.constructEvent as ReturnType<typeof vi.fn>).mockReturnValue(
        mockEvent
      );
      (mockStripeClient.checkout.sessions.retrieve as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockSession
      );
      (mockStripeClient.customers.retrieve as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockCustomer
      );

      const onCheckoutComplete = vi.fn();
      const handler = createWebhookHandler({
        provider,
        cache,
        handlers: {
          onCheckoutComplete,
        },
      });

      const request = new NextRequest('http://localhost:3000/api/webhook', {
        method: 'POST',
        headers: {
          'stripe-signature': signature,
        },
        body: payload,
      });

      const response = await handler(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.received).toBe(true);
      expect(onCheckoutComplete).toHaveBeenCalled();
    });

    it('should handle customer.subscription.created event', async () => {
      const payload = JSON.stringify({
        id: 'evt_123',
        type: 'customer.subscription.created',
        data: { object: { id: 'sub_test_123' } },
        created: Math.floor(Date.now() / 1000),
      });

      const signature = 't=1234567890,v1=signature';

      const mockEvent = {
        id: 'evt_123',
        type: 'customer.subscription.created',
        data: { object: { id: 'sub_test_123' } },
        created: Math.floor(Date.now() / 1000),
      };

      const mockSubscription = {
        id: 'sub_test_123',
        customer: 'cus_test_123',
        status: 'active',
        current_period_end: Math.floor(Date.now() / 1000) + 86400 * 30,
        current_period_start: Math.floor(Date.now() / 1000),
        cancel_at_period_end: false,
        items: {
          data: [
            {
              id: 'si_test_123',
              price: { id: 'price_123' },
              quantity: 1,
            },
          ],
        },
        metadata: { userId: 'user_123' },
        created: Math.floor(Date.now() / 1000),
      };

      (mockStripeClient.webhooks.constructEvent as ReturnType<typeof vi.fn>).mockReturnValue(
        mockEvent
      );
      (mockStripeClient.subscriptions.retrieve as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockSubscription
      );

      const onSubscriptionCreated = vi.fn();
      const handler = createWebhookHandler({
        provider,
        cache,
        handlers: {
          onSubscriptionCreated,
        },
      });

      const request = new NextRequest('http://localhost:3000/api/webhook', {
        method: 'POST',
        headers: {
          'stripe-signature': signature,
        },
        body: payload,
      });

      const response = await handler(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.received).toBe(true);
      expect(onSubscriptionCreated).toHaveBeenCalled();
    });

    it('should handle customer.subscription.updated event', async () => {
      const payload = JSON.stringify({
        id: 'evt_123',
        type: 'customer.subscription.updated',
        data: { object: { id: 'sub_test_123' } },
        created: Math.floor(Date.now() / 1000),
      });

      const signature = 't=1234567890,v1=signature';

      const mockEvent = {
        id: 'evt_123',
        type: 'customer.subscription.updated',
        data: { object: { id: 'sub_test_123' } },
        created: Math.floor(Date.now() / 1000),
      };

      const mockSubscription = {
        id: 'sub_test_123',
        customer: 'cus_test_123',
        status: 'active',
        current_period_end: Math.floor(Date.now() / 1000) + 86400 * 30,
        current_period_start: Math.floor(Date.now() / 1000),
        cancel_at_period_end: false,
        items: {
          data: [],
        },
        created: Math.floor(Date.now() / 1000),
      };

      (mockStripeClient.webhooks.constructEvent as ReturnType<typeof vi.fn>).mockReturnValue(
        mockEvent
      );
      (mockStripeClient.subscriptions.retrieve as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockSubscription
      );

      const onSubscriptionUpdated = vi.fn();
      const handler = createWebhookHandler({
        provider,
        cache,
        handlers: {
          onSubscriptionUpdated,
        },
      });

      const request = new NextRequest('http://localhost:3000/api/webhook', {
        method: 'POST',
        headers: {
          'stripe-signature': signature,
        },
        body: payload,
      });

      const response = await handler(request);

      expect(response.status).toBe(200);
      expect(onSubscriptionUpdated).toHaveBeenCalled();
    });

    it('should handle customer.subscription.deleted event', async () => {
      const payload = JSON.stringify({
        id: 'evt_123',
        type: 'customer.subscription.deleted',
        data: { object: { id: 'sub_test_123' } },
        created: Math.floor(Date.now() / 1000),
      });

      const signature = 't=1234567890,v1=signature';

      const mockEvent = {
        id: 'evt_123',
        type: 'customer.subscription.deleted',
        data: { object: { id: 'sub_test_123' } },
        created: Math.floor(Date.now() / 1000),
      };

      const mockSubscription = {
        id: 'sub_test_123',
        customer: 'cus_test_123',
        status: 'canceled',
        current_period_end: Math.floor(Date.now() / 1000),
        current_period_start: Math.floor(Date.now() / 1000),
        cancel_at_period_end: false,
        items: {
          data: [],
        },
        created: Math.floor(Date.now() / 1000),
      };

      (mockStripeClient.webhooks.constructEvent as ReturnType<typeof vi.fn>).mockReturnValue(
        mockEvent
      );
      (mockStripeClient.subscriptions.retrieve as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockSubscription
      );

      const onSubscriptionCanceled = vi.fn();
      const handler = createWebhookHandler({
        provider,
        cache,
        handlers: {
          onSubscriptionCanceled,
        },
      });

      const request = new NextRequest('http://localhost:3000/api/webhook', {
        method: 'POST',
        headers: {
          'stripe-signature': signature,
        },
        body: payload,
      });

      const response = await handler(request);

      expect(response.status).toBe(200);
      expect(onSubscriptionCanceled).toHaveBeenCalled();
    });

    it('should reject requests without signature', async () => {
      const handler = createWebhookHandler({
        provider,
        cache,
      });

      const request = new NextRequest('http://localhost:3000/api/webhook', {
        method: 'POST',
        body: JSON.stringify({ type: 'checkout.session.completed' }),
      });

      const response = await handler(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBeDefined();
      expect(data.message).toContain('signature');
    });

    it('should reject invalid signature', async () => {
      const payload = JSON.stringify({ type: 'checkout.session.completed' });
      const invalidSignature = 'invalid_signature';

      // Use the actual Stripe mock error class
      const Stripe = require('stripe');
      const stripeError = new Stripe.errors.StripeSignatureVerificationError(
        'No signatures found matching the payload'
      );

      (mockStripeClient.webhooks.constructEvent as ReturnType<typeof vi.fn>).mockImplementation(
        () => {
          throw stripeError;
        }
      );

      const handler = createWebhookHandler({
        provider,
        cache,
      });

      const request = new NextRequest('http://localhost:3000/api/webhook', {
        method: 'POST',
        headers: {
          'stripe-signature': invalidSignature,
        },
        body: payload,
      });

      const response = await handler(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe(ErrorCodes.WEBHOOK_SIGNATURE_INVALID);
    });

    it('should reject non-POST requests', async () => {
      const handler = createWebhookHandler({
        provider,
        cache,
      });

      const request = new NextRequest('http://localhost:3000/api/webhook', {
        method: 'GET',
      });

      const response = await handler(request);
      const data = await response.json();

      expect(response.status).toBe(405);
      expect(data.error).toBe('Method not allowed');
    });

    it('should handle unhandled event types gracefully', async () => {
      const payload = JSON.stringify({
        id: 'evt_123',
        type: 'payment_intent.succeeded',
        data: { object: {} },
        created: Math.floor(Date.now() / 1000),
      });

      const signature = 't=1234567890,v1=signature';

      const mockEvent = {
        id: 'evt_123',
        type: 'payment_intent.succeeded',
        data: { object: {} },
        created: Math.floor(Date.now() / 1000),
      };

      (mockStripeClient.webhooks.constructEvent as ReturnType<typeof vi.fn>).mockReturnValue(
        mockEvent
      );

      const handler = createWebhookHandler({
        provider,
        cache,
      });

      const request = new NextRequest('http://localhost:3000/api/webhook', {
        method: 'POST',
        headers: {
          'stripe-signature': signature,
        },
        body: payload,
      });

      const response = await handler(request);
      const data = await response.json();

      // Should still return 200 to acknowledge receipt
      expect(response.status).toBe(200);
      expect(data.received).toBe(true);
    });
  });

  describe('createCheckoutHandler', () => {
    it('should create checkout session successfully', async () => {
      const mockSession = {
        id: 'cs_test_123',
        url: 'https://checkout.stripe.com/c/pay/cs_test_123',
        status: 'open' as const,
      };

      vi.spyOn(provider, 'createCheckout').mockResolvedValue(mockSession);

      const handler = createCheckoutHandler({
        provider,
      });

      const request = new NextRequest('http://localhost:3000/api/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          priceId: 'price_123',
          successUrl: 'https://example.com/success',
          cancelUrl: 'https://example.com/cancel',
          customerEmail: 'test@example.com',
          metadata: { userId: 'user_123' },
        }),
      });

      const response = await handler(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.url).toBe(mockSession.url);
      expect(data.sessionId).toBe(mockSession.id);
    });

    it('should reject requests with missing priceId', async () => {
      const handler = createCheckoutHandler({
        provider,
      });

      const request = new NextRequest('http://localhost:3000/api/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          successUrl: 'https://example.com/success',
          cancelUrl: 'https://example.com/cancel',
        }),
      });

      const response = await handler(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid request');
      expect(data.message).toContain('priceId');
    });

    it('should reject requests with missing successUrl', async () => {
      const handler = createCheckoutHandler({
        provider,
      });

      const request = new NextRequest('http://localhost:3000/api/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          priceId: 'price_123',
          cancelUrl: 'https://example.com/cancel',
        }),
      });

      const response = await handler(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid request');
      expect(data.message).toContain('successUrl');
    });

    it('should reject requests with missing cancelUrl', async () => {
      const handler = createCheckoutHandler({
        provider,
      });

      const request = new NextRequest('http://localhost:3000/api/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          priceId: 'price_123',
          successUrl: 'https://example.com/success',
        }),
      });

      const response = await handler(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid request');
      expect(data.message).toContain('cancelUrl');
    });

    it('should handle PaymentError with proper status code', async () => {
      const paymentError = new PaymentError(
        'Checkout failed',
        ErrorCodes.PAYMENT_FAILED,
        400
      );

      vi.spyOn(provider, 'createCheckout').mockRejectedValue(paymentError);

      const handler = createCheckoutHandler({
        provider,
      });

      const request = new NextRequest('http://localhost:3000/api/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          priceId: 'price_123',
          successUrl: 'https://example.com/success',
          cancelUrl: 'https://example.com/cancel',
        }),
      });

      const response = await handler(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe(ErrorCodes.PAYMENT_FAILED);
      expect(data.message).toBe('Checkout failed');
    });

    it('should reject non-POST requests', async () => {
      const handler = createCheckoutHandler({
        provider,
      });

      const request = new NextRequest('http://localhost:3000/api/checkout', {
        method: 'GET',
      });

      const response = await handler(request);
      const data = await response.json();

      expect(response.status).toBe(405);
      expect(data.error).toBe('Method not allowed');
    });
  });
});

