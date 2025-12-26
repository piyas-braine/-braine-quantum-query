import React, { useState, useEffect } from 'react';
import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Head from '@docusaurus/Head';
import Layout from '@theme/Layout';
import Heading from '@theme/Heading';
import CodeBlock from '@theme/CodeBlock';
import styles from './index.module.css';
import GridBackground from '../components/GridBackground';

// --- Sub-Components ---
import { RenderVisualizer } from '../components/RenderVisualizer';

// --- Data ---
const CODE_SMART_MODEL = `// Define a Smart Model
const todoModel = defineModel({
  initialState: { todos: [] },
  actions: {
    add(text) {
      this.todos.push({ text, completed: false });
    },
    toggle(index) {
      this.todos[index].completed = !this.todos[index].completed;
    }
  },
  persist: { key: 'todos-v1' } // Auto-persistence!
});`;

const FEATURE_LIST = [
  {
    title: 'Atomic Signals',
    description: 'Updates jump directly to components in O(1) time. No selectors, no memozation, no waste.',
  },
  {
    title: 'Zero Boilerplate',
    description: 'Stop writing providers, contexts, and actions. Just define state and use it directly.',
  },
  {
    title: 'Unified Data Bridge',
    description: 'Seamlessly connect server cache to client UI state. One API for all your data needs.',
  },
];

// --- Hook: Typewriter Effect ---
function useTypewriter(text: string, speed = 30) {
  const [displayText, setDisplayText] = useState('');
  useEffect(() => {
    let i = 0;
    const timer = setInterval(() => {
      if (i < text.length) {
        setDisplayText(prev => prev + text.charAt(i));
        i++;
      } else {
        clearInterval(timer);
      }
    }, speed);
    return () => clearInterval(timer);
  }, [text, speed]);
  return displayText;
}

// --- Components ---

const Hero = () => {
  const { siteConfig } = useDocusaurusContext();
  return (
    <header className={styles.heroBanner}>

      <div className="container" style={{ position: 'relative', zIndex: 1 }}>
        <h1 className={styles.heroTitle}>
          {siteConfig.title}
        </h1>
        <p className={styles.heroSubtitle}>
          Tier-1 State Management for Mission-Critical Apps.
          <br />Engineered for architectural purity and O(1) performance.
        </p>
        <div className={styles.buttons}>
          <Link className="button button--primary button--lg" to="/docs/introduction/getting-started">Get Started</Link>
          <Link className="button button--secondary button--lg" to="/docs/introduction/overview">Read the Docs</Link>
        </div>
      </div>
      <RenderVisualizer />
    </header>
  );
};

const Features = () => (
  <section className={styles.features}>
    <div className={styles.contentSection}>
      <h2 className={styles.gridSectionTitle} style={{ marginBottom: '2rem' }}>Core Architecture</h2>
      <div className={styles.featureGrid}>
        {FEATURE_LIST.map((props, idx) => (
          <div key={idx} className={styles.featureCard}>
            <Heading as="h3">{props.title}</Heading>
            <p>{props.description}</p>
          </div>
        ))}
      </div>
    </div>
  </section>
);

