import { join, basename, extname, dirname, resolve, sep } from 'path'
import { readFile, writeFile, mkdir, readdir, rm, rename, stat } from 'fs/promises'
import { existsSync } from 'fs'
import type { LibraryNode } from '../shared/types'
import { openZqDocument, saveZqDocument, detectZqType } from './zq-file'

const SKIP_DIRS = new Set(['node_modules', '.git'])
const SUPPORTED_EXTENSIONS = new Set(['.md', '.markdown', '.txt', '.html', '.zq'])

function localeSort(a: string, b: string): number {
  return a.localeCompare(b, undefined, { sensitivity: 'base' })
}

function assertUnderRoot(rootPath: string, targetPath: string): void {
  const root = resolve(rootPath)
  const target = resolve(targetPath)
  if (target !== root && !target.startsWith(root + sep)) {
    throw new Error('Path outside workspace')
  }
}

function isSupportedFile(filePath: string): boolean {
  const ext = extname(filePath).toLowerCase()
  if (!SUPPORTED_EXTENSIONS.has(ext)) return false
  if (ext === '.zq') {
    try {
      return detectZqType(filePath) === 'document'
    } catch {
      return false
    }
  }
  return true
}

function shouldSkipDir(name: string): boolean {
  return name.startsWith('.') || SKIP_DIRS.has(name)
}

async function scanDirectory(dirPath: string): Promise<LibraryNode[]> {
  let entries
  try {
    entries = await readdir(dirPath, { withFileTypes: true })
  } catch {
    return []
  }

  const folders: LibraryNode[] = []
  const files: LibraryNode[] = []

  for (const entry of entries) {
    const fullPath = join(dirPath, entry.name)
    if (entry.isDirectory()) {
      if (shouldSkipDir(entry.name)) continue
      const children = await scanDirectory(fullPath)
      folders.push({
        id: fullPath,
        name: entry.name,
        type: 'folder',
        children,
      })
    } else if (entry.isFile() && isSupportedFile(fullPath)) {
      files.push({
        id: fullPath,
        name: entry.name,
        type: 'file',
      })
    }
  }

  folders.sort((a, b) => localeSort(a.name, b.name))
  files.sort((a, b) => localeSort(a.name, b.name))
  return [...folders, ...files]
}

export async function scanFolderTree(rootPath: string): Promise<LibraryNode[]> {
  return scanDirectory(rootPath)
}

export async function readFolderFile(
  filePath: string,
): Promise<{ content?: string; json?: any; meta?: any; isZq: boolean; name: string }> {
  const ext = extname(filePath).toLowerCase()
  const name = basename(filePath)

  if (ext === '.zq') {
    const { json, meta } = await openZqDocument(filePath)
    return { json, meta, isZq: true, name }
  }

  const content = await readFile(filePath, 'utf-8')
  return { content, isZq: false, name }
}

export async function writeFolderFile(
  filePath: string,
  data: { content?: string; json?: any; title?: string; meta?: any },
): Promise<void> {
  const ext = extname(filePath).toLowerCase()

  if (ext === '.zq' || data.json) {
    const title = data.title || basename(filePath, extname(filePath))
    await saveZqDocument(filePath, data.json, title, data.meta)
    return
  }

  await writeFile(filePath, data.content ?? '', 'utf-8')
}

function normalizeFileName(name: string): string {
  const trimmed = name.trim()
  if (!trimmed) throw new Error('Empty name')
  if (trimmed.includes('/') || trimmed.includes('\\')) throw new Error('Invalid name')
  const ext = extname(trimmed).toLowerCase()
  if (!ext) return `${trimmed}.md`
  return trimmed
}

export async function createFolderFile(
  rootPath: string,
  parentPath: string | null,
  name: string,
): Promise<LibraryNode> {
  const parent = parentPath ?? rootPath
  assertUnderRoot(rootPath, parent)

  const fileName = normalizeFileName(name)
  const filePath = join(parent, fileName)

  assertUnderRoot(rootPath, filePath)
  if (existsSync(filePath)) {
    throw new Error('File already exists')
  }
  await writeFile(filePath, '', 'utf-8')

  return { id: filePath, name: fileName, type: 'file' }
}

export async function createFolderDir(
  rootPath: string,
  parentPath: string | null,
  name: string,
): Promise<LibraryNode> {
  const trimmed = name.trim()
  if (!trimmed) throw new Error('Empty name')
  if (trimmed.includes('/') || trimmed.includes('\\')) throw new Error('Invalid name')

  const parent = parentPath ?? rootPath
  assertUnderRoot(rootPath, parent)

  const dirPath = join(parent, trimmed)
  assertUnderRoot(rootPath, dirPath)
  await mkdir(dirPath, { recursive: false })

  return { id: dirPath, name: trimmed, type: 'folder', children: [] }
}

export async function renameFolderEntry(
  rootPath: string,
  oldPath: string,
  newName: string,
): Promise<boolean> {
  assertUnderRoot(rootPath, oldPath)

  const trimmed = newName.trim()
  if (!trimmed) return false
  if (trimmed.includes('/') || trimmed.includes('\\')) return false

  const parent = dirname(oldPath)
  const newPath = join(parent, trimmed)
  assertUnderRoot(rootPath, newPath)
  if (existsSync(newPath)) return false

  await rename(oldPath, newPath)
  return true
}

export async function deleteFolderEntry(rootPath: string, targetPath: string): Promise<boolean> {
  assertUnderRoot(rootPath, targetPath)
  if (resolve(targetPath) === resolve(rootPath)) return false

  const info = await stat(targetPath)
  if (info.isDirectory()) {
    await rm(targetPath, { recursive: true, force: true })
  } else {
    await rm(targetPath, { force: true })
  }
  return true
}

export async function moveFolderEntry(
  rootPath: string,
  srcPath: string,
  destParentPath: string | null,
  _index: number,
): Promise<boolean> {
  assertUnderRoot(rootPath, srcPath)

  const destParent = destParentPath ?? rootPath
  assertUnderRoot(rootPath, destParent)

  const destPath = join(destParent, basename(srcPath))
  if (resolve(srcPath) === resolve(destPath)) return true

  assertUnderRoot(rootPath, destPath)
  if (existsSync(destPath)) return false
  await rename(srcPath, destPath)
  return true
}

export function getFolderDisplayName(rootPath: string): string {
  return basename(rootPath) || rootPath
}
