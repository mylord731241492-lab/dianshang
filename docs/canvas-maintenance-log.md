# 旧画布维护日志

## 维护原则

- 旧画布是当前唯一画布基线，后续只做最小修复和必要接线。
- 每次改旧画布必须写清楚：触发背景、改动文件、影响链路、验证命令、未覆盖风险。
- 如果一轮内出现临时补丁，必须在本日志记录是否保留、为什么保留、后续如何移除。
- 真实 Provider 调用、真实扣费、批量生成和破坏性数据操作，必须先由用户确认。

## 当前资产版本

| 资产 | 当前版本 | 说明 |
| --- | --- | --- |
| `assets/canvas-chat-prompt-flow.js/css` | `20260630dialogcard4` | 对话 Agent 桥接、复用快速模式消息卡片 UI、桥接卡片模式隔离、生成中进度条 |
| `assets/index-DglIsp_g.js` | `20260630dialogagent12` | 旧画布主入口缓存版本，指向会话隔离后的 Canvas chunk |
| `assets/Canvas-B8bY9_QL.js` | `20260630dialogagent9` | 旧 Canvas Chat 原生参数控件 + 三模式会话隔离 |
| `assets/Canvas-yGc8b2gf.js` | `20260630dialogagent9` | 旧 Canvas Chat 原生参数控件 + 三模式会话隔离 |
| `assets/canvas-performance-mode.js/css` | `20260629perf5` | 旧画布性能过渡层 |
| `assets/canvas-image-node-polish.js/css` | `20260629image7` | 图片节点显示与工具条 polish |
| `assets/admin-api-source-route-bridge.js` | `20260629sourceapi1` | 旧后台到源码后台桥接 |

## 不可回退护栏

- 三模式隔离是当前旧画布硬边界：`对话 / 快速 / 视频` 不能共享 `messages`、`input`、`images`、生成中状态或 `sessionId`。
- `快速` 不是 `对话 Agent`，不能为了复用实现把快速模式改成 GPT 5.5 分析链路。
- `视频` 不是图片生成占位的别名，后续接入视频 Provider 前必须单独写契约、成本规则和 smoke。
- 刷新恢复时，`source:"canvas-chat"` 只能恢复草稿到输入框，不能自动新增用户消息。
- `对话` 桥接消息卡片必须复用旧 Canvas Chat 快速模式的 `message-card / message-meta / image-grid / cost-line` 结构和 scoped 样式标记，禁止再自绘第二套卡片壳、图片网格和结果按钮视觉。
- 任何修改旧 Canvas Chat 状态管理的 PR，都必须保留 `scripts/verify-canvas-performance-assets.js` 中的会话隔离锚点，并跑旧画布边界 smoke。

## 2026-06-30 对话 Agent 与 New API 文本端点

### 触发背景

- 用户确认最新业务线：Agent 生图链路属于 `对话` 模式，不属于 `快速` 模式。
- 真实 New API 后台可看到 GPT 5.5 消费记录，但前端提示没有拿到可用提示词。
- 用户澄清问题是“没出提示词”，不是 GPT Image 2 生图失败。

### 当前实现

- `assets/canvas-chat-prompt-flow.js` 只接管旧 Canvas Chat 的 `对话` 标签发送。
- `/api/canvas/dialog-agent-generate` 先调用 GPT 5.5，再调用 GPT Image 2。
- `callProviderResponses` 在 New API 文本线路下内部改走 `/chat/completions`，并把 Responses 风格输入转为 Chat Completions `messages`。
- 普通非 New API 文本线路仍保留 `/responses` 逻辑。
- 成功结果会显示在对话中，并派发 `canvas:add-generated-image-to-canvas` 自动放入画布。

### 已确认的问题根因

- New API 的 GPT 5.5 `/responses` 对部分输入会扣费但返回 `completed + output=[]`。
- 同一路线改走 `/chat/completions` 后可从 `choices[0].message.content` 拿到文本。
- GPT 5.5 偶发输出两个 JSON 对象时，`parseJsonObjectFromText` 现在只取第一个完整 JSON 对象。

### 仍需注意

