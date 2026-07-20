<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { FolderOpen } from '@/components/icons'
import { ZqSwitch } from '@/components/ui'
import CodeThemeSelect from './CodeThemeSelect.vue'
import { normalizeMdAssetCustomFolder } from '../../../../shared/markdown-assets'

const props = defineProps<{
  codeTheme: string
  drawioUiLayout: 'full' | 'minimal'
  spellcheck: boolean
  mdAssetMode: 'relative' | 'absolute'
  mdAssetFolder: 'assets' | 'docNamed' | 'same' | 'custom'
  mdAssetCustomFolder: string
  mdAssetFileName: 'original' | 'uuid'
  isWebPlatform: boolean
  /** 已下载流程图插件时为 true */
  drawioBundleReady: boolean
}>()

const emit = defineEmits<{
  'update:codeTheme': [value: string]
  'update:drawioUiLayout': [value: 'full' | 'minimal']
  'update:spellcheck': [value: boolean]
  'update:mdAssetMode': [value: 'relative' | 'absolute']
  'update:mdAssetFolder': [value: 'assets' | 'docNamed' | 'same' | 'custom']
  'update:mdAssetCustomFolder': [value: string]
  'update:mdAssetFileName': [value: 'original' | 'uuid']
}>()

const { t } = useI18n()
const customFolderDraft = ref(props.mdAssetCustomFolder)

watch(
  () => props.mdAssetCustomFolder,
  (v) => {
    customFolderDraft.value = v
  },
)

function onCodeThemeInput(v: string) {
  emit('update:codeTheme', v)
}

function onDrawioLayoutInput(v: 'full' | 'minimal') {
  emit('update:drawioUiLayout', v)
}

function onSpellcheckInput(v: boolean) {
  emit('update:spellcheck', v)
}

function onMdAssetModeInput(v: 'relative' | 'absolute') {
  emit('update:mdAssetMode', v)
}

function onMdAssetFolderInput(v: 'assets' | 'docNamed' | 'same' | 'custom') {
  emit('update:mdAssetFolder', v)
}

function onMdAssetFileNameInput(v: 'original' | 'uuid') {
  emit('update:mdAssetFileName', v)
}

function commitCustomFolder() {
  emit('update:mdAssetCustomFolder', normalizeMdAssetCustomFolder(customFolderDraft.value))
}

async function onBrowseCustomFolder() {
  if (!window.electron?.pickMdAssetCustomFolder) return
  const absPath = await window.electron.pickMdAssetCustomFolder()
  if (absPath) {
    customFolderDraft.value = absPath
    emit('update:mdAssetCustomFolder', normalizeMdAssetCustomFolder(absPath))
  }
}
</script>

