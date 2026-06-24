# 部署与维护说明

## 当前定位

本项目当前是打包后的 Vue 前端资产 + Express/SQLite 本地后端。默认运行在 mock 模式，真实 AI、邮件、支付、云存储都必须显式开启。

## AI 网关原则

正式部署不在本项目里重造通用 AI 网关。优先复用：

- New-API：统一模型网关、Token 分发、额度、统计和渠道管理。
- CLIProxyAPI / CPA：作为 New-API 后置渠道，处理 Codex、Claude Code 等 CLI/OAuth 账号池。

本项目只做业务平台和 Provider Adapter，默认把真实模型调用转发给 New-API。员工或内部工具只拿 New-API token，不直接接触 CPA 或真实上游 key。

## 本地启动

```powershell
$OutputEncoding = [console]::InputEncoding = [console]::OutputEncoding = [System.Text.UTF8Encoding]::new()
Copy-Item ".env.example" ".env"
npm install
npm start
```

默认地址：

- 前台：`http://127.0.0.1:3456/`
- 后台：`http://127.0.0.1:3456/admin/login`
- 管理员：`admin / admin123`

## 两段式部署路线

当前按“先内网测试，再服务器部署”的顺序推进：

| 阶段 | 目标 | 真实服务 | 验收重点 |
| --- | --- | --- | --- |
| 内网测试 | 公司内网或单机可访问，前端流程和后台管理可验收 | 默认关闭，New-API 可选 | mock 跑通、SQLite 持久化、后台配置不丢、页面入口可用 |
| 服务器部署 | 内网测试稳定后迁到正式服务器 | 按需开启 New-API，不默认开启支付/邮件/存储 | `.env` 密钥、Nginx/HTTPS、备份恢复、重启健康检查、访问权限 |

画布当前保持本地优先：浏览器本地项目、用户授权的本地文件夹、JSON 导入/导出。服务器端优先承载用户、后台配置、模板、图库、生成记录和业务接口，不在本阶段强制接管画布本地 JSON。

## 内网 Docker Compose 部署

当前推荐的 7 月前内网部署方式是轻量 Docker Compose：一个 Node.js 一体服务承载静态前端、`/api/*`、SQLite、uploads 和 logs。New-API/CPA 作为外部服务配置，不在本项目容器里重造。

首次部署：

```powershell
$OutputEncoding = [console]::InputEncoding = [console]::OutputEncoding = [System.Text.UTF8Encoding]::new()
Copy-Item ".env.example" ".env"
docker compose -f docker-compose.internal.yml config
docker compose -f docker-compose.internal.yml up --build -d
```

Docker 默认使用 `node:20-bookworm`。项目依赖 `better-sqlite3`，在 `node:20-bookworm-slim` 里可能因为缺少 `python3/make/g++` 触发构建失败；内网测试优先用完整 Debian Node 镜像，减少额外 apt 源配置。

`.env` 不是 mock 启动的硬依赖。没有 `.env` 时，`docker-compose.internal.yml` 会使用安全占位默认值，`ENABLE_REAL_AI=false`，Provider Adapter 保持 mock 回落。生产或内网正式使用前仍建议复制 `.env.example` 为 `.env`，至少修改 `JWT_SECRET`，再按需填写 New-API 配置。

访问地址：

- 前台：`http://服务器IP:3456/`
- 后台：`http://服务器IP:3456/admin/login`
- 健康检查：`http://服务器IP:3456/api/health`

持久化数据：

- `dianshang-data`：SQLite 数据库，容器内路径 `/app/data/data.db`
- `dianshang-uploads`：用户上传文件，容器内路径 `/app/uploads`
- `dianshang-logs`：运行日志预留目录，容器内路径 `/app/logs`

常用命令：

```powershell
docker compose -f docker-compose.internal.yml ps
docker compose -f docker-compose.internal.yml logs -f app
docker compose -f docker-compose.internal.yml restart app
docker compose -f docker-compose.internal.yml down
```

部署验收：

```powershell
Invoke-RestMethod -Method Get -Uri "http://127.0.0.1:3456/api/health"
$env:SMOKE_BASE_URL = "http://127.0.0.1:3456"
powershell -NoProfile -ExecutionPolicy Bypass -File "scripts\smoke-api.ps1"
```

