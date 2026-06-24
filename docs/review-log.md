# 审查与复核记录

## 审查规则

每轮完成后记录：

- 已验证的命令和页面。
- 新发现的风险。
- 未覆盖的测试。
- 需要人工确认的事项。
- 下一轮优先级。
- 优先复用已有接口、成熟开源项目和当前技术栈能力，不重复造轮子；新增能力前先确认是否已有 New-API、CPA、Docker Compose、现有 `/api/*` 或前端模块可复用。

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
