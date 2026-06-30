# 审查与复核记录

## 审查规则

每轮完成后记录：

- 已验证的命令和页面。
- 新发现的风险。
- 未覆盖的测试。
- 需要人工确认的事项。
- 下一轮优先级。
- 优先复用已有接口、成熟开源项目和当前技术栈能力，不重复造轮子；新增能力前先确认是否已有 New-API、CPA、Docker Compose、现有 `/api/*` 或前端模块可复用。

## 2026-06-26 技术栈补救决策复核

### 已验证

- 对比视频参考中的源码型全栈思路：前端保留 `frontend/src/*`，后端按模型/视图组织，数据库和后台管理有稳定边界。
- 对比当前项目现状：前端为打包 Vue 资产，后端为 Express + SQLite，一部分功能依赖 bridge 脚本和 override CSS。
- 新增 `docs/adr/0002-source-first-technology-stack.md`，明确当前过渡栈和正式源码目标栈。
- 更新 `docs/iteration-review-checklist.md`，要求新增复杂前端能力先判断是否进入后续源码工程，避免继续大规模改打包 JS。
- 更新 `docs/known-gaps.md`，把技术栈补救路线列为显式缺口。

### 结论

- 当前不建议立即切 Django/MySQL，也不建议推倒 Express/SQLite 内网版本。
- 正式补救方向是 Vue 3 + Vite + TypeScript 前端源码化，Node.js + TypeScript 后端模块化，后续按阶段引入 Postgres/MySQL、Redis、BullMQ、Worker 和对象存储。
- Django Admin 的效率可以作为后台能力参考，但当前核心栈继续沿用 Vue/Node 更能复用已有验证成果。

### 未覆盖

- 尚未建立 API 契约文档。
- 尚未盘点每个 bridge/override 对应的源码化迁移项。
- 尚未开始 `server.js` 模块拆分和 `frontend/` 源码工程。

## 2026-06-26 新分支源码栈与画布启动复核

### 已验证

- 已切换到 `codex/source-stack-canvas-rebuild` 新分支。
- 已新增 `frontend/` 源码工程，依赖限定为成熟开源基座：Vue、Vite、TypeScript、Vue Router、Pinia、Axios、Naive UI、lucide-vue-next、Vue Flow。
- 已实现新版画布第一版：节点、连线、视口、Controls、MiniMap 和背景全部来自 Vue Flow。
- 已通过 `npm run build --prefix frontend`，覆盖 TypeScript 类型检查和 Vite 生产构建。
- 已新增 `README.md` 和更新 `AGENTS.md`，明确禁止自研画布、UI 组件库、状态库、HTTP Client、AI 网关和账号池。
- 已新增 `docs/plans/2026-06-26-source-stack-canvas-rebuild-plan.md`，按 Lane A-E 写明并行任务树。

### 结论

- 新分支已从旧打包资产修补模式切到源码前端模式。
- 当前新版画布是可构建的起点，但尚未承载旧画布全部业务能力。
- 后续应先做 API 契约和旧画布能力盘点，再扩大新画布功能。

### 未覆盖

- 尚未启动浏览器做新前端视觉检查。
- 尚未接真实后端生成任务。
- 尚未建立多工作树目录。

## 2026-06-25 后台全页面截图复跑

### 已验证

- 使用自带 Playwright CLI 跑通 `scripts/smoke-admin-pages-ui.ps1`。
- 自动登录后台后逐页打开并截图：Dashboard、用户、订单、日志、兑换码、API 线路、模型价格、任务监控、模板工作流、系统设置。
- 截图归档：`docs/design-references/admin-2026-06-25/full-*-desktop-1440x900.png`。
- 每页都校验了关键标题；结果均为 `ok: true`，未出现 404/500。
- 自动采集到的后台顶部标题颜色为 `rgb(2, 6, 23)`，字重 `900`，标题不再是浅灰。
- `node --check server.js`、`node --check assets/home-carousel-inertia.js`、前端路由 smoke 和 disposable API smoke 均通过。

### 视觉结论

- Dashboard、模板工作流、模型价格、用户管理抽查截图可进入人工测试。
- 图标线宽、按钮字距、表格密度和卡片间距整体保持工具台风格。
- 用户管理和模型价格页操作按钮较多，但当前没有把页面挤爆；后续如追更高完成度，可单独压缩操作列或做二级菜单。

### 新发现问题

- 首次新增截图脚本时缺少 Playwright `open` session 步骤，已补齐并复跑通过。
- `docker compose -f docker-compose.internal.yml ps` 因 Docker Desktop daemon 未运行失败，本轮不把容器状态算作已复核。

### 未覆盖

- 后台移动端卡片化体验。
- 保存类复杂弹窗关闭/回显的全量人工点测。
- 服务器部署后的远程浏览器截图。

## 2026-06-25 画布 JSON 导入与保存恢复复核

### 已验证

- `scripts/smoke-canvas-json-ui.ps1` 已跑通。
- 通过 `/api/workflows/:id/save-json` 保存临时画布 JSON，内容为 2 个节点、1 条连线。
- 通过 `/api/user/projects/:id` 读取确认 JSON 未丢字段。
- 浏览器打开 `/canvas/:id` 后，用页面隐藏 JSON 文件 input 导入 `.workflow.json`，模拟真实本地文件导入。
- 前端导入后 `hasVueFlow: true`、`nodeCount: 2`、console `0 errors`。
- 截图归档：`docs/design-references/frontend-2026-06-25/canvas-json-smoke-desktop-1440x900.png`。
- smoke 结束后自动删除临时项目，避免污染当前人工测试库。
- 第一次失败残留的 `canvas_json_smoke_*` 临时项目已按前缀清理，`/api/health` 项目数回到 3。
- `node --check server.js`、`node --check assets/home-carousel-inertia.js`、前端路由 smoke 和 disposable API smoke 均通过。

### 结论

- 当前阶段“画布走本地，到时候自己 JSON 导入”的策略是可测的：JSON 文件导入路径已经能渲染节点。
- 后端 `/api/workflows/:id/save-json` 可作为后续云端保存兼容接口继续保留。

### 风险

- 直接打开 `/canvas/:id` 目前不会自动从服务端项目 JSON 恢复节点；当前证据证明的是本地 JSON 文件导入，而不是云端项目自动恢复。
- 本地文件夹授权保存必须由人工在浏览器里选择目录，自动化只能覆盖无授权时的提示和 JSON 导入。
- `docker compose -f docker-compose.internal.yml ps` 因 Docker Desktop daemon 未运行失败，本轮不把容器状态算作已复核。

## 2026-06-25 统一预检与 UI smoke 护栏复核

### 已验证

- `scripts/preflight-check.ps1` 默认 API smoke 已改为 `scripts/smoke-api-disposable.ps1`，不再默认污染当前人工测试库。
- `SMOKE_UI=true` 已接入后台全页截图 smoke 和画布 JSON 导入 smoke。
- `scripts/preflight-check.ps1` 和 `scripts/verify-internal-deploy.ps1` 已增加 native 命令退出码检查，避免子脚本失败后父脚本继续显示通过。
- `SMOKE_UI=true` 的统一预检已通过，覆盖 Node 静态检查、disposable API smoke、前端路由 smoke、后台 10 页截图、画布 JSON 导入、health 和 git status。
- health 前后保持 `users: 22`、`projects: 3`、`redeem_codes: 10`，确认本轮更新后的默认预检不再增加当前库测试数据。

### 新发现问题

- 旧版 preflight 调用子 PowerShell 脚本后没有检查 `$LASTEXITCODE`，曾出现 canvas UI smoke 失败但父脚本继续打印 `Preflight checks passed`；该问题已修复。
- Playwright 连续跑多个 session 时，`open` 后 5 秒偶尔不够，已调整为 8 秒等待。

### 未覆盖

- Docker Desktop daemon 当前未运行，`docker compose -f docker-compose.internal.yml ps` 仍失败；容器状态本轮不算已复核。
- 服务器无桌面环境时，`SMOKE_UI=true` 需要在本地浏览器机器上设置 `SMOKE_BASE_URL` 指向服务器地址再跑。

## 2026-06-25 后台配置重启持久化复核

### 已验证

- 新增 `scripts/smoke-admin-persistence-disposable.ps1`，使用临时 SQLite 和临时运行目录，不污染当前人工测试库。
- 脚本会写入后台 settings、API 线路、模型价格和模板工作流。
- 写入后停止 Node 进程并用同一临时数据库重启服务。
- 重启后读取确认：
  - `settings.persistenceSmokeAt/defaultCredits` 存在。
  - 新增 API 线路和 `baseUrl` 存在。
  - 新增模型价格和 `pricePoints` 存在。
  - 模板工作流 `persistenceSmokeAt` 存在。
- `preflight-check.ps1` 已新增 `SMOKE_PERSISTENCE=true` 可选入口。

### 结论

- 当前 SQLite `app_state` 对后台 settings、API 线路、模型价格、模板工作流具备重启持久化能力。

### 未覆盖

- Docker volume 层面的容器重启持久化仍需 Docker daemon 或服务器环境验证。
- 生产迁移到独立业务表仍是后续维护项，不影响当前内网轻量版测试。

## 2026-06-24

### 已审查结论

- 当前项目仍是 Express 一体服务：静态前端资产 + `/api/*` + SQLite。
- 7 月前内网部署不建议一步到位引入 Postgres、Redis、BullMQ、Worker。
- New-API/CPA 应作为外部基础设施复用，本项目只保留 Provider Adapter 和业务层记录。
- Docker 轻量版应持久化 SQLite、uploads、logs，避免容器重建丢数据。

### 风险

- 当前前端是打包资产，复杂 1:1 修复会受限。
- SQLite 适合内网小范围，后续多人高并发或计费上线前需迁移 Postgres。
- 真实 AI、邮件、支付、对象存储尚未接入，不能按生产功能对外承诺。
- New-API/CPA 账号池涉及合规、额度和安全风险，需要部署方确认。
- 本机未检测到 `docker` 命令，本轮只能验证 Compose 文件已生成，不能完成容器实跑。

### 待人工确认

- 内网部署方式：Windows 服务器、Linux 服务器还是公司内网机器。
- 是否有统一域名和 Nginx/HTTPS 要求。
- New-API/CPA 是否已部署，或是否需要后续单独编排。
- 前端 1:1 的页面截图基准和验收优先级。

## 2026-06-24 后台接口 smoke 扩展

### 已验证

- 临时端口 `4568` 使用独立 SQLite 数据库启动成功。
- 扩展后的 `scripts/smoke-api.ps1` 覆盖后台 users、orders、usage logs、redeem codes、generate tasks、template workflows、settings 和 public routes。
- 兑换码新增、模板工作流 PUT、settings PATCH 均返回 `success: true`。

### 未覆盖

- 用户删除/恢复/永久匿名化等破坏性后台操作。
- 订单状态变更、任务取消/删除等需要更细测试数据的写接口。
- 前端后台页面的可视化和交互验收。

## 2026-06-24 前端入口复核

### 已验证

- 临时端口 `4569` 上 `/`、`/template-image`、`/canvas`、`/user/center`、`/admin/dashboard` 均可渲染。
- 未登录访问 `/user/center` 会跳转 `/login?redirect=/user/center`。
- 未登录访问 `/admin/dashboard` 会跳转 `/admin/login?redirect=/admin/dashboard`。
- 首页 `图库` 入口可点击，页面显示 `图片生成历史`、`共 0 张` 和空状态。
- 画布未选择本地保存文件夹属于预期状态，新 console 事件已降级为 warning。

### 未覆盖

- 登录态下用户中心和后台真实页面交互。
- 模板生成 mock 图片后图库历史同步。
- 画布选择本地文件夹后的真实本地自动保存。
- 移动端截图和视觉 1:1 对照。

## 2026-06-24 登录态与图库闭环

### 已验证

- 真实用户登录表单可进入 `/user/center`，显示用户、余额、兑换码和 API 线路模块。
- 真实管理员登录表单可进入 `/admin/dashboard`，显示统计卡片、模型使用、用户排行和线路统计。
- `/api/template/generate-image` 会写入 `generations`，`/api/user/generations` 返回生成历史。
- 首页实际加载的旧 `imageHistory-s5iwPTNE.js` 已复用 `/api/user/generations` 同步后端历史，图库显示 `共 1 张`。

### 风险与原则

- 发现新旧两套打包资产并存，后续前端补丁必须先确认 `index.html` 当前实际引用链路。
- 不新增重复图库接口，不自研额外同步层；优先复用已有 `/api/user/generations`。
- 后续 AI 网关继续复用 New-API/CPA，不在本项目内重造分发和账号池。

### 未覆盖

- 模板页面前端按钮级生成流程。
- 多图生成、删除历史、保存链接。
- 后台子页面真实交互和移动端布局。

## 2026-06-24 轻量平台架构护栏

### 已验证

- 临时端口 `4573` 使用独立 SQLite 数据库启动成功。
- `scripts/preflight-check.ps1` 已串联 `node --check server.js`、`node --check assets/home-carousel-inertia.js`、`scripts/smoke-api.ps1`、`/api/health` 和 `git status`。
- 预检通过，`/api/health` 明确返回 mock 模式、New-API 网关配置、CPA 预期后置关系、数据库状态和运行路径。

### 架构结论

- 7 月前继续采用 Express 一体服务 + SQLite + Docker Compose/PM2 的轻量内网平台路线。
- Postgres、Redis、BullMQ、独立 Worker 暂不进入当前阶段，避免拖慢内网部署。
- New-API 作为真实 AI 网关首选；CPA 只作为 New-API 后置渠道；本项目不自研 AI 网关和账号池。
- Open WebUI 暂不纳入核心链路，避免偏离电商画布、模板、图库、后台业务平台定位。

### 风险

- CodeGraph 在 `C:\Users\pc\Desktop\hjm-mb-clone` 未初始化，本轮未使用结构索引。
- 本机仍无法运行 Docker CLI，Docker Compose 只能保留配置级和文档级验证。
- 统一预检脚本依赖已有服务可访问；如 3456 被占用或服务未启动，需要先用临时端口启动。

### 未覆盖

- Docker 容器真实启动、健康检查和重启持久化。
- New-API 真实 token 联通。
- 前端模板、后台子页、画布长流程的浏览器级复核。

## 2026-06-24 内网测试优先策略复核

### 已审查结论

- 部署路径改为先公司内网测试，稳定后再服务器部署。
- 内网测试阶段允许无 `.env` 或 `.env` 保持占位值，必须 mock 跑通；服务器正式部署前再开启严格密钥检查。
- 画布当前明确保持本地优先，使用浏览器本地存储、本地文件夹授权和 JSON 导入/导出；不把画布服务端化作为当前部署阻塞项。
- New-API/CPA 继续复用外部开源项目，本项目只保留 Provider Adapter 和业务记录，不内置网关、额度、账号池和统计面板。

### 已调整

- `scripts/preflight-check.ps1`：画布本地恢复守卫改为可选检查，避免成为内网部署默认闸门。
- `scripts/verify-internal-deploy.ps1`：无 `.env` 或占位 `.env` 时允许内网 mock 验收；服务器正式部署可通过 `REQUIRE_ENV_FILE=true` 和 `REQUIRE_PRODUCTION_SECRETS=true` 强制检查。
- 新增 `docs/internal-test-rollout-checklist.md`，拆分内网测试和服务器部署验收项。

### 风险

- 内网测试阶段如果长期不做服务器严格检查，迁移服务器时仍需补 Nginx/HTTPS、备份恢复和访问权限。
- 画布本地 JSON 适合当前个人/小范围使用；如果后续要团队协同画布，需要单独立项服务端项目存储。

## 2026-06-24 模板/图库 smoke 闭环

### 已验证

- `http://127.0.0.1:3456/template-image` 可加载 10 个模板，侧栏显示自定义、小红书、海报、包装、模特、场景、详情页、副图、白底图和主图模板。
- 点击主图模板后，页面显示复刻参考图、自家产品图、提示词输入、生成设置、反推提示词、生成图片、任务队列和结果区。
- `http://127.0.0.1:3456/admin/dashboard` 登录态可显示用户数、订单金额、今日生成、消耗点数、模型使用、用户排行和 API 线路。
- 临时端口 `4575` 的扩展 smoke 覆盖模板设置、模型线路、注册、用户 profile、模板反推、模板生成、用户图库历史和后台接口，全部通过。

### 风险与原则

- 不新增重复模板接口，不重造图库同步层；继续复用 `/api/template/settings`、`/api/template/generate-image` 和 `/api/user/generations`。
- PowerShell 5 对 UTF-8 无 BOM `.ps1` 中文字符串解析不稳定，自动 smoke 中的测试 prompt 使用 ASCII，文档和前端仍保持中文。
- 模板页首次进入曾出现 `共 0 个模板`，刷新后恢复 10 个；后续若复现，优先检查本地草稿恢复逻辑和实际加载资产，不先改后端。

### 未覆盖

- 上传真实图片或模拟文件后的反推按钮前端完整闭环。
- 模板结果卡片的预览、发送到画布、删除和刷新。
- 后台 users/orders/logs/api-providers/template-workflows 子页逐页视觉和写操作。

## 2026-06-24 后台子页与前端路由 smoke

### 已验证

- 后台 `dashboard/users/orders/logs/generate-tasks/redeem-codes/api-providers/model-prices/template-workflows/settings` 均可渲染。
- `orders` 显示订单表格和关闭订单入口。
- `logs` 显示消费日志筛选和流水表格。
- `template-workflows` 显示模板列表、模板配置、图片槽、平台和保存配置入口。
- `settings` 显示注册赠送、云端保存、图片节点工具开关和保存设置入口。
- 新增 `scripts/smoke-frontend-routes.ps1`，覆盖 SPA 路由 fallback 和核心静态资产。
- 临时端口 `4577` 的 `scripts/preflight-check.ps1` 已包含 API smoke、前端路由 smoke、health 和 git status，全部通过。

### 风险与原则

- 首次批量读取后台部分页面时曾短暂拿到空文本，增加等待和逐页复核后正常；后续如果用户遇到空白，优先检查懒加载时序、登录态和实际加载资产。
- 前端路由 smoke 只验证 HTTP 层和 SPA shell/核心资产，不等同视觉 1:1。
- 继续复用现有后台组件和接口，不新建另一套后台管理系统。

### 未覆盖

- 后台按钮级写操作：API 线路新增/编辑/删除、模型新增、模板工作流保存、系统设置保存。
- 移动端后台布局。
- Docker 容器内的同一套前端路由 smoke。

## 2026-06-24 后台写操作 smoke

### 已验证

- `scripts/smoke-admin-write.ps1` 要求 `SMOKE_ALLOW_WRITES=true`，避免默认误跑破坏性写操作。
- 临时 SQLite 库中验证用户状态、余额调整、安全检查、重置密码、软删除、回收站恢复、永久匿名化。
- 临时 SQLite 库中验证订单状态 mock patch、兑换码创建删除。
- 临时 SQLite 库中验证 API 线路新增、编辑、测试连接、拉取模型、设默认、删除。
- 临时 SQLite 库中验证路线模型新增、编辑、启停、删除。
- 临时 SQLite 库中验证模板工作流保存和系统设置保存。
- 默认 `scripts/preflight-check.ps1` 会跳过后台写操作；设置 `SMOKE_ALLOW_WRITES=true` 后完整 preflight 通过。

### 风险与原则

- 写操作 smoke 只应在临时库、测试库或明确允许的环境运行。
- 不新增后台系统，不重造配置中心；继续复用现有 `/api/admin/*`、SQLite/app_state 和 mock provider 回落。
- 订单状态接口当前是 mock 返回，不持久化订单状态；如果后续要做真实订单管理，需要独立持久化订单表和支付状态机。

### 未覆盖

- 浏览器 UI 点击级写操作。
- Docker 容器重启后 API 线路、模型价格、模板工作流、系统设置的持久化验证。
- New-API 真实网关下的 API 线路测试连接。

## 2026-06-24 内网部署验收脚本

### 已验证

- 本机 `docker --version` 不可用，当前无法执行容器构建和 Compose 实跑。
- `scripts/verify-internal-deploy.ps1` PowerShell 解析检查通过。
- 临时端口 `4581` 的默认 `scripts/preflight-check.ps1` 通过，覆盖 API smoke、前端路由 smoke、health 和 Git 状态。
- `docs/deployment.md` 已补充服务器验收脚本、容器 restart 后健康检查、写操作 smoke 安全开关。

### 风险与原则

- 不把未实跑的 Docker 验收记为完成；当前只是把服务器验收工具和操作步骤补齐。
- New-API/CPA 仍作为外部基础设施复用，本项目容器只承载业务平台和 Provider Adapter。
- `SMOKE_ALLOW_WRITES=true` 只允许在测试库或临时库使用，不应直接对正式业务库执行。

### 未覆盖

- `docker compose -f docker-compose.internal.yml config`
- `docker compose -f docker-compose.internal.yml up --build -d`
- 容器 restart 后 SQLite volume 持久化。
- Nginx/HTTPS/域名配置。

## 2026-06-24 后台 UI 写操作与 New-API 配置回显

### 已验证

- 临时端口 `4582` 使用独立 SQLite 数据目录进行浏览器 UI 写操作，不触碰本机正常库。
- 后台兑换码创建表单的前端字段 `points/totalCount/perUserLimit/status` 已能写入后端，并在表格回显为前端列需要的 `点数/总次数/每人上限/剩余次数/状态`。
- 后台 API 线路新增已能保留 `displayName/baseUrl/category/apiFormat`，New-API 风格 Base URL 不再被 mock 默认地址覆盖。
- 模板工作流页点击 `保存配置` 后出现 `模板工作流已保存`。
- 系统设置页点击 `保存设置` 后出现 `系统设置已保存`。
- `scripts/smoke-admin-write.ps1` 增加兑换码前端字段和 API 线路 `displayName/baseUrl` 断言。

