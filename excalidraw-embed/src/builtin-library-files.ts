/**
 * 内置素材库：与 public/builtin-libraries/*.excalidrawlib 一一对应（按文件名排序后依次合并）。
 * 增删库文件时请同步修改此列表。
 */
export const BUILTIN_LIBRARY_FILES: readonly string[] = [
  'UML-ER-library.excalidrawlib',
  'awesome-icons.excalidrawlib',
  'aws-architecture-icons.excalidrawlib',
  'azure-network.excalidrawlib',
  'basic-ux-wireframing-elements.excalidrawlib',
  'cloud.excalidrawlib',
  'data-viz.excalidrawlib',
  'db-eng.excalidrawlib',
  'drwnio.excalidrawlib',
  'forms.excalidrawlib',
  'google-icons.excalidrawlib',
  'it-logos.excalidrawlib',
  'microsoft-azure-cloud-icons.excalidrawlib',
  'network-topology-icons.excalidrawlib',
  'software-architecture.excalidrawlib',
  'stick-figures.excalidrawlib',
  'system-design-template.excalidrawlib',
  'system-design.excalidrawlib',
  'technology-logos.excalidrawlib',
] as const;
