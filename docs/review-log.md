# 审查与复核记录

## 审查规则

每轮完成后记录：

- 已验证的命令和页面。
- 新发现的风险。
- 未覆盖的测试。
- 需要人工确认的事项。
- 下一轮优先级。
- 优先复用已有接口、成熟开源项目和当前技术栈能力，不重复造轮子；新增能力前先确认是否已有 New-API、CPA、Docker Compose、现有 `/api/*` 或前端模块可复用。

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
