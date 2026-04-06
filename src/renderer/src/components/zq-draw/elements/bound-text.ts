import type { Scene } from '../core/scene';
import type {
  DrawElement,
  DrawTextElement,
  DrawLinearElement,
  BoundElement,
  TextAlign,
  VerticalAlign,
} from '../types';
import { FONT_FAMILY_FALLBACKS, DEFAULT_LINE_HEIGHT, DEFAULT_FONT_SIZE } from '../constants';

export const BOUND_TEXT_PADDING = 5;
const ARROW_LABEL_WIDTH_FRACTION = 0.7;
const ARROW_LABEL_FONT_SIZE_TO_MIN_WIDTH_RATIO = 11;

const VALID_CONTAINER_TYPES = new Set([
  'rectangle',
  'ellipse',
  'diamond',
  'arrow',
]);

let _measureCanvas: HTMLCanvasElement | null = null;
function getMeasureContext(): CanvasRenderingContext2D {
  if (!_measureCanvas) {
    _measureCanvas = document.createElement('canvas');
  }
  return _measureCanvas.getContext('2d')!;
}

export function getFontString(fontSize: number, fontFamily: number): string {
  return `${fontSize}px ${FONT_FAMILY_FALLBACKS[fontFamily] || 'sans-serif'}`;
}

export function getLineHeightInPx(fontSize: number, lineHeight: number): number {
  return fontSize * lineHeight;
}

export function isTextBindableContainer(element: DrawElement): boolean {
  return VALID_CONTAINER_TYPES.has(element.type);
}

export function isBoundToContainer(element: DrawElement): boolean {
  return element.type === 'text' && !!(element as DrawTextElement).containerId;
}

export function getBoundTextElement(
  container: DrawElement,
  scene: Scene,
): DrawTextElement | null {
  if (!container.boundElements) return null;
  const textBound = container.boundElements.find((b) => b.type === 'text');
  if (!textBound) return null;
  const el = scene.getElement(textBound.id);
  if (!el || el.isDeleted || el.type !== 'text') return null;
  return el as DrawTextElement;
}

export function getContainerElement(
  textElement: DrawTextElement,
  scene: Scene,
): DrawElement | null {
  if (!textElement.containerId) return null;
  const el = scene.getElement(textElement.containerId);
  if (!el || el.isDeleted) return null;
  return el;
}

export function getBoundTextMaxWidth(container: DrawElement): number {
  const padding = BOUND_TEXT_PADDING * 2;
  if (container.type === 'ellipse') {
    return Math.floor(((container.width / 2) * Math.sqrt(2)) * 2 - padding);
  }
  if (container.type === 'diamond') {
    return Math.floor(container.width / 2 - padding);
  }
  if (container.type === 'arrow' || container.type === 'line') {
    const linearWidth = Math.max(container.width, container.height, 1);
    return Math.max(
      Math.floor(linearWidth * ARROW_LABEL_WIDTH_FRACTION),
      DEFAULT_FONT_SIZE * ARROW_LABEL_FONT_SIZE_TO_MIN_WIDTH_RATIO,
    );
  }
  return Math.floor(container.width - padding);
}

export function getBoundTextMaxHeight(
  container: DrawElement,
  textElement?: DrawTextElement,
): number {
  const padding = BOUND_TEXT_PADDING * 2;
  if (container.type === 'ellipse') {
    return Math.floor(((container.height / 2) * Math.sqrt(2)) * 2 - padding);
  }
  if (container.type === 'diamond') {
    return Math.floor(container.height / 2 - padding);
  }
  if (container.type === 'arrow' || container.type === 'line') {
    return Infinity;
  }
  return Math.floor(container.height - padding);
}

export function computeContainerDimensionForBoundText(
  dimension: number,
  containerType: string,
): number {
  dimension = Math.ceil(dimension);
  const padding = BOUND_TEXT_PADDING * 2;

  if (containerType === 'ellipse') {
    return Math.round(((dimension + padding) / (Math.sqrt(2))) * 2);
  }
  if (containerType === 'arrow' || containerType === 'line') {
    return dimension + padding * 8;
  }
  if (containerType === 'diamond') {
    return 2 * (dimension + padding);
  }
  return dimension + padding;
}

export function getContainerTextCoords(container: DrawElement): { x: number; y: number } {
  if (container.type === 'ellipse') {
    const hw = container.width / 2;
    const hh = container.height / 2;
    const inscribedHalfW = hw * Math.SQRT1_2;
    const inscribedHalfH = hh * Math.SQRT1_2;
    return {
      x: container.x + hw - inscribedHalfW + BOUND_TEXT_PADDING,
      y: container.y + hh - inscribedHalfH + BOUND_TEXT_PADDING,
    };
  }
  if (container.type === 'diamond') {
    const hw = container.width / 4;
    const hh = container.height / 4;
    return {
      x: container.x + container.width / 2 - hw + BOUND_TEXT_PADDING,
      y: container.y + container.height / 2 - hh + BOUND_TEXT_PADDING,
    };
  }
  return {
    x: container.x + BOUND_TEXT_PADDING,
    y: container.y + BOUND_TEXT_PADDING,
  };
}

