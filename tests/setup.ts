/**
 * Vitest setup file for Stripe SDK tests.
 * Configures mocks for Stripe SDK, environment variables, and React testing.
 */

import { vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Cleanup after each test
afterEach(() => {
  cleanup();
});

// Mock environment variables
process.env.STRIPE_SECRET_KEY = 'sk_test_mock_key_1234567890';
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_mock_webhook_secret_1234567890';

// Mock Stripe SDK
const mockStripeClient = {
  checkout: {
    sessions: {
      create: vi.fn(),
      retrieve: vi.fn(),
    },
  },
  subscriptions: {
    create: vi.fn(),
    retrieve: vi.fn(),
    update: vi.fn(),
    cancel: vi.fn(),
  },
  customers: {
    create: vi.fn(),
    retrieve: vi.fn(),
  },
  billingPortal: {
    sessions: {
      create: vi.fn(),
    },
  },
  webhooks: {
    constructEvent: vi.fn(),
  },
};

// Mock Stripe constructor - must be a class for 'new' to work
class MockStripe {
  checkout = mockStripeClient.checkout;
  subscriptions = mockStripeClient.subscriptions;
  customers = mockStripeClient.customers;
  billingPortal = mockStripeClient.billingPortal;
  webhooks = mockStripeClient.webhooks;
  
  constructor(_apiKey: string, _options?: unknown) {
    // Constructor does nothing, just returns the mock
  }
}

// Create error classes that can be used in instanceof checks
class MockStripeError extends Error {
  statusCode?: number;
  constructor(message: string, statusCode?: number) {
    super(message);
    this.name = 'StripeError';
    this.statusCode = statusCode;
  }
}

class MockStripeSignatureVerificationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StripeSignatureVerificationError';
  }
}

// Create errors object that matches Stripe SDK structure
const mockStripeErrors = {
  StripeError: MockStripeError,
  StripeSignatureVerificationError: MockStripeSignatureVerificationError,
};

// Attach errors to MockStripe class (matches Stripe SDK where Stripe.errors exists)
(MockStripe as any).errors = mockStripeErrors;

// Mock Stripe module
vi.mock('stripe', () => {
  return {
    default: MockStripe,
    errors: mockStripeErrors,
  };
});

// Mock window.location for redirects
Object.defineProperty(window, 'location', {
  value: {
    href: '',
  },
  writable: true,
});

// Mock fetch globally
global.fetch = vi.fn();

// Mock @upstash/redis - must be hoisted before any imports
// Create shared mock functions
const upstashSharedMocks = {
  get: vi.fn(),
  set: vi.fn(),
  del: vi.fn(),
};

class MockUpstashRedis {
  get: ReturnType<typeof vi.fn>;
  set: ReturnType<typeof vi.fn>;
  del: ReturnType<typeof vi.fn>;
  
  constructor(_config: { url: string; token: string }) {
    this.get = upstashSharedMocks.get;
    this.set = upstashSharedMocks.set;
    this.del = upstashSharedMocks.del;
  }
}

vi.mock('@upstash/redis', () => {
  return {
    Redis: MockUpstashRedis,
  };
});

// Export mocks for use in tests
export { mockStripeClient, upstashSharedMocks };

