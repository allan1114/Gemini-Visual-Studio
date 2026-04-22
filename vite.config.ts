import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const isTauri = process.env.TAURI_ENV_PLATFORM !== undefined;

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: isTauri ? './' : '/Gemini-Visual-Studio/',
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom'],
          'vendor-ai': ['@google/genai'],
          'vendor-supabase': ['@supabase/supabase-js'],
          'vendor-d3': ['d3'],
          'vendor-zip': ['jszip'],
          'vendor-ui': ['lucide-react', 'motion', 'clsx', 'tailwind-merge'],
        },
      },
    },
    chunkSizeWarningLimit: 600,
  },
});
