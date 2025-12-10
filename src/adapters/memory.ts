/**
 * In-memory key-value adapter for testing and development.
 * Uses a simple Map-based storage with optional TTL support.
 * No external dependencies required.
 */

import type { KVAdapter } from '../core/types';

/**
 * Internal storage entry with optional expiration timestamp.
 */
interface StorageEntry<T> {
  value: T;
  expiresAt?: number;
}

/**
 * Creates an in-memory KV adapter.
 * Perfect for testing, development, or single-instance deployments.
 *
 * @returns A KVAdapter instance using Map-based storage
 *
 * @example
 * ```ts
 * const adapter = createMemoryAdapter();
 * await adapter.set('key', 'value', 60); // TTL: 60 seconds
 * const value = await adapter.get('key');
 * ```
 */
export function createMemoryAdapter(): KVAdapter {
  const storage = new Map<string, StorageEntry<unknown>>();

  /**
   * Cleanup expired entries periodically.
   * Runs every 60 seconds to prevent memory leaks.
   */
  const cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of storage.entries()) {
      if (entry.expiresAt && entry.expiresAt < now) {
        storage.delete(key);
      }
    }
  }, 60000);

  // Store cleanup function for potential manual cleanup
  (storage as unknown as { _cleanup?: () => void })._cleanup = () => {
    clearInterval(cleanupInterval);
    storage.clear();
  };

  return {
    /**
     * Retrieves a value by key.
     * Returns null if key doesn't exist or has expired.
     */
    async get<T = unknown>(key: string): Promise<T | null> {
      const entry = storage.get(key);

      if (!entry) {
        return null;
      }

      // Check if entry has expired
      if (entry.expiresAt && entry.expiresAt < Date.now()) {
        storage.delete(key);
        return null;
      }

      return entry.value as T;
    },

    /**
     * Sets a value by key with optional TTL.
     * If TTL is provided, the entry will be automatically deleted after expiration.
     */
    async set<T = unknown>(
      key: string,
      value: T,
      ttlSeconds?: number
    ): Promise<void> {
      const entry: StorageEntry<T> = {
        value,
      };

      if (ttlSeconds && ttlSeconds > 0) {
        entry.expiresAt = Date.now() + ttlSeconds * 1000;
      }

      storage.set(key, entry);
    },

    /**
     * Deletes a value by key.
     * No-op if key doesn't exist.
     */
    async delete(key: string): Promise<void> {
      storage.delete(key);
    },
  };
}

