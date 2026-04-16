<template>
  <nav class="top-menu" aria-label="Primary">
    <!-- Desktop nav links -->
    <div class="top-menu__links">
      <NuxtLink
        v-for="item in items"
        :key="item.to"
        :to="item.to"
        class="top-menu__link"
        :class="{ 'top-menu__link--active': isActive(item) }"
      >
        {{ item.label }}
      </NuxtLink>
    </div>

    <!-- Desktop auth -->
    <div class="top-menu__auth">
      <div v-if="user" class="top-menu__user">
        <img
          v-if="userImageUrl"
          :src="userImageUrl"
          :alt="user"
          class="top-menu__user-avatar"
        />
        <span class="top-menu__user-name">{{ user }}</span>
      </div>
      <NuxtLink
        v-if="isAdmin"
        to="/admin/createGame"
        class="top-menu__link"
        :class="{ 'top-menu__link--active': route.path === '/admin/createGame' }"
      >
        Create Game
      </NuxtLink>
      <button type="button" class="top-menu__logout" @click="signOut">Logout</button>
    </div>

    <!-- Mobile: compact header row (avatar + name + hamburger) -->
    <div class="top-menu__mobile-bar">
      <div v-if="user" class="top-menu__user">
        <img
          v-if="userImageUrl"
          :src="userImageUrl"
          :alt="user"
          class="top-menu__user-avatar"
        />
        <span class="top-menu__user-name">{{ user }}</span>
      </div>
      <button
        type="button"
        class="top-menu__hamburger"
        :aria-expanded="menuOpen"
        aria-label="Toggle navigation"
        @click="menuOpen = !menuOpen"
      >
        <span class="top-menu__hamburger-line" :class="{ 'top-menu__hamburger-line--open-1': menuOpen }" />
        <span class="top-menu__hamburger-line" :class="{ 'top-menu__hamburger-line--open-2': menuOpen }" />
        <span class="top-menu__hamburger-line" :class="{ 'top-menu__hamburger-line--open-3': menuOpen }" />
      </button>
    </div>

    <!-- Mobile dropdown drawer (full-width, flex-basis 100%) -->
    <div v-show="menuOpen" class="top-menu__drawer">
      <NuxtLink
        v-for="item in items"
        :key="item.to"
        :to="item.to"
        class="top-menu__drawer-link"
        :class="{ 'top-menu__drawer-link--active': isActive(item) }"
        @click="menuOpen = false"
      >
        {{ item.label }}
      </NuxtLink>
      <NuxtLink
        v-if="isAdmin"
        to="/admin/createGame"
        class="top-menu__drawer-link"
        :class="{ 'top-menu__drawer-link--active': route.path === '/admin/createGame' }"
        @click="menuOpen = false"
      >
        Create Game
      </NuxtLink>
      <div class="top-menu__drawer-divider" />
      <button type="button" class="top-menu__drawer-logout" @click="() => { signOut(); menuOpen = false }">
        Logout
      </button>
    </div>
  </nav>
</template>

<script setup lang="ts">
const route = useRoute()
const { user, isAdmin, logout } = useAuth()

const menuOpen = ref(false)

// Close drawer on route change
watch(() => route.path, () => { menuOpen.value = false })

const playerImages = import.meta.glob('../../assets/img/*.png', { eager: true, import: 'default' }) as Record<string, string>

const userImageUrl = computed(() => {
  if (!user.value) return null
  const key = `../../assets/img/${user.value.toLowerCase()}.png`
  return playerImages[key] ?? null
})

const items = [
  { label: 'Dashboard', to: '/dashboard', match: ['/dashboard'] },
  { label: 'Games', to: '/games', match: ['/games', '/gameList'] },
  { label: 'Players', to: '/players', match: ['/players'] },
  { label: 'Commanders', to: '/commanders', match: ['/commanders'] },
  { label: 'Achievements', to: '/achievements', match: ['/achievements'] },
  { label: 'Shop', to: '/shop', match: ['/shop'] },
] as const

function isActive(item: (typeof items)[number]) {
  return item.match.some((prefix) => route.path === prefix || route.path.startsWith(`${prefix}/`))
}

async function signOut() {
  await logout()
  await navigateTo('/login')
}
</script>

<style lang="scss" scoped>
.top-menu {
  position: sticky;
  top: 0;
  z-index: 40;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: $spacing-2;
  padding: $spacing-3 $spacing-6;
  margin-bottom: $spacing-6;
  background: rgba($color-bg, 0.92);
  border-bottom: 1px solid rgba($border-color, 0.82);
  backdrop-filter: blur(12px);
  overflow: hidden;

  &::before {
    content: '';
    position: absolute;
    inset: 0;
    z-index: -1;
    background: url('/assets/img/xp_texture.jpg') center / cover no-repeat;
    opacity: 0.18;
    filter: grayscale(60%) contrast(140%) brightness(35%);
    pointer-events: none;
  }
}

.top-menu__links {
  display: flex;
  justify-content: center;
  flex-wrap: wrap;
  gap: $spacing-2;
}

