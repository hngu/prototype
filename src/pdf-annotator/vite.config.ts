import { defineConfig } from 'vitest/config'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'

export default defineConfig({
  plugins: [react(), babel({ presets: [reactCompilerPreset()] })],
  // 5173 belongs to the Adonis frontend dev server.
  server: { port: 5174 },
  test: {
    environment: 'node',
    include: ['src/**/*.spec.ts'],
  },
})
