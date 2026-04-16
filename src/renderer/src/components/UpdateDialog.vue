<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { CircleCheck, CircleX, X } from '@/components/icons'
import { ZqScrollbar } from '@/components/ui'

const props = defineProps<{
  visible: boolean
  updateUrl: string
}>()

const emit = defineEmits<{
  close: []
}>()

const { t } = useI18n()

type ViewState = 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'error'

const viewState = ref<ViewState>('checking')
const newVersion = ref('')
const releaseNotes = ref('')
const errorMessage = ref('')
const progress = ref({ percent: 0, transferred: 0, total: 0, bytesPerSecond: 0 })

let cleanupListener: (() => void) | null = null

onMounted(() => {
  cleanupListener = window.electron.onUpdateEvent((payload) => {
    switch (payload.type) {
      case 'checking':
        viewState.value = 'checking'
        break
      case 'available':
        viewState.value = 'available'
        newVersion.value = payload.info.version
        releaseNotes.value = payload.info.notes || ''
        break
      case 'not-available':
        viewState.value = 'not-available'
        break
      case 'progress':
        viewState.value = 'downloading'
        progress.value = payload.progress
        break
      case 'downloaded':
        viewState.value = 'downloaded'
        break
      case 'error':
        viewState.value = 'error'
        errorMessage.value = payload.message
        break
    }
  })
})

onUnmounted(() => {
  cleanupListener?.()
})

watch(() => props.visible, (v) => {
  // 关闭弹窗时若在下载中，保留状态；主进程会继续下载，完成后会再打开弹窗显示安装
  if (!v && viewState.value !== 'downloading') {
    viewState.value = 'checking'
  }
})

function formatBytes(bytes: number): string {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

const progressText = computed(() => {
  const p = progress.value
  if (p.total > 0) return `${formatBytes(p.transferred)} / ${formatBytes(p.total)}`
  return formatBytes(p.transferred)
})

const speedText = computed(() => {
  return formatBytes(progress.value.bytesPerSecond) + '/s'
})

async function checkUpdate() {
  if (!props.updateUrl) {
    viewState.value = 'error'
    errorMessage.value = t('update.networkError')
    return
  }
  viewState.value = 'checking'
  await window.electron.updateCheck(props.updateUrl)
}

async function startDownload() {
  if (!props.updateUrl) return
  viewState.value = 'downloading'
  progress.value = { percent: 0, transferred: 0, total: 0, bytesPerSecond: 0 }
  await window.electron.updateDownload(props.updateUrl)
}

async function install() {
  await window.electron.updateInstall()
}

function onOverlayClick() {
  if (viewState.value === 'downloaded') return
  emit('close')
}
</script>

<template>
  <Teleport to="body">
    <Transition name="update-modal">
      <div v-if="visible" class="update-overlay" @click.self="onOverlayClick">
        <div class="update-dialog">
          <button class="close-btn" @click="emit('close')">
            <X :size="12" :stroke-width="1.5" />
          </button>

          <!-- Checking -->
          <template v-if="viewState === 'checking'">
            <div class="state-icon">
              <div class="spinner" />
            </div>
            <p class="state-text">{{ t('update.checking') }}</p>
          </template>

          <!-- Available -->
          <template v-if="viewState === 'available'">
            <div class="state-icon">
              <div class="available-badge">{{ t('update.updateAvailable') }}</div>
            </div>
            <p class="state-detail">
              {{ t('update.newVersion') }}: <span class="version-accent">v{{ newVersion }}</span>
            </p>
            <div v-if="releaseNotes" class="release-notes">
              <div class="release-notes-label">{{ t('update.releaseNotes') }}</div>
              <ZqScrollbar class="release-notes-scroll" height="120px">
                <div class="release-notes-body">{{ releaseNotes }}</div>
              </ZqScrollbar>
            </div>
            <div class="action-row">
              <button class="action-btn default" @click="emit('close')">{{ t('update.later') }}</button>
              <button class="action-btn primary" @click="startDownload">{{ t('update.downloadNow') }}</button>
            </div>
          </template>

          <!-- Not available -->
          <template v-if="viewState === 'not-available'">
            <div class="state-icon">
              <CircleCheck class="state-icon__lucide state-icon__lucide--accent" :size="48" :stroke-width="2" />
            </div>
            <p class="state-text">{{ t('update.noUpdate') }}</p>
            <button class="action-btn default" @click="emit('close')">{{ t('dialog.confirm') }}</button>
          </template>

          <!-- Downloading -->
          <template v-if="viewState === 'downloading'">
            <p class="state-text">{{ t('update.downloading') }}</p>
            <div class="progress-wrapper">
              <div class="progress-bar">
                <div class="progress-fill" :style="{ width: progress.percent + '%' }" />
              </div>
              <div class="progress-stats">
                <span class="progress-stats__left">{{ progress.percent }}%</span>
                <span class="progress-stats__center">{{ t('update.downloadSpeed') }} {{ speedText }}</span>
                <span class="progress-stats__right">{{ progressText }}</span>
              </div>
            </div>
          </template>

          <!-- Downloaded -->
          <template v-if="viewState === 'downloaded'">
            <div class="state-icon">
              <CircleCheck class="state-icon__lucide state-icon__lucide--accent" :size="48" :stroke-width="2" />
            </div>
            <p class="state-text">{{ t('update.downloadComplete') }}</p>
            <p class="hint-text">{{ t('update.installTip') }}</p>
            <div class="action-row">
              <button class="action-btn default" @click="emit('close')">{{ t('update.later') }}</button>
              <button class="action-btn primary" @click="install">{{ t('update.installNow') }}</button>
            </div>
          </template>

          <!-- Error -->
          <template v-if="viewState === 'error'">
            <div class="state-icon">
              <CircleX class="state-icon__lucide state-icon__lucide--danger" :size="48" :stroke-width="2" />
            </div>
            <p class="state-text error-text">{{ t('update.error') }}</p>
            <p class="hint-text">{{ errorMessage }}</p>
            <div class="action-row">
              <button class="action-btn default" @click="emit('close')">{{ t('update.later') }}</button>
              <button class="action-btn primary" @click="checkUpdate">{{ t('update.retry') }}</button>
            </div>
          </template>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.update-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.35);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
  backdrop-filter: blur(4px);
}

