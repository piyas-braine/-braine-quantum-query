import { describe, it, expect } from 'vitest';
import { QueryCache } from '../src/addon/query/queryCache';

describe('DX: "this" Context Safety', () => {
    it('should allow destructuring of methods without losing context', async () => {
        const client = new QueryCache();
        const { fetch, set, get } = client;

        // 1. Test set (synchronous)
        // If 'this' is lost, this will crash accessing 'this.generateKey' or 'this.signals'
        expect(() => set(['test'], 'value')).not.toThrow();

        // 2. Test get
        expect(get(['test'])).toBe('value');

        // 3. Test fetch (async)
        const fetchFn = async () => 'fetched';
        // If 'this' is lost, this will crash accessing 'this.deduplicationCache'
        await expect(fetch(['fetched'], fetchFn)).resolves.toBe('fetched');
    });

    it('should be safe to pass as callback', () => {
        const client = new QueryCache();
        const execute = (fn: any) => fn(['callback'], 'data');

        // Passing client.set directly as a callback
        expect(() => execute(client.set)).not.toThrow();
        expect(client.get(['callback'])).toBe('data');
    });
});
