<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 16 16"
    fill="currentColor"
    xmlns="http://www.w3.org/2000/svg"
    class="tier-icon"
    :class="`tier-icon--${tier}`"
    :aria-label="label"
  >
    <!-- God: radiant 8-point starburst -->
    <g v-if="tier === 'god'">
      <polygon points="8,1 9.2,6.2 14.5,5 10.5,9 14,13.2 9,10.6 8,15.5 7,10.6 2,13.2 5.5,9 1.5,5 6.8,6.2"/>
      <circle cx="8" cy="8" r="2.2" opacity="0.5"/>
    </g>

    <!-- Legend: ornate crown with gems -->
    <g v-else-if="tier === 'legend'">
      <path d="M1,12.5 L1,8 L4.5,10.5 L8,2 L11.5,10.5 L15,8 L15,12.5 Z"/>
      <rect x="1" y="12.5" width="14" height="2.5" rx="1"/>
      <circle cx="4.8" cy="12.5" r="1.1" opacity="0.75"/>
      <circle cx="8"   cy="11.5" r="1.3" opacity="0.9"/>
      <circle cx="11.2" cy="12.5" r="1.1" opacity="0.75"/>
    </g>

    <!-- Diamond: classic gem cut -->
    <g v-else-if="tier === 'diamond'">
      <polygon points="8,0 15,5 8,16 1,5" opacity="0.9"/>
      <polygon points="8,0 15,5 8,7 1,5" opacity="0.6"/>
      <polygon points="8,7 15,5 8,16" opacity="0.75"/>
      <polygon points="8,7 1,5 8,16" opacity="0.55"/>
    </g>

    <!-- Platinum: five-point crown -->
    <g v-else-if="tier === 'platinum'">
      <path d="M1,13 L1,8 L4,11 L8,2 L12,11 L15,8 L15,13 Z"/>
      <rect x="1" y="13" width="14" height="2" rx="1"/>
    </g>

    <!-- Gold: five-pointed star -->
    <g v-else-if="tier === 'gold'">
      <polygon points="8,1 10.2,6.1 15.5,6.5 11.5,10 12.9,15.1 8,12.2 3.1,15.1 4.5,10 0.5,6.5 5.8,6.1"/>
    </g>

    <!-- Silver: heater shield -->
    <g v-else-if="tier === 'silver'">
      <path d="M8,15 Q2,12 2,7 L2,3 L8,1 L14,3 L14,7 Q14,12 8,15 Z"/>
      <path d="M8,13 Q4,10.5 4,7 L4,4.5 L8,3 L12,4.5 L12,7 Q12,10.5 8,13 Z" opacity="0.35"/>
    </g>

    <!-- Bronze: laurel-wreath hexagon -->
    <g v-else-if="tier === 'bronze'">
      <polygon points="8,1 14,4.5 14,11.5 8,15 2,11.5 2,4.5"/>
      <polygon points="8,4 11.5,6 11.5,10 8,12 4.5,10 4.5,6" opacity="0.35"/>
    </g>

    <!-- Trash: skull -->
    <g v-else-if="tier === 'trash'">
      <ellipse cx="8" cy="7" rx="5.5" ry="5.5"/>
      <rect x="4.5" y="11" width="7" height="3" rx="1"/>
      <rect x="6" y="12.5" width="1.2" height="2" rx="0.5" fill="none" stroke="currentColor" stroke-width="0.8"/>
      <rect x="8.8" y="12.5" width="1.2" height="2" rx="0.5" fill="none" stroke="currentColor" stroke-width="0.8"/>
      <circle cx="5.8" cy="6.5" r="1.2" fill="#0f0f1a"/>
      <circle cx="10.2" cy="6.5" r="1.2" fill="#0f0f1a"/>
      <path d="M6.5,9.5 L7.2,8.5 L8,9.2 L8.8,8.5 L9.5,9.5" stroke="#0f0f1a" stroke-width="0.8" fill="none"/>
    </g>
  </svg>
</template>

<script setup lang="ts">
import type { Tier } from '~/utils/tiers'
import { TIER_META } from '~/utils/tiers'

const props = withDefaults(
  defineProps<{
    tier: Tier
    size?: number
  }>(),
  { size: 12 },
)

const label = computed(() => TIER_META[props.tier].label)
</script>

<style lang="scss" scoped>
.tier-icon {
  display: inline-block;
  vertical-align: middle;
  flex-shrink: 0;

  &--god      { color: $tier-god-color;      filter: drop-shadow(0 0 4px $tier-god-color); }
  &--legend   { color: $tier-legend-color;   filter: drop-shadow(0 0 4px $tier-legend-color); }
  &--diamond  { color: $tier-diamond-color;  filter: drop-shadow(0 0 3px $tier-diamond-color); }
  &--platinum { color: $tier-platinum-color; }
  &--gold     { color: $tier-gold-color;     filter: drop-shadow(0 0 2px rgba(255,215,0,0.5)); }
  &--silver   { color: $tier-silver-color; }
  &--bronze   { color: $tier-bronze-color; }
  &--trash    { color: $tier-trash-color; }
}
</style>
