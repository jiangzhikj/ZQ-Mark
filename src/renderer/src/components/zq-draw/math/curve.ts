import type { Point } from './types';

/**
 * Evaluate a quadratic Bezier curve at parameter t.
 */
export function quadraticBezier(
  p0: Point,
  p1: Point,
  p2: Point,
  t: number,
): Point {
  const mt = 1 - t;
  return [
    mt * mt * p0[0] + 2 * mt * t * p1[0] + t * t * p2[0],
    mt * mt * p0[1] + 2 * mt * t * p1[1] + t * t * p2[1],
  ];
}

/**
 * Evaluate a cubic Bezier curve at parameter t.
 */
export function cubicBezier(
  p0: Point,
  p1: Point,
  p2: Point,
  p3: Point,
  t: number,
): Point {
  const mt = 1 - t;
  const mt2 = mt * mt;
  const t2 = t * t;
  return [
    mt2 * mt * p0[0] +
      3 * mt2 * t * p1[0] +
      3 * mt * t2 * p2[0] +
      t2 * t * p3[0],
    mt2 * mt * p0[1] +
      3 * mt2 * t * p1[1] +
      3 * mt * t2 * p2[1] +
      t2 * t * p3[1],
  ];
}

/**
 * Approximate the length of a cubic Bezier curve by sampling.
 */
export function cubicBezierLength(
  p0: Point,
  p1: Point,
  p2: Point,
  p3: Point,
  steps = 50,
): number {
  let length = 0;
  let prev = p0;
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const curr = cubicBezier(p0, p1, p2, p3, t);
    length += Math.hypot(curr[0] - prev[0], curr[1] - prev[1]);
    prev = curr;
  }
  return length;
}

/**
 * Sample points along a cubic Bezier curve.
 */
export function cubicBezierPoints(
  p0: Point,
  p1: Point,
  p2: Point,
  p3: Point,
  count: number,
): Point[] {
  const points: Point[] = [];
  for (let i = 0; i <= count; i++) {
    points.push(cubicBezier(p0, p1, p2, p3, i / count));
  }
  return points;
}
