import type { ToolType } from '../types';

const TOOL_CURSORS: Record<string, string> = {
  selection: 'default',
  hand: 'grab',
  freedraw: 'crosshair',
  text: 'text',
  eraser: 'crosshair',
  laser: 'crosshair',
};

const SHAPE_CURSOR = 'crosshair';

export function getCursorForTool(tool: ToolType): string {
  return TOOL_CURSORS[tool] ?? SHAPE_CURSOR;
}

export function getGrabbingCursor(): string {
  return 'grabbing';
}

export function getResizeCursor(angle: number, direction: string): string {
  const directionMap: Record<string, string> = {
    n: 'ns-resize',
    s: 'ns-resize',
    e: 'ew-resize',
    w: 'ew-resize',
    ne: 'nesw-resize',
    sw: 'nesw-resize',
    nw: 'nwse-resize',
    se: 'nwse-resize',
  };
  return directionMap[direction] ?? 'default';
}

export function getRotationCursor(): string {
  return 'grab';
}
