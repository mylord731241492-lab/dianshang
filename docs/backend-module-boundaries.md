# 后端模块边界初版

本文件定义渐进模块边界。当前 `server.js` 继续作为 Express 兼容入口；生图任务已先迁出最小的持久仓储、任务服务和 Provider 调度模块，后续迁移到 NestJS 或 TypeScript 模块时必须保持 `/api/*` 契约兼容。

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
- 迁移风险：当前画布此前以本地保存为主，云端保存恢复需要在兼容现有 JSON 的前提下逐步接入。

## canvas

- 负责：画布 JSON、工作流 JSON、节点数据版本、导入导出格式。
- 当前路由：`/api/workflows/:id/save-json`、项目接口中的 `data`。
- 数据：当前复用 `projects.data`，后续可拆 `canvas_snapshots`。
- 迁移风险：不得把画布运行时内部对象直接作为长期后端模型；需要 Canvas Adapter 做格式转换。

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
- 当前模块：`backend/generation/task-repository.js`、`backend/generation/generation-task-service.js`；`server.js` 保留路由适配和 Provider 请求组装。
- 数据：`generation_tasks`、`generation_task_items`、`generation_task_attempts`、`generations`、`balance_logs`；旧 `tasks` 内存 Map 仅保留兼容入口。
- 迁移风险：SQLite 是当前单实例任务事实源。后续迁 BullMQ 时必须保留幂等键、状态、部分成功、重启中断不重放和响应字段。

## assets

- 负责：账号隔离云端资产库——上传（magic bytes 校验）、列表/详情/改名/标签、15 分钟签名读取 URL、generations 导入、软删除。
- 当前模块：`backend/assets/`（`asset-service.js`、`asset-repository.js`、`object-storage.js`、`magic-bytes.js`、`routes.js`）；`server.js` 只做 `createAssetService` + `registerAssetRoutes` 挂载。
- 当前路由：`/api/user/assets*`、`/api/asset-content/:assetId`（签名内容读取，见 ADR-0006）。
- 数据：`user_assets`；文件字节经统一 `ObjectStorage` 接口（Fake/将来 S3 兼容），绝不回退本地 uploads。
- 迁移风险：真实存储驱动未实施，`ENABLE_REAL_STORAGE=true` 必须 503 `ASSET_STORAGE_UNAVAILABLE`；所有查询强制 `user_id` 隔离；删除只软删除，物理回收由后续独立任务决定。

## prompts

- 负责：系统提示词 + 我的提示词双层云端提示词库——系统提示词 admin 维护（草稿/发布/停用/排序/软删除，内容修改 version 自增），普通用户只读已发布；我的提示词为账号私有 CRUD（搜索/分类/标签/收藏/分页）；`copy-system` 把已发布系统提示词复制为当前账号私有副本。
- 当前模块：`backend/prompts/`（`prompt-service.js`、`prompt-repository.js`、`routes.js`、`index.js`）；`server.js` 只做 `createPromptService` + `registerPromptRoutes` 挂载；建表在模块幂等迁移内完成。
- 当前路由：`/api/prompts/system`（普通用户只读已发布）、`/api/user/prompts*`（含 `copy-system`）、`/api/admin/system-prompts*`（admin 守卫）。
- 数据：`system_prompts`、`user_prompts`；`user_prompts` 所有 SQL 强制 `user_id`，跨用户一律 404 不泄漏存在性。
- 迁移风险：普通用户读取只返回 `status='published' AND deleted_at IS NULL`；删除只软删除；系统提示词修改/停用/删除不追溯修改已保存项目中的 `contentSnapshot`；管理员接口刻意不提供读取所有用户提示词正文的能力。

## provider

- 负责：Provider 状态、模型线路、New-API 调用、OpenAI-compatible 请求适配、错误标准化、连接池、有界公平调度、失败域并发与熔断。
- 当前模块：`backend/provider/image-request-scheduler.js`；具体协议适配仍在 `server.js`，不得复制调度器。
- 当前路由：`/api/public/routes`、`/api/public/models`、`/api/model-routes`、`/api/chat/completions`、后台 API 线路接口。
- 数据：`app_state.admin.apiProviders`、`app_state.admin.modelPrices`。
- 迁移风险：不得绕过 New-API 去自研通用模型网关；CPA 只做 New-API 后置渠道。

