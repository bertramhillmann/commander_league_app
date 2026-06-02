<template>
  <div class="page page--mmr-pod-finder">
    <div class="page-inner">
      <header class="finder-head">
        <div>
          <div class="finder-head__eyebrow">Matchmaking</div>
          <h1 class="finder-head__title">Pod Finder</h1>
          <p class="finder-head__subtitle">
            Build balanced pods from current commander ratings, swap decks freely, preview each placement outcome, and create the game directly when you are ready.
          </p>
        </div>
      </header>

      <GamesGameMatchMaking allow-create :show-header="false" />
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ middleware: [] })
</script>

<style lang="scss" scoped>
.page-inner {
  max-width: 1240px;
  margin: 0 auto;
  padding: 0 24px 40px;
}

.finder-head {
  margin-bottom: 24px;

  &__eyebrow {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.16em;
    color: #c8a96a;
    font-weight: 600;
    margin-bottom: 8px;
  }

  &__title {
    margin: 0;
    font-size: clamp(2rem, 3vw, 2.5rem);
    color: #f2d28b;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  &__subtitle {
    margin: 8px 0 0;
    max-width: 760px;
    color: rgba(255, 255, 255, 0.72);
    line-height: 1.6;
  }
}
</style>