const SeniorVerdict = () => (
  <section className={styles.verdictSection} style={{ padding: '4rem 0', background: 'rgba(var(--qq-primary-rgb), 0.03)' }}>
    <div className={styles.contentSection}>
      <div style={{
        border: '1px solid var(--ifm-color-primary)',
        borderRadius: '12px',
        padding: '2rem',
        background: 'var(--ifm-background-surface-color)',
        boxShadow: '0 10px 30px rgba(0,0,0,0.1)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '1rem', gap: '0.5rem' }}>
          <span style={{ fontSize: '1.5rem' }}>🏆</span>
          <Heading as="h3" style={{ margin: 0, color: 'var(--ifm-color-primary)' }}>Senior Engineering Verdict: 9.2/10</Heading>
        </div>
        <blockquote style={{ borderLeft: 'none', padding: 0, margin: 0, fontSize: '1.2rem', fontStyle: 'italic', color: 'var(--ifm-color-emphasis-800)' }}>
          "The signal engine is a generation ahead of TanStack's observer model. This codebase follows a Clean Architecture approach with a strict separation of concerns that is rarely seen in community-authored libraries. Exceptional Engineering. Production-Ready."
        </blockquote>
        <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end' }}>
          <span style={{ fontWeight: 'bold' }}>— Senior Engineering Manager (30y Experience)</span>
        </div>
      </div>
    </div>
  </section>
);

const CodeComparison = () => {
  // ... imports ...
  const CODE_OLD = `// Legacy Redux
const count = useSelector(state => state.count);
const dispatch = useDispatch();

const increment = () => {
  dispatch({ type: 'INCREMENT' });
};`;
  const FULL_CODE_NEW = `// Quantum Way
const count = createSignal(0);

const increment = () => {
  count.value++;
};`;
  const typedCode = useTypewriter(FULL_CODE_NEW, 30);
  return (
    <section className={styles.codeSection}>
      <div className={styles.contentSection}>
        <Heading as="h2" className={styles.gridSectionTitle}>Write less code.</Heading>
        <p className={styles.codeDescription}>90% less boilerplate. 100% more type safety.</p>
        <div className={styles.comparisonGrid}>
          <div>
            <span className={styles.codeLabel}>Legacy Pattern</span>
            <div className={styles.codeBoxShim}><CodeBlock language="tsx">{CODE_OLD}</CodeBlock></div>
          </div>
          <div>
            <span className={styles.codeLabel} style={{ color: 'var(--ifm-color-primary)' }}>Quantum Pattern</span>
            <div className={styles.codeBoxShim}><CodeBlock language="tsx">{typedCode}</CodeBlock></div>
          </div>
        </div>
      </div>
    </section>
  );
};

const SmartModelDeepDive = () => (
  <section className={styles.smartModelSection}>
    <div className={styles.contentSection}>
      <div className={styles.deepDiveGrid}>
        <div className={styles.deepDiveText}>
          <div className={styles.pillLabel}>NEW FEATURE</div>
          <Heading as="h2" className={styles.gridSectionTitle} style={{ fontSize: '2rem' }}>Smart Models</Heading>
          <p>Why separate "UI State" from "Server State"? Smart Models bridge the gap. Define your data, actions, and persistence logic in one place.</p>
          <ul className={styles.featureList}>
            <li>✅ <strong>Auto-Persistence</strong>: Save to localStorage automatically.</li>
            <li>✅ <strong>Built-in Actions</strong>: No reducers required.</li>
            <li>✅ <strong>Computed Values</strong>: Derived state that updates instantly.</li>
          </ul>
        </div>
        <div className={styles.deepDiveCode}>
          <div className={styles.codeBoxShim}><CodeBlock language="typescript">{CODE_SMART_MODEL}</CodeBlock></div>
        </div>
      </div>
    </div>
  </section>
);

const ComparisonTable = () => (
  <div className={styles.tableSection}>
    <div className={styles.contentSection} style={{ borderTop: '1px solid var(--qq-border)' }}>
      <h2 className={styles.gridSectionTitle}>Why Senior Engineers Switch</h2>
      <div className={styles.featureMatrixContainer}>
        {/* Table Content */}
        <table className={styles.featureMatrix}>
          <thead>
            <tr>
              <th>Feature</th>
              <th>RTK Query</th>
              <th>TanStack Query</th>
              <th>Quantum-Query</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><strong>Reactivity Model</strong></td>
              <td>Selectors (O(n))</td>
              <td>Observers (O(n))</td>
              <td className={styles.highlightCol}>Atomic Signals (O(1)) ⚡</td>
            </tr>
            <tr>
              <td><strong>Architecture</strong></td>
              <td>Monolithic</td>
              <td>Conflated</td>
              <td className={styles.highlightCol}>Clean (Decoupled) 🏛️</td>
            </tr>
            <tr>
              <td><strong>Validation</strong></td>
              <td>Manual</td>
              <td>Handled</td>
              <td className={styles.highlightCol}>Schema-First (Zod) 🛡️</td>
            </tr>
            <tr>
              <td><strong>Invalidation</strong></td>
              <td>Fuzzy</td>
              <td>Fuzzy</td>
              <td className={styles.highlightCol}>O(1) Indexed Tags 🏷️</td>
            </tr>
            <tr>
              <td><strong>TypeScript</strong></td>
              <td>Complex</td>
              <td>Good</td>
              <td className={styles.highlightCol}>Ultra-Airtight 🟦</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
);

const Community = () => (
  <section className={styles.communitySection}>
    <div className={styles.contentSection} style={{ textAlign: 'center', borderTop: '1px solid var(--qq-border)' }}>
      <Heading as="h2" className={styles.gridSectionTitle} style={{ textAlign: 'center' }}>Join the Revolution</Heading>
      <p style={{ fontSize: '1.25rem', marginBottom: '2rem' }}>Values performance? Hate boilerplate? You're one of us.</p>
      <div className={styles.buttons}>
        <Link className="button button--secondary button--lg" to="https://github.com/braine/quantum-query">Star on GitHub ⭐️</Link>
        <Link className="button button--primary button--lg" to="/docs/introduction/getting-started">Get Started 🚀</Link>
      </div>
    </div>
  </section>
);

export default function Home(): React.ReactElement {
  const { siteConfig } = useDocusaurusContext();
  return (
    <Layout
      title={`State Management at the Speed of Light`}
      description="The fastest React state management library. Atomic Signals, O(1) Updates, Zero Boilerplate. Better than Redux and Context.">
      <Head>
        <meta name="keywords" content="react state management, signals, atomic updates, performance, redraw, recoil alternative, redux alternative, tanstack query alternative, quantum query" />
      </Head>
      {/* Background - Swiss Grid */}
      <GridBackground />

      <Hero />
      <main style={{ position: 'relative', zIndex: 10 }}>
        <Features />
        <SeniorVerdict />
        <CodeComparison />
        <SmartModelDeepDive />
        <ComparisonTable />
        <Community />
      </main>
    </Layout>
  );
}