### 风险与原则

- 本轮仍不接真实 New-API key，不触发外部模型费用；只验证业务平台配置字段可以保存和回显。
- 继续保留 Express 一体服务 + SQLite + Provider Adapter 的轻量内网路线，不引入 Redis/Worker/Postgres。
- 写操作 UI 验收应继续使用临时库或测试库，正式库需要人工确认。

### 未覆盖

- 后台 `n-dialog` 创建类弹窗保存成功后不会自动关闭，关闭/取消按钮在本次浏览器自动化中表现不稳定；需要前端 polish 阶段修复。
- API 线路 `测试连接` 在真实 New-API token 下的联通和错误格式。
- users/orders/model-prices 的浏览器 UI 写操作全覆盖。

## 2026-06-24 画布保存恢复 API 长流程

### 已验证

- `scripts/smoke-api.ps1` 已覆盖画布项目创建、`/api/workflows/:id/save-json` 云保存、`/api/user/projects/:id` 读取恢复、项目列表缩略图、`PUT /api/user/projects/:id` 更新恢复和删除清理。
- 临时端口 `4584` 的默认 `scripts/preflight-check.ps1` 通过，画布 smoke 最终删除测试项目，`/api/health` 中 `projects: 0`，没有残留测试项目。
- `/api/user/projects` 响应补齐 `success/projects/list/data/total` 兼容字段，保持前端已有 `items` 不变。

### 风险与原则

- 本轮只补业务平台接口兼容和 smoke，不引入新的画布存储服务，不重造 workflow 引擎。
- 画布真实 UI 的拖拽、连线、上传、保存按钮仍需浏览器交互验收；API 长流程只能证明后端持久化和恢复链路可用。
- 继续使用 SQLite 作为 7 月前轻量内网版本的持久化层。

### 未覆盖

- 浏览器 UI 点击级：新增节点、上传素材、点击保存、刷新/重新进入同一项目恢复。
- 本地文件夹授权后的本地保存路径。
- 多用户并发编辑冲突和版本历史。

## 2026-06-24 画布浏览器 UI 与内网部署护栏复核

### 已验证

- 临时服务中打开 `/canvas` 后会自动进入动态项目页，画布工具栏、保存、历史记录、AI、工程节点、新增节点、工作流模板、文本、图片、图片生成、文生图、视频生成、撤销、重做和缩放入口可见。
- 初始画布可见 `.vue-flow`，示例状态下有 2 个节点和 1 条边，页面不是空壳。
- 点击 `保存` 可打开保存面板，显示本地自动保存、云端自动保存、选择本地文件夹和立即保存；未授权本地文件夹时提示 `请先选择本地保存文件夹`，属于预期限制。
- 点击 `历史记录` 可打开图片生成历史面板，空数据时显示 `共 0 张` 和空状态。
- 点击 `新增节点` 后可见文本节点、LLM 文本生成、图片生成节点、文生图配置、视频生成配置、图片节点和视频节点；点击文本节点后节点数增加。
- Docker Compose 配置不再硬依赖 `.env` 文件，缺少 `.env` 时仍会使用占位环境变量并保持 `ENABLE_REAL_AI=false` 的 mock 回落。

### 风险与原则

- 不在打包前端资产里大规模重写画布逻辑；动态示例项目刷新恢复问题先登记为前端 polish 缺口。
- 本项目继续按 Express 一体服务 + SQLite + Provider Adapter -> New-API 的轻量内网架构推进，不引入 Postgres、Redis、BullMQ、Worker 或 Open WebUI。
- New-API/CPA 继续复用外部成熟项目，本项目只保存业务配置、任务记录和平台状态。

### 未覆盖

- 动态示例项目刷新后节点可能变 0，需要修复恢复逻辑或默认示例数据注入。
- 本地文件夹授权后的真实本地保存流程。
- 上传素材、连线、生成节点和重新进入同一项目的完整 UI 长流程。
- Docker 容器真实构建、启动、healthcheck 和重启持久化。

## 2026-06-24 画布示例项目刷新恢复守卫

### 已验证

- 新增 `assets/canvas-project-restore-guard.js`，在主 Vue 模块加载前检查 `ai-canvas-projects-summary` 和旧摘要键。
- 仅当项目名为 `示例项目` 且 `canvasData.nodes` 缺失或为空时，自动补回 2 个示例节点和 1 条边；不修改普通用户项目。
- `scripts/verify-canvas-restore-guard.js` 使用 mock `localStorage` 验证：空示例项目会被修复，普通项目保持不变。
- `scripts/smoke-frontend-routes.ps1` 已覆盖 `/assets/canvas-project-restore-guard.js` 静态资产可访问。
- `scripts/preflight-check.ps1` 已接入守卫验证。

### 风险与原则

- 该修复复用现有本地项目摘要键和现有示例节点结构，不新增画布状态系统。
- 不直接重写 `Canvas-B8bY9_QL.js` 大包，降低压缩前端资产误伤风险。
- 守卫只处理本地摘要层；如果 IndexedDB 中已有真实空项目，仍以用户真实项目为准，不强行覆盖。

### 未覆盖

- 浏览器中刷新同一动态项目后的节点数二次确认。
- 上传素材、连线、生成节点和重新进入同一项目的完整 UI 长流程。

## 2026-06-24 Docker 前可测试状态复核

### 已验证

- 临时端口 `4594` 使用一次性 SQLite 执行 `scripts/preflight-check.ps1`，Node 语法、API smoke、前端路由 smoke 和 health 全部通过。
- 临时端口 `4596` 使用一次性 SQLite 执行 `SMOKE_ALLOW_WRITES=true scripts/smoke-admin-write.ps1`，后台写操作全部通过。
- Docker CLI、Docker Compose 和 Docker Engine 已安装可用；项目 Compose config 已通过。

### 结论

- 当前已经达到 Docker 前的本机 mock 可测试状态。
- 真实 New-API、邮件、支付、云存储无需现在配置。
- Docker 容器实跑仍需人工确认后再执行，避免占用端口或影响当前手动测试。

### 未覆盖

- 浏览器人工视觉验收。
- Docker 容器启动、重启持久化和容器内 healthcheck。
- 真实 New-API token 联通。

## 2026-06-24 Docker 启动排障

### 已验证

- Docker CLI、Compose 和 Engine 可用，项目 `docker-compose.internal.yml config` 通过。
- 官方 `node:20-alpine` 拉取 metadata 时出现 `registry-1.docker.io ... EOF`，属于 Docker Hub 网络/镜像源问题。
- 使用 `docker.m.daocloud.io/library/node:20-alpine` 可进入构建，但 `better-sqlite3` 在 Alpine/musl 下没有可用预编译包，`npm ci` 触发 `node-gyp`，因缺 Python/编译工具失败。
- 已将 Dockerfile 默认基础镜像切换为 `node:20-bookworm-slim`，并通过 `NODE_IMAGE` build arg 支持按环境替换镜像源。
- 本机 Node 服务已启动在 `http://127.0.0.1:3456/`，health 正常，可先进行人工页面验收。

### 结论

- 当前 Docker 未启动成功不是前后端业务代码失败，而是基础镜像拉取和 Alpine 原生依赖编译问题。
- 不建议在 Dockerfile 里堆 Alpine 编译工具，优先复用 Debian slim + `better-sqlite3` 预编译包，保持镜像简单可维护。

### 未覆盖

- `node:20-bookworm-slim` 镜像完整下载后的容器构建。
- 容器健康检查和 Docker volume 重启持久化。

## 2026-06-24 Docker 镜像网络重试复核

### 已验证

- 停止本机 Node 服务后，`3456` 已释放，可用于 Docker 容器绑定。
- `docker.m.daocloud.io/library/node:20-bookworm-slim` 在 metadata 阶段 EOF。
- `docker.1ms.run/library/node:20-bookworm-slim` 在 anonymous token 阶段 EOF。
- 本地 `docker images` 为空，没有可复用的 Node 基础镜像缓存。
- 容器没有启动，`docker compose ps` 为空。
- 本机 Node 服务已恢复，供人工继续测试。

### 结论

- Docker 当前阻塞条件是外部镜像源网络不可用，不是应用、端口、Compose 或 SQLite 问题。
- 已保留 `NODE_IMAGE` 可配置能力，后续只需切换到可用镜像源或稳定网络重试。

### 未覆盖

- Docker 容器首次完整构建。
- Docker volume 持久化和容器重启验收。

## 2026-06-24 Docker 实跑复核

### 已验证

- 人工下载 `node:20-bookworm` 后，使用该镜像完成 `docker compose -f docker-compose.internal.yml build`。
- 构建阶段 `npm ci --omit=dev` 通过，`better-sqlite3` 未再因缺 Python/编译工具失败。
- 停止本机 Node 服务后，`docker compose -f docker-compose.internal.yml up -d` 成功启动 `dianshang-app`。
- `docker compose ps` 显示容器 `healthy`，端口映射为 `0.0.0.0:3456->3456/tcp`。
- `http://127.0.0.1:3456/api/health` 返回 `success: true`、`status: ok`、`mode: mock`、`database: ok`，运行路径为 `/app/data`、`/app/uploads`、`/app/logs`。
- 首页 `http://127.0.0.1:3456/` 返回 200。
- 执行 `scripts/smoke-api.ps1` 后重启容器，`/api/health` 仍正常，`users/generations/balance_logs/redeem_codes/app_state` 表计数保留，证明 SQLite volume 基础持久化有效。

### 结论

- Docker 本地内网测试路径已跑通，不需要现在引入 Postgres、Redis、Worker、Open WebUI。
- 默认镜像应使用 `node:20-bookworm`，避免 slim 镜像缺少 `better-sqlite3` 编译工具。
- 真实 New-API、CPA、邮件、支付、云存储仍保持关闭，不影响 mock 测试。

### 未覆盖

- 人工浏览器完整点击测试 Docker 服务。
- 服务器/Nginx/HTTPS 正式部署验收。

## 2026-06-24 今日人工测试计划落库

### 已确认

- 新增 `docs/plans/2026-06-24-admin-frontend-manual-test.md` 作为下一轮上下文恢复入口。
- 今日目标锁定为后台与前端打通到人工可测，不扩 Postgres/Redis/Worker/Open WebUI。
- New-API 只保留配置入口和 mock 回落，不提交真实 key。

### 需要继续验证

- 后台 UI 点击级人工测试：弹窗关闭、按钮反馈、保存回显。
- 前端人工测试：首页、模板、图库、画布、用户中心。
- 其他电脑访问 `http://192.168.0.39:3456/` 的防火墙情况。

## 2026-06-24 画布节点圆角审查

### 已确认

- 图片节点外层需要 `overflow-visible` 保留连接点和右侧加号，不能直接裁剪整个节点。
- 圆角割裂来自内部 header/footer 背景没有单独圆角，尤其选中态橙色边框下更明显。
- 新增 `assets/canvas-node-radius-fix.css`，只修内部 header/footer 圆角，不改变节点尺寸和连接点行为。
- 浏览器验证：图片节点 footer 为 `0px 0px 23px 23px`，文生图 header 为 `23px 23px 0px 0px`，外层仍为 `overflow: visible`。

### 需要继续验证

- 用户当前视角下的肉眼确认。
- 其他节点类型是否也有同类内部背景压圆角的问题。

## 2026-06-24 画布选中态外层圆角复核

### 已确认

- 最新截图里的剩余割裂不只来自内部背景层，也来自 `.vue-flow__node` 外层默认 `8px` 圆角。
- 已将图片节点和文生图节点外层圆角补到 `24px`，图片生成节点外层圆角补到 `28px`。
- 外层继续保持 `overflow: visible`，连接点、右侧加号和选中手柄不会被裁掉。
- Docker 容器已重建，浏览器 computed style 已确认新规则生效。

### 需要继续验证

- 用户已肉眼确认圆角问题无明显异常，本项通过。
- 文本节点、视频节点是否也需要按原站视觉扩大圆角。

## 2026-06-24 画布小地图与聊天面板复核

### 已确认

- 右下角小地图原样式为纯白背景，和深色点阵画布割裂。
- 已将小地图外壳改为暗色半透明玻璃，并将 SVG mask 改为半透明白，避免内部仍出现白块。
- 左侧 Canvas Chat 面板原位置 `top: 56px`，顶部浮动工具条实际高度约 `73px`，存在阴影遮挡。
- 已将桌面端面板下移到 `top: 96px`，移动端仍保持全屏。
- 按参考图把桌面端面板调整为完整浮动卡片：左侧保留 `24px` 空隙，底部保留约 `22px` 空隙，四角圆角为 `24px`。

### 需要继续验证

- 用户肉眼确认透明度是否合适。
- 用户肉眼确认聊天浮动卡片位置、圆角和底部留白是否合适。

## 2026-06-24 画布用户中心标题颜色复核

### 已确认

- 用户反馈只需要修字体颜色，卡片式结构、圆角、阴影和布局不应继续调整。
- 画布内用户中心不是 Naive Modal，而是自定义 `aside` 侧栏，因此通用弹窗选择器无法命中。
- 已将颜色覆盖收窄到用户中心侧栏：`aside[class*="max-w-[414px]"][class*="bg-[#f5f6f8]"]`。
- 已验证 `admin`、`算力余额`、`算力明细`、`兑换码`、`API 线路` 的 computed color 从浅色变为 `rgb(24, 24, 27)`。

### 需要继续验证

- 用户刷新原页面后肉眼确认标题颜色是否统一。
- 后续如果侧栏 DOM 类名变动，需重新收窄选择器，避免影响其他画布弹层。

## 2026-06-25 后台视觉与接口复核

### 已确认

- 后台 10 个页面已归档桌面截图：`docs/design-references/admin-2026-06-25/`。
- Dashboard 前端读取 `userTotal`，后端原来只返回 `totalUsers`，导致卡片显示 `--`；已补兼容字段。
- Dashboard 模型占比前端读取 `modelUsage.list[].percent`，后端原来未返回，导致只显示 `%`；已补百分比。
- API 线路页操作按钮列过窄，按钮竖排导致行高约 `226px`；已给后台表格操作列保留宽度并禁止按钮竖排，行高降到 `58px`。
- 任务监控提示词列被压窄，中文竖排导致行高约 `348px`；已允许表格横向滚动，并将长提示词单行省略，行高降到约 `92px`。
- 本轮视觉补丁独立在 `assets/admin-visual-polish.css`，通过后台根布局选择器收窄，不改画布卡片结构。

### 需要继续验证

- 后台保存类操作需要用户人工点击确认：API 线路保存、模型价格保存、模板工作流保存、系统设置保存。
- 模型价格页线路筛选项仍有重复，当前不阻塞人工测试，但后续应从数据/前端状态层收敛。
- Docker Desktop 当前未在本轮确认运行，`docker compose ps` 无法连接 daemon，需要用户打开后再复核容器 `healthy`。
- 本机 Node 启动日志在 PowerShell 读取时中文显示乱码，服务本身正常，后续可改启动日志为 ASCII 或统一输出编码。

## 2026-06-25 后台保存回显与模型价格筛选复核

### 已确认

- `scripts/smoke-admin-write.ps1` 已在临时端口 `4594` 和一次性 SQLite 数据库上完整通过，覆盖后台写操作，不污染当前人工测试数据库。
- `/api/admin/model-prices` 原来把模型行放进 `list/items/data`，打包前端会把这些模型行当作线路筛选项，导致同一线路重复出现。
- 已调整 `/api/admin/model-prices`：`list/items/data/routes/providers` 返回线路分组，`models/prices/rows` 保留完整模型行。
- 浏览器复核 `/admin/model-prices`：筛选按钮只剩 `全部模型、6789、comfly-google、comfly-openai-plus、RK、哈吉米、flowstudio`，表格模型行仍正常显示。

### 需要继续验证

- `scripts/smoke-api.ps1` 仍会在当前本地库留下测试用户、生成记录和兑换码；建议下一轮改成可选临时库模式。
- Docker Desktop 未启动时无法验证 compose 容器状态，仍需用户打开后复核。

## 2026-06-25 Disposable API Smoke 护栏复核

### 已确认

- 新增 `scripts/smoke-api-disposable.ps1`，通过临时端口和临时 SQLite 数据库运行完整 API smoke。
- 脚本会继承原有 `scripts/smoke-api.ps1` 的覆盖范围，避免重复维护两套断言。
- 首次验证发现临时 DB 文件可能在 Node 退出后短暂被占用；已增加 `Wait-Process` 和清理重试。
- 最终验证通过，退出码为 `0`，没有继续写入当前 `3456` 人工测试数据库。

### 需要继续验证

- Docker Desktop 未启动，容器状态仍无法复核。
- 后续如果要验证当前真实服务写入，仍可直接运行原 `scripts/smoke-api.ps1`；日常提交前建议优先用 disposable 脚本。

## 2026-06-25 前端主流程与用户中心真实数据复核

### 已确认

- 前端桌面截图已归档到 `docs/design-references/frontend-2026-06-25/`，包含首页、图库、模板、模板工作区和用户中心关键页面。
- 首页可渲染，首页 `图库` 入口可打开生成历史弹层。
- 模板页可显示 10 个模板，模板图库入口可打开，模板工作区可进入上传槽、提示词、生成设置、结果区和任务队列。
- `/user/records` 打包前端原来只显示 `generation_logs`、`balance_logs`、`暂无新任务` 等占位文案；已通过 `assets/user-center-data-bridge.js` 追加真实生成记录和余额流水。
- `/user/redeem` 打包前端原来显示 `本地演示 / 后端待接入`；已追加后端兑换码提交入口，并说明成功后会写入余额流水。
- 浏览器验证 `/user/records` 可见 `真实记录` 和生成/流水数量，`/user/redeem` 可见 `兑换码提交` 与 `已接后端`，console 无页面错误。

### 需要继续验证

- 用户中心桌面端仍是窄移动式布局，当前可测试但不是最终桌面 1:1。
- 兑换码成功/失败提示需要用户手动点测一次。
- 图库删除、保存链接、多图显示仍需人工点测。
- Docker Desktop 未启动时无法复核 compose 容器状态。

## 2026-06-25 图库删除持久化复核

### 已确认

- 原图库弹层 `删除` 按钮只修改前端列表：删除后页面从 `共 4 张` 变 `共 3 张`，但 `/api/user/generations` 仍为 `4` 条，刷新后恢复 `共 4 张`。
- 已新增生成历史删除接口，支持 `DELETE /api/user/generations/:id`，也支持按 `resultUrl/prompt` 删除，便于打包前端图库卡片只暴露图片链接时同步后端。
- 已新增 `assets/gallery-persistence-bridge.js`，只在 `图片生成历史` 弹层中捕获 `删除` 按钮，不影响画布、后台或其他页面。
- 浏览器复核删除持久化：删除前 API `4` 条，删除后 API `3` 条；刷新后图库仍显示 `共 3 张`。
- `scripts/smoke-api.ps1` 已增加生成历史删除断言，disposable API smoke 通过。

### 需要继续验证

- `保存链接` 需要人工确认是剪贴板复制还是本地文件夹保存，后续再决定是否补持久化记录。
- `清空` 暂未接后端批量删除；如果要启用真实批量清空，必须增加二次确认，避免误删全部历史。

## 2026-06-25 图库保存链接与头像保存复核

### 已确认

- 原图库单张 `保存链接` 点击后没有稳定写入剪贴板；已在 `assets/gallery-persistence-bridge.js` 中补充复制逻辑。
- 单张 `保存链接` 现在会复制当前卡片图片 URL。
- `保存全部链接` 会复制图库弹层内所有图片 URL，一行一个；浏览器验证得到 `3` 条链接。
- 用户中心头像设置控件存在：随机头像、上传、预设头像。
- 随机头像已验证会写回后端，`/api/user/profile` 中 `avatarUrl` 从 `/avatars/avatar-vip.svg` 变为 `/avatars/avatar-2d.svg`。

### 需要继续验证

- 头像上传文件入口还未用真实图片文件点测。
- 复制出来的图片 URL 可能是本地 mock SVG 或外部 placeholder，服务器部署后需要确认访问路径是否符合内网使用习惯。
- 图库 `清空` 仍保持前端行为，未接后端批量删除。

## 2026-06-25 模板反推兼容与后台视觉复核

### 已确认

- `/api/template/reverse-prompt` 原来只返回 `rawPrompt/suggestions`，打包前端反推逻辑读取的是 `rawText/prompts`，导致接口 200 但页面仍显示 `提示词选择 0 条`。
- 已补齐 `rawText`、`prompts`、`items/list/data`，同时保留 `rawPrompt/suggestions`，避免影响现有 smoke 和后续兼容。
- 后台 10 个页面已重新截图归档：Dashboard、用户、订单、日志、兑换码、API 线路、模型价格、任务监控、模板工作流、系统设置。
- `redeem-codes` 页面自动文本检查出现 `has500=true` 是因为页面包含 `500` 点数文本，不是 HTTP 500 或页面错误。
- 后台视觉补丁继续限制在 `assets/admin-visual-polish.css`，未触碰前台画布卡片和模板结构。

### 需要继续验证

- 模板页完整 UI 闭环仍需真实上传素材后确认：提示词卡片出现、生成按钮调用 `/api/template/generate-image`、结果写入图库历史。
- Dashboard 右侧排行表在 1440 宽度下仍偏挤，后续可针对该半宽卡片做单独表格布局优化。
- 后台保存/删除/弹窗关闭仍需人工逐页点测，当前 smoke 已覆盖接口写入，但没有完全覆盖交互手感。

## 2026-06-25 模板真实上传生成闭环复核

### 已确认

