# Next API 契约初版

本文件用于新 `frontend/` 源码工程迁移时对齐旧 Express API。当前阶段不改接口实现，不创建 NestJS 工程，只把现有 `/api/*` 行为固化为可迁移契约。

字段标记：

- `Next`：新源码前端应优先使用的正式字段。
- `Legacy`：旧打包前端仍可能依赖的兼容字段，迁移完成前不得删除。
- `Mock`：当前可返回本地模拟数据，接真实服务前必须保留 mock 回落。

## Auth

| 方法 | 路径 | 认证 | 字段与说明 |
| --- | --- | --- | --- |
| `POST` | `/api/auth/register` | 无 | `username/email/password/code`；返回 `token`、`user`。`Next` 使用 `token/user`。 |
| `POST` | `/api/auth/login` | 无 | `username/password`；返回 `token`、`user`。管理员也可用 `/api/admin/login`。 |
| `POST` | `/api/auth/send-email-code` | 无 | 当前验证码打印到 console。`Mock`。 |
| `POST` | `/api/auth/send-reset-code` | 无 | 当前验证码打印到 console。`Mock`。 |
| `POST` | `/api/auth/reset-password` | 无 | 邮箱验证码重置密码。 |
| `POST` | `/api/admin/login` | 无 | 管理员登录，要求用户角色为 `admin`。 |

## User

| 方法 | 路径 | 认证 | 字段与说明 |
| --- | --- | --- | --- |
| `GET` | `/api/user/profile` | user | `Next` 使用 `user`；余额字段保留 `balance/credits` 兼容。 |
| `GET` | `/api/user/routes` | user | `Next` 使用 `items` 或 `data`；`Legacy` 同时保留两者。 |
| `GET` | `/api/user/models` | user | 按 `routeId` 返回模型列表。 |
| `GET` | `/api/user/api-status` | optional | 未登录也返回 mock 状态。`Mock`。 |
| `GET` | `/api/user/balance-logs` | user | 返回 `items`，用于用户中心余额流水。 |
| `POST` | `/api/user/redeem` | user | 兑换码入账，必须写 `balance_logs`。 |
| `POST` | `/api/user/avatar/upload` | user | multipart 上传头像，本地 uploads。 |
| `PUT` | `/api/user/avatar` | user | 保存预设头像或上传头像 URL。 |
| `POST` | `/api/user/preferences/api-provider` | user | 旧前端偏好兼容接口。`Legacy`。 |
| `POST` | `/api/user/preferences/api-route` | user | 旧前端偏好兼容接口。`Legacy`。 |

## Projects / Canvas

| 方法 | 路径 | 认证 | 字段与说明 |
| --- | --- | --- | --- |
| `GET` | `/api/user/projects` | user | 画布项目列表。`Next` 使用 `items`。 |
| `POST` | `/api/user/projects` | user | 创建项目，保存 `name/data`。 |
| `GET` | `/api/user/projects/:id` | user | 读取项目详情和画布 JSON。 |
| `PUT` | `/api/user/projects/:id` | user | 更新项目名和画布数据。 |
| `DELETE` | `/api/user/projects/:id` | user | 删除项目。 |
| `POST` | `/api/workflows/:id/save-json` | user | 保存工作流 JSON，作为新画布云端保存兼容入口。 |

## Template

| 方法 | 路径 | 认证 | 字段与说明 |
| --- | --- | --- | --- |
| `GET` | `/api/template/settings` | 无 | 返回模板、平台、比例配置；当前来自 `template-data.json` 和 `app_state`。 |
| `POST` | `/api/template/generate-image` | user | 模板生图入口；未启用真实 AI 时 mock 回落；成功必须写 `generations` 和 `balance_logs`。 |
| `POST` | `/api/template/reverse-prompt` | user | 当前返回 mock 提示词结构，保留 `rawText/prompts` 等兼容字段。 |

## Generation / Provider

| 方法 | 路径 | 认证 | 字段与说明 |
| --- | --- | --- | --- |
| `POST` | `/api/generation/estimate-cost` | optional | 估算消耗，未登录返回 mock 可用额度。 |
| `POST` | `/api/generate/tasks` | user | 生图任务入口；当前同步完成并返回任务形态，后续迁移 BullMQ 后保持响应字段兼容。 |
| `GET` | `/api/generate/tasks/:id` | user | 查询任务。 |
| `POST` | `/api/chat/completions` | user | 旧文本兼容转发；新后端接管时迁移到 OpenAI Responses 形态。`Legacy`。 |
| `GET` | `/api/proxy-image` | 无 | 远程图片同源代理，避免前端跨域和下载失败。 |
| `GET` | `/api/model-routes` | 无 | 公开模型线路，`Legacy` 和 `Next` 都可使用。 |
| `GET` | `/api/public/routes` | 无 | 公开线路列表。 |
| `GET` | `/api/public/models` | 无 | 公开模型列表。 |

