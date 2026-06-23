# 后端维护规范

## 运行方式

```powershell
$OutputEncoding = [console]::InputEncoding = [console]::OutputEncoding = [System.Text.UTF8Encoding]::new()
cd "C:\Users\pc\Desktop\hjm-mb-clone"
npm start
```

默认地址：`http://localhost:3456`

## .env 配置

| 变量 | 默认 | 说明 |
| --- | --- | --- |
| `PORT` | `3456` | 本地服务端口 |
| `JWT_SECRET` | 本地默认值 | JWT 签名密钥，部署时必须替换 |
| `AI_API_BASE` | `https://api.openai.com/v1` | 真实 AI API 基础地址 |
| `AI_API_KEY` / `AI_TEXT_KEY` / `AI_IMAGE_KEY` | 空/占位 | 真实模型 key |
| `AI_TEXT_MODEL` | `gpt-5.5` | 文本模型名 |
| `AI_IMAGE_MODEL` | `gpt-image-2` | 图片模型名 |
| `ENABLE_REAL_AI` | `false` | 只有为 `true` 且 key 有效才调用真实 AI |
| `AI_PROVIDER_GATEWAY` | `new-api` | Provider Adapter 默认网关 |
| `NEW_API_BASE` | 空/占位 | New-API OpenAI-compatible 地址 |
| `NEW_API_KEY` | 空/占位 | New-API 服务端 token |
| `PROVIDER_TIMEOUT_MS` | `30000` | Provider 请求超时 |
| `ENABLE_REAL_EMAIL` | `false` | 预留真实邮件开关 |
| `ENABLE_REAL_PAYMENT` | `false` | 预留真实支付开关 |
| `ENABLE_REAL_STORAGE` | `false` | 预留真实云存储开关 |

## 护栏原则

- 真实 AI、邮件、支付、云存储默认关闭。
- 没有有效 key 时必须走本地 mock，不允许请求卡死。
- New-API/CPA 作为外部基础设施使用，不在本项目内重造通用 AI 网关、Token 分发、CLI OAuth 账号池。
- Provider Adapter 只能持有服务端 New-API token，不允许把 New-API/CPA key 下发给前端。
- `/api/*` 未命中必须返回 JSON，不允许返回 SPA HTML。
- 管理后台删除默认软删除，永久删除只做匿名化。
- 余额变化必须写入 `balance_logs`。
- 图片生成必须写入 `generations`。
- 管理员初始化必须幂等：`admin / admin123` 始终可恢复本地登录。

## 数据库

SQLite 文件：

- `data.db`
- `data.db-shm`
- `data.db-wal`

当前核心表：

- `users`：用户、角色、余额和状态。
- `projects`：画布项目和工作流 JSON。
- `generations`：生成记录和图库历史。
- `balance_logs`：余额变化流水。
- `redeem_codes`：兑换码。
- `app_state`：后台可变配置，包括 API 线路、模型价格、模板工作流和系统设置。

备份：

```powershell
Copy-Item "C:\Users\pc\Desktop\hjm-mb-clone\data.db" "C:\Users\pc\Desktop\hjm-mb-clone\data.backup.db"
```

恢复：

```powershell
Stop-Process -Id (Get-NetTCPConnection -LocalPort 3456 | Where-Object State -eq Listen | Select-Object -First 1).OwningProcess
Copy-Item "C:\Users\pc\Desktop\hjm-mb-clone\data.backup.db" "C:\Users\pc\Desktop\hjm-mb-clone\data.db" -Force
```

## 代码分区维护

当前先保留单文件 `server.js`，按以下区块维护：

- Auth：登录、注册、验证码、管理员登录。
- Public/User：公开线路、用户资料、项目、头像、兑换码。
- Generation/Template：图片生成、模板反推、任务查询、mock 图片。
- Workflow：画布工作流保存。
- Admin：后台所有管理接口。
- API Guards：未命中接口 JSON、全局错误 JSON。
- Start：管理员初始化和服务启动。

后续拆分模块时保持路径不变，先拆实现文件，不改前端 API。

## AI Provider 集成边界

正式接真实模型时，本项目 Provider Adapter 默认连接 New-API。CPA 只作为 New-API 的一个底层渠道。

本项目负责：

- 业务用户、项目、任务和图库记录。
- 业务余额、订单和成本映射。
- 任务重试、超时、失败状态和审计日志。

New-API/CPA 负责：

- 模型渠道聚合。
- 员工 token、额度、模型白名单和用量统计。
- Codex/Claude Code 等 CLI/OAuth 账号池和协议转换。

详细设计见 `docs/architecture-newapi-cpa.md`。

## 发布前检查

```powershell
node --check "C:\Users\pc\Desktop\hjm-mb-clone\server.js"
$bytes = [System.IO.File]::ReadAllBytes("C:\Users\pc\Desktop\hjm-mb-clone\server.js")
if ($bytes.Length -ge 3 -and $bytes[0] -eq 239 -and $bytes[1] -eq 187 -and $bytes[2] -eq 191) { "BOM" } else { "NO_BOM" }
```

## 接口冒烟

后端改动后运行：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File "C:\Users\pc\Desktop\hjm-mb-clone\scripts\smoke-api.ps1"
```

脚本覆盖：

- `/api/health`
- `/api/admin/login`
- `/api/admin/dashboard`
- `/api/admin/api-providers`
- `/api/admin/model-prices`
- `/api/admin/template-workflows`
- `/api/admin/settings`
- `/api/public/routes`
