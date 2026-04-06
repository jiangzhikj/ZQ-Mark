import type { Line, Point } from './types';
import { pointDistanceSq } from './point';

export function lineLength(line: Line): number {
  return Math.hypot(line[1][0] - line[0][0], line[1][1] - line[0][1]);
}

export function lineMidpoint(line: Line): Point {
  return [(line[0][0] + line[1][0]) / 2, (line[0][1] + line[1][1]) / 2];
}

export function lineAngle(line: Line): number {
  return Math.atan2(line[1][1] - line[0][1], line[1][0] - line[0][0]);
}

/**
 * Returns the closest point on a line segment to a given point,
 * and the distance squared.
 */
export function lineClosestPoint(
  line: Line,
  p: Point,
): { point: Point; distanceSq: number } {
  const [a, b] = line;
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const lenSq = dx * dx + dy * dy;

  if (lenSq === 0) {
    return { point: a, distanceSq: pointDistanceSq(a, p) };
  }

  let t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));

  const closest: Point = [a[0] + t * dx, a[1] + t * dy];
  return { point: closest, distanceSq: pointDistanceSq(closest, p) };
}

export function lineIntersectsLine(
  l1: Line,
  l2: Line,
): Point | null {
  const [a, b] = l1;
  const [c, d] = l2;

  const denom =
    (d[1] - c[1]) * (b[0] - a[0]) - (d[0] - c[0]) * (b[1] - a[1]);
  if (Math.abs(denom) < 1e-10) return null;

  const ua =
    ((d[0] - c[0]) * (a[1] - c[1]) - (d[1] - c[1]) * (a[0] - c[0])) / denom;
  const ub =
    ((b[0] - a[0]) * (a[1] - c[1]) - (b[1] - a[1]) * (a[0] - c[0])) / denom;

  if (ua < 0 || ua > 1 || ub < 0 || ub > 1) return null;

  return [a[0] + ua * (b[0] - a[0]), a[1] + ua * (b[1] - a[1])];
}
