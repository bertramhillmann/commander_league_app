<template>
  <div class="match-chart" :class="{ 'match-chart--compact': compact }">
    <div class="match-chart__header">
      <span class="match-chart__title">{{ title }}</span>
      <span class="match-chart__summary">{{ points.length }} games</span>
    </div>

    <div v-if="points.length > 0" class="match-chart__frame">
      <canvas ref="canvasRef" class="match-chart__canvas" />
    </div>

    <div v-else class="match-chart__empty">
      No match history yet.
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Chart, ChartConfiguration, TooltipItem } from 'chart.js'
import type { PlayerMatchTimelinePoint } from '~/utils/playerMatchTimeline'

const props = withDefaults(defineProps<{
  points: PlayerMatchTimelinePoint[]
  title?: string
  compact?: boolean
}>(), {
  title: 'Match Results Over Time',
  compact: false,
})

const canvasRef = ref<HTMLCanvasElement | null>(null)
let chart: Chart | null = null

const maxPlacement = computed(() =>
  Math.max(...props.points.map((point) => point.playerCount), 4),
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

function buildConfig(): ChartConfiguration<'line'> {
  return {
    type: 'line',
    data: {
      labels: props.points.map((point) => point.dateLabel),
      datasets: [
        {
          label: 'Placement',
          data: props.points.map((point) => point.placement),
          borderColor: '#d08a34',
          backgroundColor: 'rgba(208, 138, 52, 0.14)',
          tension: 0.28,
          borderWidth: props.compact ? 1.6 : 1.9,
          pointRadius: props.compact ? 1.8 : 2.6,
          pointHoverRadius: props.compact ? 3 : 4,
          pointBackgroundColor: props.points.map((point) => pointColor(point)),
          pointBorderColor: '#242438',
          pointBorderWidth: 0.9,
          fill: false,
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
          borderColor: 'rgba(208, 138, 52, 0.24)',
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
            label(item: TooltipItem<'line'>) {
              const point = props.points[item.dataIndex]
              if (!point) return ''

              return [
                `${ordinal(point.placement)} of ${point.playerCount}`,
                point.commander,
                `${fmt(point.finalPoints)} total pts`,
                point.lPoints > 0 ? `${fmt(point.lPoints)} L-Points` : '0 L-Points',
                point.rankBefore && point.rankAfter
                  ? `Rank #${point.rankBefore} to #${point.rankAfter}`
                  : '',
              ].filter(Boolean).join(' | ')
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
          max: maxPlacement.value + 0.5,
          ticks: {
            autoSkip: false,
            color: 'rgba(136, 136, 170, 0.78)',
            callback(value) {
              const numericValue = Number(value)
              if (!Number.isInteger(numericValue)) return ''
              return ordinal(numericValue)
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
  }
}

function pointColor(point: PlayerMatchTimelinePoint) {
  if (point.placement === 1) return '#f0c24b'
  if (point.placement === point.playerCount) return '#cf5c73'
  if (point.placement === 2) return '#7ab8ff'
  return '#d08a34'
}

function ordinal(value: number) {
  if (value % 100 >= 11 && value % 100 <= 13) return `${value}th`
  if (value % 10 === 1) return `${value}st`
  if (value % 10 === 2) return `${value}nd`
  if (value % 10 === 3) return `${value}rd`
  return `${value}th`
}

function fmt(n: number) {
  if (n === 0) return '0'
  return n % 1 === 0 ? String(n) : n.toFixed(3).replace(/\.?0+$/, '')
}
</script>

<style lang="scss" scoped>
.match-chart {
  background: rgba($color-bg-elevated, 0.45);
  border: 1px solid $border-color;
  border-radius: $border-radius-lg;
  padding: $spacing-2 $spacing-3;
  display: flex;
  flex-direction: column;
  gap: $spacing-1;
  flex: 1 1 auto;
  min-height: 0;

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
    min-height: 106px;
    flex: 1 1 auto;
    position: relative;
    overflow: hidden;
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
