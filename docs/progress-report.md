# 推进进度报告

## 记录规则

每轮推进后必须新增一条记录，便于下一轮对话直接对比。

```md
## YYYY-MM-DD 本轮进度报告

- 分支：
- 完成内容：
- 修改文件：
- 验证方式：
- 验证结果：
- 当前完成度：
- 新发现问题：
- 未完成清单：
- 下一轮建议：
- 需要人工介入：
```

## 2026-06-25 后台全页面截图复跑进度报告

- 分支：`codex/backend-platform`
- 完成内容：承认并修正后台截图复核不足的问题；新增后台全页面 Playwright 截图脚本，自动登录后台并逐页打开 Dashboard、用户、订单、日志、兑换码、API 线路、模型价格、任务监控、模板工作流、系统设置；每页校验关键标题、不出现 404/500，并归档 1440x900 桌面截图。
- 修改文件：`scripts/smoke-admin-pages-ui.ps1`、`scripts/smoke-admin-pages-ui-runner.js`、`docs/progress-report.md`、`docs/feature-completion-checklist.md`、`docs/review-log.md`
- 验证方式：`node --check scripts/smoke-admin-pages-ui-runner.js`、`node --check server.js`、`node --check assets/home-carousel-inertia.js`、`powershell -NoProfile -ExecutionPolicy Bypass -File scripts\smoke-admin-pages-ui.ps1`、`powershell -NoProfile -ExecutionPolicy Bypass -File scripts\smoke-frontend-routes.ps1`、`powershell -NoProfile -ExecutionPolicy Bypass -File scripts\smoke-api-disposable.ps1`、`Invoke-RestMethod http://127.0.0.1:3456/api/health`、`docker compose -f docker-compose.internal.yml ps`。
- 验证结果：后台 10 页截图全部生成到 `docs/design-references/admin-2026-06-25/full-*-desktop-1440x900.png`；脚本返回所有页面 `ok: true`；每页后台顶部标题颜色为 `rgb(2, 6, 23)`、字重 `900`；前端路由 smoke 和 disposable API smoke 通过；健康检查返回 mock/database ok；Docker `ps` 因 Docker Desktop daemon 未运行失败，未声明容器状态已复核。
- 当前完成度：后台约 99%，测试护栏约 98%，文档审查约 99%。
- 新发现问题：用户管理和模型价格页按钮数量较多，当前能测能用但后续可继续优化操作列密度；脚本第一次运行缺少 Playwright `open` 步骤，已补齐；本机 Docker Desktop daemon 当前未启动。
- 未完成清单：后台移动端卡片化优化、复杂表单保存后自动关闭/回显体验、服务器 Docker/Nginx/HTTPS 正式部署、真实 New-API 联通。
- 下一轮建议：继续做前端画布 JSON 导入/导出人工验收证据，或把后台复杂表单保存反馈继续打磨。
- 需要人工介入：请人工浏览 `docs/design-references/admin-2026-06-25/full-*.png` 做最终视觉判断；真实 New-API token 和服务器信息后续再提供。

## 2026-06-25 画布 JSON 导入与保存恢复证据进度报告

- 分支：`codex/backend-platform`
- 完成内容：新增画布 JSON UI smoke，验证 `/api/workflows/:id/save-json` 可保存 2 节点 1 连线 JSON，`/api/user/projects/:id` 可读取同一份数据；浏览器打开 `/canvas/:id` 后通过真实隐藏文件输入导入 `.workflow.json`，前端渲染 2 个节点和连线，并归档桌面截图。
- 修改文件：`scripts/smoke-canvas-json-ui.ps1`、`scripts/smoke-canvas-json-ui-runner.js`、`docs/progress-report.md`、`docs/feature-completion-checklist.md`、`docs/review-log.md`
- 验证方式：`node --check scripts/smoke-canvas-json-ui-runner.js`、`node --check server.js`、`node --check assets/home-carousel-inertia.js`、`node scripts/verify-canvas-restore-guard.js`、`powershell -NoProfile -ExecutionPolicy Bypass -File scripts\smoke-canvas-json-ui.ps1`、`powershell -NoProfile -ExecutionPolicy Bypass -File scripts\smoke-frontend-routes.ps1`、`powershell -NoProfile -ExecutionPolicy Bypass -File scripts\smoke-api-disposable.ps1`、`Invoke-RestMethod http://127.0.0.1:3456/api/health`、`docker compose -f docker-compose.internal.yml ps`。
- 验证结果：画布 JSON smoke 返回 `ok: true`，后端保存/读取为 `nodes: 2`、`edges: 1`；前端导入后 `hasVueFlow: true`、`nodeCount: 2`、console `0 errors`；截图归档到 `docs/design-references/frontend-2026-06-25/canvas-json-smoke-desktop-1440x900.png`；临时项目已自动删除，第一次失败残留的 `canvas_json_smoke_*` 项目也已清理，`/api/health` 项目数回到 3；前端路由 smoke 和 disposable API smoke 通过；Docker `ps` 因 Docker Desktop daemon 未运行失败，未声明容器状态已复核。
- 当前完成度：画布约 88%，后端平台护栏约 82%，测试护栏约 99%。
- 新发现问题：直接打开 `/canvas/:id` 不会自动从后端项目数据恢复节点，当前可测路径是本地 JSON 导入；这符合当前“画布走本地，到时候自己 JSON 导入”的阶段策略，但后续若要云端项目恢复，需要单独补前端加载逻辑；本机 Docker Desktop daemon 当前未启动。
- 未完成清单：真实本地文件夹授权保存、移动端画布长流程、云端项目自动恢复、真实 New-API 生图后回写画布。
- 下一轮建议：继续补模板/图库/画布的人工可测清单，或开始后台复杂表单保存回显细节。
- 需要人工介入：本地文件夹授权必须人工在浏览器点选；画布节点视觉和拖拽手感仍需人工确认。

## 2026-06-25 统一预检与 UI smoke 护栏进度报告

- 分支：`codex/backend-platform`
- 完成内容：把后台全页截图 smoke 和画布 JSON 导入 smoke 接入统一预检开关；`scripts\preflight-check.ps1` 新增 `SMOKE_UI=true` 可选 UI 验收，默认 API smoke 改为 disposable 一次性 SQLite，避免污染当前人工测试库；修复 PowerShell 父脚本不检查子脚本/native 命令退出码的问题，确保任一 smoke 失败时预检真实失败；部署验收脚本同步增加 native 退出码检查。
- 修改文件：`scripts/preflight-check.ps1`、`scripts/verify-internal-deploy.ps1`、`scripts/smoke-admin-pages-ui.ps1`、`scripts/smoke-admin-pages-ui-runner.js`、`scripts/smoke-canvas-json-ui.ps1`、`scripts/smoke-canvas-json-ui-runner.js`、`docs/deployment.md`、`docs/iteration-review-checklist.md`、`docs/progress-report.md`、`docs/feature-completion-checklist.md`、`docs/review-log.md`
- 验证方式：PowerShell Parser 解析 `preflight/verify-internal-deploy/admin-pages-ui/canvas-json-ui`；`node --check scripts/smoke-admin-pages-ui-runner.js`；`node --check scripts/smoke-canvas-json-ui-runner.js`；设置 `SMOKE_UI=true` 执行 `scripts\preflight-check.ps1`；执行 `docker compose -f docker-compose.internal.yml ps`。
- 验证结果：`SMOKE_UI=true` 统一预检通过，覆盖 Node 静态检查、disposable API smoke、前端路由 smoke、后台 10 页截图 smoke、画布 JSON 导入 smoke、health 和 git status；health 前后保持 `users: 22`、`projects: 3`、`redeem_codes: 10`，确认默认 preflight 不再污染当前库；Docker `ps` 因 Docker Desktop daemon 未运行失败，未声明容器状态已复核。
- 当前完成度：测试护栏约 99%，部署护栏约 93%，后台约 99%，画布约 88%。
- 新发现问题：旧版 `preflight-check.ps1` 调 PowerShell 子脚本时没有检查 `$LASTEXITCODE`，可能出现子脚本失败但父脚本继续打印通过；已修复。
- 未完成清单：Docker Desktop/服务器容器状态复核、服务器 Nginx/HTTPS、真实 New-API 联通、本地文件夹授权保存人工测试。
- 下一轮建议：继续做后台复杂表单保存回显人工点测，或在 Docker daemon 启动后运行 `scripts\verify-internal-deploy.ps1`。
- 需要人工介入：启动 Docker Desktop 或在服务器执行 Docker 验收；提供真实 New-API token 后再做真实网关联通。

## 2026-06-25 后台配置重启持久化进度报告

- 分支：`codex/backend-platform`
- 完成内容：新增 `scripts/smoke-admin-persistence-disposable.ps1`，使用一次性 SQLite 启动服务，写入后台 settings、API 线路、模型价格和模板工作流，停止并重启服务后再次读取断言；`preflight-check.ps1` 新增 `SMOKE_PERSISTENCE=true` 可选入口。
- 修改文件：`scripts/smoke-admin-persistence-disposable.ps1`、`scripts/preflight-check.ps1`、`docs/deployment.md`、`docs/iteration-review-checklist.md`、`docs/progress-report.md`、`docs/feature-completion-checklist.md`、`docs/review-log.md`
- 验证方式：PowerShell Parser 解析 `scripts\smoke-admin-persistence-disposable.ps1` 和 `scripts\preflight-check.ps1`；执行 `powershell -NoProfile -ExecutionPolicy Bypass -File scripts\smoke-admin-persistence-disposable.ps1`。
- 验证结果：持久化 smoke 通过；重启后 `settings.persistenceSmokeAt/defaultCredits`、新增 API 线路 `baseUrl`、新增模型价格 `pricePoints`、模板工作流 `persistenceSmokeAt` 均可读回；测试使用临时目录，未污染当前人工测试库。
- 当前完成度：后端平台护栏约 84%，部署护栏约 94%，测试护栏约 99%。
- 新发现问题：无新的业务缺口；该检查需要启动临时 Node 服务，日常可选，改后台配置或部署前建议开启。
- 未完成清单：Docker daemon 启动后的容器级持久化复核、真实 New-API 联通、服务器 Nginx/HTTPS。
- 下一轮建议：把后台复杂表单保存回显继续做 UI 级验证，或 Docker 启动后跑 `scripts\verify-internal-deploy.ps1`。
- 需要人工介入：启动 Docker Desktop 或提供服务器环境；真实 New-API token 后续人工配置。

## 2026-06-24 本轮进度报告

- 分支：`codex/backend-platform`
- 完成内容：新增轻量 Docker 内网部署骨架；新增运行数据路径配置；补充部署文档、功能完成清单和审查台账。
- 修改文件：`server.js`、`.env.example`、`Dockerfile`、`.dockerignore`、`docker-compose.internal.yml`、`docs/deployment.md`、`docs/feature-completion-checklist.md`、`docs/review-log.md`、`docs/known-gaps.md`
- 验证方式：已执行 `node --check server.js`、`node --check assets/home-carousel-inertia.js`、临时端口 `4567` 的 `scripts/smoke-api.ps1`、`/api/health`；尝试执行 `docker compose -f docker-compose.internal.yml config`。
- 验证结果：Node 静态检查通过；API 冒烟通过；`/api/health` 返回 `status: ok`、`database: ok`、`mode: mock` 和运行路径；Docker 验证因本机未安装或未配置 `docker` 命令而阻塞。
- 当前完成度：部署护栏约 60%，后端平台护栏约 55%，前端 1:1 仍需逐页复核。
- 新发现问题：当前仍是一体式打包前端资产，前端源码级维护能力有限；Docker 真实启动需要本机 Docker 环境可用。
- 未完成清单：Docker `config/up` 验收、容器重启后 SQLite 数据持久化验证、前端页面截图复核、New-API 真实联通测试。
- 下一轮建议：先完成 Docker 启动验收，再继续前端图库/模板/画布逐页复核。
- 需要人工介入：内网服务器 IP、域名/Nginx、真实 New-API token、视觉 1:1 人工验收。

## 2026-06-24 后台 smoke 扩展进度报告

- 分支：`codex/backend-platform`
- 完成内容：扩展接口冒烟脚本，覆盖后台用户、订单、日志、兑换码、任务监控、模板工作流读写和排行榜接口。
- 修改文件：`scripts/smoke-api.ps1`、`docs/progress-report.md`、`docs/feature-completion-checklist.md`、`docs/review-log.md`
- 验证方式：临时端口 `4568` 启动独立 SQLite 服务并运行 `scripts/smoke-api.ps1`。
- 验证结果：扩展后的 smoke 全部通过，覆盖 `health/admin login/dashboard/users/orders/usage-logs/redeem-codes/api-providers/model-prices/generate-tasks/template-workflows/settings/public routes`。
- 当前完成度：后端平台护栏约 62%，部署护栏约 60%，前端 1:1 仍需逐页复核。
- 新发现问题：本轮未发现后台兼容缺口；Docker 仍因本机无 `docker` 命令未实跑。
- 未完成清单：Docker 实机部署验收、图库入口复核、前端页面截图归档、New-API 真实联通测试、后台更多写接口的非破坏性回归。
- 下一轮建议：继续做图库/模板/画布前端验收，或在有 Docker 的机器上做内网部署演练。
- 需要人工介入：Docker 环境或服务器、New-API token、前端视觉验收。

