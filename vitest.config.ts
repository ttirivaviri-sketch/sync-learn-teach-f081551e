import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react-swc';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: [
        'node_modules/',
        'tests/',
        '**/*.config.*',
        '**/dist/**',
        '**/*.d.ts',
        '**/mockData/**',
      ],
      lines: 70,
      functions: 70,
      branches: 65,
      statements: 70,
    },
    include: ['**/*.{test,spec}.{ts,tsx}'],
    // supabase/functions tests are Deno tests (https: imports) — they run via
    // `deno test`, not vitest, and crash Node's ESM loader if picked up here.
    exclude: ['node_modules', 'dist', '.idea', '.git', '.cache', 'supabase/functions/**'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});