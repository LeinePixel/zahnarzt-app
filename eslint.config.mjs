import { defineConfig, globalIgnores } from 'eslint/config'
import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTypeScript from 'eslint-config-next/typescript'

export default defineConfig([
  ...nextVitals,
  ...nextTypeScript,
  globalIgnores([
    '.next/**',
    '.claude/**',
    'build/**',
    'coverage/**',
    'docs/**',
    'features/**',
    'out/**',
    'playwright-report/**',
    'public/**',
    'supabase/.temp/**',
    'test-results/**',
    'next-env.d.ts',
    'docs/design/assets/**',
  ]),
])
