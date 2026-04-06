import { ref } from 'vue'
import type { LibraryNode } from '../../../shared/types'

const tree = ref<LibraryNode[]>([])
const activeDocId = ref<string | null>(null)
const activeDocName = ref('')
const libraryName = ref('')
const expandedFolders = ref<Set<string>>(new Set())

export function useLibrary() {
  const isLibraryMode = ref(false)

  async function initLibrary() {
    const mode = await window.electron.getWindowMode()
    isLibraryMode.value = mode === 'library'
    if (isLibraryMode.value) {
      await refreshTree()
      await refreshLibraryName()
    }
  }

  async function refreshLibraryName() {
    libraryName.value = await window.electron.libraryGetName()
  }

  async function refreshTree() {
    tree.value = await window.electron.libraryGetTree()
  }

  async function openDoc(docId: string): Promise<{ json: any; name: string } | null> {
    const result = await window.electron.libraryOpenDoc(docId)
    if (result) {
      activeDocId.value = docId
      activeDocName.value = result.name
    }
    return result
  }

  async function saveCurrentDoc(json: any): Promise<boolean> {
    if (!activeDocId.value) return false
    const cleanJson = JSON.parse(JSON.stringify(json))
    return await window.electron.librarySaveDoc({ docId: activeDocId.value, json: cleanJson })
  }

  async function saveLibrary(): Promise<string | null> {
    return await window.electron.librarySave()
  }

  async function createDoc(parentId: string | null, name?: string): Promise<LibraryNode | null> {
    const node = await window.electron.libraryCreateDoc({
      parentId,
      name: name || '未命名文档'
    })
    if (node) {
      await refreshTree()
      if (parentId) expandedFolders.value.add(parentId)
    }
    return node
  }

  async function createFolder(parentId: string | null, name?: string): Promise<LibraryNode | null> {
    const node = await window.electron.libraryCreateFolder({
      parentId,
      name: name || '未命名文件夹'
    })
    if (node) {
      await refreshTree()
      if (parentId) expandedFolders.value.add(parentId)
    }
    return node
  }

  async function renameItem(id: string, newName: string): Promise<boolean> {
    const ok = await window.electron.libraryRename({ id, newName })
    if (ok) {
      await refreshTree()
      if (id === activeDocId.value) activeDocName.value = newName
    }
    return ok
  }

  async function deleteItem(id: string): Promise<boolean> {
    const ok = await window.electron.libraryDelete({ id })
    if (ok) {
      await refreshTree()
      if (id === activeDocId.value) {
        activeDocId.value = null
        activeDocName.value = ''
      }
    }
    return ok
  }

  async function moveItem(id: string, newParentId: string | null, index: number): Promise<boolean> {
    const ok = await window.electron.libraryMove({ id, newParentId, index })
    if (ok) await refreshTree()
    return ok
  }

  function toggleFolder(id: string) {
    if (expandedFolders.value.has(id)) {
      expandedFolders.value.delete(id)
    } else {
      expandedFolders.value.add(id)
    }
  }

  function isFolderExpanded(id: string): boolean {
    return expandedFolders.value.has(id)
  }

  function setActiveDocId(id: string | null, name?: string) {
    activeDocId.value = id
    if (name !== undefined) activeDocName.value = name
  }

  return {
    tree,
    activeDocId,
    activeDocName,
    libraryName,
    expandedFolders,
    isLibraryMode,
    initLibrary,
    refreshTree,
    refreshLibraryName,
    openDoc,
    saveCurrentDoc,
    saveLibrary,
    createDoc,
    createFolder,
    renameItem,
    deleteItem,
    moveItem,
    toggleFolder,
    isFolderExpanded,
    setActiveDocId
  }
}
