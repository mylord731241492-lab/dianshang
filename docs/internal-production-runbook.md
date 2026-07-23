# 内网测试生产运行手册

## 当前架构边界

当前部署目标是单机 Docker 内网测试生产，不是公网正式生产。

运行形态：

- 后端唯一入口：`server.js`
- 正式容器：`dianshang-internal-gateway`、`dianshang-internal-app`、`dianshang-librechat`、`dianshang-chat-mongodb`
- 对外端口：只有统一网关暴露宿主机 `3456`；app、LibreChat、MongoDB 只在 Compose 内网通信
- 数据库：SQLite，容器内 `/app/data/data.db`，主机侧 `F:\dianshang\docker\data\data.db`
- 上传目录：容器内 `/app/uploads`，主机侧 `F:\dianshang\docker\uploads`
- 工作流目录：容器内 `/app/data/workflows`，主机侧 `F:\dianshang\docker\data\workflows`
- 日志目录：容器内 `/app/logs`，主机侧 `F:\dianshang\docker\logs`
- Chat 数据：MongoDB、LibreChat 上传、聊天图片和日志分别使用 `chat_mongodb_data`、`chat_uploads`、`chat_images`、`chat_logs` Docker 命名卷
- Chat 版本：固定 LibreChat `v0.8.6-rc1`；源码归档随项目保存，升级前不得自动漂移

前端分发规则：

- 前台继续使用根目录旧 `index.html` 和旧 `assets/` 打包资产。
- 后台 `/admin/*` 使用 `frontend/dist/index.html` 和 `frontend/dist/assets/`。
- Dockerfile 使用独立 `frontend-build` 阶段执行 `frontend/package-lock.json` 对应的 `npm ci` 和 `npm run build`，运行镜像不依赖宿主机已有或 Git 忽略的 `frontend/dist`。
- 每次修改 `frontend/src/*` 后仍须在宿主机运行一次前端构建作为 TypeScript/Vite 门禁，随后完整重建 Docker；宿主机构建产物只用于本地验证，不作为镜像输入。

当前能力状态：

- 真实 AI：开启，`ENABLE_REAL_AI=true`，`AI_PROVIDER_GATEWAY=direct`。
- 邮件：关闭，`ENABLE_REAL_EMAIL=false`。
- 找回密码：普通用户凭用户名直接设置新密码，不使用邮箱或验证码；管理员账号不开放该入口。
- 支付：关闭，`ENABLE_REAL_PAYMENT=false`。
- 对象存储：关闭，`ENABLE_REAL_STORAGE=false`。
- Chat：已启用固定内网版。主站账号通过一次性票据免登录进入 `/chat/`，LibreChat 自身登录、注册和密码重置均关闭；文本和生图仍走主站现有线路、余额和幂等计费边界。
- lingsuan 图片出站：当前 Windows 工作站保留系统代理供 Codex 使用，但正式 app 的 `LINGSUAN_IMAGE_PROXY_URL` 默认留空，容器直接访问中转，不再依赖 Clash 入口。目标服务器继续追加 `docker-compose.server-direct.yml` 显式清空该变量，防止迁移时误带代理值。两种模式都不设置容器全局 `HTTP_PROXY/HTTPS_PROXY`，其他 Provider 和文本请求直连。
- 支付与订单：支付关闭且没有真实订单表，后台订单页显示不可用空态，不再从用户记录生成演示订单。

## 发布流程

从主工作目录执行：

```powershell
$OutputEncoding = [console]::InputEncoding = [console]::OutputEncoding = [System.Text.UTF8Encoding]::new()
npm run build --prefix "F:\dianshang\frontend"
cd "F:\dianshang\docker"
docker compose --env-file ".env" -f "docker-compose.yml" -f "docker-compose.chat-production.yml" --profile chat up -d --build --force-recreate
docker compose ps
```

发布后运行内网 smoke：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File "F:\dianshang\scripts\smoke-internal-prod.ps1"
```

如果当次验收明确禁止任何兑换码增删，使用 `-ReadOnly`；该模式仍会读取兑换码列表并验证后台权限，但跳过临时兑换码创建/删除。默认模式保留完整可写 smoke。

手动检查入口：

- `http://192.168.0.39:3456/`
- `http://192.168.0.39:3456/login`
- `http://192.168.0.39:3456/canvas`
- `http://192.168.0.39:3456/admin/login`
- `http://192.168.0.39:3456/admin/settings`
- `http://192.168.0.39:3456/admin/chat-settings`
- `http://192.168.0.39:3456/admin/redeem-codes`
- `http://192.168.0.39:3456/chat/`

