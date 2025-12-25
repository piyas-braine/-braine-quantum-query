import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { QueryCache } from '../src/addon/query/queryCache';
import { createLocalStoragePersister } from '../src/addon/persist/createLocalStoragePersister';
import { persistQueryClient } from '../src/addon/persist/persistQueryClient';

describe('Persistence Adapter', () => {
    let client: QueryCache;
    let storage: Record<string, string> = {};
    let mockStorage: Storage;

    beforeEach(() => {
        client = new QueryCache({ enableGC: false });
        storage = {};
        mockStorage = {
            getItem: vi.fn((key) => storage[key] || null),
            setItem: vi.fn((key, value) => { storage[key] = value; }),
            removeItem: vi.fn((key) => { delete storage[key]; }),
            clear: vi.fn(() => { storage = {}; }),
            key: vi.fn(() => null),
            length: 0
        };
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('should hydrate client from storage on startup', async () => {
        const dehydratedState = {
            queries: [{
                queryKey: ['test'],
                data: { val: 'restored' },
                timestamp: Date.now(),
                staleTime: 1000,
                cacheTime: 5000
            }]
        };
        const persistedData = JSON.stringify({
            timestamp: Date.now(),
            buster: '',
            clientState: dehydratedState
        });

        storage['TEST_CACHE'] = persistedData;

        const persister = createLocalStoragePersister({
            key: 'TEST_CACHE',
            storage: mockStorage,
            throttleTime: 0 // Immediate
        });

        await persistQueryClient({
            queryClient: client,
            persister
        });

        // Check if data is restored
        const data = client.get(['test']);
        expect(data).toEqual({ val: 'restored' });
    });

    it('should persist data updates to storage', async () => {
        vi.useFakeTimers();
        const persister = createLocalStoragePersister({
            key: 'TEST_CACHE',
            storage: mockStorage,
            throttleTime: 100 // Throttle
        });

        await persistQueryClient({
            queryClient: client,
            persister
        });

        // Update cache
        client.set(['new-key'], { val: 'fresh' });

        // Storage should not be updated yet (throttle)
        expect(mockStorage.setItem).not.toHaveBeenCalled();

        // Fast forward
        vi.runAllTimers();

        expect(mockStorage.setItem).toHaveBeenCalled();
        const stored = JSON.parse(storage['TEST_CACHE']);
        expect(stored.clientState.queries).toHaveLength(1);
        expect(stored.clientState.queries[0].data).toEqual({ val: 'fresh' });

        vi.useRealTimers();
    });

    it('should handle offline/reconnect hooks if implemented (future)', () => {
        // Placeholder
        expect(true).toBe(true);
    });
});
