# ADR-0004：单机持久生图队列与预占账务

## 状态

Accepted

## 背景

当前生图入口直接依赖进程内任务状态和各自的 Provider 调用流程。多用户同时提交时，旧实现无法在进程重启后恢复排队任务，也缺少统一的用户公平性、失败域限流、幂等提交和预占账务。两条名称不同但共同指向 `lingsuan.top` 的线路还可能被误认为两个独立并发通道。

本阶段目标是让 10 名登录用户可以同时提交并稳定排队，不等同于同时向上游发送 10 个付费请求。Docker、正式 `3456`、真实 Provider、Redis、BullMQ、Postgres 和新 npm 依赖均不在本次变更范围。

## 决策

- 保留 `server.js` 作为 Express 兼容入口，将持久任务、调度和账务能力放入 `backend/generation/`、`backend/provider/` 与 `backend/billing/`。
- SQLite 是任务事实源，新增 `generation_tasks`、`generation_task_items`、`generation_task_attempts`。进程内 Worker 只负责领取和执行，不作为任务唯一存储。
- 创建任务与余额预占在一个 SQLite 事务中完成。成功按完成图片数结算，失败或取消按未完成图片退款；任务级唯一索引与条件更新保证预占、结算和退款至多一次。
- `Idempotency-Key` 或 `clientRequestId` 在“当前用户 + 幂等键”范围内去重。相同请求返回原任务，不同请求复用同一键返回 `409`。
- 默认全局 Provider 并发为 3，同一失败域并发为 1，同一用户运行中为 1；每用户最多 3 个非终态任务，全站最多 30 个非终态任务。
- 失败域由规范化 Provider 主机和 API 格式共同确定。共享 `lingsuan.top` 与相同格式的线路共用失败域。
- 批量任务每完成一张后重新进入公平队列，调度器优先选择最久未获得执行机会的用户。
- 连续 3 次瞬态网络失败后，失败域熔断 60 秒。只允许明确发生在 TLS 建立或请求体发送前的安全重试，普通歧义断连不自动重放，也不自动切换线路。
- 重启时恢复 `pending`；原 `running` 任务以 `WORKER_INTERRUPTED_UNKNOWN` 失败并退款，不自动重放可能已经触达上游的付费请求。
- 参考图写入独立任务目录，数据库只保存路径和脱敏元数据。限制为最多 4 张、单张 5 MiB、合计 16 MiB，请求体 24 MiB；超过 24 小时的任务输入目录由启动清理和每小时清理回收。
- `/api/generate/tasks`、模板生图与 Chat/MCP 生图复用同一持久任务服务。其他兼容图片工具继续共用同一个有界 Provider 调度器。

## 兼容性

- 保留 `/api/*` 路径和 `pending/running/success/failed`；新增 `cancelled`。
- 部分成功对旧客户端仍映射为 `success`，通过 `partial=true`、`warnings` 和实际 `settledCost` 表达。
- 旧客户端仍可读取 `progress`，但画布只展示真实阶段：排队、连接、上游生成、保存结果，不再启动合成的 90% 进度动画。
- `POST /api/template/generate-image` 在兼容等待窗口内仍返回同步结果；任务超过等待窗口时返回可轮询的异步任务响应。

## 后续迁移

`GenerationTaskService` 与 `ImageRequestScheduler` 的接口保留“任务事实源”和“执行器”分离。进入多实例阶段后，可用 Postgres/MySQL 替换 SQLite，用 Redis/BullMQ 替换进程内调度器，而不改变现有 API 和账务状态机。

## 非目标

- 不在本阶段支持多实例抢占或分布式锁。
- 不保证上游 Provider 自身可用，只保证本地排队、幂等、限流、取消、恢复和账务一致。
- 不在未获单独确认时执行真实 Provider 付费测试；不发布或重建 Docker。

## 2026-07-23 补充决策：Provider 自适应降载与人工重试

5 笔真实 Lingsuan 4K 图生图出现 3 成功、1 次 `skipped_mainline=true` 和 1 次 HTTP 524。连接均已建立且没有 TLS 重试，说明只限制“同域并发为 1”仍不足以处理上游处理阶段抖动。

- 同失败域默认至少间隔 5 秒启动请求；该间隔可配置，测试环境可显式设为 0。
- 除连续 3 次瞬态失败外，增加最近最多 5 次中出现至少 2 次瞬态失败的滑动窗口熔断；不要求先积满 5 个样本。
- `skipped_mainline` 单次触发至少 60 秒冷却，HTTP 524 单次触发至少 120 秒冷却；冷却只延迟后续任务，不重放当前任务。
- 只持久化允许列表中的 `CF-Ray`、`Retry-After`、Provider 请求号和 Server 头，不记录 Authorization、Cookie 或完整响应头。
- 本地失败任务仍按账务状态机退款；HTTP 524、`skipped_mainline`、请求超时等可能已经触达上游的结果额外记录 `providerBillingStatus=unknown`、`upstreamBillingAmbiguous=true` 和 `billingAuditRequired=true`。
- 运行中取消、进程中断、上游空结果或结果落盘失败同样视为可能已触达上游，必须持久化计费歧义并要求人工重试前确认。
- 人工重试通过 `POST /api/generate/tasks/:id/retry` 创建新任务。存在上游计费歧义时，调用方必须显式确认风险；不自动切换线路，不复用旧幂等键，原任务保持不可变。
