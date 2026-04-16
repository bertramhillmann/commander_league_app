<template>
  <div class="page page--achievements">
    <header class="achievements-page__header">
      <p class="achievements-page__eyebrow">Commander League Collection</p>
      <h1 class="achievements-page__title">Achievements</h1>
      <p class="achievements-page__subtitle">
        <template v-if="activePlayer">
          A clean overview of what you can still unlock, what you already claimed, and what your commanders have achieved.
        </template>
        <template v-else>
          Browse the full achievement list, sorted from lower rarity up to mythic.
        </template>
      </p>
    </header>

    <div v-if="activePlayer" class="achievement-sections">
      <section
        v-for="section in playerSections"
        :key="section.id"
        class="achievement-section"
      >
        <div class="achievement-section__header">
          <div>
            <h2 class="achievement-section__title">{{ section.title }}</h2>
            <p class="achievement-section__description">{{ section.description }}</p>
          </div>
          <span class="achievement-section__count">{{ section.items.length }}</span>
        </div>

        <div v-if="section.items.length > 0" class="achievements-grid achievements-grid--compact">
          <div
            v-for="item in section.items"
            :key="`${section.id}-${item.def.id}`"
            class="achievement-card"
            :class="[
              `achievement-card--${item.def.scope}`,
              `achievement-card--${item.status}`,
              `achievement-card--rarity-${item.def.rarity}`,
            ]"
            @mouseenter="onEnter(item.def.id, $event)"
            @mousemove="onMove($event)"
            @mouseleave="onLeave($event)"
          >
            <div class="achievement-card__inner">
              <div class="achievement-card__glow" />

              <div class="achievement-card__top">
                <span class="achievement-card__scope">{{ item.def.scope }}</span>
                <span class="achievement-card__rarity">{{ getRarityLabel(item.def.rarity) }}</span>
              </div>

              <div class="achievement-card__main">
                <span class="achievement-card__icon">{{ item.def.icon }}</span>
                <div class="achievement-card__text">
                  <h3 class="achievement-card__name">{{ item.def.name }}</h3>
                  <p class="achievement-card__description">{{ item.def.description }}</p>
                </div>
              </div>

              <div class="achievement-card__footer">
                <span class="achievement-card__points">{{ formatPoints(item.def.points) }} pts</span>
                <span class="achievement-card__status">{{ item.label }}</span>
              </div>

              <p v-if="item.detail" class="achievement-card__detail">{{ item.detail }}</p>

              <div v-if="item.commanders?.length" class="achievement-card__chips">
                <span
                  v-for="commander in item.commanders"
                  :key="`${item.def.id}-${commander}`"
                  class="achievement-card__chip"
                >
                  {{ commander }}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div v-else class="achievement-section__empty">
          Nothing in this group right now.
        </div>
      </section>
    </div>

    <div v-else class="achievements-grid achievements-grid--compact">
      <div
        v-for="def in allAchievements"
        :key="def.id"
        class="achievement-card"
        :class="[
          `achievement-card--${def.scope}`,
          `achievement-card--rarity-${def.rarity}`,
        ]"
        @mouseenter="onEnter(def.id, $event)"
        @mousemove="onMove($event)"
        @mouseleave="onLeave($event)"
      >
        <div class="achievement-card__inner">
          <div class="achievement-card__glow" />

          <div class="achievement-card__top">
            <span class="achievement-card__scope">{{ def.scope }}</span>
            <span class="achievement-card__rarity">{{ getRarityLabel(def.rarity) }}</span>
          </div>

          <div class="achievement-card__main">
            <span class="achievement-card__icon">{{ def.icon }}</span>
            <div class="achievement-card__text">
              <h3 class="achievement-card__name">{{ def.name }}</h3>
              <p class="achievement-card__description">{{ def.description }}</p>
            </div>
          </div>

          <div class="achievement-card__footer">
            <span class="achievement-card__points">{{ formatPoints(def.points) }} pts</span>
            <span class="achievement-card__status">
              {{ def.repeatable ? 'Repeatable' : 'One-Time' }}
            </span>
          </div>
        </div>
      </div>
    </div>

    <Teleport to="body">
      <div
        v-if="hover.visible"
        class="floating-panel"
        :style="{ top: `${hover.y}px`, left: `${hover.x}px` }"
      >
        <AchievementsAchievementMetaInformation :achievement-id="hover.id" />
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive } from 'vue'
import { formatPlayerName } from '~/utils/playerNames'
import { ACHIEVEMENTS, type AchievementDef, type AchievementRarity, type EarnedAchievement } from '~/utils/achievements'
import { getArchEnemySummary } from '~/utils/archEnemy'

