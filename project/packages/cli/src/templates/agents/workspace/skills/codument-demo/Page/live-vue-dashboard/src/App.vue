<script setup>
import { computed, ref } from 'vue';
import { usePageConnection } from '@ai-cli/page-sdk/vue';

const connection = usePageConnection();
const count = ref(0);
const target = computed(() => connection.targetRef || '正在连接 Page target…');
</script>

<template>
  <main>
    <p class="eyebrow">AI-EDITABLE SKILL APP</p>
    <h1>Live Vue Dashboard</h1>
    <p>直接修改 <code>src/App.vue</code>；Host 会生成新 generation 并只刷新本页面。</p>
    <button type="button" @click="count += 1">本地计数 {{ count }}</button>
    <small>targetRef：{{ target }}</small>
  </main>
</template>

<style>
:root { font-family: Inter, system-ui, sans-serif; color: #17202a; background: #f6f8fb; }
body { margin: 0; }
main { max-width: 680px; margin: 8vh auto; padding: 32px; border: 1px solid #dde5ee; border-radius: 18px; background: white; box-shadow: 0 18px 50px #18243a12; }
.eyebrow { color: #3867d6; font-size: 12px; font-weight: 700; letter-spacing: .12em; }
h1 { margin: 8px 0; }
button { display: block; margin: 24px 0 14px; padding: 10px 16px; border: 0; border-radius: 9px; color: white; background: #3867d6; cursor: pointer; }
small { color: #66758a; }
</style>
