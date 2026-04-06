/**
 * zq-draw core type definitions
 * Modeled after Excalidraw's element/app state system, adapted for Vue 3.
 */

// ---------------------------------------------------------------------------
// Branded primitives
// ---------------------------------------------------------------------------
export type Radians = number & { _brand: 'radians' };
export type NormalizedZoomValue = number & { _brand: 'normalizedZoom' };
export type DataURL = string & { _brand: 'DataURL' };
export type FileId = string & { _brand: 'FileId' };
export type FractionalIndex = string & { _brand: 'fractionalIndex' };
export type FontString = string & { _brand: 'fontString' };

// ---------------------------------------------------------------------------
// Enums / Literal unions
// ---------------------------------------------------------------------------
export type DrawElementType =
  | 'selection'
  | 'rectangle'
  | 'ellipse'
  | 'diamond'
  | 'line'
  | 'arrow'
  | 'freedraw'
  | 'text'
  | 'image'
  | 'frame'
  | 'embeddable';

export type FillStyle =
  | 'hachure'
  | 'cross-hatch'
  | 'solid'
  | 'zigzag'
  | 'dots'
  | 'dashed'
  | 'zigzag-line';
export type StrokeStyle = 'solid' | 'dashed' | 'dotted';
export type StrokeRoundness = 'round' | 'sharp';
export type TextAlign = 'left' | 'center' | 'right';
export type VerticalAlign = 'top' | 'middle' | 'bottom';
export type Theme = 'light' | 'dark';
export type PointerType = 'mouse' | 'pen' | 'touch';

export type Arrowhead =
  | 'arrow'
  | 'bar'
  | 'circle'
  | 'circle_outline'
  | 'triangle'
  | 'triangle_outline'
  | 'diamond'
  | 'diamond_outline';

export type ArrowType = 'sharp' | 'round' | 'elbow';

export type ToolType =
  | 'selection'
  | 'rectangle'
  | 'ellipse'
  | 'diamond'
  | 'line'
  | 'arrow'
  | 'freedraw'
  | 'text'
  | 'image'
  | 'eraser'
  | 'hand'
  | 'frame'
  | 'laser';

export interface ActiveTool {
  type: ToolType;
  customType: string | null;
  locked: boolean;
  lastActiveTool: { type: ToolType; customType: string | null } | null;
}

// ---------------------------------------------------------------------------
// Point types
// ---------------------------------------------------------------------------
export type GlobalPoint = [number, number] & { _brand: 'globalPoint' };
export type LocalPoint = [number, number] & { _brand: 'localPoint' };

// ---------------------------------------------------------------------------
// Element types
// ---------------------------------------------------------------------------
export interface BoundElement {
  id: string;
  type: 'arrow' | 'text';
}

export interface RoundnessConfig {
  type: number;
  value?: number;
}

interface DrawElementBase {
  id: string;
  type: DrawElementType;
  x: number;
  y: number;
  width: number;
  height: number;
  angle: Radians;
  strokeColor: string;
  backgroundColor: string;
  fillStyle: FillStyle;
  strokeWidth: number;
  strokeStyle: StrokeStyle;
  roughness: number;
  opacity: number;
  roundness: RoundnessConfig | null;
  seed: number;
  version: number;
  versionNonce: number;
  index: FractionalIndex | null;
  isDeleted: boolean;
  groupIds: readonly string[];
  frameId: string | null;
  boundElements: readonly BoundElement[] | null;
  link: string | null;
  locked: boolean;
  updated: number;
  customData?: Record<string, any>;
}

export interface DrawSelectionElement extends DrawElementBase {
  type: 'selection';
}

export interface DrawRectangleElement extends DrawElementBase {
  type: 'rectangle';
}

export interface DrawEllipseElement extends DrawElementBase {
  type: 'ellipse';
}

export interface DrawDiamondElement extends DrawElementBase {
  type: 'diamond';
}

export interface DrawTextElement extends DrawElementBase {
  type: 'text';
  text: string;
  originalText: string;
  fontSize: number;
  fontFamily: number;
  textAlign: TextAlign;
  verticalAlign: VerticalAlign;
  containerId: string | null;
  autoResize: boolean;
  lineHeight: number;
}

export interface FixedPointBinding {
  elementId: string;
  fixedPoint: [number, number];
}

export interface DrawLinearElement extends DrawElementBase {
  type: 'line' | 'arrow';
  points: readonly LocalPoint[];
  startBinding: FixedPointBinding | null;
  endBinding: FixedPointBinding | null;
  startArrowhead: Arrowhead | null;
  endArrowhead: Arrowhead | null;
}

export interface DrawArrowElement extends DrawLinearElement {
  type: 'arrow';
  elbowed: boolean;
}

export interface DrawFreeDrawElement extends DrawElementBase {
  type: 'freedraw';
  points: readonly LocalPoint[];
  pressures: readonly number[];
  simulatePressure: boolean;
}

export interface DrawImageElement extends DrawElementBase {
  type: 'image';
  fileId: FileId | null;
  status: 'pending' | 'saved' | 'error';
  scale: [number, number];
}

export interface DrawFrameElement extends DrawElementBase {
  type: 'frame';
  name: string | null;
}

export interface DrawEmbeddableElement extends DrawElementBase {
  type: 'embeddable';
}

export type DrawElement =
  | DrawSelectionElement
  | DrawRectangleElement
  | DrawEllipseElement
  | DrawDiamondElement
  | DrawTextElement
  | DrawLinearElement
  | DrawArrowElement
  | DrawFreeDrawElement
  | DrawImageElement
  | DrawFrameElement
  | DrawEmbeddableElement;

