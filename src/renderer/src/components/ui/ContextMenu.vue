<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick } from 'vue'

export interface ContextMenuItem {
  id: string
  label: string
  icon?: string
  disabled?: boolean
  separator?: boolean
}

const props = defineProps<{
  items: ContextMenuItem[]
}>()

const emit = defineEmits<{
  select: [id: string]
}>()

const visible = ref(false)
const x = ref(0)
const y = ref(0)
const menuRef = ref<HTMLElement>()

async function show(event: MouseEvent) {
  event.preventDefault()
  event.stopPropagation()
  x.value = event.clientX
  y.value = event.clientY
  visible.value = true

  await nextTick()
  adjustPosition()
}

function adjustPosition() {
  if (!menuRef.value) return
  const rect = menuRef.value.getBoundingClientRect()
  const vw = window.innerWidth
  const vh = window.innerHeight

  if (rect.right > vw) x.value = Math.max(0, vw - rect.width - 4)
  if (rect.bottom > vh) y.value = Math.max(0, vh - rect.height - 4)
}

function hide() {
  visible.value = false
}

function onSelect(item: ContextMenuItem) {
  if (item.disabled || item.separator) return
  emit('select', item.id)
  hide()
}

function onClickOutside(e: MouseEvent) {
  if (menuRef.value && !menuRef.value.contains(e.target as Node)) {
    hide()
  }
}

onMounted(() => {
  document.addEventListener('mousedown', onClickOutside, true)
  document.addEventListener('contextmenu', onClickOutside, true)
})

onUnmounted(() => {
  document.removeEventListener('mousedown', onClickOutside, true)
  document.removeEventListener('contextmenu', onClickOutside, true)
})

defineExpose({ show, hide })
</script>

<template>
  <Teleport to="body">
    <Transition name="ctx-menu">
      <div
        v-if="visible"
        ref="menuRef"
        class="context-menu"
        :style="{ left: x + 'px', top: y + 'px' }"
      >
        <template v-for="item in items" :key="item.id">
          <div v-if="item.separator" class="context-menu-separator" />
          <div
            v-else
            class="context-menu-item"
            :class="{ disabled: item.disabled }"
            @click="onSelect(item)"
          >
            {{ item.label }}
          </div>
        </template>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.context-menu {
  position: fixed;
  z-index: 9999;
  min-width: 160px;
  padding: 4px 0;
  background: var(--bg-editor);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
  user-select: none;
}

.context-menu-item {
  padding: 6px 14px;
  font-size: 13px;
  color: var(--text-primary);
  cursor: pointer;
  transition: background-color 0.1s;
}

.context-menu-item:hover {
  background: var(--bg-hover);
}

.context-menu-item.disabled {
  color: var(--text-tertiary);
  cursor: default;
}

.context-menu-item.disabled:hover {
  background: transparent;
}

.context-menu-separator {
  height: 1px;
  margin: 4px 8px;
  background: var(--border-color);
}

.ctx-menu-enter-active {
  transition: opacity 0.1s ease, transform 0.1s ease;
}

.ctx-menu-leave-active {
  transition: opacity 0.08s ease;
}

.ctx-menu-enter-from {
  opacity: 0;
  transform: scale(0.96);
}

.ctx-menu-leave-to {
  opacity: 0;
}
</style>
