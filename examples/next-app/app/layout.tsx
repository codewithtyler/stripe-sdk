import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { PaymentProviderWrapper } from '@/components/PaymentProviderWrapper';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Stripe SDK Example',
  description: 'Example Next.js app using Stripe SDK',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <PaymentProviderWrapper>
          {children}
        </PaymentProviderWrapper>
      </body>
    </html>
  );
}

