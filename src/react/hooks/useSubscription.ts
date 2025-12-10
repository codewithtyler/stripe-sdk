/**
 * React hook for managing subscriptions.
 * Fetches subscription state from KV and provides refresh functionality.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import type { Subscription } from '../../core/types';
import { usePaymentProvider } from '../context';

/**
 * Options for useSubscription hook.
 */
export interface UseSubscriptionOptions {
  /** Customer ID to fetch subscription for */
  customerId?: string;
  /** User ID to fetch subscription for (alternative to customerId) */
  userId?: string;
  /** API endpoint to fetch subscription from KV (default: /api/subscription) */
  fetchEndpoint?: string;
  /** API endpoint to refresh subscription from Stripe (default: /api/subscription/refresh) */
  refreshEndpoint?: string;
  /** API endpoint to cancel subscription (default: /api/subscription/cancel) */
  cancelEndpoint?: string;
  /** API endpoint to open portal (default: /api/portal) */
  portalEndpoint?: string;
  /** Callback invoked when subscription is loaded */
  onLoad?: (subscription: Subscription | null) => void;
  /** Callback invoked when refresh succeeds */
  onRefresh?: (subscription: Subscription) => void;
  /** Callback invoked when operation fails */
  onError?: (error: Error) => void;
}

/**
 * Return type for useSubscription hook.
 */
export interface UseSubscriptionReturn {
  /** Current subscription state */
  subscription: Subscription | null;
  /** Whether subscription is loading */
  isLoading: boolean;
  /** Error if operation failed */
  error: Error | null;
  /** Cancel subscription */
  cancel: () => Promise<void>;
  /** Open billing portal */
  openPortal: (returnUrl: string) => Promise<void>;
  /** Refresh subscription from Stripe and update KV */
  refresh: () => Promise<void>;
}

/**
 * Hook for managing subscriptions.
 * Fetches subscription state from KV and provides refresh functionality.
 *
 * @param options - Subscription options and callbacks
 * @returns Subscription state and functions
 *
 * @example
 * ```tsx
 * const { subscription, isLoading, refresh, cancel } = useSubscription({
 *   customerId: 'cus_123',
 *   onRefresh: (sub) => console.log('Refreshed:', sub),
 * });
 *
 * <button onClick={refresh}>Refresh</button>
 * ```
 */
