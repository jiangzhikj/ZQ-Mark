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
import type {
  ExcalidrawBundleStatus,
  ExcalidrawInstallProgress,
  ExcalidrawPluginManifest,
} from '../../../../shared/excalidraw-plugin'
import type {
  WisemappingBundleStatus,
  WisemappingInstallProgress,
  WisemappingPluginManifest,
} from '../../../../shared/wisemapping-plugin'

const emit = defineEmits<{
  drawioBundleChanged: []
  excalidrawBundleChanged: []
  wisemappingBundleChanged: []
}>()

const { t } = useI18n()

const drawioStatus = ref<DrawioBundleStatus | null>(null)
const drawioManifest = ref<DrawioPluginManifest | null>(null)
const drawioManifestError = ref('')
const drawioInstallError = ref('')
const drawioBusy = ref(false)
const drawioProgress = ref<DrawioInstallProgress | null>(null)
const drawioRemoveConfirmVisible = ref(false)

const exStatus = ref<ExcalidrawBundleStatus | null>(null)
const exManifest = ref<ExcalidrawPluginManifest | null>(null)
const exManifestError = ref('')
const exInstallError = ref('')
const exBusy = ref(false)
const exProgress = ref<ExcalidrawInstallProgress | null>(null)
const exRemoveConfirmVisible = ref(false)

const wmStatus = ref<WisemappingBundleStatus | null>(null)
const wmManifest = ref<WisemappingPluginManifest | null>(null)
const wmManifestError = ref('')
const wmInstallError = ref('')
const wmBusy = ref(false)
const wmProgress = ref<WisemappingInstallProgress | null>(null)
const wmRemoveConfirmVisible = ref(false)

let cleanupDrawioProgress: (() => void) | null = null
let cleanupExProgress: (() => void) | null = null
let cleanupWmProgress: (() => void) | null = null

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

function formatSpeed(bps: number | undefined): string {
  if (bps == null || !Number.isFinite(bps) || bps <= 0) return ''
  if (bps < 1024) return `${bps.toFixed(0)} B/s`
  if (bps < 1024 * 1024) return `${(bps / 1024).toFixed(1)} KB/s`
  return `${(bps / (1024 * 1024)).toFixed(1)} MB/s`
}

async function loadDrawioStatus() {
  try {
    drawioStatus.value = await window.electron.getDrawioBundleStatus()
  } catch {
    drawioStatus.value = { state: 'missing' }
  }
}

async function loadDrawioManifest() {
  drawioManifestError.value = ''
  try {
    drawioManifest.value = await window.electron.fetchDrawioManifest()
  } catch (e) {
    drawioManifest.value = null
    drawioManifestError.value = e instanceof Error ? e.message : String(e)
  }
}

function canUpdateDrawio() {
  if (
    !drawioManifest.value ||
    drawioStatus.value?.state !== 'ready' ||
    !drawioStatus.value.version ||
    !drawioStatus.value.userInstalled
  ) {
    return false
  }
  const v = drawioStatus.value.version
  if (v === 'dev' || v === 'bundled') {
    return false
  }
  return compareVersions(drawioManifest.value.version, v) > 0
}

async function onDrawioInstallOrUpdate() {
  drawioInstallError.value = ''
  drawioBusy.value = true
  drawioProgress.value = null
  try {
    await window.electron.installDrawioBundle()
    await loadDrawioStatus()
    emit('drawioBundleChanged')
  } catch (e) {
    drawioInstallError.value = e instanceof Error ? e.message : String(e)
  } finally {
    drawioBusy.value = false
    drawioProgress.value = null
  }
}

function askRemoveDrawio() {
  drawioRemoveConfirmVisible.value = true
}

async function onConfirmRemoveDrawio() {
  drawioRemoveConfirmVisible.value = false
  drawioInstallError.value = ''
  drawioBusy.value = true
  try {
    await window.electron.removeDrawioBundle()
    await loadDrawioStatus()
    emit('drawioBundleChanged')
  } catch (e) {
    drawioInstallError.value = e instanceof Error ? e.message : String(e)
  } finally {
    drawioBusy.value = false
  }
}

