import { onMounted, onBeforeUnmount } from 'vue';
import { useDrawStore } from '../store/draw-store';
import { TOOL_SHORTCUTS } from '../constants';
import type { ToolType, DrawLinearElement, DrawElement } from '../types';
import { deletePoints } from '../elements/linear-element-editor';
import { serializeAsJSON, deserializeFromJSON } from '../data/json';

export function useKeyboard() {
  const store = useDrawStore();

  function handleKeyDown(e: KeyboardEvent) {
    if (store.viewModeEnabled) return;

    const target = e.target as HTMLElement;
    const isTextInput =
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.isContentEditable;

    if (isTextInput) {
      if (e.key === 'Escape' && store.editingTextElement) {
        return;
      }
      return;
    }

    if (store.editingTextElement) {
      if (e.key === 'Escape') {
        store.editingTextElement = null;
        store.requestRender();
      }
      return;
    }

    const ctrl = e.ctrlKey || e.metaKey;

    // Open file (Ctrl+O)
    if (ctrl && e.key.toLowerCase() === 'o' && !e.shiftKey) {
      e.preventDefault();
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json,.excalidraw';
      input.onchange = async () => {
        const file = input.files?.[0];
        if (!file) return;
        const text = await file.text();
        const data = deserializeFromJSON(text);
        if (data) store.loadDrawData(data);
      };
      input.click();
      return;
    }

    // Save to disk (Ctrl+Shift+S)
    if (ctrl && e.key.toLowerCase() === 's' && e.shiftKey) {
      e.preventDefault();
      const json = serializeAsJSON(
        store.scene.getElements(),
        store.getAppState(),
        store.files,
      );
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${store.getAppState().name || 'drawing'}.zqdraw.json`;
      a.click();
      URL.revokeObjectURL(url);
      return;
    }

    // Undo / Redo
    if (ctrl && e.key === 'z' && !e.shiftKey) {
      e.preventDefault();
      store.undo();
      return;
    }
    if (ctrl && (e.key === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))) {
      e.preventDefault();
      store.redo();
      return;
    }

    // Copy / Cut / Paste (check Alt variants first)
    if (ctrl && e.altKey && e.key === 'c') {
      e.preventDefault();
      store.copyStyle();
      return;
    }
    if (ctrl && e.altKey && e.key === 'v') {
      e.preventDefault();
      store.pasteStyle();
      return;
    }
    if (ctrl && e.key === 'c' && !e.altKey) {
      e.preventDefault();
      store.copySelectedElements();
      return;
    }
    if (ctrl && e.key === 'x') {
      e.preventDefault();
      store.cutSelectedElements();
      return;
    }
    if (ctrl && e.key === 'v' && !e.altKey) {
      e.preventDefault();
      store.pasteFromClipboard();
      return;
    }

    // Duplicate
    if (ctrl && e.key === 'd') {
      e.preventDefault();
      store.duplicateSelectedElements();
      return;
    }

    // Select All
    if (ctrl && e.key === 'a') {
      e.preventDefault();
      store.selectAll();
      return;
    }

    // Delete (linear editor points or elements)
    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      if (store.editingLinearElement && store.editingLinearElement.selectedPointIndices.length > 0) {
        const editorState = store.editingLinearElement;
        const el = store.scene.getElement(editorState.elementId) as DrawLinearElement | null;
        if (el) {
          const updated = deletePoints(el, editorState.selectedPointIndices);
          if (updated) {
            store.recordHistory();
            store.updateElement(el.id, updated as Partial<DrawElement>);
            editorState.selectedPointIndices = [];
            store.requestRender();
          }
        }
        return;
      }
      store.deleteSelectedElementsWithBindings();
      return;
    }

    // Group / Ungroup
    if (ctrl && e.key === 'g' && !e.shiftKey) {
      e.preventDefault();
      store.groupSelected();
      return;
    }
    if (ctrl && e.key.toLowerCase() === 'g' && e.shiftKey) {
      e.preventDefault();
      store.ungroupSelected();
      return;
    }

    // Lock / Unlock
    if (ctrl && e.key === 'l' && !e.shiftKey) {
      e.preventDefault();
      if (store.isSelectedLocked) {
        store.unlockSelected();
      } else {
        store.lockSelected();
      }
      return;
    }

    // Z-index: Ctrl+] / Ctrl+[
    if (ctrl && e.key === ']' && !e.shiftKey) {
      e.preventDefault();
      store.bringForward();
      return;
    }
    if (ctrl && e.key === '[' && !e.shiftKey) {
      e.preventDefault();
      store.sendBackward();
      return;
    }
    if (ctrl && (e.key === '}' || (e.key === ']' && e.shiftKey))) {
      e.preventDefault();
      store.bringToFront();
      return;
    }
    if (ctrl && (e.key === '{' || (e.key === '[' && e.shiftKey))) {
      e.preventDefault();
      store.sendToBack();
      return;
    }

    // Hyperlink
    if (ctrl && e.key === 'k') {
      e.preventDefault();
      if (store.selectedElements.length === 1) {
        store.showHyperlinkPopup = 'editor';
      }
      return;
    }

    // Flip
    if (e.shiftKey && e.key === 'H' && !ctrl) {
      e.preventDefault();
      store.flipSelectedHorizontal();
      return;
    }
    if (e.shiftKey && e.key === 'V' && !ctrl) {
      e.preventDefault();
      store.flipSelectedVertical();
      return;
    }

    // Toggle snap mode (Alt+S)
    if (e.altKey && e.key.toLowerCase() === 's') {
      e.preventDefault();
      store.objectsSnapModeEnabled = !store.objectsSnapModeEnabled;
      return;
    }

    // Toggle stats panel (Alt+I)
    if (e.altKey && e.key.toLowerCase() === 'i') {
      e.preventDefault();
      store.showStats = !store.showStats;
      return;
    }

    // Toggle zen mode (Alt+Z)
    if (e.altKey && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      store.zenModeEnabled = !store.zenModeEnabled;
      return;
    }

    // Escape
    if (e.key === 'Escape') {
      if (store.editingLinearElement) {
        store.editingLinearElement = null;
        store.requestRender();
        return;
      }
      store.setActiveTool('selection');
      store.clearSelection();
      store.newElement = null;
      store.selectionElement = null;
      store.requestRender();
      return;
    }

    // Zoom
    if (ctrl && (e.key === '=' || e.key === '+')) {
      e.preventDefault();
      store.zoomIn();
      return;
    }
    if (ctrl && e.key === '-') {
      e.preventDefault();
      store.zoomOut();
      return;
    }
    if (ctrl && e.key === '0') {
      e.preventDefault();
      store.resetZoom();
      return;
    }
    if (ctrl && e.key === '1' && !e.shiftKey) {
      e.preventDefault();
      store.zoomToFit();
      return;
    }
    if (ctrl && (e.key === '!' || (e.key === '1' && e.shiftKey))) {
      e.preventDefault();
      store.zoomToFitSelection();
      return;
    }

    // Tool shortcuts (single key)
    if (!ctrl && !e.shiftKey && !e.altKey) {
      const key = e.key.toLowerCase();
      for (const [tool, shortcut] of Object.entries(TOOL_SHORTCUTS)) {
        if (shortcut === key) {
          store.setActiveTool(tool as ToolType);
          return;
        }
      }
    }
  }

  onMounted(() => {
    document.addEventListener('keydown', handleKeyDown);
  });

  onBeforeUnmount(() => {
    document.removeEventListener('keydown', handleKeyDown);
  });
}
