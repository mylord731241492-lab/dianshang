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

## Chat 服务（已移除）

LibreChat 已在本候选支线移除（2026-08-06）：`integrations/librechat/`、chat-mongodb/librechat/gateway 容器、nginx 网关、SSO/桥接 API、前端 Chat 设置页与相关脚本均已删除；主站文本/生图与画布聊天不受影响。
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
