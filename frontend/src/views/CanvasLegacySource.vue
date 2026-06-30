<script setup lang="ts">
import { onMounted } from 'vue';
import { legacyUrl } from '../config/legacy';

function redirectToLegacyCanvas() {
  const search = window.location.search || '';
  window.location.replace(`${legacyUrl('/canvas')}${search}`);
}

onMounted(redirectToLegacyCanvas);
</script>

<template>
  <main class="canvas-direct-redirect">
    <span>正在打开画布...</span>
  </main>
</template>
