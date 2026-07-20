import { BrowserWindow, dialog } from 'electron'
import { writeFile } from 'fs/promises'
import { asBlob } from 'html-docx-js-typescript'
import { buildExportFullHTML } from '../shared/export-html'
import type { PdfExportSettings } from '../shared/pdf-export'
import {
  DEFAULT_PDF_EXPORT_SETTINGS,
  pdfPageDimensionsPx,
  resolvePdfMargins,
} from '../shared/pdf-export'

export type ExportFormat = 'pdf' | 'html' | 'word' | 'image'

export interface ExportOptions {
  format: ExportFormat
  html: string
  title: string
  css?: string
  pdfSettings?: PdfExportSettings
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

async function createOffscreenWindow(
  html: string,
  width = 800,
  height = 600,
): Promise<BrowserWindow> {
  const win = new BrowserWindow({
    width,
    height,
    show: false,
    webPreferences: {
      offscreen: true,
      sandbox: true,
    },
  })

  const loadPromise = new Promise<void>((resolve) => {
    win.webContents.once('did-finish-load', () => resolve())
  })

  win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)

  await loadPromise
  await new Promise((r) => setTimeout(r, 500))

  return win
}

export async function exportToPDF(
  parentWindow: BrowserWindow,
  options: ExportOptions,
): Promise<string | null> {
  const { canceled, filePath } = await dialog.showSaveDialog(parentWindow, {
    defaultPath: `${options.title || 'untitled'}.pdf`,
    filters: [{ name: 'PDF', extensions: ['pdf'] }],
  })
  if (canceled || !filePath) return null

  const pdfSettings = options.pdfSettings ?? DEFAULT_PDF_EXPORT_SETTINGS
  const fullHTML = buildExportFullHTML(
    options.html,
    options.title,
    options.css,
    pdfSettings,
  )
  const { pageWidth, pageHeight } = pdfPageDimensionsPx(pdfSettings)
  const win = await createOffscreenWindow(fullHTML, pageWidth, pageHeight)
  const margin = resolvePdfMargins(pdfSettings)

  try {
    const pdfBuffer = await win.webContents.printToPDF({
      printBackground: true,
      landscape: pdfSettings.orientation === 'landscape',
      pageSize: pdfSettings.paperSize,
      scale: 1,
      margins: {
        marginType: 'custom',
        top: margin.top,
        bottom: margin.bottom,
        left: margin.left,
        right: margin.right,
      },
    })
    await writeFile(filePath, pdfBuffer)
    return filePath
  } finally {
    win.destroy()
  }
}

export async function exportToHTML(
  parentWindow: BrowserWindow,
  options: ExportOptions,
): Promise<string | null> {
  const { canceled, filePath } = await dialog.showSaveDialog(parentWindow, {
    defaultPath: `${options.title || 'untitled'}.html`,
    filters: [{ name: 'HTML', extensions: ['html', 'htm'] }],
  })
  if (canceled || !filePath) return null

  const fullHTML = buildExportFullHTML(options.html, options.title, options.css)
  await writeFile(filePath, fullHTML, 'utf-8')
  return filePath
}

