import type {
  DrawElement,
  DrawTextElement,
  DrawLinearElement,
  DrawFreeDrawElement,
  DrawImageElement,
  DrawFrameElement,
  Arrowhead,
  AppState,
  BinaryFiles,
} from '../types';
import { getCommonBounds } from '../elements/bounds';
import { FONT_FAMILY_FALLBACKS, SELECTION_BORDER_COLOR, getVerticalOffset } from '../constants';
import { getLineHeightInPx, BOUND_TEXT_PADDING } from '../elements/bound-text';
import { getFreeDrawOutlinePoints, getSvgPathFromStroke } from '../elements/shape-generator';

const SVG_NS = 'http://www.w3.org/2000/svg';
const EXPORT_PADDING = 20;

export function exportToSvg(
  elements: readonly DrawElement[],
  appState: Partial<AppState>,
  files?: BinaryFiles,
  opts: { padding?: number; background?: boolean } = {},
): SVGSVGElement {
  const nonDeleted = elements.filter((el) => !el.isDeleted);
  const padding = opts.padding ?? EXPORT_PADDING;

  if (nonDeleted.length === 0) {
    const svg = createSvgElement(100, 100);
    return svg;
  }

  const [x1, y1, x2, y2] = getCommonBounds(nonDeleted);
  const width = x2 - x1 + padding * 2;
  const height = y2 - y1 + padding * 2;

  const svg = createSvgElement(width, height);

  if (opts.background !== false && appState.viewBackgroundColor) {
    const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    bg.setAttribute('width', String(width));
    bg.setAttribute('height', String(height));
    bg.setAttribute('fill', appState.viewBackgroundColor);
    svg.appendChild(bg);
  }

  const boundTextByContainer = new Map<string, DrawTextElement>();
  for (const el of nonDeleted) {
    if (el.type === 'text') {
      const textEl = el as DrawTextElement;
      if (textEl.containerId) {
        boundTextByContainer.set(textEl.containerId, textEl);
      }
    }
  }

  const defs = document.createElementNS(SVG_NS, 'defs');
  svg.appendChild(defs);

  const g = document.createElementNS(SVG_NS, 'g');
  g.setAttribute('transform', `translate(${-x1 + padding}, ${-y1 + padding})`);

  for (const element of nonDeleted) {
    const boundText = boundTextByContainer.get(element.id);
    const svgEl = elementToSvg(element, files, boundText, defs);
    if (svgEl) {
      g.appendChild(svgEl);
    }
  }

  svg.appendChild(g);
  return svg;
}

export function exportToSvgString(
  elements: readonly DrawElement[],
  appState: Partial<AppState>,
  files?: BinaryFiles,
  opts?: { padding?: number; background?: boolean },
): string {
  const svg = exportToSvg(elements, appState, files, opts);
  const serializer = new XMLSerializer();
  return serializer.serializeToString(svg);
}

function createSvgElement(width: number, height: number): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  svg.setAttribute('width', String(Math.ceil(width)));
  svg.setAttribute('height', String(Math.ceil(height)));
  svg.setAttribute('viewBox', `0 0 ${Math.ceil(width)} ${Math.ceil(height)}`);
  return svg;
}

