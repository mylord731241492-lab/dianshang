import { createRouter, createWebHistory } from 'vue-router';
import HomeWorkbench from '../views/HomeWorkbench.vue';

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'home', component: HomeWorkbench },
    { path: '/canvas', name: 'canvas', component: () => import('../views/CanvasLegacySource.vue') },
    { path: '/template-image', name: 'template-image', component: () => import('../views/TemplateImageSource.vue') },
    { path: '/gallery', name: 'gallery', component: () => import('../views/GallerySource.vue') },
    { path: '/login', name: 'login', component: () => import('../views/AuthSource.vue'), props: { mode: 'login' } },
    { path: '/register', name: 'register', component: () => import('../views/AuthSource.vue'), props: { mode: 'register' } },
    { path: '/admin', name: 'admin-root', redirect: '/admin/login' },
    { path: '/admin/login', name: 'admin-login', component: () => import('../views/AdminLoginSource.vue') },
    { path: '/admin/dashboard', name: 'admin-dashboard', component: () => import('../views/AdminDashboardSource.vue') },
    { path: '/admin/users', name: 'admin-users', component: () => import('../views/AdminUsersSource.vue') },
    { path: '/admin/recycle-bin', name: 'admin-recycle-bin', component: () => import('../views/AdminRecycleBinSource.vue') },
    { path: '/admin/generate-tasks', name: 'admin-generate-tasks', component: () => import('../views/AdminGenerateTasksSource.vue') },
    { path: '/admin/logs', name: 'admin-logs', component: () => import('../views/AdminUsageLogsSource.vue') },
    { path: '/admin/orders', name: 'admin-orders', component: () => import('../views/AdminOrdersSource.vue') },
    { path: '/admin/redeem-codes', name: 'admin-redeem-codes', component: () => import('../views/AdminRedeemCodesSource.vue') },
    { path: '/admin/model-prices', name: 'admin-model-prices', component: () => import('../views/AdminModelPricesSource.vue') },
    { path: '/admin/api-providers', name: 'admin-api-providers', component: () => import('../views/AdminApiProvidersSource.vue') },
    { path: '/admin/template-workflows', name: 'admin-template-workflows', component: () => import('../views/AdminTemplateWorkflowsSource.vue') },
    { path: '/admin/chat-settings', name: 'admin-chat-settings', component: () => import('../views/AdminChatSettingsSource.vue') },
    { path: '/admin/settings', name: 'admin-settings', component: () => import('../views/AdminSettingsSource.vue') },
    { path: '/user/center', name: 'user-center', component: () => import('../views/UserCenterSource.vue') },
    { path: '/user/records', name: 'user-records', component: () => import('../views/UserRecordsSource.vue') },
    { path: '/user/redeem', name: 'user-redeem', component: () => import('../views/UserRedeemSource.vue') },
    { path: '/:pathMatch(.*)*', redirect: '/' }
  ]
});
