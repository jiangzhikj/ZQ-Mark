<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'

const props = defineProps<{
  visible: boolean
  currentLocale: string
  currentTheme: string
  autoSave: boolean
}>()

const emit = defineEmits<{
  close: []
  changeLocale: [locale: string]
  changeTheme: [theme: string]
  changeAutoSave: [enabled: boolean]
  checkUpdate: []
}>()

const { t } = useI18n()

const activeTab = ref<'general' | 'appearance' | 'about'>('general')

const selectedLocale = ref(props.currentLocale)
const selectedTheme = ref(props.currentTheme)
const selectedAutoSave = ref(props.autoSave)
const appVersion = ref('')
const updateUrlInput = ref('')

watch(() => props.currentLocale, (v) => { selectedLocale.value = v })
watch(() => props.currentTheme, (v) => { selectedTheme.value = v })
watch(() => props.autoSave, (v) => { selectedAutoSave.value = v })

const languages = [
  { code: 'system', label: '', desc: '', isSystem: true },
  { code: 'zh-CN', label: '简体中文', desc: 'Simplified Chinese', isSystem: false },
  { code: 'zh-TW', label: '繁體中文', desc: 'Traditional Chinese', isSystem: false },
  { code: 'en', label: 'English', desc: 'English', isSystem: false }
]

const themes = [
  { code: 'system' },
  { code: 'light' },
  { code: 'dark' }
]

function onLocaleChange(code: string) {
  selectedLocale.value = code
  emit('changeLocale', code)
}

function onThemeChange(code: string) {
  selectedTheme.value = code
  emit('changeTheme', code)
}

function onAutoSaveToggle() {
  selectedAutoSave.value = !selectedAutoSave.value
  emit('changeAutoSave', selectedAutoSave.value)
}

onMounted(async () => {
  appVersion.value = await window.electron.updateGetVersion()
  const settings = await window.electron.getSettings()
  updateUrlInput.value = settings.updateUrl || ''
})

watch(() => props.visible, async (v) => {
  if (v) {
    const settings = await window.electron.getSettings()
    updateUrlInput.value = settings.updateUrl || ''
  }
})

async function saveUpdateUrl() {
  await window.electron.setSettings({ updateUrl: updateUrlInput.value.trim() })
}

function onCheckUpdate() {
  emit('checkUpdate')
  emit('close')
}
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="visible" class="settings-overlay" @click.self="emit('close')">
        <div class="settings-window">
          <nav class="settings-nav">
            <div class="settings-nav-header">{{ t('settings.title') }}</div>
            <button
              class="nav-item"
              :class="{ active: activeTab === 'general' }"
              @click="activeTab = 'general'"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3">
                <circle cx="8" cy="8" r="3" />
                <path d="M8 1v2M8 13v2M1 8h2M13 8h2M2.9 2.9l1.4 1.4M11.7 11.7l1.4 1.4M13.1 2.9l-1.4 1.4M4.3 11.7l-1.4 1.4" />
              </svg>
              {{ t('settings.general') }}
            </button>
            <button
              class="nav-item"
              :class="{ active: activeTab === 'appearance' }"
              @click="activeTab = 'appearance'"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3">
                <rect x="2" y="2" width="12" height="12" rx="2" />
                <path d="M2 6h12" />
              </svg>
              {{ t('settings.appearance') }}
            </button>
            <button
              class="nav-item"
              :class="{ active: activeTab === 'about' }"
              @click="activeTab = 'about'"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3">
                <circle cx="8" cy="8" r="6" />
                <path d="M8 5v1M8 8v3" />
              </svg>
              {{ t('settings.about') }}
            </button>
          </nav>

          <div class="settings-content">
            <button class="close-btn" @click="emit('close')">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
                <path d="M3 3l8 8M11 3l-8 8" />
              </svg>
            </button>

            <div v-if="activeTab === 'general'" class="tab-content">
              <h2 class="section-title">{{ t('settings.general') }}</h2>

              <div class="setting-group">
                <div class="setting-label">
                  <span class="label-text">{{ t('settings.language') }}</span>
                  <span class="label-desc">{{ t('settings.languageDesc') }}</span>
                </div>
                <div class="language-list">
                  <button
                    v-for="lang in languages"
                    :key="lang.code"
                    class="language-option"
                    :class="{ selected: selectedLocale === lang.code }"
                    @click="onLocaleChange(lang.code)"
                  >
                    <span class="lang-name">{{ lang.isSystem ? t('settings.languageSystem') : lang.label }}</span>
                    <span v-if="!lang.isSystem" class="lang-desc">{{ lang.desc }}</span>
                    <svg v-if="selectedLocale === lang.code" class="check-icon" width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                      <path d="M6.5 11.5L3 8l1-1 2.5 2.5L12 4l1 1-6.5 6.5z" />
                    </svg>
                  </button>
                </div>
              </div>

              <div class="setting-group">
                <div class="setting-row">
                  <div class="setting-label">
                    <span class="label-text">{{ t('settings.autoSave') }}</span>
                    <span class="label-desc">{{ t('settings.autoSaveDesc') }}</span>
                  </div>
                  <button
                    class="toggle-switch"
                    :class="{ active: selectedAutoSave }"
                    @click="onAutoSaveToggle"
                  >
                    <span class="toggle-knob" />
                  </button>
                </div>
              </div>
            </div>

            <div v-if="activeTab === 'appearance'" class="tab-content">
              <h2 class="section-title">{{ t('settings.appearance') }}</h2>

              <div class="setting-group">
                <div class="setting-label">
                  <span class="label-text">{{ t('settings.theme') }}</span>
                  <span class="label-desc">{{ t('settings.themeDesc') }}</span>
                </div>
                <div class="theme-grid">
                  <button
                    v-for="th in themes"
                    :key="th.code"
                    class="theme-card"
                    :class="{ selected: selectedTheme === th.code }"
                    @click="onThemeChange(th.code)"
                  >
                    <span class="theme-icon">
                      <svg v-if="th.code === 'system'" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                        <rect x="2" y="3" width="20" height="14" rx="2" />
                        <path d="M8 21h8M12 17v4" />
                      </svg>
                      <svg v-else-if="th.code === 'light'" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                        <circle cx="12" cy="12" r="4" />
                        <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
                      </svg>
                      <svg v-else width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                      </svg>
                    </span>
                    <span class="theme-name">{{ t(`settings.theme${th.code.charAt(0).toUpperCase() + th.code.slice(1)}`) }}</span>
                  </button>
                </div>
              </div>
            </div>

            <div v-if="activeTab === 'about'" class="tab-content">
              <h2 class="section-title">{{ t('settings.about') }}</h2>

              <div class="setting-group">
                <div class="about-version">
                  <span class="about-app-name">ZQ Mark</span>
                  <span class="about-version-tag">v{{ appVersion }}</span>
                </div>
              </div>

              <div class="setting-group">
                <div class="setting-label">
                  <span class="label-text">{{ t('settings.updateUrl') }}</span>
                  <span class="label-desc">{{ t('settings.updateUrlDesc') }}</span>
                </div>
                <div class="update-url-row">
                  <input
                    v-model="updateUrlInput"
                    class="url-input"
                    type="text"
                    :placeholder="t('settings.updateUrlPlaceholder')"
                    @blur="saveUpdateUrl"
                    @keydown.enter="saveUpdateUrl"
                  />
                </div>
              </div>

              <div class="setting-group">
                <button class="check-update-btn" @click="onCheckUpdate">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                  {{ t('update.checkUpdate') }}
                </button>
              </div>
            </div>
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
  width: 560px;
  min-height: 400px;
  max-height: 500px;
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

