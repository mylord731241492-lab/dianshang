# New-API + CPA 集成架构

## 结论

本平台不自研通用 AI 网关、Token 分发、模型渠道管理、CLI OAuth 账号池和底层账号轮询。正式部署优先复用持续维护的开源项目：

- New-API：统一 AI 网关、模型聚合、Token 分发、额度、统计和成本核算。
- CLIProxyAPI / CPA：封装 Codex、Claude Code 等 CLI/OAuth 账号池，并提供兼容 API。

本项目后端只负责电商业务层：用户、团队、项目、画布、模板、任务、业务余额、订单、图库、后台审计。

## 推荐调用链

7 月前内网测试阶段：

```text
内网浏览器
  ↓
Express 一体服务
  ├── 静态前端资产
  ├── /api/* 业务接口
  ├── SQLite
  └── Provider Adapter -> New-API(可选) -> CPA/上游
```

内网测试稳定后的服务器/多人阶段：

```text
Nginx / HTTPS
  ↓
Node.js API Server
  ↓
BullMQ / Redis
  ↓
AI Worker
  ↓
Provider Adapter
  ↓
New-API
  ↓
  ├── CPA / CLIProxyAPI
  ├── 官方 OpenAI / Gemini
  ├── 其他中转站
  └── 本地模型
```

## 职责边界

| 层 | 负责 | 不负责 |
| --- | --- | --- |
| Node API | 业务鉴权、项目、模板、任务、业务扣费、图库、后台审计 | 直接管理所有模型渠道和底层账号池 |
| AI Worker | 执行生成任务、重试、超时、写入任务结果 | 直接暴露模型 key 给前端 |
| Provider Adapter | 轻量路由、请求格式适配、错误标准化 | 重造 New-API 的 Token/额度/模型管理 |
| New-API | 统一模型网关、Token、额度、统计、渠道管理 | 业务订单、画布项目、图库资产 |
| CPA | Codex/Claude Code 等 CLI/OAuth 账号池和协议转换 | 公司员工额度、业务层账单 |

## 双层额度

公司多人用时必须保留双层控制：

- New-API 层：控制内部员工 token、模型白名单、底层渠道额度和用量统计。
- 本平台 Billing 层：控制业务用户余额、订单、项目成本和素材生成消费。

两层都要有日志。New-API 记录底层模型调用，本平台记录业务用户为什么调用、属于哪个项目、生成了什么结果。

## Provider Adapter 原则

- 默认目标是 New-API，而不是散连多个模型服务。
- Adapter 只保留最小接口：`estimateCost`、`generateImage`、`reversePrompt`、`chat`、`getModels`、`healthCheck`。
- 没配置 New-API 或真实 key 时必须回落 mock。
- 不在本项目存储 CPA 真实账号密码或 OAuth 敏感信息。
- 所有真实调用都必须有 taskId、userId、projectId、provider、model、costEstimate 和错误码。

## 部署建议

内网测试优先使用当前仓库的 `docker-compose.internal.yml` 或 PM2，不把 New-API/CPA 打进本项目镜像。New-API 和 CPA 可以单独部署，也可以先使用已有可访问实例。

正式服务器和多人规模化后，建议使用独立 Compose 编排：

```text
nginx
app-api
worker
postgres
redis
new-api
cpa
```

早期内测可先用 PM2 + SQLite + 外部 New-API，但多人团队和计费上线前应迁移到 Postgres + Redis。

## 风险与护栏

- CPA 账号池属于高风险底层能力，应限制为内网或 New-API 后置渠道，不直接暴露给员工。
- 真实供应商条款、账号共享限制和调用成本由部署方负责确认。
- 不把 New-API/CPA 管理后台凭据提交到仓库。
- 员工只拿 New-API 发放的 token，不接触 CPA 和真实上游 key。
- 内网测试阶段不要求真实 New-API 联通；无 key 或未启用真实 AI 时必须保持 mock 回落。
- 服务器部署前再强制校验 New-API token、访问域名、HTTPS 和日志/备份策略。
