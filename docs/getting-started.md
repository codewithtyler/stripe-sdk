# Getting Started

This guide will walk you through setting up the Stripe SDK in a Next.js application. We'll build a complete checkout flow from scratch.

## Prerequisites

- Node.js 18+ and npm/yarn/pnpm
- A Stripe account (test mode is fine)
- A Next.js 15+ project (or create one with `npx create-next-app@latest`)

## Step 1: Install Dependencies

```bash
npm install @stripe-sdk/core @stripe-sdk/react @stripe-sdk/next @stripe-sdk/adapters
npm install @upstash/redis  # For production caching
```

## Step 2: Set Up Environment Variables

Create a `.env.local` file in your project root:

```env
# Stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Upstash Redis (optional for production)
UPSTASH_REDIS_REST_URL=https://...
UPSTASH_REDIS_REST_TOKEN=...
```

**Getting your Stripe keys:**

1. Go to [Stripe Dashboard](https://dashboard.stripe.com/test/apikeys)
2. Copy your **Secret key** (starts with `sk_test_`)
3. For webhooks, you'll get the secret when setting up the webhook endpoint

## Step 3: Create Stripe Provider

Create a server-side provider instance:

```ts
// lib/stripe.ts
import { createStripeProvider } from '@stripe-sdk/core';
import { createUpstashAdapter } from '@stripe-sdk/adapters';

// For production, use Upstash
const cache = createUpstashAdapter({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

// For development, use memory adapter
// import { createMemoryAdapter } from '@stripe-sdk/adapters';
// const cache = createMemoryAdapter();

export const stripe = createStripeProvider({
  cache,
});
```

## Step 4: Set Up React Provider

Wrap your app with the PaymentProvider:

```tsx
// app/layout.tsx (or pages/_app.tsx for Pages Router)
import { PaymentProvider } from '@stripe-sdk/react';
import { stripe } from '@/lib/stripe';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <PaymentProvider provider={stripe}>
          {children}
        </PaymentProvider>
      </body>
    </html>
  );
}
```

**Note:** The provider instance is created server-side, but you can pass it to the client component. The SDK handles the serialization.

## Step 5: Create Checkout Page

Create a checkout page that uses the `useCheckout` hook:

```tsx
// app/checkout/page.tsx
'use client';

import { useCheckout } from '@stripe-sdk/react';
import { useState } from 'react';

export default function CheckoutPage() {
  const [priceId, setPriceId] = useState('price_monthly');

  const { checkout, isLoading, error } = useCheckout({
    priceId,
    successUrl: `${window.location.origin}/success`,
    cancelUrl: `${window.location.origin}/cancel`,
    mode: 'subscription',
    onSuccess: (session) => {
      console.log('Checkout started:', session.id);
    },
    onError: (error) => {
      console.error('Checkout failed:', error);
    },
  });

  return (
    <div>
      <h1>Choose Your Plan</h1>
      
      <select value={priceId} onChange={(e) => setPriceId(e.target.value)}>
        <option value="price_monthly">Monthly - $10/month</option>
        <option value="price_yearly">Yearly - $100/year</option>
      </select>

      <button 
        onClick={() => checkout()} 
        disabled={isLoading}
      >
        {isLoading ? 'Loading...' : 'Subscribe'}
      </button>

      {error && <p style={{ color: 'red' }}>{error.message}</p>}
    </div>
  );
}
```

## Step 6: Create API Route for Checkout

The hook calls an API endpoint. Create it:

```ts
// app/api/checkout/route.ts
import { createCheckoutHandler } from '@stripe-sdk/next';
import { stripe } from '@/lib/stripe';

const handler = createCheckoutHandler({ provider: stripe });
export { handler as POST };
```

That's it! The handler validates the request, creates the checkout session, and returns the URL.

## Step 7: Create Success/Cancel Pages

```tsx
// app/success/page.tsx
export default function SuccessPage() {
  return (
    <div>
      <h1>Payment Successful!</h1>
      <p>Thank you for subscribing.</p>
    </div>
  );
}
```

```tsx
// app/cancel/page.tsx
export default function CancelPage() {
  return (
    <div>
      <h1>Payment Canceled</h1>
      <p>You can try again anytime.</p>
    </div>
  );
}
```

## Step 8: Set Up Webhook Handler

Webhooks are crucial for keeping your database in sync. Create a webhook endpoint:

```ts
// app/api/webhook/route.ts
import { createWebhookHandler } from '@stripe-sdk/next';
import { stripe } from '@/lib/stripe';
import { createUpstashAdapter } from '@stripe-sdk/adapters';

const cache = createUpstashAdapter({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

const handler = createWebhookHandler({
  provider: stripe,
  cache,
  handlers: {
    onCheckoutComplete: async (session) => {
      // This runs after the webhook fetches fresh data from Stripe
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
    onSubscriptionUpdated: async (subscription) => {
      console.log('Subscription updated:', subscription.id);
    },
    onSubscriptionCanceled: async (subscription) => {
      console.log('Subscription canceled:', subscription.id);
    },
  },
});

export { handler as POST };
```

## Step 9: Configure Stripe Webhook

1. **Local development** (using Stripe CLI):

```bash
# Install Stripe CLI
brew install stripe/stripe-cli/stripe

# Login
stripe login

# Forward webhooks to local server
stripe listen --forward-to localhost:3000/api/webhook
```

The CLI will output a webhook signing secret. Add it to your `.env.local`:

```env
STRIPE_WEBHOOK_SECRET=whsec_...
```

2. **Production** (using Stripe Dashboard):

1. Go to [Stripe Dashboard > Webhooks](https://dashboard.stripe.com/test/webhooks)
2. Click "Add endpoint"
3. Enter your production URL: `https://yourdomain.com/api/webhook`
4. Select events to listen to:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
5. Copy the webhook signing secret to your environment variables

## Step 10: Test the Flow

1. Start your dev server: `npm run dev`
2. Visit `http://localhost:3000/checkout`
3. Click "Subscribe"
4. Use Stripe test card: `4242 4242 4242 4242`
5. Complete the checkout
6. Check your webhook logs to see the events

## Supabase Example

If you're using Supabase, here's how to sync customer data:

```ts
// lib/stripe.ts
import { createStripeProvider } from '@stripe-sdk/core';
import { createUpstashAdapter } from '@stripe-sdk/adapters';
import { createClient } from '@supabase/supabase-js';

const cache = createUpstashAdapter({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Sync adapter to keep Supabase in sync
const sync = {
  onCustomerCreated: async (customer) => {
    await supabase.from('customers').upsert({
      stripe_customer_id: customer.id,
      email: customer.email,
      name: customer.name,
      metadata: customer.metadata,
    });
  },
  onSubscriptionUpdated: async (subscription) => {
    await supabase.from('subscriptions').upsert({
      stripe_subscription_id: subscription.id,
      customer_id: subscription.customerId,
      status: subscription.status,
      current_period_end: subscription.currentPeriodEnd.toISOString(),
    });
  },
  onSubscriptionCanceled: async (subscription) => {
    await supabase.from('subscriptions').update({
      status: 'canceled',
    }).eq('stripe_subscription_id', subscription.id);
  },
};

export const stripe = createStripeProvider({
  cache,
  sync,
});
```

## Next Steps

- Read the [API Reference](./api-reference.md) for all available hooks and handlers
- Learn about [webhook handling](./webhooks.md) in detail
- Understand the [KV + sync pattern](./sync-adapters.md)
- Check out the [migration guide](./migration.md) if you're coming from raw Stripe

## Troubleshooting

**"Missing STRIPE_SECRET_KEY" error:**
- Make sure your `.env.local` file has `STRIPE_SECRET_KEY` set
- Restart your dev server after adding environment variables

**Webhook signature verification fails:**
- Check that `STRIPE_WEBHOOK_SECRET` matches the secret from Stripe
- For local development, use the secret from `stripe listen`

**Checkout redirects but doesn't complete:**
- Check your success/cancel URLs are correct
- Make sure your webhook handler is set up and receiving events

**"Provider not found" error:**
- Make sure you wrapped your app with `<PaymentProvider>`
- Check that you're using the hook inside a client component (`'use client'`)

