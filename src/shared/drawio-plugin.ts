/** draw.io 可选插件：远程 manifest 与安装进度（主进程 / 渲染层共用类型） */

export interface DrawioPluginManifest {
  version: string
  minAppVersion?: string
  zipUrl: string
  sha256: string
  size?: number
  notes?: string
}

export type DrawioBundleState = 'missing' | 'ready'

export interface DrawioBundleStatus {
  state: DrawioBundleState
  version?: string
  /** 是否为用户通过插件中心安装到 userData 的副本（仅此项可被卸载） */
  userInstalled?: boolean
}

export type DrawioInstallPhase =
  | 'downloading'
  | 'verifying'
  | 'extracting'
  | 'done'
  | 'error'

export interface DrawioInstallProgress {
  phase: DrawioInstallPhase
  percent?: number
  received?: number
  total?: number
  /** 下载阶段：当前估算速度（字节/秒） */
  bytesPerSecond?: number
  message?: string
}
