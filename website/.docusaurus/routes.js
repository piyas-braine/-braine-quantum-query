import React from 'react';
import ComponentCreator from '@docusaurus/ComponentCreator';

export default [
  {
    path: '/-braine-quantum-query/markdown-page',
    component: ComponentCreator('/-braine-quantum-query/markdown-page', '303'),
    exact: true
  },
  {
    path: '/-braine-quantum-query/',
    component: ComponentCreator('/-braine-quantum-query/', 'ef1'),
    routes: [
      {
        path: '/-braine-quantum-query/',
        component: ComponentCreator('/-braine-quantum-query/', 'a76'),
        routes: [
          {
            path: '/-braine-quantum-query/',
            component: ComponentCreator('/-braine-quantum-query/', 'bca'),
            routes: [
              {
                path: '/-braine-quantum-query/api',
                component: ComponentCreator('/-braine-quantum-query/api', '05d'),
                exact: true,
                sidebar: "tutorialSidebar"
              },
              {
                path: '/-braine-quantum-query/migration',
                component: ComponentCreator('/-braine-quantum-query/migration', '43c'),
                exact: true,
                sidebar: "tutorialSidebar"
              },
              {
                path: '/-braine-quantum-query/recipes',
                component: ComponentCreator('/-braine-quantum-query/recipes', '8a5'),
                exact: true,
                sidebar: "tutorialSidebar"
              },
              {
                path: '/-braine-quantum-query/',
                component: ComponentCreator('/-braine-quantum-query/', '05e'),
                exact: true,
                sidebar: "tutorialSidebar"
              }
            ]
          }
        ]
      }
    ]
  },
  {
    path: '*',
    component: ComponentCreator('*'),
  },
];
