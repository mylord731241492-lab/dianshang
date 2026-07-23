# API 契约与维护状态

所有 `/api/*` 接口必须返回 JSON。未命中接口返回：

```json
{
  "success": false,
  "code": "API_NOT_FOUND",
  "message": "接口不存在: GET /api/..."
}
```

## 状态标记

- `mock`：本地模拟，不调用外部服务。
- `local-db`：读写 SQLite。
- `internal-direct-reset`：仅适用于当前小范围内网，允许普通用户凭用户名直接重置密码。
- `real-provider-ready`：接口形状已预留真实服务接入，但默认关闭。

## Auth

| Method | Path | 状态 | 请求 | 响应 |
| --- | --- | --- | --- | --- |
| POST | `/api/auth/login` | local-db | `username,password` | `token,user` |
| POST | `/api/auth/register` | local-db | `username,email,password,code` | `token,user` |
| POST | `/api/auth/send-email-code` | mock | `email,type` | `ok,code,cooldown,expiresIn` |
| POST | `/api/auth/send-reset-code` | disabled | 无 | 旧重置验证码流程已关闭，统一返回 `410 RESET_CODE_FLOW_DISABLED`；当前找回密码页面不调用 |
| POST | `/api/auth/reset-password` | internal-direct-reset | `username,newPassword` | 普通用户成功返回 `success,message`；密码少于 6 位返回 `400 PASSWORD_TOO_SHORT`；账号不存在返回 `404 ACCOUNT_NOT_FOUND`；管理员返回 `403 ADMIN_SELF_RESET_FORBIDDEN` |
| POST | `/api/admin/login` | local-db | `username,password` | `token,user` |

账号直重置是用户明确接受的内网简化方案，不校验邮箱或验证码，存在账号被他人抢重置的固有风险。不得把该契约直接用于公网或正式收费生产；注册和兑换码契约不受本方案影响。

## User

| Method | Path | 状态 | 说明 |
| --- | --- | --- | --- |
| GET | `/api/user/profile` | local-db | 当前用户资料 |
| GET | `/api/user/routes` | mock | 可用 API 线路 |
| GET | `/api/user/models` | mock | 指定线路模型 |
| GET | `/api/user/api-status` | mock | 当前线路状态 |
| GET | `/api/user/balance-logs` | local-db | 余额流水 |
| GET/DELETE | `/api/user/generations` | local-db | 图片历史；支持按 `:id` 或 `resultUrl/prompt` 删除 |
| GET/POST/PUT/DELETE | `/api/user/projects` | local-db | 画布项目，返回 `success` 和 `items/projects/list/data` 兼容字段 |
| POST/PUT | `/api/user/avatar...` | local-db | 头像上传/设置 |
| POST | `/api/user/redeem` | local-db | 兑换码 |

## Generation / Template

