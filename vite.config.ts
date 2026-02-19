import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  // Set the third parameter to '' to load all env regardless of the `VITE_` prefix.
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [react()],
    base: './', // Ensures relative paths for assets
    resolve: {
      dedupe: ['react', 'react-dom'],
      alias: {
        util: 'util',
      },
    },
    build: {
      outDir: 'dist',
      sourcemap: true,
      minify: 'esbuild',
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: ['react', 'react-dom'],
            ui: ['lucide-react'],
            charts: ['recharts'],
            pdf: ['jspdf', 'jspdf-autotable'],
            whatsapp: ['@whiskeysockets/baileys'],
            ai: ['@google/generative-ai', 'openai']
          }
        }
      }
    },
    define: {
      // Polyfill process.env for libraries and app code expecting it
      'process.env.DATABASE_URL': JSON.stringify(env.DATABASE_URL),
      // Map GEMINI_API_KEY to API_KEY as expected by the Google GenAI SDK usage in services/ai.ts
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY || env.VITE_GEMINI_API_KEY),
      'process.env.VITE_GEMINI_API_KEY': JSON.stringify(env.VITE_GEMINI_API_KEY),
      'process.env.DEEPSEEK_API_KEY': JSON.stringify(env.DEEPSEEK_API_KEY || env.VITE_DEEPSEEK_API_KEY),
      'process.env.JWT_SECRET': JSON.stringify(env.JWT_SECRET),
      // If you need the full object (use with caution to not expose sensitive system vars):
      // 'process.env': JSON.stringify(env) 
    }
  };
});
