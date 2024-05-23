import { defineConfig } from 'vitest/config'
import { version } from './package.json'

export default defineConfig({
  define: {
    __PLATFORM__: JSON.stringify('browser'),
    __VERSION__: JSON.stringify(version),
  },
  test: {
    coverage: {
      exclude: ['**/example*.ts'],
      include: ['src/**'],
      provider: 'v8',
    },
    passWithNoTests: true,
  },
})
