<script setup lang="ts">
import { ref, watch, nextTick, onBeforeUnmount } from 'vue'
import { useI18n } from 'vue-i18n'
import type { Editor } from '@tiptap/vue-3'
import { ListTree } from '@/components/icons'

const props = defineProps<{
  editor?: Editor
  scrollContainer?: HTMLElement
}>()

const { t } = useI18n()
const activeId = ref('')

interface HeadingItem {
  level: number
  text: string
  id: string
  pos: number
}

const headings = ref<HeadingItem[]>([])
let headingCounter = 0

function getHeadingDom(item: HeadingItem): HTMLElement | null {
  const editor = props.editor
  if (!editor) return null
  try {
    // nodeDOM returns the actual DOM element for the node at `pos`
    const dom = editor.view.nodeDOM(item.pos)
    if (dom instanceof HTMLElement) return dom
    return null
  } catch {
    return null
  }
}

function extractHeadings() {
  const editor = props.editor
  if (!editor) {
    headings.value = []
    return
  }

  headingCounter = 0
  const items: HeadingItem[] = []

  editor.state.doc.descendants((node, pos) => {
    if (node.type.name === 'heading') {
      const id = `toc-h-${headingCounter++}`
      items.push({ level: node.attrs.level as number, text: node.textContent, id, pos })
    }
  })
  headings.value = items
}

let isScrollingToHeading = false
let scrollingTimer: ReturnType<typeof setTimeout> | null = null

function scrollToHeading(item: HeadingItem) {
  const editor = props.editor
  const container = props.scrollContainer
  if (!editor || !container) return

  const el = getHeadingDom(item)
  if (!el) return

  isScrollingToHeading = true
  activeId.value = item.id

  // Calculate scroll position so the heading sits near the top with some padding
  const containerRect = container.getBoundingClientRect()
  const elRect = el.getBoundingClientRect()
  const offsetInContainer = elRect.top - containerRect.top + container.scrollTop
  const targetScroll = offsetInContainer - 60

  container.scrollTo({ top: Math.max(0, targetScroll), behavior: 'smooth' })

  // Use requestAnimationFrame to set selection after scroll starts,
  // and suppress ProseMirror's own scrollIntoView
  requestAnimationFrame(() => {
    try {
      editor.chain().setTextSelection(item.pos + 1).run()
      // Override any ProseMirror scroll correction
      container.scrollTo({ top: Math.max(0, targetScroll), behavior: 'smooth' })
    } catch { /* ignore */ }
  })

  if (scrollingTimer) clearTimeout(scrollingTimer)
  scrollingTimer = setTimeout(() => {
    isScrollingToHeading = false
  }, 600)
}

function updateActiveHeading() {
  if (isScrollingToHeading) return

  const container = props.scrollContainer
  if (!container || headings.value.length === 0) return

  const containerRect = container.getBoundingClientRect()
  const threshold = containerRect.top + 80

  let lastAbove = ''
  for (const item of headings.value) {
    const el = getHeadingDom(item)
    if (!el) continue
    const rect = el.getBoundingClientRect()
    if (rect.top <= threshold) {
      lastAbove = item.id
    }
  }

  const newId = lastAbove || headings.value[0]?.id || ''
  if (newId !== activeId.value) {
    activeId.value = newId
    nextTick(scrollActiveIntoView)
  }
}

function scrollActiveIntoView() {
  const activeEl = document.querySelector('.outline-item.active') as HTMLElement
  if (activeEl) {
    activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }
}

let editorUpdateHandler: (() => void) | null = null
let updateTimer: ReturnType<typeof setTimeout> | null = null

function debouncedExtract() {
  if (updateTimer) clearTimeout(updateTimer)
  updateTimer = setTimeout(() => {
    extractHeadings()
    nextTick(updateActiveHeading)
  }, 200)
}

watch(() => props.editor, (editor, oldEditor) => {
  if (oldEditor && editorUpdateHandler) {
    oldEditor.off('update', editorUpdateHandler)
  }
  if (editor) {
    extractHeadings()
    nextTick(updateActiveHeading)
    editorUpdateHandler = debouncedExtract
    editor.on('update', editorUpdateHandler)
  }
}, { immediate: true })

let scrollHandler: (() => void) | null = null
let scrollRaf = 0

