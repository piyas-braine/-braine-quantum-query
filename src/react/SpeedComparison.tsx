import React, { useState } from 'react';
import { useQuery } from '../query/useQuery';
import { useQuery$ } from '../query/useQuerySignal';
import { SignalValue } from './SignalValue';
import { useQueryClient } from '../query/context';

const BENCHMARK_SIZE = 1000;

function StandardItem({ id }: { id: number }) {
    // Standard React Hook - Triggers re-render on every update
    const { data } = useQuery<{ count: number }>({
        queryKey: ['benchmark'],
        queryFn: async () => ({ count: 0, timestamp: Date.now() }),
        refetchInterval: 100 // Aggressive updates
    });

    return <div className="item">React: {data?.count}</div>;
}

function QuantumItem({ id }: { id: number }) {
    // Quantum Hook - Zero component re-renders
    const result$ = useQuery$<{ count: number }>({
        queryKey: ['benchmark'],
        queryFn: async () => ({ count: 0, timestamp: Date.now() }),
        refetchInterval: 100
    });

    return (
        <div className="item">
            Quantum:
            <SignalValue signal={result$}>
                {res => res.data?.count}
            </SignalValue>
        </div>
    );
}

export function SpeedComparison() {
    const [mode, setMode] = useState<'standard' | 'quantum'>('standard');
    const client = useQueryClient();

    // Simulator
    React.useEffect(() => {
        let count = 0;
        const interval = setInterval(() => {
            count++;
            client.set(['benchmark'], { count, timestamp: Date.now() });
        }, 16); // ~60fps updates
        return () => clearInterval(interval);
    }, [client]);

    return (
        <div style={{ padding: 20 }}>
            <h1>Quantum Speed Test</h1>
            <div style={{ marginBottom: 20 }}>
                <button onClick={() => setMode('standard')}>Standard Mode (React Render)</button>
                <button onClick={() => setMode('quantum')}>Quantum Mode (Zero Render)</button>
            </div>

            <h3>Current Mode: {mode.toUpperCase()}</h3>
            <p>Rendering {BENCHMARK_SIZE} items with 60fps data updates.</p>

            <div style={{ display: 'flex', flexWrap: 'wrap' }}>
                {Array.from({ length: BENCHMARK_SIZE }).map((_, i) => (
                    mode === 'standard' ? <StandardItem key={i} id={i} /> : <QuantumItem key={i} id={i} />
                ))}
            </div>
        </div>
    );
}
