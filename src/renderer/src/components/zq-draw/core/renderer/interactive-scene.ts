import rough from 'roughjs';
import type {
  DrawElement,
  AppState,
  NonDeletedDrawElement,
  SuggestedBinding,
  GlobalPoint,
} from '../../types';
import { getCommonBounds, getLinearElementLocalBounds } from '../../elements/bounds';
import {
  getTransformHandles,
  getLinearPointHandles,
  getLinearMidpointHandles,
} from '../../elements/transform-handles';
import { drawElementOnCanvas } from '../../elements/shape-generator';
import { getElementSnapPoints } from '../../elements/binding';
import { applyZoom } from './helpers';
import {
  SELECTION_BORDER_COLOR,
  SELECTION_FILL_COLOR,
  SNAP_LINE_COLOR,
} from '../../constants';

export function renderInteractiveScene(
  canvas: HTMLCanvasElement,
  elements: readonly NonDeletedDrawElement[],
  appState: AppState,
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const dpr = window.devicePixelRatio || 1;
  canvas.width = appState.width * dpr;
  canvas.height = appState.height * dpr;
  canvas.style.width = `${appState.width}px`;
  canvas.style.height = `${appState.height}px`;
  ctx.scale(dpr, dpr);

  ctx.clearRect(0, 0, appState.width, appState.height);

  applyZoom(ctx, appState);

  // draw selection element (rubber band)
  if (appState.selectionElement) {
    const sel = appState.selectionElement;
    ctx.save();
    ctx.strokeStyle = SELECTION_BORDER_COLOR;
    ctx.fillStyle = SELECTION_FILL_COLOR;
    ctx.lineWidth = 1 / appState.zoom.value;
    ctx.fillRect(sel.x, sel.y, sel.width, sel.height);
    ctx.strokeRect(sel.x, sel.y, sel.width, sel.height);
    ctx.restore();
  }

  // draw new element being created (render actual shape, not just outline)
  if (appState.newElement && !appState.newElement.isDeleted) {
    const rc = rough.canvas(canvas);
    drawElementOnCanvas(rc, ctx, appState.newElement);
  }

  // draw selection highlights (skip bound text elements)
  const selectedElements = elements.filter(
    (el) => appState.selectedElementIds[el.id]
      && !(el.type === 'text' && (el as any).containerId),
  );

  if (selectedElements.length > 0) {
    drawSelectionHighlights(ctx, selectedElements, appState);
  }

  // draw snap lines
  if (appState.snapLines.length > 0) {
    drawSnapLines(ctx, appState);
  }

  // draw binding highlights
  if (appState.suggestedBindings.length > 0) {
    drawBindingHighlights(ctx, appState.suggestedBindings, appState);
  }
}

function strokeRectWithRotation(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  cx: number,
  cy: number,
  angle: number,
): void {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(angle);
  ctx.strokeRect(x - cx, y - cy, width, height);
  ctx.restore();
}

function drawRoundedHandle(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  zoom: number,
): void {
  const radius = 2 / zoom;
  if (ctx.roundRect) {
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, radius);
    ctx.fill();
    ctx.stroke();
  } else {
    ctx.fillRect(x, y, width, height);
    ctx.strokeRect(x, y, width, height);
  }
}

function isLinearElement(el: DrawElement): boolean {
  return el.type === 'line' || el.type === 'arrow';
}

function hasBoundingBox(
  el: DrawElement,
  appState: AppState,
): boolean {
  if (appState.editingLinearElement) {
    return false;
  }
  if (!isLinearElement(el)) {
    return true;
  }
  return (el as any).points?.length > 2;
}

