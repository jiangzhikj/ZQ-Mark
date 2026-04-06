<div align="center">

# ZQ Mark

**一个本地优先的现代 Markdown 编辑器**

类 Typora 的所见即所得体验，更丰富的块级编辑能力

[![Electron](https://img.shields.io/badge/Electron-35-47848F?logo=electron&logoColor=white)](https://www.electronjs.org/)
[![Vue 3](https://img.shields.io/badge/Vue-3.5-4FC08D?logo=vuedotjs&logoColor=white)](https://vuejs.org/)
[![TipTap](https://img.shields.io/badge/TipTap-v3-6C5CE7)](https://tiptap.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/License-MIT-green)](#license)

</div>

---

## 特性

- **所见即所得** — 基于 TipTap v3 (ProseMirror) 的富文本编辑，告别分屏预览
- **双模式编辑** — 单文档模式 + 文件库模式，灵活管理文档
- **丰富的块类型** — 表格、代码块（语法高亮）、数学公式 (KaTeX)、分栏布局、折叠块、提示框 (Callout)、目录 (TOC) 等
- **自由绘图** — 内置画板模块 (roughjs + perfect-freehand)，支持形状、箭头、手绘、文字等
- **媒体支持** — 图片、视频、附件嵌入，资源随文档打包
- **斜杠命令** — 输入 `/` 快速插入任意块类型
- **智能菜单** — 气泡工具栏、拖拽手柄菜单、表格浮动菜单
- **查找替换** — 支持大小写敏感的全文搜索与替换
- **源码模式** — 一键切换 Markdown 源码编辑
- **自定义文件格式** — `.zq` / `.zql` 格式完整保留所有样式和资源
- **多格式兼容** — 同时支持 `.md`、`.txt`、`.html` 文件
- **导出** — PDF、HTML、Word (.docx)、PNG 图片
- **自动保存** — 可配置的自动保存机制
- **多语言** — 中文简体、中文繁体、English
- **暗色模式** — 支持浅色 / 深色 / 跟随系统
- **跨平台** — macOS、Windows、Linux
- **自动更新** — 内置更新检查与下载机制

## 截图

> *TODO: 添加应用截图*

## 技术栈

| 层级 | 技术 |
| --- | --- |
| **框架** | Electron 35 + Vue 3 |
| **语言** | TypeScript 5.8 |
| **构建** | electron-vite + Vite 6 |
| **编辑器** | TipTap v3 (ProseMirror) |
| **样式** | TailwindCSS v4 + Sass |
| **状态管理** | Pinia |
| **国际化** | vue-i18n |
| **图标** | lucide-vue-next |
| **绘图** | roughjs + perfect-freehand |
| **数学公式** | KaTeX |

## 快速开始

### 环境要求

- **Node.js** >= 18
- **npm** >= 9

### 安装与运行

```bash
# 克隆项目
git clone https://github.com/your-username/zq-md.git
cd zq-md

# 安装依赖
npm install

# 启动开发模式
npm run dev
```

### 构建

```bash
# macOS
npm run build:mac

# macOS (Apple Silicon)
npm run build:mac-arm64

# macOS (Intel)
npm run build:mac-x64

# Windows
npm run build:win

# Linux
npm run build:linux

# 全平台
npm run build:all
```

构建产物输出至 `dist/` 目录。

## 项目结构

```
zq-md/
├── src/
│   ├── main/                          # Electron 主进程
│   │   ├── index.ts                   #   窗口管理、文件操作、IPC
│   │   ├── export.ts                  #   导出功能 (PDF/HTML/Word/Image)
│   │   ├── menu/                      #   原生菜单
│   │   └── ...
│   ├── preload/                       # Preload 桥接层
│   │   └── index.ts                   #   contextBridge API 暴露
│   ├── renderer/                      # Vue 3 渲染进程
│   │   └── src/
│   │       ├── App.vue                #   主应用壳
│   │       ├── components/
│   │       │   ├── zq-editor/         #   TipTap 编辑器封装
│   │       │   │   ├── extensions/    #     自定义扩展 (附件/callout/分栏/绘图/...)
│   │       │   │   ├── menus/         #     菜单组件 (气泡/拖拽/表格/搜索/...)
│   │       │   │   └── styles/        #     编辑器样式
│   │       │   ├── zq-draw/           #   绘图白板模块
│   │       │   ├── ui/                #   通用 UI 组件
│   │       │   └── ...                #   Sidebar/Settings/WelcomeScreen/...
│   │       └── composables/           #   组合式函数 (useEditor/useLibrary/useTheme/...)
│   └── shared/                        # 共享代码
│       ├── types.ts                   #   类型定义
│       └── i18n/                      #   国际化资源 (en/zh-CN/zh-TW)
├── build/                             # 构建资源 (应用图标)
├── docs/                              # 文档
├── electron.vite.config.ts            # electron-vite 配置
├── package.json
└── tsconfig.json
```

## 自定义文件格式

### `.zq` — 单文档

ZIP 压缩包，内部结构：

```
document.zq
├── meta.json        # 文档元信息 (名称、创建时间等)
├── content.json     # TipTap JSON 文档内容
└── assets/          # 嵌入的图片、视频、附件
```

### `.zql` — 文件库

ZIP 压缩包，内部结构：

```
library.zql
├── meta.json        # 文件库元信息
├── library.json     # 目录树结构
├── docs/            # 各文档的 JSON 内容
│   ├── {id}.json
│   └── ...
└── assets/          # 共享资源
```

> 同时完全兼容标准 `.md`、`.txt`、`.html` 文件的读写。

## 编辑器扩展

基于 TipTap v3 构建，包含以下自定义扩展：

| 扩展 | 说明 |
| --- | --- |
| **Slash Command** | `/` 命令菜单，快速插入任意块 |
| **Code Block** | 基于 lowlight 的语法高亮代码块 |
| **Mathematics** | KaTeX 数学公式渲染 |
| **Table** | 增强表格 (合并/拆分/排序/着色/斑马纹) |
| **Image** | 图片嵌入，支持对齐与缩放 |
| **Video** | 本地视频嵌入播放 |
| **Attachment** | 文件附件嵌入与下载 |
| **Callout** | 提示信息框 |
| **Toggle List** | 可折叠/展开内容块 |
| **Columns** | 多栏布局 |
| **Table of Contents** | 自动生成文档目录 |
| **Draw** | 自由绘图画板 |
| **Search & Replace** | 查找与替换面板 |
| **Font Size** | 自定义字号 |
| **Drag Handle** | 块级拖拽排序 |

## 脚本命令

| 命令 | 说明 |
| --- | --- |
| `npm run dev` | 启动开发服务器 |
| `npm run build` | 编译 (不打包安装程序) |
| `npm run build:mac` | 构建 macOS 安装包 |
| `npm run build:win` | 构建 Windows 安装包 |
| `npm run build:linux` | 构建 Linux 安装包 |
| `npm run build:all` | 构建全平台安装包 |
| `npm start` | 预览构建产物 |

## License

[MIT](LICENSE)
