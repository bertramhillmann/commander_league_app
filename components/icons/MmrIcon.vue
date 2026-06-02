<template>
  <img :src="mmrIconUrl" alt="" class="mmr-icon" :style="{ width: `${size}px`, height: `${size}px` }" />
</template>

<script setup lang="ts">
import mmrIconUrl from '~/assets/img/mmr_icon.png'
withDefaults(defineProps<{ size?: number }>(), { size: 12 })
</script>

<style scoped>
.mmr-icon {
  display: inline-block;
  vertical-align: middle;
  flex-shrink: 0;
  object-fit: contain;
  margin-bottom: 1px;
}
</style>
