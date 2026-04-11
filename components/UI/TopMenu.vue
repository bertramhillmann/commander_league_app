<template>
  <nav class="top-menu" aria-label="Primary">
    <NuxtLink
      v-for="item in items"
      :key="item.to"
      :to="item.to"
      class="top-menu__link"
      :class="{ 'top-menu__link--active': isActive(item) }"
    >
      {{ item.label }}
    </NuxtLink>
  </nav>
</template>

<script setup lang="ts">
const route = useRoute()

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
</script>

<style lang="scss" scoped>
.top-menu {
  position: sticky;
  top: 0;
  z-index: 40;
  display: flex;
  justify-content: center;
  flex-wrap: wrap;
  gap: $spacing-2;
  padding: $spacing-3 $spacing-6;
  margin-bottom: $spacing-6;
  background:
    linear-gradient(180deg, rgba($color-bg, 0.96), rgba($color-bg, 0.9)),
    rgba($color-bg, 0.92);
  border-bottom: 1px solid rgba($border-color, 0.82);
  backdrop-filter: blur(12px);
}

.top-menu__link {
  display: inline-flex;
  align-items: center;
  padding: 7px 12px;
  border-radius: $border-radius-full;
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
    color: $color-text;
    border-color: rgba($color-primary, 0.4);
    background: rgba($color-bg-elevated, 0.78);
  }

  &--active {
    color: $color-primary-light;
    border-color: rgba($color-primary, 0.5);
    background: rgba($color-primary, 0.14);
  }
}

@media (max-width: 720px) {
  .top-menu {
    padding: $spacing-3 $spacing-4;
    gap: $spacing-1;
  }

  .top-menu__link {
    padding: 6px 10px;
    font-size: 10px;
  }
}
</style>
