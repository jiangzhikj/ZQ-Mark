import { nanoid } from 'nanoid';

import type {
  DrawElement,
  DrawRectangleElement,
  DrawEllipseElement,
  DrawDiamondElement,
  DrawTextElement,
  DrawLinearElement,
  DrawArrowElement,
  DrawFreeDrawElement,
  DrawImageElement,
  DrawFrameElement,
  DrawSelectionElement,
  FillStyle,
  StrokeStyle,
  Radians,
  LocalPoint,
  Arrowhead,
  TextAlign,
  VerticalAlign,
  FractionalIndex,
  FileId,
} from '../types';
import {
  DEFAULT_ELEMENT_STROKE_COLOR,
  DEFAULT_ELEMENT_BACKGROUND_COLOR,
  DEFAULT_ELEMENT_FILL_STYLE,
  DEFAULT_ELEMENT_STROKE_WIDTH,
  DEFAULT_ELEMENT_STROKE_STYLE,
  DEFAULT_ELEMENT_ROUGHNESS,
  DEFAULT_ELEMENT_OPACITY,
  DEFAULT_ELEMENT_ROUNDNESS,
  DEFAULT_FONT_SIZE,
  DEFAULT_FONT_FAMILY,
  DEFAULT_TEXT_ALIGN,
  DEFAULT_VERTICAL_ALIGN,
  DEFAULT_LINE_HEIGHT,
  DEFAULT_END_ARROWHEAD,
  ANGLE_ZERO,
  FONT_FAMILY_FALLBACKS,
  ROUNDNESS,
} from '../constants';

function randomInteger(): number {
  return Math.floor(Math.random() * 2 ** 31);
}

function randomSeed(): number {
  return Math.floor(Math.random() * 2 ** 31);
}

interface CommonOpts {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  strokeColor?: string;
  backgroundColor?: string;
  fillStyle?: FillStyle;
  strokeWidth?: number;
  strokeStyle?: StrokeStyle;
  roughness?: number;
  opacity?: number;
  angle?: Radians;
  locked?: boolean;
  groupIds?: string[];
  frameId?: string | null;
}

function baseElement(
  type: DrawElement['type'],
  opts: CommonOpts = {},
): Omit<DrawElement, 'type'> & { type: string } {
  return {
    id: nanoid(),
    type,
    x: opts.x ?? 0,
    y: opts.y ?? 0,
    width: opts.width ?? 0,
    height: opts.height ?? 0,
    angle: opts.angle ?? ANGLE_ZERO,
    strokeColor: opts.strokeColor ?? DEFAULT_ELEMENT_STROKE_COLOR,
    backgroundColor: opts.backgroundColor ?? DEFAULT_ELEMENT_BACKGROUND_COLOR,
    fillStyle: opts.fillStyle ?? DEFAULT_ELEMENT_FILL_STYLE,
    strokeWidth: opts.strokeWidth ?? DEFAULT_ELEMENT_STROKE_WIDTH,
    strokeStyle: opts.strokeStyle ?? DEFAULT_ELEMENT_STROKE_STYLE,
    roughness: opts.roughness ?? DEFAULT_ELEMENT_ROUGHNESS,
    opacity: opts.opacity ?? DEFAULT_ELEMENT_OPACITY,
    roundness: DEFAULT_ELEMENT_ROUNDNESS,
    seed: randomSeed(),
    version: 1,
    versionNonce: randomInteger(),
    index: null as FractionalIndex | null,
    isDeleted: false,
    groupIds: opts.groupIds ?? [],
    frameId: opts.frameId ?? null,
    boundElements: null,
    link: null,
    locked: opts.locked ?? false,
    updated: Date.now(),
  };
}

export function newRectangleElement(
  opts: CommonOpts = {},
): DrawRectangleElement {
  return { ...baseElement('rectangle', opts), type: 'rectangle' } as DrawRectangleElement;
}

export function newEllipseElement(opts: CommonOpts = {}): DrawEllipseElement {
  return { ...baseElement('ellipse', opts), type: 'ellipse' } as DrawEllipseElement;
}

export function newDiamondElement(opts: CommonOpts = {}): DrawDiamondElement {
  return { ...baseElement('diamond', opts), type: 'diamond' } as DrawDiamondElement;
}

export function newSelectionElement(
  opts: CommonOpts = {},
): DrawSelectionElement {
  return {
    ...baseElement('selection', opts),
    type: 'selection',
  } as DrawSelectionElement;
}

export interface TextOpts extends CommonOpts {
  text?: string;
  fontSize?: number;
  fontFamily?: number;
  textAlign?: TextAlign;
  verticalAlign?: VerticalAlign;
  containerId?: string | null;
  lineHeight?: number;
  autoResize?: boolean;
}

