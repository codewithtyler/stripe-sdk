/**
 * React context for payment provider.
 * Provides type-safe access to the payment provider instance.
 */

import { createContext, useContext } from 'react';
import type { PaymentProvider } from '../core/types';

/**
 * Payment context value.
 * Contains the payment provider instance.
 */
export interface PaymentContextValue {
  /** Payment provider instance */
  provider: PaymentProvider;
}

/**
 * Payment context.
 * Use PaymentProvider component to provide this context.
 */
export const PaymentContext = createContext<PaymentContextValue | null>(null);

/**
 * Hook to access the payment provider from context.
 * @returns Payment context value
 * @throws Error if used outside PaymentProvider
 *
 * @example
 * ```tsx
 * const { provider } = usePaymentProvider();
 * ```
 */
export function usePaymentProvider(): PaymentContextValue {
  const context = useContext(PaymentContext);

  if (!context) {
    throw new Error(
      'usePaymentProvider must be used within a PaymentProvider component'
    );
  }

  return context;
}

