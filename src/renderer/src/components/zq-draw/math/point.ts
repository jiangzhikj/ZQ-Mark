import type { Point, Vector } from './types';

export function pointFrom(x: number, y: number): Point {
  return [x, y];
}

export function pointDistance(a: Point, b: Point): number {
  return Math.hypot(b[0] - a[0], b[1] - a[1]);
}

export function pointDistanceSq(a: Point, b: Point): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  return dx * dx + dy * dy;
}

export function pointAdd(a: Point, b: Vector): Point {
  return [a[0] + b[0], a[1] + b[1]];
}

export function pointSubtract(a: Point, b: Point): Vector {
  return [a[0] - b[0], a[1] - b[1]];
}

export function pointScale(p: Point, s: number): Point {
  return [p[0] * s, p[1] * s];
}

export function pointMidpoint(a: Point, b: Point): Point {
  return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
}

export function pointRotate(
  p: Point,
  angle: number,
  center: Point = [0, 0],
): Point {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const dx = p[0] - center[0];
  const dy = p[1] - center[1];
  return [center[0] + dx * cos - dy * sin, center[1] + dx * sin + dy * cos];
}

export function pointLerp(a: Point, b: Point, t: number): Point {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

export function pointEquals(a: Point, b: Point, tolerance = 0): boolean {
  return (
    Math.abs(a[0] - b[0]) <= tolerance && Math.abs(a[1] - b[1]) <= tolerance
  );
}

export function vectorLength(v: Vector): number {
  return Math.hypot(v[0], v[1]);
}

export function vectorNormalize(v: Vector): Vector {
  const len = vectorLength(v);
  if (len === 0) return [0, 0];
  return [v[0] / len, v[1] / len];
}

export function vectorDot(a: Vector, b: Vector): number {
  return a[0] * b[0] + a[1] * b[1];
}

export function vectorCross(a: Vector, b: Vector): number {
  return a[0] * b[1] - a[1] * b[0];
}

export function vectorPerpendicular(v: Vector): Vector {
  return [-v[1], v[0]];
}
