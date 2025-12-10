/**
 * Tests for Stripe provider implementation.
 * Mocks all Stripe API calls and tests the complete flow including customer creation before checkout.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { StripeProvider } from '../../../src/providers/stripe/index';
import { createMemoryAdapter } from '../../../src/adapters/memory';
import { PaymentError, WebhookError, ErrorCodes } from '../../../src/core/errors';
import { mockStripeClient } from '../../setup';
import type Stripe from 'stripe';

describe('StripeProvider', () => {
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

    // Reset all mocks
    vi.clearAllMocks();
  });

  describe('createCheckout', () => {
    it('should create checkout session with customer creation flow', async () => {
      const userId = 'user_123';
      const customerEmail = 'test@example.com';
      const customerId = 'cus_test_123';

      // Mock customer creation
      (mockStripeClient.customers.create as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: customerId,
        email: customerEmail,
        name: null,
        metadata: { userId },
        created: Math.floor(Date.now() / 1000),
      });

      // Mock checkout session creation
      (mockStripeClient.checkout.sessions.create as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'cs_test_123',
        url: 'https://checkout.stripe.com/c/pay/cs_test_123',
        status: 'open',
        customer: customerId,
        metadata: { userId },
        created: Math.floor(Date.now() / 1000),
      });

      const session = await provider.createCheckout({
        priceId: 'price_123',
        successUrl: 'https://example.com/success',
        cancelUrl: 'https://example.com/cancel',
        customerEmail,
        metadata: { userId },
      });

      expect(session.id).toBe('cs_test_123');
      expect(session.url).toBe('https://checkout.stripe.com/c/pay/cs_test_123');
      expect(session.customerId).toBe(customerId);
      expect(session.status).toBe('open');

      // Verify customer was created
      expect(mockStripeClient.customers.create).toHaveBeenCalledWith(
        expect.objectContaining({
          email: customerEmail,
          metadata: { userId },
        })
      );

      // Verify checkout session was created with customer ID
      expect(mockStripeClient.checkout.sessions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          customer: customerId,
          line_items: [{ price: 'price_123', quantity: 1 }],
        })
      );

      // Verify customer ID was cached
      const cachedCustomerId = await cache.get<string>(`customer:userId:${userId}`);
      expect(cachedCustomerId).toBe(customerId);
    });

    it('should use existing customer from cache', async () => {
      const userId = 'user_123';
      const customerId = 'cus_existing_123';

      // Pre-populate cache with customer ID
      await cache.set(`customer:userId:${userId}`, customerId);

      // Mock checkout session creation
      (mockStripeClient.checkout.sessions.create as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'cs_test_123',
        url: 'https://checkout.stripe.com/c/pay/cs_test_123',
        status: 'open',
        customer: customerId,
        metadata: { userId },
        created: Math.floor(Date.now() / 1000),
      });

      const session = await provider.createCheckout({
        priceId: 'price_123',
        successUrl: 'https://example.com/success',
        cancelUrl: 'https://example.com/cancel',
        customerEmail: 'test@example.com',
        metadata: { userId },
      });

      expect(session.customerId).toBe(customerId);

      // Verify customer was NOT created (used cached one)
      expect(mockStripeClient.customers.create).not.toHaveBeenCalled();

      // Verify checkout session was created with existing customer ID
      expect(mockStripeClient.checkout.sessions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          customer: customerId,
        })
      );
    });

    it('should throw error if userId is missing in metadata', async () => {
      await expect(
        provider.createCheckout({
          priceId: 'price_123',
          successUrl: 'https://example.com/success',
          cancelUrl: 'https://example.com/cancel',
          customerEmail: 'test@example.com',
        })
      ).rejects.toThrow(PaymentError);

      await expect(
        provider.createCheckout({
          priceId: 'price_123',
          successUrl: 'https://example.com/success',
          cancelUrl: 'https://example.com/cancel',
          customerEmail: 'test@example.com',
        })
      ).rejects.toThrow('userId is required in metadata for checkout');
    });

    it('should throw error if customerEmail is missing', async () => {
      await expect(
        provider.createCheckout({
          priceId: 'price_123',
          successUrl: 'https://example.com/success',
          cancelUrl: 'https://example.com/cancel',
          metadata: { userId: 'user_123' },
        })
      ).rejects.toThrow(PaymentError);

      await expect(
        provider.createCheckout({
          priceId: 'price_123',
          successUrl: 'https://example.com/success',
          cancelUrl: 'https://example.com/cancel',
          metadata: { userId: 'user_123' },
        })
      ).rejects.toThrow('customerEmail is required for checkout');
    });

    it('should handle Stripe API errors', async () => {
      const stripeError = new Error('Stripe API error');
      (stripeError as any).statusCode = 400;
      (stripeError as any).type = 'StripeCardError';

      (mockStripeClient.customers.create as ReturnType<typeof vi.fn>).mockRejectedValue(
        stripeError
      );

      await expect(
        provider.createCheckout({
          priceId: 'price_123',
          successUrl: 'https://example.com/success',
          cancelUrl: 'https://example.com/cancel',
          customerEmail: 'test@example.com',
          metadata: { userId: 'user_123' },
        })
      ).rejects.toThrow(PaymentError);
    });

    it('should handle expired checkout session', async () => {
      const userId = 'user_123';
      const customerId = 'cus_test_123';

      await cache.set(`customer:userId:${userId}`, customerId);

      (mockStripeClient.checkout.sessions.create as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'cs_test_123',
        url: 'https://checkout.stripe.com/c/pay/cs_test_123',
        status: 'expired',
        customer: customerId,
        created: Math.floor(Date.now() / 1000),
      });

      const session = await provider.createCheckout({
        priceId: 'price_123',
        successUrl: 'https://example.com/success',
        cancelUrl: 'https://example.com/cancel',
        customerEmail: 'test@example.com',
        metadata: { userId },
      });

      expect(session.status).toBe('expired');
    });
  });

  describe('createSubscription', () => {
    it('should create subscription successfully', async () => {
      const subscriptionId = 'sub_test_123';
      const customerId = 'cus_test_123';

      (mockStripeClient.subscriptions.create as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: subscriptionId,
        customer: customerId,
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
      });

      const subscription = await provider.createSubscription({
        customerId,
        priceId: 'price_123',
        metadata: { userId: 'user_123' },
      });

      expect(subscription.id).toBe(subscriptionId);
      expect(subscription.customerId).toBe(customerId);
      expect(subscription.status).toBe('active');
      expect(subscription.items).toHaveLength(1);

      // Verify subscription was cached
      const cached = await cache.get(`subscription:${subscriptionId}`);
      expect(cached).toBeDefined();
    });

    it('should handle subscription creation errors', async () => {
      const stripeError = new Error('Invalid customer');
      (stripeError as any).statusCode = 400;

      (mockStripeClient.subscriptions.create as ReturnType<typeof vi.fn>).mockRejectedValue(
        stripeError
      );

      await expect(
        provider.createSubscription({
          customerId: 'cus_invalid',
          priceId: 'price_123',
        })
      ).rejects.toThrow(PaymentError);
    });
  });

  describe('createCustomer', () => {
    it('should create customer successfully', async () => {
      const customerId = 'cus_test_123';
      const email = 'test@example.com';

      (mockStripeClient.customers.create as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: customerId,
        email,
        name: 'Test User',
        metadata: { userId: 'user_123' },
        created: Math.floor(Date.now() / 1000),
      });

      const customer = await provider.createCustomer({
        email,
        name: 'Test User',
        metadata: { userId: 'user_123' },
      });

      expect(customer.id).toBe(customerId);
      expect(customer.email).toBe(email);
      expect(customer.name).toBe('Test User');

      // Verify customer was cached by email
      const cachedByEmail = await cache.get<typeof customer>(`customer:email:${email}`);
      expect(cachedByEmail?.id).toBe(customerId);

      // Verify customer was cached by userId
      const cachedByUserId = await cache.get<string>(`customer:userId:user_123`);
      expect(cachedByUserId).toBe(customerId);
    });

    it('should return cached customer if exists', async () => {
      const email = 'test@example.com';
      const cachedCustomer = {
        id: 'cus_cached_123',
        email,
        name: 'Cached User',
        createdAt: new Date(),
      };

      await cache.set(`customer:email:${email}`, cachedCustomer);

      const customer = await provider.createCustomer({
        email,
      });

      expect(customer.id).toBe('cus_cached_123');
      expect(mockStripeClient.customers.create).not.toHaveBeenCalled();
    });

    it('should handle customer creation errors', async () => {
      const stripeError = new Error('Invalid email');
      (stripeError as any).statusCode = 400;

      (mockStripeClient.customers.create as ReturnType<typeof vi.fn>).mockRejectedValue(
        stripeError
      );

      await expect(
        provider.createCustomer({
          email: 'invalid-email',
        })
      ).rejects.toThrow(PaymentError);
    });
  });

  describe('verifyWebhook', () => {
    it('should verify webhook signature successfully', () => {
      const payload = JSON.stringify({ type: 'checkout.session.completed', id: 'evt_123' });
      const signature = 't=1234567890,v1=signature';

      const mockEvent = {
        id: 'evt_123',
        type: 'checkout.session.completed',
        data: { object: { id: 'cs_test_123' } },
        created: Math.floor(Date.now() / 1000),
      };

      (mockStripeClient.webhooks.constructEvent as ReturnType<typeof vi.fn>).mockReturnValue(
        mockEvent
      );

      const event = provider.verifyWebhook(payload, signature);

      expect(event.id).toBe('evt_123');
      expect(event.type).toBe('checkout.session.completed');
      expect(mockStripeClient.webhooks.constructEvent).toHaveBeenCalledWith(
        payload,
        signature,
        'whsec_mock_webhook_secret_1234567890'
      );
    });

    it('should throw error if webhook secret is missing', () => {
      // Temporarily clear the env var for this test
      const originalWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
      delete process.env.STRIPE_WEBHOOK_SECRET;

      const providerWithoutSecret = new StripeProvider({
        cache,
        config: {
          secretKey: 'sk_test_mock_key_1234567890',
          webhookSecret: '', // Empty string will be trimmed to undefined
        },
      });

      const payload = JSON.stringify({ type: 'checkout.session.completed' });
      const signature = 't=1234567890,v1=signature';

      expect(() => {
        providerWithoutSecret.verifyWebhook(payload, signature);
      }).toThrow(WebhookError);
      expect(() => {
        providerWithoutSecret.verifyWebhook(payload, signature);
      }).toThrow('Webhook secret is not configured');

      // Restore env var
      if (originalWebhookSecret) {
        process.env.STRIPE_WEBHOOK_SECRET = originalWebhookSecret;
      }
    });

    it('should throw error on invalid signature', () => {
      const payload = JSON.stringify({ type: 'checkout.session.completed' });
      const invalidSignature = 'invalid_signature';

      // Import Stripe the same way the webhook file does
      const Stripe = require('stripe');
      const errorMessage = 'No signatures found matching the payload';
      
      // Create error instance - ensure message is set
      const stripeError = new Stripe.errors.StripeSignatureVerificationError(errorMessage);
      
      // The mock error class should set message via super(), but ensure it's set
      if (!stripeError.message) {
        stripeError.message = errorMessage;
      }

      (mockStripeClient.webhooks.constructEvent as ReturnType<typeof vi.fn>).mockImplementation(
        () => {
          throw stripeError;
        }
      );

      expect(() => {
        provider.verifyWebhook(payload, invalidSignature);
      }).toThrow(WebhookError);
      // The error message includes the underlying Stripe error
      // Note: The instanceof check may not work with the mock, so it goes to the else branch
      expect(() => {
        provider.verifyWebhook(payload, invalidSignature);
      }).toThrow(/Webhook.*verification.*failed/i);
    });
  });

  describe('createPortalSession', () => {
    it('should create portal session successfully', async () => {
      const customerId = 'cus_test_123';
      const portalUrl = 'https://billing.stripe.com/session/portal_123';

      (mockStripeClient.billingPortal.sessions.create as ReturnType<typeof vi.fn>).mockResolvedValue(
        {
          url: portalUrl,
        }
      );

      const session = await provider.createPortalSession(
        customerId,
        'https://example.com/return'
      );

      expect(session.url).toBe(portalUrl);
      expect(mockStripeClient.billingPortal.sessions.create).toHaveBeenCalledWith({
        customer: customerId,
        return_url: 'https://example.com/return',
      });
    });

    it('should handle customer not found error', async () => {
      const customerId = 'cus_not_found';

      const stripeError = new Error('No such customer');
      (stripeError as any).statusCode = 404;

      (mockStripeClient.billingPortal.sessions.create as ReturnType<typeof vi.fn>).mockRejectedValue(
        stripeError
      );

      await expect(
        provider.createPortalSession(customerId, 'https://example.com/return')
      ).rejects.toThrow(PaymentError);
    });
  });
});

