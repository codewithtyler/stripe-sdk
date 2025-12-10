import { createWebhookHandler } from '@stripe-sdk/next';
import { stripeProvider } from '@/lib/stripe';
import { createUpstashAdapter } from '@stripe-sdk/adapters';
import type { CheckoutSession, Subscription } from '@stripe-sdk/core/types';

// Create Upstash cache adapter (same as in lib/stripe.ts)
const cache = createUpstashAdapter({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

// Create webhook handler with event handlers
const handler = createWebhookHandler({
  provider: stripeProvider,
  cache,
  handlers: {
    /**
     * Called when a checkout session is completed.
     * This is where you'd typically:
     * - Update your database with the subscription
     * - Send welcome emails
     * - Activate user features
     */
    onCheckoutComplete: async (session: CheckoutSession) => {
      console.log('Checkout completed:', session.id);
      console.log('Customer ID:', session.customerId);
      
      // Example: Update your database
      // await db.users.update({
      //   where: { id: session.metadata?.userId },
      //   data: { customerId: session.customerId },
      // });
    },

    /**
     * Called when a subscription is created.
     * This happens after checkout completes and the subscription is active.
     */
    onSubscriptionCreated: async (subscription: Subscription) => {
      console.log('Subscription created:', subscription.id);
      console.log('Status:', subscription.status);
      
      // Example: Activate user features
      // await db.users.update({
      //   where: { customerId: subscription.customerId },
      //   data: { subscriptionActive: true },
      // });
    },

    /**
     * Called when a subscription is updated.
     * This includes status changes, plan changes, etc.
     */
    onSubscriptionUpdated: async (subscription: Subscription) => {
      console.log('Subscription updated:', subscription.id);
      console.log('New status:', subscription.status);
      
      // Example: Update subscription status in database
      // await db.subscriptions.update({
      //   where: { stripeSubscriptionId: subscription.id },
      //   data: { status: subscription.status },
      // });
    },

    /**
     * Called when a subscription is canceled or deleted.
     */
    onSubscriptionCanceled: async (subscription: Subscription) => {
      console.log('Subscription canceled:', subscription.id);
      
      // Example: Deactivate user features
      // await db.users.update({
      //   where: { customerId: subscription.customerId },
      //   data: { subscriptionActive: false },
      // });
    },
  },
});

export { handler as POST };

