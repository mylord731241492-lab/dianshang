<script setup lang="ts">
defineProps<{
  eyebrow?: string;
  title?: string;
}>();
</script>

<template>
  <section class="admin-source-panel">
    <div v-if="title || eyebrow || $slots.actions" class="admin-panel-head">
      <div>
        <p v-if="eyebrow" class="eyebrow">{{ eyebrow }}</p>
        <h2 v-if="title">{{ title }}</h2>
      </div>
      <slot name="actions" />
    </div>
    <slot />
  </section>
</template>