## admin

- 负责：后台控制台、用户管理、订单 mock、日志、兑换码、API 线路、模型价格、模板工作流、系统设置。
- 当前路由：`/api/admin/*`。
- 数据：`users`、`balance_logs`、`redeem_codes`、`app_state`。
- 迁移风险：旧后台完成度高，迁移顺序应晚于画布、模板、图库和用户中心。

## billing

- 负责：余额、预占、按成功图片结算、失败/取消退款、充值订单、消费流水、模型价格映射。
- 当前模块：`backend/billing/generation-billing.js` 负责生图预占与未使用额度退款；任务状态判断仍由 generation 仓储控制。
- 当前路由：分散在兑换码、生成、后台余额调整、订单 mock。
- 数据：`balance_logs`、`redeem_codes`、后续 `orders`、`payments`。
- 迁移风险：持久生图使用 `task_id` 唯一流水保证预占和退款至多一次。真实支付未接入，不得默认开启真实支付或回调。

## 拆分门禁

- 先更新 `docs/api-contract-next.md`。
- 先补或确认对应 smoke 覆盖。
- 拆分后必须保持旧路径和关键响应字段。
- 每拆一个模块，必须运行后端 smoke 和 `/api/health`。

## 2026-08-14 渐进拆分记录

- `backend/provider/image-helpers.js`：providerImage 纯工具函数族（尺寸/宽高比/格式/质量/响应消息/载荷）+ normalizeImageRatio 等依赖工具 + PROVIDER_IMAGE_ASPECT_TOLERANCE。server.js 顶部解构 require，调用点零改动。
- 下一批候选：计费/兑换码、workflows 路由、image-tools 一族、canvas agent 挂载。
- `backend/billing/balance-service.js`：recordBalanceLog（8 处 6 列 INSERT 统一）、listUserBalanceLogs、redeemCode 全 SQL；工厂函数注入 db，路由层留 server.js。兑换冒烟：+100、二次 404。
- `backend/workflows/routes.js`：registerWorkflowRoutes(app, options) 工厂模式（auth/uid/db/workflowDir/workflowDataFromBody/normalizeWorkflowJson 注入），三条 workflows 路由 URL 逐字不变，save-json/local-json 冒烟 200。
- `backend/image-tools/routes.js`：registerImageToolRoutes(app, options)，/api/image-tools 四条 POST（outpaint/reverse-prompt/inpaint/erase）+ 独占支撑函数迁入；imageToolOutputText 等共享函数留 server.js 注入。400 校验路径逐字一致。/api/image-tools/settings 与 /tasks/:id 两条 GET 留 server.js。
- `backend/admin/routes.js`：registerAdminRoutes(app, options)，39 条 /api/admin/* 全部迁入（含 login），依赖大清单注入；admin login/users/api-providers/settings 冒烟通过。
- `backend/ecommerce-suite/routes.js`：registerEcommerceSuiteRoutes(app, options)，3 条套图路由 + 15 个独占支撑函数迁入；settings 归一化链（被 settingsState/admin 共享）留 server.js 注入。config 200、prompts 400 校验路径一致，原代码逐字 diff IDENTICAL。
- `backend/canvas-routes/routes.js`：registerTemplateSettingsRoutes/registerCanvasPromptRoutes/registerTemplateImageRoutes 三工厂，/api/template/settings、/api/canvas/generate-prompt、/api/template/generate-image、/api/template/reverse-prompt 迁入（各 register 调用放回原行位）；buildCanvasPromptInput/buildCanvasPromptFallback 独占迁入，canvasPromptImageLabel/templateWorkflowState/pickTemplatePrompt/executeTemplateImageGeneration 共享留 server.js 注入。/api/canvas/enhance-prompt 与 /api/canvas/dialog-agent-generate 因 verify-canvas-performance-assets.js 与 check-packy-gpt-image-adapter-coverage.js 的 server.js 源码锚点留 server.js。原代码逐字 diff IDENTICAL。
