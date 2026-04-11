<template>
  <div>
    <NuxtPage />
  </div>
</template>

<script setup lang="ts">
const { init } = useLeagueState()
await init()
</script>
