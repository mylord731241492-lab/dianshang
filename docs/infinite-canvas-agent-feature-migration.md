# Infinite Canvas Agent 功能迁移门禁

> 状态：`ready-for-human`
>
> 最后更新：2026-07-29
>
> 适用工作树：`F:\dianshang-worktrees\infinite-canvas-candidate`
>
> 当前候选提交：`4fbe705 fix: keep candidate login on infinite canvas`

## 1. 用户最新目标

用户已明确：本次重点是把 GitHub 原版 Infinite Canvas 的功能迁移到哈吉米候选画布，而不是只保留画布外壳、再用功能更少的业务聊天面板替换原版 Agent。

允许改变品牌、登录方式、后端接口和内部实现，但不能因为“业务化”而静默删除原版核心功能。验收以用户可以完成的操作和数据结果为准，不要求逐行保留上游实现。

因此：

- Task 13 自动化通过只证明已有候选范围通过，不证明 Agent 功能迁移完成。
- Task 14 人工验收暂缓。
- 必须先完成本文定义的 `Task 13A：Agent 功能等价迁移`。
- 未通过 Task 13A 前，不得进入 Task 15–17，不得替换正式 3456 的唯一 `/canvas`。

## 2. 事实基线

### 2.1 对比对象

- GitHub 原版：`basketikun/infinite-canvas` tag `v0.10.0`
- 上游提交：`a0287a5e346e219bd488d084295542213912d816`
- 原版本地预览：`F:\dianshang-worktrees\infinite-canvas-preview`
- 哈吉米候选：`F:\dianshang-worktrees\infinite-canvas-candidate`
- 候选运行入口：`http://127.0.0.1:3466/canvas`
- 原版对照入口：`http://127.0.0.1:3467/canvas/{projectId}`

### 2.2 当前候选进度

- Task 1–12 已提交。
- Task 13 隔离 Compose、API/UI smoke、性能样本和跨用户隔离已经通过。
- Task 14 首轮人工对比发现 Agent 能力没有按“功能迁移”目标验收。
- 正式 3456 没有因本候选工作而重建或切换。
- 3466 固定使用 Mock/Fake Provider 和隔离数据，当前结果不能证明真实 Agent、真实中转或真实扣费链路可用。

### 2.3 Task 10 的历史偏差

原计划 Task 10 写的是“替换上游 Agent 面板”，并明确删除本地 Codex Agent 连接。对应提交：

```text
fee1146 feat: replace local canvas agent with site workflows
```

该提交删除了：

- `components/canvas/canvas-local-agent-panel.tsx`
- `components/canvas/canvas-agent-chat-ui.tsx`
- `lib/agent/agent-site-tools.ts`

并把 `stores/use-agent-store.ts` 缩减为面板开合、宽度、提示词草稿和画布桥接上下文。

这符合旧计划，但不符合用户 2026-07-29 再次明确的“主要做功能迁移”目标。后续不得把 `fee1146` 的完成状态直接当作 Agent 迁移完成。

如需查看删除前实现，不要从过期 CodeGraph 结果推断，使用 Git 固定版本：

```powershell
git -C "F:\dianshang-worktrees\infinite-canvas-candidate" show "fee1146^:integrations/infinite-canvas/web/src/components/canvas/canvas-local-agent-panel.tsx"
git -C "F:\dianshang-worktrees\infinite-canvas-candidate" show "fee1146^:integrations/infinite-canvas/web/src/components/canvas/canvas-agent-chat-ui.tsx"
git -C "F:\dianshang-worktrees\infinite-canvas-candidate" show "fee1146^:integrations/infinite-canvas/web/src/lib/agent/agent-site-tools.ts"
```

当前 CodeGraph 仍可能列出已经被 `fee1146` 删除的文件，属于索引滞后；以 `git ls-files` 和实际文件系统为准。

## 3. 功能差异矩阵

状态定义：

- `已保留`：当前代码和已有测试都存在。
- `部分`：存在基础结构，但没有覆盖原版完整用户路径。
- `缺失`：原版有，候选当前没有等价能力。
- `待实测`：代码入口存在，但 Mock 环境不能证明真实链路。

