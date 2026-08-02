<template>
  <div class="page page--dashboard">
    <div class="dashboard__heading">
      <h1 class="dashboard__title">Standings</h1>
      <div v-if="isAdmin && isPlayerRatingMode" class="dashboard__simulation-actions">
        <button type="button" class="dashboard__simulation-button" @click="simulationMode = !simulationMode">
          {{ simulationMode ? 'Exit simulation' : 'Simulation mode' }}
        </button>
        <button v-if="simulationMode" type="button" class="dashboard__simulation-button" @click="resetSimulation">Reset</button>
      </div>
    </div>

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
              :title="totalScoreColumnTitle"
              @click="toggleSort('totalScore')"
            >
              <span>{{ totalScoreColumnLabel }}</span>
              <span class="standings__sort-indicator">{{ sortIndicator('totalScore') }}</span>
            </button>
          </th>
          <th
            v-if="!isPlayerRatingMode && settings.standings.usePerformanceModifier"
            class="standings__th standings__th--num standings__th--mult"
            title="Performance multiplier applied to base score&#10;1.0 = league average · &gt;1.0 = above average · &lt;1.0 = below average"
          >×Mult</th>
          <th v-if="!isPlayerRatingMode" class="standings__th standings__th--num" :title="adjustmentColumnTitle">{{ adjustmentColumnLabel }}</th>
          <th v-if="!isPlayerRatingMode" class="standings__th standings__th--num" :title="adjustedPointsColumnTitle">
            <button
              type="button"
              class="standings__sort-button standings__sort-button--num"
              @click="toggleSort('adjustedTotalPoints')"
            >
              <span>{{ adjustedPointsColumnLabel }}</span>
              <span class="standings__sort-indicator">{{ sortIndicator('adjustedTotalPoints') }}</span>
            </button>
          </th>
          <th v-if="!isPlayerRatingMode" class="standings__th standings__th--num">
            <button
              type="button"
              class="standings__sort-button standings__sort-button--num"
              @click="toggleSort('totalPoints')"
            >
              <span>Points</span>
              <span class="standings__sort-indicator">{{ sortIndicator('totalPoints') }}</span>
            </button>
          </th>
          <th v-show="showStandingsDetailColumns && settings.standings.includeAchievementPoints" class="standings__th standings__th--num">
            <button
              type="button"
              class="standings__sort-button standings__sort-button--num"
              @click="toggleSort('achievementPoints')"
            >
              <span>Achv. Pts</span>
              <span class="standings__sort-indicator">{{ sortIndicator('achievementPoints') }}</span>
            </button>
          </th>
          <th v-show="showStandingsDetailColumns && settings.standings.includeCommanderXp" class="standings__th standings__th--num">
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
              @click="toggleSort(isPlayerRatingMode ? 'participationRate' : 'gamesPlayed')"
            >
              <span>{{ isPlayerRatingMode ? 'Participation' : 'Games' }}</span>
              <span class="standings__sort-indicator">{{ sortIndicator(isPlayerRatingMode ? 'participationRate' : 'gamesPlayed') }}</span>
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
          <th v-show="showAveragePerGameColumn" class="standings__th standings__th--num">
            <button
              type="button"
              class="standings__sort-button standings__sort-button--num"
              @click="toggleSort('avgPerGame')"
            >
              <span>Avg / Game</span>
              <span class="standings__sort-indicator">{{ sortIndicator('avgPerGame') }}</span>
            </button>
          </th>
          <th class="standings__th standings__th--num">
            <button
              type="button"
              class="standings__sort-button standings__sort-button--num"
              @click="toggleSort('averageCommanderMmr')"
            >
              <span>Avg Cmdr MMR</span>
              <span class="standings__sort-indicator">{{ sortIndicator('averageCommanderMmr') }}</span>
            </button>
          </th>
          <th
            v-for="season in displayedLeagueSeasons"
            :key="season.index"
            class="standings__th standings__th--num"
            :title="`${season.label}: ${formatSeasonDate(season.startDate)} – ${formatSeasonDate(season.endDate)}`"
          >
            <button
              type="button"
              class="standings__sort-button standings__sort-button--num"
              @click="toggleSort(seasonSortKey(season.index))"
            >
              <span>{{ season.label }}</span>
              <span class="standings__sort-indicator">{{ sortIndicator(seasonSortKey(season.index)) }}</span>
            </button>
          </th>
          <!-- <th class="standings__th standings__th--commander">Most Played Commander</th> -->
          <th class="standings__th standings__th--commander">Top Commander</th>
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
              @contextmenu.prevent="onPlayerContextMenu(row, $event)"
            >{{ row.name }}</NuxtLink>
          </td>
          <td
            class="standings__td standings__td--num standings__td--total"
            @mouseenter="onRatingEnter(row, $event)"
            @mousemove="onMouseMove($event)"
            @mouseleave="onRatingLeave"
          >
            <button
              v-if="row.rankingSystem === 'player_rating_based'"
              type="button"
              class="standings__rating-button"
              @click="openRatingSidebar(row.name)"
            >
              <IconsPlayerRatingIcon :size="20" style="margin-right: 3px" />
              {{ Math.round(row.totalScore) }}
            </button>
            <template v-else>
              {{ fmt(row.totalScore) }}
            </template>
          </td>
          <td
            v-if="!isPlayerRatingMode && settings.standings.usePerformanceModifier"
            class="standings__td standings__td--num standings__td--mult standings__td--hoverable-mult"
            @mouseenter="onMultEnter(row, $event)"
            @mousemove="onMouseMove($event)"
            @mouseleave="onMultLeave"
          >{{ fmt(row.perfMult) }}</td>
          <td
            v-if="!isPlayerRatingMode"
            class="standings__td standings__td--num standings__td--comp standings__td--hoverable-comp"
            @mouseenter="onCompEnter(row, $event)"
            @mousemove="onMouseMove($event)"
            @mouseleave="onCompLeave"
          >{{ fmt(row.adjustmentDisplayPoints) }}</td>
          <td v-if="!isPlayerRatingMode" class="standings__td standings__td--num">{{ fmt(row.adjustedTotalPoints) }}</td>
          <td v-if="!isPlayerRatingMode" class="standings__td standings__td--num">{{ fmt(row.totalPoints) }}</td>
          <td
            v-show="showStandingsDetailColumns && settings.standings.includeAchievementPoints"
            class="standings__td standings__td--num standings__td--achv standings__td--hoverable"
            @mouseenter="onAchvEnter(row.name, $event)"
            @mousemove="onMouseMove($event)"
            @mouseleave="onAchvLeave"
          >
            <button
              type="button"
              class="standings__detail-button"
              @click="openDetailSidebar(row.name, 'achievements')"
            >
              {{ fmt(row.achievementPoints) }}
            </button>
          </td>
          <td
            v-show="showStandingsDetailColumns && settings.standings.includeCommanderXp"
            class="standings__td standings__td--num standings__td--xp standings__td--hoverable-xp"
            @mouseenter="onXpEnter(row.name, $event)"
            @mousemove="onMouseMove($event)"
            @mouseleave="onXpLeave"
          >
            <button
              type="button"
              class="standings__detail-button"
              @click="openDetailSidebar(row.name, 'xp')"
            >
              {{ fmt(row.xpPoints) }}
            </button>
          </td>
          <td class="standings__td standings__td--num">{{ isPlayerRatingMode ? `${row.participationRate}%` : row.gamesPlayed }}</td>
          <td class="standings__td standings__td--num">
            <input
              v-if="simulationMode && isPlayerRatingMode"
              class="standings__simulation-input"
              type="number"
              min="0"
              max="100"
              :value="simulatedWinRate(row)"
              @input="setSimulatedWinRate(row.name, Number(($event.target as HTMLInputElement).value))"
            />
            <template v-else>{{ row.winRate }}%</template>
          </td>
          <td v-show="showAveragePerGameColumn" class="standings__td standings__td--num">{{ fmt(row.avgPerGame) }}</td>
          <td class="standings__td standings__td--num standings__td--avg-mmr" :title="`Avg Commander MMR: ${Math.round(row.averageCommanderMmr)}`">
            <input
              v-if="simulationMode && isPlayerRatingMode"
              class="standings__simulation-input"
              type="number"
              :value="simulatedAverageCommanderMmr(row)"
              @input="setSimulatedAverageCommanderMmr(row.name, Number(($event.target as HTMLInputElement).value))"
            />
            <span v-else class="standings__avg-mmr"><IconsMmrIcon :size="11" />{{ Math.round(row.averageCommanderMmr) }}</span>
          </td>
          <td
            v-for="season in displayedLeagueSeasons"
            :key="season.index"
            class="standings__td standings__td--num"
          >
            <span class="standings__season-score">{{ formatSeasonScoreCell(row.seasonScores?.[season.index] ?? null, season) }}</span>
          </td>
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
                :size="20"
                :title="row.topCommanderTierLabel ?? undefined"
              />
              {{ row.topCommander }}
              <span v-if="row.topCommanderMmr" class="standings__commander-mmr"><IconsMmrIcon :size="11" />{{ Math.round(row.topCommanderMmr) }}</span>
            </NuxtLink>
            <span v-else class="standings__muted">—</span>
          </td>
        </tr>
      </tbody>
    </table>
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
              <th class="looster-table__th looster-table__th--num">Looster Points</th>
              <th v-if="showLoosterDetailColumns" class="looster-table__th looster-table__th--num">Looster Points Spent</th>
              <th class="looster-table__th looster-table__th--num">Bought Loosters</th>
              <th class="looster-table__th looster-table__th--set">Most Bought Set</th>
              <th v-if="showLoosterDetailColumns" class="looster-table__th looster-table__th--num">LP Over Games</th>
              <th v-if="showLoosterDetailColumns" class="looster-table__th looster-table__th--num">LP Over Missed</th>
              <th v-if="showLoosterDetailColumns" class="looster-table__th looster-table__th--num">Looster Points Total</th>
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
                <NuxtLink v-if="row.availableLoosters > 0" class="looster-table__available-link" to="/shop">
                  {{ row.availableLoosters }}
                </NuxtLink>
                <template v-else>{{ row.availableLoosters }}</template>
              </td>
              <td class="looster-table__td looster-table__td--num">{{ fmtLoosterOneDecimal(row.currentLoosterPoints) }}</td>
              <td v-if="showLoosterDetailColumns" class="looster-table__td looster-table__td--num looster-table__td--spent">{{ fmtLooster(row.spentLoosterPoints) }}</td>
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
              <td
                v-if="showLoosterDetailColumns"
                class="looster-table__td looster-table__td--num looster-table__td--hoverable"
                @mouseenter="onLoosterEnter(row, 'games', $event)"
                @mousemove="onMouseMove($event)"
                @mouseleave="onLoosterLeave"
              >
                {{ fmtLooster(row.gameLoosterPoints) }}
              </td>
              <td
                v-if="showLoosterDetailColumns"
                class="looster-table__td looster-table__td--num looster-table__td--hoverable"
                @mouseenter="onLoosterEnter(row, 'missed', $event)"
                @mousemove="onMouseMove($event)"
                @mouseleave="onLoosterLeave"
              >
                {{ fmtLooster(row.missedGameLoosterPoints) }}
              </td>
              <td v-if="showLoosterDetailColumns" class="looster-table__td looster-table__td--num">{{ fmtLooster(row.totalLoosterPoints) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <div class="dashboard__prize-pool">
      <span class="dashboard__prize-pool-label">Prize Pool</span>
      <strong class="dashboard__prize-pool-value">{{ fmtEuro(totalPrizePool) }}</strong>
    </div>

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

    <section v-if="fullPerformanceChartData.series.length > 0" class="dashboard__perf-section">
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
        >{{ secondaryChartLabel }}</button>
        <button
          type="button"
          class="dashboard__perf-switch"
          :class="{ 'dashboard__perf-switch--active': activeChart === 'participation' }"
          @click="activeChart = 'participation'"
        >Participation</button>
        <button
          type="button"
          class="dashboard__perf-switch"
          :class="{ 'dashboard__perf-switch--active': activeChart === 'averageCommanderMmr' }"
          @click="activeChart = 'averageCommanderMmr'"
        >Avg Commander MMR</button>
      </div>
      <div
        v-if="activeChart === 'performance' && performanceSeasonOptions.length > 0"
        class="dashboard__perf-season-switcher"
      >
        <button
          type="button"
          class="dashboard__perf-season-switch"
          :class="{ 'dashboard__perf-season-switch--active': selectedPerformanceSeason === 'all' }"
          @click="selectedPerformanceSeason = 'all'"
        >All</button>
        <button
          v-for="season in performanceSeasonOptions"
          :key="season.index"
          type="button"
          class="dashboard__perf-season-switch"
          :class="{ 'dashboard__perf-season-switch--active': selectedPerformanceSeason === season.index }"
          @click="selectedPerformanceSeason = season.index"
        >{{ season.label }}</button>
      </div>
      <ChartsPerformanceTimeline
        v-if="activeChart === 'performance'"
        :labels="activePerformanceChartData.labels"
        :series="activePerformanceChartData.series"
        :title="activePerfChartTitle"
        :subtitle="activePerfChartSubtitle"
      />
      <ChartsPerformanceTimeline
        v-else-if="activeChart === 'total'"
        :labels="scoreChartData.labels"
        :series="scoreChartData.series"
        :title="activePerfChartTitle"
        :subtitle="activePerfChartSubtitle"
      />
      <ChartsPerformanceTimeline
        v-else-if="activeChart === 'participation'"
        :labels="participationChartData.labels"
        :series="participationChartData.series"
        :title="activePerfChartTitle"
        :subtitle="activePerfChartSubtitle"
      />
      <ChartsPerformanceTimeline
        v-else
        :labels="averageCommanderMmrChartData.labels"
        :series="averageCommanderMmrChartData.series"
        :title="activePerfChartTitle"
        :subtitle="activePerfChartSubtitle"
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
          <span
            class="dashboard__perf-player-points"
            :title="player.pointsTitle"
          >{{ fmt(player.points) }}</span>
        </NuxtLink>
      </div>
    </section>

    <CommandersTopCommander />

    <section v-if="commanderMmrChartData.series.length > 0" class="dashboard__perf-section">
      <div class="dashboard__mmr-filter">
        <span class="dashboard__mmr-filter-label">Players</span>
        <button
          v-for="row in table"
          :key="row.name"
          type="button"
          class="dashboard__mmr-filter-btn"
          :class="{ 'dashboard__mmr-filter-btn--hidden': commanderHiddenPlayers.has(row.name) }"
          @click="toggleCommanderPlayer(row.name)"
        >{{ row.name }}</button>
      </div>
      <ChartsPerformanceTimeline
        :labels="commanderMmrChartData.labels"
        :series="filteredCommanderMmrSeries"
        title="Commander MMR Timeline"
        subtitle="All commanders in the league, carrying forward their latest recorded MMR after each game."
      />
    </section>
    </template>

    <Teleport to="body">
      <div
        v-if="catchupHover.visible"
        class="floating-panel mult-tooltip"
        :style="{ top: `${catchupHover.y}px`, left: `${catchupHover.x}px` }"
      >
        <template v-if="catchupHover.mode === 'rating_compare'">
          <div class="mult-tooltip__title">Rating Matchup</div>
          <div class="mult-tooltip__summary">
            {{ catchupHover.summary }}
          </div>
          <table class="mult-tooltip__table">
            <tbody>
            <tr>
              <td class="mult-tooltip__label">Target</td>
              <td class="mult-tooltip__op"></td>
              <td class="mult-tooltip__detail">current rating</td>
              <td class="mult-tooltip__value">{{ catchupHover.targetName }} · {{ Math.round(catchupHover.targetRating) }}</td>
            </tr>
            <tr>
              <td class="mult-tooltip__label">You</td>
              <td class="mult-tooltip__op"></td>
              <td class="mult-tooltip__detail">current rating</td>
              <td class="mult-tooltip__value">{{ catchupHover.viewerName }} · {{ Math.round(catchupHover.viewerRating) }}</td>
            </tr>
            <tr
              v-for="entry in catchupHover.strongerFactors"
              :key="`stronger-${entry.key}`"
              class="mult-tooltip__row--stronger"
            >
              <td class="mult-tooltip__label">They lead</td>
              <td class="mult-tooltip__op">-</td>
              <td class="mult-tooltip__detail">
                <strong>{{ entry.label }} </strong>
                <span class="mult-tooltip__inline-note"> {{ entry.note }}</span>
              </td>
              <td class="mult-tooltip__value">+{{ fmt(entry.delta) }}</td>
            </tr>
            <tr
              v-for="entry in catchupHover.weakerFactors"
              :key="`weaker-${entry.key}`"
              class="mult-tooltip__row--weaker"
            >
              <td class="mult-tooltip__label">You lead</td>
              <td class="mult-tooltip__op">+</td>
              <td class="mult-tooltip__detail">
                <strong>{{ entry.label }} </strong>
                <span class="mult-tooltip__inline-note"> {{ entry.note }}</span>
              </td>
              <td class="mult-tooltip__value">+{{ fmt(Math.abs(entry.delta)) }}</td>
            </tr>
            </tbody>
          </table>
          <div v-if="catchupHover.improvementIdeas.length" class="mult-tooltip__ideas">
            <div class="mult-tooltip__ideas-title">How to improve against this player</div>
            <ul class="mult-tooltip__ideas-list">
              <li
                v-for="idea in catchupHover.improvementIdeas"
                :key="idea"
                class="mult-tooltip__ideas-item"
              >
                {{ idea }}
              </li>
            </ul>
          </div>
        </template>
        <template v-else>
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
        </template>
      </div>
    </Teleport>

    <Teleport to="body">
      <div
        v-if="loosterHover.visible"
        class="floating-panel mult-tooltip looster-tooltip"
        :style="{ top: `${loosterHover.y}px`, left: `${loosterHover.x}px` }"
      >
        <div class="mult-tooltip__title">{{ loosterHover.title }}</div>
        <div class="mult-tooltip__summary">{{ loosterHover.playerName }}</div>
        <table class="mult-tooltip__table">
          <tbody>
            <tr v-for="entry in loosterHover.entries" :key="entry.label">
              <td class="mult-tooltip__label">{{ entry.label }}</td>
              <td class="mult-tooltip__op"></td>
              <td class="mult-tooltip__detail">{{ entry.detail }}</td>
              <td class="mult-tooltip__value">{{ entry.value }}</td>
            </tr>
            <tr class="mult-tooltip__row--sep">
              <td class="mult-tooltip__label">Total</td>
              <td class="mult-tooltip__op">=</td>
              <td class="mult-tooltip__detail">{{ loosterHover.totalLabel }}</td>
              <td class="mult-tooltip__value">{{ loosterHover.totalValue }}</td>
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
        v-if="ratingHover.visible"
        class="floating-panel mult-tooltip"
        :style="{ top: `${ratingHover.y}px`, left: `${ratingHover.x}px` }"
      >
        <div class="mult-tooltip__title">{{ ratingHover.playerName }}'s Player Rating</div>
        <div v-if="ratingHoverRows.length" class="rating-hover">
          <div
            class="rating-hover__pie"
            :style="{ background: ratingHoverPieBackground }"
            aria-label="Player rating points by factor"
          >
            <span class="rating-hover__pie-value">+{{ Math.round(ratingHoverTotal) }}</span>
          </div>
          <div class="rating-hover__legend">
            <div v-for="entry in ratingHoverRows" :key="entry.key" class="rating-hover__legend-row">
              <span class="rating-hover__swatch" :style="{ backgroundColor: entry.color }"></span>
              <span class="rating-hover__label">{{ entry.label }}</span>
              <span class="rating-hover__value">+{{ Math.round(entry.value) }}</span>
            </div>
          </div>
        </div>
        <div v-else class="mult-tooltip__summary">No factor breakdown is available for this rating.</div>
        <div v-if="ratingHover.provisional" class="rating-hover__status">Provisional rating</div>
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

    <Sidebar
      v-model="ratingSidebarOpen"
      :player-name="ratingSidebarPlayer"
      :compare-player-name="ratingSidebarComparePlayer"
      :mode="detailSidebarMode"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import {
  calculatePlayerSeasonAverages,
  calculateStandingsAdjustment,
  compareGamesChronological,
  type PlayerGameRecord,
  type StandingsAdjustmentResult,
} from '~/composables/useLeagueState'
import { calculateAverageCommanderMMRScore, calculatePlayerRating } from '~/composables/usePlayerRating'
import { getCommanderTierFromMMR, getInitialCommanderMMR, type CommanderMMRTier } from '~/composables/useCommanderMMR'
import type { PerformancePlayerSeries } from '~/components/charts/PerformanceTimeline.vue'
import { fetchSetByCode } from '~/services/scryfallService'
import { getArchEnemySummary } from '~/utils/archEnemy'
import { getFeaturedPlayers, type FeaturedPlayerCandidate } from '~/utils/featuredPlayer'
import type { PlayerRatingBreakdownKey, RatingBreakdownEntry } from '~/composables/usePlayerRating'
import {
  buildLeagueSeasonRanges,
  hasActiveSeasonalRanking,
  MIN_GAMES_FOR_PENALTY_MODE,
  type StandingsAdjustmentMode,
} from '~/utils/leagueSettings'
import { formatLoosterPoints, roundLoosterPoints } from '~/utils/loosterPoints'
import { formatPlayerName } from '~/utils/playerNames'
import {
  EXPECTED_WIN_RATE,
  PERF_BASE_WEIGHT,
  PERF_WIN_RATE_WEIGHT,
  PERF_AVG_WEIGHT,
  PERF_MULT_MAX,
  PERF_MULT_MIN,
} from '~/utils/placements'
import type { LoosterPurchaseRecord } from '~/utils/loosterPurchases'

const { gameRecords, games, leagueSnapshots, players, standings, loading, loaded, progress } = useLeagueState()
const { settings } = useLeagueSettings()
const { user, isAdmin, ensureSession } = useAuth()
const simulationMode = ref(false)
const simulatedAverageCommanderMmrs = reactive<Record<string, number>>({})
const simulatedWinRates = reactive<Record<string, number>>({})

type SortKey =
  | 'totalScore'
  | 'adjustedTotalPoints'
  | 'adjustmentDisplayPoints'
  | 'totalPoints'
  | 'achievementPoints'
  | 'xpPoints'
  | 'gamesPlayed'
  | 'participationRate'
  | 'totalLosses'
  | 'winRate'
  | 'avgPerGame'
  | 'averageCommanderMmr'
  | 'totalLPoints'
  | `season:${number}`

type ChartStandingRow = {
  rank: number
  name: string
  points: number
  pointsTitle?: string
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
  gameLoosterPointsEntries: LoosterTooltipEntry[]
  spentLoosterPoints: number
  boughtLoosters: number
  mostBoughtSet: string
  missedGameLoosterPoints: number
  missedGameLoosterPointsEntries: LoosterTooltipEntry[]
  totalLoosterPoints: number
}

type LoosterTooltipEntry = {
  label: string
  detail: string
  value: string
}

type DashboardSetMeta = {
  iconUrl: string
  scryfallUrl: string
}

const sortKey = ref<SortKey>('totalScore')
const sortDirection = ref<'desc' | 'asc'>('desc')
const hasMounted = ref(false)
const showLoosterDetailColumns = false
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
const playerRankingSystem = computed(() => settings.value.playerRankingSystem)
const isPlayerRatingMode = computed(() => playerRankingSystem.value === 'player_rating_based')
const seasonalRankingEnabled = computed(() =>
  hasActiveSeasonalRanking(settings.value.standings.seasonalRanking),
)
const showSeasonScoresInTable = computed(() => seasonalRankingEnabled.value)
const generatedLeagueSeasons = computed(() => buildLeagueSeasonRanges(settings.value.standings.seasonalRanking))
const displayedLeagueSeasons = computed(() => showSeasonScoresInTable.value ? generatedLeagueSeasons.value : [])
const performanceSeasonOptions = computed(() => {
  const now = Date.now()
  return generatedLeagueSeasons.value.filter((season) => season.startMs <= now)
})
const selectedPerformanceSeason = ref<'all' | number>('all')
watch(performanceSeasonOptions, (options) => {
  if (selectedPerformanceSeason.value === 'all') return
  if (!options.some((season) => season.index === selectedPerformanceSeason.value)) {
    selectedPerformanceSeason.value = 'all'
  }
}, { immediate: true })
const showStandingsDetailColumns = false
const showAveragePerGameColumn = false
const totalScoreColumnLabel = computed(() => playerRankingSystem.value === 'player_rating_based' ? 'Rating' : 'Total')
const secondaryChartLabel = computed(() => playerRankingSystem.value === 'player_rating_based' ? 'Player Rating' : 'Total Score')
const activePerfChartTitle = computed(() => {
  const selectedSeason = getSelectedPerformanceSeason()
  if (activeChart.value === 'performance') {
    return selectedSeason ? `${selectedSeason.label} Performance` : 'Performance Over Time'
  }
  if (activeChart.value === 'total') return secondaryChartLabel.value
  if (activeChart.value === 'averageCommanderMmr') return 'Average Commander MMR Over Time'
  return 'Participation Over Time'
})
const activePerfChartSubtitle = computed(() => {
  const selectedSeason = getSelectedPerformanceSeason()
  if (activeChart.value === 'performance') {
    if (selectedSeason) {
      return `Season-only average trend for ${selectedSeason.label}, resetting at the start of that season.`
    }
    return 'League performance trend after each recorded game.'
  }
  if (activeChart.value === 'total') {
    return playerRankingSystem.value === 'player_rating_based'
      ? 'Live player rating across the full league timeline.'
      : 'Total score across the full league timeline.'
  }
  if (activeChart.value === 'averageCommanderMmr') {
    return 'Rolling average commander strength per player after each recorded game.'
  }
  return 'Games played per week for each player.'
})
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
  if (playerRankingSystem.value === 'player_rating_based') {
    if (settings.value.playerRating.simpleMmr.enabled) {
      return [
        'Player MMR is a simple results-only ladder.',
        'Each pod is treated as head-to-head MMR matchups against the other players in that game.',
        'Achievements, commander XP, and weighted subfactors are not part of this rating.',
      ].join('\n')
    }
    return [
        'Player Rating combines recent form, long-term performance, season points, win rate, commander MMR context, commander points, achievements, clutch play, and commander diversity.',
      'Total points only play a small activity role and missed-game compensation is not part of the rating formula.',
      'Recent games count more than old ones.',
      'Low sample sizes are confidence-adjusted, so provisional players move more as they build a history.',
      'Commander MMR context rewards strong results into stronger pods and softens results farmed only in easier ones.',
    ].join('\n')
  }
  if (seasonalRankingEnabled.value) {
    return [
      'Season ranking averages each started league season separately, then averages those season scores together.',
      'Only seasons in which a player has recorded a game count toward that player’s season average.',
      'Future seasons stay hidden as - until their start date is reached.',
    ].join('\n')
  }
  if (adjustmentMode.value === 'freeGames') {
    return '((Points + Free Games) + Achievement Points + Commander XP Points) × Performance Multiplier'
  }
  if (adjustmentMode.value === 'penaltyGames') {
    return '((Points - Penalty) + Achievement Points + Commander XP Points) × Performance Multiplier'
  }
  return '((Points + Missed-Game Compensation) + Achievement Points + Commander XP Points) × Performance Multiplier'
})

