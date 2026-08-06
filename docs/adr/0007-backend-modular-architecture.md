# ADR-0007: 后端模块化与生产化架构设计

## Status

Proposed（待用户确认后按 Phase 3 门禁逐步执行；确认前不拆分 server.js）

## Context

- 2026-08-06 候选支线 `codex/infinite-canvas-candidate` 已完成：桥豆式重试稳定化（`7831bab`）、LibreChat 后台整仓移除（`9adb0ad`）。当前 `server.js` 仍有约 7586 行，按注释段分为 DATA / PROVIDER ADAPTER / AUTH / PUBLIC / USER / PROJECTS·CANVAS / UPLOAD / AI GENERATION / WORKFLOWS / ADMIN / API GUARDS / SPA FALLBACK / START。
- 已开始模块化：`backend/` 下已有 `assets`（object-storage/asset-repository/service/routes）、`prompts`、`generation`（task-repository + generation-task-service）、`canvas-agent`（runtime-service/session-repository/provider-planner/site-tools/tool-contracts/routes）、`provider`（image-request-scheduler + image-provider-diagnostics）、`billing`（generation-billing）、`agent-skills`。
- 数据库仍为 SQLite：`users/email_codes/balance_logs/projects/generations/redeem_codes/app_state/chat_text_charges/chat_text_steps` + `generation_tasks/items/attempts` + 云端资产表；`app_state` 以 JSON 键值对承载 apiProviders、settings、templateWorkflows、modelPrices、uiPreferences 等。
- 约束（AGENTS.md）：Phase 3 = API 契约与后端模块边界，先写契约和边界，不直接推倒 server.js；Phase 4 = 生产基础设施（NestJS、Prisma、Postgres/MySQL、Redis/BullMQ、MinIO/S3）进入前必须先完成方案、环境确认和迁移验收点；禁止在模块边界确认前拆分 server.js；禁止自研已由 New-API/CPA 覆盖的模型网关、Token 分发和账号池。

## Decision

把后端按「Express 兼容组合根 + 领域模块 + Provider 适配层 + 数据访问层」四层组织，模块边界与 API 契约一一对应；拆分过程只搬代码不换行为，每步一提交并用现有 smoke 全量验证。

### 目标模块图

```text
frontend(Vue SPA) / canvas(React) + 外部集成
                  │ HTTP /api/*
                  ▼
server.js（组合根：中间件、路由注册、SPA fallback、静态）
                  │
  ┌───────────────┴───────────────────────────────┐
  │ 业务服务层（用例 + 领域规则）                 │
  │ auth / users / projects / generation /        │
  │ billing / assets / prompts / canvas-agent /   │
  │ admin / agent-skills                          │
  └───────────────┬───────────────────────────────┘
                  │
  ┌───────────────┴───────────────────────────────┐
  │ Provider 适配层（线路/模型/重试/熔断/计费标记）│
  │ New-API -> CPA/上游；官转/直连 agent 池        │
  └───────────────┬───────────────────────────────┘
                  │
  ┌───────────────┴──────────┐   ┌──────────────────┐
  │ 数据访问层（repository） │   │ 对象存储（S3 兼容）│
  │ SQLite 现状 → Postgres   │   │ MinIO / 云 S3      │
  └──────────────────────────┘   └──────────────────┘
```

### 模块边界（Phase 3 拆分子目标）

