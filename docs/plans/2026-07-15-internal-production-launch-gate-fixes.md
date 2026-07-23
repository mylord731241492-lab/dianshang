# 内网生产上线门禁收口实施计划

> **执行要求：** 按本计划逐项测试、实现、验证；生产数据备份必须在明确维护窗口确认后执行。

**目标：** 在不修改注册和兑换码流程的前提下，使当前主站能够从完整源码在 Windows + Docker 上可复现构建，并消除会误导管理员或导致迁移失败的上线阻塞项。

**架构：** 保持现有 Express + SQLite + bind mount 和唯一 `/canvas` 画布。Docker 使用多阶段构建生成 `frontend/dist`；主站继续分发根目录旧前台资产，源码后台和图库由镜像内构建产物提供。Chat 未正式部署时由公开状态接口和前端入口门禁共同隐藏，正式启用仍走既有 Compose `chat` profile 和统一网关。

**技术栈：** Node.js 20、Express、SQLite、Vue 3、Vite、TypeScript、Docker Compose、PowerShell。

---

## 范围与不变项

- 不修改普通用户注册流程。
- 不修改兑换码接口、页面或数据。
- 不启用真实邮件、支付、对象存储或新的基础设施。
- 不调用真实 Provider，不产生付费请求。
- 不另建画布，不改变现有工作流 JSON。
- 不覆盖现有 SQLite、上传图片、工作流或日志。
- 当前工作树包含用户已有修改，本轮不自动创建 Git 提交。

### 任务 1：建立上线门禁回归测试

**文件：**

- 新建：`scripts/test-internal-production-launch-gates.js`
- 修改：`scripts/test-launch-security-guards.js`

**步骤 1：编写 Docker 构建契约断言**

- 断言 `Dockerfile` 存在独立前端构建阶段。
- 断言前端阶段执行 `npm ci` 和 `npm run build`。
- 断言运行镜像从构建阶段复制 `/frontend/dist`。
- 断言 `.dockerignore` 排除所有层级的 `node_modules`、本地 `frontend/dist`、真实 `.env` 和持久化数据。

**步骤 2：编写临时生产服务 API 断言**

- 使用临时 SQLite、uploads 和 logs 启动生产模式服务。
- 创建管理员和普通用户测试数据。
- 断言 `/api/admin/orders` 返回 `available=false` 和空真实订单，而不是从用户伪造订单。
- 断言订单状态修改接口返回不可用错误，而不是假装保存成功。
- 断言 Dashboard 今日统计按真实日期计算，线路统计在无线路字段时明确不可用。
- 断言任务历史不伪造线路、尺寸、参考图和队列模式。
- 断言管理员重置密码成功但响应不包含明文密码，并验证新密码可以登录。
- 断言 `/api/chat/status` 在 `ENABLE_LIBRECHAT=false` 时返回不可用。

**步骤 3：运行测试并确认修复前失败**

运行：

```powershell
node "F:\dianshang\scripts\test-internal-production-launch-gates.js"
```

预期：至少因 Docker 未自动构建前端、伪造订单、密码回显或缺少 Chat 状态接口而失败。

### 任务 2：使 Docker 构建完全可复现

**文件：**

- 修改：`Dockerfile`
- 修改：`.dockerignore`
- 修改：`docs/internal-production-runbook.md`

**步骤 1：增加前端构建阶段**

- 使用与运行镜像一致的 Node 20 基础镜像。
- 先复制 `frontend/package*.json` 并执行 `npm ci`，利用依赖层缓存。
- 再复制 `frontend/` 源码并执行 `npm run build`。

**步骤 2：复制构建产物到运行镜像**

- 根应用继续执行 `npm ci --omit=dev`。
- 复制主站源码后，从前端构建阶段覆盖 `/app/frontend/dist`。
- 不依赖宿主机已有 `frontend/dist`。

**步骤 3：收紧构建上下文**

