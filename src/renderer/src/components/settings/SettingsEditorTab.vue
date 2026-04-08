<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import CodeThemeSelect from './CodeThemeSelect.vue'

defineProps<{
  codeTheme: string
  drawioUiLayout: 'full' | 'minimal'
}>()

const emit = defineEmits<{
  'update:codeTheme': [value: string]
  'update:drawioUiLayout': [value: 'full' | 'minimal']
}>()

const { t } = useI18n()

function onCodeThemeInput(v: string) {
  emit('update:codeTheme', v)
}

function onDrawioLayoutInput(v: 'full' | 'minimal') {
  emit('update:drawioUiLayout', v)
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
</style>
