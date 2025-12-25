import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { defineModel } from '../src/core/model';

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

describe('Magic Persistence', () => {

    // Mock LocalStorage
    const mockStorage = new Map<string, string>();
    const localStorageMock = {
        getItem: vi.fn((key: string) => mockStorage.get(key) || null),
        setItem: vi.fn((key: string, value: string) => mockStorage.set(key, value)),
        removeItem: vi.fn((key: string) => mockStorage.delete(key))
    };

    beforeEach(() => {
        mockStorage.clear();
        vi.clearAllMocks();
        // @ts-ignore
        global.window = { localStorage: localStorageMock };
    });

    it('should hydrate from localStorage (Sync)', () => {
        // Setup existing data
        mockStorage.set('user-store', JSON.stringify({ name: 'Alice' }));

        const model = defineModel({
            persist: { key: 'user-store', storage: 'local' },
            state: { name: 'Bob' } // Default
        });

        // Should be Alice instantly
        expect(model.name).toBe('Alice');
    });

    it('should auto-save to localStorage (Sync)', async () => {
        const model = defineModel({
            persist: { key: 'save-test', storage: 'local' },
            state: { count: 0 }
        });

        model.count = 5;

        // Wait for debounce (100ms)
        await delay(150);

        expect(localStorageMock.setItem).toHaveBeenCalledWith('save-test', '{"count":5}');
        expect(mockStorage.get('save-test')).toBe('{"count":5}');
    });

    it('should support AsyncStorage (React Native / Async)', async () => {
        const asyncMock = {
            getItem: vi.fn(async (key: string) => {
                await delay(10);
                return '{"theme": "dark"}';
            }),
            setItem: vi.fn(async (k, v) => { })
        };

        const model = defineModel({
            persist: { key: 'rn-test', storage: asyncMock as any },
            state: { theme: 'light' }
        });

        // Initially default (Sync)
        expect(model.theme).toBe('light');

        // Wait for Async Hydration
        await delay(20);

        // Should update
        expect(model.theme).toBe('dark');
    });

    it('should only save whitelisted paths', async () => {
        const model = defineModel({
            persist: { key: 'whitelist', storage: 'local', paths: ['saved'] },
            state: { saved: 'yes', ignored: 'no' }
        });

        model.saved = 'modified';
        model.ignored = 'modified';

        await delay(150);

        expect(mockStorage.get('whitelist')).toBe('{"saved":"modified"}');
    });
});
