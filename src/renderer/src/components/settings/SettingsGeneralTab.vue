<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { Check } from '@/components/icons'
import { ZqSwitch } from '@/components/ui/form'
import { SETTINGS_LANGUAGES } from './constants'

const props = defineProps<{
  selectedLocale: string
  selectedAutoSave: boolean
  telemetryEnabled: boolean
  saveFormatAskDialog: boolean
  saveFormatDefault: 'md' | 'zq'
}>()

const emit = defineEmits<{
  changeLocale: [code: string]
  changeAutoSave: [enabled: boolean]
  changeTelemetry: [enabled: boolean]
  changeSaveFormatAsk: [enabled: boolean]
  changeSaveFormatDefault: [format: 'md' | 'zq']
}>()

const { t } = useI18n()

function onLocaleChange(code: string) {
  emit('changeLocale', code)
}

function onSaveFormatDefaultPick(format: 'md' | 'zq') {
  emit('changeSaveFormatDefault', format)
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
        <ZqSwitch
          :model-value="selectedAutoSave"
          @update:model-value="emit('changeAutoSave', $event)"
        />
      </div>
    </div>

    <div class="setting-group">
      <div class="setting-row">
        <div class="setting-label">
          <span class="label-text">{{ t('settings.saveFormatAsk') }}</span>
          <span class="label-desc">{{ t('settings.saveFormatAskDesc') }}</span>
        </div>
        <ZqSwitch
          :model-value="saveFormatAskDialog"
          @update:model-value="emit('changeSaveFormatAsk', $event)"
        />
      </div>
      <div class="save-format-default">
        <span class="save-format-default__label">{{ t('settings.saveFormatDefaultLabel') }}</span>
        <div class="save-format-default__options" role="radiogroup" :aria-label="t('settings.saveFormatDefaultLabel')">
          <button
            type="button"
            class="format-pill"
            :class="{ selected: saveFormatDefault === 'md' }"
            role="radio"
            :aria-checked="saveFormatDefault === 'md'"
            @click="onSaveFormatDefaultPick('md')"
          >
            {{ t('settings.saveFormatMd') }}
          </button>
          <button
            type="button"
            class="format-pill"
            :class="{ selected: saveFormatDefault === 'zq' }"
            role="radio"
            :aria-checked="saveFormatDefault === 'zq'"
            @click="onSaveFormatDefaultPick('zq')"
          >
            {{ t('settings.saveFormatZq') }}
          </button>
        </div>
        <p class="save-format-default__hint">{{ t('settings.saveFormatDefaultHint') }}</p>
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
        <ZqSwitch
          :model-value="telemetryEnabled"
          @update:model-value="emit('changeTelemetry', $event)"
        />
      </div>
    </div>
    -->
  </div>
</template>
