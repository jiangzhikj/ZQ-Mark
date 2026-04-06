import type { AppState, NormalizedZoomValue } from '../../types';

export function sceneCoordsToViewport(
  sceneX: number,
  sceneY: number,
  appState: { scrollX: number; scrollY: number; zoom: { value: number } },
): { x: number; y: number } {
  return {
    x: (sceneX + appState.scrollX) * appState.zoom.value,
    y: (sceneY + appState.scrollY) * appState.zoom.value,
  };
}

export function viewportCoordsToScene(
  viewportX: number,
  viewportY: number,
  appState: { scrollX: number; scrollY: number; zoom: { value: number } },
): { x: number; y: number } {
  return {
    x: viewportX / appState.zoom.value - appState.scrollX,
    y: viewportY / appState.zoom.value - appState.scrollY,
  };
}

export function getNormalizedZoom(zoom: number): NormalizedZoomValue {
  return Math.max(0.1, Math.min(30, zoom)) as NormalizedZoomValue;
}

export function applyZoom(
  ctx: CanvasRenderingContext2D,
  appState: { scrollX: number; scrollY: number; zoom: { value: number } },
): void {
  const dpr = window.devicePixelRatio || 1;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.scale(appState.zoom.value, appState.zoom.value);
  ctx.translate(appState.scrollX, appState.scrollY);
}

export function drawGrid(
  ctx: CanvasRenderingContext2D,
  appState: AppState,
): void {
  if (!appState.gridModeEnabled) return;

  const gridSize = appState.gridSize;
  const zoom = appState.zoom.value;

  const offsetX = appState.scrollX * zoom;
  const offsetY = appState.scrollY * zoom;
  const width = appState.width;
  const height = appState.height;

  ctx.save();
  const dprGrid = window.devicePixelRatio || 1;
  ctx.setTransform(dprGrid, 0, 0, dprGrid, 0, 0);

  ctx.strokeStyle = appState.theme === 'dark'
    ? 'rgba(255, 255, 255, 0.1)'
    : 'rgba(0, 0, 0, 0.1)';
  ctx.lineWidth = 1;

  const scaledGrid = gridSize * zoom;
  const startX = (offsetX % scaledGrid) - scaledGrid;
  const startY = (offsetY % scaledGrid) - scaledGrid;

  ctx.beginPath();
  for (let x = startX; x < width + scaledGrid; x += scaledGrid) {
    ctx.moveTo(Math.round(x) + 0.5, 0);
    ctx.lineTo(Math.round(x) + 0.5, height);
  }
  for (let y = startY; y < height + scaledGrid; y += scaledGrid) {
    ctx.moveTo(0, Math.round(y) + 0.5);
    ctx.lineTo(width, Math.round(y) + 0.5);
  }
  ctx.stroke();

  ctx.restore();
}
