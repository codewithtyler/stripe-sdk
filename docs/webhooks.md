# Webhooks

Webhooks are how Stripe notifies your application about events like completed payments, subscription changes, and customer updates. This guide explains how the SDK handles webhooks and why it works the way it does.

## The Problem with Webhooks

Theo taught us an important lesson: **never trust the event payload**. Here's why:

1. **Stale data** - The event payload might be from when the event was created, not the current state
2. **Race conditions** - Multiple events can arrive out of order
3. **Partial updates** - The payload might not include all the data you need

**Bad example (don't do this):**
```ts
// ❌ WRONG - Trusting event payload
if (event.type === 'checkout.session.completed') {
  const session = event.data.object;
  // This might be stale!
  await db.subscriptions.create({
    status: session.status,  // Might be 'open' instead of 'complete'
  });
}
```

**Good example (what we do):**
```ts
// ✅ CORRECT - Fetch fresh data
if (event.type === 'checkout.session.completed') {
  const sessionId = event.data.object.id;
  // Always fetch fresh data from Stripe
  const freshSession = await stripe.checkout.sessions.retrieve(sessionId);
  // Now we have the latest state
  await db.subscriptions.create({
    status: freshSession.status,  // Guaranteed to be current
  });
}
```

## How Our Webhook Handler Works

The `createWebhookHandler` function implements a secure, reliable webhook processing flow:

### 1. Signature Verification

First, we verify the webhook signature to ensure it's actually from Stripe:

```ts
const signature = request.headers.get('stripe-signature');
const event = provider.verifyWebhook(body, signature);
```

If verification fails, we return 401 immediately. This prevents malicious requests from triggering your handlers.

### 2. Fresh Data Fetching

**This is the key part** - we always fetch the latest data from Stripe:

```ts
if (event.type === 'checkout.session.completed') {
  const sessionId = event.data.object.id;
  // Fetch fresh data (don't trust event payload)
  const freshSession = await fetchLatestCheckoutSession(stripe, sessionId);
  // Use freshSession, not event.data.object
}
```

This ensures you're always working with the current state, not stale event data.

### 3. KV Cache Update

After fetching fresh data, we update the KV cache:

```ts
await cache.set(`checkout:${freshSession.id}`, freshSession, 3600);
await cache.set(`customer:${customer.id}`, customer, 86400);
```

This makes subsequent lookups fast (via `useSubscription` hook, etc.).

### 4. Sync Adapter (Optional)

If you've configured a sync adapter, it's called with the fresh data:

```ts
if (sync?.onCustomerCreated) {
  await sync.onCustomerCreated(customer);  // Fresh customer data
}
```

### 5. User Handlers

Finally, your custom event handlers are called:

```ts
if (handlers?.onCheckoutComplete) {
  await handlers.onCheckoutComplete(freshSession);  // Fresh session data
}
```

### 6. Always Return 200

We always return 200 to acknowledge receipt, even if handlers fail:

```ts
return NextResponse.json({ received: true }, { status: 200 });
```

This prevents Stripe from retrying the webhook. If you need to retry failed operations, handle that in your handlers.

## Setting Up Webhooks

### Local Development

Use Stripe CLI to forward webhooks to your local server:

```bash
# Install Stripe CLI
brew install stripe/stripe-cli/stripe

# Login
stripe login

# Forward webhooks
stripe listen --forward-to localhost:3000/api/webhook
```

The CLI will output a webhook signing secret. Add it to your `.env.local`:

```env
STRIPE_WEBHOOK_SECRET=whsec_...
```

### Production

1. Go to [Stripe Dashboard > Webhooks](https://dashboard.stripe.com/webhooks)
2. Click "Add endpoint"
3. Enter your production URL: `https://yourdomain.com/api/webhook`
4. Select events to listen to:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `customer.subscription.canceled`
5. Copy the webhook signing secret to your environment variables

## Webhook Handler Setup

Create your webhook handler:

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
      // This receives FRESH data from Stripe (not event payload)
      console.log('Checkout completed:', session.id);
      console.log('Status:', session.status);  // Guaranteed to be 'complete'
      
      // Update your database
      if (session.metadata?.userId) {
        await db.users.update({
          where: { id: session.metadata.userId },
          data: { subscribed: true },
        });
      }
    },
    onSubscriptionCreated: async (subscription) => {
      // Fresh subscription data
      console.log('Subscription created:', subscription.id);
      console.log('Status:', subscription.status);
    },
    onSubscriptionUpdated: async (subscription) => {
      // Fresh subscription data
      console.log('Subscription updated:', subscription.id);
      console.log('Status:', subscription.status);
      
      // Update user permissions
      if (subscription.status === 'active') {
        await activateUser(subscription.customerId);
      }
    },
    onSubscriptionCanceled: async (subscription) => {
      // Fresh subscription data
      console.log('Subscription canceled:', subscription.id);
      
      // Revoke user permissions
      await deactivateUser(subscription.customerId);
    },
  },
});

