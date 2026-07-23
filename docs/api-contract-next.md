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
| `POST` | `/api/auth/send-reset-code` | 无 | 旧重置验证码流程已关闭，统一返回 `410 RESET_CODE_FLOW_DISABLED`；当前找回密码页面不再调用。 |
| `POST` | `/api/auth/reset-password` | 无 | 当前小范围内网使用 `username/newPassword` 直接重置普通用户密码，新密码至少 6 位；管理员账号拒绝公开重置。该低安全契约不得直接迁移到公网。 |
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
| `POST` | `/api/workflows/:id/save-json` | user | 保存工作流 JSON，作为当前画布云端保存兼容入口。 |
| `POST` | `/api/image-tools/reverse-prompt` | user | 画布图片节点反推提示词；请求至少包含 `imageUrl`。后端读取原图并以多模态 `input_image` 调用当前文本线路，返回 `prompt/text/rawPrompt/rawText`；不得把图片线路用于文本反推。 |
| `POST` | `/api/canvas/enhance-prompt` | user | 图片生成节点 AI 扩写；接收 `prompt/currentPrompt` 与最多 4 张真实 `referenceImages`，通过当前 GPT‑5.6 Terra 文本线路生成可编辑的 `prompt/text`，不自动生图。该接口对用户免费且不读写余额，同一用户只允许一个并发请求；Provider 失败不得覆盖原提示词。 |

## Template

| 方法 | 路径 | 认证 | 字段与说明 |
| --- | --- | --- | --- |
| `GET` | `/api/template/settings` | 无 | 返回模板、平台、比例配置；当前来自 `template-data.json` 和 `app_state`。 |
| `POST` | `/api/template/generate-image` | user | 模板生图入口，复用 SQLite 持久任务、预占账务与统一 Provider 调度；兼容等待窗口内返回同步结果，超时返回可轮询任务。未启用真实 AI 时保留 mock 回落。 |
| `POST` | `/api/template/reverse-prompt` | user | 当前返回 mock 提示词结构，保留 `rawText/prompts` 等兼容字段。 |

## Generation / Provider

| 方法 | 路径 | 认证 | 字段与说明 |
| --- | --- | --- | --- |
| `POST` | `/api/generation/estimate-cost` | optional | 估算消耗，未登录返回 mock 可用额度。 |
| `POST` | `/api/generate/tasks` | user | 持久生图任务入口。支持 `Idempotency-Key` 或 `clientRequestId`，任务与余额预占在同一事务中写入；返回 HTTP 202 和 `taskId/status/queuePosition/reservedCost/replayed`。每用户最多 3 个非终态任务，全站最多 30 个，超限返回 429 与 `Retry-After`。 |
| `GET` | `/api/generate/tasks/:id` | user | 从 SQLite 查询当前用户任务。状态为 `pending/running/success/failed/cancelled`，并返回 `stage/queuePosition/startedAt/finishedAt/elapsedMs/canCancel/retryAfterMs`。线路冷却时 `stage=provider_degraded`；失败任务的 `request` 可包含脱敏的 `responseDiagnostics/providerBillingStatus/upstreamBillingAmbiguous/billingAuditRequired`。部分成功使用 `success + partial=true + warnings`。 |
| `POST` | `/api/generate/tasks/:id/cancel` | user | 取消本人 `pending/running` 任务。等待任务立即出队退款；运行任务中止本地请求并记录“上游可能已计费”的歧义，不自动重放。 |
| `POST` | `/api/generate/tasks/:id/retry` | user | 人工重试本人 `failed/cancelled` 任务并创建全新任务，原任务保持不变。上一单存在上游计费歧义时必须提交 `confirmUpstreamBillingRisk=true`；接口不自动切换线路、不复用旧幂等键。参考图仅在原任务文件仍处于 24 小时保留期时可重试，文件已清理返回 `410 GENERATION_RETRY_INPUT_EXPIRED`。 |
| `POST` | `/api/chat/completions` | user | 旧文本兼容转发；新后端接管时迁移到 OpenAI Responses 形态。`Legacy`。 |
| `GET` | `/api/chat/status` | 无 | Chat 入口公开状态，只返回 `enabled/accessEnabled/accessReady/chatPath/message`；不得返回 Provider、LibreChat 或 MongoDB 敏感配置。 |
| `GET` | `/api/proxy-image` | 签名 URL | 远程图片同源代理。新地址必须携带服务端 HMAC `sig`；只兼容数据库真实生成记录中已有的旧无签名目标。每次请求及重定向均拒绝内网/特殊用途地址和非 80/443 端口，只允许常见光栅图片，响应体最多 20 MiB（可通过 `IMAGE_PROXY_MAX_BYTES` 下调，硬上限 30 MiB）。 |
| `GET` | `/api/model-routes` | 无 | 公开模型线路，`Legacy` 和 `Next` 都可使用。 |
| `GET` | `/api/public/routes` | 无 | 公开线路列表。 |
| `GET` | `/api/public/models` | 无 | 公开模型列表。 |