| 原版 Agent 能力 | 哈吉米候选现状 | 状态 | 是否阻断 |
| --- | --- | :---: | :---: |
| 多轮对话与流式工作状态 | 三模式助手有消息和生成状态，但不是原版 Agent 生命周期 | 部分 | 是 |
| 读取当前项目、节点、连线、选区和视口 | `CanvasAgentSnapshot` 与 bridge 保留 | 已保留 | 是 |
| 新建、更新、删除、移动、缩放节点 | `CanvasAgentOp` 保留增删改和部分布局指令 | 部分 | 是 |
| 连接节点、选择节点、调整视口 | `connect_nodes/select_nodes/set_viewport` 已存在 | 已保留 | 是 |
| 触发文本、图片、视频、音频生成 | 当前统一为 `run_generation`，真实后端能力不完整 | 部分 | 是 |
| 为写操作显示待确认卡片 | 原版有 `confirmTools`、批准和拒绝；候选界面没有 | 缺失 | 是 |
| 拒绝工具后保证画布不变 | 当前没有用户可见的拒绝链路 | 缺失 | 是 |
| 工具执行结果和失败回传对话 | 当前响应可带 `ops`，但缺少完整工具生命周期 UI | 部分 | 是 |
| 图片附件发送 | 原版最多 6 张、总负载 28 MiB；候选有参考资源但交互不同 | 部分 | 是 |
| 引用已选、已连接或点名节点 | `canvas-resource-references.ts` 已支持图、视频、音频、文本上下文 | 已保留 | 是 |
| 停止正在运行的 Agent turn | 原版有 interrupt；候选没有等价停止入口 | 缺失 | 是 |
| 新建、恢复、删除历史会话 | 项目信封保存 `chatSessions/activeChatId`，但无完整历史管理 UI | 部分 | 是 |
| 连接、工具调用、错误事件日志 | 原版有日志页；候选没有用户可见诊断日志 | 缺失 | 是 |
| 连接状态和断线恢复 | 原版 Local Agent 有 SSE 重连；候选改成同源 HTTP，仍需定义请求恢复 | 部分 | 是 |
| 画布项目查询 | 原版站点工具 `canvas_list_projects` 已随文件删除 | 缺失 | 是 |
| 生成任务状态查询 | 原版站点工具 `generation_get_status` 已删除；候选另有任务 API | 部分 | 是 |
| 提示词搜索 | 原版 `prompts_search` 被删除；候选有云端提示词库但未纳入 Agent 工具 | 部分 | 是 |
| 素材查询和添加 | 原版 `assets_list/assets_add` 被删除；候选有账号素材 API 但未纳入 Agent 工具 | 部分 | 是 |
| 生图工作台配置和生成 | 原版有读取配置和触发工具；候选快速生图为独立模式 | 部分 | 是 |
| 视频工作台配置和生成 | 候选后端没有正式契约时应明确禁用，不得伪装完成 | 缺失 | 否 |
| 对话、快速生图、电商套图 | 候选新增三模式和账号业务链路 | 已保留 | 是 |
| 账号项目、素材、提示词和任务隔离 | Task 5–13 已有 API 与跨用户 smoke | 已保留 | 是 |
| 本地 Codex URL、Token、插件和 MCP 配置页 | 已按旧计划删除 | 缺失 | 见下文 |

## 4. 迁移边界

### 4.1 固定为网页版多用户 Agent

用户明确要把画布做成给其他人登录使用的网页版，因此禁止把原版的本地部署方式原样带入候选：

- 不依赖用户电脑安装 Codex、Claude Code、MCP 或 `@basketikun/canvas-agent`。
- 不连接用户电脑的 `127.0.0.1`。
- 不向普通用户显示 Local URL、Connect token 或 Codex 插件配置。
- 不在浏览器保存或直连 Lingsuan/其他 Provider Key。

必须复用的是 Infinite Canvas 原版 `canvas-agent` 的 MCP 画布工具、工具 schema、浏览器执行语义和写操作确认体验，不使用 `hajimi-website` 生图 MCP 代替画布 MCP。原版 `canvas-agent/src/agents.ts` 写死的 `codex app-server --stdio` 模型驱动不进入网页版。

目标链路：

