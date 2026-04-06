import { type Ref } from 'vue';
import { useDrawStore } from '../store/draw-store';
import type {
  DrawElement,
  DrawLinearElement,
  DrawArrowElement,
  DrawFreeDrawElement,
  DrawSelectionElement,
  GlobalPoint,
  LocalPoint,
  TransformHandleType,
} from '../types';
import { DRAGGING_THRESHOLD } from '../constants';
import {
  newRectangleElement,
  newEllipseElement,
  newDiamondElement,
  newLineElement,
  newArrowElement,
  newFreeDrawElement,
  newTextElement,
  newSelectionElement,
  newFrameElement,
} from '../elements/new-element';
import {
  getTransformHandleAtPoint,
  getLinearPointIndexAtPosition,
  getLinearMidpointIndexAtPosition,
} from '../elements/transform-handles';
import { isElementInsideBox } from '../elements/collision';
import { getCursorForTool } from '../core/cursor';
import { EraserTrail } from '../core/eraser';
import {
  getHoveredElementForBinding,
  bindArrowToElement,
  unbindArrowFromElement,
  isArrowElement,
  getSnapMidpointNear,
} from '../elements/binding';
import {
  isTextBindableContainer,
  getBoundTextElement,
  bindTextToContainer,
  measureText,
  isBoundToContainer,
} from '../elements/bound-text';
import {
  getOutermostGroupId,
  selectGroupsForSelectedElements,
} from '../elements/group';
import { SnapCache, snapDraggedElements, snapNewElement, snapResizeElement } from '../core/snap';
import { getCommonBounds, getElementBounds } from '../elements/bounds';
import {
  createLinearEditorState,
  isLinearElement as checkIsLinear,
  handleLinearEditorPointerDown,
  handleLinearEditorPointerMove,
  handleLinearEditorPointerUp,
  addPointAtMidpoint,
} from '../elements/linear-element-editor';
import {
  createGestureState,
  getGestureCenter,
  getGestureDistance,
} from '../core/gesture';

interface PointerState {
  isDown: boolean;
  startX: number;
  startY: number;
  lastX: number;
  lastY: number;
  hasDragged: boolean;
  hitElement: DrawElement | null;
  hitHandle: TransformHandleType | null;
  isPanning: boolean;
  originalElements: Map<string, DrawElement>;
}

