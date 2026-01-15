// router/index.js
import { createWebHistory, createRouter, useRoute } from "vue-router";
import Home from "@/App.vue";

const routes = [
  {
    path: "/",
    name: "Home",
    component: Home,
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

export default router;