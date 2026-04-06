import type { DrawElement, DrawLinearElement, DrawFreeDrawElement, GlobalPoint } from '../types';
import { getElementBounds } from './bounds';
import { pointRotate, pointDistance } from '../math/point';
import type { Point } from '../math/types';
import { lineClosestPoint } from '../math/line';

const HIT_THRESHOLD = 10;

/**
 * Test if a scene point hits an element.
 */
export function hitTest(
  element: DrawElement,
  scenePoint: GlobalPoint,
  zoom: number = 1,
): boolean {
  const threshold = HIT_THRESHOLD / zoom;

  if (element.type === 'line' || element.type === 'arrow') {
    return hitTestLinear(element as DrawLinearElement, scenePoint, threshold);
  }

  if (element.type === 'freedraw') {
    return hitTestFreeDraw(element as DrawFreeDrawElement, scenePoint, threshold);
  }

  if (element.type === 'diamond') {
    return hitTestDiamond(element, scenePoint, threshold);
  }

  if (element.type === 'ellipse') {
    return hitTestEllipse(element, scenePoint, threshold);
  }

  return hitTestGeneric(element, scenePoint, threshold);
}

function hitTestGeneric(
  element: DrawElement,
  scenePoint: GlobalPoint,
  threshold: number,
): boolean {
  const { x, y, width, height, angle } = element;
  const cx = x + width / 2;
  const cy = y + height / 2;

  const rotatedPoint = angle !== 0
    ? pointRotate(scenePoint as unknown as Point, -angle, [cx, cy])
    : (scenePoint as unknown as Point);

  const px = rotatedPoint[0];
  const py = rotatedPoint[1];

  if (element.backgroundColor !== 'transparent') {
    return (
      px >= x - threshold &&
      px <= x + width + threshold &&
      py >= y - threshold &&
      py <= y + height + threshold
    );
  }

  const nearLeft = Math.abs(px - x) <= threshold && py >= y - threshold && py <= y + height + threshold;
  const nearRight = Math.abs(px - (x + width)) <= threshold && py >= y - threshold && py <= y + height + threshold;
  const nearTop = Math.abs(py - y) <= threshold && px >= x - threshold && px <= x + width + threshold;
  const nearBottom = Math.abs(py - (y + height)) <= threshold && px >= x - threshold && px <= x + width + threshold;

  return nearLeft || nearRight || nearTop || nearBottom;
}

function hitTestDiamond(
  element: DrawElement,
  scenePoint: GlobalPoint,
  threshold: number,
): boolean {
  const { x, y, width, height, angle } = element;
  const cx = x + width / 2;
  const cy = y + height / 2;

  const rotatedPoint = angle !== 0
    ? pointRotate(scenePoint as unknown as Point, -angle, [cx, cy])
    : (scenePoint as unknown as Point);

  const px = rotatedPoint[0];
  const py = rotatedPoint[1];

  // A point is inside a diamond if |dx/a| + |dy/b| <= 1
  // where a = width/2, b = height/2, dx/dy are relative to center
  const a = width / 2;
  const b = height / 2;
  if (a === 0 || b === 0) return false;

  const dx = Math.abs(px - cx);
  const dy = Math.abs(py - cy);
  const normalizedDist = dx / a + dy / b;

  if (element.backgroundColor !== 'transparent') {
    // filled: hit if inside diamond + threshold
    const thresholdNorm = threshold / Math.min(a, b);
    return normalizedDist <= 1 + thresholdNorm;
  }

  // stroke only: hit if near the diamond border
  const thresholdNorm = threshold / Math.min(a, b);
  return normalizedDist >= 1 - thresholdNorm && normalizedDist <= 1 + thresholdNorm;
}

