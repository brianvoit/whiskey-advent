import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  define: {
    // VAPID public key — safe to expose in client code
    __VAPID_PUBLIC_KEY__: JSON.stringify(
      'BHEwrIWikoX-aSKcZ5H0md0QcJUauIgJ_gu0kCQ36sY-QKLDViAcqsp4KpJrMWz5oj6_lRM6U0UHdwq01BjKWos'
    ),
  },
  plugins: [
    react(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'prompt',
      includeAssets: ['favicon.ico', 'icon.svg', 'apple-touch-icon-180x180.png'],
      manifest: {
        name: 'Whiskey Advent',
        short_name: 'Whiskey Advent',
        description: 'Track your whiskey advent calendar tastings',
        theme_color: '#7c2d12',
        // Android builds its launch splash from this. Match the light theme's
        // background (theme.tsx) so it doesn't flash navy before the app paints.
        background_color: '#F9F5EF',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: 'pwa-64x64.png',
            sizes: '64x64',
            type: 'image/png',
          },
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'maskable-icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // Pre-cache all JS/CSS/HTML/assets produced by Vite
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            // Never cache Supabase API calls — always fetch fresh data
            urlPattern: /^https:\/\/[^/]+\.supabase\.co\//,
            handler: 'NetworkOnly',
          },
          {
            // Cache Google Fonts and other CDN assets with a stale-while-revalidate strategy
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\//,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'google-fonts',
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
        ],
      },
    }),
  ],
})
