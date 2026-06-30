# 旧画布维护日志

## 维护原则

- 旧画布是当前唯一画布基线，后续只做最小修复和必要接线。
- 每次改旧画布必须写清楚：触发背景、改动文件、影响链路、验证命令、未覆盖风险。
- 如果一轮内出现临时补丁，必须在本日志记录是否保留、为什么保留、后续如何移除。
- 真实 Provider 调用、真实扣费、批量生成和破坏性数据操作，必须先由用户确认。

## 当前资产版本

| 资产 | 当前版本 | 说明 |
| --- | --- | --- |
| `assets/canvas-chat-prompt-flow.js/css` | `20260630dialogagent9` | 对话 Agent 桥接、New API GPT 5.5 文本端点修复 |
| `assets/Canvas-B8bY9_QL.js` | `20260630dialogagent6` | 旧 Canvas Chat 原生参数控件在三种模式渲染 |
| `assets/Canvas-yGc8b2gf.js` | `20260630dialogagent6` | 旧 Canvas Chat 原生参数控件在三种模式渲染 |
| `assets/canvas-performance-mode.js/css` | `20260629perf5` | 旧画布性能过渡层 |
| `assets/canvas-image-node-polish.js/css` | `20260629image7` | 图片节点显示与工具条 polish |
| `assets/admin-api-source-route-bridge.js` | `20260629sourceapi1` | 旧后台到源码后台桥接 |

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
