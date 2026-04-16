<template>
  <nav class="top-menu" aria-label="Primary">
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
  </nav>
</template>

<script setup lang="ts">
const route = useRoute()
const { user, isAdmin, logout } = useAuth()

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
</style>
