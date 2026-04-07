<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { FileArchive, FileText } from '@/components/icons'
import { ZqDialog, ZqButton } from '@/components/ui'
import { ZqCheckbox } from '@/components/ui/form'

const props = defineProps<{
  visible: boolean
}>()

const emit = defineEmits<{
  pick: [payload: { format: 'md' | 'zq'; remember: boolean }]
  cancel: []
}>()

const { t } = useI18n()
const rememberNext = ref(false)

watch(
  () => props.visible,
  (v) => {
    if (v) rememberNext.value = false
  }
)

function onPick(format: 'md' | 'zq') {
  emit('pick', { format, remember: rememberNext.value })
}

function onCancel() {
  emit('cancel')
}
</script>

<template>
  <ZqDialog :visible="visible" width="560px" @close="onCancel">
    <template #header>
      <div class="sf-header">
        <h2 class="sf-title">{{ t('dialog.saveFormatTitle') }}</h2>
        <p class="sf-subtitle">{{ t('dialog.saveFormatSubtitle') }}</p>
      </div>
    </template>

    <div class="sf-body">
      <div class="sf-cards">
        <div class="sf-card sf-card--md">
          <div class="sf-card-icon">
            <FileText :size="22" :stroke-width="1.75" />
          </div>
          <span class="sf-badge sf-badge--muted">{{ t('dialog.saveFormatMdBadge') }}</span>
          <h3 class="sf-card-title">{{ t('dialog.saveFormatMdTitle') }}</h3>
          <p class="sf-card-body">{{ t('dialog.saveFormatMdBody') }}</p>
          <div class="sf-card-actions">
            <ZqButton class="sf-card-actions__btn" @click="onPick('md')">
              {{ t('dialog.saveFormatSaveAsMd') }}
            </ZqButton>
          </div>
        </div>

        <div class="sf-card sf-card--zq">
          <div class="sf-card-icon sf-card-icon--accent">
            <FileArchive :size="22" :stroke-width="1.75" />
          </div>
          <span class="sf-badge sf-badge--accent">{{ t('dialog.saveFormatZqBadge') }}</span>
          <h3 class="sf-card-title">{{ t('dialog.saveFormatZqTitle') }}</h3>
          <p class="sf-card-body">{{ t('dialog.saveFormatZqBody') }}</p>
          <div class="sf-card-actions">
            <ZqButton variant="primary" class="sf-card-actions__btn" @click="onPick('zq')">
              {{ t('dialog.saveFormatSaveAsZq') }}
            </ZqButton>
          </div>
        </div>
      </div>

      <ZqCheckbox v-model="rememberNext" class="sf-remember">
        {{ t('dialog.saveFormatRemember') }}
      </ZqCheckbox>
      <p class="sf-hint">{{ t('dialog.saveFormatRememberHint') }}</p>
    </div>

    <template #footer>
      <ZqButton @click="onCancel">{{ t('dialog.cancel') }}</ZqButton>
    </template>
  </ZqDialog>
</template>

<style scoped>
.sf-header {
  margin: 0;
}

.sf-title {
  margin: 0 0 8px;
  font-size: 17px;
  font-weight: 600;
  color: var(--text-primary);
  letter-spacing: -0.02em;
}

.sf-subtitle {
  margin: 0;
  font-size: 13px;
  line-height: 1.55;
  color: var(--text-secondary);
}

.sf-body {
  display: flex;
  flex-direction: column;
  gap: 0;
  margin: -4px 0 0;
}

.sf-cards {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-bottom: 10px;
}

@media (max-width: 520px) {
  .sf-cards {
    grid-template-columns: 1fr;
  }
}

.sf-card {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  padding: 14px 14px 12px;
  border-radius: 10px;
  border: 1px solid var(--border-color);
  background: var(--bg-sidebar);
  min-height: 0;
}

.sf-card--zq {
  border-color: color-mix(in srgb, var(--accent-color) 28%, var(--border-color));
  background: linear-gradient(
    145deg,
    color-mix(in srgb, var(--accent-color) 9%, var(--bg-sidebar)) 0%,
    var(--bg-sidebar) 100%
  );
}

.sf-card-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 8px;
  margin-bottom: 10px;
  background: var(--bg-hover);
  color: var(--text-secondary);
}

.sf-card-icon--accent {
  background: color-mix(in srgb, var(--accent-color) 16%, var(--bg-hover));
  color: var(--accent-color);
}

.sf-badge {
  display: inline-block;
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  padding: 3px 7px;
  border-radius: 4px;
  margin-bottom: 8px;
}

.sf-badge--muted {
  background: var(--bg-hover);
  color: var(--text-tertiary);
}

.sf-badge--accent {
  background: var(--accent-shadow);
  color: var(--accent-color);
}

.sf-card-title {
  margin: 0 0 8px;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
}

.sf-card-body {
  margin: 0 0 12px;
  flex: 1;
  font-size: 12px;
  line-height: 1.55;
  color: var(--text-secondary);
}

.sf-card-actions {
  width: 100%;
  margin-top: auto;
}

.sf-card-actions__btn {
  width: 100%;
  justify-content: center;
}

.sf-remember {
  margin-top: 2px;
}

.sf-hint {
  margin: 6px 0 0 23px;
  font-size: 11px;
  line-height: 1.45;
  color: var(--text-tertiary);
}
</style>
