<template>
  <div class="placement-chart" :class="{ 'placement-chart--compact': compact }">
    <div v-if="!compact" class="placement-chart__header">
      <span class="placement-chart__title">{{ title }}</span>
      <span class="placement-chart__summary">{{ points.length }} games</span>
    </div>

    <div v-if="points.length > 0" class="placement-chart__frame">
      <canvas ref="canvasRef" class="placement-chart__canvas" />
    </div>

    <div v-else class="placement-chart__empty">
      No games yet.
    </div>

    <div v-if="hasTierChanges && !compact" class="placement-chart__legend">
      <span class="placement-chart__legend-item placement-chart__legend-item--line">Placement</span>
      <span
        v-for="point in legendTierExamples"
        :key="`${point.tier}-${point.tierChange}`"
        class="placement-chart__legend-item"
        :style="{ color: tierPalette[point.tier] }"
      >{{ point.tierChange === 'drop' ? '▼' : '▲' }} {{ point.tierLabel }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Chart, ChartConfiguration, Plugin, TooltipItem } from 'chart.js'
import type { CommanderMMRTimelinePoint, PlacementTimelinePoint } from '~/utils/commanderTimeline'

const props = withDefaults(defineProps<{
  points: Array<PlacementTimelinePoint | CommanderMMRTimelinePoint>
  title?: string
  compact?: boolean
  mode?: "placement" | "mmr"
}>(), {
  title: 'Placements Over Time',
  compact: false,
  mode: "placement",
})

const tierPalette: Record<string, string> = {
  god: '#fde68a',
  legend: '#e879f9',
  diamond: '#7ad8ff',
  platinum: '#d9dee8',
  gold: '#e8a030',
  silver: '#aeb7d0',
  bronze: '#b88357',
  trash: '#d85b72',
}

const canvasRef = ref<HTMLCanvasElement | null>(null)
let chart: Chart | null = null

const hasTierChanges = computed(() => props.points.some((point) => point.tierChange))

