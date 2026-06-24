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
- `real-provider-ready`：接口形状已预留真实服务接入，但默认关闭。

## Auth

| Method | Path | 状态 | 请求 | 响应 |
| --- | --- | --- | --- | --- |
| POST | `/api/auth/login` | local-db | `username,password` | `token,user` |
| POST | `/api/auth/register` | local-db | `username,email,password,code` | `token,user` |
| POST | `/api/auth/send-email-code` | mock | `email,type` | `ok,code,cooldown,expiresIn` |
| POST | `/api/auth/send-reset-code` | mock | `email` | `message,cooldown,expiresIn` |
| POST | `/api/auth/reset-password` | local-db | `email,code,password/newPassword` | `success,message` |
| POST | `/api/admin/login` | local-db | `username,password` | `token,user` |

## User

| Method | Path | 状态 | 说明 |
| --- | --- | --- | --- |
| GET | `/api/user/profile` | local-db | 当前用户资料 |
| GET | `/api/user/routes` | mock | 可用 API 线路 |
| GET | `/api/user/models` | mock | 指定线路模型 |
| GET | `/api/user/api-status` | mock | 当前线路状态 |
| GET | `/api/user/balance-logs` | local-db | 余额流水 |
| GET | `/api/user/generations` | local-db | 图片历史 |
| GET/POST/PUT/DELETE | `/api/user/projects` | local-db | 画布项目 |
| POST/PUT | `/api/user/avatar...` | local-db | 头像上传/设置 |
| POST | `/api/user/redeem` | local-db | 兑换码 |

## Generation / Template

| Method | Path | 状态 | 说明 |
| --- | --- | --- | --- |
| POST | `/api/generation/estimate-cost` | mock | 估算点数 |
| POST | `/api/generate/tasks` | mock + local-db | 创建完成态生成任务，写 `generations` |
| GET | `/api/generate/tasks/:id` | mock | 查询内存任务 |
| POST | `/api/template/reverse-prompt` | mock | 返回提示词建议 |
| POST | `/api/template/generate-image` | mock + local-db | 返回本地 SVG 图并写历史 |
| POST | `/api/chat/completions` | mock / real-provider-ready | 默认 mock；仅 `ENABLE_REAL_AI=true` 且 key 有效时调用真实接口 |
| GET | `/api/mock-image/:id.svg` | mock | 本地占位图 |

## Admin

| Method | Path | 状态 | 说明 |
| --- | --- | --- | --- |
| GET | `/api/admin/dashboard` | local-db + mock | 统计、模型使用、排行、线路使用 |
| GET | `/api/admin/dashboard/user-credit-ranking` | local-db | 用户消费排行 |
| GET/PATCH/POST/DELETE | `/api/admin/users...` | local-db | 用户状态、余额、密码、软删除 |
| GET/POST/DELETE | `/api/admin/redeem-codes` | local-db | 兑换码管理 |
| GET/PATCH | `/api/admin/orders` | mock | 订单列表与状态 |
| GET | `/api/admin/usage-logs` | local-db | 余额/消费日志 |
| GET/POST/PUT/DELETE | `/api/admin/api-providers` | local-db + mock | API 线路配置，兼容 New-API Base URL/displayName |
| GET/POST/PATCH/DELETE | `/api/admin/model-prices` 和 route models | local-db + mock | 模型价格 |
| GET/POST/DELETE | `/api/admin/generate-tasks` | local-db + mock | 任务监控 |
| GET/PUT | `/api/admin/template-workflows` | local-db | 模板工作流，当前保存到 `app_state` |
| GET/PATCH | `/api/admin/settings` | local-db | 系统设置，当前保存到 `app_state` |

## Workflow

| Method | Path | 状态 | 说明 |
| --- | --- | --- | --- |
| POST | `/api/workflows/:id/save-json` | local-db | 保存画布工作流到 `projects` |

## PowerShell 验证

```powershell
$OutputEncoding = [console]::InputEncoding = [console]::OutputEncoding = [System.Text.UTF8Encoding]::new()
$login = Invoke-RestMethod -Method Post -Uri "http://localhost:3456/api/admin/login" -ContentType "application/json; charset=utf-8" -Body (@{ username="admin"; password="admin123" } | ConvertTo-Json)
$headers = @{ Authorization = "Bearer $($login.token)" }
Invoke-RestMethod -Method Get -Uri "http://localhost:3456/api/admin/dashboard" -Headers $headers
Invoke-RestMethod -Method Get -Uri "http://localhost:3456/api/admin/api-providers" -Headers $headers
Invoke-RestMethod -Method Get -Uri "http://localhost:3456/api/admin/generate-tasks" -Headers $headers
```
