# 旧画布维护边界

## 当前基线

- 唯一画布入口：`/canvas` 和 `/canvas/:projectId`。
- 运行时资产：`assets/Canvas-B8bY9_QL.js`、`assets/Canvas-yGc8b2gf.js`、`assets/Canvas-*.css`。
- 允许的过渡层：`assets/canvas-performance-mode.*`、`assets/canvas-image-node-polish.*`、`assets/canvas-chat-prompt-flow.*`。
- 后端边界：继续在 `server.js` 现有 `/api/*` 上做最小兼容，不在本轮拆分后端模块。
- 新前端关系：`frontend/` 只负责源码页和旧画布跳转；禁止继续在 `frontend/` 内开发新画布。

## Canvas Chat 三模式硬护栏

- `对话 / 快速 / 视频` 必须是三套独立会话，不允许共享同一份消息列表、输入框草稿、参考图列表、生成中状态或 `sessionId`。
- 切换模式时必须先保存当前模式状态，再加载目标模式状态；不能只切 `mode` 字段后继续渲染同一个 `messages/images/input` 引用。
- 生成任务、轮询任务和回调必须按任务创建时的原始模式回写，不能写入用户当前可见模式。
- `对话` 模式可以走 GPT 5.5 分析 + GPT Image 2 生图；`快速` 模式不能被改成对话 Agent 链路；`视频` 模式当前只允许作为“电商套图 Agent”入口，不能复用快速或对话的发送链路。
- `source:"canvas-chat"` 的未发送草稿只能恢复到输入框，不能刷新后自动转成一条用户消息。
- 如需改动上述隔离机制，必须先更新本文件、`docs/canvas-maintenance-log.md` 和 `scripts/verify-canvas-performance-assets.js` 的守护断言，并重新跑旧画布边界 smoke。

## 生产链路

### 对话模式

- 入口：旧 Canvas Chat 的 `对话` 标签。
- 前端桥接：`assets/canvas-chat-prompt-flow.js`，当前版本 `20260701suite15`。
- 后端接口：`POST /api/canvas/dialog-agent-generate`。
- 编排流程：参考图和用户需求 -> GPT 5.5 分析 -> `analysisSummary/finalPrompt` -> GPT Image 2 生图 -> 对话结果卡 -> 自动落到画布。
- 文本线路：New API 网关下 GPT 5.5 使用 `/chat/completions`，不是 `/responses`。
- 生图线路：有参考图走 `callProviderImageEdit`，无参考图走 `callProviderImageGeneration`。
- 成本规则：分析成本 + 图片成本 x 张数；端到端成功后扣本地余额；分析失败或生图失败不扣本地余额。

### 快速模式

- 入口：旧 Canvas Chat 的 `快速` 标签。
- 业务语义：直接快速生图，不走 GPT 5.5 分析。
- 后端入口：继续沿用 `/api/generate/tasks` 的普通图片任务语义。
- 参数来源：使用旧 Canvas Chat 原生设置控件，不在桥接层重造控件。
- 会话边界：只读取快速模式自己的输入、参考图、消息和生成状态，不继承对话或视频模式状态。

### 视频模式 / 电商套图 Agent

- 入口：旧 Canvas Chat 的 `视频` 标签。
- 当前边界：第三个标签承载电商套图 Agent，对话形态不变，不切独立表单页，不改主画布 bundle。
- 前端桥接：仍使用 `assets/canvas-chat-prompt-flow.js/css`，只在 `isSuiteMode(panel)` 命中 `视频 / 电商套图Agent` 时插入产品图、参考图和 skill 选择。
- 工作链路：产品图必填，参考图可多张；先调用 `/api/canvas/ecommerce-suite/prompts`，由 GPT 根据当前 skill、产品图、参考图和用户需求动态生成本次板块提示词，再由用户勾选/编辑板块后调用 `/api/canvas/ecommerce-suite/generate` 生图。
- 板块边界：后台不维护固定“首屏/卖点/效果/科技/场景”模板集合；`/api/canvas/ecommerce-suite/config` 对前台暴露 `sectionMode:"dynamic"` 和空 `sections`，禁止前端默认发送固定 `sectionKeys`。
- 后端边界：套图链路可以通过 `callProviderResponses` 生成提示词，并通过 `callProviderImageEdit` 或 `callProviderImageGeneration` 生图；不得绕过统一 Provider Adapter。
- 会话边界：不得读取或污染 `对话 / 快速` 的消息、输入框草稿、参考图、参数控件状态；发送按钮分支必须保持 `对话 -> handleSubmit`、`视频 -> handleSuiteSubmit`、其他模式放行。

