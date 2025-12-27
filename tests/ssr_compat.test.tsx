/**
 * @vitest-environment node
 */
import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import React from 'react';
import { QueryClient, QueryClientProvider, useQuery } from '../src/index';

// Simple component using useQuery
function TestComponent() {
    const { data } = useQuery({
        queryKey: ['ssr'],
        queryFn: async () => 'data'
    });
    return <div>{data || 'loading'}</div>;
}

describe('SSR Compatibility checks', () => {
    it('should renderToString without Missing getServerSnapshot error', () => {
        const client = new QueryClient();

        // This should NOT throw "Missing getServerSnapshot"
        const html = renderToString(
            <QueryClientProvider client={client}>
                <TestComponent />
            </QueryClientProvider>
        );

        expect(html).toContain('loading');
    });
});