function elementToSvg(
  element: DrawElement,
  files?: BinaryFiles,
  boundText?: DrawTextElement,
  defs?: SVGDefsElement,
): SVGElement | null {
  const g = document.createElementNS(SVG_NS, 'g');
  g.setAttribute(
    'transform',
    `translate(${element.x}, ${element.y})${
      element.angle ? ` rotate(${(element.angle * 180) / Math.PI}, ${element.width / 2}, ${element.height / 2})` : ''
    }`,
  );
  g.setAttribute('opacity', String(element.opacity / 100));

  switch (element.type) {
    case 'rectangle': {
      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      rect.setAttribute('width', String(element.width));
      rect.setAttribute('height', String(element.height));
      applyStrokeAndFill(rect, element);
      if (element.roundness) {
        const r = Math.min(element.width, element.height) * 0.1;
        rect.setAttribute('rx', String(r));
        rect.setAttribute('ry', String(r));
      }
      g.appendChild(rect);
      break;
    }
    case 'ellipse': {
      const ellipse = document.createElementNS('http://www.w3.org/2000/svg', 'ellipse');
      ellipse.setAttribute('cx', String(element.width / 2));
      ellipse.setAttribute('cy', String(element.height / 2));
      ellipse.setAttribute('rx', String(element.width / 2));
      ellipse.setAttribute('ry', String(element.height / 2));
      applyStrokeAndFill(ellipse, element);
      g.appendChild(ellipse);
      break;
    }
    case 'diamond': {
      const w = element.width;
      const h = element.height;
      const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
      polygon.setAttribute(
        'points',
        `${w / 2},0 ${w},${h / 2} ${w / 2},${h} 0,${h / 2}`,
      );
      applyStrokeAndFill(polygon, element);
      g.appendChild(polygon);
      break;
    }
    case 'text': {
      const textEl = element as DrawTextElement;
      if (!textEl.text) break;

      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      const fontFamily = FONT_FAMILY_FALLBACKS[textEl.fontFamily] ?? 'sans-serif';
      text.setAttribute('font-size', String(textEl.fontSize));
      text.setAttribute('font-family', fontFamily);
      text.setAttribute('fill', textEl.strokeColor);
      text.setAttribute('dominant-baseline', 'alphabetic');
      text.setAttribute('text-anchor', textEl.textAlign === 'center' ? 'middle' : textEl.textAlign === 'right' ? 'end' : 'start');
      text.setAttribute('style', 'white-space: pre;');

      const lines = textEl.text.split('\n');
      const lineHeightPx = getLineHeightInPx(textEl.fontSize, textEl.lineHeight);
      const vOffset = getVerticalOffset(textEl.fontFamily, textEl.fontSize, lineHeightPx);
      let textX = 0;
      if (textEl.textAlign === 'center') textX = textEl.width / 2;
      else if (textEl.textAlign === 'right') textX = textEl.width;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]!;
        const tspan = document.createElementNS('http://www.w3.org/2000/svg', 'tspan');
        tspan.setAttribute('x', String(textX));
        tspan.setAttribute('y', String(i * lineHeightPx + vOffset));
        tspan.textContent = line || '\u00A0';
        text.appendChild(tspan);
      }
      g.appendChild(text);
      break;
    }
    case 'line':
    case 'arrow': {
      const linear = element as DrawLinearElement;
      if (linear.points && linear.points.length >= 2) {
        const lineEl = createLinearSvgElement(linear, element);

        if (boundText && defs) {
          const mask = document.createElementNS(SVG_NS, 'mask');
          const maskId = `mask-${element.id}`;
          mask.setAttribute('id', maskId);

          const maskVisible = document.createElementNS(SVG_NS, 'rect');
          maskVisible.setAttribute('x', '-10000');
          maskVisible.setAttribute('y', '-10000');
          maskVisible.setAttribute('width', '20000');
          maskVisible.setAttribute('height', '20000');
          maskVisible.setAttribute('fill', '#fff');
          mask.appendChild(maskVisible);

          const pad = BOUND_TEXT_PADDING;
          const maskHole = document.createElementNS(SVG_NS, 'rect');
          maskHole.setAttribute('x', String(boundText.x - element.x - pad));
          maskHole.setAttribute('y', String(boundText.y - element.y - pad));
          maskHole.setAttribute('width', String(boundText.width + pad * 2));
          maskHole.setAttribute('height', String(boundText.height + pad * 2));
          maskHole.setAttribute('fill', '#000');
          mask.appendChild(maskHole);

          defs.appendChild(mask);

          const maskedGroup = document.createElementNS(SVG_NS, 'g');
          maskedGroup.setAttribute('mask', `url(#${maskId})`);
          maskedGroup.appendChild(lineEl);
          g.appendChild(maskedGroup);
        } else {
          g.appendChild(lineEl);
        }

        {
          const pts = linear.points;
          if (linear.endArrowhead && pts.length >= 2) {
            const tip = pts[pts.length - 1]!;
            const prev = pts[pts.length - 2]!;
            const arrowEl = createArrowheadSvg(prev, tip, linear.endArrowhead, element.strokeColor, element.strokeWidth);
            if (arrowEl) g.appendChild(arrowEl);
          }
          if (linear.startArrowhead && pts.length >= 2) {
            const tip = pts[0]!;
            const prev = pts[1]!;
            const arrowEl = createArrowheadSvg(prev, tip, linear.startArrowhead, element.strokeColor, element.strokeWidth);
            if (arrowEl) g.appendChild(arrowEl);
          }
        }
      }
      break;
    }
    case 'freedraw': {
      const fd = element as DrawFreeDrawElement;
      if (fd.points && fd.points.length >= 2) {
        const outlinePoints = getFreeDrawOutlinePoints(fd);
        const d = getSvgPathFromStroke(outlinePoints);
        if (d) {
          const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
          path.setAttribute('d', d);
          path.setAttribute('fill', element.strokeColor);
          path.setAttribute('stroke', 'none');
          g.appendChild(path);
        }
      }
      break;
    }
    case 'image': {
      const imgEl = element as DrawImageElement;
      if (imgEl.fileId && files?.[imgEl.fileId]) {
        const fileData = files[imgEl.fileId]!;
        const image = document.createElementNS('http://www.w3.org/2000/svg', 'image');
        image.setAttribute('width', String(element.width));
        image.setAttribute('height', String(element.height));
        image.setAttributeNS('http://www.w3.org/1999/xlink', 'href', fileData.dataURL);
        g.appendChild(image);
      }
      break;
    }
    case 'frame': {
      const frameEl = element as DrawFrameElement;
      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      rect.setAttribute('width', String(element.width));
      rect.setAttribute('height', String(element.height));
      rect.setAttribute('fill', 'none');
      rect.setAttribute('stroke', SELECTION_BORDER_COLOR);
      rect.setAttribute('stroke-width', '2');
      rect.setAttribute('stroke-dasharray', '8 4');
      g.appendChild(rect);

      if (frameEl.name) {
        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', '0');
        text.setAttribute('y', '-4');
        text.setAttribute('font-size', '12');
        text.setAttribute('font-family', 'sans-serif');
        text.setAttribute('fill', SELECTION_BORDER_COLOR);
        text.setAttribute('text-anchor', 'start');
        text.textContent = frameEl.name;
        g.appendChild(text);
      }
      break;
    }
    default:
      return null;
  }

  return g;
}