## LibreChat Integration

这些接口只用于同域名 `/chat/` 独立聊天应用。浏览器可使用主站 JWT 调用票据创建和首页目录接口；Provider 与 MCP 桥接仍必须使用 Docker 内部服务密钥，并同时携带动态用户身份。旧 `/api/chat/completions` 不因本集成修改。

| 方法 | 路径 | 认证 | 字段与说明 |
| --- | --- | --- | --- |
| `POST` | `/api/integrations/librechat/sso-ticket` | user | 为当前主站用户创建 60 秒一次性票据；数据库只保存 SHA-256 哈希，返回 `ticket/expiresAt/chatPath`。 |
| `GET` | `/api/chat/home-catalog` | user | 返回后台启用且模型已开放的首页托管智能体；每项包含稳定 ID、名称、简介、系统指令、模型及 Skills/网站生图能力开关，不返回密钥。 |
| `POST` | `/api/integrations/librechat/sso-exchange` | service | 原子消费一次性票据并返回主站用户映射；重复、过期或无效票据返回 `401 SSO_TICKET_INVALID`。 |
| `GET` | `/api/integrations/librechat/v1/models` | service + user headers | 返回 LibreChat 可用文本模型列表；用户身份头为 `X-Chat-User-Id` 与 `X-Chat-User-Email`。 |
| `POST` | `/api/integrations/librechat/v1/chat/completions` | service + user headers | OpenAI Chat Completions 兼容桥接，支持 SSE、`tools`、`tool_choice`、工具调用和 `X-Chat-Message-ID` 幂等计费。 |
| `POST/GET/DELETE` | `/api/integrations/librechat/mcp` | service + user headers | 官方 MCP Streamable HTTP 入口；第一版只发布 `prepare_image_generation` 与 `execute_image_generation`。LibreChat 服务端用 `X-Chat-Reference-Images: b64url:<payload>` 传递当前消息附件路径的 UTF-8 JSON 数组，最多 4 张；主站继续兼容旧的原始 JSON Header。 |

集成约束：

