/**
 * Core type definitions for the Stripe SDK.
 * These types define the provider interface and all payment-related data structures.
 */

/**
 * Main payment provider interface that all providers must implement.
 * Follows the Vercel AI SDK provider pattern for consistency.
 */
export interface PaymentProvider {
  /** Provider name identifier (e.g., "stripe") */
  readonly name: string;

  /**
   * Creates a checkout session for one-time or subscription payments.
   * @param options - Checkout configuration options
   * @returns Promise resolving to the created checkout session
   */
  createCheckout(options: CheckoutOptions): Promise<CheckoutSession>;

  /**
   * Creates a subscription for a customer.
   * @param options - Subscription configuration options
   * @returns Promise resolving to the created subscription
   */
  createSubscription(options: SubscriptionOptions): Promise<Subscription>;

  /**
   * Creates a new customer record.
   * @param data - Customer information
   * @returns Promise resolving to the created customer
   */
  createCustomer(data: CustomerData): Promise<Customer>;

  /**
   * Verifies a webhook payload signature and returns the parsed event.
   * @param payload - Raw webhook payload string
   * @param signature - Webhook signature from headers
   * @returns Parsed and verified webhook event
   * @throws WebhookError if signature verification fails
   */
  verifyWebhook(payload: string, signature: string): WebhookEvent;

  /**
   * Creates a billing portal session for customer self-service.
   * @param customerId - Customer identifier
   * @param returnUrl - URL to redirect after portal session ends
   * @returns Promise resolving to portal session with URL
   */
  createPortalSession(customerId: string, returnUrl: string): Promise<PortalSession>;
}

/**
 * Options for creating a checkout session.
 */
export interface CheckoutOptions {
  /** Stripe Price ID to charge */
  priceId: string;
  /** URL to redirect after successful payment */
  successUrl: string;
  /** URL to redirect if payment is cancelled */
  cancelUrl: string;
  /** Optional customer email (will create customer if not exists) */
  customerEmail?: string;
  /** Optional customer ID (for existing customers) */
  customerId?: string;
  /** Optional metadata to attach to the session */
  metadata?: Record<string, string>;
  /** Checkout mode: payment (one-time), subscription, or setup */
  mode?: 'payment' | 'subscription' | 'setup';
  /** Optional quantity for the line item */
  quantity?: number;
  /** Optional trial period in days (subscription mode only) */
  trialDays?: number;
}

/**
 * Represents a checkout session created by the provider.
 */
export interface CheckoutSession {
  /** Unique session identifier */
  id: string;
  /** URL to redirect user to complete checkout */
  url: string;
  /** Current session status */
  status: 'open' | 'complete' | 'expired';
  /** Customer ID (if customer was created/used) */
  customerId?: string;
  /** Metadata attached to the session */
  metadata?: Record<string, string>;
  /** Timestamp when session was created */
  createdAt?: Date;
}

/**
 * Options for creating a subscription.
 */
export interface SubscriptionOptions {
  /** Customer ID to create subscription for */
  customerId: string;
  /** Price ID to subscribe to */
  priceId: string;
  /** Optional trial period in days */
  trialDays?: number;
  /** Optional metadata to attach */
  metadata?: Record<string, string>;
  /** Optional quantity for the subscription */
  quantity?: number;
}

/**
 * Represents a subscription created by the provider.
 */
export interface Subscription {
  /** Unique subscription identifier */
  id: string;
  /** Customer ID this subscription belongs to */
  customerId: string;
  /** Current subscription status */
  status: SubscriptionState;
  /** Date when current billing period ends */
  currentPeriodEnd: Date;
  /** Date when current billing period started */
  currentPeriodStart: Date;
  /** Whether subscription will cancel at period end */
  cancelAtPeriodEnd: boolean;
  /** Subscription line items */
  items: SubscriptionItem[];
  /** Optional metadata */
  metadata?: Record<string, string>;
  /** Timestamp when subscription was created */
  createdAt?: Date;
}

/**
 * Subscription status values.
 * Maps to Stripe subscription status values.
 */
export type SubscriptionState =
  | 'active'
  | 'past_due'
  | 'canceled'
  | 'incomplete'
  | 'incomplete_expired'
  | 'trialing'
  | 'unpaid'
  | 'paused';

/**
 * Represents a subscription line item.
 */
export interface SubscriptionItem {
  /** Unique item identifier */
  id: string;
  /** Price ID for this item */
  priceId: string;
  /** Quantity of this item */
  quantity: number;
}

/**
 * Data required to create a customer.
 */
export interface CustomerData {
  /** Customer email address (required) */
  email: string;
  /** Optional customer name */
  name?: string;
  /** Optional metadata to attach */
  metadata?: Record<string, string>;
}

/**
 * Represents a customer created by the provider.
 */
export interface Customer {
  /** Unique customer identifier */
  id: string;
  /** Customer email address */
  email: string;
  /** Optional customer name */
  name?: string;
  /** Optional metadata */
  metadata?: Record<string, string>;
  /** Timestamp when customer was created */
  createdAt?: Date;
}

/**
 * Represents a webhook event from the payment provider.
 */
export interface WebhookEvent {
  /** Unique event identifier */
  id: string;
  /** Event type (e.g., "checkout.session.completed") */
  type: string;
  /** Event data object */
  data: unknown;
  /** Timestamp when event was created */
  created: Date;
}

/**
 * Configuration for payment provider initialization.
 */
export interface PaymentConfig {
  /** API key for the payment provider */
  apiKey: string;
  /** Optional webhook secret for signature verification */
  webhookSecret?: string;
}

/**
 * Portal session for customer billing management.
 */
export interface PortalSession {
  /** URL to redirect customer to billing portal */
  url: string;
}

/**
 * Key-value adapter interface for caching and storage.
 * Used by providers to cache customer and subscription data.
 */
export interface KVAdapter {
  /**
   * Retrieves a value by key.
   * @param key - Storage key
   * @returns Promise resolving to the value or null if not found
   */
  get<T = unknown>(key: string): Promise<T | null>;

  /**
   * Sets a value by key with optional TTL.
   * @param key - Storage key
   * @param value - Value to store
   * @param ttlSeconds - Optional time-to-live in seconds
   * @returns Promise resolving when set is complete
   */
  set<T = unknown>(key: string, value: T, ttlSeconds?: number): Promise<void>;

  /**
   * Deletes a value by key.
   * @param key - Storage key
   * @returns Promise resolving when delete is complete
   */
  delete(key: string): Promise<void>;
}

/**
 * Synchronization adapter interface for real-time updates.
 * Optional paid feature - allows providers to sync data changes in real-time.
 */
export interface SyncAdapter {
  /**
   * Called when a new customer is created.
   * @param customer - The newly created customer
   * @returns Promise resolving when sync is complete
   */
  onCustomerCreated?(customer: Customer): Promise<void>;

  /**
   * Called when a subscription is updated (status change, renewal, etc.).
   * @param subscription - The updated subscription
   * @returns Promise resolving when sync is complete
   */
  onSubscriptionUpdated?(subscription: Subscription): Promise<void>;

  /**
   * Called when a subscription is canceled.
   * @param subscription - The canceled subscription
   * @returns Promise resolving when sync is complete
   */
  onSubscriptionCanceled?(subscription: Subscription): Promise<void>;
}

