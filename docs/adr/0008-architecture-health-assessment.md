# ADR-0008: 后端架构健康判定（2026-08-06）

## Status

Assessed（基于候选支线提交 9adb0ad / c93650a 后的工作树事实）

## 判定结论

当前后端为「**过渡期可用、亚健康偏良**」，整体评分 **B-**。最近两轮改动（瞬时错误重试落地、LibreChat 整仓移除 -8856 行）使健康度明显回升；但单体耦合、无自动化测试、配置依赖 app_state JSON 是三大主要债务。对照 AGENTS.md 门禁：Phase 3 只完成一半（契约 + 部分领域模块），Phase 4 未启动（符合门禁，未引入 Postgres/BullMQ/S3/NestJS）。

## 量化事实（提交 9adb0ad / c93650a 后）

| 指标 | 数值 | 说明 |
|------|-----:|------|
| server.js 行数 | 7586 | 单文件单体 |
| server.js 直接 SQL（db.prepare） | 122 | 路由/服务层混排 |
| server.js API 路由（app./api） | 97 | 全部注册在主文件 |
| server.js 顶层函数/常量 | 258 | 职责混合 |
| process.env 读取点 | 62 | 配置散落 |
| 数据库表定义（含 backend） | 19 | SQLite |
| backend/ 领域模块目录 | 7 | assets/prompts/generation/canvas-agent/provider/billing/agent-skills |
| backend/ 模块文件 | 23 | 已抽离 |
| server.js 引用 backend 模块 | 13 | 组合根调用 |
| 自动化单元测试文件 | 0 | 无 jest/vitest/devDependencies |
| 结构化日志/请求追踪 | 无 | console + logs/*.log 重定向 |

## 分维度健康评分

| 维度 | 评分 | 依据 |
|------|:---:|------|
| 模块化/边界 | 6/10 | 已抽 7 领域模块；但 auth/users/projects/admin/provider 主体仍在 server.js |
| 可维护性 | 4/10 | 7586 行单文件、122 处直 SQL、258 顶层函数 |
| 稳定性/可靠性 | 7.5/10 | 重试/熔断/幂等/恢复退款/余额预占已落地；mock 故障回归 6/6 |
| 可测试性 | 2/10 | 无自动化单测；仅 smoke 脚本 + 手工验证 |
| 可扩展性/生产化 | 3/10 | SQLite 单写、进程内队列、单实例 |
| 安全/配置 | 5/10 | JWT/路径越界/密钥不入库已有；无速率限制、无安全响应头、.env 全局读 |
| 契约/文档 | 8/10 | ADR 8 篇、API 契约两份、baseline/review/progress 持续更新 |
| 依赖健康 | 7/10 | 依赖精简（express/sqlite/jwt/multer/sharp/zod）；无 devDependencies |

## 主要风险（按优先级）

1. **回归风险高**：122 处直 SQL + 258 顶层函数，改一处易波及其他路由（此前删除 LibreChat 已出现误删共享状态函数并当场恢复）。
2. **回归保障弱**：无自动化测试，每次改动依赖手工 smoke；重试/计费/幂等/调度没有可重复的单测网。
3. **配置状态无 schema**：app_state JSON 承载 6+ 类配置（apiProviders/settings/templateWorkflows/modelPrices/uiPreferences），无版本、无校验、并发写可能覆盖。
4. **mock 与真实逻辑同文件**：mockMode/providerStatus/mockCanvasDialogAgentPlan 等与生产逻辑混排，ENABLE_REAL_AI 切换存在走错分支风险。
5. **生产化硬门槛**：SQLite 单写 + 进程内队列，多人/多实例前必须完成 Phase 4（Postgres/Redis/BullMQ/S3），当前未授权属合规状态。
6. **可观测性弱**：console + 文件重定向，无请求 ID、无结构化日志、无指标，排障靠 grep。

## 健康资产

- 调度器已模块化且参数可配置、snapshot() 可观测；瞬时错误重试已落地并经 mock 故障回归 6/6。
- 任务幂等、中断恢复安全退款、余额预占/结算/退款链路完整，billingAuditRequired 标记已设计。
- assets/prompts/canvas-agent/generation/billing/provider/agent-skills 7 个领域模块已抽离并有明确依赖方向。
- ADR-0002/0004/0005/0006/0007 已固化技术路线、队列、画布、资产、模块边界；LibreChat 巨型耦合已移除。
- 前端有 vue-tsc 门禁，脚本有 node --check + 多套 smoke；接口契约先行。

## 整改建议（按优先级）

1. **P0**：确认 ADR-0007，按 auth → users → projects → admin 顺序拆分 server.js；每模块 route/service/repository 三层 + 独立 commit + smoke 全绿。
2. **P0**：为核心逻辑（调度器、重试、计费、幂等、路由契约）补最小单测（node:test 即可，不新增依赖）。
3. **P1**：app_state 拆专属表（api_providers/admin_settings/template_workflows/model_prices/ui_preferences）+ 版本与校验。
4. **P1**：mock 分支隔离到独立模块，生产分支零 mock 引用。
5. **P1**：结构化日志 + 请求 ID（无第三方依赖起步）。
6. **P2（门禁）**：Phase 4 生产化（Postgres/Redis/BullMQ/S3/NestJS）按 ADR-0002/0007 门禁评估后另行确认。

## Consequences

- 本判定为评估记录，不改变代码行为；3466 候选端与生产 Docker 均不受影响。
- 下一轮若执行整改，从 P0 的 ADR-0007 确认与 auth 模块拆分开始，并每步更新本判定中的量化指标。
