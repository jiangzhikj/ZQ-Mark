---

## name: zq-mark description: &gt;- Guides development of ZQ Mark (Electron + Vue 3 + TipTap v3): repo layout, icon barrel (@/components/icons), shared UI under @/components/ui, build scripts, main/preload/renderer boundaries, custom .zq/.zql formats, editor extensions and i18n. Use when working in this repository on UI, icons, the editor, IPC, exports, or packaging.

# ZQ Mark 项目开发指引

面向本仓库的 Agent：默认假设已熟悉 Vue 3 / Electron / TipTap；此处只补充**本项目**特有的结构与约定。

## 项目是什么

- **ZQ Mark**：本地优先的 Markdown 编辑器（类 Typora 所见即所得）。
- **运行时**：Electron 35；**UI**：Vue 3 + TipTap v3（ProseMirror）+ Pinia + vue-i18n。
- **样式**：TailwindCSS v4（Vite 插件）+ Sass。
- **双形态**：桌面 Electron；另有 `dev:web` / `build:web` 的 Web 入口（`vite.web.config.ts`），渲染层通过 `src/renderer/src/platform/` 做能力抽象。

## 常用命令

| 命令 | 用途 |
| --- | --- |
| `npm run dev` | 开发（electron-vite） |
| `npm run build` | 编译到 `out/`，不打出安装包 |
| `npm run build:win` / `build:mac` / `build:linux` / `build:all` | 各平台安装包，产物在 `dist/` |
| `npm start` | `electron-vite preview` |
| `npm run dev:web` / `build:web` | 纯 Web 开发与构建 |

环境：Node ≥ 18，npm ≥ 9（见根目录 `README.md`）。

## 目录结构（与改代码相关）

```plaintext
src/
├── main/                 # Electron 主进程：窗口、文件、导出、托盘、更新等
├── preload/              # contextBridge 暴露给渲染进程的 API
├── renderer/src/         # Vue 渲染进程（Vite alias `@` → 此处）
│   ├── App.vue
│   ├── components/
│   │   ├── icons/        # 图标统一出口（见下文）
│   │   ├── ui/           # 通用 UI：按钮、对话框、表单等（优先复用）
│   │   ├── zq-editor/    # TipTap 封装：extensions/、menus/、styles/
│   │   └── ...
│   ├── composables/
│   └── platform/         # Electron / Web 等平台差异与补丁
└── shared/               # 主进程与渲染进程共享：types、i18n 资源等
```

构建配置：`electron.vite.config.ts`（renderer 中 `@` 指向 `src/renderer/src`）。

## 图标（Icons）

- **唯一来源**：`lucide-vue-next`，但业务代码**不要**直接 `import from 'lucide-vue-next'`。

- **统一从 barrel 引用**：`src/renderer/src/components/icons/index.ts` 将用到的图标 **re-export**；页面/组件里写成：

  ```ts
  import { Save, X, FileText } from '@/components/icons'
  ```

- **需要新图标时**：在 `icons/index.ts` 中增加对应符号的 `export { NewIcon } from 'lucide-vue-next'`，再在业务里从 `@/components/icons` 引入。保持命名与 Lucide 一致，便于检索与去重。

## 通用 UI 组件（`components/ui`）

- **优先复用**：按钮、对话框、滚动条、滑块、上下文菜单、表单输入等，先看 `src/renderer/src/components/ui/` 是否已有（入口：`@/components/ui` 或 `components/ui/index.ts`）。
- **禁止在业务文件里堆一套「临时」按钮/弹窗样式**：若现有 `ui` 无法满足需求，应在 `components/ui/` **下新增统一组件**（或子目录如 `ui/form/`），并在 `components/ui/index.ts` 中导出，再在业务处引用。
- **命名习惯**：通用组件以 `Zq` 前缀为主（如 `ZqButton`、`ZqDialog`），与仓库现有风格一致；表单相关可放在 `ui/form/` 并经由 `form/index.ts` 汇总。
- **例外**：`zq-editor` 内仅服务于编辑器的专用块/菜单组件（如某扩展的 `*Component.vue`）可留在 `zq-editor` 下，但其中若出现**可复用的通用控件**（标准确认框、统一样式输入框等），仍应抽到 `ui`。

## 分层与职责

- **main**：系统集成（`window-manager`、`zq-file`、菜单、`export`、`updater`、`asset-protocol`、`tray`）。避免在 main 写 UI。
- **preload**：仅暴露必要 API；渲染进程不直接使用 Node，通过预加载桥接。
- **renderer**：所有编辑器 UI、TipTap 扩展、状态（Pinia）、与 preload 的调用约定。
- **shared**：跨进程类型与文案键；改文案时同步 `src/shared/i18n/locales/`（en、zh-CN、zh-TW）。

新增 TipTap 扩展：放在 `src/renderer/src/components/zq-editor/extensions/`，并在 `extensions/index.ts` 汇总注册；复杂块可配独立 `*Component.vue`。

## 自定义文件格式

- `.zq`：ZIP；含 `meta.json`、`content.json`（TipTap JSON）、`assets/`。
- `.zql`：ZIP；库结构含 `library.json`、`docs/{id}.json`、`assets/` 等。

逻辑与读写细节以 `src/main/zq-file.ts` 及渲染侧文档流为准；兼容 `.md` / `.txt` / `.html`。

## 修改时的检查清单

- [ ] 新图标：是否已加入 `components/icons/index.ts`，且业务侧只从 `@/components/icons` 引用？

- [ ] 新 UI：是否优先使用 `@/components/ui`；缺组件时是否在 `components/ui` 新建并导出，而非在页面里写一堆裸 `button`/`div`？

- [ ] 涉及 UI 字符串：是否三语言（en / zh-CN / zh-TW）？

- [ ] 涉及文件或系统能力：main + preload + renderer 三层是否一致？

- [ ] 仅改编辑器行为：优先动 `zq-editor/extensions` 与相关 composable，不扩散到无关组件。

- [ ] 打包资源：`package.json` 的 `build.files`、`extraResources` 与 `build/`、`resources/` 是否需同步？

## 延伸阅读

- 产品特性与脚本表：根目录 `README.md`。
- 发布流程：若存在 `docs/release-guide.md`，以仓库内最新内容为准。