interface SectionItem {
  def: AchievementDef
  status: 'open' | 'earned' | 'repeatable'
  label: string
  detail?: string
  commanders?: string[]
}

interface SectionGroup {
  id: string
  title: string
  description: string
  items: SectionItem[]
}

const { players, games, gameRecords } = useLeagueState()
const { user, ensureSession } = useAuth()

await ensureSession()

const allAchievements = computed(() => sortAchievements(Object.values(ACHIEVEMENTS)))

const normalizedUserName = computed(() => (user.value ? formatPlayerName(user.value) : null))
const activePlayer = computed(() =>
  normalizedUserName.value ? players.value[normalizedUserName.value] ?? null : null,
)

const activePlayerCommanders = computed(() =>
  Object.keys(activePlayer.value?.commanderXP ?? {}).sort((a, b) => a.localeCompare(b)),
)

const currentWeekAbs = computed(() => absWeek(new Date()))

const gameWeekById = computed(() => {
  const map = new Map<string, number>()
  for (const game of games.value) {
    map.set(game.gameId, absWeek(new Date(game.date)))
  }
  return map
})

const earnedById = computed(() => {
  const map = new Map<string, EarnedAchievement[]>()
  for (const earned of activePlayer.value?.earnedAchievements ?? []) {
    const list = map.get(earned.id) ?? []
    list.push(earned)
    map.set(earned.id, list)
  }
  return map
})

const earnedThisWeek = computed(() => {
  const ids = new Set<string>()
  for (const earned of activePlayer.value?.earnedAchievements ?? []) {
    const week = gameWeekById.value.get(earned.gameId)
    if (week === currentWeekAbs.value) ids.add(earned.id)
  }
  return ids
})

const activePlayerArchEnemy = computed(() => {
  if (!activePlayer.value) return null
  return getArchEnemySummary(activePlayer.value.name, games.value, gameRecords.value)
})

