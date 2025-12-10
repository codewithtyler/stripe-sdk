import { NextRequest, NextResponse } from 'next/server';
import { stripeProvider } from '@/lib/stripe';
import { createUpstashAdapter } from '@stripe-sdk/adapters';
import type { Subscription } from '@stripe-sdk/core/types';
import { loadStripeConfig } from '@stripe-sdk/core/config';
import { createStripeClient } from '@stripe-sdk/providers/stripe/api';

// Create Upstash cache adapter
const cache = createUpstashAdapter({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

/**
 * POST /api/subscription/refresh
 * Fetches latest subscription from Stripe and updates KV cache
 */
export async function POST(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const customerId = searchParams.get('customerId');
    const userId = searchParams.get('userId');

    if (!customerId && !userId) {
      return NextResponse.json(
        { error: 'customerId or userId is required' },
        { status: 400 }
      );
    }

    // Load Stripe config and create client
    const config = loadStripeConfig();
    const stripe = createStripeClient(config.secretKey);

    // Resolve customerId if we have userId
    let resolvedCustomerId = customerId;
    if (!resolvedCustomerId && userId) {
      resolvedCustomerId = await cache.get<string>(`customer:userId:${userId}`);
      if (!resolvedCustomerId) {
        return NextResponse.json(
          { error: 'Customer not found for userId' },
          { status: 404 }
        );
      }
    }

    // Fetch latest subscription from Stripe
    const subscriptions = await stripe.subscriptions.list({
      customer: resolvedCustomerId!,
      limit: 1,
      status: 'all',
    });

    if (subscriptions.data.length === 0) {
      return NextResponse.json(
        { error: 'No subscription found' },
        { status: 404 }
      );
    }

    const stripeSubscription = subscriptions.data[0];

    // Convert to SDK Subscription type
    const subscription: Subscription = {
      id: stripeSubscription.id,
      customerId:
        typeof stripeSubscription.customer === 'string'
          ? stripeSubscription.customer
          : stripeSubscription.customer?.id ?? '',
      status: stripeSubscription.status as Subscription['status'],
      currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
      currentPeriodStart: new Date(stripeSubscription.current_period_start * 1000),
      cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
      items: stripeSubscription.items.data.map((item) => ({
        id: item.id,
        priceId: item.price.id,
        quantity: item.quantity ?? 1,
      })),
      metadata: stripeSubscription.metadata ?? undefined,
      createdAt: new Date(stripeSubscription.created * 1000),
    };

    // Update KV cache
    await cache.set(`subscription:${subscription.id}`, subscription, 3600);
    await cache.set(
      `subscription:customer:${subscription.customerId}`,
      subscription.id,
      3600
    );

    return NextResponse.json({ subscription });
  } catch (error) {
    console.error('Subscription refresh error:', error);
    return NextResponse.json(
      { error: 'Failed to refresh subscription' },
      { status: 500 }
    );
  }
}

