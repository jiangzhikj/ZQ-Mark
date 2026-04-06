import { ref, onMounted, onUnmounted, watch } from 'vue'

export type ThemeMode = 'system' | 'light' | 'dark'
export type ResolvedTheme = 'light' | 'dark'

const themeMode = ref<ThemeMode>('system')
const resolvedTheme = ref<ResolvedTheme>('light')

export function useTheme() {
  let cleanup: (() => void) | null = null

  async function init() {
    const systemTheme = await window.electron.getSystemTheme()
    resolvedTheme.value = systemTheme
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
