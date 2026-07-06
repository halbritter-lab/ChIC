import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'

// https://vitejs.dev/config/
export default defineConfig(({ command }) => {
  const base = command === 'build' ? '/ChIC/' : '/';

  return {
    base: base,
    plugins: [
      vue(),
      VitePWA({
        registerType: 'autoUpdate', // Or 'prompt' based on preference
        // injectRegister: 'auto', // or null or 'script'
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,json,vue,txt,woff2}'] // Ensure all needed assets are cached
        },
        manifest: {
          name: 'Charité Imaging Classification Tool',
          short_name: 'ChIC',
          description: 'An application to group PLD progression data.', // Add a description
          start_url: './?source=pwa',
          display: 'standalone',
          background_color: '#ffffff', // Optional: Add background color
          theme_color: '#00bf7d',
          icons: [
            {
              src: 'img/icons/favicon-16x16.png',
              sizes: '16x16',
              type: 'image/png'
            },
            {
              src: 'img/icons/favicon-32x32.png',
              sizes: '32x32',
              type: 'image/png'
            },
            {
              src: 'favicon.png',
              sizes: '64x64',
              type: 'image/png'
            },
            {
              src: 'img/icons/apple-touch-icon-120x120.png',
              sizes: '120x120',
              type: 'image/png'
            },
            {
              src: 'img/icons/apple-touch-icon-152x152.png',
              sizes: '152x152',
              type: 'image/png'
            },
            {
              src: 'img/icons/apple-touch-icon-180x180.png',
              sizes: '180x180',
              type: 'image/png'
            },
            {
              src: 'img/icons/apple-touch-icon.png',
              sizes: '180x180',
              type: 'image/png'
            },
            {
              src: 'img/icons/android-chrome-192x192.png',
              sizes: '192x192',
              type: 'image/png'
            },
            {
              src: 'img/icons/android-chrome-512x512.png',
              sizes: '512x512',
              type: 'image/png'
            },
            {
              src: 'img/icons/android-chrome-maskable-192x192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'maskable'
            },
            {
              src: 'img/icons/android-chrome-maskable-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable'
            },
            {
              src: 'img/icons/msapplication-icon-144x144.png',
              sizes: '144x144',
              type: 'image/png'
            },
            {
              src: 'img/icons/mstile-150x150.png',
              sizes: '150x150',
              type: 'image/png'
            }
          ]
        },
        devOptions: {
          enabled: true // Enable PWA features in dev mode if needed
        }
      })
    ],
    resolve: {
      alias: {
        '@': '/src' // If you use '@' alias
      }
    },
    server: {
        port: 8080, // Or your preferred port
        open: true, // Automatically open browser
        watch: {
          usePolling: true
        }
    }
  }
})
