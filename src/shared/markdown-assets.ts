/** Markdown 模式下本地资源（图片/视频/音频/附件）的保存策略 */

export type MdAssetMode = 'relative' | 'absolute'
export type MdAssetFolder = 'assets' | 'docNamed' | 'same' | 'custom'
export type MdAssetFileName = 'original' | 'uuid'

export interface MdAssetSettings {
  mdAssetMode: MdAssetMode
  mdAssetFolder: MdAssetFolder
  /** 自定义资源目录：设置中保存的绝对路径；写入 .md 时转为相对路径 */
  mdAssetCustomFolder: string
  mdAssetFileName: MdAssetFileName
}

export const DEFAULT_MD_ASSET_SETTINGS: MdAssetSettings = {
  mdAssetMode: 'relative',
  mdAssetFolder: 'assets',
  mdAssetCustomFolder: '',
  mdAssetFileName: 'original',
}

/** TipTap 节点类型 → 需要处理的 attrs 字段（与 zq-file ASSET_ATTRS 对齐，不含 diagram 块） */
export const MD_EMBEDDABLE_ASSET_ATTRS: Record<string, string | string[]> = {
  imageBlock: 'src',
  image: 'src',
  videoBlock: 'src',
  video: 'src',
  audioBlock: 'src',
  audio: 'src',
  attachmentBlock: 'url',
  attachment: 'url',
}

export function mdAssetAttrKeysForType(nodeType: string): string[] {
  const v = MD_EMBEDDABLE_ASSET_ATTRS[nodeType]
  if (!v) return []
  return Array.isArray(v) ? v : [v]
}

function pathSep(p: string): string {
  return p.includes('\\') ? '\\' : '/'
}

export function mdPathDirname(filePath: string): string {
  const normalized = filePath.replace(/^web:/, '')
  const sep = pathSep(normalized)
  const idx = normalized.lastIndexOf(sep)
  if (idx <= 0) return sep === '\\' ? normalized.slice(0, 3) : ''
  return normalized.slice(0, idx)
}

export function mdPathBasename(filePath: string, stripExt = false): string {
  const normalized = filePath.replace(/^web:/, '')
  const sep = pathSep(normalized)
  const name = normalized.split(/[/\\]/).pop() || normalized
  if (!stripExt) return name
  const dot = name.lastIndexOf('.')
  return dot > 0 ? name.slice(0, dot) : name
}

export function mdPathExtname(filePath: string): string {
  const name = mdPathBasename(filePath)
  const dot = name.lastIndexOf('.')
  return dot >= 0 ? name.slice(dot) : ''
}

export function mdPathJoin(dir: string, ...parts: string[]): string {
  const sep = pathSep(dir || parts[0] || '/')
  let result = dir.replace(/[/\\]+$/, '')
  for (const part of parts) {
    const p = part.replace(/^[/\\]+/, '').replace(/[/\\]+$/, '')
    if (p) result = result ? `${result}${sep}${p}` : p
  }
  return result
}

export function isAbsolutePath(p: string): boolean {
  const t = p.trim()
  if (!t) return false
  if (t.startsWith('/') && !t.startsWith('//')) return true
  return /^[A-Za-z]:[\\/]/.test(t)
}

/** 设置里保存的自定义目录：绝对路径原样保留 */
export function normalizeMdAssetCustomFolder(value?: string): string {
  return (value ?? '').trim().replace(/[/\\]+$/, '')
}

export function normalizeMdAssetSettings(partial?: Partial<MdAssetSettings>): MdAssetSettings {
  const folder = partial?.mdAssetFolder
  let mdAssetFolder: MdAssetFolder = 'assets'
  if (folder === 'docNamed' || folder === 'same' || folder === 'custom') {
    mdAssetFolder = folder
  }
  return {
    mdAssetMode: partial?.mdAssetMode === 'absolute' ? 'absolute' : 'relative',
    mdAssetFolder,
    mdAssetCustomFolder: normalizeMdAssetCustomFolder(partial?.mdAssetCustomFolder),
    mdAssetFileName: partial?.mdAssetFileName === 'uuid' ? 'uuid' : 'original',
  }
}