Chat 的无费用浏览器验收：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File "F:\dianshang\scripts\smoke-chat-production-ui.ps1"
```

该脚本复用一个已有的有效普通用户，只生成 5 分钟主站 JWT 和一次性 SSO 票据，不注册用户、不发送消息、不调用 Provider、不扣费。

登录页发布验收：点击“找回密码”，页面应只显示用户名、新密码和确认新密码；普通测试用户重置后应能使用新密码登录，管理员用户名应返回拒绝。该检查会修改测试用户密码，只能使用专门的测试账号。

## 安全配置

Docker 环境文件：`F:\dianshang\docker\.env`。

必须配置：

- `JWT_SECRET`：至少 32 位强随机字符串，不能使用默认或占位值。
- `ADMIN_BOOTSTRAP_USERNAME`：初始管理员用户名。
- `ADMIN_BOOTSTRAP_PASSWORD`：初始管理员强密码。
- `CORS_ORIGINS`：内网允许来源，示例 `http://192.168.0.39:3456,http://127.0.0.1:3456,http://localhost:3456`。
- `ENABLE_LIBRECHAT=true`。
- `LIBRECHAT_BRIDGE_SECRET`、`LIBRECHAT_JWT_SECRET`、`LIBRECHAT_JWT_REFRESH_SECRET`：彼此独立的强随机值。
- `LIBRECHAT_CREDS_KEY`：64 位十六进制；`LIBRECHAT_CREDS_IV`：32 位十六进制。
- `CHAT_PUBLIC_ORIGIN`：服务器真实内网来源，例如 `http://192.168.0.39:3456`；迁移服务器后必须同步改为新 IP。
- `CHAT_GATEWAY_PORT=3456`；正式栈禁止同时让 app 再暴露同一宿主机端口。
- `LINGSUAN_IMAGE_PROXY_URL`：默认留空并直连 `lingsuan.top`。只有经过验证的稳定 CONNECT 代理才允许在 `.env` 主动填写；不得把宿主机临时 Clash 端口当作生产默认值。目标服务器启动时仍追加 `docker-compose.server-direct.yml`，显式防止代理值随环境迁移。

迁移期配置：

- `PASSWORD_LEGACY_SECRETS`：仅用于识别旧 JWT secret 生成的历史密码哈希。用户或管理员登录成功后会自动重哈希到当前强 `JWT_SECRET`，该变量不用于 JWT 签发。

启动规则：

- 生产模式下如果没有管理员账号，且没有配置强 `ADMIN_BOOTSTRAP_PASSWORD`，服务会拒绝启动。
- 如果已有 `admin/admin123` 默认弱密码，并配置了强 `ADMIN_BOOTSTRAP_PASSWORD`，服务启动时会识别当前或迁移期旧密码哈希，并轮换为 bootstrap 强密码。
- 服务不会再每次启动都强制把管理员密码改回 `admin123`。

## 备份流程

执行：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File "F:\dianshang\scripts\backup-internal-prod.ps1" -ConfirmMaintenanceWindow
```

该命令会短暂停止 `dianshang-internal-app`，必须在已获维护窗口确认后执行。脚本会记录容器原运行状态，在同一个停止窗口内通过宿主机 `better-sqlite3` backup API 生成一致性数据库备份、执行 `quick_check` 与 `integrity_check`，并归档工作流、上传/生成图片和日志；全部采集完成后才恢复容器并等待 `healthy/running`。未传 `-ConfirmMaintenanceWindow` 时脚本会拒绝执行。

备份输出目录：

```text
F:\dianshang\docker\backup\internal-prod-YYYYMMDD-HHMMSS\
```

备份内容：

- `database\data.db`：应用容器停止期间通过宿主机 `better-sqlite3` backup API 生成的 SQLite 一致性备份。
- `archives\data.zip`：`docker\data` 归档，排除在线 SQLite 文件 `data.db`、`data.db-wal`、`data.db-shm` 和临时 `backups` 目录；数据库以 `database\data.db` 为准。
- `archives\uploads.zip`：`docker\uploads` 归档。
- `archives\logs.zip`：`docker\logs` 归档。
- `manifest.json`：Windows Docker 迁移清单，格式版本为 2；只使用相对路径，记录每个制品的字节数、SHA-256、SQLite 校验结果和 `docker/.env` 指纹。

真实 `docker/.env` 不会写入备份包，必须通过单独的安全/离线渠道复制；清单里的指纹用于确认服务器拿到的是同一份配置。`manifest.json` 同时记录维护窗口起止时间、容器原运行状态和恢复后的健康状态。若备份过程失败，脚本仍会在 `finally` 中尝试恢复原先正在运行的容器；任何恢复或健康检查失败都必须作为生产故障处理，不能继续上线。

本机无生产数据恢复演练：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File "F:\dianshang\scripts\test-windows-server-migration.ps1"
```

该测试只使用系统临时目录，不停止或修改当前生产容器，也不调用 Provider。它会验证数据库、工作流、图片、日志字节一致，并确认重复恢复和篡改迁移包都会被拒绝。

## Windows Server + Docker Compose 迁移

目标服务器先安装好 Windows 可用的 Docker Engine/Desktop 与 Docker Compose，再执行以下步骤。恢复脚本优先使用已有宿主机 Node.js；未安装 Node.js 时会复用/构建应用 Docker 镜像执行清单和 SQLite 校验，不要求为迁移额外安装 Node.js。安装 Docker 属于服务器变更，实际迁移时应另行确认维护窗口。

