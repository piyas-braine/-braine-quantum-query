import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createHttpClient } from '../src/addon/httpClient';

// Mock Fetch Global
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('createHttpClient', () => {
    beforeEach(() => {
        mockFetch.mockReset();
    });

    it('should make basic requests', async () => {
        mockFetch.mockResolvedValue({
            ok: true,
            text: () => Promise.resolve('{"id": 1}'),
            status: 200
        });

        const api = createHttpClient({ baseURL: 'https://api.test' });
        const res = await api.get<{ id: number }>('/users');

        expect(mockFetch).toHaveBeenCalledWith(
            'https://api.test/users',
            expect.objectContaining({ method: 'GET' })
        );
        expect(res.id).toBe(1);
    });

    it('should inject auth headers', async () => {
        mockFetch.mockResolvedValue({ ok: true, text: async () => '{}' });

        const api = createHttpClient({
            auth: {
                getToken: () => 'valid-token',
                onTokenExpired: async () => 'new-token'
            }
        });

        await api.post('/test');

        expect(mockFetch).toHaveBeenCalledWith(
            '/test',
            expect.objectContaining({
                headers: expect.objectContaining({
                    'Authorization': 'Bearer valid-token'
                })
            })
        );
    });

    it('should handle 401 refresh flow', async () => {
        // 1st Call: 401
        mockFetch.mockResolvedValueOnce({
            ok: false,
            status: 401,
            text: async () => 'Unauthorized'
        });

        // 2nd Call: 200 (Retry)
        mockFetch.mockResolvedValueOnce({
            ok: true,
            status: 200,
            text: async () => '{"success": true}'
        });

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
        expect(mockFetch).toHaveBeenLastCalledWith(
            '/secure',
            expect.objectContaining({
                headers: expect.objectContaining({
                    'Authorization': 'Bearer refreshed-token'
                })
            })
        );

        expect(res.success).toBe(true);
    });
});
