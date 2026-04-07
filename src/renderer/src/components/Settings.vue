<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  Check,
  ChevronDown,
  Code,
  Download,
  Info,
  Monitor,
  Moon,
  Palette,
  Settings,
  Sun,
  X,
} from '@/components/icons'

const props = defineProps<{
  visible: boolean
  currentLocale: string
  currentTheme: string
  autoSave: boolean
  codeTheme: string
}>()

const emit = defineEmits<{
  close: []
  changeLocale: [locale: string]
  changeTheme: [theme: string]
  changeAutoSave: [enabled: boolean]
  changeCodeTheme: [theme: string]
  checkUpdate: []
}>()

const { t } = useI18n()

const activeTab = ref<'general' | 'appearance' | 'editor' | 'about'>('general')

const selectedLocale = ref(props.currentLocale)
const selectedTheme = ref(props.currentTheme)
const selectedAutoSave = ref(props.autoSave)
const selectedCodeTheme = ref(props.codeTheme)
const appVersion = ref('')
const updateUrlInput = ref('')

const dropdownRef = ref<HTMLElement>()
const dropdownOpen = ref(false)

watch(() => props.currentLocale, (v) => { selectedLocale.value = v })
watch(() => props.currentTheme, (v) => { selectedTheme.value = v })
watch(() => props.autoSave, (v) => { selectedAutoSave.value = v })
watch(() => props.codeTheme, (v) => { selectedCodeTheme.value = v })

const codeThemes = [
  { code: 'intellij', label: 'IntelliJ IDEA' },
  { code: 'github', label: 'GitHub' },
  { code: 'one-dark', label: 'One Dark' },
  { code: 'monokai', label: 'Monokai' },
  { code: 'dracula', label: 'Dracula' },
  { code: 'solarized-light', label: 'Solarized Light' },
  { code: 'nord', label: 'Nord' },
  { code: 'night-owl', label: 'Night Owl' }
]

const selectedThemeLabel = computed(() => {
  return codeThemes.find(t => t.code === selectedCodeTheme.value)?.label || selectedCodeTheme.value
})

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

function onCodeThemeChange(code: string) {
  selectedCodeTheme.value = code
  emit('changeCodeTheme', code)
}

function toggleDropdown() {
  dropdownOpen.value = !dropdownOpen.value
}

function selectCodeTheme(code: string) {
  dropdownOpen.value = false
  onCodeThemeChange(code)
}

function handleClickOutside(e: MouseEvent) {
  if (dropdownRef.value && !dropdownRef.value.contains(e.target as Node)) {
    dropdownOpen.value = false
  }
}

watch(dropdownOpen, (open) => {
  if (open) {
    setTimeout(() => document.addEventListener('click', handleClickOutside), 0)
  } else {
    document.removeEventListener('click', handleClickOutside)
  }
})

onMounted(async () => {
  appVersion.value = await window.electron.updateGetVersion()
  const settings = await window.electron.getSettings()
  updateUrlInput.value = settings.updateUrl || ''
})

watch(() => props.visible, async (v) => {
  if (v) {
    const settings = await window.electron.getSettings()
    updateUrlInput.value = settings.updateUrl || ''
  } else {
    dropdownOpen.value = false
  }
})

async function saveUpdateUrl() {
  await window.electron.setSettings({ updateUrl: updateUrlInput.value.trim() })
}

function onCheckUpdate() {
  emit('checkUpdate')
  emit('close')
}

