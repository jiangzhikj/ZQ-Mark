<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  Code,
  Info,
  Palette,
  Puzzle,
  Settings,
  X,
} from '@/components/icons'
import { ZqScrollbar } from '@/components/ui'
import SettingsAppearanceTab from './settings/SettingsAppearanceTab.vue'
import SettingsEditorTab from './settings/SettingsEditorTab.vue'
import SettingsGeneralTab from './settings/SettingsGeneralTab.vue'
import SettingsPluginsTab from './settings/SettingsPluginsTab.vue'
import SettingsAboutTab from './settings/SettingsAboutTab.vue'

const props = defineProps<{
  visible: boolean
  currentLocale: string
  currentTheme: string
  autoSave: boolean
  codeTheme: string
  telemetryEnabled: boolean
  drawioUiLayout: 'full' | 'minimal'
  spellcheck: boolean
  saveFormatAskDialog: boolean
  saveFormatDefault: 'md' | 'zq'
  drawioBundleReady: boolean
  showPluginCenter: boolean
}>()

const emit = defineEmits<{
  close: []
  changeLocale: [locale: string]
  changeTheme: [theme: string]
  changeAutoSave: [enabled: boolean]
  changeTelemetry: [enabled: boolean]
  changeCodeTheme: [theme: string]
  changeSaveFormatAsk: [enabled: boolean]
  changeSaveFormatDefault: [format: 'md' | 'zq']
  changeDrawioUiLayout: [layout: 'full' | 'minimal']
  changeSpellcheck: [enabled: boolean]
  checkUpdate: []
  drawioBundleChanged: []
  excalidrawBundleChanged: []
  wisemappingBundleChanged: []
}>()

const { t } = useI18n()

const activeTab = ref<'general' | 'appearance' | 'editor' | 'plugins' | 'about'>(
  'general',
)

const selectedLocale = ref(props.currentLocale)
const selectedTheme = ref(props.currentTheme)
const selectedAutoSave = ref(props.autoSave)
const selectedTelemetryEnabled = ref(props.telemetryEnabled)
const selectedCodeTheme = ref(props.codeTheme)
const selectedDrawioUiLayout = ref(props.drawioUiLayout)
const selectedSpellcheck = ref(props.spellcheck)
const selectedSaveFormatAsk = ref(props.saveFormatAskDialog)
const selectedSaveFormatDefault = ref(props.saveFormatDefault)

watch(() => props.currentLocale, (v) => {
  selectedLocale.value = v
})
watch(() => props.currentTheme, (v) => {
  selectedTheme.value = v
})
watch(() => props.autoSave, (v) => {
  selectedAutoSave.value = v
})
watch(() => props.telemetryEnabled, (v) => {
  selectedTelemetryEnabled.value = v
})
watch(() => props.codeTheme, (v) => {
  selectedCodeTheme.value = v
})
watch(() => props.drawioUiLayout, (v) => {
  selectedDrawioUiLayout.value = v
})
watch(() => props.spellcheck, (v) => {
  selectedSpellcheck.value = v
})
watch(() => props.saveFormatAskDialog, (v) => {
  selectedSaveFormatAsk.value = v
})
watch(() => props.saveFormatDefault, (v) => {
  selectedSaveFormatDefault.value = v
})

function onLocaleChange(code: string) {
  selectedLocale.value = code
  emit('changeLocale', code)
}

function onThemeChange(code: string) {
  selectedTheme.value = code
  emit('changeTheme', code)
}

function onAutoSaveToggle(enabled: boolean) {
  selectedAutoSave.value = enabled
  emit('changeAutoSave', enabled)
}

function onTelemetryToggle(enabled: boolean) {
  selectedTelemetryEnabled.value = enabled
  emit('changeTelemetry', enabled)
}

function onCodeThemeChange(theme: string) {
  selectedCodeTheme.value = theme
  emit('changeCodeTheme', theme)
}

function onDrawioUiLayoutChange(layout: 'full' | 'minimal') {
  selectedDrawioUiLayout.value = layout
  emit('changeDrawioUiLayout', layout)
}

function onSpellcheckChange(enabled: boolean) {
  selectedSpellcheck.value = enabled
  emit('changeSpellcheck', enabled)
}

function onCheckUpdate() {
  emit('checkUpdate')
  emit('close')
}

function onDrawioBundleChanged() {
  emit('drawioBundleChanged')
}

function onExcalidrawBundleChanged() {
  emit('excalidrawBundleChanged')
}

function onWisemappingBundleChanged() {
  emit('wisemappingBundleChanged')
}

