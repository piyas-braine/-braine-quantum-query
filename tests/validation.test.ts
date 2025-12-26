import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createHttpClient } from '../src/httpClient';
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

        mockFetch.mockResolvedValue(new Response(JSON.stringify({ id: 123, name: 'Alice' }), { status: 200 }));

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
        mockFetch.mockResolvedValue(new Response(JSON.stringify({ id: 123 }), { status: 200 }));

        const api = createHttpClient({});

        await expect(api.get('/user', { schema: UserSchema }))
            .rejects
            .toThrow(/Validation Error/);
    });
});
