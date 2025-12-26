import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { QueryClient } from '../src/query/queryClient';

describe('QueryClient', () => {
    let cache: QueryClient;

    beforeEach(() => {
        cache = new QueryClient();
    });

    afterEach(() => {
        cache.destroy();
    });

    it('should store and retrieve data', () => {
        const data = { id: 1, name: 'Test' };
        cache.set(['users', '1'], data);

        const retrieved = cache.get(['users', '1']);
        expect(retrieved).toEqual(data);
    });

    it('should return undefined for non-existent keys', () => {
        const retrieved = cache.get(['nonexistent']);
        expect(retrieved).toBeUndefined();
    });

    it('should respect stale time', async () => {
        const data = { id: 1 };
        cache.set(['test'], data, { staleTime: 100 });

        expect(cache.isStale(['test'])).toBe(false);

        await new Promise(resolve => setTimeout(resolve, 150));

        expect(cache.isStale(['test'])).toBe(true);
    });

    it('should respect cache time and auto-expire', async () => {
        const data = { id: 1 };
        cache.set(['test'], data, { cacheTime: 100 });

        expect(cache.get(['test'])).toEqual(data);

        await new Promise(resolve => setTimeout(resolve, 150));

        expect(cache.get(['test'])).toBeUndefined();
    });

    it('should invalidate queries by prefix', () => {
        cache.set(['users', '1'], { id: 1 });
        cache.set(['users', '2'], { id: 2 });
        cache.set(['posts', '1'], { id: 1 });

        cache.invalidate(['users']);

        // Soft invalidation: data remains, but isStale is true
        expect(cache.get(['users', '1'])).toEqual({ id: 1 });
        expect(cache.isStale(['users', '1'])).toBe(true);
        expect(cache.get(['users', '2'])).toEqual({ id: 2 });
        expect(cache.isStale(['users', '2'])).toBe(true);
        expect(cache.get(['posts', '1'])).toEqual({ id: 1 });
    });

    it('should clear all cache', () => {
        cache.set(['a'], 1);
        cache.set(['b'], 2);

        cache.clear();

        expect(cache.get(['a'])).toBeUndefined();
        expect(cache.get(['b'])).toBeUndefined();
    });

    it('should support prefetch', () => {
        const data = { id: 1 };
        cache.prefetch(['users', '1'], data);

        expect(cache.get(['users', '1'])).toEqual(data);
    });

    it('should provide cache stats', () => {
        cache.set(['a'], 1);
        cache.set(['b'], 2);

        const stats = cache.getStats();
        expect(stats.size).toBe(2);
        expect(stats.keys.length).toBe(2);
    });

    it('should invalidate all queries (DevTools logic)', () => {
        cache.set(['a'], 1);
        cache.set(['b'], 2);

        cache.invalidateAll();

        // InvalidateAll sets data to soft invalidated
        expect(cache.get(['a'])).toEqual(1);
        expect(cache.isStale(['a'])).toBe(true);
        expect(cache.get(['b'])).toEqual(2);
        expect(cache.isStale(['b'])).toBe(true);

        // Keys should still exist (signals are present)
        expect(cache.getStats().size).toBe(2);
    });

    it('should remove specific query (DevTools logic)', () => {
        cache.set(['a'], 1);
        cache.set(['b'], 2);

        cache.remove(['a']);

        expect(cache.get(['a'])).toBeUndefined();
        expect(cache.get(['b'])).toBe(2);
        // Key should be gone
        expect(cache.getStats().size).toBe(1);
    });
});
