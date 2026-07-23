# 内网 Docker 运行目录

这个目录是独立运行目录。Compose 从上级项目目录构建镜像，但运行数据固定挂载到本目录：

- `docker/data`：SQLite 数据库
- `docker/uploads`：用户上传文件
- `docker/logs`：运行日志
- `docker/backup`：手工备份目录

当前阶段定位：内网试运行/验收环境。不要把本目录配置直接用于公网生产。

## 首次启动

```powershell
cd "F:\dianshang\docker"
Copy-Item ".env.example" ".env"
notepad ".env"
docker compose up -d --build
```

如果开发目录里已经运行了 `node server.js` 并占用 `3456`，二选一：

```powershell
# 方案一：先停掉当前 Node 服务，再用 Docker 占用 3456
Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -match 'server\.js' -and $_.CommandLine -match 'node' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
```

```env
# 方案二：保持当前 Node 服务，把 docker\.env 里的宿主机端口改成 3457
HOST_PORT=3457
```

启动后访问：

```text
http://127.0.0.1:3456
http://192.168.0.39:3456
```

## 内网验收

推荐用本目录脚本启动并验证：

```powershell
cd "F:\dianshang\docker"
powershell -NoProfile -ExecutionPolicy Bypass -File ".\verify-internal.ps1"
```

脚本会执行：

- `docker compose config`
- `docker compose up --build -d`
- `/api/health`
- API smoke
- 前端路由 smoke
- Provider guard smoke

默认不运行 Playwright UI smoke。需要完整 UI 检查时：

```powershell
$env:SMOKE_UI="true"
powershell -NoProfile -ExecutionPolicy Bypass -File ".\verify-internal.ps1"
Remove-Item Env:\SMOKE_UI
```

## Chat 正式内网栈

正式版固定为统一网关、主应用、LibreChat、MongoDB 四个容器，只有网关暴露宿主机 `3456`：

```powershell
cd "F:\dianshang\docker"
docker compose --env-file ".env" -f "docker-compose.yml" -f "docker-compose.chat-production.yml" --profile chat up -d --build --force-recreate
docker compose ps
```

`integrations/librechat/upstream/LibreChat-0.8.6-rc1.tar.gz` 已随源码固定，不依赖本机 `F:\dev-cache`。常规重建不要执行 `docker compose down -v`，否则会删除 Chat 的 MongoDB、上传、图片和日志卷。

当前 Windows 工作站保留 Windows 系统代理供 Codex 等宿主机应用使用，但正式 app 默认把 `LINGSUAN_IMAGE_PROXY_URL` 留空并直接访问 `lingsuan.top`。2026-07-22 已在系统代理仍开启时完成容器直连连续探测，避免 Clash 关闭、切换配置或 core 重载中断生图。Packy、其他图片域名和文本请求同样保持直连；容器全局 `HTTP_PROXY`、`HTTPS_PROXY` 与 `ALL_PROXY` 必须为空。

目标服务器直接访问图片中转时，仍建议把 `docker-compose.server-direct.yml` 作为最后一个覆盖文件。它会显式清空 `LINGSUAN_IMAGE_PROXY_URL`，避免迁移时误带代理环境变量：

```powershell
docker compose --env-file ".env" -f "docker-compose.yml" -f "docker-compose.chat-production.yml" -f "docker-compose.server-direct.yml" --profile chat up -d --build --force-recreate
```

服务器启动前应先确认其 Docker 容器可以直连 `lingsuan.top:443`。当前工作站使用两文件或追加该覆盖文件，最终都应解析为空；需要代理时只能在 `.env` 中主动填写稳定地址。

无 Provider、无扣费的页面验收：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File "F:\dianshang\scripts\smoke-chat-production-ui.ps1"
```

## Chat 真实中转测试栈

`3464` 可以只读复用主站 `data.db` 中已经配置的文本线路，不在命令行或浏览器输出 API Key：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File "F:\dianshang\scripts\start-librechat-real-test.ps1" -Port 3464 -Build
```

普通集成 smoke 不调用真实 Provider：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File "F:\dianshang\scripts\smoke-librechat-integration.ps1" -BaseUrl "http://127.0.0.1:3464"
```

LibreChat 的普通上传文件与聊天图片分别持久化到 Docker 卷中的 `/app/uploads` 和 `/app/client/public/images`。重建容器不会删除新上传的附件；执行 `docker compose down -v` 会删除这些卷，不可用于保留数据的常规重启。

真实文本中转 smoke 可能消耗 Provider 额度，必须显式确认：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File "F:\dianshang\scripts\smoke-librechat-real-provider.ps1" -BaseUrl "http://127.0.0.1:3464" -ConfirmPaidCall
```

## 常用命令

```powershell
cd "F:\dianshang\docker"
docker compose ps
docker compose logs -f app
docker compose restart app
docker compose down
docker compose up -d --build
```

## Windows 防火墙

局域网访问前开放端口：

```powershell
New-NetFirewallRule -DisplayName "Dianshang Internal 3456" -Direction Inbound -Protocol TCP -LocalPort 3456 -Action Allow
```

## 升级代码

```powershell
cd "F:\dianshang"
git pull origin main
cd "F:\dianshang\docker"
powershell -NoProfile -ExecutionPolicy Bypass -File ".\verify-internal.ps1"
```

升级不会删除 `docker/data`、`docker/uploads`、`docker/logs`。

## 备份

使用项目脚本在同一维护窗口内备份 SQLite、工作流、图片和日志：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File "F:\dianshang\scripts\backup-internal-prod.ps1" -ConfirmMaintenanceWindow
```

输出位于 `docker\backup\internal-prod-YYYYMMDD-HHMMSS`。`manifest.json` 包含相对路径、每个制品的 SHA-256、SQLite 完整性结果和 `docker/.env` 指纹；真实 `.env` 不进入备份包，必须单独安全复制。

迁移到 Windows Server + Docker Compose 前，可先做不接触生产数据的恢复演练：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File "F:\dianshang\scripts\test-windows-server-migration.ps1"
```

服务器恢复命令和 `.env`、空目标目录门禁见 `docs/internal-production-runbook.md`。恢复脚本不会覆盖已有 `data/uploads/logs`。

## 注意

- `.env` 不要提交到 Git。
- 内网测试必须放在 VPN、内网网段或访问白名单后面，不开放公网端口。
- `JWT_SECRET` 内网长期试运行前必须换成长随机值；占位值只允许本机 smoke。
- 当前阶段保持 `ENABLE_REAL_PAYMENT=false`。
- `ENABLE_REAL_AI=true` 后会走真实 Provider，可能产生真实调用和扣费。
- 需要真实 AI 点测时，先限制测试账号和额度。
- 管理员默认账号仍是当前代码的内网遗留风险，正式对外前必须整改。
- 根目录静态暴露、CORS、安全头、密码哈希、限流和健康信息泄露仍是公网预生产门禁项。
- 内网生产建议固定服务器 IP，并用 `http://服务器IP:3456` 访问。
