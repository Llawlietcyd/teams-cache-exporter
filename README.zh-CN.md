# Teams 聊天导出工具箱

这是一个面向 `Microsoft Teams Web v2` 的小工具集，用来导出**当前打开的聊天**，并把本地缓存里的消息整理成更适合阅读和处理的格式。

它适合以下场景：

- 学校或工作租户没有官方自助导出入口
- 浏览器插件或页面导出经常不完整
- 需要把聊天记录整理成 `JSON / CSV / Markdown`

## 功能概览

这个工具包含两种使用方式：

1. `浏览器扩展`
   低门槛。打开当前聊天后，点击扩展按钮即可导出。
2. `脚本模式`
   包含浏览器端原始导出脚本和 Node.js 清洗脚本，适合调试和二次开发。

## 目录结构

```text
teams-chat-export-toolkit/
  README.md
  README.zh-CN.md
  package.json
  LICENSE
  docs/
    privacy-policy.md
    store-readiness.md
  extension/
    manifest.json
    popup.html
    popup.css
    popup.js
    background.js
    content.js
    icons/
  scripts/
    browser/
      export-current-chat-idb.js
    node/
      clean-export.js
```

## 最简单的使用方式：扩展模式

### 1. 加载扩展

在 Chrome 或 Edge 中：

1. 打开 `chrome://extensions/` 或 `edge://extensions/`
2. 开启 `Developer mode`
3. 点击 `Load unpacked`
4. 选择：

   `teams-chat-export-toolkit/extension`

### 2. 导出当前聊天

1. 打开 `https://teams.microsoft.com/v2/`
2. 点进你要导出的聊天
3. 点击浏览器右上角扩展图标
4. 打开 `Teams Cache Exporter`
5. 点击 `Export current chat`

可选项：

- `Include raw cache dump`
  会额外下载原始缓存 JSON，适合调试或做进一步分析

### 3. 生成的文件

扩展会自动下载：

- `*.cleaned.json`
- `*.cleaned.csv`
- `*.transcript.md`
- 可选：`*.raw.json`

## 脚本模式

### 浏览器端原始导出

如果你不想用扩展，也可以直接在 Teams 页面控制台里运行：

`scripts/browser/export-current-chat-idb.js`

它会导出当前聊天的原始缓存 JSON。

### Node.js 清洗

安装要求：

- Node.js `18+`

示例：

```powershell
npm run clean -- --input "..\Stepsafe Tech team_idb_2026-04-15.json"
```

可选参数：

```powershell
npm run clean -- --input "..\Stepsafe Tech team_idb_2026-04-15.json" --outdir ".\exports"
npm run clean -- --input "..\Stepsafe Tech team_idb_2026-04-15.json" --basename "stepsafe-tech-team"
npm run clean -- --input "..\Stepsafe Tech team_idb_2026-04-15.json" --drop-system
```

## 清洗器做了什么

- 把毫秒级时间戳转成 ISO 和本地时间
- 把 Teams 的 HTML 内容转成纯文本
- 把常见系统消息转成人能读懂的文本
- 提取回复预览
- 生成参与者摘要和消息类型统计
- 导出 CSV 方便 Excel 打开
- 导出 Markdown transcript 方便阅读和分享

## 局限

- 它只能导出**当前浏览器本地缓存里已经有的聊天数据**
- 如果某些参与者名字没有缓存到，本工具可能仍然显示为 `8:orgid:...`
- 这不是微软官方导出方案
- 请只在你的学校、公司或组织政策允许的前提下使用

## GitHub 发布建议

- 建议把这个工具目录单独做成一个仓库
- 不要默认提交个人聊天导出文件
- 推荐把导出结果放进 `exports/`，并用 `.gitignore` 忽略

## 商店上架建议

如果想尝试上 Chrome Web Store / Edge Add-ons，可以先看：

- `docs/privacy-policy.md`
- `docs/store-readiness.md`

这两个文件是为了提前准备上架需要的说明材料。
