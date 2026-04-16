# Teams Cache Exporter

这是一个面向 `Microsoft Teams Web v2` 的小工具，用来导出**当前打开的聊天**，并把浏览器本地缓存里的消息整理成更适合阅读和处理的格式。

适合这些场景：

- 学校或工作账号没有官方自助导出入口
- 普通插件只能抓到当前页面上已经渲染出来的少量消息
- 需要把聊天记录整理成 `JSON / CSV / Markdown`

## 主要功能

- 只导出当前打开的 Teams 聊天
- 直接读取浏览器本地 `IndexedDB` 缓存
- 扩展里可直接选择导出格式
- 可选隐藏系统消息
- 可选附带原始缓存导出
- 自动生成可读版 `JSON / CSV / Markdown`

## 目录结构

```text
teams-cache-exporter/
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

在 Chrome 或 Edge 里：

1. 打开 `chrome://extensions/` 或 `edge://extensions/`
2. 开启 `Developer mode`
3. 点击 `Load unpacked`
4. 选择：

   `teams-cache-exporter/extension`

### 2. 导出当前聊天

1. 打开 `https://teams.microsoft.com/v2/`
2. 点进你要导出的那个聊天
3. 点击浏览器右上角扩展图标
4. 打开 `Teams Cache Exporter`
5. 勾选你要的输出格式：
   - `Cleaned JSON`
   - `CSV for Excel`
   - `Markdown transcript`
6. 可选勾选：
   - `Hide system messages`
   - `Include raw cache dump`
7. 点击 `Export current chat`

扩展会自动下载你选中的文件。

## 脚本模式

### 浏览器端原始导出

如果你不想用扩展，也可以直接在 Teams 页面控制台里运行：

`scripts/browser/export-current-chat-idb.js`

它会导出当前聊天的原始缓存 JSON。

### Node.js 清洗

要求：

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

## 清洗器会做什么

- 把毫秒时间戳转成 ISO 和本地时间
- 把 Teams 的 HTML 内容转成纯文本
- 把常见系统消息转成人能直接看懂的文本
- 提取回复预览
- 生成参与者摘要和消息类型统计
- 导出 CSV 方便 Excel 打开
- 导出 Markdown transcript 方便阅读和分享

## 当前扩展版的体验增强

- 会记住上次选择的导出选项
- 再次打开弹窗时会保留上一次的状态结果
- 如果 Teams 标签页里还没注入脚本，弹窗会自动补注入

## 限制

- 只能导出当前浏览器本地缓存里已经有的数据
- 某些参与者如果名字没有缓存到，本工具仍可能显示成 `8:orgid:...`
- 这不是微软官方导出路径
- 请只在你的学校、公司或组织政策允许的前提下使用

## 仓库建议

- 不要默认提交个人聊天导出文件
- 推荐把导出结果放进 `exports/` 并通过 `.gitignore` 忽略
- 如果要上商店，先补齐截图、支持链接和隐私政策页面

## 商店准备

如果你准备上 Chrome Web Store 或 Edge Add-ons，先看：

- `docs/privacy-policy.md`
- `docs/store-readiness.md`
