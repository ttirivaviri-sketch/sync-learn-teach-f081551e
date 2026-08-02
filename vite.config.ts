import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "0.0.0.0",
    port: 8080,
    hmr: false,
    proxy: {
      // Proxy all /api/ai/* requests to the local AI proxy server
      '/api/ai': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false,
      },
    },
  },
  plugins: [
    react(),
    mode === 'development' &&
    componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    minify: 'esbuild',
    sourcemap: false,
    chunkSizeWarningLimit: 2000,
    target: 'esnext',
    cssCodeSplit: true,
    // NOTE: do NOT add a custom `manualChunks` here. Splitting React into its
    // own chunk while React-dependent vendors land elsewhere creates circular
    // chunk imports and the bundle dies with
    // "Cannot read properties of undefined (reading 'createContext')".
    // Route-level code splitting already happens via React.lazy in App.tsx.
  },

  optimizeDeps: {
    exclude: ['pdfjs-dist'],
    esbuildOptions: {
      target: 'esnext',
    },
  },
}));
