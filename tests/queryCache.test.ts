import { describe, it, expect, beforeEach } from 'vitest';
import { QueryCache } from '../src/addon/query/queryCache';

describe('QueryCache', () => {
    let cache: QueryCache;

    beforeEach(() => {
        cache = new QueryCache();
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

        expect(cache.get(['users', '1'])).toBeUndefined();
        expect(cache.get(['users', '2'])).toBeUndefined();
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
});
