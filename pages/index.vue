<template>
  <div class="home">
    <header class="home__header">
      <h1 class="home__title">Commander App</h1>
      <p class="home__subtitle">Track your league, commanders & glory</p>
    </header>

    <nav class="home__nav">
      <NuxtLink to="/gameList" class="nav-card">
        <span class="nav-card__icon">🎮</span>
        <span class="nav-card__label">Games</span>
      </NuxtLink>
      <NuxtLink to="/dashboard" class="nav-card">
        <span class="nav-card__icon">📊</span>
        <span class="nav-card__label">Dashboard</span>
      </NuxtLink>
      <NuxtLink to="/achievements" class="nav-card">
        <span class="nav-card__icon">🏆</span>
        <span class="nav-card__label">Achievements</span>
      </NuxtLink>
      <NuxtLink to="/shop" class="nav-card">
        <span class="nav-card__icon">🛒</span>
        <span class="nav-card__label">Shop</span>
      </NuxtLink>
    </nav>

    <div class="home__admin">
      <NuxtLink to="/admin/login" class="admin-link">Admin</NuxtLink>
    </div>
  </div>
</template>

<script setup lang="ts">
</script>

<style lang="scss" scoped>
.home {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: $spacing-12;
  padding: $spacing-8;

  &__header {
    text-align: center;
  }

  &__title {
    font-size: $font-size-4xl;
    color: $color-primary-light;
    text-shadow: $shadow-glow-primary;
    margin-bottom: $spacing-2;
  }

  &__subtitle {
    color: $color-text-muted;
    font-size: $font-size-lg;
  }

  &__nav {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: $spacing-4;
    width: 100%;
    max-width: 480px;
  }

  &__admin {
    margin-top: $spacing-4;
  }
}

.nav-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: $spacing-2;
  padding: $spacing-8 $spacing-4;
  background: $color-bg-card;
  border: 1px solid $border-color;
  border-radius: $border-radius-xl;
  text-decoration: none;
  color: $color-text;
  transition: border-color $transition-fast, background $transition-fast, box-shadow $transition-fast;

  &:hover {
    border-color: $color-primary;
    background: $color-bg-elevated;
    box-shadow: $shadow-glow-primary;
    color: $color-text;
  }

  &__icon {
    font-size: 2rem;
  }

  &__label {
    font-size: $font-size-sm;
    font-weight: $font-weight-semibold;
    letter-spacing: 0.05em;
    text-transform: uppercase;
  }
}

.admin-link {
  font-size: $font-size-xs;
  color: $color-text-muted;
  text-decoration: none;
  letter-spacing: 0.1em;
  text-transform: uppercase;

  &:hover {
    color: $color-text;
  }
}
</style>