export { handler as POST };
```

## Event Types Handled

The webhook handler automatically handles these event types:

### `checkout.session.completed`

Triggered when a checkout session is completed (payment successful).

**What happens:**
1. Fetches fresh checkout session from Stripe
2. Updates KV cache with session
3. If customer was created, fetches and caches customer
4. Calls `sync.onCustomerCreated` if configured
5. Calls `handlers.onCheckoutComplete` if provided

**Example:**
```ts
onCheckoutComplete: async (session) => {
  // session is fresh data from Stripe
  // session.status is guaranteed to be 'complete'
  // session.customerId is the actual customer ID
}
```

### `customer.subscription.created`

Triggered when a subscription is created.

**What happens:**
1. Fetches fresh subscription from Stripe
2. Updates KV cache
3. Caches subscription lookup by customer ID
4. Calls `sync.onSubscriptionUpdated` if configured
5. Calls `handlers.onSubscriptionCreated` if provided

**Example:**
```ts
onSubscriptionCreated: async (subscription) => {
  // subscription is fresh data from Stripe
  // subscription.status might be 'incomplete', 'trialing', or 'active'
}
```

### `customer.subscription.updated`

Triggered when a subscription is updated (status change, renewal, etc.).

**What happens:**
1. Fetches fresh subscription from Stripe
2. Updates KV cache
3. Calls `sync.onSubscriptionUpdated` if configured
4. Calls `handlers.onSubscriptionUpdated` if provided

**Example:**
```ts
onSubscriptionUpdated: async (subscription) => {
  // subscription is fresh data from Stripe
  // subscription.status is the current status
  // subscription.currentPeriodEnd is the latest period end
}
```

### `customer.subscription.deleted` / `customer.subscription.canceled`

Triggered when a subscription is canceled or deleted.

**What happens:**
1. Fetches fresh subscription from Stripe (even if canceled, we get the latest state)
2. Updates KV cache (kept for 24 hours for history)
3. Calls `sync.onSubscriptionCanceled` if configured
4. Calls `handlers.onSubscriptionCanceled` if provided

**Example:**
```ts
onSubscriptionCanceled: async (subscription) => {
  // subscription is fresh data from Stripe
  // subscription.status is 'canceled'
  // subscription.cancelAtPeriodEnd tells you if it's immediate or at period end
}
```

## Custom Event Handlers

You can handle additional event types by checking the event type in your handler:

```ts
const handler = createWebhookHandler({
  provider: stripe,
  cache: upstashCache,
  handlers: {
    onCheckoutComplete: async (session) => {
      // Handle checkout completion
    },
    // For other events, you can access the raw event in the webhook handler
    // by creating a custom handler function
  },
});

// Or extend the handler to handle more events
export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get('stripe-signature');
  
  // Verify signature
  const event = stripe.verifyWebhook(body, signature);
  
  // Handle custom events
  if (event.type === 'invoice.payment_succeeded') {
    // Handle invoice payment
  }
  
  // Use the standard handler for other events
  return handler(request);
}
```

## Error Handling

The webhook handler is designed to be resilient:

1. **Signature verification failures** → Returns 401 (Stripe will retry)
2. **Handler errors** → Logs error, returns 200 (prevents infinite retries)
3. **Sync adapter errors** → Logs error, continues processing

**Best practice:** Handle errors in your handlers:

```ts
onCheckoutComplete: async (session) => {
  try {
    await db.users.update({ ... });
  } catch (error) {
    // Log to error tracking service
    console.error('Failed to update user:', error);
    // Optionally queue for retry
    await queueRetry({ type: 'checkout', sessionId: session.id });
  }
}
```

## Testing Webhooks

### Using Stripe CLI

```bash
# Forward webhooks to local server
stripe listen --forward-to localhost:3000/api/webhook

# Trigger a test event
stripe trigger checkout.session.completed
```

### Using Stripe Dashboard

1. Go to [Stripe Dashboard > Webhooks](https://dashboard.stripe.com/webhooks)
2. Click on your webhook endpoint
3. Click "Send test webhook"
4. Select an event type
5. Click "Send test webhook"

### Manual Testing

You can manually test by creating a checkout session and completing it:

```ts
// Create a test checkout
const session = await stripe.checkout.sessions.create({
  line_items: [{ price: 'price_test', quantity: 1 }],
  mode: 'subscription',
  success_url: 'https://example.com/success',
  cancel_url: 'https://example.com/cancel',
});

// Complete it in test mode
// The webhook will fire automatically
```

## Idempotency

The webhook handler doesn't implement idempotency by default. If you need idempotency (to prevent duplicate processing), implement it in your handlers:

```ts
onCheckoutComplete: async (session) => {
  // Check if already processed
  const processed = await db.webhookEvents.findUnique({
    where: { eventId: session.id },
  });
  
  if (processed) {
    return; // Already processed
  }
  
  // Process the event
  await db.users.update({ ... });
  
  // Mark as processed
  await db.webhookEvents.create({
    data: { eventId: session.id, type: 'checkout.completed' },
  });
}
```

## Why We Fetch Fresh Data

This is the core principle: **always fetch fresh data from Stripe, never trust the event payload**.

**Reasons:**
1. **Stale data** - Event payload might be from when event was created
2. **Race conditions** - Events can arrive out of order
3. **Partial data** - Payload might not include all fields you need
4. **State changes** - Object state might have changed since event was created

**Example:**
```ts
// Event says status is 'open'
// But by the time we process it, status might be 'complete'
// So we fetch fresh data to get the current state
const freshSession = await stripe.checkout.sessions.retrieve(sessionId);
// Now we have the actual current state
```

This is the lesson Theo taught us, and it's built into every webhook handler we create.

