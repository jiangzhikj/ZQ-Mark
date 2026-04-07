# ZQ Mark 发布与更新指南

## 目录

1. [应用图标](#1-%E5%BA%94%E7%94%A8%E5%9B%BE%E6%A0%87)
2. [文件关联图标](#2-%E6%96%87%E4%BB%B6%E5%85%B3%E8%81%94%E5%9B%BE%E6%A0%87)
3. [目录结构](#3-%E7%9B%AE%E5%BD%95%E7%BB%93%E6%9E%84)
4. [图标制作方法](#4-%E5%9B%BE%E6%A0%87%E5%88%B6%E4%BD%9C%E6%96%B9%E6%B3%95)
5. [package.json 构建配置](#5-packagejson-%E6%9E%84%E5%BB%BA%E9%85%8D%E7%BD%AE)
6. [构建命令](#6-%E6%9E%84%E5%BB%BA%E5%91%BD%E4%BB%A4)
7. [通过 GitHub 发布更新](#7-%E9%80%9A%E8%BF%87-github-%E5%8F%91%E5%B8%83%E6%9B%B4%E6%96%B0)
8. [完整发布流程（基于 GitHub）](#8-%E5%AE%8C%E6%95%B4%E5%8F%91%E5%B8%83%E6%B5%81%E7%A8%8B%EF%BC%88%E5%9F%BA%E4%BA%8E-github%EF%BC%89)

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

## 7. 通过 GitHub 发布更新

本项目使用 **GitHub Releases** 作为安装包托管；`latest.json` 可放在仓库内通过 **raw** 地址固定拉取。应用会从配置的 `{updateUrl}/latest.json` 读取清单，再按其中的直链下载各平台安装包。

### 7.1 原理说明

应用内置的更新器会向配置的 URL 发起请求：

1. 请求 `{updateUrl}/latest.json` 获取版本清单
2. 比较版本号，如果有新版本则提示用户
3. 用户点击下载后，从 `latest.json` 中记录的 URL 下载对应平台安装包
4. 下载完成后用户手动安装

GitHub Release 资源提供稳定直链（`releases/download/...`），与仓库根目录的 raw `latest.json` 搭配即可。

### 7.2 GitHub 仓库准备

1. 在 GitHub 上创建公开仓库（或使用已有仓库），例如：`jiangzhikj/ZQ-Mark`
2. 在仓库根目录维护 `latest.json`（或通过 Release 附件提供，见下文）

### 7.3 latest.json 格式

```json
{
  "version": "1.0.3",
  "notes": "- 修复了\"/\"菜单的上下箭头选择的bug\n- 优化了性能",
  "pub_date": "2026-04-03T00:00:00Z",
  "platforms": {
    "darwin-arm64": {
      "url": "https://minio-api.fuadmin.cn/zq-mark/v1.0.3/ZQ%20Mark-1.0.3-arm64.dmg",
      "size": 89000000
    },
    "darwin-x64": {
      "url": "https://minio-api.fuadmin.cn/zq-mark/v1.0.3/ZQ%20Mark-1.0.3.dmg",
      "size": 92000000
    },
    "win32-x64": {
      "url": "https://minio-api.fuadmin.cn/zq-mark/v1.0.3/ZQ%20Mark%20Setup%201.0.3.exe",
      "size": 78000000
    },
    "linux-x64": {
      "url": "https://minio-api.fuadmin.cn/zq-mark/v1.0.3/ZQ%20Mark-1.0.3-x86_64.AppImage",
      "size": 95000000
    }
  }
}
```

> **说明**：
> - `latest.json` 放在固定路径 `zq-mark/` 下，应用请求 `https://minio-api.fuadmin.cn/zq-mark/latest.json`
> - 安装包按版本号放在 `v{version}/` 目录下，`url` 指向具体版本的文件
> - 安装包同时托管在 [GitHub Releases](https://github.com/jiangzhikj/ZQ-Mark/releases) 作为备用下载源

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

### 7.5 在 GitHub 上创建 Release 的详细步骤

#### Step A：进入仓库 Releases 页面

1. 打开 GitHub 仓库页面
2. 点击右侧 **Releases**（或 **发行版**）
3. 点击 **Create a new release** / **Draft a new release**

#### Step B：填写 Release 信息

| 字段 | 说明 | 示例 |
| --- | --- | --- |
| **Choose a tag** | 版本标签，以 `v` 开头 | `v1.1.0` |
| **Release title** | 标题 | `ZQ Mark v1.1.0` |
| **Describe this release** | 更新说明（Markdown） | `- 新功能...\n- 修复...` |

#### Step C：上传附件

在 **Attach binaries** 区域上传构建产物：

1. **各平台安装包**（按需上传）：
   - `ZQ-Mark-{version}-arm64.dmg` — macOS Apple Silicon
   - `ZQ-Mark-{version}-x64.dmg` — macOS Intel
   - `ZQ-Mark-Setup-{version}-x64.exe` — Windows x64
   - `ZQ-Mark-{version}-x86_64.AppImage` — Linux x64

（可选）也可把 `latest.json` 作为 Release 资产上传；若采用下文 **方案 A**，则清单放在仓库代码里即可。

> **注意**：GitHub 对单个文件大小有上限（一般 Release 资源约 **2 GB**），通常足够覆盖安装包；若需更大对象需使用 Git LFS 等方案。

#### Step D：发布

点击 **Publish release** 完成发布。

### 7.6 获取更新地址

Release 资产直链格式为：

```
https://github.com/jiangzhikj/ZQ-Mark/releases/download/<标签名>/<文件名>
```

在 `latest.json` 的 `platforms.*.url` 中填入各平台安装包的完整直链。

若把 `latest.json` 放在 **某一 Release 的资产**里，则应用中的 **更新地址** 需指向该 Release 资产所在目录（不含文件名），例如：

```
https://github.com/jiangzhikj/ZQ-Mark/releases/download/v1.1.0
```

应用会在其后拼接 `/latest.json` 拉取清单。

> **重要提示**：每次发布若把 `latest.json` 放在带版本号的 Release 目录下，更新地址会随版本变化。**推荐方案 A**：在仓库根目录维护 `latest.json`，更新地址固定为 GitHub **raw** 根路径（应用内置默认值），仅更新仓库内 JSON 与各平台 `platforms.*.url` 指向新 Release 资产即可。

### 7.7 推荐的发布方案（方案 A 详解）

推荐使用 **MinIO 对象存储 + GitHub Release 备份**：

```plaintext
MinIO: minio-api.fuadmin.cn/zq-mark/
├── latest/
│   └── latest.json                    ← 版本清单（固定路径，每次发版覆盖更新）
├── v1.0.3/
│   ├── latest.json                    ← 该版本的清单备份
│   ├── ZQ Mark-1.0.3-arm64.dmg       ← macOS Apple Silicon
│   ├── ZQ Mark-1.0.3.dmg             ← macOS Intel
│   ├── ZQ Mark Setup 1.0.3.exe       ← Windows x64
│   └── ZQ Mark-1.0.3-x86_64.AppImage ← Linux x64
├── v1.1.0/
│   └── ...                            ← 下一个版本
└── ...

GitHub Release (备用): github.com/jiangzhikj/ZQ-Mark/releases
├── 同上安装包作为备用下载源
└── ...
```

> **关键**：应用内置的更新地址固定为 `https://minio-api.fuadmin.cn/zq-mark/latest`，每次发版只需将新的 `latest.json` 上传到 `latest/` 目录覆盖即可，代码无需修改。安装包按版本号存放在各自的 `v{version}/` 目录下。

**用户只需配置一次更新地址**（与内置默认一致时可不填）：

```
https://minio-api.fuadmin.cn/zq-mark/latest
```

`latest.json` 里各平台的 `url` 指向对应版本的 MinIO 下载直链（也可使用 GitHub Release 直链作为备用）。

### 7.8 更新流程图

```plaintext
                 应用启动
                   │
          ┌────────▼────────┐
          │ 延迟 10 秒后检查  │  （以及每 4 小时定时检查）
          └────────┬────────┘
                   │
     GET {updateUrl}/latest.json
     (从 MinIO 或 GitHub 获取)
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
   从 MinIO (或 GitHub Release) 直链
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

## 8. 完整发布流程（基于 GitHub）

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

### Step 4：在 GitHub 创建新 Release

1. 进入 GitHub 仓库 → Releases → Draft a new release
2. 填写 tag（如 `v1.1.0`）、标题与更新说明
3. 上传 `dist/` 下生成的各平台安装包作为 Release 资产
4. 点击 **Publish release**

### Step 5：上传安装包与 latest.json 到 MinIO

1. 将 `dist/` 下生成的各平台安装包上传到 MinIO 的 `zq-mark/v{version}/` 目录
2. 编辑 `latest.json`，更新版本号、说明与各平台 `url`（指向 `v{version}/` 下的文件）
3. 将 `latest.json` 上传到 MinIO 的 **`zq-mark/latest/`** 目录（覆盖旧文件）
4. （可选）同时在 `zq-mark/v{version}/` 下备份一份 `latest.json`

> 代码中的 `defaultSettings.updateUrl` 固定为 `https://minio-api.fuadmin.cn/zq-mark`，**发版时无需修改代码**。

### Step 6：验证

1. 打开旧版本应用
2. 进入 **设置 → 关于**，确认更新地址正确（默认已内置为 MinIO，一般无需改）：
   ```
   https://minio-api.fuadmin.cn/zq-mark/latest
   ```
3. 点击「检查更新」
4. 确认弹出更新对话框，显示新版本与说明
5. 点击下载，确认进度正常
6. 下载完成后点击安装，确认安装包可打开

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
xattr -cr /Applications/ZQ\ Mark.app


- **Windows**：SmartScreen 会弹出"未知发布者"警告，用户需点击"仍要运行"

当前项目未配置代码签名，更新功能采用手动安装方式（`shell.openPath`），无需签名也可正常工作。
