'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSubscription } from '@stripe-sdk/react';

export default function SuccessPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('session_id');
  const [userId] = useState(() => {
    // In a real app, get this from auth context
    return 'user_' + Math.random().toString(36).substr(2, 9);
  });

  const { subscription, refresh, isLoading } = useSubscription({
    userId,
    onRefresh: () => {
      // After refresh, redirect to dashboard
      setTimeout(() => {
        router.push('/dashboard');
      }, 2000);
    },
  });

  useEffect(() => {
    // Refresh subscription state when page loads
    if (sessionId) {
      refresh();
    }
  }, [sessionId, refresh]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="z-10 max-w-5xl w-full items-center justify-center font-mono text-sm">
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-8 max-w-md mx-auto text-center border border-slate-200 dark:border-slate-700">
          {isLoading ? (
            <div className="space-y-4">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
              <p className="text-slate-600 dark:text-slate-300">
                Syncing your subscription...
              </p>
            </div>
          ) : subscription ? (
            <div className="space-y-4">
              <div className="text-green-500 text-5xl mb-4">✓</div>
              <h1 className="text-3xl font-bold mb-2">Payment Successful!</h1>
              <p className="text-slate-600 dark:text-slate-300 mb-4">
                Your subscription is now active. Redirecting to dashboard...
              </p>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Status: <span className="font-semibold">{subscription.status}</span>
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <h1 className="text-3xl font-bold mb-2">Processing...</h1>
              <p className="text-slate-600 dark:text-slate-300">
                Please wait while we sync your subscription.
              </p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

