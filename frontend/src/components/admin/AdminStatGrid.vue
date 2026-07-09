<script setup lang="ts">
import type { Component } from 'vue';

export interface AdminStatItem {
  label: string;
  value: number | string;
  icon: Component;
}

const props = defineProps<{
  stats: AdminStatItem[];
  label: string;
}>();

function formatValue(value: number | string) {
  if (typeof value === 'number') return value.toLocaleString('zh-CN');
  const numericValue = Number(value);
  return Number.isFinite(numericValue) && String(value).trim() !== '' ? numericValue.toLocaleString('zh-CN') : value;
}
</script>

<template>
  <section class="admin-stat-grid" :aria-label="props.label">
    <article v-for="stat in props.stats" :key="stat.label">
      <component :is="stat.icon" :size="20" />
      <span>{{ stat.label }}</span>
      <strong>{{ formatValue(stat.value) }}</strong>
    </article>
  </section>
</template>