1. 先生成不含密钥和持久化数据的同版本源码包：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File "F:\dianshang\scripts\package-internal-prod-source.ps1"
```

输出位于 `F:\dianshang\output\releases\dianshang-source-YYYYMMDD-HHMMSS.zip`，ZIP 内 `release-manifest.json` 记录全部源码文件的字节数和 SHA-256。发布包明确排除 `.env`、SQLite、uploads、logs、backup、`node_modules` 和宿主机 `frontend/dist`。将该 ZIP 解压到目标目录，例如 `D:\dianshang`；不要从当前工作树手工挑选文件，也不要把旧服务器的持久化目录混入目标。
2. 通过单独的安全/离线渠道复制原 `F:\dianshang\docker\.env` 到目标 `D:\dianshang\docker\.env`。源码包和数据迁移包都不包含密钥。
3. 把一个已完成且校验通过的格式 v2 `internal-prod-YYYYMMDD-HHMMSS` 数据包复制到服务器，例如 `D:\migration\internal-prod-...`。
4. 确认目标 `docker\data`、`docker\uploads`、`docker\logs` 不存在或为空，然后执行恢复：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File "D:\dianshang\scripts\restore-internal-prod-windows.ps1" `
  -PackagePath "D:\migration\internal-prod-YYYYMMDD-HHMMSS" `
  -TargetDockerDir "D:\dianshang\docker" `
  -ConfirmEmptyTargetRestore
```

恢复成功后再按服务器 IP 修改 `HOST_PORT`、`CORS_ORIGINS` 等网络字段。不要更换或遗漏 `JWT_SECRET`、`PASSWORD_LEGACY_SECRETS` 和 Provider 密钥。若恢复前必须修改 `.env`，需人工确认密钥兼容后增加 `-AllowEnvironmentFileChange`。

5. 构建启动固定四容器栈并等待健康：

```powershell
docker compose --env-file "D:\dianshang\docker\.env" `
  -f "D:\dianshang\docker\docker-compose.yml" `
  -f "D:\dianshang\docker\docker-compose.chat-production.yml" `
  -f "D:\dianshang\docker\docker-compose.server-direct.yml" `
  --profile chat up -d --build --force-recreate
docker inspect --format "{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}" dianshang-internal-app
docker inspect --format "{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}" dianshang-librechat
docker inspect --format "{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}" dianshang-chat-mongodb
docker inspect --format "{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}" dianshang-internal-gateway
```

恢复脚本的 `-StartApp` 仍只负责主应用旧式启动，不代表 Chat 四容器已上线；启用 Chat 时应使用上述明确的统一网关命令。

6. 先用 `docker compose ... config` 确认 app 的 `LINGSUAN_IMAGE_PROXY_URL` 为 `""`，再从 app 容器执行不带 API Key 的 `lingsuan.top:443` 到站探针。随后使用服务器真实内网 URL 运行 `scripts/smoke-internal-prod.ps1`，并人工验证登录、项目恢复、历史生成图片和工作流加载；真实生图只在用户确认费用后执行一笔。

当前主站“云端图片”的真实保存方式是本机/服务器文件系统：图片文件位于 `docker/uploads`，引用和生成元数据位于 SQLite。迁移时二者必须成对恢复。用户已确认内部数据量较小，备份只保留在本机 `docker/backup`，不启用 S3/MinIO、云盘、NAS 或自动异地备份；实际迁移服务器时再人工复制选定的数据包。

Chat 的 MongoDB、上传、图片和日志命名卷不在当前主站迁移包内。明天首次迁移按已确认的简单方案在服务器创建全新 Chat 卷，不迁移今天的 Chat 验收账号映射和测试记录；主站用户、余额、项目、生成历史、工作流与图片仍按 SQLite + `docker/uploads` 正常迁移。以后若需要保留聊天记录或私有 Skills，必须先另做四个 Chat 命名卷的停机备份与恢复，不能假设本脚本已覆盖。

## 准生产限制

本阶段允许：

- 单机四容器固定栈，不做横向扩容。
- 小范围内网用户测试。
- 真实 AI 生成测试。
- SQLite 本地数据。
- 普通用户凭用户名直接重置密码；这是用户明确接受的小范围内网便利模式。

本阶段不允许假设已经具备：

- 多实例部署。
- 真实邮件发送。
- 真实支付闭环。
- 对象存储。
- Redis/BullMQ/AI Worker。
- 公网正式生产安全等级。

用户名直重置不验证本人身份，存在账号枚举和被他人重置的风险。扩大分发范围或进入公网前，必须替换为邮箱、短信、管理员审批或其他可靠身份校验流程。

进入公网或正式收费生产前，必须补齐数据库迁移、对象存储、队列、审计日志、访问控制、HTTPS 和备份恢复演练。
