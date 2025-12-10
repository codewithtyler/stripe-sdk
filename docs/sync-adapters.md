# Sync Adapters

Sync adapters solve a critical problem: keeping your database in sync with Stripe without polling or complex webhook logic.

## The Problem

When a customer subscribes, you need to:
1. Store the subscription in your database
2. Update user permissions
3. Send welcome emails
4. Update analytics
5. Cache in KV for fast lookups

Doing this in webhook handlers works, but it's verbose and error-prone. Sync adapters provide a clean, type-safe way to handle these updates.

## KV vs Sync: Why Both?

### KV Adapter (Required)

The KV adapter caches Stripe data for fast lookups. It's used by:
- `useSubscription` hook to fetch subscription state
- `useCustomer` hook to fetch customer data
- Webhook handler to cache fresh data after events

**Example:**
```ts
const cache = createUpstashAdapter({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

// Automatically caches:
// - checkout:session_id → CheckoutSession
// - subscription:sub_id → Subscription
// - customer:cus_id → Customer
// - customer:email:user@example.com → Customer
// - customer:userId:user_123 → Customer ID
```

### Sync Adapter (Optional)

The sync adapter keeps your database in sync with Stripe. It's called automatically when:
- A customer is created
- A subscription is created or updated
- A subscription is canceled

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
};

const provider = createStripeProvider({ cache, sync });
```

## How Sync Adapters Work

Sync adapters are called automatically by the webhook handler **after** fetching fresh data from Stripe and updating the KV cache. Here's the flow:

1. **Webhook received** → Stripe sends event
2. **Signature verified** → Webhook handler verifies signature
3. **Fresh data fetched** → Handler fetches latest data from Stripe (don't trust event payload)
4. **KV cache updated** → Latest data is cached
5. **Sync adapter called** → Your sync adapter updates your database
6. **User handlers called** → Your custom event handlers run

**Important:** Sync adapters receive the same fresh data that was just fetched from Stripe, so you can trust it's accurate.

## Complete Example

Here's a full setup with Prisma:

```ts
// lib/stripe.ts
import { createStripeProvider } from '@stripe-sdk/core';
import { createUpstashAdapter } from '@stripe-sdk/adapters';
import { prisma } from './prisma';