onBeforeUnmount(() => {
  document.removeEventListener('click', handleClickOutside)
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
              class="nav-item"
              :class="{ active: activeTab === 'general' }"
              @click="activeTab = 'general'"
            >
              <Settings :size="16" :stroke-width="1.3" />
              {{ t('settings.general') }}
            </button>
            <button
              class="nav-item"
              :class="{ active: activeTab === 'appearance' }"
              @click="activeTab = 'appearance'"
            >
              <Palette :size="16" :stroke-width="1.3" />
              {{ t('settings.appearance') }}
            </button>
            <button
              class="nav-item"
              :class="{ active: activeTab === 'editor' }"
              @click="activeTab = 'editor'"
            >
              <Code :size="16" :stroke-width="1.3" />
              {{ t('settings.editor') }}
            </button>
            <button
              class="nav-item"
              :class="{ active: activeTab === 'about' }"
              @click="activeTab = 'about'"
            >
              <Info :size="16" :stroke-width="1.3" />
              {{ t('settings.about') }}
            </button>
          </nav>

          <div class="settings-content">
            <button class="close-btn" @click="emit('close')">
              <X :size="14" :stroke-width="1.5" />
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
                    <Check
                      v-if="selectedLocale === lang.code"
                      class="check-icon"
                      :size="16"
                      :stroke-width="2.5"
                    />
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
                      <Monitor
                        v-if="th.code === 'system'"
                        :size="24"
                        :stroke-width="1.5"
                      />
                      <Sun
                        v-else-if="th.code === 'light'"
                        :size="24"
                        :stroke-width="1.5"
                      />
                      <Moon v-else :size="24" :stroke-width="1.5" />
                    </span>
                    <span class="theme-name">{{ t(`settings.theme${th.code.charAt(0).toUpperCase() + th.code.slice(1)}`) }}</span>
                  </button>
                </div>
              </div>
            </div>

            <div v-if="activeTab === 'editor'" class="tab-content">
              <h2 class="section-title">{{ t('settings.editor') }}</h2>

              <div class="setting-group">
                <div class="setting-label">
                  <span class="label-text">{{ t('settings.codeTheme') }}</span>
                  <span class="label-desc">{{ t('settings.codeThemeDesc') }}</span>
                </div>

                <div ref="dropdownRef" class="code-theme-select-wrapper">
                  <button class="code-theme-trigger" @click="toggleDropdown">
                    <span class="trigger-label">{{ selectedThemeLabel }}</span>
                    <ChevronDown
                      :size="14"
                      :stroke-width="2"
                      class="trigger-chevron"
                      :class="{ open: dropdownOpen }"
                    />
                  </button>
                  <Transition name="dropdown">
                    <div v-if="dropdownOpen" class="code-theme-dropdown">
                      <button
                        v-for="ct in codeThemes"
                        :key="ct.code"
                        class="code-theme-option"
                        :class="{ selected: selectedCodeTheme === ct.code }"
                        @click="selectCodeTheme(ct.code)"
                      >
                        <span>{{ ct.label }}</span>
                        <Check
                          v-if="selectedCodeTheme === ct.code"
                          :size="14"
                          :stroke-width="2.5"
                          class="option-check"
                        />
                      </button>
                    </div>
                  </Transition>
                </div>

                <div class="code-preview-area" :data-preview-theme="selectedCodeTheme">
                  <pre class="code-preview-pre"><span class="preview-comment">// Fibonacci sequence generator</span>
<span class="preview-keyword">function</span> <span class="preview-fn">fibonacci</span>(n) {
  <span class="preview-keyword">const</span> result = [<span class="preview-number">0</span>, <span class="preview-number">1</span>]
  <span class="preview-keyword">for</span> (<span class="preview-keyword">let</span> i = <span class="preview-number">2</span>; i &lt; n; i++) {
    result.<span class="preview-fn">push</span>(result[i - <span class="preview-number">1</span>] + result[i - <span class="preview-number">2</span>])
  }
  <span class="preview-keyword">return</span> result
}

<span class="preview-builtin">console</span>.<span class="preview-fn">log</span>(<span class="preview-string">"Result:"</span>, <span class="preview-fn">fibonacci</span>(<span class="preview-number">10</span>))</pre>
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
                  <Download :size="16" :stroke-width="2" />
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

/* ── Code Theme Dropdown ── */
.code-theme-select-wrapper {
  position: relative;
}

.code-theme-trigger {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  height: 36px;
  padding: 0 12px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: transparent;
  color: var(--text-primary);
  font-size: 13px;
  font-weight: 500;
  font-family: inherit;
  cursor: pointer;
  transition: border-color 0.15s;
}

.code-theme-trigger:hover {
  border-color: var(--border-strong);
}

.code-theme-trigger:focus {
  border-color: var(--accent-color);
  outline: none;
}

.trigger-chevron {
  color: var(--text-tertiary);
  transition: transform 0.2s ease;
  flex-shrink: 0;
}

.trigger-chevron.open {
  transform: rotate(180deg);
}

.code-theme-dropdown {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  background: var(--bg-editor);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
  z-index: 10;
  padding: 4px;
  max-height: 240px;
  overflow-y: auto;
}

.code-theme-option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 8px 10px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--text-primary);
  font-size: 13px;
  font-family: inherit;
  cursor: pointer;
  transition: background 0.1s ease;
  text-align: left;
}