### 提示词草稿接口

- `/api/canvas/generate-prompt` 是历史提示词草稿入口。
- 当前主业务线已切到对话 Agent 生图；不要再把该接口当作对话模式主链路。
- 如后续要恢复“只出提示词”模式，必须先确认新的产品边界，再改前端入口文案和 smoke。

## GPT Image 2 统一适配器

- 所有 GPT Image 2 文生图必须通过 `callProviderImageGeneration`。
- 所有 GPT Image 2 图生图、图片编辑、局部修改必须通过 `callProviderImageEdit`。
- 禁止业务入口直接拼 `/images/generations` 或 `/images/edits` 上游请求。
- 已知覆盖入口：
  - Canvas Chat 对话 Agent：`/api/canvas/dialog-agent-generate`
  - 快速生图任务：`/api/generate/tasks`
  - 模板生图：`/api/template/generate-image`
  - 图片工具：`/api/image-tools/outpaint`、`/api/image-tools/inpaint`、`/api/image-tools/erase`
  - 后台 Provider 测试：`/api/admin/api-providers/:id/test`

## GPT Image 2 参数规则

- UI 的 `1K / 2K / 4K` 表示图片大小档位，不是 Packy `quality`。
- 后端按 `图片大小档位 + 比例` 自动换算 Packy `size`，比例菜单覆盖 `1:1 / 2:3 / 3:2 / 3:4 / 4:3 / 4:5 / 5:4 / 9:16 / 16:9 / 1:2 / 2:1 / 9:21 / 21:9`。
- Packy `quality` 默认使用 `auto`；只有明确传入 `low / medium / high / auto` 时才作为质量参数。
- Packy 编辑接口上游 `n` 固定为 `1`；多张结果由后端循环请求。
- 图生图和编辑默认发送 `input_fidelity=high`，优先保留参考图主体、包装结构和细节。
- 输出统一倾向：`output_format=png`、`response_format=url`。
- Packy 技术档案见 `docs/provider-packy-gpt-image-2.md`。

## 允许改动

- 修复旧画布阻塞级 bug。
- 调整旧画布桥接层样式、缓存版本和小范围 DOM 接线。
- 在 `server.js` 现有 Provider Adapter 内补齐参数映射、返回解析和边界错误。
- 增加不会触发真实付费调用的 smoke、静态检查和文档。
- 更新 `docs/progress-report.md`、`docs/review-log.md`、`docs/feature-completion-checklist.md` 和本文件。

## 谨慎改动

- 直接修改 `assets/Canvas-B8bY9_QL.js` 或 `assets/Canvas-yGc8b2gf.js`。
- 调整 Canvas Chat 三个标签的 DOM 结构和状态隔离。
- 修改 `/api/generate/tasks` 普通快速生图语义。
- 修改 GPT Image 2 多参考图字段名，目前使用 `image[]`。
- 调整真实 Provider 超时、扣费、重试和上游请求次数。

## 禁止改动

- 继续开发 Vue Flow 新画布或 Infinite-Canvas 迁移。
- 新增第二套画布拖拽、连线、缩放、小地图和视口系统。
- 在桥接层重造快速模式已有参数控件。
- 新增独立的 `canvas-ecommerce-suite-agent.js/css` 或独立套图工作台。
- 绕过 `callProviderImageGeneration` / `callProviderImageEdit` 直连 GPT Image 2。
- 未经用户确认触发真实付费批量测试。
- 未记录 API 契约就新增重要生图接口。

## 每次改旧画布后的检查

```powershell
node --check "F:\dianshang\server.js"
node --check "F:\dianshang\assets\canvas-chat-prompt-flow.js"
node "F:\dianshang\scripts\verify-canvas-performance-assets.js"
node "F:\dianshang\scripts\check-packy-gpt-image-size.js"
node "F:\dianshang\scripts\check-packy-gpt-image-adapter-coverage.js"
node "F:\dianshang\scripts\check-provider-text-extraction.js"
powershell -NoProfile -ExecutionPolicy Bypass -File "F:\dianshang\scripts\smoke-backend-canvas-boundary.ps1"
git -C "F:\dianshang" diff --check
```

如改动 `assets/Canvas-*.js`，还必须额外运行：

```powershell
node --check "F:\dianshang\assets\Canvas-B8bY9_QL.js"
node --check "F:\dianshang\assets\Canvas-yGc8b2gf.js"
node "F:\dianshang\scripts\verify-canvas-performance-assets.js"
```

真实 GPT 5.5 或 GPT Image 2 点测会产生上游请求和可能扣费，必须先获得用户确认。
