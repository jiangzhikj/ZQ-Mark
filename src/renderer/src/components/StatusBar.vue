<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { Circle, CircleCheck } from '@/components/icons'

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
        <CircleCheck
          v-if="!isModified"
          :size="12"
          :stroke-width="2.5"
        />
        <Circle
          v-else
          class="save-indicator__dot"
          :size="12"
          fill="currentColor"
          :stroke-width="0"
        />
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