- `callProviderResponses` 名字和 New API 下实际 `/chat/completions` 行为不完全一致；目前保留函数名是为了减少调用面变更。
- `debugAnalysisOnly` 是 admin 诊断开关，只用于定位 GPT 5.5 分析阶段，不属于用户业务功能。
- 普通坏响应里目前会返回脱敏 `responseShape`，便于继续定位上游结构；生产对外开放前建议收窄到诊断模式。

## 2026-06-30 Canvas Chat 参数控件修正

### 触发背景

- 用户要求快速模式 `1张 / 1K / 1:1` 三个按钮对齐、不重叠。
- 用户要求对话模式使用与快速模式一致的三项设置控件。

### 当前实现

- `dialogagent5` 桥接层自绘控件方案已废弃。
- `dialogagent6` 改为启用旧 Canvas Chat 原生参数控件，让 `对话 / 快速 / 视频` 都渲染同一套控件。
- `dialogagent8` 用共享 flex wrap 规则统一三按钮宽度和间距。
- 桥接脚本只读取原生控件文本，不再创建第二套参数按钮。

### 后续风险

- 如继续改底部布局，优先改 `assets/canvas-chat-prompt-flow.css` 的覆盖层，不要再移动原生控件 DOM。
- 如要动 `Canvas-*.js`，只改必要渲染开关或事件监听，必须跑两个 Canvas bundle 的语法检查。

## 2026-06-30 Canvas Chat 三模式会话隔离

### 触发背景

- 用户指出 `对话 / 快速 / 视频` 三个模式不是同一个会话，切标签时不应串消息、参考图、输入框和生成状态。

### 当前实现

- 主入口版本为 `index-DglIsp_g.js?v=20260630dialogagent12`。
- 旧 Canvas chunk 版本为 `Canvas-B8bY9_QL.js?v=20260630dialogagent9` 和 `Canvas-yGc8b2gf.js?v=20260630dialogagent9`。
- `CanvasChatPanel` 内部维护按模式分桶的 `input / images / messages / sessionId`，切模式时保存旧桶并加载新桶。
- 异步生成结果不再直接写当前可见消息数组，而是通过消息 id 回写原始模式会话。
- `source:"canvas-chat"` 的草稿恢复只回到输入框，不再自动生成用户消息。

### 守护脚本

- `scripts/verify-canvas-performance-assets.js` 已增加会话隔离、输入保存和草稿恢复断言。

### 禁止回退

- 禁止把 `input / images / messages / sessionId` 合并回单个共享状态。
- 禁止只用 `mode` 字段区分 UI 文案，却复用同一份消息数组。
- 禁止在生成回调里直接写当前可见标签的消息列表。

## 2026-06-30 Canvas Chat 对话卡片 UI 复用快速模式

### 触发背景

- 用户要求 `对话` 模式消息改成与快速模式截图一致的清爽卡片 UI。
- 用户进一步指出快速模式已经有对应 CSS，不应重复造轮子。

### 当前实现

- `assets/canvas-chat-prompt-flow.js` 升级为 `20260630dialogcard1`。
- 对话桥接手工插入的用户卡片和生成结果卡片继续是 `article.message-card`，并补齐旧 `CanvasChatPanel` 的 scoped 样式标记。
- 桥接内部类改为复用旧快速模式结构：头部使用 `message-meta`，正文使用 `message-text`，图片结果使用 `image-grid`，消耗行使用 `cost-line`。
- `assets/canvas-chat-prompt-flow.css` 不再覆盖卡片壳、图片网格、结果图按钮等快速模式已有视觉，只保留对话 Agent 特有的分析提示、状态和加载态操作按钮。
- 用户卡片不再重复显示 `1张 · 1K · 1:1`，参数仍从底部旧原生控件读取并传给后端。

### 守护脚本

- `scripts/verify-canvas-performance-assets.js` 已增加 `dialogcard1` 缓存版本、scoped 样式标记、`message-meta / image-grid / cost-line` 结构和禁止回退自绘图片网格的断言。

### 验证命令

