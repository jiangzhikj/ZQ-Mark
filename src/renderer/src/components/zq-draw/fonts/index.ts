import VirgilUrl from '@/assets/fonts/Virgil-Regular.woff2?url';
import NunitoUrl from '@/assets/fonts/Nunito.woff2?url';

import Excalifont0 from '@/assets/fonts/Excalifont-Regular-a88b72a24fb54c9f94e3b5fdaa7481c9.woff2?url';
import Excalifont1 from '@/assets/fonts/Excalifont-Regular-be310b9bcd4f1a43f571c46df7809174.woff2?url';
import Excalifont2 from '@/assets/fonts/Excalifont-Regular-b9dcf9d2e50a1eaf42fc664b50a3fd0d.woff2?url';
import Excalifont3 from '@/assets/fonts/Excalifont-Regular-41b173a47b57366892116a575a43e2b6.woff2?url';
import Excalifont4 from '@/assets/fonts/Excalifont-Regular-3f2c5db56cc93c5a6873b1361d730c16.woff2?url';
import Excalifont5 from '@/assets/fonts/Excalifont-Regular-349fac6ca4700ffec595a7150a0d1e1d.woff2?url';
import Excalifont6 from '@/assets/fonts/Excalifont-Regular-623ccf21b21ef6b3a0d87738f77eb071.woff2?url';

interface FontDef {
  family: string;
  url: string;
  descriptors?: FontFaceDescriptors;
}

const LOCAL_FONTS: FontDef[] = [
  { family: 'Virgil', url: VirgilUrl },
  { family: 'Nunito', url: NunitoUrl, descriptors: { weight: '500' } },
];

const EXCALIFONT_SUBSETS: Array<{ url: string; unicodeRange: string }> = [
  {
    url: Excalifont0,
    unicodeRange:
      'U+20-7e,U+a0-a3,U+a5-a6,U+a8-ab,U+ad-b1,U+b4,U+b6-b8,U+ba-ff,U+131,U+152-153,U+2bc,U+2c6,U+2da,U+2dc,U+304,U+308,U+2013-2014,U+2018-201a,U+201c-201e,U+2020,U+2022,U+2024-2026,U+2030,U+2039-203a,U+20ac,U+2122,U+2212',
  },
  {
    url: Excalifont1,
    unicodeRange:
      'U+100-130,U+132-137,U+139-149,U+14c-151,U+154-17e,U+192,U+1fc-1ff,U+218-21b,U+237,U+1e80-1e85,U+1ef2-1ef3,U+2113',
  },
  { url: Excalifont2, unicodeRange: 'U+400-45f,U+490-491,U+2116' },
  {
    url: Excalifont3,
    unicodeRange: 'U+37e,U+384-38a,U+38c,U+38e-393,U+395-3a1,U+3a3-3a8,U+3aa-3cf,U+3d7',
  },
  {
    url: Excalifont4,
    unicodeRange:
      'U+2c7,U+2d8-2d9,U+2db,U+2dd,U+302,U+306-307,U+30a-30c,U+326-328,U+212e,U+2211,U+fb01-fb02',
  },
  {
    url: Excalifont5,
    unicodeRange: 'U+462-463,U+472-475,U+4d8-4d9,U+4e2-4e3,U+4e6-4e9,U+4ee-4ef',
  },
  { url: Excalifont6, unicodeRange: 'U+300-301,U+303' },
];

import { XIAOLAI_SUBSETS } from './xiaolai';

let _loaded = false;

function registerSubsetFont(
  family: string,
  subsets: Array<{ url: string; unicodeRange: string }>,
): Promise<FontFace>[] {
  const promises: Promise<FontFace>[] = [];
  for (const subset of subsets) {
    try {
      const face = new FontFace(
        family,
        `url(${subset.url}) format('woff2')`,
        { display: 'swap', style: 'normal', weight: '400', unicodeRange: subset.unicodeRange },
      );
      document.fonts.add(face);
      promises.push(face.load());
    } catch { /* skip */ }
  }
  return promises;
}

export async function loadDrawFonts(): Promise<void> {
  if (_loaded) return;
  _loaded = true;

  const promises: Promise<FontFace>[] = [];

  for (const def of LOCAL_FONTS) {
    try {
      const face = new FontFace(
        def.family,
        `url(${def.url}) format('woff2')`,
        { display: 'swap', style: 'normal', weight: '400', ...def.descriptors },
      );
      document.fonts.add(face);
      promises.push(face.load());
    } catch { /* skip */ }
  }

  promises.push(...registerSubsetFont('Excalifont', EXCALIFONT_SUBSETS));
  promises.push(...registerSubsetFont('Xiaolai', XIAOLAI_SUBSETS));

  await Promise.allSettled(promises);
}