function onSaveFormatAskToggle(enabled: boolean) {
  selectedSaveFormatAsk.value = enabled
  emit('changeSaveFormatAsk', enabled)
}

function onSaveFormatDefaultChange(format: 'md' | 'zq') {
  selectedSaveFormatDefault.value = format
  emit('changeSaveFormatDefault', format)
}

watch(() => props.visible, (v) => {
  if (!v) {
    activeTab.value = 'general'
  }
})
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="visible" class="settings-overlay" @click.self="emit('close')">
        <div class="settings-window">
          <nav class="settings-nav">
            <div class="settings-nav-header">{{ t('settings.title') }}</div>
            <button
              type="button"
              class="nav-item"
              :class="{ active: activeTab === 'general' }"
              @click="activeTab = 'general'"
            >
              <Settings :size="16" :stroke-width="1.3" />
              {{ t('settings.general') }}
            </button>
            <button
              type="button"
              class="nav-item"
              :class="{ active: activeTab === 'appearance' }"
              @click="activeTab = 'appearance'"
            >
              <Palette :size="16" :stroke-width="1.3" />
              {{ t('settings.appearance') }}
            </button>
            <button
              type="button"
              class="nav-item"
              :class="{ active: activeTab === 'editor' }"
              @click="activeTab = 'editor'"
            >
              <Code :size="16" :stroke-width="1.3" />
              {{ t('settings.editor') }}
            </button>
            <button
              v-if="showPluginCenter"
              type="button"
              class="nav-item"
              :class="{ active: activeTab === 'plugins' }"
              @click="activeTab = 'plugins'"
            >
              <Puzzle :size="16" :stroke-width="1.3" />
              {{ t('settings.plugins') }}
            </button>
            <button
              type="button"
              class="nav-item"
              :class="{ active: activeTab === 'about' }"
              @click="activeTab = 'about'"
            >
              <Info :size="16" :stroke-width="1.3" />
              {{ t('settings.about') }}
            </button>
          </nav>

          <div class="settings-main">
            <button type="button" class="close-btn" @click="emit('close')">
              <X :size="14" :stroke-width="1.5" />
            </button>

            <ZqScrollbar class="settings-main-scroll">
              <div class="settings-content">
                <SettingsGeneralTab
                  v-show="activeTab === 'general'"
                  :selected-locale="selectedLocale"
                  :selected-auto-save="selectedAutoSave"
                  :telemetry-enabled="selectedTelemetryEnabled"
                  :save-format-ask-dialog="selectedSaveFormatAsk"
                  :save-format-default="selectedSaveFormatDefault"
                  @change-locale="onLocaleChange"
                  @change-auto-save="onAutoSaveToggle"
                  @change-telemetry="onTelemetryToggle"
                  @change-save-format-ask="onSaveFormatAskToggle"
                  @change-save-format-default="onSaveFormatDefaultChange"
                />

                <SettingsAppearanceTab
                  v-show="activeTab === 'appearance'"
                  :selected-theme="selectedTheme"
                  @change-theme="onThemeChange"
                />

                <SettingsEditorTab
                  v-show="activeTab === 'editor'"
                  :code-theme="selectedCodeTheme"
                  :drawio-ui-layout="selectedDrawioUiLayout"
                  :spellcheck="selectedSpellcheck"
                  :drawio-bundle-ready="drawioBundleReady"
                  @update:code-theme="onCodeThemeChange"
                  @update:drawio-ui-layout="onDrawioUiLayoutChange"
                  @update:spellcheck="onSpellcheckChange"
                />

                <SettingsPluginsTab
                  v-show="activeTab === 'plugins'"
                  @drawio-bundle-changed="onDrawioBundleChanged"
                  @excalidraw-bundle-changed="onExcalidrawBundleChanged"
                  @wisemapping-bundle-changed="onWisemappingBundleChanged"
                />

                <SettingsAboutTab
                  v-show="activeTab === 'about'"
                  :visible="visible"
                  @check-update="onCheckUpdate"
                />
              </div>
            </ZqScrollbar>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.settings-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.35);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  backdrop-filter: blur(4px);
}

.settings-window {
  width: 700px;
  height: 560px;
  background: var(--bg-editor);
  border-radius: 12px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3), 0 0 0 1px var(--border-color);
  display: flex;
  overflow: hidden;
}

.settings-nav {
  width: 170px;
  flex-shrink: 0;
  background: var(--bg-sidebar);
  border-right: 1px solid var(--border-color);
  padding: 16px 8px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.settings-nav-header {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--text-tertiary);
  padding: 4px 10px 12px;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--text-secondary);
  font-size: 13px;
  font-family: inherit;
  cursor: pointer;
  transition: all 0.12s ease;
  text-align: left;
}

