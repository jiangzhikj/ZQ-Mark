<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { useI18n } from 'vue-i18n'
import { Download, Trash2 } from '@/components/icons'
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue'
import type {
  DrawioBundleStatus,
  DrawioInstallProgress,
  DrawioPluginManifest,
} from '../../../../shared/drawio-plugin'

const emit = defineEmits<{
  drawioBundleChanged: []
}>()

const { t } = useI18n()

const status = ref<DrawioBundleStatus | null>(null)
const manifest = ref<DrawioPluginManifest | null>(null)
const manifestError = ref('')
const installError = ref('')
const busy = ref(false)
const progress = ref<DrawioInstallProgress | null>(null)
const removeConfirmVisible = ref(false)

let cleanupProgress: (() => void) | null = null

function compareVersions(a: string, b: string): number {
  const pa = a.replace(/^v/, '').split('.').map(Number)
  const pb = b.replace(/^v/, '').split('.').map(Number)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const na = pa[i] || 0
    const nb = pb[i] || 0
    if (na > nb) return 1
    if (na < nb) return -1
  }
  return 0
}

function formatBytes(n: number | undefined): string {
  if (n == null || !Number.isFinite(n) || n < 0) return '—'
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

/** 下载速度（字节/秒）→ 可读字符串 */
function formatSpeed(bps: number | undefined): string {
  if (bps == null || !Number.isFinite(bps) || bps <= 0) return ''
  if (bps < 1024) return `${bps.toFixed(0)} B/s`
  if (bps < 1024 * 1024) return `${(bps / 1024).toFixed(1)} KB/s`
  return `${(bps / (1024 * 1024)).toFixed(1)} MB/s`
}

async function loadStatus() {
  try {
    status.value = await window.electron.getDrawioBundleStatus()
  } catch {
    status.value = { state: 'missing' }
  }
}

async function loadManifest() {
  manifestError.value = ''
  try {
    manifest.value = await window.electron.fetchDrawioManifest()
  } catch (e) {
    manifest.value = null
    manifestError.value = e instanceof Error ? e.message : String(e)
  }
}

const canUpdate = () => {
  if (
    !manifest.value ||
    status.value?.state !== 'ready' ||
    !status.value.version ||
    !status.value.userInstalled
  ) {
    return false
  }
  const v = status.value.version
  /** 主进程对开发/内置副本返回的占位版本，不做 semver 比较 */
  if (v === 'dev' || v === 'bundled') {
    return false
  }
  return compareVersions(manifest.value.version, v) > 0
}

async function onInstallOrUpdate() {
  installError.value = ''
  busy.value = true
  progress.value = null
  try {
    await window.electron.installDrawioBundle()
    await loadStatus()
    emit('drawioBundleChanged')
  } catch (e) {
    installError.value = e instanceof Error ? e.message : String(e)
  } finally {
    busy.value = false
    progress.value = null
  }
}

function askRemove() {
  removeConfirmVisible.value = true
}

async function onConfirmRemove() {
  removeConfirmVisible.value = false
  installError.value = ''
  busy.value = true
  try {
    await window.electron.removeDrawioBundle()
    await loadStatus()
    emit('drawioBundleChanged')
  } catch (e) {
    installError.value = e instanceof Error ? e.message : String(e)
  } finally {
    busy.value = false
  }
}

onMounted(async () => {
  await loadStatus()
  await loadManifest()
  cleanupProgress = window.electron.onDrawioInstallProgress((p) => {
    progress.value = p
    if (p.phase === 'downloading' || p.phase === 'verifying' || p.phase === 'extracting') {
      busy.value = true
    }
    if (p.phase === 'done' || p.phase === 'error') {
      busy.value = false
      if (p.phase === 'error') {
        installError.value = p.message || t('settings.pluginInstallFailed')
      }
    }
  })
})

onBeforeUnmount(() => {
  cleanupProgress?.()
})

defineExpose({
  refresh: async () => {
    await loadStatus()
    await loadManifest()
  },
})
</script>

<template>
  <div class="settings-panel">
    <h2 class="section-title">{{ t('settings.pluginCenter') }}</h2>
    <p class="section-desc">{{ t('settings.pluginCenterDesc') }}</p>

    <div class="plugin-card">
      <div class="plugin-card__head">
        <h3 class="plugin-card__title">{{ t('settings.pluginDrawioTitle') }}</h3>
        <span
          v-if="status?.state === 'ready' && status.userInstalled"
          class="plugin-card__badge"
        >{{ t('settings.pluginInstalled') }}</span>
        <span
          v-else-if="status?.state === 'ready'"
          class="plugin-card__badge plugin-card__badge--muted"
        >{{ t('settings.pluginBuiltinDrawio') }}</span>
        <span
          v-else
          class="plugin-card__badge plugin-card__badge--muted"
        >{{ t('settings.pluginNotInstalled') }}</span>
      </div>
      <p class="plugin-card__desc">{{ t('settings.pluginDrawioDesc') }}</p>
      <p class="plugin-card__license">{{ t('settings.pluginDrawioLicense') }}</p>

      <div v-if="manifestError" class="plugin-card__warn">
        {{ t('settings.pluginManifestError') }}: {{ manifestError }}
      </div>
      <div v-else-if="manifest" class="plugin-card__meta">
        <span v-if="manifest.version">{{ t('settings.pluginRemoteVersion') }}: {{ manifest.version }}</span>
        <span v-if="status?.version">{{ t('settings.pluginInstalledVersion') }}: {{ status.version }}</span>
        <span>{{ t('settings.pluginSize') }}: {{ formatBytes(manifest.size) }}</span>
      </div>
      <p
        v-if="status?.state === 'ready' && status.userInstalled === false"
        class="plugin-card__builtin-hint"
      >
        {{ t('settings.pluginBuiltinDrawioHint') }}
      </p>

      <div v-if="installError" class="plugin-card__error">
        {{ installError }}
      </div>

      <div
        v-if="progress && progress.phase !== 'done' && progress.phase !== 'error'"
        class="plugin-card__progress"
      >
        <div class="plugin-card__progress-label">
          <template v-if="progress.phase === 'downloading'">{{ t('settings.pluginPhaseDownloading') }}</template>
          <template v-else-if="progress.phase === 'verifying'">{{ t('settings.pluginPhaseVerifying') }}</template>
          <template v-else-if="progress.phase === 'extracting'">{{ t('settings.pluginPhaseExtracting') }}</template>
        </div>
        <div class="plugin-card__progress-bar">
          <div
            class="plugin-card__progress-fill"
            :style="{ width: `${progress.percent ?? 0}%` }"
          />
        </div>
        <div class="plugin-card__progress-footer">
          <span class="plugin-card__progress-size">
            <template v-if="progress.total">
              {{ formatBytes(progress.received) }} / {{ formatBytes(progress.total) }}
            </template>
            <template v-else>
              {{ formatBytes(progress.received) }}
            </template>
          </span>
          <span
            v-if="progress.phase === 'downloading' && progress.bytesPerSecond"
            class="plugin-card__progress-speed"
          >
            {{ t('settings.pluginDownloadSpeed') }} {{ formatSpeed(progress.bytesPerSecond) }}
          </span>
        </div>
      </div>

      <div class="plugin-card__actions">
        <template v-if="status?.userInstalled">
          <button
            v-if="canUpdate()"
            type="button"
            class="btn-primary"
            :disabled="busy"
            @click="onInstallOrUpdate"
          >
            <Download :size="16" :stroke-width="1.5" class="btn-ic" />
            {{ t('settings.pluginUpdate') }}
          </button>
          <button
            type="button"
            class="btn-danger"
            :disabled="busy"
            @click="askRemove"
          >
            <Trash2 :size="16" :stroke-width="1.5" class="btn-ic" />
            {{ t('settings.pluginRemove') }}
          </button>
        </template>
        <button
          v-else
          type="button"
          class="btn-primary"
          :disabled="busy"
          @click="onInstallOrUpdate"
        >
          <Download :size="16" :stroke-width="1.5" class="btn-ic" />
          {{ t('settings.pluginInstall') }}
        </button>
      </div>
    </div>

    <ConfirmDialog
      :visible="removeConfirmVisible"
      :title="t('settings.pluginRemoveConfirmTitle')"
      :message="t('settings.pluginRemoveConfirmMessage')"
      :confirm-text="t('settings.pluginRemove')"
      :cancel-text="t('dialog.cancel')"
      confirm-variant="danger"
      @confirm="onConfirmRemove"
      @cancel="removeConfirmVisible = false"
    />
  </div>
</template>

<style scoped>
.section-desc {
  margin: -4px 0 20px;
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.5;
}

.plugin-card {
  border: 1px solid var(--border-color);
  border-radius: 10px;
  padding: 16px 18px;
  background: var(--bg-sidebar);
}

.plugin-card__head {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.plugin-card__title {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
}

.plugin-card__badge {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 999px;
  background: var(--bg-active);
  color: var(--text-primary);
}

.plugin-card__badge--muted {
  opacity: 0.75;
}

.plugin-card__desc {
  margin: 10px 0 0;
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.55;
}

.plugin-card__license {
  margin: 8px 0 0;
  font-size: 12px;
  color: var(--text-tertiary, var(--text-secondary));
  line-height: 1.45;
}

.plugin-card__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 12px 20px;
  margin-top: 12px;
  font-size: 12px;
  color: var(--text-secondary);
}

.plugin-card__builtin-hint {
  margin: 10px 0 0;
  font-size: 12px;
  color: var(--text-secondary);
  line-height: 1.5;
}

.plugin-card__warn,
.plugin-card__error {
  margin-top: 10px;
  font-size: 12px;
  line-height: 1.45;
}

.plugin-card__warn {
  color: var(--text-secondary);
}

.plugin-card__error {
  color: #c62828;
}

html[data-theme='dark'] .plugin-card__error {
  color: #ef9a9a;
}

.plugin-card__progress {
  margin-top: 14px;
}

.plugin-card__progress-label {
  font-size: 12px;
  color: var(--text-secondary);
  margin-bottom: 6px;
}

.plugin-card__progress-bar {
  height: 6px;
  border-radius: 999px;
  background: var(--border-color);
  overflow: hidden;
}

.plugin-card__progress-fill {
  height: 100%;
  background: var(--accent, #1976d2);
  transition: width 0.15s ease;
}

.plugin-card__progress-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  flex-wrap: wrap;
  font-size: 11px;
  color: var(--text-tertiary, var(--text-secondary));
  margin-top: 4px;
}

.plugin-card__progress-size {
  min-width: 0;
}

.plugin-card__progress-speed {
  flex-shrink: 0;
  color: var(--text-secondary);
}

.plugin-card__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 16px;
}

.btn-primary,
.btn-danger {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  border-radius: 8px;
  font-size: 13px;
  font-family: inherit;
  cursor: pointer;
  border: 1px solid transparent;
}

.btn-primary {
  background: var(--bg-active);
  color: var(--text-primary);
  border-color: var(--border-color);
}

.btn-primary:hover:not(:disabled) {
  background: var(--bg-hover);
}

.btn-danger {
  background: transparent;
  color: #c62828;
  border-color: rgba(198, 40, 40, 0.35);
}

.btn-danger:hover:not(:disabled) {
  background: rgba(198, 40, 40, 0.08);
}

html[data-theme='dark'] .btn-danger {
  color: #ef9a9a;
  border-color: rgba(239, 154, 154, 0.35);
}

.btn-primary:disabled,
.btn-danger:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-ic {
  flex-shrink: 0;
}
</style>
