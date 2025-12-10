'use client';

import { useState } from 'react';
import { useSubscription } from '@stripe-sdk/react';
import Link from 'next/link';

export default function DashboardPage() {
  const [userId] = useState(() => {
    // In a real app, get this from auth context
    return 'user_' + Math.random().toString(36).substr(2, 9);
  });

  const {
    subscription,
    isLoading,
    error,
    cancel,
    openPortal,
    refresh,
  } = useSubscription({
    userId,
    onRefresh: (sub) => {
      console.log('Subscription refreshed:', sub);
    },
    onError: (err) => {
      console.error('Subscription error:', err);
      alert('Error: ' + err.message);
    },
  });

  const handleCancel = async () => {
    if (
      confirm(
        'Are you sure you want to cancel your subscription? It will remain active until the end of the current period.'
      )
    ) {
      try {
        await cancel();
        alert('Subscription canceled successfully');
        refresh();
      } catch (err) {
        alert('Failed to cancel subscription');
      }
    }
  };

  const handleOpenPortal = async () => {
    try {
      await openPortal(
        `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/dashboard`
      );
    } catch (err) {
      alert('Failed to open billing portal');
    }
  };

  if (isLoading) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-24">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
        <p className="mt-4 text-slate-600 dark:text-slate-300">Loading subscription...</p>
      </main>
    );
  }

  if (error) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-24">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded max-w-md">
          <p className="font-semibold">Error</p>
          <p>{error.message}</p>
        </div>
      </main>
    );
  }

  if (!subscription) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-24">
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-8 max-w-md mx-auto text-center border border-slate-200 dark:border-slate-700">
          <h1 className="text-2xl font-bold mb-4 text-slate-900 dark:text-slate-100">No Active Subscription</h1>
          <p className="text-slate-600 dark:text-slate-300 mb-6">
            You don't have an active subscription yet.
          </p>
          <Link
            href="/"
            className="inline-block bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 px-4 rounded transition-colors"
          >
            Subscribe Now
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="z-10 max-w-5xl w-full items-center justify-center font-mono text-sm">
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-8 max-w-2xl mx-auto border border-slate-200 dark:border-slate-700">
          <div className="mb-6">
            <Link
              href="/"
              className="text-blue-500 hover:text-blue-600 underline"
            >
              ← Back to Home
            </Link>
          </div>

          <h1 className="text-3xl font-bold mb-6 text-slate-900 dark:text-slate-100">Subscription Dashboard</h1>

          <div className="space-y-6">
            <div className="border-b border-gray-200 dark:border-gray-700 pb-4">
              <h2 className="text-xl font-semibold mb-2">Subscription Details</h2>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-600 dark:text-slate-300">Status:</span>
                  <span
                    className={`font-semibold ${
                      subscription.status === 'active'
                        ? 'text-green-600'
                        : subscription.status === 'canceled'
                        ? 'text-red-600'
                        : 'text-yellow-600'
                    }`}
                  >
                    {subscription.status.toUpperCase()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">
                    Subscription ID:
                  </span>
                  <span className="font-mono text-sm">{subscription.id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">
                    Current Period Start:
                  </span>
                  <span>
                    {new Date(subscription.currentPeriodStart).toLocaleDateString()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">
                    Current Period End:
                  </span>
                  <span>
                    {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
                  </span>
                </div>
                {subscription.cancelAtPeriodEnd && (
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">
                      Cancels At Period End:
                    </span>
                    <span className="text-yellow-600 font-semibold">Yes</span>
                  </div>
                )}
              </div>
            </div>

            {subscription.items && subscription.items.length > 0 && (
              <div className="border-b border-gray-200 dark:border-gray-700 pb-4">
                <h2 className="text-xl font-semibold mb-2">Subscription Items</h2>
                <div className="space-y-2">
                  {subscription.items.map((item) => (
                    <div key={item.id} className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">
                        Price ID:
                      </span>
                      <span className="font-mono text-sm">{item.priceId}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-4">
              <button
                onClick={handleOpenPortal}
                className="flex-1 bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 px-4 rounded transition-colors"
              >
                Manage Billing
              </button>
              {subscription.status === 'active' && !subscription.cancelAtPeriodEnd && (
                <button
                  onClick={handleCancel}
                  className="flex-1 bg-red-500 hover:bg-red-600 text-white font-semibold py-2 px-4 rounded transition-colors"
                >
                  Cancel Subscription
                </button>
              )}
              <button
                onClick={refresh}
                className="flex-1 bg-slate-500 hover:bg-slate-600 text-white font-semibold py-2 px-4 rounded transition-colors"
              >
                Refresh
              </button>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

