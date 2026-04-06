<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import logoSrc from '@/assets/icon/icon.svg'
import { CircleCheck, CircleX, Download, X } from '@/components/icons'

const props = defineProps<{
  visible: boolean
  updateUrl: string
}>()

const emit = defineEmits<{
  close: []
}>()

const { t } = useI18n()

type ViewState = 'about' | 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'error'

const viewState = ref<ViewState>('about')
const currentVersion = ref('')
const newVersion = ref('')
const releaseNotes = ref('')
const errorMessage = ref('')
const progress = ref({ percent: 0, transferred: 0, total: 0, bytesPerSecond: 0 })

let cleanupListener: (() => void) | null = null

onMounted(async () => {
  currentVersion.value = await window.electron.updateGetVersion()
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
  if (v) viewState.value = 'about'
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

function backToAbout() {
  viewState.value = 'about'
}
</script>

<template>
  <Teleport to="body">
    <Transition name="about-modal">
      <div v-if="visible" class="about-overlay" @click.self="emit('close')">
        <div class="about-dialog">
          <button class="close-btn" @click="emit('close')">
            <X :size="12" :stroke-width="1.5" />
          </button>

          <!-- About view -->
          <template v-if="viewState === 'about'">
            <div class="app-logo">
              <img :src="logoSrc" width="64" height="64" alt="ZQ Mark" />
            </div>
            <h2 class="app-name">ZQ Mark</h2>
            <span class="app-version">v{{ currentVersion }}</span>
            <p class="app-desc">{{ t('app.name') }}</p>
            <div class="about-divider" />
            <button class="check-btn" @click="checkUpdate">
              <Download :size="16" :stroke-width="2" />
              {{ t('update.checkUpdate') }}
            </button>
          </template>

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
              <div class="release-notes-content">{{ releaseNotes }}</div>
            </div>
            <div class="action-row">
              <button class="action-btn default" @click="backToAbout">{{ t('update.later') }}</button>
              <button class="action-btn primary" @click="startDownload">{{ t('update.downloading').replace('...', '') }}</button>
            </div>
          </template>

          <!-- Not available -->
          <template v-if="viewState === 'not-available'">
            <div class="state-icon">
              <CircleCheck class="state-icon__lucide state-icon__lucide--accent" :size="48" :stroke-width="2" />
            </div>
            <p class="state-text">{{ t('update.noUpdate') }}</p>
            <button class="action-btn default" @click="backToAbout">{{ t('dialog.confirm') }}</button>
          </template>

          <!-- Downloading -->
          <template v-if="viewState === 'downloading'">
            <p class="state-text">{{ t('update.downloading') }}</p>
            <div class="progress-wrapper">
              <div class="progress-bar">
                <div class="progress-fill" :style="{ width: progress.percent + '%' }" />
              </div>
              <div class="progress-stats">
                <span>{{ progress.percent }}%</span>
                <span>{{ progressText }}</span>
                <span v-if="progress.bytesPerSecond > 0">{{ speedText }}</span>
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
              <button class="action-btn default" @click="backToAbout">{{ t('update.later') }}</button>
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
              <button class="action-btn default" @click="backToAbout">{{ t('update.later') }}</button>
              <button class="action-btn primary" @click="checkUpdate">{{ t('update.retry') }}</button>
            </div>
          </template>
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

.about-divider {
  width: 100%;
  height: 1px;
  background: var(--border-color);
  margin: 6px 0;
}

.check-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 36px;
  padding: 0 24px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: transparent;
  color: var(--text-primary);
  font-size: 13px;
  font-weight: 500;
  font-family: inherit;
  cursor: pointer;
  transition: all 0.15s;
}

.check-btn:hover {
  border-color: var(--accent-color);
  color: var(--accent-color);
  background: var(--accent-shadow, rgba(59, 130, 246, 0.06));
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

.release-notes-content {
  font-size: 12px;
  color: var(--text-secondary);
  line-height: 1.6;
  max-height: 120px;
  overflow-y: auto;
  background: var(--bg-hover);
  border-radius: 8px;
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
  display: flex;
  justify-content: space-between;
  margin-top: 6px;
  font-size: 11px;
  color: var(--text-tertiary);
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