推荐在服务器上跑完整验收脚本：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File "scripts\verify-internal-deploy.ps1"
```

该脚本会执行：

- `docker compose -f docker-compose.internal.yml config`
- `docker compose -f docker-compose.internal.yml up --build -d`
- `/api/health`
- `scripts\smoke-api.ps1`
- `scripts\smoke-frontend-routes.ps1`
- 容器 `restart` 后再次检查健康状态

内网测试阶段允许无 `.env` 或 `.env` 仍为占位值，脚本会警告但继续 mock 验收。服务器正式部署前建议开启严格检查：

```powershell
$env:REQUIRE_ENV_FILE = "true"
$env:REQUIRE_PRODUCTION_SECRETS = "true"
powershell -NoProfile -ExecutionPolicy Bypass -File "scripts\verify-internal-deploy.ps1"
```

后台写操作 smoke 默认不会跑。只有在临时库或测试服务器上明确允许时才开启：

```powershell
$env:SMOKE_ALLOW_WRITES = "true"
powershell -NoProfile -ExecutionPolicy Bypass -File "scripts\verify-internal-deploy.ps1"
```

不要在正式业务库上随手开启 `SMOKE_ALLOW_WRITES=true`。

## 环境变量

| 字段 | 默认 | 说明 |
| --- | --- | --- |
| `PORT` | `3456` | 本地服务端口 |
| `JWT_SECRET` | 本地开发默认值 | 生产环境必须改成长随机值 |
| `DATA_DIR` | `.` | 运行数据目录，Docker 中为 `/app/data` |
| `DB_PATH` | `./data.db` | SQLite 数据库路径，Docker 中为 `/app/data/data.db` |
| `UPLOAD_DIR` | `./uploads` | 上传目录，Docker 中为 `/app/uploads` |
| `LOG_DIR` | `./logs` | 日志目录，Docker 中为 `/app/logs` |
| `ENABLE_REAL_AI` | `false` | 是否启用真实 AI 调用 |
| `ENABLE_REAL_EMAIL` | `false` | 是否启用真实邮件 |
| `ENABLE_REAL_PAYMENT` | `false` | 是否启用真实支付 |
| `ENABLE_REAL_STORAGE` | `false` | 是否启用真实云存储 |
| `AI_PROVIDER_GATEWAY` | `new-api` | Provider Adapter 网关类型，正式部署默认 New-API |
| `NEW_API_BASE` | New-API 占位地址 | New-API OpenAI-compatible 入口 |
| `NEW_API_KEY` | 占位值 | New-API 分配给本平台服务端的 token |
| `PROVIDER_TIMEOUT_MS` | `30000` | Provider 调用超时时间 |
| `AI_API_BASE` | provider 占位地址 | OpenAI-compatible 服务地址 |
| `AI_IMAGE_KEY` | 占位值 | 生图 key，不允许提交到 Git |
| `AI_TEXT_KEY` | 占位值 | 文本 key，不允许提交到 Git |
| `AI_IMAGE_MODEL` | `gpt-image-2` | 生图模型名 |
| `AI_TEXT_MODEL` | `gpt-5.5` | 文本模型名 |

New-API 生产配置示例：

```env
ENABLE_REAL_AI=true
AI_PROVIDER_GATEWAY=new-api
NEW_API_BASE=https://new-api.example.com/v1
NEW_API_KEY=sk-your-new-api-token
```

未配置 `ENABLE_REAL_AI=true` 或未提供有效 `NEW_API_KEY` 时，Provider Adapter 必须保持 mock 模式。

## 健康检查

```powershell
Invoke-RestMethod -Method Get -Uri "http://127.0.0.1:3456/api/health"
```

健康检查应返回服务状态、数据库状态、mock/real provider 开关和关键表数量。

## SQLite 备份与恢复

备份前建议先停止服务，或至少同时保留 WAL 文件。

```powershell
Copy-Item "data.db" "backup\data.db"
Copy-Item "data.db-wal" "backup\data.db-wal" -ErrorAction SilentlyContinue
Copy-Item "data.db-shm" "backup\data.db-shm" -ErrorAction SilentlyContinue
```

恢复时停止服务后覆盖同名文件，再启动服务。

## PM2 部署参考

```powershell
npm install -g pm2
pm2 start server.js --name dianshang
pm2 save
```

## Nginx 反代参考

```nginx
server {
  listen 80;
  server_name example.com;

  location / {
    proxy_pass http://127.0.0.1:3456;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

## 入库规则

- 提交源码、构建前端资产、文档、模板数据。
- 不提交 `.env`、`node_modules/`、`data.db*`、`uploads/`、日志和临时文件。
- 真实 key 只放本机 `.env` 或后续后台安全配置。

## 后续维护顺序

1. 稳定前端 1:1 验收。
2. 内网测试通过 Docker Compose/PM2 跑通，并验证 SQLite、uploads、logs 持久化。
3. 将后台设置、API 线路、模型价格、模板工作流持久化到 SQLite。
4. 拆分 `server.js` 为 Auth/User/Projects/Generation/Template/Admin/Provider/DB 模块。
5. 增加自动化接口冒烟测试。
6. 通过 Provider Adapter 对接 New-API，不直接重造 New-API/CPA 已有能力。
7. 服务器部署前补齐 `.env`、Nginx/HTTPS、备份恢复和访问权限。
8. 公司多人规模化前再迁移到 Postgres + Redis + BullMQ。
