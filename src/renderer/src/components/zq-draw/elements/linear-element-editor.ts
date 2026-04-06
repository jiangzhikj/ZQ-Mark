import type {
  DrawLinearElement,
  DrawElement,
  LocalPoint,
  GlobalPoint,
  LinearElementEditorState,
} from '../types';
import {
  getLinearPointIndexAtPosition,
  getLinearMidpointIndexAtPosition,
} from './transform-handles';

export function createLinearEditorState(
  elementId: string,
): LinearElementEditorState {
  return {
    elementId,
    selectedPointIndices: [],
    isDragging: false,
    dragStartPoint: null,
    lastDragPoint: null,
  };
}

export function isLinearElement(el: DrawElement): el is DrawLinearElement {
  return el.type === 'line' || el.type === 'arrow';
}

export function getPointGlobalCoords(
  element: DrawLinearElement,
  pointIndex: number,
): GlobalPoint {
  const pt = element.points[pointIndex];
  if (!pt) return [element.x, element.y] as GlobalPoint;
  return [element.x + pt[0], element.y + pt[1]] as GlobalPoint;
}

export function handleLinearEditorPointerDown(
  state: LinearElementEditorState,
  element: DrawLinearElement,
  sceneX: number,
  sceneY: number,
  zoom: number,
): { action: 'drag-point' | 'add-midpoint' | 'none'; pointIndex?: number } {
  const hitIndex = getLinearPointIndexAtPosition(element, sceneX, sceneY, zoom);
  if (hitIndex !== null) {
    state.selectedPointIndices = [hitIndex];
    state.isDragging = true;
    state.dragStartPoint = [sceneX, sceneY] as GlobalPoint;
    state.lastDragPoint = [sceneX, sceneY] as GlobalPoint;
    return { action: 'drag-point', pointIndex: hitIndex };
  }

  const midIndex = getLinearMidpointIndexAtPosition(element, sceneX, sceneY, zoom);
  if (midIndex !== null) {
    return { action: 'add-midpoint', pointIndex: midIndex };
  }

  return { action: 'none' };
}

export function handleLinearEditorPointerMove(
  state: LinearElementEditorState,
  element: DrawLinearElement,
  sceneX: number,
  sceneY: number,
  shiftKey: boolean,
): DrawLinearElement | null {
  if (!state.isDragging || state.selectedPointIndices.length === 0) return null;

  const dx = sceneX - (state.lastDragPoint?.[0] ?? sceneX);
  const dy = sceneY - (state.lastDragPoint?.[1] ?? sceneY);
  state.lastDragPoint = [sceneX, sceneY] as GlobalPoint;

  const newPoints = [...element.points] as LocalPoint[];
  for (const idx of state.selectedPointIndices) {
    const pt = newPoints[idx];
    if (!pt) continue;

    let newX = pt[0] + dx;
    let newY = pt[1] + dy;

    if (shiftKey && element.points.length >= 2) {
      const prevIdx = idx > 0 ? idx - 1 : idx + 1;
      const prevPt = newPoints[prevIdx];
      if (prevPt) {
        const angle = Math.atan2(newY - prevPt[1], newX - prevPt[0]);
        const snapped = Math.round(angle / (Math.PI / 4)) * (Math.PI / 4);
        const dist = Math.hypot(newX - prevPt[0], newY - prevPt[1]);
        newX = prevPt[0] + Math.cos(snapped) * dist;
        newY = prevPt[1] + Math.sin(snapped) * dist;
      }
    }

    newPoints[idx] = [newX, newY] as LocalPoint;
  }

  const normalized = normalizePoints(newPoints);

  return {
    ...element,
    x: element.x + normalized.offsetX,
    y: element.y + normalized.offsetY,
    points: normalized.points,
    width: normalized.width,
    height: normalized.height,
  } as DrawLinearElement;
}

export function handleLinearEditorPointerUp(
  state: LinearElementEditorState,
): void {
  state.isDragging = false;
  state.dragStartPoint = null;
  state.lastDragPoint = null;
}

export function addPointAtMidpoint(
  element: DrawLinearElement,
  segmentIndex: number,
): { updatedElement: DrawLinearElement; newPointIndex: number } {
  const p1 = element.points[segmentIndex]!;
  const p2 = element.points[segmentIndex + 1]!;
  const midPoint: LocalPoint = [
    (p1[0] + p2[0]) / 2,
    (p1[1] + p2[1]) / 2,
  ] as LocalPoint;

  const newPoints = [...element.points];
  newPoints.splice(segmentIndex + 1, 0, midPoint);

  return {
    updatedElement: {
      ...element,
      points: newPoints as readonly LocalPoint[],
    } as DrawLinearElement,
    newPointIndex: segmentIndex + 1,
  };
}

export function deletePoints(
  element: DrawLinearElement,
  indices: number[],
): DrawLinearElement | null {
  if (element.points.length - indices.length < 2) return null;

  const indexSet = new Set(indices);
  const newPoints = element.points.filter(
    (_, i) => !indexSet.has(i),
  ) as LocalPoint[];

  const normalized = normalizePoints(newPoints);

  return {
    ...element,
    x: element.x + normalized.offsetX,
    y: element.y + normalized.offsetY,
    points: normalized.points,
    width: normalized.width,
    height: normalized.height,
  } as DrawLinearElement;
}

function normalizePoints(points: LocalPoint[]): {
  points: LocalPoint[];
  offsetX: number;
  offsetY: number;
  width: number;
  height: number;
} {
  if (points.length === 0) {
    return { points: [], offsetX: 0, offsetY: 0, width: 0, height: 0 };
  }

  const first = points[0]!;
  const offsetX = first[0];
  const offsetY = first[1];

  const normalized = points.map(
    (p) => [p[0] - offsetX, p[1] - offsetY] as LocalPoint,
  );

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of normalized) {
    minX = Math.min(minX, p[0]);
    minY = Math.min(minY, p[1]);
    maxX = Math.max(maxX, p[0]);
    maxY = Math.max(maxY, p[1]);
  }

  return {
    points: normalized,
    offsetX,
    offsetY,
    width: Math.abs(maxX - minX),
    height: Math.abs(maxY - minY),
  };
}
