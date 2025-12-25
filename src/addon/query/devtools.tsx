import React, { useState } from 'react';
import { useQueryCache } from './useQueryCache';
import { useQueryClient } from './context';

export function QuantumDevTools() {
    const [isOpen, setIsOpen] = useState(false);
    const cache = useQueryCache();
    const client = useQueryClient();

    if (!isOpen) {
        return (
            <button
                onClick={() => setIsOpen(true)}
                style={{
                    position: 'fixed',
                    bottom: '10px',
                    right: '10px',
                    background: '#000',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '50%',
                    width: '40px',
                    height: '40px',
                    cursor: 'pointer',
                    zIndex: 9999,
                    boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                    fontSize: '20px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                }}
            >
                ⚡️
            </button>
        );
    }

    return (
        <div style={{
            position: 'fixed',
            bottom: 0,
            right: 0,
            width: '100%',
            maxWidth: '600px',
            height: '400px',
            background: '#1a1a1a',
            color: '#fff',
            borderTopLeftRadius: '10px',
            boxShadow: '0 -4px 20px rgba(0,0,0,0.3)',
            zIndex: 9999,
            display: 'flex',
            flexDirection: 'column',
            fontFamily: 'monospace'
        }}>
            <div style={{
                padding: '10px',
                borderBottom: '1px solid #333',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: '#222',
                borderTopLeftRadius: '10px'
            }}>
                <span style={{ fontWeight: 'bold' }}>⚡️ Quantum DevTools</span>
                <button
                    onClick={() => setIsOpen(false)}
                    style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#999',
                        cursor: 'pointer',
                        fontSize: '16px'
                    }}
                >
                    ✕
                </button>
            </div>

            <div style={{
                flex: 1,
                overflowY: 'auto',
                padding: '10px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
            }}>
                {Array.from(cache.entries()).length === 0 ? (
                    <div style={{ padding: '20px', textAlign: 'center', color: '#666' }}>
                        No active queries
                    </div>
                ) : (
                    Array.from(cache.entries()).map(([keyHash, entry]) => (
                        <div key={keyHash} style={{
                            background: '#2a2a2a',
                            borderRadius: '4px',
                            padding: '8px',
                            border: '1px solid #333'
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                <span style={{ color: '#aaa', fontSize: '12px' }}>
                                    {entry.key.map(k => String(k)).join(' / ')}
                                </span>
                                <div style={{ display: 'flex', gap: '5px' }}>
                                    <span style={{
                                        fontSize: '10px',
                                        padding: '2px 4px',
                                        borderRadius: '2px',
                                        background: client.isStale(entry.key) ? '#dda0dd' : '#90ee90',
                                        color: '#000'
                                    }}>
                                        {client.isStale(entry.key) ? 'STALE' : 'FRESH'}
                                    </span>
                                </div>
                            </div>

                            <div style={{
                                fontSize: '11px',
                                color: '#ddd',
                                whiteSpace: 'pre-wrap',
                                maxHeight: '100px',
                                overflow: 'hidden',
                                opacity: 0.8
                            }}>
                                {JSON.stringify(entry.data, null, 2)}
                            </div>

                            <div style={{ marginTop: '8px', display: 'flex', gap: '8px' }}>
                                <button
                                    onClick={() => client.invalidate(entry.key)}
                                    style={{
                                        background: '#444',
                                        border: 'none',
                                        color: '#fff',
                                        padding: '4px 8px',
                                        borderRadius: '3px',
                                        cursor: 'pointer',
                                        fontSize: '10px'
                                    }}
                                >
                                    Invalidate
                                </button>
                                <button
                                    onClick={() => {
                                        client.invalidate(entry.key);
                                        // Trigger a refetch via window focus simulation or just rely on the app re-rendering
                                        // Since we don't have a direct 'refetch' method on the cache that triggers listeners immediately in this polls setup
                                        // invalidation -> next useQuery read -> fetch
                                    }}
                                    style={{
                                        background: '#444',
                                        border: 'none',
                                        color: '#fff',
                                        padding: '4px 8px',
                                        borderRadius: '3px',
                                        cursor: 'pointer',
                                        fontSize: '10px'
                                    }}
                                >
                                    Refetch
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
