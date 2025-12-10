/**
 * React hook for managing customer data.
 * Fetches customer information and provides refresh functionality.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import type { Customer } from '../../core/types';
import { usePaymentProvider } from '../context';

/**
 * Options for useCustomer hook.
 */
export interface UseCustomerOptions {
  /** Customer ID to fetch */
  customerId?: string;
  /** Customer email to fetch (alternative to customerId) */
  email?: string;
  /** User ID to fetch customer for (alternative to customerId/email) */
  userId?: string;
  /** API endpoint to fetch customer (default: /api/customer) */
  fetchEndpoint?: string;
  /** Callback invoked when customer is loaded */
  onLoad?: (customer: Customer | null) => void;
  /** Callback invoked when refresh succeeds */
  onRefresh?: (customer: Customer) => void;
  /** Callback invoked when operation fails */
  onError?: (error: Error) => void;
}

/**
 * Return type for useCustomer hook.
 */
export interface UseCustomerReturn {
  /** Current customer data */
  customer: Customer | null;
  /** Whether customer is loading */
  isLoading: boolean;
  /** Error if operation failed */
  error: Error | null;
  /** Refresh customer data */
  refresh: () => Promise<void>;
}

/**
 * Hook for managing customer data.
 * Fetches customer information from API.
 *
 * @param options - Customer options and callbacks
 * @returns Customer state and functions
 *
 * @example
 * ```tsx
 * const { customer, isLoading, refresh } = useCustomer({
 *   customerId: 'cus_123',
 *   onLoad: (customer) => console.log('Loaded:', customer),
 * });
 *
 * <button onClick={refresh}>Refresh</button>
 * ```
 */
export function useCustomer(
  options: UseCustomerOptions = {}
): UseCustomerReturn {
  const { provider } = usePaymentProvider();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchEndpoint = options.fetchEndpoint || '/api/customer';

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // Fetch customer
  const fetchCustomer = useCallback(async () => {
    if (!options.customerId && !options.email && !options.userId) {
      setCustomer(null);
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
      if (options.email) {
        params.set('email', options.email);
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
          setCustomer(null);
          options.onLoad?.(null);
          return;
        }
        throw new Error(`Failed to fetch customer: ${response.statusText}`);
      }

      const data = await response.json();
      const cust: Customer | null = data.customer || null;

      if (abortController.signal.aborted) {
        return;
      }

      setCustomer(cust);
      options.onLoad?.(cust);
    } catch (e) {
      if (abortController.signal.aborted) {
        return;
      }

      const error = e instanceof Error ? e : new Error('Failed to fetch customer');
      setError(error);
      options.onError?.(error);
    } finally {
      if (!abortController.signal.aborted) {
        setIsLoading(false);
      }
    }
  }, [
    options.customerId,
    options.email,
    options.userId,
    fetchEndpoint,
    options.onLoad,
    options.onError,
  ]);

  // Refresh customer data
  const refresh = useCallback(async () => {
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
      if (options.email) {
        params.set('email', options.email);
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
          setCustomer(null);
          options.onLoad?.(null);
          return;
        }
        throw new Error(`Failed to refresh customer: ${response.statusText}`);
      }

      const data = await response.json();
      const cust: Customer | null = data.customer || null;

      if (abortController.signal.aborted) {
        return;
      }

      setCustomer(cust);
      options.onRefresh?.(cust!);
    } catch (e) {
      if (abortController.signal.aborted) {
        return;
      }

      const error = e instanceof Error ? e : new Error('Failed to refresh customer');
      setError(error);
      options.onError?.(error);
    } finally {
      if (!abortController.signal.aborted) {
        setIsLoading(false);
      }
    }
  }, [
    options.customerId,
    options.email,
    options.userId,
    fetchEndpoint,
    options.onLoad,
    options.onRefresh,
    options.onError,
  ]);

  // Fetch customer on mount or when identifiers change
  useEffect(() => {
    fetchCustomer();
  }, [fetchCustomer]);

  return {
    customer,
    error,
    isLoading,
    refresh,
  };
}

