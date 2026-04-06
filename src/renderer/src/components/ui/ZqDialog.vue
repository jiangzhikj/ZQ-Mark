<script setup lang="ts">
defineProps<{
  visible: boolean
  title?: string
  width?: string
}>()

const emit = defineEmits<{
  close: []
}>()

function onOverlayClick(e: MouseEvent) {
  if ((e.target as HTMLElement).classList.contains('zq-dialog-overlay')) {
    emit('close')
  }
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') emit('close')
}
</script>

<template>
  <Teleport to="body">
    <Transition name="zq-dialog">
      <div
        v-if="visible"
        class="zq-dialog-overlay"
        @mousedown="onOverlayClick"
        @keydown="onKeydown"
      >
        <div class="zq-dialog" :style="{ width: width || '420px' }">
          <div v-if="title || $slots.header" class="zq-dialog__header">
            <slot name="header">
              <span class="zq-dialog__title">{{ title }}</span>
            </slot>
          </div>
          <div class="zq-dialog__body">
            <slot />
          </div>
          <div v-if="$slots.footer" class="zq-dialog__footer">
            <slot name="footer" />
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.zq-dialog-overlay {
  position: fixed;
  inset: 0;
  z-index: 10000;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(2px);
}

.zq-dialog {
  background: var(--bg-editor);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.zq-dialog__header {
  padding: 20px 24px 0;
}

.zq-dialog__title {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
}

.zq-dialog__body {
  padding: 16px 24px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.zq-dialog__footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 0 24px 20px;
}

.zq-dialog-enter-active {
  transition: opacity 0.15s ease;
}

.zq-dialog-enter-active .zq-dialog {
  transition: transform 0.15s ease, opacity 0.15s ease;
}

.zq-dialog-leave-active {
  transition: opacity 0.1s ease;
}

.zq-dialog-enter-from {
  opacity: 0;
}

.zq-dialog-enter-from .zq-dialog {
  transform: scale(0.96);
  opacity: 0;
}

.zq-dialog-leave-to {
  opacity: 0;
}
</style>
