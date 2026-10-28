import { createRouter, createWebHistory } from 'vue-router'

import { useAuthStore } from '@/stores/auth'

const APP_NAME = 'Particule'

declare module 'vue-router' {
  interface RouteMeta {
    /** Browser tab title, shown as "<title> · Particule" */
    title?: string
    /** Redirects anonymous users to the login page */
    requiresAuth?: boolean
    /** Redirects signed-in users to the app (home, login, signup) */
    guestOnly?: boolean
    /** Shell rendered by App.vue: public site (default), standalone login/signup, or the app */
    layout?: 'public' | 'auth' | 'app'
  }
}

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: () => import('@/views/HomeView.vue'),
      meta: { guestOnly: true },
    },
    {
      // The home page content, still reachable once signed in
      path: '/about',
      name: 'about',
      component: () => import('@/views/HomeView.vue'),
      meta: { title: 'À propos' },
    },
    {
      path: '/login',
      name: 'login',
      component: () => import('@/views/LoginView.vue'),
      meta: { title: 'Connexion', guestOnly: true, layout: 'auth' },
    },
    {
      path: '/signup',
      name: 'signup',
      component: () => import('@/views/SignupView.vue'),
      meta: { title: 'Créer un compte', guestOnly: true, layout: 'auth' },
    },
    {
      path: '/app',
      component: () => import('@/views/KnowledgeBaseLayout.vue'),
      meta: { requiresAuth: true, layout: 'app' },
      children: [
        {
          path: '',
          name: 'knowledge-bases',
          component: () => import('@/views/KnowledgeBasesView.vue'),
          meta: { title: 'Bases de connaissances' },
        },
        {
          // The user's sources, with the source `sourceId` open (or a new one with `?new`).
          // Declared before the knowledge base route, which would match `/app/sources` too
          path: 'sources/:sourceId?',
          name: 'sources',
          component: () => import('@/views/SourcesView.vue'),
          props: true,
          meta: { title: 'Sources' },
        },
        {
          // Particules list, with the particule `permalink` open (or a draft with `?new`)
          path: ':kbId/:permalink?',
          name: 'knowledge-base',
          component: () => import('@/views/KnowledgeBaseView.vue'),
          props: true,
        },
      ],
    },
  ],
})

router.beforeEach(async (to) => {
  const auth = useAuthStore()

  // Restore the session from the stored token; if the API is unreachable, continue as anonymous
  if (auth.token && !auth.user) await auth.fetchUser().catch(() => {})

  if (to.meta.requiresAuth && !auth.isAuthenticated) {
    return { name: 'login', query: { redirect: to.fullPath } }
  }
  if (to.meta.guestOnly && auth.isAuthenticated) return { name: 'knowledge-bases' }
})

router.afterEach((to) => {
  document.title = to.meta.title ? `${to.meta.title} · ${APP_NAME}` : APP_NAME
})

export default router
