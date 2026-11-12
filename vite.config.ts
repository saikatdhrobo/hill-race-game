import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * BASE_PATH lets you deploy the game under a sub-path, e.g.
 *   BASE_PATH=/games/ridgeline/ npm run build
 * It defaults to '/' which works for Vercel, Netlify, Cloudflare Pages
 * and any static host that serves the folder root.
 */
export default defineConfig(({ mode }) => ({
  base: process.env.BASE_PATH ?? '/',
  plugins: [react()],
  server: { host: '0.0.0.0', port: 5173, allowedHosts: true },
  preview: { host: '0.0.0.0', port: 4173, allowedHosts: true },
  build: {
    target: 'es2020',
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: mode !== 'production',
    chunkSizeWarningLimit: 1600,
    rollupOptions: {
      output: {
        manualChunks: {
          three: ['three'],
          rapier: ['@dimforge/rapier3d-compat'],
          react: ['react', 'react-dom'],
        },
      },
    },
  },
}));
