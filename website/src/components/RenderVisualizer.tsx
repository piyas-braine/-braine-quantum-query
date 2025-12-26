import React, { useState, useEffect, useRef } from 'react';
import styles from '../pages/index.module.css';

// --- Simulation Components ---

// Legacy Component (Flashes on every update)
const LegacyCounter = () => {
    const [count, setCount] = useState(0);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (ref.current) {
            ref.current.style.backgroundColor = 'rgba(255, 59, 48, 0.2)'; // Flash Red
            setTimeout(() => {
                if (ref.current) ref.current.style.backgroundColor = 'transparent';
            }, 200);
        }
    });

    return (
        <div ref={ref} className={styles.simBox}>
            <div className={styles.simLabel}>Legacy Component</div>
            <div className={styles.simCount}>{count}</div>
            <button className={styles.simBtn} onClick={() => setCount(c => c + 1)}>
                Render (Slow)
            </button>
            <div className={styles.simMetric}>Re-renders: {count} (O(n))</div>
        </div>
    );
};

// Quantum Component (Virtual Signal)
const QuantumCounter = () => {
    const [count, setCount] = useState(0);
    // Signals are internal, so we don't flash the container
    const textRef = useRef<HTMLDivElement>(null);

    const increment = () => {
        setCount(c => c + 1);
        // Simulate "Fine Grained" update (only text flashes)
        if (textRef.current) {
            textRef.current.style.color = '#58c4dc';
            textRef.current.style.textShadow = '0 0 10px #58c4dc';
            setTimeout(() => {
                if (textRef.current) {
                    textRef.current.style.color = 'inherit';
                    textRef.current.style.textShadow = 'none';
                }
            }, 200);
        }
    };

    return (
        <div className={styles.simBoxQuantum}>
            <div className={styles.simLabel} style={{ color: '#58c4dc' }}>Quantum Signal</div>
            <div ref={textRef} className={styles.simCount}>{count}</div>
            <button className={styles.simBtnPrimary} onClick={increment}>
                Update Signal
            </button>
            <div className={styles.simMetric} style={{ color: '#58c4dc' }}>Re-renders: 0 (O(1))</div>
        </div>
    );
};

export const RenderVisualizer = () => {
    return (
        <div className={styles.visualizerContainer}>
            <LegacyCounter />
            <QuantumCounter />
        </div>
    );
};
