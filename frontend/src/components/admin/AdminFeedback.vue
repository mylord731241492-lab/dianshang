<script setup lang="ts">
defineProps<{
  errorMessage?: string;
  successMessage?: string;
}>();
</script>

<template>
  <div v-if="errorMessage" class="template-error admin-feedback admin-feedback-error">{{ errorMessage }}</div>
  <div v-if="successMessage" class="template-success admin-feedback admin-feedback-success">{{ successMessage }}</div>
</template>
