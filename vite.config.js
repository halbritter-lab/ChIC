import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'

// https://vitejs.dev/config/
export default defineConfig(({ command }) => {
  const base = command === 'build' ? '/pld-progression-grouper/' : '/';

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
          name: 'PLD-Progression Grouper',
          short_name: 'PLD-PG',
          description: 'An application to group PLD progression data.', // Add a description
          start_url: './?source=pwa',
          display: 'standalone',
          background_color: '#ffffff', // Optional: Add background color
          theme_color: '#00bf7d',
          icons: [
            // Add icons here - crucial for PWA installation
            // Example:
            {
              src: 'img/icons/android-chrome-192x192.png', // Path relative to public dir
              sizes: '192x192',
              type: 'image/png'
            },
            {
              src: 'img/icons/android-chrome-512x512.png',
              sizes: '512x512',
              type: 'image/png'
            },
            {
              src: 'img/icons/apple-touch-icon.png', // Example for Apple
              sizes: '180x180',
              type: 'image/png',
              purpose: 'apple touch icon'
            },
            {
              src: 'img/icons/maskable-icon-512x512.png', // Example maskable icon
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable'
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
