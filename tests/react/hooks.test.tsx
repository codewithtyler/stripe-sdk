/**
 * Tests for React hooks (useCheckout, useSubscription, useCustomer).
 * Tests loading states, success/error handling, and cleanup.
 */

import React from 'react';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useCheckout } from '../../src/react/hooks/useCheckout';
import { useSubscription } from '../../src/react/hooks/useSubscription';
import { useCustomer } from '../../src/react/hooks/useCustomer';
import { PaymentProvider } from '../../src/react/provider';
import { createMemoryAdapter } from '../../src/adapters/memory';
import { StripeProvider } from '../../src/providers/stripe/index';
import type { ReactNode } from 'react';

// Mock window.location
const mockLocation = { href: '' };
Object.defineProperty(window, 'location', {
  value: mockLocation,
  writable: true,
});

// Mock fetch
global.fetch = vi.fn();

describe('React Hooks', () => {
  let provider: StripeProvider;
  let wrapper: ({ children }: { children: ReactNode }) => JSX.Element;

  beforeEach(() => {
    const cache = createMemoryAdapter();
    provider = new StripeProvider({
      cache,
      config: {
        secretKey: 'sk_test_mock_key_1234567890',
        webhookSecret: 'whsec_mock_webhook_secret_1234567890',
      },
    });

    wrapper = ({ children }: { children: ReactNode }) => (
      <PaymentProvider provider={provider}>{children}</PaymentProvider>
    );

    vi.clearAllMocks();
    mockLocation.href = '';
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('useCheckout', () => {
    it('should initialize with default state', () => {
      const { result } = renderHook(() => useCheckout(), { wrapper });

      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBe(null);
      expect(result.current.session).toBe(null);
      expect(typeof result.current.checkout).toBe('function');
      expect(typeof result.current.reset).toBe('function');
    });

    it('should create checkout session successfully', async () => {
      const mockSession = {
        session: {
          id: 'cs_test_123',
          url: 'https://checkout.stripe.com/c/pay/cs_test_123',
          status: 'open' as const,
        },
      };

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => mockSession,
      });

      const { result } = renderHook(
        () =>
          useCheckout({
            priceId: 'price_123',
            successUrl: 'https://example.com/success',
            cancelUrl: 'https://example.com/cancel',
            endpoint: '/api/checkout',
          }),
        { wrapper }
      );

      await act(async () => {
        await result.current.checkout();
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.session).toEqual(mockSession.session);
      expect(result.current.error).toBe(null);
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/checkout',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        })
      );
    });

    it('should handle loading state', async () => {
      let resolveFetch: (value: any) => void;
      const fetchPromise = new Promise((resolve) => {
        resolveFetch = resolve;
      });

      (global.fetch as ReturnType<typeof vi.fn>).mockReturnValueOnce(fetchPromise);

      const { result } = renderHook(
        () =>
          useCheckout({
            priceId: 'price_123',
            successUrl: 'https://example.com/success',
            cancelUrl: 'https://example.com/cancel',
          }),
        { wrapper }
      );

      act(() => {
        result.current.checkout();
      });

      expect(result.current.isLoading).toBe(true);

      await act(async () => {
        resolveFetch!({
          ok: true,
          json: async () => ({
            session: {
              id: 'cs_test_123',
              url: 'https://checkout.stripe.com/c/pay/cs_test_123',
              status: 'open' as const,
            },
          }),
        });
        await fetchPromise;
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
    });

    it('should handle error state', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        json: async () => ({ message: 'Invalid price ID' }),
      });

      const { result } = renderHook(
        () =>
          useCheckout({
            priceId: 'price_123',
            successUrl: 'https://example.com/success',
            cancelUrl: 'https://example.com/cancel',
          }),
        { wrapper }
      );

      await act(async () => {
        await result.current.checkout();
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.error).toBeInstanceOf(Error);
      expect(result.current.error?.message).toContain('Invalid price ID');
      expect(result.current.session).toBe(null);
    });

    it('should call onSuccess callback', async () => {
      const onSuccess = vi.fn();
      const mockSession = {
        session: {
          id: 'cs_test_123',
          url: 'https://checkout.stripe.com/c/pay/cs_test_123',
          status: 'open' as const,
        },
      };

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => mockSession,
      });

      const { result } = renderHook(
        () =>
          useCheckout({
            priceId: 'price_123',
            successUrl: 'https://example.com/success',
            cancelUrl: 'https://example.com/cancel',
            onSuccess,
          }),
        { wrapper }
      );

      await act(async () => {
        await result.current.checkout();
      });

      await waitFor(() => {
        expect(onSuccess).toHaveBeenCalledWith(mockSession.session);
      });
    });

    it('should call onError callback', async () => {
      const onError = vi.fn();

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: async () => ({ message: 'Server error' }),
      });

      const { result } = renderHook(
        () =>
          useCheckout({
            priceId: 'price_123',
            successUrl: 'https://example.com/success',
            cancelUrl: 'https://example.com/cancel',
            onError,
          }),
        { wrapper }
      );

      await act(async () => {
        await result.current.checkout();
      });

      await waitFor(() => {
        expect(onError).toHaveBeenCalled();
      });
    });

    it('should reset state', async () => {
      const mockSession = {
        session: {
          id: 'cs_test_123',
          url: 'https://checkout.stripe.com/c/pay/cs_test_123',
          status: 'open' as const,
        },
      };

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => mockSession,
      });

      const { result } = renderHook(
        () =>
          useCheckout({
            priceId: 'price_123',
            successUrl: 'https://example.com/success',
            cancelUrl: 'https://example.com/cancel',
          }),
        { wrapper }
      );

      await act(async () => {
        await result.current.checkout();
      });

      await waitFor(() => {
        expect(result.current.session).toBeTruthy();
      });

      act(() => {
        result.current.reset();
      });

      expect(result.current.session).toBe(null);
      expect(result.current.error).toBe(null);
      expect(result.current.isLoading).toBe(false);
    });

    it('should handle abort signal', async () => {
      let fetchSignal: AbortSignal | undefined;
      (global.fetch as ReturnType<typeof vi.fn>).mockImplementation((url, options) => {
        // Capture the signal to verify it exists
        fetchSignal = options?.signal as AbortSignal;
        return new Promise(() => {}); // Never resolves
      });

      const { result, unmount } = renderHook(
        () =>
          useCheckout({
            priceId: 'price_123',
            successUrl: 'https://example.com/success',
            cancelUrl: 'https://example.com/cancel',
          }),
        { wrapper }
      );

      act(() => {
        result.current.checkout();
      });

      // Wait for fetch to be called and loading state to be true
      await waitFor(() => {
        expect(result.current.isLoading).toBe(true);
        expect(fetchSignal).toBeDefined();
      });

      // Verify signal was passed to fetch and is not aborted yet
      expect(fetchSignal?.aborted).toBe(false);

      // Unmount should abort the request and clean up without errors
      // The hook's cleanup effect will abort the controller
      unmount();

      // Give cleanup time to run
      await new Promise((resolve) => setTimeout(resolve, 50));

      // The signal should now be aborted (cleanup ran)
      expect(fetchSignal?.aborted).toBe(true);
    });
  });

  describe('useSubscription', () => {
    it('should initialize with default state', async () => {
      // Mock the initial fetch call
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ subscription: null }),
      });

      const { result } = renderHook(() => useSubscription({ customerId: 'cus_123' }), {
        wrapper,
      });

      // Wait for initial fetch to complete
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.error).toBe(null);
      expect(result.current.subscription).toBe(null);
      expect(typeof result.current.refresh).toBe('function');
      expect(typeof result.current.cancel).toBe('function');
      expect(typeof result.current.openPortal).toBe('function');
    });

    it('should fetch subscription successfully', async () => {
      const mockSubscription = {
        subscription: {
          id: 'sub_123',
          customerId: 'cus_123',
          status: 'active' as const,
          currentPeriodEnd: new Date(),
          currentPeriodStart: new Date(),
          cancelAtPeriodEnd: false,
          items: [],
        },
      };

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => mockSubscription,
      });

      const { result } = renderHook(
        () => useSubscription({ customerId: 'cus_123', fetchEndpoint: '/api/subscription' }),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.subscription).toEqual(mockSubscription.subscription);
      expect(result.current.error).toBe(null);
    });

    it('should handle 404 (no subscription)', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      });

      const { result } = renderHook(
        () => useSubscription({ customerId: 'cus_123' }),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.subscription).toBe(null);
      expect(result.current.error).toBe(null);
    });

    it('should refresh subscription', async () => {
      const mockSubscription = {
        subscription: {
          id: 'sub_123',
          customerId: 'cus_123',
          status: 'active' as const,
          currentPeriodEnd: new Date(),
          currentPeriodStart: new Date(),
          cancelAtPeriodEnd: false,
          items: [],
        },
      };

      (global.fetch as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ subscription: null }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockSubscription,
        });

      const { result } = renderHook(
        () =>
          useSubscription({
            customerId: 'cus_123',
            refreshEndpoint: '/api/subscription/refresh',
          }),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.refresh();
      });

      await waitFor(() => {
        expect(result.current.subscription).toEqual(mockSubscription.subscription);
      });
    });

    it('should cancel subscription', async () => {
      const mockSubscription = {
        subscription: {
          id: 'sub_123',
          customerId: 'cus_123',
          status: 'active' as const,
          currentPeriodEnd: new Date(),
          currentPeriodStart: new Date(),
          cancelAtPeriodEnd: false,
          items: [],
        },
      };

      (global.fetch as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ subscription: mockSubscription.subscription }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({}),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            subscription: { ...mockSubscription.subscription, status: 'canceled' as const },
          }),
        });

      const { result } = renderHook(
        () =>
          useSubscription({
            customerId: 'cus_123',
            cancelEndpoint: '/api/subscription/cancel',
          }),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.subscription).toBeTruthy();
      });

      await act(async () => {
        await result.current.cancel();
      });

      await waitFor(() => {
        expect(result.current.subscription?.status).toBe('canceled');
      });
    });
  });

  describe('useCustomer', () => {
    it('should initialize with default state', async () => {
      // Mock the initial fetch call
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ customer: null }),
      });

      const { result } = renderHook(() => useCustomer({ customerId: 'cus_123' }), {
        wrapper,
      });

      // Wait for initial fetch to complete
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.error).toBe(null);
      expect(result.current.customer).toBe(null);
      expect(typeof result.current.refresh).toBe('function');
    });

    it('should fetch customer successfully', async () => {
      const mockCustomer = {
        customer: {
          id: 'cus_123',
          email: 'test@example.com',
          name: 'Test User',
          createdAt: new Date(),
        },
      };

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => mockCustomer,
      });

      const { result } = renderHook(
        () => useCustomer({ customerId: 'cus_123', fetchEndpoint: '/api/customer' }),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.customer).toEqual(mockCustomer.customer);
      expect(result.current.error).toBe(null);
    });

    it('should handle 404 (customer not found)', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      });

      const { result } = renderHook(() => useCustomer({ customerId: 'cus_not_found' }), {
        wrapper,
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.customer).toBe(null);
      expect(result.current.error).toBe(null);
    });

    it('should refresh customer', async () => {
      const mockCustomer = {
        customer: {
          id: 'cus_123',
          email: 'test@example.com',
        },
      };

      (global.fetch as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ customer: null }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockCustomer,
        });

      const { result } = renderHook(() => useCustomer({ customerId: 'cus_123' }), {
        wrapper,
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.refresh();
      });

      await waitFor(() => {
        expect(result.current.customer).toEqual(mockCustomer.customer);
      });
    });
  });
});

