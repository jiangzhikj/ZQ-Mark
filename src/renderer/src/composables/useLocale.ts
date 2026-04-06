import { onMounted } from 'vue'
import { useI18n } from 'vue-i18n'

export function useLocale() {
  const { locale } = useI18n()

  async function init() {
    const systemLocale = await window.electron.getSystemLocale()
    locale.value = systemLocale
  }

  async function setLocale(lang: string) {
    locale.value = lang
    await window.electron.changeLocale(lang)
  }

  onMounted(() => {
    init()
  })

  return { locale, setLocale }
}
