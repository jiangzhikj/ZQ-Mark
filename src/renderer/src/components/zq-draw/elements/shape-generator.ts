import rough from 'roughjs';
import type { RoughCanvas } from 'roughjs/bin/canvas';
import type { Drawable } from 'roughjs/bin/core';
import getStroke from 'perfect-freehand';
import type {
  DrawElement,
  DrawLinearElement,
  DrawArrowElement,
  DrawFreeDrawElement,
  Arrowhead,
} from '../types';
import {
  ROUNDNESS,
  DEFAULT_PROPORTIONAL_RADIUS,
  DEFAULT_ADAPTIVE_RADIUS,
} from '../constants';

const cache = new Map<string, Drawable>();

function getCacheKey(element: DrawElement): string {
  const r = element.roundness ? element.roundness.type : 0;
  return `${element.id}_${element.version}_${element.seed}_${r}`;
}

function getLineDash(strokeStyle: string): number[] | undefined {
  switch (strokeStyle) {
    case 'dashed':
      return [12, 8];
    case 'dotted':
      return [3, 6];
    default:
      return undefined;
  }
}

function getRoughOptions(element: DrawElement) {
  return {
    seed: element.seed,
    roughness: element.roughness,
    fill:
      element.backgroundColor !== 'transparent'
        ? element.backgroundColor
        : undefined,
    fillStyle: element.fillStyle as string,
    stroke: element.strokeColor,
    strokeWidth: element.strokeWidth,
    strokeLineDash: getLineDash(element.strokeStyle),
  };
}

function getCornerRadius(x: number, element: DrawElement): number {
  if (
    element.roundness?.type === ROUNDNESS.PROPORTIONAL_RADIUS ||
    element.roundness?.type === ROUNDNESS.LEGACY
  ) {
    return x * DEFAULT_PROPORTIONAL_RADIUS;
  }

  if (element.roundness?.type === ROUNDNESS.ADAPTIVE_RADIUS) {
    const fixedRadiusSize =
      element.roundness?.value ?? DEFAULT_ADAPTIVE_RADIUS;
    const CUTOFF_SIZE = fixedRadiusSize / DEFAULT_PROPORTIONAL_RADIUS;

    if (x <= CUTOFF_SIZE) {
      return x * DEFAULT_PROPORTIONAL_RADIUS;
    }
    return fixedRadiusSize;
  }

  return 0;
}