export function newTextElement(opts: TextOpts = {}): DrawTextElement {
  const text = opts.text ?? '';
  const fontSize = opts.fontSize ?? DEFAULT_FONT_SIZE;
  const fontFamily = opts.fontFamily ?? DEFAULT_FONT_FAMILY;
  const lineHeight = opts.lineHeight ?? DEFAULT_LINE_HEIGHT;

  let width = opts.width ?? 0;
  let height = opts.height ?? 0;

  if (text && (width === 0 || height === 0)) {
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const ff = FONT_FAMILY_FALLBACKS[fontFamily] || 'sans-serif';
        ctx.font = `${fontSize}px ${ff}`;
        const lines = text.split('\n');
        let maxW = 0;
        for (const line of lines) {
          maxW = Math.max(maxW, ctx.measureText(line || ' ').width);
        }
        if (width === 0) width = Math.ceil(maxW);
        if (height === 0) height = Math.ceil(lines.length * fontSize * lineHeight);
      }
    } catch {
      const lineCount = text.split('\n').length;
      height = lineCount * fontSize * lineHeight;
      width = text.length * fontSize * 0.6;
    }
  }

  if (height === 0) {
    height = Math.ceil(fontSize * lineHeight);
  }

  return {
    ...baseElement('text', { ...opts, width, height }),
    type: 'text',
    text,
    originalText: text,
    fontSize,
    fontFamily,
    textAlign: (opts.textAlign ?? DEFAULT_TEXT_ALIGN) as TextAlign,
    verticalAlign: (opts.verticalAlign ?? DEFAULT_VERTICAL_ALIGN) as VerticalAlign,
    containerId: opts.containerId ?? null,
    autoResize: opts.autoResize ?? true,
    lineHeight,
  } as DrawTextElement;
}

export interface LinearOpts extends CommonOpts {
  points?: LocalPoint[];
  startArrowhead?: Arrowhead | null;
  endArrowhead?: Arrowhead | null;
}

export function newLineElement(opts: LinearOpts = {}): DrawLinearElement {
  return {
    ...baseElement('line', opts),
    type: 'line',
    roundness: { type: ROUNDNESS.PROPORTIONAL_RADIUS },
    points: opts.points ?? ([[0, 0] as LocalPoint, [0, 0] as LocalPoint]),
    startBinding: null,
    endBinding: null,
    startArrowhead: opts.startArrowhead ?? null,
    endArrowhead: opts.endArrowhead ?? null,
  } as DrawLinearElement;
}

export function newArrowElement(opts: LinearOpts = {}): DrawArrowElement {
  return {
    ...baseElement('arrow', opts),
    type: 'arrow',
    roundness: { type: ROUNDNESS.PROPORTIONAL_RADIUS },
    points: opts.points ?? ([[0, 0] as LocalPoint, [0, 0] as LocalPoint]),
    startBinding: null,
    endBinding: null,
    startArrowhead: opts.startArrowhead ?? null,
    endArrowhead: opts.endArrowhead ?? DEFAULT_END_ARROWHEAD,
    elbowed: false,
  } as DrawArrowElement;
}

export interface FreeDrawOpts extends CommonOpts {
  points?: LocalPoint[];
  pressures?: number[];
  simulatePressure?: boolean;
}

export function newFreeDrawElement(
  opts: FreeDrawOpts = {},
): DrawFreeDrawElement {
  return {
    ...baseElement('freedraw', opts),
    type: 'freedraw',
    points: opts.points ?? [],
    pressures: opts.pressures ?? [],
    simulatePressure: opts.simulatePressure ?? true,
  } as DrawFreeDrawElement;
}

export interface ImageOpts extends CommonOpts {
  fileId?: FileId | null;
}

export function newImageElement(opts: ImageOpts = {}): DrawImageElement {
  return {
    ...baseElement('image', opts),
    type: 'image',
    fileId: opts.fileId ?? null,
    status: 'pending',
    scale: [1, 1],
  } as DrawImageElement;
}

export function newFrameElement(
  opts: CommonOpts & { name?: string } = {},
): DrawFrameElement {
  return {
    ...baseElement('frame', opts),
    type: 'frame',
    name: opts.name ?? null,
    width: opts.width ?? 800,
    height: opts.height ?? 600,
  } as DrawFrameElement;
}

export function newElementByType(
  type: DrawElement['type'],
  opts: CommonOpts = {},
): DrawElement {
  switch (type) {
    case 'rectangle':
      return newRectangleElement(opts);
    case 'ellipse':
      return newEllipseElement(opts);
    case 'diamond':
      return newDiamondElement(opts);
    case 'text':
      return newTextElement(opts as TextOpts);
    case 'line':
      return newLineElement(opts as LinearOpts);
    case 'arrow':
      return newArrowElement(opts as LinearOpts);
    case 'freedraw':
      return newFreeDrawElement(opts as FreeDrawOpts);
    case 'image':
      return newImageElement(opts as ImageOpts);
    case 'frame':
      return newFrameElement(opts);
    case 'selection':
      return newSelectionElement(opts);
    default:
      return newRectangleElement(opts);
  }
}
