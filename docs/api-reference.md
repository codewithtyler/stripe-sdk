# API Reference

Complete reference for all hooks, handlers, types, and adapters.

## Hooks

### `useCheckout`

Creates checkout sessions with automatic redirect handling.

**Signature:**
```ts
function useCheckout(options?: UseCheckoutOptions): UseCheckoutReturn
```

**Options:**
```ts
interface UseCheckoutOptions extends Partial<CheckoutOptions> {
  endpoint?: string;                    // API endpoint (default: '/api/checkout')
  onSuccess?: (session: CheckoutSession) => void;
  onError?: (error: Error) => void;
}
```

**Returns:**
```ts
interface UseCheckoutReturn {
  checkout: (options?: Partial<CheckoutOptions>) => Promise<void>;
  isLoading: boolean;
  error: Error | null;
  session: CheckoutSession | null;
  reset: () => void;
}
```

**Example:**
```tsx
const { checkout, isLoading, error } = useCheckout({
  priceId: 'price_123',
  successUrl: '/success',
  cancelUrl: '/cancel',
  customerEmail: 'user@example.com',
  metadata: { userId: 'user_123' },
  mode: 'subscription',
  trialDays: 7,
  onSuccess: (session) => {
    console.log('Checkout started:', session.id);
  },
});

// Override options at call time
await checkout({ priceId: 'price_456' });
```

**CheckoutOptions:**
```ts
interface CheckoutOptions {
  priceId: string;                      // Required: Stripe Price ID
  successUrl: string;                   // Required: Redirect after success
  cancelUrl: string;                    // Required: Redirect after cancel
  customerEmail?: string;               // Optional: Create customer with email
  customerId?: string;                  // Optional: Use existing customer
  metadata?: Record<string, string>;    // Optional: Attach metadata
  mode?: 'payment' | 'subscription' | 'setup';  // Default: 'subscription'
  quantity?: number;                     // Default: 1
  trialDays?: number;                   // Optional: Trial period (subscription only)
}
```

---

### `useSubscription`

Manages subscriptions with automatic KV caching and refresh.

**Signature:**
```ts
function useSubscription(options?: UseSubscriptionOptions): UseSubscriptionReturn
```

**Options:**
```ts
interface UseSubscriptionOptions {
  customerId?: string;                  // Customer ID to fetch subscription for
  userId?: string;                      // User ID (looks up via metadata)
  fetchEndpoint?: string;               // Default: '/api/subscription'
  refreshEndpoint?: string;             // Default: '/api/subscription/refresh'
  cancelEndpoint?: string;              // Default: '/api/subscription/cancel'
  portalEndpoint?: string;              // Default: '/api/portal'
  onLoad?: (subscription: Subscription | null) => void;
  onRefresh?: (subscription: Subscription) => void;
  onError?: (error: Error) => void;
}
```

**Returns:**
```ts
interface UseSubscriptionReturn {
  subscription: Subscription | null;
  isLoading: boolean;
  error: Error | null;
  cancel: () => Promise<void>;
  openPortal: (returnUrl: string) => Promise<void>;
  refresh: () => Promise<void>;
}
```

**Example:**
```tsx
const { subscription, isLoading, refresh, cancel, openPortal } = useSubscription({
  customerId: 'cus_123',
  // or userId: 'user_123',  // if you store userId in metadata
  onLoad: (sub) => {
    if (sub) {
      console.log('Subscription status:', sub.status);
    }
  },
  onRefresh: (sub) => {
    console.log('Refreshed:', sub);
  },
});

// Refresh from Stripe and update KV
await refresh();

// Cancel subscription
await cancel();

// Open billing portal
await openPortal('/dashboard');
```

**Subscription:**
```ts
interface Subscription {
  id: string;
  customerId: string;
  status: SubscriptionState;
  currentPeriodEnd: Date;
  currentPeriodStart: Date;
  cancelAtPeriodEnd: boolean;
  items: SubscriptionItem[];
  metadata?: Record<string, string>;
  createdAt?: Date;
}

type SubscriptionState =
  | 'active'
  | 'past_due'
  | 'canceled'
  | 'incomplete'
  | 'incomplete_expired'
  | 'trialing'
  | 'unpaid'
  | 'paused';
```