| 模块 | 现有代码来源 | 职责 | 关键接口（路径前缀） |
|------|------------|------|---------------------|
| auth | server.js AUTH 段 | 登录/注册/JWT/邮箱码/管理员引导 | /api/auth/*、/api/admin/login |
| users | USER 段 | 资料/头像/兑换码/余额日志 | /api/user/profile|redeem|avatar|balance-logs |
| projects | PROJECTS/CANVAS + WORKFLOWS 段 | 项目 CRUD + workflow 文件 | /api/user/projects、/api/settings/canvas-storage |
| generation | 已抽 backend/generation + server.js 残留 | 持久任务/调度/幂等/恢复 | /api/generate/*、/api/template/generate-image、/api/image-tools/* |
| billing | 已抽 backend/billing + chat_text_charges 段 | 预占/结算/退款/审计 | generation_billing、chat_text_charges/steps |
| assets | 已抽 backend/assets | 云端资产/签名 URL/对象存储 | /api/user/assets*、/api/asset-content/* |
| prompts | 已抽 backend/prompts | 系统/用户提示词 | /api/prompts/*、/api/user/prompts/* |
| canvas-agent | 已抽 backend/canvas-agent + dialog-agent 残留 | 画布对话/电商套件/工具 | /api/canvas/*、/api/canvas/ecommerce-suite/* |
| provider | 已抽 backend/provider + server.js ADAPTER 段 | 线路/模型/上游请求/重试/熔断 | provider 适配层（无 HTTP 出口） |
| admin | ADMIN 段 | 后台 CRUD/任务监控/设置 | /api/admin/* |
| infra | 各段公共部分 | 鉴权中间件/错误处理/限流/SPA fallback/静态 | Express 中间件 |

依赖方向固定：infra ← routes ← services ← repositories ← db；provider 只被 generation/canvas-agent/prompts 服务层调用，禁止路由直连 provider。

### 数据层目标

- 用 repository 接口封装全部 SQL（`backend/*/repository.js` 模式），server.js 内的 `db.prepare` 逐步消除；验收点：路由处理器无直接 SQL。
- `app_state` 按领域拆为专属表：ui_preferences、api_providers、template_workflows、model_prices、admin_settings（现状为 JSON 键，先保持读写兼容，迁移时建新表回填）。
- 生产化（Phase 4）以 Postgres 优先，Prisma/Drizzle 定义 schema；SQLite 兼容迁移先行，双跑对比后切换；环境与数据迁移必须经用户确认。

### 任务编排目标

- 现状：GenerationTaskService + ImageRequestScheduler 进程内 bounded-fair 队列（全局/域名/用户并发、启动间隔、熔断、请求级重试、任务幂等与恢复退款）。
- 目标：把「并发上限、用户配额、幂等键、重试/退款语义」固化为编排契约；生产化时队列后端替换为 Redis/BullMQ，AI Worker 独立进程复用同一 provider 适配层；验收点：调度器 snapshot() 字段等价、任务幂等/恢复行为等价、环境变量驱动的并发参数不变。

### API 契约策略

- 以 `docs/api-contracts.md`、`docs/api-contract-next.md` 为准；模块拆分不改变路径、方法、状态码、响应字段。
- 每拆一个模块：routes.js 只做参数解析与调用 service；旧 smoke（scripts/smoke-api-disposable.ps1 等）全绿后才允许提交。

## 生产化前置门禁（Phase 4）

- Postgres/MySQL、Redis/BullMQ、MinIO/S3、NestJS 进入前依次完成：方案评审 → 用户环境确认 → 数据迁移演练（含回滚）→ 双跑对比 → 生产验收点记录。
- 不提前引入新依赖；不把新功能写进旧 assets/*.js 或 server.js（仅阻塞级 bug 可短修）。

## 风险

- 拆模块破坏现有行为：每步跑 node --check + 接口冒烟 + smoke-api-disposable；发现行为差异回退该步。
- SQLite 单写限制：内网单机阶段维持；多人/多实例前必须切 Postgres。
- 计费模糊性（500/超时重试）：已带 billingAuditRequired 标记，生产化前补对账任务与审计报表。
- 正式生产（192.168.0.39:3456 Docker）不受本 ADR 影响；候选支线验证通过后另行走 Docker 重建流程。

## Consequences

- 拆分过程中 docs/current-baseline.md、progress-report.md、review-log.md 每轮更新；每模块拆完登记 api-contracts 状态。
- 用户确认本 ADR 后，按 auth → users → projects → admin 顺序逐个抽取（每个模块独立 commit + smoke），再处理 server.js 残留的 canvas-agent/provider 代码收敛。
