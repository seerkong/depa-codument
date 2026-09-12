<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import RouteCard from './components/RouteCard.vue';
import DetailView from './views/DetailView.vue';
import OverviewView from './views/OverviewView.vue';

const sourceRoute = ref(globalThis.__HALFCODE_PAGE_ROUTE__ ?? '/');
const activeView = computed(() => sourceRoute.value.startsWith('/detail/') || sourceRoute.value.startsWith('/d/')
  ? DetailView
  : OverviewView);

function receiveRoute(event) {
  sourceRoute.value = event.detail?.sourceRoute ?? '/';
}

onMounted(() => addEventListener('codument.route', receiveRoute));
onBeforeUnmount(() => removeEventListener('codument.route', receiveRoute));
</script>

<template>
  <main>
    <RouteCard :route="sourceRoute">
      <component :is="activeView" :route="sourceRoute" />
    </RouteCard>
  </main>
</template>

<style scoped>
main{min-height:100vh;padding:32px;background:#f5f7fb;color:#17202a;font-family:Inter,system-ui,sans-serif}
</style>