---

### `useCustomer`

Fetches customer data with automatic caching.

**Signature:**
```ts
function useCustomer(options?: UseCustomerOptions): UseCustomerReturn
```

**Options:**
```ts
interface UseCustomerOptions {
  customerId?: string;                  // Customer ID to fetch
  email?: string;                       // Customer email (alternative lookup)
  userId?: string;                      // User ID (looks up via metadata)
  fetchEndpoint?: string;               // Default: '/api/customer'
  onLoad?: (customer: Customer | null) => void;
  onRefresh?: (customer: Customer) => void;
  onError?: (error: Error) => void;
}
```

**Returns:**
```ts
interface UseCustomerReturn {
  customer: Customer | null;
  isLoading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}
```

**Example:**
```tsx
const { customer, isLoading, refresh } = useCustomer({
  customerId: 'cus_123',
  // or email: 'user@example.com',
  // or userId: 'user_123',
  onLoad: (customer) => {
    if (customer) {
      console.log('Customer:', customer.email);
    }
  },
});

// Refresh customer data
await refresh();
```

**Customer:**
```ts
interface Customer {
  id: string;
  email: string;
  name?: string;
  metadata?: Record<string, string>;
  createdAt?: Date;
}
```

---

## Next.js Handlers

### `createCheckoutHandler`

Creates a Next.js API route handler for checkout session creation.

**Signature:**
```ts
function createCheckoutHandler(
  options: CreateCheckoutHandlerOptions
): (request: NextRequest) => Promise<NextResponse>
```

**Options:**
```ts
interface CreateCheckoutHandlerOptions {
  provider: PaymentProvider;           // Required: Provider instance
  cache?: KVAdapter;                    // Optional: Additional caching
}
```

**Example:**
```ts
// app/api/checkout/route.ts
import { createCheckoutHandler } from '@stripe-sdk/next';
import { stripe } from '@/lib/stripe';

const handler = createCheckoutHandler({ provider: stripe });
export { handler as POST };
```

**Request Body:**
```ts
interface CreateCheckoutRequest {
  priceId: string;
  successUrl: string;
  cancelUrl: string;
  customerEmail?: string;
  customerId?: string;
  metadata?: Record<string, string>;
  mode?: 'payment' | 'subscription' | 'setup';
  quantity?: number;
  trialDays?: number;
}
```

**Response:**
```ts
interface CreateCheckoutResponse {
  url: string;                          // Checkout session URL
  sessionId: string;                   // Checkout session ID
}
```

---

### `createWebhookHandler`

Creates a Next.js API route handler for Stripe webhooks.

**Signature:**
```ts
function createWebhookHandler(
  options: CreateWebhookHandlerOptions
): (request: NextRequest) => Promise<NextResponse>
```

**Options:**
```ts
interface CreateWebhookHandlerOptions {
  provider: PaymentProvider;           // Required: Provider instance
  cache: KVAdapter;                     // Required: KV adapter for caching
  sync?: SyncAdapter;                   // Optional: Sync adapter for real-time updates
  handlers?: WebhookEventHandlers;      // Optional: Custom event handlers
}
```

**Event Handlers:**
```ts
interface WebhookEventHandlers {
  onCheckoutComplete?: (session: CheckoutSession) => Promise<void>;
  onSubscriptionCreated?: (subscription: Subscription) => Promise<void>;
  onSubscriptionUpdated?: (subscription: Subscription) => Promise<void>;
  onSubscriptionCanceled?: (subscription: Subscription) => Promise<void>;
}
```

**Example:**
```ts
// app/api/webhook/route.ts
import { createWebhookHandler } from '@stripe-sdk/next';
import { stripe } from '@/lib/stripe';
import { upstashCache } from '@/lib/cache';

const handler = createWebhookHandler({
  provider: stripe,
  cache: upstashCache,
  handlers: {
    onCheckoutComplete: async (session) => {
      // This runs AFTER the webhook fetches fresh data from Stripe
      // and updates the KV cache
      console.log('Checkout completed:', session.id);
      
      // Update your database
      if (session.metadata?.userId) {
        await db.users.update({
          where: { id: session.metadata.userId },
          data: { subscribed: true },
        });
      }
    },
    onSubscriptionCreated: async (subscription) => {
      console.log('Subscription created:', subscription.id);
    },
  },
});

export { handler as POST };
```

