import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],

  build: {
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('@fullcalendar'))                   return 'vendor-calendar';
          if (id.includes('jspdf') || id.includes('html2canvas')) return 'vendor-export';
          if (id.includes('xlsx') || id.includes('sheetjs')) return 'vendor-export';
          if (id.includes('leaflet'))                         return 'vendor-map';
          if (id.includes('i18next'))                         return 'vendor-i18n';
          if (id.includes('@supabase'))                       return 'vendor-supabase';
          if (id.includes('zustand'))                         return 'vendor-zustand';
          if (id.includes('react-dom') || id.includes('scheduler')) return 'vendor-react';
        },
      },
    },
  },

  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/tests/setup.js'],
    css: false,
  },
});
