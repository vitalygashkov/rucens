import { createRouter, createWebHistory } from 'vue-router';
import Root from '@/routes/_root.vue';

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'root',
      component: Root,
      children: [
        {
          path: '',
          name: 'home',
          component: () => import('./routes/(home).vue'),
        },
      ],
    },
  ],
});

export default router;