.code-theme-option:hover {
  background: var(--bg-hover);
}

.code-theme-option.selected {
  background: var(--accent-shadow);
  color: var(--accent-color);
  font-weight: 500;
}

.option-check {
  color: var(--accent-color);
  flex-shrink: 0;
}

.dropdown-enter-active {
  transition: opacity 0.12s ease, transform 0.12s ease;
}

.dropdown-leave-active {
  transition: opacity 0.08s ease, transform 0.08s ease;
}

.dropdown-enter-from,
.dropdown-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

/* ── Code Preview Area ── */
.code-preview-area {
  margin-top: 12px;
  border-radius: 8px;
  border: 1px solid var(--border-color);
  overflow: hidden;
}

.code-preview-pre {
  margin: 0;
  padding: 16px 20px;
  font-family: ui-monospace, 'SFMono-Regular', Menlo, Monaco, Consolas, monospace;
  font-size: 12.5px;
  line-height: 1.65;
  background: var(--preview-bg, var(--bg-sidebar));
  color: var(--preview-text, var(--text-primary));
  overflow-x: auto;
}

.preview-comment {
  font-style: italic;
}

/* ── Preview theme: IntelliJ IDEA ── */
[data-preview-theme='intellij'] { --preview-bg: #ffffff; --preview-text: #080808; }
[data-preview-theme='intellij'] .preview-keyword { color: #0033B3; font-weight: 700; }
[data-preview-theme='intellij'] .preview-fn { color: #00627A; }
[data-preview-theme='intellij'] .preview-string { color: #067D17; }
[data-preview-theme='intellij'] .preview-comment { color: #8C8C8C; }
[data-preview-theme='intellij'] .preview-number { color: #1750EB; }
[data-preview-theme='intellij'] .preview-builtin { color: #871094; }

/* ── Preview theme: GitHub ── */
[data-preview-theme='github'] { --preview-bg: #f6f8fa; --preview-text: #24292e; }
[data-preview-theme='github'] .preview-keyword { color: #d73a49; }
[data-preview-theme='github'] .preview-fn { color: #6f42c1; }
[data-preview-theme='github'] .preview-string { color: #032f62; }
[data-preview-theme='github'] .preview-comment { color: #6a737d; }
[data-preview-theme='github'] .preview-number { color: #005cc5; }
[data-preview-theme='github'] .preview-builtin { color: #e36209; }

/* ── Preview theme: One Dark ── */
[data-preview-theme='one-dark'] { --preview-bg: #282c34; --preview-text: #abb2bf; }
[data-preview-theme='one-dark'] .preview-keyword { color: #c678dd; }
[data-preview-theme='one-dark'] .preview-fn { color: #61afef; }
[data-preview-theme='one-dark'] .preview-string { color: #98c379; }
[data-preview-theme='one-dark'] .preview-comment { color: #5c6370; }
[data-preview-theme='one-dark'] .preview-number { color: #d19a66; }
[data-preview-theme='one-dark'] .preview-builtin { color: #e6c07b; }

/* ── Preview theme: Monokai ── */
[data-preview-theme='monokai'] { --preview-bg: #272822; --preview-text: #f8f8f2; }
[data-preview-theme='monokai'] .preview-keyword { color: #f92672; }
[data-preview-theme='monokai'] .preview-fn { color: #a6e22e; }
[data-preview-theme='monokai'] .preview-string { color: #e6db74; }
[data-preview-theme='monokai'] .preview-comment { color: #75715e; }
[data-preview-theme='monokai'] .preview-number { color: #ae81ff; }
[data-preview-theme='monokai'] .preview-builtin { color: #66d9ef; }

/* ── Preview theme: Dracula ── */
[data-preview-theme='dracula'] { --preview-bg: #282a36; --preview-text: #f8f8f2; }
[data-preview-theme='dracula'] .preview-keyword { color: #ff79c6; }
[data-preview-theme='dracula'] .preview-fn { color: #50fa7b; }
[data-preview-theme='dracula'] .preview-string { color: #f1fa8c; }
[data-preview-theme='dracula'] .preview-comment { color: #6272a4; }
[data-preview-theme='dracula'] .preview-number { color: #bd93f9; }
[data-preview-theme='dracula'] .preview-builtin { color: #8be9fd; }

/* ── Preview theme: Solarized Light ── */
[data-preview-theme='solarized-light'] { --preview-bg: #fdf6e3; --preview-text: #657b83; }
[data-preview-theme='solarized-light'] .preview-keyword { color: #859900; }
[data-preview-theme='solarized-light'] .preview-fn { color: #268bd2; }
[data-preview-theme='solarized-light'] .preview-string { color: #2aa198; }
[data-preview-theme='solarized-light'] .preview-comment { color: #93a1a1; }
[data-preview-theme='solarized-light'] .preview-number { color: #d33682; }
[data-preview-theme='solarized-light'] .preview-builtin { color: #b58900; }

/* ── Preview theme: Nord ── */
[data-preview-theme='nord'] { --preview-bg: #2e3440; --preview-text: #d8dee9; }
[data-preview-theme='nord'] .preview-keyword { color: #81a1c1; }
[data-preview-theme='nord'] .preview-fn { color: #8fbcbb; }
[data-preview-theme='nord'] .preview-string { color: #a3be8c; }
[data-preview-theme='nord'] .preview-comment { color: #616e88; }
[data-preview-theme='nord'] .preview-number { color: #b48ead; }
[data-preview-theme='nord'] .preview-builtin { color: #d08770; }

/* ── Preview theme: Night Owl ── */
[data-preview-theme='night-owl'] { --preview-bg: #011627; --preview-text: #d6deeb; }
[data-preview-theme='night-owl'] .preview-keyword { color: #c792ea; }
[data-preview-theme='night-owl'] .preview-fn { color: #82aaff; }
[data-preview-theme='night-owl'] .preview-string { color: #ecc48d; }
[data-preview-theme='night-owl'] .preview-comment { color: #637777; }
[data-preview-theme='night-owl'] .preview-number { color: #f78c6c; }
[data-preview-theme='night-owl'] .preview-builtin { color: #addb67; }

/* Dark mode overrides for light-oriented themes */
:global([data-theme='dark']) [data-preview-theme='intellij'] { --preview-bg: #2b2b2b; --preview-text: #a9b7c6; }
:global([data-theme='dark']) [data-preview-theme='intellij'] .preview-keyword { color: #cc7832; font-weight: 700; }
:global([data-theme='dark']) [data-preview-theme='intellij'] .preview-fn { color: #ffc66d; }
:global([data-theme='dark']) [data-preview-theme='intellij'] .preview-string { color: #6a8759; }
:global([data-theme='dark']) [data-preview-theme='intellij'] .preview-comment { color: #808080; }
:global([data-theme='dark']) [data-preview-theme='intellij'] .preview-number { color: #6897bb; }
:global([data-theme='dark']) [data-preview-theme='intellij'] .preview-builtin { color: #a9b7c6; }

:global([data-theme='dark']) [data-preview-theme='github'] { --preview-bg: #0d1117; --preview-text: #c9d1d9; }
:global([data-theme='dark']) [data-preview-theme='github'] .preview-keyword { color: #ff7b72; }
:global([data-theme='dark']) [data-preview-theme='github'] .preview-fn { color: #d2a8ff; }
:global([data-theme='dark']) [data-preview-theme='github'] .preview-string { color: #a5d6ff; }
:global([data-theme='dark']) [data-preview-theme='github'] .preview-comment { color: #8b949e; }
:global([data-theme='dark']) [data-preview-theme='github'] .preview-number { color: #79c0ff; }
:global([data-theme='dark']) [data-preview-theme='github'] .preview-builtin { color: #ffa657; }

:global([data-theme='dark']) [data-preview-theme='solarized-light'] { --preview-bg: #002b36; --preview-text: #839496; }
:global([data-theme='dark']) [data-preview-theme='solarized-light'] .preview-keyword { color: #859900; }
:global([data-theme='dark']) [data-preview-theme='solarized-light'] .preview-fn { color: #268bd2; }
:global([data-theme='dark']) [data-preview-theme='solarized-light'] .preview-string { color: #2aa198; }
:global([data-theme='dark']) [data-preview-theme='solarized-light'] .preview-comment { color: #586e75; }
:global([data-theme='dark']) [data-preview-theme='solarized-light'] .preview-number { color: #d33682; }
:global([data-theme='dark']) [data-preview-theme='solarized-light'] .preview-builtin { color: #b58900; }
</style>
