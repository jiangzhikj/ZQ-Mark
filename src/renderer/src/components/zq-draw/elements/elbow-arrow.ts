import type { Scene } from '../core/scene';
import type {
  DrawArrowElement,
  DrawElement,
  GlobalPoint,
  LocalPoint,
} from '../types';
import { getElementBounds } from './bounds';

const DONGLE_LENGTH = 24;
const MIN_SEGMENT_LENGTH = 10;

type Direction = 'up' | 'down' | 'left' | 'right';

interface ElbowRouteContext {
  startPoint: GlobalPoint;
  endPoint: GlobalPoint;
  startDir: Direction;
  endDir: Direction;
  startBounds: [number, number, number, number] | null;
  endBounds: [number, number, number, number] | null;
}

/**
 * Determine the heading direction from a point on an element's outline.
 */
function getHeadingFromElement(
  point: GlobalPoint,
  element: DrawElement | null,
): Direction {
  if (!element) return 'right';

  const cx = element.x + element.width / 2;
  const cy = element.y + element.height / 2;
  const dx = point[0] - cx;
  const dy = point[1] - cy;

  if (Math.abs(dx) > Math.abs(dy)) {
    return dx > 0 ? 'right' : 'left';
  }
  return dy > 0 ? 'down' : 'up';
}

function getDirVector(dir: Direction): [number, number] {
  switch (dir) {
    case 'up': return [0, -1];
    case 'down': return [0, 1];
    case 'left': return [-1, 0];
    case 'right': return [1, 0];
  }
}

function oppositeDir(dir: Direction): Direction {
  switch (dir) {
    case 'up': return 'down';
    case 'down': return 'up';
    case 'left': return 'right';
    case 'right': return 'left';
  }
}

function isHorizontal(dir: Direction): boolean {
  return dir === 'left' || dir === 'right';
}

/**
 * Simplified elbow arrow routing.
 * Produces an orthogonal path with at most 5 segments (L, Z, or U shape).
 */
function routeElbow(ctx: ElbowRouteContext): GlobalPoint[] {
  const { startPoint, endPoint, startDir, endDir } = ctx;
  const [sx, sy] = startPoint;
  const [ex, ey] = endPoint;

  const sv = getDirVector(startDir);
  const ev = getDirVector(oppositeDir(endDir));

  const dongleStart: GlobalPoint = [
    sx + sv[0] * DONGLE_LENGTH,
    sy + sv[1] * DONGLE_LENGTH,
  ] as GlobalPoint;

  const dongleEnd: GlobalPoint = [
    ex + ev[0] * DONGLE_LENGTH,
    ey + ev[1] * DONGLE_LENGTH,
  ] as GlobalPoint;

  const [dsx, dsy] = dongleStart;
  const [dex, dey] = dongleEnd;

  if (isHorizontal(startDir) && !isHorizontal(endDir)) {
    return [startPoint, dongleStart, [dsx, dey] as GlobalPoint, dongleEnd, endPoint];
  }

  if (!isHorizontal(startDir) && isHorizontal(endDir)) {
    return [startPoint, dongleStart, [dex, dsy] as GlobalPoint, dongleEnd, endPoint];
  }

  if (isHorizontal(startDir) && isHorizontal(endDir)) {
    const midX = (dsx + dex) / 2;
    return [
      startPoint,
      dongleStart,
      [midX, dsy] as GlobalPoint,
      [midX, dey] as GlobalPoint,
      dongleEnd,
      endPoint,
    ];
  }

  const midY = (dsy + dey) / 2;
  return [
    startPoint,
    dongleStart,
    [dsx, midY] as GlobalPoint,
    [dex, midY] as GlobalPoint,
    dongleEnd,
    endPoint,
  ];
}

/**
 * Remove redundant collinear points from the path.
 */
function simplifyPath(points: GlobalPoint[]): GlobalPoint[] {
  if (points.length <= 2) return points;

  const result: GlobalPoint[] = [points[0]!];
  for (let i = 1; i < points.length - 1; i++) {
    const prev = result[result.length - 1]!;
    const curr = points[i]!;
    const next = points[i + 1]!;

    const sameX = Math.abs(prev[0] - curr[0]) < 0.5 && Math.abs(curr[0] - next[0]) < 0.5;
    const sameY = Math.abs(prev[1] - curr[1]) < 0.5 && Math.abs(curr[1] - next[1]) < 0.5;

    if (!sameX && !sameY) {
      result.push(curr);
    } else if (sameX || sameY) {
      // skip collinear
    } else {
      result.push(curr);
    }
  }
  result.push(points[points.length - 1]!);
  return result;
}

/**
 * Calculate elbow arrow points for a given arrow element.
 */
export function calculateElbowArrowPoints(
  arrow: DrawArrowElement,
  scene: Scene,
): LocalPoint[] {
  const firstPoint = arrow.points[0]!;
  const lastPoint = arrow.points[arrow.points.length - 1]!;

  const startGlobal: GlobalPoint = [
    arrow.x + firstPoint[0],
    arrow.y + firstPoint[1],
  ] as GlobalPoint;

  const endGlobal: GlobalPoint = [
    arrow.x + lastPoint[0],
    arrow.y + lastPoint[1],
  ] as GlobalPoint;

  let startElement: DrawElement | null = null;
  let endElement: DrawElement | null = null;
  let startBounds: [number, number, number, number] | null = null;
  let endBounds: [number, number, number, number] | null = null;

  if (arrow.startBinding) {
    startElement = scene.getElement(arrow.startBinding.elementId) || null;
    if (startElement) startBounds = getElementBounds(startElement) as [number, number, number, number];
  }
  if (arrow.endBinding) {
    endElement = scene.getElement(arrow.endBinding.elementId) || null;
    if (endElement) endBounds = getElementBounds(endElement) as [number, number, number, number];
  }

  const startDir = getHeadingFromElement(startGlobal, startElement);
  const endDir = getHeadingFromElement(endGlobal, endElement);

  const ctx: ElbowRouteContext = {
    startPoint: startGlobal,
    endPoint: endGlobal,
    startDir,
    endDir,
    startBounds,
    endBounds,
  };

  const globalPath = routeElbow(ctx);
  const simplified = simplifyPath(globalPath);

  return simplified.map(
    (p) => [p[0] - arrow.x, p[1] - arrow.y] as LocalPoint,
  );
}

/**
 * Update an elbow arrow's points after binding changes or element moves.
 */
export function updateElbowArrowPoints(
  arrow: DrawArrowElement,
  scene: Scene,
): void {
  if (!arrow.elbowed) return;

  const newPoints = calculateElbowArrowPoints(arrow, scene);
  scene.mutateElement(arrow.id, { points: newPoints } as Partial<DrawElement>);
}
