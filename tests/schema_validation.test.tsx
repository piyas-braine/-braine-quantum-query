import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useQuery } from '../src/query/useQuery';
import { z } from 'zod';
import React from 'react';
import { QueryClient } from '../src/query/queryClient';
import { QueryClientProvider } from '../src/query/context';

// Define a schema
const UserSchema = z.object({
    id: z.number(),
    name: z.string(),
    email: z.string().email()
});

describe('useQuery Schema Validation', () => {
    let client: QueryClient;
    let wrapper: React.FC<{ children: React.ReactNode }>;

    beforeEach(() => {
        client = new QueryClient();
        wrapper = ({ children }: { children: React.ReactNode }) => (
            <QueryClientProvider client={client}>{children}</QueryClientProvider>
        );
    });

    it('should validate correct data successfully', async () => {
        const validData = { id: 1, name: 'Alice', email: 'alice@example.com' };

        const { result } = renderHook(() => useQuery({
            queryKey: ['user', 1],
            queryFn: async () => validData,
            schema: UserSchema,
            staleTime: 0,
            retry: false
        }), { wrapper });

        await waitFor(() => expect(result.current.data).toEqual(validData));
        expect(result.current.isError).toBe(false);
    });

    it('should fail validation for incorrect data', async () => {
        const invalidData = { id: 1, name: 'Alice', email: 'not-an-email' };

        const { result } = renderHook(() => useQuery({
            queryKey: ['user', 2],
            queryFn: async () => invalidData,
            schema: UserSchema,
            staleTime: 0,
            retry: false
        }), { wrapper });

        await waitFor(() => expect(result.current.isError).toBe(true));

        expect(result.current.error).toBeInstanceOf(z.ZodError);
        expect(result.current.data).toBeUndefined();
    });

    it('should infer types correctly (compile time check)', async () => {
        // This test is mainly for manual verification or if we ran tsc
        const { result } = renderHook(() => useQuery({
            queryKey: ['user', 3],
            queryFn: async () => ({ id: 1, name: 'Bob', email: 'bob@example.com' }),
            schema: UserSchema,
            retry: false
        }), { wrapper });

        // Wait for fetch to complete to avoid "act" warnings about updates after test finishes
        await waitFor(() => expect(result.current.isSuccess).toBe(true));

        // result.current.data should be typed as { id: number; name: string; email: string; } | undefined
        // We can't easily assert types in runtime tests, but if the code compiles, the inference is working enough to allow usage.
    });
});
