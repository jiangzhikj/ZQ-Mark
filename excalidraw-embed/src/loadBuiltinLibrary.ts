import { loadLibraryFromBlob, mergeLibraryItems } from '@excalidraw/excalidraw';
import type { LibraryItem } from '@excalidraw/excalidraw/types';
import { BUILTIN_LIBRARY_FILES } from './builtin-library-files';

const base = import.meta.env.BASE_URL; // Vite: './'

export async function loadMergedBuiltinLibraryItems(): Promise<LibraryItem[]> {
  const names = [...BUILTIN_LIBRARY_FILES].sort();
  const blobs = await Promise.all(
    names.map(async (name) => {
      const res = await fetch(`${base}builtin-libraries/${encodeURIComponent(name)}`);
      if (!res.ok) {
        throw new Error(`builtin-libraries/${name}: ${res.status}`);
      }
      return res.blob();
    }),
  );

  let acc: LibraryItem[] = [];
  for (const blob of blobs) {
    const items = await loadLibraryFromBlob(blob, 'published');
    acc = mergeLibraryItems(acc, items);
  }
  return acc;
}