async function loadExStatus() {
  try {
    exStatus.value = await window.electron.getExcalidrawBundleStatus()
  } catch {
    exStatus.value = { state: 'missing' }
  }
}

async function loadExManifest() {
  exManifestError.value = ''
  try {
    exManifest.value = await window.electron.fetchExcalidrawManifest()
  } catch (e) {
    exManifest.value = null
    exManifestError.value = e instanceof Error ? e.message : String(e)
  }
}

function canUpdateEx() {
  if (
    !exManifest.value ||
    exStatus.value?.state !== 'ready' ||
    !exStatus.value.version ||
    !exStatus.value.userInstalled
  ) {
    return false
  }
  const v = exStatus.value.version
  if (v === 'dev' || v === 'bundled') {
    return false
  }
  return compareVersions(exManifest.value.version, v) > 0
}

async function onExInstallOrUpdate() {
  exInstallError.value = ''
  exBusy.value = true
  exProgress.value = null
  try {
    await window.electron.installExcalidrawBundle()
    await loadExStatus()
    emit('excalidrawBundleChanged')
  } catch (e) {
    exInstallError.value = e instanceof Error ? e.message : String(e)
  } finally {
    exBusy.value = false
    exProgress.value = null
  }
}

function askRemoveEx() {
  exRemoveConfirmVisible.value = true
}

async function onConfirmRemoveEx() {
  exRemoveConfirmVisible.value = false
  exInstallError.value = ''
  exBusy.value = true
  try {
    await window.electron.removeExcalidrawBundle()
    await loadExStatus()
    emit('excalidrawBundleChanged')
  } catch (e) {
    exInstallError.value = e instanceof Error ? e.message : String(e)
  } finally {
    exBusy.value = false
  }
}

async function loadWmStatus() {
  try {
    wmStatus.value = await window.electron.getWisemappingBundleStatus()
  } catch {
    wmStatus.value = { state: 'missing' }
  }
}

async function loadWmManifest() {
  wmManifestError.value = ''
  try {
    wmManifest.value = await window.electron.fetchWisemappingManifest()
  } catch (e) {
    wmManifest.value = null
    wmManifestError.value = e instanceof Error ? e.message : String(e)
  }
}

function canUpdateWm() {
  if (
    !wmManifest.value ||
    wmStatus.value?.state !== 'ready' ||
    !wmStatus.value.version ||
    !wmStatus.value.userInstalled
  ) {
    return false
  }
  const v = wmStatus.value.version
  if (v === 'dev' || v === 'bundled') {
    return false
  }
  return compareVersions(wmManifest.value.version, v) > 0
}

async function onWmInstallOrUpdate() {
  wmInstallError.value = ''
  wmBusy.value = true
  wmProgress.value = null
  try {
    await window.electron.installWisemappingBundle()
    await loadWmStatus()
    emit('wisemappingBundleChanged')
  } catch (e) {
    wmInstallError.value = e instanceof Error ? e.message : String(e)
  } finally {
    wmBusy.value = false
    wmProgress.value = null
  }
}

function askRemoveWm() {
  wmRemoveConfirmVisible.value = true
}

async function onConfirmRemoveWm() {
  wmRemoveConfirmVisible.value = false
  wmInstallError.value = ''
  wmBusy.value = true
  try {
    await window.electron.removeWisemappingBundle()
    await loadWmStatus()
    emit('wisemappingBundleChanged')
  } catch (e) {
    wmInstallError.value = e instanceof Error ? e.message : String(e)
  } finally {
    wmBusy.value = false
  }
}

const anyBusy = () => drawioBusy.value || exBusy.value || wmBusy.value