export function getArrowLabelPosition(
  arrow: DrawLinearElement,
): { x: number; y: number } {
  const points = arrow.points;
  if (!points || points.length < 2) {
    return { x: arrow.x, y: arrow.y };
  }

  if (points.length % 2 === 1) {
    const midIdx = Math.floor(points.length / 2);
    const pt = points[midIdx]!;
    return {
      x: arrow.x + pt[0],
      y: arrow.y + pt[1],
    };
  }

  const midIdx = Math.floor(points.length / 2) - 1;
  const p1 = points[midIdx]!;
  const p2 = points[midIdx + 1]!;
  return {
    x: arrow.x + (p1[0] + p2[0]) / 2,
    y: arrow.y + (p1[1] + p2[1]) / 2,
  };
}

export function computeBoundTextPosition(
  container: DrawElement,
  textElement: DrawTextElement,
  scene?: Scene,
): { x: number; y: number } {
  if (container.type === 'arrow' || container.type === 'line') {
    const arrow = container as DrawLinearElement;
    const center = getArrowLabelPosition(arrow);
    return {
      x: center.x - textElement.width / 2,
      y: center.y - textElement.height / 2,
    };
  }

  const maxWidth = getBoundTextMaxWidth(container);
  const maxHeight = getBoundTextMaxHeight(container, textElement);

  const textWidth = textElement.width;
  const textHeight = textElement.height;

  let offsetX: number;
  switch (textElement.textAlign as TextAlign) {
    case 'center':
      offsetX = (maxWidth - textWidth) / 2;
      break;
    case 'right':
      offsetX = maxWidth - textWidth;
      break;
    default:
      offsetX = 0;
  }

  let offsetY: number;
  switch (textElement.verticalAlign as VerticalAlign) {
    case 'middle':
      offsetY = (maxHeight - textHeight) / 2;
      break;
    case 'bottom':
      offsetY = maxHeight - textHeight;
      break;
    default:
      offsetY = 0;
  }

  if (container.type === 'ellipse' || container.type === 'diamond') {
    const cx = container.x + container.width / 2;
    const cy = container.y + container.height / 2;
    const areaX = cx - maxWidth / 2;
    const areaY = cy - getBoundTextMaxHeight(container, textElement) / 2;
    return {
      x: areaX + offsetX,
      y: areaY + offsetY,
    };
  }

  const coords = getContainerTextCoords(container);
  return {
    x: coords.x + offsetX,
    y: coords.y + offsetY,
  };
}

export function measureText(
  text: string,
  fontSize: number,
  fontFamily: number,
  lineHeight: number,
  maxWidth?: number,
): { width: number; height: number; wrappedText: string } {
  const ctx = getMeasureContext();
  const fontString = getFontString(fontSize, fontFamily);
  ctx.font = fontString;

  const lineHeightPx = getLineHeightInPx(fontSize, lineHeight);
  const inputText = text || ' ';

  let lines: string[];
  let wrappedText: string;

  if (maxWidth && maxWidth > 0 && isFinite(maxWidth)) {
    lines = wrapText(inputText, ctx, maxWidth);
    wrappedText = lines.join('\n');
  } else {
    lines = inputText.split('\n');
    wrappedText = inputText;
  }

  let width = 0;
  for (const line of lines) {
    const metrics = ctx.measureText(line || ' ');
    width = Math.max(width, metrics.width);
  }

  const height = lines.length * lineHeightPx;
  return {
    width: Math.ceil(width),
    height: Math.ceil(height),
    wrappedText,
  };
}

export function getTextWidth(
  text: string,
  fontSize: number,
  fontFamily: number,
): number {
  const ctx = getMeasureContext();
  ctx.font = getFontString(fontSize, fontFamily);
  const lines = text.split('\n');
  let maxW = 0;
  for (const line of lines) {
    maxW = Math.max(maxW, ctx.measureText(line || ' ').width);
  }
  return Math.ceil(maxW);
}

export function wrapText(
  text: string,
  ctx: CanvasRenderingContext2D,
  maxWidth: number,
): string[] {
  const paragraphs = text.split('\n');
  const lines: string[] = [];

  for (const paragraph of paragraphs) {
    if (paragraph === '') {
      lines.push('');
      continue;
    }

    const chars = [...paragraph];
    let currentLine = '';

    for (let i = 0; i < chars.length; i++) {
      const char = chars[i]!;
      const testLine = currentLine + char;
      const metrics = ctx.measureText(testLine);

      if (metrics.width > maxWidth && currentLine.length > 0) {
        const lastSpaceIdx = currentLine.lastIndexOf(' ');
        if (lastSpaceIdx > 0) {
          lines.push(currentLine.slice(0, lastSpaceIdx));
          currentLine = currentLine.slice(lastSpaceIdx + 1) + char;
        } else {
          lines.push(currentLine);
          currentLine = char;
        }
      } else {
        currentLine = testLine;
      }
    }

    if (currentLine) {
      lines.push(currentLine);
    }
  }

  return lines.length > 0 ? lines : [''];
}

