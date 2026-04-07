<script setup lang="ts">
const props = defineProps<{
  disabled?: boolean
}>()

const model = defineModel<boolean>({ required: true })

function onClick() {
  if (props.disabled) return
  model.value = !model.value
}
</script>

<template>
  <button
    type="button"
    role="switch"
    class="zq-switch"
    :class="{ 'zq-switch--on': model }"
    :aria-checked="model"
    :disabled="disabled"
    @click="onClick"
  >
    <span class="zq-switch__knob" aria-hidden="true" />
  </button>
</template>

<style scoped>
.zq-switch {
  position: relative;
  width: 40px;
  height: 22px;
  flex-shrink: 0;
  padding: 0;
  border: none;
  border-radius: 11px;
  background: var(--border-color);
  cursor: pointer;
  transition: background 0.2s ease;
}

.zq-switch:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.zq-switch--on {
  background: var(--accent-color);
}

.zq-switch__knob {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
  transition: transform 0.2s ease;
}

.zq-switch--on .zq-switch__knob {
  transform: translateX(18px);
}
</style>