- 排除任意层级 `node_modules`。
- 排除宿主机 `frontend/dist`，证明镜像只能使用源码构建结果。
- 继续排除 `.env`、数据库、uploads、logs 和 backup。

**步骤 4：验证干净构建**

运行：

```powershell
docker build --no-cache -t dianshang-launch-gate-test:local "F:\dianshang"
docker run --rm --entrypoint node dianshang-launch-gate-test:local -e "const fs=require('fs');if(!fs.existsSync('/app/frontend/dist/index.html'))process.exit(1)"
```

预期：镜像内存在源码新构建的 `frontend/dist/index.html`，镜像内不存在 `.env`。

### 任务 3：消除后台伪造或误导数据

**文件：**

- 修改：`server.js`
- 修改：`frontend/src/api/adminDashboard.ts`
- 修改：`frontend/src/api/adminOrders.ts`
- 修改：`frontend/src/api/adminGenerateTasks.ts`
- 修改：`frontend/src/views/AdminDashboardSource.vue`
- 修改：`frontend/src/views/AdminOrdersSource.vue`
- 修改：`frontend/src/views/AdminGenerateTasksSource.vue`

**步骤 1：Dashboard 只返回可追溯统计**

- 用户总数、生成总数、余额、消耗、模型用量继续从 SQLite 聚合。
- 今日新增用户和今日生成数使用 SQLite 当日本地日期过滤。
- 支付关闭时今日订单金额返回 0，并通过 `dataQuality.ordersAvailable=false` 标注。
- `generations` 没有线路字段时，线路统计返回空列表和 `available=false`，不再平均分摊次数与消耗。

**步骤 2：订单页停止伪造数据**

- `/api/admin/orders` 返回空列表、`available=false` 和“支付未启用”的说明。
- `/api/admin/orders/:id/status` 返回 409 `PAYMENT_DISABLED`。
- 页面显示明确提示，不把用户注册记录包装成微信/支付宝/Stripe 订单。

**步骤 3：任务历史停止填充未知字段**

- 历史 `generations` 仅返回数据库真实存在的用户、模型、提示词、结果、状态、成本和记录时间。
- 未存储的线路、尺寸、质量、参考图数量不再填固定值。
- 内存任务继续显示运行态真实字段；汇总队列模式改为“内存任务 + 历史记录”，不再称 `local-mock`。
- 页面把缺失字段显示为“未记录”，不显示伪造默认线路和 1024×1024。

**步骤 4：管理员重置密码响应脱敏**

- 保留显式新密码要求和现有更新逻辑。
- 成功响应只返回 `success` 和提示，不返回 `password`。

### 任务 4：Chat 未部署时隐藏入口

**文件：**

- 修改：`server.js`
- 修改：`assets/chat-entry-link.js`
- 修改：`index.html`
- 修改：`docs/api-contracts.md`
- 修改：`docs/api-contract-next.md`

**步骤 1：增加无敏感信息的公开状态接口**

- `GET /api/chat/status` 只返回部署开关、访问可用状态、维护提示和 `/chat/` 路径。
- 不返回 Provider Key、桥接密钥、MongoDB 地址或内部 URL。

**步骤 2：入口脚本先检查状态**

- 首页插入 AI 对话入口前请求公开状态。
- 部署关闭或访问关闭时移除入口并停止观察器。
- 登录后的 Chat 回跳也必须在状态可用时执行。
- 请求失败默认不展示入口。

**步骤 3：更新静态资源 query**

- 更新 `index.html` 中 `chat-entry-link.js` 的版本 query，隔离浏览器旧缓存。

### 任务 5：生成不含密钥和数据的源码发布包

**文件：**

- 新建：`scripts/package-internal-prod-source.ps1`
- 新建：`scripts/test-internal-prod-source-package.ps1`
- 修改：`docs/internal-production-runbook.md`

**步骤 1：实现发布包生成**