export function useSubscription(
  options: UseSubscriptionOptions = {}
): UseSubscriptionReturn {
  const { provider } = usePaymentProvider();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchEndpoint = options.fetchEndpoint || '/api/subscription';
  const refreshEndpoint = options.refreshEndpoint || '/api/subscription/refresh';
  const cancelEndpoint = options.cancelEndpoint || '/api/subscription/cancel';
  const portalEndpoint = options.portalEndpoint || '/api/portal';

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // Fetch subscription from KV
  const fetchSubscription = useCallback(async () => {
    if (!options.customerId && !options.userId) {
      setSubscription(null);
      return;
    }

    // Cancel any in-flight request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    setIsLoading(true);
    setError(null);

    try {
      // Build query params
      const params = new URLSearchParams();
      if (options.customerId) {
        params.set('customerId', options.customerId);
      }
      if (options.userId) {
        params.set('userId', options.userId);
      }

      const response = await fetch(`${fetchEndpoint}?${params.toString()}`, {
        method: 'GET',
        signal: abortController.signal,
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (abortController.signal.aborted) {
        return;
      }

      if (!response.ok) {
        if (response.status === 404) {
          setSubscription(null);
          options.onLoad?.(null);
          return;
        }
        throw new Error(`Failed to fetch subscription: ${response.statusText}`);
      }

      const data = await response.json();
      const sub: Subscription | null = data.subscription || null;

      if (abortController.signal.aborted) {
        return;
      }

      setSubscription(sub);
      options.onLoad?.(sub);
    } catch (e) {
      if (abortController.signal.aborted) {
        return;
      }

      const error = e instanceof Error ? e : new Error('Failed to fetch subscription');
      setError(error);
      options.onError?.(error);
    } finally {
      if (!abortController.signal.aborted) {
        setIsLoading(false);
      }
    }
  }, [options.customerId, options.userId, fetchEndpoint, options.onLoad, options.onError]);

  // Refresh subscription from Stripe and update KV
  const refresh = useCallback(async () => {
    if (!options.customerId && !options.userId) {
      throw new Error('customerId or userId is required');
    }

    // Cancel any in-flight request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    setIsLoading(true);
    setError(null);

    try {
      // Build query params
      const params = new URLSearchParams();
      if (options.customerId) {
        params.set('customerId', options.customerId);
      }
      if (options.userId) {
        params.set('userId', options.userId);
      }

      const response = await fetch(`${refreshEndpoint}?${params.toString()}`, {
        method: 'POST',
        signal: abortController.signal,
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (abortController.signal.aborted) {
        return;
      }

      if (!response.ok) {
        throw new Error(`Failed to refresh subscription: ${response.statusText}`);
      }

      const data = await response.json();
      const sub: Subscription = data.subscription;

      if (abortController.signal.aborted) {
        return;
      }

      setSubscription(sub);
      options.onRefresh?.(sub);
    } catch (e) {
      if (abortController.signal.aborted) {
        return;
      }

      const error = e instanceof Error ? e : new Error('Failed to refresh subscription');
      setError(error);
      options.onError?.(error);
    } finally {
      if (!abortController.signal.aborted) {
        setIsLoading(false);
      }
    }
  }, [options.customerId, options.userId, refreshEndpoint, options.onRefresh, options.onError]);

  // Cancel subscription
  const cancel = useCallback(async () => {
    if (!subscription) {
      throw new Error('No subscription to cancel');
    }

    // Cancel any in-flight request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(cancelEndpoint, {
        method: 'POST',
        signal: abortController.signal,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          subscriptionId: subscription.id,
        }),
      });

      if (abortController.signal.aborted) {
        return;
      }

      if (!response.ok) {
        throw new Error(`Failed to cancel subscription: ${response.statusText}`);
      }

      // Refresh subscription state
      await fetchSubscription();
    } catch (e) {
      if (abortController.signal.aborted) {
        return;
      }

      const error = e instanceof Error ? e : new Error('Failed to cancel subscription');
      setError(error);
      options.onError?.(error);
    } finally {
      if (!abortController.signal.aborted) {
        setIsLoading(false);
      }
    }
  }, [subscription, cancelEndpoint, fetchSubscription, options.onError]);

  // Open billing portal
  const openPortal = useCallback(
    async (returnUrl: string) => {
      if (!subscription?.customerId) {
        throw new Error('No customer ID available');
      }

      // Cancel any in-flight request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(portalEndpoint, {
          method: 'POST',
          signal: abortController.signal,
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            customerId: subscription.customerId,
            returnUrl,
          }),
        });

        if (abortController.signal.aborted) {
          return;
        }

        if (!response.ok) {
          throw new Error(`Failed to create portal session: ${response.statusText}`);
        }

        const data = await response.json();

        if (abortController.signal.aborted) {
          return;
        }

        // Redirect to portal URL
        if (data.url) {
          window.location.href = data.url;
        }
      } catch (e) {
        if (abortController.signal.aborted) {
          return;
        }

        const error = e instanceof Error ? e : new Error('Failed to open portal');
        setError(error);
        options.onError?.(error);
      } finally {
        if (!abortController.signal.aborted) {
          setIsLoading(false);
        }
      }
    },
    [subscription, portalEndpoint, options.onError]
  );

  // Fetch subscription on mount or when customerId/userId changes
  useEffect(() => {
    fetchSubscription();
  }, [fetchSubscription]);

  return {
    cancel,
    error,
    isLoading,
    openPortal,
    refresh,
    subscription,
  };
}

