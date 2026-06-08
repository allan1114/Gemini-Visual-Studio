import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const isTauri = process.env.TAURI_ENV_PLATFORM !== undefined;

// Base public path is environment-driven so the same build works on multiple
// hosts:
//   - GitHub Pages: served from a sub-path -> defaults to '/Gemini-Visual-Studio/'
//   - Vercel / custom domain root: set VITE_BASE_PATH=/ in the project env
//   - Tauri desktop: relative paths
const basePath = isTauri ? './' : (process.env.VITE_BASE_PATH ?? '/Gemini-Visual-Studio/');

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: basePath,
  build: {
    outDir: 'dist',
    sourcemap: false,
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
