import { describe, it, expect, vi } from 'vitest';
import { QueryClient } from '../src/query/queryClient';

describe('Senior Grade: GC & Robustness', () => {

    it('should evict least recently used INACTIVE entries when maxSize is reached', () => {
        const client = new QueryClient({ maxCacheSize: 2 });

        // 1. Fill cache with 2 entries
        client.set(['q1'], 'data1');
        client.set(['q2'], 'data2');

        expect(client.getStats().size).toBe(2);

        // 2. Access q1 to make it "Most Recently Used"
        client.get(['q1']);

        // 3. Add q3. This should trigger eviction.
        // Since q1 was just touched, q2 is the oldest. 
        // Neither q1 nor q2 are "watched" (no subscribers), so q2 should be evicted.
        client.set(['q3'], 'data3');

        expect(client.getStats().size).toBe(2);
        expect(client.get(['q1'])).toBe('data1');
        expect(client.get(['q2'])).toBeUndefined(); // Evicted!
        expect(client.get(['q3'])).toBe('data3');
    });

    it('should NOT evict active (watched) entries even if they are oldest', () => {
        const client = new QueryClient({ maxCacheSize: 2 });

        client.set(['q1'], 'data1');
        client.set(['q2'], 'data2');

        // Subscribe to q1 (make it active)
        const unsub = client.getSignal(['q1']).subscribe(() => { });

        // Add q3. 
        // q1 is oldest but active. q2 is newer but inactive.
        client.get(['q1']); // Move q1 to MRU, q2 to LRU
        client.set(['q3'], 'data3'); // q2 evicted.

        expect(client.get(['q1'])).toBe('data1');
        expect(client.get(['q2'])).toBeUndefined();

        // Now q1 (active) is oldest, q3 (inactive) is MRU.
        // Add q4. Should evict q3 instead of active q1.
        client.set(['q4'], 'data4');
        expect(client.get(['q1'])).toBe('data1'); // Saved by activity!
        expect(client.get(['q3'])).toBeUndefined(); // Evicted instead of active q1!

        unsub();
    });

    it('should throw error for deeply nested query keys (stableHash guard)', () => {
        const client = new QueryClient();

        let nested: any = { a: 1 };
        for (let i = 0; i < 20; i++) {
            nested = { nested };
        }

        expect(() => {
            client.getSignal([nested]);
        }).toThrow("[Quantum] Query key is too deeply nested. Max depth is 15.");
    });
});
