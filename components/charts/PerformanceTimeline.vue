<template>
  <div class="perf-chart">
    <div class="perf-chart__header">
      <div class="perf-chart__title-group">
        <span class="perf-chart__title">{{ props.title }}</span>
        <span v-if="props.subtitle" class="perf-chart__subtitle">{{ props.subtitle }}</span>
      </div>
      <div class="perf-chart__legend">
        <button
          v-for="(s, i) in props.series"
          :key="s.name"
          type="button"
          class="perf-chart__legend-item"
          :class="{
            'perf-chart__legend-item--hidden': hiddenSet.has(s.name),
            'perf-chart__legend-item--dimmed': soloedSeries !== null && soloedSeries !== s.name,
          }"
          @click="toggleSeries(s.name, i)"
          @contextmenu.prevent="soloSeries(s.name)"
        >
          <span class="perf-chart__legend-dot" :style="{ background: s.color }" />
          {{ s.name }}
        </button>
      </div>
    </div>

    <div v-if="props.series.length > 0" class="perf-chart__frame">
      <canvas
        ref="canvasRef"
        class="perf-chart__canvas"
        @pointerdown="onPointerDown"
        @pointermove="onPointerMove"
        @pointerup="onPointerUp"
        @pointercancel="onPointerCancel"
      />
      <div
        v-if="isDragging"
        class="perf-chart__drag-box"
        :style="dragBoxStyle"
      />
      <button
        v-if="selectionRange || props.seasonFiltered"
        type="button"
        class="perf-chart__reset-btn"
        @click="resetZoom"
      >Reset zoom</button>
    </div>
    <div v-else class="perf-chart__empty">{{ props.emptyLabel }}</div>
  </div>
</template>

<script setup lang="ts">
import type { Chart, ChartConfiguration, TooltipItem } from 'chart.js'

export interface PerformancePlayerSeries {
  name: string
  color: string
  data: (number | null)[]
  tooltipData?: (string | null)[]
}

const props = withDefaults(defineProps<{
  labels: string[]
  series: PerformancePlayerSeries[]
  filled?: boolean
  title?: string
  subtitle?: string
  emptyLabel?: string
  seasonFiltered?: boolean
  gameIds?: (string | null)[]
}>(), {
  filled: false,
  title: 'Performance Trends',
  subtitle: 'Exponential weighted score - recent games count more',
  emptyLabel: 'No performance data yet.',
  seasonFiltered: false,
  gameIds: undefined,
})

const emit = defineEmits<{
  reset: []
  pointClick: [gameId: string]
}>()

const canvasRef = ref<HTMLCanvasElement | null>(null)
const hiddenSet = ref<Set<string>>(new Set())
const soloedSeries = ref<string | null>(null)
let chart: Chart | null = null
let renderVersion = 0

const selectionRange = ref<{ start: number; end: number } | null>(null)
const isDragging = ref(false)
const dragStartX = ref(0)
const dragCurrentX = ref(0)

const displayLabels = computed(() => {
  if (!selectionRange.value) return props.labels
  return props.labels.slice(selectionRange.value.start, selectionRange.value.end + 1)
})

const displaySeries = computed<PerformancePlayerSeries[]>(() => {
  if (!selectionRange.value) return props.series
  const { start, end } = selectionRange.value
  return props.series.map((s) => ({
    ...s,
    data: s.data.slice(start, end + 1),
    tooltipData: s.tooltipData?.slice(start, end + 1),
  }))
})

const displayGameIds = computed(() => {
  if (!props.gameIds) return null
  if (!selectionRange.value) return props.gameIds
  return props.gameIds.slice(selectionRange.value.start, selectionRange.value.end + 1)
})

const dragBoxStyle = computed(() => {
  const left = Math.min(dragStartX.value, dragCurrentX.value)
  const width = Math.abs(dragCurrentX.value - dragStartX.value)
  return { left: `${left}px`, width: `${width}px` }
})

const DRAG_THRESHOLD_PX = 8

function onPointerDown(event: PointerEvent) {
  if (!chart || event.button !== 0) return
  const canvas = canvasRef.value
  if (!canvas) return
  const rect = canvas.getBoundingClientRect()
  isDragging.value = true
  dragStartX.value = event.clientX - rect.left
  dragCurrentX.value = dragStartX.value
  canvas.setPointerCapture(event.pointerId)
}

function onPointerMove(event: PointerEvent) {
  if (!isDragging.value) return
  const canvas = canvasRef.value
  if (!canvas) return
  const rect = canvas.getBoundingClientRect()
  dragCurrentX.value = Math.min(Math.max(event.clientX - rect.left, 0), rect.width)
}

function onPointerUp(event: PointerEvent) {
  if (!isDragging.value || !chart) return
  isDragging.value = false
  const canvas = canvasRef.value
  if (canvas) canvas.releasePointerCapture(event.pointerId)

  const minPx = Math.min(dragStartX.value, dragCurrentX.value)
  const maxPx = Math.max(dragStartX.value, dragCurrentX.value)
  if (maxPx - minPx < DRAG_THRESHOLD_PX) {
    handlePointClick(dragCurrentX.value)
    return
  }

  const xScale = chart.scales.x
  const rawStart = xScale.getValueForPixel(minPx)
  const rawEnd = xScale.getValueForPixel(maxPx)
  if (rawStart === undefined || rawEnd === undefined) return

  const currentLength = displayLabels.value.length
  const localStart = Math.max(0, Math.min(currentLength - 1, Math.round(rawStart)))
  const localEnd = Math.max(0, Math.min(currentLength - 1, Math.round(rawEnd)))
  if (localEnd <= localStart) return

  const offset = selectionRange.value?.start ?? 0
  selectionRange.value = { start: offset + localStart, end: offset + localEnd }
}