## 2026-06-24 前端入口复核进度报告

- 分支：`codex/backend-platform`
- 完成内容：复核首页、模板、画布、用户中心、后台登录和图库入口；修复画布本地自动保存未选文件夹时的 console error 验收噪音。
- 修改文件：`index.html`、`assets/Canvas-B8bY9_QL.js`、`assets/Canvas-yGc8b2gf.js`、`docs/progress-report.md`、`docs/feature-completion-checklist.md`、`docs/review-log.md`
- 验证方式：临时端口 `4569` 启动独立服务；浏览器打开 `/`、`/template-image`、`/canvas`、`/user/center`、`/admin/dashboard`；点击首页 `图库`；用 CDP console 事件游标验证新导航后的画布日志。
- 验证结果：各入口均可渲染；图库入口点击后显示 `图片生成历史` 和空状态；画布本地文件夹未选择提示已从新 console error 降为 warning。
- 当前完成度：首页约 72%，模板约 75%，画布约 68%，图库约 65%，后端平台护栏约 62%。
- 新发现问题：用户中心和后台在未登录时会正确跳转登录页，后续需要登录态下继续验收；画布本地保存仍需人工选择文件夹才能验证真实保存。
- 未完成清单：登录态用户中心验收、后台页面视觉验收、模板生成闭环、画布保存恢复长流程、移动端截图归档。
- 下一轮建议：继续做登录态验收，优先用户中心、后台 dashboard、模板生成 mock 闭环。
- 需要人工介入：本地文件夹授权、视觉 1:1 判断、真实账号/登录态场景确认。

## 2026-06-24 登录态与图库闭环进度报告

- 分支：`codex/backend-platform`
- 完成内容：完成真实表单登录态验收；验证用户中心、后台 dashboard、模板 mock 生成和图库历史同步闭环；复用已有 `/api/user/generations` 补齐当前首页实际加载的旧图库历史模块。
- 修改文件：`assets/imageHistory-s5iwPTNE.js`、`docs/progress-report.md`、`docs/feature-completion-checklist.md`、`docs/review-log.md`
- 验证方式：临时端口 `4571` 启动独立服务；创建测试用户；调用 `/api/template/generate-image` 写入生成记录；真实表单登录用户和管理员；浏览器点击首页 `图库`；运行 `node --check assets/imageHistory-s5iwPTNE.js`。
- 验证结果：用户中心登录态显示 `smoke4571`、余额和 API 线路；管理员 dashboard 显示用户数、模型使用、用户排行和线路统计；图库历史从后端同步后显示 `共 1 张` 和 mock 图片记录。
- 当前完成度：首页约 74%，模板约 78%，画布约 68%，图库约 75%，后台约 74%，后端平台护栏约 64%。
- 新发现问题：当前存在新旧两套打包前端资产，首页实际引用旧 `index-ZrBcanD1.js` 链路；后续前端修复需优先确认实际加载资产，避免只修未加载文件。
- 未完成清单：模板页面按钮级交互验收、画布保存恢复长流程、后台子页面视觉验收、移动端截图归档、Docker 实机部署验收。
- 下一轮建议：继续做模板页面 mock 生成的前端按钮级闭环，或做后台子页面视觉/交互复核。
- 需要人工介入：视觉 1:1 判断、本地文件夹授权、Docker 环境或内网服务器。

## 2026-06-24 轻量平台架构护栏进度报告

- 分支：`codex/backend-platform`
- 完成内容：把 7 月前轻量内网平台路线固化为 ADR；新增每轮推进复核清单；新增 `scripts/preflight-check.ps1`，把 Node 静态检查、首页动效脚本检查、API smoke、health 和 git status 串成统一预检入口。
- 修改文件：`docs/adr/0001-lightweight-internal-platform.md`、`docs/iteration-review-checklist.md`、`scripts/preflight-check.ps1`、`docs/progress-report.md`、`docs/feature-completion-checklist.md`、`docs/review-log.md`、`docs/known-gaps.md`
- 验证方式：临时端口 `4573` 启动独立 SQLite 服务；执行 `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/preflight-check.ps1`；检查 `/api/health`。
- 验证结果：`node --check server.js` 通过；`node --check assets/home-carousel-inertia.js` 通过；后台与 public routes API smoke 全部通过；`/api/health` 返回 `success: true`、`database: ok`、`mode: mock`、New-API mock 回落状态和运行路径。

## 2026-06-24 Docker 内网实跑进度报告

- 分支：`codex/backend-platform`
- 完成内容：使用人工下载的 `node:20-bookworm` 完成 Docker 镜像构建，启动 `dianshang-app` 容器并验证健康检查；将 Docker 默认基础镜像从 slim 调整为已验证可构建的完整版 Debian Node 镜像；完成接口 smoke 和容器重启后的 SQLite 基础持久化验证。
- 修改文件：`Dockerfile`、`docker-compose.internal.yml`、`.env.example`、`docs/deployment.md`、`docs/feature-completion-checklist.md`、`docs/known-gaps.md`、`docs/review-log.md`、`docs/progress-report.md`
- 验证方式：`node --check server.js`、`node --check assets/home-carousel-inertia.js`、`docker compose -f docker-compose.internal.yml config/build/up/ps/restart`、`scripts/smoke-api.ps1`、`Invoke-RestMethod http://127.0.0.1:3456/api/health`、`Invoke-WebRequest http://127.0.0.1:3456/`
- 验证结果：镜像构建通过；容器状态 `healthy`；`/api/health` 返回 `success: true`、`status: ok`、`mode: mock`、`database: ok`；首页返回 200；接口 smoke 全部通过；容器重启后表计数保留。
- 当前完成度：部署护栏约 92%，后端平台护栏约 72%，前端 1:1 仍需继续人工逐页复核。
- 新发现问题：`node:20-bookworm-slim` 会因 `better-sqlite3` 缺编译工具失败；本地测试阶段改用 `node:20-bookworm` 更省心。
- 未完成清单：Docker 服务的人工浏览器点击测试、服务器/Nginx/HTTPS 部署、真实 New-API 联通。
- 下一轮建议：先让用户在 Docker 服务上手动测试首页、模板、图库、画布、后台；若页面无明显问题，再做容器重启持久化验证和提交推送。
- 需要人工介入：浏览器人工验收；真实 New-API token、服务器 IP/域名/Nginx 后续再配置。

## 2026-06-24 内网测试优先部署进度报告

- 分支：`codex/backend-platform`
- 完成内容：明确部署路线为先内网测试、稳定后服务器部署；画布保持本地 JSON 导入/导出策略，不作为服务端化阻塞项；New-API/CPA 继续复用外部开源项目，不在本项目重造网关和账号池；调整预检和部署验收脚本，使内网 mock 测试可无 `.env` 跑通，服务器部署再开启严格密钥检查。
- 修改文件：`scripts/preflight-check.ps1`、`scripts/verify-internal-deploy.ps1`、`docs/deployment.md`、`docs/adr/0001-lightweight-internal-platform.md`、`docs/backend-maintenance.md`、`docs/architecture-newapi-cpa.md`、`docs/known-gaps.md`、`docs/feature-completion-checklist.md`、`docs/review-log.md`、`docs/internal-test-rollout-checklist.md`
- 验证方式：临时端口 `4593` 使用独立 SQLite 数据目录启动服务；执行 `powershell -NoProfile -ExecutionPolicy Bypass -File scripts\preflight-check.ps1`。
- 验证结果：预检通过；`node --check server.js`、`node --check assets/home-carousel-inertia.js` 通过；画布恢复守卫按本地优先策略跳过；API smoke 全部通过；前端路由 smoke 全部通过；`/api/health` 返回 `mode: mock`、`database: ok`、`gateway: new-api` 且真实 AI 未启用。
- 当前完成度：部署护栏约 78%，New-API 架构护栏约 74%，画布策略已明确为本地优先待复核。
- 新发现问题：此前部署文档允许无 `.env` mock 启动，但 `verify-internal-deploy.ps1` 会强制 `.env`，已调整为内网测试宽松、服务器部署严格。
- 未完成清单：Docker 实机启动、容器重启后 SQLite 持久化、服务器 Nginx/HTTPS、生产 `.env`、真实 New-API 联通、画布 JSON 导入/导出人工验收。
- 下一轮建议：在内网测试机或安装 Docker 的机器上运行 `scripts/verify-internal-deploy.ps1`，再继续后台/模板/图库页面验收。
- 需要人工介入：提供内网测试机器/Docker 环境；后续服务器 IP、域名、HTTPS 和真实 New-API token。
- 当前完成度：部署护栏约 65%，后端平台护栏约 68%，文档审查约 86%，前端 1:1 完成度保持上一轮估算。
- 新发现问题：CodeGraph 在该目录未初始化，结构查询暂时不能使用；Docker CLI 本机仍不可用，容器实跑和重启持久化还需在有 Docker 的机器上验证。
- 未完成清单：Docker Compose 实机启动、容器重启后 SQLite 数据持久化、模板页按钮级闭环、画布保存恢复长流程、后台子页面视觉验收、New-API 真实联通测试。
- 下一轮建议：优先继续模板页前端按钮级验收和后台子页面复核；如果准备内网服务器，则同步做 Docker Compose 实机部署演练。
- 需要人工介入：提供 Docker 环境或内网服务器；提供 New-API token 才能做真实网关联通；前端 1:1 视觉仍需人工确认。

## 2026-06-24 模板/图库 smoke 闭环进度报告

- 分支：`codex/backend-platform`
- 完成内容：复核模板页和后台 dashboard；模板页可加载 10 个模板、切换到主图模板并显示素材槽、提示词、反推和生成入口；后台 dashboard 登录态可显示统计、排行和 API 线路；扩展 `scripts/smoke-api.ps1`，把模板设置、模型线路、用户注册登录、模板反推、模板生成、用户图库历史纳入自动 smoke。
- 修改文件：`scripts/smoke-api.ps1`、`docs/progress-report.md`、`docs/feature-completion-checklist.md`、`docs/review-log.md`
- 验证方式：浏览器访问 `http://127.0.0.1:3456/template-image` 和 `/admin/dashboard`；临时端口 `4575` 启动独立 SQLite 服务并运行 `scripts/smoke-api.ps1`。
- 验证结果：模板页从后端加载 10 个模板，模板切换正常；后台 dashboard 可渲染真实统计；扩展后的 smoke 全部通过，覆盖 `template/settings`、`model-routes`、`auth register/login profile`、`template/reverse-prompt`、`template/generate-image`、`user/generations` 和后台接口。
- 当前完成度：模板约 82%，图库约 78%，后台约 76%，后端平台护栏约 72%，文档审查约 88%。
- 新发现问题：PowerShell 5 对 UTF-8 无 BOM `.ps1` 中的中文字符串解析不稳定，本轮 smoke 测试数据改为 ASCII；模板页首次进入曾短暂出现 `共 0 个模板`，刷新后恢复 10 个，需后续观察是否与本地草稿状态有关。
- 未完成清单：模板真实上传图片后的反推/生成按钮级闭环、图库多图/删除/保存链接、画布保存恢复长流程、后台子页逐页视觉验收、Docker 实机部署验收。
- 下一轮建议：继续做模板上传 mock 文件后的完整前端闭环，或转向后台 users/orders/logs/api-providers/template-workflows 子页视觉和写操作验收。
- 需要人工介入：模板视觉 1:1 判断、本地文件夹授权、Docker 环境或内网服务器、New-API token。

## 2026-06-24 后台子页与前端路由 smoke 进度报告

- 分支：`codex/backend-platform`
- 完成内容：逐页复核后台 dashboard、users、orders、logs、generate-tasks、redeem-codes、api-providers、model-prices、template-workflows、settings；新增 `scripts/smoke-frontend-routes.ps1`，并接入 `scripts/preflight-check.ps1`，覆盖 SPA 路由和核心静态资产。
- 修改文件：`scripts/smoke-frontend-routes.ps1`、`scripts/preflight-check.ps1`、`docs/progress-report.md`、`docs/feature-completion-checklist.md`、`docs/review-log.md`
- 验证方式：浏览器逐页访问后台子页；本机 `3456` 运行 `scripts/smoke-frontend-routes.ps1`；临时端口 `4577` 运行 `scripts/preflight-check.ps1`。
- 验证结果：后台子页均可渲染，不是空壳；`orders/logs/template-workflows/settings` 复核后可见表格或配置内容；前端路由 smoke 覆盖 `/`、登录注册、模板、画布、用户中心、后台所有核心子页和核心静态资产，全部通过；完整 preflight 通过。
- 当前完成度：首页约 72%，模板约 82%，图库约 78%，后台约 80%，部署护栏约 69%，后端平台护栏约 73%，文档审查约 90%。
- 新发现问题：首次批量读取后台部分页面时曾短暂拿到空文本，增加等待和复核后正常，后续需继续关注懒加载/路由切换时序；Docker CLI 仍未在本机验证。
- 未完成清单：后台子页按钮级写操作、模板真实上传素材后的完整生成闭环、图库多图/删除/保存链接、画布保存恢复长流程、Docker 实机部署、New-API 真实联通。
- 下一轮建议：继续后台子页写操作验收，优先 API 线路新增/编辑测试连接、模板工作流保存、系统设置保存；或切到画布保存恢复长流程。
- 需要人工介入：Docker/内网服务器、New-API token、本地文件夹授权、视觉 1:1 人工确认。

