import { defineConfig } from 'vite';

export default defineConfig({
    build: {
        rollupOptions: {
            output: {
                manualChunks: {
                    'chart-vendor': ['chart.js'],
                    'pdf-vendor': ['jspdf', 'jspdf-autotable'],
                    'supabase-vendor': ['@supabase/supabase-js'],
                },
            },
        },
        chunkSizeWarningLimit: 1000,
    },
});
