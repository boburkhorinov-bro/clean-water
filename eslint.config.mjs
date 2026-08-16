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

      // Kalitni chiqarib tashlash idiomasi — `const { X: _unused, ...qolgani } = obj`.
      // Bu yerda o'zgaruvchi ataylab ishlatilmaydi: uning yagona vazifasi kalitni
      // qolganidan ajratish. `_` prefiksi niyatni aytadi, `ignoreRestSiblings` esa
      // aynan shu shaklni qamrab oladi.
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          ignoreRestSiblings: true,
          varsIgnorePattern: '^_',
          argsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
    },
  },
  prettier,
];

export default config;
