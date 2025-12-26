import { describe, it, expect, vi } from 'vitest';
import { render, waitFor, screen } from '@testing-library/react';
import React, { Suspense } from 'react';
import { QueryClientProvider } from '../src/addon/query/context';
import { QueryCache } from '../src/addon/query/queryCache';
import { useSuspenseQuery } from '../src/addon/query/useSuspenseQuery';

const createWrapper = () => {
    const client = new QueryCache();
    return {
        wrapper: ({ children }: { children: React.ReactNode }) => (
            React.createElement(QueryClientProvider, { client }, children)
        ),
        client
    };
};

const SuspenseComponent = ({ queryFn, queryKey }: any) => {
    const { data } = useSuspenseQuery({
        queryKey,
        queryFn
    });
    return <div>Data: {data}</div>;
};

describe('Suspense Support', () => {
    it('should suspend while fetching', async () => {
        const { wrapper: Wrapper, client } = createWrapper();
        const queryKey = ['suspense-test'];
        const queryFn = vi.fn().mockImplementation(async () => {
            await new Promise(resolve => setTimeout(resolve, 100));
            return 'Resolved Data';
        });

        const Fallback = () => <div>Loading...</div>;

        render(
            <Wrapper>
                <Suspense fallback={<Fallback />}>
                    <SuspenseComponent queryKey={queryKey} queryFn={queryFn} />
                </Suspense>
            </Wrapper>
        );

        // Should see fallback initially
        expect(screen.getByText('Loading...')).toBeDefined();

        // Should resolve
        await waitFor(() => {
            expect(screen.getByText('Data: Resolved Data')).toBeDefined();
        });
    });
});
