import type { Scene } from '../core/scene';
import type {
  DrawElement,
  DrawArrowElement,
  DrawLinearElement,
  BoundElement,
  FixedPointBinding,
  GlobalPoint,
  NonDeletedDrawElement,
} from '../types';
import { getElementBounds } from './bounds';
import { pointDistance, pointRotate } from '../math/point';
import type { Point } from '../math/types';
import { handleBoundTextResize } from './bound-text';

const BINDING_THRESHOLD = 15;
const SNAP_DISTANCE = 15;

const BINDABLE_TYPES = new Set([
  'rectangle',
  'ellipse',
  'diamond',
  'frame',
  'image',
  'embeddable',
]);

export function isBindableElement(element: DrawElement): boolean {
  return BINDABLE_TYPES.has(element.type);
}

export function isLinearElement(element: DrawElement): element is DrawLinearElement {
  return element.type === 'line' || element.type === 'arrow';
}

export function isArrowElement(element: DrawElement): element is DrawArrowElement {
  return element.type === 'arrow';
}

/**
 * Find the closest bindable element near a point, preferring smaller shapes.
 */
export function getHoveredElementForBinding(
  point: GlobalPoint,
  elements: readonly NonDeletedDrawElement[],
  zoom: number = 1,
): NonDeletedDrawElement | null {
  const threshold = BINDING_THRESHOLD / zoom;
  const candidates: NonDeletedDrawElement[] = [];

  for (let i = elements.length - 1; i >= 0; i--) {
    const el = elements[i]!;
    if (!isBindableElement(el) || el.locked) continue;
    if (isPointNearElement(point, el, threshold)) {
      candidates.push(el);
    }
  }

  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0]!;

  return candidates.sort(
    (a, b) => b.width ** 2 + b.height ** 2 - (a.width ** 2 + a.height ** 2),
  ).pop()!;
}

function isPointNearElement(
  point: GlobalPoint,
  element: DrawElement,
  threshold: number,
): boolean {
  const [x1, y1, x2, y2] = getElementBounds(element);
  return (
    point[0] >= x1 - threshold &&
    point[0] <= x2 + threshold &&
    point[1] >= y1 - threshold &&
    point[1] <= y2 + threshold
  );
}

/**
 * Calculate the fixed point ratio (0-1 range) for a point on an element.
 */
export function calculateFixedPoint(
  point: GlobalPoint,
  element: DrawElement,
): [number, number] {
  const { x, y, width, height, angle } = element;
  const cx = x + width / 2;
  const cy = y + height / 2;

  const localPoint = angle !== 0
    ? pointRotate([point[0], point[1]] as Point, -angle, [cx, cy])
    : [point[0], point[1]];

  const ratioX = width === 0 ? 0.5 : Math.max(0, Math.min(1, (localPoint[0] - x) / width));
  const ratioY = height === 0 ? 0.5 : Math.max(0, Math.min(1, (localPoint[1] - y) / height));

  return [ratioX, ratioY];
}

/**
 * Convert a fixed point ratio back to a global coordinate.
 */
export function getGlobalFixedPoint(
  fixedPoint: [number, number],
  element: DrawElement,
): GlobalPoint {
  const { x, y, width, height, angle } = element;
  const localX = x + fixedPoint[0] * width;
  const localY = y + fixedPoint[1] * height;

  if (angle === 0) {
    return [localX, localY] as GlobalPoint;
  }

  const cx = x + width / 2;
  const cy = y + height / 2;
  const rotated = pointRotate([localX, localY] as Point, angle, [cx, cy]);
  return rotated as unknown as GlobalPoint;
}

/**
 * Find the intersection point of a line from element center to a target point
 * with the element's outline.
 */
