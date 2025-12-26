import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createHttpClient } from '../src/httpClient';

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('HttpClient Deduplication', () => {
    beforeEach(() => {
        mockFetch.mockReset();
        mockFetch.mockResolvedValue(new Response('{}', { status: 200 }));
    });

    it('should dedupe parallel GET requests', async () => {
        // Delay the first response so the second request hits while the first is pending
        // Delay the first response so the second request hits while the first is pending
        // Delay the first response so the second request hits while the first is pending
        mockFetch.mockReturnValue(new Promise(resolve =>
            setTimeout(() => resolve(new Response('{"count": 1}', { status: 200 })), 100)
        ));

        const api = createHttpClient({ baseURL: 'http://test' });

        const p1 = api.get<{ count: number }>('/dedupe');
        const p2 = api.get<{ count: number }>('/dedupe');

        const [r1, r2] = await Promise.all([p1, p2]);

        expect(r1.count).toBe(1);
        expect(r2.count).toBe(1);

        // Crucial check: Fetch should only be called ONCE
        expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should NOT dedupe distinct requests', async () => {
        mockFetch
            .mockResolvedValueOnce(new Response('{}', { status: 200 }))
            .mockResolvedValueOnce(new Response('{}', { status: 200 }));

        const api = createHttpClient({ baseURL: 'http://test' });

        await Promise.all([
            api.get('/a'),
            api.get('/b')
        ]);

        expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should NOT dedupe POST requests', async () => {
        mockFetch
            .mockResolvedValueOnce(new Response('{}', { status: 200 }))
            .mockResolvedValueOnce(new Response('{}', { status: 200 }));

        const api = createHttpClient({ baseURL: 'http://test' });

        // Even if body is same, POSTs usually have side effects so we shouldn't dedupe by default
        await Promise.all([
            api.post('/submit', { a: 1 }),
            api.post('/submit', { a: 1 })
        ]);

        expect(mockFetch).toHaveBeenCalledTimes(2);
    });
});