function createLinearSvgElement(
  linear: DrawLinearElement,
  element: DrawElement,
): SVGElement {
  const pts = linear.points as [number, number][];

  if (element.roundness && pts.length > 2) {
    const path = document.createElementNS(SVG_NS, 'path');
    const d = catmullRomToSvgPath(pts);
    path.setAttribute('d', d);
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', element.strokeColor);
    path.setAttribute('stroke-width', String(element.strokeWidth));
    path.setAttribute('stroke-linecap', 'round');
    path.setAttribute('stroke-linejoin', 'round');
    applyStrokeDash(path, element);
    return path;
  }

  const polyline = document.createElementNS(SVG_NS, 'polyline');
  const pointsStr = pts.map((p) => `${p[0]},${p[1]}`).join(' ');
  polyline.setAttribute('points', pointsStr);
  polyline.setAttribute('fill', 'none');
  polyline.setAttribute('stroke', element.strokeColor);
  polyline.setAttribute('stroke-width', String(element.strokeWidth));
  applyStrokeDash(polyline, element);
  return polyline;
}

function catmullRomToSvgPath(points: [number, number][]): string {
  if (points.length < 2) return '';
  if (points.length === 2) {
    return `M ${points[0]![0]},${points[0]![1]} L ${points[1]![0]},${points[1]![1]}`;
  }

  const parts: string[] = [`M ${points[0]![0]},${points[0]![1]}`];
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)]!;
    const p1 = points[i]!;
    const p2 = points[i + 1]!;
    const p3 = points[Math.min(points.length - 1, i + 2)]!;

    const cp1x = p1[0] + (p2[0] - p0[0]) / 6;
    const cp1y = p1[1] + (p2[1] - p0[1]) / 6;
    const cp2x = p2[0] - (p3[0] - p1[0]) / 6;
    const cp2y = p2[1] - (p3[1] - p1[1]) / 6;

    parts.push(`C ${cp1x},${cp1y} ${cp2x},${cp2y} ${p2[0]},${p2[1]}`);
  }
  return parts.join(' ');
}

