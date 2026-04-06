import rough from 'roughjs';
import type { DrawElement, DrawTextElement, DrawFrameElement, AppState, BinaryFiles } from '../../types';
import { drawElementOnCanvas } from '../../elements/shape-generator';
import { applyZoom, drawGrid } from './helpers';
import { FONT_FAMILY_FALLBACKS, SELECTION_BORDER_COLOR, getVerticalOffset } from '../../constants';
import { getLineHeightInPx, BOUND_TEXT_PADDING } from '../../elements/bound-text';

export function renderStaticScene(
  canvas: HTMLCanvasElement,
  elements: readonly DrawElement[],
  appState: AppState,
  files: BinaryFiles,
  imageCache: Map<string, HTMLImageElement>,
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const rc = rough.canvas(canvas);
  const dpr = window.devicePixelRatio || 1;

  canvas.width = appState.width * dpr;
  canvas.height = appState.height * dpr;
  canvas.style.width = `${appState.width}px`;
  canvas.style.height = `${appState.height}px`;
  ctx.scale(dpr, dpr);

  ctx.clearRect(0, 0, appState.width, appState.height);
  if (appState.viewBackgroundColor) {
    ctx.fillStyle = appState.viewBackgroundColor;
    ctx.fillRect(0, 0, appState.width, appState.height);
  }

  drawGrid(ctx, appState);
  applyZoom(ctx, appState);

  const frameMap = new Map<string, DrawFrameElement>();
  for (const element of elements) {
    if (element.type === 'frame' && !element.isDeleted) {
      frameMap.set(element.id, element as DrawFrameElement);
    }
  }

  const editingTextId = appState.editingTextElement?.id ?? null;

  const linearContainerIds = new Set<string>();
  for (const element of elements) {
    if (element.isDeleted) continue;
    if (element.type === 'arrow' || element.type === 'line') {
      if (element.boundElements?.some((b) => b.type === 'text')) {
        linearContainerIds.add(element.id);
      }
    }
  }

  for (const element of elements) {
    if (element.isDeleted) continue;

    if (element.type === 'text' && element.id === editingTextId) continue;

    const frame = element.frameId ? frameMap.get(element.frameId) : null;
    const shouldClip = frame && appState.frameRendering.enabled && appState.frameRendering.clip;

    if (shouldClip && frame) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(frame.x, frame.y, frame.width, frame.height);
      ctx.clip();
    }

    if (element.type === 'frame') {
      renderFrameElement(ctx, element as DrawFrameElement, appState);
    } else if (element.type === 'text') {
      const textEl = element as DrawTextElement;
      if (textEl.containerId && linearContainerIds.has(textEl.containerId)) {
        renderLinearBoundText(ctx, textEl, appState.viewBackgroundColor);
      } else {
        renderTextElement(ctx, textEl);
      }
    } else if (element.type === 'image') {
      renderImageElement(ctx, element, imageCache);
    } else {
      drawElementOnCanvas(rc, ctx, element);
    }

    if (shouldClip) {
      ctx.restore();
    }
  }
}

function renderLinearBoundText(
  ctx: CanvasRenderingContext2D,
  element: DrawTextElement,
  bgColor: string | null,
): void {
  if (!element.text) return;

  const pad = BOUND_TEXT_PADDING;
  ctx.save();
  ctx.globalAlpha = element.opacity / 100;

  if (bgColor) {
    ctx.fillStyle = bgColor;
    ctx.fillRect(
      element.x - pad,
      element.y - pad,
      element.width + pad * 2,
      element.height + pad * 2,
    );
  }

  ctx.restore();
  renderTextElement(ctx, element);
}

function renderTextElement(
  ctx: CanvasRenderingContext2D,
  element: DrawTextElement,
): void {
  if (!element.text) return;

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

  const fontFamily = FONT_FAMILY_FALLBACKS[element.fontFamily] ?? 'sans-serif';
  ctx.font = `${element.fontSize}px ${fontFamily}`;
  ctx.fillStyle = element.strokeColor;
  ctx.textAlign = element.textAlign as CanvasTextAlign;

  const lines = element.text.split('\n');
  const lineHeightPx = getLineHeightInPx(element.fontSize, element.lineHeight);

  let textX = 0;
  if (element.textAlign === 'center') {
    textX = element.width / 2;
  } else if (element.textAlign === 'right') {
    textX = element.width;
  }

  const vOffset = getVerticalOffset(element.fontFamily, element.fontSize, lineHeightPx);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    ctx.fillText(line, textX, i * lineHeightPx + vOffset);
  }

  ctx.restore();
}

function renderFrameElement(
  ctx: CanvasRenderingContext2D,
  element: DrawFrameElement,
  appState: AppState,
): void {
  if (!appState.frameRendering.enabled) return;

  ctx.save();
  ctx.globalAlpha = element.opacity / 100;

  if (appState.frameRendering.outline) {
    ctx.strokeStyle = SELECTION_BORDER_COLOR;
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 4]);
    ctx.strokeRect(element.x, element.y, element.width, element.height);
    ctx.setLineDash([]);
  }

  if (appState.frameRendering.name && element.name) {
    const zoom = appState.zoom.value;
    const fontSize = 12 / zoom;
    ctx.font = `${fontSize}px sans-serif`;
    ctx.fillStyle = SELECTION_BORDER_COLOR;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    ctx.fillText(element.name, element.x, element.y - 4 / zoom);
  }

  ctx.restore();
}

function renderImageElement(
  ctx: CanvasRenderingContext2D,
  element: DrawElement,
  imageCache: Map<string, HTMLImageElement>,
): void {
  const imgEl = element as DrawElement & { fileId: string | null };
  if (!imgEl.fileId) return;

  const img = imageCache.get(imgEl.fileId);
  if (!img) return;

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
  ctx.drawImage(img, 0, 0, element.width, element.height);
  ctx.restore();
}
