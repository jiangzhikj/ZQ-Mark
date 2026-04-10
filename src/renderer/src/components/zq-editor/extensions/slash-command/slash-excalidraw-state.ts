/** 斜杠「Excalidraw」是否可用（与主窗口资源是否就绪一致，由 App 同步） */
let slashExcalidrawAvailable = false;

export function setSlashExcalidrawAvailable(v: boolean): void {
  slashExcalidrawAvailable = v;
}

export function isSlashExcalidrawAvailable(): boolean {
  return slashExcalidrawAvailable;
}