const legendTierExamples = computed(() => {
  const seen = new Set<string>()
  return props.points.filter((point) => {
    if (!point.tierChange) return false
    const key = `${point.tier}-${point.tierChange}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  }).slice(0, 4)
})

const placementPoints = computed(() =>
  props.points.filter((point): point is PlacementTimelinePoint => "placement" in point),
)

const mmrPoints = computed(() =>
  props.points.filter((point): point is CommanderMMRTimelinePoint => "mmr" in point),
)

const maxPlacement = computed(() =>
  Math.max(...placementPoints.value.map((point) => point.playerCount), 4),
)

watch(
  () => props.points,
  async () => {
    await renderChart()
  },
  { deep: true },
)

watch(
  () => props.compact,
  async () => {
    await renderChart()
  },
)

watch(
  () => props.mode,
  async () => {
    await renderChart()
  },
)

onMounted(async () => {
  await renderChart()
})

onBeforeUnmount(() => {
  destroyChart()
})

async function renderChart() {
  if (!canvasRef.value || !import.meta.client) return

  const { default: ChartJS } = await import('chart.js/auto')
  destroyChart()
  chart = new ChartJS(canvasRef.value, buildChartConfig())
}

function destroyChart() {
  if (!chart) return
  chart.destroy()
  chart = null
}

function buildChartConfig(): ChartConfiguration<'line' | 'scatter'> {
  const labels = props.points.map((point) => point.dateLabel)
  const metricValues = props.mode === "mmr"
    ? mmrPoints.value.map((point) => point.mmr)
    : placementPoints.value.map((point) => point.placement)
  const markerData = props.points.map((point, index) =>
    point.tierChange
      ? { x: index, y: props.mode === "mmr" && "mmr" in point ? point.mmr : "placement" in point ? point.placement : null }
      : { x: index, y: null },
  )
  const mmrBounds = getMmrBounds(mmrPoints.value.map((point) => point.mmr))

  return {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          type: 'line',
          label: props.mode === "mmr" ? "MMR Rating" : "Placement",
          data: metricValues,
          borderColor: '#9b6ee8',
          backgroundColor: 'rgba(155, 110, 232, 0.14)',
          tension: 0.34,
          borderWidth: props.compact ? 1.5 : 2,
          pointRadius: props.compact ? 1.6 : 2.4,
          pointHoverRadius: props.compact ? 3 : 4,
          pointBackgroundColor: props.points.map((p) => tierPalette[p.tier] ?? '#9b6ee8'),
          pointBorderColor: '#242438',
          pointBorderWidth: props.compact ? 0.8 : 1,
          fill: false,
          segment: {
            borderColor: (ctx: any) => tierPalette[props.points[ctx.p0DataIndex]?.tier] ?? '#9b6ee8',
          },
        },
        {
          type: 'scatter',
          label: 'Tier shifts',
          data: markerData,
          showLine: false,
          pointRadius: 0,
          pointHoverRadius: 0,
          pointStyle: 'triangle',
          pointRotation: (ctx) => markerRotation(ctx.dataIndex),
          pointBackgroundColor: 'rgba(0, 0, 0, 0)',
          pointBorderColor: 'rgba(0, 0, 0, 0)',
          pointBorderWidth: 0,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      layout: {
        padding: {
          top: props.compact ? 12 : 16,
          right: props.compact ? 6 : 8,
          bottom: props.compact ? 2 : 4,
          left: props.compact ? 2 : 4,
        },
      },
      animation: false,
      interaction: {
        mode: 'nearest',
        intersect: false,
      },
      plugins: {
        legend: {
          display: false,
        },
        tooltip: {
          displayColors: false,
          backgroundColor: 'rgba(36, 36, 56, 0.96)',
          borderColor: 'rgba(155, 110, 232, 0.24)',
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
              const bits = props.mode === "mmr" && "mmr" in point
                ? [`MMR ${formatMmr(point.mmr)}`, point.tierLabel]
                : "placement" in point
                  ? [`${ordinal(point.placement)} of ${point.playerCount}`, point.tierLabel]
                  : []
              if ("gamesWithCommander" in point && point.gamesWithCommander < 20 && point.projectedTierLabel && point.projectedTierLabel !== point.tierLabel) {
                bits.push(`Projected ${point.projectedTierLabel}`)
              }
              if ("delta" in point && point.delta !== 0) {
                bits.push(`${point.delta > 0 ? "+" : ""}${formatMmr(point.delta)} MMR`)
              }
              if (point.tierChange === 'rise') bits.push(`Tier rose to ${point.tierLabel}`)
              if (point.tierChange === 'drop') bits.push(`Tier dropped to ${point.tierLabel}`)
              return bits.join(' • ')
            },
          },
        },
      },
      scales: {
        x: {
          grid: {
            display: false,
          },
          border: {
            display: false,
          },
          ticks: {
            display: !props.compact,
            color: 'rgba(136, 136, 170, 0.72)',
            maxRotation: 0,
            autoSkip: true,
            maxTicksLimit: 4,
            font: {
              size: 9,
            },
          },
        },
        y: {
          reverse: props.mode === "placement",
          min: props.mode === "mmr" ? mmrBounds.min : 0.5,
          max: props.mode === "mmr" ? mmrBounds.max : maxPlacement.value + 0.5,
          ticks: {
            autoSkip: false,
            color: 'rgba(136, 136, 170, 0.78)',
            callback(value) {
              if (props.mode === "mmr") return formatMmr(Number(value))
              const numericValue = Number(value)
              if (!Number.isInteger(numericValue)) return ''
              if (props.compact) {
                const num = numericValue
                if (num !== 1 && num !== maxPlacement.value) return ''
              }
              return ordinal(numericValue)
            },
            font: {
              size: 9,
            },
            padding: props.compact ? 4 : 6,
          },
          grid: {
            color(context) {
              const value = Number(context.tick.value)
              if (props.mode === "mmr") {
                return 'rgba(136, 136, 170, 0.12)'
              }
              if (props.compact && value !== 1 && value !== maxPlacement.value) {
                return 'rgba(136, 136, 170, 0.06)'
              }
              return 'rgba(136, 136, 170, 0.12)'
            },
            borderDash: [2, 3],
            drawTicks: false,
          },
          border: {
            display: false,
          },
        },
      },
      elements: {
        line: {
          capBezierPoints: true,
        },
      },
    },
    plugins: [tierPointLabelPlugin],
  }
}

const tierPointLabelPlugin: Plugin<'line' | 'scatter'> = {
  id: 'tier-point-labels',
  afterDatasetsDraw(chartInstance) {
    const datasetMeta = chartInstance.getDatasetMeta(1)
    if (!datasetMeta) return

    const { ctx } = chartInstance
    ctx.save()
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.font = props.compact ? '700 9px sans-serif' : '700 10px sans-serif'

    datasetMeta.data.forEach((element, index) => {
      const point = props.points[index]
      if (!point?.tierChange) return

      const arrow = point.tierChange === 'drop' ? '▼' : '▲'
      const yOffset = point.tierChange === 'drop' ? 13 : -12
      ctx.fillStyle = tierPalette[point.tier]
      ctx.fillText(arrow, element.x, element.y + yOffset)
    })

    ctx.restore()
  },
}

function markerRotation(index: number) {
  return props.points[index]?.tierChange === 'drop' ? 180 : 0
}

function ordinal(value: number) {
  if (value % 100 >= 11 && value % 100 <= 13) return `${value}th`
  if (value % 10 === 1) return `${value}st`
  if (value % 10 === 2) return `${value}nd`
  if (value % 10 === 3) return `${value}rd`
  return `${value}th`
}

function getMmrBounds(values: number[]) {
  if (values.length === 0) return { min: 1400, max: 1600 }

  const minValue = Math.min(...values)
  const maxValue = Math.max(...values)
  if (minValue === maxValue) {
    return { min: minValue - 50, max: maxValue + 50 }
  }

  const padding = Math.max(25, Math.round((maxValue - minValue) * 0.12))
  return {
    min: minValue - padding,
    max: maxValue + padding,
  }
}

function formatMmr(value: number) {
  return Math.round(value).toString()
}
</script>

<style lang="scss" scoped>
.placement-chart {
  background: rgba($color-bg-elevated, 0.7);
  border: 1px solid rgba($border-color, 0.8);
  border-radius: $border-radius-md;
  padding: $spacing-3;
  display: flex;
  flex-direction: column;
  gap: $spacing-2;

  &--compact {
    padding: 6px 8px;
    gap: 0;
    border-radius: $border-radius-sm;
    background: rgba($color-bg-elevated, 0.55);
  }

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
    position: relative;
    min-height: 104px;
  }

  &--compact &__frame {
    min-height: 62px;
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

  &__legend {
    display: flex;
    flex-wrap: wrap;
    gap: $spacing-3;
  }

  &__legend-item {
    font-size: 10px;
    color: $color-text-muted;

    &--line { color: $color-primary-light; }
  }
}
</style>