- 从当前完整工作树生成时间戳 ZIP，保留源码相对路径。
- 排除 `.git`、缓存、`node_modules`、`frontend/dist`、`.env`、SQLite、uploads、logs、backup、output 和临时目录。
- 在 ZIP 内写入 `release-manifest.json`，记录每个文件相对路径、字节数和 SHA-256。

**步骤 2：实现安全测试**

- 在系统临时目录生成一次发布包。
- 断言包含 `server.js`、`Dockerfile`、Compose、前端 package lock 和关键源码。
- 断言不包含任何真实 `.env`、数据库、上传图片、日志、备份、`node_modules` 或宿主机构建产物。
- 校验清单列出的每个文件哈希。

**步骤 3：生成最终源码包**

运行：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File "F:\dianshang\scripts\package-internal-prod-source.ps1"
```

预期：`output\releases\dianshang-source-YYYYMMDD-HHMMSS.zip`，且脚本输出清单摘要。

### 任务 6：本地验证与生产 Docker 重建

**文件：**

- 修改：`scripts/smoke-internal-prod.ps1`（仅在需要增加新断言时）

**步骤 1：运行静态和隔离测试**

```powershell
node --check "F:\dianshang\server.js"
node "F:\dianshang\scripts\test-internal-production-launch-gates.js"
node "F:\dianshang\scripts\test-launch-security-guards.js"
npm run build --prefix "F:\dianshang\frontend"
powershell -NoProfile -ExecutionPolicy Bypass -File "F:\dianshang\scripts\test-internal-prod-source-package.ps1"
powershell -NoProfile -ExecutionPolicy Bypass -File "F:\dianshang\scripts\test-windows-server-migration.ps1"
powershell -NoProfile -ExecutionPolicy Bypass -File "F:\dianshang\scripts\smoke-api-disposable.ps1"
```

预期：全部退出码为 0；不调用 Provider，不修改生产注册或兑换码数据。

**步骤 2：完整重建生产 App**

```powershell
docker compose --env-file "F:\dianshang\docker\.env" -f "F:\dianshang\docker\docker-compose.yml" up -d --build --force-recreate app
```

**步骤 3：验证容器和真实内网入口**

- 容器 `dianshang-internal-app` 必须为 `healthy`。
- 记录镜像 ID、镜像创建时间和容器启动时间。
- 直接请求 `http://192.168.0.39:3456/`、`/canvas`、`/user/center`、`/gallery`、`/admin/login`、`/api/health`。
- `/chat/` 在未启用 Chat 时保持明确 503，但首页不展示入口。
- 运行 `smoke-internal-prod.ps1 -ReadOnly`，不增删兑换码。

### 任务 7：文档与最终迁移备份

**文件：**

- 修改：`docs/current-baseline.md`
- 修改：`docs/internal-production-runbook.md`
- 修改：`docs/feature-completion-checklist.md`
- 修改：`docs/progress-report.md`
- 修改：`docs/review-log.md`

**步骤 1：记录最终生产事实**

- 记录 Docker 多阶段构建、后台数据边界、Chat 入口门禁和源码包路径。
- 记录测试命令、镜像 ID、3456 结果和未覆盖风险。

**步骤 2：检查文本质量**

```powershell
git -C "F:\dianshang" diff --check
```

- 检查本轮文本文件均为 UTF-8 无 BOM。

**步骤 3：等待维护窗口确认**

最终备份会短暂停止生产容器，未获得明确确认前不执行。

确认后运行：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File "F:\dianshang\scripts\backup-internal-prod.ps1" -ConfirmMaintenanceWindow
node "F:\dianshang\scripts\portable-migration-manifest.js" verify "F:\dianshang\docker\backup\internal-prod-YYYYMMDD-HHMMSS"
```

验收：迁移包 `formatVersion=2`，SQLite `quick_check` 与 `integrity_check` 均为 `ok`，所有制品 SHA-256 通过，原容器恢复 `healthy`。
