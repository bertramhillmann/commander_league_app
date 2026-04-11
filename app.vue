<template>
  <div class="app-shell">
    <UITopMenu v-if="!route.path.startsWith('/admin')" />
    <NuxtPage />
  </div>
</template>

<script setup lang="ts">
const route = useRoute()
const { init } = useLeagueState()
await init()
</script>

<style lang="scss" scoped>
.app-shell {
  min-height: 100vh;
}
</style>
