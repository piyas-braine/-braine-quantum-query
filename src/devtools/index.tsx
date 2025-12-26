import React, { useState, useRef, useEffect } from 'react';
import { QueryPanel } from './QueryPanel';
import { StatePanel } from './StatePanel';

export function QuantumDevTools() {
    const [isOpen, setIsOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<'queries' | 'state'>('queries');
    const [height, setHeight] = useState(400);

    // Resizing logic
    const isResizingRef = useRef(false);
    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!isResizingRef.current) return;
            const newHeight = window.innerHeight - e.clientY;
            if (newHeight > 200 && newHeight < window.innerHeight - 50) setHeight(newHeight);
        };
        const handleMouseUp = () => { isResizingRef.current = false; document.body.style.cursor = 'default'; };
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
        return () => { window.removeEventListener('mousemove', handleMouseMove); window.removeEventListener('mouseup', handleMouseUp); };
    }, []);

    if (!isOpen) {
        return (
            <button
                onClick={() => setIsOpen(true)}
                style={{
                    position: 'fixed', bottom: '20px', right: '20px',
                    width: '40px', height: '40px', borderRadius: '50%',
                    background: '#000', border: '1px solid #333',
                    color: '#b0fb5d', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', zIndex: 9999, boxShadow: '0 4px 12px rgba(0,0,0,0.5)'
                }}
            >
                ⚡️
            </button>
        );
    }

    return (
        <div style={{
            position: 'fixed', bottom: 0, right: 0, width: '100%', height: `${height}px`,
            background: '#0a0a0a', borderTop: '1px solid #333', zIndex: 9999,
            display: 'flex', flexDirection: 'column', fontFamily: 'monospace'
        }}>
            {/* Resizer */}
            <div
                onMouseDown={() => { isResizingRef.current = true; document.body.style.cursor = 'ns-resize'; }}
                style={{ height: '6px', top: '-3px', position: 'absolute', width: '100%', cursor: 'ns-resize', zIndex: 100 }}
            />

            {/* Header */}
            <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '8px 16px', background: '#111', borderBottom: '1px solid #222'
            }}>
                <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                    <span style={{ color: '#b0fb5d', fontWeight: 'bold' }}>Quantum DevTools</span>
                    <div style={{ display: 'flex', gap: '4px', background: '#000', padding: '2px', borderRadius: '4px' }}>
                        <TabButton active={activeTab === 'queries'} onClick={() => setActiveTab('queries')}>Queries</TabButton>
                        <TabButton active={activeTab === 'state'} onClick={() => setActiveTab('state')}>State</TabButton>
                    </div>
                </div>
                <button onClick={() => setIsOpen(false)} style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer' }}>×</button>
            </div>

            {/* Content */}
            <div style={{ flex: 1, overflow: 'hidden' }}>
                {activeTab === 'queries' ? <QueryPanel /> : <StatePanel />}
            </div>
        </div>
    );
}

function TabButton({ active, children, onClick }: { active: boolean, children: React.ReactNode, onClick: () => void }) {
    return (
        <button
            onClick={onClick}
            style={{
                background: active ? '#222' : 'transparent',
                color: active ? '#fff' : '#666',
                border: 'none', borderRadius: '2px',
                padding: '4px 12px', fontSize: '11px', cursor: 'pointer'
            }}
        >
            {children}
        </button>
    );
}