- Codex 内置浏览器不支持文件上传，已改用独立 Playwright CLI 验证模板上传链路。
- `/template-image` 选择 `一键主图反推复刻` 后，参考图槽和产品图槽均可上传本地 `logo.png`。
- 上传后页面状态从 `待上传` 进入可生成状态，素材统计显示 `2 张素材`。
- 点击 `反推提示词` 后，页面显示 `提示词选择 3 条`，并出现 `高转化主图`、`场景氛围图`、`极简白底图` 三张提示词卡片。
- 点击 `生成图片` 后，页面显示 `已完成`、`当前 1 张`、`1 个已完成`，结果卡可见 `进画布` 和 `下载`。
- 网络请求确认 `/api/template/reverse-prompt` 和 `/api/template/generate-image` 均为 200。
- `/api/user/generations` 最新记录为本次模板生成结果，说明图库历史后端写入成功。
- `scripts/smoke-api.ps1` 已新增 `rawText/prompts` 字段断言，避免后续兼容字段回退。

### 需要继续验证

- 这次验证使用的是 mock 图片结果，后续接 New-API 后必须复测真实生图。
- Playwright CLI 登录态目前只写入 `auth_token`，顶部仍显示 `登录`，但接口调用已通过；后续如果要长期自动化，应写专用脚本处理 `auth_user` JSON 引号。
- 1440 截图中上传素材预览区域显示了 `logo.png` 文件名，生成结果本身正常；需要你在真实浏览器里确认这是测试素材/截图加载问题，还是预览卡片需要继续修。
- 模板页“进画布”按钮、下载文件名和批量生成还未作为本轮重点验证。

## 2026-06-25 后台内置浏览器截图与交互 Smoke 复核

### 已确认

- 已使用内置浏览器归档后台 10 页截图：Dashboard、用户、订单、日志、兑换码、API 线路、模型价格、任务监控、模板工作流、系统设置。
- 页面均能打开，未出现空白、404 或 500。
- 新增 `scripts/smoke-admin-ui.ps1` 与 `scripts/smoke-admin-ui-runner.js`，通过浏览器内登录后验证关键后台交互。
- 已验证 `系统设置 -> 保存设置` 有成功提示。
- 已验证 `API 线路管理 -> 新增线路` 弹窗能打开，且包含 Base URL、API Key、接口路径等字段。
- 已验证 `兑换码管理 -> 创建兑换码` 弹窗能打开，且包含兑换码、点数、次数、过期时间等字段。
- 已验证 `模板工作流 -> 保存配置` 可点击，页面不报错。
- 已归档交互截图：
  - `admin-ui-smoke-dashboard-desktop-1440x900.png`
  - `admin-ui-smoke-settings-desktop-1440x900.png`
  - `admin-ui-smoke-api-provider-modal-desktop-1440x900.png`
  - `admin-ui-smoke-redeem-modal-desktop-1440x900.png`
  - `admin-ui-smoke-template-workflows-desktop-1440x900.png`

### 需要继续验证

- 后台删除/恢复确认还没有全部纳入自动化。
- Dashboard 用户排行表在 1440 视口下仍偏宽，后续可单独做表格列压缩。
- 后台视觉这轮只做复核和护栏，没有再改动已确认的画布卡片布局。

## 2026-06-25 后台写入 Disposable Smoke 复核

### 已确认

- 新增 `scripts/smoke-admin-write-disposable.ps1`，默认使用临时端口 `4596` 和临时 SQLite。
- 脚本会自动设置 `SMOKE_ALLOW_WRITES=true`，只允许后台写入 smoke 在临时库执行。
- 已验证通过用户软删除、回收站恢复、永久匿名化，不会误删当前人工测试库中的真实数据。
- 已验证兑换码创建/删除、API 线路创建/更新/删除、线路模型创建/更新/禁用/删除。
- 已验证模板工作流和系统设置保存。
- 临时服务结束后会停止 Node 进程，并清理临时目录。

### 需要继续验证

- 这是后端写入路径验证，不等同于前端确认弹窗手感验证。
- 下一步仍需用浏览器点测后台用户删除、回收站恢复、永久删除的确认弹窗。

## 2026-06-25 用户中心兑换码与后台删除恢复 UI Smoke 复核

### 已确认

- 新增 `scripts/smoke-user-redeem-ui.ps1` 与 runner。
- `/user/redeem` 错误码提交会显示红色提示 `兑换码不存在`。
- `/user/redeem` 有效码提交会显示绿色提示 `兑换成功，增加 3 算力`。
- 新增 `scripts/smoke-admin-delete-ui.ps1` 与 runner。
- 后台用户删除会打开页面内确认弹窗，包含管理员密码、删除原因和 `确认删除` 按钮。
- 确认删除后用户进入回收站，回收站行可见。
- 点击恢复后显示 `用户已恢复`，回收站回到空状态。
- smoke 使用临时用户，结束后通过 API 做清理，避免留下测试账号。

### 需要继续验证

- 用户中心桌面端仍是窄移动式布局，后续如果追 1:1 桌面视觉需要单独优化。
- 后台用户表操作列较密，1440 下可用但仍可做细化。
- 后台永久删除前端弹窗还未单独截图；后端路径已由 disposable write smoke 覆盖。

## 2026-06-25 移动端关键页面截图 Smoke 复核

### 已确认

- 新增 `scripts/smoke-mobile-ui.ps1` 与 runner。
- 移动端截图目录：`docs/design-references/mobile-2026-06-25/`。
- 已归档首页、模板页、画布页、用户中心兑换码、后台 Dashboard、后台 API 线路、后台模板工作流 390x844 截图。
- 首页移动端标题原先在 390 宽下断成 `工作 / 台`，已通过 `assets/home-overrides.css` 移动端字号修复。
- 画布移动端核心内容可见，包含新增节点面板和底部缩放控件。
- 后台移动端 Dashboard 可见统计卡片，API 线路和模板工作流可见核心内容。

### 需要继续验证

- 后台移动端表格信息密度仍偏高，API 线路页默认只露出前两列，需要后续看是否做移动端专门卡片化。
- 画布移动端本地保存提示会占据顶部空间，这是当前本地画布策略带来的提示，不属于本轮错误。

## 2026-06-25 后台截图复跑与 Dashboard 表格复核

### 已确认

- 已重新跑通 `scripts/smoke-admin-ui.ps1`，后台主截图覆盖 Dashboard、系统设置、API 线路弹窗、兑换码弹窗和模板工作流。
- 已重新跑通 `scripts/smoke-admin-delete-ui.ps1`，后台删除确认、回收站行和恢复完成截图均已归档。
- 已重新跑通 `scripts/smoke-mobile-ui.ps1`，移动端首页、模板、画布、用户兑换码、后台 Dashboard、API 线路、模板工作流均非空白。
- 已用 Codex 内置浏览器打开 `/admin/dashboard` 和 `/admin/api-providers` 抽查，API 线路页 console error 为 0。
- Dashboard 右侧用户消费排行表原先被全局 `min-width: 980px` 撑宽裁切，本轮已改为随容器收缩，截图中最后使用列不再被直接裁掉。
- 删除/恢复 UI smoke 失败原因是表格刷新导致按钮 DOM 在点击前被替换，已改为按当前 DOM 行查找按钮并立即点击，复跑通过。

### 需要继续验证

- 移动端后台表格仍采用横向表格方案，已经更紧凑，但是否需要卡片化要等人工看图决定。
- Playwright CLI 截图脚本不能并行复用同一个 session；后续自动化应串行执行，或显式拆不同 session。
- Docker Desktop daemon 当前仍需人工打开后再复核容器状态。

## 2026-06-25 图库多图与空状态复核

### 已确认

- 新增 `scripts/smoke-gallery-ui.ps1` 与 runner。
- 已验证临时用户生成 2 张 mock 图后，首页图库弹窗显示 `共 2 张`，两张图片卡片可见。
- 已验证 `保存全部链接` 会写入 2 条图片链接；smoke 使用测试剪贴板，不依赖系统剪贴板权限。
- 初次严格复核发现真实问题：后端删除生成记录后，前端图库仍从 localStorage 复活旧图。
- 已修复 `imageHistory` 同步逻辑：登录态下以后端 `/api/user/generations` 为生成历史权威来源，同时保留本地文件夹/浏览器缓存类素材。
- 修复后重新跑通，删除后 API 为 0 条，重开图库显示 `共 0 张` 和 `还没有图片生成历史`。
- 已归档截图：
  - `gallery-multi-state-desktop-1440x900.png`
  - `gallery-empty-state-desktop-1440x900.png`

### 需要继续验证

- 移动端图库多图和空状态还没有单独截图。
- 图库空状态视觉可用但偏朴素，后续如果追细节可统一空状态图标、按钮禁用态和弹窗内间距。

## 2026-06-25 移动端图库入口复核

### 已确认

- 390x844 首页原本没有可点击的 `图库` 入口，导致移动端图库无法人工打开。
- 已在 `gallery-persistence-bridge.js` 增加移动端首页专用轻量入口，只在 `/` 且 `max-width: 720px` 时显示。
- 移动端入口打开后复用 `/api/user/generations`，不是单独假数据。
- 已验证移动端多图状态：`共 2 张`，图片卡片、保存链接按钮可见。
- 已验证移动端空状态：`共 0 张`，显示 `还没有图片生成历史`。
- 移动端图库弹窗已做文本转义，避免真实提示词中的符号污染 HTML。
- 已归档截图：
  - `gallery-multi-mobile-390x844.png`
  - `gallery-empty-mobile-390x844.png`

### 需要继续验证

- 这是轻量补入口，不是完整重做移动端导航；后续如追 1:1，需要把首页、模板、图库移动端导航体系一起统一。
- 移动端保存到本地文件夹能力仍依赖浏览器权限，当前 smoke 只覆盖复制链接。

## 2026-06-25 后台全页截图复跑复核

### 已确认

- 已使用 Playwright 重新执行 `scripts/smoke-admin-pages-ui.ps1`。
- 后台 10 个页面全部返回 `ok:true`，包含 Dashboard、用户、订单、日志、兑换码、API 线路、模型价格、任务监控、模板工作流、系统设置。
- 截图目录：`docs/design-references/admin-2026-06-25/`。
- 截图文件：`full-dashboard-desktop-1440x900.png`、`full-users-desktop-1440x900.png`、`full-orders-desktop-1440x900.png`、`full-logs-desktop-1440x900.png`、`full-redeem-codes-desktop-1440x900.png`、`full-api-providers-desktop-1440x900.png`、`full-model-prices-desktop-1440x900.png`、`full-generate-tasks-desktop-1440x900.png`、`full-template-workflows-desktop-1440x900.png`、`full-settings-desktop-1440x900.png`。
- 脚本已读取标题样式：标题颜色统一为 `rgb(2, 6, 23)`，标题字重统一为 `900`。
- 当前截图 smoke 未发现 404、500 或空白页。

### 需要继续验证

- 需要人工看图判断后台标题、按钮、图标、字距、表格密度是否达到“工具台”观感。
- 后台移动端表格目前仍是横向表格方案，是否卡片化等人工确认后再做。

## 2026-06-25 后台操作列视觉复核

### 已确认

- 逐页查看后台桌面截图后，发现用户管理、API 线路、模型价格等页面右侧操作按钮容易被表格宽度挤到画面外。
- 已在 `assets/admin-visual-polish.css` 增加后台表格卡片横向滚动保护。
- 已将带按钮的最后一列设为右侧固定列，并允许按钮在操作列内换行，保证“编辑、禁用、设默认、测试连接、拉取模型、删除”等关键操作在截图和人工测试时可见。
- 已重新执行 `scripts/smoke-admin-pages-ui.ps1`，后台 10 页全部 `ok:true`。
- 已执行前端路由 smoke、API smoke、`/api/health` 和 JS 语法检查，均通过。

### 需要继续验证

- 多操作按钮完整可见后，用户管理/API 线路行高会增加；如果人工看图觉得偏松，下一轮应改成“更多操作”菜单或详情抽屉。
- `docker compose -f docker-compose.internal.yml ps` 当前失败，原因是 Docker Desktop daemon 未运行，需要启动 Docker Desktop 后复核容器。

## 2026-06-25 用户中心桌面布局复核

### 已确认

- 用户中心原始打包页桌面端仍使用 `max-w-[430px]` 手机壳布局，人工测试时显得过窄。
- 已在 `user-center-data-bridge.js` 对 `/user/*` 页面增加桌面端布局补丁：960px 以上使用 980px 外壳和两栏 grid，移动端不触发。
- 已增加用户页头像破图兜底，坏图会隐藏，避免显示浏览器破图标。
- 新增 `scripts/smoke-user-center-layout-ui.ps1` 和 runner，覆盖 `/user/center`、`/user/records`、`/user/redeem` 桌面截图，以及 `/user/center` 移动端截图。
- 已将用户中心布局 smoke 接入 `SMOKE_UI=true` 的 `preflight-check.ps1` 和 `verify-internal-deploy.ps1`。
- `SMOKE_UI=true scripts\preflight-check.ps1` 已通过，覆盖后台截图、画布 JSON 导入和用户中心布局。

### 需要继续验证

- 目前头像兜底是隐藏坏图，视觉上是空头像底色；如果需要更精致，下一轮补文字头像或固定默认头像资源。
- 用户中心桌面两栏已可测，但是否接近目标站观感仍需人工确认。

## 2026-06-25 用户中心默认头像复核

### 已确认

- 原兜底只是隐藏坏图，截图中头像区域仍显得空。
- 已改为默认文字头像：头像图片加载失败时，在头像圆形容器里显示当前用户首字母。
- `scripts\smoke-user-center-layout-ui.ps1` 已增加校验：如果存在 broken image，则必须出现 `.uc-avatar-fallback`。
- 桌面截图 `user-center-desktop-1440x900.png` 和移动端截图 `user-center-mobile-390x844.png` 已显示 `A` 默认头像。

### 需要继续验证

- 当前是首字母兜底，足够人工测试；若要更接近品牌视觉，可后续换成固定默认头像图片。

## 2026-06-25 内置浏览器后台截图与 Docker daemon 复核

### 已确认

- 已使用内置浏览器登录后台，并生成 10 张桌面截图：`manual-audit-dashboard/users/orders/logs/redeem-codes/api-providers/model-prices/generate-tasks/template-workflows/settings-desktop-1440x900.png`。
- 10 个后台页面均非空白、非 404，浏览器 console error 为 0。
- 自动文本检测在兑换码页命中 `500`，从页面业务上看大概率是积分数值，需要人工看图确认，不按真实 500 错误处理。
- `docker --version` 可用，版本为 29.5.3。
- `docker compose version` 可用，版本为 v5.1.4。
- `scripts\verify-internal-deploy.ps1` 已增加 `docker info`，现在会在 `docker available` 阶段提前检查 Docker Server。
- 当前失败信息为：`failed to connect to the docker API at npipe:////./pipe/dockerDesktopLinuxEngine`。
- 结论：Docker CLI/Compose 已安装，Docker Desktop daemon 未运行；不是项目代码或镜像配置本身失败。

### 需要继续验证

- 人工查看 10 张后台 `manual-audit` 截图，重点看标题、图标、按钮、字距、表格密度和卡片间距是否接受。
- 打开 Docker Desktop 并等待 Engine running 后，重新执行 `scripts\verify-internal-deploy.ps1`。
- 只有完整通过后，才能把部署护栏从 `待复核` 改为 `完成`。

## 2026-06-25 后台主按钮颜色复核

### 已确认

- 系统设置页 `保存设置` 原样式为 Naive UI 默认亮薄荷绿：`rgb(99, 226, 183)`，文字为黑色，和后台工具台风格不统一。
- 已在 `assets/admin-visual-polish.css` 的后台作用域中覆盖 `.n-button.n-button--primary-type`。
- 新样式使用清新 emerald 绿主色、白色文字、低饱和边框和轻阴影，避免继续出现荧光薄荷绿，同时不压成黑绿。
- 内置浏览器已归档截图：`docs/design-references/admin-2026-06-25/settings-button-fresh-green-desktop-1440x900.png`。

### 需要继续验证

- 你人工确认新的清新绿色按钮是否符合预期。
- 继续按后台页面截图审查其他明显突兀的颜色、按钮密度和标题层级。

## 2026-06-25 后台用户表格操作列复核

### 已确认

- 用户管理页右侧 sticky 操作列原阴影过宽，形成大片白色遮罩，视觉上盖住注册时间/最后登录一部分。
- 已将操作列宽度从 240px 调整为 226px，并加入轻边线。
- 已将操作列阴影从 `-16px 0 24px rgba(248, 250, 252, 0.88)` 收敛为 `-6px 0 14px rgba(248, 250, 252, 0.58)`。
- 已将表格按钮高度从 28px 压到 26px，字号从 12px 压到 11px，减少多按钮行高压力。
- 内置浏览器已归档截图：`docs/design-references/admin-2026-06-25/users-action-column-polish-desktop-1440x900.png`。

### 需要继续验证

- 用户管理宽表仍然信息密度高，日期列会截断；如果人工测试觉得仍然拥挤，下一步应做“更多操作”菜单或详情抽屉，而不是继续压缩表格。
- API 线路、模型价格等宽表需要继续按同样标准复核。

## 2026-06-25 后台 API 线路与模型价格宽表复核

### 已确认

- 已重新截取 `API 线路管理` 和 `模型价格` 两页，文件为 `api-providers-action-column-polish-desktop-1440x900.png`、`model-prices-action-column-polish-desktop-1440x900.png`。
- API 线路页操作列包含 6 个按钮：编辑、禁用、设默认、测试连接、拉取模型、删除；按钮高度已统一为 26px。
- 模型价格页操作列包含 3 个按钮：编辑价格、禁用、删除；按钮高度已统一为 26px。
- 两页操作列均继承 226px 宽度、轻边线和小阴影，未再出现上一轮那种大片白色遮罩。
- 两页均非 404/500，适合进入人工点测。

### 需要继续验证

- API 线路仍是超宽配置表，右侧部分字段需要横向滚动；如果后续追后台体验，应做列显隐、详情抽屉或“更多操作”菜单。
- 继续复核订单、日志、任务监控的状态色、表格密度和按钮层级。

## 2026-06-25 后台任务监控操作按钮复核

### 已确认

- 订单管理和消费日志当前截图可测，没有发现必须立即修复的视觉阻断问题。
- 任务监控操作列原来存在两个明显问题：竖排按钮被拉成 197px 长条色块；sticky 操作列背景半透明，导致参数/时间文字透出。
- 已将 `td:last-child` 下的竖排按钮容器右对齐，`admin-ghost`、`admin-danger` 表格按钮改为内容宽度。
- 已将 sticky 操作列背景改为纯白，避免底层文字透出。
- Playwright 验证：`详情` 按钮 58x26，`删除记录` 按钮 60x26，操作列背景 `rgb(255, 255, 255)`。
- 已归档截图：`docs/design-references/admin-2026-06-25/generate-tasks-action-buttons-polish-desktop-1440x900.png`。

### 需要继续验证

- 任务监控仍是宽表，参数/时间列需要横向滚动；如果后续追更好体验，应做详情抽屉或列显隐。
- 继续复核兑换码、模板工作流和系统设置的弹窗/保存回显视觉。

## 2026-06-25 后台模板工作流绿色统一复核

### 已确认

- 兑换码创建弹窗和 API 线路弹窗的主按钮已经是绿色白字，暂不需要改。
- 模板工作流页原先仍有橙色主按钮和橙色选中态：`新增`、`保存配置`、`生成预览`、`新增图片槽`、`新增字段`、选中模板卡和 checkbox。
- 已在后台作用域 CSS 中覆盖 `bg-orange-500`、`bg-orange-50 text-orange-600`、`border-orange-200 bg-orange-50`，统一为 emerald 绿系。
- 已统一后台 checkbox：`accent-color: #10b981`。
- 内置浏览器验证：页面按钮未再检测到 `rgb(249, 115, 22)` 橙色背景，checkbox accent-color 为 `rgb(16, 185, 129)`。
- 已归档截图：`docs/design-references/admin-2026-06-25/template-workflows-green-actions-desktop-1440x900.png`。

### 需要继续验证

- 人工确认模板工作流绿色统一后的观感。
- 继续复核兑换码创建/删除弹窗、API 线路保存回显和系统设置保存提示。

## 2026-06-25 后台弹窗绿色按钮复核

### 已确认

- 已重新打开兑换码创建弹窗和 API 线路新增弹窗，截图归档为 `redeem-modal-green-review-desktop-1440x900.png`、`api-provider-modal-green-review-desktop-1440x900.png`。
- 兑换码弹窗 `创建` 按钮为绿色白字，API 线路弹窗 `保存` 按钮为绿色白字。
- 两个弹窗均非 404/500，也未出现 `Internal Server Error` 或 `Cannot GET`。
- 本轮没有改动画布卡片、画布用户面板和前端主流程结构。

### 需要继续验证

- 弹窗内部主按钮仍使用 Naive 默认绿，和外层后台主按钮不是完全同一个渐变；目前视觉方向一致，后续可按人工反馈统一到同一套按钮 token。
- 继续验证系统设置保存提示、兑换码删除确认和 API 线路保存回显。

## 2026-06-25 后台删除/回收站 UI 复核

### 已确认

- `smoke-admin-ui.ps1` 通过，系统设置保存点击、API 线路弹窗、兑换码弹窗和模板工作流保存点击均可执行。
- `smoke-admin-delete-ui.ps1` 初次失败点是回收站页面行等待和计数过严；诊断显示前端回收站实际能显示刚删除的用户。
- 已加固 `smoke-admin-delete-ui-runner.js`：进入回收站后等待目标用户名出现，匹配行数改为至少 1；恢复后等待目标用户名消失。
- 已把 `/admin/recycle-bin` 加入 `smoke-frontend-routes.ps1`，后续前端路由 smoke 会覆盖回收站入口。
- 重跑后删除/恢复 UI smoke 通过，截图已刷新：`admin-user-delete-target-desktop-1440x900.png`、`admin-user-delete-confirm-desktop-1440x900.png`、`admin-user-recycle-row-desktop-1440x900.png`、`admin-user-restore-complete-desktop-1440x900.png`。

