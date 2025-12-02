# Complete Stripe SDK Implementation Guide for Cursor AI

**Goal:** Build a production-ready "dead simple" Stripe SDK that matches Vercel AI SDK's ease of use in 1-2 days using Cursor 2.0's multi-agent capabilities.

**Target Developer Experience:**

```tsx
import { stripe } from '@stripe-sdk/provider';
import { useCheckout } from '@stripe-sdk/react';

const { checkout, isLoading, error } = useCheckout({
  provider: stripe,
  priceId: 'price_monthly',
  onSuccess: () => router.push('/dashboard')
});
```

---

## Implementation Strategy

### Timeline: 1-2 Days

**Day 1 (8-10 hours):**

- Hours 1-3: Create spec.md, patterns/, configure workspace
- Hours 3-4: Set up git worktrees for parallel development
- Hours 4-8: Deploy 8 parallel agents on core modules with TDD
- Hours 8-10: Review, merge best implementations

**Day 2 (6-8 hours):**

- Hours 1-4: Feature modules in parallel (streaming, webhooks)
- Hours 4-6: Integration testing, documentation generation
- Hours 6-8: Polish, edge cases, final review

### Multi-Agent Allocation

Run these simultaneously in separate git worktrees:

| Agent | Task | Model | Worktree |
|-------|------|-------|----------|
| Agent 1 | Core provider interface | Claude Sonnet 4 | ../sdk-core |
| Agent 2 | Core provider (variant) | Composer | ../sdk-core-alt |
| Agent 3 | React hooks | Composer | ../sdk-react |
| Agent 4 | Next.js API routes | Composer | ../sdk-next |
| Agent 5 | TypeScript types | GPT-4.1 | ../sdk-types |
| Agent 6 | Test suite | Composer | ../sdk-tests |
| Agent 7 | Webhook handler | Claude Sonnet 4 | ../sdk-webhooks |
| Agent 8 | Documentation | Gemini 2.5 Pro | ../sdk-docs |

---

## Project Structure (Create This Exactly)

```text
stripe-sdk/
├── .cursor/
│   └── rules/
│       ├── development.md
│       └── testing.md
├── src/
│   ├── core/
│   │   ├── provider.ts           # PaymentProvider interface
│   │   ├── types.ts               # Shared TypeScript types
│   │   ├── errors.ts              # Error classes
│   │   └── config.ts              # Environment variable loading
│   ├── providers/
│   │   ├── stripe/
│   │   │   ├── index.ts           # Stripe provider implementation
│   │   │   ├── config.ts          # Stripe-specific config
│   │   │   ├── webhooks.ts        # Signature verification
│   │   │   └── api.ts             # API call wrappers
│   │   └── index.ts               # Provider exports
│   ├── react/
│   │   ├── provider.tsx           # <PaymentProvider> component
│   │   ├── context.tsx            # React Context
│   │   ├── hooks/
│   │   │   ├── useCheckout.ts
│   │   │   ├── useSubscription.ts
│   │   │   ├── usePayment.ts
│   │   │   └── useCustomer.ts
│   │   └── index.ts               # Hook exports
│   ├── next/
│   │   ├── api/
│   │   │   ├── create-checkout.ts
│   │   │   ├── create-subscription.ts
│   │   │   └── webhook.ts
│   │   └── index.ts
│   └── index.ts                   # Main package export
├── tests/
│   ├── core/
│   ├── providers/
│   ├── react/
│   └── next/
├── patterns/                      # Reference implementations
│   ├── ai-sdk-provider.ts         # Example from Vercel AI SDK
│   ├── hook-pattern.ts            # React hook best practices
│   └── webhook-handler.ts         # Secure webhook processing
├── examples/
│   └── next-app/                  # Working example application
├── docs/
│   ├── getting-started.md
│   ├── api-reference.md
│   └── migration-guide.md
├── spec.md                        # Technical specification (CREATE FIRST)
├── status.md                      # Context restoration file
├── package.json
├── tsconfig.json
├── vitest.config.ts
└── README.md
```

---

## Technical Specification (spec.md)

Create this file first. All agents reference it.

