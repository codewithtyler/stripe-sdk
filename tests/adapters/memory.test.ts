/**
 * Tests for memory adapter implementation.
 * Tests all KVAdapter interface methods including TTL support.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createMemoryAdapter } from '../../src/adapters/memory';
import type { KVAdapter } from '../../src/core/types';

describe('Memory Adapter', () => {
  let adapter: KVAdapter;

  beforeEach(() => {
    adapter = createMemoryAdapter();
  });

  describe('get', () => {
    it('should return null for non-existent key', async () => {
      const value = await adapter.get('non-existent-key');
      expect(value).toBe(null);
    });

    it('should retrieve stored value', async () => {
      await adapter.set('test-key', 'test-value');
      const value = await adapter.get<string>('test-key');
      expect(value).toBe('test-value');
    });

    it('should retrieve complex objects', async () => {
      const complexObject = {
        id: '123',
        name: 'Test',
        metadata: { userId: 'user_123' },
        nested: {
          value: 42,
        },
      };

      await adapter.set('complex-key', complexObject);
      const value = await adapter.get<typeof complexObject>('complex-key');
      expect(value).toEqual(complexObject);
    });

    it('should return null for expired entries', async () => {
      await adapter.set('expired-key', 'value', 1); // 1 second TTL

      // Wait for expiration
      await new Promise((resolve) => setTimeout(resolve, 1100));

      const value = await adapter.get('expired-key');
      expect(value).toBe(null);
    });

    it('should retrieve value before expiration', async () => {
      await adapter.set('ttl-key', 'value', 5); // 5 seconds TTL

      // Immediately retrieve (should still be valid)
      const value = await adapter.get<string>('ttl-key');
      expect(value).toBe('value');
    });
  });

  describe('set', () => {
    it('should store string values', async () => {
      await adapter.set('string-key', 'string-value');
      const value = await adapter.get<string>('string-key');
      expect(value).toBe('string-value');
    });

    it('should store number values', async () => {
      await adapter.set('number-key', 42);
      const value = await adapter.get<number>('number-key');
      expect(value).toBe(42);
    });

    it('should store boolean values', async () => {
      await adapter.set('bool-key', true);
      const value = await adapter.get<boolean>('bool-key');
      expect(value).toBe(true);
    });

    it('should store object values', async () => {
      const obj = { id: '123', name: 'Test' };
      await adapter.set('obj-key', obj);
      const value = await adapter.get<typeof obj>('obj-key');
      expect(value).toEqual(obj);
    });

    it('should overwrite existing values', async () => {
      await adapter.set('overwrite-key', 'old-value');
      await adapter.set('overwrite-key', 'new-value');
      const value = await adapter.get<string>('overwrite-key');
      expect(value).toBe('new-value');
    });

    it('should store with TTL', async () => {
      await adapter.set('ttl-key', 'value', 2); // 2 seconds TTL
      const value = await adapter.get<string>('ttl-key');
      expect(value).toBe('value');

      // Wait for expiration
      await new Promise((resolve) => setTimeout(resolve, 2100));

      const expiredValue = await adapter.get('ttl-key');
      expect(expiredValue).toBe(null);
    });

    it('should store without TTL (permanent)', async () => {
      await adapter.set('permanent-key', 'value');
      const value = await adapter.get<string>('permanent-key');
      expect(value).toBe('value');

      // Wait a bit (should still be there)
      await new Promise((resolve) => setTimeout(resolve, 100));

      const stillThere = await adapter.get<string>('permanent-key');
      expect(stillThere).toBe('value');
    });

    it('should handle zero TTL as permanent', async () => {
      await adapter.set('zero-ttl-key', 'value', 0);
      const value = await adapter.get<string>('zero-ttl-key');
      expect(value).toBe('value');
    });

    it('should handle negative TTL as permanent', async () => {
      await adapter.set('negative-ttl-key', 'value', -1);
      const value = await adapter.get<string>('negative-ttl-key');
      expect(value).toBe('value');
    });
  });

  describe('delete', () => {
    it('should delete existing key', async () => {
      await adapter.set('delete-key', 'value');
      await adapter.delete('delete-key');
      const value = await adapter.get('delete-key');
      expect(value).toBe(null);
    });

    it('should handle deleting non-existent key gracefully', async () => {
      // Should not throw
      await expect(adapter.delete('non-existent-key')).resolves.not.toThrow();
    });

    it('should allow setting after delete', async () => {
      await adapter.set('delete-set-key', 'old-value');
      await adapter.delete('delete-set-key');
      await adapter.set('delete-set-key', 'new-value');
      const value = await adapter.get<string>('delete-set-key');
      expect(value).toBe('new-value');
    });
  });

  describe('KVAdapter interface compliance', () => {
    it('should implement all required methods', () => {
      expect(typeof adapter.get).toBe('function');
      expect(typeof adapter.set).toBe('function');
      expect(typeof adapter.delete).toBe('function');
    });

    it('should handle concurrent operations', async () => {
      const promises = [
        adapter.set('concurrent-1', 'value-1'),
        adapter.set('concurrent-2', 'value-2'),
        adapter.set('concurrent-3', 'value-3'),
      ];

      await Promise.all(promises);

      const values = await Promise.all([
        adapter.get<string>('concurrent-1'),
        adapter.get<string>('concurrent-2'),
        adapter.get<string>('concurrent-3'),
      ]);

      expect(values).toEqual(['value-1', 'value-2', 'value-3']);
    });

    it('should handle large values', async () => {
      const largeValue = 'x'.repeat(10000);
      await adapter.set('large-key', largeValue);
      const value = await adapter.get<string>('large-key');
      expect(value).toBe(largeValue);
    });

    it('should handle special characters in keys', async () => {
      const specialKey = 'key:with:colons:and-dashes_and_underscores';
      await adapter.set(specialKey, 'value');
      const value = await adapter.get<string>(specialKey);
      expect(value).toBe('value');
    });

    it('should handle special characters in values', async () => {
      const specialValue = 'value with\nnewlines\tand\ttabs';
      await adapter.set('special-value-key', specialValue);
      const value = await adapter.get<string>('special-value-key');
      expect(value).toBe(specialValue);
    });
  });

  describe('TTL edge cases', () => {
    it('should handle very short TTL', async () => {
      await adapter.set('short-ttl-key', 'value', 0.1); // 100ms

      // Immediately should work
      const immediate = await adapter.get<string>('short-ttl-key');
      expect(immediate).toBe('value');

      // Wait for expiration
      await new Promise((resolve) => setTimeout(resolve, 150));

      const expired = await adapter.get('short-ttl-key');
      expect(expired).toBe(null);
    });

    it('should handle very long TTL', async () => {
      await adapter.set('long-ttl-key', 'value', 86400); // 24 hours
      const value = await adapter.get<string>('long-ttl-key');
      expect(value).toBe('value');
    });

    it('should update TTL on overwrite', async () => {
      await adapter.set('update-ttl-key', 'value', 1);
      await new Promise((resolve) => setTimeout(resolve, 500));
      await adapter.set('update-ttl-key', 'new-value', 2);

      // Should still be valid after original TTL
      await new Promise((resolve) => setTimeout(resolve, 600));
      const value = await adapter.get<string>('update-ttl-key');
      expect(value).toBe('new-value');
    });
  });
});