function playerRatingTooltip(row: {
  rankingSystem?: string
  provisional?: boolean
  ratingBreakdown?: any
}) {
  if (row.rankingSystem !== 'player_rating_based') return totalScoreColumnTitle.value

  if (settings.value.playerRating.simpleMmr.enabled) {
    const lines = [
      'Player MMR is a simple results-only ladder.',
      'Each pod is treated as head-to-head MMR matchups against the other players in that game.',
    ]

    if (row.provisional) {
      lines.push('')
      lines.push('This rating is provisional until enough games have been played.')
    }

    return lines.join('\n')
  }

  const lines = [
        'Player Rating combines recent form, long-term performance, season points, win rate, commander MMR context, total points as a small activity signal, achievements, clutch play, and commander diversity.',
    'Missed-game/free-game points are not part of this rating.',
  ]

  const breakdown = row.ratingBreakdown
  if (breakdown) {
    lines.push('')
    lines.push('Current weighted factors:')
    lines.push(`Recent form: ${fmt(breakdown.recentPerformance?.weightedContribution ?? 0)}`)
    lines.push(`All-time performance: ${fmt(breakdown.allTimePerformance?.weightedContribution ?? 0)}`)
    lines.push(`Season points: ${fmt(breakdown.seasonPoints?.weightedContribution ?? 0)}`)
    lines.push(`Win rate: ${fmt(breakdown.winRate?.weightedContribution ?? 0)}`)
    lines.push(`Finishes vs stronger opponents: ${fmt(breakdown.commanderMMRContext?.weightedContribution ?? 0)}`)
    lines.push(`Average commander MMR: ${fmt(breakdown.averageCommanderMMR?.weightedContribution ?? 0)}`)
    lines.push(`Total points / activity: ${fmt(breakdown.activityPoints?.weightedContribution ?? 0)}`)
    lines.push(`Achievements: ${fmt(breakdown.achievements?.weightedContribution ?? 0)}`)
    lines.push(`Clutch: ${fmt(breakdown.clutch?.weightedContribution ?? 0)}`)
    lines.push(`Diversity: ${fmt(breakdown.commanderDiversity?.weightedContribution ?? 0)}`)
  }

  if (row.provisional) {
    lines.push('')
    lines.push('This rating is provisional until enough games have been played.')
  }

  return lines.join('\n')
}

