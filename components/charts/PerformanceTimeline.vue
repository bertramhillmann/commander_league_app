<template>
  <div class="perf-chart">
    <div class="perf-chart__header">
      <div class="perf-chart__title-group">
        <span class="perf-chart__title">Performance Trends</span>
        <span class="perf-chart__subtitle">Exponential weighted score — recent games count more (λ=0.1)</span>
      </div>
      <div class="perf-chart__legend">
        <button
          v-for="(s, i) in props.series"
          :key="s.name"
          type="button"
          class="perf-chart__legend-item"
          :class="{ 'perf-chart__legend-item--hidden': hiddenSet.has(s.name) }"
          @click="toggleSeries(s.name, i)"
        >
          <span class="perf-chart__legend-dot" :style="{ background: s.color }" />
          {{ s.name }}
        </button>
      </div>
    </div>

    <div v-if="props.series.length > 0" class="perf-chart__frame">
      <canvas ref="canvasRef" class="perf-chart__canvas" />
    </div>
    <div v-else class="perf-chart__empty">No performance data yet.</div>
  </div>
</template>

<script setup lang="ts">
import type { Chart, ChartConfiguration, TooltipItem } from 'chart.js'

export interface PerformancePlayerSeries {
  name: string
  color: string
  data: (number | null)[]
}

const props = withDefaults(defineProps<{
  labels: string[]
  series: PerformancePlayerSeries[]
  filled?: boolean
}>(), { filled: false })

const canvasRef = ref<HTMLCanvasElement | null>(null)
const hiddenSet = ref<Set<string>>(new Set())
let chart: Chart | null = null

watch(
  () => [props.labels, props.series],
  async () => { await renderChart() },
  { deep: true },
)

onMounted(async () => { await renderChart() })
onBeforeUnmount(() => { if (chart) chart.destroy() })

async function renderChart() {
  if (!canvasRef.value || !import.meta.client) return
  const { default: ChartJS } = await import('chart.js/auto')
  if (chart) chart.destroy()
  chart = new ChartJS(canvasRef.value, buildConfig())
}

function toggleSeries(name: string, datasetIndex: number) {
  if (!chart) return
  if (hiddenSet.value.has(name)) {
    hiddenSet.value.delete(name)
    chart.setDatasetVisibility(datasetIndex, true)
  } else {
    hiddenSet.value.add(name)
    chart.setDatasetVisibility(datasetIndex, false)
  }
  hiddenSet.value = new Set(hiddenSet.value)
  chart.update()
}

function buildConfig(): ChartConfiguration<'line'> {
  return {
    type: 'line',
    data: {
      labels: props.labels,
      datasets: props.series.map((s) => ({
        label: s.name,
        data: s.data,
        borderColor: s.color,
        backgroundColor: props.filled ? hexToRgba(s.color, 0.15) : 'transparent',
        borderWidth: 1.8,
        tension: 0.3,
        spanGaps: true,
        pointRadius: 0,
        pointHoverRadius: 4,
        pointHoverBackgroundColor: s.color,
        pointHoverBorderColor: '#1a1a2e',
        pointHoverBorderWidth: 1.5,
        fill: props.filled ? 'origin' as const : false as const,
      })),
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      interaction: {
        mode: 'index',
        intersect: false,
      },
      layout: {
        padding: { top: 8, right: 8, bottom: 2, left: 2 },
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(20, 18, 36, 0.97)',
          borderColor: 'rgba(136, 136, 170, 0.2)',
          borderWidth: 1,
          titleColor: '#f3f3ff',
          bodyColor: '#c8c8df',
          padding: 10,
          displayColors: true,
          boxWidth: 8,
          boxHeight: 8,
          callbacks: {
            title(items) { return items[0]?.label ?? '' },
            label(item: TooltipItem<'line'>) {
              const val = item.parsed.y
              if (val === null || val === undefined) return ''
              return `${item.dataset.label}: ${fmt(val)}`
            },
          },
          filter(item) {
            return item.parsed.y !== null && item.parsed.y !== undefined
          },
          itemSort(a, b) {
            return (b.parsed.y ?? 0) - (a.parsed.y ?? 0)
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
            maxTicksLimit: 8,
            font: { size: 9 },
          },
        },
        y: {
          grid: { color: 'rgba(136, 136, 170, 0.08)', drawTicks: false },
          border: { display: false },
          ticks: {
            color: 'rgba(136, 136, 170, 0.78)',
            font: { size: 9 },
            padding: 6,
            callback(value) { return fmt(Number(value)) },
          },
        },
      },
    },
  }
}

function hexToRgba(hex: string, alpha: number) {
  const r = Number.parseInt(hex.slice(1, 3), 16)
  const g = Number.parseInt(hex.slice(3, 5), 16)
  const b = Number.parseInt(hex.slice(5, 7), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

function fmt(n: number) {
  if (n === 0) return '0'
  return n % 1 === 0 ? String(n) : n.toFixed(2).replace(/\.?0+$/, '')
}
</script>

<style lang="scss" scoped>
.perf-chart {
  background: rgba($color-bg-elevated, 0.45);
  border: 1px solid $border-color;
  border-radius: $border-radius-xl;
  padding: $spacing-4;
  display: flex;
  flex-direction: column;
  gap: $spacing-3;

  &__header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: $spacing-4;
    flex-wrap: wrap;
  }

  &__title-group {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  &__title {
    font-size: $font-size-xs;
    font-weight: $font-weight-semibold;
    color: $color-text;
    text-transform: uppercase;
    letter-spacing: 0.07em;
  }

  &__subtitle {
    font-size: 10px;
    color: $color-text-muted;
  }

  &__legend {
    display: flex;
    flex-wrap: wrap;
    gap: $spacing-2;
  }

  &__legend-item {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 3px 8px;
    border: 1px solid rgba($border-color, 0.6);
    border-radius: $border-radius-full;
    background: transparent;
    font-size: 11px;
    color: $color-text;
    cursor: pointer;
    transition: opacity $transition-fast, border-color $transition-fast;

    &:hover {
      border-color: rgba($color-primary-light, 0.4);
    }

    &--hidden {
      opacity: 0.35;
    }
  }

  &__legend-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  &__frame {
    height: 280px;
    position: relative;
    overflow: hidden;
  }

  &__canvas {
    display: block;
    position: absolute;
    inset: 0;
    width: 100% !important;
    height: 100% !important;
  }

  &__empty {
    font-size: $font-size-xs;
    color: $color-text-muted;
    padding: $spacing-4 0;
  }
}

@media (max-width: $breakpoint-sm) {
  .perf-chart {
    &__frame {
      height: 120px;
    }
  }
}
</style>
