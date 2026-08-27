import { defineConfig } from 'vite'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    babel({ presets: [reactCompilerPreset()] })
  ],
  server: {
    host: true,
    allowedHosts: ['prototype.app'],
    hmr: {
      host: 'prototype.app',
      protocol: 'wss',
      clientPort: 443,
    },
  },
})
