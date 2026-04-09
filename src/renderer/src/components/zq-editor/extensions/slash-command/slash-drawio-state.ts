/** 斜杠菜单「流程图」是否可用（与主窗口 draw.io 资源是否就绪一致，由 App 同步） */
let slashDrawioAvailable = false

export function setSlashDrawioAvailable(v: boolean): void {
  slashDrawioAvailable = v
}

export function isSlashDrawioAvailable(): boolean {
  return slashDrawioAvailable
}