### 需要继续验证

- 删除确认和回收站恢复已经可测；后续仍需人工确认交互文案和按钮危险色是否符合预期。
- Docker 容器状态仍依赖 Docker Desktop Engine，当前不能把部署验证标为完成。

## 2026-06-25 模板/图库主流程 UI 复核

### 已确认

- 新增 `scripts/smoke-template-ui.ps1` 和 `scripts/smoke-template-ui-runner.js`。
- 模板 UI smoke 已覆盖：选中“一键主图反推复刻”、上传参考设计图、上传产品素材图、反推提示词、生成 mock 图片、确认生成记录写入 `/api/user/generations`。
- 模板流程截图已归档：`template-main-image-selected-desktop-1440x900.png`、`template-uploaded-desktop-1440x900.png`、`template-reverse-prompts-desktop-1440x900.png`、`template-generate-result-desktop-1440x900.png`。
- 图库 UI smoke 已重跑通过，覆盖桌面 2 张生成历史、保存全部链接复制 2 行、移动端 2 张生成历史、删除后桌面/移动端空状态。
- `preflight-check.ps1` 的 `SMOKE_UI=true` 分支已加入模板 UI smoke 和图库 UI smoke，后续一轮 UI 预检会覆盖这两条主流程。

### 需要继续验证

- 模板页真实 New-API 接入后，提示词结构和生成结果耗时需要重新校准。
- 当前模板 UI smoke 使用 `logo.png` 作为测试素材，适合验证链路，不代表真实商品图视觉质量。
- 你需要人工看模板上传/反推/生成截图，确认布局和手感是否接受。

## 2026-06-25 Docker HOST_PORT 部署复核

### 已确认

- Docker Desktop Engine 已可用，`docker info` 正常返回 Server 信息。
- 默认 `3456` 端口被本地 Node 服务占用时，Docker 直接启动会报端口绑定失败。
- 已新增 `HOST_PORT`：宿主机端口可设为 `3457`，容器内部仍保持 `PORT=3456`。
- 使用 `HOST_PORT=3457` 完整执行 `scripts\verify-internal-deploy.ps1` 通过：compose config、build、up、health、API smoke、前端路由 smoke、restart persistence smoke、compose ps。
- 最终容器状态为 healthy，映射 `0.0.0.0:3457->3456/tcp`。

### 需要继续验证

- 服务器部署时建议只使用一个正式端口，避免 Node 本地服务和 Docker 同时抢端口。
- 公司内网访问需要按实际服务器 IP、防火墙入站规则和路由策略再测。

## 2026-06-25 后台按钮颜色清新化复核

### 已确认

- 按人工反馈，后台主按钮不再使用偏亮、偏糖果感的薄荷渐变。
- `assets/admin-visual-polish.css` 只调整后台主按钮颜色、边框和阴影，不改后台卡片结构、圆角、高度、表格布局。
- Playwright 已重新打开 `/admin/settings`，`保存设置` 按钮 computed style 为：背景 `rgb(16, 185, 129)`、文字 `rgb(255, 255, 255)`、边框 `rgba(16, 185, 129, 0.9)`、轻阴影 `rgba(16, 185, 129, 0.18)`。
- 截图已归档：`settings-save-button-fresh-green-desktop-1440x900.png`。
- 后台 UI smoke 已通过，覆盖 Dashboard、系统设置保存、API 线路弹窗、兑换码弹窗、模板工作流保存。
- `/api/generation/estimate-cost` 已改为未登录可 mock 预估，`smoke-api.ps1` 已补 public estimate 覆盖，避免首页未登录 401 刷红。

### 需要继续验证

- 后台 10 页还要继续逐页看标题、图标、按钮、字距、表格密度和空状态。
- 这次没有做后台整体风格重排，只处理颜色突兀点；后续视觉问题继续按截图逐个收。
- 新颜色需要人工确认是否比原截图里的浅薄荷按钮舒服。

## 2026-06-25 首页/画布入口 UI Smoke 复核

### 已确认

- 新增 `scripts/smoke-home-canvas-ui.ps1` 和 `scripts/smoke-home-canvas-ui-runner.js`。
- 首页检查项包含：`电商自动化工作台`、`Beta`、`电商全流程工作台`、`我的历史画布项目`、`新画布`、`模板`、`图库`，并验证 `.history-track` 的 `data-inertia-ready=1`。
- 画布检查项包含：Vue Flow 容器、工具栏文字、画布节点文字，当前 smoke 打开后可渲染 2 个节点。
- 本轮修复未登录 `/api/user/api-status` 401，和未登录 `/api/generation/estimate-cost` 一样走 mock 兜底；重跑首页/画布 UI smoke 后 console error 为 0，badResponses 为 0。
- 新脚本已接入 `preflight-check.ps1` 和 `verify-internal-deploy.ps1` 的 `SMOKE_UI=true` 分支。
- Docker 已用 `HOST_PORT=3457` 重新构建并跑通部署验证，容器内 API smoke 覆盖 public `/api/user/api-status`。

### 需要继续验证

- 首页移动端和画布移动端还没有纳入这个新 smoke，本轮只覆盖桌面 1440x900。
- 画布本地自动保存提醒是当前本地优先策略的预期提示，后续需要人工确认是否影响使用感。
- 后台逐页视觉复核仍要继续，尤其是标题、按钮、图标和表格密度。

## 2026-06-25 后台 10 页视觉审计护栏

### 已确认

- 已重跑后台 10 页 `full-*.png` 截图：Dashboard、用户、订单、日志、兑换码、API 线路、模型价格、任务监控、模板工作流、系统设置。
- `smoke-admin-pages-ui-runner.js` 已从“截图可打开”增强为“截图 + 样式审计”：标题颜色/字重、按钮样本、旧薄荷按钮残留、表格行高、sticky 操作列宽度都会被检查。
- 本轮 10 页全部通过：标题颜色均为深色 `rgb(2, 6, 23)`，标题字重均为 `900`，旧薄荷按钮残留 0。
- 表格行高审计通过：普通表格 58px，用户/API 线路/任务监控等复杂行最大 85px，未超过 92px。
- sticky 操作列审计通过：当前固定操作列宽度 226px，未超过 245px，背景为白色。

### 需要继续验证

- 视觉审计能抓基础一致性，但不能替代人工审美判断；仍需要人工确认宽表操作列、按钮密度和列表可读性。
- 用户管理、API 线路、任务监控仍是宽表结构，若后续觉得操作列拥挤，建议做“更多操作”菜单或详情抽屉。
- 后台移动端还没有做专项体验优化。

## 2026-06-25 后台保存刷新回显 UI 验证

### 已确认

- 新增 `scripts/smoke-admin-save-echo-ui.ps1` 和 `scripts/smoke-admin-save-echo-ui-runner.js`。
- 系统设置页已验证：临时修改“新用户注册赠送”数值，打开真实后台页面、点击保存、刷新后仍能回显，然后恢复原设置。
- API 线路页已验证：临时创建 New-API 风格线路，刷新页面能看到线路名称和 Base URL，截图后删除临时线路。
- 模型价格页已验证：临时创建模型价格，刷新页面能看到模型名称，截图后删除临时模型。
- 模板工作流页已验证：通过真实 UI 修改第一个模板名称、点击保存配置、刷新后输入框仍回显，截图后恢复原模板配置。
- 截图已归档：`save-echo-settings-desktop-1440x900.png`、`save-echo-api-provider-desktop-1440x900.png`、`save-echo-model-prices-desktop-1440x900.png`、`save-echo-template-workflows-desktop-1440x900.png`。
- 新脚本已接入 `preflight-check.ps1` 和 `verify-internal-deploy.ps1` 的 `SMOKE_UI=true` 分支。

### 需要继续验证

- 这轮覆盖的是桌面后台复杂配置链路；后台移动端表格/弹窗还没有专项优化。
- Playwright 自动截图能证明打开和回显，但最终视觉舒适度仍需要人工看截图确认。
- New-API 真实 token 接入后，API 线路“测试连接”和模型同步还需要再做真实网关验收。

## 2026-06-25 移动端主流程 Smoke 加固

### 已确认

- `scripts/smoke-mobile-ui.ps1` 现在会读取 `SMOKE_BASE_URL`、检查 `/api/health`，并自动打开 Playwright session，后续可用于本地 `3456` 和 Docker `3457`。
- 移动端 runner 已覆盖 390x844 首页、模板、画布、用户兑换码、后台 Dashboard、后台 API 线路、后台模板工作流。
- 首页移动端验证结果：`horizontalOverflow=0`，标题没有拆成单字，console error 为 0，bad response 为 0。
- 画布移动端验证结果：Vue Flow 存在，节点数为 2，横向溢出为 0。
- 后台移动端三页可打开并截图，未出现 404/500 或关键 console 错误。
- `SMOKE_UI=true` 的预检和 Docker 部署验证链已接入移动端 smoke。

### 需要继续验证

- 后台移动端仍偏“能用优先”，复杂表格没有做卡片化，后续如果要给手机端正式使用，需要单独做设计。
- 移动端截图能证明无空白和无明显溢出，但视觉审美仍需要人工看图确认。

## 2026-06-25 后台移动端视觉微调

### 已确认

- 顶部操作按钮新增移动端 nowrap 规则，`返回前台` 不再在 390 宽度下拆成竖字。
- 后台移动端表格最小宽度调整为 820px，保留横向滚动策略。
- 移动端 sticky 操作列从 226px 收窄到 188px，表格按钮缩小到 10.5px/50px，API 线路页面右侧按钮压迫感降低。
- 重跑 `scripts/smoke-mobile-ui.ps1` 通过：首页、模板、画布、用户兑换码、后台 Dashboard、API 线路、模板工作流均无 404/500、无 console error、无 bad response。
- 人工查看最新 `admin-dashboard-mobile-390x844.png`、`admin-api-providers-mobile-390x844.png`、`admin-template-workflows-mobile-390x844.png`，顶部按钮和 API 线路操作列较上一版更自然。

### 需要继续验证

- 当前仍不是后台移动端正式卡片化方案，只是内网人工测试阶段的视觉压迫修复。
- 用户管理、订单、日志、任务监控等更多后台宽表移动端截图后续可继续专项抽查。

## 2026-06-25 New-API/CPA Provider 护栏

### 已确认

- 新增 `scripts/smoke-provider-guard.ps1`。
- `/api/health` 当前返回 `providers.ai.gateway = new-api`，并声明 `routesThroughNewApi=true`、`cpaExpectedBehindNewApi=true`。
- 当前未启用真实 AI，Provider guard 验证后台 API 线路测试返回 `mock:true`。
- 当前未启用真实 AI，Provider guard 验证 `/api/chat/completions` 返回本地 mock 响应。
- 脚本已接入 `preflight-check.ps1` 和 `verify-internal-deploy.ps1`，以后默认预检会检查无 key mock 回落护栏。

### 需要继续验证

- 真实 New-API 地址和 token 还没有配置，真实网关联通测试未执行。
- CPA 只作为 New-API 后置渠道，本项目不保存 CPA 账号池凭据；CPA 是否可用需要在 New-API 后台单独验证。

## 2026-06-25 API 线路弹窗可读性

### 已确认

- 原 API 线路新增/编辑弹窗只有 placeholder，没有字段 label；已有值时用户无法判断每个白色输入框含义。
- 新增 `assets/admin-api-form-labels.js`，运行时只增强 API 线路弹窗，不影响其他页面。
- 弹窗现在会显示 18 个中文字段名和说明：后端真实名称、前端展示名称、线路标识、渠道类型、接口格式、Base URL、API Key、聊天接口、生图接口、视频接口、默认聊天模型、默认生图模型、默认视频模型、优先级、线路倍率、状态、默认线路、备注。
- API Key 说明明确：编辑时留空表示不修改，不要把真实 key 提交到 Git。

### 需要继续验证

- 用户手动填真实 New-API 线路后，需要继续测后台“测试连接”。
- 模板反推和模板生图当前仍是 mock 逻辑，真实 New-API 连通后需要继续补这两条业务调用链。

## 2026-06-25 画布生图接通排查

### 已确认

- 本地服务重启后，`.env` 中的 key 已被识别：`/api/health` 返回 `textKeyConfigured=true`、`imageKeyConfigured=true`。
- 当前仍是 mock 模式：`/api/health` 返回 `providers.ai.enabled=false`，原因是 `.env` 没有启用 `ENABLE_REAL_AI=true`。
- `/api/generate/tasks` 已改为真实启用时调用 Provider Adapter 的图片生成；未启用时继续 mock。
- `/api/template/generate-image` 已改为真实启用时调用 Provider Adapter 的图片生成；未启用时继续 mock。
- 新增 `/api/proxy-image`，用于把上游远程图片转为本地同源地址，降低画布本地素材保存时的跨域 `Failed to fetch`。
- 已验证 mock 模式下画布生图和模板生图都返回 `success=true`、`mock=true`，返回的 `/api/mock-image/*.svg` 可 200 打开。
- 本地 Node `3456` 已运行本轮代码；Docker `3457` 重建时 Docker Desktop 报 `metadata.db: input/output error`，随后 `docker compose ps` 返回 `Docker Desktop is unable to start`，说明容器尚未更新到本轮代码，且 Docker 引擎需要人工重启。

### 需要继续验证

- 真实 New-API 尚未启用，不应声称真实生图已跑通。
- 开启真实调用需要人工在 `.env` 加 `ENABLE_REAL_AI=true` 并重启服务；这可能产生费用。
- 真实 New-API 的 `/images/generations` 返回结构、模型名和尺寸参数还需要一次实测；如果 New-API 使用自定义 endpoint，需要继续调整 Provider Adapter。
- 模板反推仍是 mock 文案，后续需要接 `/chat/completions` 或专门的反推 workflow。
- Docker Desktop 需要人工重启后再重建容器，确认 `docker compose ps` 可用，以及 `http://127.0.0.1:3457/api/proxy-image` 不再是 404。

## 2026-06-25 New-API 真实联通测试

### 已确认

- `.env` 加入 `ENABLE_REAL_AI=true` 并重启本地 Node 后，`/api/health` 已显示真实模式：`enabled=true`、`mode=real-provider-ready`。
- Packy API 根路径 `https://www.packyapi.com` 返回网页 HTML，不是 OpenAI-compatible API JSON；正确 Base URL 已确认为 `https://www.packyapi.com/v1`。
- 后台 API 线路测试已通过真实文本 ping：`New-API 网关连接正常`，延迟约 3.9 秒。
- `server.js` 已修复 HTML 200 误判问题：如果 `/chat/completions` 没有返回 `choices`，会返回 `PROVIDER_CHAT_BAD_RESPONSE`。

### 需要继续验证

- 真实生图仍未通过，上游返回：`分组 codex 下模型 gpt-image-2 无可用渠道（distributor）`。
- 需要在 Packy/New-API 后台给 `codex` 分组配置可用的 `gpt-image-2` 生图渠道，或更换有生图权限的 key/分组。
- 如果 Packy 后台实际生图模型名不是 `gpt-image-2`，需要同步修改 `.env` 的 `AI_IMAGE_MODEL`。
- Docker Desktop 仍需人工重启后重建容器，当前本地 Node `3456` 是真实联通测试依据。

## 2026-06-25 画布生图模型类型保护

### 已确认

- `/api/model-routes?group=image` 返回图片线路和图片模型，`/api/model-routes?group=text` 返回文本线路和文本模型。
- 画布后端图片生成入口已新增模型类型保护：如果请求误传 `gpt-5.5` 这类文本模型，后端会回落到 `AI_IMAGE_MODEL` 或默认图片模型，不再拿文本模型请求 `/images/generations`。
- 验证时故意传 `model=gpt-5.5`，后端实际请求回落到 `gpt-image-2`，说明保护生效。

### 需要继续验证

- Packy token/分组仍是真实阻塞点：`gpt-image-2` 返回 `分组 codex 下模型 gpt-image-2 无可用渠道`。
- `gemini-3-pro-image-preview` 返回 `当前令牌未覆盖供应商 Google（已选分组=[codex mimo-officially]）`。
- 需要人工在 Packy/New-API 后台确认 token 所属分组、供应商覆盖和生图渠道。

## 2026-06-25 真实生图联通成功

### 已确认

- 用户更换生图可用 key 后，Packy `/v1/models` 可见 `gpt-image-2`。
- `/api/generate/tasks` 使用 `gpt-image-2` 已真实返回图片：`success=true`、`mock=false`、`providerMode=real-provider-ready`。
- 上游远程图已通过 `/api/proxy-image` 转为本地同源地址，代理请求返回 HTTP 200。
- 任务响应已补顶层 `modelKey/model` 字段，便于前端和日志展示。

### 需要继续验证

- 浏览器画布节点真实点击生成尚待人工确认。
- 模板页真实生图尚待人工确认。
- Docker Desktop 仍需重启后重建容器，本轮真实生图成功基于本地 Node `3456`。

## 2026-06-25 Packy 生图参数兼容

### 已确认

- Packy `/images/generations` 不接受 `response_format` 参数，画布错误 `Unknown parameter: 'response_format'` 来自这里。
- 移除 `response_format` 后，真实 `gpt-image-2` 生图成功。
- 图片生成耗时约 27 秒，本轮将图片超时独立设置为 180 秒，文本请求仍保持 30 秒。
- 返回的远程结果图经 `/api/proxy-image` 代理后 HTTP 200。

### 需要继续验证

- 前端画布节点真实点击后是否等待足够久。
- 模板页真实生图是否复用同一条兼容路径。

## 2026-06-26 源码化技术栈任务树启动

### 已确认

- 主目录固定为 `F:\dianshang`，并行工作树统一规划为 `F:\dianshang-worktrees\*`。
- CodeGraph 已在 `F:\dianshang` 初始化，结构定位和调用链分析后续优先用索引工具。
- 新前端成熟基座固定为 Vue 3、Vite、TypeScript、Vue Router、Pinia、Axios、Naive UI、lucide-vue-next、Vue Flow。
- 新画布继续基于 Vue Flow，不自研拖拽、连线、缩放、视口和小地图。
- 后端暂不创建 NestJS 工程，先写 API 契约和模块边界，避免推倒当前可运行旧版本。
- `docs/api-contract-next.md`、`docs/backend-module-boundaries.md`、`docs/canvas-migration-checklist.md` 已作为第一批迁移边界文档落地。
- `.codegraph/` 已加入 `.gitignore`，本地索引不会进入版本库。

### 需要继续验证

- API 契约需要继续对照真实 `/api/*` 路由、字段和错误码做逐项复核。
- 新版 `/canvas` 需要人工点测节点新增、属性面板、连线、JSON 导入导出、本地保存和生成入口。
- 后端模块边界需要补充数据库表归属、错误码归属和 smoke 覆盖关系。
- 未经确认不安装新依赖、不引入数据库/Redis/对象存储、不真实调用外部服务。

## 2026-06-26 哈基米旧画布 UI 迁移

### 已确认

- 用户明确要求新版画布 UI 继续使用哈基米旧画布的整体布局和卡片板块。
- `Infinite-Canvas-main.zip` 是用户提供的画布源码参考，但本轮 UI 主风格以用户截图中的哈基米旧画布为准。
- Vue Flow 继续作为底层成熟画布引擎；顶部工具条、左侧 Canvas Chat、右侧 Create Node、节点卡片视觉为本项目业务 UI。
- 默认节点坐标已整体避开左侧 Canvas Chat，且导入或读取旧本地缓存时会自动右移避免遮挡。
- 浏览器截图已归档：`docs/design-references/canvas-hjm-legacy-layout-final-2026-06-26.png`。

### 需要继续验证

- 用户人工确认新版 `/canvas` 与截图中的旧哈基米画布视觉接近度。
- 右侧节点菜单的“文生图、视频生成、撤销、重做”目前是 UI 占位，还未接完整动作。
- 左侧快速模式输入框还未接真实生成任务，只完成 UI 迁移。

## 2026-06-26 Infinite-Canvas 节点与模板迁移

### 已确认

- 新 Vue Flow 画布已注册 Infinite-Canvas 第一批全量节点：图片、提示词、循环、LLM、API生成、MS生成、视频生成、RunningHub、ComfyUI、LTX Director、Output、分组、提示词组。
- 所有节点通过同一个 Store 注册表创建，避免后续继续搓临时节点。
- 提示词模板直接来自 `Infinite-Canvas-main` 的系统模板 Markdown，已进入 `frontend/public/system-prompts/infinite-canvas-prompt-templates.md`。
- 浏览器自动化已验证：13 类节点都能创建，提示词模板可见并可应用，运行按钮可让节点进入 ready/done 状态，图片和视频示例输出字段存在。

### 需要继续验证

- 真实外部执行器尚未逐项接入；当前是前端运行状态与示例输出跑通。
- 后续接真实执行器前，需要确认 ComfyUI、RunningHub、ModelScope、LTX、视频 API 的环境、密钥和本机/局域网地址。
- 提示词模板目前先显示搜索结果前 8 个；后续需要补分类 Tab、详情预览、正向/完整应用两个按钮，与 Infinite-Canvas 行为完全对齐。

## 2026-06-26 Infinite-Canvas 运行适配器

### 已确认

- 新增 `canvasRunner` 适配器，避免把运行逻辑散写在画布组件内。
- `generator` 和 `msgen` 已接入本地成熟接口 `/api/generate/tasks`。
- `llm` 已接入本地成熟接口 `/api/chat/completions`。
- 适配器会从 Vue Flow 连线收集上游提示词和参考图，符合 Infinite-Canvas 的节点输入输出迁移方向。
- 未登录浏览器验证中，真实后端接口返回 401，节点进入 error 并显示明确原因；没有执行真实外部付费调用。
- `video`、`ltxDirector`、`comfy`、`rh` 当前可完成前端运行状态，但真实外部执行器仍需要环境配置。

### 需要继续验证

