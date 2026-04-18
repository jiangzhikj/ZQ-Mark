import { shallowRef } from 'vue';

export type WisemappingStandaloneCommitPayload = {
  token: string;
  mapXml: string;
  preview: string;
};

/** 独立窗口提交时用于回调到「打开该窗口」的块（避免 NodeView 重挂载后 standaloneToken 丢失） */
export type WisemappingStandaloneCommitBridge = {
  token: string;
  commit: (payload: WisemappingStandaloneCommitPayload) => void | Promise<void>;
};

export const wisemappingStandaloneCommitBridge =
  shallowRef<WisemappingStandaloneCommitBridge | null>(null);

let globalListenerAttached = false;

export function ensureWisemappingStandaloneCommitIpcListener(): void {
  if (globalListenerAttached) return;
  const api = window.electron;
  if (!api?.onWisemappingStandaloneCommit) return;
  globalListenerAttached = true;
  api.onWisemappingStandaloneCommit((payload) => {
    const b = wisemappingStandaloneCommitBridge.value;
    if (!b || b.token !== payload.token) return;
    void Promise.resolve(b.commit(payload)).catch(() => {});
  });
}