| Method | Path | 状态 | 说明 |
| --- | --- | --- | --- |
| POST | `/api/generation/estimate-cost` | mock | 估算点数 |
| POST | `/api/generate/tasks` | Provider + local-db | 创建异步生图任务；每次合法提交均返回 HTTP 202 并创建独立任务，取得 Provider 槽位前为 `pending`，出站后为 `running`。允许同一用户连续提交多批任务。当前画布只压缩发送给 Provider 的参考图副本：最长边超过 2048 或体积超过 4MB 时转为高质量 WebP，画布原图和项目数据不变；后端发送前仍超过 5MB 的单张参考图以 `PROVIDER_REFERENCE_IMAGE_TOO_LARGE` 结束任务，不调用 Provider、不扣本地算力。配置 `LINGSUAN_IMAGE_PROXY_URL` 时，仅主机名精确为 `lingsuan.top` 的 HTTPS 图片请求使用该 CONNECT 代理；文本请求、其他 Provider 和 HTTP 假 Provider 保持直连，容器不设置全局 `HTTP_PROXY/HTTPS_PROXY`。未命中定向代理的图片 HTTPS 使用 IPv4 keep-alive；DNS 返回多个 IPv4 时，每次新建连接会避开上一次使用的地址。只有明确发生在 TLS/连接建立前的断开、`ETIMEDOUT`、不可达或 DNS 临时失败最多重试 2 次，普通 `socket hang up/ECONNRESET` 不重放，避免重复上游费用。图生图任务的脱敏 `request` 元数据包含参考图数量、逐图/合计字节数、MIME、传输模式、连接族和安全重试次数，不包含图片内容、代理凭据或密钥。 |
| GET | `/api/generate/tasks/:id` | runtime | 查询当前用户内存任务，状态为 `pending/running/success/failed`。 |
| POST | `/api/template/reverse-prompt` | mock | 返回提示词建议；兼容 `rawText/rawPrompt`、`prompts/suggestions/items/list/data` |
| POST | `/api/image-tools/reverse-prompt` | real-provider-ready | 画布图片节点反推提示词。请求至少包含 `imageUrl`；后端读取图片并转换为多模态 `input_image`，只允许通过 `resolveTextRoute` 选择文本线路，不得回退到图片线路。成功返回 `prompt/text/rawPrompt/rawText`；图片不可读返回 `400 IMAGE_TOOL_IMAGE_UNREADABLE`，Provider 失败返回 `502` 且不自动重试 |
| POST | `/api/canvas/enhance-prompt` | real-provider-ready | 画布图片生成节点的 AI 提示词扩写。请求包含 `prompt/currentPrompt` 和最多 4 张 `referenceImages`；后端读取真实 PNG/JPEG/WebP 原图，按上传顺序作为多模态 `input_image` 交给当前 GPT‑5.6 Terra 文本线路。成功返回可编辑的 `prompt/text`，但不创建生图任务。该能力对用户免费，`costPoints=0`，不得读写用户余额；同一用户同时只允许一个扩写请求。Provider 失败返回 `502`，不得用本地短模板覆盖原提示词。 |
| POST | `/api/template/generate-image` | mock / real-provider-ready + local-db + local-files | Provider 请求由当前图片线路的 `apiFormat` 选择适配规则，不得按域名自动切换。`lingsuan-images` 固定使用 `/v1/images/generations` 或 `/v1/images/edits`、非流式 JSON/Base64；文生图只发送 `model/prompt/size/quality/output_format/n`，图生图只发送 `model/image[]/prompt/size/quality/output_format/n`（有 mask 时追加 `mask`），禁止发送 `stream/partial_images/response_format/input_fidelity/ratio/background/moderation`。Packy 仍保持 `url/false/0`。Provider 返回 Base64 或 HTTP(S) 图片时，先校验并写入 `/uploads/generated/`，再以本地短 URL 写入历史；只要返图能解码为有效图片，即使比例偏差超过 3% 或真实尺寸无法读取，也必须保留并返回本地 URL，同时在成功结果写入 `aspectRatioWarning`、`warning` 和 `warnings`。此类有效返图按成功任务写历史和扣系统算力，不本地裁切、不自动重试。远程图落盘失败、图片签名无效或上游 200 空图仍按失败处理，不得扣本地算力、不得把外链或 Base64 写库，也不得自动发起第二次付费请求 |
| POST | `/api/chat/completions` | mock / real-provider-ready | 默认 mock；仅 `ENABLE_REAL_AI=true` 且 key 有效时调用真实接口 |
| POST | `/api/integrations/librechat/v1/chat/completions` | real-provider-ready + local-db | LibreChat 专用文本桥接，按消息 ID 幂等预扣与结算，并显式接收 `hjm_managed_agent_id`/`X-Chat-Agent-ID`。所有 Chat 智能体的模型键从后台当前文本 API 路线动态同步，现为 `gpt-5.6-terra`（每次 5 算力）；只有 ID 为 `ecommerce-main-image` 的托管智能体进入两阶段多模态方案流程，其他智能体继续使用原工具策略，禁止按名称或提示词猜测智能体。历史 `gpt-5.5`/`gpt-5.6` 名称会映射到当前路线模型。Provider HTTP 4xx/5xx、网络失败、超时、模型不支持或方案工具输出无效时都退款且不降级。旧会话缺少智能体 ID 时要求用户重新选择智能体或新建会话。 |
| POST/GET/DELETE | `/api/integrations/librechat/mcp` | real-provider-ready + local-db | 内置 `prepare_ecommerce_image_plan`、`confirm_ecommerce_image_plan`、`prepare_image_generation`、`execute_image_generation` 四个工具。前两个工具只允许 `ecommerce-main-image` 使用：首轮 GPT‑5.6 按上传顺序读取最多 4 张 PNG/JPEG/WebP 原图，图片用途完全服从用户描述，输出 v2 `designPrompt`、`referenceRoles[]`、动态 `copyItems[]`；方案正文、文案名称和内容可编辑，来源只读且文案行可增删。确认方案必须再次调用 GPT‑5.6，并携带原需求、全部原图、原方案、修改方案、动态文案和补充要求生成 `finalPrompt`；服务端只追加图片角色、准确文案、无额外乱码/水印等确定性约束，再创建报价。确认报价前不调用图片 Provider。历史固定字段方案转换为动态文案行展示；生成结果继续提供“修改这张/再出一版/完成”，修订时恢复最初参考图及上一版结果。 |
| GET | `/api/chat/status` | runtime-state | 无需登录，只返回 Chat 部署/访问是否可用、维护提示和 `/chat/` 路径；不返回密钥或内部地址 |
| GET | `/api/mock-image/:id.svg` | mock | 本地占位图 |
| GET | `/api/proxy-image` | signed proxy | 新远程图使用 HMAC `sig`；旧无签名地址只允许命中已有生成记录；拒绝私网/特殊地址、非 80/443 端口和重定向绕过，限制图片类型与响应体大小 |