.nav-item:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.nav-item.active {
  background: var(--bg-active);
  color: var(--text-primary);
  font-weight: 500;
}

.settings-main {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  position: relative;
}

.settings-window :deep(.settings-main-scroll) {
  flex: 1;
  min-height: 0;
}

.settings-content {
  padding: 20px;
  margin: 6px;
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

.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.2s ease;
}

.modal-enter-active .settings-window,
.modal-leave-active .settings-window {
  transition: transform 0.2s ease, opacity 0.2s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-from .settings-window,
.modal-leave-to .settings-window {
  transform: scale(0.95);
  opacity: 0;
}

/* 子面板共享样式（子组件根为 .settings-panel） */
.settings-content :deep(.settings-panel) {
  animation: tabFadeIn 0.15s ease;
}

@keyframes tabFadeIn {
  from {
    opacity: 0;
    transform: translateY(4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.settings-content :deep(.settings-panel .section-title) {
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 24px;
}

.settings-content :deep(.settings-panel .setting-group) {
  margin-bottom: 24px;
}

.settings-content :deep(.settings-panel .setting-label) {
  margin-bottom: 12px;
}

.settings-content :deep(.settings-panel .label-text) {
  display: block;
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary);
  margin-bottom: 2px;
}

.settings-content :deep(.settings-panel .label-desc) {
  display: block;
  font-size: 12px;
  color: var(--text-tertiary);
}

.settings-content :deep(.settings-panel .language-list) {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.settings-content :deep(.settings-panel .language-option) {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: transparent;
  cursor: pointer;
  transition: all 0.12s ease;
  text-align: left;
  font-family: inherit;
}

.settings-content :deep(.settings-panel .language-option:hover) {
  border-color: var(--border-strong);
  background: var(--bg-hover);
}

.settings-content :deep(.settings-panel .language-option.selected) {
  border-color: var(--accent-color);
  background: var(--accent-shadow);
}

.settings-content :deep(.settings-panel .lang-name) {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary);
}

.settings-content :deep(.settings-panel .lang-desc) {
  font-size: 12px;
  color: var(--text-tertiary);
  flex: 1;
}

.settings-content :deep(.settings-panel .check-icon) {
  color: var(--accent-color);
  flex-shrink: 0;
  margin-left: auto;
}

.settings-content :deep(.settings-panel .theme-grid) {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}

.settings-content :deep(.settings-panel .theme-card) {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 16px 8px;
  border: 2px solid var(--border-color);
  border-radius: 10px;
  background: transparent;
  cursor: pointer;
  transition: all 0.15s ease;
  font-family: inherit;
}

.settings-content :deep(.settings-panel .theme-card:hover) {
  border-color: var(--border-strong);
  background: var(--bg-hover);
}

.settings-content :deep(.settings-panel .theme-card.selected) {
  border-color: var(--accent-color);
  background: var(--accent-shadow);
}

.settings-content :deep(.settings-panel .theme-icon) {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-secondary);
}

.settings-content :deep(.settings-panel .theme-card.selected .theme-icon) {
  color: var(--accent-color);
}

.settings-content :deep(.settings-panel .theme-name) {
  font-size: 12px;
  font-weight: 500;
  color: var(--text-primary);
}

.settings-content :deep(.settings-panel .setting-row) {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.settings-content :deep(.settings-panel .save-format-default) {
  margin-top: 14px;
  padding-top: 14px;
  border-top: 1px solid var(--border-color);
}

.settings-content :deep(.settings-panel .save-format-default__label) {
  display: block;
  font-size: 12px;
  font-weight: 500;
  color: var(--text-secondary);
  margin-bottom: 8px;
}

.settings-content :deep(.settings-panel .save-format-default__options) {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.settings-content :deep(.settings-panel .format-pill) {
  padding: 8px 14px;
  border-radius: 8px;
  border: 1px solid var(--border-color);
  background: var(--bg-sidebar);
  color: var(--text-secondary);
  font-size: 12px;
  font-family: inherit;
  cursor: pointer;
  transition: all 0.12s ease;
}

.settings-content :deep(.settings-panel .format-pill:hover) {
  border-color: var(--border-strong);
  color: var(--text-primary);
}

.settings-content :deep(.settings-panel .format-pill.selected) {
  border-color: var(--accent-color);
  background: var(--accent-shadow);
  color: var(--text-primary);
  font-weight: 500;
}

.settings-content :deep(.settings-panel .save-format-default__hint) {
  margin: 10px 0 0;
  font-size: 11px;
  line-height: 1.45;
  color: var(--text-tertiary);
}
</style>
