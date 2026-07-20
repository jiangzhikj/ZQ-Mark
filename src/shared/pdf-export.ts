export type PdfPaperSize = 'A4' | 'A3' | 'A5' | 'Letter' | 'Legal'
export type PdfMarginPreset = 'normal' | 'narrow' | 'wide' | 'minimal' | 'custom'
export type PdfOrientation = 'portrait' | 'landscape'

export interface PdfMarginsInches {
  top: number
  bottom: number
  left: number
  right: number
}

export interface PdfExportSettings {
  paperSize: PdfPaperSize
  margins: PdfMarginPreset
  marginTop: number
  marginBottom: number
  marginLeft: number
  marginRight: number
  orientation: PdfOrientation
}

const PAPER_INCHES: Record<PdfPaperSize, { width: number; height: number }> = {
  A3: { width: 11.69, height: 16.54 },
  A4: { width: 8.27, height: 11.69 },
  A5: { width: 5.83, height: 8.27 },
  Letter: { width: 8.5, height: 11 },
  Legal: { width: 8.5, height: 14 },
}

const MARGIN_MIN_INCHES = 0
const MARGIN_MAX_INCHES = 2

export function pdfMarginInches(preset: Exclude<PdfMarginPreset, 'custom'>): PdfMarginsInches {
  switch (preset) {
    case 'minimal':
      return { top: 0.25, bottom: 0.25, left: 0.25, right: 0.25 }
    case 'narrow':
      return { top: 0.5, bottom: 0.5, left: 0.5, right: 0.5 }
    case 'normal':
      return { top: 0.75, bottom: 0.75, left: 0.75, right: 0.75 }
    case 'wide':
      return { top: 1, bottom: 1, left: 1, right: 1 }
  }
}

const NORMAL_MARGINS = pdfMarginInches('normal')

export const DEFAULT_PDF_EXPORT_SETTINGS: PdfExportSettings = {
  paperSize: 'A4',
  margins: 'normal',
  marginTop: NORMAL_MARGINS.top,
  marginBottom: NORMAL_MARGINS.bottom,
  marginLeft: NORMAL_MARGINS.left,
  marginRight: NORMAL_MARGINS.right,
  orientation: 'portrait',
}

export function clampMarginInches(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.min(MARGIN_MAX_INCHES, Math.max(MARGIN_MIN_INCHES, value))
}

export function resolvePdfMargins(settings: PdfExportSettings): PdfMarginsInches {
  return {
    top: clampMarginInches(settings.marginTop),
    bottom: clampMarginInches(settings.marginBottom),
    left: clampMarginInches(settings.marginLeft),
    right: clampMarginInches(settings.marginRight),
  }
}

export function pdfPageDimensionsInches(settings: PdfExportSettings): {
  width: number
  height: number
} {
  const base = PAPER_INCHES[settings.paperSize]
  if (settings.orientation === 'landscape') {
    return { width: base.height, height: base.width }
  }
  return base
}

export function pdfPageDimensionsPx(
  settings: PdfExportSettings,
  dpi = 96,
): {
  pageWidth: number
  pageHeight: number
  contentWidth: number
  contentHeight: number
  marginTop: number
  marginBottom: number
  marginLeft: number
  marginRight: number
} {
  const page = pdfPageDimensionsInches(settings)
  const margin = resolvePdfMargins(settings)
  const pageWidth = Math.round(page.width * dpi)
  const pageHeight = Math.round(page.height * dpi)
  const marginTop = Math.round(margin.top * dpi)
  const marginBottom = Math.round(margin.bottom * dpi)
  const marginLeft = Math.round(margin.left * dpi)
  const marginRight = Math.round(margin.right * dpi)
  return {
    pageWidth,
    pageHeight,
    contentWidth: pageWidth - marginLeft - marginRight,
    contentHeight: pageHeight - marginTop - marginBottom,
    marginTop,
    marginBottom,
    marginLeft,
    marginRight,
  }
}