/** 根据文档路径与设置计算资源目标目录（绝对路径） */
export function resolveMdAssetDir(docPath: string, settings: MdAssetSettings): string {
  const docDir = mdPathDirname(docPath)
  switch (settings.mdAssetFolder) {
    case 'docNamed': {
      const base = mdPathBasename(docPath, true) || 'untitled'
      return mdPathJoin(docDir, `${base}.assets`)
    }
    case 'same':
      return docDir
    case 'custom': {
      const custom = settings.mdAssetCustomFolder.trim()
      if (!custom) return mdPathJoin(docDir, 'assets')
      if (isAbsolutePath(custom)) return custom.replace(/[/\\]+$/, '')
      // 兼容旧版：设置里存过相对路径时仍按文档目录解析
      return mdPathJoin(docDir, custom)
    }
    case 'assets':
    default:
      return mdPathJoin(docDir, 'assets')
  }
}

/** 计算 fromDir → toPath 的相对路径（统一 `/`，供 Markdown 引用） */
export function mdPathRelative(fromDir: string, toPath: string): string {
  const normalize = (p: string) => p.replace(/\\/g, '/').replace(/\/+$/, '') || ''
  const from = normalize(fromDir)
  const to = normalize(toPath)

  const driveFrom = /^([A-Za-z]:)/i.exec(from)?.[1]
  const driveTo = /^([A-Za-z]:)/i.exec(to)?.[1]
  if (driveFrom && driveTo && driveFrom.toLowerCase() !== driveTo.toLowerCase()) {
    return mdPathBasename(toPath)
  }

  const stripDrive = (p: string) => p.replace(/^[A-Za-z]:/i, '')
  const fromParts = stripDrive(from).split('/').filter(Boolean)
  const toParts = stripDrive(to).split('/').filter(Boolean)

  let i = 0
  while (i < fromParts.length && i < toParts.length && fromParts[i] === toParts[i]) {
    i++
  }

  const up = fromParts.length - i
  const down = toParts.slice(i)
  const result = [...Array(up).fill('..'), ...down].join('/')
  return result || mdPathBasename(toPath)
}

/** 计算相对路径（统一用 `/`，Markdown 惯例） */
export function toMdRelativePath(docPath: string, absolutePath: string): string {
  const docDir = mdPathDirname(docPath)
  return mdPathRelative(docDir, absolutePath)
}

export function makeUniqueFileName(name: string, usedNames: Set<string>): string {
  if (!usedNames.has(name)) {
    usedNames.add(name)
    return name
  }
  const ext = mdPathExtname(name)
  const base = ext ? name.slice(0, -ext.length) : name
  let counter = 1
  let candidate = `${base}_${counter}${ext}`
  while (usedNames.has(candidate)) {
    counter++
    candidate = `${base}_${counter}${ext}`
  }
  usedNames.add(candidate)
  return candidate
}

export function isRemoteAssetUrl(url: string): boolean {
  const t = url.trim()
  return (
    t.startsWith('http://') ||
    t.startsWith('https://') ||
    t.startsWith('data:') ||
    t.startsWith('blob:')
  )
}

export function isRelativeAssetPath(url: string): boolean {
  const t = url.trim()
  if (!t || isRemoteAssetUrl(t)) return false
  if (t.startsWith('local-asset:') || t.startsWith('file://')) return false
  if (t.startsWith('/') && !t.startsWith('//')) return false
  if (/^[A-Za-z]:[\\/]/.test(t)) return false
  return true
}

/** 插入编辑器节点时写入的 URL：相对路径模式用 relativePath，否则 local-asset 等 */
export function mdAssetStoredSrc(result: { url: string; relativePath?: string }): string {
  const rel = result.relativePath?.trim()
  if (rel) return rel.replace(/\\/g, '/')
  return result.url
}