export function usePointerEvents(containerRef: Ref<HTMLElement | null>) {
  const store = useDrawStore();

  const state: PointerState = {
    isDown: false,
    startX: 0,
    startY: 0,
    lastX: 0,
    lastY: 0,
    hasDragged: false,
    hitElement: null,
    hitHandle: null,
    isPanning: false,
    originalElements: new Map(),
  };

  let spacePressed = false;
  let eraserTrail: EraserTrail | null = null;
  let eraserOriginalOpacities = new Map<string, number>();
  const snapCache = new SnapCache();

  // Multi-touch gesture state
  const gestureState = createGestureState();
  let isGesturing = false;

  function getSceneCoords(e: PointerEvent): { x: number; y: number } {
    const rect = containerRef.value?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    const vx = e.clientX - rect.left;
    const vy = e.clientY - rect.top;
    return store.viewportToScene(vx, vy);
  }

  function onPointerDown(e: PointerEvent) {
    // Track pointers for gesture detection
    gestureState.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (gestureState.pointers.size >= 2) {
      isGesturing = true;
      const dist = getGestureDistance(gestureState);
      if (gestureState.initialDistance === null && dist !== null) {
        gestureState.initialDistance = dist;
        gestureState.initialScale = store.zoom.value;
      }
      gestureState.lastCenter = getGestureCenter(gestureState);
      return;
    }

    if (store.viewModeEnabled && store.activeTool.type !== 'hand') return;

    const { x, y } = getSceneCoords(e);
    state.isDown = true;
    state.startX = x;
    state.startY = y;
    state.lastX = x;
    state.lastY = y;
    state.hasDragged = false;
    state.hitElement = null;
    state.hitHandle = null;
    state.isPanning = false;
    dragHistoryRecorded = false;
    store.cursorButton = 'down';

    const tool = store.activeTool.type;

    // panning (hand tool, middle button, space+click)
    if (tool === 'hand' || e.button === 1 || spacePressed) {
      state.isPanning = true;
      setCursor('grabbing');
      return;
    }

    if (tool === 'eraser') {
      handleEraserStart(x, y);
      return;
    }

    if (tool === 'selection') {
      handleSelectionPointerDown(x, y, e);
    } else if (tool === 'freedraw') {
      handleFreeDrawStart(x, y, e);
    } else if (tool === 'text') {
      handleTextCreate(x, y);
      e.preventDefault();
    } else if (tool === 'frame') {
      handleFrameStart(x, y);
    } else if (tool === 'image') {
      handleImageInsert(x, y);
    } else if (
      tool === 'rectangle' ||
      tool === 'ellipse' ||
      tool === 'diamond' ||
      tool === 'line' ||
      tool === 'arrow'
    ) {
      handleShapeStart(x, y, tool);
    }
  }

  function onPointerMove(e: PointerEvent) {
    // Handle multi-touch gesture
    if (gestureState.pointers.has(e.pointerId)) {
      gestureState.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    }
    if (isGesturing && gestureState.pointers.size >= 2) {
      const newDist = getGestureDistance(gestureState);
      const newCenter = getGestureCenter(gestureState);

      if (newDist !== null && gestureState.initialDistance !== null && gestureState.initialScale !== null) {
        const scale = newDist / gestureState.initialDistance;
        const newZoom = gestureState.initialScale * scale;
        store.setZoom(newZoom);
      }

      if (newCenter && gestureState.lastCenter) {
        const dx = (newCenter.x - gestureState.lastCenter.x) / store.zoom.value;
        const dy = (newCenter.y - gestureState.lastCenter.y) / store.zoom.value;
        store.scrollX += dx;
        store.scrollY += dy;
      }

      gestureState.lastCenter = newCenter;
      store.requestRender();
      return;
    }

    const { x, y } = getSceneCoords(e);

    if (!state.isDown) {
      updateCursor(x, y);
      return;
    }

    const dx = x - state.startX;
    const dy = y - state.startY;
    if (!state.hasDragged && Math.hypot(dx, dy) > DRAGGING_THRESHOLD) {
      state.hasDragged = true;
    }

    if (state.isPanning) {
      store.scrollX += x - state.lastX;
      store.scrollY += y - state.lastY;
      // recalculate because scroll changed
      const newCoords = getSceneCoords(e);
      state.lastX = newCoords.x;
      state.lastY = newCoords.y;
      store.requestRender();
      return;
    }

    const tool = store.activeTool.type;

    if (tool === 'eraser') {
      handleEraserMove(x, y);
      return;
    }

    if (tool === 'selection') {
      handleSelectionPointerMove(x, y, e.shiftKey);
    } else if (tool === 'freedraw') {
      handleFreeDrawMove(x, y, e);
    } else if (
      tool === 'rectangle' ||
      tool === 'ellipse' ||
      tool === 'diamond' ||
      tool === 'frame'
    ) {
      handleShapeMove(x, y, e.shiftKey);
    } else if (tool === 'line' || tool === 'arrow') {
      handleLinearMove(x, y, e.shiftKey);
    }

    state.lastX = x;
    state.lastY = y;
  }

  function onPointerUp(e: PointerEvent) {
    gestureState.pointers.delete(e.pointerId);
    if (isGesturing) {
      if (gestureState.pointers.size < 2) {
        isGesturing = false;
        gestureState.initialDistance = null;
        gestureState.initialScale = null;
        gestureState.lastCenter = null;
      }
      return;
    }

    if (!state.isDown) return;
    state.isDown = false;
    store.cursorButton = 'up';

    const { x, y } = getSceneCoords(e);

    if (state.isPanning) {
      state.isPanning = false;
      setCursor(getCursorForTool(store.activeTool.type));
      return;
    }

    const tool = store.activeTool.type;

    if (tool === 'eraser') {
      handleEraserEnd();
    } else if (tool === 'selection') {
      handleSelectionPointerUp(x, y);
    } else if (tool === 'freedraw') {
      handleFreeDrawEnd(x, y, e);
    } else if (
      tool === 'rectangle' ||
      tool === 'ellipse' ||
      tool === 'diamond' ||
      tool === 'line' ||
      tool === 'arrow' ||
      tool === 'frame'
    ) {
      handleShapeEnd();
    }

    state.originalElements.clear();
    store.selectedElementsAreBeingDragged = false;
    store.isResizing = false;
    store.isRotating = false;
  }

  // ---- Selection tool handlers ----
  function handleSelectionPointerDown(x: number, y: number, e: PointerEvent) {
    // check linear element editor interaction
    if (store.editingLinearElement) {
      const editorState = store.editingLinearElement;
      const el = store.scene.getElement(editorState.elementId) as DrawLinearElement | null;
      if (el && checkIsLinear(el)) {
        const result = handleLinearEditorPointerDown(editorState, el, x, y, store.zoom.value);
        if (result.action === 'drag-point') {
          store.recordHistory();
          state.hitElement = el;
          state.originalElements.set(el.id, { ...el } as DrawElement);
          return;
        }
        if (result.action === 'add-midpoint' && result.pointIndex !== undefined) {
          store.recordHistory();
          const { updatedElement, newPointIndex } = addPointAtMidpoint(el, result.pointIndex);
          store.updateElement(el.id, updatedElement as Partial<DrawElement>);
          editorState.selectedPointIndices = [newPointIndex];
          editorState.isDragging = true;
          editorState.dragStartPoint = [x, y] as GlobalPoint;
          editorState.lastDragPoint = [x, y] as GlobalPoint;
          state.hitElement = store.scene.getElement(el.id) as DrawElement;
          state.originalElements.set(el.id, { ...store.scene.getElement(el.id)! });
          store.requestRender();
          return;
        }
        // clicked outside points - exit editing
        store.editingLinearElement = null;
        store.requestRender();
      }
    }

    // check linear point handles on selected linear elements (non-editing mode)
    if (store.selectedElements.length === 1) {
      const el = store.selectedElements[0]!;
      if (checkIsLinear(el)) {
        const ptIdx = getLinearPointIndexAtPosition(el, x, y, store.zoom.value);
        if (ptIdx !== null) {
          store.recordHistory();
          store.editingLinearElement = createLinearEditorState(el.id);
          store.editingLinearElement.selectedPointIndices = [ptIdx];
          store.editingLinearElement.isDragging = true;
          store.editingLinearElement.dragStartPoint = [x, y] as GlobalPoint;
          store.editingLinearElement.lastDragPoint = [x, y] as GlobalPoint;
          state.hitElement = el;
          state.originalElements.set(el.id, { ...el });
          store.requestRender();
          return;
        }

        const linearEl = el as DrawLinearElement;
        const pointCount = linearEl.points?.length ?? 0;
        if (pointCount === 2) {
          const midIdx = getLinearMidpointIndexAtPosition(el, x, y, store.zoom.value);
          if (midIdx !== null) {
            store.recordHistory();
            const { updatedElement, newPointIndex } = addPointAtMidpoint(linearEl, midIdx);
            store.updateElement(el.id, updatedElement as Partial<DrawElement>);
            store.editingLinearElement = createLinearEditorState(el.id);
            store.editingLinearElement.selectedPointIndices = [newPointIndex];
            store.editingLinearElement.isDragging = true;
            store.editingLinearElement.dragStartPoint = [x, y] as GlobalPoint;
            store.editingLinearElement.lastDragPoint = [x, y] as GlobalPoint;
            state.hitElement = store.scene.getElement(el.id) as DrawElement;
            state.originalElements.set(el.id, { ...store.scene.getElement(el.id)! });
            store.requestRender();
            return;
          }
        }
      }
    }

    // check transform handles on selected elements
    if (store.selectedElements.length === 1) {
      const el = store.selectedElements[0]!;
      const handle = getTransformHandleAtPoint(
        el,
        [x, y],
        store.zoom.value,
      );
      if (handle) {
        store.recordHistory();
        state.hitHandle = handle;
        state.hitElement = el;
        state.originalElements.set(el.id, { ...el });
        if (handle === 'rotation') {
          store.isRotating = true;
        } else {
          store.isResizing = true;
        }
        return;
      }
    }

    // check hit on elements
    let hitEl = store.getElementAtPosition(x, y);
    if (hitEl && isBoundToContainer(hitEl)) {
      const containerId = (hitEl as any).containerId;
      const containerEl = store.scene.getElement(containerId);
      if (containerEl && !containerEl.isDeleted) {
        hitEl = containerEl;
      }
    }
    if (hitEl) {
      state.hitElement = hitEl;

      const outerGroupId = getOutermostGroupId(hitEl, store.editingGroupId);
      if (outerGroupId && !e.shiftKey) {
        const { selectedElementIds: newIds, selectedGroupIds: newGids } =
          selectGroupsForSelectedElements(
            { [hitEl.id]: true },
            store.elements,
            store.editingGroupId,
          );
        store.selectedElementIds = newIds;
        store.selectedGroupIds = newGids;
      } else if (!store.selectedElementIds[hitEl.id]) {
        store.selectElement(hitEl.id, e.shiftKey);
      }

      for (const el of store.selectedElements) {
        state.originalElements.set(el.id, { ...el });
      }
    } else {
      // start rubber band selection
      if (!e.shiftKey) {
        store.clearSelection();
      }
      store.selectionElement = newSelectionElement({
        x,
        y,
        width: 0,
        height: 0,
      });
    }
  }

  let dragHistoryRecorded = false;
  let dragOriginalBounds: Bounds | null = null;

  function handleSelectionPointerMove(x: number, y: number, shiftKey = false) {
    // linear editor point dragging
    if (store.editingLinearElement?.isDragging) {
      const editorState = store.editingLinearElement;
      const el = store.scene.getElement(editorState.elementId) as DrawLinearElement | null;
      if (el && checkIsLinear(el)) {
        const updated = handleLinearEditorPointerMove(editorState, el, x, y, shiftKey);
        if (updated) {
          store.updateElement(el.id, updated as Partial<DrawElement>);
          store.requestRender();
        }
      }
      return;
    }

    if (state.hitHandle && state.hitElement) {
      handleTransform(x, y);
      return;
    }

    if (state.hitElement && state.hasDragged) {
      if (!dragHistoryRecorded) {
        store.recordHistory();
        dragHistoryRecorded = true;

        // Cache original bounds BEFORE any movement
        dragOriginalBounds = getCommonBounds(store.selectedElements);

        if (store.objectsSnapModeEnabled) {
          const excludeIds = new Set(Object.keys(store.selectedElementIds));
          snapCache.invalidate();
          snapCache.update(store.elements, excludeIds);
        }
      }
      store.selectedElementsAreBeingDragged = true;

      const totalDx = x - state.startX;
      const totalDy = y - state.startY;

      let finalDx: number;
      let finalDy: number;

      if (store.objectsSnapModeEnabled && dragOriginalBounds) {
        const { snappedOffset, snapLines } = snapDraggedElements(
          { x: totalDx, y: totalDy },
          dragOriginalBounds,
          snapCache,
          store.zoom.value,
        );
        finalDx = snappedOffset.x;
        finalDy = snappedOffset.y;
        store.setSnapLines(snapLines);
      } else if (store.gridModeEnabled && dragOriginalBounds) {
        const rawX = dragOriginalBounds[0] + totalDx;
        const rawY = dragOriginalBounds[1] + totalDy;
        finalDx = store.snapToGrid(rawX) - dragOriginalBounds[0];
        finalDy = store.snapToGrid(rawY) - dragOriginalBounds[1];
      } else {
        finalDx = totalDx;
        finalDy = totalDy;
      }

      // Apply absolute offset from original positions
      for (const el of store.selectedElements) {
        if (isBoundToContainer(el)) continue;
        const orig = state.originalElements.get(el.id);
        if (orig) {
          store.updateElement(el.id, {
            x: orig.x + finalDx,
            y: orig.y + finalDy,
          } as Partial<DrawElement>);
        }
      }

      for (const el of store.selectedElements) {
        if (isBoundToContainer(el)) continue;
        store.updateBindingsAfterMove(el.id);
      }

      store.requestRender();
      return;
    }

    if (store.selectionElement) {
      // update rubber band
      const selEl = store.selectionElement;
      store.selectionElement = {
        ...selEl,
        width: x - selEl.x,
        height: y - selEl.y,
      } as DrawSelectionElement;
      store.requestRender();
    }
  }

  function handleSelectionPointerUp(x: number, y: number) {
    // linear editor point drag end - rebind arrow endpoints
    if (store.editingLinearElement?.isDragging) {
      const editorState = store.editingLinearElement;
      handleLinearEditorPointerUp(editorState);
      const el = store.scene.getElement(editorState.elementId);
      if (el && isArrowElement(el)) {
        const arrow = el as DrawArrowElement;
        const draggedIndices = editorState.selectedPointIndices;
        const isStartEndpoint = draggedIndices.includes(0);
        const isEndEndpoint = draggedIndices.includes(arrow.points.length - 1);

        if (isStartEndpoint) {
          const startPt = [arrow.x + arrow.points[0]![0], arrow.y + arrow.points[0]![1]] as GlobalPoint;
          const target = getHoveredElementForBinding(startPt, store.elements, store.zoom.value);
          if (target && target.id !== arrow.id) {
            bindArrowToElement(arrow, 'start', target, store.scene);
          } else {
            unbindArrowFromElement(arrow, 'start', store.scene);
          }
        }
        if (isEndEndpoint) {
          const endPt = [arrow.x + arrow.points[arrow.points.length - 1]![0], arrow.y + arrow.points[arrow.points.length - 1]![1]] as GlobalPoint;
          const target = getHoveredElementForBinding(endPt, store.elements, store.zoom.value);
          if (target && target.id !== arrow.id) {
            bindArrowToElement(arrow, 'end', target, store.scene);
          } else {
            unbindArrowFromElement(arrow, 'end', store.scene);
          }
        }
        store.updateBindingsAfterMove(el.id);
      }
      store.requestRender();
      return;
    }

    store.clearSnapLines();

    if (state.hasDragged && state.hitElement) {
      const draggedIds = Object.keys(store.selectedElementIds);
      store.updateFrameMembership(draggedIds);
    }

    dragHistoryRecorded = false;
    dragOriginalBounds = null;

    if (state.hitHandle) {
      for (const el of store.selectedElements) {
        store.updateBindingsAfterResize(el.id);
      }
      state.hitHandle = null;
    }

    if (store.selectionElement) {
      // finalize rubber band selection
      const sel = store.selectionElement;
      const box = {
        x: Math.min(sel.x, sel.x + sel.width),
        y: Math.min(sel.y, sel.y + sel.height),
        width: Math.abs(sel.width),
        height: Math.abs(sel.height),
      };

      if (box.width > 1 && box.height > 1) {
        const ids: string[] = [];
        for (const el of store.elements) {
          if (isElementInsideBox(el, box)) {
            ids.push(el.id);
          }
        }
        if (ids.length > 0) {
          store.selectElements(ids);
        }
      }

      store.selectionElement = null;
      store.requestRender();
    }
  }

  function handleTransform(x: number, y: number) {
    if (!state.hitElement || !state.hitHandle) return;

    const original = state.originalElements.get(state.hitElement.id);
    if (!original) return;

    if (state.hitHandle === 'rotation') {
      const cx = original.x + original.width / 2;
      const cy = original.y + original.height / 2;
      const angle = Math.atan2(y - cy, x - cx) + Math.PI / 2;
      store.updateElement(state.hitElement.id, { angle } as any);
    } else {
      let updates = computeResize(original, state.hitHandle, x, y, state.startX, state.startY);

      // Snap resize edges if snap mode is enabled and element is not rotated
      if (store.objectsSnapModeEnabled && Math.abs(original.angle) < 0.01) {
        // Initialize snap cache on first resize frame
        if (!dragHistoryRecorded) {
          snapCache.invalidate();
          snapCache.update(store.elements, new Set([state.hitElement.id]));
        }

        const newX = (updates as any).x ?? original.x;
        const newY = (updates as any).y ?? original.y;
        const newW = (updates as any).width ?? original.width;
        const newH = (updates as any).height ?? original.height;

        // Determine which edges are being resized
        let resizingEdgeX: number | null = null;
        let resizingEdgeY: number | null = null;
        const handle = state.hitHandle;

        if (handle === 'e' || handle === 'ne' || handle === 'se') {
          resizingEdgeX = newX + newW;
        } else if (handle === 'w' || handle === 'nw' || handle === 'sw') {
          resizingEdgeX = newX;
        }
        if (handle === 's' || handle === 'se' || handle === 'sw') {
          resizingEdgeY = newY + newH;
        } else if (handle === 'n' || handle === 'ne' || handle === 'nw') {
          resizingEdgeY = newY;
        }

        const { offsetX, offsetY, snapLines } = snapResizeElement(
          resizingEdgeX,
          resizingEdgeY,
          snapCache,
          store.zoom.value,
        );

        if (offsetX !== 0) {
          if (handle === 'e' || handle === 'ne' || handle === 'se') {
            (updates as any).width = newW + offsetX;
          } else if (handle === 'w' || handle === 'nw' || handle === 'sw') {
            (updates as any).x = newX + offsetX;
            (updates as any).width = newW - offsetX;
          }
        }
        if (offsetY !== 0) {
          if (handle === 's' || handle === 'se' || handle === 'sw') {
            (updates as any).height = newH + offsetY;
          } else if (handle === 'n' || handle === 'ne' || handle === 'nw') {
            (updates as any).y = newY + offsetY;
            (updates as any).height = newH - offsetY;
          }
        }

        store.setSnapLines(snapLines);
      }

      store.updateElement(state.hitElement.id, updates as Partial<DrawElement>);
    }

    store.requestRender();
  }

  // ---- Image insertion handler ----
  function handleImageInsert(x: number, y: number) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.style.display = 'none';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (file) {
        await store.addImageFromFile(file, x, y);
        if (!store.activeTool.locked) {
          store.setActiveTool('selection');
        }
      }
      input.remove();
    };
    document.body.appendChild(input);
    input.click();
    state.isDown = false;
    store.cursorButton = 'up';
  }

  // ---- Shape creation handlers ----
  function handleShapeStart(
    x: number,
    y: number,
    tool: 'rectangle' | 'ellipse' | 'diamond' | 'line' | 'arrow',
  ) {
    // Initialize snap cache for new element creation
    if (store.objectsSnapModeEnabled) {
      snapCache.invalidate();
      snapCache.update(store.elements, new Set());
    }

    let sx = store.gridModeEnabled ? store.snapToGrid(x) : x;
    let sy = store.gridModeEnabled ? store.snapToGrid(y) : y;

    // For arrow/line, snap start point to binding target
    if (tool === 'arrow' || tool === 'line') {
      const point = [x, y] as GlobalPoint;
      const hovered = getHoveredElementForBinding(point, store.elements, store.zoom.value);
      if (hovered) {
        const midPoint = getSnapMidpointNear(point, hovered, store.zoom.value);
        if (midPoint) {
          sx = midPoint[0];
          sy = midPoint[1];
        }
      }
    }

    const opts = {
      x: sx,
      y: sy,
      strokeColor: store.currentItemStrokeColor,
      backgroundColor: store.currentItemBackgroundColor,
      fillStyle: store.currentItemFillStyle as any,
      strokeWidth: store.currentItemStrokeWidth,
      strokeStyle: store.currentItemStrokeStyle as any,
      roughness: store.currentItemRoughness,
      opacity: store.currentItemOpacity,
    };

    let el: DrawElement;
    if (tool === 'line') {
      el = newLineElement({ ...opts, points: [[0, 0] as LocalPoint, [0, 0] as LocalPoint] });
    } else if (tool === 'arrow') {
      el = newArrowElement({ ...opts, points: [[0, 0] as LocalPoint, [0, 0] as LocalPoint] });
    } else if (tool === 'ellipse') {
      el = newEllipseElement(opts);
    } else if (tool === 'diamond') {
      el = newDiamondElement(opts);
    } else {
      el = newRectangleElement(opts);
    }

    store.newElement = el;
  }

  function handleFrameStart(x: number, y: number) {
    const sx = store.gridModeEnabled ? store.snapToGrid(x) : x;
    const sy = store.gridModeEnabled ? store.snapToGrid(y) : y;
    const el = newFrameElement({ x: sx, y: sy, width: 0, height: 0 });
    store.newElement = el;
  }

  function handleShapeMove(x: number, y: number, shiftKey: boolean) {
    if (!store.newElement) return;

    let snappedX = store.gridModeEnabled ? store.snapToGrid(x) : x;
    let snappedY = store.gridModeEnabled ? store.snapToGrid(y) : y;

    let width = snappedX - store.newElement.x;
    let height = snappedY - store.newElement.y;

    if (shiftKey) {
      const size = Math.max(Math.abs(width), Math.abs(height));
      width = Math.sign(width) * size;
      height = Math.sign(height) * size;
    }

    // Snap new element to reference points
    if (store.objectsSnapModeEnabled) {
      const elX = store.newElement.x;
      const elY = store.newElement.y;
      const rawBounds: Bounds = [
        Math.min(elX, elX + width),
        Math.min(elY, elY + height),
        Math.max(elX, elX + width),
        Math.max(elY, elY + height),
      ];
      const { snappedBounds, snapLines } = snapNewElement(rawBounds, snapCache, store.zoom.value);
      const snapDx = snappedBounds[0] - rawBounds[0];
      const snapDy = snappedBounds[1] - rawBounds[1];
      width += snapDx * Math.sign(width || 1);
      height += snapDy * Math.sign(height || 1);
      store.setSnapLines(snapLines);
    }

    store.newElement = {
      ...store.newElement,
      width,
      height,
      version: (store.newElement.version ?? 0) + 1,
    } as DrawElement;
    store.requestRender();
  }

  function handleLinearMove(x: number, y: number, shiftKey: boolean) {
    if (!store.newElement) return;
    const el = store.newElement as DrawLinearElement;

    const snappedX = store.gridModeEnabled ? store.snapToGrid(x) : x;
    const snappedY = store.gridModeEnabled ? store.snapToGrid(y) : y;

    let endX = snappedX - el.x;
    let endY = snappedY - el.y;

    if (shiftKey) {
      const angle = Math.atan2(endY, endX);
      const snapped = Math.round(angle / (Math.PI / 4)) * (Math.PI / 4);
      const dist = Math.hypot(endX, endY);
      endX = Math.cos(snapped) * dist;
      endY = Math.sin(snapped) * dist;
    }

    // Check for binding target at the endpoint
    const endGlobal = [el.x + endX, el.y + endY] as GlobalPoint;
    const hovered = getHoveredElementForBinding(endGlobal, store.elements, store.zoom.value);
    if (hovered) {
      const midPoint = getSnapMidpointNear(endGlobal, hovered, store.zoom.value);
      store.suggestedBindings = [{ element: hovered, midPoint }];
      if (midPoint) {
        endX = midPoint[0] - el.x;
        endY = midPoint[1] - el.y;
      }
    } else if (store.suggestedBindings.length > 0) {
      store.suggestedBindings = [];
    }

    const newPoints: LocalPoint[] = [
      el.points[0]!,
      [endX, endY] as LocalPoint,
    ];

    store.newElement = {
      ...el,
      points: newPoints,
      width: Math.abs(endX),
      height: Math.abs(endY),
      version: (el.version ?? 0) + 1,
    } as DrawElement;
    store.requestRender();
  }

  function handleShapeEnd() {
    store.clearSnapLines();
    if (!store.newElement) return;

    const el = store.newElement;
    const isLinear = el.type === 'line' || el.type === 'arrow';

    let { x, y, width, height } = el;

    if (!isLinear) {
      // normalize negative dimensions for shapes (not lines/arrows)
      if (width < 0) {
        x += width;
        width = -width;
      }
      if (height < 0) {
        y += height;
        height = -height;
      }
    } else {
      width = Math.abs(width);
      height = Math.abs(height);
    }

    if (width < 2 && height < 2) {
      store.newElement = null;
      store.requestRender();
      return;
    }

    const finalized = { ...el, x, y, width, height } as DrawElement;
    store.addElement(finalized);
    store.selectElement(finalized.id);

    if (isArrowElement(finalized)) {
      const arrow = finalized as DrawArrowElement;
      const startPt = [arrow.x + arrow.points[0]![0], arrow.y + arrow.points[0]![1]] as GlobalPoint;
      const endPt = [arrow.x + arrow.points[arrow.points.length - 1]![0], arrow.y + arrow.points[arrow.points.length - 1]![1]] as GlobalPoint;

      const startTarget = getHoveredElementForBinding(startPt, store.elements, store.zoom.value);
      if (startTarget && startTarget.id !== finalized.id) {
        bindArrowToElement(arrow, 'start', startTarget, store.scene);
      }
      const endTarget = getHoveredElementForBinding(endPt, store.elements, store.zoom.value);
      if (endTarget && endTarget.id !== finalized.id) {
        bindArrowToElement(arrow, 'end', endTarget, store.scene);
      }
    }

    store.newElement = null;
    store.suggestedBindings = [];

    if (!store.activeTool.locked) {
      store.setActiveTool('selection');
    }
    store.requestRender();
  }

  // ---- FreeDraw handlers ----
  function handleFreeDrawStart(x: number, y: number, e: PointerEvent) {
    const simulatePressure = e.pressure === 0 || e.pressure === 0.5;
    const el = newFreeDrawElement({
      x,
      y,
      strokeColor: store.currentItemStrokeColor,
      strokeWidth: store.currentItemStrokeWidth,
      opacity: store.currentItemOpacity,
      points: [[0, 0] as LocalPoint],
      pressures: simulatePressure ? [] : [e.pressure],
      simulatePressure,
    });
    store.newElement = el;
  }

  function handleFreeDrawMove(x: number, y: number, e: PointerEvent) {
    if (!store.newElement || store.newElement.type !== 'freedraw') return;
    const el = store.newElement as DrawFreeDrawElement;
    const dx = x - el.x;
    const dy = y - el.y;

    const lastPoint = el.points[el.points.length - 1];
    if (lastPoint && lastPoint[0] === dx && lastPoint[1] === dy) return;

    const pressures = el.simulatePressure
      ? el.pressures
      : [...el.pressures, e.pressure];

    store.newElement = {
      ...el,
      points: [...el.points, [dx, dy] as LocalPoint],
      pressures,
    } as DrawElement;
    store.requestRender();
  }

  function handleFreeDrawEnd(x: number, y: number, e: PointerEvent) {
    if (!store.newElement || store.newElement.type !== 'freedraw') return;
    const el = store.newElement as DrawFreeDrawElement;
    if (el.points.length < 2) {
      store.newElement = null;
      return;
    }

    const points = el.points;
    let dx = x - el.x;
    let dy = y - el.y;

    if (dx === points[0]![0] && dy === points[0]![1]) {
      dy += 0.0001;
      dx += 0.0001;
    }

    const pressures = el.simulatePressure
      ? []
      : [...el.pressures, e.pressure];

    const rawPoints = [...points, [dx, dy] as LocalPoint];

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of rawPoints) {
      minX = Math.min(minX, p[0]);
      minY = Math.min(minY, p[1]);
      maxX = Math.max(maxX, p[0]);
      maxY = Math.max(maxY, p[1]);
    }

    const normalizedPoints = rawPoints.map(
      (p) => [p[0] - minX, p[1] - minY] as LocalPoint,
    );

    const finalized = {
      ...el,
      x: el.x + minX,
      y: el.y + minY,
      points: normalizedPoints,
      pressures,
      width: maxX - minX,
      height: maxY - minY,
    } as DrawElement;

    store.addElement(finalized);
    store.newElement = null;
    store.requestRender();
  }

  // ---- Text handler ----
  function handleTextCreate(x: number, y: number) {
    const hitEl = store.getElementAtPosition(x, y);

    if (hitEl && isTextBindableContainer(hitEl)) {
      const existingText = getBoundTextElement(hitEl, store.scene);
      if (existingText) {
        store.editingTextElement = existingText as any;
        store.selectElement(hitEl.id);
      } else {
        const textEl = newTextElement({
          x: hitEl.x,
          y: hitEl.y,
          fontSize: store.currentItemFontSize,
          fontFamily: store.currentItemFontFamily,
          strokeColor: store.currentItemStrokeColor,
          opacity: store.currentItemOpacity,
          text: '',
          containerId: hitEl.id,
          textAlign: 'center',
          verticalAlign: 'middle',
        });
        store.addElement(textEl);
        bindTextToContainer(textEl, hitEl, store.scene);
        store.editingTextElement = store.scene.getElement(textEl.id) as any;
        store.selectElement(hitEl.id);
      }
    } else {
      const metrics = measureText('', store.currentItemFontSize, store.currentItemFontFamily, 1.25);
      const el = newTextElement({
        x,
        y,
        width: metrics.width,
        height: metrics.height,
        fontSize: store.currentItemFontSize,
        fontFamily: store.currentItemFontFamily,
        strokeColor: store.currentItemStrokeColor,
        opacity: store.currentItemOpacity,
        text: '',
      });
      store.addElement(el);
      store.editingTextElement = el;
      store.selectElement(el.id);
    }

    if (!store.activeTool.locked) {
      store.setActiveTool('selection');
    }
  }

  // ---- Eraser handlers ----
  function handleEraserStart(x: number, y: number) {
    eraserTrail = new EraserTrail();
    eraserOriginalOpacities = new Map();
    eraserTrail.addPoint(x, y, store.elements, store.zoom.value);
  }

  function handleEraserMove(x: number, y: number) {
    if (!eraserTrail) return;
    const erasedIds = eraserTrail.addPoint(x, y, store.elements, store.zoom.value);

    for (const el of store.elements) {
      if (erasedIds.has(el.id) && !eraserOriginalOpacities.has(el.id)) {
        eraserOriginalOpacities.set(el.id, el.opacity);
        store.updateElement(el.id, { opacity: 30 } as Partial<DrawElement>);
      }
    }
    store.requestRender();
  }

  function handleEraserEnd() {
    if (!eraserTrail) return;
    const erasedIds = eraserTrail.getErasedIds();
    if (erasedIds.size > 0) {
      for (const [id, opacity] of eraserOriginalOpacities) {
        store.updateElement(id, { opacity } as Partial<DrawElement>);
      }
      store.recordHistory();
      store.scene.deleteElements([...erasedIds]);
    }
    eraserOriginalOpacities.clear();
    eraserTrail.clear();
    eraserTrail = null;
    store.requestRender();
  }

  // ---- Double-click for bound text / linear edit ----
  function onDoubleClick(e: MouseEvent) {
    if (store.viewModeEnabled) return;
    const { x, y } = getSceneCoords(e as unknown as PointerEvent);
    const hitEl = store.getElementAtPosition(x, y);

    if (hitEl && hitEl.type === 'text') {
      const textEl = hitEl as any;
      store.editingTextElement = textEl;
      if (textEl.containerId) {
        store.selectElement(textEl.containerId);
      } else {
        store.selectElement(hitEl.id);
      }
      return;
    }

    if (hitEl && checkIsLinear(hitEl)) {
      const existingText = getBoundTextElement(hitEl, store.scene);
      if (existingText) {
        store.editingTextElement = existingText as any;
        store.selectElement(hitEl.id);
      } else if (hitEl.type === 'arrow') {
        const textEl = newTextElement({
          x: hitEl.x,
          y: hitEl.y,
          fontSize: store.currentItemFontSize,
          fontFamily: store.currentItemFontFamily,
          strokeColor: store.currentItemStrokeColor,
          opacity: store.currentItemOpacity,
          text: '',
          containerId: hitEl.id,
          textAlign: 'center',
          verticalAlign: 'middle',
        });
        store.addElement(textEl);
        bindTextToContainer(textEl, hitEl, store.scene);
        store.editingTextElement = store.scene.getElement(textEl.id) as any;
        store.selectElement(hitEl.id);
      } else {
        store.editingLinearElement = createLinearEditorState(hitEl.id);
        store.selectElement(hitEl.id);
        store.requestRender();
      }
      return;
    }

    if (hitEl && isTextBindableContainer(hitEl)) {
      const existingText = getBoundTextElement(hitEl, store.scene);
      if (existingText) {
        store.editingTextElement = existingText as any;
        store.selectElement(hitEl.id);
      } else {
        const textEl = newTextElement({
          x: hitEl.x,
          y: hitEl.y,
          fontSize: store.currentItemFontSize,
          fontFamily: store.currentItemFontFamily,
          strokeColor: store.currentItemStrokeColor,
          opacity: store.currentItemOpacity,
          text: '',
          containerId: hitEl.id,
          textAlign: 'center',
          verticalAlign: 'middle',
        });
        store.addElement(textEl);
        bindTextToContainer(textEl, hitEl, store.scene);
        store.editingTextElement = store.scene.getElement(textEl.id) as any;
        store.selectElement(hitEl.id);
      }
      return;
    }

    if (!hitEl) {
      const textEl = newTextElement({
        x,
        y,
        fontSize: store.currentItemFontSize,
        fontFamily: store.currentItemFontFamily,
        strokeColor: store.currentItemStrokeColor,
        opacity: store.currentItemOpacity,
        text: '',
      });
      store.addElement(textEl);
      store.editingTextElement = textEl;
      store.selectElement(textEl.id);
      store.setActiveTool('selection');
    }
  }

  // ---- Binding suggestion ----
  function updateBindingSuggestion(x: number, y: number) {
    const point = [x, y] as GlobalPoint;
    const hovered = getHoveredElementForBinding(point, store.elements, store.zoom.value);

    if (hovered) {
      const midPoint = getSnapMidpointNear(point, hovered, store.zoom.value);
      store.suggestedBindings = [{ element: hovered, midPoint }];
      store.requestRender();
    } else if (store.suggestedBindings.length > 0) {
      store.suggestedBindings = [];
      store.requestRender();
    }
  }

  // ---- Cursor ----
  function setCursor(cursor: string) {
    if (containerRef.value) {
      containerRef.value.style.cursor = cursor;
    }
  }

  function updateCursor(x: number, y: number) {
    const tool = store.activeTool.type;

    if (tool === 'arrow' || tool === 'line') {
      updateBindingSuggestion(x, y);
      setCursor(getCursorForTool(tool));
      return;
    }

    if (tool !== 'selection') {
      if (store.suggestedBindings.length > 0) {
        store.suggestedBindings = [];
        store.requestRender();
      }
      setCursor(getCursorForTool(tool));
      return;
    }

    // check linear editor point handles
    if (store.editingLinearElement) {
      const el = store.scene.getElement(store.editingLinearElement.elementId);
      if (el && checkIsLinear(el)) {
        const ptIdx = getLinearPointIndexAtPosition(el, x, y, store.zoom.value);
        if (ptIdx !== null) {
          setCursor('pointer');
          return;
        }
      }
    }

    // check linear point handles for selected linear elements
    if (store.selectedElements.length === 1) {
      const el = store.selectedElements[0]!;
      if (checkIsLinear(el)) {
        const ptIdx = getLinearPointIndexAtPosition(el, x, y, store.zoom.value);
        if (ptIdx !== null) {
          setCursor('pointer');
          return;
        }
      }
    }

    // check transform handles
    if (store.selectedElements.length === 1) {
      const el = store.selectedElements[0]!;
      const handle = getTransformHandleAtPoint(el, [x, y], store.zoom.value);
      if (handle) {
        setCursor(handle === 'rotation' ? 'grab' : `${handle}-resize`);
        return;
      }
    }

    const hitEl = store.getElementAtPosition(x, y);
    setCursor(hitEl ? 'move' : 'default');
  }

  // ---- Space key for panning ----
  function onKeyDown(e: KeyboardEvent) {
    if (e.code === 'Space' && !spacePressed) {
      spacePressed = true;
      setCursor('grab');
    }
  }

  function onKeyUp(e: KeyboardEvent) {
    if (e.code === 'Space') {
      spacePressed = false;
      setCursor(getCursorForTool(store.activeTool.type));
    }
  }

  function attach() {
    const el = containerRef.value;
    if (!el) return;
    el.style.touchAction = 'none';
    el.addEventListener('pointerdown', onPointerDown);
    el.addEventListener('pointermove', onPointerMove);
    el.addEventListener('pointerup', onPointerUp);
    el.addEventListener('pointerleave', onPointerUp);
    el.addEventListener('pointercancel', onPointerUp);
    el.addEventListener('dblclick', onDoubleClick);
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);
  }

  function detach() {
    const el = containerRef.value;
    if (!el) return;
    el.removeEventListener('pointerdown', onPointerDown);
    el.removeEventListener('pointermove', onPointerMove);
    el.removeEventListener('pointerup', onPointerUp);
    el.removeEventListener('pointerleave', onPointerUp);
    el.removeEventListener('pointercancel', onPointerUp);
    el.removeEventListener('dblclick', onDoubleClick);
    document.removeEventListener('keydown', onKeyDown);
    document.removeEventListener('keyup', onKeyUp);
  }

  return { attach, detach };
}

// ---- Resize computation ----
function computeResize(
  original: DrawElement,
  handle: TransformHandleType,
  x: number,
  y: number,
  startX: number,
  startY: number,
): Partial<DrawElement> {
  const dx = x - startX;
  const dy = y - startY;
  let { x: ox, y: oy, width: ow, height: oh } = original;

  switch (handle) {
    case 'se':
      return { width: ow + dx, height: oh + dy } as any;
    case 'nw':
      return { x: ox + dx, y: oy + dy, width: ow - dx, height: oh - dy } as any;
    case 'ne':
      return { y: oy + dy, width: ow + dx, height: oh - dy } as any;
    case 'sw':
      return { x: ox + dx, width: ow - dx, height: oh + dy } as any;
    case 'n':
      return { y: oy + dy, height: oh - dy } as any;
    case 's':
      return { height: oh + dy } as any;
    case 'w':
      return { x: ox + dx, width: ow - dx } as any;
    case 'e':
      return { width: ow + dx } as any;
    default:
      return {};
  }
}
