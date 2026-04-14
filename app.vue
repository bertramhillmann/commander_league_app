<template>
  <div class="app-shell">
    <UITopMenu v-if="!route.path.startsWith('/admin') && route.path !== '/login'" />
    <NuxtPage />
  </div>
</template>

<script setup lang="ts">
import { watch } from 'vue'

const route = useRoute()
const { init } = useLeagueState()

if (!route.path.startsWith('/admin') && route.path !== '/login') {
  await init()
}

if (process.client) {
  watch(
    () => route.path,
    async (path) => {
      if (!path.startsWith('/admin') && path !== '/login') {
        await init()
      }
    },
  )
}
</script>

<style lang="scss" scoped>
.app-shell {
  min-height: 100vh;
}
</style>
