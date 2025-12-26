import { describe, it, expect } from 'vitest';
import { QueryClient } from '../src/query/queryClient';
import { dehydrate, hydrate } from '../src/query/hydration';

describe('SSR Hydration', () => {
    it('should dehydrate and hydrate query state', () => {
        const serverClient = new QueryClient();
        const key = ['posts', 1];
        const data = { id: 1, title: 'Hello' };

        // Simulate fetch on server
        const signal = serverClient.getSignal(key);
        signal.set({
            data,
            status: 'success',
            isFetching: false,
            error: null,
            fetchDirection: 'initial',
            timestamp: 1000,
            staleTime: 5000,
            cacheTime: 10000,
            key
        });

        const dehydrated = dehydrate(serverClient);

        // Client side
        const clientClient = new QueryClient();
        hydrate(clientClient, dehydrated);

        const clientSignal = clientClient.getSignal(key);
        const state = clientSignal.get();

        expect(state).toBeDefined();
        expect(state?.data).toEqual(data);
        expect(state?.timestamp).toBe(1000);
        expect(state?.status).toBe('success');
    });
});
