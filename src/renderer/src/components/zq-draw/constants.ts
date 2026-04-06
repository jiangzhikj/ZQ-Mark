import type {
  Arrowhead,
  FillStyle,
  NormalizedZoomValue,
  Radians,
  StrokeStyle,
  ToolType,
} from './types';

// ---------------------------------------------------------------------------
// Version
// ---------------------------------------------------------------------------
export const DRAW_VERSION = 1;
export const DRAW_SOURCE = 'zq-draw';

// ---------------------------------------------------------------------------
// Zoom
// ---------------------------------------------------------------------------
export const MIN_ZOOM = 0.1 as NormalizedZoomValue;
export const MAX_ZOOM = 30 as NormalizedZoomValue;
export const DEFAULT_ZOOM = 1 as NormalizedZoomValue;
export const ZOOM_STEP = 0.1;

// ---------------------------------------------------------------------------
// Grid
// ---------------------------------------------------------------------------
export const DEFAULT_GRID_SIZE = 20;
export const DEFAULT_GRID_STEP = 5;

// ---------------------------------------------------------------------------
// Element defaults
// ---------------------------------------------------------------------------
export const DEFAULT_ELEMENT_STROKE_COLOR = '#1e1e1e';
export const DEFAULT_ELEMENT_BACKGROUND_COLOR = 'transparent';
export const DEFAULT_ELEMENT_FILL_STYLE: FillStyle = 'hachure';
export const DEFAULT_ELEMENT_STROKE_WIDTH = 2;
export const DEFAULT_ELEMENT_STROKE_STYLE: StrokeStyle = 'solid';
export const DEFAULT_ELEMENT_ROUGHNESS = 1;
export const DEFAULT_ELEMENT_OPACITY = 100;
export const DEFAULT_ELEMENT_ROUNDNESS = { type: 3 };

// ---------------------------------------------------------------------------
// Text defaults
// ---------------------------------------------------------------------------
export const DEFAULT_FONT_SIZE = 20;
export const DEFAULT_FONT_FAMILY = 5; // Excalifont (hand-drawn)
export const DEFAULT_TEXT_ALIGN = 'left';
export const DEFAULT_VERTICAL_ALIGN = 'top';
export const DEFAULT_LINE_HEIGHT = 1.25;
export const BOUND_TEXT_PADDING = 5;

export const FONT_FAMILY = {
  Virgil: 1,
  Helvetica: 2,
  Cascadia: 3,
  Assistant: 4,
  Excalifont: 5,
  Nunito: 6,
  'Comic Shanns': 8,
} as const;

export const FONT_FAMILY_FALLBACKS: Record<number, string> = {
  1: '"Virgil", "Excalifont", "Xiaolai", "Segoe UI Emoji", cursive',
  2: '"Helvetica", "Segoe UI Emoji", sans-serif',
  3: '"Cascadia", "Comic Shanns", "Segoe UI Emoji", monospace',
  4: '"Assistant", "Segoe UI Emoji", sans-serif',
  5: '"Excalifont", "Virgil", "Xiaolai", "Segoe UI Emoji", cursive',
  6: '"Nunito", "Segoe UI Emoji", sans-serif',
  8: '"Comic Shanns", "Cascadia", "Segoe UI Emoji", monospace',
};

export interface FontMetrics {
  unitsPerEm: number;
  ascender: number;
  descender: number;
  lineHeight: number;
}

export const FONT_METADATA: Record<number, FontMetrics> = {
  [FONT_FAMILY.Excalifont]: { unitsPerEm: 1000, ascender: 886, descender: -374, lineHeight: 1.25 },
  [FONT_FAMILY.Nunito]: { unitsPerEm: 1000, ascender: 1011, descender: -353, lineHeight: 1.25 },
  [FONT_FAMILY['Comic Shanns']]: { unitsPerEm: 1000, ascender: 750, descender: -250, lineHeight: 1.25 },
  [FONT_FAMILY.Virgil]: { unitsPerEm: 1000, ascender: 886, descender: -374, lineHeight: 1.25 },
  [FONT_FAMILY.Helvetica]: { unitsPerEm: 2048, ascender: 1577, descender: -471, lineHeight: 1.15 },
  [FONT_FAMILY.Cascadia]: { unitsPerEm: 2048, ascender: 1900, descender: -480, lineHeight: 1.2 },
  [FONT_FAMILY.Assistant]: { unitsPerEm: 2048, ascender: 1021, descender: -287, lineHeight: 1.25 },
};