const playerSections = computed<SectionGroup[]>(() => {
  if (!activePlayer.value) return []

  const defs = allAchievements.value
  const playerRepeatable = defs.filter((def) => def.scope === 'player' && def.repeatable)
  const playerOnce = defs.filter((def) => def.scope === 'player' && !def.repeatable)
  const commanderOnce = defs.filter((def) => def.scope === 'commander' && !def.repeatable)
  const commanderRepeatable = defs.filter((def) => def.scope === 'commander' && def.repeatable)

  const availableThisWeek = playerRepeatable
    .filter((def) => !earnedThisWeek.value.has(def.id))
    .map((def) => buildItem(def, 'open', 'Available this week', getRepeatablePlayerDetail(def.id)))

  const claimedThisWeek = playerRepeatable
    .filter((def) => earnedThisWeek.value.has(def.id))
    .map((def) => {
      const count = countCurrentWeekEarns(def.id)
      return buildItem(
        def,
        'earned',
        'Claimed this week',
        getClaimedRepeatablePlayerDetail(def.id, count),
      )
    })

  const playerUnlocked = playerOnce
    .filter((def) => hasEarned(def.id))
    .map((def) => buildItem(def, 'earned', 'Unlocked'))

  const playerOpen = playerOnce
    .filter((def) => !hasEarned(def.id))
    .map((def) => buildItem(def, 'open', 'Still available'))

  const commanderUnlocked = commanderOnce
    .filter((def) => hasEarned(def.id))
    .map((def) => {
      const commanders = uniqueCommandersFor(def.id)
      const detail = commanders.length === 1
        ? 'Unlocked on 1 commander.'
        : `Unlocked on ${commanders.length} commanders.`
      return buildItem(def, 'earned', 'Unlocked', detail, commanders)
    })

  const commanderOpen = commanderOnce
    .filter((def) => !hasEarned(def.id))
    .map((def) => {
      const detail = activePlayerCommanders.value.length > 0
        ? `Not unlocked on any of your ${activePlayerCommanders.value.length} commanders yet.`
        : 'Play a commander to start unlocking commander achievements.'
      return buildItem(def, 'open', 'Still available', detail)
    })

  const commanderRepeatableAvailable: SectionItem[] = []
  const commanderRepeatableClaimed: SectionItem[] = []

  for (const def of commanderRepeatable) {
    const totalEarned = countEarns(def.id)
    const earnedThisWeekAlready = earnedThisWeek.value.has(def.id)
    if (totalEarned > 0 && earnedThisWeekAlready) {
      const commanders = uniqueCommandersFor(def.id)
      const detail = `Earned ${totalEarned} time${totalEarned === 1 ? '' : 's'} so far. Available again next week.`
      commanderRepeatableClaimed.push(buildItem(def, 'earned', 'Claimed this week', detail, commanders))
    } else if (totalEarned > 0) {
      const commanders = uniqueCommandersFor(def.id)
      const detail = `Earned ${totalEarned} time${totalEarned === 1 ? '' : 's'} so far. Still available this week.`
      commanderRepeatableAvailable.push(buildItem(def, 'repeatable', 'Available this week', detail, commanders))
    } else {
      commanderRepeatableAvailable.push(buildItem(def, 'repeatable', 'Available this week', 'Still available on your commanders.'))
    }
  }

  return [
    {
      id: 'week-open',
      title: 'This Week',
      description: 'Repeatable achievements you can still claim in the current calendar week.',
      items: [...availableThisWeek, ...commanderRepeatableAvailable],
    },
    {
      id: 'week-earned',
      title: 'Claimed This Week',
      description: 'Repeatable achievements you already picked up this week.',
      items: [...claimedThisWeek, ...commanderRepeatableClaimed],
    },
    {
      id: 'player-open',
      title: 'Player Achievements Still Available',
      description: 'One-time player milestones you have not unlocked yet.',
      items: playerOpen,
    },
    {
      id: 'player-earned',
      title: 'Player Achievements Unlocked',
      description: 'One-time player milestones you already secured.',
      items: playerUnlocked,
    },
    {
      id: 'commander-earned',
      title: 'Commander Achievements Unlocked',
      description: 'One-time commander achievements already earned by at least one of your commanders.',
      items: commanderUnlocked,
    },
    {
      id: 'commander-open',
      title: 'Commander Achievements Still Available',
      description: 'One-time commander achievements none of your commanders have unlocked yet.',
      items: commanderOpen,
    },
  ]
})

const OFFSET_X = 16
const OFFSET_Y = 16
const MAX_ROTATE = 7

const hover = reactive({ visible: false, id: '', x: 0, y: 0 })
let activeCard: HTMLElement | null = null
let pendingEvent: MouseEvent | null = null
let frameId = 0

function sortAchievements(defs: AchievementDef[]) {
  return [...defs].sort((a, b) => {
    const rarityDiff = getRarityRank(a.rarity) - getRarityRank(b.rarity)
    if (rarityDiff !== 0) return rarityDiff

    const pointDiff = a.points - b.points
    if (pointDiff !== 0) return pointDiff

    return a.name.localeCompare(b.name)
  })
}

function formatPoints(value: number): string {
  return value % 1 === 0 ? String(value) : value.toFixed(2).replace(/\.?0+$/, '')
}

function getRarityRank(rarity: AchievementRarity) {
  return {
    common: 1,
    uncommon: 2,
    rare: 3,
    mythic: 4,
  }[rarity]
}

function getRarityLabel(rarity: AchievementRarity) {
  return {
    common: 'Common',
    uncommon: 'Uncommon',
    rare: 'Rare',
    mythic: 'Mythic',
  }[rarity]
}

function buildItem(
  def: AchievementDef,
  status: SectionItem['status'],
  label: string,
  detail?: string,
  commanders?: string[],
): SectionItem {
  return { def, status, label, detail, commanders }
}