## 2026-06-24 后台写操作 smoke 进度报告

- 分支：`codex/backend-platform`
- 完成内容：新增 `scripts/smoke-admin-write.ps1`，覆盖后台按钮级写接口：用户状态/余额/安全检查/重置密码/软删除/回收站恢复/永久匿名化，订单状态，兑换码创建删除，API 线路新增/编辑/测试/拉模型/设默认/删除，模型新增/编辑/启停/删除，模板工作流保存，系统设置保存；`preflight-check.ps1` 仅在 `SMOKE_ALLOW_WRITES=true` 时运行该写操作 smoke。
- 修改文件：`scripts/smoke-admin-write.ps1`、`scripts/preflight-check.ps1`、`docs/progress-report.md`、`docs/feature-completion-checklist.md`、`docs/review-log.md`
- 验证方式：临时端口 `4578` 单独运行 `scripts/smoke-admin-write.ps1`；临时端口 `4579` 运行默认 `scripts/preflight-check.ps1` 确认写操作默认跳过；临时端口 `4580` 设置 `SMOKE_ALLOW_WRITES=true` 后运行完整 `preflight-check.ps1`。
- 验证结果：后台写操作 smoke 通过；默认 preflight 会跳过破坏性写操作；显式开启写操作时完整 preflight 通过，且仍为 mock/New-API 回落模式。
- 当前完成度：后台约 84%，部署护栏约 70%，后端平台护栏约 76%，文档审查约 91%。
- 新发现问题：后台订单状态接口当前为 mock 响应，不持久化订单状态；API 线路/模型/模板工作流/系统设置写操作已通过 app_state 持久化链路验证，但 Docker 重启持久化仍需实机验证。
- 未完成清单：后台写操作浏览器 UI 点击级验收、Docker 实机部署与重启持久化、New-API 真实联通、画布保存恢复长流程、模板真实上传素材生成闭环。
- 下一轮建议：继续做后台 UI 点击级写操作验收，或切到 Docker 实机/内网服务器部署演练。
- 需要人工介入：Docker/内网服务器、New-API token、是否允许在正式库跑写操作 smoke 的明确确认。

## 2026-06-24 内网部署验收脚本进度报告

- 分支：`codex/backend-platform`
- 完成内容：新增 `scripts/verify-internal-deploy.ps1`，用于有 Docker 的服务器上执行内网部署全流程验收；更新 `docs/deployment.md`，补充完整服务器验收命令、默认 smoke、前端路由 smoke、容器重启健康检查和写操作 smoke 的安全开关说明。
- 修改文件：`scripts/verify-internal-deploy.ps1`、`docs/deployment.md`、`docs/progress-report.md`、`docs/feature-completion-checklist.md`、`docs/review-log.md`
- 验证方式：本机执行 `docker --version` 检查；PowerShell 解析 `scripts/verify-internal-deploy.ps1`；临时端口 `4581` 运行默认 `scripts/preflight-check.ps1`。
- 验证结果：本机未安装 Docker，无法实跑 Compose；部署验收脚本语法检查通过；默认 preflight 通过，覆盖 API smoke、前端路由 smoke、health，并默认跳过后台写操作 smoke。
- 当前完成度：部署护栏约 74%，后端平台护栏约 76%，文档审查约 92%。
- 新发现问题：Docker CLI 在当前机器不可用，容器构建、启动、重启持久化仍需到内网服务器或安装 Docker 后验证。
- 未完成清单：`docker compose config/up/restart` 实机验收、SQLite volume 重启持久化、New-API 真实联通、Nginx/域名/HTTPS 配置、服务器备份恢复演练。
- 下一轮建议：如果有内网服务器，直接运行 `scripts/verify-internal-deploy.ps1`；如果继续本机推进，则做画布保存恢复长流程或后台 UI 点击级写操作。
- 需要人工介入：提供有 Docker 的服务器或安装 Docker Desktop；提供 New-API token；确认内网端口、域名和是否需要 Nginx/HTTPS。

## 2026-06-24 后台 UI 写操作与 New-API 配置回显进度报告

- 分支：`codex/backend-platform`
- 完成内容：修复后台兑换码前端字段兼容，`points/totalCount/perUserLimit/status` 能正确写入和回显；修复 API 线路 `displayName/baseUrl/category/apiFormat` 兼容与回显，避免 New-API 配置被 mock 默认地址覆盖；完成浏览器 UI 点击级验收，覆盖兑换码创建、API 线路新增、模板工作流保存、系统设置保存。
- 修改文件：`server.js`、`scripts/smoke-admin-write.ps1`、`docs/api-contracts.md`、`docs/progress-report.md`、`docs/feature-completion-checklist.md`、`docs/review-log.md`、`docs/known-gaps.md`
- 验证方式：临时端口 `4582` 使用独立 SQLite 启动服务；浏览器登录后台并点击创建兑换码、创建 API 线路、保存模板工作流、保存系统设置；运行 `node --check server.js`、`node --check assets/home-carousel-inertia.js`、默认 `scripts/preflight-check.ps1` 和 `SMOKE_ALLOW_WRITES=true` 的 `scripts/smoke-admin-write.ps1`。
- 验证结果：兑换码 `UITEST77` 回显为 `77 / 7 / 1 / 0 / 7`；API 线路 `ui-newapi-smoke-2` 回显 `UI NewAPI Smoke 2` 与 `https://new-api-2.internal.example/v1`；模板工作流出现 `模板工作流已保存`；系统设置出现 `系统设置已保存`；默认 preflight 通过；后台写操作 smoke 通过。
- 当前完成度：后台约 87%，New-API 骨架约 72%，后端平台护栏约 78%，文档审查约 93%，部署护栏保持 74%。
- 新发现问题：后台 `n-dialog` 类创建弹窗保存成功后不会自动关闭，兑换码弹窗的关闭/取消按钮在本次浏览器自动化中表现不稳定；需要在前端 polish 阶段集中修弹窗关闭状态。
- 未完成清单：Docker 实机部署与重启持久化、New-API 真实联通、画布保存恢复长流程、模板真实上传素材生成闭环、后台弹窗自动关闭体验修复。
- 下一轮建议：优先跑 `scripts/preflight-check.ps1` 与写操作 smoke，完成提交；之后切到画布保存恢复长流程，或在有 Docker 的服务器上执行 `scripts/verify-internal-deploy.ps1`。
- 需要人工介入：Docker/内网服务器、New-API token、后台弹窗体验是否按原站要求保存后自动关闭的视觉确认。

## 2026-06-24 画布保存恢复 API 长流程进度报告

- 分支：`codex/backend-platform`
- 完成内容：补齐画布项目接口统一响应格式，保留 `items/id/name/data` 等前端兼容字段；扩展 `scripts/smoke-api.ps1`，覆盖项目创建、workflow 云保存、读取恢复、列表缩略图、项目更新恢复和删除清理。
- 修改文件：`server.js`、`scripts/smoke-api.ps1`、`docs/api-contracts.md`、`docs/progress-report.md`、`docs/feature-completion-checklist.md`、`docs/review-log.md`
- 验证方式：临时端口 `4584` 使用独立 SQLite 启动服务；运行 `node --check server.js`、PowerShell 脚本解析检查、BOM 检查和默认 `scripts/preflight-check.ps1`。
- 验证结果：默认 preflight 通过；API smoke 输出包含 `POST /api/user/projects`、`POST /api/workflows/:id/save-json`、`GET /api/user/projects/:id`、`GET /api/user/projects`、`PUT /api/user/projects/:id`、`DELETE /api/user/projects/:id`；health 最终显示 `projects: 0`，测试项目已清理。
- 当前完成度：画布约 74%，后端平台护栏约 79%，文档审查约 94%，部署护栏保持 74%。
- 新发现问题：本轮没有发现接口阻塞；浏览器 UI 级画布拖拽、上传、保存按钮和重新打开项目仍未覆盖。
- 未完成清单：画布浏览器 UI 长流程、Docker 实机部署与重启持久化、New-API 真实联通、模板真实上传素材生成闭环、后台弹窗自动关闭体验修复。
- 下一轮建议：继续做画布浏览器 UI 级验收，或若服务器就绪则执行 `scripts/verify-internal-deploy.ps1` 做内网部署验证。
- 需要人工介入：本地文件夹授权场景、Docker/内网服务器、New-API token、画布视觉 1:1 人工确认。

## 2026-06-24 画布 UI 与轻量部署护栏进度报告

- 分支：`codex/backend-platform`
- 完成内容：复核画布浏览器 UI 基础长流程，确认工具栏、保存面板、图片历史面板和新增节点入口可用；修正 `docker-compose.internal.yml`，去掉对 `.env` 的硬依赖，让无 `.env` 的内网 mock 部署也能使用安全占位默认值启动；更新部署文档，明确 `.env` 可选但生产必须改 `JWT_SECRET` 和按需配置 New-API。
- 修改文件：`docker-compose.internal.yml`、`docs/deployment.md`、`docs/progress-report.md`、`docs/feature-completion-checklist.md`、`docs/review-log.md`、`docs/known-gaps.md`
- 验证方式：浏览器临时端口画布 UI 观察；运行 `node --check server.js`、`node --check assets/home-carousel-inertia.js`、默认 `scripts/preflight-check.ps1`、`/api/health`、BOM 检查和 `git status --short --branch`。
- 验证结果：画布初始状态可见 2 个节点和 1 条边，保存/历史/新增节点入口有响应；保存面板未授权本地文件夹时给出预期提示；临时端口默认 preflight 通过，覆盖 API smoke、前端路由 smoke、health 和 git status；Docker 本机仍不可用，Compose 实机启动未验证。
- 当前完成度：画布约 78%，部署护栏约 76%，后端平台护栏约 79%，文档审查约 95%，New-API 骨架约 72%。
- 新发现问题：动态示例项目刷新后节点可能从示例节点变为 0；保存面板的完整本地保存需要人工授权文件夹；CodeGraph 未初始化，结构化索引暂不可用。
- 未完成清单：Docker 实机部署与重启持久化、New-API 真实联通、画布上传素材/连线/保存恢复 UI 长流程、模板真实上传素材生成闭环、后台弹窗自动关闭体验修复。
- 下一轮建议：优先在内网服务器跑 `scripts/verify-internal-deploy.ps1` 完成 Docker 真实部署验收；如果继续本机推进，则修画布动态项目刷新后节点丢失，再补上传素材和重新进入同一项目的 UI 验收。
- 需要人工介入：提供有 Docker 的内网服务器或安装 Docker Desktop；提供 New-API token；授权浏览器本地文件夹保存；人工确认首页、画布、模板、图库的 1:1 视觉差异。

## 2026-06-24 画布示例项目刷新恢复进度报告

- 分支：`codex/backend-platform`
- 完成内容：定位当前实际前端入口为 `assets/index-DglIsp_g.js -> assets/Canvas-B8bY9_QL.js`；未直接重写画布大包，改为新增轻量启动守卫，在主 Vue 模块加载前修复本地项目摘要中空的 `示例项目`，避免刷新时读到空摘要导致默认节点丢失；新增守卫验证脚本，并接入前端路由 smoke 和统一 preflight。
- 修改文件：`index.html`、`assets/canvas-project-restore-guard.js`、`scripts/verify-canvas-restore-guard.js`、`scripts/smoke-frontend-routes.ps1`、`scripts/preflight-check.ps1`、`docs/progress-report.md`、`docs/feature-completion-checklist.md`、`docs/review-log.md`、`docs/known-gaps.md`
- 验证方式：运行 `node --check assets/canvas-project-restore-guard.js`、`node --check scripts/verify-canvas-restore-guard.js`、`node scripts/verify-canvas-restore-guard.js`、默认 `scripts/preflight-check.ps1`、BOM 检查和 `git status --short --branch`。
- 验证结果：守卫脚本可解析；mock `localStorage` 验证通过，空示例项目补回 2 个节点和 1 条边，普通项目不变；前端路由 smoke 覆盖新资产；浏览器会话验证中途被外部会话切换打断，未把浏览器刷新同一项目记为完成。
- 当前完成度：画布约 80%，后端平台护栏约 79%，部署护栏约 76%，文档审查约 96%，New-API 骨架约 72%。
- 新发现问题：实际入口链和残留入口链并存，当前生效链是 `index-DglIsp_g.js / Canvas-B8bY9_QL.js`，后续改打包资产必须先确认链路；浏览器自动化会话偶发被切换，需要下轮重新验证刷新场景。
- 未完成清单：浏览器刷新同一动态项目后的节点数二次确认、画布上传素材/连线/保存恢复 UI 长流程、Docker 实机部署与重启持久化、New-API 真实联通、模板真实上传素材生成闭环。
- 下一轮建议：重新做画布浏览器验证，确认 `/canvas/project_*` 刷新后仍有示例节点；随后继续上传素材、连线和云端保存恢复 UI 长流程。
- 需要人工介入：本地文件夹授权场景、Docker/内网服务器、New-API token、画布视觉 1:1 人工确认。

## 2026-06-24 Docker 前可测试状态进度报告

