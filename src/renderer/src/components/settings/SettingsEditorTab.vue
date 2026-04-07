<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import CodeThemeSelect from './CodeThemeSelect.vue'

defineProps<{
  codeTheme: string
}>()

const emit = defineEmits<{
  'update:codeTheme': [value: string]
}>()

const { t } = useI18n()

function onCodeThemeInput(v: string) {
  emit('update:codeTheme', v)
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
  </div>
</template>