- 登录态下真实 `generator` 生图需要人工确认，因为可能消耗算力。
- 登录态下真实 `llm` 文本改写需要人工确认，因为可能消耗模型额度。
- ComfyUI、RunningHub、LTX、视频生成必须先确认环境和密钥，不能写自研替代执行器。

## 2026-06-26 新画布废止并回滚旧画布

### 已确认

- 用户明确要求“新画布直接全部废止，回滚到旧画布”。
- `frontend/` 中的新画布已经从构建链路移除：删除 `CanvasStudio.vue`、新画布 Store、类型、运行适配器和 Infinite-Canvas 提示词模板文件。
- 已卸载 `@vue-flow/core`、`@vue-flow/background`、`@vue-flow/controls`、`@vue-flow/minimap`，新前端不再依赖 Vue Flow。
- `frontend/src/views/LegacyCanvasRedirect.vue` 负责把新前端 `/canvas` 跳转到旧后端 `http://127.0.0.1:3456/canvas`。
- 旧画布资产 `assets/Canvas-*.js/css` 和旧后端 `server.js` 未被本轮修改。

### 需要继续验证

- 人工打开 `http://127.0.0.1:3456/canvas`，确认回到旧画布。
- 后续画布问题只在旧画布链路做最小修复，不继续推进新画布或 Infinite-Canvas 节点迁移。

## 2026-06-26 前端源码化迁移骨架

### 已确认

- 前端源码化不再包含新画布。
- 未迁移页面使用统一桥接组件跳转旧前端，避免旧功能断链。
- `frontend/src/config/frontendMigration.ts` 成为页面迁移索引，每个路由标记 source 或 legacy。
- 首页显示迁移索引，便于人工确认哪些页面还在旧版、哪些已进入源码。

### 需要继续验证

- `/template-image` 是下一批最适合迁移的核心业务页。
- 后台页面数量多，建议最后迁移。

## 2026-06-26 模板生图页源码迁移

### 已确认

- `/template-image` 已由 `frontend/` 源码承载，不再桥接旧页面。
- 模板配置来自 `/api/template/settings`，当前可加载 10 个模板。
- 图片/文本线路来自 `/api/model-routes?group=image/text`。
- 反推和生成沿用旧后端接口，不新造业务接口。
- 无登录验证只触发本地 401，不会发生真实付费生成。

### 需要继续验证

- 登录态真实上传和反推。
- 登录态真实生成前需人工确认算力消耗。
- 移动端 390px 布局还需截图复核。

## 2026-06-26 图库页源码迁移

### 已确认

- `/gallery` 已由 `frontend/` 源码承载，不再桥接旧页面。
- 图库历史读取复用 `/api/user/generations`。
- 删除记录复用 `DELETE /api/user/generations/:id`，未新增后端接口。
- 无登录验证只触发预期 401，并显示中文登录提示。
- 截图已归档：`docs/design-references/gallery-source-2026-06-26.png`。

### 需要继续验证

- 登录态真实图库数据。
- 删除记录需要测试数据确认后再点测。
- 移动端布局需补截图。

## 2026-06-26 登录注册源码迁移

### 已确认

- `/login` 和 `/register` 已由 `frontend/` 源码承载。
- 登录接口复用 `/api/auth/login`。
- 注册流程复用 `/api/auth/send-email-code` 和 `/api/auth/register`。
- 已用默认账号 `admin/admin123` 验证登录成功。
- 登录后 token 写入 `auth_token`，源码图库页可带 token 请求，不再出现 401。

### 需要继续验证

- 注册新账号完整路径。
- 源码前端退出登录。
- 登录态下模板页上传/反推/生成。

## 2026-06-26 用户中心源码迁移

### 已确认

- `/user/center` 已由 `frontend/` 源码承载。
- 用户资料复用 `/api/user/profile`。
- 余额流水复用 `/api/user/balance-logs`。
- API 状态复用 `/api/user/api-status`。
- 已用 `admin/admin123` 验证登录态用户中心，无 4xx 响应。
- 截图已归档：`docs/design-references/user-center-source-2026-06-26.png`。

### 需要继续验证

- `/user/records` 和 `/user/redeem` 仍需源码迁移。
- 头像上传和头像预设编辑暂未迁移。
- 移动端布局需补截图。

## 2026-06-26 生成记录与兑换码源码迁移

### 已确认

- `/user/records` 已由 `frontend/` 源码承载，生成历史复用 `/api/user/generations`，余额流水复用 `/api/user/balance-logs`。
- `/user/redeem` 已由 `frontend/` 源码承载，用户余额复用 `/api/user/profile`，兑换提交复用 `/api/user/redeem`，最近流水复用 `/api/user/balance-logs`。
- 已用默认账号 `admin/admin123` 验证登录态访问；生成记录页显示 13 条生成记录和 16 条余额流水；兑换页显示当前算力 `999989` 和 8 条最近流水。
- 浏览器验收没有 page error，也没有 4xx/5xx API 响应。
- 截图已归档：`docs/design-references/user-records-source-2026-06-26.png`、`docs/design-references/user-redeem-source-2026-06-26.png`。

### 需要继续验证

- 真实兑换码提交会改变余额，自动化未提交兑换码；需要测试码或人工确认后再测。
- 移动端布局还需补 390px 截图。
- 头像上传/预设头像编辑暂未进入源码化迁移。

## 2026-06-26 用户模块移动端与登录态前台回测

### 已确认

- 390x844 移动端打开 `/user/records` 时，初次回测发现横向溢出 90px，原因是生成图片卡片被图片固有宽度撑开。
- 已补源码 CSS 约束，复跑后 `/user/records` 的 `scrollWidth=clientWidth=390`，横向溢出为 0。
- `/user/redeem` 移动端同样为 0 横向溢出，余额和最近流水可见。
- 登录态 `/template-image` 只做非付费加载回测，确认 10 个模板、2 个素材槽、无 4xx/5xx API。
- 登录态 `/gallery` 确认 13 张记录、无 4xx/5xx API。
- 截图已归档：`docs/design-references/user-records-source-mobile-390x844-2026-06-26.png`、`docs/design-references/user-redeem-source-mobile-390x844-2026-06-26.png`、`docs/design-references/template-image-source-login-2026-06-26.png`、`docs/design-references/gallery-source-login-2026-06-26.png`。

### 需要继续验证

- 浏览器仍有一个非 API 的 404 静态资源提示，业务 API 无 4xx/5xx；后续可单独补 favicon 或定位静态资源。
- 真实模板反推/生成会消耗模型额度，本轮未点击。
- 图库删除和兑换码提交会改数据，本轮未点击。
- 部分历史中文 prompt 显示为问号，疑似早期数据编码遗留，需要另开数据修复任务。

## 2026-06-26 Codex 自带浏览器前台源码页点测

### 已确认

- 已按用户要求使用 Codex 自带浏览器可见窗口点测，不再只依赖 headless 截图。
- 默认账号 `admin/admin123` 可在源码登录页登录，登录后跳转 `/gallery`。
- 桌面视口点测结果：
  - `/gallery`：标题“图库历史”，13 张图库卡片，横向溢出 0。
  - `/template-image`：标题“模板生图工作台”，10 个模板按钮，2 个素材槽，横向溢出 0。
  - `/user/records`：标题“生成记录”，2 个面板、13 条生成记录、16 条流水，横向溢出 0。
  - `/user/redeem`：标题“兑换码”，余额 `999989`、8 条最近流水，横向溢出 0。
- 移动端视口点测结果：
  - `/user/records`：横向溢出 0，13 条生成记录和 16 条流水可见。
  - `/user/redeem`：横向溢出 0，余额 `999989` 可见。
- 自带浏览器页面业务控制台错误为 0。
- 截图已归档：`docs/design-references/iab-gallery-source-login-2026-06-26.png`、`docs/design-references/iab-template-image-source-login-2026-06-26.png`、`docs/design-references/iab-user-records-source-2026-06-26.png`、`docs/design-references/iab-user-redeem-source-2026-06-26.png`、`docs/design-references/iab-user-records-mobile-390x844-2026-06-26.png`、`docs/design-references/iab-user-redeem-mobile-390x844-2026-06-26.png`。

### 需要继续验证

- 本轮没有触发真实生成、兑换码提交和图库删除，避免消耗额度或改数据。
- 自带浏览器运行环境出现过 Codex/Statsig 统计请求超时日志，不影响本地业务页；后续只把业务页面控制台作为验收依据。
- 注册新账号和后台源码页仍未进入本轮点测。

## 2026-06-26 源码前端 Playwright 点击 Smoke

### 已确认

- 新增 `scripts/smoke-source-frontend-ui.ps1` 和 `scripts/smoke-source-frontend-ui-runner.js`，专门覆盖 `frontend/` Vue3 源码页，并接入 `scripts/preflight-check.ps1` 的 `SMOKE_UI=true` 分支。
- 脚本使用 Playwright CLI，不新增依赖；`npx` 已确认可用。
- 点击链路已跑通：
  - 登录页填写 `admin/admin123` 并点击登录。
  - 图库页填写搜索词 `simple`，确认至少 1 张卡片，再点击刷新。
  - 模板页点击“白底图”，确认选中模板发生变化，再填写提示词文本。
  - 生成记录页填写搜索词 `simple`，确认至少 1 条记录，再点击刷新。
  - 兑换码页填写测试文本，但只点击刷新，不提交兑换码。
  - 390x844 移动端复核 records/redeem 横向溢出为 0。
- 脚本输出无 4xx/5xx API、无业务 console error。
- 截图已归档到 `docs/design-references/source-frontend-2026-06-26/`。

### 需要继续验证

- 真实生成、兑换码提交和图库删除仍需要人工确认费用和测试数据后再测。

## 2026-06-26 源码前端注册点击 Smoke

### 已确认

- `/register` 注册页已纳入 `scripts/smoke-source-frontend-ui-runner.js`。
- Playwright 会填写唯一临时用户名、邮箱和密码，点击“发送验证码”，确认验证码自动填入，再点击“注册”。
- 注册成功后确认跳转 `/gallery`，并保存注册成功截图。
- 注册产生的临时用户会通过后台登录接口清理：先软删除，再调用回收站永久删除接口。
- 清理后脚本清空本地登录态，再继续默认账号 `admin/admin123` 的原有源码前端点击回归。
- 重新运行 `scripts/smoke-source-frontend-ui.ps1` 已通过，结果包含 `register ok` 和 `register-cleanup ok`。

### 需要继续验证

- 注册 smoke 使用当前本地服务和当前库，虽然会清理临时用户，但仍属于写入型测试；生产环境运行前需要确认测试库或 disposable 环境。
- 真实生成、真实兑换码提交和图库删除仍没有自动执行，避免费用和数据变化。

## 2026-06-26 源码前端导航与退出登录 Smoke

### 已确认

- 首页迁移索引已纳入 `scripts/smoke-source-frontend-ui-runner.js`。
- Playwright 会打开 `/`，确认“前端迁移索引”，点击 `/user/center` 源码入口进入用户中心。
- 用户中心会检查横向溢出为 0，并点击“图库历史”快捷按钮确认可导航到图库页。
- 脚本末尾会回到用户中心点击“退出登录”，确认跳转 `/login`，并确认 localStorage 中 `auth_token` 和 `auth_user` 已清空。
- 重新运行源码前端 smoke 已通过，结果包含 `home-index-user-navigation ok` 和 `logout ok`。

### 需要继续验证

- 真实付费和破坏性动作仍未自动执行。
- 后台源码化页面尚未进入 `frontend/`。

## 2026-06-26 源码前端未登录边界与自带浏览器点击复核

### 已确认

- `scripts/smoke-source-frontend-ui-runner.js` 已移除 `networkidle` 硬等待，统一使用 DOM 就绪加短暂稳定等待，避免源码前端 smoke 在本地开发服务中卡死。
- 源码前端 smoke 已新增未登录态边界：
  - `/gallery` 显示“请先登录”提示，预期 401 被白名单识别。
  - `/user/center` 显示“请先登录后查看用户中心。”
  - `/user/records` 显示“请先登录后查看生成记录。”
  - `/user/redeem` 显示“请先登录后兑换。”
- 重新运行源码前端 smoke 已通过，覆盖注册清理、未登录边界、默认账号登录、首页跳转、用户中心快捷导航、图库、模板、记录、兑换页、移动端和退出登录。
- 已按用户要求使用 Codex 自带浏览器真实点击当前页面：兑换页填写测试码但不提交、点击刷新、点击用户中心、从用户中心点击图库历史、进入生成记录并搜索 `simple`。
- 自带浏览器复核的 `/user/redeem`、`/user/center`、`/gallery`、`/user/records` 横向溢出均为 0。

### 需要继续验证

- 本轮仍未触发真实生成、兑换码提交、图库删除，避免费用和数据变化。
- Codex 自带浏览器运行时出现 Statsig 统计请求超时日志，但本地业务页面检查通过；后续仍以业务 API 和页面错误作为验收依据。

## 2026-06-26 源码首页迁移看板复核

### 已确认

- 首页迁移看板直接读取 `frontendMigrationRoutes`，没有硬编码新增路由列表。
- 页面显示 `8` 个源码页面、`13` 个旧版桥接、`21` 个总入口。
- 阶段卡显示“前台源码化”“旧画布保留”“后台迁移”，和当前画布废止、后台桥接策略一致。
- Playwright smoke 已新增首页统计和阶段卡断言，避免后续路由变化时看板静默失真。
- Codex 自带浏览器已打开首页并检查横向溢出为 0；滚动到迁移索引后点击“模板生图”，成功进入 `/template-image`。

### 需要继续验证

- 首页看板只解决迁移透明度，不代表后台页面已源码化。
- CodeGraph 索引仍显示已废止的新画布文件，后续结构分析前需要重建或谨慎对照磁盘状态。

## 2026-06-26 源码后台登录复核

### 已确认

- `/admin/login` 已由 `frontend/` 源码承载，并从迁移配置中的 `legacy` 改为 `source`。
- 登录接口复用 `/api/admin/login`，不新增后端接口、不新增依赖。
- 登录成功后写入源码前端 `auth_token/auth_user`，页面展示“管理员登录成功”。
- Playwright smoke 已覆盖后台登录源码页，确认默认管理员账号可登录并保存 session。
- Codex 自带浏览器点测通过：填写 `admin/admin123` 后显示成功态，再访问 `/user/center` 可读取 admin 资料，证明源码前端 session 生效。

### 需要继续验证

- 旧后台运行在 `http://127.0.0.1:3456`，源码前端运行在 `http://127.0.0.1:5173`，两个 origin 的 localStorage 不共享；旧后台仍需旧入口登录。
- 后台其余页面仍是旧桥接，下一步应从只读 Dashboard 开始迁移，不先动删除、保存、价格等写入页。

## 2026-06-26 源码后台 Dashboard 复核

### 已确认

- `/admin/dashboard` 已由 `frontend/` 源码承载，并从迁移配置中的 `legacy` 改为 `source`。
- Dashboard 只调用只读接口：`/api/admin/dashboard` 和 `/api/admin/dashboard/user-credit-ranking`。
- 页面展示 6 张统计卡、模型使用、线路概览、用户消耗排行和最近生成任务。
- Playwright smoke 已覆盖桌面 Dashboard、刷新按钮、排行/任务行数和 390x844 移动端横向溢出。
- Codex 自带浏览器点测通过：打开 `/admin/dashboard`，点击“刷新”，页面横向溢出为 0。

### 需要继续验证

- 后台 Dashboard 是只读迁移，不代表用户管理、API 线路、模型价格等写入页已源码化。
- `F:\dianshang` 后端依赖未安装，独立启动会缺 `express`；本轮继续复用旧项目后端 `C:\Users\pc\Desktop\hjm-mb-clone`。

## 2026-06-26 源码后台用户管理只读复核

### 已确认

- `/admin/users` 已由 `frontend/` 源码承载，并从迁移配置中的 `legacy` 改为 `source`。
- 用户页只调用只读接口 `/api/admin/users`，不提供删除、改余额、重置密码等写入动作。
- 页面支持关键词搜索、角色/状态筛选、分页和刷新，统计卡显示总数、当前页、启用账户、管理员和余额。
- Playwright smoke 已覆盖桌面用户管理搜索 `admin`、刷新、统计卡数量、列表行数、`admin@local` 可见性，以及 390x844 移动端横向溢出。
- Codex 自带浏览器点测通过：打开 `/admin/users`，搜索 `admin`，点击“查询”和“刷新”，页面横向溢出为 0。

### 需要继续验证

- 当前用户管理页是只读迁移，不代表旧后台的删除、恢复、改余额、重置密码等写入能力已源码化。
- CodeGraph 当前 Vue 索引数量少于实际源码页，继续结构分析前应考虑重建索引或以构建结果为准。

## 2026-06-26 源码后台任务监控只读复核

### 已确认

- `/admin/generate-tasks` 已由 `frontend/` 源码承载，并从迁移配置中的 `legacy` 改为 `source`。
- 任务监控页只调用只读接口 `/api/admin/generate-tasks`，不调用取消任务和删除任务接口。
- 页面支持关键词搜索、状态筛选、分页和刷新，统计卡显示总数、成功、运行中、等待、失败和当前页消耗。
- Playwright smoke 已覆盖桌面任务监控搜索 `simple`、刷新、统计卡数量、列表行数、`gpt-image-2` 可见性，以及 390x844 移动端横向溢出。
- Codex 自带浏览器点测通过：打开 `/admin/generate-tasks`，搜索 `simple`，点击“查询”和“刷新”，页面横向溢出为 0。

### 需要继续验证

- 当前任务监控页是只读迁移，不代表旧后台的取消任务、删除任务等写入能力已源码化。
- 旧接口不支持关键词服务端搜索，本轮是当前页前端筛选；新后端接管时需要在 API 契约里补正式 keyword 参数。

## 2026-06-26 源码后台消费日志只读复核

### 已确认

- `/admin/logs` 已由 `frontend/` 源码承载，并从迁移配置中的 `legacy` 改为 `source`。
- 消费日志页只调用只读接口 `/api/admin/usage-logs`，不调用余额调整或用户写入接口。
- 页面支持关键词搜索、类型筛选、分页和刷新，统计卡显示总数、当前页收入、当前页消耗、生成记录和兑换记录。
- Playwright smoke 已覆盖桌面消费日志搜索 `注册赠送`、刷新、统计卡数量、列表行数、文本可见性，以及 390x844 移动端横向溢出。
- Codex 自带浏览器点测通过：打开 `/admin/logs`，搜索 `注册赠送`，点击“查询”和“刷新”，页面横向溢出为 0。

### 需要继续验证

- 当前消费日志页是只读迁移，不代表旧后台余额调整、用户删除、兑换码管理等写入能力已源码化。
- 旧接口的 `logs` 字段是全量数组，`items` 是分页数组；本轮已修正前端归一化优先级，但新后端契约需要把字段含义固定下来。

## 2026-06-26 源码后台订单管理只读复核

### 已确认

- `/admin/orders` 已由 `frontend/` 源码承载，并从迁移配置中的 `legacy` 改为 `source`。
- 订单管理页只调用只读接口 `/api/admin/orders`，不调用 `/api/admin/orders/:id/status`。
- 页面支持订单号/用户/邮箱搜索、状态筛选、分页和刷新，统计卡显示订单总数、当前页金额、已支付、待支付、已关闭和当前页算力。
- Playwright smoke 已覆盖桌面订单管理搜索 `HJM`、刷新、统计卡数量、列表行数、`HJM000001` 可见性，以及 390x844 移动端横向溢出。
- Codex 自带浏览器点测通过：打开 `/admin/orders`，搜索 `HJM000001`，点击“查询”和“刷新”，桌面横向溢出为 0；390x844 视口复核横向溢出仍为 0。

### 需要继续验证

- 当前订单管理页是只读迁移，不代表旧后台订单改状态、退款、补单等写入能力已源码化。
- 旧接口的 `orders` 字段是全量数组，`items` 是分页数组；本轮已修正前端归一化优先级，但新后端契约需要把字段含义固定下来。

## 2026-06-26 源码后台兑换码管理只读复核

### 已确认

- `/admin/redeem-codes` 已由 `frontend/` 源码承载，并从迁移配置中的 `legacy` 改为 `source`。
- 兑换码管理页只调用只读接口 `/api/admin/redeem-codes`，不调用 `POST /api/admin/redeem-codes` 或 `DELETE /api/admin/redeem-codes/:code`。
- 页面支持兑换码/状态/算力搜索、状态筛选、分页和刷新，统计卡显示兑换码总数、当前页算力、启用中、已禁用、已用尽和剩余次数。
- Playwright smoke 已新增桌面兑换码管理搜索 `HAJIMI`、刷新、统计卡数量、列表行数、`HAJIMI2024` 可见性，以及 390x844 移动端横向溢出检查。
- Codex 自带浏览器点测通过：打开 `/admin/redeem-codes`，搜索 `HAJIMI`，点击“查询”和“刷新”，桌面横向溢出为 0；390x844 视口复核横向溢出仍为 0。

### 需要继续验证

- 当前兑换码管理页是只读迁移，不代表旧后台兑换码创建、删除、发放等写入能力已源码化。
- 旧接口的 `codes` 字段是全量数组，`items` 是分页数组；本轮已修正前端归一化优先级，但新后端契约需要把字段含义固定下来。

## 2026-06-26 源码后台模型价格只读复核

### 已确认

- `/admin/model-prices` 已由 `frontend/` 源码承载，并从迁移配置中的 `legacy` 改为 `source`。
- 模型价格页只调用只读接口 `/api/admin/model-prices`，不调用模型价格保存、新增或删除接口。
- 页面支持模型/线路/类型搜索、类型筛选、分页和刷新，统计卡显示线路数量、模型总数、启用模型、图片模型、文本模型和当前筛选总价。
- Playwright smoke 已新增桌面模型价格搜索 `gpt-image-2`、刷新、统计卡数量、列表行数、`GPT Image 2` 可见性，以及 390x844 移动端横向溢出检查。
- Codex 自带浏览器点测通过：打开 `/admin/model-prices`，搜索 `gpt-image-2`，点击“查询”和“刷新”，桌面横向溢出为 0；390x844 视口复核横向溢出仍为 0。

