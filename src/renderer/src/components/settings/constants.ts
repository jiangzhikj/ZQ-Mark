export const CODE_THEMES = [
  { code: 'intellij', label: 'IntelliJ IDEA' },
  { code: 'github', label: 'GitHub' },
  { code: 'one-dark', label: 'One Dark' },
  { code: 'monokai', label: 'Monokai' },
  { code: 'dracula', label: 'Dracula' },
  { code: 'solarized-light', label: 'Solarized Light' },
  { code: 'nord', label: 'Nord' },
  { code: 'night-owl', label: 'Night Owl' },
] as const

export const SETTINGS_LANGUAGES = [
  { code: 'system', label: '', desc: '', isSystem: true },
  { code: 'zh-CN', label: '简体中文', desc: 'Simplified Chinese', isSystem: false },
  { code: 'zh-TW', label: '繁體中文', desc: 'Traditional Chinese', isSystem: false },
  { code: 'en', label: 'English', desc: 'English', isSystem: false },
] as const

export const SETTINGS_UI_THEMES = [{ code: 'system' }, { code: 'light' }, { code: 'dark' }] as const
