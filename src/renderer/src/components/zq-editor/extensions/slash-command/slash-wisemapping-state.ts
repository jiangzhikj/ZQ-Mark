/** 斜杠「思维导图 / WiseMapping」是否可用（与主窗口资源是否就绪一致，由 App 同步） */
let slashWisemappingAvailable = false;

export function setSlashWisemappingAvailable(v: boolean): void {
  slashWisemappingAvailable = v;
}

export function isSlashWisemappingAvailable(): boolean {
  return slashWisemappingAvailable;
}
