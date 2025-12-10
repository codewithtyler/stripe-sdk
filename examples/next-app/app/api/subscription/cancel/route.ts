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
 * POST /api/subscription/cancel
 * Cancels subscription at period end and updates KV cache
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

    // Get subscription ID from cache
    const subscriptionId = await cache.get<string>(
      `subscription:customer:${resolvedCustomerId!}`
    );

    if (!subscriptionId) {
      return NextResponse.json(
        { error: 'Subscription not found' },
        { status: 404 }
      );
    }

    // Cancel subscription at period end
    const canceledSubscription = await stripe.subscriptions.update(
      subscriptionId,
      {
        cancel_at_period_end: true,
      }
    );

    // Convert to SDK Subscription type
    const subscription: Subscription = {
      id: canceledSubscription.id,
      customerId:
        typeof canceledSubscription.customer === 'string'
          ? canceledSubscription.customer
          : canceledSubscription.customer?.id ?? '',
      status: canceledSubscription.status as Subscription['status'],
      currentPeriodEnd: new Date(canceledSubscription.current_period_end * 1000),
      currentPeriodStart: new Date(
        canceledSubscription.current_period_start * 1000
      ),
      cancelAtPeriodEnd: canceledSubscription.cancel_at_period_end,
      items: canceledSubscription.items.data.map((item) => ({
        id: item.id,
        priceId: item.price.id,
        quantity: item.quantity ?? 1,
      })),
      metadata: canceledSubscription.metadata ?? undefined,
      createdAt: new Date(canceledSubscription.created * 1000),
    };

    // Update KV cache
    await cache.set(`subscription:${subscription.id}`, subscription, 3600);

    return NextResponse.json({ subscription });
  } catch (error) {
    console.error('Subscription cancel error:', error);
    return NextResponse.json(
      { error: 'Failed to cancel subscription' },
      { status: 500 }
    );
  }
}