/** 是否为可嵌入、需本地化的资源 URL（local-asset / file / 绝对路径 / 相对路径） */
export function isEmbeddableAssetUrl(url: string): boolean {
  const t = url.trim()
  if (!t || isRemoteAssetUrl(t)) return false
  if (t.startsWith('local-asset:')) return true
  if (t.startsWith('file://')) return true
  if (t.startsWith('/') && !t.startsWith('//')) return true
  if (/^[A-Za-z]:[\\/]/.test(t)) return true
  return isRelativeAssetPath(t)
}

/** 将相对路径解析为绝对路径（不含 local-asset 转换） */
export function resolveRelativeAssetPath(docPath: string, relPath: string): string {
  const trimmed = relPath.trim().replace(/^\.\//, '')
  const docDir = mdPathDirname(docPath)
  const joined = mdPathJoin(docDir, trimmed).replace(/\\/g, '/')
  const driveMatch = /^([A-Za-z]:)/.exec(joined)
  const drive = driveMatch?.[1] ?? ''
  const rest = drive ? joined.slice(drive.length) : joined
  const parts = rest.split('/').filter(Boolean)
  const stack: string[] = []
  for (const part of parts) {
    if (part === '.') continue
    if (part === '..') {
      if (stack.length) stack.pop()
      continue
    }
    stack.push(part)
  }
  const normalized = stack.join('/')
  if (drive) return `${drive}/${normalized}`.replace(/\//g, pathSep(drive))
  if (joined.startsWith('/')) return `/${normalized}`
  return normalized
}

/** 将可嵌入 URL 解析为本地绝对路径；fileUrlToPath 由主进程传入以正确解析 file:// */
export function resolveEmbeddableUrlToAbsPath(
  url: string,
  docPath: string,
  fileUrlToPath?: (fileUrl: string) => string | null,
): string | null {
  const trimmed = url.trim()
  if (!trimmed || isRemoteAssetUrl(trimmed) || trimmed.startsWith('local-asset:')) {
    return null
  }

  if (trimmed.startsWith('file://')) {
    if (fileUrlToPath) {
      try {
        return fileUrlToPath(trimmed)
      } catch {
        return null
      }
    }
    try {
      return decodeURIComponent(trimmed.replace(/^file:\/\//, ''))
    } catch {
      return trimmed.replace(/^file:\/\//, '')
    }
  }

  if (isRelativeAssetPath(trimmed)) {
    return resolveRelativeAssetPath(docPath, trimmed)
  }

  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) {
    return trimmed
  }

  if (/^[A-Za-z]:[\\/]/.test(trimmed)) {
    return trimmed
  }

  return null
}

const MD_HTML_ASSET_ATTRS = ['src', 'href', 'data-url', 'poster'] as const

function resolveUrlInMarkdown(
  url: string,
  docPath: string,
  toLocalAsset: (absPath: string) => string,
  fileUrlToPath?: (fileUrl: string) => string | null,
): string | null {
  const abs = resolveEmbeddableUrlToAbsPath(url, docPath, fileUrlToPath)
  if (!abs) return null
  return toLocalAsset(abs)
}

/** 将 Markdown / HTML 内本地资源 URL 转为 local-asset，供打开 .md 时渲染 */
export function resolveMdContentAssetUrls(
  md: string,
  docPath: string,
  toLocalAsset: (absPath: string) => string,
  fileUrlToPath?: (fileUrl: string) => string | null,
): string {
  let result = md.replace(
    /(!?\[[^\]]*\]\()([^)]*)(\))/g,
    (_match, prefix: string, url: string, suffix: string) => {
      const resolved = resolveUrlInMarkdown(url, docPath, toLocalAsset, fileUrlToPath)
      if (resolved) return `${prefix}${resolved}${suffix}`
      return `${prefix}${url}${suffix}`
    },
  )

  const attrGroup = MD_HTML_ASSET_ATTRS.join('|')
  const htmlAttrRe = new RegExp(`\\b(${attrGroup})=(["'])([^"']*)\\2`, 'gi')
  result = result.replace(htmlAttrRe, (match, attr: string, quote: string, url: string) => {
    const resolved = resolveUrlInMarkdown(url, docPath, toLocalAsset, fileUrlToPath)
    if (resolved) return `${attr}=${quote}${resolved}${quote}`
    return match
  })

  return result
}

/** 收集 materialize 前后 JSON 中变化的资源 URL 对 */
export function buildAssetUrlReplacements(
  originalJson: any,
  materializedJson: any,
): Array<{ from: string; to: string }> {
  const pairs: Array<{ from: string; to: string }> = []

  function walk(origNode: any, matNode: any): void {
    if (!origNode || !matNode) return
    for (const attrKey of mdAssetAttrKeysForType(origNode.type)) {
      const from = origNode.attrs?.[attrKey]
      const to = matNode.attrs?.[attrKey]
      if (
        typeof from === 'string' &&
        typeof to === 'string' &&
        from !== to &&
        isEmbeddableAssetUrl(from)
      ) {
        pairs.push({ from, to })
      }
    }
    const oc = origNode.content
    const mc = matNode.content
    if (Array.isArray(oc) && Array.isArray(mc)) {
      const len = Math.min(oc.length, mc.length)
      for (let i = 0; i < len; i++) walk(oc[i], mc[i])
    }
  }

  walk(originalJson, materializedJson)
  return pairs
}

/** 将 Markdown / HTML 中的资源 URL 批量替换（如 local-asset → 相对路径） */
export function applyAssetUrlReplacementsInMarkdown(
  md: string,
  replacements: Array<{ from: string; to: string }>,
): string {
  if (!replacements.length) return md
  let result = md
  const seen = new Set<string>()
  const sorted = [...replacements].sort((a, b) => b.from.length - a.from.length)
  for (const { from, to } of sorted) {
    if (!from || from === to || seen.has(from)) continue
    seen.add(from)
    result = result.split(from).join(to)
    if (from.startsWith('local-asset:')) {
      const asFile = from.replace(/^local-asset:/, 'file:')
      result = result.split(asFile).join(to)
    }
  }
  return result
}

const MD_URL_IN_MARKDOWN = /(!?\[[^\]]*\]\()([^)]*)(\))/g
const MD_HTML_ASSET_ATTR_RE = new RegExp(
  `\\b(${MD_HTML_ASSET_ATTRS.join('|')})=(["'])([^"']*)\\2`,
  'gi',
)