- 分支：`codex/backend-platform`
- 完成内容：按“先把前后端做到可测试，再由人工 Docker 手测”的节奏，完成本机 mock 模式预检和后台写操作验证；确认当前不需要先接真实 New-API、邮件、支付或云存储。
- 修改文件：`docs/progress-report.md`、`docs/feature-completion-checklist.md`、`docs/review-log.md`
- 验证方式：临时端口 `4594` + 一次性 SQLite 执行 `scripts/preflight-check.ps1`；临时端口 `4596` + 一次性 SQLite 执行 `SMOKE_ALLOW_WRITES=true scripts/smoke-admin-write.ps1`。
- 验证结果：预检通过，覆盖 Node 语法、API smoke、前端路由 smoke、health；后台写操作 smoke 通过，覆盖用户状态/余额/安全/删除恢复、订单状态、兑换码、API 线路、模型、模板工作流和系统设置。
- 当前完成度：后端可测试护栏约 82%，部署护栏约 80%，前端路由级可测试约 82%。
- 新发现问题：后台写操作脚本默认安全关闭，必须在一次性数据库上显式设置 `SMOKE_ALLOW_WRITES=true`；这是预期护栏。
- 未完成清单：Docker 容器实跑、容器重启持久化、浏览器人工视觉验收、真实 New-API 联通。
- 下一轮建议：先打开本地服务做人工浏览器验收，确认首页/模板/图库/用户中心/后台 UI 操作，再由人工启动 Docker 验收。
- 需要人工介入：人工视觉验收和 Docker 手动运行确认。

## 2026-06-24 Docker 启动排障与本机测试服务进度报告

- 分支：`codex/backend-platform`
- 完成内容：尝试启动 Docker Compose 供人工测试；定位官方 Docker Hub 拉取 `node:20-alpine` 出现 EOF；将 Dockerfile 改为可配置 `NODE_IMAGE`，并把默认基础镜像改为 `node:20-bookworm-slim`，避免 Alpine/musl 下 `better-sqlite3` 需要现场编译；使用 `docker.m.daocloud.io/library/node:20-alpine` 验证镜像代理可绕过 Docker Hub metadata 问题，但 Alpine 构建因缺 Python/编译工具失败；使用 `bookworm-slim` 镜像代理时下载超时。为不阻塞人工测试，已启动本机 Node mock 服务。
- 修改文件：`Dockerfile`、`docker-compose.internal.yml`、`.gitignore`、`docs/progress-report.md`、`docs/review-log.md`
- 验证方式：`docker compose -f docker-compose.internal.yml config`；`docker compose up --build -d`；`Invoke-RestMethod http://127.0.0.1:3456/api/health`。
- 验证结果：Compose config 通过；Docker 容器未成功启动，当前阻塞在外部基础镜像下载/构建阶段；本机 Node 服务已在 `http://127.0.0.1:3456/` 启动，`/api/health` 返回 `success: true`、`mode: mock`、`database: ok`。
- 当前完成度：Docker 配置护栏约 82%，Docker 实跑验收仍未完成；本机 mock 人工测试可开始。
- 新发现问题：Docker Hub 网络不稳定；Alpine 基础镜像不适合当前 `better-sqlite3` 依赖，除非额外安装 Python/make/g++，因此已切换到 Debian slim 默认路线。
- 未完成清单：Docker `bookworm-slim` 镜像完整下载、容器启动、healthcheck、重启持久化；人工浏览器视觉验收。
- 下一轮建议：先用当前本机 Node 服务做人工页面验收；Docker 等镜像下载稳定后重试 `NODE_IMAGE=docker.m.daocloud.io/library/node:20-bookworm-slim docker compose -f docker-compose.internal.yml up --build -d`。
- 需要人工介入：当前请在浏览器测试 `http://127.0.0.1:3456/`；Docker 镜像下载可能需要稳定网络或配置 Docker Desktop 镜像加速。

## 2026-06-24 Docker 镜像网络重试进度报告

- 分支：`codex/backend-platform`
- 完成内容：按人工测试反馈重新尝试 Docker Compose 启动；先停止本机 Node 测试服务释放 `3456`，分别尝试 `docker.m.daocloud.io/library/node:20-bookworm-slim` 和 `docker.1ms.run/library/node:20-bookworm-slim`；两者均在 metadata/token 阶段 EOF；确认本地 Docker 没有 Node 镜像缓存，容器未启动；已恢复本机 Node 服务供继续测试。
- 修改文件：`docs/progress-report.md`、`docs/review-log.md`
- 验证方式：`docker compose -f docker-compose.internal.yml up --build -d`、`docker images`、`docker compose ps`、`Invoke-RestMethod http://127.0.0.1:3456/api/health`。
- 验证结果：Docker 容器仍未启动，阻塞在外部镜像源 EOF；本机 Node 服务恢复成功，`/api/health` 返回 `success: true`、`mode: mock`、`database: ok`。
- 当前完成度：本机 mock 可测试保持可用；Docker 实跑验收仍阻塞在镜像下载网络。
- 新发现问题：多个镜像代理源 metadata/token 请求均 EOF，当前不是项目代码或 Compose 配置失败。
- 未完成清单：Docker Desktop 镜像源稳定后完整构建、容器 healthcheck、volume 重启持久化。
- 下一轮建议：继续人工页面测试；Docker 需要先解决基础镜像拉取，可以在 Docker Desktop 配置可用 registry mirror 或换稳定网络后重试。
- 需要人工介入：如必须立刻 Docker，需要你确认可用代理/网络或允许配置 Docker Desktop 镜像加速。

## 2026-06-24 Docker 内网实跑最终确认进度报告

- 分支：`codex/backend-platform`
- 完成内容：在用户人工下载 `node:20-bookworm` 后完成 Docker 构建、启动、健康检查、接口 smoke 和容器重启后的 SQLite 基础持久化验证；把默认 Docker 镜像固定为当前验证通过的 `node:20-bookworm`，避免后续默认使用 slim 镜像再次失败。
- 修改文件：`Dockerfile`、`docker-compose.internal.yml`、`.env.example`、`docs/deployment.md`、`docs/feature-completion-checklist.md`、`docs/known-gaps.md`、`docs/review-log.md`、`docs/progress-report.md`
- 验证方式：`node --check server.js`、`node --check assets/home-carousel-inertia.js`、`docker compose -f docker-compose.internal.yml config`、`docker compose -f docker-compose.internal.yml build`、`docker compose -f docker-compose.internal.yml up -d`、`scripts/smoke-api.ps1`、`docker compose -f docker-compose.internal.yml restart app`、`/api/health`、首页 200 检查。
- 验证结果：全部通过；容器 `dianshang-app` 处于 `healthy`；`/api/health` 返回 `success: true`、`mode: mock`、`database: ok`；重启后 SQLite 表计数保留。
- 当前完成度：部署护栏约 92%，后端平台护栏约 72%，前端 1:1 仍需人工逐页复核。
- 新发现问题：`node:20-bookworm-slim` 不适合作为当前默认 Docker 基础镜像，因为 `better-sqlite3` 可能需要原生编译工具。
- 未完成清单：Docker 服务人工浏览器完整点击测试、服务器/Nginx/HTTPS 正式部署、真实 New-API 联通、前端 1:1 剩余视觉细节。
- 下一轮建议：用户先在当前 Docker 服务 `http://127.0.0.1:3456/` 手动测试首页、模板、图库、画布和后台；我根据反馈继续修前端交互或后台接口。
- 需要人工介入：浏览器人工验收；真实 New-API token 和服务器部署信息后续再提供。

## 2026-06-24 今日人工测试计划落库进度报告

- 分支：`codex/backend-platform`
- 完成内容：新增今日人工测试计划文档，明确后台与前端打通到可人工测试；同步功能清单和 review log；继续承诺不扩架构、不接真实 New-API key。
- 修改文件：`docs/plans/2026-06-24-admin-frontend-manual-test.md`、`docs/progress-report.md`、`docs/feature-completion-checklist.md`、`docs/review-log.md`
- 验证方式：`node --check server.js`、`node --check assets/home-carousel-inertia.js`、`scripts/smoke-api.ps1`、`/api/health`、`docker compose ps`、`git status`。
- 验证结果：全部通过；Docker 服务 `healthy`，`/api/health` 为 mock + database ok；API smoke 覆盖登录、用户、项目、模板生成、图库历史和后台核心接口。
- 当前完成度：后台约 90%，部署护栏约 92%，前端人工验收进行中。
- 新发现问题：无新增技术阻塞；下一步主要靠人工点击发现 UI 细节。
- 未完成清单：后台 UI 人工点击、模板生成闭环人工测试、图库多图/空状态、画布基础操作、用户中心生成记录。
- 下一轮建议：从后台 UI 点击级验收开始，发现一个修一个。
- 需要人工介入：你在浏览器里点测并截图反馈；真实 New-API key 和服务器部署信息后续再给。

## 2026-06-24 画布节点圆角修复进度报告

- 分支：`codex/backend-platform`
- 完成内容：审查图片节点和文生图节点圆角割裂问题；新增轻量 CSS 修复内部 header/footer 背景圆角，同时保留 Vue Flow 连接点外溢；Docker 重新构建并验证新 CSS 已加载。
- 修改文件：`index.html`、`assets/canvas-node-radius-fix.css`、`scripts/smoke-frontend-routes.ps1`、`docs/progress-report.md`、`docs/feature-completion-checklist.md`、`docs/review-log.md`
- 验证方式：浏览器刷新画布项目；读取 computed style；截图检查选中态图片节点；`docker compose -f docker-compose.internal.yml up --build -d`；`/api/health`；静态资源请求。
- 验证结果：图片节点 header/footer 圆角生效，文生图 header 圆角生效，连接点未被裁；Docker 服务 `healthy`，`/assets/canvas-node-radius-fix.css` 返回 200。
- 当前完成度：画布约 82%，部署护栏约 92%，前端人工验收继续进行中。
- 新发现问题：同类问题可能存在于其他节点类型，需要后续人工截图确认。
- 未完成清单：更多节点类型选中态视觉、画布 JSON 导入/导出、本地文件夹授权、模板/图库继续人工测试。
- 下一轮建议：你先刷新画布看圆角；如果还有边缘割裂，我继续按截图位置微调。
- 需要人工介入：肉眼确认当前修复是否符合预期。

## 2026-06-24 画布选中态外层圆角复核进度报告

- 分支：`codex/backend-platform`
- 完成内容：根据最新截图复核画布节点圆角；定位剩余割裂来自 Vue Flow 外层节点默认 `8px` 圆角与节点本体 `24px/28px` 圆角不一致；补齐图片节点、文生图节点、图片生成节点外层圆角，不改变 `overflow: visible`，避免连接点和加号被裁掉。
- 修改文件：`assets/canvas-node-radius-fix.css`、`docs/progress-report.md`、`docs/feature-completion-checklist.md`、`docs/review-log.md`
- 验证方式：Docker 重新构建；浏览器打开 `/canvas/project_1782292799148_7xqro748k`，新增文生图测试节点后读取 computed style；请求 `/assets/canvas-node-radius-fix.css`；执行 `node --check server.js`、`node --check assets/home-carousel-inertia.js`、`scripts/smoke-frontend-routes.ps1`、`/api/health`。
- 验证结果：图片节点外层圆角为 `24px`，文生图外层圆角为 `24px`，图片生成外层圆角为 `28px`；节点外层仍为 `overflow: visible`；Docker 服务 `healthy`，前端路由 smoke 通过，health 返回 `success: true`。
- 当前完成度：画布约 83%，部署护栏约 92%，前端人工验收继续进行中。
- 新发现问题：文本节点和视频节点仍保留原设计小圆角；本轮未确认它们是否需要跟随原站扩大圆角。
- 未完成清单：用户肉眼确认当前截图位置、文本/视频节点视觉一致性、画布 JSON 导入/导出、本地文件夹授权、模板/图库继续人工测试。
- 下一轮建议：你刷新画布看这两个截图位置；如果视觉 OK，就继续转后台 UI 弹窗/保存回显人工可测。
- 需要人工介入：确认圆角是否符合你要的 1:1 观感。

## 2026-06-24 画布小地图与聊天面板微调进度报告

- 分支：`codex/backend-platform`
- 完成内容：根据最新截图把右下角小地图从纯白改成暗色半透明玻璃面板；同步覆盖小地图 SVG 遮罩填充；将左侧 Canvas Chat 面板从 `top: 56px` 下移到 `top: 96px`，避免被顶部浮动工具条阴影遮挡；按参考图把面板改为完整浮动卡片，左侧留 `24px`，底部留约 `22px`，四角圆角为 `24px`。
- 修改文件：`assets/canvas-node-radius-fix.css`、`docs/progress-report.md`、`docs/feature-completion-checklist.md`、`docs/review-log.md`
- 验证方式：Docker 重新构建；浏览器刷新当前画布并读取 computed style；执行 `node --check server.js`、`node --check assets/home-carousel-inertia.js`、`scripts/smoke-frontend-routes.ps1`、`/api/health`。
- 验证结果：小地图背景为 `rgba(15, 23, 42, 0.38)`，遮罩为 `rgba(255, 255, 255, 0.14)`；聊天面板位置为 `x=24/y=96`，底部空隙为 `22px`，四角圆角为 `24px`；Docker 服务 `healthy`，前端路由 smoke 通过。
- 当前完成度：画布约 84%，部署护栏约 92%，前端人工验收继续进行中。
- 新发现问题：本轮未做移动端画布复核；聊天面板下移和底部留白仅作用于桌面端，移动端仍保持全屏不偏移。
- 未完成清单：用户肉眼确认当前两处截图、文本/视频节点视觉一致性、画布 JSON 导入/导出、本地文件夹授权、模板/图库继续人工测试。
- 下一轮建议：你刷新当前画布确认观感；如果 OK，继续后台 UI 弹窗/保存回显人工可测。
- 需要人工介入：确认小地图透明度、聊天浮动卡片位置、圆角和底部留白是否合适。

