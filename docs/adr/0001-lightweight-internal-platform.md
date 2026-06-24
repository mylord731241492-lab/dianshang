# ADR-0001: 7 月前采用轻量内网平台架构

## Status

Accepted

## Context

当前项目是打包后的 Vue 前端资产、Express 后端和 SQLite 本地数据库。目标是在 7 月前完成公司内网或单服务器可部署版本，同时保留后续扩展到多人协作、真实 AI 网关、计费和任务队列的空间。

当前约束：

- 前端没有完整源码，短期以打包资产小补丁和兼容接口为主。
- 先做公司内网测试，跑稳后再部署到服务器，暂不按公开 SaaS 峰值并发设计。
- 真实 AI、支付、邮件、存储不能默认启用，避免误扣费和误调用。
- New-API 与 CPA 已有成熟开源能力，本项目不重复实现通用 AI 网关、员工 token 分发、额度统计或 CLI OAuth 账号池。
- 画布当前保持本地优先，依赖浏览器本地存储、本地文件夹授权和 JSON 导入/导出；服务器端本阶段不强制接管画布 JSON。

## Decision

7 月前采用轻量平台版：

```text
Docker Compose / PM2
  ↓
Express 一体服务
  ├─ 静态前端资产
  ├─ /api/* 后端接口
  ├─ SQLite 持久化
  └─ Provider Adapter → New-API → CPA/上游模型
```

本阶段不引入 Postgres、Redis、BullMQ、独立 AI Worker 和微服务拆分。`server.js` 可以继续按清晰区块维护，后续在接口稳定后再低风险拆模块。

New-API 作为默认真实 AI 网关；CPA 只作为 New-API 后置渠道，不直接暴露给前端、员工或本平台用户。

部署采用两段式：

1. 内网测试：mock 默认可跑通，按需配置 New-API，重点验证页面、后台、模板、图库、SQLite 持久化和重启恢复。
2. 服务器部署：内网测试稳定后，再补齐 `.env` 密钥、Nginx/HTTPS、备份恢复、访问权限和真实 New-API 联通。

## Consequences

### Positive

- 7 月前部署路径短，`npm start`、PM2 或 Docker Compose 都能承载。
- 无真实 key 时 mock 可跑通，适合前端 1:1 和内部流程验收。
- SQLite、uploads、logs 可通过 Docker volume 持久化，满足小范围内网试用。
- New-API/CPA 职责边界清晰，不重复造轮子。
- 后续迁移 Postgres/Redis/Worker 时，Provider Adapter 和业务接口路径可以保持稳定。

### Negative

- SQLite 不适合高并发、多实例和强计费一致性场景。
- 单进程 Express 内执行生成任务时，长耗时任务会限制并发能力。
- 打包前端资产维护成本高，复杂 UI 改动不如源码级稳定。

### Neutral

- 本阶段的 Billing 只做业务层记录和余额护栏，底层模型额度仍由 New-API 管理。
- 画布本地 JSON 不作为服务器持久化阻塞项；后续如要团队协同画布，再单独立项做服务端项目存储。
- 真正公司多人规模化前，需要另起迁移阶段：Postgres、Redis、BullMQ、AI Worker、对象存储、统一日志和监控。

## Alternatives Considered

**一步到位：Postgres + Redis + BullMQ + Worker + New-API + CPA**

- 暂不采用：生产架构更完整，但会显著拉长 7 月前内网部署时间；当前前端 1:1、接口契约和部署基础还在收敛。

**只用 CLIProxyAPI，不加 New-API**

- 暂不采用：CPA 更适合底层账号池和协议转换，不适合直接承担公司多人 token、额度、模型白名单、统计和审计入口。

**接入 Open WebUI 作为核心**

- 暂不采用：Open WebUI 更偏通用聊天/模型界面，本项目核心是电商画布、模板、图库、后台和业务流程，短期不纳入核心架构。

**重写完整前端源码**

- 暂不采用：当前目标是本地克隆可验收和可部署，缺源码时大重写风险高，先维护构建资产和兼容层。

## References

- `docs/deployment.md`
- `docs/architecture-newapi-cpa.md`
- `docs/backend-maintenance.md`
- `docs/feature-completion-checklist.md`
- `docs/progress-report.md`
