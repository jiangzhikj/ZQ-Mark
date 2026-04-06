import type { DrawElement, AppState, BinaryFiles } from '../types';
import { getCommonBounds } from '../elements/bounds';
import { renderStaticScene } from '../core/renderer/static-scene';

const EXPORT_PADDING = 20;

export async function exportToCanvas(
  elements: readonly DrawElement[],
  appState: Partial<AppState>,
  files: BinaryFiles,
  imageCache: Map<string, HTMLImageElement>,
  opts: { padding?: number; scale?: number; background?: boolean } = {},
): Promise<HTMLCanvasElement> {
  const nonDeleted = elements.filter((el) => !el.isDeleted);
  if (nonDeleted.length === 0) {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    return canvas;
  }

  const [x1, y1, x2, y2] = getCommonBounds(nonDeleted);
  const padding = opts.padding ?? EXPORT_PADDING;
  const scale = opts.scale ?? 2;

  const width = x2 - x1 + padding * 2;
  const height = y2 - y1 + padding * 2;

  const canvas = document.createElement('canvas');

  const exportAppState: AppState = {
    ...getDefaultExportAppState(),
    ...appState,
    width,
    height,
    scrollX: -x1 + padding,
    scrollY: -y1 + padding,
    zoom: { value: 1 as any },
    gridModeEnabled: false,
  } as AppState;

  if (opts.background === false) {
    exportAppState.viewBackgroundColor = 'transparent';
  }

  renderStaticScene(canvas, nonDeleted, exportAppState, files, imageCache);

  if (scale !== 1) {
    const scaledCanvas = document.createElement('canvas');
    scaledCanvas.width = canvas.width * scale;
    scaledCanvas.height = canvas.height * scale;
    const ctx = scaledCanvas.getContext('2d');
    if (ctx) {
      ctx.scale(scale, scale);
      ctx.drawImage(canvas, 0, 0);
    }
    return scaledCanvas;
  }

  return canvas;
}

export async function exportToBlob(
  elements: readonly DrawElement[],
  appState: Partial<AppState>,
  files: BinaryFiles,
  imageCache: Map<string, HTMLImageElement>,
  opts: { padding?: number; scale?: number; background?: boolean; type?: string; quality?: number } = {},
): Promise<Blob> {
  const canvas = await exportToCanvas(elements, appState, files, imageCache, opts);
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Failed to export to blob'));
      },
      opts.type ?? 'image/png',
      opts.quality ?? 0.92,
    );
  });
}

function getDefaultExportAppState(): AppState {
  return {
    viewBackgroundColor: '#ffffff',
    zoom: { value: 1 as any },
    scrollX: 0,
    scrollY: 0,
    width: 100,
    height: 100,
    theme: 'light',
    gridModeEnabled: false,
    gridSize: 20,
    gridStep: 5,
    exportBackground: true,
    exportScale: 2,
    exportWithDarkMode: false,
  } as AppState;
}