export type NonDeletedDrawElement = DrawElement & { isDeleted: false };

export type OrderedDrawElement = DrawElement & {
  index: FractionalIndex;
};

// ---------------------------------------------------------------------------
// Binary files
// ---------------------------------------------------------------------------
export interface BinaryFileData {
  mimeType: string;
  id: FileId;
  dataURL: DataURL;
  created: number;
  lastRetrieved?: number;
}

export type BinaryFiles = Record<string, BinaryFileData>;

// ---------------------------------------------------------------------------
// Zoom
// ---------------------------------------------------------------------------
export interface Zoom {
  value: NormalizedZoomValue;
}

// ---------------------------------------------------------------------------
// App State
// ---------------------------------------------------------------------------
export interface AppState {
  activeTool: ActiveTool;
  viewBackgroundColor: string;
  zoom: Zoom;
  scrollX: number;
  scrollY: number;
  width: number;
  height: number;
  offsetTop: number;
  offsetLeft: number;
  theme: Theme;

  // selection
  selectedElementIds: Record<string, true>;
  selectedGroupIds: Record<string, boolean>;

  // current drawing style
  currentItemStrokeColor: string;
  currentItemBackgroundColor: string;
  currentItemFillStyle: FillStyle;
  currentItemStrokeWidth: number;
  currentItemStrokeStyle: StrokeStyle;
  currentItemRoughness: number;
  currentItemOpacity: number;
  currentItemFontFamily: number;
  currentItemFontSize: number;
  currentItemTextAlign: TextAlign;
  currentItemStartArrowhead: Arrowhead | null;
  currentItemEndArrowhead: Arrowhead | null;
  currentItemRoundness: StrokeRoundness;
  currentItemArrowType: ArrowType;

  // modes
  viewModeEnabled: boolean;
  zenModeEnabled: boolean;
  gridModeEnabled: boolean;
  gridSize: number;
  gridStep: number;
  objectsSnapModeEnabled: boolean;

  // editing
  editingTextElement: DrawTextElement | null;
  editingLinearElement: LinearElementEditorState | null;
  editingGroupId: string | null;
  newElement: DrawElement | null;
  selectionElement: DrawSelectionElement | null;
  resizingElement: DrawElement | null;
  multiElement: DrawLinearElement | null;

  // interaction
  isResizing: boolean;
  isRotating: boolean;
  cursorButton: 'up' | 'down';
  lastPointerDownWith: PointerType;
  selectedElementsAreBeingDragged: boolean;

  // ui
  openMenu: 'canvas' | null;
  openPopup: string | null;
  showHyperlinkPopup: false | 'info' | 'editor';
  isLoading: boolean;
  errorMessage: string | null;
  name: string | null;

  // snap
  snapLines: readonly SnapLine[];
  originSnapOffset: { x: number; y: number } | null;

  // binding
  suggestedBindings: SuggestedBinding[];

  // export
  exportBackground: boolean;
  exportScale: number;
  exportWithDarkMode: boolean;

  // frame
  frameRendering: {
    enabled: boolean;
    name: boolean;
    outline: boolean;
    clip: boolean;
  };
}

// ---------------------------------------------------------------------------
// Snap lines
// ---------------------------------------------------------------------------
export interface SnapLine {
  type: 'points' | 'gap';
  points: GlobalPoint[];
}

// ---------------------------------------------------------------------------
// Binding suggestion (arrow tool hover feedback)
// ---------------------------------------------------------------------------
export interface SuggestedBinding {
  element: DrawElement;
  midPoint: GlobalPoint | null;
}

// ---------------------------------------------------------------------------
// Scene data (serialization)
// ---------------------------------------------------------------------------
export interface DrawData {
  type: 'zq-draw';
  version: number;
  source: string;
  elements: readonly DrawElement[];
  appState: Partial<AppState>;
  files: BinaryFiles;
}

// ---------------------------------------------------------------------------
// Component props / emits
// ---------------------------------------------------------------------------
export interface DrawProps {
  modelValue?: DrawData;
  readonly?: boolean;
  width?: number | string;
  height?: number | string;
  theme?: Theme;
  gridMode?: boolean;
  zenMode?: boolean;
  initialData?: DrawData | (() => Promise<DrawData>);
}

export interface DrawEmits {
  (e: 'update:modelValue', data: DrawData): void;
  (e: 'change', elements: DrawElement[], appState: Partial<AppState>): void;
  (e: 'save', data: DrawData): void;
}

// ---------------------------------------------------------------------------
// Action system
// ---------------------------------------------------------------------------
export type CaptureUpdateAction = 'immediately' | 'eventually' | 'none';

export interface ActionResult {
  elements?: readonly DrawElement[];
  appState?: Partial<AppState>;
  captureUpdate: CaptureUpdateAction;
}

// ---------------------------------------------------------------------------
// Linear element editor
// ---------------------------------------------------------------------------
export interface LinearElementEditorState {
  elementId: string;
  selectedPointIndices: number[];
  isDragging: boolean;
  dragStartPoint: GlobalPoint | null;
  lastDragPoint: GlobalPoint | null;
}

// ---------------------------------------------------------------------------
// Transform handles
// ---------------------------------------------------------------------------
export type TransformHandleDirection =
  | 'n'
  | 's'
  | 'w'
  | 'e'
  | 'nw'
  | 'ne'
  | 'sw'
  | 'se';

export type TransformHandleType = TransformHandleDirection | 'rotation';
export type MaybeTransformHandleType = TransformHandleType | false;
