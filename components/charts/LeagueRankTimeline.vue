<template>
  <div class="league-chart" :class="{ 'league-chart--compact': compact }">
    <div class="league-chart__header">
      <span class="league-chart__title">{{ title }}</span>
      <span class="league-chart__summary">{{ points.length }} games</span>
    </div>

    <div v-if="points.length > 0" class="league-chart__frame">
      <canvas ref="canvasRef" class="league-chart__canvas" />
    </div>

    <div v-else class="league-chart__empty">
      No league history yet.
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Chart, ChartConfiguration, Plugin, TooltipItem } from 'chart.js'
import type { LeagueRankTimelinePoint } from '~/utils/playerLeagueTimeline'

const props = withDefaults(defineProps<{
  points: LeagueRankTimelinePoint[]
  title?: string
  compact?: boolean
}>(), {
  title: 'League Placement Over Time',
  compact: false,
})

const canvasRef = ref<HTMLCanvasElement | null>(null)
let chart: Chart | null = null

const maxRank = computed(() =>
  Math.max(...props.points.map((point) => point.totalPlayers), 4),
)

watch(
  () => props.points,
  async () => {
    await renderChart()
  },
  { deep: true },
)

onMounted(async () => {
  await renderChart()
})

onBeforeUnmount(() => {
  if (chart) chart.destroy()
})

async function renderChart() {
  if (!canvasRef.value || !import.meta.client) return

  const { default: ChartJS } = await import('chart.js/auto')
  if (chart) chart.destroy()
  chart = new ChartJS(canvasRef.value, buildConfig())
}

function buildConfig(): ChartConfiguration<'line' | 'scatter'> {
  const labels = props.points.map((point) => point.dateLabel)
  const ranks = props.points.map((point) => point.rank)
  const missedGames = props.points.map((point, index) =>
    point.participated ? { x: index, y: null } : { x: index, y: point.rank },
  )

  return {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          type: 'line',
          label: 'League Rank',
          data: ranks,
          borderColor: '#2c9c6a',
          backgroundColor: 'rgba(44, 156, 106, 0.12)',
          tension: 0.24,
          borderWidth: props.compact ? 1.6 : 1.9,
          pointRadius: props.compact ? 1.5 : 2.1,
          pointHoverRadius: props.compact ? 3 : 3.6,
          pointBackgroundColor: '#2c9c6a',
          pointBorderColor: '#242438',
          pointBorderWidth: 0.9,
          fill: false,
        },
        {
          type: 'scatter',
          label: 'Missed Game',
          data: missedGames,
          pointRadius: 0,
          pointHoverRadius: 0,
          pointBackgroundColor: 'rgba(0, 0, 0, 0)',
          pointBorderWidth: 0,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      layout: {
        padding: {
          top: 8,
          right: 6,
          bottom: 2,
          left: 2,
        },
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          displayColors: false,
          backgroundColor: 'rgba(36, 36, 56, 0.96)',
          borderColor: 'rgba(44, 156, 106, 0.24)',
          borderWidth: 1,
          titleColor: '#f3f3ff',
          bodyColor: '#c8c8df',
          padding: 10,
          callbacks: {
            title(items) {
              const item = items[0]
              const point = props.points[item.dataIndex]
              return point?.dateLabel ?? item.label
            },
            label(item: TooltipItem<'line' | 'scatter'>) {
              const point = props.points[item.dataIndex]
              if (!point) return ''
              const bits = [`Rank ${point.rank} of ${point.totalPlayers}`, `${fmt(point.totalPoints)} pts`]
              if (!point.participated) bits.push('Did not participate')
              return bits.join(' • ')
            },
          },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          border: { display: false },
          ticks: {
            color: 'rgba(136, 136, 170, 0.72)',
            maxRotation: 0,
            autoSkip: true,
            maxTicksLimit: 5,
            font: { size: 9 },
          },
        },
        y: {
          reverse: true,
          min: 0.5,
          max: maxRank.value + 0.5,
          ticks: {
            autoSkip: false,
            color: 'rgba(136, 136, 170, 0.78)',
            callback(value) {
              const numericValue = Number(value)
              if (!Number.isInteger(numericValue)) return ''
              return `${numericValue}`
            },
            font: { size: 9 },
            padding: 6,
          },
          grid: {
            color: 'rgba(136, 136, 170, 0.1)',
            borderDash: [2, 3],
            drawTicks: false,
          },
          border: { display: false },
        },
      },
    },
    plugins: [missedGamePlugin],
  }
}

const missedGamePlugin: Plugin<'line' | 'scatter'> = {
  id: 'missed-game-labels',
  afterDatasetsDraw(chartInstance) {
    const datasetMeta = chartInstance.getDatasetMeta(1)
    if (!datasetMeta) return

    const { ctx } = chartInstance
    ctx.save()
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.font = '700 9px sans-serif'

    datasetMeta.data.forEach((element, index) => {
      const point = props.points[index]
      if (point?.participated) return
      ctx.fillStyle = 'rgba(136, 136, 170, 0.88)'
      ctx.fillText('x', element.x, element.y - 9)
    })

    ctx.restore()
  },
}

function fmt(n: number) {
  if (n === 0) return '0'
  return n % 1 === 0 ? String(n) : n.toFixed(3).replace(/\.?0+$/, '')
}
</script>

<style lang="scss" scoped>
.league-chart {
  width:600px;
  height:300px;
  background: rgba($color-bg-elevated, 0.68);
  border: 1px solid rgba($border-color, 0.8);
  border-radius: $border-radius-md;
  padding: $spacing-2 $spacing-3;
  display: flex;
  flex-direction: column;
  gap: $spacing-1;

  &__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: $spacing-2;
  }

  &__title {
    font-size: $font-size-xs;
    font-weight: $font-weight-semibold;
    color: $color-text;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  &__summary {
    font-size: 10px;
    color: $color-text-muted;
  }

  &__frame {
    min-height: 128px;
  }

  &__canvas {
    display: block;
    width: 100%;
    height: 100%;
  }

  &__empty {
    font-size: $font-size-xs;
    color: $color-text-muted;
  }
}
</style>