## Gallery

| 方法 | 路径 | 认证 | 字段与说明 |
| --- | --- | --- | --- |
| `GET` | `/api/user/generations` | user | 图库历史；`Next` 使用 `items`，图片 URL 优先 `url/resultUrl`。 |
| `DELETE` | `/api/user/generations/:id` | user | 删除单条生成记录。 |
| `DELETE` | `/api/user/generations` | user | 清空当前用户生成记录。 |
| `GET` | `/api/mock-image/:id.svg` | 无 | 本地 mock 图片。`Mock`。 |

## Admin

| 方法 | 路径 | 认证 | 字段与说明 |
| --- | --- | --- | --- |
| `GET` | `/api/admin/dashboard` | admin | 控制台统计。 |
| `GET` | `/api/admin/users` | admin | 用户列表。 |
| `PATCH` | `/api/admin/users/:id/status` | admin | 用户状态。 |
| `POST` | `/api/admin/users/:id/balance` | admin | 管理员余额调整，必须写 `balance_logs`。 |
| `DELETE` | `/api/admin/users/:id` | admin | 软删除。 |
| `GET/POST/DELETE` | `/api/admin/redeem-codes` | admin | 兑换码管理。 |
| `GET/POST/PUT/DELETE` | `/api/admin/api-providers` | admin | API 线路管理，当前保存在 `app_state`。`PUT /api/admin/api-providers` 可整包替换线路。 |
| `GET/POST/PATCH/DELETE` | `/api/admin/model-prices` 与 `/api/admin/route-models/*` | admin | 模型价格与路由模型管理。 |
| `GET/PUT` | `/api/admin/template-workflows` | admin | 模板工作流配置，当前保存在 `app_state`。 |
| `GET/PATCH` | `/api/admin/settings` | admin | 系统设置，当前保存在 `app_state`。 |
| `GET` | `/api/admin/generate-tasks` | admin | 生成任务监控。 |

## 迁移规则

- 新前端必须优先依赖 `Next` 字段，但后端迁移期间继续返回 `Legacy` 字段。
- `Mock` 字段和 mock 路径不得删除，直到真实服务、验收脚本和人工验收都通过。
- 任何接口新增或破坏性修改，必须先更新本文件和 smoke，再改代码。
- NestJS 迁移时保持路径和关键响应字段兼容，按模块逐步替换旧 Express 实现。

## API 线路目标约束

- API 线路目标收窄为两条：图片线路 `GPT Image 2`，模型键 `gpt-image-2`；文本线路 `GPT 5.5`，模型键 `gpt-5.5`。
- 旧的 `6789`、`comfly-*`、`RK`、`哈吉米`、`flowstudio` 等线路不再作为目标配置保留；如需兼容历史数据，只能作为数据库旧记录读取，不能再进入默认种子。
- 图片文生图请求形态参考 OpenAI Images：`POST /images/generations`，请求体最小字段为 `{ "model": "gpt-image-2", "prompt": "string" }`，可扩展 `size`、`quality`、`n`。
- 图片图生图 / 局部重绘请求形态参考 OpenAI Images Edit：`POST /images/edits`，请求体最小字段为 `{ "model": "gpt-image-2", "images": [{ "image_url": "..." }], "prompt": "string" }`，可扩展 `mask`、`size`、`quality`、`n`；上传真实文件时可使用 `multipart/form-data`。
- 文本请求形态参考 OpenAI Responses：`POST /responses`，请求体最小字段为 `{ "model": "gpt-5.5", "input": "string" }`。
- 管理后台 API 线路页只能提供整包替换为上述两条的入口；不得新增自研网关字段、账号池字段或非官方请求格式字段。
- 前端 API 线路页只展示能力注册表，不承载业务调用逻辑。当前能力注册表位于 `frontend/src/config/providerCapabilities.ts`；后续中转站差异必须进入后端 Provider Adapter。
- 分层关系固定为：前端功能模块调用后端业务接口，后端业务接口选择 Provider 能力，Provider Adapter 再根据中转站构造真实请求。