```markdown
# Stripe SDK Technical Specification

## Architecture Overview

### Provider Pattern (Following Vercel AI SDK)
All payment providers implement a unified `PaymentProvider` interface. Switching providers requires changing 2 lines (import + provider name).

### Core Principles
1. **Convention Over Configuration**: API keys auto-load from environment
2. **Hook-based State Management**: Zero manual state management code
3. **Type Safety**: Full TypeScript coverage with proper generics
4. **Streaming-first**: WebSockets for real-time payment status updates

## Module Boundaries

### Core Module (`src/core/`)
**Responsibility:** Provider interface, base types, error handling

**Key Exports:**
- `PaymentProvider` interface
- `PaymentConfig` type
- Base error classes: `PaymentError`, `WebhookError`, `ConfigError`

**Dependencies:** None (pure interfaces)

### Providers Module (`src/providers/`)
**Responsibility:** Provider implementations (Stripe initially)

**Key Exports:**
- `stripe()` provider factory
- Stripe-specific types

**Dependencies:**
- `stripe` npm package (^17.5.0)
- `src/core/*`

### React Module (`src/react/`)
**Responsibility:** React hooks and context

**Key Exports:**
- `<PaymentProvider>` component
- `useCheckout()`, `useSubscription()`, `usePayment()`, `useCustomer()`

**Dependencies:**
- `react` (^18.3.1)
- `src/core/*`

### Next.js Module (`src/next/`)
**Responsibility:** API routes and server actions

**Key Exports:**
- `createCheckoutHandler()`
- `createWebhookHandler()`
- `createSubscriptionHandler()`

**Dependencies:**
- `next` (^15.0.0)
- `src/core/*`
- `src/providers/*`

## Type Definitions

### Core Types

```typescript
// src/core/types.ts

export interface PaymentProvider {
  name: string;

  createCheckout(options: CheckoutOptions): Promise<CheckoutSession>;
  createSubscription(options: SubscriptionOptions): Promise<Subscription>;
  createCustomer(data: CustomerData): Promise<Customer>;
  verifyWebhook(payload: string, signature: string): WebhookEvent;
  createPortalSession(customerId: string): Promise<PortalSession>;
}

export interface CheckoutOptions {
  priceId: string;
  successUrl: string;
  cancelUrl: string;
  customerEmail?: string;
  metadata?: Record<string, string>;
  mode?: 'payment' | 'subscription' | 'setup';
}

export interface CheckoutSession {
  id: string;
  url: string;
  status: 'open' | 'complete' | 'expired';
  customerId?: string;
  metadata?: Record<string, string>;
}

export interface SubscriptionOptions {
  customerId: string;
  priceId: string;
  trialDays?: number;
  metadata?: Record<string, string>;
}

export interface Subscription {
  id: string;
  customerId: string;
  status: 'active' | 'past_due' | 'canceled' | 'incomplete';
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
  items: SubscriptionItem[];
}

export interface SubscriptionItem {
  id: string;
  priceId: string;
  quantity: number;
}

export interface CustomerData {
  email: string;
  name?: string;
  metadata?: Record<string, string>;
}

export interface Customer {
  id: string;
  email: string;
  name?: string;
  metadata?: Record<string, string>;
}

export interface WebhookEvent {
  id: string;
  type: string;
  data: any;
  created: Date;
}

export interface PortalSession {
  url: string;
}

export interface PaymentConfig {
  apiKey: string;
  webhookSecret?: string;
}
```

### React Hook Return Types

```typescript
// src/react/types.ts

export interface UseCheckoutReturn {
  checkout: (options?: Partial<CheckoutOptions>) => Promise<void>;
  isLoading: boolean;
  error: Error | null;
  session: CheckoutSession | null;
  reset: () => void;
}

export interface UseSubscriptionReturn {
  subscribe: (options?: Partial<SubscriptionOptions>) => Promise<void>;
  cancel: () => Promise<void>;
  isLoading: boolean;
  error: Error | null;
  subscription: Subscription | null;
  openPortal: () => Promise<void>;
}

export interface UsePaymentReturn {
  createPaymentIntent: (amount: number, currency: string) => Promise<string>;
  isLoading: boolean;
  error: Error | null;
  clientSecret: string | null;
}

export interface UseCustomerReturn {
  customer: Customer | null;
  isLoading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}
```

## Error Handling Strategy

### Error Classes

```typescript
// src/core/errors.ts

export class PaymentError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500
  ) {
    super(message);
    this.name = 'PaymentError';
  }
}

export class WebhookError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'WebhookError';
  }
}

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigError';
  }
}
```

### Error Codes

| Code | Meaning | HTTP Status |
|------|---------|-------------|
| `INVALID_CONFIG` | Missing or invalid configuration | 500 |
| `INVALID_REQUEST` | Invalid request parameters | 400 |
| `WEBHOOK_SIGNATURE_INVALID` | Webhook signature verification failed | 401 |
| `PAYMENT_FAILED` | Payment processing failed | 402 |
| `NOT_FOUND` | Resource not found | 404 |
| `RATE_LIMITED` | Too many requests | 429 |

## Streaming Implementation

Not required for MVP. Future enhancement for real-time payment status.

## Tool Calling Interface

Not required for MVP. Future enhancement for AI-assisted checkout flows.

## Security Considerations

### API Key Storage

- Never log API keys
- Load from environment variables only
- Validate presence on initialization
- Support both test and live mode keys

### Webhook Signature Verification

- Always verify signatures before processing
- Use constant-time comparison
- Reject webhooks with invalid signatures immediately
- Log verification failures for monitoring

### CSRF Protection

- Next.js API routes use built-in CSRF tokens
- Validate origin headers
- Use secure session cookies

## Testing Strategy

### Unit Tests (Vitest)

- Mock all Stripe API calls
- Test loading, success, and error states
- Verify type safety
- Test error handling paths

### Integration Tests

- Use Stripe test mode
- Verify end-to-end checkout flows
- Test webhook processing
- Validate subscription lifecycle

### E2E Tests (Optional)

- Playwright for full user flows
- Test in example Next.js app

## Performance Targets

- Hook initialization: < 10ms
- API route response: < 200ms
- Webhook processing: < 500ms
- Bundle size: < 50kb (gzipped)

## Browser Support

- Modern browsers (Chrome, Firefox, Safari, Edge)
- No IE11 support
- React 18+ required

## Deployment Considerations

- Webhook endpoint must be publicly accessible
- SSL required for production webhooks
- Set up Stripe webhook in dashboard
- Configure environment variables in deployment platform

---

## Cursor Rules (.cursor/rules/development.md)

```markdown
---
description: Stripe SDK development standards
globs: ["src/**/*.ts", "src/**/*.tsx"]
alwaysApply: true
---