```text
登录用户的 /canvas 浏览器
  -> 认证后的画布 Agent 会话（userId + projectId + browserSessionId）
  -> 服务端 Agent Runtime
  -> 服务端 Lingsuan 文本路线
  -> Infinite Canvas MCP 工具调用
  -> 写操作返回浏览器等待用户确认
  -> 浏览器使用原版画布 bridge 执行
  -> 工具结果返回 Agent，继续当前对话
```

后端可以把 Infinite Canvas MCP 工具转换为 Lingsuan 支持的 function/tool schema；Lingsuan 不需要原生连接 MCP，但服务端 Agent Runtime 必须负责工具发现、调用、结果续接、停止和流式事件。优先复用项目已存在的成熟服务端 Agent/MCP Runtime，不新造模型网关。

最终必须达到以下用户结果：

- Agent 能读懂当前画布上下文。
- Agent 能提出结构化画布操作。
- 用户能在写操作前查看、批准或拒绝。
- 执行结果、失败和退款状态能回到同一对话。
- 对话能停止、恢复、删除和刷新后继续。
- 原版站点级工具通过现有项目、任务、提示词和素材 API 获得等价实现。
- 业务三模式继续隔离，不能因恢复 Agent 功能而串 session、参考图或 taskId。

网页版会话必须按 `userId + projectId + agentSessionId + browserSessionId` 隔离。服务器不能沿用原版进程级全局 `codexThreadId/codexQueue`；同一用户多标签页、不同用户和不同项目不得互相接收工具调用或事件。

### 4.2 不在本门禁内

- 不要求恢复上游插件市场。
- 不恢复本地 Codex/Claude Code 驱动。
- 不恢复 Local URL、Connect token 或本机 Origin 白名单。
- 不要求恢复上游独立首页、图片台或视频台。
- 不要求恢复浏览器直连 Provider。
- 不要求在 Task 13A 调用真实 Provider 或产生费用。
- 不允许为了补 Agent 功能绕过现有任务、计费、退款、资产归属和同源 API。

## 5. Task 13A 实施清单

执行时使用 `Code`、`executing-plans` 和 `tdd` 技能，先补失败测试，再做最小实现。不要直接开始 Task 14。

### 13A.1 固定能力契约和测试夹具

- 从 `fee1146^` 和上游 v0.10.0 提取原版 Agent 用户能力清单。
- 从上游 `canvas-agent/src/mcp-server.ts`、`tools.ts`、`schemas.ts`、`canvas-session.ts` 提取并复用画布 MCP 契约；`agents.ts` 的本地 Codex 驱动只作反例，不迁入网页版运行路径。
- 为请求、流式事件或轮询事件、工具提案、确认、拒绝、执行结果、错误、停止和会话历史定义 TypeScript 契约。
- 契约只描述认证后的同源接口，不复制浏览器直连 Provider、本地 Agent URL 或永久连接密钥。
- 增加至少一份“原版输入意图 → 候选预期操作”的固定 fixture。

### 13A.1A 建立服务端多用户会话代理

- 浏览器登录后为当前项目创建短期 `agentSessionId/browserSessionId`。
- 使用经过认证的 SSE 或 WebSocket 传递流式回复、工具提案、确认结果、停止和执行结果。
- 每次工具调用在服务器校验用户、项目、会话、调用 ID 和允许的工具 schema。
- 浏览器断开、退出登录、401、切换账号或项目时立即注销执行通道。
- 会话与事件持久化不得只放进单个 Node 进程内存；至少保证刷新恢复和进程重启后的安全终态。

验收：

- 功能矩阵中的每个阻断项至少对应一个自动化用例。
- 测试先能证明当前候选缺失，再开始实现。

### 13A.2 恢复工具生命周期

实现统一状态机：

```text
用户消息
  -> Agent 分析
  -> 工具提案
  -> 等待确认（写操作）
  -> 批准或拒绝
  -> 执行
  -> 结果/错误回传
  -> Agent 最终回复
```

要求：

- 读操作可自动执行。
- 新建、更新、删除、移动、缩放、连线、触发生成等写操作默认要求确认。
- 拒绝后节点、连线、视口、任务和余额均不得变化。
- 同一个工具调用必须有稳定 ID，重复确认不得重复执行。
- 触发生图继续走持久任务、幂等、计费和退款链路。

