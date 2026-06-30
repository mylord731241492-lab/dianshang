# ADR-0002: 源码优先技术栈与补救路线

## Status

Accepted

## Context

当前项目已经能以内网轻量版运行，但维护形态存在明显风险：

- 前端主要是打包后的 Vue 资产，复杂 UI 改动只能通过 `assets/*.js`、bridge 脚本和 override CSS 修补。
- 后端集中在单文件 `server.js`，接口、数据访问、Provider Adapter、后台管理和 mock 逻辑耦合较高。
- SQLite 适合当前内网验证，不适合后续多人、多实例、真实计费和长耗时任务。
- New-API/CPA 已覆盖通用 AI 网关、模型渠道、Token、额度和底层账号池，本项目不应重复实现这些基础设施。

视频参考中的方案是源码型全栈：前端保留 `frontend/src/*`，后端按模型和视图组织，数据库与后台管理自然挂接。它的核心价值不是 Django 或 MySQL 本身，而是“源码、模型、接口、后台、数据库迁移”有稳定边界。

## Decision

本项目正式路线采用“双轨补救”：

```text
当前内网过渡栈
  Vue 打包资产 + Express + better-sqlite3 + SQLite + Mock/New-API Adapter

正式源码目标栈
  Vue 3 + Vite + TypeScript
  Vue Router + Pinia + Axios/TanStack Query
  Naive UI + Vue Flow
  Node.js + TypeScript API
  Express 兼容层逐步模块化，后续可迁 NestJS
  Prisma 或 Drizzle
  Postgres 优先，MySQL 可作为部署方偏好替代
  Redis + BullMQ + AI Worker
  S3 兼容对象存储
  New-API -> CPA/上游模型
```

本阶段不把后端立即切换到 Django。Django Admin 的后台效率很高，但当前仓库已有 Express API、Node smoke 脚本、Docker 验收和 New-API Adapter，直接换栈会把已经验证的路径打断。后续如后台 CRUD 需求大幅增加，可以评估 AdminJS、Directus、Strapi 或独立 Django 管理服务，但不作为当前核心栈。

## Immediate Remediation

从本 ADR 生效后，新增需求优先按以下规则处理：

1. 不再把大规模前端功能直接写进打包产物。`assets/*.js` 只允许做阻塞级 bug 修复或短期兼容。
2. 所有新业务接口先写入 API 契约，再实现后端；接口路径尽量保留现有 `/api/*`，避免打断当前前端。
3. 新增后端能力按模块边界组织：`auth`、`user`、`projects`、`generation`、`gallery`、`admin`、`provider`、`billing`。
4. 真实 AI、邮件、支付、对象存储和任务队列必须默认关闭或 mock 回落，直到对应验收通过。
5. 对 bridge、override、compat 字段建立迁移清单；后续源码前端重建时逐项内化，不继续无限堆叠。

## Migration Phases

### Phase 0: 当前止血

- 保留 `server.js` 路由行为和 SQLite。
- 固化 API 契约、mock 边界、New-API/CPA 边界。
- 禁止继续无计划修改大块打包 JS。
- 新增文档和测试护栏，确保已有内网版本可继续验收。

### Phase 1: 后端模块化

- 在不改接口路径的前提下拆分 `server.js`。
- 抽出 Provider Adapter、鉴权、数据库访问、余额流水、生成记录、后台配置。
- 为后续 TypeScript 化做边界准备。

### Phase 2: 前端源码重建

- 新建 `frontend/` 源码工程。
- 以现有页面为验收基准，逐页重建：首页、模板、图库、用户中心、画布、后台。
- bridge/override 的行为必须迁入源码组件、store 或 API client。
- 每迁一页保留截图和 smoke 证据。

### Phase 3: 生产基础设施

- SQLite 迁移到 Postgres 或 MySQL。
- 引入 Redis、BullMQ、AI Worker。
- 本地 uploads 迁移到 S3 兼容对象存储。
- 加入数据库迁移、备份恢复、日志审计、Nginx/HTTPS 和访问控制。

## Consequences

### Positive

- 当前内网可运行成果不会被推倒。
- 后续补救方向明确，避免继续在打包产物上无序修补。
- 技术栈与当前 Vue/Node 资产连续，迁移风险小于立即切 Django。
- 后续多人、计费、任务队列和真实 AI 有清晰升级路径。

### Negative

- 短期仍要背负打包前端资产和单文件后端的维护成本。
- 前端源码重建不是小改动，需要独立排期和逐页验收。
- Postgres/MySQL、Redis、Worker、对象存储不会立刻带来收益，只有进入多人和真实计费阶段才值得引入。

## Non-Goals

- 不在当前阶段重写完整前端。
- 不在当前阶段把 Express 全量迁移 Django。
- 不在当前阶段自研 New-API/CPA 已覆盖的通用网关、账号池、Token 分发和模型渠道管理。
- 不为未验证的公开 SaaS 峰值并发提前引入 Kubernetes 或微服务拆分。