function drawSelectionHighlights(
  ctx: CanvasRenderingContext2D,
  selectedElements: readonly DrawElement[],
  appState: AppState,
): void {
  const zoom = appState.zoom.value;
  const lineWidth = 1 / zoom;
  const padding = 4 / zoom;

  if (selectedElements.length === 1) {
    const el = selectedElements[0]!;
    const isLinear = isLinearElement(el);
    const showBBox = hasBoundingBox(el, appState);

    let selX: number, selY: number, selW: number, selH: number;
    let selCx: number, selCy: number, selAngle: number;

    if (isLinear) {
      const [bx1, by1, bx2, by2] = getLinearElementLocalBounds(el as any);
      selX = bx1;
      selY = by1;
      selW = bx2 - bx1;
      selH = by2 - by1;
      selCx = el.x + el.width / 2;
      selCy = el.y + el.height / 2;
      selAngle = el.angle;
    } else {
      selX = el.x;
      selY = el.y;
      selW = el.width;
      selH = el.height;
      selCx = el.x + el.width / 2;
      selCy = el.y + el.height / 2;
      selAngle = el.angle;
    }

    ctx.save();
    ctx.strokeStyle = SELECTION_BORDER_COLOR;
    ctx.lineWidth = lineWidth;

    if (showBBox) {
      strokeRectWithRotation(
        ctx,
        selX - padding,
        selY - padding,
        selW + padding * 2,
        selH + padding * 2,
        selCx,
        selCy,
        selAngle,
      );
    }

    if (!appState.viewModeEnabled) {
      if (isLinear) {
        const isEditing = !!appState.editingLinearElement;
        drawLinearPointHandles(ctx, el, zoom, lineWidth, isEditing);
      }

      if (showBBox) {
        const handles = getTransformHandles(el, zoom);
        for (const handle of handles) {
          ctx.fillStyle = '#ffffff';
          ctx.strokeStyle = SELECTION_BORDER_COLOR;
          ctx.lineWidth = lineWidth;

          if (handle.type === 'rotation') {
            ctx.beginPath();
            ctx.arc(
              handle.x + handle.width / 2,
              handle.y + handle.height / 2,
              handle.width / 2,
              0,
              Math.PI * 2,
            );
            ctx.fill();
            ctx.stroke();
          } else {
            drawRoundedHandle(ctx, handle.x, handle.y, handle.width, handle.height, zoom);
          }
        }
      }
    }

    ctx.restore();
  } else if (selectedElements.length > 1) {
    const [x1, y1, x2, y2] = getCommonBounds(selectedElements);

    ctx.save();
    ctx.strokeStyle = SELECTION_BORDER_COLOR;
    ctx.lineWidth = lineWidth;
    ctx.setLineDash([5 / zoom, 5 / zoom]);
    ctx.strokeRect(
      x1 - padding,
      y1 - padding,
      x2 - x1 + padding * 2,
      y2 - y1 + padding * 2,
    );

    for (const el of selectedElements) {
      const { x: ex, y: ey, width: ew, height: eh, angle: ea } = el;
      const ecx = ex + ew / 2;
      const ecy = ey + eh / 2;
      strokeRectWithRotation(ctx, ex, ey, ew, eh, ecx, ecy, ea);
    }

    ctx.restore();
  }
}

