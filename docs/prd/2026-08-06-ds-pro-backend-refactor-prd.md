# PRD：DS Pro 发布后后端重构（模块化 + 生产化）

> 文档类型：PRD（产品需求文档）
> 状态：Draft（等待 DS Pro 发布与用户确认）
> 日期：2026-08-06
> 分支：codex/infinite-canvas-candidate
> 关联：ADR-0002（技术栈路线）、ADR-0007（后端模块化架构，Proposed）、ADR-0008（架构健康判定 B-）

## 1. 背景与问题

当前候选端后端处于「过渡期可用、亚健康偏良」状态（ADR-0008，整体 B-）：

- `server.js` 单文件 7586 行，122 处直接 `db.prepare`，97 条 `/api` 路由与 258 个顶层函数/常量混排；
- 自动化单元测试为 0，回归依赖手工 smoke；
- `app_state` JSON 承载 6+ 类配置（apiProviders/settings/templateWorkflows/modelPrices/uiPreferences），无 schema、无版本、并发写可能覆盖；
- mock 与生产逻辑同文件；无结构化日志/请求 ID；
- SQLite 单写 + 进程内队列，多人/多实例前必须完成 Phase 4（Postgres/Redis/BullMQ/S3）。

已有架构设计（ADR-0007 Proposed）但尚未拆分。用户决定：**等 DS Pro 发布后，用更强的模型能力执行这次重构**，先把 PRD 定稿。

## 2. 触发条件（本 PRD 生效前提）

- DS Pro 版本正式发布，且本地/中转可用（用户确认）；
- 用户明确说「开始重构」（按 PRD 执行），本 PRD 由 Draft 转为 Approved；
- 在此之前不拆 server.js、不动 Phase 4 基础设施（与 AGENTS.md 门禁一致）。

## 3. 目标（重构完成时应有）

1. `server.js` 瘦身为组合根（中间件/路由注册/SPA fallback/静态），主体逻辑迁入 `backend/*` 领域模块。
2. 领域模块边界明确：auth / users / projects / generation / billing / assets / prompts / canvas-agent / provider / admin / infra（依赖方向：infra ← routes ← services ← repositories ← db）。
3. 数据访问层统一：路由处理器无直接 SQL；repository 接口承载全部 SQL。
4. `app_state` 拆为专属表（ui_preferences / api_providers / template_workflows / model_prices / admin_settings），带版本与校验。
5. mock 与生产逻辑隔离，生产分支零 mock 引用。
6. 核心逻辑（调度器、重试、计费、幂等、路由契约）有自动化单测（node:test 起步，不新增依赖）。
7. 结构化日志 + 请求 ID。
8. Phase 4 生产化路径明确（Postgres + Redis/BullMQ + S3 兼容存储），经用户确认后按门禁执行。

## 4. 非目标（明确不做）

- 不重写画布、不迁移 Infinite Canvas 节点体系、不引入新画布引擎；
- 不重造模型网关/Token 分发/账号池（继续复用 New-API/CPA）；
- 不在本 PRD 内做 UI 重构或新增业务功能；
- 不引入 Kubernetes/微服务；
- 不删除历史 docs（LibreChat 等历史记录保留）。

## 5. 范围与里程碑

### M0：准备（DS Pro 发布前可做）

- 固化 API 契约基线（docs/api-contracts.md + api-contract-next.md 已存在，补全 auth/users/projects/admin 响应字段）；
- 建立后端 smoke 基线（node --check + scripts/smoke-api-disposable.ps1 + 关键接口清单），保证每步拆分前后行为等价；
- 选定拆分顺序与提交粒度（每模块一个 commit）。

### M1：auth + users 模块拆分

- 抽取 AUTH 段（登录/注册/JWT/邮箱码/管理员引导）与 USER 段（资料/头像/兑换码/余额日志）到 backend/auth、backend/users；
- 每步：只搬代码不换行为 → node --check + smoke 全绿 → commit。

### M2：projects + admin 模块拆分

- 抽取 PROJECTS/CANVAS + WORKFLOWS 段与 ADMIN 段；
- 路由处理器无直接 SQL 验收。

### M3：数据层加固

- app_state 拆专属表 + 迁移脚本（SQLite 兼容迁移先行，双跑对比后切换）；
- mock 分支隔离；结构化日志 + 请求 ID。

### M4：测试网

- 调度器、重试、计费、幂等、路由契约的最小单测（node:test）；
- 把现有 mock 故障注入回归固化为可重复测试。

### M5：Phase 4 生产化（需用户单独确认）

- Postgres/MySQL、Redis/BullMQ、S3 兼容存储按 ADR-0002/0007 门禁评估；
- 数据迁移演练（含回滚）→ 双跑对比 → 生产验收点。

## 6. 验收标准（DS Pro 重构完成后）

1. server.js ≤ 1500 行，且不含业务 SQL 与业务路由注册（仅组合根 + 兼容转发）；
2. `rg "db.prepare" server.js` = 0，全部收敛到 backend/*/repository.js；
3. 全部 /api 路径、方法、状态码、响应字段与重构前契约一致（smoke + 契约快照比对）；
4. 核心单测全部通过（含瞬时错误重试、计费预占/退款、任务幂等、调度 snapshot 等价）；
5. mock 故障注入回归固化为自动化测试且通过；
6. app_state 旧键读取兼容（迁移后老数据可读），新表带版本校验；
7. 3466 候选端全链路冒烟通过；生产 Docker 未动或按门禁另行重建。

## 7. 风险与应对

- **拆分破坏行为**：每模块独立 commit + smoke 全绿才继续；行为差异回退该步。
- **DS Pro 未发布/能力不达预期**：PRD 不失效，M0 准备可先做；触发点延后。
- **计费模糊性**：500/超时重试已带 billingAuditRequired 标记；生产化前补对账与审计报表。
- **数据迁移风险**：app_state 拆表与 Postgres 迁移均演练 + 回滚 + 双跑。

## 8. 待用户确认事项

1. 「DS Pro」指哪个产品/版本？（假设：DeepSeek Pro 或指定模型的 Pro 版本）
2. M0 准备是否现在就开始（不依赖 DS Pro 发布）？
3. 拆分顺序 auth → users → projects → admin 是否认可？
4. 单测用 node:test（零依赖）是否认可？
5. 生产化（Phase 4）是否仍按 ADR-0002 保持 Postgres 优先？

