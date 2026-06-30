# 后端模块边界初版

本文件只定义边界，不执行拆分。当前 `server.js` 继续作为可运行基线，后续迁移到 NestJS 或 TypeScript 模块时必须保持 `/api/*` 契约兼容。

## 目标架构

```text
NestJS API Server
  ├─ auth
  ├─ users
  ├─ projects
  ├─ canvas
  ├─ template
  ├─ gallery
  ├─ generation
  ├─ provider
  ├─ admin
  └─ billing
```

当前阶段不得创建 NestJS 工程；先完成契约、边界和验收点。

## auth

- 负责：注册、登录、管理员登录、验证码、重置密码、JWT 签发与校验、RBAC。
- 当前路由：`/api/auth/*`、`/api/admin/login`。
- 数据：`users`，后续可拆 `email_codes`。
- 迁移风险：旧前端依赖 `token/user`，管理员和用户登录响应不能断。

## users

- 负责：用户资料、头像、偏好、余额展示、兑换码入口。
- 当前路由：`/api/user/profile`、`/api/user/avatar/*`、`/api/user/preferences/*`、`/api/user/redeem`。
- 数据：`users`、`balance_logs`、`redeem_codes`。
- 迁移风险：余额同时存在 `balance/credits` 兼容字段。

## projects

- 负责：项目列表、项目创建、项目详情、项目更新、项目删除。
- 当前路由：`/api/user/projects*`。
- 数据：`projects`。
- 迁移风险：旧画布本地优先，新画布需要逐步接云端保存恢复。

## canvas

- 负责：画布 JSON、工作流 JSON、节点数据版本、导入导出格式。
- 当前路由：`/api/workflows/:id/save-json`、项目接口中的 `data`。
- 数据：当前复用 `projects.data`，后续可拆 `canvas_snapshots`。
- 迁移风险：不得把 Vue Flow 内部对象直接作为长期后端模型；需要 Canvas Adapter 做格式转换。

## template

- 负责：模板列表、素材槽、提示词、比例、反推提示词、模板生图入口。
- 当前路由：`/api/template/settings`、`/api/template/generate-image`、`/api/template/reverse-prompt`。
- 数据：`template-data.json`、`app_state.admin.templateWorkflows`、`generations`、`balance_logs`。
- 迁移风险：反推仍是 mock，真实接入前必须保留 mock 回落和兼容字段。

## gallery

- 负责：生成历史、图库展示、删除、清空、图片代理、结果资产。
- 当前路由：`/api/user/generations*`、`/api/proxy-image`、`/api/mock-image/:id.svg`。
- 数据：`generations`，文件来自 uploads、远程 URL 或 mock SVG。
- 迁移风险：后续接 MinIO/S3 前不得删除本地 uploads 和 proxy 兼容。

## generation

- 负责：估费、生成任务创建、任务状态、任务取消、任务监控数据。
- 当前路由：`/api/generation/estimate-cost`、`/api/generate/tasks*`、`/api/admin/generate-tasks*`。
- 数据：`tasks` 内存 Map、`generations`、`balance_logs`。
- 迁移风险：当前同步完成任务，后续迁 BullMQ 时响应结构必须兼容。

## provider

- 负责：Provider 状态、模型线路、New-API 调用、OpenAI-compatible 请求适配、错误标准化。
- 当前路由：`/api/public/routes`、`/api/public/models`、`/api/model-routes`、`/api/chat/completions`、后台 API 线路接口。
- 数据：`app_state.admin.apiProviders`、`app_state.admin.modelPrices`。
- 迁移风险：不得绕过 New-API 去自研通用模型网关；CPA 只做 New-API 后置渠道。

## admin

- 负责：后台控制台、用户管理、订单 mock、日志、兑换码、API 线路、模型价格、模板工作流、系统设置。
- 当前路由：`/api/admin/*`。
- 数据：`users`、`balance_logs`、`redeem_codes`、`app_state`。
- 迁移风险：旧后台完成度高，迁移顺序应晚于画布、模板、图库和用户中心。

## billing

- 负责：余额、扣费、充值订单、消费流水、模型价格映射。
- 当前路由：分散在兑换码、生成、后台余额调整、订单 mock。
- 数据：`balance_logs`、`redeem_codes`、后续 `orders`、`payments`。
- 迁移风险：真实支付未接入，不得默认开启真实支付或回调。

## 拆分门禁

- 先更新 `docs/api-contract-next.md`。
- 先补或确认对应 smoke 覆盖。
- 拆分后必须保持旧路径和关键响应字段。
- 每拆一个模块，必须运行后端 smoke 和 `/api/health`。
