import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'workbench',
      component: () => import('@/views/Workbench.vue'),
      meta: { title: '工作台' },
    },
    {
      path: '/result/:id',
      name: 'result',
      component: () => import('@/views/Result.vue'),
      meta: { title: '分析结果' },
    },
    {
      path: '/questions/:id',
      name: 'questions',
      component: () => import('@/views/Questions.vue'),
      meta: { title: '面试题预测' },
    },
    {
      path: '/history',
      name: 'history',
      component: () => import('@/views/History.vue'),
      meta: { title: '历史记录' },
    },
    {
      path: '/settings',
      name: 'settings',
      component: () => import('@/views/Settings.vue'),
      meta: { title: '设置' },
    },
    {
      path: '/about',
      name: 'about',
      component: () => import('@/views/About.vue'),
      meta: { title: '关于' },
    },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
  scrollBehavior: () => ({ top: 0 }),
})

router.afterEach((to) => {
  const title = to.meta.title as string | undefined
  document.title = title ? `${title} · OfferLens` : 'OfferLens'
})

export default router
