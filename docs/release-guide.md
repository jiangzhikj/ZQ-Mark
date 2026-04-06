# ZQ Mark 发布与更新指南

## 目录

1. [应用图标](#1-%E5%BA%94%E7%94%A8%E5%9B%BE%E6%A0%87)
2. [文件关联图标](#2-%E6%96%87%E4%BB%B6%E5%85%B3%E8%81%94%E5%9B%BE%E6%A0%87)
3. [目录结构](#3-%E7%9B%AE%E5%BD%95%E7%BB%93%E6%9E%84)
4. [图标制作方法](#4-%E5%9B%BE%E6%A0%87%E5%88%B6%E4%BD%9C%E6%96%B9%E6%B3%95)
5. [package.json 构建配置](#5-packagejson-%E6%9E%84%E5%BB%BA%E9%85%8D%E7%BD%AE)
6. [构建命令](#6-%E6%9E%84%E5%BB%BA%E5%91%BD%E4%BB%A4)
7. [通过 Gitee 发布更新](#7-%E9%80%9A%E8%BF%87-gitee-%E5%8F%91%E5%B8%83%E6%9B%B4%E6%96%B0)
8. [完整发布流程](#8-%E5%AE%8C%E6%95%B4%E5%8F%91%E5%B8%83%E6%B5%81%E7%A8%8B)

---

## 1. 应用图标

### 各平台要求

| 平台 | 格式 | 文件名 | 尺寸要求 | 说明 |
| --- | --- | --- | --- | --- |
| **macOS** | `.icns` | `icon.icns` | 包含 16×16 到 1024×1024 多尺寸 | macOS 专用打包格式，内含多种分辨率 |
| **Windows** | `.ico` | `icon.ico` | 包含 16×16 到 256×256 多尺寸 | Windows 专用打包格式 |
| **Linux** | `.png` | `icon.png` | 推荐 512×512 或 1024×1024 | 单张 PNG 即可 |

### 默认查找路径

electron-builder 默认按以下路径查找图标（无需额外配置）：

```plaintext
build/
├── icon.icns          ← macOS 图标
├── icon.ico           ← Windows 图标
├── icon.png           ← Linux 图标（也作为通用后备）
```

> **重要**：electron-builder 默认从项目根目录的 `build/` 文件夹查找图标文件。如果要自定义路径，需要在 `package.json` 中显式配置 `icon` 字段。

### 自定义图标路径（可选）

如果不想用 `build/` 目录，可以在 `package.json` 中指定：

```json
{
  "build": {
    "mac": {
      "icon": "resources/icon.icns"
    },
    "win": {
      "icon": "resources/icon.ico"
    },
    "linux": {
      "icon": "resources/icon.png"
    }
  }
}
```

---

## 2. 文件关联图标

为自定义文件扩展名（`.zq`、`.zql`）设置专属图标，让用户在系统中看到自定义文件图标。

### macOS 文件类型图标

macOS 文件类型图标也使用 `.icns` 格式，需要在 `fileAssociations` 中配置：

```json
{
  "fileAssociations": [
    {
      "ext": "zq",
      "name": "ZQ Document",
      "icon": "build/zq-doc.icns",
      "role": "Editor"
    },
    {
      "ext": "zql",
      "name": "ZQ Document Library",
      "icon": "build/zq-lib.icns",
      "role": "Editor"
    }
  ]
}
```

### Windows 文件类型图标

Windows 使用 `.ico` 格式：

```json
{
  "fileAssociations": [
    {
      "ext": "zq",
      "name": "ZQ Document",
      "icon": "build/zq-doc.ico",
      "role": "Editor"
    }
  ]
}
```

### Linux

Linux 不支持文件关联图标，系统会使用应用图标。

---

## 3. 目录结构

建议的最终目录结构：

```plaintext
zq-mark/
├── build/                          ← electron-builder 图标目录
│   ├── icon.icns                   ← macOS 应用图标
│   ├── icon.ico                    ← Windows 应用图标
│   ├── icon.png                    ← Linux 应用图标 (512×512+)
│   ├── zq-doc.icns                 ← macOS .zq 文件图标（可选）
│   ├── zq-doc.ico                  ← Windows .zq 文件图标（可选）
│   ├── zq-lib.icns                 ← macOS .zql 文件图标（可选）
│   └── zq-lib.ico                  ← Windows .zql 文件图标（可选）
├── resources/                      ← 应用运行时资源（会被打包进 app）
├── docs/
│   └── release-guide.md            ← 本文档
├── src/
├── package.json
└── ...
```

> `build/` 目录仅在构建时使用，不会被打包进应用。 `resources/` 目录的内容会被打包进最终应用（配置在 `package.json` 的 `files` 字段中）。

---

## 4. 图标制作方法

### 4.1 准备源图

- 准备一张 **1024×1024** 的 PNG 图片（带透明通道）
- 这是所有平台图标的源文件

### 4.2 生成 macOS .icns

**方法 A：使用 macOS 自带的** `iconutil`**（推荐）**

```bash
# 1. 创建 iconset 目录
mkdir icon.iconset

# 2. 用 sips 从源图生成各尺寸
sips -z 16 16     icon-1024.png --out icon.iconset/icon_16x16.png
sips -z 32 32     icon-1024.png --out icon.iconset/icon_16x16@2x.png
sips -z 32 32     icon-1024.png --out icon.iconset/icon_32x32.png
sips -z 64 64     icon-1024.png --out icon.iconset/icon_32x32@2x.png
sips -z 128 128   icon-1024.png --out icon.iconset/icon_128x128.png
sips -z 256 256   icon-1024.png --out icon.iconset/icon_128x128@2x.png
sips -z 256 256   icon-1024.png --out icon.iconset/icon_256x256.png
sips -z 512 512   icon-1024.png --out icon.iconset/icon_256x256@2x.png
sips -z 512 512   icon-1024.png --out icon.iconset/icon_512x512.png
sips -z 1024 1024 icon-1024.png --out icon.iconset/icon_512x512@2x.png

# 3. 转换为 icns
iconutil -c icns icon.iconset -o icon.icns

# 4. 清理
rm -rf icon.iconset
```

**方法 B：使用** `electron-icon-builder`**（跨平台）**

```bash
npx electron-icon-builder --input=icon-1024.png --output=build/
```

会自动在 `build/` 下生成 `icons/` 目录，包含所有平台格式。

**方法 C: 使用在线工具**

- [CloudConvert](https://cloudconvert.com/png-to-icns) — PNG → ICNS
- [iConvert Icons](https://iconverticons.com/) — 支持多种格式互转

### 4.3 生成 Windows .ico

**方法 A：使用 ImageMagick**

```bash
# 安装 (macOS)
brew install imagemagick

# 生成包含多尺寸的 ico
convert icon-1024.png -define icon:auto-resize=256,128,64,48,32,16 icon.ico
```

**方法 B：使用** `electron-icon-builder`

同上，`electron-icon-builder` 会同时生成 `.ico`。

**方法 C：在线工具**

- [ConvertICO](https://convertico.com/) — PNG → ICO
- [RealFaviconGenerator](https://realfavicongenerator.net/) — 支持多种尺寸

### 4.4 生成 Linux PNG

直接使用 1024×1024 或 512×512 的 PNG 即可，命名为 `icon.png` 放入 `build/`。

### 4.5 一键生成所有格式（最简方法）

```bash
# 安装
npm install -D electron-icon-builder

# 从一张 1024x1024 PNG 生成所有格式
npx electron-icon-builder --input=./icon-source.png --output=./build

# 生成结果在 build/icons/ 下：
# build/icons/mac/icon.icns
# build/icons/win/icon.ico
# build/icons/png/1024x1024.png
# ...

# 把文件移到 build/ 根目录
cp build/icons/mac/icon.icns build/icon.icns
cp build/icons/win/icon.ico build/icon.ico
cp build/icons/png/512x512.png build/icon.png
```

---

## 5. package.json 构建配置

当前配置及补充说明：

```jsonc
{
  "build": {
    "appId": "com.zq.zq-mark",
    "productName": "ZQ Mark",
    "directories": {
      "output": "dist"                     // 构建产物输出目录
    },
    "files": [
      "out/**/*",                          // electron-vite 编译输出
      "resources/**/*"                     // 运行时资源
    ],

    // 文件关联 — 添加 icon 字段指向对应图标文件
    "fileAssociations": [
      {
        "ext": "zq",
        "name": "ZQ Document",
        "description": "ZQ Mark Document",
        "mimeType": "application/x-zq",
        "icon": "build/zq-doc",            // 不带扩展名，builder 自动补 .icns/.ico
        "role": "Editor"
      },
      {
        "ext": "zql",
        "name": "ZQ Document Library",
        "description": "ZQ Mark Document Library",
        "mimeType": "application/x-zql",
        "icon": "build/zq-lib",
        "role": "Editor"
      }
      // md, txt, html 等系统已有图标，无需自定义
    ],

    // macOS 配置
    "mac": {
      "category": "public.app-category.productivity",
      "icon": "build/icon.icns",           // 可省略，默认就是 build/icon.icns
      "target": ["dmg", "zip"],
      "darkModeSupport": true
    },

    // DMG 安装窗口美化（可选）
    "dmg": {
      "background": "build/dmg-bg.png",    // 可选，DMG 背景图 (540×380)
      "iconSize": 80,
      "contents": [
        { "x": 130, "y": 220 },
        { "x": 410, "y": 220, "type": "link", "path": "/Applications" }
      ]
    },

    // Windows 配置
    "win": {
      "icon": "build/icon.ico",            // 可省略，默认就是 build/icon.ico
      "target": ["nsis"]
    },
    "nsis": {
      "oneClick": false,
      "perMachine": false,
      "allowToChangeInstallationDirectory": true,
      "createDesktopShortcut": true,
      "createStartMenuShortcut": true,
      "installerIcon": "build/icon.ico",           // 安装程序图标（可选）
      "uninstallerIcon": "build/icon.ico",         // 卸载程序图标（可选）
      "installerHeaderIcon": "build/icon.ico"      // 安装向导头部图标（可选）
    },

    // Linux 配置
    "linux": {
      "icon": "build/icon.png",            // 可省略，默认就是 build/icon.png
      "target": ["AppImage", "deb"],
      "category": "Office"
    },

    "npmRebuild": false
  }
}
```

---

## 6. 构建命令

```bash
# macOS（在 macOS 上运行）
npm run build:mac

# Windows（在 Windows 上运行，或 macOS 用 wine 交叉编译）
npm run build:win

# Linux（在 Linux 上运行）
npm run build:linux
```

### 构建产物

| 平台 | 格式 | 路径 |
| --- | --- | --- |
| macOS | `.dmg` / `.zip` | `dist/ZQ Mark-{version}-arm64.dmg` 等 |
| Windows | `.exe` (NSIS) | `dist/ZQ Mark Setup {version}.exe` |
| Linux | `.AppImage` / `.deb` | `dist/ZQ Mark-{version}.AppImage` 等 |

---

## 7. 通过 Gitee 发布更新

本项目使用 **Gitee Releases** 作为更新文件托管平台。应用的自动更新机制会从 Gitee Release 附件中下载 `latest.json` 和安装包。

### 7.1 原理说明

应用内置的更新器会向配置的 URL 发起请求：

1. 请求 `{updateUrl}/latest.json` 获取版本清单
2. 比较版本号，如果有新版本则提示用户
3. 用户点击下载后，从 `latest.json` 中记录的 URL 下载对应平台安装包
4. 下载完成后用户手动安装

Gitee Release 的附件提供了直链下载能力，完美适配此机制。

### 7.2 Gitee 仓库准备

1. 在 Gitee 上创建一个仓库（公开仓库，附件可免登录下载）
2. 仓库名称：`zq-mark`（用户名：`zq-platform`）

### 7.3 latest.json 格式

```json
{
  "version": "1.1.0",
  "notes": "- 新增自动更新功能\n- 修复了文档库保存问题\n- 优化了性能",
  "pub_date": "2026-04-03T00:00:00Z",
  "platforms": {
    "darwin-arm64": {
      "url": "https://gitee.com/zq-platform/zq-mark/releases/download/v1.1.0/ZQ-Mark-1.1.0-arm64.dmg",
      "size": 89000000
    },
    "darwin-x64": {
      "url": "https://gitee.com/zq-platform/zq-mark/releases/download/v1.1.0/ZQ-Mark-1.1.0-x64.dmg",
      "size": 92000000
    },
    "win32-x64": {
      "url": "https://gitee.com/zq-platform/zq-mark/releases/download/v1.1.0/ZQ-Mark-Setup-1.1.0-x64.exe",
      "size": 78000000
    },
    "linux-x64": {
      "url": "https://gitee.com/zq-platform/zq-mark/releases/download/v1.1.0/ZQ-Mark-1.1.0-x86_64.AppImage",
      "size": 95000000
    }
  }
}
```

### 7.4 平台标识符

应用会根据 `process.platform` 和 `process.arch` 自动拼接以下 key：

| 操作系统 | 架构 | 平台 Key |
| --- | --- | --- |
| macOS | Apple Silicon | `darwin-arm64` |
| macOS | Intel | `darwin-x64` |
| Windows | 64 位 | `win32-x64` |
| Windows | 32 位 | `win32-ia32` |
| Linux | x64 | `linux-x64` |
| Linux | ARM64 | `linux-arm64` |

### 7.5 在 Gitee 上创建 Release 的详细步骤

#### Step A：进入仓库 Release 页面

1. 打开 Gitee 仓库页面
2. 点击右侧 **"发行版"**（Releases）标签
3. 点击 **"新建发行版"**

#### Step B：填写 Release 信息

| 字段 | 说明 | 示例 |
| --- | --- | --- |
| **标签名** | 版本号，以 `v` 开头 | `v1.1.0` |
| **发行版标题** | 版本标题 | `ZQ Mark v1.1.0` |
| **发行版描述** | 更新说明（Markdown 格式） | `- 新功能...\n- 修复...` |

#### Step C：上传附件

在 Release 编辑页底部的 **"上传附件"** 区域，上传以下文件：

1. **`latest.json`** — 版本清单文件（**必须**）
2. **各平台安装包**（根据需要上传）：
   - `ZQ-Mark-{version}-arm64.dmg` — macOS Apple Silicon
   - `ZQ-Mark-{version}-x64.dmg` — macOS Intel
   - `ZQ-Mark-Setup-{version}-x64.exe` — Windows x64
   - `ZQ-Mark-{version}-x86_64.AppImage` — Linux x64

> **注意**：Gitee 免费版单个附件大小限制为 **100 MB**。如果安装包超过此限制，可以考虑使用压缩后的 zip 包，或升级 Gitee 付费版。

#### Step D：发布

点击 **"创建发行版"** 按钮完成发布。

### 7.6 获取更新地址

Release 创建完成后，附件会获得一个直链下载 URL，格式为：

```
https://gitee.com/zq-platform/zq-mark/releases/download/<标签名>/<文件名>
```

你需要在 `latest.json` 的 `platforms.*.url` 中填入各安装包的完整直链地址。

**应用中配置的更新地址**应该是 `latest.json` 所在目录的 URL（不含文件名）：

```
https://gitee.com/zq-platform/zq-mark/releases/download/v1.1.0
```

用户在 **设置 → 关于** 页面填入此地址即可。应用会自动在此地址后拼接 `/latest.json` 进行版本检查。

> **重要提示**：每次发布新版本时，更新地址中的版本号会变化。建议有以下两种方案：
>
> 1. **方案 A（推荐）**：在仓库中维护一个固定的 `latest.json` 文件（放在仓库代码中而非 Release 附件中），使用 Gitee 的原始文件链接（raw 链接），如：`https://gitee.com/zq-platform/zq-mark/raw/master`（已内置为应用默认值）。每次发布新版本时更新仓库中的 `latest.json`，只需把安装包传到 Release 附件。
> 2. **方案 B**：每次发布后将新的 Release 附件地址告知用户，用户手动更新设置中的地址。

### 7.7 推荐的发布方案（方案 A 详解）

推荐使用**仓库 raw 链接 + Release 附件**的组合方式：

```plaintext
Gitee 仓库: zq-platform/zq-mark
├── latest.json          ← 放在仓库代码根目录（每次发布时更新此文件）
└── README.md

Release v1.1.0 附件:
├── ZQ-Mark-1.1.0-arm64.dmg
├── ZQ-Mark-Setup-1.1.0-x64.exe
└── ...
```

**用户只需填写一次更新地址，后续发布无需用户修改**：

```
https://gitee.com/zq-platform/zq-mark/raw/master
```

`latest.json` 中的安装包 URL 指向对应 Release 的附件直链。

### 7.8 更新流程图

```plaintext
                 应用启动
                   │
          ┌────────▼────────┐
          │ 延迟 10 秒后检查  │  （以及每 4 小时定时检查）
          └────────┬────────┘
                   │
     GET {updateUrl}/latest.json
     (从 Gitee raw 或 Release 附件获取)
                   │
         ┌─────────▼──────────┐
         │  比较 version 字段   │
         │  与当前 app.getVersion() │
         └─────────┬──────────┘
              ╱         ╲
          有新版本      已最新
            │            │
    显示更新对话框     静默，不打扰
            │
     用户点击"下载"
            │
   从 Gitee Release 附件
   下载对应平台安装包
   (显示实时进度条)
            │
     下载完成
            │
     用户点击"安装"
            │
  shell.openPath(安装包路径)
            │
    系统打开安装程序
    用户手动完成安装
```

---

## 8. 完整发布流程（基于 Gitee）

### Step 1：更新版本号

```bash
# 修改 package.json 中的 version
# "version": "1.0.0" → "version": "1.1.0"
```

### Step 2：准备图标

```bash
# 确保 build/ 下有以下文件：
# build/icon.icns   (macOS)
# build/icon.ico    (Windows)
# build/icon.png    (Linux)
```

### Step 3：构建各平台安装包

```bash
# macOS（在 macOS 上执行）
npm run build:mac

# Windows（在 Windows 上执行）
npm run build:win

# Linux（在 Linux 上执行）
npm run build:linux
```

### Step 4：在 Gitee 创建新 Release

1. 进入 Gitee 仓库 → 发行版 → 新建发行版
2. 填写标签名（如 `v1.1.0`）、标题和更新说明
3. 上传 `dist/` 下生成的各平台安装包作为附件
4. 点击"创建发行版"

### Step 5：更新仓库中的 latest.json

1. 从 Gitee Release 页面复制各附件的直链 URL
2. 编辑仓库根目录的 `latest.json`，更新版本号、更新说明、各平台下载链接
3. 提交并推送到 Gitee

```bash
git add latest.json
git commit -m "release: v1.1.0"
git push
```

### Step 6：验证

1. 打开旧版本应用
2. 进入 **设置 → 关于**，确认更新地址正确（默认已内置，无需手动填写）：
   ```
   https://gitee.com/zq-platform/zq-mark/raw/master
   ```
3. 点击"检查更新"
4. 确认弹出更新对话框，显示新版本和更新说明
5. 点击下载，验证进度条正常工作
6. 下载完成后点击安装，确认安装包能正常打开

---

## 附录 A：macOS DMG 背景图

如果想美化 DMG 安装窗口（拖拽应用到 Applications 的那个界面）：

- 尺寸：**540×380** 像素
- 格式：PNG
- 路径：`build/dmg-bg.png`
- 需要在 `package.json` 中配置 `dmg.background` 字段

## 附录 B：Windows NSIS 安装向导定制

NSIS 安装向导支持更多定制：

```json
{
  "nsis": {
    "oneClick": false,
    "perMachine": false,
    "allowToChangeInstallationDirectory": true,
    "installerIcon": "build/icon.ico",
    "uninstallerIcon": "build/icon.ico",
    "installerSidebar": "build/nsis-sidebar.bmp",
    "license": "LICENSE"
  }
}
```

- `installerSidebar`：安装向导侧栏图片，**164×314** BMP 格式

## 附录 C：代码签名（可选）

| 平台 | 证书类型 | 获取途径 | 年费参考 |
| --- | --- | --- | --- |
| macOS | Apple Developer ID | [Apple Developer](https://developer.apple.com) | $99/年 |
| Windows | EV Code Signing Certificate | DigiCert, Sectigo 等 | $200-400/年 |

未签名的应用：

- **macOS**：用户首次打开需要右键 → 打开，或在系统设置中允许
- **Windows**：SmartScreen 会弹出"未知发布者"警告，用户需点击"仍要运行"

当前项目未配置代码签名，更新功能采用手动安装方式（`shell.openPath`），无需签名也可正常工作。
