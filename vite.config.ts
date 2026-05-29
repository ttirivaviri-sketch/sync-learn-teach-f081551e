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
    rollupOptions: {
      output: {
        // Split heavy vendors into their own chunks so the landing route doesn't
        // pay for libraries it never uses. Saves ~300-600 KB on first paint.
        manualChunks: (id) => {
          if (!id.includes('node_modules')) return undefined;
          if (id.includes('react-router')) return 'router';
          if (id.includes('@tanstack/react-query')) return 'query';
          if (id.includes('@supabase')) return 'supabase';
          if (id.includes('recharts') || id.includes('d3-')) return 'charts';
          if (id.includes('katex')) return 'katex';
          if (id.includes('pdfjs-dist') || id.includes('pdf-lib')) return 'pdf';
          if (id.includes('embla-carousel')) return 'carousel';
          if (id.includes('framer-motion') || id.includes('motion')) return 'motion';
          if (id.includes('@radix-ui')) return 'radix';
          if (id.includes('lucide-react')) return 'icons';
          if (id.includes('react-dom') || id.includes('scheduler') || /\/react\//.test(id)) return 'react';
          return 'vendor';
        },
      },
    },
  },
  optimizeDeps: {
    exclude: ['pdfjs-dist'],
    esbuildOptions: {
      target: 'esnext',
    },
  },
}));
