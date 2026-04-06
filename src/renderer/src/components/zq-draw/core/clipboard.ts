import type { DrawElement, BinaryFiles } from '../types';
import { duplicateElement } from '../elements/duplicate';

const CLIPBOARD_KEY = 'zq-draw-clipboard';

export interface ClipboardData {
  elements: readonly DrawElement[];
  files: BinaryFiles;
}

let memoryClipboard: ClipboardData | null = null;

function serializeClipboard(data: ClipboardData): string {
  return JSON.stringify({
    type: CLIPBOARD_KEY,
    elements: data.elements,
    files: data.files,
  });
}

function deserializeClipboard(text: string): ClipboardData | null {
  try {
    const parsed = JSON.parse(text);
    if (parsed?.type !== CLIPBOARD_KEY || !Array.isArray(parsed.elements)) {
      return null;
    }
    return {
      elements: parsed.elements,
      files: parsed.files || {},
    };
  } catch {
    return null;
  }
}

export async function copyElements(
  elements: readonly DrawElement[],
  files: BinaryFiles,
): Promise<void> {
  const data: ClipboardData = {
    elements: elements.map((el) => ({ ...el })),
    files: { ...files },
  };
  memoryClipboard = data;

  try {
    await navigator.clipboard.writeText(serializeClipboard(data));
  } catch {
    // fallback to memory only
  }
}

export async function cutElements(
  elements: readonly DrawElement[],
  files: BinaryFiles,
): Promise<void> {
  await copyElements(elements, files);
}

export async function pasteElements(
  offset: { x: number; y: number } = { x: 10, y: 10 },
): Promise<ClipboardData | null> {
  let source: ClipboardData | null = null;

  try {
    const text = await navigator.clipboard.readText();
    source = deserializeClipboard(text);
  } catch {
    // system clipboard not available
  }

  if (!source) {
    source = memoryClipboard;
  }

  if (!source) return null;

  const duplicated = source.elements.map((el) =>
    duplicateElement(el, offset.x, offset.y),
  );

  return {
    elements: duplicated,
    files: { ...source.files },
  };
}

export function hasClipboardData(): boolean {
  return memoryClipboard !== null;
}