function hitTestEllipse(
  element: DrawElement,
  scenePoint: GlobalPoint,
  threshold: number,
): boolean {
  const { x, y, width, height, angle } = element;
  const cx = x + width / 2;
  const cy = y + height / 2;

  const rotatedPoint = angle !== 0
    ? pointRotate(scenePoint as unknown as Point, -angle, [cx, cy])
    : (scenePoint as unknown as Point);

  const px = rotatedPoint[0];
  const py = rotatedPoint[1];

  const a = width / 2;
  const b = height / 2;
  if (a === 0 || b === 0) return false;

  const dx = px - cx;
  const dy = py - cy;

  if (element.backgroundColor !== 'transparent') {
    const thresholdA = a + threshold;
    const thresholdB = b + threshold;
    return (dx * dx) / (thresholdA * thresholdA) + (dy * dy) / (thresholdB * thresholdB) <= 1;
  }

  const outerA = a + threshold;
  const outerB = b + threshold;
  const innerA = Math.max(a - threshold, 0);
  const innerB = Math.max(b - threshold, 0);

  const outerDist = (dx * dx) / (outerA * outerA) + (dy * dy) / (outerB * outerB);
  const innerDist = innerA > 0 && innerB > 0
    ? (dx * dx) / (innerA * innerA) + (dy * dy) / (innerB * innerB)
    : 2; // always "outside" inner if too small

  return outerDist <= 1 && innerDist >= 1;
}

function hitTestLinear(
  element: DrawLinearElement,
  scenePoint: GlobalPoint,
  threshold: number,
): boolean {
  const { x, y, points, angle } = element;
  const cx = x + element.width / 2;
  const cy = y + element.height / 2;

  const sp: Point = angle !== 0
    ? pointRotate([scenePoint[0], scenePoint[1]], -angle, [cx, cy])
    : [scenePoint[0], scenePoint[1]];

  for (let i = 0; i < points.length - 1; i++) {
    const a: Point = [x + points[i]![0], y + points[i]![1]];
    const b: Point = [x + points[i + 1]![0], y + points[i + 1]![1]];
    const { distanceSq } = lineClosestPoint([a, b], sp);
    if (Math.sqrt(distanceSq) <= threshold) {
      return true;
    }
  }
  return false;
}

function hitTestFreeDraw(
  element: DrawFreeDrawElement,
  scenePoint: GlobalPoint,
  threshold: number,
): boolean {
  const { x, y, points, strokeWidth } = element;
  const sp: Point = [scenePoint[0], scenePoint[1]];
  const visualThreshold = threshold + (strokeWidth * 4.25) / 2;

  for (let i = 0; i < points.length - 1; i++) {
    const a: Point = [x + points[i]![0], y + points[i]![1]];
    const b: Point = [x + points[i + 1]![0], y + points[i + 1]![1]];
    const { distanceSq } = lineClosestPoint([a, b], sp);
    if (Math.sqrt(distanceSq) <= visualThreshold) {
      return true;
    }
  }

  if (points.length === 1) {
    const d = pointDistance([x + points[0]![0], y + points[0]![1]], sp);
    if (d <= visualThreshold) return true;
  }

  return false;
}

/**
 * Test if an element is inside a selection box.
 */
export function isElementInsideBox(
  element: DrawElement,
  box: { x: number; y: number; width: number; height: number },
): boolean {
  const [x1, y1, x2, y2] = getElementBounds(element);
  const bx1 = Math.min(box.x, box.x + box.width);
  const by1 = Math.min(box.y, box.y + box.height);
  const bx2 = Math.max(box.x, box.x + box.width);
  const by2 = Math.max(box.y, box.y + box.height);

  return x1 >= bx1 && y1 >= by1 && x2 <= bx2 && y2 <= by2;
}

/**
 * Test if an element overlaps a selection box.
 */
export function isElementOverlappingBox(
  element: DrawElement,
  box: { x: number; y: number; width: number; height: number },
): boolean {
  const [x1, y1, x2, y2] = getElementBounds(element);
  const bx1 = Math.min(box.x, box.x + box.width);
  const by1 = Math.min(box.y, box.y + box.height);
  const bx2 = Math.max(box.x, box.x + box.width);
  const by2 = Math.max(box.y, box.y + box.height);

  return x1 <= bx2 && x2 >= bx1 && y1 <= by2 && y2 >= by1;
}
