<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { Check, ChevronDown } from '@/components/icons'
import { CODE_THEMES } from './constants'

import '@/components/zq-editor/styles/code-themes.scss'

const props = defineProps<{
  modelValue: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const dropdownRef = ref<HTMLElement>()
const dropdownOpen = ref(false)

const selectedLabel = computed(() => {
  return CODE_THEMES.find((t) => t.code === props.modelValue)?.label || props.modelValue
})

function toggleDropdown() {
  dropdownOpen.value = !dropdownOpen.value
}

function select(code: string) {
  dropdownOpen.value = false
  emit('update:modelValue', code)
}

function handleClickOutside(e: MouseEvent) {
  if (dropdownRef.value && !dropdownRef.value.contains(e.target as Node)) {
    dropdownOpen.value = false
  }
}

watch(dropdownOpen, (open) => {
  if (open) {
    setTimeout(() => document.addEventListener('click', handleClickOutside), 0)
  } else {
    document.removeEventListener('click', handleClickOutside)
  }
})

onBeforeUnmount(() => {
  document.removeEventListener('click', handleClickOutside)
})
</script>

<template>
  <div>
    <div ref="dropdownRef" class="code-theme-select-wrapper">
      <button type="button" class="code-theme-trigger" @click="toggleDropdown">
        <span class="trigger-label">{{ selectedLabel }}</span>
        <ChevronDown
          :size="14"
          :stroke-width="2"
          class="trigger-chevron"
          :class="{ open: dropdownOpen }"
        />
      </button>
      <Transition name="dropdown">
        <div v-if="dropdownOpen" class="code-theme-dropdown">
          <button
            v-for="ct in CODE_THEMES"
            :key="ct.code"
            type="button"
            class="code-theme-option"
            :class="{ selected: modelValue === ct.code }"
            @click="select(ct.code)"
          >
            <span>{{ ct.label }}</span>
            <Check
              v-if="modelValue === ct.code"
              :size="14"
              :stroke-width="2.5"
              class="option-check"
            />
          </button>
        </div>
      </Transition>
    </div>

    <div class="code-preview-area" :data-code-theme="modelValue">
      <pre class="code-preview-pre"><code class="hljs zq-code-theme-preview"><span class="hljs-comment">// Fibonacci sequence generator</span>
<span class="hljs-keyword">function</span> <span class="hljs-title function_">fibonacci</span>(<span class="hljs-params">n</span>) {
  <span class="hljs-keyword">const</span> result = [<span class="hljs-number">0</span>, <span class="hljs-number">1</span>]
  <span class="hljs-keyword">for</span> (<span class="hljs-keyword">let</span> i = <span class="hljs-number">2</span>; i &lt; n; i++) {
    result.<span class="hljs-title function_">push</span>(result[i - <span class="hljs-number">1</span>] + result[i - <span class="hljs-number">2</span>])
  }
  <span class="hljs-keyword">return</span> result
}

<span class="hljs-variable language_">console</span>.<span class="hljs-title function_">log</span>(<span class="hljs-string">"Result:"</span>, <span class="hljs-title function_">fibonacci</span>(<span class="hljs-number">10</span>))</code></pre>
    </div>
  </div>
</template>

<style scoped>
.code-theme-select-wrapper {
  position: relative;
}

.code-theme-trigger {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  height: 36px;
  padding: 0 12px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: transparent;
  color: var(--text-primary);
  font-size: 13px;
  font-weight: 500;
  font-family: inherit;
  cursor: pointer;
  transition: border-color 0.15s;
}

.code-theme-trigger:hover {
  border-color: var(--border-strong);
}

.code-theme-trigger:focus {
  border-color: var(--accent-color);
  outline: none;
}

.trigger-chevron {
  color: var(--text-tertiary);
  transition: transform 0.2s ease;
  flex-shrink: 0;
}

.trigger-chevron.open {
  transform: rotate(180deg);
}

.code-theme-dropdown {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  background: var(--bg-editor);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
  z-index: 10;
  padding: 4px;
  max-height: 240px;
  overflow-y: auto;
}

.code-theme-option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 8px 10px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--text-primary);
  font-size: 13px;
  font-family: inherit;
  cursor: pointer;
  transition: background 0.1s ease;
  text-align: left;
}

.code-theme-option:hover {
  background: var(--bg-hover);
}

.code-theme-option.selected {
  background: var(--accent-shadow);
  color: var(--accent-color);
  font-weight: 500;
}

.option-check {
  color: var(--accent-color);
  flex-shrink: 0;
}

.dropdown-enter-active {
  transition: opacity 0.12s ease, transform 0.12s ease;
}

.dropdown-leave-active {
  transition: opacity 0.08s ease, transform 0.08s ease;
}

.dropdown-enter-from,
.dropdown-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

.code-preview-area {
  margin-top: 12px;
  border-radius: 8px;
  border: 1px solid var(--border-color);
  overflow: hidden;
}

.code-preview-pre {
  margin: 0;
  padding: 16px 20px;
  font-family: 'Fira Code', 'Cascadia Code', 'JetBrains Mono', Consolas, Monaco, 'Courier New', monospace;
  font-size: 12.5px;
  line-height: 1.65;
  background: var(--zq-code-bg, var(--bg-sidebar));
  color: var(--zq-code-text, var(--text-primary));
  overflow-x: auto;
}

.code-preview-pre :deep(code) {
  font-family: inherit;
  background: transparent;
  padding: 0;
}
</style>
