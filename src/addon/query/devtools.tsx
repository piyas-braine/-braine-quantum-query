import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useQueryCache } from './useQueryCache';
import { useQueryClient } from './context';

export function QuantumDevTools() {
    const [isOpen, setIsOpen] = useState(false);
    const [isMinimized, setIsMinimized] = useState(false);
    const [height, setHeight] = useState(450);
    const [filter, setFilter] = useState('');
    const cache = useQueryCache();
    const client = useQueryClient();

    // Resize Logic
    const isResizingRef = useRef(false);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!isResizingRef.current) return;
            const newHeight = window.innerHeight - e.clientY;
            if (newHeight > 200 && newHeight < window.innerHeight - 50) {
                setHeight(newHeight);
            }
        };

        const handleMouseUp = () => {
            isResizingRef.current = false;
            document.body.style.cursor = 'default';
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, []);

    const entries = useMemo(() => Array.from(cache.entries()), [cache]);
    const filteredEntries = useMemo(() => {
        if (!filter) return entries;
        const search = filter.toLowerCase();
        return entries.filter(([_, entry]) =>
            entry.key.some(k => String(k).toLowerCase().includes(search))
        );
    }, [entries, filter]);

    if (!isOpen) {
        return (
            <button
                onClick={() => setIsOpen(true)}
                style={{
                    position: 'fixed',
                    bottom: '20px',
                    right: '20px',
                    background: '#111',
                    color: '#b0fb5d', // Quantum Green
                    border: '1px solid #333',
                    borderRadius: '50%',
                    width: '48px',
                    height: '48px',
                    cursor: 'pointer',
                    zIndex: 9999,
                    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
                    fontSize: '20px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'transform 0.2s',
                    fontFamily: 'monospace'
                }}
                onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.1)'}
                onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                title="Open Quantum DevTools"
            >
                ⚡️
            </button>
        );
    }

    if (isMinimized) {
        return (
            <div style={{
                position: 'fixed',
                bottom: '20px',
                right: '20px',
                background: '#111',
                border: '1px solid #333',
                borderRadius: '8px',
                padding: '8px 12px',
                zIndex: 9999,
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
                fontFamily: 'monospace',
                color: '#e0e0e0',
                cursor: 'pointer'
            }} onClick={() => setIsMinimized(false)}>
                <span style={{ color: '#b0fb5d' }}>⚡️</span>
                <span style={{ fontSize: '12px' }}>DevTools</span>
                <span style={{
                    background: '#333',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    fontSize: '10px'
                }}>{entries.length} queries</span>
            </div>
        );
    }

    return (
        <div
            ref={containerRef}
            style={{
                position: 'fixed',
                bottom: 0,
                right: 0,
                width: '100%',
                height: `${height}px`,
                background: '#0a0a0a',
                color: '#e0e0e0',
                borderTopLeftRadius: '12px',
                borderTopRightRadius: '12px',
                boxShadow: '0 -10px 40px rgba(0,0,0,0.5)',
                zIndex: 9999,
                display: 'flex',
                flexDirection: 'column',
                fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                fontSize: '13px',
                borderTop: '1px solid #333'
            }}
        >
            {/* Resizer Handle */}
            <div
                onMouseDown={() => {
                    isResizingRef.current = true;
                    document.body.style.cursor = 'ns-resize';
                }}
                style={{
                    height: '6px',
                    width: '100%',
                    cursor: 'ns-resize',
                    position: 'absolute',
                    top: '-3px',
                    left: 0,
                    zIndex: 10,
                    // debugging color: background: 'red', opacity: 0.2
                }}
            />

            {/* Header */}
            <div style={{
                padding: '12px 16px',
                borderBottom: '1px solid #222',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: '#111',
                borderTopLeftRadius: '12px',
                borderTopRightRadius: '12px',
                userSelect: 'none'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ color: '#b0fb5d', fontSize: '16px' }}>⚡️</span>
                    <span style={{ fontWeight: 600, letterSpacing: '-0.5px' }}>Quantum DevTools</span>
                    <span style={{
                        background: '#222',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        fontSize: '10px',
                        color: '#666'
                    }}>v1.2.3</span>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                        onClick={() => setIsMinimized(true)}
                        title="Minimize"
                        style={{
                            background: 'transparent',
                            border: 'none',
                            color: '#666',
                            cursor: 'pointer',
                            fontSize: '16px',
                            padding: '4px',
                            lineHeight: 1
                        }}
                    >
                        _
                    </button>
                    <button
                        onClick={() => setIsOpen(false)}
                        title="Close"
                        style={{
                            background: 'transparent',
                            border: 'none',
                            color: '#666',
                            cursor: 'pointer',
                            fontSize: '18px',
                            padding: '4px',
                            lineHeight: 1
                        }}
                    >
                        ×
                    </button>
                </div>
            </div>

            {/* Toolbar */}
            <div style={{
                padding: '8px 16px',
                borderBottom: '1px solid #222',
                background: '#0f0f0f',
                display: 'flex',
                gap: '12px'
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
                        padding: '6px 10px',
                        borderRadius: '4px',
                        flex: 1,
                        fontSize: '12px',
                        outline: 'none'
                    }}
                />
                <button
                    onClick={() => client.invalidateAll()}
                    title="Invalidate All Queries"
                    style={{
                        background: '#222',
                        border: '1px solid #333',
                        color: '#d69e2e',
                        borderRadius: '4px',
                        padding: '0 12px',
                        cursor: 'pointer',
                        fontSize: '12px',
                        fontWeight: 500
                    }}
                >
                    ↻ Invalidate All
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
                    <div style={{
                        padding: '40px',
                        textAlign: 'center',
                        color: '#444',
                        fontStyle: 'italic'
                    }}>
                        No active queries in cache.<br />
                        <span style={{ fontSize: '11px', opacity: 0.7 }}>
                            (Note: Only `useQuery` calls appear here. Raw `api.get` calls are not cached globally.)
                        </span>
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

function QueryItem({ entry, client, isStale }: { entry: any, client: any, isStale: boolean }) {
    const [expanded, setExpanded] = useState(false);

    return (
        <div style={{
            background: '#111',
            borderRadius: '6px',
            border: '1px solid #222',
            overflow: 'hidden'
        }}>
            <div
                onClick={() => setExpanded(!expanded)}
                style={{
                    padding: '8px 12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    background: expanded ? '#161616' : 'transparent'
                }}
            >
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center', overflow: 'hidden' }}>
                    <span style={{
                        color: isStale ? '#d69e2e' : '#b0fb5d',
                        fontSize: '14px',
                        fontWeight: 'bold',
                        minWidth: '10px'
                    }}>
                        {isStale ? '•' : '•'}
                    </span>
                    <span style={{
                        color: '#e0e0e0',
                        fontWeight: 500,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                    }}>
                        ['{entry.key.join("', '")}']
                    </span>
                </div>

                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <span style={{
                        fontSize: '10px',
                        padding: '2px 6px',
                        borderRadius: '3px',
                        background: isStale ? 'rgba(214, 158, 46, 0.15)' : 'rgba(176, 251, 93, 0.15)',
                        color: isStale ? '#d69e2e' : '#b0fb5d',
                        border: `1px solid ${isStale ? 'rgba(214, 158, 46, 0.3)' : 'rgba(176, 251, 93, 0.3)'}`
                    }}>
                        {isStale ? 'STALE' : 'FRESH'}
                    </span>
                    <span style={{ color: '#666', fontSize: '10px' }}>
                        {expanded ? '▼' : '▶'}
                    </span>
                </div>
            </div>

            {expanded && (
                <div style={{
                    padding: '10px',
                    borderTop: '1px solid #222',
                    background: '#0a0a0a'
                }}>
                    <div style={{
                        display: 'flex',
                        gap: '8px',
                        marginBottom: '10px',
                        borderBottom: '1px solid #222',
                        paddingBottom: '8px'
                    }}>
                        <button
                            onClick={(e) => { e.stopPropagation(); client.invalidate(entry.key); }}
                            style={{
                                background: '#222',
                                border: '1px solid #333',
                                color: '#d69e2e',
                                padding: '4px 10px',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontSize: '11px'
                            }}
                        >
                            Invalidate
                        </button>
                        <button
                            onClick={(e) => { e.stopPropagation(); client.remove(entry.key); }}
                            style={{
                                background: '#222',
                                border: '1px solid #333',
                                color: '#ff4d4f',
                                padding: '4px 10px',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontSize: '11px'
                            }}
                        >
                            Remove
                        </button>
                    </div>

                    <div style={{ position: 'relative' }}>
                        <pre style={{
                            margin: 0,
                            fontSize: '11px',
                            color: '#a0a0a0',
                            overflowX: 'auto',
                            fontFamily: 'monospace'
                        }}>
                            {JSON.stringify(entry.data, null, 2)}
                        </pre>
                    </div>

                    <div style={{
                        marginTop: '8px',
                        fontSize: '10px',
                        color: '#444',
                        textAlign: 'right'
                    }}>
                        Updated: {new Date(entry.updatedAt).toLocaleTimeString()}
                    </div>
                </div>
            )}
        </div>
    );
}
