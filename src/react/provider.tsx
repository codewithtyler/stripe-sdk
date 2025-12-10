/**
 * PaymentProvider React component.
 * Provides payment provider context to child components.
 */

import type { ReactNode } from 'react';
import type { PaymentProvider } from '../core/types';
import { PaymentContext } from './context';

/**
 * Props for PaymentProvider component.
 */
export interface PaymentProviderProps {
  /** Payment provider instance */
  provider: PaymentProvider;
  /** Child components */
  children: ReactNode;
}

/**
 * PaymentProvider component.
 * Wraps your app to provide payment provider context.
 *
 * @param props - Component props
 * @returns Provider component
 *
 * @example
 * ```tsx
 * import { PaymentProvider } from '@stripe-sdk/react';
 * import { stripe } from '@stripe-sdk/providers';
 *
 * function App() {
 *   const provider = stripe({ cache: memoryCache() });
 *
 *   return (
 *     <PaymentProvider provider={provider}>
 *       <YourApp />
 *     </PaymentProvider>
 *   );
 * }
 * ```
 */
export function PaymentProvider({
  provider,
  children,
}: PaymentProviderProps): JSX.Element {
  return (
    <PaymentContext.Provider value={{ provider }}>
      {children}
    </PaymentContext.Provider>
  );
}