const cache = createUpstashAdapter({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

const sync = {
  onCustomerCreated: async (customer) => {
    // Create customer in database
    await prisma.customer.upsert({
      where: { stripe_customer_id: customer.id },
      update: {
        email: customer.email,
        name: customer.name,
        metadata: customer.metadata,
      },
      create: {
        stripe_customer_id: customer.id,
        email: customer.email,
        name: customer.name,
        metadata: customer.metadata,
        // Link to user if userId is in metadata
        userId: customer.metadata?.userId,
      },
    });
  },

  onSubscriptionUpdated: async (subscription) => {
    // Update subscription in database
    await prisma.subscription.upsert({
      where: { stripe_subscription_id: subscription.id },
      update: {
        status: subscription.status,
        current_period_end: subscription.currentPeriodEnd,
        current_period_start: subscription.currentPeriodStart,
        cancel_at_period_end: subscription.cancelAtPeriodEnd,
      },
      create: {
        stripe_subscription_id: subscription.id,
        customer_id: subscription.customerId,
        status: subscription.status,
        current_period_end: subscription.currentPeriodEnd,
        current_period_start: subscription.currentPeriodStart,
        cancel_at_period_end: subscription.cancelAtPeriodEnd,
      },
    });

    // Update user permissions based on subscription status
    if (subscription.status === 'active') {
      const customer = await prisma.customer.findUnique({
        where: { stripe_customer_id: subscription.customerId },
      });
      
      if (customer?.userId) {
        await prisma.user.update({
          where: { id: customer.userId },
          data: { isPremium: true },
        });
      }
    }
  },

  onSubscriptionCanceled: async (subscription) => {
    // Mark subscription as canceled
    await prisma.subscription.update({
      where: { stripe_subscription_id: subscription.id },
      data: { status: 'canceled' },
    });

    // Revoke user permissions
    const customer = await prisma.customer.findUnique({
      where: { stripe_customer_id: subscription.customerId },
    });
    
    if (customer?.userId) {
      await prisma.user.update({
        where: { id: customer.userId },
        data: { isPremium: false },
      });
    }
  },
};

export const stripe = createStripeProvider({ cache, sync });
```

## Supabase Example

```ts
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const sync = {
  onCustomerCreated: async (customer) => {
    await supabase.from('customers').upsert({
      stripe_customer_id: customer.id,
      email: customer.email,
      name: customer.name,
      metadata: customer.metadata,
      user_id: customer.metadata?.userId,
    });
  },

  onSubscriptionUpdated: async (subscription) => {
    await supabase.from('subscriptions').upsert({
      stripe_subscription_id: subscription.id,
      customer_id: subscription.customerId,
      status: subscription.status,
      current_period_end: subscription.currentPeriodEnd.toISOString(),
      current_period_start: subscription.currentPeriodStart.toISOString(),
      cancel_at_period_end: subscription.cancelAtPeriodEnd,
    });
  },

  onSubscriptionCanceled: async (subscription) => {
    await supabase.from('subscriptions').update({
      status: 'canceled',
    }).eq('stripe_subscription_id', subscription.id);
  },
};
```

## Drizzle Example

```ts
import { db } from './drizzle';
import { customers, subscriptions } from './schema';

const sync = {
  onCustomerCreated: async (customer) => {
    await db.insert(customers).values({
      stripeCustomerId: customer.id,
      email: customer.email,
      name: customer.name,
      metadata: customer.metadata,
      userId: customer.metadata?.userId,
    }).onConflictDoUpdate({
      target: customers.stripeCustomerId,
      set: {
        email: customer.email,
        name: customer.name,
        metadata: customer.metadata,
      },
    });
  },

  onSubscriptionUpdated: async (subscription) => {
    await db.insert(subscriptions).values({
      stripeSubscriptionId: subscription.id,
      customerId: subscription.customerId,
      status: subscription.status,
      currentPeriodEnd: subscription.currentPeriodEnd,
      currentPeriodStart: subscription.currentPeriodStart,
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
    }).onConflictDoUpdate({
      target: subscriptions.stripeSubscriptionId,
      set: {
        status: subscription.status,
        currentPeriodEnd: subscription.currentPeriodEnd,
        currentPeriodStart: subscription.currentPeriodStart,
        cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
      },
    });
  },
};
```

## Error Handling

Sync adapters should handle their own errors. If a sync adapter throws, the webhook handler will:
1. Log the error
2. Still return 200 to Stripe (to prevent retries)
3. Continue processing other handlers

**Best practice:** Wrap sync adapter calls in try/catch:

```ts
const sync = {
  onSubscriptionUpdated: async (subscription) => {
    try {
      await db.subscriptions.upsert({ ... });
    } catch (error) {
      // Log to error tracking service
      console.error('Sync failed:', error);
      // Optionally retry or queue for later
    }
  },
};
```

## Coming Soon

We're working on official adapters for:
- **Supabase** - Direct Supabase integration
- **Prisma** - Prisma client wrapper
- **Drizzle** - Drizzle ORM integration

These will provide even simpler setup:

```ts
import { createSupabaseSyncAdapter } from '@stripe-sdk/adapters-supabase';

const sync = createSupabaseSyncAdapter({
  supabaseUrl: process.env.SUPABASE_URL!,
  supabaseKey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
});
```

## When to Use Sync Adapters

**Use sync adapters when:**
- You need to keep your database in sync with Stripe
- You want to update user permissions automatically
- You need to trigger side effects (emails, analytics, etc.)

**Don't use sync adapters when:**
- You only need KV caching (use KV adapter alone)
- You handle all updates in webhook handlers manually
- You're using a serverless function that can't access your database

## Performance

Sync adapters run asynchronously and don't block the webhook response. The webhook handler:
1. Updates KV cache (fast)
2. Calls sync adapter (async, non-blocking)
3. Returns 200 immediately

This ensures Stripe receives a quick response while your database updates happen in the background.

