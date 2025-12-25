import React, { useState } from 'react';
import { useQuery } from '../addon/query/useQuery';
import { QuantumDevTools } from '../addon/query/devtools';
import { QueryClientProvider, useQueryClient } from '../addon/query/context';

const client = {
    // Mock client creation for demo if needed, or use default provider
    // In real app: const client = new QueryCache();
};

function UserProfile({ id }: { id: number }) {
    const { data, isFetching, error } = useQuery({
        queryKey: ['user', id],
        queryFn: async () => {
            await new Promise(r => setTimeout(r, 1000));
            if (Math.random() > 0.8) throw new Error('Random Failure');
            return { id, name: `User ${id}`, timestamp: Date.now() };
        },
        staleTime: 5000
    });

    if (error) return <div style={{ color: 'red' }}>Error: {error.message}</div>;

    return (
        <div style={{ border: '1px solid #ccc', padding: '10px', margin: '10px' }}>
            <h3>User {id}</h3>
            {isFetching ? 'Loading...' : <pre>{JSON.stringify(data, null, 2)}</pre>}
        </div>
    );
}

export function DevToolsDemo() {
    const [userIds, setUserIds] = useState([1, 2]);

    return (
        <QueryClientProvider>
            <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>
                <h1>Quantum DevTools Demo</h1>
                <button onClick={() => setUserIds(ids => [...ids, ids.length + 1])}>
                    Add User
                </button>

                <div style={{ display: 'flex', flexWrap: 'wrap' }}>
                    {userIds.map(id => <UserProfile key={id} id={id} />)}
                </div>

                <QuantumDevTools />
            </div>
        </QueryClientProvider>
    );
}
