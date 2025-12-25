import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createHttpClient } from '../src/addon/httpClient';

// Mock Fetch Global
const mockFetch = vi.fn();
global.fetch = mockFetch;

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

describe('HttpClient Intelligent Caching', () => {
    beforeEach(() => {
        mockFetch.mockResolvedValue(new Response('{}', { status: 200 })); vi.useRealTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('should cache response within TTL', async () => {
        mockFetch.mockResolvedValue(new Response('{"data": "fresh"}', { status: 200 }));

        const api = createHttpClient({ baseURL: 'https://api.test' });

        mockFetch.mockClear();
        // First Request: Network
        const res1 = await api.get('/cache', { cache: { ttl: 5000 } });
        expect(res1).toEqual({ data: 'fresh' });
        expect(mockFetch).toHaveBeenCalledTimes(1);

        // Second Request: Cache (Immediate)
        const res2 = await api.get('/cache', { cache: { ttl: 5000 } });
        expect(res2).toEqual({ data: 'fresh' });
        expect(mockFetch).toHaveBeenCalledTimes(1); // Still 1!
    });

    it('should re-fetch after TTL expires', async () => {
        mockFetch.mockResolvedValue(new Response('{"data": "fresh"}', { status: 200 }));

        const api = createHttpClient({ baseURL: 'https://api.test' });

        mockFetch.mockClear();
        // Request 1
        await api.get('/expire', { cache: { ttl: 100 } });
        expect(mockFetch).toHaveBeenCalledTimes(1);

        // Advance Time > TTL
        vi.setSystemTime(Date.now() + 150);

        // Request 2
        await api.get('/expire', { cache: { ttl: 100 } });
        expect(mockFetch).toHaveBeenCalledTimes(2); // New Fetch
    });

    it('should bypass cache when force is true', async () => {
        mockFetch.mockResolvedValue(new Response('{}', { status: 200 }));

        const api = createHttpClient({});

        mockFetch.mockClear();
        await api.get('/force', { cache: { ttl: 5000 } });
        expect(mockFetch).toHaveBeenCalledTimes(1);

        mockFetch.mockClear();
        await api.get('/force', { cache: { ttl: 5000, force: true } });
        expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should return a clone of cached data (immutability)', async () => {
        mockFetch.mockResolvedValue(new Response('{"items": [1, 2]}', { status: 200 }));

        const api = createHttpClient({});

        const res1 = await api.get<any>('/mutate', { cache: { ttl: 5000 } });
        res1.items.push(3); // Mutate result

        const res2 = await api.get<any>('/mutate', { cache: { ttl: 5000 } });
        expect(res2.items).toEqual([1, 2]); // Should be original
        expect(res2.items.length).toBe(2);
    });
});
