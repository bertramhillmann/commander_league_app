<template>
  <div class="rating-chart">
    <div class="rating-chart__header">
      <span class="rating-chart__title">{{ title }}</span>
      <span class="rating-chart__summary">{{ points.length }} games</span>
    </div>

    <div v-if="points.length > 0" class="rating-chart__frame">
      <canvas ref="canvasRef" class="rating-chart__canvas" @click="onCanvasClick" />
    </div>

    <div v-else class="rating-chart__empty">
      No rating history yet.
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Chart, ChartConfiguration, TooltipItem } from 'chart.js'
import type { PlayerRatingSnapshot } from '~/composables/usePlayerRating'

const props = withDefaults(defineProps<{
  points: PlayerRatingSnapshot[]
  averageRatings?: Array<number | null>
  title?: string
}>(), {
  averageRatings: () => [],
  title: 'Player Rating Over Time',
})

const emit = defineEmits<{
  pointClick: [gameId: string]
}>()

const canvasRef = ref<HTMLCanvasElement | null>(null)
let chart: Chart | null = null

function onCanvasClick(event: MouseEvent) {
  if (!chart || !canvasRef.value || props.points.length === 0) return
  const rect = canvasRef.value.getBoundingClientRect()
  const pixelX = event.clientX - rect.left
  const rawIndex = chart.scales.x.getValueForPixel(pixelX)
  if (rawIndex === undefined) return
  const index = Math.max(0, Math.min(props.points.length - 1, Math.round(rawIndex)))
  const gameId = props.points[index]?.gameId
  if (gameId) emit('pointClick', gameId)
}

const ratingBounds = computed(() => {
  const values = [
    ...props.points.map((p) => p.rating),
    ...props.averageRatings.filter((value): value is number => value !== null),
  ]
  if (values.length === 0) return { min: 1400, max: 1600 }
  const min = Math.min(...values)
  const max = Math.max(...values)
  if (min === max) return { min: min - 50, max: max + 50 }
  const pad = Math.max(20, Math.round((max - min) * 0.12))
  return { min: min - pad, max: max + pad }
})

watch(() => [props.points, props.averageRatings], async () => { await renderChart() }, { deep: true })
onMounted(async () => { await renderChart() })
onBeforeUnmount(() => { if (chart) chart.destroy() })

async function renderChart() {
  if (!canvasRef.value || !import.meta.client) return
  const { default: ChartJS } = await import('chart.js/auto')
  if (chart) chart.destroy()
  chart = new ChartJS(canvasRef.value, buildConfig())
}

function buildConfig(): ChartConfiguration<'line'> {
  const labels = props.points.map((p, i) => `G${i + 1} · ${p.date}`)
  const ratings = props.points.map((p) => p.rating)
  const bounds = ratingBounds.value
  const hasAverageComparison = props.averageRatings.length === props.points.length
    && props.averageRatings.some((value) => value !== null)

  return {
    type: 'line',
    data: {
      labels,
      datasets: [
        ...(hasAverageComparison
          ? [{
              label: 'League Avg Rating',
              data: props.averageRatings,
              borderColor: 'rgba(148, 163, 184, 0.3)',
              backgroundColor: 'transparent',
              tension: 0.28,
              borderWidth: 1.7,
              pointRadius: 0,
              pointHoverRadius: 3,
              pointHoverBackgroundColor: 'rgba(148, 163, 184, 0.45)',
              pointHoverBorderColor: '#242438',
              pointHoverBorderWidth: 0.8,
              fill: false,
            }]
          : []),
        {
          label: 'Player Rating',
          data: ratings,
          borderColor: '#f59e0b',
          backgroundColor: 'rgba(245, 158, 11, 0.1)',
          tension: 0.28,
          borderWidth: 1.9,
          pointRadius: 2.1,
          pointHoverRadius: 3.6,
          pointBackgroundColor: props.points.map((p) => p.provisional ? 'rgba(245, 158, 11, 0.45)' : '#f59e0b'),
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
        padding: { top: 8, right: 6, bottom: 2, left: 2 },
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          displayColors: false,
          backgroundColor: 'rgba(36, 36, 56, 0.96)',
          borderColor: 'rgba(245, 158, 11, 0.24)',
          borderWidth: 1,
          titleColor: '#f3f3ff',
          bodyColor: '#c8c8df',
          padding: 10,
          callbacks: {
            title(items) {
              const item = items[0]
              const point = props.points[item.dataIndex]
              return point?.date ?? item.label
            },
            label(item: TooltipItem<'line'>) {
              if (item.dataset.label === 'League Avg Rating') {
                return `League Avg Rating ${Math.round(item.parsed.y)}`
              }
              const point = props.points[item.dataIndex]
              if (!point) return ''
              const bits = [`Rating ${Math.round(point.rating)}`]
              if (point.provisional) bits.push('Provisional')
              if (point.commander) bits.push(point.commander)
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
          min: bounds.min,
          max: bounds.max,
          ticks: {
            autoSkip: true,
            color: 'rgba(136, 136, 170, 0.78)',
            callback(value) { return fmt(Number(value)) },
            font: { size: 9 },
            padding: 6,
          },
          grid: {
            color: 'rgba(136, 136, 170, 0.1)',
            drawTicks: false,
          },
          border: { display: false, dash: [2, 3] },
        },
      },
    },
  }
}

function fmt(n: number) {
  if (n === 0) return '0'
  return n % 1 === 0 ? String(n) : n.toFixed(2).replace(/\.?0+$/, '')
}
</script>

<style lang="scss" scoped>
.rating-chart {
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
    cursor: pointer;
  }

  &__empty {
    font-size: $font-size-xs;
    color: $color-text-muted;
  }
}
</style>