export function generateRoughDrawable(element: DrawElement): Drawable | null {
  const key = getCacheKey(element);
  const cached = cache.get(key);
  if (cached) return cached;

  const gen = rough.generator();
  const opts = getRoughOptions(element);
  let drawable: Drawable | null = null;

  switch (element.type) {
    case 'rectangle': {
      if (element.roundness) {
        const w = element.width;
        const h = element.height;
        const r = getCornerRadius(Math.min(w, h), element);
        drawable = gen.path(
          `M ${r} 0 L ${w - r} 0 Q ${w} 0, ${w} ${r} L ${w} ${h - r} Q ${w} ${h}, ${w - r} ${h} L ${r} ${h} Q 0 ${h}, 0 ${h - r} L 0 ${r} Q 0 0, ${r} 0`,
          opts,
        );
      } else {
        drawable = gen.rectangle(0, 0, element.width, element.height, opts);
      }
      break;
    }
    case 'ellipse':
      drawable = gen.ellipse(
        element.width / 2,
        element.height / 2,
        element.width,
        element.height,
        opts,
      );
      break;
    case 'diamond': {
      const w = element.width;
      const h = element.height;
      const topX = Math.floor(w / 2) + 1;
      const topY = 0;
      const rightX = w;
      const rightY = Math.floor(h / 2) + 1;
      const bottomX = topX;
      const bottomY = h;
      const leftX = 0;
      const leftY = rightY;

      if (element.roundness) {
        const verticalRadius = getCornerRadius(
          Math.abs(topX - leftX),
          element,
        );
        const horizontalRadius = getCornerRadius(
          Math.abs(rightY - topY),
          element,
        );
        drawable = gen.path(
          `M ${topX + verticalRadius} ${topY + horizontalRadius} L ${rightX - verticalRadius} ${rightY - horizontalRadius} C ${rightX} ${rightY}, ${rightX} ${rightY}, ${rightX - verticalRadius} ${rightY + horizontalRadius} L ${bottomX + verticalRadius} ${bottomY - horizontalRadius} C ${bottomX} ${bottomY}, ${bottomX} ${bottomY}, ${bottomX - verticalRadius} ${bottomY - horizontalRadius} L ${leftX + verticalRadius} ${leftY + horizontalRadius} C ${leftX} ${leftY}, ${leftX} ${leftY}, ${leftX + verticalRadius} ${leftY - horizontalRadius} L ${topX - verticalRadius} ${topY + horizontalRadius} C ${topX} ${topY}, ${topX} ${topY}, ${topX + verticalRadius} ${topY + horizontalRadius}`,
          opts,
        );
      } else {
        drawable = gen.polygon(
          [
            [topX, topY],
            [rightX, rightY],
            [bottomX, bottomY],
            [leftX, leftY],
          ],
          opts,
        );
      }
      break;
    }
    case 'line':
    case 'arrow': {
      const linear = element as DrawLinearElement;
      if (linear.points.length >= 2) {
        const pts = linear.points.map((p) => [p[0], p[1]] as [number, number]);
        if (pts.length === 2) {
          drawable = gen.line(pts[0]![0], pts[0]![1], pts[1]![0], pts[1]![1], opts);
        } else if (element.roundness) {
          drawable = gen.curve(pts, opts);
        } else {
          drawable = gen.linearPath(pts, opts);
        }
      }
      break;
    }
    default:
      return null;
  }

  if (drawable) {
    cache.set(key, drawable);
    if (cache.size > 5000) {
      const firstKey = cache.keys().next().value;
      if (firstKey) cache.delete(firstKey);
    }
  }

  return drawable;
}

export function drawElementOnCanvas(
  rc: RoughCanvas,
  ctx: CanvasRenderingContext2D,
  element: DrawElement,
): void {
  ctx.save();
  ctx.translate(element.x, element.y);

  if (element.angle !== 0) {
    const cx = element.width / 2;
    const cy = element.height / 2;
    ctx.translate(cx, cy);
    ctx.rotate(element.angle);
    ctx.translate(-cx, -cy);
  }

  ctx.globalAlpha = element.opacity / 100;

  if (element.type === 'freedraw') {
    drawFreeDraw(ctx, element as DrawFreeDrawElement);
  } else if (element.type === 'text') {
    // text is rendered separately
  } else if (element.type === 'image') {
    // image is rendered separately
  } else if (element.type === 'arrow' && (element as DrawArrowElement).elbowed) {
    drawElbowedArrowPath(ctx, element as DrawArrowElement);
    drawArrowheads(ctx, element as DrawArrowElement);
  } else {
    const drawable = generateRoughDrawable(element);
    if (drawable) {
      rc.draw(drawable);
    }

    if (element.type === 'arrow' || element.type === 'line') {
      const linear = element as DrawLinearElement;
      if (linear.startArrowhead || linear.endArrowhead) {
        drawArrowheads(ctx, element as DrawArrowElement);
      }
    }
  }

  ctx.restore();
}

export function getFreeDrawOutlinePoints(
  element: DrawFreeDrawElement,
): number[][] {
  const inputPoints = element.simulatePressure
    ? element.points
    : element.points.length
      ? element.points.map(([x, y], i) => [x, y, element.pressures[i] ?? 0.5])
      : [[0, 0, 0.5]];

  return getStroke(inputPoints as number[][], {
    simulatePressure: element.simulatePressure,
    size: element.strokeWidth * 4.25,
    thinning: 0.6,
    smoothing: 0.5,
    streamline: 0.5,
    easing: (t: number) => Math.sin((t * Math.PI) / 2),
    last: true,
  });
}

