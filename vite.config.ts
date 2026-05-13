import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [react()],
    base: './',
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
      'process.env.DATABASE_URL': JSON.stringify(env.DATABASE_URL),
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY || env.VITE_GEMINI_API_KEY),
      'process.env.VITE_GEMINI_API_KEY': JSON.stringify(env.VITE_GEMINI_API_KEY),
      'process.env.DEEPSEEK_API_KEY': JSON.stringify(env.DEEPSEEK_API_KEY || env.VITE_DEEPSEEK_API_KEY),
      'process.env.JWT_SECRET': JSON.stringify(env.JWT_SECRET),
    }
  };
});
