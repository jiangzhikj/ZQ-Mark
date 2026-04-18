/** WiseMapping 可选插件：远程 manifest 与安装进度（主进程 / 渲染层共用类型） */

export interface WisemappingPluginManifest {
  version: string
  minAppVersion?: string
  zipUrl: string
  sha256: string
  size?: number
  notes?: string
}

export type WisemappingBundleState = 'missing' | 'ready'

export interface WisemappingBundleStatus {
  state: WisemappingBundleState
  version?: string
  /** 是否为用户通过插件中心安装到 userData 的副本（仅此项可被卸载） */
  userInstalled?: boolean
}

export type WisemappingInstallPhase =
  | 'downloading'
  | 'verifying'
  | 'extracting'
  | 'done'
  | 'error'

export interface WisemappingInstallProgress {
  phase: WisemappingInstallPhase
  percent?: number
  received?: number
  total?: number
  bytesPerSecond?: number
  message?: string
}
