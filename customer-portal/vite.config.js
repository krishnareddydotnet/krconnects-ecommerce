import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // NOTE: Vite 8's production build uses the new oxc/Rolldown bundler,
  // which ignores this esbuild.jsx setting (harmless warning during
  // `vite build`). Vitest, however, still uses esbuild internally for
  // its test transform pipeline, so this setting is required for JSX
  // to resolve correctly inside tests.
  esbuild: {
    jsx: 'automatic'
  },
  server: {
    port: 5173
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './tests/setup.js'
  }
});
