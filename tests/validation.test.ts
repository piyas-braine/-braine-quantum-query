import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createHttpClient } from '../src/addon/httpClient';
import { z } from 'zod';

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('HttpClient Validation', () => {
    beforeEach(() => {
        mockFetch.mockReset();
    });

    it('should validate and infer type with Zod', async () => {
        const UserSchema = z.object({
            id: z.number(),
            name: z.string()
        });

        mockFetch.mockResolvedValue({
            ok: true,
            status: 200,
            text: async () => JSON.stringify({ id: 123, name: 'Alice' })
        });

        const api = createHttpClient({});

        // TypeScript infers 'user' as { id: number, name: string }
        const user = await api.get('/user', { schema: UserSchema });

        expect(user).toEqual({ id: 123, name: 'Alice' });
    });

    it('should throw mismatch error for invalid data', async () => {
        const UserSchema = z.object({
            id: z.number(),
            name: z.string()
        });

        // API returns bad data (name missing)
        mockFetch.mockResolvedValue({
            ok: true,
            status: 200,
            text: async () => JSON.stringify({ id: 123 })
        });

        const api = createHttpClient({});

        await expect(api.get('/user', { schema: UserSchema }))
            .rejects
            .toThrow(/Validation Error/);
    });
});
