# Migration Guide

Migrating from the raw Stripe SDK to this SDK? This guide will help you make the switch with minimal changes.

## Why Migrate?

The raw Stripe SDK requires a lot of boilerplate:

- 75+ lines for a simple checkout flow
- Manual error handling everywhere
- Webhook signature verification code
- State management for loading/error states
- Caching logic
- Type safety issues

This SDK reduces that to 5 lines while maintaining full type safety and adding automatic caching, error handling, and webhook security.

## Before & After Examples

### Checkout Flow

**Before (Raw Stripe SDK):**
```tsx
// ❌ 75+ lines of boilerplate
'use client';

import { useState } from 'react';
import Stripe from 'stripe';

export default function CheckoutPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);

  const handleCheckout = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          priceId: 'price_monthly',
          successUrl: `${window.location.origin}/success`,
          cancelUrl: `${window.location.origin}/cancel`,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Checkout failed');
      }

      const data = await response.json();
      setSessionId(data.sessionId);

      // Redirect to checkout
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (e) {
      const err = e instanceof Error ? e : new Error('Checkout failed');
      setError(err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div>
      <button onClick={handleCheckout} disabled={isLoading}>
        {isLoading ? 'Loading...' : 'Subscribe'}
      </button>
      {error && <p style={{ color: 'red' }}>{error.message}</p>}
    </div>
  );
}
```

**After (This SDK):**
```tsx
// ✅ 5 lines
'use client';

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

### API Route Handler

**Before (Raw Stripe SDK):**
```ts
// ❌ 50+ lines
import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-11-20.acacia',
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate request
    if (!body.priceId || typeof body.priceId !== 'string') {
      return NextResponse.json(
        { error: 'Invalid request', message: 'priceId is required' },
        { status: 400 }
      );
    }

    if (!body.successUrl || typeof body.successUrl !== 'string') {
      return NextResponse.json(
        { error: 'Invalid request', message: 'successUrl is required' },
        { status: 400 }
      );
    }

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      line_items: [{ price: body.priceId, quantity: body.quantity || 1 }],
      mode: body.mode || 'subscription',
      success_url: body.successUrl,
      cancel_url: body.cancelUrl,
      customer_email: body.customerEmail,
      customer: body.customerId,
      metadata: body.metadata,
    });

    return NextResponse.json({
      url: session.url,
      sessionId: session.id,
    });
  } catch (error) {
    if (error instanceof Stripe.errors.StripeError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode || 500 }
      );
    }
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

**After (This SDK):**
```ts
// ✅ 3 lines
import { createCheckoutHandler } from '@stripe-sdk/next';
import { stripe } from '@/lib/stripe';

const handler = createCheckoutHandler({ provider: stripe });
export { handler as POST };
```

### Webhook Handler

**Before (Raw Stripe SDK):**
```ts
// ❌ 100+ lines
import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-11-20.acacia',
});

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get('stripe-signature');

  if (!signature) {
    return NextResponse.json(
      { error: 'Missing signature' },
      { status: 401 }
    );
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (error) {
    console.error('Webhook signature verification failed:', error);
    return NextResponse.json(
      { error: 'Invalid signature' },
      { status: 401 }
    );
  }

  try {
    // Handle checkout.session.completed
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      
      // Fetch fresh data (don't trust event payload)
      const freshSession = await stripe.checkout.sessions.retrieve(session.id, {
        expand: ['customer', 'subscription'],
      });

      // Update database
      if (freshSession.metadata?.userId) {
        await db.users.update({
          where: { id: freshSession.metadata.userId },
          data: { subscribed: true },
        });
      }

      // Cache in KV
      await kv.set(`checkout:${freshSession.id}`, freshSession, 3600);
    }

    // Handle subscription.created
    if (event.type === 'customer.subscription.created') {
      const subscription = event.data.object as Stripe.Subscription;
      
      // Fetch fresh data
      const freshSubscription = await stripe.subscriptions.retrieve(subscription.id, {
        expand: ['customer'],
      });

      // Update database
      await db.subscriptions.create({
        data: {
          stripeSubscriptionId: freshSubscription.id,
          customerId: freshSubscription.customer as string,
          status: freshSubscription.status,
        },
      });

      // Cache in KV
      await kv.set(`subscription:${freshSubscription.id}`, freshSubscription, 3600);
    }

    // ... handle more event types

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Webhook handler error:', error);
    return NextResponse.json(
      { error: 'Handler failed' },
      { status: 500 }
    );
  }
}
```

**After (This SDK):**
```ts
// ✅ 15 lines
import { createWebhookHandler } from '@stripe-sdk/next';
import { stripe } from '@/lib/stripe';
import { upstashCache } from '@/lib/cache';

const handler = createWebhookHandler({
  provider: stripe,
  cache: upstashCache,
  handlers: {
    onCheckoutComplete: async (session) => {
      // Fresh data is already fetched and cached
      if (session.metadata?.userId) {
        await db.users.update({
          where: { id: session.metadata.userId },
          data: { subscribed: true },
        });
      }
    },
    onSubscriptionCreated: async (subscription) => {
      await db.subscriptions.create({
        data: {
          stripeSubscriptionId: subscription.id,
          customerId: subscription.customerId,
          status: subscription.status,
        },
      });
    },
  },
});

export { handler as POST };
```

## Step-by-Step Migration

### 1. Install the SDK

```bash
npm install @stripe-sdk/core @stripe-sdk/react @stripe-sdk/next @stripe-sdk/adapters
npm install @upstash/redis  # For production caching
```

