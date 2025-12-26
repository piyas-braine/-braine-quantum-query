import React, { useEffect, useState } from 'react';
import { getStores } from './registry';
import { subscribe } from '../core/proxy';

export function StatePanel() {
    const storesSignal = getStores();
    const [stores, setStores] = useState(storesSignal.get());

    // Subscribe to registry changes
    useEffect(() => {
        return storesSignal.subscribe(setStores);
    }, []);

    if (stores.length === 0) {
        return (
            <div style={{ padding: '20px', textAlign: 'center', color: '#666', fontSize: '12px' }}>
                No stores registered.<br />
                Use <code>registerStore(store)</code> to inspect proxies.
            </div>
        );
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', background: '#222', height: '100%', overflowY: 'auto' }}>
            {stores.map((entry, i) => (
                <StoreItem key={i} entry={entry} />
            ))}
        </div>
    );
}

function StoreItem({ entry }: { entry: { name: string, store: any } }) {
    const [expanded, setExpanded] = useState(true);
    const [data, setData] = useState(entry.store);
    const [flash, setFlash] = useState(false);

    useEffect(() => {
        // Subscribe to store updates to live-refresh the view
        const unsub = subscribe(entry.store, () => {
            // Force update
            setData({ ...entry.store });

            // Visual Flash
            setFlash(true);
            setTimeout(() => setFlash(false), 200);
        });
        return () => { unsub(); };
    }, [entry.store]);

    return (
        <div style={{ background: '#111', marginBottom: '1px' }}>
            <div
                onClick={() => setExpanded(!expanded)}
                style={{
                    padding: '8px',
                    background: flash ? '#222' : '#1a1a1a',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    transition: 'background 0.2s'
                }}
            >
                <span style={{ color: '#b0fb5d', fontSize: '10px' }}>{expanded ? '▼' : '▶'}</span>
                <span style={{ color: '#fff', fontSize: '12px', fontWeight: 'bold' }}>{entry.name}</span>
            </div>

            {expanded && (
                <div style={{ padding: '8px', background: '#0a0a0a' }}>
                    <JSONTree data={data} />
                </div>
            )}
        </div>
    );
}

function JSONTree({ data }: { data: any }) {
    if (typeof data !== 'object' || data === null) {
        return <span style={{ color: '#ce9178' }}>{String(data)}</span>;
    }

    return (
        <div style={{ fontFamily: 'monospace', fontSize: '11px', color: '#9cdcfe' }}>
            {Object.entries(data).map(([key, value]) => (
                <div key={key} style={{ paddingLeft: '12px' }}>
                    <span style={{ color: '#dcdcaa' }}>{key}: </span>
                    <JSONValue value={value} />
                </div>
            ))}
        </div>
    );
}

function JSONValue({ value }: { value: any }) {
    if (typeof value === 'object' && value !== null) {
        if (Array.isArray(value)) {
            return <span>[{value.length}]</span>;
        }
        return <span>{'{...}'}</span>;
    }
    return <span style={{ color: '#ce9178' }}>{String(value)}</span>;
}
