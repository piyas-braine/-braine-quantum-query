import { describe, it, expect, beforeEach } from 'vitest';
import { QueryStorage } from '../src/query/queryStorage';
import { QueryClient } from '../src/query/queryClient';

describe('10/10 Trie Invalidation', () => {
    let client: QueryClient;

    beforeEach(() => {
        client = new QueryClient();
    });

    it('should match hierarchical keys', () => {
        client.set(['todos'], 'list');
        client.set(['todos', 1], 'detail 1');
        client.set(['todos', 1, 'comments'], 'comments 1');

        client.set(['users'], 'users list'); // Should not be invalidated

        // Invalidate 'todos' -> Should hit all 'todos' keys
        client.invalidate(['todos']);

        expect(client.isStale(['todos'])).toBe(true);
        expect(client.isStale(['todos', 1])).toBe(true);
        expect(client.isStale(['todos', 1, 'comments'])).toBe(true);

        expect(client.isStale(['users'])).toBe(false);
    });

    it('should NOT match string prefix collisions (The Bug Fix)', () => {
        client.set(['user'], 'user');
        client.set(['users'], 'users'); // 'user' is a string prefix of 'users'

        // Invalidate ['user']
        client.invalidate(['user']);

        expect(client.isStale(['user'])).toBe(true);
        expect(client.isStale(['users'])).toBe(false); // FIXED!
    });

    it('should handle partial matching deeply', () => {
        client.set(['a', 'b', 'c'], 1);
        client.set(['a', 'b', 'd'], 2);
        client.set(['a', 'x'], 3);

        client.invalidate(['a', 'b']);

        expect(client.isStale(['a', 'b', 'c'])).toBe(true);
        expect(client.isStale(['a', 'b', 'd'])).toBe(true);
        expect(client.isStale(['a', 'x'])).toBe(false);
    });

    it('should handle object keys correctly', () => {
        client.set(['search', { q: 'foo' }], 1);
        client.set(['search', { q: 'bar' }], 2);

        // Invalidate all searches
        client.invalidate(['search']);

        expect(client.isStale(['search', { q: 'foo' }])).toBe(true);
        expect(client.isStale(['search', { q: 'bar' }])).toBe(true);
    });
});
