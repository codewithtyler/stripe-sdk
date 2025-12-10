# Stripe SDK

A dead simple Stripe SDK that solves Stripe's developer experience problems. Built following Vercel AI SDK patterns, this SDK reduces verbose Stripe API calls to clean, type-safe hooks and handlers. What used to take 75 lines of boilerplate now takes 5.

## The Problem

Working with Stripe directly means dealing with verbose API calls, manual error handling, webhook signature verification, state management, and caching. Theo's pain is real—you end up writing the same boilerplate over and over again.

**Before (75 lines):**
```tsx
// Create checkout session
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
const session = await stripe.checkout.sessions.create({
  line_items: [{ price: 'price_123', quantity: 1 }],
  mode: 'subscription',
  success_url: `${origin}/success`,
  cancel_url: `${origin}/cancel`,
  customer_email: user.email,
  metadata: { userId: user.id },
});

// Handle webhook
const sig = req.headers['stripe-signature'];
const event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
if (event.type === 'checkout.session.completed') {
  const session = event.data.object;
  // Fetch fresh data from Stripe (don't trust event payload)
  const freshSession = await stripe.checkout.sessions.retrieve(session.id);
  // Update database
  await db.subscriptions.create({ ... });
  // Cache in KV
  await kv.set(`subscription:${userId}`, freshSession);
}
// ... 60 more lines of boilerplate
```

**After (5 lines):**
```tsx
const { checkout, isLoading } = useCheckout({
  priceId: 'price_123',
  successUrl: '/success',
  cancelUrl: '/cancel',
});
```

## Installation

```bash
npm install @stripe-sdk/core @stripe-sdk/react @stripe-sdk/next @stripe-sdk/adapters
```

## Quick Start

1. **Set up your provider** (server-side):

```ts
// lib/stripe.ts
import { createStripeProvider } from '@stripe-sdk/core';
import { createUpstashAdapter } from '@stripe-sdk/adapters';

export const stripe = createStripeProvider({
  cache: createUpstashAdapter({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  }),
});
```

2. **Wrap your app** (client-side):

```tsx
// app/layout.tsx
import { PaymentProvider } from '@stripe-sdk/react';
import { stripe } from './lib/stripe';

export default function RootLayout({ children }) {
  return (
    <PaymentProvider provider={stripe}>
      {children}
    </PaymentProvider>
  );
}
```

3. **Use the hook**:

```tsx
// app/checkout/page.tsx
import { useCheckout } from '@stripe-sdk/react';

export default function CheckoutPage() {
  const { checkout, isLoading, error } = useCheckout({
    priceId: 'price_monthly',
    successUrl: '/success',
    cancelUrl: '/cancel',
  });

  return (
    <button onClick={() => checkout()} disabled={isLoading}>
      {isLoading ? 'Loading...' : 'Subscribe'}
    </button>
  );
}
```

That's it. No manual state management, no error handling boilerplate, no webhook verification code.

## Hooks

### `useCheckout`

Create checkout sessions with automatic redirect handling.

```tsx
const { checkout, isLoading, error, session } = useCheckout({
  priceId: 'price_123',
  successUrl: '/success',
  cancelUrl: '/cancel',
  customerEmail: 'user@example.com',
  metadata: { userId: 'user_123' },
  mode: 'subscription',
  onSuccess: (session) => console.log('Started:', session.id),
  onError: (error) => console.error('Failed:', error),
});

// Call it
await checkout();
```

### `useSubscription`

Manage subscriptions with automatic KV caching and refresh.

```tsx
const { subscription, isLoading, refresh, cancel, openPortal } = useSubscription({
  customerId: 'cus_123',
  // or userId: 'user_123', // if you store userId in metadata
  onLoad: (sub) => console.log('Loaded:', sub),
  onRefresh: (sub) => console.log('Refreshed:', sub),
});

// Refresh from Stripe and update KV
await refresh();

// Cancel subscription
await cancel();

// Open billing portal
await openPortal('/dashboard');
```

### `useCustomer`

Fetch customer data with automatic caching.

```tsx
const { customer, isLoading, refresh } = useCustomer({
  customerId: 'cus_123',
  // or email: 'user@example.com',
  // or userId: 'user_123',
  onLoad: (customer) => console.log('Loaded:', customer),
});
```

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `STRIPE_SECRET_KEY` | Stripe secret API key (starts with `sk_`) | Yes |
| `STRIPE_WEBHOOK_SECRET` | Webhook signing secret (starts with `whsec_`) | For webhooks |
| `UPSTASH_REDIS_REST_URL` | Upstash Redis REST API URL | For Upstash adapter |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis REST API token | For Upstash adapter |

## Next.js API Routes

### Checkout Handler

```ts
// app/api/checkout/route.ts
import { createCheckoutHandler } from '@stripe-sdk/next';
import { stripe } from '@/lib/stripe';

const handler = createCheckoutHandler({ provider: stripe });
export { handler as POST };
```

### Webhook Handler

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
      // Update your database
      await db.users.update({
        where: { id: session.metadata?.userId },
        data: { subscribed: true },
      });
    },
    onSubscriptionCreated: async (subscription) => {
      console.log('New subscription:', subscription.id);
    },
  },
});

export { handler as POST };
```

### Portal Handler

```ts
// app/api/portal/route.ts
import { createPortalHandler } from '@stripe-sdk/next';
import { stripe } from '@/lib/stripe';

const handler = createPortalHandler({ provider: stripe });
export { handler as POST };
```

## Adapters

### Memory Adapter (Development)

```ts
import { createMemoryAdapter } from '@stripe-sdk/adapters';

const cache = createMemoryAdapter();
```

### Upstash Adapter (Production)

```ts
import { createUpstashAdapter } from '@stripe-sdk/adapters';

const cache = createUpstashAdapter({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});
```

## Documentation

- **[Getting Started](./docs/getting-started.md)** - Complete setup guide
- **[API Reference](./docs/api-reference.md)** - All hooks, handlers, and types
- **[Webhooks](./docs/webhooks.md)** - Webhook handling guide
- **[Sync Adapters](./docs/sync-adapters.md)** - KV + sync pattern explained
- **[Migration Guide](./docs/migration.md)** - Migrating from raw Stripe SDK

## Features

- ✅ **Type-safe** - Full TypeScript support with proper generics
- ✅ **Zero boilerplate** - Hooks handle state, errors, and loading
- ✅ **Automatic caching** - KV adapter caches customers and subscriptions
- ✅ **Fresh data fetching** - Webhooks always fetch latest from Stripe (per Theo's lesson)
- ✅ **Signature verification** - Built-in webhook security
- ✅ **Error handling** - Proper error classes with status codes
- ✅ **Provider pattern** - Easy to swap providers (future: Paddle, LemonSqueezy)

## License

MIT
