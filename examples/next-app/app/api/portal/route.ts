import { createPortalHandler } from '@stripe-sdk/next';
import { stripeProvider } from '@/lib/stripe';

const handler = createPortalHandler({
  provider: stripeProvider,
});

export { handler as POST };

