# ZQ Mark 安装文档

本文档说明：**从源码安装与运行**、**构建安装包**，以及 **draw.io（diagrams.net）可选插件** 的清单地址、校验、发布路径与本地目录。

---

## 1. 环境与依赖

- **Node.js** ≥ 18  
- **npm** ≥ 9  

---

## 2. 克隆与本地运行

```bash
git clone https://github.com/your-username/zq-md.git
cd zq-md
npm install
npm run dev
```

- 纯 Web 预览：`npm run dev:web`  
- 其他脚本见根目录 [`package.json`](../package.json) 的 `scripts` 字段。

---

## 3. 构建安装包

```bash
npm run build:mac      # macOS（arm64 + x64）
npm run build:mac-arm64
npm run build:mac-x64
npm run build:win
npm run build:linux
npm run build:all
```

产物输出至 **`dist/`**。更完整的发布流程（`latest.json`、GitHub Release、MinIO 等）见 **[发布与更新指南](./release-guide.md)**。

---

## 4. draw.io 可选插件（diagrams.net）

### 4.1 终端用户

- 安装包**默认不包含** draw.io 静态资源（减小体积）。  
- 在应用内打开 **偏好设置 → 插件**，下载并安装后即可插入、编辑流程图。  
- **网页版**不支持该插件（仅桌面端）。

### 4.2 清单地址与 zip 下载

应用使用与「检查应用更新」相同的 **`updateUrl`**（偏好设置中的 **更新服务器地址**；内置默认示例：`https://minio-api.fuadmin.cn/zq-mark`）。

| 用途 | URL 规则 |
| --- | --- |
| **插件清单** | `{updateUrl 去尾斜杠}/plugins/drawio/manifest.json` |
| **zip 包** | 由清单中的 **`zipUrl`** 指定（必须为 **`https://`** 直链） |

示例（默认基址下）：

- 清单：`https://minio-api.fuadmin.cn/zq-mark/plugins/drawio/manifest.json`  
- zip：由清单字段 `zipUrl` 指向，例如 `https://minio-api.fuadmin.cn/zq-mark/plugins/drawio/drawio-1.0.0.zip`  

### 4.3 `manifest.json` 字段

| 字段 | 必填 | 说明 |
| --- | --- | --- |
| `version` | 是 | 插件包版本（展示用） |
| `zipUrl` | 是 | zip 的 **HTTPS** 直链 |
| `sha256` | 是 | 对整个 zip 文件的 SHA-256（十六进制，校验下载完整性） |
| `size` | 否 | zip 字节数，用于下载进度估算 |
| `minAppVersion` | 否 | 最低应用版本；当前应用版本低于此则拒绝安装 |
| `notes` | 否 | 说明文字（应用安装逻辑可不解析） |

清单与 `zipUrl` 均须通过 **HTTPS** 提供。

### 4.4 仓库内模板与当前校验值

仓库中维护的清单模板路径：

- **[`resources/plugins/drawio/manifest.json`](../resources/plugins/drawio/manifest.json)**  

对应的源 zip（用于打包上传，**不**随应用安装包分发）：

- **[`resources/drawio-1.0.0.zip`](../resources/drawio-1.0.0.zip)**  

当前与上述 zip 一致的校验值（若更换 zip 后需重算，见 **§4.6**）：

| 字段 | 值 |
| --- | --- |
| `sha256` | `2a7b6919a4c38d7b8950d850a922a52fb98b7bab4cdcf5745e594dbacb415ac7` |
| `size` | `53521578`（字节，约 51 MB） |

清单正文示例（与仓库文件一致，发布时以仓库内文件为准）：

```json
{
  "version": "1.0.0",
  "zipUrl": "https://minio-api.fuadmin.cn/zq-mark/plugins/drawio/drawio-1.0.0.zip",
  "sha256": "2a7b6919a4c38d7b8950d850a922a52fb98b7bab4cdcf5745e594dbacb415ac7",
  "size": 53521578,
  "minAppVersion": "1.0.4",
  "notes": "diagrams.net webapp；对应仓库内 resources/drawio-1.0.0.zip（解压后含单层 drawio/ 目录）"
}
```

### 4.5 发布方上传路径（示例）

对象存储（如 MinIO）上与 `zipUrl`、清单 URL 一致的路径示例：

- `zq-mark/plugins/drawio/manifest.json`  
- `zq-mark/plugins/drawio/drawio-1.0.0.zip`  

将仓库中的 `manifest.json` 与 zip 上传至上述路径（或你自定义的 HTTPS 域名，并同步修改清单中的 `zipUrl`）。

### 4.6 更新 zip 后重新计算校验

在仓库根目录执行：

```bash
npm run hash:drawio
```

默认对 **`resources/drawio-1.0.0.zip`** 计算 `sha256` 与 `size`；也可传入其他路径：

```bash
node scripts/hash-drawio-zip.mjs /path/to/your.zip
```

将命令输出的 `sha256`、`size` 写回 `resources/plugins/drawio/manifest.json` 后再上传。

### 4.7 安装包与本地路径

- **`resources/drawio-*.zip`**：在 [`package.json`](../package.json) 的 `build.files` 中已排除，**不会**打进 Electron 安装包，仅作发布到 CDN 的源文件。  
- **用户安装后的插件目录**（应用运行时）：  
  - `{userData}/plugins/drawio/`  
  - 其中 `userData` 为 Electron 的用户数据目录（各系统路径因 `app.getName()` 而异，例如 macOS 常见为 `~/Library/Application Support/zq-mark/`）。  
  - 内含 `index.html`（及解压后的 `js/`、`styles/` 等）与版本文件 `.zq-drawio-version`。  
- **临时解压目录**：`{userData}/plugins/.drawio-install-staging/`（安装完成后会删除）。

zip 内容要求：解压后根目录有 **`index.html`**，或**仅一层子目录**内含 `index.html`（例如 `drawio/index.html`）。

### 4.8 开发环境

若未在插件中心安装，本地开发时主进程仍会尝试使用仓库内的 **`resources/drawio/`**（若存在），便于无网调试。

---

## 5. 相关文档

| 文档 | 说明 |
| --- | --- |
| [发布与更新指南](./release-guide.md) | `latest.json`、GitHub Release、MinIO 目录与完整发版流程 |
| [README](../README.md) | 项目特性、技术栈与结构概览 |
