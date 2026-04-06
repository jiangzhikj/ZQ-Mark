import { defineStore } from 'pinia';
import { markRaw, ref, computed, shallowRef } from 'vue';

import type {
  DrawElement,
  NonDeletedDrawElement,
  AppState,
  ActiveTool,
  ToolType,
  BinaryFiles,
  BinaryFileData,
  DrawData,
  GlobalPoint,
  NormalizedZoomValue,
  DataURL,
  FileId,
  Zoom,
  DrawSelectionElement,
  DrawTextElement,
  DrawArrowElement,
  DrawLinearElement,
  DrawImageElement,
  Arrowhead,
  SnapLine,
  TextAlign,
  VerticalAlign,
  LinearElementEditorState,
  SuggestedBinding,
} from '../types';
import {
  DEFAULT_ELEMENT_STROKE_COLOR,
  DEFAULT_ELEMENT_BACKGROUND_COLOR,
  DEFAULT_ELEMENT_FILL_STYLE,
  DEFAULT_ELEMENT_STROKE_WIDTH,
  DEFAULT_ELEMENT_STROKE_STYLE,
  DEFAULT_ELEMENT_ROUGHNESS,
  DEFAULT_ELEMENT_OPACITY,
  DEFAULT_FONT_SIZE,
  DEFAULT_FONT_FAMILY,
  DEFAULT_END_ARROWHEAD,
  DEFAULT_GRID_SIZE,
  DEFAULT_GRID_STEP,
  DEFAULT_ZOOM,
  CANVAS_BACKGROUND_LIGHT,
  MIN_ZOOM,
  MAX_ZOOM,
  ZOOM_STEP,
} from '../constants';
import { Scene } from '../core/scene';
import { History, type HistoryEntry } from '../core/history';
import { renderStaticScene } from '../core/renderer/static-scene';
import { renderInteractiveScene } from '../core/renderer/interactive-scene';
import { viewportCoordsToScene } from '../core/renderer/helpers';
import { hitTest } from '../elements/collision';
import { getCommonBounds } from '../elements/bounds';
import { duplicateElements } from '../elements/duplicate';
import {
  copyElements,
  cutElements,
  pasteElements,
} from '../core/clipboard';
import { toDrawData, deserializeFromJSON } from '../data/json';
import { newImageElement } from '../elements/new-element';
import {
  groupElements,
  ungroupElements,
  getElementsInGroup,
  selectGroupsForSelectedElements,
  getOutermostGroupId,
} from '../elements/group';
import {
  moveOneRight,
  moveOneLeft,
  moveAllRight,
  moveAllLeft,
} from '../elements/zindex';
import { alignElements, distributeElements } from '../elements/align';
import type { Alignment, Distribution } from '../elements/align';
import { flipElements } from '../elements/flip';
import {
  updateBoundElements,
  unbindAllBoundElements,
  isArrowElement,
} from '../elements/binding';
import { updateElbowArrowPoints } from '../elements/elbow-arrow';
import { updateFrameMembershipOnDrag } from '../elements/frame';
import {
  handleBoundTextResize,
} from '../elements/bound-text';

