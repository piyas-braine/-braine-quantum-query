import React, { useEffect, useRef } from 'react';
import styles from '../pages/index.module.css';
import { useColorMode } from '@docusaurus/theme-common';

interface Particle {
    x: number;
    y: number;
    vx: number;
    vy: number;
    size: number;
}

const QuantumField = () => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const { colorMode } = useColorMode();

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let width = window.innerWidth;
        let height = window.innerHeight;
        canvas.width = width;
        canvas.height = height;

        const particles: Particle[] = [];
        // Less dense = More elegant
        const particleCount = Math.min(width * 0.1, 100);

        const isDark = colorMode === 'dark';
        // Dark Mode: White stars (opacity handled below)
        // Light Mode: Black/Slate stars for visibility against white bg
        const particleColor = isDark ? '255, 255, 255' : '50, 50, 70';
        const opacity = isDark ? 0.4 : 0.15;

        for (let i = 0; i < particleCount; i++) {
            particles.push({
                x: Math.random() * width,
                y: Math.random() * height,
                vx: (Math.random() - 0.5) * 0.2, // Very Slow (Cinematic)
                vy: (Math.random() - 0.5) * 0.2,
                size: Math.random() * 1.5 + 0.5,
            });
        }

        let animId: number;

        const animate = () => {
            ctx.clearRect(0, 0, width, height);

            particles.forEach((p, i) => {
                p.x += p.vx;
                p.y += p.vy;

                if (p.x < 0 || p.x > width) p.vx *= -1;
                if (p.y < 0 || p.y > height) p.vy *= -1;

                ctx.fillStyle = `rgba(${particleColor}, ${opacity})`;
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                ctx.fill();

                // Connections: Only when very close (Constellations)
                for (let j = i + 1; j < particles.length; j++) {
                    const p2 = particles[j];
                    if (!p2) continue;
                    const dx = p.x - p2.x;
                    const dy = p.y - p2.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);

                    // Reduced connection distance for cleaner look
                    if (dist < 80) {
                        ctx.strokeStyle = `rgba(${particleColor}, ${(80 - dist) / 800})`; // Very faint lines
                        ctx.lineWidth = 0.5;
                        ctx.beginPath();
                        ctx.moveTo(p.x, p.y);
                        ctx.lineTo(p2.x, p2.y);
                        ctx.stroke();
                    }
                }
            });
            animId = requestAnimationFrame(animate);
        };

        animate();

        const handleResize = () => {
            width = window.innerWidth;
            height = window.innerHeight;
            canvas.width = width;
            canvas.height = height;
        };

        window.addEventListener('resize', handleResize);
        return () => {
            window.removeEventListener('resize', handleResize);
            cancelAnimationFrame(animId);
        };
    }, [colorMode]);

    return <canvas ref={canvasRef} className={styles.quantumField} />;
};

export default QuantumField;
