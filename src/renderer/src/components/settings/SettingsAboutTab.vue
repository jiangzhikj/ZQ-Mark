<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Download } from '@/components/icons'

const props = defineProps<{
  visible: boolean
}>()

const emit = defineEmits<{
  checkUpdate: []
}>()

const { t } = useI18n()

const appVersion = ref('')
const updateUrlInput = ref('')

async function loadAboutData() {
  appVersion.value = await window.electron.updateGetVersion()
  const settings = await window.electron.getSettings()
  updateUrlInput.value = settings.updateUrl || ''
}

onMounted(() => {
  loadAboutData()
})

watch(
  () => props.visible,
  (v) => {
    if (v) {
      loadAboutData()
    }
  },
)

async function saveUpdateUrl() {
  await window.electron.setSettings({ updateUrl: updateUrlInput.value.trim() })
}

function onCheckUpdate() {
  emit('checkUpdate')
}
</script>

<template>
  <div class="settings-panel">
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
      <button type="button" class="check-update-btn" @click="onCheckUpdate">
        <Download :size="16" :stroke-width="2" />
        {{ t('update.checkUpdate') }}
      </button>
    </div>
  </div>
</template>

<style scoped>
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
