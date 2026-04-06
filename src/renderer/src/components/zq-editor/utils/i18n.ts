import i18n from '@/i18n';

const FLAT_SECTIONS = ['slash', 'bubble', 'blockMenu', 'turnInto', 'search', 'link', 'color', 'codeBlock', 'table', 'image', 'attachment', 'toc', 'toggle', 'upload', 'draw']

export function $t(key: string, ...args: any[]): string {
  if (key.startsWith('zq-editor.')) {
    const rest = key.slice('zq-editor.'.length)
    const dotIdx = rest.indexOf('.')
    if (dotIdx > 0) {
      const section = rest.slice(0, dotIdx)
      const subKey = rest.slice(dotIdx + 1)
      if (FLAT_SECTIONS.includes(section)) {
        const locale = (i18n.global as any).locale?.value || (i18n.global as any).locale || 'zh-CN'
        const msgs = (i18n.global as any).messages?.value || (i18n.global as any).messages
        const localeData = msgs?.[locale]?.['zq-editor']?.[section]
        if (localeData && subKey in localeData) {
          return localeData[subKey]
        }
        for (const fb of ['zh-CN', 'en']) {
          const fbData = msgs?.[fb]?.['zq-editor']?.[section]
          if (fbData && subKey in fbData) return fbData[subKey]
        }
      }
    }
  }
  return (i18n.global as any).t(key, ...args);
}
