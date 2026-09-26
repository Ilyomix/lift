import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// Served from GitHub Pages at https://ilyomix.github.io/golgoth/
const BASE = process.env.GOLGOTH_BASE ?? '/golgoth/'

export default defineConfig({
  base: BASE,
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['favicon.svg', 'icons/apple-touch-icon.png'],
      manifest: {
        id: BASE,
        name: 'Golgoth — Programme hypertrophie',
        short_name: 'Golgoth',
        description:
          "Programme d'hypertrophie fondé sur la recherche : séances, calendrier des blocs, minuteur de repos et suivi des objectifs.",
        lang: 'fr',
        dir: 'ltr',
        start_url: BASE,
        scope: BASE,
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#060A13',
        theme_color: '#060A13',
        categories: ['health', 'fitness', 'sports'],
        icons: [
          { src: 'icons/pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,woff2,png,svg,webmanifest,jpg}'],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
        // End-of-rest notifications from the push server.
        importScripts: ['push-sw.js'],
      },
    }),
  ],
  build: {
    target: 'es2022',
    sourcemap: false,
  },
})
