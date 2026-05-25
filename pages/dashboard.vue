<template>
  <div class="page page--dashboard">
    <h1 class="dashboard__title">Standings</h1>

    <div v-if="pageLoading" class="dash-loader" aria-live="polite" aria-busy="true">
      <div class="dash-loader__inner">
        <div class="dash-loader__dots"><span /><span /><span /></div>
        <p class="dash-loader__label">{{ progressLabel }}</p>
        <div class="dash-loader__track">
          <div class="dash-loader__fill" :style="{ width: `${progressPercent}%` }" />
        </div>
      </div>
    </div>

    <template v-else>
    <div class="standings-wrap">
    <table class="standings">
      <thead>
        <tr>
          <th class="standings__th standings__th--rank">#</th>
          <th class="standings__th standings__th--name">Player</th>
          <th class="standings__th standings__th--num" :title="totalScoreColumnTitle">
            <button
              type="button"
              class="standings__sort-button standings__sort-button--num"
              @click="toggleSort('totalScore')"
            >
              <span>Total</span>
              <span class="standings__sort-indicator">{{ sortIndicator('totalScore') }}</span>
            </button>
          </th>
          <th
            v-if="settings.standings.usePerformanceModifier"
            class="standings__th standings__th--num standings__th--mult"
            title="Performance multiplier applied to base score&#10;1.0 = league average · &gt;1.0 = above average · &lt;1.0 = below average"
          >×Mult</th>
          <th class="standings__th standings__th--num" :title="adjustmentColumnTitle">{{ adjustmentColumnLabel }}</th>
          <th class="standings__th standings__th--num" :title="adjustedPointsColumnTitle">
            <button
              type="button"
              class="standings__sort-button standings__sort-button--num"
              @click="toggleSort('adjustedTotalPoints')"
            >
              <span>{{ adjustedPointsColumnLabel }}</span>
              <span class="standings__sort-indicator">{{ sortIndicator('adjustedTotalPoints') }}</span>
            </button>
          </th>
          <th class="standings__th standings__th--num">
            <button
              type="button"
              class="standings__sort-button standings__sort-button--num"
              @click="toggleSort('totalPoints')"
            >
              <span>Points</span>
              <span class="standings__sort-indicator">{{ sortIndicator('totalPoints') }}</span>
            </button>
          </th>
          <th v-if="settings.standings.includeAchievementPoints" class="standings__th standings__th--num">
            <button
              type="button"
              class="standings__sort-button standings__sort-button--num"
              @click="toggleSort('achievementPoints')"
            >
              <span>Achv. Pts</span>
              <span class="standings__sort-indicator">{{ sortIndicator('achievementPoints') }}</span>
            </button>
          </th>
          <th v-if="settings.standings.includeCommanderXp" class="standings__th standings__th--num">
            <button
              type="button"
              class="standings__sort-button standings__sort-button--num"
              @click="toggleSort('xpPoints')"
            >
              <span>XP Pts</span>
              <span class="standings__sort-indicator">{{ sortIndicator('xpPoints') }}</span>
            </button>
          </th>
          <th class="standings__th standings__th--num">
            <button
              type="button"
              class="standings__sort-button standings__sort-button--num"
              @click="toggleSort('gamesPlayed')"
            >
              <span>Games</span>
              <span class="standings__sort-indicator">{{ sortIndicator('gamesPlayed') }}</span>
            </button>
          </th>
          <th class="standings__th standings__th--num">
            <button
              type="button"
              class="standings__sort-button standings__sort-button--num"
              @click="toggleSort('winRate')"
            >
              <span>Win %</span>
              <span class="standings__sort-indicator">{{ sortIndicator('winRate') }}</span>
            </button>
          </th>
          <th class="standings__th standings__th--num">
            <button
              type="button"
              class="standings__sort-button standings__sort-button--num"
              @click="toggleSort('avgPerGame')"
            >
              <span>Avg / Game</span>
              <span class="standings__sort-indicator">{{ sortIndicator('avgPerGame') }}</span>
            </button>
          </th>
          <th class="standings__th standings__th--commander">Most Played Commander</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="row in table"
          :key="row.name"
          class="standings__row"
          :class="{
            'standings__row--self': row.name === loggedInPlayerName,
            'standings__row--top1': row.rank === 1,
            'standings__row--top2': row.rank === 2,
            'standings__row--top3': row.rank === 3
          }"
        >
          <td class="standings__td standings__td--rank">
            <span class="standings__rank" :class="`standings__rank--${row.rank}`">
              {{ rankLabel(row.rank) }}
            </span>
          </td>
          <td class="standings__td standings__td--name">
            <NuxtLink
              class="standings__player-link"
              :to="`/players/${encodeURIComponent(row.name)}`"
              @mouseenter="onPlayerEnter(row, $event)"
              @mousemove="onMouseMove($event)"
              @mouseleave="onPlayerLeave"
            >{{ row.name }}</NuxtLink>
          </td>
          <td class="standings__td standings__td--num standings__td--total">{{ fmt(row.totalScore) }}</td>
          <td
            v-if="settings.standings.usePerformanceModifier"
            class="standings__td standings__td--num standings__td--mult standings__td--hoverable-mult"
            @mouseenter="onMultEnter(row, $event)"
            @mousemove="onMouseMove($event)"
            @mouseleave="onMultLeave"
          >{{ fmt(row.perfMult) }}</td>
          <td
            class="standings__td standings__td--num standings__td--comp standings__td--hoverable-comp"
            @mouseenter="onCompEnter(row, $event)"
            @mousemove="onMouseMove($event)"
            @mouseleave="onCompLeave"
          >{{ fmt(row.adjustmentDisplayPoints) }}</td>
          <td class="standings__td standings__td--num">{{ fmt(row.adjustedTotalPoints) }}</td>
          <td class="standings__td standings__td--num">{{ fmt(row.totalPoints) }}</td>
          <td
            v-if="settings.standings.includeAchievementPoints"
            class="standings__td standings__td--num standings__td--achv standings__td--hoverable"
            @mouseenter="onAchvEnter(row.name, $event)"
            @mousemove="onMouseMove($event)"
            @mouseleave="onAchvLeave"
          >{{ fmt(row.achievementPoints) }}</td>
          <td
            v-if="settings.standings.includeCommanderXp"
            class="standings__td standings__td--num standings__td--xp standings__td--hoverable-xp"
            @mouseenter="onXpEnter(row.name, $event)"
            @mousemove="onMouseMove($event)"
            @mouseleave="onXpLeave"
          >{{ fmt(row.xpPoints) }}</td>
          <td class="standings__td standings__td--num">{{ row.gamesPlayed }}</td>
          <td class="standings__td standings__td--num">{{ row.winRate }}%</td>
          <td class="standings__td standings__td--num">{{ fmt(row.avgPerGame) }}</td>
          <td class="standings__td standings__td--commander">
            <NuxtLink
              v-if="row.topCommander"
              class="standings__commander-name"
              :to="`/commanders/${encodeURIComponent(row.topCommander!)}`"
              @mouseenter="onCommanderEnter(row.name, row.topCommander!, $event)"
              @mousemove="onMouseMove($event)"
              @mouseleave="onCommanderLeave"
            >
              <IconsTierIcon
                v-if="row.topCommanderTier"
                :tier="row.topCommanderTier"
                :size="12"
              />
              {{ row.topCommander }}
            </NuxtLink>
            <span v-else class="standings__muted">—</span>
          </td>
        </tr>
      </tbody>
    </table>
    </div>

    <div class="dashboard__prize-pool">
      <span class="dashboard__prize-pool-label">Prize Pool</span>
      <strong class="dashboard__prize-pool-value">{{ fmtEuro(totalPrizePool) }}</strong>
    </div>

    <section class="dashboard__looster-section">
      <header class="dashboard__looster-header">
        <h2 class="dashboard__looster-title">Looster Points</h2>
        <p class="dashboard__looster-subtitle">Availability, spending, and set trends per player.</p>
      </header>

      <div class="dashboard__looster-wrap">
        <table class="looster-table">
          <thead>
            <tr>
              <th class="looster-table__th looster-table__th--name">Player</th>
              <th class="looster-table__th looster-table__th--num">Loosters Available</th>
              <th class="looster-table__th looster-table__th--num">Looster Points Right Now</th>
              <th class="looster-table__th looster-table__th--num">Looster Points Spent</th>
              <th class="looster-table__th looster-table__th--num">Bought Loosters</th>
              <th class="looster-table__th looster-table__th--set">Most Bought Set</th>
              <th class="looster-table__th looster-table__th--num">LP Over Games</th>
              <th class="looster-table__th looster-table__th--num">LP Over Missed</th>
              <th class="looster-table__th looster-table__th--num">Looster Points Total</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in loosterTable" :key="row.name" class="looster-table__row">
              <td class="looster-table__td looster-table__td--name">
                <NuxtLink class="looster-table__player-link" :to="`/players/${encodeURIComponent(row.name)}`">
                  {{ row.name }}
                </NuxtLink>
              </td>
              <td
                class="looster-table__td looster-table__td--num looster-table__td--available"
                :class="row.availableLoosters > 0 ? 'looster-table__td--available-yes' : 'looster-table__td--available-no'"
              >
                {{ row.availableLoosters }}
              </td>
              <td class="looster-table__td looster-table__td--num">{{ fmt(row.currentLoosterPoints) }}</td>
              <td class="looster-table__td looster-table__td--num looster-table__td--spent">{{ fmt(row.spentLoosterPoints) }}</td>
              <td class="looster-table__td looster-table__td--num">{{ row.boughtLoosters }}</td>
              <td class="looster-table__td looster-table__td--set">
                <a
                  v-if="row.mostBoughtSet"
                  class="looster-table__set-link"
                  :href="loosterSetMeta[row.mostBoughtSet]?.scryfallUrl || `https://scryfall.com/sets/${row.mostBoughtSet.toLowerCase()}`"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <img
                    v-if="loosterSetMeta[row.mostBoughtSet]?.iconUrl"
                    :src="loosterSetMeta[row.mostBoughtSet].iconUrl"
                    :alt="`${row.mostBoughtSet} set icon`"
                    class="looster-table__set-icon"
                  >
                  <span>{{ row.mostBoughtSet }}</span>
                </a>
                <span v-else>-</span>
              </td>
              <td class="looster-table__td looster-table__td--num">{{ fmt(row.gameLoosterPoints) }}</td>
              <td class="looster-table__td looster-table__td--num">{{ fmt(row.missedGameLoosterPoints) }}</td>
              <td class="looster-table__td looster-table__td--num">{{ fmt(row.totalLoosterPoints) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <section
      v-if="featuredPlayer || loggedInArchEnemy"
      class="dashboard__spotlight"
      :class="{ 'dashboard__spotlight--no-art': !featuredPlayer }"
    >
      <div v-if="featuredPlayer" class="dashboard__spotlight-art">
        <img
          v-if="featuredPlayer.imageUrl"
          :src="featuredPlayer.imageUrl"
          :alt="featuredPlayer.name"
          class="dashboard__spotlight-art-img"
        />
        <div v-else class="dashboard__spotlight-art-placeholder">
          {{ featuredPlayer.initials }}
        </div>
        <div class="dashboard__spotlight-art-overlay" />
      </div>

      <div class="dashboard__spotlight-body">
        <div v-if="featuredPlayer" class="dashboard__spotlight-player">
          <div class="dashboard__spotlight-eyebrow">Featured Player</div>
          <NuxtLink
            class="dashboard__spotlight-name"
            :to="`/players/${encodeURIComponent(featuredPlayer.name)}`"
          >{{ featuredPlayer.name }}</NuxtLink>
          <div class="dashboard__spotlight-player-title">{{ featuredPlayer.title }}</div>
          <p class="dashboard__spotlight-summary">{{ featuredPlayer.summary }}</p>
          <ul class="dashboard__spotlight-reasons">
            <li
              v-for="reason in featuredPlayer.reasons"
              :key="reason"
              class="dashboard__spotlight-reason"
            >{{ reason }}</li>
          </ul>
        </div>

        <div v-if="honorableMentions.length" class="dashboard__spotlight-honorable">
          <div class="dashboard__spotlight-honorable-label">Honorable Mentions</div>
          <div class="dashboard__spotlight-honorable-list">
            <NuxtLink
              v-for="(player, index) in honorableMentions"
              :key="player.name"
              class="dashboard__spotlight-mention"
              :to="`/players/${encodeURIComponent(player.name)}`"
            >
              <div class="dashboard__spotlight-mention-rank">#{{ index + 2 }}</div>
              <div class="dashboard__spotlight-mention-header">
                <div class="dashboard__spotlight-mention-name">{{ player.name }}</div>
                <div class="dashboard__spotlight-mention-title">{{ player.title }}</div>
              </div>
              <div class="dashboard__spotlight-mention-stats">
                <span>{{ player.rankLabel }}</span>
                <span>{{ player.gamesPlayed }} games</span>
                <span>{{ player.winRate }}% win</span>
                <span>{{ fmt(player.avgPerGame) }} avg pts</span>
              </div>
              <p class="dashboard__spotlight-mention-summary">{{ player.summary }}</p>
            </NuxtLink>
          </div>
        </div>

        <div v-if="loggedInArchEnemy" class="dashboard__spotlight-aside">
          <div class="dashboard__spotlight-aside-label">Your Arch Enemy</div>
          <PlayersArchEnemyCard :summary="loggedInArchEnemy" />
        </div>
      </div>

    </section>

    <section v-if="spotlightStatTiles.length" class="dashboard__spotlight-stats-section">
      <div class="dashboard__spotlight-stats">
        <NuxtLink
          v-for="tile in spotlightStatTiles"
          :key="tile.key"
          class="dashboard__spotlight-stat"
          :to="`/players/${encodeURIComponent(tile.name)}`"
        >
          <div class="dashboard__spotlight-stat-label">{{ tile.label }}</div>
          <div class="dashboard__spotlight-stat-player">
            <img
              v-if="tile.imageUrl"
              :src="tile.imageUrl"
              :alt="tile.name"
              class="dashboard__spotlight-stat-avatar"
            />
            <span
              v-else
              class="dashboard__spotlight-stat-avatar dashboard__spotlight-stat-avatar--fallback"
            >{{ tile.initials }}</span>
            <span class="dashboard__spotlight-stat-name">{{ tile.name }}</span>
          </div>
          <div class="dashboard__spotlight-stat-value">{{ tile.value }}</div>
          <div class="dashboard__spotlight-stat-detail">{{ tile.detail }}</div>
        </NuxtLink>
      </div>
    </section>

    <section v-if="performanceChartData.series.length > 0" class="dashboard__perf-section">
      <div class="dashboard__perf-switcher">
        <button
          type="button"
          class="dashboard__perf-switch"
          :class="{ 'dashboard__perf-switch--active': activeChart === 'performance' }"
          @click="activeChart = 'performance'"
        >Performance</button>
        <button
          type="button"
          class="dashboard__perf-switch"
          :class="{ 'dashboard__perf-switch--active': activeChart === 'total' }"
          @click="activeChart = 'total'"
        >Total Points</button>
      </div>
      <ChartsPerformanceTimeline
        v-if="activeChart === 'performance'"
        :labels="performanceChartData.labels"
        :series="performanceChartData.series"
      />
      <ChartsPerformanceTimeline
        v-else
        :labels="totalPointsChartData.labels"
        :series="totalPointsChartData.series"
      />
      <div v-if="currentChartStandings.length" class="dashboard__perf-ranking">
        <NuxtLink
          v-for="player in currentChartStandings"
          :key="`${activeChart}-${player.name}`"
          class="dashboard__perf-player"
          :to="`/players/${encodeURIComponent(player.name)}`"
        >
          <span class="dashboard__perf-player-rank">{{ rankLabel(player.rank) }}</span>
          <img
            v-if="player.imageUrl"
            :src="player.imageUrl"
            :alt="player.name"
            class="dashboard__perf-player-icon"
          />
          <span
            v-else
            class="dashboard__perf-player-icon dashboard__perf-player-icon--fallback"
          >{{ player.initials }}</span>
          <span class="dashboard__perf-player-name">{{ player.name }}</span>
          <span class="dashboard__perf-player-points">{{ fmt(player.points) }}</span>
        </NuxtLink>
      </div>
    </section>

    <CommandersTopCommander />
    </template>

    <Teleport to="body">
      <div
        v-if="catchupHover.visible"
        class="floating-panel mult-tooltip"
        :style="{ top: `${catchupHover.y}px`, left: `${catchupHover.x}px` }"
      >
        <div class="mult-tooltip__title">Catch-Up</div>
        <table class="mult-tooltip__table">
          <tbody>
          <tr>
            <td class="mult-tooltip__label">Target</td>
            <td class="mult-tooltip__op"></td>
            <td class="mult-tooltip__detail"></td>
            <td class="mult-tooltip__value">{{ catchupHover.targetName }}</td>
          </tr>
          <tr>
            <td class="mult-tooltip__label">Gap</td>
            <td class="mult-tooltip__op"></td>
            <td class="mult-tooltip__detail">their total - your total</td>
            <td class="mult-tooltip__value">{{ fmt(catchupHover.gap) }}</td>
          </tr>
          <tr>
            <td class="mult-tooltip__label">Your avg</td>
            <td class="mult-tooltip__op"></td>
            <td class="mult-tooltip__detail">points per game</td>
            <td class="mult-tooltip__value">{{ fmt(catchupHover.avgPerGame) }}</td>
          </tr>
          <tr>
            <td class="mult-tooltip__label">Comp swing</td>
            <td class="mult-tooltip__op"></td>
            <td class="mult-tooltip__detail">next game vs compensation</td>
            <td class="mult-tooltip__value">{{ fmt(catchupHover.nextCompDelta) }}</td>
          </tr>
          <tr>
            <td class="mult-tooltip__label">Net gain</td>
            <td class="mult-tooltip__op"></td>
            <td class="mult-tooltip__detail">expected total next game</td>
            <td class="mult-tooltip__value">{{ fmt(catchupHover.nextNetGain) }}</td>
          </tr>
          <tr class="mult-tooltip__row--sep">
            <td class="mult-tooltip__label">Catch up</td>
            <td class="mult-tooltip__op">=</td>
            <td class="mult-tooltip__detail">{{ catchupHover.message }}</td>
            <td class="mult-tooltip__value">{{ catchupHover.gamesNeededLabel }}</td>
          </tr>
          </tbody>
        </table>
      </div>
    </Teleport>

    <Teleport to="body">
      <div
        v-if="hover.visible"
        class="floating-panel"
        :style="{ top: `${hover.y}px`, left: `${hover.x}px` }"
      >
        <GamesCommanderMetaInformation
          :player-name="hover.playerName"
          :commander-name="hover.commanderName"
        />
      </div>
    </Teleport>

    <Teleport to="body">
      <div
        v-if="achvHover.visible"
        class="floating-panel"
        :style="{ top: `${achvHover.y}px`, left: `${achvHover.x}px` }"
      >
        <AchievementsAchievementList
          :player-name="achvHover.playerName"
          :commander-name="achvHover.commanderName || undefined"
        />
      </div>
    </Teleport>

    <Teleport to="body">
      <div
        v-if="xpHover.visible"
        class="floating-panel"
        :style="{ top: `${xpHover.y}px`, left: `${xpHover.x}px` }"
      >
        <CommandersCommanderXPList :player-name="xpHover.playerName" />
      </div>
    </Teleport>

    <Teleport to="body">
      <div
        v-if="multHover.visible"
        class="floating-panel mult-tooltip"
        :style="{ top: `${multHover.y}px`, left: `${multHover.x}px` }"
      >
        <div class="mult-tooltip__title">Performance ×Mult</div>
        <table class="mult-tooltip__table">
          <tbody>
          <tr>
            <td class="mult-tooltip__label">Base</td>
            <td class="mult-tooltip__op"></td>
            <td class="mult-tooltip__detail"></td>
            <td class="mult-tooltip__value">{{ fmt(0.70) }}</td>
          </tr>
          <tr>
            <td class="mult-tooltip__label">Win rate</td>
            <td class="mult-tooltip__op">+</td>
            <td class="mult-tooltip__detail">0.15 × ({{ multHover.winRate }}% / 25%)</td>
            <td class="mult-tooltip__value">{{ fmt(multHover.winRateTerm) }}</td>
          </tr>
          <tr>
            <td class="mult-tooltip__label">Avg / game</td>
            <td class="mult-tooltip__op">+</td>
            <td class="mult-tooltip__detail">0.15 × ({{ fmt(multHover.avgPerGame) }} / {{ fmt(multHover.leagueAvgPerGame) }})</td>
            <td class="mult-tooltip__value">{{ fmt(multHover.avgTerm) }}</td>
          </tr>
          <tr class="mult-tooltip__row--sep">
            <td class="mult-tooltip__label">Raw</td>
            <td class="mult-tooltip__op">=</td>
            <td class="mult-tooltip__detail"></td>
            <td class="mult-tooltip__value">{{ fmt(multHover.perfMultRaw) }}</td>
          </tr>
          <tr v-if="multHover.perfMultRaw !== multHover.perfMult">
            <td class="mult-tooltip__label mult-tooltip__label--clamped">Clamped</td>
            <td class="mult-tooltip__op">→</td>
            <td class="mult-tooltip__detail mult-tooltip__label--clamped">range [0.5 – 1.5]</td>
            <td class="mult-tooltip__value mult-tooltip__label--clamped">{{ fmt(multHover.perfMult) }}</td>
          </tr>
          </tbody>
        </table>
      </div>
    </Teleport>

    <Teleport to="body">
      <div
        v-if="compHover.visible"
        class="floating-panel mult-tooltip"
        :style="{ top: `${compHover.y}px`, left: `${compHover.x}px` }"
      >
        <div class="mult-tooltip__title">{{ compHover.title }}</div>
        <table class="mult-tooltip__table">
          <tbody>
          <tr v-if="compHover.mode === 'compensation'">
            <td class="mult-tooltip__label">Games</td>
            <td class="mult-tooltip__op"></td>
            <td class="mult-tooltip__detail">{{ compHover.gamesPlayed }} played / {{ compHover.maxGamesPlayed }} max</td>
            <td class="mult-tooltip__value">{{ compHover.missingGames }}</td>
          </tr>
          <tr v-if="compHover.mode === 'compensation'">
            <td class="mult-tooltip__label">Projected</td>
            <td class="mult-tooltip__op">=</td>
            <td class="mult-tooltip__detail">min(missing, max(30, {{ compHover.gamesPlayed }}))</td>
            <td class="mult-tooltip__value">{{ compHover.cappedMissingGames }}</td>
          </tr>
          <tr v-if="compHover.mode === 'compensation'">
            <td class="mult-tooltip__label">Optimistic</td>
            <td class="mult-tooltip__op"></td>
            <td class="mult-tooltip__detail">player avg / game</td>
            <td class="mult-tooltip__value">{{ fmt(compHover.averageScore) }}</td>
          </tr>
          <tr v-if="compHover.mode === 'compensation'">
            <td class="mult-tooltip__label">Floor</td>
            <td class="mult-tooltip__op"></td>
            <td class="mult-tooltip__detail">league worst avg / game</td>
            <td class="mult-tooltip__value">{{ fmt(compHover.leagueFloorScore) }}</td>
          </tr>
          <tr v-if="compHover.mode === 'compensation'">
            <td class="mult-tooltip__label">Decay</td>
            <td class="mult-tooltip__op"></td>
            <td class="mult-tooltip__detail">exp(-i / {{ fmt(compHover.decayFactor) }}) per game</td>
            <td class="mult-tooltip__value">decay</td>
          </tr>
          <tr v-if="compHover.mode === 'compensation'">
            <td class="mult-tooltip__label">Discounts</td>
            <td class="mult-tooltip__op">×</td>
            <td class="mult-tooltip__detail">{{ fmt(compHover.gameValueFactor) }} value × {{ fmt(compHover.sampleFactor) }} sample</td>
            <td class="mult-tooltip__value">{{ fmt(compHover.gameValueFactor * compHover.sampleFactor) }}</td>
          </tr>
          <tr v-if="compHover.mode === 'compensation'" class="mult-tooltip__row--sep">
            <td class="mult-tooltip__label">Sample</td>
            <td class="mult-tooltip__op"></td>
            <td class="mult-tooltip__detail">{{ compHover.gamesPlayed }} / ({{ compHover.gamesPlayed }} + {{ fmt(compHover.sampleSmoothingGames) }})</td>
            <td class="mult-tooltip__value">{{ fmt(compHover.sampleFactor) }}</td>
          </tr>
          <tr v-if="compHover.mode === 'freeGames'">
            <td class="mult-tooltip__label">Starting avg</td>
            <td class="mult-tooltip__op"></td>
            <td class="mult-tooltip__detail">before first played game</td>
            <td class="mult-tooltip__value">{{ fmt(compHover.baselineAvgPoints) }}</td>
          </tr>
          <tr v-if="compHover.mode === 'freeGames'">
            <td class="mult-tooltip__label">Miss reduction</td>
            <td class="mult-tooltip__op">-</td>
            <td class="mult-tooltip__detail">per consecutive missed game</td>
            <td class="mult-tooltip__value">{{ fmt(compHover.consecutiveMissPenalty) }}</td>
          </tr>
          <tr v-if="compHover.mode === 'freeGames'">
            <td class="mult-tooltip__label">Avg floor</td>
            <td class="mult-tooltip__op"></td>
            <td class="mult-tooltip__detail">minimum free-game value</td>
            <td class="mult-tooltip__value">{{ fmt(compHover.minimumAvgPoints) }}</td>
          </tr>
          <tr v-if="compHover.mode === 'penaltyGames'">
            <td class="mult-tooltip__label">Baseline games</td>
            <td class="mult-tooltip__op"></td>
            <td class="mult-tooltip__detail">lowest player sample with at least 30 games</td>
            <td class="mult-tooltip__value">{{ compHover.lowestGamesPlayed }}</td>
          </tr>
          <tr v-if="compHover.mode === 'penaltyGames'">
            <td class="mult-tooltip__label">Game gap</td>
            <td class="mult-tooltip__op"></td>
            <td class="mult-tooltip__detail">your games above the baseline</td>
            <td class="mult-tooltip__value">{{ compHover.gameGap }}</td>
          </tr>
          <tr v-if="compHover.mode === 'penaltyGames'">
            <td class="mult-tooltip__label">Factor</td>
            <td class="mult-tooltip__op">×</td>
            <td class="mult-tooltip__detail">penalty multiplier</td>
            <td class="mult-tooltip__value">{{ fmt(compHover.penaltyFactor) }}</td>
          </tr>
          <tr>
            <td class="mult-tooltip__label">{{ compHover.totalLabel }}</td>
            <td class="mult-tooltip__op">=</td>
            <td class="mult-tooltip__detail">{{ compHover.totalDetail }}</td>
            <td class="mult-tooltip__value">{{ fmt(compHover.displayPoints) }}</td>
          </tr>
          </tbody>
        </table>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import {
  calculateStandingsAdjustment,
  compareGamesChronological,
  type PlayerGameRecord,
  type StandingsAdjustmentResult,
} from '~/composables/useLeagueState'
import type { PerformancePlayerSeries } from '~/components/charts/PerformanceTimeline.vue'
import { fetchSetByCode } from '~/services/scryfallService'
import { getArchEnemySummary } from '~/utils/archEnemy'
import { getFeaturedPlayers, type FeaturedPlayerCandidate } from '~/utils/featuredPlayer'
import { MIN_GAMES_FOR_PENALTY_MODE, type StandingsAdjustmentMode } from '~/utils/leagueSettings'
import { roundLoosterPoints } from '~/utils/loosterPoints'
import { formatPlayerName } from '~/utils/playerNames'
import {
  EXPECTED_WIN_RATE,
  PERF_BASE_WEIGHT,
  PERF_WIN_RATE_WEIGHT,
  PERF_AVG_WEIGHT,
  PERF_MULT_MAX,
  PERF_MULT_MIN,
} from '~/utils/placements'
import { computeGlobalCommanderBaseline, computePlayerCommanderTier, type Tier } from '~/utils/tiers'
import type { LoosterPurchaseRecord } from '~/utils/loosterPurchases'

const { commanders, gameRecords, games, leagueSnapshots, players, standings, loading, loaded, progress } = useLeagueState()
const { settings } = useLeagueSettings()
const { user, ensureSession } = useAuth()

type SortKey =
  | 'totalScore'
  | 'adjustedTotalPoints'
  | 'adjustmentDisplayPoints'
  | 'totalPoints'
  | 'achievementPoints'
  | 'xpPoints'
  | 'gamesPlayed'
  | 'totalLosses'
  | 'winRate'
  | 'avgPerGame'
  | 'totalLPoints'

type ChartStandingRow = {
  rank: number
  name: string
  points: number
  imageUrl: string
  initials: string
}

type SpotlightStatTile = {
  key: string
  label: string
  name: string
  value: string
  detail: string
  imageUrl: string
  initials: string
}

type LoosterTableRow = {
  name: string
  availableLoosters: number
  currentLoosterPoints: number
  gameLoosterPoints: number
  spentLoosterPoints: number
  boughtLoosters: number
  mostBoughtSet: string
  missedGameLoosterPoints: number
  totalLoosterPoints: number
}

type DashboardSetMeta = {
  iconUrl: string
  scryfallUrl: string
}

const sortKey = ref<SortKey>('totalScore')
const sortDirection = ref<'desc' | 'asc'>('desc')
const hasMounted = ref(false)
const purchases = ref<LoosterPurchaseRecord[]>([])
const loosterSetMeta = ref<Record<string, DashboardSetMeta>>({})
const pageLoading = computed(() => !hasMounted.value || loading.value || !loaded.value)
const progressPercent = computed(() => {
  if (progress.value.total <= 0) return 8
  return Math.max(8, Math.min(100, Math.round((progress.value.current / progress.value.total) * 100)))
})
const progressLabel = computed(() => {
  if (progress.value.total <= 0) return 'Preparing league data...'
  return `${progress.value.current}/${progress.value.total} games computed`
})
const totalPrizePool = computed(() =>
  purchases.value.reduce((sum, purchase) => sum + Number(purchase.priceEuro ?? 0), 0),
)
const loosterCost = computed(() => Number(settings.value.shop.loosterCost ?? 0))
const chronologicalGames = computed(() => [...games.value].sort(compareGamesChronological))
const playerPortraitModules = import.meta.glob('../assets/img/*.png', { eager: true, import: 'default' })
const playerPortraits = Object.fromEntries(
  Object.entries(playerPortraitModules).map(([path, url]) => {
    const fileName = path.split('/').pop() ?? ''
    const key = fileName.replace(/\.png$/i, '').toLowerCase()
    return [key, url as string]
  }),
)
const gameOrderMap = computed(() =>
  new Map(chronologicalGames.value.map((game, index) => [game.gameId, index])),
)
const loggedInArchEnemy = computed(() => {
  if (!user.value) return null
  const playerName = formatPlayerName(user.value)
  if (!players.value[playerName]) return null
  return getArchEnemySummary(playerName, chronologicalGames.value, gameRecords.value)
})
const loggedInPlayerName = computed(() => (user.value ? formatPlayerName(user.value) : ''))
const adjustmentMode = computed(() => settings.value.standings.adjustmentMode)
const adjustmentColumnLabel = computed(() => {
  if (adjustmentMode.value === 'freeGames') return 'Free Games'
  if (adjustmentMode.value === 'penaltyGames') return 'Penalty'
  return 'Comp.'
})
const adjustedPointsColumnLabel = computed(() => {
  if (adjustmentMode.value === 'freeGames') return 'Pts + Free Games'
  if (adjustmentMode.value === 'penaltyGames') return 'Pts - Penalty'
  return 'Pts + Comp'
})
const adjustmentColumnTitle = computed(() => {
  if (adjustmentMode.value === 'freeGames') {
    return 'Points earned for missed games based on the player average at that time, reduced by consecutive misses and never added to the player average'
  }
  if (adjustmentMode.value === 'penaltyGames') {
    return `Penalty deducted from players above the lowest player sample once the baseline reaches at least ${MIN_GAMES_FOR_PENALTY_MODE} games`
  }
  return 'Projected compensation for missed games compared to the most active player. Always discounted and not affected by the multiplier.'
})
const adjustedPointsColumnTitle = computed(() => {
  if (adjustmentMode.value === 'freeGames') return 'Base points plus earned free-game points. Does not include achievements or commander XP.'
  if (adjustmentMode.value === 'penaltyGames') return 'Base points minus the excess-games penalty. Does not include achievements or commander XP.'
  return 'Base points plus missed-game compensation. Does not include achievements or commander XP.'
})
const totalScoreColumnTitle = computed(() => {
  if (adjustmentMode.value === 'freeGames') {
    return '((Points + Free Games) + Achievement Points + Commander XP Points) × Performance Multiplier'
  }
  if (adjustmentMode.value === 'penaltyGames') {
    return '((Points - Penalty) + Achievement Points + Commander XP Points) × Performance Multiplier'
  }
  return '((Points + Missed-Game Compensation) + Achievement Points + Commander XP Points) × Performance Multiplier'
})

const purchasesByPlayer = computed(() => {
  const grouped = new Map<string, LoosterPurchaseRecord[]>()

  for (const purchase of purchases.value) {
    const existing = grouped.get(purchase.playerName) ?? []
    existing.push(purchase)
    grouped.set(purchase.playerName, existing)
  }

  return grouped
})

const loosterTable = computed<LoosterTableRow[]>(() =>
  table.value.map((standingRow) => {
    const playerName = standingRow.name
    const player = players.value[playerName]
    const playerPurchases = purchasesByPlayer.value.get(playerName) ?? []
    const gameLoosterPoints = roundLoosterPoints(
      Object.values(gameRecords.value[playerName] ?? {}).reduce((sum, record) => sum + record.lPoints, 0),
    )
    const spentLoosterPoints = r3(
      playerPurchases.reduce((sum, purchase) => sum + Number(purchase.cost ?? 0), 0),
    )
    const totalLoosterPoints = roundLoosterPoints(player?.totalLPoints ?? 0)
    const missedGameLoosterPoints = roundLoosterPoints(
      Math.max(0, totalLoosterPoints - gameLoosterPoints),
    )
    const currentLoosterPoints = r3(totalLoosterPoints - spentLoosterPoints)
    const availableLoosters = loosterCost.value > 0
      ? Math.max(0, Math.floor(currentLoosterPoints / loosterCost.value))
      : 0

    const setCounts = playerPurchases.reduce((counts, purchase) => {
      counts.set(purchase.set, (counts.get(purchase.set) ?? 0) + 1)
      return counts
    }, new Map<string, number>())

    const mostBoughtSet = [...setCounts.entries()]
      .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))[0]?.[0] ?? ''

    return {
      name: playerName,
      availableLoosters,
      currentLoosterPoints,
      gameLoosterPoints,
      spentLoosterPoints,
      boughtLoosters: playerPurchases.length,
      mostBoughtSet,
      missedGameLoosterPoints,
      totalLoosterPoints,
    }
  }),
)

