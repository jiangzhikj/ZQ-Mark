<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { Check } from '@/components/icons'
import { SETTINGS_LANGUAGES } from './constants'

const props = defineProps<{
  selectedLocale: string
  selectedAutoSave: boolean
  telemetryEnabled: boolean
}>()

const emit = defineEmits<{
  changeLocale: [code: string]
  changeAutoSave: [enabled: boolean]
  changeTelemetry: [enabled: boolean]
}>()

const { t } = useI18n()

function onLocaleChange(code: string) {
  emit('changeLocale', code)
}

function onAutoSaveToggle() {
  emit('changeAutoSave', !props.selectedAutoSave)
}

function onTelemetryToggle() {
  emit('changeTelemetry', !props.telemetryEnabled)
}
</script>

<template>
  <div class="settings-panel">
    <h2 class="section-title">{{ t('settings.general') }}</h2>

    <div class="setting-group">
      <div class="setting-label">
        <span class="label-text">{{ t('settings.language') }}</span>
        <span class="label-desc">{{ t('settings.languageDesc') }}</span>
      </div>
      <div class="language-list">
        <button
          v-for="lang in SETTINGS_LANGUAGES"
          :key="lang.code"
          type="button"
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
          type="button"
          class="toggle-switch"
          :class="{ active: selectedAutoSave }"
          @click="onAutoSaveToggle"
        >
          <span class="toggle-knob" />
        </button>
      </div>
    </div>

    <!-- 匿名使用统计：暂隐藏 UI，主进程仍按 settings.telemetryEnabled 上报 -->
    <!--
    <div class="setting-group">
      <div class="setting-row">
        <div class="setting-label">
          <span class="label-text">{{ t('settings.telemetry') }}</span>
          <span class="label-desc">{{ t('settings.telemetryDesc') }}</span>
        </div>
        <button
          type="button"
          class="toggle-switch"
          :class="{ active: telemetryEnabled }"
          @click="onTelemetryToggle"
        >
          <span class="toggle-knob" />
        </button>
      </div>
    </div>
    -->
  </div>
</template>
