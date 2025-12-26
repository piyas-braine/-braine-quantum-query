import React from 'react';
import styles from '../pages/index.module.css';

const GridBackground = () => {
    return (
        <div className={styles.gridBackground}>
            {/* SVG Grid Pattern */}
            <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
                <defs>
                    <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                        <path d="M 40 0 L 0 0 0 40" fill="none" stroke="var(--qq-grid-line)" strokeWidth="1" />
                    </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#grid)" />
            </svg>

            {/* Optional: Axis Lines (Crosshair) */}
            <div className={styles.axisX} />
            <div className={styles.axisY} />
        </div>
    );
};

export default GridBackground;