/** 遍历 Markdown / HTML 内可嵌入 URL 并替换 */
export function replaceEmbeddableUrlsInMarkdown(
  md: string,
  replaceUrl: (url: string) => string | null | undefined,
): string {
  let result = md.replace(
    MD_URL_IN_MARKDOWN,
    (_match, prefix: string, url: string, suffix: string) => {
      const next = replaceUrl(url.trim())
      if (next) return `${prefix}${next}${suffix}`
      return `${prefix}${url}${suffix}`
    },
  )

  result = result.replace(
    MD_HTML_ASSET_ATTR_RE,
    (match, _attr: string, quote: string, url: string) => {
      const next = replaceUrl(url.trim())
      if (next) return match.replace(url, next)
      return match
    },
  )

  return result
}

/** 提取 Markdown / HTML 内所有可嵌入资源 URL（去重） */
export function extractEmbeddableUrlsFromMarkdown(md: string): string[] {
  const urls = new Set<string>()
  for (const m of md.matchAll(MD_URL_IN_MARKDOWN)) {
    const u = m[2]?.trim()
    if (u && isEmbeddableAssetUrl(u)) urls.add(u)
  }
  for (const m of md.matchAll(MD_HTML_ASSET_ATTR_RE)) {
    const u = m[3]?.trim()
    if (u && isEmbeddableAssetUrl(u)) urls.add(u)
  }
  return [...urls]
}