### 需要继续验证

- 当前模型价格页是只读迁移，不代表旧后台模型价格保存、新增模型、删除模型等写入能力已源码化。
- 旧接口的 `items` 是全量线路而不是模型级分页；新后端契约需要把模型级分页、搜索和类型筛选固定下来。

## 2026-06-26 源码后台 API 线路只读复核

### 已确认

- `/admin/api-providers` 已由 `frontend/` 源码承载，并从迁移配置中的 `legacy` 改为 `source`。
- API 线路页只调用只读接口 `/api/admin/api-providers`，不调用测试、新增、保存、删除、设默认或拉模型接口。
- 页面支持线路/模型/Base URL 搜索、类型筛选、分页和刷新，统计卡显示线路总数、启用线路、图片线路、文本线路、默认线路和模型总数。
- 已源码化后台页侧栏中的 API 线路入口已改为 `/admin/api-providers`，不再跳回旧后台线路页。
- Playwright smoke 已新增桌面 API 线路搜索 `route_6789`、刷新、统计卡数量、列表行数、masked key 可见性，以及 390x844 移动端横向溢出检查。
- Codex 自带浏览器点测通过：打开 `/admin/api-providers`，搜索 `route_6789`，点击“查询”和“刷新”，桌面横向溢出为 0；390x844 视口复核横向溢出仍为 0。

### 需要继续验证

- 当前 API 线路页是只读迁移，不代表旧后台 API 线路测试、新增、保存、删除、设默认、拉模型等写入能力已源码化。
- 旧接口的 `items` 是全量线路而不是真正分页；新后端契约需要固定线路级分页、搜索、类型筛选和密钥脱敏规则。

## 2026-06-26 源码后台模板工作流只读复核

### 已确认

- `/admin/template-workflows` 已由 `frontend/` 源码承载，并从迁移配置中的 `legacy` 改为 `source`。
- 模板工作流页只调用只读接口 `/api/admin/template-workflows`，不调用 `PUT /api/admin/template-workflows`。
- 页面支持模板/分类/标签搜索、分类筛选和刷新，统计卡显示模板总数、启用模板、分类数量、素材槽、字段数量和比例选项。
- 页面展示平台、清晰度、比例和模型配置摘要，并按模板展示素材槽、字段和输出上限。
- Playwright smoke 已新增桌面模板工作流搜索 `白底图`、刷新、统计卡数量、列表行数、平台/比例摘要可见性，以及 390x844 移动端横向溢出检查。
- Codex 自带浏览器点测通过：打开 `/admin/template-workflows`，搜索 `白底图`，点击“查询”和“刷新”，桌面横向溢出为 0；390x844 视口复核横向溢出仍为 0。

### 需要继续验证

- 当前模板工作流页是只读迁移，不代表旧后台模板保存、新增、删除、字段编辑等写入能力已源码化。
- 旧接口 GET 一次返回完整模板配置；新后端契约需要固定模板级分页、搜索、分类筛选和写入权限边界。

## 2026-06-26 剩余三入口源码化收尾复核

### 已确认

- `/canvas`、`/admin/recycle-bin`、`/admin/settings` 已从迁移配置中的 `legacy` 改为 `source`，首页迁移统计为 21/0/21。
- `/canvas` 已由 `CanvasLegacySource.vue` 承载源码入口壳，页面明确“不重启新画布、不引入 Vue Flow、不自研画布”，并内嵌/链接旧后端画布。
- `/admin/recycle-bin` 只调用 `GET /api/admin/recycle-bin/users`，不调用恢复或永久删除接口。
- `/admin/settings` 只调用 `GET /api/admin/settings`，不调用 `PATCH /api/admin/settings`。
- Playwright smoke 已覆盖旧画布源码入口、回收站只读搜索、系统设置只读搜索，以及三者 390x844 移动端横向溢出检查。
- Codex 自带浏览器点测通过：桌面 `/canvas`、`/admin/recycle-bin`、`/admin/settings` 均横向溢出为 0；390x844 视口三页横向溢出仍为 0。

### 需要继续验证

- 当前 `/canvas` 是源码入口壳，不代表旧画布内部代码已迁入 `frontend/`；这符合“新画布废止、回滚旧画布”的既定边界。
- 当前回收站测试库为空，本轮已覆盖空状态；有删除用户时的卡片视觉和恢复/永久删除写入动作需另行确认测试数据后再验收。
- 当前系统设置页是只读迁移，不代表保存设置、图片工具配置写入等能力已源码化。

## 2026-06-26 Vue3 源码工程化护栏复核

### 已确认

- 首页阶段状态已从早期迁移文案改为当前事实：源码入口完成、旧画布锁定、后台只读完成。
- 已删除未使用的 `LegacyRouteRedirect.vue`，当前源码路由不再依赖旧桥接组件。
- `scripts/check-source-frontend-routes.js` 已新增，检查 `frontendMigrationRoutes` 与 Vue Router 的 21 个路径一致，并确认所有迁移入口都是 `source`。
- `frontend/package.json` 已新增 `check:routes`、`smoke:source` 和 `verify:source`，便于后续进入人工验收前先跑基础护栏。
- `docs/source-frontend-acceptance-checklist.md` 已新增，明确可直接跑通的功能、暂不自动执行的写入动作和下一阶段验收顺序。

### 验证

- `npm.cmd run check:routes --prefix "F:\dianshang\frontend"` 通过，输出 `Source frontend route maintenance check passed: 21/21 source routes.`
- `node --check "F:\dianshang\scripts\check-source-frontend-routes.js"` 通过。
- `npm.cmd run build --prefix "F:\dianshang\frontend"` 通过。
- `powershell -NoProfile -ExecutionPolicy Bypass -File "F:\dianshang\scripts\smoke-source-frontend-ui.ps1"` 通过。
- `git -C "F:\dianshang" diff --check` 通过，仅有 CRLF 提示。
- UTF-8 BOM、尾随空格和 `frontend/src` 旧桥接残留检查通过。

### 需要继续验证

- 写入、删除、扣费、真实模型调用和新后端依赖安装仍需用户确认后再执行。

## 2026-06-26 系统设置保存试点复核

### 已确认

- `frontend/src/api/adminSettings.ts` 已新增 `updateAdminSettings()`，复用现有 Axios，不新增依赖。
- `/admin/settings` 已从纯只读页升级为保存试点页，当前只开放低风险基础字段草稿：站点名称、注册开关、模板生图、图库历史、Mock 模式、默认算力和上传上限。
- 图片工具配置仍保持只读，未开放复杂线路、模型和提示词模板写入。
- smoke 断言已改为检查保存试点区和保存按钮存在，但不点击保存。

### 验证

- `node --check "F:\dianshang\scripts\smoke-source-frontend-ui-runner.js"` 通过。
- `npm.cmd run typecheck --prefix "F:\dianshang\frontend"` 通过。
- `npm.cmd run check:routes --prefix "F:\dianshang\frontend"` 通过。
- `npm.cmd run build --prefix "F:\dianshang\frontend"` 通过。
- `powershell -NoProfile -ExecutionPolicy Bypass -File "F:\dianshang\scripts\smoke-source-frontend-ui.ps1"` 通过，且未触发系统设置保存。

### 需要继续验证

- 保存按钮的真实写入回显需要人工确认测试值和恢复方式后再点测。

## 2026-06-26 旧画布入口崩溃复核

### 已确认

- 用户反馈崩溃时处于 `/canvas` 移动端入口；旧后端健康检查正常，旧画布项目页可 200 返回。
- 临时 Playwright 诊断打开旧画布项目页 8 秒，无 page crash、无 console error、无 4xx/5xx 静态资源错误。
- 诊断中唯一异常级信号是旧画布 warning：`canvas:chat-session-change:skip-not-ready`，属于旧画布初始化时序提示，不是页面崩溃栈。
- 为降低移动端和自带浏览器压力，`/canvas` 源码入口已改为默认不加载 iframe，只显示轻量入口和手动加载按钮。

### 验证

- `npm.cmd run typecheck --prefix "F:\dianshang\frontend"` 通过。
- `node --check "F:\dianshang\scripts\smoke-source-frontend-ui-runner.js"` 通过。
- `npm.cmd run build --prefix "F:\dianshang\frontend"` 通过。
- `npm.cmd run check:routes --prefix "F:\dianshang\frontend"` 通过。
- `powershell -NoProfile -ExecutionPolicy Bypass -File "F:\dianshang\scripts\smoke-source-frontend-ui.ps1"` 通过；`/canvas` 断言更新为默认 `iframeCount=0` 且存在“加载旧画布预览”按钮。

### 需要继续验证

- 旧画布内部的节点新增、上传、生成、保存恢复仍需要单独长流程验收。
- 如果点击“加载旧画布预览”仍导致浏览器崩溃，应进一步禁用入口页 iframe，只保留新窗口打开。

## 2026-06-26 旧画布本地保存权限复核

### 已确认

- 截图中的报错来自浏览器 File System Access API：`requestPermission` 不能在当前上下文请求权限。
- 旧画布在 iframe 里运行时属于嵌入上下文，不适合执行本地文件夹授权。
- `/canvas` 源码入口已移除 iframe 预览，只保留新窗口打开旧画布，并写明本地保存必须在新窗口旧画布中使用。

### 需要继续验证

- 用户需要从 `/canvas` 点击“新窗口打开旧画布”，在 `127.0.0.1:3456/canvas` 顶层页里重新选择本地文件夹。
- 如果顶层旧画布仍报同样错误，再继续查是否缺少用户手势、浏览器权限策略或 File System Access API 兼容性。

## 2026-06-26 Vue3 API 错误处理收敛复核

### 已确认

- CodeGraph 本轮调用超时，不是“未初始化”返回；已按工具不可用处理，改用本地源码读取和自动化护栏推进。
- `frontend/src/api/http.ts` 已集中提供 `getApiErrorMessage()`，统一处理 401、403、后端 `message/error` 字段和 JS Error。
- 用户页、模板页、图库页和后台源码页仍保留各自业务兜底文案，未登录提示没有被抹平。
- `/canvas` 和 `/admin/settings` 的路线图与 README 描述已同步到当前事实。

### 验证

- `npm.cmd run typecheck --prefix "F:\dianshang\frontend"` 通过。
- `npm.cmd run check:routes --prefix "F:\dianshang\frontend"` 通过，输出 `Source frontend route maintenance check passed: 21/21 source routes.`。
- `npm.cmd run build --prefix "F:\dianshang\frontend"` 通过。
- `powershell -NoProfile -ExecutionPolicy Bypass -File "F:\dianshang\scripts\smoke-source-frontend-ui.ps1"` 通过，且 `/canvas` 仍为 `iframeCount=0`。
- `git -C "F:\dianshang" diff --check` 通过，仅有 CRLF 提示。
- `rg` 检查确认视图层不再散落 `response?.data?.message` 和 `(error as Error)?.message` 解析。
- 本轮关键文件 BOM 和尾随空白检查为空。

### 需要继续验证

- CodeGraph 后续如继续超时，需要单独确认是否重建索引或重启 MCP 服务。

## 2026-06-26 系统设置图片工具可配置复核

### 已确认

- 用户反馈准确：此前图片工具配置只有展示标签，没有线路、模型和提示词模板选择控件。
- 本轮复用现有 API 线路数据，不新增 npm 包、不新增后端接口。
- `/admin/settings` 图片工具配置现在提供启用开关、图片线路下拉、模型下拉和提示词模板输入。
- 页面顶部文案已从“复杂图片工具配置只读”改为“开放基础设置和图片工具线路、模型、提示词模板配置”。

### 验证

- `npm.cmd run typecheck --prefix "F:\dianshang\frontend"` 通过。
- `npm.cmd run build --prefix "F:\dianshang\frontend"` 通过。
- `powershell -NoProfile -ExecutionPolicy Bypass -File "F:\dianshang\scripts\smoke-source-frontend-ui.ps1"` 第二次重跑通过；第一次失败停在 Playwright CLI session 未打开，不是页面逻辑错误。
- `git -C "F:\dianshang" diff --check` 通过，仅有 CRLF 提示。
- 自带浏览器刷新 `/admin/settings`，确认图片工具区有 4 个工具卡、4 个开关、8 个下拉和 4 个提示词输入框。

### 需要继续验证

- 真实保存仍需人工按“记录原值 -> 修改 -> 保存 -> 刷新回显 -> 恢复原值”的顺序验收。

## 2026-06-26 系统设置基础开关点击复核

### 已确认

- 用户反馈成立：基础设置里的 Naive UI `n-switch` 滑块本体点击后状态不变。
- 右侧文字按钮此前可以工作，但滑块本体不工作会误导人工验收。
- 已替换为自控按钮式滑块，点击滑块和文字按钮都会走同一个状态切换函数。

### 验证

- 自带浏览器逐个点击 7 个滑块，全部能改变草稿状态，并逐个恢复测试前状态。
- 自带浏览器逐个点击 7 个文字按钮，全部能改变草稿状态，并逐个恢复测试前状态。
- `npm.cmd run typecheck --prefix "F:\dianshang\frontend"` 通过。
- `npm.cmd run check:routes --prefix "F:\dianshang\frontend"` 通过。
- `npm.cmd run build --prefix "F:\dianshang\frontend"` 通过。
- `git -C "F:\dianshang" diff --check` 通过，仅有 CRLF 提示。

### 需要继续验证

- 用户人工点击保存前仍需记录原值；本轮未保存真实配置。

## 2026-06-26 API 官方双线路收敛复核

### 已确认

- 用户要求成立：旧 API 多线路列表应收敛，不再继续保留 `6789`、`comfly-*`、`RK`、`哈吉米`、`flowstudio` 等旧目标线路。
- 当前目标只保留两条线路：图片 `GPT Image 2 / gpt-image-2`，文本 `GPT 5.5 / gpt-5.5`。
- 图片请求格式按官方 Images 生成形态记录为 `POST /images/generations`，请求体示例包含 `model/prompt/size/quality/n`。
- 文本请求格式按官方 Responses 形态记录为 `POST /responses`，请求体示例包含 `model/input`。
- 本轮没有新增 npm 依赖，没有调用真实外部 AI 接口。

### 验证

- `node --check "F:\dianshang\server.js"` 通过。
- `node --check "C:\Users\pc\Desktop\hjm-mb-clone\server.js"` 通过。
- `npm.cmd run typecheck --prefix "F:\dianshang\frontend"` 通过。
- `npm.cmd run check:routes --prefix "F:\dianshang\frontend"` 通过，输出 `21/21 source routes`。
- `npm.cmd run build --prefix "F:\dianshang\frontend"` 通过。
- `git -C "F:\dianshang" diff --check` 通过，仅有 CRLF 提示。
- 兼容后端重启后 `/api/health` 正常，模型配置为 `textModel=gpt-5.5`、`imageModel=gpt-image-2`。
- 已调用本地整包替换接口写入运行数据库，复核 `/api/admin/api-providers` 为 2 条线路、默认模型为 `gpt-image-2,gpt-5.5`，旧线路名匹配为 false。
- 已删除 3 条早期 `ui-echo-model-*` 模型价格覆盖行，复核 `/api/admin/model-prices` 模型键只剩 `gpt-image-2,gpt-5.5`。
- 自带浏览器打开 `/admin/api-providers`，显示 2 条线路、2 张官方目标卡、`/images/generations`、`/responses`、无旧线路文本，横向溢出为 0。
- 完整源码前端 smoke 通过；首次失败为脚本选择器把 `/images/generations` 误解析成正则，已修正。

### 需要继续验证

- 历史生成记录、消费日志和仪表盘模型使用统计仍可能显示旧历史模型或旧线路名；这属于历史业务数据，若用户要求“历史也清洗”，必须另开数据迁移任务并先备份。
- 新后端真正接管时，需要把 `POST /responses` 与 `POST /images/generations` 的请求构造迁移到 Provider Adapter，且先确认 Key、代理网关和费用边界。

## 2026-06-26 API 图生图能力补齐复核

### 已确认

- 图生图不应作为第三条 API 线路处理；它属于 `GPT Image 2` 图片线路下的第二个官方请求能力。
- 图片线路现在包含两个请求示例：`文生图 /images/generations` 与 `图生图 / 局部重绘 /images/edits`。
- `/images/edits` 示例包含 `images` 和 `prompt`，局部重绘场景保留 `mask` 字段；真实文件上传时可走 `multipart/form-data`，URL/base64 引用可按 JSON 形态表达。

### 验证

- 已重启兼容后端并写入运行数据库，复核图片线路 `requestExamples=2`，包含 `/images/edits`。
- `node --check "F:\dianshang\server.js"` 通过。
- `node --check "C:\Users\pc\Desktop\hjm-mb-clone\server.js"` 通过。
- `npm.cmd run typecheck --prefix "F:\dianshang\frontend"` 通过。
- `npm.cmd run check:routes --prefix "F:\dianshang\frontend"` 通过，输出 `21/21 source routes`。
- `npm.cmd run build --prefix "F:\dianshang\frontend"` 通过。
- `git -C "F:\dianshang" diff --check` 通过，仅有 CRLF 提示。
- 自带浏览器打开 `/admin/api-providers`，确认页面显示 `/images/generations`、`/images/edits`、`/responses` 和“图生图 / 局部重绘”，横向溢出为 0。
- 完整源码前端 smoke 通过。

### 需要继续验证

- 当前只是配置与后台展示补齐，未实现真实图生图上传、mask 画布、Provider Adapter 调用和任务结果回写。

## 2026-06-26 Provider 能力注册表复核

### 已确认

- 线路不是前端功能路由；线路只描述上游 Provider 和模型能力。
- 能力展示不应继续散落在 API 线路页或 API client 文件里。
- 已新增 `frontend/src/config/providerCapabilities.ts`，作为当前前端能力展示注册表。
- 后续新增中转站差异应落到后端 Provider Adapter，不在前端页面里手写各家请求格式。

### 验证

- `npm.cmd run typecheck --prefix "F:\dianshang\frontend"` 通过。
- `npm.cmd run check:routes --prefix "F:\dianshang\frontend"` 通过，输出 `21/21 source routes`。
- `node --check "F:\dianshang\scripts\smoke-source-frontend-ui-runner.js"` 通过。
- `git -C "F:\dianshang" diff --check` 通过，仅有 CRLF 提示。
- `npm.cmd run build --prefix "F:\dianshang\frontend"` 通过。
- 自带浏览器打开 `/admin/api-providers`，确认文生图 `/images/generations`、图生图 `/images/edits`、文本生成 `/responses` 都存在，横向溢出为 0。

### 需要继续验证

- 新后端接管时，需要把这份前端注册表升级为后端能力元数据来源，避免前后端双份配置长期漂移。

## 2026-06-26 API 线路旧后台表单恢复复核

### 已确认

- 用户反馈成立：源码后台此前不像原 HJM 后台，缺少旧后台已有的 API 线路新增/编辑表单。
- 旧后台字段已对齐到源码页：后端真实名称、前端展示名称、线路标识 code、渠道类型、接口格式、Base URL、API Key、聊天接口、生图接口、视频接口、默认模型、优先级、线路倍率、状态、默认线路和备注。
- API Key 不在页面明文回显；后端仍返回 `sk-local-********` 掩码。编辑时留空表示不修改，这是当前安全边界。
- 当前 `real-provider-ready`，所以本轮未自动点击“测试连接”，避免触发真实外部请求。

### 验证

- `node --check "F:\dianshang\server.js"` 通过。
- `node --check "C:\Users\pc\Desktop\hjm-mb-clone\server.js"` 通过。
- `npm.cmd run typecheck --prefix "F:\dianshang\frontend"` 通过。
- `npm.cmd run build --prefix "F:\dianshang\frontend"` 通过。
- `git -C "F:\dianshang" diff --check` 通过，仅有 CRLF 提示。
- 已重启兼容后端，`/api/health` 正常，当前 Provider 状态为 `real-provider-ready`。
- Playwright 浏览器烟测通过核心本地链路：登录管理员、打开 `/admin/api-providers`、新增临时 `codex-smoke` 线路、确认列表出现、打开编辑表单、删除临时线路。
- 删除后复核运行数据库无 `route_codex_smoke_*` 残留，API 线路回到 `route_openai_gpt_image_2,route_openai_gpt_5_5` 两条。

### 需要继续验证

- 人工验收时可点击“新增线路”和“编辑”确认旧后台字段是否满足你的实际配置习惯。
- 若要让后台写入的真实 API Key 直接接管付费调用，需要先设计密钥加密存储、权限控制、审计日志和 Provider Adapter 读取策略；当前实现不把真实 Key 明文回显。

## 2026-06-26 首页旧客户端能力补回复核

### 已确认

- 用户反馈成立：Vue3 首页此前只是迁移索引，不是旧客户端业务首页。
- 已用 Playwright 打开旧首页 `http://127.0.0.1:3456/` 对照首屏能力，旧首页包含模式切换、添加图片、提示词、模型/张数/比例/清晰度、预计算力、生成和历史画布入口。
- 第一版纠偏：此前误做成新业务工作台壳，用户指出不是旧首页迁移；已撤掉该版。
- Vue3 首页已按旧站实际运行首页迁移：固定顶部栏、左侧导航、浅色玻璃背景、中心生成面板和“我的历史画布项目”横向列表。
- 首页快速生图复用现有模板生成 API，不新增第二套生成逻辑；首屏不再主动请求需要登录的项目接口，避免未登录状态产生 401/403。

### 验证