function hasEarned(id: string) {
  return (earnedById.value.get(id)?.length ?? 0) > 0
}

function countEarns(id: string) {
  return earnedById.value.get(id)?.length ?? 0
}

function countCurrentWeekEarns(id: string) {
  return (earnedById.value.get(id) ?? []).filter(
    (earned) => gameWeekById.value.get(earned.gameId) === currentWeekAbs.value,
  ).length
}

function getRepeatablePlayerDetail(id: string) {
  if (id !== 'beat_arch_enemy') return undefined

  const archEnemy = activePlayerArchEnemy.value
  if (!archEnemy?.enemyName || !archEnemy.matchup) {
    return 'No active arch enemy right now. Lose a few tracked games to the same player first.'
  }

  const losses = archEnemy.matchup.losses
  return `Current arch enemy: ${archEnemy.enemyName} (${losses} tracked loss${losses === 1 ? '' : 'es'}). Beat them in a game this week to claim it.`
}

function getClaimedRepeatablePlayerDetail(id: string, count: number) {
  if (id === 'beat_arch_enemy') {
    const archEnemy = activePlayerArchEnemy.value
    const currentTarget = archEnemy?.enemyName
      ? ` Current target: ${archEnemy.enemyName}.`
      : ''
    return `${count > 1 ? `Recorded ${count} times this week.` : 'Already earned in the current calendar week.'}${currentTarget}`
  }

  return count > 1 ? `Recorded ${count} times this week.` : 'Already earned in the current calendar week.'
}

function uniqueCommandersFor(id: string) {
  return Array.from(
    new Set(
      (earnedById.value.get(id) ?? [])
        .map((earned) => earned.commander)
        .filter((value): value is string => Boolean(value)),
    ),
  ).sort((a, b) => a.localeCompare(b))
}

function calcPosition(e: MouseEvent) {
  let x = e.clientX + OFFSET_X
  let y = e.clientY + OFFSET_Y
  if (x + 220 > window.innerWidth) x = e.clientX - 220 - OFFSET_X
  if (y + 200 > window.innerHeight) y = e.clientY - 200 - OFFSET_Y
  return { x: x + window.scrollX, y: y + window.scrollY }
}

function updateTilt(card: HTMLElement, e: MouseEvent) {
  const inner = card.querySelector('.achievement-card__inner') as HTMLElement | null
  if (!inner) return

  const rect = card.getBoundingClientRect()
  const x = (e.clientX - rect.left) / rect.width
  const y = (e.clientY - rect.top) / rect.height
  const rotateY = (x - 0.5) * MAX_ROTATE * 2
  const rotateX = (0.5 - y) * MAX_ROTATE * 2

  inner.style.setProperty('--rx', `${rotateX.toFixed(2)}deg`)
  inner.style.setProperty('--ry', `${rotateY.toFixed(2)}deg`)
  inner.style.setProperty('--glow-x', `${(x * 100).toFixed(2)}%`)
  inner.style.setProperty('--glow-y', `${(y * 100).toFixed(2)}%`)
}

function flushTilt() {
  frameId = 0
  if (!activeCard || !pendingEvent) return
  updateTilt(activeCard, pendingEvent)
}

function scheduleTilt(card: HTMLElement, e: MouseEvent) {
  activeCard = card
  pendingEvent = e
  if (frameId) return
  frameId = requestAnimationFrame(flushTilt)
}

function resetTilt(card: HTMLElement) {
  const inner = card.querySelector('.achievement-card__inner') as HTMLElement | null
  if (!inner) return

  inner.style.setProperty('--rx', '0deg')
  inner.style.setProperty('--ry', '0deg')
  inner.style.setProperty('--glow-x', '50%')
  inner.style.setProperty('--glow-y', '50%')
}

function onEnter(id: string, e: MouseEvent) {
  const card = e.currentTarget as HTMLElement | null
  if (card) scheduleTilt(card, e)

  hover.id = id
  hover.visible = true
  Object.assign(hover, calcPosition(e))
}

function onMove(e: MouseEvent) {
  const card = e.currentTarget as HTMLElement | null
  if (card) scheduleTilt(card, e)

  if (!hover.visible) return
  Object.assign(hover, calcPosition(e))
}