- `node --check "F:\dianshang\assets\canvas-chat-prompt-flow.js"`
- `node --check "F:\dianshang\assets\Canvas-B8bY9_QL.js"`
- `node --check "F:\dianshang\assets\Canvas-yGc8b2gf.js"`
- `node "F:\dianshang\scripts\verify-canvas-performance-assets.js"`
- `powershell -NoProfile -ExecutionPolicy Bypass -File "F:\dianshang\scripts\smoke-backend-canvas-boundary.ps1"`
- `git -C "F:\dianshang" diff --check`
- 触达文本文件 UTF-8 BOM 检查。

### 验证结果

- 上述语法检查、资产守卫和旧画布边界 smoke 均通过。
- `git diff --check` 仅提示既有 Windows LF/CRLF 转换 warning，无空白错误。
- 触达文本文件 `HasBom=false`。
- 内置浏览器刷新后确认页面加载 `/assets/canvas-chat-prompt-flow.js?v=20260630dialogcard1` 和 `/assets/canvas-chat-prompt-flow.css?v=20260630dialogcard1`；切到 `对话` 后桥接提示条正常出现，未点击发送，未触发真实 Provider。

### 禁止回退

- 禁止在 `canvas-chat-prompt-flow.css` 重新定义 `.hjm-prompt-flow-result-grid figure` 或 `.hjm-prompt-flow-images figure` 作为第二套图片网格。
- 禁止移除 `applyCanvasChatScope`，否则桥接 DOM 会吃不到旧快速模式 scoped CSS。

## 2026-06-30 Canvas Chat 对话桥接 DOM 隔离补丁

### 触发背景

- 用户复测发现：切到 `快速` 模式时，仍能看到 `对话` 桥接层直接插入的 “椒图AI 正在分析参考图和需求...” 生成卡片。
- 上一版护栏只检查了三模式 Vue 会话桶和快速模式样式复用，没有检查桥接脚本手工插入的 DOM 是否受模式隔离约束。

### 当前实现

- `assets/canvas-chat-prompt-flow.js/css` 升级为 `20260630dialogcard4`。
- 桥接插入的用户卡片和结果卡片统一增加 `hjm-prompt-flow-card` 和 `data-hjm-prompt-flow-mode="chat"`。
- 对已泄漏在页面中的旧桥接 DOM 也做兼容：没有模式标记的 `.hjm-prompt-flow-user / .hjm-prompt-flow-agent` 默认按 `chat` 处理，只允许在对话模式显示。
- 新增 `syncPromptFlowCardVisibility`：只有当前面板处于 `对话` 标签时，才显示 `data-hjm-prompt-flow-mode="chat"` 的桥接卡片。
- 面板处于非对话模式时移除 `hjm-prompt-flow-dialog-active` 状态，并把桥接卡片 `hidden=true`、`display:none`。
- CSS 增加兜底：`.canvas-chat-panel:not(.hjm-prompt-flow-dialog-active) .hjm-prompt-flow-card / .hjm-prompt-flow-user / .hjm-prompt-flow-agent { display: none !important; }`。
- 点击标签、DOM 变更和初始化延迟检查都会同步执行卡片可见性刷新。

### 守护脚本

- `scripts/verify-canvas-performance-assets.js` 已增加 `dialogcard4` 版本、`syncPromptFlowCardVisibility`、`data-hjm-prompt-flow-mode`、非对话模式 CSS 隐藏规则和桥接卡片类名断言。

### 禁止回退

- 禁止桥接层直接插入没有模式标记的卡片。
- 禁止只依赖 Vue 会话桶隔离而忽略桥接 DOM 隔离。
- 禁止让 `.hjm-prompt-flow-card` 在 `快速` 或 `视频` 模式可见。

## 2026-06-30 Canvas Chat 对话任务空状态与进度条补丁

### 触发背景

- 用户指出 `灵感不间断` 空状态应只在未开始任务时显示，生成任务开始后应消失。
- 用户要求生成过程增加进度条 UI，而不是只显示文字状态。

### 当前实现

- `assets/canvas-chat-prompt-flow.js/css` 升级为 `20260630dialogcard4`。
- `syncPromptFlowCardVisibility` 会统计当前对话模式可见桥接卡片数；只要存在桥接任务卡片，就隐藏 `.message-list > .empty-state`。
- 生成结果卡新增 `hjm-prompt-flow-progress` 进度条，分析阶段约 `18%`，进入生图阶段约 `68%`，成功或失败时更新到 `100%` 并隐藏进度条。
- 进度条为桥接层 UI 状态，不改变后端请求、不新增轮询、不触发额外 Provider 调用。

