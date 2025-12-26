import { themes as prismThemes } from 'prism-react-renderer';
import type { Config } from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

const config: Config = {
  title: 'Quantum Query',
  tagline: 'State Management at the Speed of Light',
  favicon: 'img/favicon.svg',

  url: 'https://braine.github.io',
  baseUrl: '/',

  organizationName: 'braine',
  projectName: 'quantum-query',

  onBrokenLinks: 'throw',
  onBrokenMarkdownLinks: 'warn',

  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: './sidebars.ts',
          editUrl: 'https://github.com/braine/quantum-query/tree/main/website/',
        },
        blog: false, // Disable blog for now
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    image: 'img/social-card.jpg',
    colorMode: {
      defaultMode: 'dark',
      disableSwitch: false,
      respectPrefersColorScheme: true,
    },
    navbar: {
      title: 'Quantum Query',
      logo: {
        alt: 'Quantum Query Logo',
        src: 'img/logo.svg', // We assume default logo for now
      },
      items: [
        {
          type: 'docSidebar',
          sidebarId: 'tutorialSidebar',
          position: 'left',
          label: 'Docs',
        },
        {
          href: 'https://github.com/braine/quantum-query',
          label: 'GitHub',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Docs',
          items: [
            { label: 'Introduction', to: '/docs/introduction/overview' },
            { label: 'Quick Start', to: '/docs/introduction/getting-started' },
          ],
        },
        {
          title: 'Community',
          items: [
            { label: 'GitHub', href: 'https://github.com/braine/quantum-query' },
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} Braine Inc. Built with Quantum Query.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
      additionalLanguages: ['typescript', 'tsx'],
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