function createArrowheadSvg(
  from: [number, number],
  to: [number, number],
  type: Arrowhead,
  color: string,
  strokeWidth: number,
): SVGElement | null {
  const angle = Math.atan2(to[1] - from[1], to[0] - from[0]);
  const size = Math.max(10, strokeWidth * 4);

  const leftAngle = angle + Math.PI + Math.PI / 6;
  const rightAngle = angle + Math.PI - Math.PI / 6;
  const lx = to[0] + size * Math.cos(leftAngle);
  const ly = to[1] + size * Math.sin(leftAngle);
  const rx = to[0] + size * Math.cos(rightAngle);
  const ry = to[1] + size * Math.sin(rightAngle);

  switch (type) {
    case 'arrow': {
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', `M ${lx},${ly} L ${to[0]},${to[1]} L ${rx},${ry}`);
      path.setAttribute('fill', 'none');
      path.setAttribute('stroke', color);
      path.setAttribute('stroke-width', String(strokeWidth));
      path.setAttribute('stroke-linejoin', 'round');
      path.setAttribute('stroke-linecap', 'round');
      return path;
    }
    case 'triangle': {
      const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
      polygon.setAttribute('points', `${to[0]},${to[1]} ${lx},${ly} ${rx},${ry}`);
      polygon.setAttribute('fill', color);
      polygon.setAttribute('stroke', 'none');
      return polygon;
    }
    case 'circle': {
      const r = size / 2;
      const cx = to[0] + (r * Math.cos(angle + Math.PI));
      const cy = to[1] + (r * Math.sin(angle + Math.PI));
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('cx', String(cx));
      circle.setAttribute('cy', String(cy));
      circle.setAttribute('r', String(r));
      circle.setAttribute('fill', color);
      circle.setAttribute('stroke', 'none');
      return circle;
    }
    case 'diamond': {
      const half = size / 2;
      const backX = to[0] + size * Math.cos(angle + Math.PI);
      const backY = to[1] + size * Math.sin(angle + Math.PI);
      const midX = (to[0] + backX) / 2;
      const midY = (to[1] + backY) / 2;
      const perpX = half * Math.cos(angle + Math.PI / 2);
      const perpY = half * Math.sin(angle + Math.PI / 2);
      const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
      polygon.setAttribute('points', `${to[0]},${to[1]} ${midX + perpX},${midY + perpY} ${backX},${backY} ${midX - perpX},${midY - perpY}`);
      polygon.setAttribute('fill', color);
      polygon.setAttribute('stroke', 'none');
      return polygon;
    }
    case 'bar': {
      const perpX = (size / 2) * Math.cos(angle + Math.PI / 2);
      const perpY = (size / 2) * Math.sin(angle + Math.PI / 2);
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', String(to[0] + perpX));
      line.setAttribute('y1', String(to[1] + perpY));
      line.setAttribute('x2', String(to[0] - perpX));
      line.setAttribute('y2', String(to[1] - perpY));
      line.setAttribute('stroke', color);
      line.setAttribute('stroke-width', String(strokeWidth));
      line.setAttribute('stroke-linecap', 'round');
      return line;
    }
    default:
      return null;
  }
}

function applyStrokeDash(svgEl: SVGElement, element: DrawElement): void {
  if (element.strokeStyle === 'dashed') {
    svgEl.setAttribute('stroke-dasharray', '12 8');
  } else if (element.strokeStyle === 'dotted') {
    svgEl.setAttribute('stroke-dasharray', '3 6');
  }
}

function applyStrokeAndFill(svgEl: SVGElement, element: DrawElement): void {
  svgEl.setAttribute('stroke', element.strokeColor);
  svgEl.setAttribute('stroke-width', String(element.strokeWidth));
  svgEl.setAttribute(
    'fill',
    element.backgroundColor !== 'transparent' ? element.backgroundColor : 'none',
  );
  applyStrokeDash(svgEl, element);
}
