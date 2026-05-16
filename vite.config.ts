/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: '127.0.0.1',
    port: 5173,
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    // Pin a non-UTC timezone so the D014 regression test (unzoned dataset ISOs
    // parsed as UTC) actually exercises the parsing asymmetry. On a UTC CI
    // runner, bare and Z-suffixed inputs parse to the same epoch ms and the
    // parity assertion passes whether or not `parseDatasetIso` exists.
    env: { TZ: 'America/Toronto' },
  },
})