function drawLinearPointHandles(
  ctx: CanvasRenderingContext2D,
  element: DrawElement,
  zoom: number,
  lineWidth: number,
  isEditing: boolean,
): void {
  const pointHandles = getLinearPointHandles(element, zoom);
  const pointCount = (element as any).points?.length ?? 0;
  const radius = isEditing
    ? pointHandles[0]?.size ?? 8 / zoom
    : (pointHandles[0]?.size ?? 8 / zoom) / 2;

  for (const h of pointHandles) {
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = SELECTION_BORDER_COLOR;
    ctx.lineWidth = lineWidth;
    ctx.beginPath();
    ctx.arc(h.x, h.y, radius / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  const showMidpoints = isEditing || pointCount === 2;
  if (showMidpoints) {
    const midHandles = getLinearMidpointHandles(element, zoom);
    for (const h of midHandles) {
      ctx.fillStyle = 'rgba(177, 151, 252, 0.7)';
      ctx.strokeStyle = SELECTION_BORDER_COLOR;
      ctx.lineWidth = lineWidth;
      ctx.beginPath();
      ctx.arc(h.x, h.y, h.size / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  }
}

function drawSnapLines(
  ctx: CanvasRenderingContext2D,
  appState: AppState,
): void {
  ctx.save();
  ctx.strokeStyle = SNAP_LINE_COLOR;
  ctx.lineWidth = 1 / appState.zoom.value;
  ctx.setLineDash([4 / appState.zoom.value, 4 / appState.zoom.value]);

  for (const snapLine of appState.snapLines) {
    if (snapLine.points.length >= 2) {
      ctx.beginPath();
      ctx.moveTo(snapLine.points[0]![0], snapLine.points[0]![1]);
      for (let i = 1; i < snapLine.points.length; i++) {
        ctx.lineTo(snapLine.points[i]![0], snapLine.points[i]![1]);
      }
      ctx.stroke();
    }
  }

  ctx.restore();
}

function drawBindingHighlights(
  ctx: CanvasRenderingContext2D,
  suggestedBindings: SuggestedBinding[],
  appState: AppState,
): void {
  const zoom = appState.zoom.value;

  for (const suggestion of suggestedBindings) {
    const el = suggestion.element;
    drawBindingOutline(ctx, el, zoom);
    drawBindingSnapPoints(ctx, el, suggestion.midPoint, zoom);
  }
}

function drawBindingOutline(
  ctx: CanvasRenderingContext2D,
  element: DrawElement,
  zoom: number,
): void {
  const { x, y, width, height, angle } = element;
  const cx = x + width / 2;
  const cy = y + height / 2;
  const lineWidth = 2 / zoom;

  ctx.save();
  ctx.strokeStyle = SELECTION_BORDER_COLOR;
  ctx.lineWidth = lineWidth;
  ctx.globalAlpha = 0.6;
  ctx.translate(cx, cy);
  ctx.rotate(angle);

  const lx = x - cx;
  const ly = y - cy;

  if (element.type === 'ellipse') {
    ctx.beginPath();
    ctx.ellipse(0, 0, width / 2, height / 2, 0, 0, Math.PI * 2);
    ctx.stroke();
  } else if (element.type === 'diamond') {
    ctx.beginPath();
    ctx.moveTo(0, ly);
    ctx.lineTo(lx + width, 0);
    ctx.lineTo(0, ly + height);
    ctx.lineTo(lx, 0);
    ctx.closePath();
    ctx.stroke();
  } else {
    const r = element.roundness ? Math.min(width, height) * 0.1 : 0;
    if (r > 0 && ctx.roundRect) {
      ctx.beginPath();
      ctx.roundRect(lx, ly, width, height, r);
      ctx.stroke();
    } else {
      ctx.strokeRect(lx, ly, width, height);
    }
  }

  ctx.restore();
}

function drawBindingSnapPoints(
  ctx: CanvasRenderingContext2D,
  element: DrawElement,
  activeMidPoint: GlobalPoint | null,
  zoom: number,
): void {
  const snapPoints = getElementSnapPoints(element);
  const dotRadius = 4 / zoom;
  const activeDotRadius = 6 / zoom;

  for (const sp of snapPoints) {
    const isActive =
      activeMidPoint &&
      Math.abs(sp[0] - activeMidPoint[0]) < 0.5 &&
      Math.abs(sp[1] - activeMidPoint[1]) < 0.5;

    ctx.save();

    if (isActive) {
      ctx.fillStyle = SELECTION_BORDER_COLOR;
      ctx.globalAlpha = 1;
      ctx.beginPath();
      ctx.arc(sp[0], sp[1], activeDotRadius, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5 / zoom;
      ctx.stroke();
    } else {
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = SELECTION_BORDER_COLOR;
      ctx.lineWidth = 1 / zoom;
      ctx.globalAlpha = 0.7;
      ctx.beginPath();
      ctx.arc(sp[0], sp[1], dotRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    ctx.restore();
  }
}
