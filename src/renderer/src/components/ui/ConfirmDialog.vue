<script setup lang="ts">
import ZqDialog from './ZqDialog.vue'
import ZqButton from './ZqButton.vue'

defineProps<{
  visible: boolean
  title?: string
  message?: string
  confirmText?: string
  cancelText?: string
  alternateText?: string
  confirmVariant?: 'primary' | 'danger'
  alternateVariant?: 'default' | 'primary' | 'danger'
  width?: string
}>()

const emit = defineEmits<{
  confirm: []
  cancel: []
  alternate: []
}>()
</script>

<template>
  <ZqDialog
    :visible="visible"
    :title="title"
    :width="width || '400px'"
    @close="emit('cancel')"
  >
    <p class="confirm-dialog__message">{{ message }}</p>
    <template #footer>
      <ZqButton @click="emit('cancel')">{{ cancelText || '取消' }}</ZqButton>
      <ZqButton v-if="alternateText" :variant="alternateVariant || 'default'" @click="emit('alternate')">{{ alternateText }}</ZqButton>
      <ZqButton :variant="confirmVariant || 'primary'" @click="emit('confirm')">{{ confirmText || '确定' }}</ZqButton>
    </template>
  </ZqDialog>
</template>

<style scoped>
.confirm-dialog__message {
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.6;
  margin: 0;
}
</style>
