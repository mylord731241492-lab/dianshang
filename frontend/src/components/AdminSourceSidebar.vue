<script setup lang="ts">
import { ShieldCheck } from 'lucide-vue-next';

const navItems = [
  { label: '控制台 Dashboard', path: '/admin/dashboard' },
  { label: '用户管理', path: '/admin/users' },
  { label: '回收站', path: '/admin/recycle-bin' },
  { label: '订单管理', path: '/admin/orders' },
  { label: '消费日志', path: '/admin/logs' },
  { label: '任务监控', path: '/admin/generate-tasks' },
  { label: '兑换码管理', path: '/admin/redeem-codes' },
  { label: 'API 线路', path: '/admin/api-providers' },
  { label: '模型价格', path: '/admin/model-prices' },
  { label: '模板工作流', path: '/admin/template-workflows' },
  { label: '系统设置', path: '/admin/settings' }
];
</script>

<template>
  <aside class="admin-source-sidebar">
    <div class="admin-source-brand">
      <div><ShieldCheck :size="22" /></div>
      <span>管理员后台</span>
      <small>Source Console</small>
    </div>
    <nav>
      <RouterLink
        v-for="item in navItems"
        :key="item.path"
        :to="item.path"
        active-class="active"
        exact-active-class="active"
      >
        {{ item.label }}
      </RouterLink>
    </nav>
  </aside>
</template>
