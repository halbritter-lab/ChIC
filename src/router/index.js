// router/index.js
import { createWebHistory, createRouter } from "vue-router";
import Home from "@/App.vue";

const routes = [
  {
    path: "/",
    name: "Home",
    component: Home,
  },
];

const router = createRouter({
  // Respect the Vite base path (/ChIC/ in production) so deep links/refresh work.
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
});

export default router;