<script setup>
defineProps({ route: { type: String, required: true } });
</script>
<template><section><h1>动态详情</h1><p>{{ route }}</p><p>动态参数产生多个页面实例，但只对应一个 Page definition。</p></section></template>