onMounted(async () => {
  await loadDrawioStatus()
  await loadDrawioManifest()
  await loadExStatus()
  await loadExManifest()
  await loadWmStatus()
  await loadWmManifest()

  cleanupDrawioProgress = window.electron.onDrawioInstallProgress((p) => {
    drawioProgress.value = p
    if (p.phase === 'downloading' || p.phase === 'verifying' || p.phase === 'extracting') {
      drawioBusy.value = true
    }
    if (p.phase === 'done' || p.phase === 'error') {
      drawioBusy.value = false
      if (p.phase === 'error') {
        drawioInstallError.value = p.message || t('settings.pluginInstallFailed')
      }
    }
  })

  cleanupExProgress = window.electron.onExcalidrawInstallProgress((p) => {
    exProgress.value = p
    if (p.phase === 'downloading' || p.phase === 'verifying' || p.phase === 'extracting') {
      exBusy.value = true
    }
    if (p.phase === 'done' || p.phase === 'error') {
      exBusy.value = false
      if (p.phase === 'error') {
        exInstallError.value = p.message || t('settings.pluginInstallFailed')
      }
    }
  })

  cleanupWmProgress = window.electron.onWisemappingInstallProgress((p) => {
    wmProgress.value = p
    if (p.phase === 'downloading' || p.phase === 'verifying' || p.phase === 'extracting') {
      wmBusy.value = true
    }
    if (p.phase === 'done' || p.phase === 'error') {
      wmBusy.value = false
      if (p.phase === 'error') {
        wmInstallError.value = p.message || t('settings.pluginInstallFailed')
      }
    }
  })
})

onBeforeUnmount(() => {
  cleanupDrawioProgress?.()
  cleanupExProgress?.()
  cleanupWmProgress?.()
})