## Code Quality Standards

- Use TypeScript strict mode (no implicit any)
- All public functions MUST have JSDoc comments
- Prefer async/await over .then() chains
- Error handling: wrap all provider calls in try/catch
- Never replace code with placeholders like `// ... rest of code`
- Always include complete code when making modifications

## Naming Conventions

- Interfaces: PascalCase (e.g., PaymentProvider)
- Types: PascalCase with descriptive names
- Functions: camelCase with verb prefix (e.g., createCheckout)
- Hooks: useX pattern (e.g., useCheckout)
- API routes: kebab-case files (e.g., create-checkout.ts)
- Constants: UPPER_SNAKE_CASE

## Import Order

1. React imports (if applicable)
2. Third-party packages
3. Internal core imports (src/core/*)
4. Internal provider imports (src/providers/*)
5. Internal types
6. Relative imports

## Stripe-Specific Rules

- Always check for stripe initialization before API calls
- Never log Stripe API keys or secrets
- All webhook handlers MUST verify signatures first
- Use Stripe's official TypeScript types where available
- Handle rate limiting with exponential backoff

## Testing Requirements

- Every hook needs minimum 3 test cases:
  1. Success case
  2. Error case
  3. Loading state
- Mock all external API calls
- Test files must be adjacent to implementation
- Use descriptive test names: "should X when Y"

## File Organization

- Keep files under 500 lines
- One primary export per file
- Group related functionality
- Separate concerns (types, logic, UI)

## React Patterns

- Hooks must follow Rules of Hooks
- Clean up side effects in useEffect
- Memoize expensive computations
- Avoid prop drilling (use Context)

## Breaking Changes Protocol

Think through changes before modifying:
1. Provide PLAN with REASONING first
2. List all files that will be affected
3. Wait for approval before proceeding
4. Only modify code directly relevant to request
```

---

## Reference Patterns

### Pattern 1: Provider Interface (patterns/ai-sdk-provider.ts)

```typescript
// Based on Vercel AI SDK's provider pattern
// This is the exact pattern to follow for payment providers

interface LanguageModelV1 {
  // Provider identification
  readonly provider: string;
  readonly modelId: string;

  // Core methods
  doGenerate(options: GenerateOptions): Promise<GenerateResult>;
  doStream(options: StreamOptions): AsyncIterable<StreamPart>;
}

// Our payment provider follows identical structure:
interface PaymentProvider {
  readonly name: string; // e.g., "stripe"

  // Core payment methods
  createCheckout(options: CheckoutOptions): Promise<CheckoutSession>;
  createSubscription(options: SubscriptionOptions): Promise<Subscription>;

  // Webhook handling
  verifyWebhook(payload: string, signature: string): WebhookEvent;
}

// Provider factory function (same pattern as AI SDK)
export function stripe(config?: StripeConfig): PaymentProvider {
  const apiKey = config?.apiKey ?? process.env.STRIPE_SECRET_KEY;

  if (!apiKey) {
    throw new ConfigError('Missing STRIPE_SECRET_KEY');
  }

  return {
    name: 'stripe',

    async createCheckout(options) {
      // Implementation
    },

    async createSubscription(options) {
      // Implementation
    },

    verifyWebhook(payload, signature) {
      // Implementation
    }
  };
}
```

### Pattern 2: React Hook Structure (patterns/hook-pattern.ts)

```typescript
// Based on Vercel AI SDK's useChat hook
// Follow this exact structure for all payment hooks

import { useState, useCallback } from 'react';
import { usePaymentProvider } from './context';

export function useCheckout(options: UseCheckoutOptions = {}) {
  const provider = usePaymentProvider();

  // State management (all hooks follow this pattern)
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [session, setSession] = useState<CheckoutSession | null>(null);

  // Main action (async, with full error handling)
  const checkout = useCallback(async (overrideOptions?: Partial<CheckoutOptions>) => {
    setIsLoading(true);
    setError(null);

    try {
      const mergedOptions = { ...options, ...overrideOptions };
      const result = await provider.createCheckout(mergedOptions);
      setSession(result);

      // Redirect to checkout URL
      if (result.url) {
        window.location.href = result.url;
      }

      options.onSuccess?.(result);
    } catch (e) {
      const error = e instanceof Error ? e : new Error('Checkout failed');
      setError(error);
      options.onError?.(error);
    } finally {
      setIsLoading(false);
    }
  }, [provider, options]);

  // Reset function (standard pattern)
  const reset = useCallback(() => {
    setSession(null);
    setError(null);
  }, []);

  // Return object (alphabetically sorted for consistency)
  return {
    checkout,
    error,
    isLoading,
    reset,
    session,
  };
}

// TypeScript for hook options
interface UseCheckoutOptions extends Partial<CheckoutOptions> {
  onSuccess?: (session: CheckoutSession) => void;
  onError?: (error: Error) => void;
}
```

### Pattern 3: Webhook Handler (patterns/webhook-handler.ts)

```typescript
// Secure webhook processing pattern
// Never skip signature verification

import type { NextRequest } from 'next/server';

export function createWebhookHandler(
  provider: PaymentProvider,
  handlers: WebhookHandlers
) {
  return async (request: NextRequest) => {
    // 1. Get raw body (required for signature verification)
    const body = await request.text();

    // 2. Get signature from headers
    const signature = request.headers.get('stripe-signature');

    if (!signature) {
      return new Response('Missing signature', { status: 401 });
    }

    // 3. Verify signature (ALWAYS DO THIS FIRST)
    let event: WebhookEvent;
    try {
      event = provider.verifyWebhook(body, signature);
    } catch (e) {
      console.error('Webhook signature verification failed:', e);
      return new Response('Invalid signature', { status: 401 });
    }

    // 4. Route to appropriate handler
    try {
      switch (event.type) {
        case 'checkout.session.completed':
          await handlers.onCheckoutComplete?.(event.data);
          break;

        case 'customer.subscription.created':
          await handlers.onSubscriptionCreated?.(event.data);
          break;

        case 'customer.subscription.updated':
          await handlers.onSubscriptionUpdated?.(event.data);
          break;

        case 'customer.subscription.deleted':
          await handlers.onSubscriptionCanceled?.(event.data);
          break;

        default:
          console.log('Unhandled webhook event:', event.type);
      }
    } catch (e) {
      console.error('Webhook handler error:', e);
      return new Response('Handler failed', { status: 500 });
    }

    // 5. Always return 200 to acknowledge receipt
    return new Response('OK', { status: 200 });
  };
}

// Type-safe webhook handlers
interface WebhookHandlers {
  onCheckoutComplete?: (data: any) => Promise<void>;
  onSubscriptionCreated?: (data: any) => Promise<void>;
  onSubscriptionUpdated?: (data: any) => Promise<void>;
  onSubscriptionCanceled?: (data: any) => Promise<void>;
}
```

### Pattern 4: Actual Stripe API Calls (DO NOT DEVIATE)

```typescript
// Use these EXACT patterns for all Stripe API calls
// These are verified working implementations

import Stripe from 'stripe';

// Initialize Stripe client (singleton pattern)
let stripeInstance: Stripe | null = null;

function getStripeClient(apiKey: string): Stripe {
  if (!stripeInstance) {
    stripeInstance = new Stripe(apiKey, {
      apiVersion: '2024-11-20.acacia', // Use latest API version
      typescript: true,
    });
  }
  return stripeInstance;
}

// Creating checkout session
async function createCheckoutSession(
  stripe: Stripe,
  options: CheckoutOptions
): Promise<CheckoutSession> {
  const session = await stripe.checkout.sessions.create({
    line_items: [{
      price: options.priceId,
      quantity: 1,
    }],
    mode: options.mode ?? 'subscription',
    success_url: options.successUrl,
    cancel_url: options.cancelUrl,
    customer_email: options.customerEmail,
    metadata: options.metadata,
  });

  return {
    id: session.id,
    url: session.url!,
    status: session.status ?? 'open',
    customerId: session.customer as string | undefined,
    metadata: session.metadata ?? undefined,
  };
}

// Creating subscription
async function createSubscription(
  stripe: Stripe,
  options: SubscriptionOptions
): Promise<Subscription> {
  const subscription = await stripe.subscriptions.create({
    customer: options.customerId,
    items: [{
      price: options.priceId,
    }],
    trial_period_days: options.trialDays,
    metadata: options.metadata,
  });

  return {
    id: subscription.id,
    customerId: subscription.customer as string,
    status: subscription.status,
    currentPeriodEnd: new Date(subscription.current_period_end * 1000),
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
    items: subscription.items.data.map(item => ({
      id: item.id,
      priceId: item.price.id,
      quantity: item.quantity ?? 1,
    })),
  };
}

// Verifying webhook signature
function verifyWebhook(
  stripe: Stripe,
  payload: string,
  signature: string,
  webhookSecret: string
): WebhookEvent {
  const event = stripe.webhooks.constructEvent(
    payload,
    signature,
    webhookSecret
  );

  return {
    id: event.id,
    type: event.type,
    data: event.data.object,
    created: new Date(event.created * 1000),
  };
}

// Creating customer
async function createCustomer(
  stripe: Stripe,
  data: CustomerData
): Promise<Customer> {
  const customer = await stripe.customers.create({
    email: data.email,
    name: data.name,
    metadata: data.metadata,
  });

  return {
    id: customer.id,
    email: customer.email!,
    name: customer.name ?? undefined,
    metadata: customer.metadata ?? undefined,
  };
}

// Creating portal session
async function createPortalSession(
  stripe: Stripe,
  customerId: string,
  returnUrl: string
): Promise<PortalSession> {
  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });

  return {
    url: session.url,
  };
}
```

---

## Pre-written Prompts for Each Phase

### Phase 1: Project Setup (30 minutes)

```text
Create the complete project structure following spec.md exactly.
Generate all directories and empty files. Set up:

1. package.json with exact dependencies:
   - stripe: ^17.5.0
   - react: ^18.3.1
   - next: ^15.0.0
   - typescript: ^5.7.2
   - vitest: ^2.1.8
   - @testing-library/react: ^16.1.0

2. tsconfig.json with strict mode enabled

3. vitest.config.ts with React testing setup

4. .cursor/rules/development.md (use rules provided above)

5. Create status.md with initial state

Do not write any implementation code yet. Just structure.
```

### Phase 2: Core Types & Interfaces (1 hour)

```text
Implement complete type definitions following spec.md section "Type Definitions".

Files to create:
- src/core/types.ts (all interfaces from spec)
- src/core/errors.ts (error classes from spec)
- src/core/provider.ts (PaymentProvider interface only)

Reference @spec.md for exact type signatures.

Write corresponding test files:
- tests/core/types.test.ts
- tests/core/errors.test.ts

Use JSDoc comments on all exports. No implementation logic yet,
just types and interfaces.
```

### Phase 3: Stripe Provider (2-3 hours, parallel agents)

**Agent 1 (Claude Sonnet 4):**

```text
Implement Stripe provider following @patterns/ai-sdk-provider.ts
and @patterns/webhook-handler.ts.

File: src/providers/stripe/index.ts

Use EXACT Stripe API patterns from @patterns/stripe-api.ts.
Do not invent API calls—copy the proven patterns.

Requirements:
1. Export stripe() factory function
2. Implement all PaymentProvider methods
3. Handle errors with proper error classes
4. Load config from environment variables
5. Write tests first, then implementation

Tests file: tests/providers/stripe/index.test.ts
Mock all Stripe API calls.
```

**Agent 2 (Composer - Variant):**

```text
Implement Stripe provider using a different approach than Agent 1.
Same requirements, different implementation strategy.

Focus on:
- Alternative error handling approach
- Different config validation
- Cleaner async handling

File: src/providers/stripe/index-alt.ts

We will compare both and pick the best.
```

### Phase 4: React Hooks (2-3 hours, parallel agents)

**Agent 3 (Composer):**

```text
Implement React hooks following @patterns/hook-pattern.ts exactly.

Files:
- src/react/context.tsx (PaymentProvider context)
- src/react/provider.tsx (<PaymentProvider> component)
- src/react/hooks/useCheckout.ts
- src/react/hooks/useSubscription.ts

Follow the EXACT structure from hook-pattern.ts:
1. State management with useState
2. Callbacks with useCallback
3. Error handling try/catch
4. Loading states
5. Success/error callbacks

Test files:
- tests/react/hooks/useCheckout.test.ts
- tests/react/hooks/useSubscription.test.ts

Write tests first, implement until tests pass.
```

### Phase 5: Next.js Integration (1-2 hours)

```text
Generate Next.js API route handlers following @patterns/webhook-handler.ts.

Files:
- src/next/api/create-checkout.ts
- src/next/api/webhook.ts

Requirements:
1. Use Next.js 15 route handler format
2. Proper error responses (JSON format)
3. CORS headers where needed
4. Rate limiting consideration

Webhook handler MUST:
1. Verify signature before processing
2. Handle all event types from spec.md
3. Return 200 immediately
4. Log errors but don't expose details

Test file: tests/next/api/webhook.test.ts
```

### Phase 6: Integration Testing (1-2 hours)

```text
Create end-to-end integration tests using real Stripe test mode.

File: tests/integration/checkout-flow.test.ts

Test scenarios:
1. Create checkout session
2. Handle successful payment webhook
3. Create subscription
4. Cancel subscription
5. Handle failed payment webhook

Use Stripe test mode API keys from environment.
Mock webhook signatures for local testing.
```

### Phase 7: Documentation (1 hour)

```text
Generate comprehensive documentation following example structure:

Files:
- README.md (installation, quick start, examples)
- docs/getting-started.md (step-by-step guide)
- docs/api-reference.md (all exports with JSDoc)

Use @Docs references to spec.md and implementation files.

Include:
1. Installation instructions
2. Environment variable setup
3. Basic usage example
4. Hook API reference
5. Webhook setup guide
6. Troubleshooting section
```

---

## Complete Copy-Paste Prompts for Cursor

### Phase 1: Foundation (Copy This to Cursor)

```text
I'm building a Stripe SDK following Vercel AI SDK patterns. Complete specification
is in @spec.md.

TASK: Implement Phase 1 (Foundation).

CRITICAL REQUIREMENTS:
1. Read the ENTIRE @spec.md first
2. Create ALL files with COMPLETE implementations
3. NO placeholders: "// ... rest of code..." or "// TODO: Implement"
4. NO incomplete functions or "TODO" comments
5. Use strict TypeScript - no 'any' types allowed
6. All public functions MUST have JSDoc comments

DELIVERABLES:
- src/core/provider.ts (complete PaymentProvider interface)
- src/core/types.ts (all types, fully defined)
- src/core/errors.ts (error classes with proper inheritance)
- src/core/config.ts (env loading with validation)
- patterns/stripe-api-calls.ts (working Stripe API examples)
- patterns/ai-sdk-provider.ts (reference pattern from Vercel AI SDK)

When complete, show me:
1. List of files created
2. Confirmation TypeScript compiles with zero errors
3. Brief explanation of any design decisions

DO NOT proceed to Phase 2 until I approve.
DO NOT ask me questions - make reasonable decisions and document them.
DO NOT provide descriptions - show me actual working code.
```

### Phase 2: Stripe Provider (Copy This to Cursor)

```text
@spec.md Phase 2

Phase 1 approved. Implement Phase 2 (Stripe Provider).

CRITICAL RULES:
- Reference @patterns/stripe-api-calls.ts for API patterns - copy EXACTLY
- Write tests FIRST in tests/providers/stripe/stripe-provider.test.ts
- Then implement until ALL tests pass
- Use TDD: Red → Green → Refactor
- NO placeholders like "// ... implementation ..."
- EVERY method must be fully implemented with complete error handling

TDD WORKFLOW:
1. Write complete test file (success, errors, edge cases)
2. Run tests - should fail (Red)
3. Implement src/providers/stripe/index.ts
4. Run tests until all pass (Green)
5. Refactor if needed

DELIVERABLES:
- Complete StripeProvider class
- All methods: createCheckout, createSubscription, createCustomer, verifyWebhook, createPortalSession
- Webhook signature verification in src/providers/stripe/webhooks.ts
- Test suite with >80% coverage
- ALL tests passing

Show me: Test results (all green) and coverage report.
Wait for approval before Phase 3.
```

### Phase 3: React Hooks (Copy This to Cursor)

```text
@spec.md Phase 3

Phase 2 complete. Implement Phase 3 (React Hooks).

REFERENCES:
- @patterns/ai-sdk-provider.ts for patterns
- @src/providers/stripe/index.ts for provider interface

IMPLEMENTATION ORDER (ONE at a time):
1. src/react/provider.tsx (Context + Provider)
2. src/react/hooks/useCheckout.ts
3. src/react/hooks/useSubscription.ts
4. src/react/hooks/usePayment.ts
5. src/react/hooks/useCustomer.ts

EACH HOOK NEEDS:
- Test file FIRST (loading, success, error, cleanup cases)
- Complete implementation (NO placeholders)
- JSDoc comments
- Proper TypeScript (no 'any')
- Cleanup on unmount

START WITH: useCheckout only.
Show me tests + implementation.
WAIT for approval before next hook.

DO NOT implement all at once - I review each one.
```

### Phase 4: Next.js Routes (Copy This to Cursor)

```text
@spec.md Phase 4

Hooks complete. Create Next.js API routes.

DELIVERABLES:

1. src/next/api/checkout.ts
   - POST handler with type-safe request/response
   - Status codes: 200, 400, 500
   - Request validation with clear errors
   - Complete try/catch error handling

2. src/next/api/webhook.ts
   - POST handler for Stripe webhooks
   - Signature verification (use @patterns/stripe-api-calls.ts)
   - Event routing for: checkout.session.completed, subscription created/updated/deleted
   - Idempotency handling
   - NO "// handle other events..." placeholders

REQUIREMENTS:
- Every webhook event type must be handled (minimum 4 types)
- Complete implementations only
- Helpful error messages

TEST WITH:
stripe listen --forward-to localhost:3000/api/stripe/webhook

Show me webhook test results for 3+ event types.
```

### Phase 5: Documentation (Copy This to Cursor)

```text
@spec.md Phase 5

SDK complete. Create docs and working example.

PART 1 - README.md:
- Description (1 paragraph)
- Installation
- Quick start (5-10 lines that work)
- All hooks with examples
- Environment variables table
- Troubleshooting common errors
- Link to example app

PART 2 - Working Example (examples/next-app/):
COMPLETE Next.js app with:
- Checkout page using useCheckout
- Subscription page using useSubscription
- Success/cancel pages
- API routes using our handlers
- .env.example
- Must run with `npm run dev`

REQUIREMENTS:
- Copy-paste ready for developers
- Error handling and loading states
- Production-like patterns (not toy code)
- NO placeholders anywhere
- Actually works when run

PART 3 - API Docs (docs/api.md):
- Every hook: signature, params, return, example
- Every type with all fields
- Common use case examples

Make it production-ready.
```

---

## Git Worktree Setup Commands

```bash
# Initialize main branch
git init
git add .
git commit -m "Initial project structure"

# Create worktrees for parallel development
git worktree add ../sdk-core -b feature/core
git worktree add ../sdk-core-alt -b feature/core-alt
git worktree add ../sdk-react -b feature/react
git worktree add ../sdk-next -b feature/next
git worktree add ../sdk-types -b feature/types
git worktree add ../sdk-tests -b feature/tests
git worktree add ../sdk-webhooks -b feature/webhooks
git worktree add ../sdk-docs -b feature/docs

# Open each in separate Cursor instance
# Assign agents to each worktree
# Work proceeds in parallel

# After completion, merge best implementations:
git checkout main
git merge feature/core
git merge feature/react
git merge feature/next
# etc.
```

---

## Testing Configuration

### vitest.config.ts

```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    globals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'tests/',
        '*.config.*',
      ],
    },
  },
});
```

### tests/setup.ts

```typescript
import { expect, afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import * as matchers from '@testing-library/jest-dom/matchers';

expect.extend(matchers);

afterEach(() => {
  cleanup();
});

// Mock environment variables
process.env.STRIPE_SECRET_KEY = 'sk_test_mock';
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_mock';

// Mock Stripe API
vi.mock('stripe', () => {
  return {
    default: vi.fn(() => ({
      checkout: {
        sessions: {
          create: vi.fn(),
        },
      },
      subscriptions: {
        create: vi.fn(),
        update: vi.fn(),
        cancel: vi.fn(),
      },
      webhooks: {
        constructEvent: vi.fn(),
      },
    })),
  };
});
```

---

## Package.json

```json
{
  "name": "@stripe-sdk/core",
  "version": "0.1.0",
  "description": "Dead simple Stripe SDK following Vercel AI SDK patterns",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "dev": "vitest",
    "test": "vitest run",
    "test:ui": "vitest --ui",
    "test:coverage": "vitest run --coverage",
    "build": "tsc",
    "typecheck": "tsc --noEmit",
    "lint": "eslint src",
    "format": "prettier --write \"src/**/*.{ts,tsx}\""
  },
  "dependencies": {
    "stripe": "^17.5.0"
  },
  "peerDependencies": {
    "react": "^18.3.1",
    "next": "^15.0.0"
  },
  "devDependencies": {
    "@testing-library/react": "^16.1.0",
    "@testing-library/jest-dom": "^6.6.3",
    "@types/node": "^22.10.2",
    "@types/react": "^18.3.12",
    "@vitejs/plugin-react": "^4.3.4",
    "@vitest/ui": "^2.1.8",
    "eslint": "^9.16.0",
    "jsdom": "^25.0.1",
    "prettier": "^3.4.2",
    "typescript": "^5.7.2",
    "vitest": "^2.1.8"
  },
  "keywords": [
    "stripe",
    "payments",
    "react",
    "nextjs",
    "sdk",
    "typescript"
  ],
  "author": "Your Name",
  "license": "MIT"
}
```

---

## Status Tracking (status.md)

Update this file after each phase. Reference with `@status.md` when starting new conversations.

```markdown
# Project Status

