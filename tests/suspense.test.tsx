import { describe, it, expect, vi } from 'vitest';
import { render, waitFor, screen, act } from '@testing-library/react';
import React, { Suspense } from 'react';
import { QueryClientProvider } from '../src/query/context';
import { QueryClient } from '../src/query/queryClient';
import { useSuspenseQuery } from '../src/query/useSuspenseQuery';

const createWrapper = () => {
    const client = new QueryClient();
    return {
        wrapper: ({ children }: { children: React.ReactNode }) => (
            React.createElement(QueryClientProvider, { client, children })
        ),
        client
    };
};

const SuspenseComponent = ({ queryFn, queryKey }: any) => {
    const { data } = useSuspenseQuery({
        queryKey,
        queryFn
    });
    return <div>Data: {data as unknown as React.ReactNode}</div>;
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
    it('should throw error to ErrorBoundary', async () => {
        const { wrapper: Wrapper } = createWrapper();
        const queryKey = ['suspense-error'];
        const queryFn = vi.fn().mockRejectedValue(new Error('Boom'));

        // Prevent console.error from jsdom for this expected error
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { });

        // Simple Error Boundary
        class ErrorBoundary extends React.Component<{ fallback: React.ReactNode, children: React.ReactNode }, { hasError: boolean }> {
            state = { hasError: false };
            static getDerivedStateFromError() { return { hasError: true }; }
            render() {
                if (this.state.hasError) return this.props.fallback;
                return this.props.children;
            }
        }

        render(
            <Wrapper>
                <ErrorBoundary fallback={<div>Error Caught</div>}>
                    <Suspense fallback={<div>Loading...</div>}>
                        <SuspenseComponent queryKey={queryKey} queryFn={queryFn} />
                    </Suspense>
                </ErrorBoundary>
            </Wrapper>
        );

        await waitFor(() => {
            expect(screen.getByText('Error Caught')).toBeDefined();
        });

        consoleSpy.mockRestore();
    });

});