watch(() => props.scrollContainer, (container, oldContainer) => {
  if (oldContainer && scrollHandler) {
    oldContainer.removeEventListener('scroll', scrollHandler)
  }
  if (container) {
    scrollHandler = () => {
      cancelAnimationFrame(scrollRaf)
      scrollRaf = requestAnimationFrame(updateActiveHeading)
    }
    container.addEventListener('scroll', scrollHandler, { passive: true })
    nextTick(updateActiveHeading)
  }
}, { immediate: true })

onBeforeUnmount(() => {
  if (props.editor && editorUpdateHandler) {
    props.editor.off('update', editorUpdateHandler)
  }
  if (props.scrollContainer && scrollHandler) {
    props.scrollContainer.removeEventListener('scroll', scrollHandler)
  }
  cancelAnimationFrame(scrollRaf)
  if (updateTimer) clearTimeout(updateTimer)
  if (scrollingTimer) clearTimeout(scrollingTimer)
})
</script>

<template>
  <div class="outline-panel">
    <div v-if="headings.length === 0" class="outline-empty">
      <div class="outline-empty__inner">
        <div class="outline-empty__icon-wrap" aria-hidden="true">
          <ListTree class="outline-empty__icon" :size="40" :stroke-width="1.35" />
        </div>
        <p class="outline-empty__text">{{ t('sidebar.noHeadings') }}</p>
      </div>
    </div>
    <nav v-else class="outline-list">
      <button
        v-for="heading in headings"
        :key="heading.id"
        class="outline-item"
        :class="[
          `level-${heading.level}`,
          { active: heading.id === activeId }
        ]"
        :title="heading.text"
        @click="scrollToHeading(heading)"
      >
        <span class="outline-indicator" />
        <span class="outline-text">{{ heading.text }}</span>
      </button>
    </nav>
  </div>
</template>

<style scoped>
.outline-panel {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding: 4px 0;
}

.outline-list::-webkit-scrollbar {
  width: 5px;
}

.outline-list::-webkit-scrollbar-track {
  background: transparent;
}

.outline-list::-webkit-scrollbar-thumb {
  background: transparent;
  border-radius: 3px;
  transition: background 0.2s;
}

.outline-list:hover::-webkit-scrollbar-thumb {
  background: var(--scrollbar-thumb);
}

.outline-empty {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px 16px;
  min-height: 140px;
}

.outline-empty__inner {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 14px;
  max-width: 220px;
  transform: translateY(-58px);
}

.outline-empty__icon-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 72px;
  height: 72px;
  border-radius: 18px;
  background: var(--bg-hover);
  /* border: 1px solid var(--border-color); */
  color: var(--text-tertiary);
  box-shadow: none;
}

.outline-empty__icon {
  flex-shrink: 0;
  opacity: 0.85;
}

.outline-empty__text {
  margin: 0;
  font-size: 12px;
  color: var(--text-tertiary);
  text-align: center;
  line-height: 1.65;
  white-space: pre-line;
}

.outline-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  display: flex;
  flex-direction: column;
  margin: 0 20px;
}

.outline-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 5px 16px;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  font-size: 13px;
  line-height: 1.4;
  text-align: left;
  cursor: pointer;
  transition: all 0.12s ease;
  position: relative;
  border-radius: 8px;
}

.outline-item:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.outline-item:active {
  background: var(--bg-active);
}

.outline-item.active {
  color: var(--accent-color);
  background: var(--bg-hover);
}

.outline-item.active::before {
  content: '';
  position: absolute;
  left: 1px;
  top: 6px;
  bottom: 6px;
  width: 2px;
  background: var(--accent-color);
  border-radius: 1px;
}

.outline-item.active .outline-indicator {
  background: var(--accent-color) !important;
  opacity: 1 !important;
  transform: scale(1.3);
}

.outline-indicator {
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: var(--text-tertiary);
  flex-shrink: 0;
  opacity: 0.6;
  transition: all 0.15s ease;
}

.outline-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.outline-item.level-1 { padding-left: 16px; font-weight: 600; font-size: 13px; }
.outline-item.level-2 { padding-left: 28px; font-weight: 500; font-size: 13px; }
.outline-item.level-3 { padding-left: 40px; font-size: 12px; }
.outline-item.level-4 { padding-left: 52px; font-size: 12px; }
.outline-item.level-5 { padding-left: 64px; font-size: 12px; }
.outline-item.level-6 { padding-left: 76px; font-size: 12px; }

.outline-item.level-1 .outline-indicator { background: var(--accent-color); opacity: 1; width: 5px; height: 5px; }
.outline-item.level-2 .outline-indicator { background: var(--accent-color); opacity: 0.6; }
</style>
