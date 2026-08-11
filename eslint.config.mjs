import nextCoreWebVitals from 'eslint-config-next/core-web-vitals'
import nextTypeScript from 'eslint-config-next/typescript'

/** Flat config; eslint-config-next 16 levert kant-en-klare flat configs. */
const config = [
  {
    ignores: [
      '.next/**',
      'node_modules/**',
      'next-env.d.ts',
      'test-results/**',
      'playwright-report/**',
      'coverage/**',
    ],
  },
  ...nextCoreWebVitals,
  ...nextTypeScript,
  {
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'no-console': ['error', { allow: ['warn', 'error', 'info'] }],
    },
  },
  {
    // Jobs, seed en de logger mogen naar de console schrijven.
    files: ['src/jobs/**/*.ts', 'prisma/**/*.ts', 'src/lib/logger.ts', 'scripts/**/*.mjs'],
    rules: { 'no-console': 'off' },
  },
]

export default config