- `npm.cmd run typecheck --prefix "F:\dianshang\frontend"` 通过。
- `npm.cmd run check:routes --prefix "F:\dianshang\frontend"` 通过，输出 `21/21 source routes`。
- `npm.cmd run build --prefix "F:\dianshang\frontend"` 通过。
- `git -C "F:\dianshang" diff --check` 通过，仅有 CRLF 提示。
- Playwright 新首页桌面检查通过：旧版 `.home-header`、`.side-rail`、`.hero-panel` 和“我的历史画布项目”均存在，横向溢出为 0。
- Playwright 390px 移动端检查通过：主标题、生成按钮和历史画布项目可见，横向溢出为 0。
- 重新加载后 console 仅有 Vite debug 连接日志，无 401/403、无 pageerror；背景图不再通过工程外 `@fs/F:/dianshang/assets` 路径加载。

### 需要继续验证

- 人工登录后输入真实提示词点击首页快速生图，确认 Provider 返回、余额扣减和图库写入。
- 旧首页的本地保存弹窗、历史项目拖拽惯性、完整项目恢复等深层交互仍需继续按旧站 assets 迁入。
## 2026-06-29 旧画布性能优化复核

### 已确认

- 本轮只优化 `F:\dianshang` 当前生产测试项目，不再改 `C:\Users\pc\Desktop\hjm-mb-clone`。
- 新增 `canvas-performance-active` 交互态，拖拽、缩放、节点移动时降低旧画布重阴影、毛玻璃、hover transform 和动画成本。
- 图片节点和聊天面板图片已做懒加载与异步解码；不新增缩略图服务，不改变图片 URL 策略。
- 自动保存只做降频和合并等待，不改变旧工作流 JSON 格式。

### 验证

- `node --check "F:\dianshang\server.js"` 通过。
- `git -C "F:\dianshang" diff --check` 通过，仅有 CRLF 提示。
- `/api/health` 正常，数据库和上传目录均指向 `F:\dianshang`。
- 自带浏览器打开 `http://127.0.0.1:3456/canvas`，确认 `canvas-performance-mode.css/js?v=20260629perf3` 已加载。
- 浏览器模拟拖动画布后 `canvas-performance-active=true`，约 0.9 秒后恢复为 false；模拟滚轮缩放同样触发并恢复。
- 页面 Vue Flow 存在、节点数为 2、console error 为 0；节点图片未破图，已应用异步解码。
- 旧画布自动保存和视口保存 timer 已加入性能态延迟：交互仍活跃时调用 `noteSaveDeferred()` 并重新排队，等待拖拽/缩放结束后合并保存；不改变工作流 JSON 格式。
- 新增 `scripts/smoke-canvas-performance-ui.ps1` 和 `scripts/smoke-canvas-performance-ui-runner.js`，并接入 `SMOKE_UI=true` 预检。
- 新增 `scripts/verify-canvas-performance-assets.js`，静态防回退检查 `perf3` 版本、保存延迟锚点、`J4=1400` 和旧 `900/250` 节流锚点不再存在。
- `node "F:\dianshang\scripts\verify-canvas-performance-assets.js"` 通过，返回 `version=20260629perf3`、`saveDeferral=true`。
- `powershell -NoProfile -ExecutionPolicy Bypass -File "F:\dianshang\scripts\smoke-canvas-performance-ui.ps1"` 通过；自动复核性能资源加载、性能 API、基础拖拽、单次滚轮、连续 20 次滚轮、打开 Canvas Chat 后拖拽、交互态 `will-change: transform`、动态图片探针 `loading=lazy/decoding=async`、console errors 为 0、bad responses 为 0。
- 用户反馈缩放时卡片闪烁后已复核并修复：性能态拆分为 `canvas-performance-zooming` 与 `canvas-performance-dragging`，滚轮缩放只给 Vue Flow viewport/pane/canvas-flow 启用合成层，不再对 `.vue-flow__node` 改写阴影、滤镜、transition 或 hover transform。
- 缓存版本已升级到 `20260629perf4`；`scripts/verify-canvas-performance-assets.js` 新增防回退检查，确保性能 CSS 不再包含 `html.canvas-performance-active .vue-flow__node`。
- 默认画布 smoke 通过缩放闪烁回归断言：滚轮后 `zooming=true`、`dragging=false`、`debugMode=zooming`，节点视觉样式在缩放前后保持一致。
- 指定项目 smoke 已通过：`SMOKE_CANVAS_PATH=/canvas/project_1782707934819_dxzylygh5`，确认该 URL 加载 `perf4` 资源，拖拽/缩放性能态启停正常，console errors 为 0，bad responses 为 0。
- 新增帧预算 smoke：`scripts/smoke-canvas-frame-budget-ui.ps1` 会临时注入 8 个 Vue Flow 卡片和图片探针，并采样拖拽/连续缩放期间的 `requestAnimationFrame` 帧间隔；默认画布复核通过，拖拽 `avgDelta=16.67ms`、`p95Delta=16.8ms`、长帧 0，缩放 `avgDelta=16.67ms`、`p95Delta=16.8ms`、长帧 0。
- `scripts/verify-canvas-performance-assets.js` 已纳入帧预算 smoke 文件和 `preflight-check.ps1` 接入点检查，避免后续性能验收脚本被遗漏。
- 图片节点右侧工具栏半截问题已修复：取消普通 `.vue-flow__node` 的 paint containment，避免裁掉节点外溢的 `image-node-toolbar`；新增工具栏防裁切规则和 `toolbarProbe` 自动断言，当前结果为 `nodeContain=none`、`nodeOverflow=visible`、`toolbarZIndex=1200`。
- 缓存版本已升级到 `20260629perf5`；性能 smoke 与帧预算 smoke 均通过，移除节点 paint containment 后未观察到帧预算回退。
- 图片节点展示形态已改为图片对象优先：新增 `assets/canvas-image-node-polish.css?v=20260629image2`，只做旧画布 CSS 过渡覆盖，不新增依赖、不重写画布、不改节点数据结构；有图节点取消 `object-cover` 和 `max-height:220px` 裁切，改为 `object-fit: contain` 与 `max-height:520px`，让图片按原始比例完整显示；标题和尺寸信息浮到图片上方，右侧工具栏继续保持外溢可点击。
- 性能 smoke 已新增 `imageNodeVisualProbe` 和 `loadedImageNodeProbe`：空图占位为 300x300、URL 输入行隐藏、工具栏 `z-index=1200`；800x1000 有图探针显示为 416x520，`imageObjectFit=contain`，顶部信息为 absolute。真实项目页复核到 1254x1254 图片按 416x416 完整显示。
- 帧预算 smoke 复跑通过：拖拽 `avgDelta=16.67ms`、`p95Delta=16.8ms`、长帧 0；缩放 `avgDelta=16.77ms`、`p95Delta=16.8ms`、`maxDelta=33.2ms`、长帧 0。
- 用户反馈图片工具栏遮挡图片后，图片节点补丁升级到 `20260629image4`：有图节点的外壳、舞台和图片统一按图片比例 box 自适应，工具栏与折叠把手改为挂在该 box 右侧，不再使用旧固定卡片宽度定位；已验证 CSS 资源可由 `http://127.0.0.1:3456/assets/canvas-image-node-polish.css?v=20260629image4` 返回 200，`node --check` 和 `git diff --check` 通过。
- 本轮追加指定项目验收：`SMOKE_CANVAS_PATH=/canvas/project_1782707934819_dxzylygh5` 的画布性能 smoke 通过，确认 `20260629image4` 资源加载、工具栏防裁切、竖图 loadedImageNodeProbe、拖拽/缩放性能态和 Canvas Chat 拖拽无 console error、无 bad response。
- 本轮追加比例专项探针：在指定项目页临时注入方图、横图、竖图三类图片节点，不保存项目、不触发接口。测得方图 `520x520`、横图 `520x260`、竖图 `260x520`，均为 `object-fit: contain`；右侧工具栏均位于图片舞台右侧 `18px`，折叠把手位于右侧 `2px`，且 `toolbarOverlapsImage=false`。
- 当前没有继续修改 `assets/canvas-image-node-polish.css`，因为遮挡问题未在指定项目 smoke 或三比例探针中复现。

### 需要继续验证

- 用户人工拖动画布 10 秒、缩放 20 次，观察是否比优化前更顺滑。
- 用户人工选中真实图片节点，确认右侧图片工具侧边栏完整露出，不再只剩半截。
- 如指定项目未恢复已有图片节点，需要先创建或导入含方图、横图、竖图的测试画布，再做人工截图确认顶部标题/尺寸不遮挡图片主体。
- 生成结果加入画布后继续拖动，确认大图节点不再明显阻塞。
- 如果仍卡，第二阶段再规划旧画布源码化、缩略图缓存、节点虚拟化和更细粒度渲染拆分。

## 2026-06-29 图片节点顶部工具条复核

### 已确认

- 本轮继续只改 `F:\dianshang` 旧画布过渡层，不重写画布引擎，不改 Provider，不动 API Key，不触发真实生图。
- `index.html` 已把图片节点 polish 资源升级到 `20260629image5`，并新增 `assets/canvas-image-node-polish.js`。
- 图片节点 JS 会按图片自然宽高打 `square`、`landscape`、`portrait`、`long` 方向标记；`图像生成结果`、`文生图`、`对话生成图片` 等生成图会被标为 `data-image-source="generated"`。
- 有图图片节点保留顶部标题/尺寸信息，选中或 hover 时显示顶部黑色横向工具条；旧右侧大侧栏和折叠把手不再展示。
- 无图上传态的旧工具条已隐藏并禁用 pointer events，避免空节点残留可点击浮层。
- 超长图已从普通 `max-height: 520px` 限制中分离，改为较窄宽度完整展开。

### 验证

- `node --check "F:\dianshang\server.js"` 通过。
- `node --check "F:\dianshang\assets\canvas-image-node-polish.js"` 通过。
- `node --check "F:\dianshang\scripts\smoke-canvas-performance-ui-runner.js"` 通过。
- 指定项目 `SMOKE_CANVAS_PATH=/canvas/project_1782707934819_dxzylygh5` 的画布性能 smoke 通过：`imageNodePolishCssLoaded=true`、`imageNodePolishJsLoaded=true`、`hasImagePolishApi=true`。
- 图片比例专项探针通过：方图 `520x520`、横图 `520x260`、竖图 `260x520`、长图约 `259x5864` 且 `imageMaxHeight=none`、生成结果图 `520x520` 且 `source=generated`。
- 顶部工具条专项断言通过：工具条 `display=flex`、`position=absolute`、`z-index=1220`，位于图片舞台上方，且与图片矩形无交集；`.image-node-toolbar-wrap` 为 `display=none`。

### 需要继续验证

- 用户在浏览器中刷新指定项目，选中真实图片节点确认顶部工具条观感。
- 用真实普通图片节点和真实图像生成结果节点各选中一次，确认二者视觉一致。
- 真实生图链路仍需用户确认额度和测试范围后再做。

## 2026-06-29 图片节点 image6 回归复核

### 已确认

- 用户截图中的右侧白色竖向工具栏来自真实构建里的 `ImageNodeToolbar` scoped 组件，旧规则为 `left:302px`、`flex-direction:column`、`height:calc(100% - 20px)`。
- `image5` 的 smoke 探针把工具栏放在 `.image-node` 内部，未覆盖真实 sibling 结构，这是本次漏测原因。
- 已升级 `image6`：JS 给 Vue Flow 图片节点本身打 `image-node-has-image/image-node-is-selected`，CSS 以节点级选择器覆盖 sibling 工具栏，强制顶部横向显示。

### 验证

- `node --check "F:\dianshang\server.js"` 通过。
- `node --check "F:\dianshang\assets\canvas-image-node-polish.js"` 通过。
- `node --check "F:\dianshang\scripts\smoke-canvas-performance-ui-runner.js"` 通过。
- 指定项目 smoke 通过：`imageNodePolishCssLoaded=true`、`imageNodePolishJsLoaded=true`、真实 sibling 工具栏 `toolbarFlexDirection=row`、`toolbarWidth=346`、`toolbarHeight=50`、`toolbarAboveStage=true`、`toolbarOverlapsStage=false`。

### 需要继续验证

- 用户在当前打开的浏览器页强刷后，选中截图中的真实图片节点，确认右侧白色竖栏消失，顶部黑色横向工具条出现。

## 2026-06-29 扩图面板 outpaint1 复核

### 已确认

- 本轮只修旧画布扩图面板定位逻辑，不改 Provider、不动 API Key、不触发真实生图。
- 扩图面板默认位置属于组件状态计算问题：原逻辑只在图片 load 和比例切换后排一次 `nextTick(P)`，在面板实际目标画布尺寸稳定后不会二次居中。
- 已在两个旧 Canvas bundle 中将扩图重算改为 `nextTick + requestAnimationFrame + 80ms`，确保默认打开和切换比例后按最终画布尺寸重新计算中心点。
- 拖拽边界仍使用原有 clamp 逻辑，保持图片移动受目标画布范围限制，避免提交坐标越界。
- 入口缓存版本已升级到 `20260629outpaint1`；性能资源仍为 `20260629perf5`，图片节点工具条仍为 `20260629image7`。
- 静态验证已通过：`verify-canvas-performance-assets.js` 检查两个 Canvas bundle 均包含二次重算补丁，并确认旧 `Dt(P)` 扩图锚点不再存在。
- 指定项目 smoke 已通过，确认 `outpaint1` 入口资源加载、旧画布基础交互、图片节点工具条和比例探针均正常；本 smoke 不触发真实扩图接口。

### 需要继续验证

- 用户强刷当前浏览器页后，打开真实图片节点的 `AI 扩图`，确认默认图像在目标画布中心。
- 依次点 `1:1`、`3:2`、`4:3`、`16:9`、`9:16`，确认每次切换后仍居中。
- 在目标画布内拖动图片，确认移动范围仍受限制且不会跑出黄色/绿色区域。

## 2026-06-29 扩图面板 outpaint2 复核

### 已确认

- 本轮继续只修旧画布扩图面板，不改 Provider、不动 API Key、不触发真实生图。
- 用户反馈缩放时无法自动保持位置后，复核缩放 handler 发现其依赖 `u.value`，在 input 事件顺序下可能读到上一帧值。
- 已将缩放 handler 改为读取当前 range 事件值，并以当前图片中心点为锚点计算新尺寸和位置。
- 原有 clamp 边界保留：图片靠近画布边缘时，缩放后会被限制在黄色/绿色目标画布内，这是预期限制。
- 入口缓存版本已升级到 `20260629outpaint2`；静态护栏会检查新缩放 handler 和旧 handler 不回退。
- 静态和页面 smoke 已通过：`verify-canvas-performance-assets.js` 返回 `20260629perf5+outpaint2`，指定项目加载 `outpaint2` 入口成功，console errors 为 0、bad responses 为 0。

### 需要继续验证

- 强刷后打开 `AI 扩图`，先把图片拖到非默认位置，再滑动“原图等比缩放”，确认图片围绕当前位置缩放。
- 在画布边缘附近重复缩放，确认只在越界时被 clamp，不在普通区域突然跳回默认中心。

## 2026-06-29 扩图面板 outpaint3 复核

### 已确认

- 用户截图确认 `outpaint2` 仍有问题：`1:1` 黄色舞台不是方形，滑条拉满后图片也没有按方形目标铺满。
- 根因是 CSS 的 `.outpaint-stage { max-height: 230px }` 压扁了比例舞台；缩放计算本身拿到的是被压扁后的 DOM 尺寸。
- 已改为由组件 inline style 覆盖舞台尺寸：`maxHeight:none`，横图/方图占满可用宽度，竖图按视口高度自动收窄，保证比例不变。
- 静态护栏已增加舞台比例样式断言，并禁止回退到旧的单一 `aspectRatio` 写法。
- 静态和页面 smoke 已通过：`verify-canvas-performance-assets.js` 返回 `20260629perf5+outpaint3`，指定项目加载 `outpaint3` 入口成功，console errors 为 0、bad responses 为 0。

### 需要继续验证

- 强刷后打开 `AI 扩图`，确认 `1:1` 舞台为方形。
- 将缩放拉到最大，确认方图完整铺满方形舞台。
- 切换 `16:9` 和 `9:16`，确认舞台形状跟随比例变化而不是被固定高度压扁。

## 2026-06-29 扩图面板 outpaint4 复核

### 已确认

- 用户希望扩图内容能在绿色画布里自由移动，并且缩放保持等比例。
- 旧 clamp 对放大后的图片不友好：图片一旦等于或大于目标画布，`max(0, stageSize-imageSize)` 变成 0，拖动被锁死。
- 已新增双模式 clamp：图片小于画布时限制在画布内；图片大于画布时允许在画布内平移取景，同时不露空。
- 缩放范围已从 `35-100` 改成 `20-220`，其中 `100%` 是完整贴合，超过 `100%` 是等比例放大取景。
- 静态护栏已检查新 clamp、`20-220` 滑条范围，并禁止旧拖动 clamp 和旧滑条范围回退。
- 静态和页面 smoke 已通过：`verify-canvas-performance-assets.js` 返回 `20260629perf5+outpaint4`，指定项目加载 `outpaint4` 入口成功，console errors 为 0、bad responses 为 0。

### 需要继续验证

- 强刷后打开 `AI 扩图`，将缩放拉到超过 `100%`，确认图片等比例放大。
- 放大后拖动图片，确认能在绿色画布中平移取景，且不会露出黄色/绿色空白。

## 2026-06-29 扩图面板 outpaint6 复核

### 已确认

- 用户纠正成立：扩图不是裁剪，绿色区域露出不是错误，而是待生成区域；不应使用“不露空”限位。
- `outpaint4` 的 clamp 会在右侧和右下角让图片卡死，违背自由摆放需求。
- 已将位置限制放宽到 `[-imageSize, stageSize]`，允许图片在绿色目标画布内外自由摆放，只避免整张图完全拖走后找不到。
- 舞台空白区域也已绑定拖动开始事件，按住绿色空白处也能移动图片层。
- 缩放范围改为 `20-300`，保持等比例缩放。
- 静态和页面 smoke 已通过：`verify-canvas-performance-assets.js` 返回 `20260629perf5+outpaint6`，指定项目加载 `outpaint6` 入口成功，console errors 为 0、bad responses 为 0。

### 需要继续验证

- 强刷后打开 `AI 扩图`，在绿色空白区域按住拖动，确认图片跟随移动。
- 把图片拖到右侧、右下角和左上角，确认不会提前卡死。
- 缩放到较大比例后继续拖动，确认仍能自由摆放。

## 2026-06-29 重绘接入 GPT Image 2 图生图复核

### 已确认

- 前端旧画布 `局部修改` 面板提交字段为 `imageUrl`、`maskBase64`、`prompt`、`referenceImages`，并同步等待 `/api/image-tools/inpaint` 返回最终图片。
- 后端此前缺少 `/api/image-tools/inpaint` 和 `/api/image-tools/erase`，因此按钮没有接入真实图生图编辑链路。
- 已新增两个 image-tools 路由，统一复用 `callProviderImageEdit`，请求目标为线路配置的 `/images/edits`，默认模型保持 `gpt-image-2`。
- 已修正 mask 读取：`maskBase64`/`mask`/`maskUrl` 独立于参考图数量发送，支持单原图 + 单 mask 的局部重绘。
- 已新增 `/api/upload/image` 兼容旧画布参考图上传入口。
- 服务已重启，`/api/health` 指向 `F:\dianshang`；未授权探测三个新入口均返回 `401` 而不是 `404`，确认路由已加载且没有触发真实上游。
- 最终检查通过：`node --check` 覆盖 `server.js`、图片节点 polish JS、画布性能 runner 和资源验证脚本；`verify-canvas-performance-assets.js` 返回 `20260629perf5+outpaint6`；指定项目画布 UI smoke 通过，console errors 为 0、bad responses 为 0；`git diff --check` 仅有既有 CRLF warning；本轮触达文件 BOM 均为 false。

### 需要继续验证

- 用户确认额度后，登录态选中真实图片节点，打开 `局部修改`，涂抹 mask 并提交，确认返回 GPT Image 2 edits 结果图并创建 `局部修改结果` 图片节点。
- 同样验证 `AI 智能消除` 是否按 mask 消除并创建 `智能消除结果` 节点。
- 若上游对 Packy/OpenAI-compatible `/images/edits` 的 multipart 字段有差异，再追加 Provider Adapter 配置化。

## 2026-06-29 image-tools tools1 顶部工具接线复核

### 已确认

- 用户要求除 `AI 超清放大` 和 `一键抠图` 外，其它顶部图片工具都接上。
- `AI 扩图` 已补后端 `/api/image-tools/outpaint`，复用 GPT Image 2 图生图编辑链路，并返回标准 `taskId/resultImages`，旧画布原有轮询可继续使用。
- `反推提示词` 已补 `/api/image-tools/reverse-prompt`，前端面板从 mock 文案改为打开时请求当前图片并展示返回提示词。
- `文字编辑` 已从空的 `textEdit` 面板改为复用 mask 局部重绘面板，提交时保留 `type/operation=text_edit`，后台用文字编辑专用提示词调用 `/images/edits`。
- `格式/压缩`、`图片尺寸调整`、`图片裁剪`、`添加到聊天`、`生成视频` 沿用旧画布已有本地/节点链路；其中本地结果上传依赖已补齐的 `/api/upload/image`。
- `AI 超清放大` 和 `一键抠图` 保持未接入，`/api/image-tools/settings` 明确返回 `enabled:false`，避免误判。
- 入口缓存版本已升级为 `20260629tools1`，资源校验增加 `/image-tools/reverse-prompt` 与 `operation:"text_edit"` 锚点。
- 服务已重启，`/api/health` 指向 `F:\dianshang`；未授权路由探测全部为 `401` 而非 `404`，未触发真实上游。
- 静态和页面验证通过：`node --check` 覆盖后端、两个 Canvas bundle、图片 polish JS 和验证脚本；`verify-canvas-performance-assets.js` 返回 `20260629perf5+tools1`；第二次画布 UI smoke 通过，console errors 为 0、bad responses 为 0。第一次 smoke 仍复现一次已知 Playwright 会话未打开问题，重跑成功。

