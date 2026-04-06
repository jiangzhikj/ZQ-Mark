<script setup lang="ts">
defineProps<{
  variant?: 'default' | 'primary' | 'danger'
  size?: 'small' | 'medium'
}>()
</script>

<template>
  <button
    class="zq-button"
    :class="[
      `zq-button--${variant || 'default'}`,
      `zq-button--${size || 'medium'}`
    ]"
  >
    <slot />
  </button>
</template>

<style scoped>
.zq-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  border: none;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  font-family: inherit;
  cursor: pointer;
  transition: all 0.15s;
  white-space: nowrap;
}

.zq-button--medium {
  height: 32px;
  padding: 0 20px;
}

.zq-button--small {
  height: 26px;
  padding: 0 12px;
  font-size: 12px;
}

.zq-button--default {
  background: var(--bg-hover);
  color: var(--text-secondary);
}

.zq-button--default:hover {
  background: var(--bg-active);
  color: var(--text-primary);
}

.zq-button--primary {
  background: var(--accent-color);
  color: #fff;
}

.zq-button--primary:hover {
  opacity: 0.9;
}

.zq-button--danger {
  background: var(--el-color-danger);
  color: #fff;
}

.zq-button--danger:hover {
  opacity: 0.9;
}
</style>
