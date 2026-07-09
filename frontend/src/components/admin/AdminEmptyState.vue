<script setup lang="ts">
defineProps<{
  message: string;
}>();
</script>

<template>
  <p class="admin-empty">{{ message }}</p>
</template>