### 13A.3 补齐画布工具

至少覆盖：

- 读取画布、选区和项目摘要。
- 创建文本、图片引用、生成配置和流程节点。
- 更新节点内容、标题、位置和尺寸。
- 删除节点和连线。
- 连接节点、选择节点和设置视口。
- 触发已有后端支持的文本/图片生成。
- 查询当前生成任务状态。

不得把 `applyCanvasAgentOps` 的存在当作完成；必须从自然语言请求一直验收到画布状态变化。

### 13A.4 补齐站点工具

用现有哈吉米 API 重做原版站点工具的等价能力：

- 项目列表与打开项目。
- 生成任务状态查询。
- 系统/个人提示词搜索。
- 账号素材列表、搜索和插入。
- 生图路线、模型和参数读取。
- 创建生图任务。

候选不得重新使用上游浏览器本地 Store 作为账号数据事实源。

### 13A.5 补齐会话、停止和诊断

- 新建、切换、恢复和删除会话。
- 刷新后恢复当前会话。
- 停止正在分析或等待中的请求。
- 显示最少可用的事件记录：请求开始、工具提案、批准、拒绝、执行成功、执行失败、任务 ID、退款状态。
- 日志必须脱敏，不显示 Token、API Key、密码、对象存储密钥或完整授权头。

### 13A.6 保持三模式和账号隔离

- 对话、快速生图、电商套图继续使用独立消息、草稿、引用、sessionId 和 taskId。
- Agent 历史必须绑定 `userId + projectId`。
- 切换账号或 401 后清空内存态，不显示上一账号会话、素材或提示词。
- 异步完成写回创建任务时的账号、项目和模式。

## 6. 自动化验收

在原 Task 13 smoke 基础上新增 Agent 专项。至少覆盖：

1. “创建两个文本节点并连接”会产生待确认提案；批准后节点和连线出现。
2. 同一确认请求重复提交只执行一次。
3. “删除选中节点”被拒绝后，项目 envelope 逐字段不变。
4. 修改节点标题、内容、位置和尺寸后可撤销，刷新后状态一致。
5. 选择一张图片并要求创建图生图流程，引用关系正确且项目 JSON 无 `data:image/`、`blob:`。
6. Agent 可以搜索账号素材和提示词，但用户 A 不能读取用户 B 的数据。
7. Agent 触发 Fake Provider 生图后显示 taskId、终态和账务状态；失败路径显示退款。
8. 请求进行中点击停止，不再继续应用后续写操作。
9. 新建两个会话，刷新、恢复和删除均正确。
10. 日志能定位工具失败，但不包含敏感字段。
11. 三模式快速切换时，消息、引用、sessionId 和 taskId 不串写。
12. 浏览器控制台零错误，意外 HTTP 4xx/5xx 为零。
13. 用户 A、用户 B 并发对话时，工具提案、事件和执行结果不串用户或项目。
14. 同一用户打开两个项目标签页时，工具调用只投递到创建该 `browserSessionId` 的标签页。
15. 伪造、过期或已退出登录的 Agent 会话不能读取画布、确认工具或继续接收事件。

必须继续运行：

```powershell
node --check "F:\dianshang-worktrees\infinite-canvas-candidate\server.js"
npm run typecheck --prefix "F:\dianshang-worktrees\infinite-canvas-candidate\integrations\infinite-canvas\web"
npm run build --prefix "F:\dianshang-worktrees\infinite-canvas-candidate\integrations\infinite-canvas\web"
powershell -NoProfile -ExecutionPolicy Bypass -File "F:\dianshang-worktrees\infinite-canvas-candidate\scripts\smoke-infinite-canvas-candidate.ps1" -Port 3466
git -C "F:\dianshang-worktrees\infinite-canvas-candidate" diff --check
```

测试保持：

- `ENABLE_REAL_AI=false`
- `ENABLE_REAL_STORAGE=false`
- `ENABLE_REAL_EMAIL=false`
- `ENABLE_REAL_PAYMENT=false`
- 仅绑定 `127.0.0.1:3466`
- 正式 3456 容器指纹前后不变

## 7. 人工 A/B 验收

Task 13A 自动化通过后，同时打开原版 3467 和候选 3466，对同一组指令逐项比较：