- LibreChat 不持有主站 JWT，也不获得 Provider Key；SSO 成功后只签发 LibreChat 自己的 HttpOnly 会话。
- 文本桥接按消息 ID 预留、结算或退款，重试不得重复扣费；同一消息内每次 Provider 工具续传按请求指纹记录独立步骤，工具调用阶段保持消息预留，最终回复后才结算整条消息。完全相同的步骤重放返回 `409`，但合法的工具结果续传不得被误判为重复消息。
- 文本 Responses 桥接检测到生图/图生图意图时，必须强制选择网站 `prepare_image_generation` 或 `execute_image_generation` 函数；进入该流程后，图片附件只由 MCP 服务端上下文读取，不再把图片字节交给文本 Provider。若上游仍返回 `image_generation_call.result`，桥接不得把 Base64 写进聊天，必须退款并返回可读提示。
- 最新用户消息即使没有“生图/生成/设计”等动词，只要同时包含电商平台、画布尺寸或比例、目标人群/卖点/商品规格三类结构化简报信息，也必须视为生图需求并强制选择 `prepare_image_generation`；不得让用户重复提交同一份完整简报。
- `prepare_image_generation` 只报价并签发一次性确认码；`execute_image_generation` 必须使用下一条消息的 ID，且同一报价只能成功消费一次。执行工具允许省略 `quoteId`，服务端必须按当前用户与确认码哈希定位 pending 报价，不能跨用户匹配。
- 两个内置生图工具的 MCP `content[].text` 是面向普通用户的中文 Markdown：报价只展示生成方式、模型、数量、参考图数量、算力与确认码，完成结果只展示数量、算力和图片；`quoteId/modelKey/taskId/instruction` 等内部字段只保留在 `structuredContent`，不得假设 LibreChat 会把它持久化给下一轮模型。LibreChat 前台不得展示工具函数名、`hajimi-website`、Parameters 或原始 JSON；已完成的报价/结果即使后续助手续接失败也必须保持可见，其他通用工具展示不受影响。
- 内置生图工具结果续接和明确的“确认生图 CODE”由主站确定性处理：工具结果不再二次调用文本 Provider，确认消息直接返回 `execute_image_generation` 工具调用。文本模型仍可用于首次理解用户需求和整理生图提示词，但其后续 502 不得隐藏报价或阻断确认执行。
- LibreChat 当前消息中的 `/images/*` 图片附件由服务端序列化为 UTF-8 JSON，再以 Base64URL 编码写入 `X-Chat-Reference-Images`，避免中文文件名触发 Fetch Header 的 ByteString 限制；主站解码后将路径规范化为 Docker 内部 LibreChat 图片地址并合并到报价。有参考图执行 `/images/edits` multipart 图生图，无参考图执行 `/images/generations` JSON 文生图。模型无需复制附件 URL，也不能用参数覆盖当前消息的真实附件上下文。
- 生图仍复用主站生成逻辑，成功记录必须进入现有 `generations` 和 `balance_logs`。
- 图片 Provider 返回 `b64_json`、裸 Base64 或 HTTP(S) URL 时，主站都必须先校验图片类型、签名和大小并写入持久化 `/uploads/generated/`；MCP、图片工具和生成历史只保存本地短 URL，不返回或保存 Base64/Provider 外链。远程图片落盘失败时任务失败，异步任务不得扣费。
- 图片请求方式由当前线路的 `apiFormat` 和线路级响应字段共同决定，不得根据 Base URL 域名推断。`apiFormat=lingsuan-images` 是独立、锁定的官方 Images 规则：固定非流式 JSON `data[].b64_json`，图生图使用 `image[]`，只发送已验证的官方字段并强制 `/v1/images/generations`、`/v1/images/edits`；保存时即使提交了冲突的流式字段也必须规范化为 `false/0/b64_json`。Packy 继续为 `false/0/url`，其他通用线路仍可使用原线路级响应配置。Provider 返回 HTTP 200 但没有最终图片时必须失败并保留脱敏上游摘要，本地不得扣费或自动重试，同时向用户说明上游可能已经计费。
- 第一版关闭 RAG、代码执行、搜索索引、向量库和用户自定义外部 MCP。

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
| `GET` | `/api/admin/users` | admin | 用户列表；排除 `deleted` 和 `purged`，这两类只进入回收站/审计域。 |
| `PATCH` | `/api/admin/users/:id/status` | admin | 状态仅允许 `active/disabled/banned`；禁止当前管理员自停用或自封禁。 |
| `POST` | `/api/admin/users/:id/balance` | admin | 非零余额调整，调整后不得小于 0，必须写 `balance_logs`。 |
| `POST` | `/api/admin/users/:id/security-check` | admin | 按真实账号状态、余额、身份字段重复和最新余额日志一致性返回风险检查，不返回固定演示结论。 |
| `POST` | `/api/admin/users/:id/reset-password` | admin | 显式提供至少 6 位新密码；成功响应不得回显明文。 |
| `DELETE` | `/api/admin/users/:id` | admin | 软删除到回收站；禁止删除当前管理员。 |
| `GET/POST/DELETE` | `/api/admin/recycle-bin/users/*` | admin | 查看已删除用户、恢复为启用、永久匿名化；永久操作只允许 `deleted` 用户。 |
| `GET/POST/DELETE` | `/api/admin/redeem-codes` | admin | 兑换码管理。 |
| `GET/POST/PUT/DELETE` | `/api/admin/api-providers` | admin | API 线路管理，当前保存在 `app_state`。`PUT /api/admin/api-providers` 可整包替换线路。 |
| `GET/POST/PATCH/DELETE` | `/api/admin/model-prices` 与 `/api/admin/route-models/*` | admin | 模型价格与路由模型管理；价格非负，删除使用 tombstone，内置模型不会在刷新后复现。 |
| `GET/PUT` | `/api/admin/template-workflows` | admin | 模板工作流配置，当前保存在 `app_state`。 |
| `GET/PATCH` | `/api/admin/settings` | admin | 系统设置，当前保存在 `app_state`。 |
| `GET/PATCH` | `/api/admin/chat/settings` | admin | Chat 运行时策略与部署状态；可写字段为访问、文本、MCP 生图开关、允许模型、维护提示和最多 12 个首页托管智能体，密钥只返回是否已配置。 |
| `POST` | `/api/admin/chat/test` | admin | 执行不产生模型费用的 Chat 内部健康检查，返回主站桥接、LibreChat `/health`、SSO、Skills 与 MCP 配置状态。 |
| `POST` | `/api/admin/chat/test-provider` | admin | 真实 API 中转诊断；必须传 `confirmRealCall=true`、允许模型和短提示词，最多输出 16 tokens，可能消耗 Provider 额度但不扣主站用户余额。 |
| `GET` | `/api/admin/generate-tasks` | admin | 以 SQLite 持久任务为主的生成监控，返回排队分组、阶段耗时、失败域、熔断状态、账务状态和脱敏错误；兼容期合并旧运行时任务和历史。 |
| `POST` | `/api/admin/generate-tasks/:id/cancel` | admin | 复用用户任务取消状态机；只允许 `pending/running`，运行中取消保留上游可能已计费的提示。 |
| `DELETE` | `/api/admin/generate-tasks/:id` | admin | 只删除终态持久任务或兼容历史，不追加退款。 |

