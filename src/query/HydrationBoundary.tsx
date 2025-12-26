import React, { useRef } from 'react';
import { useQueryClient } from './context';
import { hydrate, type DehydratedState } from './hydration';

interface HydrationBoundaryProps {
    state?: DehydratedState;
    children: React.ReactNode;
}

export function HydrationBoundary({ state, children }: HydrationBoundaryProps) {
    const client = useQueryClient();
    const hydratedRef = useRef(false);

    if (state && !hydratedRef.current) {
        hydrate(client, state);
        hydratedRef.current = true;
    }

    return <>{children}</>;
}