## 2026-06-24 画布用户中心标题颜色修复进度报告

- 分支：`codex/backend-platform`
- 完成内容：根据截图修复画布内用户中心侧栏标题过浅问题；确认问题来自侧栏继承浅色文字，而不是卡片结构；只追加侧栏范围内的标题颜色覆盖，保留卡片大小、圆角、阴影和布局不变。
- 修改文件：`assets/canvas-node-radius-fix.css`、`docs/progress-report.md`、`docs/feature-completion-checklist.md`、`docs/review-log.md`
- 验证方式：Docker 重新构建；临时浏览器页打开 `/canvas/project_1782292799148_7xqro748k?fontfix=1` 并点击用户中心；读取 `admin`、`算力余额`、`算力明细`、`兑换码`、`API 线路` 的 computed color；执行 `node --check server.js`、`node --check assets/home-carousel-inertia.js`、`scripts/smoke-frontend-routes.ps1`、`/api/health`。
- 验证结果：上述标题颜色均为 `rgb(24, 24, 27)`；Docker 服务已重新构建并启动；前端路由 smoke 通过，health 返回 `success: true`、`mode: mock`、`database: ok`。
- 当前完成度：画布约 85%，用户中心约 70%，部署护栏约 92%。
- 新发现问题：浏览器临时页可验证文字颜色，但用户当前原页面需要手动刷新后才能看到新 CSS。
- 未完成清单：用户中心算力明细展开、生成记录、头像保存；画布 JSON 导入/导出；模板/图库继续人工测试。
- 下一轮建议：你刷新当前画布，先确认用户中心标题颜色；如果 OK，继续后台 UI 保存回显和用户中心明细展开测试。
- 需要人工介入：刷新浏览器后肉眼确认颜色是否符合你要的统一深色。

## 2026-06-25 后台视觉与前后端人工可测进度报告

- 分支：`codex/backend-platform`
- 完成内容：新增今日目标计划文档；归档后台 10 个页面桌面截图；补齐 Dashboard 前端所需的 `userTotal` 等兼容字段；为模型使用统计补 `percent`，修复模型占比只显示 `%` 的问题；新增后台视觉补丁，统一卡片阴影、表格密度、标题字距、按钮密度；修复 API 线路操作列竖排撑高和任务监控提示词竖排问题。
- 修改文件：`server.js`、`index.html`、`assets/admin-visual-polish.css`、`docs/plans/2026-06-25-admin-frontend-backend-manual-test.md`、`docs/design-references/admin-2026-06-25/*.png`、`docs/progress-report.md`、`docs/feature-completion-checklist.md`、`docs/review-log.md`
- 验证方式：后台登录接口注入登录态后访问并截图 `/admin/dashboard`、`/admin/users`、`/admin/orders`、`/admin/logs`、`/admin/redeem-codes`、`/admin/api-providers`、`/admin/model-prices`、`/admin/generate-tasks`、`/admin/template-workflows`、`/admin/settings`；读取表格行高；调用 `/api/admin/dashboard` 检查 `userTotal` 与 `modelUsage.list[].percent`；执行 `node --check server.js`、`node --check assets/home-carousel-inertia.js`、`scripts/smoke-frontend-routes.ps1`、`scripts/smoke-api.ps1`、`/api/health`、`docker compose ps`。
- 验证结果：10 个后台页面均非空白；Dashboard 用户总数显示为 `1`，模型占比显示 `79% / 21%`；API 线路首行行高从约 `226px` 降到 `58px`；任务监控首行从约 `348px` 降到 `92px`，提示词改为单行省略；`node --check`、前端路由 smoke、API smoke、`/api/health` 均通过；Docker Desktop 当前未启动，`docker compose ps` 无法连接 daemon，需用户打开 Docker 后复核。
- 当前完成度：后台约 93%，后端平台护栏约 74%，前端人工验收约 80%，部署护栏约 92%。
- 新发现问题：本机启动日志在 PowerShell 读取时中文有乱码；模型价格页线路筛选项仍有重复，当前先作为数据/前端状态待优化项，不阻塞人工测试。
- 未完成清单：Docker Desktop 当前需重新确认运行状态；后台保存类操作仍需你手动点测；前端首页、模板、图库、画布、用户中心还需要继续逐页人工反馈。
- 下一轮建议：你从后台 10 页按按钮/弹窗/保存回显测试；我继续修真实点击中发现的问题，然后再转模板/图库闭环。
- 需要人工介入：打开 Docker Desktop 后复核容器状态；人工点测后台保存、删除、弹窗关闭和前端主流程。

## 2026-06-25 后台保存回显与模型价格筛选修复进度报告

- 分支：`codex/backend-platform`
- 完成内容：使用临时端口和一次性 SQLite 数据库执行 `scripts/smoke-admin-write.ps1`，覆盖后台用户状态/余额/安全/重置/删除恢复、订单状态、兑换码、API 线路、模型价格、模板工作流、系统设置写入链路；修复 `/api/admin/model-prices` 返回结构，让前端筛选读取线路分组，模型行继续通过 `models/prices/rows` 返回；重新归档模型价格页截图。
- 修改文件：`server.js`、`docs/design-references/admin-2026-06-25/model-prices-desktop-1440x900.png`、`docs/progress-report.md`、`docs/feature-completion-checklist.md`、`docs/review-log.md`
- 验证方式：临时服务 `http://127.0.0.1:4594` + `SMOKE_ALLOW_WRITES=true` 跑 `scripts/smoke-admin-write.ps1`；本机服务检查 `/api/admin/model-prices`；Edge 截图复核 `/admin/model-prices`；执行 `node --check server.js`、`node --check assets/home-carousel-inertia.js`、`scripts/smoke-frontend-routes.ps1`、`scripts/smoke-api.ps1`、`/api/health`、`docker compose ps`。
- 验证结果：后台写入 smoke 通过且未污染当前 3456 数据库；`/api/admin/model-prices` 现在返回 `6` 条线路分组和 `37` 条模型行；模型价格页筛选按钮只剩 `全部模型、6789、comfly-google、comfly-openai-plus、RK、哈吉米、flowstudio`；固定 Node/前端路由/API/health 验证通过；Docker Desktop 未启动，`docker compose ps` 仍无法连接 daemon。
- 当前完成度：后台约 94%，后端平台护栏约 76%，前端人工验收约 81%，部署护栏约 92%。
- 新发现问题：常规 `scripts/smoke-api.ps1` 会在当前本地库留下测试用户、生成记录和兑换码；后续建议给它也增加一次性数据库运行模式，减少人工测试数据干扰。
- 未完成清单：Docker Desktop 打开后的容器复核；后台弹窗/保存按钮人工点击；模板真实上传闭环、图库删除/保存、用户中心明细/头像。
- 下一轮建议：优先把 `smoke-api` 改成可选临时库运行，随后继续模板/图库/用户中心人工闭环。
- 需要人工介入：打开 Docker Desktop 后让我复核；人工点测后台和前端主流程。

## 2026-06-25 API Smoke 一次性数据库护栏进度报告

- 分支：`codex/backend-platform`
- 完成内容：新增 `scripts/smoke-api-disposable.ps1`，自动用临时端口、临时 `DATA_DIR/DB_PATH/UPLOAD_DIR/LOG_DIR` 启动一次性 Node 服务，调用原有 `scripts/smoke-api.ps1`，跑完停止服务并清理临时目录；计划文档增加该验证命令。
- 修改文件：`scripts/smoke-api-disposable.ps1`、`docs/plans/2026-06-25-admin-frontend-backend-manual-test.md`、`docs/progress-report.md`、`docs/feature-completion-checklist.md`、`docs/review-log.md`
- 验证方式：执行 `scripts/smoke-api-disposable.ps1`；执行 `node --check server.js`、`node --check assets/home-carousel-inertia.js`、`scripts/smoke-frontend-routes.ps1`、`/api/health`、`docker compose ps`、`git status`。
- 验证结果：disposable API smoke 完整通过，覆盖登录、注册、项目保存、模板反推/生成、图库历史、后台 dashboard/users/orders/logs/redeem/api-providers/model-prices/generate-tasks/template-workflows/settings；本轮不再污染当前 `3456` 人工测试数据库；Node 检查、前端路由 smoke、health 均通过；Docker Desktop 未启动，`docker compose ps` 仍无法连接 daemon。
- 当前完成度：后台约 94%，测试护栏约 82%，前端人工验收约 81%，部署护栏约 92%。
- 新发现问题：旧版 `scripts/smoke-api.ps1` 仍会直接写当前目标服务；后续固定验证建议默认用 disposable 包装脚本，只有明确要测试当前服务写入时再用原脚本。
- 未完成清单：Docker Desktop 打开后的容器复核；模板真实上传闭环、图库删除/保存、用户中心明细/头像；后台人工弹窗点击。
- 下一轮建议：继续模板/图库/用户中心人工闭环，或打开 Docker 后先补容器健康复核。
- 需要人工介入：打开 Docker Desktop 后让我复核；人工点测前端主流程。

## 2026-06-25 前端主流程与用户中心真实数据桥接进度报告

- 分支：`codex/backend-platform`
- 完成内容：归档首页、首页图库、模板页、模板图库、模板工作区、用户中心、用户中心算力明细、兑换码、API 线路等前端桌面截图；确认用户中心 `/user/records` 和 `/user/redeem` 原来是打包前端写死的占位文案；新增轻量桥接脚本，只在用户中心记录页和兑换页运行，从现有后端读取真实生成记录、余额流水，并提供兑换码提交入口；不改画布卡片结构。
- 修改文件：`index.html`、`assets/user-center-data-bridge.js`、`docs/plans/2026-06-25-admin-frontend-backend-manual-test.md`、`docs/design-references/frontend-2026-06-25/*.png`、`docs/progress-report.md`、`docs/feature-completion-checklist.md`、`docs/review-log.md`
- 验证方式：浏览器注入管理员登录态后访问 `/user/records` 与 `/user/redeem` 并截图；检查页面文本包含 `真实记录`、`生成 N · 流水 N`、`兑换码提交`、`已接后端`；执行 `node --check server.js`、`node --check assets/home-carousel-inertia.js`、`node --check assets/user-center-data-bridge.js`、`scripts/smoke-frontend-routes.ps1`、`scripts/smoke-api-disposable.ps1`、`/api/health`、`docker compose ps`。
- 验证结果：用户中心记录页和兑换页桥接内容可见，浏览器 console 无页面错误；前端路由 smoke 通过；disposable API smoke 完整通过，覆盖登录、项目、模板生成、图库历史和后台接口；`/api/health` 返回 `success: true`、`mode: mock`、`database: ok`；Docker Desktop 当前未启动，`docker compose ps` 仍无法连接 daemon。
- 当前完成度：首页约 74%，模板约 82%，图库约 80%，用户中心约 78%，后台约 94%，后端平台护栏约 78%，部署护栏约 92%。
- 新发现问题：用户中心桌面端仍是窄移动式容器，不影响测试，但后续要做 1:1 桌面视觉时需要单独优化；兑换码接口可提交，成功/失败提示仍需你人工点一次确认手感。
- 未完成清单：Docker Desktop 打开后的容器复核；用户中心头像保存；图库删除/保存链接；模板真实上传素材后的完整闭环；后台弹窗和保存回显继续人工点测。
- 下一轮建议：先让你从 `/user/records`、`/user/redeem`、图库、模板工作区人工点一遍；发现真实问题后我继续小补丁修复，再转后台每页按钮/弹窗手感优化。
- 需要人工介入：打开 Docker Desktop 后复核容器；人工测试兑换码成功/失败、图库删除/保存、模板上传和后台保存按钮。

## 2026-06-25 图库删除持久化进度报告