## Admin

| Method | Path | 状态 | 说明 |
| --- | --- | --- | --- |
| GET | `/api/admin/dashboard` | local-db | 只返回可追溯统计、模型使用和排行；历史生成未保存线路字段时 `routeUsage.available=false` 且不返回推算线路数据 |
| GET | `/api/admin/dashboard/user-credit-ranking` | local-db | 用户消费排行 |
| GET/PATCH/POST/DELETE | `/api/admin/users...` | local-db | 用户状态、余额、密码、安全检查和软删除；普通列表排除 `deleted/purged`，当前管理员禁止自停用和自删除，余额不得调成负数 |
| GET/POST/DELETE | `/api/admin/recycle-bin/users...` | local-db | 只读取 `deleted` 用户；支持恢复为 `active` 或永久匿名化，非回收站用户拒绝操作 |
| GET/POST/DELETE | `/api/admin/redeem-codes` | local-db | 兑换码管理 |
| GET/PATCH | `/api/admin/orders` | disabled | 当前支付未启用且无真实订单表；GET 返回空列表和 `available=false`，PATCH 返回 `409 PAYMENT_DISABLED`，不得从用户记录伪造订单 |
| GET | `/api/admin/usage-logs` | local-db | 余额/消费日志 |
| GET/POST/PUT/DELETE | `/api/admin/api-providers` | local-db + mock | API 线路配置，兼容 New-API Base URL/displayName |
| GET/POST/PATCH/DELETE | `/api/admin/model-prices` 和 route models | local-db + mock | 模型价格；价格必须为非负数，删除使用持久 tombstone，内置模型不得在刷新后自动复现 |
| GET/POST/DELETE | `/api/admin/generate-tasks` | local-db + runtime-memory | 任务监控；只允许取消运行时 `pending/running` 任务，删除同时支持运行时任务和 SQLite 历史；历史未保存字段不得填固定值 |
| GET/PUT | `/api/admin/template-workflows` | local-db | 模板工作流，当前保存到 `app_state` |
| GET/PATCH | `/api/admin/settings` | local-db | 系统设置，当前保存到 `app_state` |

## Workflow

| Method | Path | 状态 | 说明 |
| --- | --- | --- | --- |
| POST | `/api/workflows/:id/save-json` | local-db | 保存画布 workflow JSON 到 `projects.data`，返回 `id/workflowId/savedAt` |

## PowerShell 验证

```powershell
$OutputEncoding = [console]::InputEncoding = [console]::OutputEncoding = [System.Text.UTF8Encoding]::new()
$login = Invoke-RestMethod -Method Post -Uri "http://localhost:3456/api/admin/login" -ContentType "application/json; charset=utf-8" -Body (@{ username="admin"; password="admin123" } | ConvertTo-Json)
$headers = @{ Authorization = "Bearer $($login.token)" }
Invoke-RestMethod -Method Get -Uri "http://localhost:3456/api/admin/dashboard" -Headers $headers
Invoke-RestMethod -Method Get -Uri "http://localhost:3456/api/admin/api-providers" -Headers $headers
Invoke-RestMethod -Method Get -Uri "http://localhost:3456/api/admin/generate-tasks" -Headers $headers
```