**Important:** The webhook handler always fetches fresh data from Stripe before calling your handlers. This follows Theo's lesson: never trust the event payload, always fetch the latest state.

---

### `createPortalHandler`

Creates a Next.js API route handler for billing portal sessions.

**Signature:**
```ts
function createPortalHandler(
  options: CreatePortalHandlerOptions
): (request: NextRequest) => Promise<NextResponse>
```

**Options:**
```ts
interface CreatePortalHandlerOptions {
  provider: PaymentProvider;           // Required: Provider instance
}
```

**Example:**
```ts
// app/api/portal/route.ts
import { createPortalHandler } from '@stripe-sdk/next';
import { stripe } from '@/lib/stripe';

const handler = createPortalHandler({ provider: stripe });
export { handler as POST };
```

**Request Body:**
```ts
interface CreatePortalRequest {
  customerId: string;                  // Required: Customer ID
  returnUrl: string;                    // Required: Redirect after portal
}
```

**Response:**
```ts
interface CreatePortalResponse {
  url: string;                          // Portal session URL
}
```

---

## Core Provider

### `createStripeProvider`

Creates a Stripe payment provider instance.

**Signature:**
```ts
function createStripeProvider(
  options: CreateStripeProviderOptions
): PaymentProvider
```

**Options:**
```ts
interface CreateStripeProviderOptions {
  cache: KVAdapter;                     // Required: KV adapter for caching
  sync?: SyncAdapter;                   // Optional: Sync adapter for real-time updates
  config?: Partial<StripeConfig>;       // Optional: Config overrides
}
```

**Example:**
```ts
import { createStripeProvider } from '@stripe-sdk/core';
import { createUpstashAdapter } from '@stripe-sdk/adapters';

const cache = createUpstashAdapter({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

const provider = createStripeProvider({
  cache,
  sync: {
    onCustomerCreated: async (customer) => {
      await syncToDatabase(customer);
    },
  },
});
```

**PaymentProvider Interface:**
```ts
interface PaymentProvider {
  readonly name: string;
  createCheckout(options: CheckoutOptions): Promise<CheckoutSession>;
  createSubscription(options: SubscriptionOptions): Promise<Subscription>;
  createCustomer(data: CustomerData): Promise<Customer>;
  verifyWebhook(payload: string, signature: string): WebhookEvent;
  createPortalSession(customerId: string, returnUrl: string): Promise<PortalSession>;
}
```

---

## Adapters

### `createMemoryAdapter`

Creates an in-memory KV adapter for development and testing.

**Signature:**
```ts
function createMemoryAdapter(): KVAdapter
```

**Example:**
```ts
import { createMemoryAdapter } from '@stripe-sdk/adapters';

const cache = createMemoryAdapter();
await cache.set('key', 'value', 60); // TTL: 60 seconds
const value = await cache.get('key');
```

**Note:** Data is lost on server restart. Use for development only.

---

### `createUpstashAdapter`

Creates an Upstash Redis KV adapter for production.

**Signature:**
```ts
function createUpstashAdapter(
  config: UpstashAdapterConfig
): KVAdapter
```

**Config:**
```ts
interface UpstashAdapterConfig {
  url: string;                          // Upstash Redis REST API URL
  token: string;                        // Upstash Redis REST API token
}
```

**Example:**
```ts
import { createUpstashAdapter } from '@stripe-sdk/adapters';

const cache = createUpstashAdapter({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

await cache.set('customer:user123', customerData, 86400); // 24 hours
const customer = await cache.get<Customer>('customer:user123');
```

**KVAdapter Interface:**
```ts
interface KVAdapter {
  get<T = unknown>(key: string): Promise<T | null>;
  set<T = unknown>(key: string, value: T, ttlSeconds?: number): Promise<void>;
  delete(key: string): Promise<void>;
}
```

