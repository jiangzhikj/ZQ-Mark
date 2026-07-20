import { ref } from 'vue'
import type { LibraryNode } from '../../../shared/types'

const tree = ref<LibraryNode[]>([])
const activeFilePath = ref<string | null>(null)
const activeFileName = ref('')
const folderName = ref('')
const folderRootPath = ref<string | null>(null)
const expandedFolders = ref<Set<string>>(new Set())

function pathSepFor(p: string): string {
  return p.includes('\\') ? '\\' : '/'
}

function isPathUnder(parentPath: string, childPath: string): boolean {
  if (parentPath === childPath) return false
  const sep = pathSepFor(parentPath)
  const normalizedParent = parentPath.endsWith(sep) ? parentPath : `${parentPath}${sep}`
  return childPath.startsWith(normalizedParent)
}

export function useFolderWorkspace() {
  const isFolderMode = ref(false)

  async function initFolder() {
    const mode = await window.electron.getWindowMode()
    isFolderMode.value = mode === 'folder'
    if (isFolderMode.value) {
      folderRootPath.value = await window.electron.folderGetRoot()
      await refreshTree()
      await refreshFolderName()
    }
  }

  async function refreshFolderName() {
    folderName.value = await window.electron.folderGetName()
  }

  async function refreshTree() {
    tree.value = await window.electron.folderGetTree()
  }

  async function openFile(filePath: string): Promise<{
    content?: string
    json?: any
    meta?: any
    isZq: boolean
    name: string
  } | null> {
    const result = await window.electron.folderReadFile(filePath)
    if (result) {
      activeFilePath.value = filePath
      activeFileName.value = result.name
    }
    return result
  }

  async function saveCurrentFile(data: {
    content?: string
    json?: any
    title?: string
    meta?: any
  }): Promise<boolean> {
    if (!activeFilePath.value) return false
    return window.electron.folderWriteFile({
      filePath: activeFilePath.value,
      ...data,
    })
  }

  async function createDoc(parentId: string | null, name?: string): Promise<LibraryNode | null> {
    const node = await window.electron.folderCreateFile({
      parentId,
      name: name || '未命名文档',
    })
    if (node) {
      await refreshTree()
      if (parentId) expandedFolders.value.add(parentId)
    }
    return node
  }

  async function createFolder(parentId: string | null, name?: string): Promise<LibraryNode | null> {
    const node = await window.electron.folderCreateFolder({
      parentId,
      name: name || '未命名文件夹',
    })
    if (node) {
      await refreshTree()
      if (parentId) expandedFolders.value.add(parentId)
    }
    return node
  }

  async function renameItem(id: string, newName: string): Promise<boolean> {
    const ok = await window.electron.folderRename({ id, newName })
    if (ok) {
      if (activeFilePath.value) {
        if (id === activeFilePath.value) {
          const sep = pathSepFor(id)
          const lastSep = Math.max(id.lastIndexOf('/'), id.lastIndexOf('\\'))
          const parent = lastSep >= 0 ? id.slice(0, lastSep) : ''
          activeFilePath.value = parent ? `${parent}${sep}${newName}` : newName
          activeFileName.value = newName
        } else if (isPathUnder(id, activeFilePath.value)) {
          const sep = pathSepFor(id)
          const lastSep = Math.max(id.lastIndexOf('/'), id.lastIndexOf('\\'))
          const parent = lastSep >= 0 ? id.slice(0, lastSep) : ''
          const newFolderPath = parent ? `${parent}${sep}${newName}` : newName
          activeFilePath.value = `${newFolderPath}${activeFilePath.value.slice(id.length)}`
          activeFileName.value = activeFilePath.value.split(/[/\\]/).pop() || activeFileName.value
        }
      }
      await refreshTree()
    }
    return ok
  }

  async function deleteItem(id: string): Promise<boolean> {
    const ok = await window.electron.folderDelete({ id })
    if (ok) {
      await refreshTree()
      if (
        activeFilePath.value &&
        (id === activeFilePath.value || isPathUnder(id, activeFilePath.value))
      ) {
        activeFilePath.value = null
        activeFileName.value = ''
      }
    }
    return ok
  }

  async function moveItem(id: string, newParentId: string | null, index: number): Promise<boolean> {
    const ok = await window.electron.folderMove({ id, newParentId, index })
    if (ok) {
      if (activeFilePath.value) {
        if (id === activeFilePath.value) {
          const baseName = id.split(/[/\\]/).pop() || ''
          const parent = newParentId ?? folderRootPath.value ?? ''
          if (parent && baseName) {
            const sep = pathSepFor(parent)
            activeFilePath.value = `${parent}${sep}${baseName}`
          }
        } else if (isPathUnder(id, activeFilePath.value)) {
          const baseName = id.split(/[/\\]/).pop() || ''
          const parent = newParentId ?? folderRootPath.value ?? ''
          if (parent && baseName) {
            const sep = pathSepFor(parent)
            const newFolderPath = `${parent}${sep}${baseName}`
            activeFilePath.value = `${newFolderPath}${activeFilePath.value.slice(id.length)}`
          }
        }
      }
      await refreshTree()
    }
    return ok
  }

  function toggleFolder(id: string) {
    if (expandedFolders.value.has(id)) {
      expandedFolders.value.delete(id)
    } else {
      expandedFolders.value.add(id)
    }
  }

  function setActiveFilePath(id: string | null, name?: string) {
    activeFilePath.value = id
    if (name !== undefined) activeFileName.value = name
  }

  function setFolderRoot(path: string | null) {
    folderRootPath.value = path
  }

  function enterFolderMode(rootPath: string) {
    isFolderMode.value = true
    folderRootPath.value = rootPath
  }

  return {
    tree,
    activeFilePath,
    activeFileName,
    folderName,
    folderRootPath,
    expandedFolders,
    isFolderMode,
    initFolder,
    refreshTree,
    refreshFolderName,
    openFile,
    saveCurrentFile,
    createDoc,
    createFolder,
    renameItem,
    deleteItem,
    moveItem,
    toggleFolder,
    setActiveFilePath,
    setFolderRoot,
    enterFolderMode,
  }
}
