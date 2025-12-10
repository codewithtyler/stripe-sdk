/**
 * Upstash Redis adapter for production key-value storage.
 * Provides persistent, distributed storage with automatic JSON serialization.
 * Requires @upstash/redis package.
 */

import type { KVAdapter } from '../core/types';

/**
 * Configuration options for Upstash adapter.
 */
export interface UpstashAdapterConfig {
  /** Upstash Redis REST API URL */
  url: string;
  /** Upstash Redis REST API token */
  token: string;
}

/**
 * Creates an Upstash Redis KV adapter.
 * Handles JSON serialization/deserialization automatically.
 *
 * @param config - Upstash configuration with URL and token
 * @returns A KVAdapter instance using Upstash Redis
 * @throws Error if @upstash/redis is not installed
 *
 * @example
 * ```ts
 * const adapter = createUpstashAdapter({
 *   url: process.env.UPSTASH_REDIS_REST_URL!,
 *   token: process.env.UPSTASH_REDIS_REST_TOKEN!,
 * });
 * await adapter.set('customer:user123', 'cus_abc123');
 * const customerId = await adapter.get<string>('customer:user123');
 * ```
 */
export function createUpstashAdapter(
  config: UpstashAdapterConfig
): KVAdapter {
  // Dynamic import to avoid requiring @upstash/redis as a peer dependency
  // This allows the memory adapter to work without any external deps
  let RedisClass: new (config: { url: string; token: string }) => {
    get(key: string): Promise<unknown>;
    set(key: string, value: string, options?: { ex?: number }): Promise<string>;
    del(key: string): Promise<number>;
  };

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const upstashRedis = require('@upstash/redis');
    RedisClass = upstashRedis.Redis;
  } catch (error) {
    throw new Error(
      '@upstash/redis package is required for Upstash adapter. Install it with: npm install @upstash/redis'
    );
  }

  if (!RedisClass) {
    throw new Error('Failed to import @upstash/redis');
  }

  const redis = new RedisClass({
    url: config.url,
    token: config.token,
  });

  return {
    /**
     * Retrieves a value by key from Upstash Redis.
     * Automatically deserializes JSON values.
     */
    async get<T = unknown>(key: string): Promise<T | null> {
      try {
        const result = await redis.get(key);

        if (result === null || result === undefined) {
          return null;
        }

        // Upstash Redis automatically handles JSON serialization
        // If the value is a string that looks like JSON, parse it
        if (typeof result === 'string') {
          try {
            return JSON.parse(result) as T;
          } catch {
            // If parsing fails, return as-is (might be a plain string)
            return result as T;
          }
        }

        return result as T;
      } catch (error) {
        throw new Error(
          `Failed to get key "${key}" from Upstash: ${
            error instanceof Error ? error.message : 'Unknown error'
          }`
        );
      }
    },

    /**
     * Sets a value by key in Upstash Redis.
     * Automatically serializes values to JSON.
     * Supports optional TTL via Upstash's EX parameter.
     */
    async set<T = unknown>(
      key: string,
      value: T,
      ttlSeconds?: number
    ): Promise<void> {
      try {
        // Serialize value to JSON for storage
        const serialized =
          typeof value === 'string' ? value : JSON.stringify(value);

        if (ttlSeconds && ttlSeconds > 0) {
          // Set with expiration
          await redis.set(key, serialized, { ex: ttlSeconds });
        } else {
          // Set without expiration
          await redis.set(key, serialized);
        }
      } catch (error) {
        throw new Error(
          `Failed to set key "${key}" in Upstash: ${
            error instanceof Error ? error.message : 'Unknown error'
          }`
        );
      }
    },

    /**
     * Deletes a value by key from Upstash Redis.
     */
    async delete(key: string): Promise<void> {
      try {
        await redis.del(key);
      } catch (error) {
        throw new Error(
          `Failed to delete key "${key}" from Upstash: ${
            error instanceof Error ? error.message : 'Unknown error'
          }`
        );
      }
    },
  };
}

