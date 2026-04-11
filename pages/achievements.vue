<template>
  <div class="page page--achievements">
    <h1 class="ach-page__title">Achievements</h1>

    <div class="ach-page__grid">
      <div
        v-for="def in allAchievements"
        :key="def.id"
        class="ach-card"
        @mouseenter="onEnter(def.id, $event)"
        @mousemove="onMouseMove($event)"
        @mouseleave="onLeave"
      >
        <span class="ach-card__icon">{{ def.icon }}</span>
        <div class="ach-card__body">
          <span class="ach-card__name">{{ def.name }}</span>
          <span class="ach-card__desc">{{ def.description }}</span>
        </div>
        <div class="ach-card__meta">
          <span class="ach-card__pts">+{{ def.points }}</span>
          <span v-if="def.repeatable" class="ach-card__tag ach-card__tag--repeatable">repeatable</span>
          <span v-else class="ach-card__tag ach-card__tag--once">once</span>
        </div>
      </div>
    </div>

    <Teleport to="body">
      <div
        v-if="hover.visible"
        class="floating-panel"
        :style="{ top: `${hover.y}px`, left: `${hover.x}px` }"
      >
        <AchievementsAchievementMetaInformation :achievement-id="hover.id" />
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { reactive } from 'vue'
import { ACHIEVEMENTS } from '~/utils/achievements'

const allAchievements = Object.values(ACHIEVEMENTS)

const OFFSET_X = 16
const OFFSET_Y = 16

const hover = reactive({ visible: false, id: '', x: 0, y: 0 })

function calcPosition(e: MouseEvent) {
  let x = e.clientX + OFFSET_X
  let y = e.clientY + OFFSET_Y
  if (x + 220 > window.innerWidth) x = e.clientX - 220 - OFFSET_X
  if (y + 200 > window.innerHeight) y = e.clientY - 200 - OFFSET_Y
  return { x: x + window.scrollX, y: y + window.scrollY }
}

function onEnter(id: string, e: MouseEvent) {
  hover.id = id
  hover.visible = true
  const pos = calcPosition(e)
  hover.x = pos.x
  hover.y = pos.y
}

function onMouseMove(e: MouseEvent) {
  if (!hover.visible) return
  const pos = calcPosition(e)
  hover.x = pos.x
  hover.y = pos.y
}

function onLeave() {
  hover.visible = false
}
</script>

<style lang="scss" scoped>
.ach-page__title {
  font-size: $font-size-xl;
  font-weight: $font-weight-bold;
  color: $color-text;
  margin-bottom: $spacing-6;
}

.ach-page__grid {
  display: flex;
  flex-direction: column;
  gap: $spacing-2;
  max-width: 680px;
}

.ach-card {
  display: flex;
  align-items: center;
  gap: $spacing-3;
  background: $color-bg-card;
  border: 1px solid $border-color;
  border-radius: $border-radius-lg;
  padding: $spacing-3 $spacing-4;
  cursor: default;
  transition: border-color $transition-fast;

  &:hover {
    border-color: $color-primary;
  }

  &__icon {
    font-size: 22px;
    line-height: 1;
    flex-shrink: 0;
    width: 32px;
    text-align: center;
  }

  &__body {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  &__name {
    font-size: $font-size-sm;
    font-weight: $font-weight-semibold;
    color: $color-text;
  }

  &__desc {
    font-size: $font-size-xs;
    color: $color-text-muted;
  }

  &__meta {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: $spacing-1;
    flex-shrink: 0;
  }

  &__pts {
    font-size: $font-size-sm;
    font-weight: $font-weight-bold;
    color: $color-accent;
  }

  &__tag {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    font-weight: $font-weight-medium;
    padding: 1px 6px;
    border-radius: $border-radius-sm;

    &--repeatable { background: rgba($color-secondary, 0.15); color: $color-secondary; }
    &--once       { background: rgba($color-text-muted, 0.1); color: $color-text-muted; }
  }
}
</style>

<style lang="scss">
.floating-panel {
  position: absolute;
  z-index: 9999;
  pointer-events: none;
}
</style>
