import { NextRequest, NextResponse } from 'next/server';
import { stripeProvider } from '@/lib/stripe';
import { createUpstashAdapter } from '@stripe-sdk/adapters';
import type { Subscription } from '@stripe-sdk/core/types';
import Stripe from 'stripe';
import { loadStripeConfig } from '@stripe-sdk/core/config';
import { createStripeClient } from '@stripe-sdk/providers/stripe/api';

// Create Upstash cache adapter
const cache = createUpstashAdapter({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

/**
 * GET /api/subscription
 * Fetches subscription from KV cache by customerId or userId
 */
export async function GET(request: NextRequest) {
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

    let subscription: Subscription | null = null;

    if (customerId) {
      // Try to get subscription ID from cache
      const subscriptionId = await cache.get<string>(
        `subscription:customer:${customerId}`
      );

      if (subscriptionId) {
        subscription = await cache.get<Subscription>(`subscription:${subscriptionId}`);
      }
    } else if (userId) {
      // Look up customer ID by userId
      const customerId = await cache.get<string>(`customer:userId:${userId}`);

      if (customerId) {
        const subscriptionId = await cache.get<string>(
          `subscription:customer:${customerId}`
        );

        if (subscriptionId) {
          subscription = await cache.get<Subscription>(`subscription:${subscriptionId}`);
        }
      }
    }

    return NextResponse.json({ subscription });
  } catch (error) {
    console.error('Subscription fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch subscription' },
      { status: 500 }
    );
  }
}

