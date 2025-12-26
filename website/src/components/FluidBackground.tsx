import React from 'react';
import styles from '../pages/index.module.css';

/**
 * FluidBackground
 * Renders soft, moving gradient orbs to create a modern SaaS aesthetic.
 * Pure CSS animation for performance.
 */
const FluidBackground = () => {
    return (
        <div className={styles.fluidContainer}>
            <div className={`${styles.fluidOrb} ${styles.orb1}`} />
            <div className={`${styles.fluidOrb} ${styles.orb2}`} />
            <div className={`${styles.fluidOrb} ${styles.orb3}`} />
            <div className={styles.fluidOverlay} />
        </div>
    );
};

export default FluidBackground;
