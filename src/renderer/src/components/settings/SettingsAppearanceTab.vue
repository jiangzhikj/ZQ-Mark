<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { Monitor, Moon, Sun } from '@/components/icons'
import { SETTINGS_UI_THEMES } from './constants'

defineProps<{
  selectedTheme: string
}>()

const emit = defineEmits<{
  changeTheme: [code: string]
}>()

const { t } = useI18n()

function onThemeChange(code: string) {
  emit('changeTheme', code)
}
</script>

<template>
  <div class="settings-panel">
    <h2 class="section-title">{{ t('settings.appearance') }}</h2>

    <div class="setting-group">
      <div class="setting-label">
        <span class="label-text">{{ t('settings.theme') }}</span>
        <span class="label-desc">{{ t('settings.themeDesc') }}</span>
      </div>
      <div class="theme-grid">
        <button
          v-for="th in SETTINGS_UI_THEMES"
          :key="th.code"
          type="button"
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
</template>