.top-menu__link {
  display: inline-flex;
  align-items: center;
  padding: 7px 12px;
  border-radius: $border-radius-md;
  border: 1px solid rgba($border-color, 0.75);
  background: rgba($color-bg-card, 0.52);
  color: $color-text-muted;
  text-decoration: none;
  font-size: $font-size-xs;
  font-weight: $font-weight-semibold;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  transition: color $transition-fast, border-color $transition-fast, background $transition-fast;

  &:hover {
    color: $color-accent;
    border-color: rgba($color-accent, 0.4);
    background: rgba($color-bg-elevated, 0.78);
  }

  &--active {
    color: $color-accent;
    border-color: rgba($color-accent, 0.6);
    background: rgba($color-accent, 0.12);
    box-shadow: 0 0 10px rgba($color-accent, 0.25), inset 0 0 6px rgba($color-accent, 0.08);
  }
}

.top-menu__auth {
  display: inline-flex;
  align-items: center;
  gap: $spacing-2;
}

.top-menu__user {
  display: inline-flex;
  align-items: center;
  gap: $spacing-2;
}

.top-menu__user-avatar {
  width: 36px;
  height: 36px;
  border-radius: $border-radius-sm;
  object-fit: cover;
  object-position: center top;
  border: 1px solid rgba($color-accent, 0.45);
}

.top-menu__user-name {
  color: $color-accent;
  font-size: $font-size-xs;
  font-weight: $font-weight-bold;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  text-shadow: 0 0 12px rgba($color-accent, 0.35);
}

.top-menu__logout {
  appearance: none;
  display: inline-flex;
  align-items: center;
  padding: 7px 12px;
  border-radius: $border-radius-md;
  border: 1px solid rgba($border-color, 0.75);
  background: rgba($color-bg-card, 0.52);
  color: $color-text-muted;
  font: inherit;
  font-size: $font-size-xs;
  font-weight: $font-weight-semibold;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  cursor: pointer;
  transition: color $transition-fast, border-color $transition-fast, background $transition-fast;

  &:hover {
    color: $color-text;
    border-color: rgba($color-primary, 0.4);
    background: rgba($color-bg-elevated, 0.78);
  }
}

// ── Mobile hamburger (hidden on desktop) ──────────────────────────────────────

.top-menu__mobile-bar {
  display: none;
}

.top-menu__hamburger {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 5px;
  padding: 8px;
  background: transparent;
  border: 1px solid rgba($border-color, 0.75);
  border-radius: $border-radius-md;
  cursor: pointer;
}

.top-menu__hamburger-line {
  display: block;
  width: 20px;
  height: 2px;
  background: $color-text-muted;
  border-radius: 2px;
  transition: transform $transition-fast, opacity $transition-fast;

  &--open-1 { transform: translateY(7px) rotate(45deg); }
  &--open-2 { opacity: 0; }
  &--open-3 { transform: translateY(-7px) rotate(-45deg); }
}

.top-menu__drawer {
  display: none; // only shown on mobile via media query below
}

// ── Tablet: shrink links ───────────────────────────────────────────────────────

@media (max-width: 720px) {
  .top-menu {
    padding: $spacing-3 $spacing-4;
    gap: $spacing-1;
    justify-content: center;
  }

  .top-menu__link {
    padding: 6px 10px;
    font-size: 10px;
  }

  .top-menu__links {
    justify-content: center;
  }
}

// ── Mobile: hamburger menu ─────────────────────────────────────────────────────

@media (max-width: 540px) {
  .top-menu {
    flex-wrap: wrap;
    justify-content: space-between;
    padding: $spacing-2 $spacing-3;
    gap: 0;
  }

  // Hide desktop links and auth on mobile
  .top-menu__links {
    display: none;
  }

  .top-menu__auth {
    display: none;
  }

  // Show mobile bar
  .top-menu__mobile-bar {
    display: flex;
    width: 100%;
    align-items: center;
    justify-content: space-between;
    gap: $spacing-2;
  }

  // Show drawer (takes full width via flex-basis 100%)
  .top-menu__drawer {
    display: flex;
    flex-direction: column;
    width: 100%;
    padding: $spacing-2 0;
    border-top: 1px solid rgba($border-color, 0.5);
    margin-top: $spacing-2;
    gap: $spacing-1;
  }

  .top-menu__drawer-link {
    display: block;
    padding: 10px $spacing-3;
    border-radius: $border-radius-md;
    color: $color-text-muted;
    font-size: $font-size-sm;
    font-weight: $font-weight-semibold;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    text-decoration: none;
    transition: color $transition-fast, background $transition-fast;

    &:hover {
      color: $color-accent;
      background: rgba($color-bg-elevated, 0.6);
    }

    &--active {
      color: $color-accent;
      background: rgba($color-accent, 0.1);
    }
  }

  .top-menu__drawer-divider {
    height: 1px;
    background: rgba($border-color, 0.5);
    margin: $spacing-1 0;
  }

  .top-menu__drawer-logout {
    appearance: none;
    display: block;
    width: 100%;
    text-align: left;
    padding: 10px $spacing-3;
    border: 0;
    border-radius: $border-radius-md;
    background: transparent;
    color: $color-text-muted;
    font: inherit;
    font-size: $font-size-sm;
    font-weight: $font-weight-semibold;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    cursor: pointer;
    transition: color $transition-fast, background $transition-fast;

    &:hover {
      color: $color-text;
      background: rgba($color-bg-elevated, 0.6);
    }
  }
}
</style>
