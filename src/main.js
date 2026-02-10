// main.js
import { createApp } from 'vue';
import App from './App.vue';
import router from './router';
// Register service worker only in production to avoid caching during development
if (import.meta.env && import.meta.env.PROD) {
	import('./registerServiceWorker');
}
// In development, unregister any previously-registered service workers
// so cached assets from older builds don't interfere with HMR/dev reloads.
if (import.meta.env && !import.meta.env.PROD && typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
	navigator.serviceWorker.getRegistrations().then(regs => {
		regs.forEach(r => r.unregister());
	}).catch(() => {});
	// Also clear any CacheStorage entries created by older SWs
	if (typeof caches !== 'undefined') {
		caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k)))).catch(() => {});
	}
}

createApp(App).use(router).mount('#app');