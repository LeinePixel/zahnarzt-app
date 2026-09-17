import { configDefaults, defineConfig } from 'vitest/config'
import base from './vitest.config.mts'

export default defineConfig({
  ...base,
  test: { ...base.test, exclude: [...configDefaults.exclude, 'tests/**'] },
})
