import { useState, useEffect } from 'react';
import { useQueryClient } from './context';

export function useQueryCache() {
    const client = useQueryClient();
    const [cache, setCache] = useState(client.getAll());

    useEffect(() => {
        const interval = setInterval(() => {
            // Polling for changes (Simple & Robust for DevTools)
            // In a real implementation, we would use a subscription model on the QueryCache
            setCache({ ...client.getAll() });
        }, 500);

        return () => clearInterval(interval);
    }, [client]);

    return cache;
}