后台数据真实性约束：Dashboard 今日字段必须按 SQLite 当日记录计算；历史生成记录没有线路字段时不得平均分摊到所有线路。支付未启用且没有真实订单表时，订单 GET 返回 `available=false` 与空列表，状态修改返回 409。管理员重置密码成功响应不得回显明文密码，安全检查不得返回固定演示结论。任务历史不得填充数据库未保存的线路、尺寸、质量或参考图数量；取消仅控制本地任务状态，不得宣称已撤销上游计费。

## 迁移规则

- 新前端必须优先依赖 `Next` 字段，但后端迁移期间继续返回 `Legacy` 字段。
- `Mock` 字段和 mock 路径不得删除，直到真实服务、验收脚本和人工验收都通过。
- 任何接口新增或破坏性修改，必须先更新本文件和 smoke，再改代码。
- NestJS 迁移时保持路径和关键响应字段兼容，按模块逐步替换旧 Express 实现。

## API 线路目标约束

- API 线路目标仍为一条图片线路和一条 Responses 文本线路：图片模型键 `gpt-image-2`；文本线路允许 `gpt-5.5` 与 `gpt-5.6`。普通 Chat 继续使用 `gpt-5.5`，只有托管智能体 ID `ecommerce-main-image` 默认使用 `gpt-5.6`，每次调用 5 算力。
- 旧的 `6789`、`comfly-*`、`RK`、`哈吉米`、`flowstudio` 等线路不再作为目标配置保留；如需兼容历史数据，只能作为数据库旧记录读取，不能再进入默认种子。
- 图片文生图请求形态参考 OpenAI Images：`POST /images/generations`，请求体最小字段为 `{ "model": "gpt-image-2", "prompt": "string" }`，可扩展 `size`、`quality`、`n`。
- 图片图生图 / 局部重绘请求形态参考 Packy GPT-Image-2 Images Edit：`POST /v1/images/edits`，请求体为 `multipart/form-data`，最小字段为 `model=gpt-image-2`、`prompt=string`、`image=<file>`、`n=1`；正式图生图默认追加按“比例 + 清晰度”换算后的 `size` 和 `quality`，其中 `1K/2K/4K` 分别派生 `low/medium/high`，同时追加 `output_format=png`、`response_format=url` 和 `input_fidelity=high`，局部重绘可追加 `mask=<png file>`。
- 站内生图业务接口中的比例字段固定为 `ratio`，格式使用冒号，例如 `ratio: "1:1"`；前端不得再把比例写入 `size`。后端继续兼容历史客户端的 `size: "1x1"`、`ratio: "1x1"` 和 `ratio: "1X1"`，但 `ratio` 与 `size` 同时存在时以 `ratio` 为准。
- Provider Adapter 发给图片上游的 `size` 固定为换算后的真实像素尺寸，例如 `1K + 1:1` 转为 `size: "1024x1024"`；不得把 `1:1` 或 `1x1` 直接作为官方 `size` 参数发送。
- 图片生成节点带参考图时，上行 Prompt 必须同时包含目标比例、像素尺寸和“不得继承参考图原比例”的重新构图要求；Provider `size` 仍保持官方像素格式。禁止用本地裁切、拉伸或补边替代正确的中转返图，也禁止自动发起第二次付费请求。
- 固定比例上行 Prompt 和 Provider `size` 必须从当前请求动态生成，不得硬编码 `1:1`；`自动` 模式发送 `size=auto`，Prompt 描述为按内容自然选择画布，不声明字面量 `auto` 是具体比例或尺寸。
- Provider 返回的 PNG/JPEG/WebP/GIF/BMP 只要能解码为有效图片，就必须持久化到 `/uploads/generated/` 并把本地 URL 返回任务、模板或 Chat 调用方，禁止因上游实际比例偏差吞掉有效返图。当实际宽高比与请求 `size` 相差超过 3%，或无法读取真实尺寸时，成功结果追加 `aspectRatioWarning`、`warning` 和 `warnings` 元数据供界面提示，但仍写 `generations` 并按成功任务扣系统算力；不本地裁切、不自动发起第二次付费请求。空结果、无效签名或无法解码的内容仍按 Provider 失败处理，不落历史、不扣系统算力。
- 文本请求形态参考 OpenAI Responses：`POST /responses`，普通请求最小字段为 `{ "model": "gpt-5.5", "input": "string" }`；`ecommerce-main-image` 的方案请求使用 `gpt-5.6`，并按顺序在 `input` 中提供实际 `input_image`，不得替换为“图片 N”文本占位符。
- 管理后台 API 线路页只能提供整包替换为上述两条的入口；不得新增自研网关字段、账号池字段或非官方请求格式字段。
- 前端 API 线路页只展示能力注册表，不承载业务调用逻辑。当前能力注册表位于 `frontend/src/config/providerCapabilities.ts`；后续中转站差异必须进入后端 Provider Adapter。
- 分层关系固定为：前端功能模块调用后端业务接口，后端业务接口选择 Provider 能力，Provider Adapter 再根据中转站构造真实请求。
