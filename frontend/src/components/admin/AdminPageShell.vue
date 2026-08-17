<script setup lang="ts">
import { NConfigProvider } from 'naive-ui';
import AdminSourceSidebar from '../AdminSourceSidebar.vue';
import { adminNaiveThemeOverrides } from '../../config/adminTheme';
</script>

<template>
  <n-config-provider abstract :theme="null" :theme-overrides="adminNaiveThemeOverrides">
    <main class="admin-source-shell">
      <AdminSourceSidebar />
      <section class="admin-source-main">
        <slot />
      </section>
    </main>
  </n-config-provider>
</template>