const purchasesByPlayer = computed(() => {
  const grouped = new Map<string, LoosterPurchaseRecord[]>()

  for (const purchase of purchases.value) {
    const existing = grouped.get(purchase.playerName) ?? []
    existing.push(purchase)
    grouped.set(purchase.playerName, existing)
  }

  return grouped
})

const missedLoosterBreakdownByPlayer = computed(() => {
  const grouped = new Map<string, { counts: Record<3 | 4 | 5, number>, total: number }>()

  for (const standingRow of table.value) {
    grouped.set(standingRow.name, {
      counts: { 3: 0, 4: 0, 5: 0 },
      total: 0,
    })
  }

  for (const game of chronologicalGames.value) {
    const playerCount = game.players.length
    if (playerCount !== 3 && playerCount !== 4 && playerCount !== 5) continue

    const missedPoints = getMissedGameLoosterPoints(playerCount)
    if (missedPoints <= 0) continue

    const participants = new Set(game.players.map((player) => player.name))

    for (const [playerName, breakdown] of grouped.entries()) {
      if (participants.has(playerName)) continue
      breakdown.counts[playerCount] += 1
      breakdown.total = roundLoosterPoints(breakdown.total + missedPoints)
    }
  }

  return grouped
})

const loosterTable = computed<LoosterTableRow[]>(() =>
  table.value.map((standingRow) => {
    const playerName = standingRow.name
    const player = players.value[playerName]
    const playerPurchases = purchasesByPlayer.value.get(playerName) ?? []
    const playerRecords = Object.values(gameRecords.value[playerName] ?? {})
    const loosterAwardRecords = playerRecords.filter((record) => record.placement > 1 && record.lPoints > 0)
    const gameLoosterPoints = roundLoosterPoints(
      loosterAwardRecords.reduce((sum, record) => sum + record.lPoints, 0),
    )
    const spentLoosterPoints = roundLoosterPoints(
      playerPurchases.reduce((sum, purchase) => sum + Number(purchase.cost ?? 0), 0),
    )
    const totalLoosterPoints = roundLoosterPoints(player?.totalLPoints ?? 0)
    const missedGameLoosterPoints = roundLoosterPoints(
      Math.max(0, totalLoosterPoints - gameLoosterPoints),
    )
    const currentLoosterPoints = roundLoosterPoints(totalLoosterPoints - spentLoosterPoints)
    const availableLoosters = loosterCost.value > 0
      ? Math.max(0, Math.floor(currentLoosterPoints / loosterCost.value))
      : 0

    const setCounts = playerPurchases.reduce((counts, purchase) => {
      counts.set(purchase.set, (counts.get(purchase.set) ?? 0) + 1)
      return counts
    }, new Map<string, number>())

    const mostBoughtSet = [...setCounts.entries()]
      .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))[0]?.[0] ?? ''

    const placementCounts = loosterAwardRecords.reduce((counts, record) => {
      const key = `${record.placement}-${record.playerCount}`
      counts.set(key, (counts.get(key) ?? 0) + 1)
      return counts
    }, new Map<string, number>())
    const placementTotals = loosterAwardRecords.reduce((totals, record) => {
      const key = `${record.placement}-${record.playerCount}`
      totals.set(key, roundLoosterPoints((totals.get(key) ?? 0) + record.lPoints))
      return totals
    }, new Map<string, number>())
    const gameLoosterPointsEntries = [...placementCounts.entries()]
      .sort((left, right) => {
        const [leftPlacement, leftPlayerCount] = left[0].split('-').map(Number)
        const [rightPlacement, rightPlayerCount] = right[0].split('-').map(Number)
        return leftPlacement - rightPlacement || leftPlayerCount - rightPlayerCount
      })
      .map(([key, count]) => {
        const [placement, playerCount] = key.split('-').map(Number)
        return {
          label: placementOfPodLabel(placement, playerCount),
          detail: `${count} game${count === 1 ? '' : 's'}`,
          value: fmtLooster(placementTotals.get(key) ?? 0),
        }
      })

    const missedBreakdown = missedLoosterBreakdownByPlayer.value.get(playerName) ?? {
      counts: { 3: 0, 4: 0, 5: 0 },
      total: 0,
    }
    const missedGameLoosterPointsEntries = (Object.entries(missedBreakdown.counts) as [string, number][])
      .filter(([, count]) => count > 0)
      .map(([playerCount, count]) => {
        const numericPlayerCount = Number(playerCount) as 3 | 4 | 5
        const total = roundLoosterPoints(count * getMissedGameLoosterPoints(numericPlayerCount))
        return {
          label: `Missed ${playerCount}-player pod`,
          detail: `${count} game${count === 1 ? '' : 's'}`,
          value: fmtLooster(total),
        }
      })

    return {
      name: playerName,
      availableLoosters,
      currentLoosterPoints,
      gameLoosterPoints,
      gameLoosterPointsEntries,
      spentLoosterPoints,
      boughtLoosters: playerPurchases.length,
      mostBoughtSet,
      missedGameLoosterPoints,
      missedGameLoosterPointsEntries,
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

// function topCommander(playerName: string): string | null {
//   const records = Object.values(gameRecords.value[playerName] ?? {})
//   if (records.length === 0) return null
//   const counts: Record<string, number> = {}
//   for (const r of records) counts[r.commander] = (counts[r.commander] ?? 0) + 1
//   return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
// }

function fmtEuro(value: number) {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
  }).format(value)
}