defineExpose({
  refresh: async () => {
    await loadDrawioStatus()
    await loadDrawioManifest()
    await loadExStatus()
    await loadExManifest()
    await loadWmStatus()
    await loadWmManifest()
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
          v-if="drawioStatus?.state === 'ready' && drawioStatus.userInstalled"
          class="plugin-card__badge"
        >{{ t('settings.pluginInstalled') }}</span>
        <span
          v-else-if="drawioStatus?.state === 'ready'"
          class="plugin-card__badge plugin-card__badge--muted"
        >{{ t('settings.pluginBuiltinDrawio') }}</span>
        <span
          v-else
          class="plugin-card__badge plugin-card__badge--muted"
        >{{ t('settings.pluginNotInstalled') }}</span>
      </div>
      <p class="plugin-card__desc">{{ t('settings.pluginDrawioDesc') }}</p>
      <p class="plugin-card__license">{{ t('settings.pluginDrawioLicense') }}</p>

      <div v-if="drawioManifestError" class="plugin-card__warn">
        {{ t('settings.pluginManifestError') }}: {{ drawioManifestError }}
      </div>
      <div v-else-if="drawioManifest" class="plugin-card__meta">
        <span v-if="drawioManifest.version">{{ t('settings.pluginRemoteVersion') }}: {{ drawioManifest.version }}</span>
        <span v-if="drawioStatus?.version">{{ t('settings.pluginInstalledVersion') }}: {{ drawioStatus.version }}</span>
        <span>{{ t('settings.pluginSize') }}: {{ formatBytes(drawioManifest.size) }}</span>
      </div>
      <p
        v-if="drawioStatus?.state === 'ready' && drawioStatus.userInstalled === false"
        class="plugin-card__builtin-hint"
      >
        {{ t('settings.pluginBuiltinDrawioHint') }}
      </p>

      <div v-if="drawioInstallError" class="plugin-card__error">
        {{ drawioInstallError }}
      </div>

      <div
        v-if="drawioProgress && drawioProgress.phase !== 'done' && drawioProgress.phase !== 'error'"
        class="plugin-card__progress"
      >
        <div class="plugin-card__progress-label">
          <template v-if="drawioProgress.phase === 'downloading'">{{ t('settings.pluginPhaseDownloading') }}</template>
          <template v-else-if="drawioProgress.phase === 'verifying'">{{ t('settings.pluginPhaseVerifying') }}</template>
          <template v-else-if="drawioProgress.phase === 'extracting'">{{ t('settings.pluginPhaseExtracting') }}</template>
        </div>
        <div class="plugin-card__progress-bar">
          <div
            class="plugin-card__progress-fill"
            :style="{ width: `${drawioProgress.percent ?? 0}%` }"
          />
        </div>
        <div class="plugin-card__progress-footer">
          <span class="plugin-card__progress-size">
            <template v-if="drawioProgress.total">
              {{ formatBytes(drawioProgress.received) }} / {{ formatBytes(drawioProgress.total) }}
            </template>
            <template v-else>
              {{ formatBytes(drawioProgress.received) }}
            </template>
          </span>
          <span
            v-if="drawioProgress.phase === 'downloading' && drawioProgress.bytesPerSecond"
            class="plugin-card__progress-speed"
          >
            {{ t('settings.pluginDownloadSpeed') }} {{ formatSpeed(drawioProgress.bytesPerSecond) }}
          </span>
        </div>
      </div>

      <div class="plugin-card__actions">
        <template v-if="drawioStatus?.userInstalled">
          <button
            v-if="canUpdateDrawio()"
            type="button"
            class="btn-primary"
            :disabled="anyBusy()"
            @click="onDrawioInstallOrUpdate"
          >
            <Download :size="16" :stroke-width="1.5" class="btn-ic" />
            {{ t('settings.pluginUpdate') }}
          </button>
          <button
            type="button"
            class="btn-danger"
            :disabled="anyBusy()"
            @click="askRemoveDrawio"
          >
            <Trash2 :size="16" :stroke-width="1.5" class="btn-ic" />
            {{ t('settings.pluginRemove') }}
          </button>
        </template>
        <button
          v-else
          type="button"
          class="btn-primary"
          :disabled="anyBusy()"
          @click="onDrawioInstallOrUpdate"
        >
          <Download :size="16" :stroke-width="1.5" class="btn-ic" />
          {{ t('settings.pluginInstall') }}
        </button>
      </div>
    </div>

    <div class="plugin-card plugin-card--spaced">
      <div class="plugin-card__head">
        <h3 class="plugin-card__title">{{ t('settings.pluginExcalidrawTitle') }}</h3>
        <span
          v-if="exStatus?.state === 'ready' && exStatus.userInstalled"
          class="plugin-card__badge"
        >{{ t('settings.pluginInstalled') }}</span>
        <span
          v-else-if="exStatus?.state === 'ready'"
          class="plugin-card__badge plugin-card__badge--muted"
        >{{ t('settings.pluginBuiltinExcalidraw') }}</span>
        <span
          v-else
          class="plugin-card__badge plugin-card__badge--muted"
        >{{ t('settings.pluginNotInstalled') }}</span>
      </div>
      <p class="plugin-card__desc">{{ t('settings.pluginExcalidrawDesc') }}</p>
      <p class="plugin-card__license">{{ t('settings.pluginExcalidrawLicense') }}</p>

      <div v-if="exManifestError" class="plugin-card__warn">
        {{ t('settings.pluginManifestError') }}: {{ exManifestError }}
      </div>
      <div v-else-if="exManifest" class="plugin-card__meta">
        <span v-if="exManifest.version">{{ t('settings.pluginRemoteVersion') }}: {{ exManifest.version }}</span>
        <span v-if="exStatus?.version">{{ t('settings.pluginInstalledVersion') }}: {{ exStatus.version }}</span>
        <span>{{ t('settings.pluginSize') }}: {{ formatBytes(exManifest.size) }}</span>
      </div>
<!--      <p-->
<!--        v-if="exStatus?.state === 'ready' && exStatus.userInstalled === false"-->
<!--        class="plugin-card__builtin-hint"-->
<!--      >-->
<!--        {{ t('settings.pluginBuiltinExcalidrawHint') }}-->
<!--      </p>-->

      <div v-if="exInstallError" class="plugin-card__error">
        {{ exInstallError }}
      </div>

      <div
        v-if="exProgress && exProgress.phase !== 'done' && exProgress.phase !== 'error'"
        class="plugin-card__progress"
      >
        <div class="plugin-card__progress-label">
          <template v-if="exProgress.phase === 'downloading'">{{ t('settings.pluginPhaseDownloading') }}</template>
          <template v-else-if="exProgress.phase === 'verifying'">{{ t('settings.pluginPhaseVerifying') }}</template>
          <template v-else-if="exProgress.phase === 'extracting'">{{ t('settings.pluginPhaseExtracting') }}</template>
        </div>
        <div class="plugin-card__progress-bar">
          <div
            class="plugin-card__progress-fill"
            :style="{ width: `${exProgress.percent ?? 0}%` }"
          />
        </div>
        <div class="plugin-card__progress-footer">
          <span class="plugin-card__progress-size">
            <template v-if="exProgress.total">
              {{ formatBytes(exProgress.received) }} / {{ formatBytes(exProgress.total) }}
            </template>
            <template v-else>
              {{ formatBytes(exProgress.received) }}
            </template>
          </span>
          <span
            v-if="exProgress.phase === 'downloading' && exProgress.bytesPerSecond"
            class="plugin-card__progress-speed"
          >
            {{ t('settings.pluginDownloadSpeed') }} {{ formatSpeed(exProgress.bytesPerSecond) }}
          </span>
        </div>
      </div>

      <div class="plugin-card__actions">
        <template v-if="exStatus?.userInstalled">
          <button
            v-if="canUpdateEx()"
            type="button"
            class="btn-primary"
            :disabled="anyBusy()"
            @click="onExInstallOrUpdate"
          >
            <Download :size="16" :stroke-width="1.5" class="btn-ic" />
            {{ t('settings.pluginUpdate') }}
          </button>
          <button
            type="button"
            class="btn-danger"
            :disabled="anyBusy()"
            @click="askRemoveEx"
          >
            <Trash2 :size="16" :stroke-width="1.5" class="btn-ic" />
            {{ t('settings.pluginRemove') }}
          </button>
        </template>
        <button
          v-else
          type="button"
          class="btn-primary"
          :disabled="anyBusy()"
          @click="onExInstallOrUpdate"
        >
          <Download :size="16" :stroke-width="1.5" class="btn-ic" />
          {{ t('settings.pluginInstall') }}
        </button>
      </div>
    </div>

    <div class="plugin-card plugin-card--spaced">
      <div class="plugin-card__head">
        <h3 class="plugin-card__title">{{ t('settings.pluginWisemappingTitle') }}</h3>
        <span
          v-if="wmStatus?.state === 'ready' && wmStatus.userInstalled"
          class="plugin-card__badge"
        >{{ t('settings.pluginInstalled') }}</span>
        <span
          v-else-if="wmStatus?.state === 'ready'"
          class="plugin-card__badge plugin-card__badge--muted"
        >{{ t('settings.pluginBuiltinWisemapping') }}</span>
        <span
          v-else
          class="plugin-card__badge plugin-card__badge--muted"
        >{{ t('settings.pluginNotInstalled') }}</span>
      </div>
      <p class="plugin-card__desc">{{ t('settings.pluginWisemappingDesc') }}</p>
      <p class="plugin-card__license">{{ t('settings.pluginWisemappingLicense') }}</p>

      <div v-if="wmManifestError" class="plugin-card__warn">
        {{ t('settings.pluginManifestError') }}: {{ wmManifestError }}
      </div>
      <div v-else-if="wmManifest" class="plugin-card__meta">
        <span v-if="wmManifest.version">{{ t('settings.pluginRemoteVersion') }}: {{ wmManifest.version }}</span>
        <span v-if="wmStatus?.version">{{ t('settings.pluginInstalledVersion') }}: {{ wmStatus.version }}</span>
        <span>{{ t('settings.pluginSize') }}: {{ formatBytes(wmManifest.size) }}</span>
      </div>
      <p
        v-if="wmStatus?.state === 'ready' && wmStatus.userInstalled === false"
        class="plugin-card__builtin-hint"
      >
        {{ t('settings.pluginBuiltinWisemappingHint') }}
      </p>

      <div v-if="wmInstallError" class="plugin-card__error">
        {{ wmInstallError }}
      </div>

      <div
        v-if="wmProgress && wmProgress.phase !== 'done' && wmProgress.phase !== 'error'"
        class="plugin-card__progress"
      >
        <div class="plugin-card__progress-label">
          <template v-if="wmProgress.phase === 'downloading'">{{ t('settings.pluginPhaseDownloading') }}</template>
          <template v-else-if="wmProgress.phase === 'verifying'">{{ t('settings.pluginPhaseVerifying') }}</template>
          <template v-else-if="wmProgress.phase === 'extracting'">{{ t('settings.pluginPhaseExtracting') }}</template>
        </div>
        <div class="plugin-card__progress-bar">
          <div
            class="plugin-card__progress-fill"
            :style="{ width: `${wmProgress.percent ?? 0}%` }"
          />
        </div>
        <div class="plugin-card__progress-footer">
          <span class="plugin-card__progress-size">
            <template v-if="wmProgress.total">
              {{ formatBytes(wmProgress.received) }} / {{ formatBytes(wmProgress.total) }}
            </template>
            <template v-else>
              {{ formatBytes(wmProgress.received) }}
            </template>
          </span>
          <span
            v-if="wmProgress.phase === 'downloading' && wmProgress.bytesPerSecond"
            class="plugin-card__progress-speed"
          >
            {{ t('settings.pluginDownloadSpeed') }} {{ formatSpeed(wmProgress.bytesPerSecond) }}
          </span>
        </div>
      </div>

      <div class="plugin-card__actions">
        <template v-if="wmStatus?.userInstalled">
          <button
            v-if="canUpdateWm()"
            type="button"
            class="btn-primary"
            :disabled="anyBusy()"
            @click="onWmInstallOrUpdate"
          >
            <Download :size="16" :stroke-width="1.5" class="btn-ic" />
            {{ t('settings.pluginUpdate') }}
          </button>
          <button
            type="button"
            class="btn-danger"
            :disabled="anyBusy()"
            @click="askRemoveWm"
          >
            <Trash2 :size="16" :stroke-width="1.5" class="btn-ic" />
            {{ t('settings.pluginRemove') }}
          </button>
        </template>
        <button
          v-else
          type="button"
          class="btn-primary"
          :disabled="anyBusy()"
          @click="onWmInstallOrUpdate"
        >
          <Download :size="16" :stroke-width="1.5" class="btn-ic" />
          {{ t('settings.pluginInstall') }}
        </button>
      </div>
    </div>

    <ConfirmDialog
      :visible="drawioRemoveConfirmVisible"
      :title="t('settings.pluginRemoveConfirmTitle')"
      :message="t('settings.pluginRemoveConfirmMessage')"
      :confirm-text="t('settings.pluginRemove')"
      :cancel-text="t('dialog.cancel')"
      confirm-variant="danger"
      @confirm="onConfirmRemoveDrawio"
      @cancel="drawioRemoveConfirmVisible = false"
    />

    <ConfirmDialog
      :visible="exRemoveConfirmVisible"
      :title="t('settings.pluginRemoveConfirmTitle')"
      :message="t('settings.pluginRemoveConfirmMessage')"
      :confirm-text="t('settings.pluginRemove')"
      :cancel-text="t('dialog.cancel')"
      confirm-variant="danger"
      @confirm="onConfirmRemoveEx"
      @cancel="exRemoveConfirmVisible = false"
    />

    <ConfirmDialog
      :visible="wmRemoveConfirmVisible"
      :title="t('settings.pluginRemoveWisemappingConfirmTitle')"
      :message="t('settings.pluginRemoveWisemappingConfirmMessage')"
      :confirm-text="t('settings.pluginRemove')"
      :cancel-text="t('dialog.cancel')"
      confirm-variant="danger"
      @confirm="onConfirmRemoveWm"
      @cancel="wmRemoveConfirmVisible = false"
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

.plugin-card--spaced {
  margin-top: 18px;
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
