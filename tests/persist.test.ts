import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { atom } from '../src/store/model';

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

describe('Magic Persistence (Atoms)', () => {

    // Mock LocalStorage
    const mockStorage = new Map<string, string>();
    const localStorageMock = {
        getItem: vi.fn((key: string) => {
            console.log('[Test] getItem called:', key);
            return mockStorage.get(key) || null;
        }),
        setItem: vi.fn((key: string, value: string) => mockStorage.set(key, value)),
        removeItem: vi.fn((key: string) => mockStorage.delete(key))
    };

    beforeEach(() => {
        mockStorage.clear();
        vi.clearAllMocks();
        // @ts-ignore
        global.window = { localStorage: localStorageMock };
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('should hydrate from localStorage (Sync using hydrateSync)', () => {
        // Setup existing data
        mockStorage.set('user-store', JSON.stringify({ name: 'Alice' }));

        // 10/10 Test Practice: DI + Determinism
        const user$ = atom({ name: 'Bob' }, {
            key: 'user-store',
            storage: localStorageMock as any,
            hydrateSync: true
        });

        // Should be Alice safely
        expect(user$.get().name).toBe('Alice');
    });

    it('should auto-save to localStorage', async () => {
        const count$ = atom({ count: 0 }, { key: 'save-test', storage: 'local' });

        count$.set({ count: 5 });

        // Signal effects run synchronously/microtask usually, but persistence might need a tick
        // Our implementation is sync inside effect.
        await delay(10);

        expect(localStorageMock.setItem).toHaveBeenCalledWith('save-test', '{"count":5}');
        expect(mockStorage.get('save-test')).toBe('{"count":5}');
    });

    it('should support AsyncStorage (Async)', async () => {
        const asyncMock = {
            getItem: vi.fn(async (key: string) => {
                await delay(10);
                return '{"theme": "dark"}';
            }),
            setItem: vi.fn(async (k, v) => { })
        };

        const theme$ = atom({ theme: 'light' }, { key: 'rn-test', storage: asyncMock as any });

        // Initially default (Sync) because async hydration takes time
        expect(theme$.get().theme).toBe('light');

        // Wait for Async Hydration
        await delay(50);

        // Should update
        expect(theme$.get().theme).toBe('dark');
    });
});