export function wrapTextToString(
  text: string,
  fontSize: number,
  fontFamily: number,
  maxWidth: number,
): string {
  const ctx = getMeasureContext();
  ctx.font = getFontString(fontSize, fontFamily);
  return wrapText(text, ctx, maxWidth).join('\n');
}

export function redrawTextBoundingBox(
  textElement: DrawTextElement,
  container: DrawElement | null,
  scene: Scene,
): void {
  const lineHeight = textElement.lineHeight || DEFAULT_LINE_HEIGHT;

  if (container) {
    const isArrow = container.type === 'arrow' || container.type === 'line';
    const maxWidth = getBoundTextMaxWidth(container);

    const metrics = measureText(
      textElement.originalText,
      textElement.fontSize,
      textElement.fontFamily,
      lineHeight,
      isArrow ? undefined : maxWidth,
    );

    const wrappedText = metrics.wrappedText;
    const textWidth = metrics.width;
    const textHeight = metrics.height;

    if (!isArrow) {
      const maxHeight = getBoundTextMaxHeight(container, textElement);
      if (textHeight > maxHeight) {
        const nextHeight = computeContainerDimensionForBoundText(
          textHeight,
          container.type,
        );
        scene.mutateElement(container.id, { height: nextHeight } as Partial<DrawElement>);
      }
      if (textWidth > maxWidth) {
        const nextWidth = computeContainerDimensionForBoundText(
          textWidth,
          container.type,
        );
        scene.mutateElement(container.id, { width: nextWidth } as Partial<DrawElement>);
      }
    }

    const updatedContainer = scene.getElement(container.id) || container;
    const pos = computeBoundTextPosition(updatedContainer, {
      ...textElement,
      text: wrappedText,
      width: textWidth,
      height: textHeight,
    } as DrawTextElement, scene);

    scene.mutateElement(textElement.id, {
      text: wrappedText,
      x: pos.x,
      y: pos.y,
      width: textWidth,
      height: textHeight,
      angle: isArrow ? 0 : container.angle,
    } as Partial<DrawElement>);
  } else {
    const metrics = measureText(
      textElement.originalText,
      textElement.fontSize,
      textElement.fontFamily,
      lineHeight,
      textElement.autoResize ? undefined : textElement.width,
    );

    const updates: Partial<DrawTextElement> = {
      text: metrics.wrappedText,
      height: metrics.height,
    };

    if (textElement.autoResize) {
      const widthDiff = metrics.width - textElement.width;
      const heightDiff = metrics.height - textElement.height;

      updates.width = metrics.width;

      if (textElement.textAlign === 'center') {
        updates.x = textElement.x - widthDiff / 2;
      } else if (textElement.textAlign === 'right') {
        updates.x = textElement.x - widthDiff;
      }

      if (textElement.verticalAlign === 'middle') {
        updates.y = textElement.y - heightDiff / 2;
      }
    }

    scene.mutateElement(textElement.id, updates as Partial<DrawElement>);
  }
}

export function bindTextToContainer(
  textElement: DrawTextElement,
  container: DrawElement,
  scene: Scene,
): void {
  const isArrow = container.type === 'arrow' || container.type === 'line';

  scene.mutateElement(textElement.id, {
    containerId: container.id,
    textAlign: 'center',
    verticalAlign: 'middle',
    angle: isArrow ? 0 : container.angle,
  } as Partial<DrawElement>);

  const existingBound = container.boundElements || [];
  if (!existingBound.some((b) => b.id === textElement.id)) {
    const newBound: BoundElement[] = [
      ...existingBound,
      { id: textElement.id, type: 'text' },
    ];
    scene.mutateElement(container.id, {
      boundElements: newBound,
    } as Partial<DrawElement>);
  }

  const updatedContainer = scene.getElement(container.id) || container;
  const updatedText = scene.getElement(textElement.id) as DrawTextElement;
  if (updatedText) {
    redrawTextBoundingBox(updatedText, updatedContainer, scene);
  }
}

export function unbindTextFromContainer(
  textElement: DrawTextElement,
  scene: Scene,
): void {
  if (!textElement.containerId) return;

  const container = scene.getElement(textElement.containerId);
  if (container && container.boundElements) {
    const newBound = container.boundElements.filter((b) => b.id !== textElement.id);
    scene.mutateElement(container.id, {
      boundElements: newBound.length > 0 ? newBound : null,
    } as Partial<DrawElement>);
  }

  const metrics = measureText(
    textElement.originalText,
    textElement.fontSize,
    textElement.fontFamily,
    textElement.lineHeight || DEFAULT_LINE_HEIGHT,
  );

  scene.mutateElement(textElement.id, {
    containerId: null,
    text: textElement.originalText,
    width: metrics.width,
    height: metrics.height,
    autoResize: true,
  } as Partial<DrawElement>);
}

export function handleBoundTextResize(
  container: DrawElement,
  scene: Scene,
): void {
  const textEl = getBoundTextElement(container, scene);
  if (!textEl) return;
  redrawTextBoundingBox(textEl, container, scene);
}