- 分支：`codex/backend-platform`
- 完成内容：审计首页图库弹层按钮，确认原 `删除` 只会前端临时移除，刷新后记录恢复；新增 `/api/user/generations/:id` 和 `/api/user/generations` 删除接口；新增图库持久化桥接脚本，在图库弹层点击 `删除` 时根据图片链接/提示词同步删除后端记录；更新 API smoke 覆盖生成历史删除。
- 修改文件：`server.js`、`index.html`、`assets/gallery-persistence-bridge.js`、`scripts/smoke-api.ps1`、`docs/api-contracts.md`、`docs/design-references/frontend-2026-06-25/gallery-delete-persistent-desktop-1440x900.png`、`docs/progress-report.md`、`docs/feature-completion-checklist.md`、`docs/review-log.md`
- 验证方式：浏览器登录后打开首页图库，记录删除前后 API 数量和页面数量，刷新后再次打开图库；执行 `node --check server.js`、`node --check assets/gallery-persistence-bridge.js`、`node --check assets/user-center-data-bridge.js`、`scripts/smoke-api-disposable.ps1`。
- 验证结果：删除前 API 为 `4` 条、页面显示 `共 4 张`；点击删除后 API 为 `3` 条、页面显示 `共 3 张`；刷新后仍显示 `共 3 张`；浏览器 console 无页面错误；disposable API smoke 已通过并包含 `DELETE /api/user/generations/:id`。
- 当前完成度：图库约 84%，前端人工验收约 84%，后端平台护栏约 80%，测试护栏约 84%。
- 新发现问题：`保存链接` 仍需人工确认剪贴板/本地文件夹提示是否符合预期；`清空` 目前未做后端批量清空，暂不作为本轮默认行为，避免误删全部生成历史。
- 未完成清单：图库保存链接、多图和空状态；模板真实上传素材闭环；用户中心头像保存；后台弹窗和保存回显继续人工点测；Docker Desktop 打开后的容器复核。
- 下一轮建议：继续审计图库 `保存链接` 和模板上传生成闭环；如果你想保留批量清空，也需要增加二次确认和后端批量删除接口。
- 需要人工介入：人工点测图库保存链接和是否需要支持“清空”持久删除。

## 2026-06-25 图库保存链接与头像保存复核进度报告

- 分支：`codex/backend-platform`
- 完成内容：审计图库 `保存链接`、`保存全部链接` 和用户中心头像设置；补强图库桥接脚本，让单张保存复制当前图片链接，保存全部复制弹层内全部图片链接；验证用户中心随机头像按钮会调用后端头像接口并写回 profile。
- 修改文件：`assets/gallery-persistence-bridge.js`、`docs/design-references/frontend-2026-06-25/gallery-save-link-audit-desktop-1440x900.png`、`docs/design-references/frontend-2026-06-25/gallery-save-link-fixed-desktop-1440x900.png`、`docs/design-references/frontend-2026-06-25/user-avatar-audit-desktop-1440x900.png`、`docs/design-references/frontend-2026-06-25/user-avatar-random-desktop-1440x900.png`、`docs/progress-report.md`、`docs/feature-completion-checklist.md`、`docs/review-log.md`
- 验证方式：浏览器登录后打开首页图库，点击单张 `保存链接` 并读取剪贴板；点击 `保存全部链接` 并读取剪贴板行数；打开 `/user/center` 点击随机头像，前后请求 `/api/user/profile` 对比 `avatarUrl`。
- 验证结果：单张保存复制到图片 URL；保存全部复制 `3` 条图片链接；头像从 `/avatars/avatar-vip.svg` 写回为 `/avatars/avatar-2d.svg`；浏览器 console 无页面错误。
- 当前完成度：图库约 88%，用户中心约 82%，前端人工验收约 86%，后端平台护栏约 80%。
- 新发现问题：图库 `保存链接` 在 headless 浏览器复制到的是实际图片源，可能是本地 mock SVG 或外部 placeholder 链接，后续服务器部署时需确认图片 URL 可公网/内网访问；头像上传文件入口还未实测。
- 未完成清单：图库空状态恢复；模板真实上传素材闭环；用户中心头像上传；兑换码成功/失败提示；后台弹窗和保存回显继续人工点测；Docker Desktop 打开后的容器复核。
- 下一轮建议：继续模板真实上传生成闭环，随后补用户中心头像上传和兑换码提示手感。
- 需要人工介入：人工确认复制出来的链接形式是否符合你的实际保存习惯；打开 Docker Desktop 后复核容器。

## 2026-06-25 模板反推兼容与后台视觉复核进度报告

- 分支：`codex/backend-platform`
- 完成内容：补齐 `/api/template/reverse-prompt` 的打包前端兼容字段，新增 `rawText`、`prompts`、`items/list/data` 等别名，保留原有 `rawPrompt/suggestions`；重新归档后台 10 个页面桌面截图；对后台视觉补丁做小幅收敛，统一图标线宽、标题字重、按钮图标尺寸、表格密度，并把后台表格最小宽度从 `1180px` 调整为 `980px` 以适配 1440 桌面复核。
- 修改文件：`server.js`、`assets/admin-visual-polish.css`、`docs/api-contracts.md`、`docs/design-references/admin-2026-06-25/*.png`、`docs/design-references/frontend-2026-06-25/*.png`、`docs/progress-report.md`、`docs/feature-completion-checklist.md`、`docs/review-log.md`
- 验证方式：浏览器访问并截图 `/admin/dashboard`、`/admin/users`、`/admin/orders`、`/admin/logs`、`/admin/redeem-codes`、`/admin/api-providers`、`/admin/model-prices`、`/admin/generate-tasks`、`/admin/template-workflows`、`/admin/settings`；接口调用 `/api/template/reverse-prompt` 检查 `rawText/prompts`；复核 `/api/health`；执行固定 Node/API/前端 smoke 验证；执行 `docker compose -f docker-compose.internal.yml ps`。
- 验证结果：后台 10 页均非空白、非 404；复核截图已写入 `docs/design-references/admin-2026-06-25/`，Dashboard/API 线路/模板工作流已二次截图；模板反推接口已返回 `3` 条 prompt，并同时包含 `rawText` 与 `prompts`；`node --check`、前端路由 smoke、当前服务 API smoke、disposable API smoke、`/api/health` 均通过；Docker Desktop daemon 未运行，`docker compose ps` 报找不到 `dockerDesktopLinuxEngine` 管道。
- 当前完成度：首页约 74%，模板约 86%，图库约 88%，用户中心约 86%，后台约 95%，后端平台护栏约 81%，测试护栏约 84%，部署护栏约 92%。
- 新发现问题：模板页前端仍要求真实素材上传后才会显示提示词卡片；浏览器自动化的隐藏 file input 需要继续用标准文件选择器验证，当前接口层已修但完整上传生成 UI 闭环还要继续点测。Dashboard 右侧排行表在 1440 截图下仍略宽，已记录为后续视觉细化项。
- 未完成清单：模板真实上传后生成闭环；兑换码成功/失败提示；后台弹窗关闭、删除/恢复确认；Docker 容器状态在 Docker Desktop 打开后复核。
- 下一轮建议：优先用人工或浏览器文件选择器完成模板“上传素材 -> 反推提示词 -> 生成图片 -> 图库历史”闭环；随后继续后台保存/弹窗手感逐页点测。
- 需要人工介入：你手动上传一张图片到模板页看提示词卡片是否出现；打开 Docker Desktop 后我再复核 compose 容器。

## 2026-06-25 模板真实上传生成闭环进度报告

- 分支：`codex/backend-platform`
- 完成内容：补强 `scripts/smoke-api.ps1`，增加 `/api/template/reverse-prompt` 的 `rawText/prompts` 兼容字段断言；使用独立 Playwright CLI 会话验证模板页真实文件上传，完成“上传参考图 + 产品图 -> 反推 3 条提示词 -> 生成 1 张 mock 图片 -> 写入图库历史”的闭环；归档模板完整生成截图。
- 修改文件：`scripts/smoke-api.ps1`、`docs/design-references/frontend-2026-06-25/template-upload-generate-complete-desktop-1440x900.png`、`docs/progress-report.md`、`docs/feature-completion-checklist.md`、`docs/review-log.md`
- 验证方式：执行 `scripts/smoke-api-disposable.ps1`；Playwright CLI 打开 `/template-image`，上传 `logo.png` 到参考图和产品图槽位，填写提示词，点击 `反推提示词` 和 `生成图片`；读取 Playwright requests、console、页面 snapshot；调用 `/api/user/generations` 确认生成历史；执行固定 Node/前端路由/API/health/Docker 状态检查。
- 验证结果：上传后页面显示参考图 `1/12`、产品图 `1/12`、生成设置 `2 张素材`；反推后显示 `提示词选择 3 条` 且请求 `/api/template/reverse-prompt` 为 200；生成后页面显示 `已完成`、`当前 1 张`、`1 个已完成`，请求 `/api/template/generate-image` 为 200；`/api/user/generations` 最新记录为本次生成的 mock 图片；Playwright console 无 warning/error；`node --check`、前端路由 smoke、当前服务 API smoke、disposable API smoke 和 `/api/health` 均通过；Docker Desktop daemon 未运行，`docker compose ps` 仍报找不到 `dockerDesktopLinuxEngine` 管道。
- 当前完成度：首页约 74%，模板约 91%，图库约 88%，用户中心约 86%，后台约 95%，后端平台护栏约 81%，测试护栏约 86%，部署护栏约 92%。
- 新发现问题：独立 Playwright 会话里 `auth_user` 被 PowerShell 引号转义影响，顶部仍显示 `登录`，但 `auth_token` 有效，接口调用和生成闭环不受影响；这说明后续 CLI 自动化需要专门写一个小脚本处理登录态，避免命令行引号问题。
- 未完成清单：后台弹窗关闭、删除/恢复确认；兑换码成功/失败提示；首页/画布/用户中心移动端复核；Docker 容器状态在 Docker Desktop 打开后复核。
- 下一轮建议：先做后台保存/弹窗逐页手感复核，再补兑换码提示和移动端关键页面截图。
- 需要人工介入：你用真实浏览器再点一次模板上传生成手感；打开 Docker Desktop 后我复核 compose 容器。

## 2026-06-25 后台内置浏览器截图与交互 Smoke 进度报告

- 分支：`codex/backend-platform`
- 完成内容：使用 Codex 内置浏览器重新归档后台 10 个页面桌面截图；新增后台 UI smoke 脚本和 runner，自动登录管理员、访问 Dashboard/系统设置/API 线路/兑换码/模板工作流，验证保存按钮、弹窗打开和关键表单可见，并归档交互截图。
- 修改文件：`scripts/smoke-admin-ui.ps1`、`scripts/smoke-admin-ui-runner.js`、`docs/design-references/admin-2026-06-25/*.png`、`docs/progress-report.md`、`docs/feature-completion-checklist.md`、`docs/review-log.md`、`docs/plans/2026-06-25-admin-frontend-backend-manual-test.md`
- 验证方式：内置浏览器截图 `/admin/dashboard`、`/admin/users`、`/admin/orders`、`/admin/logs`、`/admin/redeem-codes`、`/admin/api-providers`、`/admin/model-prices`、`/admin/generate-tasks`、`/admin/template-workflows`、`/admin/settings`；执行 `scripts/smoke-admin-ui.ps1`。
- 验证结果：后台 10 页均非空白、非 404、非 500；`scripts/smoke-admin-ui.ps1` 通过，验证系统设置保存、API 线路新增弹窗、兑换码创建弹窗、模板工作流保存，并生成 5 张交互截图；API 线路和兑换码弹窗视觉可读，按钮层级清晰。
- 当前完成度：首页约 74%，模板约 91%，图库约 88%，用户中心约 86%，后台约 96%，后端平台护栏约 81%，测试护栏约 88%，部署护栏约 92%。
- 新发现问题：后台整体可测，但 Dashboard 右侧排行表在 1440 截图下仍略挤；后台删除/恢复确认还没全部纳入自动化；Docker Desktop 当前仍需打开后复核 compose 状态。
- 未完成清单：后台删除/恢复确认；兑换码成功/失败提示；首页/画布/用户中心移动端复核；Docker 容器状态复核；New-API 真实 token 后续接入。
- 下一轮建议：继续后台删除/恢复和用户中心兑换码提示手感；然后做移动端关键页面截图。
- 需要人工介入：你人工点测后台删除/恢复是否符合预期；打开 Docker Desktop 后复核容器。

## 2026-06-25 后台写入 Disposable Smoke 进度报告

- 分支：`codex/backend-platform`
- 完成内容：新增 `scripts/smoke-admin-write-disposable.ps1`，在临时端口、临时 SQLite、临时 uploads/logs 下运行后台写入 smoke，并自动设置 `SMOKE_ALLOW_WRITES=true`；跑完停止临时服务并清理临时目录，避免污染当前 `3456` 人工测试数据。
- 修改文件：`scripts/smoke-admin-write-disposable.ps1`、`docs/plans/2026-06-25-admin-frontend-backend-manual-test.md`、`docs/progress-report.md`、`docs/feature-completion-checklist.md`、`docs/review-log.md`
- 验证方式：执行 `powershell -NoProfile -ExecutionPolicy Bypass -File scripts\smoke-admin-write-disposable.ps1`。
- 验证结果：临时库后台写入 smoke 通过，覆盖管理员登录、注册测试用户、用户禁用、余额调整、安全检查、重置密码、软删除、回收站恢复、永久匿名化、订单关闭、兑换码创建/删除、API 线路创建/更新/测试/拉模型/设默认/删除、线路模型创建/更新/禁用/删除、模板工作流保存、系统设置保存。
- 当前完成度：首页约 74%，模板约 91%，图库约 88%，用户中心约 86%，后台约 97%，后端平台护栏约 82%，测试护栏约 90%，部署护栏约 92%。
- 新发现问题：后台删除/恢复的后端路径已经有一次性库保护验证，但前端确认弹窗和手感仍需要人工点测；原 `scripts/smoke-admin-write.ps1` 仍保持默认拒绝写入，避免误跑当前人工库。
- 未完成清单：后台删除/恢复前端确认弹窗；兑换码成功/失败提示；移动端关键页面截图；Docker 容器状态复核；New-API 真实 token 后续接入。
- 下一轮建议：用内置浏览器补后台删除/恢复前端确认弹窗截图，随后补用户中心兑换码成功/失败提示。
- 需要人工介入：打开 Docker Desktop 后复核容器；人工确认后台删除/恢复交互是否符合预期。