onMounted(async () => {
  hasMounted.value = true
  await ensureSession()
  await loadPrizePool()
})

async function loadPrizePool() {
  try {
    const response = await $fetch<{ purchases: LoosterPurchaseRecord[] }>('/api/purchases')
    purchases.value = response.purchases ?? []
    await loadLoosterSetMeta()
  } catch {
    purchases.value = []
    loosterSetMeta.value = {}
  }
}

async function loadLoosterSetMeta() {
  const uniqueSetCodes = [...new Set(
    purchases.value.map((purchase) => purchase.set?.trim()).filter(Boolean),
  )] as string[]

  if (uniqueSetCodes.length === 0) {
    loosterSetMeta.value = {}
    return
  }

  const resolvedSets = await Promise.all(uniqueSetCodes.map(async (setCode) => {
    const set = await fetchSetByCode(setCode)
    return [setCode, set] as const
  }))

  const nextMeta: Record<string, DashboardSetMeta> = {}

  for (const [setCode, set] of resolvedSets) {
    if (!set?.icon_svg_uri || !set?.scryfall_uri) continue

    nextMeta[setCode] = {
      iconUrl: set.icon_svg_uri,
      scryfallUrl: set.scryfall_uri,
    }
  }

  loosterSetMeta.value = nextMeta
}