## Current State
- [ ] Phase 1: Project setup (PENDING)
- [ ] Phase 2: Core types (PENDING)
- [ ] Phase 3: Stripe provider (PENDING)
- [ ] Phase 4: React hooks (PENDING)
- [ ] Phase 5: Next.js integration (PENDING)
- [ ] Phase 6: Integration testing (PENDING)
- [ ] Phase 7: Documentation (PENDING)

## Completed Work
None yet.

## Active Branches
- main: Initial commit
- feature/core: Not started
- feature/react: Not started
- feature/next: Not started

## Known Issues
None yet.

## Next Steps
1. Run Phase 1 prompt to create project structure
2. Set up git worktrees
3. Deploy parallel agents for Phase 3

## Important Context
- Following Vercel AI SDK patterns exactly
- MVP scope: Stripe only, no streaming
- Target: 1-2 day implementation
- TDD with YOLO mode enabled
```

---

## Critical Success Factors

### ✅ DO THESE

1. **Create spec.md before any code** - 2 hours of planning saves 2 days of rework
2. **Use parallel agents from start** - 8 agents = 8× exploration speed
3. **Write tests first (TDD)** - Enable YOLO mode, let Cursor iterate to green
4. **Reference patterns explicitly** - "identical to @patterns/x.ts"
5. **Keep conversations short** - New chat for each feature/module
6. **Review every diff** - AI is fast but needs verification
7. **Update status.md** - Essential for context restoration

### ❌ NEVER DO THESE

1. **NO PLACEHOLDER CODE** - Never write `// TODO: Implement` or `// ... rest of code...`

   ```typescript
   // ❌ WRONG - Causes iteration hell
   async createCheckout(options: CheckoutOptions) {
     // TODO: Implement
     // ... rest of implementation ...
   }

   // ✅ CORRECT - Complete implementation always
   async createCheckout(options: CheckoutOptions): Promise<CheckoutSession> {
     if (!this.stripe) throw new PaymentError('Stripe not initialized');

     try {
       const session = await this.stripe.checkout.sessions.create({
         line_items: [{ price: options.priceId, quantity: 1 }],
         mode: options.mode,
         success_url: options.successUrl,
         cancel_url: options.cancelUrl,
       });

       return {
         id: session.id,
         url: session.url!,
         status: session.status === 'open' ? 'open' : 'complete',
       };
     } catch (error) {
       throw new PaymentError(`Checkout failed: ${error.message}`);
     }
   }
   ```