### 需要继续验证

- 登录态选中真实图片节点，依次打开 `AI 扩图`、`反推提示词`、`文字编辑`，确认面板和标题符合预期。
- 用户确认额度后，再点提交 `AI 扩图`、`反推提示词`、`智能消除`、`局部修改`、`文字编辑`，确认真实 GPT Image 2/文本模型返回结果。
- 后续若要接 `AI 超清放大` 或 `一键抠图`，需要单独确认使用的 Provider 能力和返回格式。

## 2026-06-29 API 线路源码页旧后台导航复核

### 已确认

- 直达 `/admin/api-providers` 已由 `server.js` 返回 `frontend/dist/index.html`，源码页 bundle 为 `assets/index-D1smZqeB.js`。
- 旧后台仪表盘仍由根 `index.html` 和旧 bundle `assets/index-DglIsp_g.js` 承载，菜单点击此前会在旧客户端路由内渲染旧 `AdminShell` 表格。
- 已新增 `assets/admin-api-source-route-bridge.js`，旧后台点击 `API 线路管理` 时会整页跳转到 `/admin/api-providers`，交给源码页入口接管。
- 浏览器复核：从 `/admin/dashboard` 点击旧后台 `API 线路管理` 后，页面加载源码 `admin-source-shell`，可见 `应用官方双线路`、`/images/generations`、`/images/edits`、`/responses`。

### 需要继续验证

- 用户当前浏览器如果停留在已加载的旧页面，需要刷新一次或重新点击菜单；之后应稳定进入新版源码线路管理。
- 后续若继续把更多后台页面源码化，需要逐页接管入口，避免旧 Vue Router 和源码 Vue Router 同时管理同一路径。

## 2026-06-29 后台源码侧栏与路由统一复核

### 已确认

- 后台源码页此前各自维护侧栏，Dashboard、任务监控、API 线路等页面的菜单入口数量不一致，属于迁移未同步完成。
- 已抽出 `AdminSourceSidebar.vue` 统一后台源码页侧栏，11 个已迁移后台页面均改用共用组件，避免后续单页漏改。
- 服务端源码入口从单独 `/admin/api-providers` 扩展为全部已迁移 `/admin/...` 后台路径，直达订单、系统设置、模板工作流不再进入旧入口。
- 浏览器复核：`/admin/api-providers`、`/admin/orders`、`/admin/settings`、`/admin/template-workflows` 均加载源码 bundle，侧栏都是同一套 11 个入口，且当前页高亮正确。

### 需要继续验证

- 其它后台页如用户、回收站、任务监控、消费日志、兑换码、模型价格可按同一方式继续人工点一遍，主要风险是个别页面接口数据为空或权限提示，不是侧栏同步问题。

## 2026-06-30 日志扫描与路线图对齐复核

### 已确认

- CodeGraph 索引健康：103 个文件、10640 个节点、21982 条边，可继续用于结构性定位。
- `logs/manual-gen-frontend-err.log` 里的 Vite 资产越界错误已经被当前源码修正；`HomeWorkbench.vue` 现在从 `frontend/src/assets/home-product-workbench.png` 加载图片，不再引用工程外 `F:\dianshang\assets`。
- 维护审计指出的文档滞后成立：`docs/frontend-migration-roadmap.md` 和 `docs/source-frontend-acceptance-checklist.md` 仍把 API 线路写成纯只读，并保留首页迁移索引、旧画布入口壳等旧表述。
- 已将路线图、验收清单、README 和迁移索引同步到当前事实：旧站首页工作台、`/canvas` 直跳旧画布运行时、后台 11 页共用侧栏、`/admin/settings` 与 `/admin/api-providers` 为写入试点。
- 完整源码前端 UI smoke 首次复跑发现脚本固定搜索 `simple` 会使当前任务监控列表筛空；已改为从首条真实任务提取搜索词，避免测试数据变化导致误报。
- 完整源码前端 UI smoke 随后发现移动端用户管理页横向溢出 65px；已在移动端后台布局中收敛面板、工具栏控件和分页宽度，复跑后移动端后台 11 页横向溢出均为 0。

### 需要继续验证

- 后续可按路线图建议人工点一轮后台 11 页，重点看共用侧栏、写入试点提示和真实浏览器观感。

## 2026-06-30 后端与旧画布边界护栏复核

### 已确认

- 本轮没有拆分 `server.js`，也没有修改旧 Canvas bundle 逻辑；只新增后端/旧画布边界 smoke 和维护文档。
- `scripts/smoke-backend-canvas-boundary.ps1` 使用 disposable 数据目录和禁用真实外部能力的环境启动后端，避免污染当前生产测试库或触发上游。
- 新 smoke 覆盖旧画布入口 HTML、性能层、图片节点 polish、源码后台桥接脚本、两个旧 Canvas bundle、canvas storage 配置、image-tools 路由 auth 边界和上传入口 auth/400 边界。
- `upscale` 和 `removeBg` 在 `/api/image-tools/settings` 中仍保持 `enabled:false`，防止未确认 Provider 能力前被误认为已接入。

### 需要继续验证

- 后续如果继续改 image-tools 真实提交链路，需要在用户确认额度后另行做登录态人工点测；当前 smoke 只验证边界，不触发真实生成。

## 2026-06-30 Canvas Chat 对话只出提示词业务线复核

### 已确认

- 用户最新确认的业务线是：先按顺序上传参考图，再填写提示词需求，先生成可编辑提示词；真实生图由用户切到 `快速` 标签手动完成。
- 复核旧画布运行态时，当前对话模式底部模型为 `GPT 5.5 (GPT 5.5)`；旧 Canvas 包中没有 `确认生图`、`确认提示词` 文案，也没有 `/api/generate/tasks` 调用，只有 `/api/chat/completions`。
- 已新增 `assets/canvas-chat-prompt-flow.js/css` 作为旧画布桥接层，只在 `对话` 标签接管发送，不影响 `快速` 和 `视频` 标签。
- 桥接层会收集当前对话最近一组可见参考图，并在提交给后端前把 `blob:` 预览图转为 `data:image/*`，避免后端图生图读取不到参考图。
- 新增 `/api/canvas/generate-prompt`，文本线路真实可用时走 `/responses` 生成提示词；mock 或失败时返回基础可编辑草稿。桥接层已移除 `确认生图` 和 `/api/generate/tasks` 调用。
- boundary smoke 已加入新 JS/CSS 资源、未登录 401 边界和管理员登录后的提示词草稿返回形态，避免接口或资源 404 回退。

### 需要继续验证

- 刷新当前画布后，在 `对话` 标签上传两张图并输入需求，确认出现“提示词草稿”卡片和 `复制提示词` 按钮，且不再新增 `gpt-5.5` 失败结果卡。
- 切到 `快速` 标签后，由用户自行粘贴提示词并触发真实生图；该步骤会产生外部调用和算力消耗，不纳入本轮自动验证。

## 2026-06-30 Canvas Chat 兜底文案复核

### 已确认

- 当前 `/api/canvas/generate-prompt` 路由已加载；未登录访问返回 `401` 而非旧的 `404`。
- 文本模型暂不可用时，业务上只需要保留基础提示词草稿并提醒用户复制到 `快速` 模式，不应把上游渠道或接口错误直接暴露在卡片里。
- 已将 `assets/canvas-chat-prompt-flow.js` 的 `fallback`、mock 和接口异常分支统一收敛为：“文本模型暂不可用，已生成基础提示词，可编辑后复制到快速模式。”

### 需要继续验证

- 强刷当前画布后，在 `对话` 标签触发一次提示词生成，确认状态文案一致且草稿仍可编辑、可复制。

## 2026-06-30 Canvas Chat 对话 Agent 生图链路复核

### 已确认

- 最新业务线已改为 `对话` 模式执行 Agent 生图：参考图和需求先由 GPT 5.5 分析，再把最终提示词交给 GPT Image 2 生图。
- 新增 `/api/canvas/dialog-agent-generate`，与普通 `/api/generate/tasks` 快速生图入口分开，避免把快速模式语义改乱。
- 对话桥接层只在 `对话` 标签拦截发送，`快速` 和 `视频` 标签不显示对话 Agent 分析状态，也不走 GPT 5.5 分析。
- 对话结果成功后会派发 `canvas:add-generated-image-to-canvas`，两个旧 Canvas bundle 已监听该事件并复用既有图片节点创建逻辑。
- boundary smoke 已覆盖未登录 `401`、mock 登录后返回 `analysisSummary/finalPrompt/resultImages`，并校验 `analysisCost=5`、`imageCost=10`、`totalCost=15`。
- 语法检查、静态资产校验、backend/canvas boundary smoke、disposable API smoke、diff/BOM 检查均已通过；本轮未触发真实 GPT 5.5 或 GPT Image 2 付费调用。

### 需要继续验证

- 强刷当前画布后，用真实登录态在 `对话` 标签上传参考图并输入需求，确认前端依次显示分析、生成、结果，并且结果图自动落到画布。
- 真实 Provider 模式下点击会产生 GPT 5.5 和 GPT Image 2 上游调用及算力扣除；本轮自动验证只跑 mock，不做真实付费点测。

## 2026-06-30 Canvas Chat 对话 Agent GPT 5.5 超时复核

### 已确认

- 用户截图中的上游后台记录显示 GPT 5.5 请求耗时可达 42 秒；后端此前文本 Provider 默认超时为 30 秒。
- 本地超时由 `callProviderResponses` 的 `AbortController` 主动触发；上游记录存在不代表本地仍能拿到响应，Provider 可能在连接断开后继续完成并记账。
- 已将文本 Provider 默认等待时间调为 120 秒，并让对话 Agent 分析阶段显式传入 `CANVAS_DIALOG_ANALYSIS_TIMEOUT_MS`。
- 分析阶段再次超时时，后端返回 `CANVAS_DIALOG_ANALYSIS_TIMEOUT`、`stage: analysis` 和明确文案，避免继续显示泛化的 “AI Provider 请求超时”。

### 需要继续验证

- 真实登录态下再次发起对话 Agent 生图，确认 42 秒级 GPT 5.5 分析能正常进入后续 GPT Image 2 生图阶段。
- 若 GPT 5.5 超过 120 秒仍超时，需要再评估是否改为异步任务轮询，避免 HTTP 长连接等待。

## 2026-06-30 Canvas Chat 对话 Agent GPT 5.5 文本提取复核

### 已确认

- 超时修复后出现的新错误是 “GPT 5.5 未返回可用的生图提示词”，说明文本 Provider HTTP 调用已经成功，失败发生在本地解析阶段。
- 当前 `parseCanvasDialogAgentPlan` 在有文本时会把原始文本作为 prompt 兜底，因此空 prompt 的根因是 `imageToolOutputText` 没能从 Provider 响应结构中抽取文本。
- 已补充 `normalizeProviderContentText`，支持 `choices[].message.content[]`、`output[].content[]`、`text.value`、`output_text` 等常见嵌套结构。

### 需要继续验证

- 用户重新测试真实对话 Agent 请求，确认 GPT 5.5 分析结果能进入 GPT Image 2 生图阶段。
- 若仍返回无 prompt，需要临时记录 Provider 响应 shape，再按真实结构补充解析。

## 2026-06-30 Canvas Chat 对话 Agent GPT Image 2 多参考图复核

### 已确认

- `assets/canvas-chat-prompt-flow.js` 会按可见顺序收集多张参考图，并把它们作为 `referenceImages` 传给 `/api/canvas/dialog-agent-generate`。
- GPT 5.5 分析阶段使用 `canvasDialogReferencesForAnalysis` 读取全部参考图，因此“图1/图2”的文本分析输入是完整的。
- GPT Image 2 编辑阶段此前只执行 `loadReferenceImageFile(references[0])` 并 append 单个 `image`，所以第二张参考图没有作为图片文件进入 `/images/edits`。
- 已改为无 mask 时按顺序提交多张 `image[]`，并在 request meta 中记录 `submittedReferenceImageCount` 和 `referenceImageField`。

### 需要继续验证

- 真实对话 Agent 重新测试“把图1的产品改为图2产品，文案也对应”，确认生成结果更明显继承图2瓶型、包装和文字风格。
- 若 Provider 不接受 `image[]` 字段，需要根据上游实际接口改为重复 `image` 字段或线路配置化字段名。

## 2026-06-30 Canvas Chat 对话 Agent 参数控件复核

### 已确认

- 对话模式旧 DOM 原本只有上传图片、文本模型和发送按钮，没有 `张数`、`清晰度`、`比例` 控件。
- 桥接层已在 `对话` 标签底部补充三项控件，并在提交时读取当前值。
- 请求体现在会带上 `imageCount/count/n`、`quality/clarity`、`ratio/aspectRatio`；后端已有 `providerImageSize` 和 `providerImageQuality` 处理这些字段。

### 需要继续验证

- 刷新旧画布后确认对话模式底部出现 `1张`、`1K`、`1:1` 三个控件。
- 选择 `2张` 或其它比例后发送一次真实对话 Agent 请求，确认后端返回对应数量和尺寸倾向。

## 2026-06-30 Canvas Chat 参数控件设计语言复核

### 已确认

- 用户截图确认旧设计语言应为：底部紧凑按钮、张数/清晰度深色竖向菜单、比例浅色卡片网格。
- `dialogagent5` 已移除对话/视频参数中的原生 `select`，改为注入旧式按钮和自绘菜单。
- 快速模式继续保留旧 Canvas Chat 自带参数控件，只由桥接样式做网格归组，避免和对话新增控件混用。

### 需要继续验证

- 刷新旧画布后，在 `对话`、`快速`、`视频` 三个标签分别打开参数菜单，确认视觉语言一致且没有控件重叠。
- 点击比例卡片后确认按钮文案和对话 Agent 请求体中的 `ratio/aspectRatio` 同步更新。

## 2026-06-30 Canvas Chat 参数控件去桥接层复核

### 已确认

- `dialogagent5` 的方向已判定为错误：它仍在桥接层自绘一套参数控件，并且移动快速模式原控件导致重叠。
- `dialogagent6` 已改为启用旧 Canvas Chat 组件原生参数控件，三种模式共享同一套按钮和菜单行为。
- 桥接脚本不再创建 `hjm-dialog-agent-settings` 或 `hjm-native-param-settings`，只清理旧残留并从原控件读取 `张数 / 清晰度 / 比例`。

### 需要继续验证

- 用户刷新当前画布后确认：对话模式参数控件来自旧组件，快速模式按钮不再重叠，比例菜单仍是旧卡片网格。
- 若仍有缓存残留，需要强刷或重开当前项目页，确认入口 HTML 已加载 `dialogagent6`。

## 2026-06-30 Canvas Chat 快速设置对齐复核

### 已确认

- 快速模式重叠根因是 CSS 第一列仍按上传按钮 `44px` 计算，而 `1张` 按钮强制 `82px`，导致从第一列溢出到第二列。
- `dialogagent7` 将底部网格改为三个完整参数列，上传按钮只占第一列的一小块，不再决定参数列宽。
- 对话模式设置控件仍来自旧 Canvas Chat 原生控件，不新增桥接 UI。

### 需要继续验证

- 刷新当前项目页后确认快速模式 `1张 / 1K / 1:1` 横向对齐且无重叠。
- 切到对话模式确认同一套设置控件可见。

## 2026-06-30 Canvas Chat 对话/快速三按钮一致性复核

### 已确认

- 用户最终强调的是底部 `张数 / 清晰度 / 比例` 三个按钮本身，而不是模型下拉或额外桥接控件。
- `dialogagent8` 已把参数按钮布局改为同一套 flex wrap 规则，覆盖 `对话` 和 `快速` 两种模式；三按钮使用同样的 `.compact-control` 原生按钮样式。
- 参数按钮之间使用固定 `12px` gap，并用 `calc((100% - 24px) / 3)` 控制单个按钮宽度；窄面板时只会等宽压缩或换行，不会重叠。

### 需要继续验证

- 刷新当前项目页后分别查看 `对话` 和 `快速`：`1张 / 1K / 1:1` 视觉一致，且任意面板宽度下按钮不压住彼此。

## 2026-06-30 Packy GPT Image 2 尺寸参数复核

### 已确认

- Packy `gpt-image-2` 出图必须使用 Images API；文生图为 JSON，图生图/编辑为 multipart。
- `1K / 2K / 4K` 在本项目按图片大小档位处理，不再当作 Packy `quality`。
- Packy `quality` 只输出 `low / medium / high / auto`；旧前端字段如果传 `1k/2k/4k`，后端会把它用于 `size` 换算，同时把真实 `quality` 归一为 `auto`。
- `n` 向上游固定传 `1`，多张由后端循环请求，符合当前 Packy 编辑接口限制。
- 已补本地守护脚本，覆盖 `1:1 / 2:3 / 3:2 / 3:4 / 4:3 / 4:5 / 5:4 / 9:16 / 16:9 / 1:2 / 2:1 / 9:21 / 21:9` 全部比例。

### 需要继续验证

- 不付费环境先用本地换算断言覆盖常见比例；真实 Provider 点测需用户确认额度后进行。

## 2026-06-30 Packy GPT Image 2 全入口覆盖复核

### 已确认

- 当前后端所有 GPT Image 2 出图路径都应收敛到 `callProviderImageGeneration` 或 `callProviderImageEdit`，不再由各业务入口分别拼 Provider 参数。
- 已知入口覆盖：Canvas Chat 对话 Agent、快速生图任务、模板生图、图片工具局部修改/消除/文字编辑/扩图、后台 API Provider 图片线路测试。
- 图生图 / 图片编辑统一补 `input_fidelity=high`，以提高保留参考图主体、包装结构和细节的概率。
- 新增 `scripts/check-packy-gpt-image-adapter-coverage.js`，检查已知入口调用统一适配器，并禁止源码中出现绕过适配器的 Packy 图片端点直连。

### 需要继续验证

- 后续新增任何 GPT Image 2 入口时，必须把该入口加入覆盖脚本；否则静态检查只能覆盖当前已知入口。
- 真实 Provider 对多参考图字段名 `image[]`、`input_fidelity=high` 的实际兼容性仍需在用户确认额度后点测。

## 2026-06-30 Canvas Chat 对话 Agent GPT 5.5 文本抽取复核

### 已确认

- 用户截图里的失败点发生在分析阶段：后端未拿到 `finalPrompt`，因此不会进入 GPT Image 2 生图阶段。
- 已增强文本抽取函数，支持从 `data.choices`、`response.output`、`text.value`、`reasoning_content`、顶层 `final_prompt/finalPrompt` 等结构中取出 GPT 5.5 文本。
- 新增回归脚本 `scripts/check-provider-text-extraction.js`，直接抽取 `server.js` 中的真实函数运行 5 个样例，避免解析代码再次漂移。

### 需要继续验证

- 当前修复未触发真实 GPT 5.5 调用；用户刷新并重新提交后，应确认对话卡片能进入“正在生成图片...”阶段。
- 如果仍失败，需要查看真实上游响应体字段名，再把该结构加入抽取回归样例。

## 2026-06-30 Canvas Chat 分析诊断 API 复核

### 已确认

- 为避免完整对话 Agent 继续触发 GPT Image 2，已新增 `debugAnalysisOnly:true` 诊断模式。
- 诊断模式仅管理员可用，只跑 GPT 5.5 分析阶段，返回解析是否成功、抽取文本长度、最终 prompt 和响应结构摘要。
- 响应结构摘要会隐藏 key/token/secret/authorization/password 等敏感字段。

### 需要继续验证

- 待用户确认允许一次真实 GPT 5.5 上游调用后，用诊断模式跑当前失败请求，查看 `responseShape` 和 `extractedTextPreview`。
- 如果 `parseOk=false` 且 `responseShape` 显示新的字段路径，把该结构加入 `scripts/check-provider-text-extraction.js` 再修复。

## 2026-06-30 Canvas Chat New API 文本端点复核

### 已确认

- 本轮真实 API 对照显示：New API 的 `gpt-5.5 /responses` 会产生消费但可能返回 `completed + output=[]`，导致本地拿不到提示词。
- 同一条文本线路改用 `/chat/completions` 后能正常返回 `choices[0].message.content`，并且支持把参考图按 `image_url` 传给 GPT 5.5。
- `callProviderResponses` 现保留函数名以减少影响面，但 New API 文本线路内部走 Chat Completions；普通非 New API 路线仍保留 Responses 逻辑。
- `parseJsonObjectFromText` 已兼容连续两个 JSON 对象，只取第一个完整对象，避免把重复 JSON 整段塞进 `finalPrompt`。

### 需要继续验证

- 用户刷新旧画布后重新走对话模式，应先出现 GPT 5.5 生成的真实提示词并继续进入后续图片生成。
- 后续如果 New API 后台把 GPT 5.5 路线切回真正可用的 `/responses`，再评估是否需要配置化端点选择。

## 2026-06-30 旧画布维护边界复核

### 已确认

- 已新增 `docs/canvas-maintenance-boundary.md`，把当前唯一旧画布入口、资产、后端接口、对话/快速/视频三条链路、GPT Image 2 统一适配器和禁改项写成可执行边界。
- 已新增 `docs/canvas-maintenance-log.md`，把 `dialogagent9` 当前资产版本、New API 文本端点修复、参数控件去桥接层、Packy GPT Image 2 准则、多参考图修复和临时技术债集中记录。
- `docs/canvas-migration-checklist.md` 已链接维护边界、维护日志和 Packy 技术档案，后续接手不需要从长进度日志里翻线索。

### 需要继续验证

- 文档本轮只固化维护边界，没有再次触发真实 Provider。
- 业务链路稳定后，优先清理或收窄 `debugAnalysisOnly` 与普通错误里的 `responseShape`。
