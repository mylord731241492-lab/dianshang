<script setup lang="ts">
import { ArrowLeft } from 'lucide-vue-next';

defineProps<{
  eyebrow: string;
  title: string;
  description: string;
}>();
</script>

<template>
  <header class="admin-source-topbar">
    <div>
      <RouterLink to="/" class="template-back"><ArrowLeft :size="16" />返回前台</RouterLink>
      <p class="eyebrow">{{ eyebrow }}</p>
      <h1>{{ title }}</h1>
      <span>{{ description }}</span>
    </div>
    <div class="admin-source-actions">
      <slot name="actions" />
    </div>
  </header>
</template>
