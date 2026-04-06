<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import ZqDialog from './ZqDialog.vue'
import ZqButton from './ZqButton.vue'
import { ZqFormItem, ZqInput, ZqDirPicker } from './form'

export interface InputDialogField {
  key: string
  label: string
  placeholder?: string
  defaultValue?: string
  type?: 'text' | 'directory'
  required?: boolean
}

export interface InputDialogResult {
  [key: string]: string
}

const props = defineProps<{
  visible: boolean
  title: string
  fields: InputDialogField[]
}>()

const emit = defineEmits<{
  confirm: [result: InputDialogResult]
  cancel: []
}>()

const { t } = useI18n()
const values = ref<Record<string, string>>({})
const errors = ref<Record<string, boolean>>({})
const firstInputRef = ref<HTMLInputElement>()

watch(() => props.visible, (val) => {
  if (val) {
    const v: Record<string, string> = {}
    const e: Record<string, boolean> = {}
    for (const f of props.fields) {
      v[f.key] = f.defaultValue || ''
      e[f.key] = false
    }
    values.value = v
    errors.value = e
    nextTick(() => {
      firstInputRef.value?.focus()
      firstInputRef.value?.select()
    })
  }
})

function validate(): boolean {
  let valid = true
  for (const f of props.fields) {
    if (f.required && !values.value[f.key]?.trim()) {
      errors.value[f.key] = true
      valid = false
    } else {
      errors.value[f.key] = false
    }
  }
  return valid
}

function onValueChange(key: string, val: string) {
  values.value[key] = val
  errors.value[key] = false
}

function onConfirm() {
  if (!validate()) return
  emit('confirm', { ...values.value })
}

function onCancel() {
  emit('cancel')
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter') onConfirm()
}
</script>

<template>
  <ZqDialog :visible="visible" :title="title" @close="onCancel">
    <template #default>
      <div class="input-dialog-form" @keydown="onKeydown">
        <ZqFormItem
          v-for="(field, idx) in fields"
          :key="field.key"
          :label="field.label"
          :required="field.required"
        >
          <ZqDirPicker
            v-if="field.type === 'directory'"
            :model-value="values[field.key] || ''"
            :placeholder="field.placeholder"
            :error="errors[field.key]"
            @update:model-value="onValueChange(field.key, $event)"
          />
          <ZqInput
            v-else
            :ref="(el: any) => { if (idx === 0 && el?.$el) firstInputRef = el.$el }"
            :model-value="values[field.key] || ''"
            :placeholder="field.placeholder"
            :error="errors[field.key]"
            @update:model-value="onValueChange(field.key, $event)"
          />
        </ZqFormItem>
      </div>
    </template>
    <template #footer>
      <ZqButton @click="onCancel">{{ t('dialog.cancel') }}</ZqButton>
      <ZqButton variant="primary" @click="onConfirm">{{ t('dialog.confirm') }}</ZqButton>
    </template>
  </ZqDialog>
</template>

<style scoped>
.input-dialog-form {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
</style>
