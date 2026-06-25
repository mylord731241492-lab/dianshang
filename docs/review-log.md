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