function onLeave(e: MouseEvent) {
  const card = e.currentTarget as HTMLElement | null
  if (frameId) {
    cancelAnimationFrame(frameId)
    frameId = 0
  }
  pendingEvent = null
  activeCard = null
  if (card) resetTilt(card)
  hover.visible = false
}

function isoWeek(date: Date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7))
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7)
}

function absWeek(date: Date) {
  return date.getUTCFullYear() * 53 + isoWeek(date)
}
</script>

<style lang="scss" scoped>
.page--achievements {
  padding-top: $spacing-8;
}

.achievements-page {
  &__header {
    margin-bottom: $spacing-6;
  }

  &__eyebrow {
    margin-bottom: $spacing-2;
    font-size: 10px;
    font-weight: $font-weight-semibold;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: rgba($color-primary-light, 0.78);
  }

  &__title {
    margin: 0;
    font-size: clamp(1.8rem, 3vw, 2.4rem);
    line-height: 1.05;
    text-transform: none;
    font-family: $font-family-base;
  }

  &__subtitle {
    max-width: 760px;
    margin-top: $spacing-3;
    color: rgba($color-text-muted, 0.95);
    font-size: $font-size-sm;
    line-height: 1.5;
  }
}

.achievement-sections {
  display: flex;
  flex-direction: column;
  gap: $spacing-6;
}

.achievement-section {
  padding: $spacing-4;
  border: 1px solid rgba($border-color, 0.8);
  border-radius: $border-radius-lg;
  background: rgba(8, 10, 16, 0.42);

  &__header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: $spacing-3;
    margin-bottom: $spacing-4;
  }

  &__title {
    margin: 0;
    font-size: $font-size-lg;
    line-height: 1.2;
    text-transform: none;
  }

  &__description {
    margin-top: $spacing-1;
    color: rgba($color-text-muted, 0.92);
    font-size: $font-size-sm;
    line-height: 1.45;
  }

  &__count {
    flex-shrink: 0;
    min-width: 34px;
    padding: 4px 10px;
    border-radius: $border-radius-full;
    border: 1px solid rgba($color-primary-light, 0.18);
    background: rgba($color-primary, 0.12);
    color: $color-text;
    font-size: 11px;
    font-weight: $font-weight-semibold;
    text-align: center;
  }

  &__empty {
    padding: $spacing-4;
    border-radius: $border-radius-md;
    background: rgba(255, 255, 255, 0.03);
    color: $color-text-muted;
    font-size: $font-size-sm;
  }
}

.achievements-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
  gap: $spacing-3;

  &--compact {
    grid-template-columns: repeat(auto-fit, minmax(190px, 220px));
  }
}

@keyframes mythic-shimmer {
  0%   { transform: translateX(-120%) skewX(-18deg); opacity: 0; }
  15%  { opacity: 1; }
  85%  { opacity: 1; }
  100% { transform: translateX(220%) skewX(-18deg); opacity: 0; }
}

@keyframes mythic-pulse {
  0%, 100% { box-shadow: 0 14px 30px rgba(0, 0, 0, 0.3), 0 0 18px rgba(255, 130, 40, 0.22); }
  50%       { box-shadow: 0 14px 30px rgba(0, 0, 0, 0.3), 0 0 30px rgba(255, 150, 60, 0.38); }
}

