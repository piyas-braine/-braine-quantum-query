import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createHttpClient } from '../src/httpClient';

// Mock Fetch Global
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('createHttpClient', () => {
    beforeEach(() => {
        mockFetch.mockReset();
        mockFetch.mockResolvedValue(new Response('{}', { status: 200 }));
    });

    it('should make basic requests', async () => {
        mockFetch.mockResolvedValue(new Response('{"id": 1}', { status: 200 }));

        const api = createHttpClient({ baseURL: 'https://api.test' });
        const res = await api.get<{ id: number }>('/users');

        const req = mockFetch.mock.calls[0]![0] as Request;
        expect(req.url).toContain('/users');
        expect(res.id).toBe(1);
    });

    it('should inject auth headers', async () => {
        mockFetch.mockResolvedValue(new Response('{}', { status: 200 }));

        const api = createHttpClient({
            auth: {
                getToken: () => 'valid-token',
                onTokenExpired: async () => 'new-token'
            }
        });

        await api.post('/test');

        const req = mockFetch.mock.lastCall?.[0] as Request;
        expect(req).toBeDefined();
        expect(req.url).toContain('/test');
        expect(req.headers.get('Authorization')).toBe('Bearer valid-token');
    });

    it('should handle 401 refresh flow', async () => {
        // 1st Call: 401
        mockFetch.mockResolvedValueOnce(new Response('Unauthorized', { status: 401, statusText: 'Unauthorized' }));

        // 2nd Call: 200 (Retry)
        mockFetch.mockResolvedValueOnce(new Response('{"success": true}', { status: 200 }));

        const onTokenExpired = vi.fn().mockResolvedValue('refreshed-token');

        const api = createHttpClient({
            auth: {
                getToken: () => 'old-token',
                onTokenExpired
            }
        });

        const res = await api.get<{ success: boolean }>('/secure');

        // Should call refresh
        expect(onTokenExpired).toHaveBeenCalled();

        // Should retry with new token
        expect(mockFetch).toHaveBeenCalledTimes(2);

        // Second call should have refreshed token
        const req = mockFetch.mock.calls[1]![0] as Request;
        expect(req.url).toContain('/secure');
        expect(req.headers.get('Authorization')).toBe('Bearer refreshed-token');

        expect(res.success).toBe(true);
    });
});