type MultRow = {
  winRate: number
  winRateFraction: number
  winRateTerm: number
  avgPerGame: number
  leagueAvgPerGame: number
  avgFraction: number
  avgTerm: number
  perfMultRaw: number
  perfMult: number
}

type CompensationRow = {
  adjustmentMode: StandingsAdjustmentMode
  adjustmentPoints: number
  adjustmentDisplayPoints: number
  adjustedTotalPoints: number
  gamesPlayed: number
  projectionMissingGames: number
  projectionCappedMissingGames: number
  projectionMaxGamesPlayed: number
  projectionLeagueFloorScore: number
  projectionAverageScore: number
  projectionSampleFactor: number
  projectionDecayFactor: number
  projectionGameValueFactor: number
  projectionMaxProjectedGames: number
  projectionSampleSmoothingGames: number
  freeGamesBaselineAvg: number
  freeGamesConsecutivePenalty: number
  freeGamesMinimumAvg: number
  penaltyLowestGamesPlayed: number
  penaltyGameGap: number
  penaltyFactor: number
}

// ── Commander XP points: 1 pt per level per commander ────────────────────────

// ── Most played commander ─────────────────────────────────────────────────────

function topCommander(playerName: string): string | null {
  const records = Object.values(gameRecords.value[playerName] ?? {})
  if (records.length === 0) return null
  const counts: Record<string, number> = {}
  for (const r of records) counts[r.commander] = (counts[r.commander] ?? 0) + 1
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
}

