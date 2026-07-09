<script setup lang="ts">
import { adminBrandIcon, adminNavigationGroups, adminNavigationItems } from '../config/adminNavigation';
</script>

<template>
  <aside class="admin-source-sidebar">
    <div class="admin-source-brand">
      <div><component :is="adminBrandIcon" :size="22" /></div>
      <span>管理员后台</span>
      <small>Source Console</small>
    </div>
    <nav>
      <section v-for="group in adminNavigationGroups" :key="group.key" class="admin-source-nav-group">
        <strong>{{ group.label }}</strong>
        <RouterLink
          v-for="item in adminNavigationItems.filter((navItem) => navItem.group === group.key)"
          :key="item.path"
          :to="item.path"
          active-class="active"
          exact-active-class="active"
        >
          <span><component :is="item.icon" :size="15" />{{ item.label }}</span>
        </RouterLink>
      </section>
    </nav>
  </aside>
</template>
