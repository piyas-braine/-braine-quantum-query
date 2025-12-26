import { describe, it, expect, vi } from 'vitest';
import { QueryClient } from '../src/query/queryClient';
import { z } from 'zod';

describe('Senior Grade: Global Schema Validation', () => {

    it('should use default schema if none provided', async () => {
        const UserSchema = z.object({ id: z.number(), name: z.string() });
        const client = new QueryClient({ defaultSchema: UserSchema });

        // Valid data
        const data = await client.fetch(['user'], async () => ({ id: 1, name: 'Senior' }));
        expect(data).toEqual({ id: 1, name: 'Senior' });

        // Invalid data returns from fn
        await expect(client.fetch(['user2'], async () => ({ id: 'not-a-number' })))
            .rejects.toThrow();
    });

    it('should override default schema with local schema', async () => {
        const DefaultSchema = z.string();
        const LocalSchema = z.number();
        const client = new QueryClient({ defaultSchema: DefaultSchema });

        const data = await client.fetch(['val'], async () => 123, { schema: LocalSchema });
        expect(data).toBe(123);
    });
});