.update-dialog {
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

.state-icon {
  margin: 8px 0 4px;
}

.state-icon__lucide {
  display: block;
}

.state-icon__lucide--accent {
  color: var(--accent-color);
}

.state-icon__lucide--danger {
  color: #ef4444;
}

.state-text {
  font-size: 14px;
  color: var(--text-primary);
  font-weight: 500;
}

.state-detail {
  font-size: 13px;
  color: var(--text-secondary);
}

.version-accent {
  font-weight: 600;
  color: var(--accent-color);
}

.hint-text {
  font-size: 12px;
  color: var(--text-tertiary);
  line-height: 1.5;
  max-width: 320px;
}

.action-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 34px;
  padding: 0 24px;
  border: none;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 500;
  font-family: inherit;
  cursor: pointer;
  transition: all 0.15s;
}

.action-btn.primary {
  background: var(--accent-color);
  color: #fff;
}

.action-btn.primary:hover {
  opacity: 0.9;
}

.action-btn.default {
  background: var(--bg-hover);
  color: var(--text-secondary);
}

.action-btn.default:hover {
  background: var(--bg-active);
  color: var(--text-primary);
}

.action-row {
  display: flex;
  gap: 8px;
  margin-top: 4px;
}

.available-badge {
  display: inline-flex;
  align-items: center;
  padding: 4px 14px;
  border-radius: 20px;
  background: var(--accent-shadow, rgba(59, 130, 246, 0.1));
  color: var(--accent-color);
  font-size: 13px;
  font-weight: 600;
}

.release-notes {
  width: 100%;
  text-align: left;
}

.release-notes-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-tertiary);
  margin-bottom: 6px;
}

.release-notes-scroll {
  width: 100%;
  background: var(--bg-hover);
  border-radius: 8px;
}

.release-notes-body {
  font-size: 12px;
  color: var(--text-secondary);
  line-height: 1.6;
  padding: 10px 12px;
  white-space: pre-wrap;
}

.progress-wrapper {
  width: 100%;
}

.progress-bar {
  width: 100%;
  height: 6px;
  border-radius: 3px;
  background: var(--bg-hover);
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  border-radius: 3px;
  background: var(--accent-color);
  transition: width 0.3s ease;
}

.progress-stats {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: 8px;
  margin-top: 6px;
  font-size: 11px;
  color: var(--text-tertiary);
}

.progress-stats__left {
  justify-self: start;
}

.progress-stats__center {
  justify-self: center;
  text-align: center;
}

.progress-stats__right {
  justify-self: end;
  text-align: right;
}

.spinner {
  width: 32px;
  height: 32px;
  border: 3px solid var(--border-color);
  border-top-color: var(--accent-color);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.error-text {
  color: #ef4444;
}

.update-modal-enter-active,
.update-modal-leave-active {
  transition: opacity 0.2s ease;
}

.update-modal-enter-active .update-dialog,
.update-modal-leave-active .update-dialog {
  transition: transform 0.2s ease, opacity 0.2s ease;
}

.update-modal-enter-from,
.update-modal-leave-to {
  opacity: 0;
}

.update-modal-enter-from .update-dialog,
.update-modal-leave-to .update-dialog {
  transform: scale(0.95);
  opacity: 0;
}
</style>
