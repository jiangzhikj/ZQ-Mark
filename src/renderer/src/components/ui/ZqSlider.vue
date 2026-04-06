<script setup lang="ts">
import { ref, computed, onBeforeUnmount } from 'vue'

const props = withDefaults(
  defineProps<{
    modelValue: number
    min?: number
    max?: number
    step?: number
    disabled?: boolean
  }>(),
  {
    min: 0,
    max: 100,
    step: 1,
    disabled: false,
  }
)

const emit = defineEmits<{
  'update:modelValue': [value: number]
}>()

const trackRef = ref<HTMLElement | null>(null)
const dragging = ref(false)

const percentage = computed(() => {
  const range = props.max - props.min
  if (range === 0) return 0
  return ((props.modelValue - props.min) / range) * 100
})

function getValueFromEvent(e: MouseEvent | PointerEvent) {
  if (!trackRef.value) return props.modelValue
  const rect = trackRef.value.getBoundingClientRect()
  const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
  const raw = props.min + ratio * (props.max - props.min)
  const stepped = Math.round(raw / props.step) * props.step
  return Math.max(props.min, Math.min(props.max, stepped))
}

function onPointerDown(e: PointerEvent) {
  if (props.disabled) return
  e.preventDefault()
  dragging.value = true
  emit('update:modelValue', getValueFromEvent(e))
  document.addEventListener('pointermove', onPointerMove)
  document.addEventListener('pointerup', onPointerUp)
}

function onPointerMove(e: PointerEvent) {
  emit('update:modelValue', getValueFromEvent(e))
}

function onPointerUp() {
  dragging.value = false
  document.removeEventListener('pointermove', onPointerMove)
  document.removeEventListener('pointerup', onPointerUp)
}

onBeforeUnmount(() => {
  document.removeEventListener('pointermove', onPointerMove)
  document.removeEventListener('pointerup', onPointerUp)
})
</script>

<template>
  <div
    class="zq-slider"
    :class="{ 'zq-slider--disabled': disabled, 'zq-slider--dragging': dragging }"
  >
    <div ref="trackRef" class="zq-slider__track" @pointerdown="onPointerDown">
      <div class="zq-slider__fill" :style="{ width: `${percentage}%` }" />
      <div class="zq-slider__thumb" :style="{ left: `${percentage}%` }" />
    </div>
  </div>
</template>

<style scoped>
.zq-slider {
  position: relative;
  height: 20px;
  display: flex;
  align-items: center;
  cursor: pointer;
}

.zq-slider--disabled {
  opacity: 0.4;
  cursor: not-allowed;
  pointer-events: none;
}

.zq-slider__track {
  position: relative;
  width: 100%;
  height: 4px;
  border-radius: 2px;
  background: var(--border-color);
}

.zq-slider__fill {
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  border-radius: 2px;
  background: var(--accent-color);
  transition: width 0.05s ease;
}

.zq-slider--dragging .zq-slider__fill {
  transition: none;
}

.zq-slider__thumb {
  position: absolute;
  top: 50%;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: #fff;
  border: 2px solid var(--accent-color);
  transform: translate(-50%, -50%);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.15);
  transition: left 0.05s ease, box-shadow 0.15s;
}

.zq-slider--dragging .zq-slider__thumb {
  transition: box-shadow 0.15s;
  box-shadow: 0 0 0 4px var(--accent-shadow);
}

.zq-slider__thumb:hover {
  box-shadow: 0 0 0 4px var(--accent-shadow);
}
</style>