function fmtEuro(value: number) {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
  }).format(value)
}

const globalCommanderBaseline = computed(() =>
  computeGlobalCommanderBaseline(commanders.value),
)

function playerCommanderTier(playerName: string, commanderName: string): Tier | null {
  const records = Object.values(gameRecords.value[playerName] ?? {}).filter(
    (record) => record.commander === commanderName,
  )
  const { detail } = computePlayerCommanderTier(records, globalCommanderBaseline.value)
  return detail?.tier ?? null
}

function buildPerformanceMetrics(
  totalPoints: number,
  gamesPlayed: number,
  baseWins: number,
  leagueAvgPerGame: number,
  usePerformanceModifier: boolean,
) {
  const avgPerGame = gamesPlayed > 0 ? r3(totalPoints / gamesPlayed) : 0
  const winRate = gamesPlayed > 0 ? Math.round((baseWins / gamesPlayed) * 100) : 0
  const winRateFraction = gamesPlayed > 0 ? baseWins / gamesPlayed : EXPECTED_WIN_RATE
  const avgFraction = leagueAvgPerGame > 0 ? avgPerGame / leagueAvgPerGame : 1
  const winRateTerm = r3(PERF_WIN_RATE_WEIGHT * (winRateFraction / EXPECTED_WIN_RATE))
  const avgTerm = r3(PERF_AVG_WEIGHT * avgFraction)
  const perfMultRaw = r3(PERF_BASE_WEIGHT + winRateTerm + avgTerm)
  const perfMult = usePerformanceModifier && gamesPlayed > 0
    ? r3(Math.min(PERF_MULT_MAX, Math.max(PERF_MULT_MIN, perfMultRaw)))
    : 1

  return {
    avgPerGame,
    winRate,
    winRateFraction: r3(winRateFraction),
    avgFraction: r3(avgFraction),
    winRateTerm,
    avgTerm,
    perfMultRaw,
    perfMult,
    leagueAvgPerGame: r3(leagueAvgPerGame),
  }
}

function xpToLevelFromThresholds(xp: number, thresholds: number[]) {
  let level = 1
  for (let index = 1; index < thresholds.length; index++) {
    if (xp >= thresholds[index]) level = index + 1
    else break
  }
  return Math.min(level, 20)
}

// ── Table rows ────────────────────────────────────────────────────────────────

const table = computed(() => {
  const xpThresholds = settings.value.level.thresholds
  const xpPointsPerLevel = settings.value.level.pointsPerLevel
  const includeCommanderXp = settings.value.standings.includeCommanderXp
  const includeAchievementPoints = settings.value.standings.includeAchievementPoints
  const playerSummaries = Object.values(players.value).map((player) => {
    const records = Object.values(gameRecords.value[player.name] ?? {})
    const totalPoints = r3(records.reduce((sum, record) => sum + record.finalPoints, 0))
    const gamesPlayed = records.length
    const baseWins = records.filter((record) => record.placement === 1).length
    const totalLPoints = player.totalLPoints
    const xpPoints = includeCommanderXp
      ? r3(
        Object.values(player.commanderXP).reduce(
          (sum, xp) => sum + (xpToLevelFromThresholds(xp, xpThresholds) * xpPointsPerLevel),
          0,
        ),
      )
      : 0

    return {
      name: player.name,
      achievementPoints: includeAchievementPoints ? player.achievementPoints : 0,
      xpPoints,
      totalPoints,
      gamesPlayed,
      baseWins,
      totalLPoints,
    }
  })

  const playerTotalsMap = Object.fromEntries(
    playerSummaries.map((player) => [
      player.name,
      { name: player.name, totalPoints: player.totalPoints, gamesPlayed: player.gamesPlayed },
    ]),
  )
  const usePerformanceModifier = settings.value.standings.usePerformanceModifier

  // League average points per game (used to normalise avgPerGame in the multiplier)
  const totalGames  = playerSummaries.reduce((sum, player) => sum + player.gamesPlayed, 0)
  const totalPoints = playerSummaries.reduce((sum, player) => sum + player.totalPoints, 0)
  const leagueAvgPerGame = totalGames > 0 ? totalPoints / totalGames : 1

  const rows = playerSummaries.map((player) => {
    const performance = buildPerformanceMetrics(
      player.totalPoints,
      player.gamesPlayed,
      player.baseWins,
      leagueAvgPerGame,
      usePerformanceModifier,
    )
    const adjustment = calculateStandingsAdjustment(
      { name: player.name, totalPoints: player.totalPoints, gamesPlayed: player.gamesPlayed },
      playerTotalsMap,
      settings.value,
      { games: chronologicalGames.value, gameRecords: gameRecords.value },
    )
    const totalScore = r3(
      ((player.totalPoints + player.achievementPoints + player.xpPoints) * performance.perfMult) +
      adjustment.adjustmentPoints,
    )

    const tc = topCommander(player.name)
    return {
      rank: 0,
      name: player.name,
      totalScore,
      adjustmentMode: adjustment.adjustmentMode,
      adjustmentPoints: adjustment.adjustmentPoints,
      adjustmentDisplayPoints: adjustment.adjustmentDisplayPoints,
      adjustedTotalPoints: adjustment.adjustedTotalPoints,
      projectedPoints: adjustment.adjustmentPoints,
      compensatedTotalPoints: adjustment.adjustedTotalPoints,
      projectionMissingGames: adjustment.missingGames,
      projectionCappedMissingGames: adjustment.cappedMissingGames,
      projectionMaxGamesPlayed: adjustment.maxGamesPlayed,
      projectionLeagueFloorScore: adjustment.leagueFloorScore,
      projectionAverageScore: adjustment.averageScore,
      projectionSampleFactor: adjustment.sampleFactor,
      projectionDecayFactor: adjustment.decayFactor,
      projectionGameValueFactor: adjustment.projectedGameValueFactor,
      projectionMaxProjectedGames: adjustment.maxProjectedGames,
      projectionSampleSmoothingGames: adjustment.sampleSmoothingGames,
      freeGamesBaselineAvg: adjustment.baselineAvgPoints,
      freeGamesConsecutivePenalty: adjustment.consecutiveMissPenalty,
      freeGamesMinimumAvg: adjustment.minimumAvgPoints,
      penaltyLowestGamesPlayed: adjustment.lowestGamesPlayed,
      penaltyGameGap: adjustment.gameGap,
      penaltyFactor: adjustment.penaltyFactor,
      totalPoints: player.totalPoints,
      achievementPoints: player.achievementPoints,
      xpPoints: player.xpPoints,
      gamesPlayed: player.gamesPlayed,
      winRate: performance.winRate,
      avgPerGame: performance.avgPerGame,
      leagueAvgPerGame: performance.leagueAvgPerGame,
      perfMult: performance.perfMult,
      perfMultRaw: performance.perfMultRaw,
      winRateFraction: performance.winRateFraction,
      winRateTerm: performance.winRateTerm,
      avgFraction: performance.avgFraction,
      avgTerm: performance.avgTerm,
      topCommander: tc,
      topCommanderTier: tc ? playerCommanderTier(player.name, tc) : null,
      totalLPoints: player.totalLPoints,
    }
  })

  const rankedRows = [...rows]
    .sort((a, b) => {
      if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore
      return a.name.localeCompare(b.name)
    })
    .map((row, index) => ({ ...row, rank: index + 1 }))

  return rankedRows.sort((a, b) => {
    const direction = sortDirection.value === 'desc' ? -1 : 1
    const delta = a[sortKey.value] - b[sortKey.value]

    if (delta !== 0) return delta * direction

    return (a.rank - b.rank) * direction
  })
})