.settings-content {
  flex: 1;
  padding: 24px;
  overflow-y: auto;
  position: relative;
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

.tab-content {
  animation: fadeIn 0.15s ease;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: translateY(0); }
}

.section-title {
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 24px;
}

.setting-group {
  margin-bottom: 24px;
}

.setting-label {
  margin-bottom: 12px;
}

.label-text {
  display: block;
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary);
  margin-bottom: 2px;
}

.label-desc {
  display: block;
  font-size: 12px;
  color: var(--text-tertiary);
}

.language-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.language-option {
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

.language-option:hover {
  border-color: var(--border-strong);
  background: var(--bg-hover);
}

.language-option.selected {
  border-color: var(--accent-color);
  background: var(--accent-shadow);
}

.lang-name {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary);
}

.lang-desc {
  font-size: 12px;
  color: var(--text-tertiary);
  flex: 1;
}

.check-icon {
  color: var(--accent-color);
  flex-shrink: 0;
  margin-left: auto;
}

.theme-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}

.theme-card {
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

.theme-card:hover {
  border-color: var(--border-strong);
  background: var(--bg-hover);
}

.theme-card.selected {
  border-color: var(--accent-color);
  background: var(--accent-shadow);
}

.theme-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-secondary);
}

.theme-card.selected .theme-icon {
  color: var(--accent-color);
}

.theme-name {
  font-size: 12px;
  font-weight: 500;
  color: var(--text-primary);
}

.setting-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.toggle-switch {
  position: relative;
  width: 40px;
  height: 22px;
  border: none;
  border-radius: 11px;
  background: var(--border-color);
  cursor: pointer;
  transition: background 0.2s ease;
  flex-shrink: 0;
  padding: 0;
}

.toggle-switch.active {
  background: var(--accent-color);
}

.toggle-knob {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: white;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
  transition: transform 0.2s ease;
}

.toggle-switch.active .toggle-knob {
  transform: translateX(18px);
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

.about-version {
  display: flex;
  align-items: center;
  gap: 10px;
}

.about-app-name {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
}

.about-version-tag {
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 10px;
  background: var(--bg-hover);
  color: var(--text-tertiary);
  font-weight: 500;
}

.update-url-row {
  display: flex;
  gap: 8px;
}

.url-input {
  flex: 1;
  height: 34px;
  padding: 0 12px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: transparent;
  color: var(--text-primary);
  font-size: 13px;
  font-family: inherit;
  outline: none;
  transition: border-color 0.15s;
}

.url-input:focus {
  border-color: var(--accent-color);
}

.url-input::placeholder {
  color: var(--text-tertiary);
}

.check-update-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 34px;
  padding: 0 20px;
  border: none;
  border-radius: 8px;
  background: var(--accent-color);
  color: #fff;
  font-size: 13px;
  font-weight: 500;
  font-family: inherit;
  cursor: pointer;
  transition: opacity 0.15s;
}

.check-update-btn:hover {
  opacity: 0.9;
}
</style>