export const useDrawStore = defineStore('zq-draw', () => {
  // ---- Core engine instances (non-reactive) ----
  const scene = markRaw(new Scene());
  const history = markRaw(new History());

  // ---- Canvas refs ----
  const staticCanvas = shallowRef<HTMLCanvasElement | null>(null);
  const interactiveCanvas = shallowRef<HTMLCanvasElement | null>(null);

  // ---- Binary files & image cache ----
  const files = ref<BinaryFiles>({});
  const imageCache = markRaw(new Map<string, HTMLImageElement>());

  // ---- App State (reactive) ----
  const activeTool = ref<ActiveTool>({
    type: 'selection',
    customType: null,
    locked: false,
    lastActiveTool: null,
  });

  const viewBackgroundColor = ref(CANVAS_BACKGROUND_LIGHT);
  const zoom = ref<Zoom>({ value: DEFAULT_ZOOM });
  const scrollX = ref(0);
  const scrollY = ref(0);
  const canvasWidth = ref(800);
  const canvasHeight = ref(600);
  const offsetTop = ref(0);
  const offsetLeft = ref(0);
  const theme = ref<'light' | 'dark'>('light');

  const selectedElementIds = ref<Record<string, true>>({});
  const selectedGroupIds = ref<Record<string, boolean>>({});

  const currentItemStrokeColor = ref(DEFAULT_ELEMENT_STROKE_COLOR);
  const currentItemBackgroundColor = ref(DEFAULT_ELEMENT_BACKGROUND_COLOR);
  const currentItemFillStyle = ref(DEFAULT_ELEMENT_FILL_STYLE);
  const currentItemStrokeWidth = ref(DEFAULT_ELEMENT_STROKE_WIDTH);
  const currentItemStrokeStyle = ref(DEFAULT_ELEMENT_STROKE_STYLE);
  const currentItemRoughness = ref(DEFAULT_ELEMENT_ROUGHNESS);
  const currentItemOpacity = ref(DEFAULT_ELEMENT_OPACITY);
  const currentItemFontFamily = ref(DEFAULT_FONT_FAMILY);
  const currentItemFontSize = ref(DEFAULT_FONT_SIZE);
  const currentItemStartArrowhead = ref<Arrowhead | null>(null);
  const currentItemEndArrowhead = ref(DEFAULT_END_ARROWHEAD);
  const currentItemArrowType = ref<'sharp' | 'round' | 'elbow'>('round');

  const editingGroupId = ref<string | null>(null);
  const showHyperlinkPopup = ref<false | 'info' | 'editor'>(false);
  const snapLines = ref<readonly SnapLine[]>([]);
  const originSnapOffset = ref<{ x: number; y: number } | null>(null);

  const viewModeEnabled = ref(false);
  const zenModeEnabled = ref(false);
  const gridModeEnabled = ref(false);
  const gridSize = ref(DEFAULT_GRID_SIZE);
  const gridStep = ref(DEFAULT_GRID_STEP);
  const objectsSnapModeEnabled = ref(false);
  const showStats = ref(false);
  const mainMenuOpen = ref(false);

  const editingTextElement = ref<DrawTextElement | null>(null);
  const editingLinearElement = ref<LinearElementEditorState | null>(null);
  const newElement = ref<DrawElement | null>(null);
  const selectionElement = ref<DrawSelectionElement | null>(null);
  const isResizing = ref(false);
  const isRotating = ref(false);
  const cursorButton = ref<'up' | 'down'>('up');
  const selectedElementsAreBeingDragged = ref(false);
  const suggestedBindings = ref<SuggestedBinding[]>([]);

  // render trigger
  const sceneVersion = ref(0);

  // ---- Computed ----
  const elements = computed(() => {
    // eslint-disable-next-line no-unused-expressions
    sceneVersion.value;
    return scene.getNonDeletedElements();
  });

  const selectedElements = computed(() => {
    return elements.value.filter((el) => selectedElementIds.value[el.id]);
  });

  const canUndo = computed(() => {
    // depend on sceneVersion so this recomputes after undo/redo/record
    void sceneVersion.value;
    return history.canUndo;
  });
  const canRedo = computed(() => {
    void sceneVersion.value;
    return history.canRedo;
  });

  // ---- Build AppState snapshot ----
  function getAppState(): AppState {
    return {
      activeTool: activeTool.value,
      viewBackgroundColor: viewBackgroundColor.value,
      zoom: zoom.value,
      scrollX: scrollX.value,
      scrollY: scrollY.value,
      width: canvasWidth.value,
      height: canvasHeight.value,
      offsetTop: offsetTop.value,
      offsetLeft: offsetLeft.value,
      theme: theme.value,
      selectedElementIds: selectedElementIds.value,
      selectedGroupIds: selectedGroupIds.value,
      currentItemStrokeColor: currentItemStrokeColor.value,
      currentItemBackgroundColor: currentItemBackgroundColor.value,
      currentItemFillStyle: currentItemFillStyle.value as any,
      currentItemStrokeWidth: currentItemStrokeWidth.value,
      currentItemStrokeStyle: currentItemStrokeStyle.value as any,
      currentItemRoughness: currentItemRoughness.value,
      currentItemOpacity: currentItemOpacity.value,
      currentItemFontFamily: currentItemFontFamily.value,
      currentItemFontSize: currentItemFontSize.value,
      currentItemTextAlign: 'left',
      currentItemStartArrowhead: currentItemStartArrowhead.value,
      currentItemEndArrowhead: currentItemEndArrowhead.value,
      currentItemRoundness: 'round',
      currentItemArrowType: currentItemArrowType.value,
      viewModeEnabled: viewModeEnabled.value,
      zenModeEnabled: zenModeEnabled.value,
      gridModeEnabled: gridModeEnabled.value,
      gridSize: gridSize.value,
      gridStep: gridStep.value,
      objectsSnapModeEnabled: objectsSnapModeEnabled.value,
      editingTextElement: editingTextElement.value,
      editingLinearElement: editingLinearElement.value,
      editingGroupId: editingGroupId.value,
      newElement: newElement.value,
      selectionElement: selectionElement.value,
      resizingElement: null,
      multiElement: null,
      isResizing: isResizing.value,
      isRotating: isRotating.value,
      cursorButton: cursorButton.value,
      lastPointerDownWith: 'mouse',
      selectedElementsAreBeingDragged: selectedElementsAreBeingDragged.value,
      openMenu: null,
      openPopup: null,
      showHyperlinkPopup: showHyperlinkPopup.value,
      isLoading: false,
      errorMessage: null,
      name: null,
      snapLines: snapLines.value,
      originSnapOffset: originSnapOffset.value,
      suggestedBindings: suggestedBindings.value,
      exportBackground: true,
      exportScale: 2,
      exportWithDarkMode: false,
      frameRendering: { enabled: true, name: true, outline: true, clip: true },
    };
  }

  // ---- Scene change listener ----
  function init(): void {
    scene.onChange(() => {
      sceneVersion.value++;
    });
  }

  // ---- Render ----
  let renderFrameId: number | null = null;

  function requestRender(): void {
    if (renderFrameId !== null) return;
    renderFrameId = requestAnimationFrame(() => {
      renderFrameId = null;
      render();
    });
  }

  function render(): void {
    const appState = getAppState();
    if (staticCanvas.value) {
      renderStaticScene(
        staticCanvas.value,
        scene.getNonDeletedElements(),
        appState,
        files.value,
        imageCache,
      );
    }
    if (interactiveCanvas.value) {
      renderInteractiveScene(
        interactiveCanvas.value,
        scene.getNonDeletedElements(),
        appState,
      );
    }
  }

  // ---- Tool ----
  function setActiveTool(type: ToolType): void {
    if (type !== 'selection') {
      activeTool.value = {
        ...activeTool.value,
        lastActiveTool: {
          type: activeTool.value.type,
          customType: activeTool.value.customType,
        },
      };
    }
    activeTool.value = { ...activeTool.value, type, customType: null };
    if (type === 'selection') {
      // keep selection
    } else {
      clearSelection();
    }
    requestRender();
  }

  // ---- Selection ----
  function clearSelection(): void {
    selectedElementIds.value = {};
    selectedGroupIds.value = {};
    editingLinearElement.value = null;
  }

  function selectElement(id: string, additive = false): void {
    if (editingLinearElement.value && editingLinearElement.value.elementId !== id) {
      editingLinearElement.value = null;
    }
    if (additive) {
      selectedElementIds.value = { ...selectedElementIds.value, [id]: true };
    } else {
      selectedElementIds.value = { [id]: true };
    }
    requestRender();
  }

  function selectElements(ids: string[]): void {
    const map: Record<string, true> = {};
    for (const id of ids) map[id] = true;
    selectedElementIds.value = map;
    requestRender();
  }

  function selectAll(): void {
    const map: Record<string, true> = {};
    for (const el of scene.getNonDeletedElements()) {
      map[el.id] = true;
    }
    selectedElementIds.value = map;
    requestRender();
  }

  // ---- History ----
  function recordHistory(): void {
    history.record({
      elements: scene.getElements().map((el) => ({ ...el })),
      appState: {
        selectedElementIds: { ...selectedElementIds.value },
        selectedGroupIds: { ...selectedGroupIds.value },
        viewBackgroundColor: viewBackgroundColor.value,
        editingGroupId: editingGroupId.value,
        editingTextElement: null,
        name: null,
      },
    });
    sceneVersion.value++;
  }

  function undo(): void {
    const current: HistoryEntry = {
      elements: scene.getElements().map((el) => ({ ...el })),
      appState: {
        selectedElementIds: { ...selectedElementIds.value },
        selectedGroupIds: { ...selectedGroupIds.value },
        viewBackgroundColor: viewBackgroundColor.value,
        editingGroupId: editingGroupId.value,
        editingTextElement: null,
        name: null,
      },
    };
    const entry = history.undo(current);
    if (entry) {
      scene.replaceAllElements(entry.elements);
      selectedElementIds.value = entry.appState.selectedElementIds as Record<string, true>;
      requestRender();
    }
  }

  function redo(): void {
    const current: HistoryEntry = {
      elements: scene.getElements().map((el) => ({ ...el })),
      appState: {
        selectedElementIds: { ...selectedElementIds.value },
        selectedGroupIds: { ...selectedGroupIds.value },
        viewBackgroundColor: viewBackgroundColor.value,
        editingGroupId: editingGroupId.value,
        editingTextElement: null,
        name: null,
      },
    };
    const entry = history.redo(current);
    if (entry) {
      scene.replaceAllElements(entry.elements);
      selectedElementIds.value = entry.appState.selectedElementIds as Record<string, true>;
      requestRender();
    }
  }

  // ---- Element CRUD ----
  function addElement(element: DrawElement): void {
    recordHistory();
    scene.insertElement(element);
    requestRender();
  }

  function updateElement(id: string, updates: Partial<DrawElement>): void {
    scene.mutateElement(id, updates);
    requestRender();
  }

  function deleteSelectedElements(): void {
    const ids = Object.keys(selectedElementIds.value);
    if (ids.length === 0) return;
    recordHistory();
    scene.deleteElements(ids);
    clearSelection();
    requestRender();
  }

  // ---- Clipboard ----
  async function copySelectedElements(): Promise<void> {
    const selected = selectedElements.value;
    if (selected.length === 0) return;
    await copyElements(selected, files.value);
  }

  async function cutSelectedElements(): Promise<void> {
    const selected = selectedElements.value;
    if (selected.length === 0) return;
    await cutElements(selected, files.value);
    deleteSelectedElementsWithBindings();
  }

  async function pasteFromClipboard(): Promise<void> {
    const data = await pasteElements();
    if (!data) return;
    recordHistory();
    scene.insertElements(data.elements);
    const ids: Record<string, true> = {};
    for (const el of data.elements) ids[el.id] = true;
    selectedElementIds.value = ids;
    requestRender();
  }

  function duplicateSelectedElements(): void {
    const selected = selectedElements.value;
    if (selected.length === 0) return;
    recordHistory();
    const duped = duplicateElements(selected);
    scene.insertElements(duped);
    const ids: Record<string, true> = {};
    for (const el of duped) ids[el.id] = true;
    selectedElementIds.value = ids;
    requestRender();
  }

  // ---- Zoom / Pan ----
  function setZoom(value: number): void {
    const clamped = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, value));
    zoom.value = { value: clamped as NormalizedZoomValue };
    requestRender();
  }

  function zoomIn(): void {
    setZoom(zoom.value.value + ZOOM_STEP);
  }

  function zoomOut(): void {
    setZoom(zoom.value.value - ZOOM_STEP);
  }

  function zoomToFit(): void {
    const nonDeleted = scene.getNonDeletedElements();
    if (nonDeleted.length === 0) return;
    const [x1, y1, x2, y2] = getCommonBounds(nonDeleted);
    const padding = 50;
    const contentW = x2 - x1 + padding * 2;
    const contentH = y2 - y1 + padding * 2;
    const zoomX = canvasWidth.value / contentW;
    const zoomY = canvasHeight.value / contentH;
    const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Math.min(zoomX, zoomY)));
    zoom.value = { value: newZoom as NormalizedZoomValue };
    scrollX.value = -x1 + padding + (canvasWidth.value / newZoom - contentW) / 2;
    scrollY.value = -y1 + padding + (canvasHeight.value / newZoom - contentH) / 2;
    requestRender();
  }

  function resetZoom(): void {
    setZoom(1);
  }

  function setScroll(x: number, y: number): void {
    scrollX.value = x;
    scrollY.value = y;
    requestRender();
  }

  // ---- Viewport helpers ----
  function viewportToScene(vx: number, vy: number): { x: number; y: number } {
    return viewportCoordsToScene(vx, vy, {
      scrollX: scrollX.value,
      scrollY: scrollY.value,
      zoom: zoom.value,
    });
  }

  // ---- Hit testing ----
  function getElementAtPosition(
    sceneX: number,
    sceneY: number,
  ): NonDeletedDrawElement | null {
    const els = scene.getNonDeletedElements();
    for (let i = els.length - 1; i >= 0; i--) {
      const el = els[i]!;
      if (el.locked) continue;
      if (hitTest(el, [sceneX, sceneY] as GlobalPoint, zoom.value.value)) {
        return el;
      }
    }
    return null;
  }

  // ---- Serialization ----
  function getDrawData(): DrawData {
    return toDrawData(scene.getElements(), getAppState(), files.value);
  }

  function loadDrawData(data: DrawData): void {
    scene.replaceAllElements(data.elements as DrawElement[]);
    if (data.appState.viewBackgroundColor) {
      viewBackgroundColor.value = data.appState.viewBackgroundColor;
    }
    if (data.appState.gridModeEnabled !== undefined) {
      gridModeEnabled.value = data.appState.gridModeEnabled;
    }
    if (data.appState.theme) {
      theme.value = data.appState.theme;
    }
    if (data.files) {
      files.value = { ...data.files };
    }
    history.clear();
    requestRender();
  }

  function loadFromJSON(json: string): void {
    const data = deserializeFromJSON(json);
    if (data) loadDrawData(data);
  }

  // ---- Group / Ungroup ----
  function groupSelected(): void {
    const selected = selectedElements.value;
    if (selected.length < 2) return;
    recordHistory();
    const groupId = groupElements(selected, scene, editingGroupId.value);
    selectedGroupIds.value = { ...selectedGroupIds.value, [groupId]: true };
    requestRender();
  }

  function ungroupSelected(): void {
    const selected = selectedElements.value;
    if (selected.length === 0) return;

    const groupIdsToUngroup = new Set<string>();
    for (const el of selected) {
      if (el.groupIds.length > 0) {
        const outerGid = el.groupIds[el.groupIds.length - 1]!;
        groupIdsToUngroup.add(outerGid);
      }
    }
    if (groupIdsToUngroup.size === 0) return;

    recordHistory();
    for (const gid of groupIdsToUngroup) {
      ungroupElements(scene.getElements(), scene, gid);
    }
    const newGroupIds = { ...selectedGroupIds.value };
    for (const gid of groupIdsToUngroup) {
      delete newGroupIds[gid];
    }
    selectedGroupIds.value = newGroupIds;
    requestRender();
  }

  // ---- Lock / Unlock ----
  function lockSelected(): void {
    const selected = selectedElements.value;
    if (selected.length === 0) return;
    recordHistory();
    for (const el of selected) {
      scene.mutateElement(el.id, { locked: true } as Partial<DrawElement>);
    }
    clearSelection();
    requestRender();
  }

  function unlockSelected(): void {
    const selected = selectedElements.value;
    if (selected.length === 0) return;
    recordHistory();
    for (const el of selected) {
      scene.mutateElement(el.id, { locked: false } as Partial<DrawElement>);
    }
    requestRender();
  }

  const isSelectedLocked = computed(() => {
    return selectedElements.value.length > 0 && selectedElements.value.every((el) => el.locked);
  });

  // ---- Z-Index ----
  function bringToFront(): void {
    if (Object.keys(selectedElementIds.value).length === 0) return;
    recordHistory();
    moveAllRight(scene.getElements(), selectedElementIds.value, scene);
    requestRender();
  }

  function sendToBack(): void {
    if (Object.keys(selectedElementIds.value).length === 0) return;
    recordHistory();
    moveAllLeft(scene.getElements(), selectedElementIds.value, scene);
    requestRender();
  }

  function bringForward(): void {
    if (Object.keys(selectedElementIds.value).length === 0) return;
    recordHistory();
    moveOneRight(scene.getElements(), selectedElementIds.value, scene);
    requestRender();
  }

  function sendBackward(): void {
    if (Object.keys(selectedElementIds.value).length === 0) return;
    recordHistory();
    moveOneLeft(scene.getElements(), selectedElementIds.value, scene);
    requestRender();
  }

  // ---- Align / Distribute ----
  function alignSelected(alignment: Alignment): void {
    const selected = selectedElements.value;
    if (selected.length < 2) return;
    recordHistory();
    alignElements(selected, alignment, scene);
    requestRender();
  }

  function distributeSelected(distribution: Distribution): void {
    const selected = selectedElements.value;
    if (selected.length < 3) return;
    recordHistory();
    distributeElements(selected, distribution, scene);
    requestRender();
  }

  // ---- Flip ----
  function flipSelectedHorizontal(): void {
    const selected = selectedElements.value;
    if (selected.length === 0) return;
    recordHistory();
    flipElements(selected, 'horizontal', scene);
    requestRender();
  }

  function flipSelectedVertical(): void {
    const selected = selectedElements.value;
    if (selected.length === 0) return;
    recordHistory();
    flipElements(selected, 'vertical', scene);
    requestRender();
  }

  // ---- Hyperlink ----
  function setElementLink(id: string, link: string | null): void {
    recordHistory();
    scene.mutateElement(id, { link } as Partial<DrawElement>);
    requestRender();
  }

  // ---- Binding helpers ----
  function updateBindingsAfterMove(elementId: string): void {
    const el = scene.getElement(elementId);
    if (!el) return;
    updateBoundElements(el, scene);

    if (isArrowElement(el) && (el as DrawArrowElement).elbowed) {
      updateElbowArrowPoints(el as DrawArrowElement, scene);
    }

    handleBoundTextResize(el, scene);
  }

  function updateBindingsAfterResize(elementId: string): void {
    const el = scene.getElement(elementId);
    if (!el) return;
    updateBoundElements(el, scene);
    handleBoundTextResize(el, scene);
  }

  // ---- Frame membership ----
  function updateFrameMembership(draggedIds: string[]): void {
    const dragged = draggedIds
      .map((id) => scene.getElement(id))
      .filter((el): el is DrawElement => el != null && !el.isDeleted);
    if (dragged.length === 0) return;
    updateFrameMembershipOnDrag(dragged, scene.getNonDeletedElements(), scene);
  }

  // ---- Enhanced delete (unbind before delete) ----
  function deleteSelectedElementsWithBindings(): void {
    const ids = Object.keys(selectedElementIds.value);
    if (ids.length === 0) return;
    recordHistory();

    const allIdsToDelete = new Set(ids);
    for (const id of ids) {
      const el = scene.getElement(id);
      if (!el) continue;
      if (el.boundElements) {
        for (const bound of el.boundElements) {
          if (bound.type === 'text') {
            allIdsToDelete.add(bound.id);
          }
        }
      }
      unbindAllBoundElements(el, scene);
    }

    scene.deleteElements([...allIdsToDelete]);
    clearSelection();
    requestRender();
  }

  // ---- Image insertion ----
  async function addImageFromFile(file: File, x: number, y: number): Promise<void> {
    const reader = new FileReader();
    const dataURL = await new Promise<string>((resolve, reject) => {
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

    const fileId = `img_${Date.now()}_${Math.random().toString(36).slice(2, 8)}` as FileId;
    const fileData: BinaryFileData = {
      mimeType: file.type,
      id: fileId,
      dataURL: dataURL as DataURL,
      created: Date.now(),
    };
    files.value = { ...files.value, [fileId]: fileData };

    const img = new window.Image();
    img.src = dataURL;
    await new Promise<void>((resolve) => {
      img.onload = () => resolve();
      img.onerror = () => resolve();
    });
    imageCache.set(fileId, img);

    const maxDim = 400;
    let w = img.naturalWidth || 200;
    let h = img.naturalHeight || 200;
    if (w > maxDim || h > maxDim) {
      const ratio = Math.min(maxDim / w, maxDim / h);
      w = Math.round(w * ratio);
      h = Math.round(h * ratio);
    }

    const el = newImageElement({
      x: x - w / 2,
      y: y - h / 2,
      width: w,
      height: h,
      fileId,
    }) as DrawImageElement;
    (el as any).status = 'saved';

    recordHistory();
    addElement(el);
    selectElement(el.id);
  }

  // ---- Copy / Paste style ----
  const copiedStyle = ref<Partial<DrawElement> | null>(null);

  function copyStyle(): void {
    const el = selectedElements.value[0];
    if (!el) return;
    copiedStyle.value = {
      strokeColor: el.strokeColor,
      backgroundColor: el.backgroundColor,
      fillStyle: el.fillStyle,
      strokeWidth: el.strokeWidth,
      strokeStyle: el.strokeStyle,
      roughness: el.roughness,
      opacity: el.opacity,
      roundness: el.roundness,
    } as Partial<DrawElement>;
  }

  function pasteStyle(): void {
    if (!copiedStyle.value || selectedElements.value.length === 0) return;
    recordHistory();
    for (const el of selectedElements.value) {
      updateElement(el.id, { ...copiedStyle.value } as Partial<DrawElement>);
    }
    requestRender();
  }

  // ---- Zoom to fit selection ----
  function zoomToFitSelection(): void {
    const selected = selectedElements.value;
    if (selected.length === 0) return;
    const [x1, y1, x2, y2] = getCommonBounds(selected);
    const padding = 50;
    const contentW = x2 - x1 + padding * 2;
    const contentH = y2 - y1 + padding * 2;
    const zoomX = canvasWidth.value / contentW;
    const zoomY = canvasHeight.value / contentH;
    const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Math.min(zoomX, zoomY)));
    zoom.value = { value: newZoom as NormalizedZoomValue };
    scrollX.value = -x1 + padding + (canvasWidth.value / newZoom - contentW) / 2;
    scrollY.value = -y1 + padding + (canvasHeight.value / newZoom - contentH) / 2;
    requestRender();
  }

  // ---- Snap lines ----
  function setSnapLines(lines: readonly SnapLine[]): void {
    snapLines.value = lines;
    requestRender();
  }

  function clearSnapLines(): void {
    snapLines.value = [];
  }

  // ---- Grid snap helper ----
  function snapToGrid(value: number): number {
    if (!gridModeEnabled.value) return value;
    const step = gridSize.value;
    return Math.round(value / step) * step;
  }

  // ---- Cleanup ----
  function destroy(): void {
    if (renderFrameId !== null) {
      cancelAnimationFrame(renderFrameId);
      renderFrameId = null;
    }
    scene.destroy();
    history.clear();
    imageCache.clear();
  }

  return {
    // engine
    scene,
    history,
    // canvas refs
    staticCanvas,
    interactiveCanvas,
    // files
    files,
    imageCache,
    // state
    activeTool,
    viewBackgroundColor,
    zoom,
    scrollX,
    scrollY,
    canvasWidth,
    canvasHeight,
    offsetTop,
    offsetLeft,
    theme,
    selectedElementIds,
    selectedGroupIds,
    currentItemStrokeColor,
    currentItemBackgroundColor,
    currentItemFillStyle,
    currentItemStrokeWidth,
    currentItemStrokeStyle,
    currentItemRoughness,
    currentItemOpacity,
    currentItemFontFamily,
    currentItemFontSize,
    currentItemStartArrowhead,
    currentItemEndArrowhead,
    currentItemArrowType,
    editingGroupId,
    showHyperlinkPopup,
    snapLines,
    originSnapOffset,
    viewModeEnabled,
    zenModeEnabled,
    gridModeEnabled,
    gridSize,
    gridStep,
    objectsSnapModeEnabled,
    showStats,
    mainMenuOpen,
    editingTextElement,
    editingLinearElement,
    newElement,
    selectionElement,
    isResizing,
    isRotating,
    cursorButton,
    selectedElementsAreBeingDragged,
    suggestedBindings,
    sceneVersion,
    // computed
    elements,
    selectedElements,
    canUndo,
    canRedo,
    isSelectedLocked,
    // methods
    getAppState,
    init,
    requestRender,
    render,
    setActiveTool,
    clearSelection,
    selectElement,
    selectElements,
    selectAll,
    recordHistory,
    undo,
    redo,
    addElement,
    updateElement,
    deleteSelectedElements,
    copySelectedElements,
    cutSelectedElements,
    pasteFromClipboard,
    duplicateSelectedElements,
    setZoom,
    zoomIn,
    zoomOut,
    zoomToFit,
    resetZoom,
    setScroll,
    viewportToScene,
    getElementAtPosition,
    getDrawData,
    loadDrawData,
    loadFromJSON,
    // P1 methods
    groupSelected,
    ungroupSelected,
    lockSelected,
    unlockSelected,
    bringToFront,
    sendToBack,
    bringForward,
    sendBackward,
    alignSelected,
    distributeSelected,
    flipSelectedHorizontal,
    flipSelectedVertical,
    setElementLink,
    updateBindingsAfterMove,
    updateBindingsAfterResize,
    updateFrameMembership,
    deleteSelectedElementsWithBindings,
    addImageFromFile,
    copiedStyle,
    copyStyle,
    pasteStyle,
    zoomToFitSelection,
    setSnapLines,
    clearSnapLines,
    snapToGrid,
    destroy,
  };
});
