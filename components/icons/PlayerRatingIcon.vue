<template>
  <img :src="iconUrl" alt="" class="player-rating-icon" :style="{ width: `${size}px`, height: `${size}px` }" />
</template>

<script setup lang="ts">
import iconUrl from '~/assets/img/icons/favicon.png'
withDefaults(defineProps<{ size?: number }>(), { size: 12 })
</script>

<style scoped>
.player-rating-icon {
  display: inline-block;
  vertical-align: middle;
  flex-shrink: 0;
  object-fit: contain;
  margin-bottom: 1px;
}
</style>
