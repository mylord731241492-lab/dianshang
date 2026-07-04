# 内网测试生产运行手册

## 当前架构边界

当前部署目标是单机 Docker 内网测试生产，不是公网正式生产。

运行形态：

- 后端唯一入口：`server.js`
- 容器：`dianshang-internal-app`
- 数据库：SQLite，容器内 `/app/data/data.db`，主机侧 `F:\dianshang\docker\data\data.db`
- 上传目录：容器内 `/app/uploads`，主机侧 `F:\dianshang\docker\uploads`
- 工作流目录：容器内 `/app/data/workflows`，主机侧 `F:\dianshang\docker\data\workflows`
- 日志目录：容器内 `/app/logs`，主机侧 `F:\dianshang\docker\logs`

前端分发规则：

- 前台继续使用根目录旧 `index.html` 和旧 `assets/` 打包资产。
- 后台 `/admin/*` 使用 `frontend/dist/index.html` 和 `frontend/dist/assets/`。
- 每次修改 `frontend/src/*` 后，必须先构建 `frontend/dist`，再重建 Docker。

当前能力状态：

- 真实 AI：开启，`ENABLE_REAL_AI=true`，`AI_PROVIDER_GATEWAY=direct`。
- 邮件：关闭，`ENABLE_REAL_EMAIL=false`。
- 支付：关闭，`ENABLE_REAL_PAYMENT=false`。
- 对象存储：关闭，`ENABLE_REAL_STORAGE=false`。

## 发布流程

从主工作目录执行：

```powershell
$OutputEncoding = [console]::InputEncoding = [console]::OutputEncoding = [System.Text.UTF8Encoding]::new()
npm run build --prefix "F:\dianshang\frontend"
cd "F:\dianshang\docker"
docker compose up --build -d
docker compose ps
```

发布后运行内网 smoke：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File "F:\dianshang\scripts\smoke-internal-prod.ps1"
```

手动检查入口：

- `http://192.168.0.39:3456/`
- `http://192.168.0.39:3456/login`
- `http://192.168.0.39:3456/canvas`
- `http://192.168.0.39:3456/admin/login`
- `http://192.168.0.39:3456/admin/settings`
- `http://192.168.0.39:3456/admin/redeem-codes`

## 安全配置

Docker 环境文件：`F:\dianshang\docker\.env`。

必须配置：

- `JWT_SECRET`：至少 32 位强随机字符串，不能使用默认或占位值。
- `ADMIN_BOOTSTRAP_USERNAME`：初始管理员用户名。
- `ADMIN_BOOTSTRAP_PASSWORD`：初始管理员强密码。
- `CORS_ORIGINS`：内网允许来源，示例 `http://192.168.0.39:3456,http://127.0.0.1:3456,http://localhost:3456`。

迁移期配置：

- `PASSWORD_LEGACY_SECRETS`：仅用于识别旧 JWT secret 生成的历史密码哈希。用户或管理员登录成功后会自动重哈希到当前强 `JWT_SECRET`，该变量不用于 JWT 签发。

启动规则：

- 生产模式下如果没有管理员账号，且没有配置强 `ADMIN_BOOTSTRAP_PASSWORD`，服务会拒绝启动。
- 如果已有 `admin/admin123` 默认弱密码，并配置了强 `ADMIN_BOOTSTRAP_PASSWORD`，服务启动时会识别当前或迁移期旧密码哈希，并轮换为 bootstrap 强密码。
- 服务不会再每次启动都强制把管理员密码改回 `admin123`。

## 备份流程

执行：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File "F:\dianshang\scripts\backup-internal-prod.ps1"
```

备份输出目录：

```text
F:\dianshang\docker\backup\internal-prod-YYYYMMDD-HHMMSS\
```

备份内容：

- `database\data.db`：通过容器内 `better-sqlite3` backup API 生成的 SQLite 备份。
- `archives\data.zip`：`docker\data` 归档，排除在线 SQLite 文件 `data.db`、`data.db-wal`、`data.db-shm` 和临时 `backups` 目录；数据库以 `database\data.db` 为准。
- `archives\uploads.zip`：`docker\uploads` 归档。
- `archives\logs.zip`：`docker\logs` 归档。
- `manifest.json`：备份清单。

恢复演练建议：

1. 停止容器：`docker compose down`
2. 复制当前 `docker\data`、`docker\uploads` 到临时目录再演练，避免覆盖线上数据。
3. 将备份中的 `database\data.db` 放入临时 `data` 目录。
4. 解压 uploads/workflows/logs 到临时目录。
5. 用临时 Compose 或临时目录启动验证。

## 准生产限制

本阶段允许：

- 单机单容器。
- 小范围内网用户测试。
- 真实 AI 生成测试。
- SQLite 本地数据。

本阶段不允许假设已经具备：

- 多实例部署。
- 真实邮件发送。
- 真实支付闭环。
- 对象存储。
- Redis/BullMQ/AI Worker。
- 公网正式生产安全等级。

进入公网或正式收费生产前，必须补齐数据库迁移、对象存储、队列、审计日志、访问控制、HTTPS 和备份恢复演练。
