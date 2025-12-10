'use client';

import { PaymentProvider } from '@stripe-sdk/react';
import { stripeProvider, isStripeReady } from '@/lib/stripe';
import type { ReactNode } from 'react';

/**
 * Client component wrapper for PaymentProvider.
 * Required because PaymentProvider uses React Context which only works in Client Components.
 */
export function PaymentProviderWrapper({ children }: { children: ReactNode }) {
  return (
    <>
      {!isStripeReady && (
        <div className="bg-amber-50/50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 mb-3 mx-4 mt-2">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <svg
                className="h-5 w-5 text-amber-600 dark:text-amber-400"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div className="ml-3 flex-1">
              <p className="text-sm text-amber-800 dark:text-amber-200">
                <strong className="font-semibold">Stripe is not configured.</strong> Payment features will not work.
                <br className="my-1" />
                Please set <code className="bg-amber-100 dark:bg-amber-900/40 px-1.5 py-0.5 rounded text-xs font-mono">STRIPE_SECRET_KEY</code> in{' '}
                <code className="bg-amber-100 dark:bg-amber-900/40 px-1.5 py-0.5 rounded text-xs font-mono">.env.local</code>
                <br className="my-1" />
                <a
                  href="https://dashboard.stripe.com/test/apikeys"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-amber-700 dark:text-amber-300 hover:text-amber-800 dark:hover:text-amber-200 underline font-medium inline-flex items-center gap-1"
                >
                  Get your key from Stripe Dashboard
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              </p>
            </div>
          </div>
        </div>
      )}
      <PaymentProvider provider={stripeProvider}>{children}</PaymentProvider>
    </>
  );
}

