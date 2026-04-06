import { BrowserWindow, dialog } from 'electron'
import { writeFile } from 'fs/promises'
import { asBlob } from 'html-docx-js-typescript'

export type ExportFormat = 'pdf' | 'html' | 'word' | 'image'

export interface ExportOptions {
  format: ExportFormat
  html: string
  title: string
  css?: string
}

function buildFullHTML(html: string, title: string, css?: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(title)}</title>
<style>
${getExportStyles()}
${css || ''}
</style>
</head>
<body>
<article class="export-content">
${html}
</article>
</body>
</html>`
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function getExportStyles(): string {
  return `
* { margin: 0; padding: 0; box-sizing: border-box; }

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC',
    'Hiragino Sans GB', 'Microsoft YaHei', 'Helvetica Neue', Helvetica, Arial, sans-serif;
  color: #1d1d1f;
  background: #ffffff;
  line-height: 1.7;
  -webkit-font-smoothing: antialiased;
}

.export-content {
  max-width: 800px;
  margin: 0 auto;
  padding: 2rem 3rem;
}

h1 { font-size: 2rem; font-weight: 700; margin: 1.5rem 0 0.5rem; line-height: 1.2; }
h2 { font-size: 1.5rem; font-weight: 600; margin: 1.25rem 0 0.5rem; line-height: 1.3; }
h3 { font-size: 1.25rem; font-weight: 600; margin: 1rem 0 0.5rem; line-height: 1.4; }
p { margin: 0.25rem 0; line-height: 1.7; }

ul, ol { padding-left: 1.5rem; margin: 0.25rem 0; }
li { margin: 0.125rem 0; }
li p { margin: 0; }

ul[data-type='taskList'] {
  list-style: none;
  padding-left: 0;
}
ul[data-type='taskList'] li {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
}
ul[data-type='taskList'] li > label {
  flex-shrink: 0;
  margin-top: 0.25rem;
}
ul[data-type='taskList'] li > label input[type='checkbox'] {
  width: 1rem;
  height: 1rem;
  accent-color: #007aff;
}
ul[data-type='taskList'] li > div { flex: 1; min-width: 0; }
ul[data-type='taskList'] li[data-checked='true'] > div {
  text-decoration: line-through;
  color: #86868b;
}

blockquote {
  border-left: 3px solid #007aff;
  padding-left: 1rem;
  margin: 0.75rem 0;
  color: #494949;
}

code {
  background-color: rgba(0,0,0,0.03);
  padding: 0.125rem 0.375rem;
  border-radius: 4px;
  font-family: ui-monospace, 'SFMono-Regular', Menlo, Monaco, Consolas, monospace;
  font-size: 0.875em;
  color: #f56c6c;
}

pre {
  background-color: #f0f0f0;
  color: #1d1d1f;
  padding: 1rem;
  border-radius: 8px;
  overflow-x: auto;
  margin: 0.75rem 0;
}
pre code {
  background-color: transparent;
  padding: 0;
  color: inherit;
  font-size: 0.875rem;
}

a { color: #007aff; text-decoration: underline; }

hr {
  border: none;
  border-top: 1px solid rgba(0,0,0,0.09);
  margin: 1.5rem 0;
}

table {
  border-collapse: collapse;
  width: 100%;
  margin: 0.75rem 0;
  font-size: 0.9375rem;
}
th, td {
  border: 1px solid rgba(0,0,0,0.12);
  padding: 0.5rem 0.75rem;
  text-align: left;
}
th {
  background-color: rgba(0,0,0,0.03);
  font-weight: 600;
}

img {
  max-width: 100%;
  height: auto;
  border-radius: 4px;
  margin: 0.5rem 0;
}

.callout {
  padding: 1rem;
  border-radius: 8px;
  margin: 0.75rem 0;
  background-color: rgba(0,122,255,0.06);
  border-left: 4px solid #007aff;
}

.katex-display { margin: 1rem 0; overflow-x: auto; }

@media print {
  body { background: white; }
  .export-content { max-width: none; padding: 0; }
  pre { white-space: pre-wrap; word-wrap: break-word; }
}
`
}

async function createOffscreenWindow(html: string): Promise<BrowserWindow> {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
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

  const fullHTML = buildFullHTML(options.html, options.title, options.css)
  const win = await createOffscreenWindow(fullHTML)

  try {
    const pdfBuffer = await win.webContents.printToPDF({
      printBackground: true,
      margins: { top: 0.5, bottom: 0.5, left: 0.5, right: 0.5 },
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

  const fullHTML = buildFullHTML(options.html, options.title, options.css)
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

  const fullHTML = buildFullHTML(options.html, options.title, options.css)
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