<template>
  <div class="settings-panel">
    <h2 class="section-title">{{ t('settings.editor') }}</h2>

    <div class="setting-group">
      <div class="setting-label">
        <span class="label-text">{{ t('settings.codeTheme') }}</span>
        <span class="label-desc">{{ t('settings.codeThemeDesc') }}</span>
      </div>

      <CodeThemeSelect :model-value="codeTheme" @update:model-value="onCodeThemeInput" />
    </div>

    <div class="setting-group">
      <div class="setting-row">
        <div class="setting-label">
          <span class="label-text">{{ t('settings.spellcheck') }}</span>
          <span class="label-desc">{{ t('settings.spellcheckDesc') }}</span>
        </div>
        <ZqSwitch
          :model-value="spellcheck"
          @update:model-value="onSpellcheckInput"
        />
      </div>
    </div>

    <div class="setting-group">
      <div class="setting-label">
        <span class="label-text">{{ t('settings.mdAssetMode') }}</span>
        <span class="label-desc">{{ t('settings.mdAssetModeDesc') }}</span>
      </div>

      <div class="drawio-layout-seg" role="group" :aria-label="t('settings.mdAssetMode')">
        <button
          type="button"
          class="seg-btn"
          :class="{ active: mdAssetMode === 'relative' }"
          @click="onMdAssetModeInput('relative')"
        >
          {{ t('settings.mdAssetModeRelative') }}
        </button>
        <button
          type="button"
          class="seg-btn"
          :class="{ active: mdAssetMode === 'absolute' }"
          @click="onMdAssetModeInput('absolute')"
        >
          {{ t('settings.mdAssetModeAbsolute') }}
        </button>
      </div>

      <p v-if="isWebPlatform" class="md-asset-hint">{{ t('settings.mdAssetDesktopOnlyHint') }}</p>

      <template v-if="mdAssetMode === 'relative'">
        <div class="md-asset-sub">
          <span class="md-asset-sub__label">{{ t('settings.mdAssetFolder') }}</span>
          <span class="md-asset-sub__desc">{{ t('settings.mdAssetFolderDesc') }}</span>
          <div class="drawio-layout-seg md-asset-sub__seg" role="group" :aria-label="t('settings.mdAssetFolder')">
            <button
              type="button"
              class="seg-btn"
              :class="{ active: mdAssetFolder === 'assets' }"
              @click="onMdAssetFolderInput('assets')"
            >
              {{ t('settings.mdAssetFolderAssets') }}
            </button>
            <button
              type="button"
              class="seg-btn"
              :class="{ active: mdAssetFolder === 'docNamed' }"
              @click="onMdAssetFolderInput('docNamed')"
            >
              {{ t('settings.mdAssetFolderDocNamed') }}
            </button>
            <button
              type="button"
              class="seg-btn"
              :class="{ active: mdAssetFolder === 'same' }"
              @click="onMdAssetFolderInput('same')"
            >
              {{ t('settings.mdAssetFolderSame') }}
            </button>
            <button
              type="button"
              class="seg-btn"
              :class="{ active: mdAssetFolder === 'custom' }"
              @click="onMdAssetFolderInput('custom')"
            >
              {{ t('settings.mdAssetFolderCustom') }}
            </button>
          </div>
        </div>

        <div v-if="mdAssetFolder === 'custom'" class="md-asset-sub">
          <span class="md-asset-sub__label">{{ t('settings.mdAssetCustomFolder') }}</span>
          <span class="md-asset-sub__desc">{{ t('settings.mdAssetCustomFolderDesc') }}</span>
          <div class="md-asset-custom-row">
            <input
              v-model="customFolderDraft"
              type="text"
              class="md-asset-custom-input"
              :placeholder="t('settings.mdAssetCustomFolderPlaceholder')"
              spellcheck="false"
              @change="commitCustomFolder"
              @blur="commitCustomFolder"
            />
            <button
              v-if="!isWebPlatform"
              type="button"
              class="md-asset-custom-browse"
              :title="t('settings.mdAssetCustomFolderBrowse')"
              @click="onBrowseCustomFolder"
            >
              <FolderOpen :size="16" />
            </button>
          </div>
          <p v-if="!isWebPlatform && !customFolderDraft" class="md-asset-hint md-asset-hint--compact">
            {{ t('settings.mdAssetCustomFolderEmptyHint') }}
          </p>
        </div>

        <div class="md-asset-sub">
          <span class="md-asset-sub__label">{{ t('settings.mdAssetFileName') }}</span>
          <span class="md-asset-sub__desc">{{ t('settings.mdAssetFileNameDesc') }}</span>
          <div class="drawio-layout-seg" role="group" :aria-label="t('settings.mdAssetFileName')">
            <button
              type="button"
              class="seg-btn"
              :class="{ active: mdAssetFileName === 'original' }"
              @click="onMdAssetFileNameInput('original')"
            >
              {{ t('settings.mdAssetFileNameOriginal') }}
            </button>
            <button
              type="button"
              class="seg-btn"
              :class="{ active: mdAssetFileName === 'uuid' }"
              @click="onMdAssetFileNameInput('uuid')"
            >
              {{ t('settings.mdAssetFileNameUuid') }}
            </button>
          </div>
        </div>
      </template>
    </div>

    <div v-if="drawioBundleReady" class="setting-group">
      <div class="setting-label">
        <span class="label-text">{{ t('settings.drawioUiLayout') }}</span>
        <span class="label-desc">{{ t('settings.drawioUiLayoutDesc') }}</span>
      </div>

      <div class="drawio-layout-seg" role="group" :aria-label="t('settings.drawioUiLayout')">
        <button
          type="button"
          class="seg-btn"
          :class="{ active: drawioUiLayout === 'full' }"
          @click="onDrawioLayoutInput('full')"
        >
          {{ t('settings.drawioUiLayoutFull') }}
        </button>
        <button
          type="button"
          class="seg-btn"
          :class="{ active: drawioUiLayout === 'minimal' }"
          @click="onDrawioLayoutInput('minimal')"
        >
          {{ t('settings.drawioUiLayoutMinimal') }}
        </button>
      </div>
    </div>
    <div v-else class="setting-group">
      <p class="drawio-plugin-hint">{{ t('settings.drawioLayoutRequiresPlugin') }}</p>
    </div>
  </div>
</template>

<style scoped>
.drawio-layout-seg {
  display: inline-flex;
  border-radius: 8px;
  border: 1px solid var(--border-color);
  overflow: hidden;
  background: var(--bg-sidebar);
}

.seg-btn {
  padding: 8px 16px;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  font-size: 13px;
  font-family: inherit;
  cursor: pointer;
  transition:
    background 0.12s ease,
    color 0.12s ease;
}

.seg-btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.seg-btn.active {
  background: var(--bg-active);
  color: var(--text-primary);
  font-weight: 500;
}

.seg-btn + .seg-btn {
  border-left: 1px solid var(--border-color);
}

.drawio-plugin-hint,
.md-asset-hint {
  margin: 0;
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.55;
}

.md-asset-hint {
  margin-top: 10px;
}

.md-asset-hint--compact {
  margin-top: 6px;
  font-size: 12px;
}

.md-asset-sub {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 16px;
}

.md-asset-sub__label {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary);
}

.md-asset-sub__desc {
  font-size: 12px;
  color: var(--text-secondary);
  line-height: 1.5;
}

.md-asset-sub__seg {
  flex-wrap: wrap;
}

.md-asset-custom-row {
  display: flex;
  gap: 8px;
  align-items: center;
}

.md-asset-custom-input {
  flex: 1;
  min-width: 0;
  height: 36px;
  padding: 0 12px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: var(--bg-input);
  color: var(--text-primary);
  font-size: 13px;
  font-family: inherit;
}

.md-asset-custom-input:focus {
  outline: none;
  border-color: var(--accent-color);
}

.md-asset-custom-browse {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: var(--bg-input);
  color: var(--text-secondary);
  cursor: pointer;
  flex-shrink: 0;
  transition: all 0.15s;
}

.md-asset-custom-browse:hover {
  border-color: var(--accent-color);
  color: var(--accent-color);
}
</style>
