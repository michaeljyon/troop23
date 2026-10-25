import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import troop from './troop/troop.js';
import devApi from './dev/api-plugin.js';

export default defineConfig({
  define: { __BUILD__: JSON.stringify(new Date().toISOString()) },
  plugins: [
    react(),
    devApi(),
    {
      name: 'pack-html',
      transformIndexHtml: html => html
        .replaceAll('%THEME%', troop.colors.primary)
        .replaceAll('%TITLE%', troop.appName)
        .replaceAll('%APPNAME%', troop.shortName)
        .replaceAll('%DESC%', `${troop.unit} · ${troop.place}. ${troop.tagline}`),
    },
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['brand/*'],
      manifest: {
        name: troop.appName,
        short_name: troop.shortName,
        description: `${troop.unit} · ${troop.place}. ${troop.tagline}`,
        start_url: '/', scope: '/', display: 'standalone', orientation: 'portrait',
        theme_color: troop.colors.primary, background_color: '#F4F1E8', lang: 'en',
        icons: [
          { src: '/brand/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/brand/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/brand/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,woff2}', 'brand/*.{png,svg}'],
        globIgnores: ['ocr/**', 'sw-push.js'],
        importScripts: ['/sw-push.js'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          { urlPattern: /\/api\/photos\/[^/]+(\/thumb)?\?/, handler: 'CacheFirst', options: { cacheName: 'photos', expiration: { maxEntries: 400, maxAgeSeconds: 86400 * 14 } } },
        ],
      },
    }),
  ],
});