### 2. Create Provider Instance

Replace your Stripe client initialization:

**Before:**
```ts
// lib/stripe.ts
import Stripe from 'stripe';

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-11-20.acacia',
});
```

**After:**
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

### 3. Wrap Your App

Add the PaymentProvider to your app:

```tsx
// app/layout.tsx
import { PaymentProvider } from '@stripe-sdk/react';
import { stripe } from '@/lib/stripe';

export default function RootLayout({ children }) {
  return (
    <PaymentProvider provider={stripe}>
      {children}
    </PaymentProvider>
  );
}
```

### 4. Replace Checkout Components

Replace manual checkout logic with `useCheckout`:

**Before:**
```tsx
const [isLoading, setIsLoading] = useState(false);
const [error, setError] = useState<Error | null>(null);

const handleCheckout = async () => {
  setIsLoading(true);
  try {
    const response = await fetch('/api/checkout', { ... });
    const data = await response.json();
    window.location.href = data.url;
  } catch (e) {
    setError(e);
  } finally {
    setIsLoading(false);
  }
};
```

**After:**
```tsx
const { checkout, isLoading, error } = useCheckout({
  priceId: 'price_monthly',
  successUrl: '/success',
  cancelUrl: '/cancel',
});
```

### 5. Replace API Routes

Replace manual API route handlers:

**Before:**
```ts
export async function POST(request: NextRequest) {
  // 50+ lines of validation, error handling, etc.
}
```

**After:**
```ts
import { createCheckoutHandler } from '@stripe-sdk/next';
import { stripe } from '@/lib/stripe';

const handler = createCheckoutHandler({ provider: stripe });
export { handler as POST };
```

### 6. Replace Webhook Handlers

Replace manual webhook processing:

**Before:**
```ts
export async function POST(request: NextRequest) {
  // 100+ lines of signature verification, event handling, etc.
}
```

**After:**
```ts
import { createWebhookHandler } from '@stripe-sdk/next';
import { stripe } from '@/lib/stripe';
import { upstashCache } from '@/lib/cache';

const handler = createWebhookHandler({
  provider: stripe,
  cache: upstashCache,
  handlers: {
    onCheckoutComplete: async (session) => {
      // Your logic here
    },
  },
});

export { handler as POST };
```

### 7. Replace Subscription Management

Replace manual subscription fetching with `useSubscription`:

**Before:**
```tsx
const [subscription, setSubscription] = useState(null);
const [isLoading, setIsLoading] = useState(false);

useEffect(() => {
  const fetchSubscription = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/subscription?customerId=${customerId}`);
      const data = await response.json();
      setSubscription(data.subscription);
    } catch (e) {
      // Handle error
    } finally {
      setIsLoading(false);
    }
  };
  fetchSubscription();
}, [customerId]);
```

**After:**
```tsx
const { subscription, isLoading, refresh } = useSubscription({
  customerId: 'cus_123',
});
```

## Common Patterns

### Fetching Subscription by User ID

**Before:**
```ts
// Manual lookup via metadata
const subscriptions = await stripe.subscriptions.list({
  customer: customerId,
  limit: 1,
});
const subscription = subscriptions.data[0];
```

**After:**
```tsx
// Automatic lookup via metadata
const { subscription } = useSubscription({
  userId: currentUser.id,  // Looks up via metadata.userId
});
```

### Error Handling

**Before:**
```ts
try {
  const session = await stripe.checkout.sessions.create({ ... });
} catch (error) {
  if (error instanceof Stripe.errors.StripeError) {
    // Handle Stripe error
  } else {
    // Handle other error
  }
}
```

**After:**
```tsx
const { checkout, error } = useCheckout({ ... });

// Error is automatically handled and available in the hook
if (error) {
  // Handle error
}
```

### Webhook Fresh Data Fetching

**Before:**
```ts
// Manual fresh data fetching
const session = event.data.object;
const freshSession = await stripe.checkout.sessions.retrieve(session.id);
```

**After:**
```ts
// Automatic fresh data fetching
onCheckoutComplete: async (session) => {
  // session is already fresh data from Stripe
  // No need to fetch again
}
```

## Breaking Changes

### API Response Format

The checkout handler returns a slightly different format:

**Before:**
```ts
{
  sessionId: string;
  url: string;
}
```

**After:**
```ts
{
  sessionId: string;  // Same
  url: string;        // Same
  session: CheckoutSession;  // New: Full session object
}
```

### Webhook Event Data

Webhook handlers receive fresh data objects, not raw Stripe objects:

**Before:**
```ts
const session = event.data.object as Stripe.Checkout.Session;
// Need to fetch fresh data manually
```

**After:**
```ts
onCheckoutComplete: async (session) => {
  // session is already fresh CheckoutSession (not Stripe.Checkout.Session)
  // No need to fetch again
}
```

## Benefits of Migration

1. **Less code** - 75 lines → 5 lines
2. **Type safety** - Full TypeScript support
3. **Automatic caching** - KV adapter handles caching
4. **Fresh data** - Webhooks always fetch latest from Stripe
5. **Error handling** - Built-in error classes and handling
6. **State management** - Hooks handle loading/error states
7. **Security** - Built-in webhook signature verification

## Need Help?

- Check the [API Reference](./api-reference.md) for all available APIs
- Read the [Getting Started](./getting-started.md) guide
- See [Webhooks](./webhooks.md) for webhook handling details

