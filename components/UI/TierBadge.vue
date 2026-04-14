<template>
  <span
    class="tier-badge"
    @mouseenter="onEnter"
    @mousemove="onMove"
    @mouseleave="onLeave"
  >
    <IconsTierIcon :tier="detail.tier" :size="size" />
    <span class="tier-badge__label" :class="`tier-text--${detail.tier}`">
      {{ label }}
    </span>

    <Teleport to="body">
      <div
        v-if="tooltipVisible && context"
        class="tier-tooltip"
        :style="{ top: `${tooltipY}px`, left: `${tooltipX}px` }"
      >
        <div class="tier-tooltip__title" :class="`tier-text--${detail.tier}`">
          {{ label }}
        </div>
        <div class="tier-tooltip__divider" />
        <div class="tier-tooltip__rows">
          <div v-if="progress && !isTopOfAll" class="tier-tooltip__row tier-tooltip__row--rise">
            <template v-if="progress.riseGames !== null">
              <span class="tier-tooltip__arrow tier-tooltip__arrow--up">▲</span>
              <span class="tier-tooltip__text">
                {{ progress.riseGames === 1 ? 'Next' : `${progress.riseGames} consecutive` }}
                1st place{{ progress.riseGames === 1 ? '' : 's' }} could push to
                <strong>{{ progress.riseTarget }}</strong>
              </span>
            </template>
            <template v-else>
              <span class="tier-tooltip__arrow tier-tooltip__arrow--up">▲</span>
              <span class="tier-tooltip__text tier-tooltip__text--muted">Consistent wins needed to rise</span>
            </template>
          </div>
          <div v-if="isTopOfAll" class="tier-tooltip__row">
            <span class="tier-tooltip__arrow tier-tooltip__arrow--up">▲</span>
            <span class="tier-tooltip__text tier-tooltip__text--muted">Peak division — can't go higher</span>
          </div>

          <div v-if="progress && !isBottomOfAll" class="tier-tooltip__row tier-tooltip__row--drop">
            <template v-if="progress.dropGames !== null">
              <span class="tier-tooltip__arrow tier-tooltip__arrow--down">▼</span>
              <span class="tier-tooltip__text">
                {{ progress.dropGames === 1 ? 'Next' : `${progress.dropGames} consecutive` }}
                0-point game{{ progress.dropGames === 1 ? '' : 's' }} could drop to
                <strong>{{ progress.dropTarget }}</strong>
              </span>
            </template>
            <template v-else>
              <span class="tier-tooltip__arrow tier-tooltip__arrow--down">▼</span>
              <span class="tier-tooltip__text tier-tooltip__text--muted">Stable — safe from drop in next 5 games</span>
            </template>
          </div>
          <div v-if="isBottomOfAll" class="tier-tooltip__row">
            <span class="tier-tooltip__arrow tier-tooltip__arrow--down">▼</span>
            <span class="tier-tooltip__text tier-tooltip__text--muted">Lowest division</span>
          </div>
        </div>
      </div>
    </Teleport>
  </span>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { TIER_META, getTierProgress, tierDetailLabel, type TierDetail, type TierContext, type TierProgress } from '~/utils/tiers'

const props = withDefaults(
  defineProps<{
    detail: TierDetail
    context?: TierContext
    size?: number
  }>(),
  { size: 13 },
)

const label = computed(() => tierDetailLabel(props.detail))

const isTopOfAll = computed(() => props.detail.tier === 'god' && props.detail.division === 3)
const isBottomOfAll = computed(() => props.detail.tier === 'trash' && props.detail.division === 1)

const progress = computed((): TierProgress | null => {
  if (!props.context) return null
  return getTierProgress(props.detail, props.context)
})

// ── Tooltip positioning ───────────────────────────────────────────────────────

const OFFSET_X = 14
const OFFSET_Y = 14
const TOOLTIP_W = 280
const TOOLTIP_H = 100

const tooltipVisible = ref(false)
const tooltipX = ref(0)
const tooltipY = ref(0)

function calcPos(e: MouseEvent) {
  let x = e.clientX + OFFSET_X + window.scrollX
  let y = e.clientY + OFFSET_Y + window.scrollY
  if (e.clientX + OFFSET_X + TOOLTIP_W > window.innerWidth) {
    x = e.clientX - TOOLTIP_W - OFFSET_X + window.scrollX
  }
  if (e.clientY + OFFSET_Y + TOOLTIP_H > window.innerHeight) {
    y = e.clientY - TOOLTIP_H - OFFSET_Y + window.scrollY
  }
  return { x, y }
}

function onEnter(e: MouseEvent) {
  if (!props.context) return
  tooltipVisible.value = true
  const pos = calcPos(e)
  tooltipX.value = pos.x
  tooltipY.value = pos.y
}

function onMove(e: MouseEvent) {
  if (!tooltipVisible.value) return
  const pos = calcPos(e)
  tooltipX.value = pos.x
  tooltipY.value = pos.y
}

function onLeave() {
  tooltipVisible.value = false
}
</script>

<style lang="scss" scoped>
.tier-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  cursor: default;

  &__label {
    font-size: $font-size-xs;
    font-weight: $font-weight-medium;
    text-transform: uppercase;
    letter-spacing: 0.06em;

    &.tier-text--god      { color: $tier-god-color; }
    &.tier-text--legend   { color: $tier-legend-color; }
    &.tier-text--diamond  { color: $tier-diamond-color; }
    &.tier-text--platinum { color: $tier-platinum-color; }
    &.tier-text--gold     { color: $tier-gold-color; }
    &.tier-text--silver   { color: $tier-silver-color; }
    &.tier-text--bronze   { color: $tier-bronze-color; }
    &.tier-text--trash    { color: $tier-trash-color; }
  }
}
</style>

<style lang="scss">
.tier-tooltip {
  position: absolute;
  z-index: 9999;
  width: 280px;
  background: $color-bg-elevated;
  border: 1px solid $border-color;
  border-radius: $border-radius-md;
  padding: $spacing-2 $spacing-3;
  box-shadow: $shadow-lg;
  pointer-events: none;

  &__title {
    font-size: $font-size-xs;
    font-weight: $font-weight-bold;
    text-transform: uppercase;
    letter-spacing: 0.08em;

    &.tier-text--god      { color: $tier-god-color; }
    &.tier-text--legend   { color: $tier-legend-color; }
    &.tier-text--diamond  { color: $tier-diamond-color; }
    &.tier-text--platinum { color: $tier-platinum-color; }
    &.tier-text--gold     { color: $tier-gold-color; }
    &.tier-text--silver   { color: $tier-silver-color; }
    &.tier-text--bronze   { color: $tier-bronze-color; }
    &.tier-text--trash    { color: $tier-trash-color; }
  }

  &__divider {
    height: 1px;
    background: $border-color;
    margin: $spacing-1 0;
  }

  &__rows {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  &__row {
    display: flex;
    align-items: flex-start;
    gap: $spacing-2;
    font-size: $font-size-xs;
    line-height: 1.45;
  }

  &__arrow {
    flex-shrink: 0;
    font-size: 9px;
    margin-top: 2px;

    &--up   { color: $color-success; }
    &--down { color: $color-danger; }
  }

  &__text {
    color: $color-text;

    strong {
      color: $color-text;
      font-weight: $font-weight-semibold;
    }

    &--muted {
      color: $color-text-muted;
    }
  }
}
</style>
