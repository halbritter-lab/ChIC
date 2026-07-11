import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { VitePWA } from 'vite-plugin-pwa';

export const PWA_INJECT_REGISTER = 'script-defer';

export const PWA_WORKBOX_CONFIG = {
  globPatterns: ['**/*.{js,css,html,ico,json,txt,woff2}', 'assets/logo-*.png'],
  globIgnores: ['**/assets/exceljs*.js'],
  runtimeCaching: [
    {
      urlPattern: ({ url }) => /\/assets\/exceljs\.min-[^/]+\.js$/.test(url.pathname),
      handler: 'CacheFirst',
      options: {
        cacheName: 'chic-excel',
        expiration: { maxEntries: 2, maxAgeSeconds: 60 * 60 * 24 * 365 },
        cacheableResponse: { statuses: [0, 200] },
      },
    },
  ],
};

// https://vitejs.dev/config/
export default defineConfig(({ command }) => {
  const base = command === 'build' ? '/ChIC/' : '/';

  return {
    base: base,
    plugins: [
      vue(),
      VitePWA({
        registerType: 'autoUpdate', // Or 'prompt' based on preference
        injectRegister: PWA_INJECT_REGISTER,
        workbox: PWA_WORKBOX_CONFIG,
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
              type: 'image/png',
            },
            {
              src: 'img/icons/favicon-32x32.png',
              sizes: '32x32',
              type: 'image/png',
            },
            {
              src: 'favicon.png',
              sizes: '64x64',
              type: 'image/png',
            },
            {
              src: 'img/icons/apple-touch-icon-120x120.png',
              sizes: '120x120',
              type: 'image/png',
            },
            {
              src: 'img/icons/apple-touch-icon-152x152.png',
              sizes: '152x152',
              type: 'image/png',
            },
            {
              src: 'img/icons/apple-touch-icon-180x180.png',
              sizes: '180x180',
              type: 'image/png',
            },
            {
              src: 'img/icons/apple-touch-icon.png',
              sizes: '180x180',
              type: 'image/png',
            },
            {
              src: 'img/icons/android-chrome-192x192.png',
              sizes: '192x192',
              type: 'image/png',
            },
            {
              src: 'img/icons/android-chrome-512x512.png',
              sizes: '512x512',
              type: 'image/png',
            },
            {
              src: 'img/icons/android-chrome-maskable-192x192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'maskable',
            },
            {
              src: 'img/icons/android-chrome-maskable-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
            {
              src: 'img/icons/msapplication-icon-144x144.png',
              sizes: '144x144',
              type: 'image/png',
            },
            {
              src: 'img/icons/mstile-150x150.png',
              sizes: '150x150',
              type: 'image/png',
            },
          ],
        },
        devOptions: {
          enabled: true, // Enable PWA features in dev mode if needed
        },
      }),
    ],
    resolve: {
      alias: {
        '@': '/src', // If you use '@' alias
      },
    },
    server: {
      // Fixed non-standard port so the dev server never collides with other local
      // dev servers (e.g. one already occupying 8080). Override via CHIC_DEV_PORT.
      port: Number(process.env.CHIC_DEV_PORT) || 8137,
      strictPort: true, // fail loudly instead of silently hopping to an unforwarded port
      host: true, // bind 0.0.0.0 so a forwarded / remote browser can reach it
      open: false, // headless / remote host: no local browser to auto-open
      watch: {
        usePolling: true,
      },
    },
    preview: {
      // Mirror the dev server: fixed non-standard port, override via CHIC_PREVIEW_PORT.
      port: Number(process.env.CHIC_PREVIEW_PORT) || 8138,
      strictPort: true,
      host: true,
    },
  };
});
