/**
 * React hook for creating checkout sessions.
 * Handles checkout flow with loading states and error handling.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import type { CheckoutOptions, CheckoutSession } from '../../core/types';
import { usePaymentProvider } from '../context';

/**
 * Options for useCheckout hook.
 */
export interface UseCheckoutOptions extends Partial<CheckoutOptions> {
  /** API endpoint to create checkout session (default: /api/checkout) */
  endpoint?: string;
  /** Callback invoked when checkout succeeds */
  onSuccess?: (session: CheckoutSession) => void;
  /** Callback invoked when checkout fails */
  onError?: (error: Error) => void;
}

/**
 * Return type for useCheckout hook.
 */
export interface UseCheckoutReturn {
  /** Function to initiate checkout */
  checkout: (options?: Partial<CheckoutOptions>) => Promise<void>;
  /** Whether checkout is in progress */
  isLoading: boolean;
  /** Error if checkout failed */
  error: Error | null;
  /** Created checkout session */
  session: CheckoutSession | null;
  /** Reset hook state */
  reset: () => void;
}

/**
 * Hook for creating and managing checkout sessions.
 * Redirects to Stripe checkout URL on success.
 *
 * @param options - Checkout options and callbacks
 * @returns Checkout state and functions
 *
 * @example
 * ```tsx
 * const { checkout, isLoading, error } = useCheckout({
 *   priceId: 'price_123',
 *   successUrl: '/success',
 *   cancelUrl: '/cancel',
 *   onSuccess: () => console.log('Checkout started'),
 * });
 *
 * <button onClick={() => checkout()}>Buy Now</button>
 * ```
 */
export function useCheckout(
  options: UseCheckoutOptions = {}
): UseCheckoutReturn {
  const { provider } = usePaymentProvider();
  const [session, setSession] = useState<CheckoutSession | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const endpoint = options.endpoint || '/api/checkout';

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const checkout = useCallback(
    async (overrideOptions?: Partial<CheckoutOptions>) => {
      // Cancel any in-flight request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      // Create new abort controller
      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      setIsLoading(true);
      setError(null);

      try {
        // Merge options
        const mergedOptions: CheckoutOptions = {
          priceId: options.priceId || '',
          successUrl: options.successUrl || '',
          cancelUrl: options.cancelUrl || '',
          customerEmail: options.customerEmail,
          customerId: options.customerId,
          metadata: options.metadata,
          mode: options.mode,
          quantity: options.quantity,
          trialDays: options.trialDays,
          ...overrideOptions,
        };

        // Validate required fields
        if (!mergedOptions.priceId) {
          throw new Error('priceId is required');
        }
        if (!mergedOptions.successUrl) {
          throw new Error('successUrl is required');
        }
        if (!mergedOptions.cancelUrl) {
          throw new Error('cancelUrl is required');
        }

        // Check if aborted
        if (abortController.signal.aborted) {
          return;
        }

        // Create checkout session via API endpoint
        const response = await fetch(endpoint, {
          method: 'POST',
          signal: abortController.signal,
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(mergedOptions),
        });

        if (abortController.signal.aborted) {
          return;
        }

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(
            errorData.message || `Checkout failed: ${response.statusText}`
          );
        }

        const data = await response.json();
        const result: CheckoutSession = data.session;

        // Check if aborted
        if (abortController.signal.aborted) {
          return;
        }

        setSession(result);

        // Redirect to checkout URL
        if (result.url) {
          window.location.href = result.url;
        }

        // Invoke success callback
        options.onSuccess?.(result);
      } catch (e) {
        // Ignore abort errors
        if (abortController.signal.aborted) {
          return;
        }

        const error = e instanceof Error ? e : new Error('Checkout failed');
        setError(error);
        options.onError?.(error);
      } finally {
        if (!abortController.signal.aborted) {
          setIsLoading(false);
        }
      }
    },
    [endpoint, options]
  );

  const reset = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setSession(null);
    setError(null);
    setIsLoading(false);
  }, []);

  return {
    checkout,
    error,
    isLoading,
    reset,
    session,
  };
}