/**
 * Calculates vertical offset for text rendered with alphabetic baseline.
 * Matches excalidraw's getVerticalOffset for consistent text positioning.
 */
export function getVerticalOffset(
  fontFamily: number,
  fontSize: number,
  lineHeightPx: number,
): number {
  const metrics = FONT_METADATA[fontFamily] ?? FONT_METADATA[FONT_FAMILY.Excalifont]!;
  const fontSizeEm = fontSize / metrics.unitsPerEm;
  const lineGap = (lineHeightPx - fontSizeEm * metrics.ascender + fontSizeEm * metrics.descender) / 2;
  return fontSizeEm * metrics.ascender + lineGap;
}

// ---------------------------------------------------------------------------
// Arrow defaults
// ---------------------------------------------------------------------------
export const DEFAULT_START_ARROWHEAD: Arrowhead | null = null;
export const DEFAULT_END_ARROWHEAD: Arrowhead | null = 'arrow';

// ---------------------------------------------------------------------------
// Colors
// ---------------------------------------------------------------------------
export const CANVAS_BACKGROUND_LIGHT = '#ffffff';
export const CANVAS_BACKGROUND_DARK = '#121212';

export const PRESET_STROKE_COLORS = [
  '#1e1e1e',
  '#e03131',
  '#2f9e44',
  '#1971c2',
  '#f08c00',
  '#6741d9',
  '#0c8599',
  '#e8590c',
];

export const PRESET_BACKGROUND_COLORS = [
  'transparent',
  '#ffc9c9',
  '#b2f2bb',
  '#a5d8ff',
  '#ffec99',
  '#d0bfff',
  '#99e9f2',
  '#ffd8a8',
];

// ---------------------------------------------------------------------------
// Snap
// ---------------------------------------------------------------------------
export const SNAP_THRESHOLD = 8;
export const SNAP_LINE_COLOR = '#6366f1';

// ---------------------------------------------------------------------------
// History
// ---------------------------------------------------------------------------
export const HISTORY_MAX_STEPS = 100;

// ---------------------------------------------------------------------------
// Selection
// ---------------------------------------------------------------------------
export const SELECTION_BORDER_COLOR = '#6965db';
export const SELECTION_FILL_COLOR = 'rgba(105, 101, 219, 0.1)';

// ---------------------------------------------------------------------------
// Transform handles
// ---------------------------------------------------------------------------
export const TRANSFORM_HANDLE_SIZE = 8;
export const ROTATION_HANDLE_OFFSET = 24;

// ---------------------------------------------------------------------------
// Misc
// ---------------------------------------------------------------------------
export const ANGLE_ZERO = 0 as Radians;
export const TAU = Math.PI * 2;
export const DRAGGING_THRESHOLD = 3;
export const LINE_CONFIRM_THRESHOLD = 10;
export const MIN_WIDTH_OR_HEIGHT = 1;

// ---------------------------------------------------------------------------
// Tool shortcuts
// ---------------------------------------------------------------------------
export const TOOL_SHORTCUTS: Partial<Record<ToolType, string>> = {
  selection: 'v',
  rectangle: 'r',
  ellipse: 'o',
  diamond: 'd',
  line: 'l',
  arrow: 'a',
  freedraw: 'p',
  text: 't',
  image: 'i',
  eraser: 'e',
  hand: 'h',
  frame: 'f',
};

// ---------------------------------------------------------------------------
// Roundness
// ---------------------------------------------------------------------------
export const DEFAULT_PROPORTIONAL_RADIUS = 0.25;
export const DEFAULT_ADAPTIVE_RADIUS = 32;

export const ROUNDNESS = {
  LEGACY: 1,
  PROPORTIONAL_RADIUS: 2,
  ADAPTIVE_RADIUS: 3,
} as const;
