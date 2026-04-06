<script setup lang="ts">
defineProps<{
  label?: string
  required?: boolean
}>()
</script>

<template>
  <div class="zq-form-item">
    <label v-if="label" class="zq-form-item__label">
      {{ label }}
      <span v-if="required" class="zq-form-item__required">*</span>
    </label>
    <div class="zq-form-item__content">
      <slot />
    </div>
  </div>
</template>

<style scoped>
.zq-form-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.zq-form-item__label {
  font-size: 12px;
  font-weight: 500;
  color: var(--text-secondary);
}

.zq-form-item__required {
  color: var(--el-color-danger);
  margin-left: 2px;
}

.zq-form-item__content {
  display: flex;
  flex-direction: column;
}
</style>
