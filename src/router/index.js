import { createRouter, createWebHashHistory } from 'vue-router'

const routes = [
  {
    path: '/',
    name: 'today',
    component: () => import('@/views/Today/TodayView.vue'),
  },
  {
    path: '/diaries',
    name: 'diaries',
    component: () => import('@/views/Diaries/DiariesView.vue'),
  },
  {
    path: '/diaries/:id/edit',
    name: 'diary-edit',
    component: () => import('@/views/DiaryDetail/DiaryEditView.vue'),
  },
  {
    path: '/diaries/:id',
    name: 'diary-detail',
    component: () => import('@/views/DiaryDetail/DiaryDetailView.vue'),
  },
  {
    path: '/drafts',
    name: 'drafts',
    component: () => import('@/views/DiaryDetail/DraftsView.vue'),
  },
  {
    path: '/search',
    name: 'search',
    component: () => import('@/views/Search/SearchView.vue'),
  },
  {
    path: '/calendar',
    name: 'calendar',
    component: () => import('@/views/Calendar/CalendarView.vue'),
  },
  {
    path: '/trash',
    name: 'trash',
    component: () => import('@/views/Trash/TrashView.vue'),
  },
  {
    path: '/settings',
    name: 'settings',
    component: () => import('@/views/Settings/SettingsView.vue'),
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: '/',
  },
]

export default createRouter({
  history: createWebHashHistory(),
  routes,
  scrollBehavior() {
    return { top: 0, behavior: 'instant' }
  },
})
