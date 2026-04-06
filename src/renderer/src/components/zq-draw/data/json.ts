import type { DrawElement, AppState, BinaryFiles, DrawData } from '../types';
import { DRAW_VERSION, DRAW_SOURCE } from '../constants';

export function serializeAsJSON(
  elements: readonly DrawElement[],
  appState: Partial<AppState>,
  files: BinaryFiles,
): string {
  const data: DrawData = {
    type: 'zq-draw',
    version: DRAW_VERSION,
    source: DRAW_SOURCE,
    elements: elements.filter((el) => !el.isDeleted),
    appState: {
      viewBackgroundColor: appState.viewBackgroundColor,
      gridModeEnabled: appState.gridModeEnabled,
      gridSize: appState.gridSize,
      theme: appState.theme,
      name: appState.name,
    },
    files,
  };
  return JSON.stringify(data, null, 2);
}

export function deserializeFromJSON(json: string): DrawData | null {
  try {
    const data = JSON.parse(json);
    if (data.type !== 'zq-draw') {
      console.warn('Unknown draw data type:', data.type);
    }
    return data as DrawData;
  } catch {
    console.error('Failed to parse draw JSON');
    return null;
  }
}

export function toDrawData(
  elements: readonly DrawElement[],
  appState: Partial<AppState>,
  files: BinaryFiles,
): DrawData {
  return {
    type: 'zq-draw',
    version: DRAW_VERSION,
    source: DRAW_SOURCE,
    elements: elements.filter((el) => !el.isDeleted),
    appState: {
      viewBackgroundColor: appState.viewBackgroundColor,
      gridModeEnabled: appState.gridModeEnabled,
      gridSize: appState.gridSize,
      theme: appState.theme,
      name: appState.name,
    },
    files,
  };
}