function joinNaturalLanguage(values: string[]) {
  if (values.length === 0) return ''
  if (values.length === 1) return values[0]
  if (values.length === 2) return `${values[0]} and ${values[1]}`
  return `${values.slice(0, -1).join(', ')}, and ${values[values.length - 1]}`
}

function topCommanderByMmr(playerName: string) {
  const records = Object.values(gameRecords.value[playerName] ?? {})
  if (records.length === 0) return null

  const latestByCommander = records.reduce<Record<string, { commander: string; mmr: number; tier: CommanderMMRTier }>>((acc, record) => {
    acc[record.commander] = {
      commander: record.commander,
      mmr: record.commanderMMRAfter,
      tier: getCommanderTierFromMMR(record.commanderMMRAfter),
    }
    return acc
  }, {})

  return Object.values(latestByCommander).sort((left, right) =>
    right.mmr - left.mmr || left.commander.localeCompare(right.commander),
  )[0] ?? null
}

function averageCommanderMmr(playerName: string) {
  const records = Object.values(gameRecords.value[playerName] ?? {})
  if (records.length === 0) return 0

  return calculateAverageCommanderMMRScore(
    records,
    settings.value.playerRating.topCommandersForAverageMmr,
    settings.value.playerRating.minimumGamesForAverageCommanderMmr,
    settings.value.playerRating.missingCommanderMmr,
    settings.value.playerRating.usePeakCommanderMmrForAverage,
  ).averageCommanderMMR
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
  const standingsMap = new Map(standings.value.map((standing) => [standing.name, standing]))
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
    const standing = standingsMap.get(player.name)
    const topCommanderEntry = topCommanderByMmr(player.name)
    const averageCommanderMmrValue = averageCommanderMmr(player.name)
    const seasonAverages = calculatePlayerSeasonAverages(player.name, chronologicalGames.value, gameRecords.value, settings.value)
    const participationRate = chronologicalGames.value.length > 0
      ? Math.round((player.gamesPlayed / chronologicalGames.value.length) * 100)
      : 0
    return {
      rank: standing?.rank ?? 0,
      name: player.name,
      totalScore: standing?.totalScore ?? 0,
      rankingSystem: standing?.rankingSystem ?? 'classic',
      playerRating: standing?.playerRating ?? null,
      provisional: standing?.provisional ?? false,
      ratingBreakdown: standing?.ratingBreakdown ?? null,
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
      participationRate,
      winRate: performance.winRate,
      avgPerGame: performance.avgPerGame,
      averageCommanderMmr: averageCommanderMmrValue,
      seasonScores: seasonAverages.seasonScores,
      leagueAvgPerGame: performance.leagueAvgPerGame,
      perfMult: performance.perfMult,
      perfMultRaw: performance.perfMultRaw,
      winRateFraction: performance.winRateFraction,
      winRateTerm: performance.winRateTerm,
      avgFraction: performance.avgFraction,
      avgTerm: performance.avgTerm,
      topCommander: topCommanderEntry?.commander ?? null,
      topCommanderMmr: topCommanderEntry?.mmr ?? 0,
      topCommanderTier: topCommanderEntry?.tier ?? null,
      topCommanderTierLabel: topCommanderEntry ? commanderMmrTierLabel(topCommanderEntry.tier) : null,
      totalLPoints: player.totalLPoints,
    }
  })

  const simulatedRows = simulationMode.value
    ? rows.map((row) => applyRatingSimulation(row))
    : rows

  const rankedRows = [...simulatedRows]
    .sort((a, b) => {
      if (a.rank !== b.rank) return a.rank - b.rank
      return a.name.localeCompare(b.name)
    })

  return rankedRows.sort((a, b) => {
    const direction = sortDirection.value === 'desc' ? -1 : 1
    const delta = getTableSortValue(a, sortKey.value) - getTableSortValue(b, sortKey.value)

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

function simulatedAverageCommanderMmr(row: { name: string, averageCommanderMmr: number }) {
  return simulatedAverageCommanderMmrs[row.name] ?? row.averageCommanderMmr
}

function simulatedWinRate(row: { name: string, winRate: number }) {
  return simulatedWinRates[row.name] ?? row.winRate
}

function setSimulatedAverageCommanderMmr(playerName: string, value: number) {
  if (Number.isFinite(value)) simulatedAverageCommanderMmrs[playerName] = value
}

function setSimulatedWinRate(playerName: string, value: number) {
  if (Number.isFinite(value)) simulatedWinRates[playerName] = Math.max(0, Math.min(100, value))
}

function resetSimulation() {
  for (const name of Object.keys(simulatedAverageCommanderMmrs)) delete simulatedAverageCommanderMmrs[name]
  for (const name of Object.keys(simulatedWinRates)) delete simulatedWinRates[name]
}

function applyRatingSimulation<T extends { name: string, averageCommanderMmr: number, winRate: number, gamesPlayed: number, totalScore: number, playerRating: number | null, ratingBreakdown: Record<string, RatingBreakdownEntry> | null }>(row: T) {
  const simulatedMmr = simulatedAverageCommanderMmr(row)
  const simulatedWinRateValue = simulatedWinRate(row)
  if ((simulatedMmr === row.averageCommanderMmr && simulatedWinRateValue === row.winRate) || !row.ratingBreakdown) return row

  const breakdown = structuredClone(row.ratingBreakdown) as Record<string, RatingBreakdownEntry>
  const factor = breakdown.averageCommanderMMR
  if (!factor) return row

  factor.rawValue = simulatedMmr
  factor.normalizedScore = Math.max(0, Math.min(100, ((simulatedMmr - 1000) / 1600) * 100))
  factor.weightedContribution = factor.normalizedScore * factor.weight
  const winRateFactor = breakdown.winRate
  if (winRateFactor) {
    winRateFactor.rawValue = simulatedWinRateValue / 100
    winRateFactor.normalizedScore = Math.max(0, Math.min(100, (winRateFactor.rawValue / 0.45) * 100))
    winRateFactor.weightedContribution = winRateFactor.normalizedScore * winRateFactor.weight
  }
  const totalWeight = Object.values(breakdown).reduce((sum, entry) => sum + entry.weight, 0) || 1
  const weightedScore = Object.values(breakdown).reduce((sum, entry) => sum + entry.weightedContribution, 0) / totalWeight
  const confidence = Math.max(0.45, Math.min(1, row.gamesPlayed / 12))
  const rating = settings.value.playerRating.minRating
    + (Math.max(0, Math.min(100, weightedScore * confidence + weightedScore * 0.2)) / 100)
      * (settings.value.playerRating.maxRating - settings.value.playerRating.minRating)

  return {
    ...row,
    averageCommanderMmr: simulatedMmr,
    winRate: simulatedWinRateValue,
    totalScore: rating,
    playerRating: rating,
    ratingBreakdown: breakdown,
  }
}

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

const activeChart = ref<'performance' | 'total' | 'participation' | 'averageCommanderMmr'>('performance')

function fmtGameDate(date: string | Date) {
  return new Date(date).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

function startOfWeekKey(date: string | Date) {
  const parsed = new Date(date)
  if (Number.isNaN(parsed.getTime())) return 'unknown'
  const normalized = new Date(Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate()))
  const day = normalized.getUTCDay()
  const diff = day === 0 ? -6 : 1 - day
  normalized.setUTCDate(normalized.getUTCDate() + diff)
  return normalized.toISOString().slice(0, 10)
}

function fmtWeekLabel(weekKey: string) {
  const parsed = new Date(`${weekKey}T00:00:00Z`)
  if (Number.isNaN(parsed.getTime())) return weekKey
  return `Week of ${parsed.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' })}`
}

function getSelectedPerformanceSeason() {
  if (selectedPerformanceSeason.value === 'all') return null
  return performanceSeasonOptions.value.find((season) => season.index === selectedPerformanceSeason.value) ?? null
}

const activePerformanceGames = computed(() => {
  const selectedSeason = getSelectedPerformanceSeason()
  if (!selectedSeason) return chronologicalGames.value
  return chronologicalGames.value.filter((game) => {
    const gameMs = new Date(game.date).getTime()
    return Number.isFinite(gameMs) && gameMs >= selectedSeason.startMs && gameMs <= selectedSeason.endMs
  })
})

function buildPerformanceChartData(games: typeof chronologicalGames.value): { labels: string[], series: PerformancePlayerSeries[] } {
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
}

const fullPerformanceChartData = computed<{ labels: string[], series: PerformancePlayerSeries[] }>(() =>
  buildPerformanceChartData(chronologicalGames.value),
)

const activePerformanceChartData = computed<{ labels: string[], series: PerformancePlayerSeries[] }>(() =>
  buildPerformanceChartData(activePerformanceGames.value),
)

const scoreChartData = computed<{ labels: string[], series: PerformancePlayerSeries[] }>(() => {
  const games = chronologicalGames.value
  if (games.length === 0) return { labels: [], series: [] }

  const labels = games.map((game) => fmtGameDate(game.date))
  const playerNames = standings.value.map((s) => s.name)

  if (isPlayerRatingMode.value) {
    const partialRecordMap: Record<string, Record<string, PlayerGameRecord>> = Object.fromEntries(
      playerNames.map((playerName) => [playerName, {}]),
    )
    const partialGames: typeof games = []
    const dataByPlayer = Object.fromEntries(
      playerNames.map((playerName) => [playerName, [] as number[]]),
    ) as Record<string, number[]>

    for (const game of games) {
      partialGames.push(game)

      for (const playerName of playerNames) {
        const record = gameRecords.value[playerName]?.[game.gameId]
        if (record) partialRecordMap[playerName][game.gameId] = record
      }

      const partialPlayers = Object.fromEntries(
        playerNames.map((playerName) => {
          const records = Object.values(partialRecordMap[playerName] ?? {})
          const earnedAchievements = records.flatMap((record) => record.achievements ?? [])
          return [playerName, {
            name: playerName,
            gamesPlayed: records.length,
            baseWins: records.filter((record) => record.placement === 1).length,
            totalPoints: r3(records.reduce((sum, record) => sum + record.finalPoints, 0)),
            achievementPoints: r3(earnedAchievements.reduce((sum, achievement) => sum + achievement.points, 0)),
            earnedAchievements,
          }]
        }),
      )

      for (const playerName of playerNames) {
        const rating = calculatePlayerRating({
          player: partialPlayers[playerName],
          players: partialPlayers,
          gameRecords: partialRecordMap,
          games: partialGames,
          settings: settings.value,
        }).rating
        dataByPlayer[playerName].push(rating)
      }
    }

    const series: PerformancePlayerSeries[] = playerNames
      .map((playerName, index) => ({
        name: playerName,
        color: PERF_CHART_COLORS[index % PERF_CHART_COLORS.length],
        data: dataByPlayer[playerName],
      }))
      .filter((entry) => entry.data.some((value) => value > 0))

    return { labels, series }
  }

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

const participationChartData = computed<{ labels: string[], series: PerformancePlayerSeries[] }>(() => {
  const games = chronologicalGames.value
  if (games.length === 0) return { labels: [], series: [] }

  const weekKeys = Array.from(new Set(games.map((game) => startOfWeekKey(game.date))))
  const labels = weekKeys.map((weekKey) => fmtWeekLabel(weekKey))
  const playerNames = standings.value.map((s) => s.name)

  const series: PerformancePlayerSeries[] = playerNames
    .map((playerName, index) => {
      const weeklyCounts = new Map<string, number>()
      for (const game of games) {
        const record = gameRecords.value[playerName]?.[game.gameId]
        if (!record) continue
        const weekKey = startOfWeekKey(game.date)
        weeklyCounts.set(weekKey, (weeklyCounts.get(weekKey) ?? 0) + 1)
      }

      const data = weekKeys.map((weekKey) => weeklyCounts.get(weekKey) ?? 0)
      return {
        name: playerName,
        color: PERF_CHART_COLORS[index % PERF_CHART_COLORS.length],
        data,
      }
    })
    .filter((entry) => entry.data.some((value) => value > 0))

  return { labels, series }
})

function averageGamesPerWeekSinceFirstGame(playerName: string): number | null {
  const playedGames = chronologicalGames.value.filter((game) => gameRecords.value[playerName]?.[game.gameId])
  if (playedGames.length === 0) return null

  const firstWeek = new Date(`${startOfWeekKey(playedGames[0].date)}T00:00:00Z`)
  const latestWeek = new Date(`${startOfWeekKey(chronologicalGames.value.at(-1)?.date ?? '')}T00:00:00Z`)
  const elapsedWeeks = Math.floor((latestWeek.getTime() - firstWeek.getTime()) / (7 * 24 * 60 * 60 * 1000)) + 1

  return elapsedWeeks > 0 ? playedGames.length / elapsedWeeks : null
}

const averageCommanderMmrChartData = computed<{ labels: string[], series: PerformancePlayerSeries[] }>(() => {
  const games = chronologicalGames.value
  if (games.length === 0) return { labels: [], series: [] }

  const initialCommanderMmr = getInitialCommanderMMR()
  const labels = games.map((game) => fmtGameDate(game.date))
  const playerNames = standings.value.map((s) => s.name)
  const partialRecordMap: Record<string, Record<string, PlayerGameRecord>> = Object.fromEntries(
    playerNames.map((playerName) => [playerName, {}]),
  )
  const dataByPlayer = Object.fromEntries(
    playerNames.map((playerName) => [playerName, [] as number[]]),
  ) as Record<string, number[]>

  for (const game of games) {
    for (const playerName of playerNames) {
      const record = gameRecords.value[playerName]?.[game.gameId]
      if (record) partialRecordMap[playerName][game.gameId] = record
    }

    for (const playerName of playerNames) {
      const records = Object.values(partialRecordMap[playerName] ?? {})
      const averageMmr = records.length > 0
        ? calculateAverageCommanderMMRScore(
            records,
            settings.value.playerRating.topCommandersForAverageMmr,
            settings.value.playerRating.minimumGamesForAverageCommanderMmr,
            settings.value.playerRating.missingCommanderMmr,
            settings.value.playerRating.usePeakCommanderMmrForAverage,
          ).averageCommanderMMR
        : initialCommanderMmr
      dataByPlayer[playerName].push(averageMmr)
    }
  }

  const series: PerformancePlayerSeries[] = playerNames
    .map((playerName, index) => ({
      name: playerName,
      color: PERF_CHART_COLORS[index % PERF_CHART_COLORS.length],
      data: dataByPlayer[playerName],
    }))
    .filter((entry) => entry.data.some((value) => value > 0))

  return { labels, series }
})

const commanderMmrChartData = computed<{ labels: string[], series: PerformancePlayerSeries[] }>(() => {
  const games = chronologicalGames.value
  if (games.length === 0) return { labels: [], series: [] }

  const labels = games.map((game) => fmtGameDate(game.date))
  const latestCommanderMmr = new Map<string, number>()
  const lastPlayedGameIndexByCommander = new Map<string, number>()

  for (const [gameIndex, game] of games.entries()) {
    const aggregateMap = getCommanderMmrAggregateForGame(game.gameId)

    for (const [commanderName, aggregate] of aggregateMap.entries()) {
      latestCommanderMmr.set(commanderName, aggregate.before + aggregate.delta)
      lastPlayedGameIndexByCommander.set(commanderName, gameIndex)
    }
  }

  const commanderNames = [...latestCommanderMmr.entries()]
    .sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1]
      return a[0].localeCompare(b[0])
    })
    .map(([commanderName]) => commanderName)

  const currentMmrByCommander = new Map<string, number>()
  const seenCommanders = new Set<string>()
  const seriesData = new Map<string, (number | null)[]>(
    commanderNames.map((commanderName) => [commanderName, []]),
  )

  for (const [gameIndex, game] of games.entries()) {
    const aggregateMap = getCommanderMmrAggregateForGame(game.gameId)

    for (const [commanderName, aggregate] of aggregateMap.entries()) {
      currentMmrByCommander.set(commanderName, aggregate.before + aggregate.delta)
      seenCommanders.add(commanderName)
    }

    for (const commanderName of commanderNames) {
      const series = seriesData.get(commanderName)
      if (!series) continue
      const lastPlayedGameIndex = lastPlayedGameIndexByCommander.get(commanderName) ?? -1
      series.push(
        seenCommanders.has(commanderName) && gameIndex <= lastPlayedGameIndex
          ? currentMmrByCommander.get(commanderName) ?? null
          : null,
      )
    }
  }

  const series: PerformancePlayerSeries[] = commanderNames
    .map((commanderName, index) => ({
      name: commanderName,
      color: getCommanderChartColor(index, commanderNames.length),
      data: seriesData.get(commanderName) ?? [],
    }))
    .filter((entry) => entry.data.some((value) => typeof value === 'number'))

  return { labels, series }
})

const commanderHiddenPlayers = ref<Set<string>>(new Set())

const commandersByPlayer = computed(() => {
  const map = new Map<string, Set<string>>()
  for (const [playerName, records] of Object.entries(gameRecords.value)) {
    const commanders = new Set<string>()
    for (const record of Object.values(records)) {
      commanders.add(record.commander)
    }
    map.set(playerName, commanders)
  }
  return map
})

const filteredCommanderMmrSeries = computed(() => {
  const { series } = commanderMmrChartData.value
  if (commanderHiddenPlayers.value.size === 0) return series
  const visibleCommanders = new Set<string>()
  for (const [playerName, commanders] of commandersByPlayer.value.entries()) {
    if (!commanderHiddenPlayers.value.has(playerName)) {
      for (const commander of commanders) visibleCommanders.add(commander)
    }
  }
  return series.filter((s) => visibleCommanders.has(s.name))
})

function toggleCommanderPlayer(playerName: string) {
  const next = new Set(commanderHiddenPlayers.value)
  if (next.has(playerName)) next.delete(playerName)
  else next.add(playerName)
  commanderHiddenPlayers.value = next
}

const currentChartStandings = computed<ChartStandingRow[]>(() => {
  const chartData = activeChart.value === 'performance'
    ? activePerformanceChartData.value
    : activeChart.value === 'total'
      ? scoreChartData.value
      : activeChart.value === 'participation'
        ? participationChartData.value
        : averageCommanderMmrChartData.value

  const standingOrder = new Map(
    standings.value.map((player, index) => [player.name, index]),
  )

  return chartData.series
    .map((series) => {
      const points = activeChart.value === 'participation'
        ? averageGamesPerWeekSinceFirstGame(series.name)
        : [...series.data].reverse().find((value): value is number => typeof value === 'number')
      return points === null || points === undefined
        ? null
        : {
            name: series.name,
            points,
            pointsTitle: activeChart.value === 'participation'
              ? 'Average games per week, from the player’s first recorded game onward.'
              : undefined,
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

function getCommanderMmrAggregateForGame(gameId: string) {
  const aggregateMap = new Map<string, { before: number, delta: number }>()

  for (const playerName of Object.keys(gameRecords.value)) {
    const record = gameRecords.value[playerName]?.[gameId]
    if (!record?.commander) continue

    const existing = aggregateMap.get(record.commander)
    if (existing) {
      existing.before = Math.min(existing.before, record.commanderMMRBefore)
      existing.delta += record.commanderMMRDelta
    } else {
      aggregateMap.set(record.commander, {
        before: record.commanderMMRBefore,
        delta: record.commanderMMRDelta,
      })
    }
  }

  return aggregateMap
}

function getCommanderChartColor(index: number, total: number) {
  const hue = Math.round((index / Math.max(total, 1)) * 360)
  return `hsl(${hue} 78% 64%)`
}

function toggleSort(key: SortKey) {
  if (sortKey.value === key) {
    sortDirection.value = sortDirection.value === 'desc' ? 'asc' : 'desc'
    return
  }

  sortKey.value = key
  sortDirection.value = 'desc'
}

function seasonSortKey(index: number): SortKey {
  return `season:${index}`
}

function getTableSortValue(row: { seasonScores?: Array<number | null>, [key: string]: any }, key: SortKey) {
  if (key.startsWith('season:')) {
    const seasonIndex = Number(key.slice('season:'.length))
    return row.seasonScores?.[seasonIndex] ?? Number.NEGATIVE_INFINITY
  }
  return row[key] ?? 0
}

function sortIndicator(key: SortKey) {
  if (sortKey.value !== key) return '↕'
  return sortDirection.value === 'desc' ? '↓' : '↑'
}

function commanderMmrTierLabel(tier: CommanderMMRTier) {
  return tier.charAt(0).toUpperCase() + tier.slice(1)
}


function rankLabel(rank: number) {
  return ['🥇', '🥈', '🥉'][rank - 1] ?? `${rank}.`
}

function fmt(n: number | null | undefined): string {
  if (typeof n !== 'number' || Number.isNaN(n)) return '0'
  if (n === 0) return '0'
  return n % 1 === 0 ? String(n) : n.toFixed(3).replace(/\.?0+$/, '')
}

function formatSeasonDate(date: string) {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

function formatSeasonScoreCell(score: number | null, season: { startMs: number, startDate: string }) {
  if (season.startMs > Date.now()) return formatSeasonDate(season.startDate)
  return score === null ? '-' : fmt(score)
}

function fmtLooster(n: number | null | undefined): string {
  return formatLoosterPoints(Math.round(typeof n === 'number' && !Number.isNaN(n) ? n : 0))
}

function fmtLoosterOneDecimal(n: number | null | undefined): string {
  return fmtLooster(n)
}

function placementLabel(placement: number): string {
  const suffix = placement === 1 ? 'st' : placement === 2 ? 'nd' : placement === 3 ? 'rd' : 'th'
  return `${placement}${suffix} place`
}

function placementOfPodLabel(placement: number, playerCount: number): string {
  const suffix = placement === 1 ? 'st' : placement === 2 ? 'nd' : placement === 3 ? 'rd' : 'th'
  return `${placement}${suffix} of ${playerCount}`
}

function pct(n: number): string {
  return `${(n * 100).toFixed(1).replace(/\.0$/, '')}%`
}

// ── Commander tooltip ─────────────────────────────────────────────────────────

const OFFSET_X = 16
const OFFSET_Y = 16

const hover = reactive({ visible: false, playerName: '', commanderName: '', x: 0, y: 0 })
const loosterHover = reactive({
  visible: false,
  playerName: '',
  title: '',
  totalLabel: '',
  totalValue: '',
  entries: [] as LoosterTooltipEntry[],
  x: 0,
  y: 0,
})

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
  if (loosterHover.visible) {
    const pos = calcMultPosition(e)
    loosterHover.x = pos.x
    loosterHover.y = pos.y
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
  if (ratingHover.visible) {
    const pos = calcRatingPosition(e)
    ratingHover.x = pos.x
    ratingHover.y = pos.y
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

function onLoosterEnter(row: LoosterTableRow, mode: 'games' | 'missed', e: MouseEvent) {
  loosterHover.playerName = row.name
  loosterHover.title = mode === 'games' ? 'L-Points Over Games' : 'L-Points Over Missed Games'
  loosterHover.totalLabel = mode === 'games' ? 'earned in played games' : 'earned from missed games'
  loosterHover.totalValue = mode === 'games'
    ? fmtLooster(row.gameLoosterPoints)
    : fmtLooster(row.missedGameLoosterPoints)
  loosterHover.entries = mode === 'games'
    ? row.gameLoosterPointsEntries
    : row.missedGameLoosterPointsEntries
  loosterHover.visible = true
  const pos = calcMultPosition(e)
  loosterHover.x = pos.x
  loosterHover.y = pos.y
}

function onLoosterLeave() {
  loosterHover.visible = false
  loosterHover.entries = []
}

// ── Achievement tooltip ───────────────────────────────────────────────────────

const achvHover = reactive({ visible: false, playerName: '', commanderName: '', x: 0, y: 0 })

function calcAchvPosition(e: MouseEvent) {
  let x = e.clientX + OFFSET_X
  let y = e.clientY + OFFSET_Y
  if (x + 240 > window.innerWidth) x = e.clientX - 240 - OFFSET_X
  if (y + 260 > window.innerHeight) y = e.clientY - 260 - OFFSET_Y
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
  if (x + 270 > window.innerWidth) x = e.clientX - 270 - OFFSET_X
  if (y + 310 > window.innerHeight) y = e.clientY - 310 - OFFSET_Y
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

const ratingHover = reactive<{
  visible: boolean
  playerName: string
  provisional: boolean
  gamesPlayed: number
  breakdown: Record<PlayerRatingBreakdownKey, RatingBreakdownEntry> | null
  x: number
  y: number
}>({
  visible: false,
  playerName: '',
  provisional: false,
  gamesPlayed: 0,
  breakdown: null,
  x: 0,
  y: 0,
})

const ratingSidebarOpen = ref(false)
const ratingSidebarPlayer = ref('')
const ratingSidebarComparePlayer = ref('')
const detailSidebarMode = ref<'rating' | 'achievements' | 'xp' | 'compare'>('rating')

function calcRatingPosition(e: MouseEvent) {
  let x = e.clientX + OFFSET_X
  let y = e.clientY + OFFSET_Y
  if (x + 420 > window.innerWidth) x = e.clientX - 420 - OFFSET_X
  if (y + 360 > window.innerHeight) y = e.clientY - 360 - OFFSET_Y
  return { x: x + window.scrollX, y: y + window.scrollY }
}

function onRatingEnter(row: { rankingSystem?: string, name: string, provisional?: boolean, gamesPlayed: number, ratingBreakdown?: any }, e: MouseEvent) {
  if (row.rankingSystem !== 'player_rating_based') return
  ratingHover.playerName = row.name
  ratingHover.provisional = Boolean(row.provisional)
  ratingHover.gamesPlayed = row.gamesPlayed
  ratingHover.breakdown = row.ratingBreakdown ?? null
  ratingHover.visible = true
  const pos = calcRatingPosition(e)
  ratingHover.x = pos.x
  ratingHover.y = pos.y
}

function onRatingLeave() {
  ratingHover.visible = false
}

function openRatingSidebar(playerName: string) {
  if (!isPlayerRatingMode.value) return
  detailSidebarMode.value = 'rating'
  ratingSidebarPlayer.value = playerName
  ratingSidebarComparePlayer.value = ''
  ratingSidebarOpen.value = true
}

function openDetailSidebar(playerName: string, mode: 'achievements' | 'xp') {
  detailSidebarMode.value = mode
  ratingSidebarPlayer.value = playerName
  ratingSidebarComparePlayer.value = ''
  ratingSidebarOpen.value = true
}

function openCompareSidebar(targetPlayerName: string, comparePlayerName: string) {
  detailSidebarMode.value = 'compare'
  ratingSidebarPlayer.value = targetPlayerName
  ratingSidebarComparePlayer.value = comparePlayerName
  ratingSidebarOpen.value = true
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
  totalScore: number
  totalPoints: number
  adjustmentPoints: number
  adjustedTotalPoints: number
  gamesPlayed: number
  avgPerGame: number
  rankingSystem?: string
  ratingBreakdown?: Record<PlayerRatingBreakdownKey, RatingBreakdownEntry> | null
}

type PlayerRatingComparisonEntry = {
  key: PlayerRatingBreakdownKey
  label: string
  delta: number
  note: string
}

const dashboardRatingFactorRows: Array<{
  key: PlayerRatingBreakdownKey
  label: string
}> = [
  { key: 'recentPerformance', label: 'Recent' },
  { key: 'allTimePerformance', label: 'All-time' },
  { key: 'seasonPoints', label: 'Season points' },
  { key: 'winRate', label: 'Win rate' },
  { key: 'commanderMMRContext', label: 'Finishes vs stronger commanders' },
  { key: 'averageCommanderMMR', label: 'Average commander MMR' },
  { key: 'activityPoints', label: 'Activity' },
  { key: 'achievements', label: 'Achv.' },
  { key: 'clutch', label: 'Finishes vs stronger players' },
  { key: 'commanderDiversity', label: 'Diversity' },
]

const ratingFactorColors: Record<PlayerRatingBreakdownKey, string> = {
  recentPerformance: '#9b6ee8',
  allTimePerformance: '#6c3fc5',
  seasonPoints: '#e8a030',
  winRate: '#ffd36a',
  commanderMMRContext: '#72b7ff',
  averageCommanderMMR: '#4a8edb',
  activityPoints: '#3cb87a',
  achievements: '#d2a8ff',
  clutch: '#e05050',
  commanderDiversity: '#c27be8',
}

function dashboardRatingFactorWeight(key: PlayerRatingBreakdownKey) {
  return key === 'activityPoints'
    ? settings.value.playerRating.weights.commanderPoints ?? 0
    : settings.value.playerRating.weights[key] ?? 0
}

const enabledDashboardRatingFactorRows = computed(() =>
  dashboardRatingFactorRows.filter((entry) => dashboardRatingFactorWeight(entry.key) > 0),
)

const ratingHoverRows = computed(() => {
  const breakdown = ratingHover.breakdown
  if (!breakdown) return []

  const totalFactorWeight = Object.values(settings.value.playerRating.weights)
    .reduce((sum, weight) => sum + weight, 0) || 1
  const confidenceMultiplier = Math.min(1, Math.max(0.45, ratingHover.gamesPlayed / 12))
  const ratingSpan = Math.max(0, settings.value.playerRating.maxRating - settings.value.playerRating.minRating)

  return enabledDashboardRatingFactorRows.value.map((entry) => ({
    ...entry,
    color: ratingFactorColors[entry.key],
    value: r3(
      ((breakdown[entry.key]?.weightedContribution ?? 0) / totalFactorWeight)
      * (0.2 + confidenceMultiplier)
      / 100
      * ratingSpan,
    ),
  }))
})

const ratingHoverTotal = computed(() => r3(
  ratingHoverRows.value.reduce((sum, entry) => sum + entry.value, 0),
))

const ratingHoverPieBackground = computed(() => {
  if (ratingHoverTotal.value <= 0) return 'rgba(255, 255, 255, 0.08)'

  let currentAngle = 0
  const segments = ratingHoverRows.value.map((entry) => {
    const startAngle = currentAngle
    const segmentAngle = (entry.value / ratingHoverTotal.value) * 360
    const gapAngle = Math.min(3.5, segmentAngle * 0.38)
    const endAngle = startAngle + Math.max(0, segmentAngle - gapAngle)
    currentAngle += segmentAngle
    return `${entry.color} ${startAngle}deg ${endAngle}deg, rgba(12, 8, 21, 0.98) ${endAngle}deg ${currentAngle}deg`
  })
  return `conic-gradient(${segments.join(', ')})`
})

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
  mode: 'catchup' | 'rating_compare'
  targetName: string
  viewerName: string
  targetRating: number
  viewerRating: number
  gap: number
  avgPerGame: number
  nextCompDelta: number
  nextNetGain: number
  gamesNeededLabel: string
  message: string
  summary: string
  strongerFactors: PlayerRatingComparisonEntry[]
  weakerFactors: PlayerRatingComparisonEntry[]
  improvementIdeas: string[]
}

const catchupHover = reactive<CatchupHoverData>({
  visible: false,
  x: 0,
  y: 0,
  mode: 'catchup',
  targetName: '',
  viewerName: '',
  targetRating: 0,
  viewerRating: 0,
  gap: 0,
  avgPerGame: 0,
  nextCompDelta: 0,
  nextNetGain: 0,
  gamesNeededLabel: '',
  message: '',
  summary: '',
  strongerFactors: [],
  weakerFactors: [],
  improvementIdeas: [],
})

const PLAYER_RATING_FACTOR_META: Record<PlayerRatingBreakdownKey, {
  label: string
  note: string
  tip: string
}> = {
  recentPerformance: {
    label: 'Recent Form',
    note: 'better finishes in recent games',
    tip: 'Improve recent form by converting your next few pods into podiums instead of spreading results across the middle.',
  },
  allTimePerformance: {
    label: 'Long-Term Performance',
    note: 'deeper full-history scoring base',
    tip: 'Raise your long-term score by building a longer stretch of above-average finishes, not just one hot week.',
  },
  seasonPoints: {
    label: 'Season Points',
    note: 'stronger averages across the active league seasons',
    tip: 'This climbs when you keep your season-by-season average high instead of relying on one isolated streak.',
  },
  winRate: {
    label: 'Win Rate',
    note: 'more first places per game played',
    tip: 'Close the win-rate gap by turning top-table appearances into actual wins more often.',
  },
  commanderMMRContext: {
    label: 'Finishes Against Stronger Opponents',
    note: 'stronger results into stronger commander pods',
    tip: 'Push this factor by finishing well into stronger commander pools rather than farming only softer pods.',
  },
  averageCommanderMMR: {
    label: 'Average Commander MMR',
    note: 'bringing stronger commanders on average',
    tip: 'This rises when your regular commander pool carries stronger MMR over time.',
  },
  activityPoints: {
    label: 'Activity',
    note: 'more rewarded play volume',
    tip: 'This is the easiest lever: simply playing more league games will nudge your rating upward here.',
  },
  achievements: {
    label: 'Achievements',
    note: 'more valuable achievement unlocks',
    tip: 'Farm a few realistic achievement lines with your main decks to pick up efficient rating value here.',
  },
  clutch: {
    label: 'Clutch',
    note: 'better conversion of strong spots into wins',
    tip: 'Your best gain here comes from closing games: wins from podium positions matter more than safe seconds.',
  },
  commanderDiversity: {
    label: 'Diversity',
    note: 'broader set of viable commanders',
    tip: 'Add another reliable commander to your rotation so your rating is less concentrated in one lane.',
  },
}

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

function buildPlayerRatingComparison(target: CatchupRow) {
  const viewerName = loggedInPlayerName.value
  if (!viewerName || target.name === viewerName) return null
  if (target.rankingSystem !== 'player_rating_based') return null

  const viewer = table.value.find((row) => row.name === viewerName)
  if (!viewer || viewer.rankingSystem !== 'player_rating_based') return null
  if (!target.ratingBreakdown || !viewer.ratingBreakdown) return null

  const factorEntries = enabledDashboardRatingFactorRows.value
    .map((entry) => entry.key)
    .map((key) => {
      const targetEntry = target.ratingBreakdown?.[key]
      const viewerEntry = viewer.ratingBreakdown?.[key]
      if (!targetEntry || !viewerEntry) return null

      return {
        key,
        label: PLAYER_RATING_FACTOR_META[key].label,
        delta: r3(targetEntry.weightedContribution - viewerEntry.weightedContribution),
        note: PLAYER_RATING_FACTOR_META[key].note,
        tip: PLAYER_RATING_FACTOR_META[key].tip,
      }
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null)
    .sort((left, right) => Math.abs(right.delta) - Math.abs(left.delta))

  const strongerFactors = factorEntries
    .filter((entry) => entry.delta > 0.01)
    .slice(0, 3)
    .map(({ key, label, delta, note }) => ({ key, label, delta, note }))

  const weakerFactors = factorEntries
    .filter((entry) => entry.delta < -0.01)
    .slice(0, 2)
    .map(({ key, label, delta, note }) => ({ key, label, delta, note }))

  const improvementIdeas = factorEntries
    .filter((entry) => entry.delta > 0.01)
    .slice(0, 3)
    .map((entry) => PLAYER_RATING_FACTOR_META[entry.key].tip)

  const strongestLabels = strongerFactors.map((entry) => entry.label)
  const summary = strongestLabels.length > 0
    ? `${target.name} currently gains more rating than you from ${joinNaturalLanguage(strongestLabels)}.`
    : `You already match or exceed ${target.name} across the main Player Rating factors.`

  return {
    viewerName,
    viewerRating: viewer.totalScore,
    targetRating: target.totalScore,
    strongerFactors,
    weakerFactors,
    improvementIdeas,
    summary,
  }
}

function onPlayerEnter(row: CatchupRow, e: MouseEvent) {
  const ratingComparison = buildPlayerRatingComparison(row)
  if (ratingComparison) {
    catchupHover.visible = true
    catchupHover.mode = 'rating_compare'
    catchupHover.targetName = row.name
    catchupHover.viewerName = ratingComparison.viewerName
    catchupHover.targetRating = ratingComparison.targetRating
    catchupHover.viewerRating = ratingComparison.viewerRating
    catchupHover.summary = ratingComparison.summary
    catchupHover.strongerFactors = ratingComparison.strongerFactors
    catchupHover.weakerFactors = ratingComparison.weakerFactors
    catchupHover.improvementIdeas = ratingComparison.improvementIdeas
    const pos = calcCatchupPosition(e)
    catchupHover.x = pos.x
    catchupHover.y = pos.y
    return
  }

  const estimate = estimateCatchup(row)
  if (!estimate) return

  catchupHover.visible = true
  catchupHover.mode = 'catchup'
  catchupHover.targetName = row.name
  catchupHover.viewerName = ''
  catchupHover.targetRating = 0
  catchupHover.viewerRating = 0
  catchupHover.gap = estimate.gap
  catchupHover.avgPerGame = estimate.avgPerGame
  catchupHover.nextCompDelta = estimate.nextCompDelta
  catchupHover.nextNetGain = estimate.nextNetGain
  catchupHover.gamesNeededLabel = estimate.gamesNeededLabel
  catchupHover.message = estimate.message
  catchupHover.summary = ''
  catchupHover.strongerFactors = []
  catchupHover.weakerFactors = []
  catchupHover.improvementIdeas = []
  const pos = calcCatchupPosition(e)
  catchupHover.x = pos.x
  catchupHover.y = pos.y
}

function onPlayerContextMenu(row: CatchupRow, event: MouseEvent) {
  const viewerName = loggedInPlayerName.value
  const shouldSkipSidebar =
    !isPlayerRatingMode.value ||
    !viewerName ||
    row.name === viewerName

  if (shouldSkipSidebar) return
  openCompareSidebar(row.name, viewerName)
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
  min-width: 720px;
  border-collapse: collapse;

  &__th,
  &__td {
    padding: $spacing-2 $spacing-3;
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

  &__row {
    transition: background $transition-fast;

    &:hover {
      background: rgba(16, 16, 16, 0.35);
      backdrop-filter: blur(3px);
    }
  }

  &__td {
    color: $color-text;
    font-size: $font-size-sm;
  }

  &__td--hoverable {
    cursor: default;
    text-decoration: underline dotted rgba($color-primary-light, 0.45);
    text-underline-offset: 0.16em;
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

  &__available-link {
    color: inherit;
    text-decoration: underline dotted rgba($color-success, 0.72);
    text-underline-offset: 0.16em;

    &:hover {
      color: $color-success;
      text-decoration-style: solid;
    }
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

.dashboard__mmr-filter {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: $spacing-2;
}

.dashboard__mmr-filter-label {
  font-size: $font-size-xs;
  color: $color-text-muted;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  margin-right: $spacing-1;
}

.dashboard__mmr-filter-btn {
  padding: 3px 10px;
  border-radius: $border-radius-full;
  border: 1px solid rgba($border-color, 0.6);
  background: transparent;
  color: $color-text;
  font-size: 11px;
  cursor: pointer;
  transition: opacity $transition-fast, border-color $transition-fast;

  &:hover {
    border-color: rgba($color-primary-light, 0.4);
  }

  &--hidden {
    opacity: 0.35;
  }
}

.dashboard__perf-switcher {
  display: flex;
  flex-wrap: wrap;
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

.dashboard__perf-season-switcher {
  display: flex;
  flex-wrap: wrap;
  gap: $spacing-2;
}

.dashboard__perf-season-switch {
  padding: 3px 12px;
  border-radius: $border-radius-full;
  border: 1px solid rgba($border-color, 0.5);
  background: rgba(255, 255, 255, 0.02);
  color: $color-text-muted;
  font-size: 11px;
  font-weight: $font-weight-medium;
  cursor: pointer;
  transition: color $transition-fast, border-color $transition-fast, background $transition-fast;

  &:hover {
    color: $color-text;
    border-color: rgba($color-primary-light, 0.36);
  }

  &--active {
    color: $color-text;
    border-color: rgba($color-primary-light, 0.5);
    background: rgba($color-primary, 0.14);
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
  border: 1px solid $border-color;
  border-radius: $border-radius-lg;
}

.dashboard__heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: $spacing-3;
}

.dashboard__simulation-actions { display: inline-flex; gap: $spacing-2; }
.dashboard__simulation-button {
  padding: $spacing-2 $spacing-3;
  border: 1px solid rgba($color-primary-light, .5);
  border-radius: $border-radius-md;
  background: rgba($color-primary, .14);
  color: $color-text;
  font: inherit;
  font-size: $font-size-xs;
  font-weight: $font-weight-semibold;
  cursor: pointer;
}
.standings__simulation-input {
  width: 74px;
  padding: 3px 5px;
  border: 1px solid rgba($color-primary-light, .65);
  border-radius: $border-radius-sm;
  background: rgba($color-primary, .12);
  color: $color-text;
  font: inherit;
  font-size: $font-size-xs;
  text-align: center;
}

.standings {
  width: 100%;
  background: rgba(0, 0, 0, 0.25);
  border-collapse: collapse;
  font-size: $font-size-sm;

  &__th {
    text-align: center;
    padding: $spacing-2 $spacing-3;
    color: $color-text-muted;
    font-size: $font-size-xs;
    text-transform: uppercase;
    letter-spacing: 0.07em;
    font-weight: $font-weight-medium;
    border-bottom: 1px solid $border-color;
    white-space: nowrap;

    &--num  { text-align: center; }
    &--rank { width: 2.5rem; text-align: center; }
    &--commander {
      text-align: left;
      white-space: nowrap;
      width: 1%;
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
      justify-content: center;
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
    text-align: center;

    &--num { text-align: center; font-variant-numeric: tabular-nums; }
    &--rank { text-align: center; }
    &--commander { text-align: left; }
    &--total { font-weight: $font-weight-bold; color: $color-secondary; }
    &--avg-mmr { white-space: nowrap; }
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

  &__avg-mmr {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    color: $color-primary-light;
    font-size: $font-size-xs;
    white-space: nowrap;
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
    flex-wrap: nowrap;
    white-space: nowrap;

    &:hover {
      cursor:pointer;
      color: $color-primary-light;
      text-decoration: underline dotted;
    }
  }

  &__commander-mmr {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    font-size: 10px;
    font-weight: $font-weight-semibold;
    color: $color-secondary;
    letter-spacing: 0.04em;
    width: 100%;
    text-align: center;
    margin-left: 0;
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

.standings__rating-button {
  appearance: none;
  border: 0;
  padding: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  text-decoration: underline;
  text-decoration-color: rgba($color-primary-light, 0.3);
  text-underline-offset: 0.18em;

  &:hover {
    color: $color-primary-light;
    text-decoration-color: rgba($color-primary-light, 0.75);
  }
}

.standings__season-score {
  display: inline-block;
  font-size: 12px;
  line-height: 1.45;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.standings__detail-button {
  appearance: none;
  border: 0;
  padding: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  cursor: pointer;
  text-decoration: underline;
  text-decoration-color: rgba($color-primary-light, 0.25);
  text-underline-offset: 0.16em;

  &:hover {
    color: $color-primary-light;
    text-decoration-color: rgba($color-primary-light, 0.65);
  }
}

.rating-hover {
  display: flex;
  align-items: center;
  gap: $spacing-4;
}

.rating-hover__pie {
  position: relative;
  display: grid;
  place-content: center;
  flex: 0 0 112px;
  width: 112px;
  aspect-ratio: 1;
  border-radius: 50%;
  text-align: center;

  &::after {
    content: '';
    position: absolute;
    inset: 24px;
    border-radius: 50%;
    background: rgba(12, 8, 21, 0.98);
  }
}

.rating-hover__pie-value {
  position: relative;
  z-index: 1;
}

.rating-hover__pie-value {
  font-size: $font-size-sm;
  font-weight: $font-weight-bold;
  color: $color-text;
  font-variant-numeric: tabular-nums;
  text-shadow: 0 1px 4px rgba(0, 0, 0, 0.9);
}

.rating-hover__legend {
  display: grid;
  gap: 4px;
  min-width: 170px;
}

.rating-hover__legend-row {
  display: grid;
  grid-template-columns: 8px minmax(0, 1fr) auto;
  align-items: center;
  gap: 6px;
  font-size: 11px;
}

.rating-hover__swatch {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.rating-hover__label {
  overflow: hidden;
  color: $color-text-muted;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.rating-hover__value {
  color: $color-text;
  font-variant-numeric: tabular-nums;
}

.rating-hover__status {
  margin-top: $spacing-3;
  padding-top: $spacing-2;
  border-top: 1px solid rgba($color-primary-light, 0.2);
  color: $color-text-muted;
  font-size: 10px;
  text-align: center;
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

.mult-tooltip {
  background: linear-gradient(155deg, rgba(18, 12, 30, 0.97), rgba(7, 5, 13, 0.98));
  border: 1px solid rgba($color-primary-light, 0.3);
  border-radius: $border-radius-lg;
  padding: $spacing-4;
  min-width: 260px;
  max-width: 500px;
  box-shadow:
    0 24px 64px rgba(0, 0, 0, 0.72),
    0 0 0 1px rgba($color-primary-light, 0.04),
    inset 0 1px 0 rgba(255, 255, 255, 0.04);

  &__title {
    font-size: 10px;
    font-weight: $font-weight-bold;
    color: $color-primary-light;
    text-transform: uppercase;
    letter-spacing: 0.14em;
    margin-bottom: $spacing-3;
    padding-bottom: $spacing-2;
    border-bottom: 1px solid rgba($color-primary-light, 0.2);
  }

  &__summary {
    max-width: 440px;
    margin-bottom: $spacing-3;
    font-size: $font-size-xs;
    line-height: 1.55;
    color: rgba($color-text, 0.9);
  }

  &__table {
    width: 100%;
    border-collapse: collapse;
    font-size: $font-size-xs;
  }

  &__label {
    color: rgba($color-text-muted, 0.85);
    padding: 3px 0;
    white-space: nowrap;
    font-weight: $font-weight-medium;
  }

  &__op {
    color: rgba($color-primary-light, 0.55);
    text-align: center;
    padding: 0 $spacing-1;
  }

  &__detail {
    color: rgba($color-text-muted, 0.65);
    padding: 0 $spacing-2;
    font-variant-numeric: tabular-nums;
    line-height: 1.4;
  }

  &__value {
    text-align: right;
    color: $color-text;
    font-variant-numeric: tabular-nums;
    font-weight: $font-weight-semibold;
    padding-left: $spacing-3;
    white-space: nowrap;
  }

  &__inline-note {
    color: rgba($color-text-muted, 0.7);
  }

  &__row--sep td {
    border-top: 1px solid rgba($color-primary-light, 0.18);
    padding-top: $spacing-2;
    color: $color-secondary;
    font-weight: $font-weight-bold;
  }

  &__row--stronger td {
    color: rgba(#f0829e, 0.88);
  }

  &__row--stronger .mult-tooltip__value {
    color: #f0829e;
    font-weight: $font-weight-bold;
  }

  &__row--weaker td {
    color: rgba($color-success, 0.82);
  }

  &__row--weaker .mult-tooltip__value {
    color: $color-success;
    font-weight: $font-weight-bold;
  }

  &__ideas {
    margin-top: $spacing-3;
    max-width: 440px;
    border-top: 1px solid rgba($color-primary-light, 0.18);
    padding-top: $spacing-2;
  }

  &__ideas-title {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: rgba($color-primary-light, 0.72);
    margin-bottom: $spacing-1;
  }

  &__ideas-list {
    margin: 0;
    padding-left: 16px;
    display: grid;
    gap: 4px;
  }

  &__ideas-item {
    color: rgba($color-text, 0.88);
    line-height: 1.45;
  }

  &__label--clamped {
    color: $color-accent;
  }
}

.looster-tooltip {
  min-width: 320px;

  .mult-tooltip__summary {
    margin-bottom: $spacing-2;
    color: $color-text-muted;
    font-size: $font-size-xs;
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }
}
</style>