export function intersectElementOutline(
  element: DrawElement,
  targetPoint: GlobalPoint,
): GlobalPoint {
  const { x, y, width, height, angle } = element;
  const cx = x + width / 2;
  const cy = y + height / 2;

  const localTarget = angle !== 0
    ? pointRotate([targetPoint[0], targetPoint[1]] as Point, -angle, [cx, cy])
    : [targetPoint[0], targetPoint[1]];

  let intersectX: number;
  let intersectY: number;

  if (element.type === 'ellipse') {
    const rx = width / 2;
    const ry = height / 2;
    const dx = localTarget[0] - cx;
    const dy = localTarget[1] - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist === 0) {
      intersectX = cx + rx;
      intersectY = cy;
    } else {
      const ndx = dx / dist;
      const ndy = dy / dist;
      const t = 1 / Math.sqrt((ndx / rx) ** 2 + (ndy / ry) ** 2);
      intersectX = cx + ndx * t;
      intersectY = cy + ndy * t;
    }
  } else if (element.type === 'diamond') {
    const dx = localTarget[0] - cx;
    const dy = localTarget[1] - cy;
    const hw = width / 2;
    const hh = height / 2;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);
    if (absDx === 0 && absDy === 0) {
      intersectX = cx;
      intersectY = cy - hh;
    } else {
      const t = 1 / (absDx / hw + absDy / hh);
      intersectX = cx + dx * t;
      intersectY = cy + dy * t;
    }
  } else {
    const dx = localTarget[0] - cx;
    const dy = localTarget[1] - cy;
    const hw = width / 2;
    const hh = height / 2;

    if (dx === 0 && dy === 0) {
      intersectX = cx + hw;
      intersectY = cy;
    } else {
      const scaleX = hw / Math.abs(dx || 1);
      const scaleY = hh / Math.abs(dy || 1);
      const scale = Math.min(scaleX, scaleY);
      intersectX = cx + dx * scale;
      intersectY = cy + dy * scale;
    }
  }

  if (angle !== 0) {
    const rotated = pointRotate(
      [intersectX, intersectY] as Point,
      angle,
      [cx, cy],
    );
    return rotated as unknown as GlobalPoint;
  }

  return [intersectX, intersectY] as GlobalPoint;
}

/**
 * Bind an arrow endpoint to a target element.
 */
export function bindArrowToElement(
  arrow: DrawArrowElement,
  endpoint: 'start' | 'end',
  target: DrawElement,
  scene: Scene,
): void {
  const pointIndex = endpoint === 'start' ? 0 : arrow.points.length - 1;
  const point = arrow.points[pointIndex]!;
  const globalPoint: GlobalPoint = [
    arrow.x + point[0],
    arrow.y + point[1],
  ] as GlobalPoint;

  const fixedPoint = calculateFixedPoint(globalPoint, target);
  const binding: FixedPointBinding = {
    elementId: target.id,
    fixedPoint,
  };

  const bindingKey = endpoint === 'start' ? 'startBinding' : 'endBinding';
  scene.mutateElement(arrow.id, {
    [bindingKey]: binding,
  } as Partial<DrawElement>);

  const existingBound = target.boundElements || [];
  if (!existingBound.some((b) => b.id === arrow.id)) {
    const newBound: BoundElement[] = [
      ...existingBound,
      { id: arrow.id, type: 'arrow' },
    ];
    scene.mutateElement(target.id, {
      boundElements: newBound,
    } as Partial<DrawElement>);
  }
}

/**
 * Unbind an arrow endpoint from its bound element.
 */
export function unbindArrowFromElement(
  arrow: DrawArrowElement,
  endpoint: 'start' | 'end',
  scene: Scene,
): void {
  const bindingKey = endpoint === 'start' ? 'startBinding' : 'endBinding';
  const binding = arrow[bindingKey];
  if (!binding) return;

  scene.mutateElement(arrow.id, {
    [bindingKey]: null,
  } as Partial<DrawElement>);

  const target = scene.getElement(binding.elementId);
  if (target && target.boundElements) {
    const newBound = target.boundElements.filter((b) => b.id !== arrow.id);
    scene.mutateElement(target.id, {
      boundElements: newBound.length > 0 ? newBound : null,
    } as Partial<DrawElement>);
  }
}

/**
 * After a bindable element is moved/resized, update all arrows bound to it.
 */
export function updateBoundElements(
  element: DrawElement,
  scene: Scene,
): void {
  if (!element.boundElements) return;

  for (const bound of element.boundElements) {
    if (bound.type !== 'arrow') continue;

    const arrow = scene.getElement(bound.id) as DrawArrowElement | undefined;
    if (!arrow || arrow.isDeleted) continue;

    updateArrowBinding(arrow, element, scene);

    const updatedArrow = scene.getElement(bound.id);
    if (updatedArrow) {
      handleBoundTextResize(updatedArrow, scene);
    }
  }
}

