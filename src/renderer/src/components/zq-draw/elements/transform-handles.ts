import type {
  DrawElement,
  DrawLinearElement,
  TransformHandleType,
  LocalPoint,
} from '../types';
import { TRANSFORM_HANDLE_SIZE, ROTATION_HANDLE_OFFSET } from '../constants';
import { pointRotate } from '../math/point';
import type { Point } from '../math/types';
import { getLinearElementLocalBounds } from './bounds';

export interface TransformHandle {
  type: TransformHandleType;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface LinearPointHandle {
  index: number;
  x: number;
  y: number;
  size: number;
}

function isLinearElement(el: DrawElement): el is DrawLinearElement {
  return el.type === 'line' || el.type === 'arrow';
}

function rotateLinearPoint(
  element: DrawLinearElement,
  px: number,
  py: number,
): [number, number] {
  if (element.angle === 0) return [px, py];
  const cx = element.x + element.width / 2;
  const cy = element.y + element.height / 2;
  return pointRotate([px, py], element.angle, [cx, cy]);
}

export function getLinearPointHandles(
  element: DrawElement,
  zoom: number,
): LinearPointHandle[] {
  if (!isLinearElement(element)) return [];

  const size = TRANSFORM_HANDLE_SIZE / zoom;
  return element.points.map((pt: LocalPoint, index: number) => {
    const [rx, ry] = rotateLinearPoint(element, element.x + pt[0], element.y + pt[1]);
    return { index, x: rx, y: ry, size };
  });
}

export function getLinearMidpointHandles(
  element: DrawElement,
  zoom: number,
): LinearPointHandle[] {
  if (!isLinearElement(element)) return [];
  if (element.points.length < 2) return [];

  const size = (TRANSFORM_HANDLE_SIZE * 0.7) / zoom;
  const midpoints: LinearPointHandle[] = [];

  for (let i = 0; i < element.points.length - 1; i++) {
    const p1 = element.points[i]!;
    const p2 = element.points[i + 1]!;
    const mx = element.x + (p1[0] + p2[0]) / 2;
    const my = element.y + (p1[1] + p2[1]) / 2;
    const [rx, ry] = rotateLinearPoint(element, mx, my);
    midpoints.push({ index: i, x: rx, y: ry, size });
  }

  return midpoints;
}

export function getLinearPointIndexAtPosition(
  element: DrawElement,
  sceneX: number,
  sceneY: number,
  zoom: number,
): number | null {
  const handles = getLinearPointHandles(element, zoom);
  const threshold = (TRANSFORM_HANDLE_SIZE / zoom) * 1.5;

  for (const h of handles) {
    if (Math.hypot(sceneX - h.x, sceneY - h.y) <= threshold) {
      return h.index;
    }
  }
  return null;
}

export function getLinearMidpointIndexAtPosition(
  element: DrawElement,
  sceneX: number,
  sceneY: number,
  zoom: number,
): number | null {
  const handles = getLinearMidpointHandles(element, zoom);
  const threshold = (TRANSFORM_HANDLE_SIZE / zoom) * 1.5;

  for (const h of handles) {
    if (Math.hypot(sceneX - h.x, sceneY - h.y) <= threshold) {
      return h.index;
    }
  }
  return null;
}

export function getTransformHandles(
  element: DrawElement,
  zoom: number,
  omitSides: Partial<Record<TransformHandleType, boolean>> = DEFAULT_OMIT_SIDES,
): TransformHandle[] {
  const isLinear = isLinearElement(element);

  if (isLinear) {
    const linear = element as DrawLinearElement;
    if (!linear.points || linear.points.length <= 2) {
      return [];
    }
  }

  const size = TRANSFORM_HANDLE_SIZE / zoom;
  const halfSize = size / 2;
  const pad = SELECTION_PADDING / zoom;

  let x1: number, y1: number, x2: number, y2: number, cx: number, cy: number;
  let effectiveAngle: number;

  if (isLinear) {
    const [bx1, by1, bx2, by2] = getLinearElementLocalBounds(element as DrawLinearElement);
    x1 = bx1 - pad;
    y1 = by1 - pad;
    x2 = bx2 + pad;
    y2 = by2 + pad;
    cx = element.x + element.width / 2;
    cy = element.y + element.height / 2;
    effectiveAngle = element.angle;
  } else {
    const { x, y, width, height } = element;
    x1 = x - pad;
    y1 = y - pad;
    x2 = x + width + pad;
    y2 = y + height + pad;
    cx = x + width / 2;
    cy = y + height / 2;
    effectiveAngle = element.angle;
  }

  const allHandles: TransformHandle[] = [];

  if (!omitSides.nw) allHandles.push({ type: 'nw', x: x1 - halfSize, y: y1 - halfSize, width: size, height: size });
  if (!omitSides.ne) allHandles.push({ type: 'ne', x: x2 - halfSize, y: y1 - halfSize, width: size, height: size });
  if (!omitSides.sw) allHandles.push({ type: 'sw', x: x1 - halfSize, y: y2 - halfSize, width: size, height: size });
  if (!omitSides.se) allHandles.push({ type: 'se', x: x2 - halfSize, y: y2 - halfSize, width: size, height: size });
  if (!omitSides.n) allHandles.push({ type: 'n', x: cx - halfSize, y: y1 - halfSize, width: size, height: size });
  if (!omitSides.s) allHandles.push({ type: 's', x: cx - halfSize, y: y2 - halfSize, width: size, height: size });
  if (!omitSides.w) allHandles.push({ type: 'w', x: x1 - halfSize, y: cy - halfSize, width: size, height: size });
  if (!omitSides.e) allHandles.push({ type: 'e', x: x2 - halfSize, y: cy - halfSize, width: size, height: size });

  if (!omitSides.rotation) {
    const rotOffset = ROTATION_HANDLE_OFFSET / zoom;
    allHandles.push({
      type: 'rotation',
      x: cx - halfSize,
      y: y1 - rotOffset - halfSize,
      width: size,
      height: size,
    });
  }

  if (effectiveAngle !== 0) {
    const center: Point = [cx, cy];
    return allHandles.map((h) => {
      const hCenter: Point = [h.x + h.width / 2, h.y + h.height / 2];
      const rotated = pointRotate(hCenter, effectiveAngle, center);
      return {
        ...h,
        x: rotated[0] - h.width / 2,
        y: rotated[1] - h.height / 2,
      };
    });
  }

  return allHandles;
}

export const DEFAULT_OMIT_SIDES: Partial<Record<TransformHandleType, boolean>> = {
  n: true,
  s: true,
  e: true,
  w: true,
};

export const SELECTION_PADDING = 4;

export function getTransformHandleAtPoint(
  element: DrawElement,
  point: [number, number],
  zoom: number,
): TransformHandleType | null {
  const handles = getTransformHandles(element, zoom);
  const threshold = (TRANSFORM_HANDLE_SIZE / zoom) * 1.5;

  for (const handle of handles) {
    const hx = handle.x + handle.width / 2;
    const hy = handle.y + handle.height / 2;
    const dx = point[0] - hx;
    const dy = point[1] - hy;
    if (Math.hypot(dx, dy) <= threshold) {
      return handle.type;
    }
  }

  return null;
}
