import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';
import nextTypeScript from 'eslint-config-next/typescript';
import prettier from 'eslint-config-prettier';

const config = [
  {
    ignores: [
      '.next/**',
      'node_modules/**',
      'ralph-claude-code/**',
      '.ralph/**',
      'next-env.d.ts',
      'src/generated/**',
    ],
  },
  ...nextCoreWebVitals,
  ...nextTypeScript,
  {
    rules: {
      // §4.8: ixtiyoriy HTML qabul qilinmaydi, kontent tiplashtirilgan bloklardan
      // renderlanadi. Bu qoida buni lint darajasida ushlab turadi.
      'react/no-danger': 'error',
    },
  },
  prettier,
];

export default config;
