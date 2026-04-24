<template>
  <div class="app-shell">
    <UITopMenu v-if="showTopMenu" />
    <NuxtPage />

    <Transition name="app-boot">
      <div v-if="showBootOverlay" class="app-boot" aria-live="polite" aria-busy="true">
        <div class="app-boot__backdrop">
          <span class="app-boot__orb app-boot__orb--primary" />
          <span class="app-boot__orb app-boot__orb--secondary" />
          <span class="app-boot__orb app-boot__orb--accent" />
        </div>

        <div class="app-boot__panel">
          <div class="app-boot__sigil" aria-hidden="true">
            <span class="app-boot__ring app-boot__ring--outer" />
            <span class="app-boot__ring app-boot__ring--inner" />
            <span class="app-boot__core" />
          </div>
          <div class="app-boot__meter" aria-hidden="true">
            <span class="app-boot__meter-fill" />
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'

const route = useRoute()
const { user } = useAuth()
const { init, loaded, loading } = useLeagueState()
const bootPending = ref(false)

function isProtectedPath(path: string) {
  return !path.startsWith('/admin') && path !== '/login'
}

const showTopMenu = computed(() => isProtectedPath(route.path))
const showBootOverlay = computed(() =>
  process.client &&
  showTopMenu.value &&
  Boolean(user.value) &&
  !loaded.value &&
  (loading.value || bootPending.value),
)

async function bootstrapRoute(path: string) {
  if (!process.client || !isProtectedPath(path)) {
    bootPending.value = false
    return
  }

  bootPending.value = true

  try {
    await init()
  } finally {
    bootPending.value = false
  }
}

if (process.server && isProtectedPath(route.path)) {
  await init()
}

if (process.client) {
  watch(
    () => route.path,
    async (path) => {
      await bootstrapRoute(path)
    },
    { immediate: true },
  )
}
</script>

<style lang="scss" scoped>
.app-shell {
  min-height: 100vh;
}

.app-boot {
  position: fixed;
  inset: 0;
  z-index: 1200;
  display: grid;
  place-items: center;
  overflow: hidden;
  background:
    radial-gradient(circle at top, rgba(32, 20, 52, 0.62), rgba(8, 6, 14, 0.94)),
    rgba(6, 5, 10, 0.82);
  backdrop-filter: blur(20px) saturate(1.15);

  &__backdrop {
    position: absolute;
    inset: 0;
    overflow: hidden;
    pointer-events: none;
  }

  &__orb {
    position: absolute;
    border-radius: 50%;
    filter: blur(90px);
    opacity: 0.3;

    &--primary {
      top: -10%;
      left: -8%;
      width: 28rem;
      height: 28rem;
      background: radial-gradient(circle, rgba($color-primary-light, 0.78), rgba($color-primary-dark, 0.12));
      animation: boot-drift 13s ease-in-out infinite;
    }

    &--secondary {
      right: -10%;
      bottom: -12%;
      width: 24rem;
      height: 24rem;
      background: radial-gradient(circle, rgba($color-secondary, 0.6), rgba($color-secondary, 0.08));
      animation: boot-drift-alt 16s ease-in-out infinite;
    }

    &--accent {
      top: 18%;
      right: 20%;
      width: 14rem;
      height: 14rem;
      background: radial-gradient(circle, rgba($color-accent, 0.48), rgba($color-accent, 0.04));
      animation: boot-pulse 7s ease-in-out infinite;
    }
  }

  &__panel {
    position: relative;
    z-index: 1;
    width: min(calc(100vw - $spacing-8 * 2), 20rem);
    padding: $spacing-6;
    border: 1px solid rgba($color-primary-light, 0.22);
    border-radius: 1.75rem;
    background: linear-gradient(180deg, rgba(21, 14, 34, 0.88), rgba(10, 9, 18, 0.92));
    box-shadow:
      0 2rem 5rem rgba(0, 0, 0, 0.45),
      inset 0 1px 0 rgba(255, 255, 255, 0.05);
    text-align: center;
  }

  &__sigil {
    position: relative;
    width: 7rem;
    height: 7rem;
    margin: 0 auto $spacing-4;
  }

  &__ring--outer {
    position: absolute;
    inset: 50%;
    transform: translate(-50%, -50%);
    width: 100%;
    height: 100%;
    border-radius: 50%;
    border: 2px solid rgba($color-primary-light, 0.34);
    box-shadow: 0 0 2rem rgba($color-primary, 0.18);
    animation: boot-spin 5s linear infinite;
  }

  &__ring--inner {
    position: absolute;
    inset: 50%;
    transform: translate(-50%, -50%);
    width: 68%;
    height: 68%;
    border-radius: 50%;
    border: 2px dashed rgba($color-accent, 0.55);
    animation: boot-spin-reverse 3.5s linear infinite;
  }

  &__core {
    position: absolute;
    inset: 50%;
    transform: translate(-50%, -50%);
    width: 22%;
    height: 22%;
    border-radius: 50%;
    background: radial-gradient(circle, rgba($color-accent, 0.95), rgba($color-primary, 0.9));
    box-shadow: 0 0 1.5rem rgba($color-accent, 0.45);
    animation: boot-pulse 1.8s ease-in-out infinite;
  }

  &__meter {
    position: relative;
    overflow: hidden;
    height: 0.45rem;
    border-radius: $border-radius-full;
    background: rgba(255, 255, 255, 0.08);
  }

  &__meter-fill {
    position: absolute;
    inset: 0;
    width: 42%;
    border-radius: inherit;
    background: linear-gradient(90deg, rgba($color-primary-light, 0.2), rgba($color-accent, 0.95), rgba($color-secondary, 0.5));
    box-shadow: 0 0 1.5rem rgba($color-accent, 0.35);
    animation: boot-meter 1.8s ease-in-out infinite;
  }
}

.app-boot-enter-active,
.app-boot-leave-active {
  transition: opacity 220ms ease;
}

.app-boot-enter-from,
.app-boot-leave-to {
  opacity: 0;
}

@keyframes boot-spin {
  from { transform: translate(-50%, -50%) rotate(0deg); }
  to { transform: translate(-50%, -50%) rotate(360deg); }
}

@keyframes boot-spin-reverse {
  from { transform: translate(-50%, -50%) rotate(360deg); }
  to { transform: translate(-50%, -50%) rotate(0deg); }
}

@keyframes boot-pulse {
  0%, 100% { transform: translate(-50%, -50%) scale(0.92); opacity: 0.85; }
  50% { transform: translate(-50%, -50%) scale(1.08); opacity: 1; }
}

@keyframes boot-drift {
  0%, 100% { transform: translate3d(0, 0, 0); }
  50% { transform: translate3d(2.5rem, 2rem, 0); }
}

@keyframes boot-drift-alt {
  0%, 100% { transform: translate3d(0, 0, 0); }
  50% { transform: translate3d(-2rem, -2.5rem, 0); }
}

@keyframes boot-meter {
  0% { transform: translateX(-120%); }
  100% { transform: translateX(340%); }
}

@media (max-width: $breakpoint-sm) {
  .app-boot {
    &__panel {
      width: min(calc(100vw - $spacing-6 * 2), 18rem);
      padding: $spacing-4;
    }

    &__sigil {
      width: 5.5rem;
      height: 5.5rem;
    }
  }
}
</style>
