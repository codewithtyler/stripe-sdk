import { createCheckoutHandler } from '@stripe-sdk/next';
import { stripeProvider } from '@/lib/stripe';

const handler = createCheckoutHandler({
  provider: stripeProvider,
});

export { handler as POST };

