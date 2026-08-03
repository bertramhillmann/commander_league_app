<template>
  <Teleport to="body">
    <div
      v-if="game"
      ref="modalRef"
      class="game-point-modal"
    >
      <button type="button" class="game-point-modal__close" @click="emit('close')">×</button>
      <div class="game-point-modal__body">
        <GamesGame :game="game" />
      </div>
      <div class="game-point-modal__footer">
        <NuxtLink
          class="game-point-modal__gamelist-link"
          :to="`/gameList?highlight=${encodeURIComponent(game.gameId)}`"
        >View in game list →</NuxtLink>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
const props = defineProps<{
  gameId: string | null
}>()

const emit = defineEmits<{
  close: []
}>()

const { games } = useLeagueState()
const modalRef = ref<HTMLElement | null>(null)

const game = computed(() => {
  if (!props.gameId) return null
  return games.value.find((entry) => entry.gameId === props.gameId) ?? null
})

function onOutsidePointerDown(event: PointerEvent) {
  if (modalRef.value && modalRef.value.contains(event.target as Node)) return
  emit('close')
}

watch(
  () => props.gameId,
  (id) => {
    if (!import.meta.client) return
    if (id) {
      document.addEventListener('pointerdown', onOutsidePointerDown, true)
    } else {
      document.removeEventListener('pointerdown', onOutsidePointerDown, true)
    }
  },
)

onBeforeUnmount(() => {
  if (import.meta.client) document.removeEventListener('pointerdown', onOutsidePointerDown, true)
})
</script>

<style lang="scss">
.game-point-modal {
  position: fixed;
  right: $spacing-4;
  bottom: $spacing-4;
  z-index: 9000;
  width: min(720px, calc(100vw - #{$spacing-4} * 2));
  max-height: min(90vh, calc(100vh - #{$spacing-4} * 2));
  display: flex;
  flex-direction: column;
  border-radius: $border-radius-xl;
  border: 1px solid rgba($color-primary-light, 0.35);
  background: rgba(10, 8, 16, 0.98);
  box-shadow: $shadow-lg;
  overflow: hidden;
}

.game-point-modal__close {
  position: absolute;
  top: 10px;
  right: 10px;
  z-index: 1;
  appearance: none;
  width: 26px;
  height: 26px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  border: 1px solid rgba($border-color, 0.8);
  background: rgba(20, 18, 36, 0.95);
  color: $color-text-muted;
  font-size: 16px;
  line-height: 1;
  cursor: pointer;

  &:hover {
    color: $color-text;
    border-color: rgba($color-primary-light, 0.5);
  }
}

.game-point-modal__body {
  padding: 18px;
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: rgba($color-primary-light, 0.2) transparent;

  .game-card {
    border: none !important;

    &:hover {
      transform: none !important;
      box-shadow: none !important;
    }
  }
}

.game-point-modal__footer {
  display: flex;
  justify-content: flex-end;
  padding: 0 18px 14px;
}

.game-point-modal__gamelist-link {
  color: $color-primary-light;
  text-decoration: none;
  font-size: $font-size-xs;
  white-space: nowrap;

  &:hover { text-decoration: underline dotted; }
}
</style>
