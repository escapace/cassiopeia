import { cassiopeia } from '../src/index'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

const exampleDirectory = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig(({ isSsrBuild }) => ({
  build: {
    emptyOutDir: isSsrBuild !== true,
    manifest: isSsrBuild !== true,
    outDir: isSsrBuild === true ? 'dist/server' : 'dist/client',
  },
  plugins: [cassiopeia(), vue()],
  resolve: {
    alias: {
      '@cassiopeia/vue': path.resolve(exampleDirectory, '../../vue'),
    },
  },
  root: exampleDirectory,
  server: {
    port: 5173,
    strictPort: true,
  },
}))
