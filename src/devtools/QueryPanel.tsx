import React, { useMemo, useState } from 'react';
import { useQueryStore } from '../query/useQueryStore';
import { useQueryClient } from '../query/context';
import { type CacheEntry } from '../query/queryStorage';
import { type QueryClient } from '../query/queryClient';
import { stableHash } from '../query/utils';

export function QueryPanel() {
    const cache = useQueryStore();
    const client = useQueryClient();
    const [filter, setFilter] = useState('');

    const entries = useMemo(() => Array.from(cache.entries()), [cache]);
    const filteredEntries = useMemo(() => {
        if (!filter) return entries;
        const search = filter.toLowerCase();
        return entries.filter(([_, entry]) => {
            const key = entry.key;
            if (Array.isArray(key)) {
                return key.some((k: unknown) => String(k).toLowerCase().includes(search));
            }
            return JSON.stringify(key).toLowerCase().includes(search);
        });
    }, [entries, filter]);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            {/* Toolbar */}
            <div style={{
                padding: '8px',
                borderBottom: '1px solid #222',
                background: '#0f0f0f',
                display: 'flex',
                gap: '8px'
            }}>
                <input
                    type="text"
                    placeholder="Filter queries..."
                    value={filter}
                    onChange={e => setFilter(e.target.value)}
                    style={{
                        background: '#1a1a1a',
                        border: '1px solid #333',
                        color: '#fff',
                        padding: '4px 8px',
                        borderRadius: '4px',
                        flex: 1,
                        fontSize: '12px',
                        outline: 'none'
                    }}
                />
                <button
                    onClick={() => client.invalidateAll()}
                    style={{
                        background: '#222',
                        border: '1px solid #333',
                        color: '#d69e2e',
                        borderRadius: '4px',
                        padding: '0 8px',
                        cursor: 'pointer',
                        fontSize: '11px'
                    }}
                >
                    Invalidate All
                </button>
            </div>

            {/* Content */}
            <div style={{
                flex: 1,
                overflowY: 'auto',
                padding: '8px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                background: '#050505'
            }}>
                {entries.length === 0 ? (
                    <div style={{ padding: '20px', textAlign: 'center', color: '#444', fontSize: '12px' }}>
                        No active queries.
                    </div>
                ) : (
                    filteredEntries.map(([keyHash, entry]) => (
                        <QueryItem
                            key={keyHash}
                            entry={entry}
                            client={client}
                            isStale={client.isStale(entry.key)}
                        />
                    ))
                )}
            </div>
        </div>
    );
}

function QueryItem({ entry, client, isStale }: { entry: CacheEntry<unknown>, client: QueryClient, isStale: boolean }) {
    const [expanded, setExpanded] = useState(false);

    return (
        <div style={{
            background: '#111',
            borderRadius: '4px',
            border: '1px solid #222',
            overflow: 'hidden'
        }}>
            <div
                onClick={() => setExpanded(!expanded)}
                style={{
                    padding: '6px 8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    background: expanded ? '#161616' : 'transparent'
                }}
            >
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', overflow: 'hidden' }}>
                    <span style={{
                        color: isStale ? '#d69e2e' : '#b0fb5d',
                        fontSize: '12px',
                        fontWeight: 'bold'
                    }}>•</span>
                    <span style={{
                        color: '#e0e0e0',
                        fontSize: '12px',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                    }}>
                        {JSON.stringify(entry.key)}
                    </span>
                </div>
                <span style={{
                    fontSize: '9px',
                    color: isStale ? '#d69e2e' : '#b0fb5d',
                    padding: '1px 4px',
                    border: `1px solid ${isStale ? '#d69e2e' : '#b0fb5d'}`,
                    borderRadius: '2px',
                    opacity: 0.7
                }}>
                    {isStale ? 'STALE' : 'FRESH'}
                </span>
            </div>

            {expanded && (
                <div style={{
                    padding: '8px',
                    borderTop: '1px solid #222',
                    background: '#0a0a0a'
                }}>
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                        <button
                            onClick={(e) => { e.stopPropagation(); client.invalidate(entry.key); }}
                            style={{ fontSize: '10px', padding: '2px 6px', cursor: 'pointer', background: '#222', border: '1px solid #333', color: '#d69e2e', borderRadius: '2px' }}
                        >Invalidate</button>
                        <button
                            onClick={(e) => { e.stopPropagation(); client.remove(entry.key); }}
                            style={{ fontSize: '10px', padding: '2px 6px', cursor: 'pointer', background: '#222', border: '1px solid #333', color: '#ff4d4f', borderRadius: '2px' }}
                        >Remove</button>
                    </div>
                    <pre style={{ margin: 0, fontSize: '10px', color: '#a0a0a0', overflowX: 'auto', fontFamily: 'monospace' }}>
                        {JSON.stringify(entry.data, null, 2)}
                    </pre>
                </div>
            )}
        </div>
    );
}
