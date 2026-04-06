<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'

const content = defineModel<string>({ required: true })

const props = defineProps<{
  registerTextarea?: (el: HTMLTextAreaElement) => void
}>()

const { t } = useI18n()
const textareaRef = ref<HTMLTextAreaElement>()

onMounted(() => {
  if (textareaRef.value && props.registerTextarea) {
    props.registerTextarea(textareaRef.value)
  }
})

function scrollToLine(line: number) {
  if (!textareaRef.value) return
  const lines = content.value.split('\n')
  let charIndex = 0
  for (let i = 0; i < line && i < lines.length; i++) {
    charIndex += lines[i].length + 1
  }
  textareaRef.value.focus()
  textareaRef.value.setSelectionRange(charIndex, charIndex)

  const lineHeight = parseFloat(getComputedStyle(textareaRef.value).lineHeight)
  const scrollTop = line * lineHeight - textareaRef.value.clientHeight / 3
  textareaRef.value.scrollTop = Math.max(0, scrollTop)
}

function handleTab(e: KeyboardEvent) {
  const textarea = e.target as HTMLTextAreaElement
  const start = textarea.selectionStart
  const end = textarea.selectionEnd
  content.value = content.value.substring(0, start) + '  ' + content.value.substring(end)
  requestAnimationFrame(() => {
    textarea.selectionStart = textarea.selectionEnd = start + 2
  })
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Tab') {
    e.preventDefault()
    handleTab(e)
  }
}

defineExpose({ scrollToLine })
</script>

<template>
  <div class="editor-container">
    <textarea
      ref="textareaRef"
      v-model="content"
      class="editor-textarea"
      :placeholder="t('editor.placeholder')"
      spellcheck="false"
      @keydown="onKeydown"
    />
  </div>
</template>

<style scoped>
.editor-container {
  flex: 1;
  display: flex;
  overflow: hidden;
  min-width: 0;
}

.editor-textarea {
  flex: 1;
  padding: 24px 48px;
  border: none;
  outline: none;
  resize: none;
  background: var(--bg-editor);
  color: var(--text-primary);
  font-family: 'SF Mono', 'Fira Code', 'Cascadia Code', 'JetBrains Mono', 'Menlo', monospace;
  font-size: 14.5px;
  line-height: 1.8;
  tab-size: 2;
  caret-color: var(--accent-color);
}

.editor-textarea::placeholder {
  color: var(--text-placeholder);
}

.editor-textarea::-webkit-scrollbar {
  width: 7px;
}

.editor-textarea::-webkit-scrollbar-track {
  background: transparent;
}

.editor-textarea::-webkit-scrollbar-thumb {
  background: var(--scrollbar-thumb);
  border-radius: 4px;
}

.editor-textarea::-webkit-scrollbar-thumb:hover {
  background: var(--scrollbar-thumb-hover);
}
</style>