const featuredPlayers = computed<FeaturedPlayerCandidate[]>(() => {
  // Prefer players who have a portrait image
  const withImages = getFeaturedPlayers(gameRecords.value, gameOrderMap.value, {
    resolveImageUrl: getPlayerPortrait,
    requireImage: true,
  }, 3)
  if (withImages.length > 0) return withImages

  // Fall back to signal-based without image requirement
  const withoutImages = getFeaturedPlayers(gameRecords.value, gameOrderMap.value, {
    resolveImageUrl: getPlayerPortrait,
    requireImage: false,
  }, 3)
  if (withoutImages.length > 0) return withoutImages

  // Final fallback: current league leader with a generic highlight
  const leader = standings.value[0]
  if (!leader) return []
  return [{
    name: leader.name,
    imageUrl: getPlayerPortrait(leader.name),
    initials: leader.name.slice(0, 2).toUpperCase(),
    title: 'League Leader',
    summary: `${leader.name} sits at the top of the standings, currently leading the league.`,
    reasons: [
      `Ranked #1 with ${leader.gamesPlayed} game${leader.gamesPlayed === 1 ? '' : 's'} played.`,
    ],
    score: 0,
  }]
})

const featuredPlayer = computed<FeaturedPlayerCandidate | null>(() => featuredPlayers.value[0] ?? null)
const honorableMentions = computed(() =>
  featuredPlayers.value
    .slice(1, 3)
    .map((player) => {
      const standing = standings.value.find((entry) => entry.name === player.name)

      return {
        ...player,
        rank: standing ? standings.value.findIndex((entry) => entry.name === player.name) + 1 : null,
        rankLabel: standing ? `League #${standings.value.findIndex((entry) => entry.name === player.name) + 1}` : 'League spotlight',
        gamesPlayed: standing?.gamesPlayed ?? 0,
        winRate: standing?.gamesPlayed ? Math.round((standing.baseWins / standing.gamesPlayed) * 100) : 0,
        avgPerGame: standing?.gamesPlayed ? standing.totalPoints / standing.gamesPlayed : 0,
      }
    }),
)

const spotlightStatTiles = computed<SpotlightStatTile[]>(() => {
  const playerNames = standings.value.map((player) => player.name)

  const buildPodWinTile = (playerCount: 3 | 4 | 5): SpotlightStatTile | null => {
    const entries = playerNames
      .map((playerName) => {
        const records = Object.values(gameRecords.value[playerName] ?? {})
          .filter((record) => record.playerCount === playerCount)
        const wins = records.filter((record) => record.placement === 1).length
        const gamesPlayed = records.length
        const winRate = gamesPlayed > 0 ? wins / gamesPlayed : 0

        return {
          name: playerName,
          wins,
          gamesPlayed,
          winRate,
        }
      })
      .filter((entry) => entry.wins > 0)
      .sort((a, b) => {
        if (b.wins !== a.wins) return b.wins - a.wins
        if (b.winRate !== a.winRate) return b.winRate - a.winRate
        if (a.gamesPlayed !== b.gamesPlayed) return a.gamesPlayed - b.gamesPlayed
        return a.name.localeCompare(b.name)
      })

    const leader = entries[0]
    if (!leader) return null

    return {
      key: `wins-${playerCount}`,
      label: `${playerCount}-Player Winner`,
      name: leader.name,
      value: pct(leader.winRate),
      detail: `${leader.wins} win${leader.wins === 1 ? '' : 's'} in ${leader.gamesPlayed} pod${leader.gamesPlayed === 1 ? '' : 's'}`,
      imageUrl: getPlayerPortrait(leader.name),
      initials: leader.name.slice(0, 2).toUpperCase(),
    }
  }

  const buildPlacementRateTile = (
    key: string,
    label: string,
    predicate: (placement: number, playerCount: number) => boolean,
  ): SpotlightStatTile | null => {
    const entries = playerNames
      .map((playerName) => {
        const records = Object.values(gameRecords.value[playerName] ?? {})
        const matches = records.filter((record) => predicate(record.placement, record.playerCount)).length
        const gamesPlayed = records.length
        const rate = gamesPlayed > 0 ? matches / gamesPlayed : 0

        return {
          name: playerName,
          matches,
          gamesPlayed,
          rate,
        }
      })
      .filter((entry) => entry.matches > 0)
      .sort((a, b) => {
        if (b.rate !== a.rate) return b.rate - a.rate
        if (b.matches !== a.matches) return b.matches - a.matches
        if (a.gamesPlayed !== b.gamesPlayed) return a.gamesPlayed - b.gamesPlayed
        return a.name.localeCompare(b.name)
      })

    const leader = entries[0]
    if (!leader) return null

    return {
      key,
      label,
      name: leader.name,
      value: pct(leader.rate),
      detail: `${leader.matches} of ${leader.gamesPlayed} game${leader.gamesPlayed === 1 ? '' : 's'}`,
      imageUrl: getPlayerPortrait(leader.name),
      initials: leader.name.slice(0, 2).toUpperCase(),
    }
  }

  return [
    buildPodWinTile(4),
    buildPodWinTile(5),
    buildPodWinTile(3),
    buildPlacementRateTile('second-place', 'Most 2nd Place', (placement) => placement === 2),
    buildPlacementRateTile('last-place', 'Most Last Place', (placement, playerCount) => placement === playerCount),
  ].filter((tile): tile is SpotlightStatTile => tile !== null)
})

function r3(n: number): number { return Math.round(n * 1000) / 1000 }

// ── Performance timeline chart ────────────────────────────────────────────────

const PERF_CHART_LAMBDA = 0.1
const PERF_CHART_COLORS = [
  '#f0c24b', '#7ab8ff', '#2c9c6a', '#cf5c73',
  '#b97cf3', '#f97316', '#22d3ee', '#a78bfa',
  '#fb923c', '#34d399',
]

function computeWeightedScore(records: PlayerGameRecord[]): number {
  if (records.length === 0) return 0
  let weightedSum = 0
  let totalWeight = 0
  for (let i = 0; i < records.length; i++) {
    const age = records.length - 1 - i
    const weight = Math.exp(-PERF_CHART_LAMBDA * age)
    weightedSum += weight * records[i].finalPoints
    totalWeight += weight
  }
  return totalWeight > 0 ? r3(weightedSum / totalWeight) : 0
}

const activeChart = ref<'performance' | 'total'>('performance')

function fmtGameDate(date: string | Date) {
  return new Date(date).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

const performanceChartData = computed<{ labels: string[], series: PerformancePlayerSeries[] }>(() => {
  const games = chronologicalGames.value
  if (games.length === 0) return { labels: [], series: [] }

  const labels = games.map((game) => fmtGameDate(game.date))
  const playerNames = standings.value.map((s) => s.name)

  const series: PerformancePlayerSeries[] = playerNames
    .map((playerName, index) => {
      const accumulated: PlayerGameRecord[] = []
      const data: (number | null)[] = []

      for (const game of games) {
        const record = gameRecords.value[playerName]?.[game.gameId]
        if (record) {
          accumulated.push(record)
          data.push(computeWeightedScore(accumulated))
        } else {
          data.push(null)
        }
      }

      return {
        name: playerName,
        color: PERF_CHART_COLORS[index % PERF_CHART_COLORS.length],
        data,
      }
    })
    .filter((s) => s.data.some((v) => v !== null))

  return { labels, series }
})

const totalPointsChartData = computed<{ labels: string[], series: PerformancePlayerSeries[] }>(() => {
  const games = chronologicalGames.value
  if (games.length === 0) return { labels: [], series: [] }

  const labels = games.map((game) => fmtGameDate(game.date))
  const playerNames = standings.value.map((s) => s.name)

  const series: PerformancePlayerSeries[] = playerNames
    .map((playerName, index) => {
      const data: number[] = []
      let lastScore = 0

      for (const game of games) {
        const snapshot = leagueSnapshots.value[game.gameId]?.[playerName]
        if (snapshot) {
          lastScore = snapshot.totalScore
        }
        data.push(lastScore)
      }

      return {
        name: playerName,
        color: PERF_CHART_COLORS[index % PERF_CHART_COLORS.length],
        data,
      }
    })
    .filter((s) => s.data.some((v) => v > 0))

  return { labels, series }
})

const currentChartStandings = computed<ChartStandingRow[]>(() => {
  const chartData = activeChart.value === 'performance'
    ? performanceChartData.value
    : totalPointsChartData.value

  const standingOrder = new Map(
    standings.value.map((player, index) => [player.name, index]),
  )

  return chartData.series
    .map((series) => {
      const latestValue = [...series.data].reverse().find((value): value is number => typeof value === 'number')
      return latestValue === undefined
        ? null
        : {
            name: series.name,
            points: latestValue,
            imageUrl: getPlayerPortrait(series.name),
            initials: series.name.slice(0, 2).toUpperCase(),
          }
    })
    .filter((player): player is Omit<ChartStandingRow, 'rank'> => player !== null)
    .sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points
      const aStanding = standingOrder.get(a.name) ?? Number.MAX_SAFE_INTEGER
      const bStanding = standingOrder.get(b.name) ?? Number.MAX_SAFE_INTEGER
      if (aStanding !== bStanding) return aStanding - bStanding
      return a.name.localeCompare(b.name)
    })
    .map((player, index) => ({
      rank: index + 1,
      ...player,
    }))
})

function getPlayerPortrait(playerName: string) {
  return playerPortraits[playerName.toLowerCase()] ?? ''
}

function toggleSort(key: SortKey) {
  if (sortKey.value === key) {
    sortDirection.value = sortDirection.value === 'desc' ? 'asc' : 'desc'
    return
  }

  sortKey.value = key
  sortDirection.value = 'desc'
}

function sortIndicator(key: SortKey) {
  if (sortKey.value !== key) return '↕'
  return sortDirection.value === 'desc' ? '↓' : '↑'
}


function rankLabel(rank: number) {
  return ['🥇', '🥈', '🥉'][rank - 1] ?? `${rank}.`
}

function fmt(n: number | null | undefined): string {
  if (typeof n !== 'number' || Number.isNaN(n)) return '0'
  if (n === 0) return '0'
  return n % 1 === 0 ? String(n) : n.toFixed(3).replace(/\.?0+$/, '')
}

function pct(n: number): string {
  return `${(n * 100).toFixed(1).replace(/\.0$/, '')}%`
}

// ── Commander tooltip ─────────────────────────────────────────────────────────

const OFFSET_X = 16
const OFFSET_Y = 16

const hover = reactive({ visible: false, playerName: '', commanderName: '', x: 0, y: 0 })

function calcPosition(e: MouseEvent) {
  let x = e.clientX + OFFSET_X
  let y = e.clientY + OFFSET_Y
  if (x + 240 > window.innerWidth) x = e.clientX - 240 - OFFSET_X
  if (y + 380 > window.innerHeight) y = e.clientY - 380 - OFFSET_Y
  return { x: x + window.scrollX, y: y + window.scrollY }
}

