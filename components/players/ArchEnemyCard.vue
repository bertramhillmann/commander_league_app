<template>
  <div class="arch-enemy-card">
    <template v-if="summary.enemyName">
      <div class="arch-enemy-card__body">
        <img
          v-if="enemyImageUrl"
          :src="enemyImageUrl"
          :alt="enemyLabel"
          class="arch-enemy-card__portrait"
        />
        <div v-else class="arch-enemy-card__portrait arch-enemy-card__portrait--empty" />

        <div class="arch-enemy-card__text">
          <div class="arch-enemy-card__headline">
            <span class="arch-enemy-card__label">⚔ Arch Enemy:</span>
            <NuxtLink
              class="arch-enemy-card__name"
              :to="`/players/${encodeURIComponent(summary.enemyName)}`"
            >
              {{ enemyLabel }}
            </NuxtLink>
          </div>

          <div class="arch-enemy-card__wounds">
            {{ summary.losses }}× hit with
            <span
              class="arch-enemy-card__card-name"
              @mouseenter="onCardEnter($event)"
              @mousemove="onCardMove($event)"
              @mouseleave="onCardLeave"
            >{{ randomCard }}</span>
          </div>
        </div>
      </div>
    </template>

    <template v-else>
      <span class="arch-enemy-card__none">No arch enemy yet</span>
    </template>
  </div>

  <Teleport to="body">
    <div
      v-if="cardPreview.visible && cardImageUrl"
      class="ae-card-preview"
      :style="{ top: `${cardPreview.y}px`, left: `${cardPreview.x}px` }"
    >
      <img :src="cardImageUrl" :alt="randomCard" class="ae-card-preview__img" />
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { fetchCardByName, getCardImageUrl } from '~/services/scryfallService'
import { formatPlayerName } from '~/utils/playerNames'
import type { ArchEnemySummary } from '~/utils/archEnemy'

const BAD_CARDS = [
  'Lava Axe', 'Thermal Blast', 'Tendrils of Agony', 'Frazzle',
  'Cradle to Grave', 'Ember Shot', "Hisoka's Defiance", 'Break Open',
  'Scorching Spear', 'Ichor Explosion', 'Aether Tide', 'Moonlace',
  'Taste of Blood', 'Waste Away', "Kamahl's Sledge", 'Dematerialize',
]

const OFFSET = 18

const props = defineProps<{
  summary: ArchEnemySummary
}>()

const playerImages = import.meta.glob('../../assets/img/*.png', { eager: true, import: 'default' }) as Record<string, string>

const enemyLabel = computed(() =>
  props.summary.enemyName ? formatPlayerName(props.summary.enemyName) : '',
)

const enemyImageUrl = computed(() => {
  if (!props.summary.enemyName) return null
  const key = `../../assets/img/${props.summary.enemyName.toLowerCase()}.png`
  return playerImages[key] ?? null
})

const randomCard = computed(() => {
  if (!props.summary.enemyName) return ''
  const seed = props.summary.playerName + props.summary.enemyName
  let hash = 0
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0
  }
  return BAD_CARDS[hash % BAD_CARDS.length]
})

const cardImageUrl = ref<string | null>(null)
const cardPreview = reactive({ visible: false, x: 0, y: 0 })

onMounted(async () => {
  if (!randomCard.value) return
  const card = await fetchCardByName(randomCard.value)
  if (card) cardImageUrl.value = getCardImageUrl(card, 'normal')
})

function calcPos(e: MouseEvent) {
  const W = 260, H = 364
  let x = e.clientX + OFFSET
  let y = e.clientY + OFFSET
  if (x + W > window.innerWidth) x = e.clientX - W - OFFSET
  if (y + H > window.innerHeight) y = e.clientY - H - OFFSET
  return { x, y }
}

function onCardEnter(e: MouseEvent) {
  const pos = calcPos(e)
  cardPreview.x = pos.x
  cardPreview.y = pos.y
  cardPreview.visible = true
}

function onCardMove(e: MouseEvent) {
  if (!cardPreview.visible) return
  const pos = calcPos(e)
  cardPreview.x = pos.x
  cardPreview.y = pos.y
}

function onCardLeave() {
  cardPreview.visible = false
}
</script>

<style lang="scss" scoped>
.arch-enemy-card {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  background: rgba(0, 0, 0, 0.35);
  padding: $spacing-3 $spacing-4;
  border-radius: $border-radius-lg;
  gap: $spacing-1;
  margin: 0 0 0 auto;

  &__body {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: $spacing-2;
  }

  &__portrait {
    flex-shrink: 0;
    width: 64px;
    height: 64px;
    border-radius: $border-radius-sm;
    object-fit: cover;
    object-position: center top;
    border: 1px solid rgba($color-danger, 0.3);

    &--empty {
      background: rgba($color-danger, 0.06);
    }
  }

  &__text {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  &__headline {
    display: flex;
    align-items: baseline;
    gap: $spacing-2;
    flex-wrap: wrap;
  }

  &__label {
    font-size: $font-size-xs;
    font-weight: $font-weight-bold;
    color: $color-danger;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    text-shadow: 0 0 10px rgba($color-danger, 0.5);
    white-space: nowrap;
  }

  &__name {
    font-size: $font-size-lg;
    font-weight: $font-weight-bold;
    color: $color-danger;
    line-height: 1;
    text-decoration: none;
    transition: color $transition-fast;

    &:hover {
      color: rgba($color-danger, 0.8);
      text-decoration: underline dotted;
    }
  }

  &__wounds {
    font-size: $font-size-xs;
    color: rgba($color-danger, 0.55);
    font-style: italic;
    letter-spacing: 0.02em;
  }

  &__card-name {
    color: rgba($color-danger, 0.8);
    font-style: normal;
    font-weight: $font-weight-semibold;
    cursor: help;
    border-bottom: 1px dotted rgba($color-danger, 0.4);
  }

  &__none {
    font-size: $font-size-sm;
    color: $color-text-muted;
    font-style: italic;
  }
}
</style>

<style lang="scss">
.ae-card-preview {
  position: fixed;
  z-index: 9999;
  pointer-events: none;

  &__img {
    width: 260px;
    border-radius: 14px;
    display: block;
    box-shadow: 0 18px 48px rgba(0, 0, 0, 0.55);
  }
}
</style>
