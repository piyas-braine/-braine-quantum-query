import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient } from '../src/query/queryClient';
import { QueryObserver } from '../src/query/queryObserver';
import { focusManager } from '../src/query/focusManager';
import { onlineManager } from '../src/query/onlineManager';

describe('Environment Awareness', () => {
    let client: QueryClient;

    beforeEach(() => {
        client = new QueryClient();
        focusManager.setFocused(true);
    });

    it('should refetch on window focus by default', async () => {
        const queryFn = vi.fn().mockResolvedValue('data');
        const observer = new QueryObserver(client, {
            queryKey: ['test'],
            queryFn,
        });

        // Initial fetch
        const unsub = observer.subscribe(() => { });
        await new Promise(r => setTimeout(r, 10));
        expect(queryFn).toHaveBeenCalledTimes(1);

        // Transition focus
        focusManager.setFocused(false);
        focusManager.setFocused(true);

        expect(queryFn).toHaveBeenCalledTimes(2);
        unsub();
    });

    it('should NOT refetch on focus if refetchOnWindowFocus is false', async () => {
        const queryFn = vi.fn().mockResolvedValue('data');
        const observer = new QueryObserver(client, {
            queryKey: ['test-no-focus'],
            queryFn,
            refetchOnWindowFocus: false,
        });

        const unsub = observer.subscribe(() => { });
        await new Promise(r => setTimeout(r, 10));
        expect(queryFn).toHaveBeenCalledTimes(1);

        focusManager.setFocused(false);
        focusManager.setFocused(true);

        expect(queryFn).toHaveBeenCalledTimes(1); // Still 1
        unsub();
    });

    it('should refetch when coming back online', async () => {
        const queryFn = vi.fn().mockResolvedValue('data');
        const observer = new QueryObserver(client, {
            queryKey: ['test-online'],
            queryFn,
        });

        const unsub = observer.subscribe(() => { });
        await new Promise(r => setTimeout(r, 10));
        expect(queryFn).toHaveBeenCalledTimes(1);

        // Simulate offline then online
        // In this simple implementation, onlineManager doesn't have a public setter for test, 
        // we'd normally mock window dispatchEvent or the manager itself.
        // Let's mock the manager's internal listener trigger if possible or use vi.mock.

        // For this test, let's just trigger the listeners manually via the manager
        // (Usually we'd want a more realistic DOM event dispatch)
        (onlineManager as any).setOnline(false);
        (onlineManager as any).setOnline(true);

        expect(queryFn).toHaveBeenCalledTimes(2);
        unsub();
    });
});
