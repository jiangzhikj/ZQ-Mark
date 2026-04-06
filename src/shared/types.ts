export interface ZqMeta {
  version: string
  type: 'document' | 'library'
  createdAt: string
  modifiedAt: string
  title: string
}

export interface LibraryNode {
  id: string
  name: string
  type: 'file' | 'folder'
  children?: LibraryNode[]
}

export interface LibraryIndex {
  tree: LibraryNode[]
}

export type WindowMode = 'document' | 'library'