function onCommanderEnter(playerName: string, commanderName: string, e: MouseEvent) {
  hover.playerName = playerName
  hover.commanderName = commanderName
  hover.visible = true
  const pos = calcPosition(e)
  hover.x = pos.x
  hover.y = pos.y
}

function onMouseMove(e: MouseEvent) {
  if (catchupHover.visible) {
    const pos = calcCatchupPosition(e)
    catchupHover.x = pos.x
    catchupHover.y = pos.y
  }
  if (hover.visible) {
    const pos = calcPosition(e)
    hover.x = pos.x
    hover.y = pos.y
  }
  if (achvHover.visible) {
    const pos = calcAchvPosition(e)
    achvHover.x = pos.x
    achvHover.y = pos.y
  }
  if (xpHover.visible) {
    const pos = calcXpPosition(e)
    xpHover.x = pos.x
    xpHover.y = pos.y
  }
  if (multHover.visible) {
    const pos = calcMultPosition(e)
    multHover.x = pos.x
    multHover.y = pos.y
  }
  if (compHover.visible) {
    const pos = calcCompPosition(e)
    compHover.x = pos.x
    compHover.y = pos.y
  }
}

function onCommanderLeave() {
  hover.visible = false
}

// ── Achievement tooltip ───────────────────────────────────────────────────────

const achvHover = reactive({ visible: false, playerName: '', commanderName: '', x: 0, y: 0 })

function calcAchvPosition(e: MouseEvent) {
  let x = e.clientX + OFFSET_X
  let y = e.clientY + OFFSET_Y
  if (x + 220 > window.innerWidth) x = e.clientX - 220 - OFFSET_X
  if (y + 300 > window.innerHeight) y = e.clientY - 300 - OFFSET_Y
  return { x: x + window.scrollX, y: y + window.scrollY }
}

function onAchvEnter(playerName: string, e: MouseEvent, commanderName = '') {
  achvHover.playerName = playerName
  achvHover.commanderName = commanderName
  achvHover.visible = true
  const pos = calcAchvPosition(e)
  achvHover.x = pos.x
  achvHover.y = pos.y
}

function onAchvLeave() {
  achvHover.visible = false
  achvHover.commanderName = ''
}

// ── XP tooltip ────────────────────────────────────────────────────────────────

const xpHover = reactive({ visible: false, playerName: '', x: 0, y: 0 })

function calcXpPosition(e: MouseEvent) {
  let x = e.clientX + OFFSET_X
  let y = e.clientY + OFFSET_Y
  if (x + 260 > window.innerWidth) x = e.clientX - 260 - OFFSET_X
  if (y + 420 > window.innerHeight) y = e.clientY - 420 - OFFSET_Y
  return { x: x + window.scrollX, y: y + window.scrollY }
}

function onXpEnter(playerName: string, e: MouseEvent) {
  xpHover.playerName = playerName
  xpHover.visible = true
  const pos = calcXpPosition(e)
  xpHover.x = pos.x
  xpHover.y = pos.y
}

function onXpLeave() {
  xpHover.visible = false
}

// ── Mult tooltip ──────────────────────────────────────────────────────────────

type MultHoverData = {
  visible: boolean
  x: number
  y: number
  winRate: number
  winRateFraction: number
  winRateTerm: number
  avgPerGame: number
  leagueAvgPerGame: number
  avgFraction: number
  avgTerm: number
  perfMultRaw: number
  perfMult: number
}

const multHover = reactive<MultHoverData>({
  visible: false,
  x: 0, y: 0,
  winRate: 0,
  winRateFraction: 0,
  winRateTerm: 0,
  avgPerGame: 0,
  leagueAvgPerGame: 0,
  avgFraction: 0,
  avgTerm: 0,
  perfMultRaw: 0,
  perfMult: 1,
})

type CompensationHoverData = {
  visible: boolean
  x: number
  y: number
  mode: StandingsAdjustmentMode
  title: string
  totalLabel: string
  totalDetail: string
  displayPoints: number
  gamesPlayed: number
  missingGames: number
  cappedMissingGames: number
  maxGamesPlayed: number
  leagueFloorScore: number
  averageScore: number
  sampleFactor: number
  decayFactor: number
  gameValueFactor: number
  maxProjectedGames: number
  sampleSmoothingGames: number
  baselineAvgPoints: number
  consecutiveMissPenalty: number
  minimumAvgPoints: number
  lowestGamesPlayed: number
  gameGap: number
  penaltyFactor: number
}

type CatchupRow = {
  name: string
  totalPoints: number
  adjustmentPoints: number
  adjustedTotalPoints: number
  gamesPlayed: number
  avgPerGame: number
}

const compHover = reactive<CompensationHoverData>({
  visible: false,
  x: 0,
  y: 0,
  mode: 'compensation',
  title: 'Compensation',
  totalLabel: 'Total Comp.',
  totalDetail: 'added after ×Mult',
  displayPoints: 0,
  gamesPlayed: 0,
  missingGames: 0,
  cappedMissingGames: 0,
  maxGamesPlayed: 0,
  leagueFloorScore: 0,
  averageScore: 0,
  sampleFactor: 0,
  decayFactor: 0,
  gameValueFactor: 0,
  maxProjectedGames: 0,
  sampleSmoothingGames: 0,
  baselineAvgPoints: 0,
  consecutiveMissPenalty: 0,
  minimumAvgPoints: 0,
  lowestGamesPlayed: 0,
  gameGap: 0,
  penaltyFactor: 0,
})

type CatchupHoverData = {
  visible: boolean
  x: number
  y: number
  targetName: string
  gap: number
  avgPerGame: number
  nextCompDelta: number
  nextNetGain: number
  gamesNeededLabel: string
  message: string
}

const catchupHover = reactive<CatchupHoverData>({
  visible: false,
  x: 0,
  y: 0,
  targetName: '',
  gap: 0,
  avgPerGame: 0,
  nextCompDelta: 0,
  nextNetGain: 0,
  gamesNeededLabel: '',
  message: '',
})

function calcMultPosition(e: MouseEvent) {
  let x = e.clientX + OFFSET_X
  let y = e.clientY + OFFSET_Y
  if (x + 240 > window.innerWidth) x = e.clientX - 240 - OFFSET_X
  if (y + 200 > window.innerHeight) y = e.clientY - 200 - OFFSET_Y
  return { x: x + window.scrollX, y: y + window.scrollY }
}

function calcCompPosition(e: MouseEvent) {
  let x = e.clientX + OFFSET_X
  let y = e.clientY + OFFSET_Y
  if (x + 320 > window.innerWidth) x = e.clientX - 320 - OFFSET_X
  if (y + 320 > window.innerHeight) y = e.clientY - 320 - OFFSET_Y
  return { x: x + window.scrollX, y: y + window.scrollY }
}

function calcCatchupPosition(e: MouseEvent) {
  let x = e.clientX + OFFSET_X
  let y = e.clientY + OFFSET_Y
  if (x + 320 > window.innerWidth) x = e.clientX - 320 - OFFSET_X
  if (y + 240 > window.innerHeight) y = e.clientY - 240 - OFFSET_Y
  return { x: x + window.scrollX, y: y + window.scrollY }
}

function onMultEnter(row: MultRow, e: MouseEvent) {
  multHover.visible = true
  multHover.winRate = row.winRate
  multHover.winRateFraction = row.winRateFraction
  multHover.winRateTerm = row.winRateTerm
  multHover.avgPerGame = row.avgPerGame
  multHover.leagueAvgPerGame = row.leagueAvgPerGame
  multHover.avgFraction = row.avgFraction
  multHover.avgTerm = row.avgTerm
  multHover.perfMultRaw = row.perfMultRaw
  multHover.perfMult = row.perfMult
  const pos = calcMultPosition(e)
  multHover.x = pos.x
  multHover.y = pos.y
}

function onMultLeave() {
  multHover.visible = false
}

function estimateCatchup(target: CatchupRow) {
  const viewerName = loggedInPlayerName.value
  if (!viewerName || target.name === viewerName) return null

  const viewer = table.value.find((row) => row.name === viewerName)
  if (!viewer) return null

  const gap = r3(target.adjustedTotalPoints - viewer.adjustedTotalPoints)
  const avgPerGame = viewer.avgPerGame
  const currentAdjustmentPoints = viewer.adjustmentPoints

  if (gap <= 0) {
    return {
      gap,
      avgPerGame,
      nextCompDelta: 0,
      nextNetGain: 0,
      gamesNeededLabel: '0',
      message: 'already ahead',
    }
  }

  let nextCompDelta = 0
  let nextNetGain = 0
  let gamesNeeded: number | null = null

  for (let games = 1; games <= 250; games++) {
    const totalPoints = r3(viewer.totalPoints + (avgPerGame * games))
    const gamesPlayed = viewer.gamesPlayed + games
    const simulatedPlayerMap = {
      ...players.value,
      [viewerName]: {
        name: viewerName,
        totalPoints,
        gamesPlayed,
      },
    }
    const adjustment = calculateStandingsAdjustment(
      { name: viewerName, totalPoints, gamesPlayed },
      simulatedPlayerMap,
      settings.value,
      { games: chronologicalGames.value, gameRecords: gameRecords.value },
    )
    const adjustedTotalPoints = r3(totalPoints + adjustment.adjustmentPoints)

    if (games === 1) {
      nextCompDelta = r3(adjustment.adjustmentPoints - currentAdjustmentPoints)
      nextNetGain = r3(adjustedTotalPoints - viewer.adjustedTotalPoints)
    }

    if (adjustedTotalPoints >= target.adjustedTotalPoints) {
      gamesNeeded = games
      break
    }
  }

  return {
    gap,
    avgPerGame,
    nextCompDelta,
    nextNetGain,
    gamesNeededLabel: gamesNeeded === null ? '—' : String(gamesNeeded),
    message: gamesNeeded === null ? 'not reachable at current pace' : 'games at your current pace',
  }
}

function onPlayerEnter(row: CatchupRow, e: MouseEvent) {
  const estimate = estimateCatchup(row)
  if (!estimate) return

  catchupHover.visible = true
  catchupHover.targetName = row.name
  catchupHover.gap = estimate.gap
  catchupHover.avgPerGame = estimate.avgPerGame
  catchupHover.nextCompDelta = estimate.nextCompDelta
  catchupHover.nextNetGain = estimate.nextNetGain
  catchupHover.gamesNeededLabel = estimate.gamesNeededLabel
  catchupHover.message = estimate.message
  const pos = calcCatchupPosition(e)
  catchupHover.x = pos.x
  catchupHover.y = pos.y
}

function onPlayerLeave() {
  catchupHover.visible = false
}

