import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// Served from GitHub Pages at https://ilyomix.github.io/lift/
const BASE = process.env.LIFT_BASE ?? '/lift/'

// Shown under the credits: version, build number (the deploy run), commit and build date.
const VERSION: string = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')).version
const commit = () => {
  try {
    return execSync('git rev-parse HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim()
  } catch {
    return ''
  }
}

export default defineConfig({
  base: BASE,
  define: {
    __APP_VERSION__: JSON.stringify(VERSION),
    __APP_BUILD__: JSON.stringify(process.env.GITHUB_RUN_NUMBER ?? ''),
    __APP_COMMIT__: JSON.stringify((process.env.GITHUB_SHA ?? commit()).slice(0, 7)),
    __APP_BUILT__: JSON.stringify(new Date().toISOString()),
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['favicon.svg', 'icons/apple-touch-icon.png'],
      manifest: {
        id: BASE,
        name: 'Lift',
        short_name: 'Lift',
        description:
          'Research-based hypertrophy program, at the gym or at home: guided sessions, block calendar, rest timer and goal tracking. In English and French.',
        lang: 'en',
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
        // The link-preview image is for crawlers, not for the app offline.
        globIgnores: ['og.png'],
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
