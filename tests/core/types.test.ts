/**
 * Type validation tests for core types.
 * Ensures type definitions are correct and interfaces are properly structured.
 */

import { describe, it, expect } from 'vitest';
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
  SubscriptionState,
} from '../../src/core/types';

describe('Core Types', () => {
  describe('CheckoutOptions', () => {
    it('should accept valid checkout options', () => {
      const options: CheckoutOptions = {
        priceId: 'price_123',
        successUrl: 'https://example.com/success',
        cancelUrl: 'https://example.com/cancel',
      };

      expect(options.priceId).toBe('price_123');
      expect(options.successUrl).toBe('https://example.com/success');
      expect(options.cancelUrl).toBe('https://example.com/cancel');
    });

    it('should accept optional fields', () => {
      const options: CheckoutOptions = {
        priceId: 'price_123',
        successUrl: 'https://example.com/success',
        cancelUrl: 'https://example.com/cancel',
        customerEmail: 'test@example.com',
        customerId: 'cus_123',
        metadata: { userId: 'user_123' },
        mode: 'subscription',
        quantity: 2,
        trialDays: 7,
      };

      expect(options.customerEmail).toBe('test@example.com');
      expect(options.customerId).toBe('cus_123');
      expect(options.metadata?.userId).toBe('user_123');
      expect(options.mode).toBe('subscription');
      expect(options.quantity).toBe(2);
      expect(options.trialDays).toBe(7);
    });
  });

  describe('CheckoutSession', () => {
    it('should have required fields', () => {
      const session: CheckoutSession = {
        id: 'cs_test_123',
        url: 'https://checkout.stripe.com/c/pay/cs_test_123',
        status: 'open',
      };

      expect(session.id).toBe('cs_test_123');
      expect(session.url).toBe('https://checkout.stripe.com/c/pay/cs_test_123');
      expect(session.status).toBe('open');
    });

    it('should accept optional fields', () => {
      const session: CheckoutSession = {
        id: 'cs_test_123',
        url: 'https://checkout.stripe.com/c/pay/cs_test_123',
        status: 'complete',
        customerId: 'cus_123',
        metadata: { userId: 'user_123' },
        createdAt: new Date(),
      };

      expect(session.customerId).toBe('cus_123');
      expect(session.metadata?.userId).toBe('user_123');
      expect(session.createdAt).toBeInstanceOf(Date);
    });

    it('should accept all valid status values', () => {
      const statuses: CheckoutSession['status'][] = ['open', 'complete', 'expired'];
      
      statuses.forEach((status) => {
        const session: CheckoutSession = {
          id: 'cs_test_123',
          url: 'https://checkout.stripe.com/c/pay/cs_test_123',
          status,
        };
        expect(session.status).toBe(status);
      });
    });
  });

  describe('SubscriptionOptions', () => {
    it('should accept valid subscription options', () => {
      const options: SubscriptionOptions = {
        customerId: 'cus_123',
        priceId: 'price_123',
      };

      expect(options.customerId).toBe('cus_123');
      expect(options.priceId).toBe('price_123');
    });

    it('should accept optional fields', () => {
      const options: SubscriptionOptions = {
        customerId: 'cus_123',
        priceId: 'price_123',
        trialDays: 14,
        metadata: { userId: 'user_123' },
        quantity: 3,
      };

      expect(options.trialDays).toBe(14);
      expect(options.metadata?.userId).toBe('user_123');
      expect(options.quantity).toBe(3);
    });
  });

  describe('Subscription', () => {
    it('should have required fields', () => {
      const subscription: Subscription = {
        id: 'sub_123',
        customerId: 'cus_123',
        status: 'active',
        currentPeriodEnd: new Date(),
        currentPeriodStart: new Date(),
        cancelAtPeriodEnd: false,
        items: [
          {
            id: 'si_123',
            priceId: 'price_123',
            quantity: 1,
          },
        ],
      };

      expect(subscription.id).toBe('sub_123');
      expect(subscription.customerId).toBe('cus_123');
      expect(subscription.status).toBe('active');
      expect(subscription.items).toHaveLength(1);
    });

    it('should accept all valid subscription states', () => {
      const states: SubscriptionState[] = [
        'active',
        'past_due',
        'canceled',
        'incomplete',
        'incomplete_expired',
        'trialing',
        'unpaid',
        'paused',
      ];

      states.forEach((status) => {
        const subscription: Subscription = {
          id: 'sub_123',
          customerId: 'cus_123',
          status,
          currentPeriodEnd: new Date(),
          currentPeriodStart: new Date(),
          cancelAtPeriodEnd: false,
          items: [],
        };
        expect(subscription.status).toBe(status);
      });
    });
  });

  describe('CustomerData', () => {
    it('should require email', () => {
      const data: CustomerData = {
        email: 'test@example.com',
      };

      expect(data.email).toBe('test@example.com');
    });

    it('should accept optional fields', () => {
      const data: CustomerData = {
        email: 'test@example.com',
        name: 'Test User',
        metadata: { userId: 'user_123' },
      };

      expect(data.name).toBe('Test User');
      expect(data.metadata?.userId).toBe('user_123');
    });
  });

  describe('Customer', () => {
    it('should have required fields', () => {
      const customer: Customer = {
        id: 'cus_123',
        email: 'test@example.com',
      };

      expect(customer.id).toBe('cus_123');
      expect(customer.email).toBe('test@example.com');
    });

    it('should accept optional fields', () => {
      const customer: Customer = {
        id: 'cus_123',
        email: 'test@example.com',
        name: 'Test User',
        metadata: { userId: 'user_123' },
        createdAt: new Date(),
      };

      expect(customer.name).toBe('Test User');
      expect(customer.metadata?.userId).toBe('user_123');
      expect(customer.createdAt).toBeInstanceOf(Date);
    });
  });

  describe('WebhookEvent', () => {
    it('should have required fields', () => {
      const event: WebhookEvent = {
        id: 'evt_123',
        type: 'checkout.session.completed',
        data: { id: 'cs_test_123' },
        created: new Date(),
      };

      expect(event.id).toBe('evt_123');
      expect(event.type).toBe('checkout.session.completed');
      expect(event.data).toEqual({ id: 'cs_test_123' });
      expect(event.created).toBeInstanceOf(Date);
    });
  });

  describe('PortalSession', () => {
    it('should have required url field', () => {
      const session: PortalSession = {
        url: 'https://billing.stripe.com/session/portal_123',
      };

      expect(session.url).toBe('https://billing.stripe.com/session/portal_123');
    });
  });

  describe('KVAdapter', () => {
    it('should define required methods', () => {
      const adapter: KVAdapter = {
        get: async <T>() => null as T | null,
        set: async () => {},
        delete: async () => {},
      };

      expect(typeof adapter.get).toBe('function');
      expect(typeof adapter.set).toBe('function');
      expect(typeof adapter.delete).toBe('function');
    });
  });

  describe('PaymentProvider', () => {
    it('should define required methods', () => {
      const provider: PaymentProvider = {
        name: 'stripe',
        createCheckout: async () => ({
          id: 'cs_test_123',
          url: 'https://checkout.stripe.com/c/pay/cs_test_123',
          status: 'open',
        }),
        createSubscription: async () => ({
          id: 'sub_123',
          customerId: 'cus_123',
          status: 'active',
          currentPeriodEnd: new Date(),
          currentPeriodStart: new Date(),
          cancelAtPeriodEnd: false,
          items: [],
        }),
        createCustomer: async () => ({
          id: 'cus_123',
          email: 'test@example.com',
        }),
        verifyWebhook: () => ({
          id: 'evt_123',
          type: 'checkout.session.completed',
          data: {},
          created: new Date(),
        }),
        createPortalSession: async () => ({
          url: 'https://billing.stripe.com/session/portal_123',
        }),
      };

      expect(provider.name).toBe('stripe');
      expect(typeof provider.createCheckout).toBe('function');
      expect(typeof provider.createSubscription).toBe('function');
      expect(typeof provider.createCustomer).toBe('function');
      expect(typeof provider.verifyWebhook).toBe('function');
      expect(typeof provider.createPortalSession).toBe('function');
    });
  });
});

