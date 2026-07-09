<script setup lang="ts">
import AdminSourceSidebar from '../AdminSourceSidebar.vue';
</script>

<template>
  <main class="admin-source-shell">
    <AdminSourceSidebar />
    <section class="admin-source-main">
      <slot />
    </section>
  </main>
</template>