function med(a: number[], b: number[]): number[] {
  return [(a[0]! + b[0]!) / 2, (a[1]! + b[1]!) / 2];
}

export function getSvgPathFromStroke(points: number[][]): string {
  if (!points.length) return '';

  const max = points.length - 1;
  return points
    .reduce(
      (acc: (string | number[])[], point, i, arr) => {
        if (i === max) {
          acc.push(point, med(point, arr[0]!), 'L', arr[0]!, 'Z');
        } else {
          acc.push(point, med(point, arr[i + 1]!));
        }
        return acc;
      },
      ['M', points[0]!, 'Q'],
    )
    .join(' ')
    .replace(/(\.\d{2})\d+/g, '$1');
}

function drawFreeDraw(
  ctx: CanvasRenderingContext2D,
  element: DrawFreeDrawElement,
): void {
  if (element.points.length < 2) return;

  const outlinePoints = getFreeDrawOutlinePoints(element);
  const pathData = getSvgPathFromStroke(outlinePoints);
  if (!pathData) return;

  const path = new Path2D(pathData);
  ctx.fillStyle = element.strokeColor;
  ctx.fill(path);
}

function drawArrowheads(
  ctx: CanvasRenderingContext2D,
  element: DrawArrowElement,
): void {
  if (element.points.length < 2) return;

  ctx.strokeStyle = element.strokeColor;
  ctx.fillStyle = element.strokeColor;
  ctx.lineWidth = element.strokeWidth;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  if (element.startArrowhead) {
    const p0 = element.points[0]!;
    const p1 = element.points[1]!;
    const angle = Math.atan2(p0[1] - p1[1], p0[0] - p1[0]);
    drawSingleArrowhead(ctx, p0[0], p0[1], angle, element.startArrowhead, element.strokeWidth);
  }

  if (element.endArrowhead) {
    const lastIdx = element.points.length - 1;
    const pLast = element.points[lastIdx]!;
    const pPrev = element.points[lastIdx - 1]!;
    const angle = Math.atan2(pLast[1] - pPrev[1], pLast[0] - pPrev[0]);
    drawSingleArrowhead(ctx, pLast[0], pLast[1], angle, element.endArrowhead, element.strokeWidth);
  }
}