---

### Sync Adapter

Sync adapters allow you to sync data changes to your database in real-time.

**Interface:**
```ts
interface SyncAdapter {
  onCustomerCreated?: (customer: Customer) => Promise<void>;
  onSubscriptionUpdated?: (subscription: Subscription) => Promise<void>;
  onSubscriptionCanceled?: (subscription: Subscription) => Promise<void>;
}
```

**Example:**
```ts
const sync = {
  onCustomerCreated: async (customer) => {
    await db.customers.create({
      stripe_customer_id: customer.id,
      email: customer.email,
      name: customer.name,
    });
  },
  onSubscriptionUpdated: async (subscription) => {
    await db.subscriptions.upsert({
      where: { stripe_subscription_id: subscription.id },
      update: {
        status: subscription.status,
        current_period_end: subscription.currentPeriodEnd,
      },
      create: {
        stripe_subscription_id: subscription.id,
        customer_id: subscription.customerId,
        status: subscription.status,
      },
    });
  },
  onSubscriptionCanceled: async (subscription) => {
    await db.subscriptions.update({
      where: { stripe_subscription_id: subscription.id },
      data: { status: 'canceled' },
    });
  },
};

const provider = createStripeProvider({ cache, sync });
```

---

## Error Types

### `PaymentError`

Thrown when payment operations fail.

```ts
class PaymentError extends Error {
  code: string;                         // Error code (e.g., 'PAYMENT_FAILED')
  statusCode: number;                   // HTTP status code (e.g., 500)
}
```

**Error Codes:**
- `PAYMENT_FAILED` - Payment processing failed
- `CUSTOMER_NOT_FOUND` - Customer not found
- `INVALID_REQUEST` - Invalid request parameters

---

### `WebhookError`

Thrown when webhook verification fails.

```ts
class WebhookError extends Error {
  code: string;                         // Error code
}
```

**Error Codes:**
- `WEBHOOK_SIGNATURE_INVALID` - Webhook signature verification failed

---

### `ConfigError`

Thrown when configuration is missing or invalid.

```ts
class ConfigError extends Error {}
```

---

## React Components

### `PaymentProvider`

Provides payment provider context to child components.

**Props:**
```ts
interface PaymentProviderProps {
  provider: PaymentProvider;           // Required: Provider instance
  children: ReactNode;                  // Required: Child components
}
```

**Example:**
```tsx
import { PaymentProvider } from '@stripe-sdk/react';
import { stripe } from '@/lib/stripe';

function App() {
  return (
    <PaymentProvider provider={stripe}>
      <YourApp />
    </PaymentProvider>
  );
}
```

---

## Type Definitions

### `CheckoutSession`

```ts
interface CheckoutSession {
  id: string;
  url: string;
  status: 'open' | 'complete' | 'expired';
  customerId?: string;
  metadata?: Record<string, string>;
  createdAt?: Date;
}
```

### `Subscription`

See `useSubscription` section above.

### `Customer`

See `useCustomer` section above.

### `PortalSession`

```ts
interface PortalSession {
  url: string;
}
```

### `WebhookEvent`

```ts
interface WebhookEvent {
  id: string;
  type: string;
  data: unknown;
  created: Date;
}
```

---

## Common Patterns

### Fetching Subscription by User ID

If you store `userId` in subscription metadata:

```tsx
const { subscription } = useSubscription({
  userId: currentUser.id,  // Looks up via metadata.userId
});
```

### Custom Error Handling

```tsx
const { checkout, error } = useCheckout({
  priceId: 'price_123',
  successUrl: '/success',
  cancelUrl: '/cancel',
  onError: (error) => {
    if (error.message.includes('card')) {
      // Handle card error
    } else {
      // Handle other errors
    }
  },
});
```

### Conditional Checkout

```tsx
const { checkout, isLoading } = useCheckout();

const handleCheckout = async () => {
  if (user.isPremium) {
    // Upgrade flow
    await checkout({ priceId: 'price_premium' });
  } else {
    // New subscription
    await checkout({ priceId: 'price_basic' });
  }
};
```