.achievement-card {
  perspective: 1000px;

  &__inner {
    --rx: 0deg;
    --ry: 0deg;
    --glow-x: 50%;
    --glow-y: 50%;
    --rarity-stripe: rgba(200, 195, 185, 0.25);
    --rarity-glow: rgba(200, 195, 185, 0.08);
    position: relative;
    min-height: 214px;
    display: flex;
    flex-direction: column;
    gap: $spacing-2;
    padding: $spacing-3;
    padding-top: calc(#{$spacing-3} + 3px);
    border-radius: 16px;
    overflow: hidden;
    border: 1px solid rgba(255, 255, 255, 0.08);
    background:
      linear-gradient(180deg, rgba(13, 16, 23, 0.97), rgba(10, 12, 18, 0.97));
    box-shadow: 0 12px 26px rgba(0, 0, 0, 0.24);
    transform: rotateX(var(--rx)) rotateY(var(--ry));
    transform-style: preserve-3d;
    transition: transform 90ms linear, box-shadow 200ms ease, border-color 200ms ease;
    will-change: transform;
    backface-visibility: hidden;

    &::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 3px;
      background: var(--rarity-stripe);
      z-index: 3;
      pointer-events: none;
    }
  }

  &:hover .achievement-card__inner {
    box-shadow: 0 18px 34px rgba(0, 0, 0, 0.32);
    border-color: rgba($color-primary-light, 0.24);
  }

  &__glow {
    position: absolute;
    inset: 0;
    background:
      radial-gradient(circle at var(--glow-x) var(--glow-y), var(--rarity-glow), transparent 32%),
      linear-gradient(135deg, rgba(255, 255, 255, 0.03), transparent 42%);
    pointer-events: none;
    opacity: 0.9;
  }

  &__top,
  &__main,
  &__footer,
  &__detail,
  &__chips {
    position: relative;
    z-index: 1;
    transform: translateZ(18px);
  }

  &__top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: $spacing-2;
  }

  &__scope,
  &__status {
    font-size: 10px;
    font-weight: $font-weight-semibold;
    letter-spacing: 0.07em;
    text-transform: uppercase;
  }

  &__rarity {
    font-size: 10px;
    font-weight: $font-weight-semibold;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: rgba($color-text, 0.9);
  }

  &__scope {
    color: rgba($color-text-muted, 0.88);
  }

  &__main {
    display: flex;
    align-items: flex-start;
    gap: $spacing-2;
    min-height: 92px;
  }

  &__icon {
    flex-shrink: 0;
    width: 42px;
    height: 42px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 12px;
    background: rgba(255, 255, 255, 0.06);
    font-size: 24px;
    line-height: 1;
  }

  &__text {
    min-width: 0;
  }

  &__name {
    margin: 0;
    font-size: 15px;
    line-height: 1.25;
    text-transform: none;
    font-family: $font-family-base;
    color: $color-text;
  }

  &__description {
    margin: $spacing-1 0 0;
    font-size: 12px;
    line-height: 1.45;
    color: rgba($color-text, 0.78);
  }

  &__footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: $spacing-2;
    margin-top: auto;
    padding-top: $spacing-2;
  }

  &__points {
    color: $color-accent;
    font-size: 12px;
    font-weight: $font-weight-bold;
  }

  &__status {
    color: rgba($color-text-muted, 0.92);
  }

  &__detail {
    font-size: 11px;
    line-height: 1.45;
    color: rgba($color-text-muted, 0.9);
  }

  &__chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  &__chip {
    padding: 3px 7px;
    border-radius: $border-radius-full;
    background: rgba($color-primary, 0.12);
    border: 1px solid rgba($color-primary-light, 0.16);
    color: $color-text;
    font-size: 10px;
    line-height: 1.2;
  }

  // ── Status modifiers ───────────────────────────────────────────────────────

  &--open .achievement-card__status {
    color: #9fd6ff;
  }

  &--earned .achievement-card__status {
    color: #9fe0ba;
  }

  &--repeatable .achievement-card__status {
    color: #d9c58f;
  }

  // ── Rarity tiers ──────────────────────────────────────────────────────────

  // Common — stone & parchment
  &--rarity-common .achievement-card__inner {
    --rarity-stripe: #9e9070;
    --rarity-glow: rgba(158, 144, 112, 0.13);
    border-color: rgba(158, 144, 112, 0.2);
    background: linear-gradient(180deg, rgba(18, 16, 12, 0.97), rgba(12, 11, 10, 0.97));
  }

  &--rarity-common .achievement-card__rarity {
    color: #b0a27e;
  }

  // Uncommon — enchanted silver-teal
  &--rarity-uncommon .achievement-card__inner {
    --rarity-stripe: #52c8a8;
    --rarity-glow: rgba(82, 200, 168, 0.16);
    border-color: rgba(82, 200, 168, 0.26);
    background: linear-gradient(160deg, rgba(0, 30, 26, 0.22) 0%, transparent 55%),
      linear-gradient(180deg, rgba(10, 15, 15, 0.97), rgba(9, 12, 12, 0.97));
  }

  &--rarity-uncommon:hover .achievement-card__inner {
    border-color: rgba(82, 200, 168, 0.44);
    box-shadow: 0 18px 34px rgba(0, 0, 0, 0.32), 0 0 14px rgba(82, 200, 168, 0.14);
  }

  &--rarity-uncommon .achievement-card__rarity {
    color: #52c8a8;
  }

  &--rarity-uncommon .achievement-card__icon {
    background: rgba(82, 200, 168, 0.1);
    border: 1px solid rgba(82, 200, 168, 0.15);
  }

  // Rare — arcane purple
  &--rarity-rare .achievement-card__inner {
    --rarity-stripe: #9b6ee8;
    --rarity-glow: rgba(155, 110, 232, 0.22);
    border-color: rgba(155, 110, 232, 0.34);
    background: linear-gradient(155deg, rgba(30, 10, 55, 0.26) 0%, transparent 55%),
      linear-gradient(180deg, rgba(12, 9, 20, 0.97), rgba(10, 8, 17, 0.97));
    box-shadow: 0 12px 26px rgba(0, 0, 0, 0.26), 0 0 0 1px rgba(155, 110, 232, 0.07);
  }

  &--rarity-rare:hover .achievement-card__inner {
    border-color: rgba(155, 110, 232, 0.55);
    box-shadow: 0 18px 34px rgba(0, 0, 0, 0.36), 0 0 22px rgba(155, 110, 232, 0.22);
  }

  &--rarity-rare .achievement-card__rarity {
    color: #9b6ee8;
  }


  &--rarity-rare .achievement-card__icon {
    background: rgba(155, 110, 232, 0.1);
    border: 1px solid rgba(155, 110, 232, 0.18);
  }

  // Mythic — fiery divine gold
  &--rarity-mythic .achievement-card__inner {
    --rarity-stripe: #ff9030;
    --rarity-glow: rgba(255, 138, 40, 0.28);
    border-color: rgba(255, 148, 50, 0.44);
    background: linear-gradient(150deg, rgba(55, 18, 0, 0.28) 0%, rgba(30, 10, 0, 0.12) 50%, transparent 75%),
      linear-gradient(180deg, rgba(15, 10, 7, 0.97), rgba(10, 8, 6, 0.97));
    animation: mythic-pulse 3.2s ease-in-out infinite;

    &::before {
      background: linear-gradient(90deg, #d04010, #ffb830, #ffe870, #ffb830, #d04010);
    }

    &::after {
      content: '';
      position: absolute;
      inset: 0;
      background: linear-gradient(
        105deg,
        transparent 40%,
        rgba(255, 210, 100, 0.07) 50%,
        transparent 60%
      );
      animation: mythic-shimmer 5s ease-in-out infinite;
      pointer-events: none;
      z-index: 2;
    }
  }

  &--rarity-mythic:hover .achievement-card__inner {
    border-color: rgba(255, 158, 60, 0.65);
  }

  &--rarity-mythic .achievement-card__rarity {
    color: #ffaa40;
    text-shadow: 0 0 10px rgba(255, 160, 50, 0.5);
  }

  &--rarity-mythic .achievement-card__name {
    color: #fff0d8;
  }

  &--rarity-mythic .achievement-card__icon {
    background: rgba(220, 110, 20, 0.14);
    border: 1px solid rgba(255, 148, 50, 0.24);
  }

  &--rarity-mythic .achievement-card__points {
    color: #ffb840;
    text-shadow: 0 0 8px rgba(255, 180, 60, 0.4);
  }
}

@media (max-width: $breakpoint-md) {
  .achievement-section {
    padding: $spacing-3;

    &__header {
      flex-direction: column;
    }
  }

  .achievements-grid,
  .achievements-grid--compact {
    grid-template-columns: 1fr;
  }
}
</style>

<style lang="scss">
.floating-panel {
  position: absolute;
  z-index: 9999;
  pointer-events: none;
}
</style>