## 2026-06-25 用户中心兑换码与后台删除恢复 UI Smoke 进度报告

- 分支：`codex/backend-platform`
- 完成内容：新增用户中心兑换码 UI smoke，自动创建一次性兑换码，验证 `/user/redeem` 错误码红色提示和有效码绿色成功提示，并截图归档；新增后台删除/恢复 UI smoke，自动创建临时用户，验证删除确认弹窗、回收站行、恢复成功提示，并在结束后清理临时用户。
- 修改文件：`scripts/smoke-user-redeem-ui.ps1`、`scripts/smoke-user-redeem-ui-runner.js`、`scripts/smoke-admin-delete-ui.ps1`、`scripts/smoke-admin-delete-ui-runner.js`、`docs/design-references/frontend-2026-06-25/*.png`、`docs/design-references/admin-2026-06-25/*.png`、`docs/progress-report.md`、`docs/feature-completion-checklist.md`、`docs/review-log.md`、`docs/plans/2026-06-25-admin-frontend-backend-manual-test.md`
- 验证方式：执行 `scripts\smoke-user-redeem-ui.ps1` 和 `scripts\smoke-admin-delete-ui.ps1`；人工查看截图 `user-redeem-invalid/success`、`admin-user-delete-confirm`、`admin-user-recycle-row`、`admin-user-restore-complete`。
- 验证结果：用户中心兑换码错误提示显示 `兑换码不存在`，成功提示显示 `兑换成功，增加 3 算力`；后台删除确认弹窗可见管理员密码和删除原因，确认后用户进入回收站，点击恢复后显示 `用户已恢复` 且回收站为空；临时用户最终通过 API 清理。
- 当前完成度：首页约 74%，模板约 91%，图库约 88%，用户中心约 88%，后台约 98%，后端平台护栏约 82%，测试护栏约 92%，部署护栏约 92%。
- 新发现问题：用户中心桌面仍是窄移动式容器，可测但不是最终 1:1 桌面布局；后台用户列表在 1440 视口下操作列较密，仍可后续细化。
- 未完成清单：移动端关键页面截图；Dashboard 排行表宽度细化；Docker 容器状态复核；New-API 真实 token 后续接入。
- 下一轮建议：继续移动端首页/模板/用户中心/后台截图复核，随后补 Dashboard 表格宽度细化。
- 需要人工介入：打开 Docker Desktop 后复核容器；人工确认用户中心兑换码和后台删除恢复手感是否符合预期。

## 2026-06-25 移动端关键页面截图 Smoke 进度报告

- 分支：`codex/backend-platform`
- 完成内容：新增 `scripts/smoke-mobile-ui.ps1` 和 runner，使用 390x844 视口截图复核首页、模板、画布、用户中心兑换码、后台 Dashboard、后台 API 线路、后台模板工作流；修复首页移动端标题字号，避免 `电商全流程工作台` 在 390 宽下断成单字。
- 修改文件：`assets/home-overrides.css`、`scripts/smoke-mobile-ui.ps1`、`scripts/smoke-mobile-ui-runner.js`、`docs/design-references/mobile-2026-06-25/*.png`、`docs/progress-report.md`、`docs/feature-completion-checklist.md`、`docs/review-log.md`、`docs/plans/2026-06-25-admin-frontend-backend-manual-test.md`
- 验证方式：执行 `scripts\smoke-mobile-ui.ps1`；人工查看 `home-mobile-390x844.png`、`template-image-mobile-390x844.png`、`canvas-mobile-390x844.png`、`admin-dashboard-mobile-390x844.png`、`admin-api-providers-mobile-390x844.png`、`user-redeem-mobile-390x844.png`。
- 验证结果：移动端 7 个关键页面均非空白、非 404、非 500；首页标题已单行显示；模板页、画布页、用户中心兑换码、后台 Dashboard/API 线路/模板工作流均可见核心内容。
- 当前完成度：首页约 78%，模板约 92%，图库约 88%，用户中心约 88%，后台约 98%，后端平台护栏约 82%，测试护栏约 94%，部署护栏约 92%。
- 新发现问题：后台移动端表格仍偏密，API 线路页默认只露出前两列，需要横向滚动；画布移动端会显示本地保存提示，属于当前“画布走本地”的既定策略。
- 未完成清单：Dashboard 右侧排行表宽度细化；后台移动端表格密度继续优化；Docker 容器状态复核；New-API 真实 token 后续接入。
- 下一轮建议：细化后台 Dashboard 排行表和移动端表格密度，或打开 Docker Desktop 后先完成容器复核。
- 需要人工介入：打开 Docker Desktop 后复核容器；人工确认移动端首页、模板、画布和后台表格观感是否接受。

## 2026-06-25 后台截图复跑与表格视觉修复进度报告

- 分支：`codex/backend-platform`
- 完成内容：确认 Codex 内置浏览器和 Playwright CLI 都可用于后台验收；重新跑通后台主交互截图、后台删除/恢复截图和移动端截图；修复后台 Dashboard 右侧用户消费排行表被全局表格宽度裁切的问题；优化移动端后台表格密度；修复后台删除/恢复 UI smoke 因列表刷新导致按钮 DOM 替换后点击不稳定的问题。
- 修改文件：`assets/admin-visual-polish.css`、`scripts/smoke-admin-delete-ui-runner.js`、`docs/design-references/admin-2026-06-25/*.png`、`docs/design-references/mobile-2026-06-25/*.png`、`docs/progress-report.md`、`docs/feature-completion-checklist.md`、`docs/review-log.md`
- 验证方式：执行 `scripts\smoke-admin-ui.ps1`、`scripts\smoke-admin-delete-ui.ps1`、`scripts\smoke-mobile-ui.ps1`；使用内置浏览器打开 `/admin/dashboard` 和 `/admin/api-providers` 抽查 DOM、按钮尺寸、表格宽度和 console error。
- 验证结果：后台主截图通过，覆盖 Dashboard、系统设置保存、API 线路新增弹窗、兑换码创建弹窗、模板工作流保存；后台删除/恢复截图通过，覆盖删除确认、回收站行和恢复成功；移动端 7 页截图通过；内置浏览器抽查 API 线路页 console error 为 0；Dashboard 用户排行表已不再被右侧裁切。
- 当前完成度：首页约 78%，模板约 92%，图库约 88%，用户中心约 88%，后台约 99%，后端平台护栏约 82%，测试护栏约 95%，部署护栏约 92%。
- 新发现问题：移动端后台表格仍是横向表格形态，已经比之前可读，但如果追更高体验，后续可以单独做移动端卡片化；Playwright 脚本不能并行复用同一个 session，否则会互相抢页面，需要后续保持串行或使用不同 session。
- 未完成清单：Docker 容器状态复核；New-API 真实 token 后续接入；图库多图和空状态恢复；后台移动端是否卡片化待人工确认。
- 下一轮建议：先让你人工看后台截图和移动端截图；如果视觉接受，继续补图库多图/空状态和 Docker 容器复核。
- 需要人工介入：打开 Docker Desktop 后复核容器；人工确认后台移动端表格是否先接受横向滚动方案。

## 2026-06-25 图库多图与空状态 Smoke 进度报告

- 分支：`codex/backend-platform`
- 完成内容：新增图库 UI smoke，自动注册临时用户、生成 2 张 mock 图片、打开首页图库、验证多图展示、验证 `保存全部链接` 写入 2 条链接、删除后重新打开图库验证 `共 0 张` 空状态；修复图库历史模块登录态下只追加后端记录、不清理本地旧生成记录的问题，避免后端删除后刷新仍复活旧图。
- 修改文件：`assets/imageHistory-CG2zEefe.js`、`assets/imageHistory-s5iwPTNE.js`、`scripts/smoke-gallery-ui.ps1`、`scripts/smoke-gallery-ui-runner.js`、`docs/design-references/frontend-2026-06-25/gallery-multi-state-desktop-1440x900.png`、`docs/design-references/frontend-2026-06-25/gallery-empty-state-desktop-1440x900.png`、`docs/progress-report.md`、`docs/feature-completion-checklist.md`、`docs/review-log.md`
- 验证方式：执行 `scripts\smoke-gallery-ui.ps1`；人工查看 `gallery-multi-state-desktop-1440x900.png` 和 `gallery-empty-state-desktop-1440x900.png`；执行相关 JS 语法检查。
- 验证结果：图库弹窗多图状态显示 `共 2 张`，两张图片卡片可见；`保存全部链接` 捕获到 2 条链接；删除后 API 记录为 0，重新打开图库显示 `共 0 张` 和 `还没有图片生成历史`；临时用户在 smoke 结束后清理。
- 当前完成度：首页约 78%，模板约 92%，图库约 92%，用户中心约 88%，后台约 99%，后端平台护栏约 82%，测试护栏约 96%，部署护栏约 92%。
- 新发现问题：图库空状态弹窗宽度和按钮仍沿用原站弹窗结构，功能可测；如果后续要追更细视觉，可再统一空状态图标和按钮禁用态。
- 未完成清单：Docker 容器状态复核；New-API 真实 token 后续接入；移动端图库多图/空状态可后续补截图；后台移动端表格是否卡片化待人工确认。
- 下一轮建议：继续补移动端图库 smoke，或打开 Docker Desktop 后先完成容器复核。
- 需要人工介入：打开 Docker Desktop 后复核容器；人工确认图库空状态视觉是否先接受。

## 2026-06-25 移动端图库入口与截图 Smoke 进度报告

- 分支：`codex/backend-platform`
- 完成内容：补齐首页移动端图库入口；在 `gallery-persistence-bridge.js` 增加只在移动端首页显示的轻量图库按钮和弹窗，复用 `/api/user/generations` 后端历史，不影响桌面原图库弹层；扩展图库 UI smoke，覆盖桌面多图、移动端多图、移动端空状态和桌面空状态。
- 修改文件：`assets/gallery-persistence-bridge.js`、`scripts/smoke-gallery-ui.ps1`、`scripts/smoke-gallery-ui-runner.js`、`docs/design-references/mobile-2026-06-25/gallery-multi-mobile-390x844.png`、`docs/design-references/mobile-2026-06-25/gallery-empty-mobile-390x844.png`、`docs/progress-report.md`、`docs/feature-completion-checklist.md`、`docs/review-log.md`
- 验证方式：执行 `scripts\smoke-gallery-ui.ps1`；人工查看 `gallery-multi-mobile-390x844.png` 和 `gallery-empty-mobile-390x844.png`；执行 JS 语法检查和固定路由/API 验证。
- 验证结果：390x844 下首页出现 `图库` 入口；点击后移动端弹窗显示 `图片生成历史`、`共 2 张` 和图片卡片；删除后重新打开显示 `共 0 张` 和 `还没有图片生成历史`；桌面图库路径仍通过。
- 当前完成度：首页约 79%，模板约 92%，图库约 94%，用户中心约 88%，后台约 99%，后端平台护栏约 82%，测试护栏约 97%，部署护栏约 92%。
- 新发现问题：移动端图库入口是轻量桥接按钮，视觉可测但还不是原站级底部导航；后续如追 1:1，可再统一移动端导航体系。
- 未完成清单：Docker 容器状态复核；New-API 真实 token 后续接入；后台移动端表格是否卡片化待人工确认；画布 JSON 导入/导出长流程。
- 下一轮建议：打开 Docker Desktop 后优先完成容器复核；或继续补画布 JSON 导入/导出 smoke。
- 需要人工介入：打开 Docker Desktop 后复核容器；人工确认移动端图库入口位置是否接受。

## 2026-06-25 后台全页截图复跑进度报告

- 分支：`codex/backend-platform`
- 完成内容：回应“后台截图未跑通”的复核要求，使用 Playwright 重新跑通后台 10 个页面桌面截图：Dashboard、用户、订单、日志、兑换码、API 线路、模型价格、任务监控、模板工作流、系统设置。
- 修改文件：`docs/progress-report.md`、`docs/review-log.md`
- 验证方式：执行 `powershell -NoProfile -ExecutionPolicy Bypass -File scripts\smoke-admin-pages-ui.ps1`。
- 验证结果：10 个后台页面全部 `ok:true`；截图已写入 `docs/design-references/admin-2026-06-25/full-*.png`；脚本读取到标题颜色统一为 `rgb(2, 6, 23)`，标题字重统一为 `900`；当前页面未出现 404/500。
- 当前完成度：首页约 79%，模板约 92%，图库约 94%，用户中心约 88%，后台约 99%，后端平台护栏约 82%，测试护栏约 99%，部署护栏约 93%。
- 新发现问题：后台截图能自动跑通，但视觉是否“完全舒服”仍要人工看图确认；移动端后台表格是否卡片化仍待决定。
- 未完成清单：Docker 容器状态复核；New-API 真实 token 后续接入；后台移动端表格是否卡片化待人工确认。
- 下一轮建议：继续用内置浏览器/Playwright 逐页看后台截图，优先修标题、按钮、图标、字距和表格密度中肉眼最明显的问题。
- 需要人工介入：你人工看一遍 `docs/design-references/admin-2026-06-25/full-*.png`，确认后台视觉先按当前版本进入人工测试。

