import type { PdfExportSettings } from './pdf-export'
import { pdfPageDimensionsPx } from './pdf-export'

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function getExportStyles(): string {
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
p { margin: 0.25rem 0; line-height: 1.7; min-height: 1em; }

ul { list-style: disc; padding-left: 1.5rem; margin: 0.25rem 0; }
ol { list-style: decimal; padding-left: 1.5rem; margin: 0.25rem 0; }
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

.columns-block {
  display: grid;
  gap: 12px;
  margin: 0.75rem 0;
}
.columns-block[data-columns='2'] {
  grid-template-columns: repeat(2, 1fr);
}
.columns-block[data-columns='3'] {
  grid-template-columns: repeat(3, 1fr);
}
.columns-block[data-columns='4'] {
  grid-template-columns: repeat(4, 1fr);
}
.column-block {
  min-width: 0;
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

/** 实际 PDF 打印：页边距/纸张由 printToPDF 控制，此处只处理内容区排版 */
function buildPdfPrintContentStyles(): string {
  return `
body {
  background: #ffffff;
}

.export-content {
  max-width: 100%;
  width: auto;
  margin-left: auto;
  margin-right: auto;
  padding: 0;
}
`
}

/** 预览：用 body padding 模拟页边距，与 printToPDF 边距视觉一致 */
function buildPdfPreviewStyles(settings: PdfExportSettings): string {
  const dims = pdfPageDimensionsPx(settings)

  return `
body {
  background: #ffffff;
  width: ${dims.pageWidth}px;
  padding: ${dims.marginTop}px ${dims.marginRight}px ${dims.marginBottom}px ${dims.marginLeft}px;
}

.export-content {
  max-width: 100%;
  width: auto;
  margin-left: auto;
  margin-right: auto;
  padding: 0;
}
`
}

export function buildExportFullHTML(
  html: string,
  title: string,
  css?: string,
  pdfSettings?: PdfExportSettings,
  options?: { preview?: boolean },
): string {
  let pdfCss = ''
  if (pdfSettings) {
    pdfCss = options?.preview
      ? buildPdfPreviewStyles(pdfSettings)
      : buildPdfPrintContentStyles()
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(title)}</title>
<style>
${getExportStyles()}
${pdfCss}
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
