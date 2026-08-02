import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'

const sharedDir = fileURLToPath(new URL('../shared', import.meta.url))

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    babel({ presets: [reactCompilerPreset()] })
  ],
  resolve: {
    // Must mirror the `paths` entry in tsconfig.app.json. tsconfig satisfies the
    // type checker only; Vite still has to resolve the specifier at bundle time.
    alias: {
      '@shared': sharedDir,
    },
  },
  server: {
    // src/shared lives outside the Vite root (src/frontend), so the dev server
    // has to be told it may serve from there.
    fs: {
      allow: ['..'],
    },
    proxy: {
      // Same-origin dev. Without this the browser talks 5173 -> 3001 cross-origin,
      // which means CORS preflight and an EventSource that sends no credentials.
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
})
