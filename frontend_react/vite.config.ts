import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';
import fs from 'fs';

// Detecta dinamicamente se está rodando dentro de container Docker ou no host Windows
const isDocker = fs.existsSync('/.dockerenv');
const defaultBackend = isDocker ? 'http://backend:8080' : 'http://localhost:8080';
const backendTarget = process.env.BACKEND_PROXY_TARGET || process.env.VITE_BACKEND_PROXY_TARGET || defaultBackend;

export default defineConfig({
  plugins: [
    tailwindcss(),
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.png', 'Logo/*.svg'],
      manifest: {
        name: 'Brilha Mais Positivo',
        short_name: 'Brilha Mais',
        description: 'Aplicativo de Apuração de Metas e KPIs - Positivo',
        theme_color: '#0f172a',
        background_color: '#f8fafc',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          {
            src: '/favicon.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: '/icon.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      }
    })
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    host: true,
    watch: {
      usePolling: true
    },
    proxy: {
      '/api': {
        target: backendTarget,
        changeOrigin: true,
        secure: false,
      }
    }
  }
});