function buildWordHTML(html: string, title: string): string {
  const s = {
    body: 'font-family: Calibri, "PingFang SC", "Microsoft YaHei", sans-serif; color: #1d1d1f; line-height: 1.7; font-size: 11pt;',
    content: 'max-width: 100%; padding: 0;',
    h1: 'font-size: 22pt; font-weight: bold; margin: 18pt 0 6pt; line-height: 1.2;',
    h2: 'font-size: 16pt; font-weight: bold; margin: 14pt 0 6pt; line-height: 1.3;',
    h3: 'font-size: 13pt; font-weight: bold; margin: 12pt 0 6pt; line-height: 1.4;',
    p: 'margin: 3pt 0; line-height: 1.7;',
    blockquote: 'border-left: 3pt solid #007aff; padding-left: 12pt; margin: 9pt 0; color: #494949;',
    code: 'background-color: #f5f5f5; padding: 1pt 4pt; border-radius: 3pt; font-family: Consolas, "Courier New", monospace; font-size: 9.5pt; color: #f56c6c;',
    pre: 'background-color: #f0f0f0; color: #1d1d1f; padding: 12pt; margin: 9pt 0; font-family: Consolas, "Courier New", monospace; font-size: 9.5pt; white-space: pre-wrap; word-wrap: break-word;',
    preCode: 'background-color: transparent; padding: 0; color: inherit; font-size: 9.5pt;',
    a: 'color: #007aff; text-decoration: underline;',
    hr: 'border: none; border-top: 1pt solid #dddddd; margin: 18pt 0;',
    table: 'border-collapse: collapse; width: 100%; margin: 9pt 0; font-size: 10pt;',
    th: 'border: 1pt solid #cccccc; padding: 6pt 9pt; text-align: left; background-color: #f5f5f5; font-weight: bold;',
    td: 'border: 1pt solid #cccccc; padding: 6pt 9pt; text-align: left;',
    img: 'max-width: 100%; height: auto;',
    ul: 'padding-left: 18pt; margin: 3pt 0;',
    ol: 'padding-left: 18pt; margin: 3pt 0;',
    li: 'margin: 1pt 0;',
  }

  let out = html

  const inlineTag = (tag: string, style: string) => {
    out = out.replace(new RegExp(`<${tag}(\\s|>)`, 'gi'), (match, after) => {
      if (after === '>') return `<${tag} style="${style}">`
      return `<${tag} style="${style}"${after}`
    })
  }

  const inlineTagExact = (tag: string, style: string) => {
    out = out.replace(new RegExp(`<${tag}>`, 'gi'), `<${tag} style="${style}">`)
  }

  inlineTag('h1', s.h1)
  inlineTag('h2', s.h2)
  inlineTag('h3', s.h3)
  inlineTag('p', s.p)
  inlineTag('blockquote', s.blockquote)
  inlineTag('a', s.a)
  inlineTag('img', s.img)
  inlineTag('table', s.table)
  inlineTag('th', s.th)
  inlineTag('td', s.td)
  inlineTag('ul', s.ul)
  inlineTag('ol', s.ol)
  inlineTag('li', s.li)
  inlineTagExact('hr', s.hr)

  out = out.replace(/<pre([^>]*)>\s*<code([^>]*)>/gi, `<pre$1 style="${s.pre}"><code$2 style="${s.preCode}">`)
  out = out.replace(/<pre>/gi, `<pre style="${s.pre}">`)

  out = out.replace(/<code(?!\s+style)([^>]*)>/gi, `<code style="${s.code}"$1>`)

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>${escapeHtml(title)}</title>
</head>
<body style="${s.body}">
<div style="${s.content}">
${out}
</div>
</body>
</html>`
}

export async function exportToWord(
  parentWindow: BrowserWindow,
  options: ExportOptions,
): Promise<string | null> {
  const { canceled, filePath } = await dialog.showSaveDialog(parentWindow, {
    defaultPath: `${options.title || 'untitled'}.docx`,
    filters: [{ name: 'Word Document', extensions: ['docx'] }],
  })
  if (canceled || !filePath) return null

  const wordHTML = buildWordHTML(options.html, options.title)
  const result = await asBlob(wordHTML)

  let buffer: Buffer
  if (Buffer.isBuffer(result)) {
    buffer = result
  } else if (result instanceof Blob) {
    buffer = Buffer.from(await result.arrayBuffer())
  } else if (result instanceof ArrayBuffer) {
    buffer = Buffer.from(result)
  } else {
    buffer = Buffer.from(result as any)
  }

  await writeFile(filePath, buffer)
  return filePath
}

export async function exportToImage(
  parentWindow: BrowserWindow,
  options: ExportOptions,
): Promise<string | null> {
  const { canceled, filePath } = await dialog.showSaveDialog(parentWindow, {
    defaultPath: `${options.title || 'untitled'}.png`,
    filters: [{ name: 'PNG Image', extensions: ['png'] }],
  })
  if (canceled || !filePath) return null

  const fullHTML = buildExportFullHTML(options.html, options.title, options.css)
  const win = await createOffscreenWindow(fullHTML)

  try {
    const contentHeight = await win.webContents.executeJavaScript(
      'document.documentElement.scrollHeight',
    )
    win.setSize(800, Math.min(contentHeight + 40, 16384))

    await new Promise((r) => setTimeout(r, 300))

    const image = await win.webContents.capturePage()
    await writeFile(filePath, image.toPNG())
    return filePath
  } finally {
    win.destroy()
  }
}

export async function runExport(
  parentWindow: BrowserWindow,
  options: ExportOptions,
): Promise<string | null> {
  switch (options.format) {
    case 'pdf':
      return exportToPDF(parentWindow, options)
    case 'html':
      return exportToHTML(parentWindow, options)
    case 'word':
      return exportToWord(parentWindow, options)
    case 'image':
      return exportToImage(parentWindow, options)
    default:
      throw new Error(`Unknown export format: ${options.format}`)
  }
}