function drawSingleArrowhead(
  ctx: CanvasRenderingContext2D,
  tipX: number,
  tipY: number,
  angle: number,
  style: Arrowhead,
  strokeWidth: number,
): void {
  const arrowLen = strokeWidth * 4 + 8;
  const arrowAngle = Math.PI / 6;
  const radius = strokeWidth * 2 + 4;

  switch (style) {
    case 'arrow': {
      ctx.beginPath();
      ctx.moveTo(
        tipX - arrowLen * Math.cos(angle - arrowAngle),
        tipY - arrowLen * Math.sin(angle - arrowAngle),
      );
      ctx.lineTo(tipX, tipY);
      ctx.lineTo(
        tipX - arrowLen * Math.cos(angle + arrowAngle),
        tipY - arrowLen * Math.sin(angle + arrowAngle),
      );
      ctx.stroke();
      break;
    }
    case 'triangle': {
      ctx.beginPath();
      ctx.moveTo(tipX, tipY);
      ctx.lineTo(
        tipX - arrowLen * Math.cos(angle - arrowAngle),
        tipY - arrowLen * Math.sin(angle - arrowAngle),
      );
      ctx.lineTo(
        tipX - arrowLen * Math.cos(angle + arrowAngle),
        tipY - arrowLen * Math.sin(angle + arrowAngle),
      );
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      break;
    }
    case 'triangle_outline': {
      ctx.beginPath();
      ctx.moveTo(tipX, tipY);
      ctx.lineTo(
        tipX - arrowLen * Math.cos(angle - arrowAngle),
        tipY - arrowLen * Math.sin(angle - arrowAngle),
      );
      ctx.lineTo(
        tipX - arrowLen * Math.cos(angle + arrowAngle),
        tipY - arrowLen * Math.sin(angle + arrowAngle),
      );
      ctx.closePath();
      ctx.stroke();
      break;
    }
    case 'bar': {
      const perpAngle = angle + Math.PI / 2;
      ctx.beginPath();
      ctx.moveTo(
        tipX + radius * Math.cos(perpAngle),
        tipY + radius * Math.sin(perpAngle),
      );
      ctx.lineTo(
        tipX - radius * Math.cos(perpAngle),
        tipY - radius * Math.sin(perpAngle),
      );
      ctx.stroke();
      break;
    }
    case 'circle': {
      ctx.beginPath();
      ctx.arc(
        tipX - radius * Math.cos(angle),
        tipY - radius * Math.sin(angle),
        radius,
        0,
        Math.PI * 2,
      );
      ctx.fill();
      ctx.stroke();
      break;
    }
    case 'circle_outline': {
      ctx.beginPath();
      ctx.arc(
        tipX - radius * Math.cos(angle),
        tipY - radius * Math.sin(angle),
        radius,
        0,
        Math.PI * 2,
      );
      ctx.stroke();
      break;
    }
    case 'diamond': {
      const dLen = radius * 1.4;
      const cx = tipX - dLen * Math.cos(angle);
      const cy = tipY - dLen * Math.sin(angle);
      ctx.beginPath();
      ctx.moveTo(tipX, tipY);
      ctx.lineTo(
        cx + radius * Math.cos(angle + Math.PI / 2),
        cy + radius * Math.sin(angle + Math.PI / 2),
      );
      ctx.lineTo(
        cx - dLen * Math.cos(angle) + tipX - cx,
        cy - dLen * Math.sin(angle) + tipY - cy,
      );
      ctx.lineTo(
        cx - radius * Math.cos(angle + Math.PI / 2),
        cy - radius * Math.sin(angle + Math.PI / 2),
      );
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      break;
    }
    case 'diamond_outline': {
      const dLen2 = radius * 1.4;
      const cx2 = tipX - dLen2 * Math.cos(angle);
      const cy2 = tipY - dLen2 * Math.sin(angle);
      ctx.beginPath();
      ctx.moveTo(tipX, tipY);
      ctx.lineTo(
        cx2 + radius * Math.cos(angle + Math.PI / 2),
        cy2 + radius * Math.sin(angle + Math.PI / 2),
      );
      ctx.lineTo(
        cx2 - dLen2 * Math.cos(angle) + tipX - cx2,
        cy2 - dLen2 * Math.sin(angle) + tipY - cy2,
      );
      ctx.lineTo(
        cx2 - radius * Math.cos(angle + Math.PI / 2),
        cy2 - radius * Math.sin(angle + Math.PI / 2),
      );
      ctx.closePath();
      ctx.stroke();
      break;
    }
  }
}

/**
 * Draw an elbowed (orthogonal) arrow path as straight line segments.
 */
function drawElbowedArrowPath(
  ctx: CanvasRenderingContext2D,
  element: DrawArrowElement,
): void {
  if (element.points.length < 2) return;

  ctx.strokeStyle = element.strokeColor;
  ctx.lineWidth = element.strokeWidth;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const dash = getLineDash(element.strokeStyle);
  if (dash) ctx.setLineDash(dash);

  ctx.beginPath();
  ctx.moveTo(element.points[0]![0], element.points[0]![1]);
  for (let i = 1; i < element.points.length; i++) {
    ctx.lineTo(element.points[i]![0], element.points[i]![1]);
  }
  ctx.stroke();

  if (dash) ctx.setLineDash([]);
}

export function clearShapeCache(): void {
  cache.clear();
}
