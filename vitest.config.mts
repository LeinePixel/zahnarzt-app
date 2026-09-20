import react from '@vitejs/plugin-react'
import { resolve } from 'path'
import { configDefaults, defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    exclude: [...configDefaults.exclude, 'tests/**', '**/*.db.test.ts', '**/*.process.test.ts'],
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
  },
  resolve: {
    alias: {
      '@': resolve(import.meta.dirname, './src'),
      'server-only': resolve(import.meta.dirname, './src/test/server-only.ts'),
    },
  },
})