function onCompEnter(row: CompensationRow, e: MouseEvent) {
  compHover.visible = true
  compHover.mode = row.adjustmentMode
  compHover.title = row.adjustmentMode === 'freeGames'
    ? 'Free Games'
    : row.adjustmentMode === 'penaltyGames'
      ? 'Penalty'
      : 'Compensation'
  compHover.totalLabel = row.adjustmentMode === 'penaltyGames' ? 'Total Penalty' : row.adjustmentMode === 'freeGames' ? 'Total Free Games' : 'Total Comp.'
  compHover.totalDetail = row.adjustmentMode === 'penaltyGames'
    ? 'subtracted after ×Mult'
    : row.adjustmentMode === 'freeGames'
      ? 'kept permanently outside avg / game'
      : 'added after ×Mult'
  compHover.displayPoints = row.adjustmentDisplayPoints
  compHover.gamesPlayed = row.gamesPlayed
  compHover.missingGames = row.projectionMissingGames
  compHover.cappedMissingGames = row.projectionCappedMissingGames
  compHover.maxGamesPlayed = row.projectionMaxGamesPlayed
  compHover.leagueFloorScore = row.projectionLeagueFloorScore
  compHover.averageScore = row.projectionAverageScore
  compHover.sampleFactor = row.projectionSampleFactor
  compHover.decayFactor = row.projectionDecayFactor
  compHover.gameValueFactor = row.projectionGameValueFactor
  compHover.maxProjectedGames = row.projectionMaxProjectedGames
  compHover.sampleSmoothingGames = row.projectionSampleSmoothingGames
  compHover.baselineAvgPoints = row.freeGamesBaselineAvg
  compHover.consecutiveMissPenalty = row.freeGamesConsecutivePenalty
  compHover.minimumAvgPoints = row.freeGamesMinimumAvg
  compHover.lowestGamesPlayed = row.penaltyLowestGamesPlayed
  compHover.gameGap = row.penaltyGameGap
  compHover.penaltyFactor = row.penaltyFactor
  const pos = calcCompPosition(e)
  compHover.x = pos.x
  compHover.y = pos.y
}

function onCompLeave() {
  compHover.visible = false
}
</script>

<style lang="scss" scoped>
.dash-loader {
  position: fixed;
  inset: 0;
  z-index: 10;
  display: grid;
  place-items: center;

  &__inner {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: $spacing-3;
  }

  &__dots {
    display: flex;
    gap: 7px;

    span {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: $color-primary-light;
      animation: page-loader-dot 1.4s ease-in-out infinite;

      &:nth-child(2) { animation-delay: 0.15s; }
      &:nth-child(3) { animation-delay: 0.3s; }
    }
  }

  &__label {
    font-size: $font-size-xs;
    letter-spacing: 0.05em;
    color: $color-text-muted;
  }

  &__track {
    width: min(100%, 220px);
    height: 3px;
    border-radius: 2px;
    background: rgba($color-primary-light, 0.1);
    overflow: hidden;
  }

  &__fill {
    height: 100%;
    border-radius: inherit;
    background: linear-gradient(90deg, $color-primary, $color-primary-light);
    transition: width 0.25s ease;
  }
}

.dashboard__title {
  font-size: $font-size-xl;
  font-weight: $font-weight-bold;
  color: $color-text;
  margin-bottom: $spacing-6;
}

.dashboard__prize-pool {
  margin-top: $spacing-4;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: $spacing-3;
  padding: $spacing-3 $spacing-4;
  border: 1px solid rgba($color-primary-light, 0.16);
  border-radius: $border-radius-lg;
  background:
    linear-gradient(180deg, rgba($color-primary, 0.08), rgba(255, 255, 255, 0.02)),
    rgba(7, 10, 16, 0.72);

  &-label {
    color: $color-text-muted;
    font-size: $font-size-xs;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    font-weight: $font-weight-semibold;
  }

  &-value {
    color: $color-secondary;
    font-size: $font-size-lg;
    font-weight: $font-weight-bold;
  }
}

.dashboard__looster-section {
  margin-top: $spacing-4;
}

.dashboard__looster-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: $spacing-3;
  margin-bottom: $spacing-3;
}

.dashboard__looster-title {
  margin: 0;
  color: $color-text;
  font-size: $font-size-lg;
  font-weight: $font-weight-bold;
}

.dashboard__looster-subtitle {
  margin: 0;
  color: $color-text-muted;
  font-size: $font-size-sm;
}

.dashboard__looster-wrap {
  overflow-x: auto;
  border: 1px solid rgba($color-primary-light, 0.16);
  border-radius: $border-radius-lg;
  background:
    linear-gradient(180deg, rgba($color-primary, 0.06), rgba(255, 255, 255, 0.02)),
    rgba(7, 10, 16, 0.72);
}

.looster-table {
  width: 100%;
  min-width: 1100px;
  border-collapse: collapse;

  &__th,
  &__td {
    padding: $spacing-3 $spacing-4;
    border-bottom: 1px solid rgba($border-color, 0.42);
    text-align: left;
    vertical-align: middle;
  }

  &__th {
    color: $color-text-muted;
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    font-weight: $font-weight-semibold;
    background: rgba(0, 0, 0, 0.14);
    white-space: nowrap;
  }

  &__row:last-child &__td {
    border-bottom: none;
  }

  &__td {
    color: $color-text;
    font-size: $font-size-sm;
  }

  &__th--num,
  &__td--num {
    text-align: center;
  }

  &__th--set,
  &__td--set {
    text-align: center;
  }

  &__player-link {
    color: $color-text;
    text-decoration: none;
    font-weight: $font-weight-semibold;

    &:hover {
      color: $color-primary-light;
    }
  }

  &__set-link {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: $spacing-2;
    color: $color-text;
    text-decoration: none;
    font-weight: $font-weight-semibold;

    &:hover {
      color: $color-primary-light;
    }
  }

  &__set-icon {
    width: 18px;
    height: 18px;
    display: block;
    object-fit: contain;
    filter: brightness(0) invert(1) drop-shadow(0 4px 8px rgba(0, 0, 0, 0.35));
  }

  &__td--available {
    font-weight: $font-weight-bold;
  }

  &__td--available-yes {
    color: $color-success;
  }

  &__td--available-no {
    color: $color-danger;
  }

  &__td--spent {
    color: #f08bb4;
    font-weight: $font-weight-semibold;
  }
}


.dashboard__spotlight {
  display: grid;
  grid-template-columns: 180px minmax(0, 1fr);
  margin: $spacing-8 0;
  border: 1px solid rgba($color-primary-light, 0.18);
  border-radius: $border-radius-xl;
  overflow: hidden;
  backdrop-filter: blur(3px);
  background: linear-gradient(45deg, black, rgba(100, 24, 140, 0.1));
  box-shadow:
    inset 0 0 0 1px rgba(255, 240, 214, 0.03),
    $shadow-lg;

  &--no-art {
    grid-template-columns: 1fr;
  }

  &-art {
    position: relative;
    display: flex;
    align-items: stretch;
    justify-content: center;
    padding: $spacing-3;
  }

  &-art-img {
    width: 100%;
    display: block;
    object-fit: cover;
    object-position: center top;
    border-radius: $border-radius-lg;
  }

  &-art-placeholder {
    width: 100%;
    aspect-ratio: 1 / 1;
    display: grid;
    place-items: center;
    font-size: 1.8rem;
    font-weight: $font-weight-bold;
    letter-spacing: 0.08em;
    color: rgba($color-text, 0.9);
    border-radius: $border-radius-lg;
    background:
      radial-gradient(circle at top, rgba($color-primary-light, 0.18), transparent 55%),
      linear-gradient(180deg, rgba(22, 28, 38, 0.92), rgba(8, 11, 17, 0.96));
  }

  &-art-overlay {
    position: absolute;
    inset: 0;
    background:
      linear-gradient(180deg, rgba(11, 8, 6, 0.02), rgba(11, 8, 6, 0.45)),
      linear-gradient(90deg, rgba(11, 8, 6, 0), rgba(11, 8, 6, 0.25));
  }

  &-body {
    padding: $spacing-4;
    display: flex;
    flex-direction: row;
    gap: $spacing-4;
    align-items: flex-start;
  }

  &-player {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: $spacing-2;
  }

  &-eyebrow {
    color: $color-primary-light;
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    font-weight: $font-weight-semibold;
  }

  &-name {
    font-size: $font-size-xl;
    font-family: $font-family-display;
    font-weight: $font-weight-bold;
    line-height: 1;
    color: $color-text;
    text-decoration: none;

    &:hover {
      color: $color-primary-light;
    }
  }

  &-player-title {
    font-size: $font-size-xs;
    font-weight: $font-weight-semibold;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: rgba($color-secondary, 0.88);
  }

  &-summary {
    margin: 0;
    max-width: 60ch;
    color: $color-text-muted;
    font-size: $font-size-sm;
  }

  &-reasons {
    margin: 0;
    padding: 0;
    list-style: none;
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: $spacing-3;
  }

  &-reason {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: $spacing-3;
    border-radius: $border-radius-lg;
    background: rgba(10, 0, 30, 0.25);
    border: 1px solid rgba($border-color, 0.72);
    font-size: $font-size-sm;
    color: $color-text;
    font-weight: $font-weight-semibold;
    line-height: 1.4;
  }

  &-honorable {
    flex: 0 1 320px;
    min-width: 260px;
    display: flex;
    flex-direction: column;
    gap: $spacing-2;
  }

  &-honorable-label {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    font-weight: $font-weight-semibold;
    color: rgba($color-secondary, 0.8);
  }

  &-honorable-list {
    display: flex;
    flex-direction: column;
    gap: $spacing-2;
  }

  &-mention {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: $spacing-3;
    border-radius: $border-radius-lg;
    border: 1px solid rgba($color-primary-light, 0.16);
    background:
      linear-gradient(180deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.02)),
      rgba(7, 10, 16, 0.72);
    box-shadow:
      inset 0 0 0 1px rgba(255, 255, 255, 0.02),
      0 8px 24px rgba(0, 0, 0, 0.18);
    color: inherit;
    text-decoration: none;
    transition: border-color $transition-fast, transform $transition-fast, background $transition-fast, box-shadow $transition-fast;

    &:hover {
      transform: translateY(-2px);
      border-color: rgba($color-primary-light, 0.34);
      background:
        linear-gradient(180deg, rgba($color-primary, 0.08), rgba(255, 255, 255, 0.03)),
        rgba(7, 10, 16, 0.78);
      box-shadow:
        inset 0 0 0 1px rgba(255, 255, 255, 0.03),
        0 12px 28px rgba(0, 0, 0, 0.24);
    }
  }

  &-mention-rank {
    align-self: flex-start;
    font-size: 10px;
    font-weight: $font-weight-bold;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: rgba($color-primary-light, 0.88);
    background: rgba($color-primary, 0.14);
    border: 1px solid rgba($color-primary, 0.24);
    border-radius: $border-radius-full;
    padding: 3px 8px;
    line-height: 1;
  }

  &-mention-header {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  &-mention-name {
    color: $color-text;
    font-weight: $font-weight-semibold;
    line-height: 1.1;
  }

  &-mention-title {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: rgba($color-primary-light, 0.78);
  }

  &-mention-summary {
    margin: 0;
    color: rgba($color-text-muted, 0.95);
    font-size: $font-size-xs;
    line-height: 1.45;
  }

  &-mention-stats {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;

    span {
      font-size: 10px;
      color: rgba($color-text, 0.86);
      background: rgba($color-primary, 0.08);
      border: 1px solid rgba($color-primary-light, 0.14);
      border-radius: $border-radius-full;
      padding: 2px 8px;
      white-space: nowrap;
    }
  }

  &-aside {
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: $spacing-1;
  }

  &-aside-label {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    font-weight: $font-weight-semibold;
    color: rgba($color-danger, 0.65);
  }

  :deep(.arch-enemy-card) {
    background: rgba(0, 0, 0, 0.25);
    align-items: flex-end;
  }

  &-stats {
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    gap: $spacing-3;
  }

  &-stat {
    aspect-ratio: 1 / 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    gap: $spacing-2;
    padding: $spacing-3;
    border-radius: $border-radius-lg;
    border: 1px solid rgba($color-primary-light, 0.18);
    background:
      linear-gradient(180deg, rgba($color-primary, 0.08), rgba(255, 255, 255, 0.02)),
      rgba(7, 10, 16, 0.72);
    box-shadow:
      inset 0 0 0 1px rgba(255, 255, 255, 0.02),
      0 10px 24px rgba(0, 0, 0, 0.16);
    color: inherit;
    text-decoration: none;
    transition: transform $transition-fast, border-color $transition-fast, background $transition-fast;

    &:hover {
      transform: translateY(-2px);
      border-color: rgba($color-primary-light, 0.34);
      background:
        linear-gradient(180deg, rgba($color-primary, 0.14), rgba(255, 255, 255, 0.03)),
        rgba(7, 10, 16, 0.8);
    }
  }

  &-stat-label {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    font-weight: $font-weight-semibold;
    color: rgba($color-primary-light, 0.82);
    line-height: 1.35;
  }

  &-stat-player {
    display: flex;
    align-items: center;
    gap: $spacing-2;
    min-width: 0;
  }

  &-stat-avatar {
    width: 42px;
    height: 42px;
    border-radius: $border-radius-md;
    object-fit: cover;
    object-position: center top;
    border: 1px solid rgba($color-primary-light, 0.26);
    flex-shrink: 0;

    &--fallback {
      display: inline-grid;
      place-items: center;
      background:
        radial-gradient(circle at top, rgba($color-primary-light, 0.18), transparent 60%),
        rgba(18, 22, 30, 0.95);
      color: $color-text;
      font-size: 11px;
      font-weight: $font-weight-bold;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }
  }

  &-stat-name {
    min-width: 0;
    font-size: $font-size-sm;
    font-weight: $font-weight-semibold;
    line-height: 1.2;
    color: $color-text;
  }

  &-stat-value {
    font-size: clamp(1.4rem, 2vw, 1.8rem);
    font-weight: $font-weight-bold;
    line-height: 1;
    color: $color-secondary;
  }

  &-stat-detail {
    font-size: 10px;
    line-height: 1.4;
    color: rgba($color-text-muted, 0.95);
  }
}

