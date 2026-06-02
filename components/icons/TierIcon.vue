<template>
  <img
    :src="iconSrc"
    :alt="label"
    :width="size"
    :height="size"
    class="tier-icon"
    :class="`tier-icon--${tier}`"
  />
</template>

<script setup lang="ts">
import type { Tier } from '~/utils/tiers'
import { TIER_META } from '~/utils/tiers'
import trashIcon from '~/assets/img/icons/trash.png'
import bronzeIcon from '~/assets/img/icons/bronze.png'
import silverIcon from '~/assets/img/icons/silver.png'
import goldIcon from '~/assets/img/icons/gold.png'
import platinumIcon from '~/assets/img/icons/platinum.png'
import diamondIcon from '~/assets/img/icons/diamond.png'
import legendIcon from '~/assets/img/icons/legend.png'
import godIcon from '~/assets/img/icons/god.png'

const TIER_ICONS: Record<string, string> = {
  trash: trashIcon,
  bronze: bronzeIcon,
  silver: silverIcon,
  gold: goldIcon,
  platinum: platinumIcon,
  diamond: diamondIcon,
  legend: legendIcon,
  god: godIcon,
}

const props = withDefaults(
  defineProps<{
    tier: Tier | string
    size?: number
  }>(),
  { size: 16 },
)

const label = computed(() => TIER_META[props.tier as Tier]?.label ?? props.tier)
const iconSrc = computed(() => TIER_ICONS[props.tier])
</script>

<style lang="scss" scoped>
.tier-icon {
  display: inline-block;
  vertical-align: middle;
  flex-shrink: 0;
  object-fit: contain;

  &--god      { filter: drop-shadow(0 0 4px $tier-god-color); }
  &--legend   { filter: drop-shadow(0 0 4px $tier-legend-color); }
  &--diamond  { filter: drop-shadow(0 0 3px $tier-diamond-color); }
  &--gold     { filter: drop-shadow(0 0 2px rgba(255,215,0,0.5)); }
}
</style>
