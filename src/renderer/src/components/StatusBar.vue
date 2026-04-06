<script setup lang="ts">
import { useI18n } from 'vue-i18n'

defineProps<{
  characters: number
  lines: number
  words: number
  isModified: boolean
}>()

const { t } = useI18n()
</script>

<template>
  <footer class="statusbar">
    <div class="statusbar-left">
      <span :class="['save-indicator', { modified: isModified }]">
        <svg v-if="!isModified" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10" />
          <path d="m9 12 2 2 4-4" />
        </svg>
        <svg v-else width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
          <circle cx="8" cy="8" r="5" />
        </svg>
        {{ isModified ? t('status.modified') : t('status.saved') }}
      </span>
    </div>
    <div class="statusbar-right">
      <span class="stat">{{ lines }} {{ t('status.lines') }}</span>
      <span class="stat">{{ words }} {{ t('status.words') }}</span>
      <span class="stat">{{ characters }} {{ t('status.characters') }}</span>
    </div>
  </footer>
</template>

<style scoped>
.statusbar {
  height: var(--statusbar-height);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  //background: var(--bg-statusbar);
  //border-top: 1px solid var(--border-color);
  flex-shrink: 0;
  user-select: none;
}

.statusbar-left,
.statusbar-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.save-indicator {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: var(--text-tertiary);
}

.save-indicator.modified {
  color: var(--accent-color);
}

.stat {
  font-size: 11px;
  color: var(--text-tertiary);
  font-variant-numeric: tabular-nums;
}
</style>