## 2026-06-25 后台操作列视觉优化进度报告

- 分支：`codex/backend-platform`
- 完成内容：逐页查看后台截图后，修复用户管理、API 线路、模型价格等宽表右侧操作按钮被挤出画面的问题；后台含表格卡片增加横向滚动保护，操作列固定在右侧并允许按钮在列内换行，避免人工测试时看不到关键操作。
- 修改文件：`assets/admin-visual-polish.css`、`docs/design-references/admin-2026-06-25/full-*.png`、`docs/progress-report.md`、`docs/feature-completion-checklist.md`、`docs/review-log.md`
- 验证方式：执行 `scripts\smoke-admin-pages-ui.ps1`、`scripts\smoke-frontend-routes.ps1`、`scripts\smoke-api.ps1`、`node --check server.js`、`node --check assets\home-carousel-inertia.js`、`Invoke-RestMethod http://127.0.0.1:3456/api/health`、`docker compose -f docker-compose.internal.yml ps`。
- 验证结果：后台 10 页截图全部 `ok:true`；前端路由 smoke 通过；API smoke 通过；`/api/health` 返回 `success:true`、`mode:mock`、`database:ok`；两个 JS 语法检查通过；Docker 检查失败，原因是 Docker Desktop daemon 未运行。
- 当前完成度：首页约 79%，模板约 92%，图库约 94%，用户中心约 88%，后台约 99%，后端平台护栏约 82%，测试护栏约 99%，部署护栏约 93%。
- 新发现问题：操作列完整性已改善，但用户管理/API 线路这类多按钮表格行高会增加；如果后续追更精细体验，应把多操作收进“更多”菜单或详情抽屉。
- 未完成清单：Docker 容器状态复核；New-API 真实 token 后续接入；后台多操作菜单化；后台移动端表格是否卡片化待人工确认。
- 下一轮建议：先让你人工看后台截图，如果接受则进入前端主流程人工测试；如果觉得行高偏大，再优先做后台“更多操作”菜单。
- 需要人工介入：打开 Docker Desktop 后复核容器；人工确认后台多按钮表格当前行高是否接受。

## 2026-06-25 用户中心桌面布局与 UI 预检进度报告

- 分支：`codex/backend-platform`
- 完成内容：修复用户中心桌面端仍是窄手机壳的问题；在 `/user/*` 桌面视口启用 980px 两栏工作台布局，移动端保持原 390px 单栏；增加头像破图兜底，避免人工测试时出现浏览器破图标；新增用户中心布局 UI smoke，并接入 `SMOKE_UI=true` 预检。
- 修改文件：`assets/user-center-data-bridge.js`、`scripts/smoke-user-center-layout-ui.ps1`、`scripts/smoke-user-center-layout-ui-runner.js`、`scripts/preflight-check.ps1`、`scripts/verify-internal-deploy.ps1`、`docs/deployment.md`、`docs/iteration-review-checklist.md`、`docs/design-references/frontend-2026-06-25/user-center-desktop-1440x900.png`、`docs/design-references/frontend-2026-06-25/user-records-bridge-desktop-1440x900.png`、`docs/design-references/frontend-2026-06-25/user-redeem-bridge-desktop-1440x900.png`、`docs/design-references/mobile-2026-06-25/user-center-mobile-390x844.png`、`docs/progress-report.md`、`docs/feature-completion-checklist.md`、`docs/review-log.md`
- 验证方式：执行 `node --check assets\user-center-data-bridge.js`、`node --check scripts\smoke-user-center-layout-ui-runner.js`、`scripts\smoke-user-center-layout-ui.ps1`、`SMOKE_UI=true scripts\preflight-check.ps1`。
- 验证结果：用户中心布局 smoke 通过；桌面 `/user/center`、`/user/records`、`/user/redeem` 外壳宽度为 980px 且主区域为 grid 两栏；移动端 `/user/center` 外壳宽度为 390px 且仍为单栏；`SMOKE_UI=true` 预检通过，覆盖后台 10 页截图、画布 JSON 导入和用户中心布局。
- 当前完成度：首页约 79%，模板约 92%，图库约 94%，用户中心约 92%，后台约 99%，后端平台护栏约 82%，测试护栏约 99%，部署护栏约 93%。
- 新发现问题：用户中心桌面已可测，但头像兜底目前是隐藏坏图，若要更精致可后续补文字头像或默认图；`SMOKE_UI=true` 会更新截图文件，运行时应避免和其他 Playwright session 并行抢页面。
- 未完成清单：Docker 容器状态复核；New-API 真实 token 后续接入；用户中心默认头像视觉；后台多操作菜单化；后台移动端表格是否卡片化待人工确认。
- 下一轮建议：继续人工点测首页、模板、图库、画布、用户中心主流程；如果 Docker Desktop 已打开，优先跑容器复核。
- 需要人工介入：确认用户中心桌面两栏布局是否接受；打开 Docker Desktop 后复核容器。

## 2026-06-25 用户中心默认头像兜底进度报告

- 分支：`codex/backend-platform`
- 完成内容：把用户中心头像破图兜底从“隐藏坏图”升级为默认文字头像；当头像图片加载失败时，自动显示用户首字母，例如 `admin` 显示 `A`，桌面和移动端一致。
- 修改文件：`assets/user-center-data-bridge.js`、`scripts/smoke-user-center-layout-ui-runner.js`、`docs/design-references/frontend-2026-06-25/user-center-desktop-1440x900.png`、`docs/design-references/mobile-2026-06-25/user-center-mobile-390x844.png`、`docs/progress-report.md`、`docs/feature-completion-checklist.md`、`docs/review-log.md`
- 验证方式：执行 `node --check assets\user-center-data-bridge.js`、`node --check scripts\smoke-user-center-layout-ui-runner.js`、`scripts\smoke-user-center-layout-ui.ps1`，并人工查看桌面和移动端截图。
- 验证结果：用户中心布局 smoke 通过；检测到 broken image 时 `avatarFallbacks=1`；桌面和移动端截图均显示默认首字母头像，不再出现浏览器破图标或空白头像。
- 当前完成度：首页约 79%，模板约 92%，图库约 94%，用户中心约 93%，后台约 99%，后端平台护栏约 82%，测试护栏约 99%，部署护栏约 93%。
- 新发现问题：默认头像已可测；后续如果追品牌一致性，可以换成统一头像素材或用户上传默认图。
- 未完成清单：Docker 容器状态复核；New-API 真实 token 后续接入；后台多操作菜单化；后台移动端表格是否卡片化待人工确认。
- 下一轮建议：继续人工点测首页、模板、图库、画布、用户中心主流程；如果 Docker Desktop 已打开，优先跑容器复核。
- 需要人工介入：确认默认首字母头像视觉是否接受；打开 Docker Desktop 后复核容器。

## 2026-06-25 内置浏览器后台截图与 Docker daemon 复核进度报告

- 分支：`codex/backend-platform`
- 完成内容：使用内置浏览器重新登录后台并逐页打开 Dashboard、用户、订单、日志、兑换码、API 线路、模型价格、任务监控、模板工作流、系统设置，生成 10 张 `manual-audit-*.png` 桌面截图；同时复核 Docker 内网部署验证脚本，增加 `docker info` 检查，使 Docker Desktop daemon 未启动时能在第一阶段明确失败。
- 修改文件：`scripts/verify-internal-deploy.ps1`、`docs/deployment.md`、`docs/design-references/admin-2026-06-25/manual-audit-*.png`、`docs/progress-report.md`、`docs/feature-completion-checklist.md`、`docs/review-log.md`
- 验证方式：内置浏览器 1440x900 逐页截图；执行 `docker --version`、`docker compose version`、`docker compose -f docker-compose.internal.yml ps`、`powershell -NoProfile -ExecutionPolicy Bypass -File scripts\verify-internal-deploy.ps1`。
- 验证结果：后台 10 页均生成截图，页面非空白、非 404，console error 为 0；兑换码页文本检测命中 `500`，需人工看图确认是积分数值不是错误页；`docker --version` 返回 29.5.3，`docker compose version` 返回 v5.1.4；`verify-internal-deploy.ps1` 在 `docker available` 阶段输出 Client 信息后，Server 连接失败：`failed to connect to the docker API at npipe:////./pipe/dockerDesktopLinuxEngine`，结论是 Docker CLI/Compose 可用，但 Docker Desktop daemon 未运行。
- 当前完成度：首页约 79%，模板约 92%，图库约 94%，用户中心约 93%，后台约 99%，后端平台护栏约 82%，测试护栏约 99%，部署护栏约 93%。
- 新发现问题：当前机器 Docker Desktop Engine 未启动，无法执行镜像构建、容器启动、重启持久化复核；后台兑换码页的自动文本检测需要人工看图确认。
- 未完成清单：启动 Docker Desktop 后重新执行 `scripts\verify-internal-deploy.ps1`；New-API 真实 token 后续接入；后台多操作菜单化；后台移动端表格是否卡片化待人工确认。
- 下一轮建议：你打开 Docker Desktop 后，我优先跑完整 Docker 内网部署验证；如果暂时不跑 Docker，则继续前端主流程人工测试修复。
- 需要人工介入：打开 Docker Desktop，等待 Engine running；人工看一眼后台 10 张 `manual-audit` 截图是否接受。

## 2026-06-25 后台主按钮颜色修复进度报告

- 分支：`codex/backend-platform`
- 完成内容：根据截图反馈修复后台系统设置页 `保存设置`、`保存工具设置` 等 Naive primary 按钮颜色；先压掉默认亮薄荷绿黑字，再按反馈调成更清新的 emerald 绿白字，hover、pressed、focus、边框和阴影统一到后台工具台风格；只改后台作用域 CSS，不影响画布卡片结构和首页/模板页。
- 修改文件：`assets/admin-visual-polish.css`、`docs/design-references/admin-2026-06-25/settings-button-fresh-green-desktop-1440x900.png`、`docs/progress-report.md`、`docs/feature-completion-checklist.md`、`docs/review-log.md`
- 验证方式：内置浏览器打开 `/admin/settings`，读取 `保存设置` 和 `保存工具设置` 的 computed style，并截图归档；执行 `scripts\smoke-frontend-routes.ps1`、`node --check server.js`、`node --check assets\home-carousel-inertia.js`、`Invoke-RestMethod http://127.0.0.1:3456/api/health`。
- 验证结果：按钮文字颜色为 `rgb(255, 255, 255)`，边框为 `rgba(16, 185, 129, 0.95)`，截图 `settings-button-fresh-green-desktop-1440x900.png` 已归档；基础前端路由和健康检查继续通过。
- 当前完成度：首页约 79%，模板约 92%，图库约 94%，用户中心约 93%，后台约 99%，后端平台护栏约 82%，测试护栏约 99%，部署护栏约 93%。
- 新发现问题：Naive UI primary 按钮 computed `background-color` 读取为透明，实际背景来自按钮内部样式层；已通过截图和文字/边框/阴影验证视觉生效。
- 未完成清单：后台更多页面继续逐页肉眼优化；Docker Desktop Engine 启动后的容器复核；New-API 真实 token 后续接入。
- 下一轮建议：继续按截图逐页看后台按钮和表格细节，优先修肉眼突兀的颜色、行高和标题层级。
- 需要人工介入：你确认新的清新绿色按钮是否接受。

## 2026-06-25 后台用户表格操作列修复进度报告

- 分支：`codex/backend-platform`
- 完成内容：根据后台用户管理截图继续做视觉复核；修复右侧 sticky 操作列白色遮罩过重、割裂日期列的问题；把操作列宽度从 240px 收到 226px，阴影从大片白雾改为轻边线和小阴影，同时把表格按钮高度从 28px 压到 26px，减少多按钮行高压力。
- 修改文件：`assets/admin-visual-polish.css`、`docs/design-references/admin-2026-06-25/users-action-column-polish-desktop-1440x900.png`、`docs/progress-report.md`、`docs/feature-completion-checklist.md`、`docs/review-log.md`
- 验证方式：内置浏览器打开 `/admin/users`，读取首个操作列 computed style，并截图归档；执行 `scripts\smoke-frontend-routes.ps1`、`node --check server.js`、`node --check assets\home-carousel-inertia.js`、`Invoke-RestMethod http://127.0.0.1:3456/api/health`。
- 验证结果：操作列宽度为 226px，阴影为 `rgba(248, 250, 252, 0.58) -6px 0px 14px`，按钮高度为 26px；截图 `users-action-column-polish-desktop-1440x900.png` 已归档；基础路由和健康检查通过。
- 当前完成度：首页约 79%，模板约 92%，图库约 94%，用户中心约 93%，后台约 99%，后端平台护栏约 82%，测试护栏约 99%，部署护栏约 93%。
- 新发现问题：用户管理仍是宽表，注册时间/最后登录等列会因为信息密度被截断；现阶段先保证可人工测试，后续如要更舒服，应把多操作收进“更多”菜单或详情抽屉。
- 未完成清单：后台其他宽表继续逐页肉眼复核；Docker Desktop Engine 启动后的容器复核；New-API 真实 token 后续接入。
- 下一轮建议：继续复核 API 线路和模型价格两张宽表，优先处理遮挡、按钮密度和标题层级。
- 需要人工介入：确认用户管理操作列现在是否接受。