2. **Skip the architecture phase** - Causes constant rework
3. **Long conversations (50+ messages)** - Context degrades
4. **Vague prompts** - "make it better" leads to iteration loops
5. **Large files (1000+ lines)** - Agent can't read completely
6. **Ignoring test failures** - Technical debt compounds
7. **Rushing without spec** - Fast start, slow finish
8. **Forgetting to copy .env to worktrees** - Will break API calls

---

## Expected Outcomes

### After Day 1

- Complete project structure
- All core types and interfaces defined
- Stripe provider implemented and tested
- React hooks functional
- All tests passing

### After Day 2

- Next.js integration complete
- Webhook handling secure and tested
- Documentation written
- Example app working
- Ready for npm publish

### Quality Metrics

- Test coverage: >80%
- TypeScript: No any types
- Bundle size: <50kb gzipped
- All API routes: <200ms response time
- Zero unhandled errors in tests

---

## Troubleshooting Guide

### If Agent Gets Stuck

1. Check status.md - is context correct?
2. Start new conversation - reference @status.md
3. Provide more specific prompt with exact file/function
4. Reference pattern files explicitly

### If Tests Fail Repeatedly

1. Review test expectations - are they correct?
2. Check mock setup - is Stripe API mocked properly?
3. Verify implementation matches spec.md exactly
4. Try different agent/model on same task

