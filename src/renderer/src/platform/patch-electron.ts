import type { ElectronAPI } from '../../../preload/index'
import { createWebElectronApi } from './web-electron'

declare global {
  interface Window {
    electron?: ElectronAPI
  }
}

/** 浏览器直接打开渲染页时注入与 Electron 一致的 API（网页版） */
export function patchElectron(): void {
  if (typeof window === 'undefined') return
  if (window.electron) return
  window.electron = createWebElectronApi()
}
