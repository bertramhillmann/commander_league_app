<template>
  <div class="title-meta">
    <div class="title-meta__eyebrow">Commander Title</div>
    <div class="title-meta__name">{{ title.name }}</div>
    <div class="title-meta__description">{{ title.description }}</div>
    <div class="title-meta__divider" />
    <div class="title-meta__reason">{{ title.reason }}</div>
  </div>
</template>

<script setup lang="ts">
import type { CommanderTitleResult } from '~/utils/titles'

defineProps<{
  title: CommanderTitleResult
}>()
</script>

<style scoped lang="scss">
.title-meta {
  width: 250px;
  background: $color-bg-elevated;
  border: 1px solid rgba($color-accent, 0.35);
  border-radius: $border-radius-lg;
  padding: $spacing-3;
  box-shadow: $shadow-lg;

  &__eyebrow {
    font-size: 10px;
    font-weight: $font-weight-semibold;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: $color-accent;
    margin-bottom: $spacing-1;
  }

  &__name {
    font-size: $font-size-sm;
    font-weight: $font-weight-semibold;
    color: $color-text;
    margin-bottom: 6px;
  }

  &__description,
  &__reason {
    font-size: $font-size-xs;
    line-height: 1.45;
  }

  &__description {
    color: $color-text;
  }

  &__divider {
    height: 1px;
    background: rgba($border-color, 0.9);
    margin: $spacing-2 0;
  }

  &__reason {
    color: $color-text-muted;
  }
}
</style>
