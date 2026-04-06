import type { DrawElement, GlobalPoint, NonDeletedDrawElement } from '../types';
import { getElementBounds } from '../elements/bounds';
import { pointDistance } from '../math/point';
import type { Point } from '../math/types';

const ERASER_RADIUS = 10;

export class EraserTrail {
  private points: GlobalPoint[] = [];
  private erasedIds = new Set<string>();

  addPoint(
    x: number,
    y: number,
    elements: readonly NonDeletedDrawElement[],
    zoom: number,
  ): Set<string> {
    const point: GlobalPoint = [x, y] as GlobalPoint;
    this.points.push(point);

    if (this.points.length < 2) return this.erasedIds;

    const prev = this.points[this.points.length - 2]!;
    const curr = this.points[this.points.length - 1]!;
    const radius = ERASER_RADIUS / zoom;

    for (const el of elements) {
      if (this.erasedIds.has(el.id) || el.locked) continue;
      if (el.type === 'selection') continue;

      if (this.testElement([prev, curr], el, radius)) {
        this.erasedIds.add(el.id);
        this.addRelatedElements(el, elements);
      }
    }

    return this.erasedIds;
  }

  private testElement(
    segment: [GlobalPoint, GlobalPoint],
    element: DrawElement,
    radius: number,
  ): boolean {
    const [x1, y1, x2, y2] = getElementBounds(element);
    const expandedBounds = [
      x1 - radius,
      y1 - radius,
      x2 + radius,
      y2 + radius,
    ];

    if (!this.segmentIntersectsBounds(segment, expandedBounds)) {
      return false;
    }

    const cx = (x1 + x2) / 2;
    const cy = (y1 + y2) / 2;
    const dist = distanceToSegment(
      [cx, cy] as Point,
      [segment[0][0], segment[0][1]] as Point,
      [segment[1][0], segment[1][1]] as Point,
    );

    const elementRadius = Math.max(x2 - x1, y2 - y1) / 2;
    return dist <= elementRadius + radius;
  }

  private segmentIntersectsBounds(
    segment: [GlobalPoint, GlobalPoint],
    bounds: number[],
  ): boolean {
    const [sx1, sy1] = segment[0];
    const [sx2, sy2] = segment[1];
    const [bx1, by1, bx2, by2] = bounds;

    const minSx = Math.min(sx1, sx2);
    const maxSx = Math.max(sx1, sx2);
    const minSy = Math.min(sy1, sy2);
    const maxSy = Math.max(sy1, sy2);

    return maxSx >= bx1! && minSx <= bx2! && maxSy >= by1! && minSy <= by2!;
  }

  private addRelatedElements(
    element: DrawElement,
    elements: readonly NonDeletedDrawElement[],
  ): void {
    if (element.groupIds.length > 0) {
      for (const el of elements) {
        for (const gid of element.groupIds) {
          if (el.groupIds.includes(gid)) {
            this.erasedIds.add(el.id);
          }
        }
      }
    }

    if (element.boundElements) {
      for (const bound of element.boundElements) {
        this.erasedIds.add(bound.id);
      }
    }
  }

  getErasedIds(): Set<string> {
    return this.erasedIds;
  }

  clear(): void {
    this.points = [];
    this.erasedIds.clear();
  }
}

function distanceToSegment(p: Point, a: Point, b: Point): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const lenSq = dx * dx + dy * dy;

  if (lenSq === 0) {
    return pointDistance(p, a);
  }

  let t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));

  const projX = a[0] + t * dx;
  const projY = a[1] + t * dy;

  return pointDistance(p, [projX, projY]);
}