### If Implementation Differs from Spec

1. Stop immediately
2. Reference @spec.md in new prompt
3. Ask for diff against spec
4. Regenerate following spec exactly

### If Merge Conflicts

1. Use git worktrees - eliminates most conflicts
2. Merge one feature at a time
3. Review diffs carefully
4. Keep main branch as source of truth

---

## Final Checklist Before Completion

- [ ] All tests passing (`npm test`)
- [ ] TypeScript compiles (`npm run typecheck`)
- [ ] Coverage >80% (`npm run test:coverage`)
- [ ] Documentation complete and accurate
- [ ] Example app runs and demonstrates all features
- [ ] Environment variables documented
- [ ] Webhook endpoint tested with Stripe CLI
- [ ] Error handling covers all edge cases
- [ ] No console.log statements in production code
- [ ] No TODO comments remaining
- [ ] README has installation and quick start
- [ ] API reference generated from JSDoc
- [ ] License file included
- [ ] package.json metadata complete

---

## Launch Sequence

```bash
# Day 1 Start (9:00 AM)
1. Create project structure (Phase 1 prompt)
2. Set up git worktrees
3. Deploy 8 agents in parallel
4. Monitor progress, review diffs
5. Merge best implementations
6. End-of-day: Core SDK functional

# Day 2 Start (9:00 AM)
1. Next.js integration (Phase 5 prompt)
2. Integration tests (Phase 6 prompt)
3. Documentation generation (Phase 7 prompt)
4. Final review and polish
5. End-of-day: Production ready SDK

# Ship It
npm test && npm run build && npm publish
```

---

**This document contains everything Cursor needs to build a production-ready Stripe SDK in 1-2 days. Reference it as @stripe-sdk-guide.md throughout development.**
