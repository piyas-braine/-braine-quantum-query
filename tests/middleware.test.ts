import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryCache } from '../src/query/queryCache';
import type { QueryPlugin } from '../src/query/types';

describe('QueryCache Middleware', () => {
    let client: QueryCache;

    beforeEach(() => {
        client = new QueryCache();
    });

    it('should trigger onFetchStart and onFetchSuccess hooks', async () => {
        const onStart = vi.fn();
        const onSuccess = vi.fn();
        const plugin: QueryPlugin = {
            name: 'test-plugin',
            onFetchStart: onStart,
            onFetchSuccess: onSuccess
        };

        client.use(plugin);

        const queryKey = ['test'];
        const data = { id: 1 };

        await client.fetch(queryKey, async () => data);

        expect(onStart).toHaveBeenCalledWith(['test']);
        expect(onSuccess).toHaveBeenCalledWith(['test'], data);
    });

    it('should trigger onFetchError hooks', async () => {
        const onError = vi.fn();
        const plugin: QueryPlugin = {
            name: 'error-plugin',
            onFetchError: onError
        };

        client.use(plugin);
        const error = new Error('boom');

        try {
            await client.fetch(['error'], async () => { throw error; }, { retry: 0 });
        } catch (e) {
            // expected
        }

        expect(onError).toHaveBeenCalledWith(['error'], error);
    });

    it('should trigger onInvalidate hooks', async () => {
        const onInvalidate = vi.fn();
        const plugin: QueryPlugin = {
            name: 'invalidate-plugin',
            onInvalidate: onInvalidate
        };

        client.use(plugin);

        client.invalidate(['test']);

        expect(onInvalidate).toHaveBeenCalledWith(['test']);
    });

    it('should support multiple plugins', async () => {
        const calls: string[] = [];
        client.use({
            name: 'p1',
            onFetchStart: () => calls.push('p1')
        });
        client.use({
            name: 'p2',
            onFetchStart: () => calls.push('p2')
        });

        await client.fetch(['multi'], async () => 1);

        expect(calls).toEqual(['p1', 'p2']);
    });
});