### 守护脚本

- `scripts/verify-canvas-performance-assets.js` 已增加空状态隐藏、进度条 DOM、进度条宽度更新和 CSS 动画断言。

### 验证结果

- `node --check "F:\dianshang\assets\canvas-chat-prompt-flow.js"` 通过。
- 两个旧 Canvas bundle 语法检查通过。
- `node "F:\dianshang\scripts\verify-canvas-performance-assets.js"` 通过，版本为 `dialogcard4`。
- `powershell -NoProfile -ExecutionPolicy Bypass -File "F:\dianshang\scripts\smoke-backend-canvas-boundary.ps1"` 通过，确认服务端发出 `canvas-chat-prompt-flow.js/css?v=20260630dialogcard4`。
- 浏览器刷新后确认加载 `dialogcard4` 资源；稳定重测 `快速` 模式 `bridgeTotal=0`、`bridgeVisible=0`；未点击发送，未触发真实 Provider。

### 禁止回退

- 禁止生成任务开始后仍显示 `灵感不间断` 空状态。
- 禁止把生成中状态退回纯文字提示，必须保留进度条或等价可视进度 UI。

## 2026-06-30 Packy GPT Image 2 规则落地

### 触发背景

- 用户提供 Packy GPT Image 2 技术文档，要求覆盖所有 GPT Image 2 生图接口。
- 用户明确 `1K / 2K / 4K` 是图片大小，不是质量。

### 当前实现

- `docs/provider-packy-gpt-image-2.md` 保存本地技术档案。
- `providerImageSize` 按大小档位和比例自动换算 Packy `size`。
- `providerImageQuality` 不再把 `1K / 2K / 4K` 当作 quality，默认输出 `auto`。
- `callProviderImageGeneration` 和 `callProviderImageEdit` 是所有 GPT Image 2 请求的统一适配器。
- 图生图和编辑默认 `input_fidelity=high`。

### 守护脚本

- `scripts/check-packy-gpt-image-size.js` 覆盖 39 个大小和比例换算。
- `scripts/check-packy-gpt-image-adapter-coverage.js` 防止已知入口绕过统一适配器。

## 2026-06-30 多参考图修正

### 触发背景

- 用户怀疑 GPT Image 2 没收到参考图，因为结果更像只按提示词生成。

### 当前实现

- GPT 5.5 分析阶段读取全部参考图。
- GPT Image 2 编辑阶段无 mask 时最多按顺序提交 16 张参考图。
- multipart 字段当前使用 `image[]`；带 mask 的局部重绘仍保持单图 + mask。

### 后续风险

- 如果 Packy 实测不接受 `image[]`，需要根据真实错误改为重复 `image` 字段或把字段名做成线路配置。
- 多参考图真实兼容性必须在用户确认额度后点测。

## 当前临时技术债

| 项 | 状态 | 处理建议 |
| --- | --- | --- |
| `debugAnalysisOnly` | admin 诊断入口，已脱敏，不扣本地余额 | 业务链路稳定后收窄到本地开发环境或移除 |
| `responseShape` 普通错误返回 | 便于继续定位 New API 结构 | 上线前改为只在诊断模式返回 |
| `callProviderResponses` 名称 | New API 下实际走 Chat Completions | 后端模块化时重命名为 `callProviderText` |
| 旧打包资产修补 | 当前不得继续扩大 | 仅阻塞级 bug 可短期修，复杂能力应先写边界 |
| `image[]` 多参考图字段名 | 未做真实兼容性确认 | 用户确认额度后点测，必要时配置化 |

## 下一轮修改前检查

1. 先读 `docs/canvas-maintenance-boundary.md` 和本日志。
2. 确认改动属于对话、快速、视频、图片工具、后台测试中的哪一条链路。
3. 如果要改 GPT Image 2 参数，先看 `docs/provider-packy-gpt-image-2.md`。
4. 如果要触发真实 GPT 5.5 或 GPT Image 2，先说明可能扣费并等用户确认。
5. 改完必须跑旧画布边界 smoke，并把结果写入 `docs/progress-report.md` 和 `docs/review-log.md`。
