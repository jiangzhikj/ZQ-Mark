<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import logoSrc from '@/assets/icon/icon.svg'
import { X } from '@/components/icons'

defineProps<{
  visible: boolean
}>()

const emit = defineEmits<{
  close: []
}>()

const { t } = useI18n()

const currentVersion = ref('')

onMounted(async () => {
  currentVersion.value = await window.electron.updateGetVersion()
})
</script>

<template>
  <Teleport to="body">
    <Transition name="about-modal">
      <div v-if="visible" class="about-overlay" @click.self="emit('close')">
        <div class="about-dialog">
          <button class="close-btn" @click="emit('close')">
            <X :size="12" :stroke-width="1.5" />
          </button>
          <div class="app-logo">
            <img :src="logoSrc" width="64" height="64" alt="ZQ Mark" />
          </div>
          <h2 class="app-name">ZQ Mark</h2>
          <span class="app-version">v{{ currentVersion }}</span>
          <p class="app-desc">{{ t('app.name') }}</p>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.about-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.35);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
  backdrop-filter: blur(4px);
}

.about-dialog {
  width: 380px;
  background: var(--bg-editor);
  border-radius: 14px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3), 0 0 0 1px var(--border-color);
  padding: 36px 28px 28px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  position: relative;
  text-align: center;
}

.close-btn {
  position: absolute;
  top: 12px;
  right: 12px;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--text-tertiary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.12s ease;
}

.close-btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.app-logo {
  margin-bottom: 4px;
}

.app-name {
  font-size: 20px;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
  letter-spacing: -0.3px;
}

.app-version {
  display: inline-block;
  font-size: 12px;
  padding: 2px 10px;
  border-radius: 10px;
  background: var(--bg-hover);
  color: var(--text-tertiary);
  font-weight: 500;
}

.app-desc {
  font-size: 13px;
  color: var(--text-tertiary);
  margin: 2px 0 0;
}

.about-modal-enter-active,
.about-modal-leave-active {
  transition: opacity 0.2s ease;
}

.about-modal-enter-active .about-dialog,
.about-modal-leave-active .about-dialog {
  transition: transform 0.2s ease, opacity 0.2s ease;
}

.about-modal-enter-from,
.about-modal-leave-to {
  opacity: 0;
}

.about-modal-enter-from .about-dialog,
.about-modal-leave-to .about-dialog {
  transform: scale(0.95);
  opacity: 0;
}
</style>
