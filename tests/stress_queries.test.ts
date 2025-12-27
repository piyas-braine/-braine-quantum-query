import { describe, it, expect, beforeEach } from 'vitest';
import { QueryClient } from '../src/query/queryClient';

describe('Query Stress Tests (300 tests)', () => {
    let client: QueryClient;

    beforeEach(() => {
        client = new QueryClient();
    });

    // 100 fetch tests
    for (let i = 1; i <= 100; i++) {
        it(`should fetch data ${i}`, async () => {
            const data = await client.fetch([`test-${i}`], async () => ({ id: i, value: `data-${i}` }));

            expect(data).toEqual({ id: i, value: `data-${i}` });
            expect(client.has([`test-${i}`])).toBe(true);
        });
    }

    // 100 cache tests
    for (let i = 1; i <= 100; i++) {
        it(`should cache data ${i}`, async () => {
            const fetchFn = async () => ({ id: i });

            await client.fetch([`cache-${i}`], fetchFn);
            const cached = client.get([`cache-${i}`]);

            expect(cached).toEqual({ id: i });
        });
    }

    // 100 invalidation tests
    for (let i = 1; i <= 100; i++) {
        it(`should invalidate data ${i}`, async () => {
            await client.fetch([`invalidate-${i}`], async () => ({ id: i }));

            client.invalidate([`invalidate-${i}`]);

            const signal = client.getSignal([`invalidate-${i}`]);
            expect(signal.get()?.isInvalidated).toBe(true);
        });
    }
});
