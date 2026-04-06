import type { DrawElement, DrawLinearElement, DrawFreeDrawElement } from '../types';
import type { Bounds } from '../math/types';
import { pointRotate } from '../math/point';

/**
 * Get the axis-aligned bounding box of an element, accounting for rotation.
 */
export function getElementBounds(element: DrawElement): Bounds {
  if (isLinearLike(element)) {
    return getLinearElementBounds(element as DrawLinearElement);
  }
  if (element.type === 'freedraw') {
    return getFreeDrawBounds(element as DrawFreeDrawElement);
  }
  return getGenericElementBounds(element);
}

function getGenericElementBounds(element: DrawElement): Bounds {
  const { x, y, width, height, angle } = element;

  if (angle === 0) {
    return [x, y, x + width, y + height];
  }

  const cx = x + width / 2;
  const cy = y + height / 2;
  const corners: [number, number][] = [
    [x, y],
    [x + width, y],
    [x + width, y + height],
    [x, y + height],
  ];

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const corner of corners) {
    const rotated = pointRotate(corner, angle, [cx, cy]);
    minX = Math.min(minX, rotated[0]);
    minY = Math.min(minY, rotated[1]);
    maxX = Math.max(maxX, rotated[0]);
    maxY = Math.max(maxY, rotated[1]);
  }

  return [minX, minY, maxX, maxY];
}

/**
 * Returns the unrotated local bounding box of a linear element's points.
 * Does NOT account for element.angle.
 */
export function getLinearElementLocalBounds(element: DrawLinearElement): Bounds {
  const { x, y, points } = element;
  if (points.length === 0) {
    return [x, y, x, y];
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const point of points) {
    const px = x + point[0];
    const py = y + point[1];
    minX = Math.min(minX, px);
    minY = Math.min(minY, py);
    maxX = Math.max(maxX, px);
    maxY = Math.max(maxY, py);
  }

  return [minX, minY, maxX, maxY];
}

function getLinearElementBounds(element: DrawLinearElement): Bounds {
  const { x, y, points, angle } = element;
  if (points.length === 0) {
    return [x, y, x, y];
  }

  const cx = x + element.width / 2;
  const cy = y + element.height / 2;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const point of points) {
    let px = x + point[0];
    let py = y + point[1];
    if (angle !== 0) {
      const rotated = pointRotate([px, py], angle, [cx, cy]);
      px = rotated[0];
      py = rotated[1];
    }
    minX = Math.min(minX, px);
    minY = Math.min(minY, py);
    maxX = Math.max(maxX, px);
    maxY = Math.max(maxY, py);
  }

  return [minX, minY, maxX, maxY];
}

function getFreeDrawBounds(element: DrawFreeDrawElement): Bounds {
  const { x, y, points } = element;
  if (points.length === 0) {
    return [x, y, x, y];
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const point of points) {
    const px = x + point[0];
    const py = y + point[1];
    minX = Math.min(minX, px);
    minY = Math.min(minY, py);
    maxX = Math.max(maxX, px);
    maxY = Math.max(maxY, py);
  }

  return [minX, minY, maxX, maxY];
}

export function getCommonBounds(
  elements: readonly DrawElement[],
): Bounds {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const el of elements) {
    const [x1, y1, x2, y2] = getElementBounds(el);
    minX = Math.min(minX, x1);
    minY = Math.min(minY, y1);
    maxX = Math.max(maxX, x2);
    maxY = Math.max(maxY, y2);
  }

  return [minX, minY, maxX, maxY];
}

export function getElementCenter(element: DrawElement): [number, number] {
  const [x1, y1, x2, y2] = getElementBounds(element);
  return [(x1 + x2) / 2, (y1 + y2) / 2];
}

function isLinearLike(element: DrawElement): boolean {
  return element.type === 'line' || element.type === 'arrow';
}
