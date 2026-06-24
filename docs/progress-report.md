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
