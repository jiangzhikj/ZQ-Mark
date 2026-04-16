import { ref, onMounted, onUnmounted, watch } from 'vue'

export type ThemeMode = 'system' | 'light' | 'dark'
export type ResolvedTheme = 'light' | 'dark'

const themeMode = ref<ThemeMode>('system')
/** 供编辑器内组件（如 Mermaid 预览）订阅，无需重复监听系统主题 */
export const resolvedTheme = ref<ResolvedTheme>('light')

export function useTheme() {
  let cleanup: (() => void) | null = null

  async function init() {
    const systemTheme = await window.electron.getSystemTheme()
    // init 可能早于 App.vue 从 settings 恢复 themeMode，因此要以 themeMode.value 为准
    resolvedTheme.value = themeMode.value === 'system' ? systemTheme : themeMode.value
    applyTheme()

    cleanup = window.electron.onThemeChanged((newTheme) => {
      if (themeMode.value === 'system') {
        resolvedTheme.value = newTheme
        applyTheme()
      }
    })
  }

  function applyTheme() {
    document.documentElement.setAttribute('data-theme', resolvedTheme.value)
  }

  function setThemeMode(mode: ThemeMode) {
    themeMode.value = mode
    if (mode === 'system') {
      window.electron.getSystemTheme().then((t) => {
        resolvedTheme.value = t
        applyTheme()
      })
    } else {
      resolvedTheme.value = mode
      applyTheme()
    }
  }

  watch(resolvedTheme, applyTheme)

  onMounted(() => {
    init()
  })

  onUnmounted(() => {
    cleanup?.()
  })

  return { themeMode, resolvedTheme, setThemeMode }
}
