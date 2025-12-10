'use client';

import { useCheckout } from '@stripe-sdk/react';
import { useSubscription } from '@stripe-sdk/react';
import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function Home() {
  const [userId] = useState('user_' + Math.random().toString(36).substr(2, 9));
  const [customerEmail, setCustomerEmail] = useState('');

  // Get subscription status (if exists)
  const { subscription, isLoading: subLoading } = useSubscription({
    userId,
  });

  // Checkout hook
  const { checkout, isLoading: checkoutLoading, error } = useCheckout({
    priceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_ID || '',
    successUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/success`,
    cancelUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}`,
    customerEmail: customerEmail || undefined,
    metadata: {
      userId,
    },
    mode: 'subscription',
    onSuccess: () => {
      console.log('Checkout started successfully');
    },
    onError: (err) => {
      console.error('Checkout error:', err);
    },
  });

  const handleSubscribe = async () => {
    if (!customerEmail) {
      alert('Please enter your email address');
      return;
    }
    await checkout();
  };

  return (
    <main className="flex h-screen flex-col items-center justify-center p-4 overflow-hidden">
      <div className="z-10 max-w-5xl w-full font-mono text-sm flex flex-col items-center justify-center gap-3 -mt-24">
        <h1 className="text-3xl font-bold text-center text-slate-900 dark:text-slate-100">
          Stripe SDK Example
        </h1>

        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-6 max-w-md w-full mx-auto border border-slate-200 dark:border-slate-700">
          {subscription ? (
            <div className="space-y-4">
              <div className="text-center">
                <h2 className="text-2xl font-semibold mb-4">
                  Subscription Active
                </h2>
                <p className="text-slate-600 dark:text-slate-300 mb-2">
                  Status: <span className="font-semibold">{subscription.status}</span>
                </p>
                <p className="text-slate-600 dark:text-slate-300 mb-4">
                  Current period ends:{' '}
                  <span className="font-semibold">
                    {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
                  </span>
                </p>
                <Link
                  href="/dashboard"
                  className="inline-block bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 px-4 rounded transition-colors"
                >
                  Go to Dashboard
                </Link>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <h2 className="text-xl font-semibold text-center mb-3">
                Subscribe Now
              </h2>
              <div>
                <label
                  htmlFor="email"
                  className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5"
                >
                  Email Address
                </label>
                <input
                  id="email"
                  type="email"
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-slate-100"
                  required
                />
              </div>
              {error && (
                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
                  {error.message}
                </div>
              )}
              <button
                onClick={handleSubscribe}
                disabled={checkoutLoading || subLoading || !customerEmail}
                className="w-full bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-semibold py-3 px-4 rounded transition-colors"
              >
                {checkoutLoading ? 'Processing...' : 'Subscribe'}
              </button>
              {subLoading && (
                <p className="text-center text-slate-500 dark:text-slate-400 text-sm">
                  Checking subscription status...
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

