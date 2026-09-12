<script setup>
defineProps({ route: { type: String, required: true } });
</script>

<template>
  <article><small>PageBundle source route</small><code>{{ route }}</code><slot /></article>
</template>

<style scoped>
article{max-width:760px;margin:auto;padding:24px;border:1px solid #dce3ea;border-radius:14px;background:#fff}small,code{display:block}code{margin:6px 0 20px;color:#2456a6}
</style>