function updateArrowBinding(
  arrow: DrawArrowElement,
  boundElement: DrawElement,
  scene: Scene,
): void {
  const updates: Partial<DrawLinearElement> = {};
  let changed = false;

  if (arrow.startBinding?.elementId === boundElement.id) {
    const outlinePoint = intersectElementOutline(boundElement, getArrowOtherEnd(arrow, 'start'));
    const newLocal = [outlinePoint[0] - arrow.x, outlinePoint[1] - arrow.y] as unknown;
    const newPoints = [...arrow.points];
    newPoints[0] = newLocal as any;
    updates.points = newPoints;
    changed = true;
  }

  if (arrow.endBinding?.elementId === boundElement.id) {
    const lastIdx = arrow.points.length - 1;
    const outlinePoint = intersectElementOutline(boundElement, getArrowOtherEnd(arrow, 'end'));
    const newLocal = [outlinePoint[0] - arrow.x, outlinePoint[1] - arrow.y] as unknown;
    const newPoints = updates.points ? [...updates.points] : [...arrow.points];
    newPoints[lastIdx] = newLocal as any;
    updates.points = newPoints;
    changed = true;
  }

  if (changed) {
    scene.mutateElement(arrow.id, updates as Partial<DrawElement>);
  }
}

function getArrowOtherEnd(
  arrow: DrawArrowElement,
  currentEndpoint: 'start' | 'end',
): GlobalPoint {
  if (currentEndpoint === 'start') {
    const lastPoint = arrow.points[arrow.points.length - 1]!;
    return [arrow.x + lastPoint[0], arrow.y + lastPoint[1]] as GlobalPoint;
  }
  const firstPoint = arrow.points[0]!;
  return [arrow.x + firstPoint[0], arrow.y + firstPoint[1]] as GlobalPoint;
}

/**
 * Get the four edge midpoints of a bindable element, accounting for rotation.
 */
export function getElementSnapPoints(element: DrawElement): GlobalPoint[] {
  const { x, y, width, height, angle } = element;
  const cx = x + width / 2;
  const cy = y + height / 2;

  let midpoints: Point[];
  if (element.type === 'diamond') {
    midpoints = [
      [cx, y],           // top vertex
      [x + width, cy],   // right vertex
      [cx, y + height],  // bottom vertex
      [x, cy],           // left vertex
    ];
  } else if (element.type === 'ellipse') {
    midpoints = [
      [cx, y],           // top
      [x + width, cy],   // right
      [cx, y + height],  // bottom
      [x, cy],           // left
    ];
  } else {
    midpoints = [
      [cx, y],           // top
      [x + width, cy],   // right
      [cx, y + height],  // bottom
      [x, cy],           // left
    ];
  }

  if (angle === 0) {
    return midpoints as unknown as GlobalPoint[];
  }

  return midpoints.map(
    (p) => pointRotate(p, angle, [cx, cy]) as unknown as GlobalPoint,
  );
}

/**
 * Find the closest snap midpoint on an element near a given point.
 */
export function getSnapMidpointNear(
  point: GlobalPoint,
  element: DrawElement,
  zoom: number,
): GlobalPoint | null {
  const threshold = SNAP_DISTANCE / zoom;
  const midpoints = getElementSnapPoints(element);
  let closest: GlobalPoint | null = null;
  let minDist = Infinity;

  for (const mp of midpoints) {
    const d = pointDistance(
      [point[0], point[1]] as Point,
      [mp[0], mp[1]] as Point,
    );
    if (d <= threshold && d < minDist) {
      minDist = d;
      closest = mp;
    }
  }

  return closest;
}

/**
 * Unbind all arrows from an element (used before deletion).
 */
export function unbindAllBoundElements(
  element: DrawElement,
  scene: Scene,
): void {
  if (!element.boundElements) return;

  for (const bound of element.boundElements) {
    const boundEl = scene.getElement(bound.id);
    if (!boundEl || boundEl.isDeleted) continue;

    if (bound.type === 'arrow' && isArrowElement(boundEl)) {
      if (boundEl.startBinding?.elementId === element.id) {
        scene.mutateElement(boundEl.id, { startBinding: null } as Partial<DrawElement>);
      }
      if (boundEl.endBinding?.elementId === element.id) {
        scene.mutateElement(boundEl.id, { endBinding: null } as Partial<DrawElement>);
      }
    }
  }
}