1. 创建两个文本节点并连接。
2. 修改选中节点的标题、内容、位置和尺寸。
3. 请求删除节点，先拒绝一次，再批准一次。
4. 上传或引用一张图片，创建图生图流程。
5. 查询项目、素材、提示词和生成任务。
6. 发起一个 Mock 生图任务并查看完成/失败信息。
7. 在运行中停止一次请求。
8. 新建会话、刷新、恢复并删除会话。
9. 查看一次成功工具和一次失败工具的诊断记录。
10. 切换对话、快速生图、电商套图，确认状态不串。

允许 UI 文案和布局不同；不允许候选无法完成原版可完成的核心操作，也不允许以“后端已经有 API”代替页面端完整路径。

## 8. 完成定义

只有同时满足以下条件，才能把 Task 13A 标记为 `done`：

- 本文所有阻断矩阵项变为“已保留”或由用户书面批准降级。
- Agent 专项自动化和原 Task 13 全量回归通过。
- 3466 与 3467 的人工 A/B 清单通过。
- 账号隔离、项目持久化、工具确认、幂等和退款没有回退。
- 正式 3456 未被修改。
- `docs/current-baseline.md`、`docs/infinite-canvas-candidate-acceptance.md`、`docs/progress-report.md` 和 `docs/review-log.md` 已更新。
- 用户明确同意重新进入 Task 14 人工门禁。

### 2026-07-29 实施结果

Task 13A 的代码实现和自动化门禁已完成，当前等待用户做最后人工调试和 3466/3467 A/B，不据此宣称 Task 13A 全部 `done`。

- 已完成服务端持久会话、事件流、提案确认/拒绝、重复确认幂等、停止、重启安全收敛和敏感日志脱敏。
- 已完成 Agent 面板、会话新建/切换/恢复/删除、写操作确认卡片、画布执行回传和同源鉴权 SSE。
- 已完成画布读写工具、站点项目/素材/提示词/模型/任务工具，以及持久生图任务桥接。
- 自动化覆盖后端 18 项、前端契约 4 项，并通过原 Task 13 候选 API/UI smoke。
- Playwright 已从自然语言走通创建两个文本节点并连接、确认、自动保存、刷新恢复和服务端执行历史恢复。
- 自动化全程使用 Fake Provider 和隔离数据，没有真实付费调用；正式 3456 指纹未变化。

待人工完成：

1. 在 3466 与 3467 执行第 7 节同指令 A/B。
2. 用用户实际灵算配置做单笔、明确授权的 Agent 生图验证。
3. 记录最终 UI 修改项和需要新增的节点类型；这些不在本轮自动扩展。
4. 用户确认后再把 Task 13A 标记为 `done` 并重新进入 Task 14。

## 9. 相关源码入口

当前候选：

- `integrations/infinite-canvas/web/src/components/hajimi/hjm-canvas-assistant-panel.tsx`
- `integrations/infinite-canvas/web/src/integrations/hajimi/canvas-assistant-api.ts`
- `integrations/infinite-canvas/web/src/integrations/hajimi/canvas-assistant-api.test.ts`
- `integrations/infinite-canvas/web/src/lib/canvas/canvas-agent-ops.ts`
- `integrations/infinite-canvas/web/src/lib/canvas/canvas-resource-references.ts`
- `integrations/infinite-canvas/web/src/pages/canvas/hooks/use-agent-bridge.ts`
- `integrations/infinite-canvas/web/src/stores/use-agent-store.ts`
- `integrations/infinite-canvas/web/src/stores/canvas/use-canvas-store.ts`

原版参考：

- `fee1146^:integrations/infinite-canvas/web/src/components/canvas/canvas-local-agent-panel.tsx`
- `fee1146^:integrations/infinite-canvas/web/src/components/canvas/canvas-agent-chat-ui.tsx`
- `fee1146^:integrations/infinite-canvas/web/src/lib/agent/agent-site-tools.ts`

总计划和验收：

- `docs/plans/2026-07-27-infinite-canvas-staged-replacement.md`
- `docs/infinite-canvas-candidate-acceptance.md`
- `docs/adr/0005-infinite-canvas-atomic-replacement.md`
