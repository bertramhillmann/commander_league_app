<template>
  <div class="rich-text-editor">
    <div class="rich-text-editor__toolbar" aria-label="Formatting controls">
      <button type="button" title="Bold" aria-label="Bold" @mousedown.prevent @click="command('bold')"><strong>B</strong></button>
      <button type="button" title="Italic" aria-label="Italic" @mousedown.prevent @click="command('italic')"><em>I</em></button>
      <button type="button" title="Heading" aria-label="Heading" @mousedown.prevent @click="format('h3')">H</button>
      <button type="button" title="Paragraph" aria-label="Paragraph" @mousedown.prevent @click="format('p')">P</button>
      <button type="button" title="Bulleted list" aria-label="Bulleted list" @mousedown.prevent @click="command('insertUnorderedList')">• List</button>
      <button type="button" title="Numbered list" aria-label="Numbered list" @mousedown.prevent @click="command('insertOrderedList')">1. List</button>
      <span class="rich-text-editor__swatches">
        <button
          v-for="swatch in colorSwatches"
          :key="swatch.name"
          type="button"
          class="rich-text-editor__swatch"
          :class="{ 'rich-text-editor__swatch--active': isActiveColor(swatch.value) }"
          :style="{ '--swatch-color': swatch.value }"
          :title="swatch.name"
          :aria-label="`Color text ${swatch.name}`"
          @mousedown.prevent
          @click="setColor(swatch.value)"
        />
        <button
          type="button"
          class="rich-text-editor__swatch rich-text-editor__swatch--clear"
          title="Clear color"
          aria-label="Clear text color"
          @mousedown.prevent
          @click="setColor('inherit')"
        >✕</button>
      </span>
    </div>
    <div
      ref="editor"
      class="rich-text-editor__content"
      contenteditable="true"
      role="textbox"
      aria-multiline="true"
      :aria-label="ariaLabel"
      @input="emitValue"
      @blur="emitValue"
    />
  </div>
</template>

<script setup lang="ts">
const props = withDefaults(defineProps<{
  modelValue: string
  ariaLabel?: string
}>(), { ariaLabel: 'Rich text editor' })

const emit = defineEmits<{ 'update:modelValue': [value: string] }>()
const editor = ref<HTMLDivElement | null>(null)

function syncValue(value: string) {
  if (editor.value && editor.value.innerHTML !== value) editor.value.innerHTML = value
}

onMounted(() => syncValue(props.modelValue))
watch(() => props.modelValue, syncValue)

function emitValue() {
  emit('update:modelValue', editor.value?.innerHTML ?? '')
}

function command(name: string) {
  editor.value?.focus()
  document.execCommand(name)
  emitValue()
}

function format(tag: 'h3' | 'p') {
  editor.value?.focus()
  document.execCommand('formatBlock', false, tag)
  emitValue()
}

const colorSwatches = [
  { name: 'Purple', value: '#9b6ee8' },
  { name: 'Green', value: '#2c9c6a' },
  { name: 'Yellow', value: '#e8a030' },
]

const activeColor = ref('')

function setColor(value: string) {
  editor.value?.focus()
  document.execCommand('foreColor', false, value)
  emitValue()
  refreshActiveColor()
}

function refreshActiveColor() {
  if (document.activeElement !== editor.value) {
    activeColor.value = ''
    return
  }
  try {
    activeColor.value = document.queryCommandValue('foreColor')
  } catch {
    activeColor.value = ''
  }
}

function isActiveColor(hex: string) {
  return !!activeColor.value && colorToRgb(activeColor.value) === colorToRgb(hex)
}

function colorToRgb(color: string) {
  const probe = document.createElement('span')
  probe.style.color = color
  document.body.appendChild(probe)
  const rgb = getComputedStyle(probe).color
  document.body.removeChild(probe)
  return rgb
}

onMounted(() => document.addEventListener('selectionchange', refreshActiveColor))
onBeforeUnmount(() => document.removeEventListener('selectionchange', refreshActiveColor))
</script>

<style lang="scss" scoped>
.rich-text-editor { position: relative; }
.rich-text-editor__toolbar { display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: $spacing-2; opacity: .12; transition: opacity $transition-fast; }
.rich-text-editor:hover .rich-text-editor__toolbar, .rich-text-editor:focus-within .rich-text-editor__toolbar { opacity: 1; }
.rich-text-editor__toolbar button { padding: 3px 7px; border: 1px solid rgba($color-primary-light, .4); border-radius: $border-radius-sm; background: rgba($color-bg-elevated, .75); color: $color-text; font: inherit; font-size: 11px; cursor: pointer; }
.rich-text-editor__toolbar button:hover { border-color: $color-primary-light; background: rgba($color-primary, .2); }
.rich-text-editor__swatches { display: flex; align-items: center; gap: 4px; margin-left: 4px; padding-left: 8px; border-left: 1px solid rgba($color-primary-light, .25); }
.rich-text-editor__swatch { box-sizing: border-box; width: 18px; height: 18px; padding: 0; border: 1px solid rgba(255, 255, 255, .25); border-radius: $border-radius-full; background: var(--swatch-color); cursor: pointer; }
.rich-text-editor__swatch:hover { border-color: $color-text; transform: scale(1.1); }
.rich-text-editor__swatch--active { border-color: $color-text; box-shadow: 0 0 0 2px rgba($color-text, .4); }
.rich-text-editor__swatch--clear { display: flex; align-items: center; justify-content: center; background: rgba($color-bg-elevated, .75); color: $color-text-muted; font-size: 10px; line-height: 1; }
.rich-text-editor__swatch--clear:hover { color: $color-text; }
.rich-text-editor__content { box-sizing: border-box; width: 100%; min-height: 1.7em; padding: 2px 4px; border: 1px solid transparent; border-radius: $border-radius-sm; outline: none; overflow: visible; white-space: pre-wrap; }
.rich-text-editor__content:hover, .rich-text-editor__content:focus { border-color: rgba($color-primary-light, .68); background: rgba($color-primary, .09); }
.rich-text-editor__content :deep(p), .rich-text-editor__content :deep(h3) { margin: 0 0 $spacing-3; }
.rich-text-editor__content :deep(p:last-child), .rich-text-editor__content :deep(h3:last-child) { margin-bottom: 0; }
</style>