.dashboard__perf-section {
  margin: $spacing-8 0;
  display: flex;
  flex-direction: column;
  gap: $spacing-3;
}

.dashboard__spotlight-stats-section {
  margin: 0 0 $spacing-8;
}

.dashboard__perf-switcher {
  display: flex;
  gap: $spacing-2;
}

.dashboard__perf-switch {
  padding: 4px 14px;
  border-radius: $border-radius-full;
  border: 1px solid rgba($border-color, 0.6);
  background: transparent;
  color: $color-text-muted;
  font-size: $font-size-xs;
  font-weight: $font-weight-medium;
  cursor: pointer;
  transition: color $transition-fast, border-color $transition-fast, background $transition-fast;

  &:hover {
    color: $color-text;
    border-color: rgba($color-primary-light, 0.4);
  }

  &--active {
    color: $color-text;
    border-color: rgba($color-primary-light, 0.5);
    background: rgba($color-primary, 0.12);
  }
}

.dashboard__perf-ranking {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: $spacing-2;
}

.dashboard__perf-player {
  display: grid;
  grid-template-columns: auto auto minmax(0, 1fr) auto;
  align-items: center;
  gap: $spacing-2;
  padding: $spacing-2 $spacing-3;
  border-radius: $border-radius-lg;
  border: 1px solid rgba($border-color, 0.7);
  background: rgba(0, 0, 0, 0.22);
  color: $color-text;
  text-decoration: none;
  transition: border-color $transition-fast, background $transition-fast, transform $transition-fast;

  &:hover {
    border-color: rgba($color-primary-light, 0.38);
    background: rgba($color-primary, 0.08);
    transform: translateY(-1px);
  }

  &-rank {
    min-width: 1.8rem;
    color: $color-primary-light;
    font-size: $font-size-sm;
    text-align: center;
  }

  &-icon {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    object-fit: cover;
    object-position: center top;
    border: 1px solid rgba($color-primary-light, 0.28);
    flex-shrink: 0;

    &--fallback {
      display: inline-grid;
      place-items: center;
      background:
        radial-gradient(circle at top, rgba($color-primary-light, 0.18), transparent 60%),
        rgba(18, 22, 30, 0.95);
      color: $color-text;
      font-size: 10px;
      font-weight: $font-weight-bold;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }
  }

  &-name {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-weight: $font-weight-medium;
  }

  &-points {
    font-variant-numeric: tabular-nums;
    color: $color-secondary;
    font-weight: $font-weight-semibold;
  }
}

.standings-wrap {
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}

.standings {
  width: 100%;
  background: rgba(0, 0, 0, 0.25);
  border-collapse: collapse;
  font-size: $font-size-sm;

  &__th {
    text-align: left;
    padding: $spacing-2 $spacing-3;
    color: $color-text-muted;
    font-size: $font-size-xs;
    text-transform: uppercase;
    letter-spacing: 0.07em;
    font-weight: $font-weight-medium;
    border-bottom: 1px solid $border-color;
    white-space: nowrap;

    &--num  { text-align: right; }
    &--rank { width: 2.5rem; text-align: center; }
    &--commander {
      width: 220px;
      min-width: 220px;
      white-space: normal;
      line-height: 1.2;
    }
    &--mult { color: $color-text-muted; font-size: $font-size-xs; }
  }

  &__sort-button {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 0;
    border: 0;
    background: transparent;
    color: inherit;
    font: inherit;
    letter-spacing: inherit;
    text-transform: inherit;
    cursor: pointer;

    &:hover {
      color: $color-text;
    }

    &--num {
      width: 100%;
      justify-content: flex-end;
    }
  }

  &__sort-indicator {
    min-width: 10px;
    color: $color-primary-light;
    text-align: center;
  }

  &__row {
    border-bottom: 1px solid rgba($border-color, 0.5);
    transition: background $transition-fast;

    &:hover {
      background: rgba(16, 16, 16, 0.35);
      backdrop-filter: blur(3px);
    }

    &--top3 {
      background: rgba($color-primary, 0.05);
    }

    &--top2 {
      background: rgba($color-primary, 0.1);
    }

    &--top1 {
      background: rgba($color-primary, 0.15);
    }

    &--self {
      background:
        linear-gradient(90deg, rgba(214, 170, 74, 0.16), rgba(214, 170, 74, 0.04)),
        rgba(16, 16, 16, 0.22);
    }
  }

  &__td {
    padding: $spacing-2 $spacing-3;
    color: $color-text;
    vertical-align: middle;

    &--num { text-align: right; font-variant-numeric: tabular-nums; }
    &--rank { text-align: center; }
    &--total { font-weight: $font-weight-bold; color: $color-secondary; }
    &--achv  { color: $color-accent; }
    &--hoverable { cursor: default; text-decoration: underline dotted $color-accent; }
    &--hoverable-xp { cursor: default; text-decoration: underline dotted $color-primary-light; }
    &--xp    { color: $color-primary-light; }
    &--comp  { color: #f08bb4; }
    &--hoverable-comp { cursor: default; text-decoration: underline dotted #f08bb4; }
    &--lp    { color: $color-danger; }
    &--mult  { color: $color-text-muted; font-size: $font-size-xs; }
    &--hoverable-mult { cursor: default; text-decoration: underline dotted $color-text-muted; }
  }

  &__row--self &__td {
    border-top: 2px solid rgba(214, 170, 74, 0.95);
    border-bottom: 2px solid rgba(214, 170, 74, 0.95);
  }

  &__row--self &__td:first-child {
    border-left: 2px solid rgba(214, 170, 74, 0.95);
  }

  &__row--self &__td:last-child {
    border-right: 2px solid rgba(214, 170, 74, 0.95);
  }

  &__rank {
    font-size: $font-size-base;

    &--1, &--2, &--3 { font-size: $font-size-base; }
  }

  &__commander-name {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    cursor: default;
    white-space: nowrap;

    &:hover {
      cursor:pointer;
      color: $color-primary-light;
      text-decoration: underline dotted;
    }
  }

  &__muted {
    color: $color-text-muted;
  }

  &__pairing-name {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
  }

  &__pairing-separator {
    color: $color-text-muted;
  }

  &__player-link {
    color: $color-text;
    text-decoration: none;

    &:hover {
      color: $color-primary-light;
      text-decoration: underline dotted;
    }
  }
}

@media (max-width: $breakpoint-md) {
  .dashboard__spotlight {
    grid-template-columns: 1fr;

    &-art {
      max-height: 120px;
      padding: $spacing-2 $spacing-3;
    }

    &-art-img {
      max-height: 100px;
      width: auto;
      max-width: 100%;
      margin: 0 auto;
    }

    &-body {
      flex-direction: column;
    }

    &-honorable {
      min-width: 0;
    }

    &-aside {
      align-items: flex-start;
    }

    &-stats {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }
}

@media (max-width: $breakpoint-sm) {
  .dashboard__title {
    font-size: $font-size-xl;
  }

  .dashboard__subtitle {
    font-size: $font-size-base;
  }

  .dashboard__spotlight {
    &-art {
      max-height: 90px;
    }

    &-art-img {
      max-height: 74px;
    }

    &-body {
      padding: $spacing-3;
    }

    &-reasons {
      grid-template-columns: 1fr;
    }

    &-name {
      font-size: $font-size-lg;
    }

    &-stats {
      grid-template-columns: 1fr;
    }

    &-stat {
      aspect-ratio: auto;
      min-height: 150px;
    }
  }
}
</style>

<style lang="scss">
.floating-panel {
  position: absolute;
  z-index: 9999;
  pointer-events: none;
}

.mult-tooltip {
  background: $color-bg-elevated;
  border: 1px solid $border-color;
  border-radius: $border-radius-md;
  padding: $spacing-3;
  min-width: 220px;

  &__title {
    font-size: $font-size-xs;
    font-weight: $font-weight-bold;
    color: $color-text-muted;
    text-transform: uppercase;
    letter-spacing: 0.07em;
    margin-bottom: $spacing-2;
  }

  &__table {
    width: 100%;
    border-collapse: collapse;
    font-size: $font-size-xs;
  }

  &__label {
    color: $color-text-muted;
    padding: 2px 0;
    white-space: nowrap;
  }

  &__op {
    color: $color-text-muted;
    text-align: center;
    padding: 0 $spacing-1;
  }

  &__detail {
    color: $color-text-muted;
    padding: 0 $spacing-2;
    font-variant-numeric: tabular-nums;
  }

  &__value {
    text-align: right;
    color: $color-text;
    font-variant-numeric: tabular-nums;
    font-weight: $font-weight-medium;
    padding-left: $spacing-2;
  }

  &__row--sep td {
    border-top: 1px solid $border-color;
    padding-top: $spacing-1;
    color: $color-text;
    font-weight: $font-weight-bold;
  }

  &__label--clamped {
    color: $color-accent;
  }
}
</style>
