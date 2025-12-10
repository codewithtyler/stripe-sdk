# Stripe SDK Example App

A complete Next.js example application demonstrating how to use the Stripe SDK for subscriptions, checkout, and webhooks.

## Features

- ✅ Checkout flow with `useCheckout` hook
- ✅ Subscription management with `useSubscription` hook
- ✅ Webhook handling with signature verification
- ✅ Upstash Redis caching
- ✅ Billing portal integration
- ✅ Subscription cancellation

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

Fill in the required values:

- **Stripe Keys**: Get from [Stripe Dashboard](https://dashboard.stripe.com/test/apikeys)
  - `STRIPE_SECRET_KEY`: Your Stripe secret key (starts with `sk_test_` or `sk_live_`)
  - `STRIPE_PUBLISHABLE_KEY`: Your Stripe publishable key (starts with `pk_test_` or `pk_live_`)
  - `STRIPE_WEBHOOK_SECRET`: Webhook signing secret (starts with `whsec_`)

- **Upstash Redis**: Get from [Upstash Console](https://console.upstash.com/)
  - `UPSTASH_REDIS_REST_URL`: Your Upstash Redis REST URL
  - `UPSTASH_REDIS_REST_TOKEN`: Your Upstash Redis REST token

- **Application**:
  - `NEXT_PUBLIC_APP_URL`: Your app URL (e.g., `http://localhost:3000`)
  - `NEXT_PUBLIC_STRIPE_PRICE_ID`: Create a price in Stripe Dashboard and use its ID (starts with `price_`)

### 3. Create a Stripe Price

1. Go to [Stripe Dashboard > Products](https://dashboard.stripe.com/test/products)
2. Create a new product and price
3. Copy the Price ID (starts with `price_`)
4. Add it to `.env.local` as `NEXT_PUBLIC_STRIPE_PRICE_ID`

### 4. Set Up Webhook Endpoint

#### Option A: Using Stripe CLI (Recommended for Development)

1. Install [Stripe CLI](https://stripe.com/docs/stripe-cli)

2. Login to Stripe:
   ```bash
   stripe login
   ```

3. Forward webhooks to your local server:
   ```bash
   stripe listen --forward-to localhost:3000/api/stripe/webhook
   ```

4. Copy the webhook signing secret (starts with `whsec_`) and add it to `.env.local` as `STRIPE_WEBHOOK_SECRET`

#### Option B: Using ngrok (For Testing on Real Devices)

1. Install [ngrok](https://ngrok.com/)

2. Start your Next.js app:
   ```bash
   npm run dev
   ```

3. In another terminal, expose your local server:
   ```bash
   ngrok http 3000
   ```

4. Copy the ngrok URL (e.g., `https://abc123.ngrok.io`)

5. In Stripe Dashboard, go to [Webhooks](https://dashboard.stripe.com/test/webhooks)

6. Click "Add endpoint" and enter:
   - URL: `https://abc123.ngrok.io/api/stripe/webhook`
   - Events to send: Select these events:
     - `checkout.session.completed`
     - `customer.subscription.created`
     - `customer.subscription.updated`
     - `customer.subscription.deleted`
     - `customer.subscription.canceled`

7. Copy the webhook signing secret and add it to `.env.local`

## Running the App

### Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### Production Build

```bash
npm run build
npm start
```

## Testing with Stripe CLI

1. Start the app:
   ```bash
   npm run dev
   ```

2. In another terminal, start Stripe webhook forwarding:
   ```bash
   stripe listen --forward-to localhost:3000/api/stripe/webhook
   ```

3. Trigger test events:
   ```bash
   # Test checkout completion
   stripe trigger checkout.session.completed

   # Test subscription creation
   stripe trigger customer.subscription.created

   # Test subscription update
   stripe trigger customer.subscription.updated

   # Test subscription cancellation
   stripe trigger customer.subscription.deleted
   ```

## Project Structure

```
examples/next-app/
├── app/
│   ├── api/
│   │   └── stripe/
│   │       ├── checkout/
│   │       │   └── route.ts      # Checkout API endpoint
│   │       └── webhook/
│   │           └── route.ts      # Webhook handler
│   ├── dashboard/
│   │   └── page.tsx               # Subscription dashboard
│   ├── success/
│   │   └── page.tsx               # Success redirect page
│   ├── layout.tsx                 # Root layout with PaymentProvider
│   ├── page.tsx                   # Landing page with subscribe button
│   └── globals.css                # Global styles
├── lib/
│   └── stripe.ts                  # Stripe provider configuration
├── .env.example                   # Environment variables template
└── README.md                      # This file
```

## How It Works

### 1. Checkout Flow

1. User enters email and clicks "Subscribe"
2. `useCheckout` hook calls `/api/stripe/checkout`
3. API route creates Stripe checkout session
4. User is redirected to Stripe Checkout
5. After payment, Stripe redirects to `/success`

### 2. Webhook Processing

1. Stripe sends webhook to `/api/stripe/webhook`
2. Handler verifies signature
3. Fetches latest data from Stripe (don't trust event payload)
4. Updates Upstash cache
5. Calls your event handlers
6. Returns 200 to acknowledge receipt

### 3. Subscription Management

1. `useSubscription` hook fetches subscription from cache
2. Dashboard shows subscription details
3. "Manage Billing" opens Stripe Customer Portal
4. "Cancel" cancels subscription at period end

## Customization

### Adding Database Integration

In `app/api/stripe/webhook/route.ts`, uncomment and modify the database update code:

```typescript
onCheckoutComplete: async (session: CheckoutSession) => {
  await db.users.update({
    where: { id: session.metadata?.userId },
    data: { customerId: session.customerId },
  });
},
```

### Adding Email Notifications

```typescript
onSubscriptionCreated: async (subscription: Subscription) => {
  await sendWelcomeEmail(subscription.customerId);
},
```

## Troubleshooting

### Webhook Signature Verification Fails

- Make sure `STRIPE_WEBHOOK_SECRET` matches the webhook endpoint secret
- If using Stripe CLI, use the secret from `stripe listen` output
- If using ngrok, use the secret from Stripe Dashboard webhook settings

### Subscription Not Showing

- Check that webhooks are being received (check server logs)
- Verify Upstash Redis is configured correctly
- Make sure `userId` in metadata matches what you're querying with

### Checkout Redirects to Cancel URL

- Check Stripe Dashboard for payment errors
- Verify `NEXT_PUBLIC_STRIPE_PRICE_ID` is correct
- Make sure test card numbers work in test mode

## Learn More

- [Stripe SDK Documentation](../../README.md)
- [Getting Started Guide](../../docs/getting-started.md)
- [API Reference](../../docs/api-reference.md)
- [Webhook Guide](../../docs/webhooks.md)

