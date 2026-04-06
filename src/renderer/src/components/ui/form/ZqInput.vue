<script setup lang="ts">
const props = defineProps<{
  modelValue: string
  placeholder?: string
  readonly?: boolean
  error?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

function onInput(e: Event) {
  emit('update:modelValue', (e.target as HTMLInputElement).value)
}
</script>

<template>
  <input
    class="zq-input"
    :class="{ 'zq-input--error': error, 'zq-input--readonly': readonly }"
    :value="modelValue"
    :placeholder="placeholder"
    :readonly="readonly"
    @input="onInput"
  />
</template>

<style scoped>
.zq-input {
  height: 36px;
  padding: 0 12px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: var(--bg-input);
  color: var(--text-primary);
  font-size: 14px;
  font-family: inherit;
  outline: none;
  width: 100%;
  transition: border-color 0.15s;
}

.zq-input:focus {
  border-color: var(--accent-color);
  box-shadow: 0 0 0 2px var(--accent-shadow);
}

.zq-input--error {
  border-color: var(--el-color-danger);
  animation: zq-shake 0.3s ease;
}

.zq-input--error:focus {
  box-shadow: 0 0 0 2px rgba(245, 108, 108, 0.2);
}

.zq-input--readonly {
  cursor: pointer;
}

@keyframes zq-shake {
  0%, 100% { transform: translateX(0); }
  20%, 60% { transform: translateX(-4px); }
  40%, 80% { transform: translateX(4px); }
}
</style>