function handlePointClick(pixelX: number) {
  if (!chart || !displayGameIds.value || displayGameIds.value.length === 0) return

  const xScale = chart.scales.x
  const rawIndex = xScale.getValueForPixel(pixelX)
  if (rawIndex === undefined) return

  const currentLength = displayLabels.value.length
  const index = Math.max(0, Math.min(currentLength - 1, Math.round(rawIndex)))
  const gameId = displayGameIds.value[index]
  if (gameId) emit('pointClick', gameId)
}

function onPointerCancel() {
  isDragging.value = false
}

function resetZoom() {
  selectionRange.value = null
  emit('reset')
}

watch(
  () => [props.labels, props.series],
  async () => {
    selectionRange.value = null
    await renderChart()
  },
  { deep: true },
)

watch(selectionRange, async () => { await renderChart() }, { deep: true })

onMounted(async () => { await renderChart() })
onBeforeUnmount(() => {
  renderVersion += 1
  if (chart) {
    chart.destroy()
    chart = null
  }
})

async function renderChart() {
  const version = ++renderVersion
  if (!import.meta.client) return
  await nextTick()
  const canvas = canvasRef.value
  if (!canvas || !canvas.isConnected) return
  const { default: ChartJS } = await import('chart.js/auto')
  if (version !== renderVersion) return
  const currentCanvas = canvasRef.value
  if (!currentCanvas || !currentCanvas.isConnected) return
  const context = currentCanvas.getContext('2d')
  if (!context) return
  if (chart) {
    chart.destroy()
    chart = null
  }
  chart = new ChartJS(context, buildConfig())
  applyVisibility()
  if (soloedSeries.value) applyOpacities()
  chart.update('none')
}

function applyVisibility() {
  if (!chart) return
  displaySeries.value.forEach((s, i) => {
    if (!chart) return
    chart.setDatasetVisibility(i, !hiddenSet.value.has(s.name))
  })
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

function applyOpacities() {
  if (!chart) return
  displaySeries.value.forEach((s, i) => {
    if (!chart) return
    const ds = chart.data.datasets[i]
    if (!soloedSeries.value || s.name === soloedSeries.value) {
      ds.borderColor = s.color
      ds.borderWidth = 1.8
    } else {
      ds.borderColor = withAlpha(s.color, 0.2)
      ds.borderWidth = 1.4
    }
  })
}

function soloSeries(name: string) {
  if (!chart) return
  soloedSeries.value = soloedSeries.value === name ? null : name
  applyOpacities()
  chart.update()
}

function buildConfig(): ChartConfiguration<'line'> {
  return {
    type: 'line',
    data: {
      labels: displayLabels.value,
      datasets: displaySeries.value.map((s) => ({
        label: s.name,
        data: s.data,
        borderColor: s.color,
        backgroundColor: props.filled ? withAlpha(s.color, 0.15) : 'transparent',
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
              const detail = displaySeries.value[item.datasetIndex]?.tooltipData?.[item.dataIndex]
              return detail
                ? `${item.dataset.label}: ${fmt(val)} (${detail})`
                : `${item.dataset.label}: ${fmt(val)}`
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

function withAlpha(color: string, alpha: number) {
  if (color.startsWith('#')) {
    const r = Number.parseInt(color.slice(1, 3), 16)
    const g = Number.parseInt(color.slice(3, 5), 16)
    const b = Number.parseInt(color.slice(5, 7), 16)
    return `rgba(${r}, ${g}, ${b}, ${alpha})`
  }
  // hsl(...) / rgb(...) — use CSS4 alpha syntax: hsl(h s l / a)
  return color.replace(')', ` / ${alpha})`)
}

function fmt(n: number) {
  if (n === 0) return '0'
  return n % 1 === 0 ? String(n) : n.toFixed(2).replace(/\.?0+$/, '')
}
</script>

<style lang="scss" scoped>
.perf-chart {
  background: rgba(0,0,0,0.5);
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

    &--dimmed {
      opacity: 0.2;
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
    touch-action: none;
    cursor: crosshair;
  }

  &__drag-box {
    position: absolute;
    top: 0;
    bottom: 0;
    background: rgba($color-primary-light, 0.18);
    border-left: 1px solid rgba($color-primary-light, 0.6);
    border-right: 1px solid rgba($color-primary-light, 0.6);
    pointer-events: none;
    z-index: 2;
  }

  &__reset-btn {
    position: absolute;
    top: 8px;
    right: 8px;
    z-index: 3;
    padding: 4px 10px;
    border: 1px solid rgba($border-color, 0.6);
    border-radius: $border-radius-full;
    background: rgba(20, 18, 36, 0.9);
    color: $color-text;
    font-size: 11px;
    cursor: pointer;
    transition: border-color $transition-fast, background $transition-fast;

    &:hover {
      border-color: rgba($color-primary-light, 0.5);
      background: rgba(20, 18, 36, 1);
    }
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
