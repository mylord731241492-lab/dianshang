# 推进进度报告

## 当前基线提示

当前 `main` 已按用户要求回滚到 `51d4dab fix: improve canvas production performance guards`。后续推进前先读 `docs/current-baseline.md`。

本文件是历史进度流水账。记录中的“已完成”“已验证”只对对应日期和当时 Git/Docker 状态成立，不能脱离当前基线直接作为现状判断。

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

## 2026-07-07 当前画布真实生图生产测试进度报告

- 分支：`main`
- 完成内容：按用户要求把 3458 从 mock 测试切到真实 AI 调用模式，并在当前画布项目中点击一次“生成图片节点”做生产测试。服务健康检查显示 `mode=real-provider-ready`、`providers.ai.enabled=true`、`imageKeyConfigured=true`。
- 修改文件：`docs/progress-report.md`、`docs/review-log.md`
- 验证方式：请求 `http://127.0.0.1:3458/api/health`；在内置浏览器当前画布用提示词“生成电商主图”触发一次 GPT Image 2 生成；查询 SQLite 最新 `generations` 记录；检查页面结果图 DOM。
- 验证结果：真实生成成功，最新记录 `gen_mra8repd7838d326` 状态为 `completed`，`cost=10`，结果地址为 `/api/proxy-image?url=https%3A%2F%2Fexternal-resources-2.packyapi.com%2Ffiles%2F2bb7f59a-3a83-4feb-a648-07e9f31c9391.png`；画布右侧 `文生图` 节点已显示真实图片，尺寸 `1022x1539`，不是 mock 占位图。
- 当前完成度：当前画布真实生图主链路已跑通。
- 新发现问题：当前浏览器会话实际登录用户为 `731241492`，不是用户提供的 `admin`；本次扣费发生在该用户下，生成后该用户余额为 `0`。
- 未完成清单：未切换到 `admin / admin123456789` 重新跑，避免重复扣费；未把当前 3458 进程升级为完整 `NODE_ENV=production`，因为强 JWT_SECRET 门禁会阻止启动。
- 下一轮建议：如需继续用管理员账号测试，先切换登录到 admin 并确认余额或充值，再跑下一次；后续应补强本地 `JWT_SECRET` 后再做完整 production 模式验证。
- 需要人工介入：用户确认是否要退出当前用户并切换到 admin，或者为当前用户补余额后继续测试。

## 2026-07-07 当前画布 mock 生图结果图修复进度报告

- 分支：`main`
- 完成内容：复现当前画布 mock 生图后右侧结果节点破图的问题；根因是前端结果图 URL 归一化只放行 `https?`、`data:image`、`/uploads/` 和 `/api/proxy-image?`，漏掉后端 mock 模式返回的 `/api/mock-image/...`，导致结果 URL 被错误拼成 `data:image/png;base64,/api/mock-image/...`。本轮在当前 Canvas 包和备用 Canvas 包中补齐 `/api/mock-image/` 白名单，并兼容解包已被错误保存的 mock URL；同步提升入口 query，避免浏览器继续吃旧包。
- 修改文件：`index.html`、`assets/Canvas-B8bY9_QL.js`、`assets/Canvas-yGc8b2gf.js`、`assets/index-DglIsp_g.js`、`assets/index-ZrBcanD1.js`、`scripts/smoke-internal-prod.ps1`、`docs/progress-report.md`、`docs/review-log.md`
- 验证方式：运行 `node --check` 检查四个 JS 包；用 PowerShell `PSParser` 检查 `scripts/smoke-internal-prod.ps1` 语法；在内置浏览器刷新 `http://127.0.0.1:3458/canvas/project_1783402782710_xeqb6t8wr`，确认首页命中 `index-DglIsp_g.js?v=20260707mockimage1`，并在 mock 模式点击“生成图片节点”复测。
- 验证结果：四个 JS 包语法检查通过，smoke 脚本语法检查通过；刷新后原破图 `文生图` 节点恢复为 `/api/mock-image/...`，自然尺寸 `1024x1024`、显示尺寸 `520x520`；再次点击生成后节点数从 3 增加到 4，两个 `文生图` 均为 `/api/mock-image/...`，`badMockWrapped=0`。
- 当前完成度：本地 mock 生图显示链路约 95%。
- 新发现问题：浏览器控制台仍有本地资源迁移/JPG 转换相关 warning，其中包含 tainted canvas 后回退保存原始 blob 的提示；本轮观察不影响结果节点显示，先作为后续资源落盘链路风险记录。
- 未完成清单：未重建 Docker，未同步 `http://192.168.0.39:3456/`；未触发真实 Provider 生图；未进一步处理本地资源迁移 warning。
- 下一轮建议：用户在 3458 确认显示修复后，再决定是否同步 3456 Docker；如果后续发现历史记录或本地素材落盘异常，再单独排查 `projects-BtxGnToV.js` 的资源迁移链路。
- 需要人工介入：如需把本修复同步到 3456 生产测试容器，需要用户确认后再执行 Docker build + force recreate，并避开真实付费生图路径。

## 2026-07-07 回滚后文档去混淆进度报告

- 分支：`main`
- 完成内容：新增 `docs/current-baseline.md` 作为当前项目第一入口，明确 Git 基线、回滚备份、生产未同步状态、阅读顺序、项目地图、当前入口资源、易混淆历史和后续修改门禁；同时在 `AGENTS.md`、本文件、`docs/review-log.md`、`docs/known-gaps.md` 和 `docs/iteration-review-checklist.md` 中加入防混淆说明。随后按 Matt Pocock skills 的本地 agent 工作方式新增 `docs/agents/`，把 issue tracker、triage labels 和 domain docs 分开，避免未来 agent 把历史流水账当成当前源码事实。本轮又按用户确认新增 `CONTEXT.md`，把“画布”固定为当前唯一画布，后续不再用两套画布的并列叫法。
- 修改文件：`AGENTS.md`、`CONTEXT.md`、`docs/current-baseline.md`、`docs/agents/issue-tracker.md`、`docs/agents/triage-labels.md`、`docs/agents/domain.md`、`docs/canvas-maintenance-boundary.md`、`docs/canvas-migration-checklist.md`、`docs/canvas-maintenance-log.md`、`docs/backend-module-boundaries.md`、`docs/api-contract-next.md`、`docs/progress-report.md`、`docs/review-log.md`、`docs/known-gaps.md`、`docs/iteration-review-checklist.md`
- 验证方式：运行 `git -C "F:\dianshang" diff --check`；检查触达文本文件 UTF-8 无 BOM；运行 `git -C "F:\dianshang" status --short --branch`；复跑 `node "F:\dianshang\scripts\verify-canvas-performance-assets.js"` 确认其当前状态；使用 CodeGraph 查看当前索引，再用 `Test-Path` 和 `git ls-files` 核对疑似新画布源码路径。
- 验证结果：`git diff --check` 通过，仅有既有 LF/CRLF 提示；触达文件 BOM 均为 `False`；当前状态为 `main...origin/main [ahead 2]` 且本轮仅有文档改动；`verify-canvas-performance-assets.js` 确认失败，缺少旧锚点 `canvas-performance-mode.js?v=20260629perf5`，已列入待修脚本风险；CodeGraph 仍列出部分已删除的新画布源码路径，但 `Test-Path` 和 `git ls-files` 均确认这些路径当前不存在。
- 当前完成度：文档入口收敛约 90%。
- 新发现问题：`scripts/verify-canvas-performance-assets.js` 在当前 `51d4dab` 基线仍断言旧资源 `canvas-performance-mode.js?v=20260629perf5`，不能直接作为可信当前验证；CodeGraph 在回滚后疑似索引滞后，仍显示当前 Git 中不存在的新画布源码文件。
- 未完成清单：梳理 active resource manifest；修正或标记过期验证脚本；按后端模块边界为 `server.js` 建只读路由索引；经用户确认后刷新或重建 CodeGraph 索引。
- 下一轮建议：先清理验证脚本和资源 manifest，再考虑从回滚前 stash 中挑选小修复。
- 需要人工介入：如果要把本 Git 回滚同步到 `http://192.168.0.39:3456/` 生产容器，需要用户确认后再重建 Docker。

## 2026-07-04 画布默认云端保存进度报告

- 分支：`main`
- 完成内容：按内网测试要求把旧画布保存模式默认调整为云端/服务器保存；入口脚本会在浏览器不支持本地文件夹选择时，把已有 `canvasSaveMode=local` 自动切到 `cloud`，避免用户在 HTTP 内网或内置浏览器里被本地文件夹授权阻塞。
- 修改文件：`index.html`、`assets/localWorkflowFileSystem-CxAxbYWk.js`、`assets/localWorkflowFileSystem-B3l-tt5f.js`、`docs/progress-report.md`、`docs/review-log.md`
- 验证方式：运行触碰 JS 的 `node --check`；检查 `/api/settings/canvas-storage`；重建 Docker 后运行内网 Docker 验证脚本、浏览器刷新 `/canvas` 检查 `localStorage.canvasSaveMode`。
- 验证结果：本地 `node --check` 已通过；`git diff --check` 无 whitespace 错误；触碰文件均无 BOM；Docker 镜像已重建并替换容器；`verify-internal.ps1` 通过 health、API smoke、前端路由 smoke 和 Provider guard；内网首页 `http://192.168.0.39:3456/` 已返回云端初始化脚本，容器内两个保存分片均为 `canvasSaveMode` 默认 `cloud`。
- 当前完成度：默认云端保存过渡约 95%。
- 新发现问题：本地文件夹选择仍依赖 Chrome/Edge + 安全上下文；本轮不处理 HTTPS 证书和多机器本地授权。
- 未完成清单：如需本地文件夹授权弹窗，后续仍需配置内网 HTTPS 或各机器浏览器策略。
- 下一轮建议：内网测试优先使用云端保存；等多机器环境稳定后再做 HTTPS 证书或本地客户端方案。
- 需要人工介入：用户需要在其他机器用 Chrome/Edge 访问内网地址确认云端保存主流程是否满足测试。

## 2026-07-03 画布连线统一进度报告

- 分支：`main`
- 完成内容：按截图要求把画布连线统一成左侧参考线的蓝色曲线样式。默认连线从直角 `smoothstep` 改为 Bezier 曲线 `default`；旧项目和导入工作流加载时会重新归一化边类型与线条样式；图片参考线、图片顺序线、提示词顺序线和视频角色线统一使用 `#3b82f6`、`2px`。
- 修改文件：`assets/Canvas-B8bY9_QL.js`、`assets/Canvas-yGc8b2gf.js`、`assets/Canvas-D1auYH9L.css`、`scripts/verify-canvas-performance-assets.js`、`docs/progress-report.md`、`docs/review-log.md`
- 验证方式：运行两个画布 bundle 和验证脚本的 `node --check`；运行 `node scripts/verify-canvas-performance-assets.js`、后端画布边界 smoke、`git diff --check`；浏览器刷新当前画布后检查边的 computed style。
- 验证结果：`node --check` 均通过；画布资产验证脚本通过；后端画布边界 smoke 通过；`git diff --check` 无 whitespace 错误；触碰文件 BOM 检查均为 `False`；当前浏览器项目刷新后采样到 9 条 edge，均为 `rgb(59, 130, 246)`、`2px`，且 SVG path 均为 Bezier 曲线。
- 当前完成度：画布连线统一约 95%。
- 新发现问题：Vue Flow 基础 CSS 里仍保留第三方默认变量 `--vf-connection-path: #b1b1b7`，但后续 `.vue-flow__connection-path{...!important}` 已覆盖，不影响实际连线颜色。
- 未完成清单：等待人工在当前项目画布上肉眼确认所有连线视觉是否符合“左边线条”。
- 下一轮建议：如果还希望连线带编号气泡，需要单独定义哪些边需要编号；本轮只统一线条本身。
- 需要人工介入：需要你在当前画布刷新后确认视觉是否已经统一。

## 2026-06-26 新画布废止回滚进度报告

- 分支：`codex/source-stack-canvas-rebuild`
- 完成内容：按用户最新要求废止新画布，不再继续 Vue Flow/Infinite-Canvas 迁移。已删除新前端画布组件、Store、类型、运行适配器和 Infinite-Canvas 提示词模板；已卸载 `@vue-flow/*` 依赖；`frontend/` 的 `/canvas` 改为跳转旧后端画布 `http://127.0.0.1:3456/canvas`；README、画布迁移清单、功能清单和 review log 已同步回滚决策。
- 修改文件：`frontend/src/router/index.ts`、`frontend/src/views/HomeWorkbench.vue`、`frontend/src/views/LegacyCanvasRedirect.vue`、`frontend/src/main.ts`、`frontend/src/styles/app.css`、`frontend/package.json`、`frontend/package-lock.json`、`README.md`、`docs/canvas-migration-checklist.md`、`docs/feature-completion-checklist.md`、`docs/progress-report.md`、`docs/review-log.md`
- 删除文件：`frontend/src/views/CanvasStudio.vue`、`frontend/src/stores/canvas.ts`、`frontend/src/types/canvas.ts`、`frontend/src/api/canvasRunner.ts`、`frontend/public/system-prompts/infinite-canvas-prompt-templates.md`
- 验证方式：扫描 `frontend/` 中 `VueFlow|vue-flow|CanvasStudio|canvasRunner|infinite-canvas` 残留；运行 `npm run build --prefix "F:\dianshang\frontend"`。
- 验证结果：残留扫描无命中；前端构建通过，产物约 `316.98 kB`，已不再出现 Vue Flow 相关依赖。
- 当前完成度：新画布废止 95%，旧画布回滚入口 90%。
- 新发现问题：`frontend/` 仍只是源码化壳，真正画布验收应回到旧后端 `3456`。
- 未完成清单：人工打开旧后端 `/canvas` 确认视觉和功能；旧画布后续如有具体问题再单独修。
- 下一轮建议：启动旧后端后直接验收旧画布，不再检查新画布节点体系。
- 需要人工介入：需要你人工确认旧画布视觉和交互是否回到预期。

## 2026-06-26 前端源码化迁移骨架进度报告

- 分支：`codex/source-stack-canvas-rebuild`
- 完成内容：在新画布废止后，建立“旧画布固定旧版、其它前端渐进源码化”的迁移骨架。新增旧前端地址配置、前端迁移路由清单、统一旧页面桥接组件；新源码首页新增迁移索引，未迁移页面保持跳转旧前端，避免半成品替换稳定功能。新增 `docs/frontend-migration-roadmap.md` 记录迁移优先级和验收规则。
- 修改文件：`frontend/src/config/legacy.ts`、`frontend/src/config/frontendMigration.ts`、`frontend/src/views/LegacyRouteRedirect.vue`、`frontend/src/router/index.ts`、`frontend/src/views/HomeWorkbench.vue`、`frontend/src/styles/app.css`、`docs/frontend-migration-roadmap.md`、`docs/canvas-migration-checklist.md`、`README.md`、`docs/progress-report.md`
- 验证方式：运行 `npm run build --prefix "F:\dianshang\frontend"`；启动或复用 Vite dev server 后请求 `/`、`/canvas`、`/template-image`；运行 `git -C "F:\dianshang" diff --check`；检查 UTF-8 无 BOM。
- 验证结果：前端构建通过；`/`、`/canvas`、`/template-image` 均返回 200 且包含 Vite app 壳；空白检查通过；UTF-8 无 BOM 检查通过。
- 当前完成度：前端迁移骨架约 30%，模板页源码迁移尚未开始。
- 新发现问题：旧前端路由由打包资产承载，源码迁移需要逐页替换，不能直接全量反编译。
- 未完成清单：模板页、图库、认证、用户中心、后台源码页；每页 API 契约和 UI smoke。
- 下一轮建议：优先迁移 `/template-image`，因为它是前台核心业务页且已有模板 API。
- 需要人工介入：每个页面切换为源码版本前，需要人工确认旧版视觉和主路径验收点。

## 2026-06-26 模板生图页源码迁移进度报告

- 分支：`codex/source-stack-canvas-rebuild`
- 完成内容：将 `/template-image` 从旧版桥接切换为 `frontend/` 源码第一版。新增模板 API 模块和源码模板页，支持加载模板配置、模板分类、素材槽本地预览和上传、提示词字段、平台/比例/清晰度/张数/线路/模型选择、反推提示词和生成图片入口。反推和生成复用旧后端现有接口；未登录时显示明确登录提示，不执行真实付费生成。
- 修改文件：`frontend/src/api/http.ts`、`frontend/src/api/templateImage.ts`、`frontend/src/views/TemplateImageSource.vue`、`frontend/src/router/index.ts`、`frontend/src/config/frontendMigration.ts`、`frontend/src/styles/app.css`、`docs/frontend-migration-roadmap.md`、`docs/feature-completion-checklist.md`、`docs/progress-report.md`
- 验证方式：运行 `npm run build --prefix "F:\dianshang\frontend"`；用 Chrome 打开 `http://127.0.0.1:5173/template-image` 做无登录非付费验证；点击“反推提示词”确认 401 被转为中文登录提示；定位 4xx 响应来源；归档截图。
- 验证结果：构建通过且路由拆包后无大 chunk 警告；浏览器验证显示标题为“模板生图工作台”、模板按钮 10 个、素材槽 2 个、模型选择控件 5 个、旧版页面链接存在；未登录点击反推后显示“请先登录旧站账号，再使用反推或生成。”；4xx 响应仅有预期的 `/api/template/reverse-prompt` 401；截图保存到 `docs/design-references/template-image-source-2026-06-26.png`。
- 当前完成度：模板源码迁移第一版约 70%，模板页总体约 96%。
- 新发现问题：真实上传、反推和生成都依赖登录态；登录态真实生成可能消耗算力，本轮未做。
- 未完成清单：登录态人工点测上传/反推/生成；生成任务轮询；历史结果与图库联动；移动端细节截图；更贴近旧版的批量任务表。
- 下一轮建议：先人工复核源码模板页；若通过，继续迁移 `/gallery` 图库页。
- 需要人工介入：真实反推/生成涉及账号和算力，需人工确认后再测试。

## 2026-06-26 图库页源码迁移进度报告

- 分支：`codex/source-stack-canvas-rebuild`
- 完成内容：将 `/gallery` 从旧版桥接切换为 `frontend/` 源码第一版。新增图库 API 模块和源码图库页，支持读取生成历史、统计图片/模型/消耗、搜索提示词或模型、按模型筛选、打开图片、复制链接和删除记录。保留旧版页面入口用于对照。
- 修改文件：`frontend/src/api/gallery.ts`、`frontend/src/views/GallerySource.vue`、`frontend/src/router/index.ts`、`frontend/src/config/frontendMigration.ts`、`frontend/src/styles/app.css`、`docs/frontend-migration-roadmap.md`、`docs/feature-completion-checklist.md`、`docs/progress-report.md`、`docs/review-log.md`
- 验证方式：运行 `npm run build --prefix "F:\dianshang\frontend"`；用 Chrome 打开 `http://127.0.0.1:5173/gallery` 做无登录验证；归档截图。
- 验证结果：构建通过；浏览器验证显示标题为“图库历史”、旧版链接存在、统计为 0、未登录错误提示为“请先登录旧站账号，再查看图库历史。”；4xx 响应为预期 `/api/user/generations` 401；截图保存到 `docs/design-references/gallery-source-2026-06-26.png`。
- 当前完成度：图库源码迁移第一版约 75%，图库总体约 97%。
- 新发现问题：未登录会在初次打开和清 token reload 时各请求一次历史接口，自动化中出现两条 401，均为预期。
- 未完成清单：登录态真实记录展示；复制链接浏览器权限确认；删除记录人工确认；移动端截图复核。
- 下一轮建议：迁移登录/注册页，让源码前端能直接建立登录态，再回测模板和图库登录态功能。
- 需要人工介入：删除记录是破坏性操作，登录态删除测试前需确认测试数据。

## 2026-06-26 登录注册源码迁移进度报告

- 分支：`codex/source-stack-canvas-rebuild`
- 完成内容：将 `/login` 和 `/register` 从旧版桥接切换为 `frontend/` 源码第一版。新增认证 API 模块和源码认证页，登录对接 `/api/auth/login`，注册对接 `/api/auth/send-email-code` 和 `/api/auth/register`。登录成功后写入 `auth_token` 和 `auth_user`，默认跳转 `/gallery`。
- 修改文件：`frontend/src/api/auth.ts`、`frontend/src/views/AuthSource.vue`、`frontend/src/router/index.ts`、`frontend/src/config/frontendMigration.ts`、`frontend/src/styles/app.css`、`docs/frontend-migration-roadmap.md`、`docs/feature-completion-checklist.md`、`docs/progress-report.md`、`docs/review-log.md`
- 验证方式：运行 `npm run build --prefix "F:\dianshang\frontend"`；打开 `http://127.0.0.1:5173/login`；使用默认账号 `admin/admin123` 登录；检查 localStorage token、用户角色和源码图库页登录态；归档截图。
- 验证结果：构建通过；`/login` 返回源码 app 壳；默认账号登录成功，跳转 `http://127.0.0.1:5173/gallery`；`auth_token` 已写入，`auth_user.username=admin`、`role=admin`；源码图库页无 401；截图保存到 `docs/design-references/auth-login-gallery-source-2026-06-26.png`。
- 当前完成度：认证源码迁移第一版约 75%，用户模块总体约 94%。
- 新发现问题：注册验证码接口会在本地响应中返回 `code`，源码注册页会自动填入，适合本地开发验证；真实邮件模式后需调整提示。
- 未完成清单：注册新账号人工验证；退出登录入口；用户中心源码页；登录态模板上传/反推/生成回测。
- 下一轮建议：先用源码登录态回测模板页和图库页；然后迁移 `/user/center`。
- 需要人工介入：真实生成会消耗算力，登录态模板生成仍需确认后再测。

## 2026-06-26 用户中心源码迁移进度报告

- 分支：`codex/source-stack-canvas-rebuild`
- 完成内容：将 `/user/center` 从旧版桥接切换为 `frontend/` 源码第一版。新增用户 API 模块和源码用户中心页，支持读取用户资料、余额流水、API 状态、展示账户概览、跳转模板/图库和退出登录。未新增后端接口。
- 修改文件：`frontend/src/api/user.ts`、`frontend/src/views/UserCenterSource.vue`、`frontend/src/router/index.ts`、`frontend/src/config/frontendMigration.ts`、`frontend/src/styles/app.css`、`docs/frontend-migration-roadmap.md`、`docs/feature-completion-checklist.md`、`docs/progress-report.md`、`docs/review-log.md`
- 验证方式：运行 `npm run build --prefix "F:\dianshang\frontend"`；用默认账号 `admin/admin123` 登录 `http://127.0.0.1:5173/login?redirect=/user/center`；检查用户中心资料、余额、API 状态和余额流水；归档截图。
- 验证结果：构建通过；登录后进入 `http://127.0.0.1:5173/user/center`；页面显示 `admin`、角色 `admin`、当前算力 `999989`、流水记录 `16`、API 状态 `GPT Image 2 · 真实/自动模式 · active`；无 4xx 响应；截图保存到 `docs/design-references/user-center-source-2026-06-26.png`。
- 当前完成度：用户中心源码迁移第一版约 75%，用户模块总体约 95%。
- 新发现问题：当前只迁移 `/user/center`，生成记录和兑换码仍桥接旧版。
- 未完成清单：`/user/records`、`/user/redeem` 源码迁移；头像上传/预设头像编辑；移动端截图复核。
- 下一轮建议：迁移 `/user/records` 和 `/user/redeem`，补齐用户模块。
- 需要人工介入：无。

## 2026-06-26 生成记录与兑换码源码迁移进度报告

- 分支：`codex/source-stack-canvas-rebuild`
- 完成内容：将 `/user/records` 和 `/user/redeem` 从旧版桥接切换为 `frontend/` 源码第一版。生成记录页复用 `/api/user/generations` 和 `/api/user/balance-logs`，支持提示词/模型搜索、流水类型筛选、打开结果图和刷新；兑换码页复用 `/api/user/profile`、`/api/user/balance-logs` 和 `/api/user/redeem`，支持余额展示、兑换码提交和最近流水刷新。未新增后端接口、未新增 npm 包。
- 修改文件：`frontend/src/api/user.ts`、`frontend/src/views/UserRecordsSource.vue`、`frontend/src/views/UserRedeemSource.vue`、`frontend/src/router/index.ts`、`frontend/src/config/frontendMigration.ts`、`frontend/src/styles/app.css`、`docs/frontend-migration-roadmap.md`、`docs/feature-completion-checklist.md`、`docs/progress-report.md`、`docs/review-log.md`
- 验证方式：检查 CodeGraph 状态；运行 `npm.cmd run build --prefix "F:\dianshang\frontend"`；启动或复用前端 `5173` 和后端 `3456`；用默认账号 `admin/admin123` 登录后打开 `/user/records` 和 `/user/redeem`；保存桌面截图。
- 验证结果：构建通过；后端健康检查通过；`/user/records` 显示标题“生成记录”、2 个记录面板、13 条生成记录和 16 条余额流水；`/user/redeem` 显示标题“兑换码”、当前算力 `999989` 和 8 条最近流水；浏览器没有 page error，也没有 4xx/5xx API 响应；截图保存到 `docs/design-references/user-records-source-2026-06-26.png` 和 `docs/design-references/user-redeem-source-2026-06-26.png`。
- 当前完成度：用户模块源码迁移第一版约 85%，用户模块总体约 97%。
- 新发现问题：真实兑换码提交会改变账户余额，自动化只验证页面和接口加载，没有提交兑换码。
- 未完成清单：移动端 390px 截图复核；真实测试兑换码提交；头像上传/预设头像编辑；登录态模板反推/生成回测。
- 下一轮建议：先做用户模块移动端截图和模板/图库登录态回测；后台源码化仍放在最后。
- 需要人工介入：如需验收兑换提交，请提供一次性测试兑换码或确认可以创建临时兑换码。

## 2026-06-26 用户模块移动端与登录态前台回测进度报告

- 分支：`codex/source-stack-canvas-rebuild`
- 完成内容：按上一轮建议补用户模块移动端验收，并回测登录态模板/图库的非付费加载路径。发现 `/user/records` 在 390px 宽度下图片卡片会被图片固有宽度撑出 90px 横向溢出，已在源码 CSS 中补 `min-width: 0`、`max-width: 100%`、图片 `display: block` 和卡片溢出保护。未点击模板反推/生成、未提交兑换码、未删除图库记录。
- 修改文件：`frontend/src/styles/app.css`、`docs/feature-completion-checklist.md`、`docs/progress-report.md`、`docs/review-log.md`
- 验证方式：启动或复用前端 `5173` 和后端 `3456`；用默认账号 `admin/admin123` 登录；在 390x844 视口打开 `/user/records` 和 `/user/redeem` 并截图；在 1440x900 视口打开 `/template-image` 和 `/gallery` 做登录态加载回测；保存截图。
- 验证结果：`/user/records` 横向溢出从 90px 修复为 0，显示 2 个面板、13 条生成记录和 16 条流水；`/user/redeem` 横向溢出为 0，显示余额 `999989` 和 8 条最近流水；登录态 `/template-image` 显示 10 个模板和 2 个素材槽；登录态 `/gallery` 显示 13 张记录；没有 4xx/5xx API 响应。浏览器有一个非 API 的 404 静态资源提示，暂不阻塞业务验收。
- 当前完成度：用户模块源码迁移第一版约 90%，模板/图库登录态加载回测完成。
- 新发现问题：生成历史中部分历史中文 prompt 显示为问号，疑似早期数据写入编码问题，不是本轮源码页渲染问题。
- 未完成清单：真实兑换码提交；模板反推/生成真实调用；图库删除测试数据；注册新账号；头像上传/预设头像编辑；后台源码化。
- 下一轮建议：开始迁移注册完整路径或进入后台源码化前的页面边界盘点；真实付费/破坏性操作仍需人工确认。
- 需要人工介入：真实兑换码、真实生成和删除图库记录需要你确认测试数据或费用边界。

## 2026-06-26 Codex 自带浏览器前台源码页点测进度报告

- 分支：`codex/source-stack-canvas-rebuild`
- 完成内容：按用户要求改用 Codex 自带浏览器可见窗口做实际点测，而不是 headless 浏览器。使用默认账号 `admin/admin123` 登录源码前端，依次打开 `/gallery`、`/template-image`、`/user/records`、`/user/redeem`；随后切到移动端视口复核 `/user/records` 和 `/user/redeem`。本轮只做读操作，不点击真实生成、兑换码提交和图库删除。
- 修改文件：`docs/progress-report.md`、`docs/review-log.md`
- 验证方式：前端 `5173` 和后端 `3456` 在线；Codex In-app Browser 可见窗口登录；采集页面标题、可见数据、横向溢出、控制台错误；保存自带浏览器截图。
- 验证结果：登录后跳转 `/gallery`；图库显示 13 张记录，模板页显示 10 个模板和 2 个素材槽，生成记录页显示 13 条生成记录和 16 条流水，兑换页显示余额 `999989` 和 8 条最近流水；桌面和移动端横向溢出均为 0；自带浏览器业务控制台错误为 0。截图保存到 `docs/design-references/iab-*-2026-06-26.png`。
- 当前完成度：前台源码页可见浏览器验收补充完成，用户模块源码迁移第一版约 90%。
- 新发现问题：自带浏览器运行环境打印过一条 Codex/Statsig 外部统计请求超时，不属于本地业务页面控制台错误；页面内仍可正常操作。
- 未完成清单：真实模板反推/生成、真实兑换码提交、图库删除、注册新账号、后台源码化。
- 下一轮建议：先做注册完整路径源码页点测，或开始后台源码化边界盘点。
- 需要人工介入：真实付费/改数据操作仍需你确认测试数据和费用边界。

## 2026-06-26 源码前端 Playwright 点击 Smoke 进度报告

- 分支：`codex/source-stack-canvas-rebuild`
- 完成内容：新增可复跑的 Vue3 源码前端 Playwright CLI 点击 smoke，不再只依赖人工截图或 headless 临时脚本。脚本会登录默认账号，点击图库搜索和刷新、模板切换到白底图并填写提示词、生成记录搜索和刷新、兑换码页填写测试文本但只点刷新不提交，并在 390x844 移动端复核 `/user/records` 和 `/user/redeem` 横向溢出。脚本明确避开真实生成、兑换码提交和图库删除。
- 修改文件：`scripts/smoke-source-frontend-ui.ps1`、`scripts/smoke-source-frontend-ui-runner.js`、`scripts/preflight-check.ps1`、`README.md`、`docs/feature-completion-checklist.md`、`docs/progress-report.md`、`docs/review-log.md`
- 验证方式：检查 `npx` 可用；运行 `node --check "F:\dianshang\scripts\smoke-source-frontend-ui-runner.js"`；运行 `powershell -NoProfile -ExecutionPolicy Bypass -File "F:\dianshang\scripts\smoke-source-frontend-ui.ps1"`。
- 验证结果：Playwright smoke 通过。结果包括：登录跳转 `/gallery`；图库搜索 `simple` 后保留 2 张卡片并刷新；模板点击切换到“白底图”并填写提示词；生成记录搜索 `simple` 后保留 2 条记录并刷新；兑换页余额 `999989` 可见；移动端 records/redeem 横向溢出为 0；无 4xx/5xx API 和业务 console error。截图保存到 `docs/design-references/source-frontend-2026-06-26/`。
- 当前完成度：源码前端工程化回归护栏约 65%，前台源码页非破坏性点击验收已自动化，并已进入统一 `SMOKE_UI=true` 预检链路。
- 新发现问题：第一次运行时 Playwright open 等待 3 秒不够，已调到 8 秒；模板提示词定位不能依赖旧 placeholder，已改为 `.form-grid textarea`。
- 未完成清单：注册完整路径点击 smoke；后台源码化前页面边界盘点；真实生成/兑换/删除仍需人工确认后单独测。
- 下一轮建议：继续补注册页源码点击 smoke，或开始后台源码化边界盘点。
- 需要人工介入：真实付费和改数据操作仍需用户确认。

## 2026-06-26 源码前端注册点击 Smoke 进度报告

- 分支：`codex/source-stack-canvas-rebuild`
- 完成内容：继续强化 Vue3 源码前端 Playwright 点击回归，把 `/register` 注册完整路径纳入 `scripts/smoke-source-frontend-ui-runner.js`。脚本会生成唯一临时用户名和邮箱，点击发送验证码，确认验证码自动填入，点击注册并确认跳转图库；随后用后台登录接口软删除并永久清理该临时用户，再清空登录态继续默认 admin 登录和其它前台页面点击链路。修正 console 404 过滤逻辑：不再用无 URL 的浏览器 console 文案误判失败，而是通过 response 事件区分 API 失败、非 favicon 静态资源失败和可忽略 favicon 404。
- 修改文件：`scripts/smoke-source-frontend-ui-runner.js`、`README.md`、`docs/feature-completion-checklist.md`、`docs/progress-report.md`
- 验证方式：运行 `node --check "F:\dianshang\scripts\smoke-source-frontend-ui-runner.js"`；运行 `powershell -NoProfile -ExecutionPolicy Bypass -File "F:\dianshang\scripts\smoke-source-frontend-ui.ps1"`。
- 验证结果：源码前端 smoke 通过。新增注册步骤返回 `register ok` 和 `register-cleanup ok`；后续登录、图库搜索刷新、模板切换填写、生成记录搜索刷新、兑换页填写但不提交、移动端 records/redeem 溢出检查继续全部通过。截图新增 `docs/design-references/source-frontend-2026-06-26/register-success-desktop-1440x900.png`。
- 当前完成度：源码前端工程化点击回归约 72%，注册/登录/图库/模板/用户记录/兑换页的非付费非破坏性主路径已自动化。
- 新发现问题：浏览器会对 favicon 404 打一条无 URL console 文案，已改用 response 级别判定，避免误报；真实非 favicon 静态资源 4xx 仍会失败。
- 未完成清单：真实生成、真实兑换码、图库删除仍需人工确认费用和测试数据；后台源码化边界盘点；源码前端 smoke 还未拆分成更细的可选开关。
- 下一轮建议：开始后台源码化边界盘点，或在确认测试数据后补图库删除/兑换码提交的 disposable smoke。
- 需要人工介入：真实付费和改数据操作仍需用户确认。

## 2026-06-26 源码前端导航与退出登录 Smoke 进度报告

- 分支：`codex/source-stack-canvas-rebuild`
- 完成内容：继续扩展 `scripts/smoke-source-frontend-ui-runner.js`，新增首页迁移索引和退出登录点击路径。脚本登录 admin 后打开 `/`，确认“前端迁移索引”可见，点击 `/user/center` 源码入口，确认进入用户中心并无横向溢出；再点击用户中心“图库历史”快捷按钮确认回到图库。脚本末尾重新进入用户中心，点击“退出登录”，确认跳转 `/login` 且 `auth_token/auth_user` 已从 localStorage 清空。
- 修改文件：`scripts/smoke-source-frontend-ui-runner.js`、`README.md`、`docs/feature-completion-checklist.md`、`docs/progress-report.md`
- 验证方式：运行 `node --check "F:\dianshang\scripts\smoke-source-frontend-ui-runner.js"`；运行 `powershell -NoProfile -ExecutionPolicy Bypass -File "F:\dianshang\scripts\smoke-source-frontend-ui.ps1"`。
- 验证结果：源码前端 smoke 通过。新增步骤 `home-index-user-navigation ok` 和 `logout ok`；原有注册清理、登录、图库、模板、记录、兑换、移动端检查继续通过。新增截图：`home-migration-index-desktop-1440x900.png`、`logout-success-desktop-1440x900.png`。
- 当前完成度：源码前端工程化点击回归约 78%，关键非付费非破坏性导航与登录态闭环已自动化。
- 新发现问题：无。
- 未完成清单：真实生成、真实兑换码、图库删除仍需人工确认费用和测试数据；后台源码化边界盘点；源码前端 smoke 还未拆分成更细的可选开关。
- 下一轮建议：进入后台源码化边界盘点，或补一个 disposable 方式的图库删除/兑换码提交 smoke。
- 需要人工介入：真实付费和改数据操作仍需用户确认。

## 2026-06-26 技术栈补救决策进度报告

- 分支：`codex/backend-platform`
- 完成内容：基于视频参考和当前项目现状，明确“不立即切 Django、不推倒当前内网版本”的补救策略；新增源码优先目标栈 ADR，确定当前过渡栈为 Vue 打包资产 + Express + SQLite，正式目标栈为 Vue 3 + Vite + TypeScript、Node.js + TypeScript API、Prisma/Drizzle、Postgres/MySQL、Redis + BullMQ + AI Worker、S3 兼容对象存储、New-API -> CPA/上游模型。
- 修改文件：`docs/adr/0002-source-first-technology-stack.md`、`docs/iteration-review-checklist.md`、`docs/known-gaps.md`、`docs/progress-report.md`、`docs/review-log.md`
- 验证方式：文档 UTF-8 BOM 检查、`git diff --check`、`git status --short --branch`。
- 验证结果：5 个 Markdown 文件均为 UTF-8 无 BOM；`git diff --check` 无空白错误，仅提示 Git 后续可能把部分工作区文件 LF 转 CRLF；`git status` 显示仅有本轮文档改动和新增 ADR。
- 当前完成度：技术栈决策约 95%，补救路线约 80%，实际源码化迁移尚未开始。
- 新发现问题：视频参考的核心优势是源码工程和后端模型边界，不是必须照搬 Django/MySQL；当前项目最大技术债是打包前端资产维护和单文件后端耦合。
- 未完成清单：API 契约文档、bridge/override 迁移清单、`server.js` 模块化拆分计划、`frontend/` 源码工程启动计划、生产数据库/队列/Worker 迁移方案。
- 下一轮建议：先做 API 契约和 bridge/override 债务清单，再开始拆 `server.js` 模块边界；不要先重写 UI。
- 需要人工介入：确认正式生产数据库偏好是 Postgres 还是 MySQL；确认是否接受后续前端源码重建排期。

## 2026-06-26 新分支源码栈与画布启动进度报告

- 分支：`codex/source-stack-canvas-rebuild`
- 完成内容：新建源码化迁移分支；新增 `frontend/`，使用 Vue 3 + Vite + TypeScript + Vue Router + Pinia + Axios + Naive UI + lucide-vue-next + Vue Flow；新增新版画布工作台，节点/连线/缩放/拖拽由 Vue Flow 承担，状态由 Pinia 管理；新增 README、AGENTS 源码化规则和并行任务树计划；准备复制分支项目到 `F:\dianshang`。
- 修改文件：`AGENTS.md`、`README.md`、`frontend/*`、`docs/plans/2026-06-26-source-stack-canvas-rebuild-plan.md`、`docs/adr/0002-source-first-technology-stack.md`、`docs/iteration-review-checklist.md`、`docs/known-gaps.md`、`docs/progress-report.md`、`docs/review-log.md`
- 验证方式：`npm install --prefix frontend`、`npm run build --prefix frontend`、文档 UTF-8 BOM 检查、`git diff --check`、`git status --short --branch`。
- 验证结果：`npm install` 完成；新前端 `vue-tsc --noEmit && vite build` 已通过；Vite 仅提示单 chunk 超过 500k，后续可用路由懒加载拆包；其余验证待最终复制后补充。
- 当前完成度：新源码前端基座约 35%，新版画布第一阶段约 25%，迁移计划约 90%。
- 新发现问题：新版前端首包包含 Naive UI 和 Vue Flow 后较大，需要后续按页面动态导入；当前是功能起点，不是最终视觉 1:1。
- 未完成清单：API 契约、新画布真实生成任务、旧画布能力对照迁移、后端 TypeScript 模块化、Redis/BullMQ Worker、对象存储、Playwright 视觉验证。
- 下一轮建议：先按 `docs/plans/2026-06-26-source-stack-canvas-rebuild-plan.md` 拆 API 契约和新版画布两个并行 Lane。
- 需要人工介入：确认 `F:\dianshang` 是否作为主工作目录；后续若要多工作树并行，可再创建 `F:\dianshang-worktrees\*`。

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

## 2026-06-25 后台 API 线路与模型价格宽表复核进度报告

- 分支：`codex/backend-platform`
- 完成内容：继续按后台截图逐页复核，重新打开 `/admin/api-providers` 和 `/admin/model-prices`；确认上一轮 sticky 操作列和按钮密度修复已覆盖到 API 线路、模型价格两张宽表；归档新的宽表截图，作为后续人工对比证据。
- 修改文件：`docs/design-references/admin-2026-06-25/api-providers-action-column-polish-desktop-1440x900.png`、`docs/design-references/admin-2026-06-25/model-prices-action-column-polish-desktop-1440x900.png`、`docs/progress-report.md`、`docs/feature-completion-checklist.md`、`docs/review-log.md`
- 验证方式：内置浏览器分别打开 `/admin/api-providers`、`/admin/model-prices`，读取操作列 computed style、按钮数量、高度和表头字段，并截图归档；执行 `scripts\smoke-frontend-routes.ps1`、`Invoke-RestMethod http://127.0.0.1:3456/api/health`。
- 验证结果：两页操作列宽度均为 226px，阴影均为 `rgba(248, 250, 252, 0.58) -6px 0px 14px`，按钮高度均为 26px；两页均非 404/500；截图已归档。
- 当前完成度：首页约 79%，模板约 92%，图库约 94%，用户中心约 93%，后台约 99%，后端平台护栏约 82%，测试护栏约 99%，部署护栏约 93%。
- 新发现问题：API 线路是超宽表，右侧 `API Key`、默认模型、最后拉取等字段在 1440 宽度下仍依赖横向滚动；现阶段可人工测试，但后续若追更舒服的后台体验，应做列显隐、详情抽屉或更多操作菜单。
- 未完成清单：后台其他页面继续逐页肉眼复核；Docker Desktop Engine 启动后的容器复核；New-API 真实 token 后续接入。
- 下一轮建议：继续看订单、日志、任务监控的表格密度和状态色，优先修一眼突兀的问题。
- 需要人工介入：人工确认 API 线路/模型价格当前宽表可接受。

## 2026-06-25 后台任务监控操作按钮修复进度报告

- 分支：`codex/backend-platform`
- 完成内容：复核订单、消费日志、任务监控三页；订单和消费日志当前可测，任务监控右侧操作列存在明显视觉问题：`详情`、`删除记录` 被拉成 197px 长条按钮，并且 sticky 操作列背景半透明导致参数/时间文字透出。本轮将后台表格竖排操作按钮改为内容宽度右对齐，并把 sticky 操作列背景改为纯白。
- 修改文件：`assets/admin-visual-polish.css`、`docs/design-references/admin-2026-06-25/generate-tasks-action-buttons-polish-desktop-1440x900.png`、`docs/progress-report.md`、`docs/feature-completion-checklist.md`、`docs/review-log.md`
- 验证方式：Playwright 打开 `/admin/generate-tasks`，读取操作列宽度、背景色、按钮宽高，并截图归档；执行 `scripts\smoke-frontend-routes.ps1`、`node --check server.js`、`node --check assets\home-carousel-inertia.js`、`Invoke-RestMethod http://127.0.0.1:3456/api/health`。
- 验证结果：任务监控操作列宽度为 226px，背景为 `rgb(255, 255, 255)`；`详情` 按钮宽度 58px，高度 26px；`删除记录` 按钮宽度 60px，高度 26px；截图 `generate-tasks-action-buttons-polish-desktop-1440x900.png` 已归档。
- 当前完成度：首页约 79%，模板约 92%，图库约 94%，用户中心约 93%，后台约 99%，后端平台护栏约 82%，测试护栏约 99%，部署护栏约 93%。
- 新发现问题：任务监控仍是宽表，参数/时间列在 1440 宽度下依赖横向滚动；现阶段已消除最明显的按钮长条和透字问题。
- 未完成清单：后台其他页面继续逐页肉眼复核；Docker Desktop Engine 启动后的容器复核；New-API 真实 token 后续接入。
- 下一轮建议：继续看兑换码、模板工作流和系统设置的弹窗/保存回显视觉，优先修肉眼突兀的问题。
- 需要人工介入：确认任务监控右侧操作按钮现在是否接受。

## 2026-06-25 后台模板工作流绿色统一进度报告

- 分支：`codex/backend-platform`
- 完成内容：复核兑换码、API 线路弹窗和模板工作流；兑换码/API 线路弹窗主按钮已是绿色白字，模板工作流页仍残留橙色主按钮、橙色选中模板卡和橙色 checkbox。本轮将模板工作流页 `新增`、`保存配置`、`新增图片槽`、`新增字段`、`生成预览`、选中模板卡和后台 checkbox 统一为清新 emerald 绿，保持后台整体颜色一致。
- 修改文件：`assets/admin-visual-polish.css`、`docs/design-references/admin-2026-06-25/template-workflows-green-actions-desktop-1440x900.png`、`docs/progress-report.md`、`docs/feature-completion-checklist.md`、`docs/review-log.md`
- 验证方式：内置浏览器打开 `/admin/template-workflows`，读取按钮颜色、checkbox accent-color，并截图归档；执行 `scripts\smoke-frontend-routes.ps1`、`node --check server.js`、`node --check assets\home-carousel-inertia.js`、`Invoke-RestMethod http://127.0.0.1:3456/api/health`。
- 验证结果：`保存配置` 文字为白色，边框为 `rgba(16, 185, 129, 0.95)`；checkbox accent-color 为 `rgb(16, 185, 129)`；页面按钮未再检测到 `rgb(249, 115, 22)` 橙色背景；截图 `template-workflows-green-actions-desktop-1440x900.png` 已归档。
- 当前完成度：首页约 79%，模板约 92%，图库约 94%，用户中心约 93%，后台约 99%，后端平台护栏约 82%，测试护栏约 99%，部署护栏约 93%。
- 新发现问题：模板工作流页面还有较长配置表单，整体可测；后续重点应放在保存回显、弹窗和移动端可读性。
- 未完成清单：后台弹窗保存回显继续人工复核；Docker Desktop Engine 启动后的容器复核；New-API 真实 token 后续接入。
- 下一轮建议：继续看兑换码创建/删除弹窗、API 线路保存回显和系统设置保存提示。
- 需要人工介入：确认模板工作流绿色统一后的观感是否接受。

## 2026-06-25 后台弹窗绿色按钮复核进度报告

- 分支：`codex/backend-platform`
- 完成内容：继续按“前后端都可人工测试”的今日目标推进；不改画布卡片结构，只复核后台弹窗按钮颜色。使用 Playwright 打开兑换码创建弹窗和 API 线路新增弹窗，确认主按钮已是清新绿色白字，并归档两张最新截图。
- 修改文件：`docs/design-references/admin-2026-06-25/redeem-modal-green-review-desktop-1440x900.png`、`docs/design-references/admin-2026-06-25/api-provider-modal-green-review-desktop-1440x900.png`、`docs/progress-report.md`、`docs/feature-completion-checklist.md`、`docs/review-log.md`
- 验证方式：Playwright 登录后台，分别打开 `/admin/redeem-codes` 的创建兑换码弹窗、`/admin/api-providers` 的新增线路弹窗，读取按钮 computed style 并截图归档；执行 `node --check server.js`、`node --check assets\home-carousel-inertia.js`、`scripts\smoke-frontend-routes.ps1`、`scripts\smoke-api.ps1`、`/api/health`、`git diff --check`、UTF-8 BOM 检查和 `docker compose -f docker-compose.internal.yml ps`。
- 验证结果：兑换码弹窗存在且无致命错误文本，`创建` 按钮颜色为白色、背景为 `rgb(24, 160, 88)`；页面顶部 `创建兑换码` 按钮为白字、背景 `rgb(5, 150, 105)`；API 线路弹窗存在且无致命错误文本，`保存` 按钮颜色为白色、背景为 `rgb(24, 160, 88)`；`node --check`、前端路由 smoke、API smoke、`/api/health`、`git diff --check` 和 UTF-8 无 BOM 检查通过；`docker compose ps` 仍无法连接 Docker Desktop Engine：`open //./pipe/dockerDesktopLinuxEngine: The system cannot find the file specified`。
- 当前完成度：首页约 79%，模板约 92%，图库约 94%，用户中心约 93%，后台约 99%，后端平台护栏约 82%，测试护栏约 99%，部署护栏约 93%。
- 新发现问题：弹窗内部 Naive primary 仍使用默认绿 `rgb(24, 160, 88)`，已经比原亮薄荷绿清爽；如果后续要求完全一致，可以再把弹窗内部也统一到外层按钮的 emerald 渐变。Docker Desktop Engine 当前未运行，容器状态仍待复核。
- 未完成清单：复杂后台表单保存回显继续人工复核；Docker Desktop Engine 启动后的容器复核；New-API 真实 token 后续接入。
- 下一轮建议：继续复核系统设置保存提示、后台删除确认弹窗和前端模板/图库主流程。
- 需要人工介入：人工确认当前弹窗绿色按钮是否接受；启动 Docker Desktop 后再跑完整容器验证。

## 2026-06-25 后台删除/回收站 UI 复核进度报告

- 分支：`codex/backend-platform`
- 完成内容：继续推进后台人工可测目标；运行后台 UI 保存流程和用户删除/恢复流程。发现 `smoke-admin-delete-ui` 在回收站页面存在等待和计数过严导致的误报，实际页面能显示已删除用户。本轮加固脚本：等待回收站行真实出现，恢复后等待行消失；同时把 `/admin/recycle-bin` 加入前端路由 smoke。
- 修改文件：`scripts/smoke-admin-delete-ui-runner.js`、`scripts/smoke-frontend-routes.ps1`、`docs/design-references/admin-2026-06-25/admin-ui-smoke-*.png`、`docs/design-references/admin-2026-06-25/admin-user-delete-*.png`、`docs/progress-report.md`、`docs/feature-completion-checklist.md`、`docs/review-log.md`
- 验证方式：执行 `scripts\smoke-admin-ui.ps1`、`scripts\smoke-admin-delete-ui.ps1`、`scripts\smoke-frontend-routes.ps1`、`scripts\smoke-api.ps1`、`node --check server.js`、`node --check assets\home-carousel-inertia.js`、`/api/health`、`git diff --check`、UTF-8 BOM 检查和 `docker compose -f docker-compose.internal.yml ps`。
- 验证结果：后台 UI smoke 通过，覆盖 Dashboard、系统设置保存、API 线路新增弹窗、兑换码创建弹窗、模板工作流保存；后台删除/恢复 UI smoke 通过，覆盖临时用户创建、删除确认弹窗、进入回收站、恢复用户并清理；前端路由 smoke 新增 `/admin/recycle-bin` 后通过；API smoke、`node --check`、`/api/health`、`git diff --check`、UTF-8 无 BOM 检查通过；`docker compose ps` 仍无法连接 Docker Desktop Engine。
- 当前完成度：首页约 79%，模板约 92%，图库约 94%，用户中心约 93%，后台约 99%，后端平台护栏约 82%，测试护栏约 99%，部署护栏约 93%。
- 新发现问题：删除确认流程本身可跑通，主要问题是测试脚本等待太短；Docker Desktop Engine 当前仍未复核。
- 未完成清单：复杂后台表单保存后刷新回显继续人工复核；Docker Desktop Engine 启动后的容器复核；New-API 真实 token 后续接入。
- 下一轮建议：继续复核前端模板/图库主流程，或在 Docker Desktop 可用后执行完整内网容器验证。
- 需要人工介入：启动 Docker Desktop 后再跑完整容器验证；人工确认回收站删除/恢复体验是否接受。

## 2026-06-25 模板/图库主流程 UI 复核进度报告

- 分支：`codex/backend-platform`
- 完成内容：继续推进“前端和后端都达到人工可测”。新增 `scripts/smoke-template-ui.ps1` 和 `scripts/smoke-template-ui-runner.js`，覆盖模板页选中“一键主图反推复刻”、上传参考图/产品图、反推 3 条提示词、生成 1 张 mock 结果并确认写入生成历史；同时重跑图库 UI smoke，覆盖桌面图库 2 张、多图复制、移动端多图、删除后空状态。
- 修改文件：`scripts/smoke-template-ui.ps1`、`scripts/smoke-template-ui-runner.js`、`scripts/preflight-check.ps1`、`docs/design-references/frontend-2026-06-25/template-*.png`、`docs/design-references/frontend-2026-06-25/gallery-*.png`、`docs/design-references/mobile-2026-06-25/gallery-*.png`、`docs/progress-report.md`、`docs/feature-completion-checklist.md`、`docs/review-log.md`
- 验证方式：执行 `scripts\smoke-template-ui.ps1` 和 `scripts\smoke-gallery-ui.ps1`；模板脚本第一次因断言文案过死误报，页面实际已显示 `3 条` 提示词，随后修正为识别 `提示词选择 / 3 条 / 查看提示词` 并重跑通过。
- 验证结果：模板 UI smoke 通过，返回 `ok=true`、`imageCount=3`、`generationCount=1`；图库 UI smoke 通过，返回 `ok=true`、`generated=2`、`copiedLinks=2`；`SMOKE_UI=true` 的预检分支已接入模板和图库 UI smoke。
- 当前完成度：首页约 79%，模板约 94%，图库约 96%，用户中心约 93%，后台约 99%，后端平台护栏约 82%，测试护栏约 99%，部署护栏约 96%。
- 新发现问题：模板 UI smoke 依赖当前 mock 反推文案包含 `3 条`；后续接 New-API 后需要重新校准真实模型返回的提示词结构。
- 未完成清单：真实服务器 Nginx/HTTPS 部署演练；New-API 真实 token 后续接入；模板真实外部生图接入后的再验收。
- 下一轮建议：继续复核首页/画布主流程，或在当前 Docker `http://127.0.0.1:3457/` 上做人工浏览。
- 需要人工介入：人工确认模板上传/反推/生成截图是否接受；确认本机是否保留 Node 3456 + Docker 3457 双运行方式。

## 2026-06-25 Docker 内网验证与端口护栏进度报告

- 分支：`codex/backend-platform`
- 完成内容：Docker Desktop Engine 已可用；首次直接跑 `3456` 失败，原因是本地 Node 服务占用端口。本轮把 Docker Compose 增加 `HOST_PORT` 宿主机端口映射，保持容器内部 `PORT=3456` 不变；使用 `HOST_PORT=3457` 完整跑通内网部署验证。
- 修改文件：`docker-compose.internal.yml`、`.env.example`、`scripts/verify-internal-deploy.ps1`、`docs/deployment.md`、`docs/progress-report.md`、`docs/feature-completion-checklist.md`、`docs/review-log.md`
- 验证方式：执行 `$env:HOST_PORT='3457'; powershell -NoProfile -ExecutionPolicy Bypass -File scripts\verify-internal-deploy.ps1`，随后执行 `docker compose -f docker-compose.internal.yml ps`。
- 验证结果：Docker 29.5.3、Compose v5.1.4 可用；镜像 build 成功；容器 `dianshang-app` 通过 `http://127.0.0.1:3457/api/health`；容器内 API smoke 和前端路由 smoke 通过；容器 restart 后数据库仍为 `ok`；最终容器状态为 `Up ... (healthy)`，端口映射 `0.0.0.0:3457->3456/tcp`。
- 当前完成度：首页约 79%，模板约 94%，图库约 96%，用户中心约 93%，后台约 99%，后端平台护栏约 82%，测试护栏约 99%，部署护栏约 96%。
- 新发现问题：本机如果同时跑 Node 和 Docker，默认 `3456` 会冲突；已通过 `HOST_PORT` 解决。
- 未完成清单：真实服务器 Nginx/HTTPS 部署演练；New-API 真实 token 后续接入；公网或公司内网多机访问需要按实际 IP/防火墙再测。
- 下一轮建议：在当前容器 `http://127.0.0.1:3457/` 上做一次人工浏览；之后继续首页/画布主流程审查。
- 需要人工介入：人工确认是否保留本机 Node 3456 + Docker 3457 的双运行方式。

## 2026-06-25 后台主按钮清新绿色回调进度报告

- 分支：`codex/backend-platform`
- 完成内容：按人工反馈把后台主按钮从偏亮、偏糖果感的薄荷绿回调为前台同系的清新 emerald 绿白搭配；只调整按钮颜色、边框和轻阴影，不改卡片结构、圆角、高度和后台布局。同时保留未登录成本预估接口的 mock 回落修复，避免首页未登录时 `/api/generation/estimate-cost` 返回 401。
- 修改文件：`assets/admin-visual-polish.css`、`server.js`、`scripts/smoke-api.ps1`、`docs/design-references/admin-2026-06-25/admin-ui-smoke-*.png`、`docs/design-references/admin-2026-06-25/settings-save-button-fresh-green-desktop-1440x900.png`、`docs/progress-report.md`、`docs/feature-completion-checklist.md`、`docs/review-log.md`
- 验证方式：Playwright 跑 `scripts\smoke-admin-ui.ps1`；单独读取 `/admin/settings` 的 `保存设置` 按钮 computed style 并截图；执行 `node --check server.js`、`node --check assets\home-carousel-inertia.js`。
- 验证结果：后台 UI smoke 通过；`保存设置` 背景为 `rgb(16, 185, 129)`，文字为 `rgb(255, 255, 255)`，边框为 `rgba(16, 185, 129, 0.9)`，阴影为轻量 `rgba(16, 185, 129, 0.18)`；截图 `settings-save-button-fresh-green-desktop-1440x900.png` 已归档。
- 当前完成度：首页约 79%，模板约 94%，图库约 96%，用户中心约 93%，后台约 99%，后端平台护栏约 83%，测试护栏约 99%，部署护栏约 96%。
- 新发现问题：当前只是按钮颜色统一，后台每页标题、图标、按钮字距、排版仍需要继续逐页截图复核。
- 未完成清单：首页/画布主流程继续复核；后台复杂表单保存后刷新回显继续人工确认；New-API 真实 token 后续接入；服务器 Nginx/HTTPS 部署演练。
- 下一轮建议：继续按后台 10 页截图逐页看标题、图标、按钮和表格密度，优先修肉眼明显问题。
- 需要人工介入：人工确认新的绿色白字按钮是否比截图里的浅薄荷按钮舒服。

## 2026-06-25 首页/画布入口 UI Smoke 进度报告

- 分支：`codex/backend-platform`
- 完成内容：新增首页/画布主流程 UI smoke，自动打开首页检查品牌、Beta、主标题、历史画布、新画布、模板和图库入口，并确认历史画布拖动惯性脚本已 ready；随后打开画布页，确认 Vue Flow 画布、工具栏和节点内容可渲染。修复未登录访问 `/api/user/api-status` 返回 401 的控制台噪声，改为 mock 状态兜底。
- 修改文件：`scripts/smoke-home-canvas-ui.ps1`、`scripts/smoke-home-canvas-ui-runner.js`、`scripts/preflight-check.ps1`、`scripts/verify-internal-deploy.ps1`、`scripts/smoke-api.ps1`、`server.js`、`docs/design-references/frontend-2026-06-25/home-dashboard-smoke-desktop-1440x900.png`、`docs/design-references/frontend-2026-06-25/canvas-open-smoke-desktop-1440x900.png`、`docs/progress-report.md`、`docs/feature-completion-checklist.md`、`docs/review-log.md`
- 验证方式：执行 `scripts\smoke-home-canvas-ui.ps1`、`scripts\smoke-api.ps1`、`scripts\smoke-frontend-routes.ps1`、`node --check server.js`、`node --check assets\home-carousel-inertia.js`、`node --check scripts\smoke-home-canvas-ui-runner.js`；使用 `HOST_PORT=3457` 执行 `scripts\verify-internal-deploy.ps1` 重新构建 Docker。
- 验证结果：首页/画布 UI smoke 通过：首页 `inertiaReady=1`、历史卡片 1 个；画布 Vue Flow 存在、节点 2 个；console 0 error、badResponses 0；API smoke 已覆盖 public `/api/user/api-status` 和 public `/api/generation/estimate-cost`；Docker `3457` 重新构建后 health、API smoke、前端路由 smoke、restart persistence smoke 均通过。
- 当前完成度：首页约 82%，模板约 94%，图库约 96%，用户中心约 93%，画布约 90%，后台约 99%，后端平台护栏约 84%，测试护栏约 99%，部署护栏约 96%。
- 新发现问题：画布打开时仍会出现本地自动保存提醒，这是本地优先策略下的预期提醒，不是 console error；后续人工测试时需要确认提示文案是否干扰。
- 未完成清单：后台 10 页继续逐页视觉复核；首页/画布移动端专项截图还需继续补；New-API 真实 token 后续接入；服务器 Nginx/HTTPS 部署演练。
- 下一轮建议：继续做后台视觉逐页复核，先看 Dashboard、用户、订单、日志的标题、按钮、图标和表格密度。
- 需要人工介入：人工确认首页和画布两张 smoke 截图是否接受；确认 Docker 继续使用 `3457` 作为本机测试端口。

## 2026-06-25 后台 10 页视觉审计护栏进度报告

- 分支：`codex/backend-platform`
- 完成内容：重跑后台 10 页桌面截图：Dashboard、用户、订单、日志、兑换码、API 线路、模型价格、任务监控、模板工作流、系统设置；增强 `scripts/smoke-admin-pages-ui-runner.js`，让后台截图不只检查页面打开，还自动审计标题颜色/字重、旧薄荷按钮残留、表格行高、sticky 操作列宽度和按钮样本。
- 修改文件：`scripts/smoke-admin-pages-ui-runner.js`、`docs/design-references/admin-2026-06-25/full-*.png`、`docs/progress-report.md`、`docs/feature-completion-checklist.md`、`docs/review-log.md`
- 验证方式：执行 `node --check scripts\smoke-admin-pages-ui-runner.js` 和 `scripts\smoke-admin-pages-ui.ps1`。
- 验证结果：后台 10 页截图全部通过；标题颜色均为深色 `rgb(2, 6, 23)`，标题字重均为 `900`；旧薄荷按钮残留为 0；表格行高最大 85px，未超过 92px；sticky 操作列宽度为 226px，未超过 245px；页面均非 404/500。
- 当前完成度：首页约 82%，模板约 94%，图库约 96%，用户中心约 93%，画布约 90%，后台约 99%，后端平台护栏约 84%，测试护栏约 99%，部署护栏约 96%。
- 新发现问题：用户管理、API 线路、任务监控这类宽表仍依赖横向滚动和固定操作列；目前可测，后续如追更高体验，建议改成“更多操作”菜单或详情抽屉。
- 未完成清单：后台复杂表单保存后刷新回显继续人工确认；后台移动端表格体验还未做专项；New-API 真实 token 后续接入；服务器 Nginx/HTTPS 部署演练。
- 下一轮建议：继续做后台保存回显链路，优先系统设置、API 线路、模型价格、模板工作流。
- 需要人工介入：人工看 10 张 `full-*.png`，确认当前后台工具台风格是否接受。

## 2026-06-25 后台保存刷新回显 UI 验证进度报告

- 分支：`codex/backend-platform`
- 完成内容：新增后台保存/刷新回显 UI smoke，覆盖系统设置、API 线路、模型价格、模板工作流四条复杂配置链路。脚本会写入临时配置，打开真实后台页面截图确认刷新后可回显，再自动恢复系统设置、模板工作流，并删除临时 API 线路和模型，避免污染人工测试库；同时把该 smoke 接入 `SMOKE_UI=true` 的预检和 Docker 部署验证链。
- 修改文件：`scripts/smoke-admin-save-echo-ui.ps1`、`scripts/smoke-admin-save-echo-ui-runner.js`、`scripts/preflight-check.ps1`、`scripts/verify-internal-deploy.ps1`、`docs/design-references/admin-2026-06-25/save-echo-*.png`、`docs/progress-report.md`、`docs/feature-completion-checklist.md`、`docs/review-log.md`
- 验证方式：执行 `node --check scripts\smoke-admin-save-echo-ui-runner.js`、`scripts\smoke-admin-save-echo-ui.ps1`、`node --check server.js`、`node --check assets\home-carousel-inertia.js`、`scripts\smoke-frontend-routes.ps1`、`scripts\smoke-api.ps1`、`Invoke-RestMethod /api/health`、`docker compose -f docker-compose.internal.yml ps`、`git diff --check`、UTF-8 BOM 检查。
- 验证结果：后台保存刷新回显 UI smoke 通过，截图已归档：`save-echo-settings-desktop-1440x900.png`、`save-echo-api-provider-desktop-1440x900.png`、`save-echo-model-prices-desktop-1440x900.png`、`save-echo-template-workflows-desktop-1440x900.png`；前端路由 smoke、API smoke、`node --check`、`/api/health`、UTF-8 无 BOM 检查通过；Docker 容器 `dianshang-app` 为 healthy，映射 `3457->3456`；`git diff --check` 仅提示 PowerShell 文件未来可能被 Git 转 CRLF，无空白错误。
- 当前完成度：首页约 82%，模板约 94%，图库约 96%，用户中心约 93%，画布约 90%，后台约 99%，后端平台护栏约 85%，测试护栏约 99%，部署护栏约 96%。
- 新发现问题：Playwright CLI 的 `run-code` 在部分错误下会输出 `### Error` 但进程码仍为 0；本轮新脚本已额外检测该标记，避免误报通过。模板工作流新增未知分类模板不会直接显示，最终改为真实 UI 修改现有模板名并保存回显，再恢复原配置。
- 未完成清单：后台移动端表格体验还未专项优化；首页/画布移动端专项截图仍待补；New-API 真实 token 后续接入；服务器 Nginx/HTTPS 部署演练。
- 下一轮建议：继续做后台每页人工视觉细调，重点看图标、按钮字距、表格密度和空状态；随后补首页/画布移动端截图。
- 需要人工介入：人工确认四张 `save-echo-*.png` 的后台保存回显截图是否接受。

## 2026-06-25 移动端主流程 UI Smoke 加固进度报告

- 分支：`codex/backend-platform`
- 完成内容：加固 `scripts/smoke-mobile-ui.ps1` 与 runner，支持 `SMOKE_BASE_URL`，会自动打开 Playwright session，不再依赖已有浏览器状态；移动端 390x844 覆盖首页、模板、画布、用户兑换码、后台 Dashboard、后台 API 线路、后台模板工作流；新增横向溢出、首页标题拆字、画布 Vue Flow 节点、console error 和 4xx/5xx 响应检查；并把移动端 smoke 接入 `SMOKE_UI=true` 的预检和 Docker 部署验证链。
- 修改文件：`scripts/smoke-mobile-ui.ps1`、`scripts/smoke-mobile-ui-runner.js`、`scripts/preflight-check.ps1`、`scripts/verify-internal-deploy.ps1`、`docs/design-references/mobile-2026-06-25/*-mobile-390x844.png`、`docs/progress-report.md`、`docs/feature-completion-checklist.md`、`docs/review-log.md`
- 验证方式：执行 `node --check scripts\smoke-mobile-ui-runner.js`、`scripts\smoke-mobile-ui.ps1`、`node --check server.js`、`node --check assets\home-carousel-inertia.js`、`scripts\smoke-frontend-routes.ps1`、`scripts\smoke-api.ps1`、`Invoke-RestMethod /api/health`、`docker compose -f docker-compose.internal.yml ps`、`git diff --check`、UTF-8 BOM 检查。
- 验证结果：移动端 UI smoke 通过，7 个页面均无 404/500、无 console error、无 bad response；首页 `horizontalOverflow=0` 且标题未拆字；画布移动端 Vue Flow 存在且节点数为 2；Docker 容器 `dianshang-app` 为 healthy，映射 `3457->3456`；`git diff --check` 仅提示 PowerShell/JS 文件未来可能被 Git 转 CRLF，无空白错误。
- 当前完成度：首页约 84%，模板约 95%，图库约 96%，用户中心约 94%，画布约 91%，后台约 99%，后端平台护栏约 85%，测试护栏约 99%，部署护栏约 96%。
- 新发现问题：移动端后台页面能打开且无横向溢出，但后台复杂表格在 390 宽下仍偏“能用优先”，不是最终移动端精修形态。
- 未完成清单：后台移动端表格/弹窗体验还未专项卡片化；New-API 真实 token 后续接入；服务器 Nginx/HTTPS 部署演练。
- 下一轮建议：继续后台逐页视觉细调，优先查看截图里的图标大小、按钮字距、表格密度和空状态。
- 需要人工介入：人工查看 `docs/design-references/mobile-2026-06-25/` 的最新 390x844 截图，确认移动端主流程是否接受。

## 2026-06-25 后台移动端按钮与宽表视觉微调进度报告

- 分支：`codex/backend-platform`
- 完成内容：根据最新移动端后台截图，修复顶部操作按钮在 390 宽度下把“返回前台”拆成竖字的问题；后台移动端表格最小宽度从 760px 调整为 820px，并把 sticky 操作列从 226px 收窄到 188px，减少 API 线路等宽表右侧按钮对内容区的压迫。只改后台移动端 CSS，不改页面结构，不影响首页、模板、画布卡片。
- 修改文件：`assets/admin-visual-polish.css`、`docs/design-references/mobile-2026-06-25/admin-*.png`、`docs/progress-report.md`、`docs/feature-completion-checklist.md`、`docs/review-log.md`
- 验证方式：执行 `scripts\smoke-mobile-ui.ps1`、`node --check scripts\smoke-mobile-ui-runner.js`、`node --check server.js`、`node --check assets\home-carousel-inertia.js`、`scripts\smoke-frontend-routes.ps1`、`scripts\smoke-api.ps1`、`Invoke-RestMethod /api/health`、`docker compose -f docker-compose.internal.yml ps`、`git diff --check`、UTF-8 BOM 检查；并人工查看 `admin-dashboard-mobile-390x844.png`、`admin-api-providers-mobile-390x844.png`、`admin-template-workflows-mobile-390x844.png`。
- 验证结果：移动端 smoke 通过，7 个页面均无 404/500、无 console error、无 bad response；后台顶部“刷新 / 返回前台 / 退出”在移动端横向显示；API 线路移动端操作列更紧凑；Docker 容器 `dianshang-app` 仍为 healthy。
- 当前完成度：首页约 84%，模板约 95%，图库约 96%，用户中心约 94%，画布约 91%，后台约 99%，后端平台护栏约 85%，测试护栏约 99%，部署护栏约 96%。
- 新发现问题：后台移动端宽表仍是横向滚动策略，不是最终手机端卡片化设计；现阶段符合“内网人工可测”。
- 未完成清单：New-API 真实 token 后续接入；服务器 Nginx/HTTPS 部署演练；后台移动端如要正式给手机高频使用，后续再做卡片化。
- 下一轮建议：继续后台桌面 10 页逐页视觉细调，或进入 New-API mock/real 切换文档和测试护栏。
- 需要人工介入：人工确认三张后台移动端截图是否接受。

## 2026-06-25 New-API/CPA Provider 护栏进度报告

- 分支：`codex/backend-platform`
- 完成内容：新增 `scripts/smoke-provider-guard.ps1`，验证本项目 Provider Adapter 默认走 New-API 边界，并在未启用真实 AI 或缺少有效 key 时保持 mock 回落；脚本检查 `/api/health` 的 `gateway=new-api`、`routesThroughNewApi=true`、`cpaExpectedBehindNewApi=true`，并验证后台 API 线路测试与 `/api/chat/completions` 在 mock 模式下不会调用真实外部服务。已接入 `preflight-check.ps1` 和 `verify-internal-deploy.ps1` 默认验证链。
- 修改文件：`scripts/smoke-provider-guard.ps1`、`scripts/preflight-check.ps1`、`scripts/verify-internal-deploy.ps1`、`docs/deployment.md`、`docs/progress-report.md`、`docs/feature-completion-checklist.md`、`docs/review-log.md`
- 验证方式：执行 `scripts\smoke-provider-guard.ps1`、`node --check server.js`、`node --check assets\home-carousel-inertia.js`。
- 验证结果：Provider guard 通过：`gateway=new-api`，当前为 mock 模式，后台线路测试返回 `mock:true`，`/api/chat/completions` 返回本地 mock 响应；没有真实 New-API key 时不会误打外部服务。
- 当前完成度：首页约 84%，模板约 95%，图库约 96%，用户中心约 94%，画布约 91%，后台约 99%，后端平台护栏约 86%，New-API 骨架约 78%，测试护栏约 99%，部署护栏约 96%。
- 新发现问题：真实 New-API token 尚未配置，脚本当前只证明 mock 回落安全；真实联通仍需你后续提供 `.env` 配置和 New-API 可访问地址。
- 未完成清单：New-API 真实 token 联通测试；服务器 Nginx/HTTPS 部署演练；真实模型返回结构接入后的模板/图库再验收。
- 下一轮建议：补服务器部署前检查脚本或 New-API 真实联通测试说明，等你给 token 后再跑真实连接。
- 需要人工介入：后续真实 New-API 地址、token、模型白名单和 CPA 后置渠道由你配置，不会提交到 Git。

## 2026-06-25 API 线路弹窗可读性修复进度报告

- 分支：`codex/backend-platform`
- 完成内容：修复后台“编辑 API 线路”弹窗看不懂的问题。新增 `assets/admin-api-form-labels.js`，在 API 线路新增/编辑弹窗打开时自动给 18 个字段补充中文字段名和说明，包括 Base URL、API Key、默认聊天模型、默认生图模型、线路倍率、默认线路等；同时在 `assets/admin-visual-polish.css` 中补字段标签样式，让标签为深灰、说明为浅灰，避免只有一堆白色输入框。
- 修改文件：`assets/admin-api-form-labels.js`、`assets/admin-visual-polish.css`、`index.html`、`docs/progress-report.md`、`docs/feature-completion-checklist.md`、`docs/review-log.md`
- 验证方式：Playwright 打开 `/admin/api-providers` 并点击首个 `编辑`，读取弹窗内 `.admin-api-field-label`；执行 `node --check assets\admin-api-form-labels.js`、`node --check server.js`、`scripts\smoke-frontend-routes.ps1`。
- 验证结果：弹窗识别到 18 个字段标签，包含 `Base URL *`、`API Key`、`默认聊天模型`、`默认生图模型` 等；JS 语法检查、后端语法检查和前端路由 smoke 均通过。后续如需截图，可重新打开弹窗确认深色标签。
- 当前完成度：首页约 84%，模板约 95%，图库约 96%，用户中心约 94%，画布约 91%，后台约 99%，后端平台护栏约 86%，New-API 骨架约 79%，测试护栏约 99%，部署护栏约 96%。
- 新发现问题：原打包前端的 API 线路弹窗没有字段 label，只依赖 placeholder；有值后用户无法判断字段含义。
- 未完成清单：用户手动填入真实 New-API 配置后，需要继续补真实 `/api/template/reverse-prompt` 和 `/api/template/generate-image` 调用链。
- 下一轮建议：等你填好一个 New-API 线路后，先测后台“测试连接”和 `/api/chat/completions`，再补模板反推/生图真实调用。
- 需要人工介入：真实 New-API Base URL、API Key、默认模型名由你手动填写，不会提交到 Git。

## 2026-06-25 画布生图接通排查与 Provider 图片链路进度报告

- 分支：`codex/backend-platform`
- 完成内容：排查画布截图里的 `Failed to fetch` 与破图问题。确认当前 `.env` 已读取到 key，但 `/api/health` 仍显示 `ENABLE_REAL_AI=false`，所以真实 New-API 尚未启用；同时将 `/api/generate/tasks` 和 `/api/template/generate-image` 接入 `callProviderImageGeneration`，真实启用后会调用 New-API/OpenAI-compatible `/images/generations`，未启用时继续 mock 回落。新增 `/api/proxy-image`，上游返回远程图片时转成本地同源代理地址，降低浏览器二次保存/读取图片时的跨域 `Failed to fetch` 风险；模板生图改为 provider 成功后再扣余额。
- 修改文件：`server.js`、`.env.example`、`docs/progress-report.md`、`docs/feature-completion-checklist.md`、`docs/review-log.md`
- 验证方式：执行 `node --check server.js`、`node --check assets\home-carousel-inertia.js`、`scripts\smoke-provider-guard.ps1`、`scripts\smoke-frontend-routes.ps1`、`scripts\smoke-api.ps1`；重启本地 Node；读取 `/api/health`；调用 `/api/generate/tasks` 和 `/api/template/generate-image` 并检查返回图片地址 200；尝试 `docker compose -f docker-compose.internal.yml up --build -d` 重建容器。
- 验证结果：本地 Node 验证通过；`/api/health` 显示 `gateway=new-api`、`textKeyConfigured=true`、`imageKeyConfigured=true`、但 `enabled=false`，原因是 `.env` 未设置 `ENABLE_REAL_AI=true`；画布生图接口返回 `success=true`、`mock=true`、结果图 `/api/mock-image/...svg` 可 200 打开；模板生图接口同样通过；Provider guard、前端路由 smoke、API smoke 均通过。Docker Desktop 重建失败：`commit failed: write ... metadata.db: input/output error`；随后 `docker compose ps` 返回 `Docker Desktop is unable to start`，容器侧暂不可作为本轮验收依据。
- 当前完成度：首页约 84%，模板约 95%，图库约 96%，用户中心约 94%，画布约 92%，后台约 99%，后端平台护栏约 87%，New-API 骨架约 84%，测试护栏约 99%，部署护栏约 96%。
- 新发现问题：只保存 `AI_API_BASE/AI_TEXT_KEY/AI_IMAGE_KEY` 不会打开真实调用；必须手动加 `ENABLE_REAL_AI=true` 并重启服务。当前真实 New-API `/images/generations` 尚未实测，等待人工确认启用。Docker Desktop 出现内部 metadata.db 写入失败，随后引擎不可用，需重启 Docker Desktop 后再重建容器。
- 未完成清单：真实 New-API 生图联通测试；真实返回图片经过代理后的画布显示截图；模板反推仍是 mock，后续接文本 provider。
- 下一轮建议：你确认要真实试跑时，在 `.env` 加 `ENABLE_REAL_AI=true` 后重启本地 Node，我再跑一次 `/api/health` 和真实生图接口；如果上游模型名或 endpoint 不兼容，再按 New-API 返回错误微调。Docker 侧先重启 Docker Desktop，再重建 `3457` 容器。
- 需要人工介入：真实调用可能产生费用，`ENABLE_REAL_AI=true` 需要你手动开启；真实 key 不提交 Git。Docker Desktop 需要人工重启一次以清掉 metadata.db 写入异常。

## 2026-06-25 New-API 真实联通测试进度报告

- 分支：`codex/backend-platform`
- 完成内容：用户在 `.env` 末尾加入 `ENABLE_REAL_AI=true` 后，重启本地 Node 并确认真实 Provider 开关生效；将本地 `.env` 的 API Base 从 `https://www.packyapi.com` 调整为 `https://www.packyapi.com/v1`，因为根路径返回网页 HTML，不是 API JSON；修复 `callProviderChat`，避免 Provider 返回 HTML 200 时被误判为“连接正常”。
- 修改文件：`server.js`、`docs/progress-report.md`、`docs/review-log.md`
- 验证方式：读取 `/api/health`；后台 API 线路测试 `/api/admin/api-providers/:id/test`；调用 `/api/generate/tasks` 测试真实生图；执行 `node --check server.js`。
- 验证结果：`/api/health` 已显示 `enabled=true`、`mode=real-provider-ready`、`baseUrl=https://www.packyapi.com/v1`；后台文本 ping 通过，New-API 网关连接正常，延迟约 3.9 秒；真实生图未通过，上游返回：`分组 codex 下模型 gpt-image-2 无可用渠道（distributor）`；`node --check server.js` 通过。
- 当前完成度：首页约 84%，模板约 95%，图库约 96%，用户中心约 94%，画布约 92%，后台约 99%，后端平台护栏约 88%，New-API 骨架约 86%，测试护栏约 99%，部署护栏约 96%。
- 新发现问题：Packy/New-API token 所属 `codex` 分组没有可用的 `gpt-image-2` 生图渠道；这是上游 New-API/渠道配置问题，不是本地前端或本地后端接口未接通。Docker Desktop 仍需重启后再重建容器。
- 未完成清单：在 Packy/New-API 后台给 `codex` 分组配置可用生图渠道，或换一个有生图权限/分组的 key；配置完成后重新测试 `/api/generate/tasks` 和画布节点。
- 下一轮建议：先在 New-API/Packy 后台处理“分组 codex + gpt-image-2 生图渠道”问题；若模型名不同，把 `.env` 的 `AI_IMAGE_MODEL` 改成后台实际可用的生图模型名。
- 需要人工介入：New-API/Packy 后台渠道、分组、模型权限需要你登录后台处理；真实生图测试可能产生费用。

## 2026-06-25 画布生图模型类型保护进度报告

- 分支：`codex/backend-platform`
- 完成内容：复核画布生图模型选择链路。确认 `/api/model-routes?group=image` 返回的是图片模型，`/api/model-routes?group=text` 返回的是文本模型；但后端图片生成入口此前没有强制校验模型类型，若前端误传文本模型，可能会拿文本模型去请求图片接口。本轮新增 `resolveImageModelKey` 和 `looksLikeImageModel`，让 `/api/generate/tasks` 与 `/api/template/generate-image` 只使用图片模型；前端误传 `gpt-5.5` 时自动回落到 `AI_IMAGE_MODEL` 或默认图片模型。
- 修改文件：`server.js`、`docs/progress-report.md`、`docs/review-log.md`
- 验证方式：执行 `node --check server.js`；重启本地 Node；故意向 `/api/generate/tasks` 传入 `model=gpt-5.5`。
- 验证结果：语法检查通过；故意传文本模型后，后端实际回落到 `gpt-image-2`，上游返回仍为 `分组 codex 下模型 gpt-image-2 无可用渠道`，证明不再拿文本模型去打生图接口。额外测试 `gemini-3-pro-image-preview` 时，上游返回 `当前令牌未覆盖供应商 Google（已选分组=[codex mimo-officially]）`，说明 Packy token/分组仍未覆盖对应供应商。
- 当前完成度：首页约 84%，模板约 95%，图库约 96%，用户中心约 94%，画布约 93%，后台约 99%，后端平台护栏约 88%，New-API 骨架约 87%，测试护栏约 99%，部署护栏约 96%。
- 新发现问题：本地画布模型列表不是文本/图片混用，但“线路/分组选择”并不会自动改变 Packy token 的上游分组权限；Packy 仍按 token 覆盖的分组和供应商判断。
- 未完成清单：Packy/New-API 后台需要给当前 token 开通可用生图供应商和模型渠道；或改用已覆盖对应供应商/分组的 token。
- 下一轮建议：先在 Packy 后台确认当前 token 覆盖的供应商和分组；如果可用模型不是 `gpt-image-2`，把 `.env` 的 `AI_IMAGE_MODEL` 改为真实可用模型，再复测画布节点。
- 需要人工介入：Packy/New-API 的 token 分组、供应商覆盖和渠道配置需要你登录后台确认。

## 2026-06-25 真实生图联通成功进度报告

- 分支：`codex/backend-platform`
- 完成内容：用户把 key 换成生图可用 key 后，重启本地 Node 并重新测试 New-API/Packy 生图链路；补充 `makeTaskResponse` 的 `modelKey/model` 兼容字段，避免任务响应顶层模型字段为空。
- 修改文件：`server.js`、`docs/progress-report.md`、`docs/review-log.md`、`docs/feature-completion-checklist.md`
- 验证方式：读取 `/api/health`；读取 Packy `/v1/models`；调用 `/api/generate/tasks`，模型 `gpt-image-2`，并请求返回的 `/api/proxy-image?...`。
- 验证结果：`/api/health` 显示 `enabled=true`、`mode=real-provider-ready`；Packy `/v1/models` 返回 `gemini-3.1-flash-image-preview`、`gemini-3-pro-image-preview`、`gpt-image-2`；`/api/generate/tasks` 返回 `success=true`、`mock=false`、`status=success`，结果图走 `/api/proxy-image`，HTTP 200。
- 当前完成度：首页约 84%，模板约 95%，图库约 96%，用户中心约 94%，画布约 94%，后台约 99%，后端平台护栏约 89%，New-API 骨架约 90%，测试护栏约 99%，部署护栏约 96%。
- 新发现问题：真实生图已通，但 Docker Desktop 仍需重启并重建容器；本轮成功基于本地 Node `3456`。
- 未完成清单：在浏览器画布节点上人工点一次生成，确认 UI 节点出图、图库历史和余额流水；模板页真实生图也需要点测。
- 下一轮建议：先在画布页面用当前 `GPT Image 2（6789）` 点一次生成；若 UI 仍报错，再看浏览器 console/network。
- 需要人工介入：真实生图会消耗额度，人工点测时注意成本。

## 2026-06-25 Packy 生图参数兼容修复进度报告

- 分支：`codex/backend-platform`
- 完成内容：根据画布截图里的 `Unknown parameter: 'response_format'`，移除 `/images/generations` 请求体中的 `response_format` 参数；同时将图片生成超时从文本默认 30 秒独立提升到 180 秒，保留文本请求 30 秒不变。
- 修改文件：`server.js`、`docs/progress-report.md`、`docs/review-log.md`
- 验证方式：重启本地 Node；读取 `/api/health` 确认 `imageTimeoutMs=180000`；调用 `/api/generate/tasks` 使用 `gpt-image-2` 真实生图，并请求返回的 `/api/proxy-image?...`。
- 验证结果：`/api/health` 显示 `enabled=true`、`mode=real-provider-ready`、`imageTimeoutMs=180000`；真实生图约 27 秒返回 `success=true`、`mock=false`、`model=gpt-image-2`，结果图代理 HTTP 200。
- 当前完成度：首页约 84%，模板约 95%，图库约 96%，用户中心约 94%，画布约 95%，后台约 99%，后端平台护栏约 90%，New-API 骨架约 92%，测试护栏约 99%，部署护栏约 96%。
- 新发现问题：真实生图耗时明显高于 30 秒，前端画布节点需要允许等待，不应按文本请求超时判断失败。
- 未完成清单：浏览器画布节点真实点击生成还需人工复核；模板页真实生图还需点测；Docker 容器仍需重建。
- 下一轮建议：你在画布里点一次生成；如果仍显示错误，优先看前端节点自己的等待/轮询/保存逻辑。
- 需要人工介入：真实生图会消耗额度。

## 2026-06-26 源码化技术栈任务树启动进度报告

- 分支：`codex/source-stack-canvas-rebuild`
- 完成内容：按用户要求把主工作目录固定为 `F:\dianshang`，启动 Lane A/B/C/D/E 的第一批纪律基线。已在 `AGENTS.md` 和 `README.md` 写入阶段门禁、禁止搓轮子、CodeGraph 索引、环境确认、新增 npm 包确认、成熟开源基座和维护测试命令。已新增 `docs/api-contract-next.md` 固化新前端 API 契约初版，新增 `docs/backend-module-boundaries.md` 定义后端模块边界，新增 `docs/canvas-migration-checklist.md` 定义 Vue Flow 画布迁移清单。已把 `.codegraph/` 加入 `.gitignore`，避免本地索引产物入库。
- 修改文件：`.gitignore`、`AGENTS.md`、`README.md`、`docs/api-contract-next.md`、`docs/backend-module-boundaries.md`、`docs/canvas-migration-checklist.md`、`docs/plans/2026-06-26-source-stack-canvas-rebuild-plan.md`、`docs/iteration-review-checklist.md`、`docs/known-gaps.md`、`docs/feature-completion-checklist.md`、`docs/progress-report.md`、`docs/review-log.md`
- 验证方式：检查 CodeGraph 状态；运行 `npm run build --prefix "F:\dianshang\frontend"`；运行 `git -C "F:\dianshang" diff --check`；对本轮新增和修改的文本文件做 UTF-8 BOM 检查。
- 验证结果：CodeGraph 已初始化并可用；`npm run build --prefix "F:\dianshang\frontend"` 通过，Vite 仅提示已有大 chunk 警告；`git -C "F:\dianshang" diff --check` 通过，仅有 Git 的 LF/CRLF 提示；本轮文件 UTF-8 无 BOM 检查通过。后端代码未改，本轮不跑后端 smoke。
- 当前完成度：源码化纪律基线约 70%，API 契约初版约 40%，后端边界文档约 35%，新版画布迁移清单约 45%，实际画布功能迁移仍保持上一阶段状态。
- 新发现问题：旧计划文档里仍有原桌面目录路径，本轮已改为 `F:\dianshang`；旧缺口文档里 CodeGraph 状态过期，本轮已改为已初始化。
- 未完成清单：API 契约还需要逐项用真实路由和响应样例复核；后端模块边界还未映射到全部 SQLite 表和错误码；新版 `/canvas` 还需要人工点测第一阶段能力；NestJS/Prisma/Postgres/Redis/BullMQ/MinIO/S3 尚未创建或安装。
- 下一轮建议：先人工验收 `AGENTS.md` 和 README 规则是否足够严格；确认后进入 API 契约复核和新版画布点测，不先拆 `server.js`。
- 需要人工介入：如果下一轮要新增任何 npm 包、下载成熟开源基座源码、安装数据库/Redis/Docker 服务或开启真实外部服务，必须先由用户确认。

## 2026-06-26 哈基米旧画布 UI 迁移进度报告

- 分支：`codex/source-stack-canvas-rebuild`
- 完成内容：根据用户截图确认，新版 Vue Flow 画布的整体 UI、布局和卡片板块继续沿用哈基米旧画布，而不是 Vue Flow 默认 UI，也不是 `Infinite-Canvas-main.zip` 的浅色项目管理画布。已把 `frontend/src/views/CanvasStudio.vue` 改为顶部旧画布动作条、左侧浅色 Canvas Chat、右侧黑色 Create Node 面板、暗色点阵画布；节点卡片改为旧画布风格深色卡片。Vue Flow 仍只负责底层拖拽、缩放、连线、Handle、Background、Controls、MiniMap。
- 修改文件：`frontend/src/views/CanvasStudio.vue`、`frontend/src/styles/app.css`、`frontend/src/stores/canvas.ts`、`frontend/src/types/canvas.ts`、`docs/design-references/canvas-hjm-legacy-layout-final-2026-06-26.png`
- 验证方式：运行 `npm run build --prefix "F:\dianshang\frontend"`；运行 `git -C "F:\dianshang" diff --check`；使用本机 Chrome 打开 `http://127.0.0.1:5173/canvas` 截图并检查左侧 Chat、右侧 Create Node、顶部动作条、节点数量、横向溢出和节点是否被左侧面板遮挡。
- 验证结果：前端构建通过，只有 Vite 大 chunk 既有警告；diff 空白检查通过，仅有 Git LF/CRLF 提示；浏览器验证显示 `leftChat=true`、`rightCreate=true`、`topActions=true`、`productNodes=4`、`noOverlap=true`、`scrollWidth=clientWidth=2048`。截图已保存到 `docs/design-references/canvas-hjm-legacy-layout-final-2026-06-26.png`。
- 新发现问题：浏览器首次监听到一个 404 console 提示，但复查 response 没有实际坏响应，疑似 favicon 或瞬时资源提示；当前不阻塞 UI 验收。
- 未完成清单：右侧创建节点面板目前先接入商品素材、提示词、图片生成、结果和模板重置；撤销/重做、历史记录、恢复图片、真实 Canvas Chat 生图还需接业务接口。
- 下一轮建议：继续按哈基米旧画布补卡片细节和交互：顶部历史记录、恢复图片、左侧快速模式真实提交、右侧节点菜单完整分类、节点选中后的参数浮层。

## 2026-06-26 Infinite-Canvas 全量节点注册与提示词模板迁移进度报告

- 分支：`codex/source-stack-canvas-rebuild`
- 完成内容：按 `Infinite-Canvas-main/static/js/canvas.js` 和 `static/js/i18n/canvas.js` 梳理节点类型，并在新 Vue Flow 画布中注册第一批全量节点：`image`、`prompt`、`loop`、`llm`、`generator`、`msgen`、`video`、`rh`、`comfy`、`ltxDirector`、`output`、`group`、`promptGroup`。右侧 Create Node 菜单已改为从节点清单创建；每类节点都有默认数据结构、可保存、可导出、可选中编辑，并有前端运行状态。已把 `Infinite-Canvas-main/static/system-prompts/infinite-canvas-prompt-templates.md` 复制到 `frontend/public/system-prompts/infinite-canvas-prompt-templates.md`，新版提示词节点可加载、搜索并应用模板。
- 修改文件：`frontend/src/types/canvas.ts`、`frontend/src/stores/canvas.ts`、`frontend/src/views/CanvasStudio.vue`、`frontend/src/styles/app.css`、`frontend/public/system-prompts/infinite-canvas-prompt-templates.md`、`docs/progress-report.md`、`docs/review-log.md`、`docs/feature-completion-checklist.md`
- 验证方式：运行 `npm run build --prefix "F:\dianshang\frontend"`；浏览器打开 `http://127.0.0.1:5173/canvas`，依次点击 13 类节点菜单并点击“运行节点”；验证模板库按钮数量、模板应用、节点数量、状态分布和输出字段。
- 验证结果：构建通过，只有 Vite 大 chunk 既有警告。浏览器验证显示 13 类节点全部可创建；默认 4 节点加 13 类新增节点后本地快照 `nodeCount=17`；逐个运行后状态分布为 `ready=8`、`done=8`、`idle=1`，存在图片输出和视频输出；提示词模板库加载出 8 个可见模板项并可应用。截图已保存到 `docs/design-references/canvas-infinite-all-nodes-2026-06-26.png`。
- 新发现问题：当前“运行节点”是前端状态和示例输出跑通，`generator/msgen/video/rh/comfy/ltxDirector/llm` 还未分别接真实 Provider、ModelScope、视频 API、RunningHub、ComfyUI、LTX 和 LLM 后端执行器。浏览器仍偶发一个无 URL 的 404 console 文案，复查 response 未发现实际坏请求，暂不阻塞。
- 未完成清单：真实运行器接入；撤销/重做历史栈；顶部恢复图片和历史记录；工作流模板导入导出；资产库/日志面板；节点级连接顺序和输入引用解析；Comfy/RH/LTX 参数编辑面板。
- 下一轮建议：按 Infinite-Canvas 源码继续迁移“运行器层”：先接 `generator` 到当前 `/api/generate/tasks`，再接 `llm` 到 `/api/chat/completions`，最后按环境确认接 ComfyUI、RunningHub、LTX、视频生成。

## 2026-06-26 Infinite-Canvas 运行适配器接入进度报告

- 分支：`codex/source-stack-canvas-rebuild`
- 完成内容：新增 `frontend/src/api/canvasRunner.ts`，把新画布节点运行逻辑从组件中抽出为适配器。适配器会按 Vue Flow 连线收集上游 Prompt 和参考图；`llm` 节点接 `/api/chat/completions`；`generator` 和 `msgen` 节点接 `/api/generate/tasks`；`video`、`ltxDirector`、`comfy`、`rh` 先跑通前端状态并明确提示真实执行器需要对应环境；`loop`、`image`、`prompt`、`group`、`promptGroup`、`output` 走本地状态更新。节点新增 `taskId/progress/cost/errorMessage` 字段，UI 会显示运行错误。
- 修改文件：`frontend/src/api/canvasRunner.ts`、`frontend/src/types/canvas.ts`、`frontend/src/views/CanvasStudio.vue`、`frontend/src/styles/app.css`、`docs/canvas-migration-checklist.md`、`docs/progress-report.md`、`docs/review-log.md`、`docs/feature-completion-checklist.md`
- 验证方式：运行 `npm run build --prefix "F:\dianshang\frontend"`；用全新无登录浏览器上下文打开 `/canvas`，清空 `auth_token`，分别运行 `API生成`、`LLM`、`ComfyUI`、`视频生成`。
- 验证结果：构建通过，只有 Vite 大 chunk 既有警告。无登录验证中，`API生成` 和 `LLM` 正确请求本地后端并得到 401，节点进入 `error`，错误信息为 `未登录，无法调用后端执行器。请登录后重试。`；`ComfyUI` 节点进入 `done` 并产生示例图片；`视频生成` 节点进入 `done` 并产生示例视频。截图保存到 `docs/design-references/canvas-runner-adapter-nonpaid-2026-06-26.png`。
- 新发现问题：真实登录后运行 `generator` 可能消耗算力；本轮没有用登录 token 跑真实生图，符合真实付费调用需人工确认的规则。
- 未完成清单：登录态下 `generator` 真实运行人工验收；`llm` 真实模型回复人工验收；`msgen` 是否需要独立 ModelScope 后端通道待确认；`ComfyUI/RH/LTX/video` 真实执行器需要环境地址、密钥或服务确认。
- 下一轮建议：先在不新增后端栈的前提下补“运行器覆盖”：`generator` 真实登录态人工点测、`llm` 登录态文本改写点测；随后按你确认的环境接 ComfyUI 或 RunningHub。

## 2026-06-26 源码前端未登录边界与自带浏览器点击进度报告

- 分支：`codex/source-stack-canvas-rebuild`
- 完成内容：继续推进 `frontend/` 源码化前端验收。修复源码前端 Playwright smoke 偶发卡死问题，将页面等待从 `networkidle` 改为 DOM 就绪加短暂稳定等待。补充未登录态边界检查，覆盖 `/gallery`、`/user/center`、`/user/records`、`/user/redeem` 的登录提示、预期 401 和横向溢出。按用户要求使用 Codex 自带浏览器从当前真实标签页点测 `/user/redeem`，完成兑换码填写但不提交、刷新、进入用户中心、跳图库、进入生成记录并搜索。
- 修改文件：`scripts/smoke-source-frontend-ui-runner.js`、`README.md`、`docs/feature-completion-checklist.md`、`docs/progress-report.md`、`docs/review-log.md`
- 验证方式：运行 `node --check "F:\dianshang\scripts\smoke-source-frontend-ui-runner.js"`；运行 `powershell -NoProfile -ExecutionPolicy Bypass -File "F:\dianshang\scripts\smoke-source-frontend-ui.ps1"`；使用 Codex 自带浏览器真实点击兑换页、用户中心、图库和生成记录。
- 验证结果：源码前端 smoke 29 秒通过，结果包含 `register`、`register-cleanup`、4 个 `unauth-*`、`login`、`home-index-user-navigation`、`gallery-search-refresh`、`template-switch-fill`、`records-search-refresh`、`redeem-fill-refresh`、`mobile-records`、`mobile-redeem` 和 `logout`；业务 API 无非预期 4xx/5xx，业务 console error 为 0。自带浏览器点测确认当前 admin 登录态下兑换页、用户中心、图库、生成记录路径正确，横向溢出均为 0。
- 当前完成度：源码化新栈约 63%，测试护栏约 99%。
- 新发现问题：Codex 自带浏览器环境会出现 Statsig 统计请求超时日志，来源不是本地业务页面；本轮仅以本地业务 API、DOM 和页面错误作为验收依据。早前已废止的新画布记录保留为历史，不代表后续继续推进新画布。
- 未完成清单：真实生成、真实兑换码提交、图库删除仍未自动执行，需人工确认费用和测试数据；后台源码化页面还未迁入 `frontend/`。
- 下一轮建议：继续做后台源码化边界盘点，或在你确认费用后补模板真实反推/生成的登录态人工验收。
- 需要人工介入：真实模型调用、兑换码提交和删除数据会产生费用或改变数据，执行前需要你确认。

## 2026-06-26 源码首页迁移看板增强进度报告

- 分支：`codex/source-stack-canvas-rebuild`
- 完成内容：继续推进 Vue3 前端工程化。首页 `HomeWorkbench` 新增迁移进度看板，直接从 `frontendMigrationRoutes` 计算源码页面、旧版桥接和总入口数量；新增阶段卡，明确“前台源码化 / 旧画布保留 / 后台迁移”的当前边界。未新增依赖、未新增接口、未触发真实生成或数据写入。
- 修改文件：`frontend/src/views/HomeWorkbench.vue`、`frontend/src/styles/app.css`、`scripts/smoke-source-frontend-ui-runner.js`、`docs/feature-completion-checklist.md`、`docs/progress-report.md`、`docs/review-log.md`
- 验证方式：运行 `where.exe npx`；运行 `node --check "F:\dianshang\scripts\smoke-source-frontend-ui-runner.js"`；运行 `npm.cmd run build --prefix "F:\dianshang\frontend"`；运行 `powershell -NoProfile -ExecutionPolicy Bypass -File "F:\dianshang\scripts\smoke-source-frontend-ui.ps1"`；使用 Codex 自带浏览器打开首页、检查统计和阶段卡、滚动到迁移索引并点击“模板生图”。
- 验证结果：`npx` 可用；前端构建通过；源码前端 smoke 通过，并新增断言首页统计必须包含 `8`、`13`、`21`，阶段卡必须包含“前台源码化 / 旧画布保留 / 后台迁移”。Codex 自带浏览器确认首页横向溢出为 0，统计为 8/13/21，点击“模板生图”后进入 `/template-image` 且页面横向溢出为 0。
- 当前完成度：源码化新栈约 65%，测试护栏约 99%。
- 新发现问题：CodeGraph 当前索引仍能看到早前已废止的新画布源码文件，说明索引滞后；本轮以磁盘文件和构建结果为准，后续如继续依赖 CodeGraph 需要重建索引或等待同步。
- 未完成清单：后台源码化还未开始；真实生成、真实兑换码提交、图库删除仍需人工确认后单独验收。
- 下一轮建议：进入后台源码化边界盘点，先把旧后台路由、接口和可迁移组件列清楚，再选择第一个低风险后台源码页。
- 需要人工介入：真实模型调用、兑换码提交和删除数据仍需确认；如要重建 CodeGraph 索引，需要确认是否运行索引命令。

## 2026-06-26 源码后台登录迁移进度报告

- 分支：`codex/source-stack-canvas-rebuild`
- 完成内容：将 `/admin/login` 从旧桥接改为 Vue3 源码页。新增 `frontend/src/api/adminAuth.ts` 复用 Axios 与 `/api/admin/login`；新增 `AdminLoginSource.vue`，支持默认管理员账号填写、管理员登录、源码前端 session 保存和成功态展示。首页迁移统计自动更新为 9 个源码页、12 个旧版桥接、21 个总入口。明确边界：源码前端 `5173` 与旧后台 `3456` localStorage 不共享，旧后台仍保留独立入口，不伪装成无缝登录桥接。
- 修改文件：`frontend/src/api/adminAuth.ts`、`frontend/src/views/AdminLoginSource.vue`、`frontend/src/router/index.ts`、`frontend/src/config/frontendMigration.ts`、`frontend/src/styles/app.css`、`scripts/smoke-source-frontend-ui-runner.js`、`README.md`、`docs/feature-completion-checklist.md`、`docs/progress-report.md`、`docs/review-log.md`
- 验证方式：运行 `node --check "F:\dianshang\scripts\smoke-source-frontend-ui-runner.js"`；运行 `npm.cmd run build --prefix "F:\dianshang\frontend"`；运行 `powershell -NoProfile -ExecutionPolicy Bypass -File "F:\dianshang\scripts\smoke-source-frontend-ui.ps1"`；使用 Codex 自带浏览器打开 `/admin/login`，填写 `admin/admin123`，点击“进入后台”，再跳 `/user/center` 复核 session。
- 验证结果：前端构建通过；源码前端 smoke 通过，结果新增 `admin-login-source ok`，首页统计断言更新为 9/12/21；Playwright 确认源码后台登录成功后 `auth_token/auth_user` 已写入。Codex 自带浏览器确认后台登录成功态可见，随后访问 `/user/center` 能读取到 `admin@local`、`admin` 角色和余额，页面横向溢出为 0。
- 当前完成度：源码化新栈约 68%，测试护栏约 99%。
- 新发现问题：不同端口的旧后台与源码前端不能共享 localStorage；后续如果要无缝后台体验，应该继续源码化后台页，而不是把 token 强行塞给旧后台。
- 未完成清单：后台 Dashboard、用户管理、订单、日志、任务监控、兑换码、API 线路、模型价格、模板工作流、系统设置仍是旧桥接；真实生成、兑换码提交和删除数据仍需人工确认。
- 下一轮建议：先迁移后台 Dashboard 只读概览页，复用现有后台 API，避免从高风险写入页开始。
- 需要人工介入：暂无新软件或新依赖；如果要测试旧后台写入操作，仍需确认测试数据。

## 2026-06-26 源码后台 Dashboard 迁移进度报告

- 分支：`codex/source-stack-canvas-rebuild`
- 完成内容：将 `/admin/dashboard` 从旧桥接改为 Vue3 源码只读页。新增 `frontend/src/api/adminDashboard.ts`，复用 `/api/admin/dashboard` 和 `/api/admin/dashboard/user-credit-ranking`；新增 `AdminDashboardSource.vue`，展示 6 张统计卡、模型使用、线路概览、用户消耗排行和最近生成任务；新增桌面和移动端样式。首页迁移统计更新为 10 个源码页、11 个旧版桥接、21 个总入口。
- 修改文件：`frontend/src/api/adminDashboard.ts`、`frontend/src/views/AdminDashboardSource.vue`、`frontend/src/router/index.ts`、`frontend/src/config/frontendMigration.ts`、`frontend/src/styles/app.css`、`scripts/smoke-source-frontend-ui-runner.js`、`README.md`、`docs/feature-completion-checklist.md`、`docs/progress-report.md`、`docs/review-log.md`
- 验证方式：运行 `node --check "F:\dianshang\scripts\smoke-source-frontend-ui-runner.js"`；运行 `npm.cmd run build --prefix "F:\dianshang\frontend"`；启动旧后端 `C:\Users\pc\Desktop\hjm-mb-clone` 作为 `3456` 稳定基线；启动 `F:\dianshang\frontend` Vite；运行 `powershell -NoProfile -ExecutionPolicy Bypass -File "F:\dianshang\scripts\smoke-source-frontend-ui.ps1"`；使用 Codex 自带浏览器打开 `/admin/dashboard` 并点击刷新。
- 验证结果：前端构建通过；源码前端 smoke 通过，新增 `admin-dashboard-source ok` 和 `mobile-admin-dashboard ok`，桌面 Dashboard 统计为 6 张卡、4 个面板、排行 8 行、任务 8 行，横向溢出为 0；390x844 移动端横向溢出为 0。Codex 自带浏览器确认 Dashboard 可见，点击“刷新”后仍保持 0 横向溢出。`F:\dianshang` 后端未安装依赖，直接运行会缺 `express`；本轮未擅自安装 npm 包，继续复用旧项目后端作为基线。
- 当前完成度：源码化新栈约 72%，测试护栏约 99%。
- 新发现问题：`F:\dianshang` 后端依赖未安装，若要让 F 盘目录独立启动旧后端，需要用户确认后再安装依赖；当前源码前端开发仍可通过旧项目 `3456` 后端验证。
- 未完成清单：后台用户管理、订单、日志、任务监控、兑换码、API 线路、模型价格、模板工作流、系统设置仍是旧桥接；后台写入类操作仍未自动测试。
- 下一轮建议：继续迁移后台用户管理只读列表，先做搜索/分页/刷新，不做删除、改余额、重置密码等写入动作。
- 需要人工介入：如需在 `F:\dianshang` 安装后端依赖或测试后台写入操作，需要用户确认。

## 2026-06-26 源码后台用户管理只读迁移进度报告

- 分支：`codex/source-stack-canvas-rebuild`
- 完成内容：将 `/admin/users` 从旧桥接改为 Vue3 源码只读页。新增 `frontend/src/api/adminUsers.ts` 归一化旧后端 `/api/admin/users` 的 `items/users/list/data` 字段；新增 `AdminUsersSource.vue`，展示用户总数、当前页用户、启用账户、管理员和当前页余额，支持关键词搜索、角色/状态前端筛选、分页和刷新。页面明确为只读，不提供删除、改余额、重置密码等后台写入动作。首页迁移统计更新为 11 个源码页、10 个旧版桥接、21 个总入口。
- 修改文件：`frontend/src/api/adminUsers.ts`、`frontend/src/views/AdminUsersSource.vue`、`frontend/src/router/index.ts`、`frontend/src/config/frontendMigration.ts`、`frontend/src/styles/app.css`、`scripts/smoke-source-frontend-ui-runner.js`、`README.md`、`docs/feature-completion-checklist.md`、`docs/progress-report.md`、`docs/review-log.md`
- 验证方式：确认 CodeGraph 状态；读取旧后端 `/api/admin/users` 响应样例；运行 `node --check "F:\dianshang\scripts\smoke-source-frontend-ui-runner.js"`；运行 `npm.cmd run build --prefix "F:\dianshang\frontend"`；复用旧项目后端 `C:\Users\pc\Desktop\hjm-mb-clone` 的 `3456`；运行 `powershell -NoProfile -ExecutionPolicy Bypass -File "F:\dianshang\scripts\smoke-source-frontend-ui.ps1"`；使用 Codex 自带浏览器打开 `/admin/users`，搜索 `admin` 并点击刷新。
- 验证结果：前端构建通过；源码前端 smoke 通过，新增 `admin-users-source ok` 和 `mobile-admin-users ok`，桌面用户页统计卡 5 张、搜索 `admin` 后 1 行、包含 `admin@local`，桌面和 390x844 移动端横向溢出均为 0。Codex 自带浏览器实际点击通过，返回 `title=用户管理`、`rows=1`、`hasAdmin=true`、`overflow=0`。本轮没有安装 `F:\dianshang` 根目录后端依赖。
- 当前完成度：源码化新栈约 75%，测试护栏约 99%。
- 新发现问题：CodeGraph 已初始化但当前 Vue 文件索引数量仍少于实际源码页面，结构分析需谨慎对照磁盘和构建结果；后续可在用户确认后重建索引。
- 未完成清单：后台订单、日志、任务监控、兑换码、API 线路、模型价格、模板工作流、系统设置仍是旧桥接；后台写入类操作仍需人工确认测试数据后再迁移或验收。
- 下一轮建议：继续做后台只读页，优先 `/admin/generate-tasks` 任务监控或 `/admin/logs` 消费日志；写入类页面继续保持旧桥接。
- 需要人工介入：如需安装 `F:\dianshang` 后端依赖、重建 CodeGraph 索引或测试后台写入操作，需要用户确认。

## 2026-06-26 源码后台任务监控只读迁移进度报告

- 分支：`codex/source-stack-canvas-rebuild`
- 使用技能：本轮评估网页相关 skill 后，采用 `Code`、`frontend-design` 和 `playwright`；暂不调用 `clone-website` 和 `design-review`。
- 完成内容：将 `/admin/generate-tasks` 从旧桥接改为 Vue3 源码只读页。新增 `frontend/src/api/adminGenerateTasks.ts` 归一化旧后端 `/api/admin/generate-tasks` 的 `items/tasks/list/data` 字段和 `summary`；新增 `AdminGenerateTasksSource.vue`，展示任务总数、成功、运行中、等待、失败、当前页消耗，支持关键词搜索、状态筛选、分页和刷新。页面明确为只读，不调用取消或删除任务接口。首页迁移统计更新为 12 个源码页、9 个旧版桥接、21 个总入口。
- 修改文件：`frontend/src/api/adminGenerateTasks.ts`、`frontend/src/views/AdminGenerateTasksSource.vue`、`frontend/src/router/index.ts`、`frontend/src/config/frontendMigration.ts`、`frontend/src/styles/app.css`、`scripts/smoke-source-frontend-ui-runner.js`、`README.md`、`docs/feature-completion-checklist.md`、`docs/progress-report.md`、`docs/review-log.md`
- 验证方式：检查 CodeGraph 状态；读取旧后端 `/api/admin/generate-tasks` 响应样例；运行 `node --check "F:\dianshang\scripts\smoke-source-frontend-ui-runner.js"`；运行 `npm.cmd run build --prefix "F:\dianshang\frontend"`；运行 `powershell -NoProfile -ExecutionPolicy Bypass -File "F:\dianshang\scripts\smoke-source-frontend-ui.ps1"`；使用 Codex 自带浏览器打开 `/admin/generate-tasks`，搜索 `simple` 并点击查询和刷新。
- 验证结果：前端构建通过；源码前端 smoke 通过，新增 `admin-generate-tasks-source ok` 和 `mobile-admin-generate-tasks ok`，桌面任务页统计卡 6 张、搜索 `simple` 后 2 行、包含 `gpt-image-2`，桌面和 390x844 移动端横向溢出均为 0。Codex 自带浏览器实际点击通过，返回 `title=任务监控`、`rows=2`、`statCards=6`、`hasModel=true`、`overflow=0`。本轮没有安装新依赖，没有安装 `F:\dianshang` 根目录后端依赖。
- 当前完成度：源码化新栈约 78%，测试护栏约 99%。
- 新发现问题：任务监控旧接口支持 `status` 服务端筛选，但不支持关键词服务端搜索；源码页先做当前页关键词筛选，后续接新后端时再补正式 query 契约。
- 未完成清单：后台消费日志、订单、兑换码、API 线路、模型价格、模板工作流、系统设置仍是旧桥接；任务取消/删除等写入能力仍未源码化。
- 下一轮建议：继续迁移 `/admin/logs` 消费日志只读页；写入类后台页继续保持旧桥接。
- 需要人工介入：如需安装新后端依赖、重建 CodeGraph 索引或测试任务取消/删除，需要用户确认。

## 2026-06-26 源码后台消费日志只读迁移进度报告

- 分支：`codex/source-stack-canvas-rebuild`
- 使用技能：继续采用 `Code`、`frontend-design` 和 `playwright`；本轮不调用克隆类或大审类 skill。
- 完成内容：将 `/admin/logs` 从旧桥接改为 Vue3 源码只读页。新增 `frontend/src/api/adminUsageLogs.ts` 归一化旧后端 `/api/admin/usage-logs` 的 `items/logs/list/data` 字段；新增 `AdminUsageLogsSource.vue`，展示日志总数、当前页收入、当前页消耗、生成记录和兑换记录，支持关键词搜索、类型筛选、分页和刷新。页面明确为只读，不调用余额调整接口。首页迁移统计更新为 13 个源码页、8 个旧版桥接、21 个总入口。
- 修改文件：`frontend/src/api/adminUsageLogs.ts`、`frontend/src/views/AdminUsageLogsSource.vue`、`frontend/src/router/index.ts`、`frontend/src/config/frontendMigration.ts`、`frontend/src/styles/app.css`、`scripts/smoke-source-frontend-ui-runner.js`、`README.md`、`docs/feature-completion-checklist.md`、`docs/progress-report.md`、`docs/review-log.md`
- 验证方式：检查 CodeGraph 状态；读取旧后端 `/api/admin/usage-logs` 响应样例；运行 `node --check "F:\dianshang\scripts\smoke-source-frontend-ui-runner.js"`；运行 `npm.cmd run build --prefix "F:\dianshang\frontend"`；运行 `powershell -NoProfile -ExecutionPolicy Bypass -File "F:\dianshang\scripts\smoke-source-frontend-ui.ps1"`；使用 Codex 自带浏览器打开 `/admin/logs`，搜索 `注册赠送` 并点击查询和刷新。
- 验证结果：前端构建通过；源码前端 smoke 通过，新增 `admin-usage-logs-source ok` 和 `mobile-admin-usage-logs ok`，桌面日志页统计卡 5 张、分页行数 10、包含 `注册赠送`，桌面和 390x844 移动端横向溢出均为 0。Codex 自带浏览器实际点击通过，返回 `title=消费日志`、`rows=10`、`statCards=5`、`hasGift=true`、`overflow=0`。本轮没有安装新依赖，没有安装 `F:\dianshang` 根目录后端依赖。
- 当前完成度：源码化新栈约 81%，测试护栏约 99%。
- 新发现问题：旧接口响应里 `logs` 是全量数组、`items` 才是分页数组；本轮已在 `adminUsageLogs.ts` 中优先使用 `items`，避免日志页一次渲染过多行。关键词搜索仍是当前页前端筛选，正式新后端接管时需要补服务端 keyword/type 契约。
- 未完成清单：后台订单、兑换码、API 线路、模型价格、模板工作流、系统设置和回收站仍是旧桥接；余额调整等写入能力仍未源码化。
- 下一轮建议：继续迁移后台订单只读页或兑换码只读页；写入类按钮仍保持旧桥接。
- 需要人工介入：如需安装新后端依赖、重建 CodeGraph 索引或测试余额调整/删除等写入动作，需要用户确认。

## 2026-06-26 源码后台订单管理只读迁移进度报告

- 分支：`codex/source-stack-canvas-rebuild`
- 使用技能：继续采用 `Code`、`frontend-design` 和 `playwright`；本轮不调用克隆类或大审类 skill。
- 完成内容：将 `/admin/orders` 从旧桥接改为 Vue3 源码只读页。新增 `frontend/src/api/adminOrders.ts` 归一化旧后端 `/api/admin/orders` 的 `items/orders/list/data` 字段，优先使用分页 `items`；新增 `AdminOrdersSource.vue`，展示订单总数、当前页金额、已支付、待支付、已关闭和当前页算力，支持订单号/用户/邮箱搜索、状态筛选、分页和刷新。页面明确为只读，不调用订单改状态接口，也不做退款或补单。
- 修改文件：`frontend/src/api/adminOrders.ts`、`frontend/src/views/AdminOrdersSource.vue`、`frontend/src/router/index.ts`、`frontend/src/config/frontendMigration.ts`、`frontend/src/styles/app.css`、`scripts/smoke-source-frontend-ui-runner.js`、`README.md`、`docs/feature-completion-checklist.md`、`docs/progress-report.md`、`docs/review-log.md`
- 验证方式：检查 CodeGraph 状态；读取旧后端 `/api/admin/orders` 响应样例；运行 `node --check "F:\dianshang\scripts\smoke-source-frontend-ui-runner.js"`；运行 `npm.cmd run build --prefix "F:\dianshang\frontend"`；运行 `powershell -NoProfile -ExecutionPolicy Bypass -File "F:\dianshang\scripts\smoke-source-frontend-ui.ps1"`；使用 Codex 自带浏览器打开 `/admin/orders`，搜索 `HJM000001` 并点击查询和刷新，再切 390x844 视口复核。
- 验证结果：前端构建通过；源码前端 smoke 通过，新增 `admin-orders-source ok` 和 `mobile-admin-orders ok`，桌面订单页统计卡 6 张、搜索 `HJM` 后 10 行、包含 `HJM000001`，桌面和 390x844 移动端横向溢出均为 0。Codex 自带浏览器实际点击通过，桌面搜索后返回 `title=订单管理`、`rows=1`、`statCards=6`、`hasOrder=true`、`readonly=true`、`overflow=0`；390x844 视口返回 `rows=10`、`statCards=6`、`hasOrder=true`、`overflow=0`。首页迁移统计更新为 14 个源码页、7 个旧版桥接、21 个总入口。本轮没有安装新依赖，没有安装 `F:\dianshang` 根目录后端依赖。
- 当前完成度：源码化新栈约 84%，测试护栏约 99%。
- 新发现问题：旧接口响应里 `orders` 是全量数组、`items` 是分页数组；本轮已在 `adminOrders.ts` 中优先使用 `items`，避免订单页一次渲染过多行。关键词搜索仍是当前页前端筛选，正式新后端接管时需要补服务端 keyword/status 契约。
- 未完成清单：后台兑换码、API 线路、模型价格、模板工作流、系统设置和回收站仍是旧桥接；订单状态修改、退款、补单等写入能力仍未源码化。
- 下一轮建议：继续迁移后台兑换码只读页或模型价格/API 线路只读页；写入类按钮仍保持旧桥接。
- 需要人工介入：如需安装新后端依赖、重建 CodeGraph 索引或测试订单改状态/退款/补单等写入动作，需要用户确认。

## 2026-06-26 源码后台兑换码管理只读迁移进度报告

- 分支：`codex/source-stack-canvas-rebuild`
- 使用技能：继续采用 `Code`、`frontend-design` 和 `playwright`；本轮不调用克隆类或大审类 skill。
- 完成内容：将 `/admin/redeem-codes` 从旧桥接改为 Vue3 源码只读页。新增 `frontend/src/api/adminRedeemCodes.ts` 归一化旧后端 `/api/admin/redeem-codes` 的 `items/codes/list/data` 字段，优先使用分页 `items`；新增 `AdminRedeemCodesSource.vue`，展示兑换码总数、当前页算力、启用中、已禁用、已用尽和剩余次数，支持兑换码/状态/算力搜索、状态筛选、分页和刷新。页面明确为只读，不调用兑换码创建或删除接口。
- 修改文件：`frontend/src/api/adminRedeemCodes.ts`、`frontend/src/views/AdminRedeemCodesSource.vue`、`frontend/src/router/index.ts`、`frontend/src/config/frontendMigration.ts`、`frontend/src/styles/app.css`、`scripts/smoke-source-frontend-ui-runner.js`、`README.md`、`docs/feature-completion-checklist.md`、`docs/progress-report.md`、`docs/review-log.md`
- 验证方式：检查 CodeGraph 状态；读取旧后端 `/api/admin/redeem-codes` 响应样例；运行 `node --check "F:\dianshang\scripts\smoke-source-frontend-ui-runner.js"`；运行 `npm.cmd run build --prefix "F:\dianshang\frontend"`；运行源码前端 smoke；使用 Codex 自带浏览器打开 `/admin/redeem-codes`，搜索 `HAJIMI` 并点击查询和刷新，再切 390x844 视口复核。
- 验证结果：前端构建通过；源码前端 smoke 通过，新增 `admin-redeem-codes-source ok` 和 `mobile-admin-redeem-codes ok`，桌面兑换码页统计卡 6 张、搜索 `HAJIMI` 后 1 行、包含 `HAJIMI2024`，桌面和 390x844 移动端横向溢出均为 0。Codex 自带浏览器实际点击通过，桌面搜索后返回 `title=兑换码管理`、`rows=1`、`statCards=6`、`hasCode=true`、`readonly=true`、`overflow=0`；390x844 视口返回 `rows=10`、`statCards=6`、`hasCode=true`、`overflow=0`。首页迁移统计更新为 15 个源码页、6 个旧版桥接、21 个总入口。本轮没有安装新依赖，没有安装 `F:\dianshang` 根目录后端依赖。
- 当前完成度：源码化新栈约 87%，测试护栏约 99%。
- 新发现问题：旧接口响应里 `codes` 是全量数组、`items` 是分页数组；本轮已在 `adminRedeemCodes.ts` 中优先使用 `items`，避免兑换码页一次渲染过多行。关键词搜索仍是当前页前端筛选，正式新后端接管时需要补服务端 keyword/status 契约。
- 未完成清单：后台 API 线路、模型价格、模板工作流、系统设置和回收站仍是旧桥接；兑换码创建、删除、发放等写入能力仍未源码化。
- 下一轮建议：继续迁移后台模型价格只读页或 API 线路只读页；写入类按钮仍保持旧桥接。
- 需要人工介入：如需安装新后端依赖、重建 CodeGraph 索引或测试兑换码创建/删除等写入动作，需要用户确认。

## 2026-06-26 源码后台模型价格只读迁移进度报告

- 分支：`codex/source-stack-canvas-rebuild`
- 使用技能：继续采用 `Code`、`frontend-design` 和 `playwright`；本轮不调用克隆类或大审类 skill。
- 完成内容：将 `/admin/model-prices` 从旧桥接改为 Vue3 源码只读页。新增 `frontend/src/api/adminModelPrices.ts` 归一化旧后端 `/api/admin/model-prices` 的 `items/routes/providers/list/data` 和 `models/prices/rows` 字段；新增 `AdminModelPricesSource.vue`，展示线路数量、模型总数、启用模型、图片模型、文本模型和当前筛选总价，支持模型/线路/类型搜索、类型筛选、分页和刷新。页面明确为只读，不调用模型保存、创建或删除接口，不改变真实计费规则。
- 修改文件：`frontend/src/api/adminModelPrices.ts`、`frontend/src/views/AdminModelPricesSource.vue`、`frontend/src/router/index.ts`、`frontend/src/config/frontendMigration.ts`、`frontend/src/styles/app.css`、`scripts/smoke-source-frontend-ui-runner.js`、`README.md`、`docs/feature-completion-checklist.md`、`docs/progress-report.md`、`docs/review-log.md`
- 验证方式：检查 CodeGraph 状态；读取旧后端 `/api/admin/model-prices` 响应样例；运行 `node --check "F:\dianshang\scripts\smoke-source-frontend-ui-runner.js"`；运行 `npm.cmd run build --prefix "F:\dianshang\frontend"`；运行源码前端 smoke；使用 Codex 自带浏览器打开 `/admin/model-prices`，搜索 `gpt-image-2` 并点击查询和刷新，再切 390x844 视口复核。
- 验证结果：前端构建通过；源码前端 smoke 通过，新增 `admin-model-prices-source ok` 和 `mobile-admin-model-prices ok`，桌面模型价格页统计卡 6 张、搜索 `gpt-image-2` 后 10 行、包含 `GPT Image 2`，桌面和 390x844 移动端横向溢出均为 0。Codex 自带浏览器实际点击通过，桌面搜索后返回 `title=模型价格`、`rows=10`、`statCards=6`、`hasModel=true`、`readonly=true`、`overflow=0`；390x844 视口返回 `rows=40`、`statCards=6`、`hasModel=true`、`readonly=true`、`overflow=0`。首页迁移统计更新为 16 个源码页、5 个旧版桥接、21 个总入口。本轮没有安装新依赖，没有安装 `F:\dianshang` 根目录后端依赖。
- 当前完成度：源码化新栈约 90%，测试护栏约 99%。
- 新发现问题：旧接口把 `items` 覆盖为全量线路，分页字段对模型级列表不是真正分页；本轮前端只做模型当前集合筛选，正式新后端接管时需要补模型级 page/pageSize/keyword/type 契约。
- 未完成清单：后台 API 线路、模板工作流、系统设置和回收站仍是旧桥接；模型价格保存、新增模型、删除模型等写入能力仍未源码化。
- 下一轮建议：继续迁移后台 API 线路只读页；写入类按钮仍保持旧桥接。
- 需要人工介入：如需安装新后端依赖、重建 CodeGraph 索引或测试模型价格保存/新增/删除等写入动作，需要用户确认。

## 2026-06-26 源码后台 API 线路只读迁移进度报告

- 分支：`codex/source-stack-canvas-rebuild`
- 使用技能：继续采用 `Code`、`frontend-design`、`playwright` 和 Codex 自带浏览器；本轮不调用克隆类或大审类 skill。
- 完成内容：将 `/admin/api-providers` 从旧桥接改为 Vue3 源码只读页。新增 `frontend/src/api/adminApiProviders.ts` 归一化旧后端 `/api/admin/api-providers` 的 `items/providers/routes/list/data` 字段；新增 `AdminApiProvidersSource.vue`，展示线路总数、启用线路、图片线路、文本线路、默认线路和模型总数，支持线路/模型/Base URL 搜索、类型筛选、分页和刷新。页面明确为只读，不调用 API 线路测试、新增、保存、删除、设默认或拉模型接口，不改变真实渠道配置。
- 修改文件：`frontend/src/api/adminApiProviders.ts`、`frontend/src/views/AdminApiProvidersSource.vue`、`frontend/src/views/AdminDashboardSource.vue`、`frontend/src/views/AdminUsersSource.vue`、`frontend/src/views/AdminGenerateTasksSource.vue`、`frontend/src/views/AdminUsageLogsSource.vue`、`frontend/src/views/AdminOrdersSource.vue`、`frontend/src/views/AdminRedeemCodesSource.vue`、`frontend/src/views/AdminModelPricesSource.vue`、`frontend/src/router/index.ts`、`frontend/src/config/frontendMigration.ts`、`frontend/src/styles/app.css`、`scripts/smoke-source-frontend-ui-runner.js`、`README.md`、`docs/feature-completion-checklist.md`、`docs/progress-report.md`、`docs/review-log.md`
- 验证方式：检查 CodeGraph 状态；读取旧后端 `/api/admin/api-providers` 响应样例；运行 `node --check "F:\dianshang\scripts\smoke-source-frontend-ui-runner.js"`；运行 `npm.cmd run build --prefix "F:\dianshang\frontend"`；运行源码前端 smoke；使用 Codex 自带浏览器打开 `/admin/api-providers`，搜索 `route_6789` 并点击查询和刷新，再切 390x844 视口复核。
- 验证结果：前端构建通过；源码前端 smoke 通过，新增 `admin-api-providers-source ok` 和 `mobile-admin-api-providers ok`，桌面 API 线路页统计卡 6 张、搜索 `route_6789` 后 1 行、包含 `route_6789` 和 masked key `sk-local-********`，桌面和 390x844 移动端横向溢出均为 0。Codex 自带浏览器实际点击通过，桌面搜索后返回 `title=API 线路`、`rows=1`、`statCards=6`、`hasRoute=true`、`hasMaskedKey=true`、`readonly=true`、`overflow=0`；390x844 视口返回 `rows=6`、`statCards=6`、`hasRoute=true`、`readonly=true`、`overflow=0`。首页迁移统计更新为 17 个源码页、4 个旧版桥接、21 个总入口。本轮没有安装新依赖，没有安装 `F:\dianshang` 根目录后端依赖。
- 当前完成度：源码化新栈约 93%，测试护栏约 99%。
- 新发现问题：旧接口一次返回全量线路，分页字段只是兼容字段；本轮前端只做当前集合筛选，正式新后端接管时需要补线路级 page/pageSize/keyword/type/status/default 契约，并明确密钥字段永远只能返回 masked 值。
- 未完成清单：后台模板工作流、系统设置和回收站仍是旧桥接；API 线路测试、新增、保存、删除、设默认、拉模型等写入能力仍未源码化。
- 下一轮建议：继续迁移后台模板工作流只读页或系统设置只读页；写入类按钮仍保持旧桥接。
- 需要人工介入：如需安装新后端依赖、重建 CodeGraph 索引或测试 API 线路写入动作，需要用户确认。

## 2026-06-26 源码后台模板工作流只读迁移进度报告

- 分支：`codex/source-stack-canvas-rebuild`
- 使用技能：继续采用 `Code`、`frontend-design`、`playwright` 和 Codex 自带浏览器；本轮不调用克隆类或大审类 skill。
- 完成内容：将 `/admin/template-workflows` 从旧桥接改为 Vue3 源码只读页。新增 `frontend/src/api/adminTemplateWorkflows.ts` 归一化旧后端 `/api/admin/template-workflows` 的 `templates/items/data` 字段；新增 `AdminTemplateWorkflowsSource.vue`，展示模板总数、启用模板、分类数量、素材槽、字段数量、比例选项，以及平台、清晰度、比例和模型配置摘要。页面支持模板/分类/标签搜索和分类筛选，明确为只读，不调用模板工作流保存接口。
- 修改文件：`frontend/src/api/adminTemplateWorkflows.ts`、`frontend/src/views/AdminTemplateWorkflowsSource.vue`、`frontend/src/router/index.ts`、`frontend/src/config/frontendMigration.ts`、`frontend/src/styles/app.css`、`scripts/smoke-source-frontend-ui-runner.js`、`README.md`、`docs/feature-completion-checklist.md`、`docs/progress-report.md`、`docs/review-log.md`
- 验证方式：检查 CodeGraph 状态；读取旧后端 `/api/admin/template-workflows` 响应样例；运行 `node --check "F:\dianshang\scripts\smoke-source-frontend-ui-runner.js"`；运行 `npm.cmd run build --prefix "F:\dianshang\frontend"`；运行源码前端 smoke；使用 Codex 自带浏览器打开 `/admin/template-workflows`，搜索 `白底图` 并点击查询和刷新，再切 390x844 视口复核。
- 验证结果：前端构建通过；源码前端 smoke 通过，新增 `admin-template-workflows-source ok` 和 `mobile-admin-template-workflows ok`，桌面模板工作流页统计卡 6 张、搜索 `白底图` 后 1 行、包含平台/比例摘要，桌面和 390x844 移动端横向溢出均为 0。Codex 自带浏览器实际点击通过，桌面搜索后返回 `title=模板工作流`、`rows=1`、`statCards=6`、`hasTemplate=true`、`hasPlatform=true`、`readonly=true`、`overflow=0`；390x844 视口返回 `rows=10`、`statCards=6`、`hasTemplate=true`、`readonly=true`、`overflow=0`。首页迁移统计更新为 18 个源码页、3 个旧版桥接、21 个总入口。本轮没有安装新依赖，没有安装 `F:\dianshang` 根目录后端依赖。
- 当前完成度：源码化新栈约 95%，测试护栏约 99%。
- 新发现问题：旧接口 GET 返回完整模板配置，PUT 会覆盖模板、平台、清晰度、比例和模型配置；本轮只做摘要阅读，正式新后端接管时需要拆出模板级分页/搜索/分类契约和保存权限边界。
- 未完成清单：后台系统设置和回收站仍是旧桥接；模板工作流保存、模板新增/删除、字段编辑等写入能力仍未源码化。
- 下一轮建议：继续迁移后台系统设置只读页；写入类按钮仍保持旧桥接。
- 需要人工介入：如需安装新后端依赖、重建 CodeGraph 索引或测试模板工作流保存动作，需要用户确认。

## 2026-06-26 剩余三入口源码化收尾进度报告

- 分支：`codex/source-stack-canvas-rebuild`
- 使用技能：继续采用 `Code`、`frontend-design`、`playwright` 和 Codex 自带浏览器；本轮不调用克隆类或大审类 skill。
- 完成内容：按“剩下 3 个一起弄完”收尾当前迁移索引中的 `/canvas`、`/admin/recycle-bin`、`/admin/settings`。`/canvas` 新增 `CanvasLegacySource.vue`，只提供源码旧画布入口壳和旧后端画布预览，不重启新画布、不引入 Vue Flow；`/admin/recycle-bin` 新增只读回收站页，只调用 `GET /api/admin/recycle-bin/users`，不恢复、不永久删除；`/admin/settings` 新增只读系统设置页，只调用 `GET /api/admin/settings`，不保存、不修改。首页迁移统计更新为 21 个源码入口、0 个旧桥接、21 个总入口。
- 修改文件：`frontend/src/api/adminRecycleBin.ts`、`frontend/src/api/adminSettings.ts`、`frontend/src/views/CanvasLegacySource.vue`、`frontend/src/views/AdminRecycleBinSource.vue`、`frontend/src/views/AdminSettingsSource.vue`、`frontend/src/router/index.ts`、`frontend/src/config/frontendMigration.ts`、`frontend/src/styles/app.css`、`scripts/smoke-source-frontend-ui-runner.js`、`README.md`、`docs/feature-completion-checklist.md`、`docs/progress-report.md`、`docs/review-log.md`
- 验证方式：检查当前 3 个 legacy 路由；读取旧后端回收站和系统设置接口样例；运行 `node --check "F:\dianshang\scripts\smoke-source-frontend-ui-runner.js"`；运行 `npm.cmd run build --prefix "F:\dianshang\frontend"`；运行源码前端 smoke；使用 Codex 自带浏览器分别打开 `/canvas`、`/admin/recycle-bin`、`/admin/settings`，再切 390x844 视口复核。
- 验证结果：前端构建通过；源码前端 smoke 通过，新增 `canvas-legacy-source`、`admin-recycle-bin-source`、`admin-settings-source`、`mobile-canvas-legacy-source`、`mobile-admin-recycle-bin`、`mobile-admin-settings`。Codex 自带浏览器桌面点测：回收站 `rows=0` 且空状态可见、`statCards=6`、`readonly=true`、`overflow=0`；系统设置搜索 `站点` 后 `rows=1`、`statCards=6`、`hasSiteName=true`、`readonly=true`、`overflow=0`；旧画布入口 `statCards=3`、`iframeCount=1`、`hasBoundary=true`、`overflow=0`。390x844 移动端三页横向溢出均为 0。本轮没有安装新依赖，没有安装 `F:\dianshang` 根目录后端依赖。
- 当前完成度：源码化新栈 100%，测试护栏 100%。
- 新发现问题：`/canvas` 已是源码入口，但画布运行时仍是旧后端画布；这是按用户“新画布废止、回滚旧画布”的边界完成，不代表旧画布内部已源码化。回收站当前测试库为空，因此本轮证据覆盖空状态和只读边界，未覆盖有删除用户时的卡片视觉。
- 未完成清单：迁移索引已无旧桥接入口；写入类能力仍需单独确认测试数据后迁移或验收，包括系统设置保存、回收站恢复/永久删除、API 线路写入、模型价格保存、模板工作流保存、兑换码创建/删除、订单状态修改、任务取消/删除、图库删除和真实生成/兑换。
- 下一轮建议：进入人工总体验收；如要继续，优先做全站源码页视觉统一审查或开始新后端接管接口准备。
- 需要人工介入：如需测试任意写入/删除/真实付费生成/新后端依赖安装，需要用户确认。

## 2026-06-26 Vue3 源码工程化验收护栏进度报告

- 分支：`codex/source-stack-canvas-rebuild`
- 使用技能：继续采用 `Code`、`frontend-design` 和 `playwright`；本轮不调用克隆类或大审类 skill。
- 完成内容：按“达到可维护 Vue3 源码工程化、可以去测试跑通功能”的目标，清理已不用的 `LegacyRouteRedirect.vue`，修正首页阶段状态为源码入口完成、旧画布锁定、后台只读完成；新增 `scripts/check-source-frontend-routes.js` 和 `frontend` 包脚本 `check:routes`、`smoke:source`、`verify:source`，防止迁移索引和 Router 漂移；新增 `docs/source-frontend-acceptance-checklist.md`，把启动、自动化验收、可直接跑通功能和暂不自动执行的写入动作集中成 runbook；更新 `docs/frontend-migration-roadmap.md`，移除早期后台旧桥接说法。
- 修改文件：`frontend/src/views/HomeWorkbench.vue`、`frontend/package.json`、`scripts/check-source-frontend-routes.js`、`docs/frontend-migration-roadmap.md`、`docs/source-frontend-acceptance-checklist.md`、`README.md`、`docs/feature-completion-checklist.md`、`docs/progress-report.md`、`docs/review-log.md`；删除 `frontend/src/views/LegacyRouteRedirect.vue`。
- 验证方式：运行 `npm.cmd run check:routes --prefix "F:\dianshang\frontend"`；运行 `node --check "F:\dianshang\scripts\check-source-frontend-routes.js"`；运行 `npm.cmd run build --prefix "F:\dianshang\frontend"`；运行 `powershell -NoProfile -ExecutionPolicy Bypass -File "F:\dianshang\scripts\smoke-source-frontend-ui.ps1"`；运行 `git -C "F:\dianshang" diff --check`；检查本轮文件 UTF-8 BOM、尾随空格和旧桥接残留。
- 验证结果：路由维护检查通过，结果为 `21/21 source routes`；前端构建通过；源码前端 smoke 通过，完整覆盖注册清理、登录、首页迁移索引、旧画布入口、用户/模板/图库、后台只读页和移动端；`diff --check` 通过，仅有 Git CRLF 提示；本轮文件无 BOM、无尾随空格；`frontend/src` 中无 `LegacyRouteRedirect` 或 `status: 'legacy'` 残留。
- 当前完成度：源码化新栈 100%，工程化验收护栏继续加固。
- 未完成清单：写入类后台动作、真实生成、真实兑换、图库删除、用户头像保存、旧画布深度操作仍需确认测试数据和回滚方式后单独验收。
- 下一轮建议：先按 `docs/source-frontend-acceptance-checklist.md` 做人工总体验收，再选择一个低风险写入链路试点。
- 需要人工介入：真实写入、删除、扣费、外部模型调用和新后端依赖安装前需要确认。

## 2026-06-26 项目风险评估与系统设置保存试点进度报告

- 风险评价：项目当前最大风险已经从“前端入口不可维护”下降为“写入链路和真实业务闭环尚未逐个验收”。Vue3 源码入口、路由索引、构建和 smoke 护栏已稳定；旧画布内部仍依赖旧运行时，新后端接管尚未开始，真实生成/兑换/删除/扣费仍需人工确认。
- 进度评价：前端源码化入口为 21/0/21；后台源码页目前以只读为主；本轮开始推进第一个低风险写入试点。
- 完成内容：系统设置页从只读迁移版升级为保存试点版。新增 `updateAdminSettings()` 调用旧后端 `PATCH /api/admin/settings`；页面新增草稿区，可编辑站点名称、开放注册、模板生图、图库历史、Mock 模式、默认算力和上传上限；保存后会刷新本地设置并显示回显提示；图片工具、线路和模型配置仍保持只读展示。
- 修改文件：`frontend/src/api/adminSettings.ts`、`frontend/src/views/AdminSettingsSource.vue`、`frontend/src/styles/app.css`、`scripts/smoke-source-frontend-ui-runner.js`、`docs/source-frontend-acceptance-checklist.md`、`docs/progress-report.md`。
- 验证方式：运行 `node --check "F:\dianshang\scripts\smoke-source-frontend-ui-runner.js"`；运行 `npm.cmd run typecheck --prefix "F:\dianshang\frontend"`；运行 `npm.cmd run check:routes --prefix "F:\dianshang\frontend"`；运行 `npm.cmd run build --prefix "F:\dianshang\frontend"`；运行 `powershell -NoProfile -ExecutionPolicy Bypass -File "F:\dianshang\scripts\smoke-source-frontend-ui.ps1"`。
- 验证结果：脚本语法检查通过；Vue TypeScript 检查通过；路由维护检查通过；前端构建通过；源码前端 smoke 通过，系统设置页新增保存试点区、保存按钮和移动端布局均被覆盖，自动化未点击保存。
- 边界：自动化 smoke 只检查系统设置保存试点 UI 是否存在，不点击保存，不修改真实配置；人工测试保存前需要记录原值，保存后恢复原值。
- 下一步：继续运行构建和源码前端 smoke；人工确认后可点测系统设置保存回显。

## 2026-06-26 旧画布入口崩溃风险修复进度报告

- 问题现象：用户在自带浏览器操作 `/canvas?iab-final-canvas-mobile=1` 后反馈崩溃。
- 定位结果：旧后端 `/api/health` 正常，旧画布项目页 `http://127.0.0.1:3456/canvas/project_1782292799148_7xqro748k` 返回 200；临时诊断打开旧画布项目页时没有 console error 和 page crash，只出现旧画布初始化 warning：`canvas:chat-session-change:skip-not-ready`。因此问题更像是 Vue3 `/canvas` 入口在移动端自动内嵌重型旧画布 iframe，导致自带浏览器/移动视口渲染压力过大。
- 完成内容：`CanvasLegacySource.vue` 改为默认不自动加载旧画布 iframe；保留“新窗口打开”和“加载旧画布预览”手动按钮。移动端进入 `/canvas` 时只展示轻量入口，不再立即启动旧画布运行时。
- 修改文件：`frontend/src/views/CanvasLegacySource.vue`、`frontend/src/styles/app.css`、`scripts/smoke-source-frontend-ui-runner.js`、`docs/progress-report.md`、`docs/review-log.md`。
- 验证方式：运行旧后端 health；请求旧画布项目页；运行临时 Playwright 诊断脚本捕获 console/pageerror/requestfailed/crash；运行 `npm.cmd run typecheck --prefix "F:\dianshang\frontend"`；运行 `node --check "F:\dianshang\scripts\smoke-source-frontend-ui-runner.js"`；运行 `npm.cmd run build --prefix "F:\dianshang\frontend"`；运行 `npm.cmd run check:routes --prefix "F:\dianshang\frontend"`；运行源码前端 smoke。
- 验证结果：旧后端健康；旧画布项目页 200；临时诊断无 page crash、无 console error；Vue TypeScript 通过；前端构建通过；路由维护检查通过；源码前端 smoke 通过，`/canvas` 当前断言为 `iframeCount=0`、`loadButtons=1`。
- 后续风险：点击“加载旧画布预览”或“新窗口打开”后进入的是旧画布运行时，仍可能暴露旧画布自身的长流程问题；但源码入口页不再自动触发重型 iframe。

## 2026-06-26 旧画布本地保存权限边界修复进度报告

- 问题现象：用户在旧画布保存面板中选择本地文件夹时出现 `Failed to execute 'requestPermission' on 'FileSystemHandle': Not allowed to request permissions in this context.`。
- 定位结果：这是浏览器 File System Access API 的上下文限制。旧画布如果在 Vue3 `/canvas` 入口页 iframe 中运行，浏览器不允许 iframe 请求本地文件夹权限；必须在顶层页面打开旧画布。
- 完成内容：移除 `/canvas` 源码入口中的 iframe 预览能力，不再提供“加载旧画布预览”；入口页只保留“新窗口打开旧画布”，并明确提示“本地保存必须在新窗口旧画布中使用”。
- 修改文件：`frontend/src/views/CanvasLegacySource.vue`、`frontend/src/styles/app.css`、`scripts/smoke-source-frontend-ui-runner.js`、`docs/progress-report.md`、`docs/review-log.md`。
- 验证方式：后续运行类型检查、构建、源码前端 smoke 和格式检查。
- 边界：旧画布本体仍由 `http://127.0.0.1:3456/canvas` 承载；本地文件夹授权必须在这个顶层页面里完成。

## 2026-06-26 Vue3 API 错误处理收敛进度报告

- 触发背景：用户确认旧画布新窗口保存恢复正常后，继续推进“可维护 Vue3 源码工程化”。本轮先尝试 CodeGraph 结构索引，但 `codegraph_status`、`codegraph_files`、`codegraph_context` 均在 300 秒左右超时或被中断；因此按工具降级边界改用本地源码读取和现有 smoke 护栏，不继续等待索引。
- 完成内容：在 `frontend/src/api/http.ts` 新增 `getApiErrorMessage()`，统一处理 Axios 响应中的 401、403、`data.message`、`data.error` 和 JS Error 兜底；将登录、用户中心、图库、模板页和后台源码页中的重复错误解析收敛到该函数，页面只保留业务兜底文案和特定未登录提示。
- 文档对齐：更新 `docs/frontend-migration-roadmap.md`、`README.md` 和 `frontend/src/config/frontendMigration.ts`，修正 `/canvas` 不再嵌入 iframe、`/admin/settings` 已是保存试点而非纯只读的描述。
- 修改文件：`frontend/src/api/http.ts`、`frontend/src/views/AuthSource.vue`、`frontend/src/views/GallerySource.vue`、`frontend/src/views/TemplateImageSource.vue`、`frontend/src/views/UserCenterSource.vue`、`frontend/src/views/UserRecordsSource.vue`、`frontend/src/views/UserRedeemSource.vue`、`frontend/src/views/AdminLoginSource.vue`、`frontend/src/views/AdminDashboardSource.vue`、`frontend/src/views/AdminUsersSource.vue`、`frontend/src/views/AdminRecycleBinSource.vue`、`frontend/src/views/AdminOrdersSource.vue`、`frontend/src/views/AdminUsageLogsSource.vue`、`frontend/src/views/AdminGenerateTasksSource.vue`、`frontend/src/views/AdminRedeemCodesSource.vue`、`frontend/src/views/AdminApiProvidersSource.vue`、`frontend/src/views/AdminModelPricesSource.vue`、`frontend/src/views/AdminTemplateWorkflowsSource.vue`、`frontend/src/views/AdminSettingsSource.vue`、`frontend/src/config/frontendMigration.ts`、`README.md`、`docs/frontend-migration-roadmap.md`。
- 已验证：`npm.cmd run typecheck --prefix "F:\dianshang\frontend"` 通过；`npm.cmd run check:routes --prefix "F:\dianshang\frontend"` 通过，仍为 `21/21 source routes`；`npm.cmd run build --prefix "F:\dianshang\frontend"` 通过；`powershell -NoProfile -ExecutionPolicy Bypass -File "F:\dianshang\scripts\smoke-source-frontend-ui.ps1"` 通过，且 `/canvas` 仍为 `iframeCount=0`；`git -C "F:\dianshang" diff --check` 通过，仅有 CRLF 提示；`rg` 确认视图层不再散落 `response?.data?.message` 和 `(error as Error)?.message` 解析；本轮关键文件 BOM 和尾随空白检查为空。
- 边界：本轮不新增依赖，不触发保存、删除、兑换、真实生成或外部模型调用；CodeGraph 仍需后续单独恢复或重建索引后再作为结构查询主工具。

## 2026-06-26 系统设置图片工具可配置进度报告

- 问题现象：用户在 `/admin/settings` 人工测试时指出“图片工具配置”和设置列表只有展示，没有可选择控件。
- 完成内容：将图片工具配置从只读展示升级为保存试点的一部分。每个工具现在有启用开关、图片线路下拉、模型下拉和提示词模板输入；线路和模型选项复用现有 `/api/admin/api-providers` 数据，不新增接口、不新增依赖。保存时随 `imageToolFeatures` 一起写入旧后端 `app_state`。
- 修改文件：`frontend/src/views/AdminSettingsSource.vue`、`frontend/src/styles/app.css`、`docs/progress-report.md`、`docs/review-log.md`。
- 已验证：`npm.cmd run typecheck --prefix "F:\dianshang\frontend"` 通过；`npm.cmd run build --prefix "F:\dianshang\frontend"` 通过；`powershell -NoProfile -ExecutionPolicy Bypass -File "F:\dianshang\scripts\smoke-source-frontend-ui.ps1"` 第二次重跑通过，第一次失败原因是 Playwright CLI session 未先打开浏览器；`git -C "F:\dianshang" diff --check` 通过，仅有 CRLF 提示；自带浏览器刷新 `/admin/settings` 后确认图片工具区有 4 个工具卡、4 个开关、8 个下拉和 4 个提示词输入框。
- 边界：本轮只打开页面确认控件存在，没有点击保存；人工测试保存前仍需记录原值，保存后再恢复原值。

## 2026-06-26 系统设置基础开关点击修复进度报告

- 问题现象：用户反馈系统设置保存试点里有几个按钮按不动。复测发现右侧文字“开启/关闭”按钮能改变草稿状态，但左侧 Naive UI `n-switch` 滑块本体 7 个都无法改变状态。
- 完成内容：将基础设置区的 7 个开关从 `n-switch` 替换为项目自控的原生按钮式滑块，并保留右侧文字按钮。现在点击滑块本体和点击文字按钮都会调用同一个 `toggleDraftBoolean()`，避免组件点击区和 `<label>` 包裹导致的事件不一致。
- 修改文件：`frontend/src/views/AdminSettingsSource.vue`、`frontend/src/styles/app.css`、`docs/progress-report.md`、`docs/review-log.md`。
- 已验证：自带浏览器逐个点击 7 个滑块，开放注册、邮箱验证码、画布存储、画布云存储、模板生图、图库历史、Mock 模式均能改变草稿状态，并已逐个点回测试前状态；逐个点击右侧文字按钮也全部能改变并恢复。`npm.cmd run typecheck --prefix "F:\dianshang\frontend"` 通过；`npm.cmd run check:routes --prefix "F:\dianshang\frontend"` 通过；`npm.cmd run build --prefix "F:\dianshang\frontend"` 通过；`git -C "F:\dianshang" diff --check` 通过，仅有 CRLF 提示。
- 边界：本轮不点击“保存设置”，没有写入真实配置。

## 2026-06-26 API 官方双线路收敛进度报告

- 触发背景：用户要求旧 API 路线全部删除，改为两条：图片 `gpt-image-2`、文本 `gpt-5.5`，请求格式参考官方。
- 官方格式参考：图片线路按 OpenAI Images 的 `/images/generations` 形态落字段；文本线路按 OpenAI Responses 的 `/responses` 形态落字段。本轮不调用外部付费接口。
- 完成内容：目标工程和当前兼容后端的默认模型池已收窄为图片 `gpt-image-2`、文本 `gpt-5.5`；默认 API 路线收窄为 `route_openai_gpt_image_2` 和 `route_openai_gpt_5_5`；新增 `PUT /api/admin/api-providers` 整包替换能力；`/admin/api-providers` 从只读页升级为写入试点页，展示官方双线路目标、请求路径、请求体示例和“应用官方双线路”按钮；README 与 API 契约记录了“禁止恢复旧多渠道列表”的边界。
- 实际数据写入：已用本地管理员账号 `admin/admin123` 调用兼容后端整包替换接口，将运行数据库中的 API 线路替换为两条目标线路；随后清理 `admin.modelPrices` 中 3 条早期 `ui-echo-model-*` 覆盖行。复核结果：API 线路 `total=2`，模型键只剩 `gpt-image-2,gpt-5.5`，旧线路名匹配为 false。
- 修改文件：`server.js`、`frontend/src/api/adminApiProviders.ts`、`frontend/src/views/AdminApiProvidersSource.vue`、`frontend/src/styles/app.css`、`scripts/smoke-source-frontend-ui-runner.js`、`README.md`、`docs/api-contract-next.md`、`docs/progress-report.md`、`docs/review-log.md`；同步修改当前兼容后端 `C:\Users\pc\Desktop\hjm-mb-clone\server.js`。
- 验证方式：`node --check "F:\dianshang\server.js"`；`node --check "C:\Users\pc\Desktop\hjm-mb-clone\server.js"`；`npm.cmd run typecheck --prefix "F:\dianshang\frontend"`；`npm.cmd run check:routes --prefix "F:\dianshang\frontend"`；`npm.cmd run build --prefix "F:\dianshang\frontend"`；`git -C "F:\dianshang" diff --check`；重启兼容后端并检查 `/api/health`；本地 API 登录后写入并复核 `/api/admin/api-providers`、`/api/admin/model-prices`；自带浏览器打开 `/admin/api-providers`；完整源码前端 smoke。
- 验证结果：后端语法检查通过；前端类型检查通过；路由维护检查通过，仍为 `21/21 source routes`；前端构建通过；`diff --check` 通过，仅有 CRLF 提示；兼容后端 health 正常，`textModel=gpt-5.5`、`imageModel=gpt-image-2`；自带浏览器显示 2 条线路、2 张官方目标卡、无旧线路文本、无横向溢出；源码前端 smoke 通过。
- 边界：历史生成记录和消费日志里仍可能出现旧线路展示名或历史模型名，这是历史业务数据，不属于当前 API 路线配置；真实供应商 Key、新后端接管、真实付费调用仍需人工确认。

## 2026-06-26 API 图生图能力补齐进度报告

- 触发背景：用户指出官方双线路中漏了图生图。
- 完成内容：不新增第三条 API 线路，继续保持图片 `GPT Image 2` 与文本 `GPT 5.5` 两条线路；在图片线路下新增第二个请求示例 `图生图 / 局部重绘`，端点为 `POST /images/edits`，请求体包含 `model/images/prompt/mask/size/quality/n`。前端 API 线路页改为支持一个线路展示多个请求示例。
- 运行数据同步：已重启兼容后端，并调用本地整包替换接口写入当前数据库；复核图片线路 `requestExamples=2`，包含 `/images/edits`。
- 修改文件：`frontend/src/api/adminApiProviders.ts`、`frontend/src/views/AdminApiProvidersSource.vue`、`frontend/src/styles/app.css`、`server.js`、`scripts/smoke-source-frontend-ui-runner.js`、`README.md`、`docs/api-contract-next.md`、`docs/progress-report.md`、`docs/review-log.md`；同步修改当前兼容后端 `C:\Users\pc\Desktop\hjm-mb-clone\server.js`。
- 验证方式：`node --check "F:\dianshang\server.js"`；`node --check "C:\Users\pc\Desktop\hjm-mb-clone\server.js"`；`npm.cmd run typecheck --prefix "F:\dianshang\frontend"`；`npm.cmd run check:routes --prefix "F:\dianshang\frontend"`；`npm.cmd run build --prefix "F:\dianshang\frontend"`；`git -C "F:\dianshang" diff --check`；自带浏览器打开 `/admin/api-providers`；完整源码前端 smoke。
- 验证结果：后端语法检查通过；前端类型检查通过；路由维护检查通过，仍为 `21/21 source routes`；前端构建通过；`diff --check` 通过，仅有 CRLF 提示；浏览器页面显示 `/images/generations`、`/images/edits`、`/responses` 和“图生图 / 局部重绘”，横向溢出为 0；完整源码前端 smoke 通过。
- 边界：本轮只补配置和展示，不实现真实图生图上传调用链；真实文件上传、mask 绘制、图生图任务入队和上游付费调用仍需后续单独实现并确认。

## 2026-06-26 Provider 能力注册表推进报告

- 触发背景：用户确认当前 API 线路先用着，但后续可能持续增加新的中转站和模型，且不同中转站请求方式可能不同。
- 完成内容：新增 `frontend/src/config/providerCapabilities.ts`，将 `gpt-image-2` 的文生图、图生图/局部重绘，以及 `gpt-5.5` 的文本生成能力收敛为前端能力注册表；`adminApiProviders.ts` 不再直接维护大段请求示例；`AdminApiProvidersSource.vue` 在后端返回旧数据缺少 `requestExamples` 时，会按模型从注册表补齐展示。
- 架构边界：API 线路页仍只是后台配置展示；前端功能模块不直接路由到线路。后续新增中转站时，应在后端 Provider Adapter 处理请求格式、鉴权和返回解析，前端只读能力注册表或后端返回的能力元数据。
- 修改文件：`frontend/src/config/providerCapabilities.ts`、`frontend/src/api/adminApiProviders.ts`、`frontend/src/views/AdminApiProvidersSource.vue`、`README.md`、`docs/api-contract-next.md`、`docs/progress-report.md`、`docs/review-log.md`。
- 验证方式：`npm.cmd run typecheck --prefix "F:\dianshang\frontend"`；`npm.cmd run check:routes --prefix "F:\dianshang\frontend"`；`node --check "F:\dianshang\scripts\smoke-source-frontend-ui-runner.js"`；`git -C "F:\dianshang" diff --check`；`npm.cmd run build --prefix "F:\dianshang\frontend"`；自带浏览器打开 `/admin/api-providers`。
- 验证结果：前端类型检查通过；路由维护检查通过，仍为 `21/21 source routes`；smoke runner 语法检查通过；`diff --check` 通过，仅有 CRLF 提示；前端构建通过；浏览器页面显示文生图 `/images/generations`、图生图 `/images/edits`、文本生成 `/responses`，横向溢出为 0。
- 边界：本轮不新增 npm 包，不改真实 Provider 调用链，不新增中转站。

## 2026-06-26 API 线路旧后台表单恢复进度报告

- 触发背景：用户反馈源码后台与原 HJM 后台不一致，尤其是“自己写 API Key 的接口”缺失。
- 定位结果：旧 HJM 后台存在完整 API 线路表单字段，包括后端真实名称、前端展示名称、线路标识 code、渠道类型、接口格式、Base URL、API Key、聊天/生图/视频接口、默认模型、优先级、线路倍率、状态、默认线路和备注；源码后台此前只有列表和官方双线路试点。
- 完成内容：`/admin/api-providers` 恢复旧后台同款新增/编辑表单；补齐新增、编辑、删除、设默认、拉取模型、测试连接按钮；API Key 输入采用密码框，编辑时留空不修改，后端仍只回显掩码；官方模型请求示例优先使用前端能力注册表，避免旧运行数据中的乱码标签污染页面。
- 后端同步：目标工程和当前兼容后端均补齐旧表单字段持久化，包括 `chatEndpoint`、`imageEndpoint`、`videoEndpoint`、`defaultTextModel`、`defaultImageModel`、`defaultVideoModel`、`multiplier` 和 `remark`。
- 修改文件：`frontend/src/api/adminApiProviders.ts`、`frontend/src/views/AdminApiProvidersSource.vue`、`frontend/src/styles/app.css`、`server.js`、`docs/progress-report.md`、`docs/review-log.md`；同步修改当前兼容后端 `C:\Users\pc\Desktop\hjm-mb-clone\server.js`。
- 验证方式：`node --check "F:\dianshang\server.js"`；`node --check "C:\Users\pc\Desktop\hjm-mb-clone\server.js"`；`npm.cmd run typecheck --prefix "F:\dianshang\frontend"`；`npm.cmd run build --prefix "F:\dianshang\frontend"`；`git -C "F:\dianshang" diff --check`；重启兼容后端并检查 `/api/health`；Playwright 浏览器烟测新增临时 `codex-smoke` 线路、打开编辑表单、删除临时线路；复核运行数据库无残留测试线路。
- 验证结果：后端语法检查通过；前端类型检查通过；前端构建通过；`diff --check` 通过，仅有 CRLF 提示；兼容后端 health 正常；浏览器烟测新增和编辑打开通过，删除后复核 API 线路回到 `route_openai_gpt_image_2,route_openai_gpt_5_5` 两条。
- 边界：本轮不自动点击“测试连接”，因为当前后端处于 `real-provider-ready`，该按钮可能触发真实 Provider 请求；真实 API Key 是否允许从后台写入并用于付费调用，后续需要单独做加密/权限/审计设计后再接管。

## 2026-06-26 首页旧客户端能力补回进度报告

- 触发背景：用户指出当前首页仍是迁移说明页，没有把旧版客户端首页的业务功能迁移过来。
- 旧版对照：旧首页首屏包含“电商全流程工作台”、Chat/Fast/AI 专业绘图 Agent 模式、添加图片、提示词输入、模型/张数/比例/清晰度、预计算力、生成按钮、模板/图库/画布/指南入口和历史画布项目。
- 纠偏记录：第一版误做成新的业务首页壳，用户指出应迁移 `C:\Users\pc\Desktop\hjm-mb-clone` 的旧首页；随后按旧站实际运行页 `http://127.0.0.1:3456/` 重新迁移。
- 完成内容：Vue3 首页已迁回旧站首页结构和视觉：固定顶部栏、导出/保存/历史记录、样式按钮、登录按钮、左侧首页/新画布/模板/图库/指南导航、中心浅色玻璃生成面板、Chat/Fast/AI 专业绘图 Agent 模式、添加图片、提示词、模型/张数/比例/清晰度、预计算力、生成按钮、我的历史画布项目横向列表和新建项目入口。
- 复用边界：首页不再首屏请求 API 线路和用户项目，避免未登录 401/403；真实上传和生成时继续复用 `uploadTemplateFile()` 与 `/api/template/generate-image`；登录态下历史项目仍可读取 `/api/user/projects`。
- 修改文件：`frontend/src/views/HomeWorkbench.vue`、`frontend/src/styles/app.css`、`frontend/src/assets/home-product-workbench.png`、`frontend/src/config/frontendMigration.ts`、`docs/progress-report.md`、`docs/review-log.md`、`docs/feature-completion-checklist.md`。
- 验证方式：`npm.cmd run typecheck --prefix "F:\dianshang\frontend"`；`npm.cmd run check:routes --prefix "F:\dianshang\frontend"`；`npm.cmd run build --prefix "F:\dianshang\frontend"`；`git -C "F:\dianshang" diff --check`；Playwright 打开旧首页 `http://127.0.0.1:3456/` 做能力对照；Playwright 打开新首页 `http://127.0.0.1:5173/` 做桌面和 390px 移动端 DOM/溢出检查；点击 Agent 模式和空提示“生成”验证本地拦截。
- 验证结果：旧首页能力已完成对照；前端类型检查、路由检查和构建通过；Playwright 确认新首页存在旧版顶部栏、侧栏、生成面板、历史画布项目，桌面和 390px 移动端横向溢出均为 0；重新加载后仅有 Vite debug 日志，无 401/403、无 pageerror，背景图不再从工程外 `@fs` 路径加载。
- 边界：本轮没有输入真实提示词点击生成，避免误触发外部付费调用；旧首页更复杂的本地保存弹窗、历史项目拖拽惯性和完整项目恢复后续可继续按旧站 assets 逐项迁入。

## 2026-06-29 Packy API 档案对齐进度报告

- 触发背景：用户提供 Packy GPT Image 文档链接，要求先优化 API 档案，后续由用户填写 key 后手动测试。
- 完成内容：将 `gpt-image-2` 文生图档案对齐为 `POST /images/generations`，请求体包含 `model/prompt/size/quality/output_format/response_format/n`；将图生图/局部重绘档案对齐为 `POST /images/edits`，`contentType` 为 `multipart/form-data`，字段为 `model/image/mask/prompt/size/quality/output_format/response_format/n`；补充 `gpt-5.5` 文本线路 `POST /responses` 示例；编辑弹窗的默认格式仅用于复制，不写入线路记录。
- 后端同步：目标工程和当前兼容后端均补齐 Packy 图片参数归一化，`quality` 只输出 `low/medium/high/auto`，`n` 固定向上游传 `1`，多图由后端循环请求；后台“测试线路”接口改为按线路类型选择 Images API 或 Responses API，不再用图片线路测试聊天接口；官方双线路输出层会覆盖旧数据库中缓存的乱码示例，避免污染页面展示。
- 修改文件：`server.js`、`frontend/src/config/providerCapabilities.ts`、`frontend/src/api/adminApiProviders.ts`、`frontend/src/views/AdminApiProvidersSource.vue`、`docs/progress-report.md`；同步修改当前兼容后端 `C:\Users\pc\Desktop\hjm-mb-clone\server.js` 和 `C:\Users\pc\Desktop\hjm-mb-clone\assets\admin-api-form-labels.js`。
- 验证方式：`node --check "F:\dianshang\server.js"`；`node --check "C:\Users\pc\Desktop\hjm-mb-clone\server.js"`；`npm.cmd run typecheck --prefix "F:\dianshang\frontend"`；`npm.cmd run check:routes --prefix "F:\dianshang\frontend"`；`npm.cmd run build --prefix "F:\dianshang\frontend"`；`git -C "F:\dianshang" diff --check`；重启兼容后端并检查 `/api/health`；本地登录后只读复核 `/api/admin/api-providers`。
- 验证结果：后端语法检查通过；前端类型检查通过；路由维护检查通过，仍为 `21/21 source routes`；前端构建通过；`diff --check` 通过，仅有 CRLF 提示；兼容后端 health 正常；后台 API 线路只读复核显示图片线路 `packy-openai-images-generations`、文生图 `/images/generations`、图生图 `/images/edits`、文本生成 `/responses`，示例标签为中文。
- 边界：本轮没有点击测试连接或触发真实生图，避免在用户填写/确认 key 前产生外部付费请求；旧数据库里的历史缓存未被清空，只在服务端输出层对官方两条线路做展示归一化。

## 2026-06-29 API 线路密钥编辑修复进度报告

- 问题现象：用户指出 API 线路看起来不能修改，不知道如何添加 key。复核发现前端有编辑表单和 API Key 输入框，但后端保存时把用户输入的真实 key 直接替换成 `sk-local-********`，导致线路级 key 实际不可用。
- 完成内容：目标工程和当前兼容后端均改为本地数据库保存真实线路 key，API 列表和公共线路输出只回显掩码；编辑表单留空表示不修改旧 key，填入新 key 才替换；批量应用官方双线路时会尽量保留已有线路 key，避免误覆盖。
- 调用链对齐：后台“测试线路”接口现在优先使用当前线路自己的 `baseUrl/apiKey`，没有线路 key 时才回退环境变量；Provider 状态会标记 `routeKeyConfigured` 和 `routeBaseUrlConfigured`，便于后续排查。
- 修改文件：`server.js`、`docs/progress-report.md`；同步修改当前兼容后端 `C:\Users\pc\Desktop\hjm-mb-clone\server.js`。
- 验证方式：`node --check "F:\dianshang\server.js"`；`node --check "C:\Users\pc\Desktop\hjm-mb-clone\server.js"`；`npm.cmd run typecheck --prefix "F:\dianshang\frontend"`；`npm.cmd run check:routes --prefix "F:\dianshang\frontend"`；`npm.cmd run build --prefix "F:\dianshang\frontend"`；`git -C "F:\dianshang" diff --check`；重启兼容后端并检查 `/api/health`；创建临时 `codex-key-smoke` 线路验证 key 保存与掩码回显后删除。
- 验证结果：临时线路列表回显 `sk-local-********` 且 `hasApiKey=true`，本地数据库原始值匹配测试 key，删除后数据库恢复为 `route_openai_gpt_image_2` 和 `route_openai_gpt_5_5` 两条正式线路；自带浏览器刷新 `/admin/api-providers` 后确认编辑按钮存在，编辑面板里 API Key 输入框位于 Base URL 下方。
- 边界：真实 key 仍只保存在本地 SQLite 状态中，不会回显到前端；本轮没有点击真实测试连接或生图，避免产生外部付费调用。

## 2026-06-29 API 线路保存回显修复进度报告

- 问题现象：用户反馈编辑保存后表单内容看起来没有变化。
- 定位结果：保存接口已写入数据库，但 `routePayload()` 为了修复官方双线路旧缓存示例，返回时把官方线路的 `apiFormat/requestFormat/endpoint/requestBodyExample` 强制覆盖成默认档案，导致用户手动保存的接口格式和 endpoint 被展示层盖回默认值。
- 完成内容：目标工程和当前兼容后端均改为“可编辑字段优先使用数据库保存值”，仅在字段为空时使用官方默认值；官方请求示例仍保留用于展示 Packy 文生图、图生图和 Responses 示例。
- 修改文件：`server.js`、`docs/progress-report.md`；同步修改当前兼容后端 `C:\Users\pc\Desktop\hjm-mb-clone\server.js`。
- 验证方式：`node --check "F:\dianshang\server.js"`；`node --check "C:\Users\pc\Desktop\hjm-mb-clone\server.js"`；重启兼容后端并检查 `/api/health`；用本地管理员 API 临时修改图片线路备注和优先级，读取确认后恢复；`npm.cmd run typecheck --prefix "F:\dianshang\frontend"`；`npm.cmd run check:routes --prefix "F:\dianshang\frontend"`；`git -C "F:\dianshang" diff --check`。
- 验证结果：临时保存的备注 `codex-save-smoke-*` 和优先级 `11` 能立即从 `/api/admin/api-providers` 读回；恢复后正式线路仍为两条；自带浏览器刷新 `/admin/api-providers` 后能看到当前数据库保存的图片线路 `baseUrl/endpoint/requestFormat`，不再被官方默认档案覆盖。
- 边界：API Key 输入框重新打开时仍会留空，这是防止真实密钥回显；判断 key 是否已保存看列表中的掩码 `sk-local-********` 或 `hasApiKey` 状态。

## 2026-06-29 旧画布性能过渡优化进度报告

- 触发背景：用户反馈旧画布拖拽和缩放明显卡顿，要求优化画布，但不换画布、不重做画布、不新增自研渲染引擎。
- 完成内容：新增 `assets/canvas-performance-mode.css` 与 `assets/canvas-performance-mode.js`，在画布拖拽、缩放、节点移动和触摸移动期间给页面加 `canvas-performance-active`；交互中临时降低毛玻璃、大阴影、hover transform 和动画过渡，并给 Vue Flow 视口、节点、边和浮动面板启用受控合成层。
- 图片节点优化：画布节点、聊天面板和图片网格中的图片会自动设置 `loading="lazy"`、`decoding="async"` 和固定 `object-fit` 行为，减少大图加载造成的布局抖动。
- 自动保存降频与合并：旧画布两个运行 bundle 中保存节流从 `900ms/250ms` 调整为 `1400ms/800ms`；同时在自动保存和视口保存 timer 触发时检查 `window.__hjmCanvasPerformanceMode.isActive()`，如果仍处于拖拽/缩放交互态，就记录 `noteSaveDeferred()` 并重新排队，等交互结束后合并保存；工作流 JSON 格式不变。
- 缓存刷新：入口和 Canvas 动态 import 版本号统一切换到 `20260629perf3`，避免浏览器继续加载旧 bundle。
- 测试护栏：新增 `scripts/smoke-canvas-performance-ui.ps1` 与 `scripts/smoke-canvas-performance-ui-runner.js`，自动验证画布性能资源加载、拖拽/滚轮触发 `canvas-performance-active`、`will-change: transform` 只在交互态启用、交互结束自动恢复，以及动态新增图片会被优化为 `loading=lazy`、`decoding=async`。新增 `scripts/verify-canvas-performance-assets.js`，静态验证 `perf3` 版本、保存延迟锚点和旧节流值不回退。两条检查均已接入预检链路。
- 修改文件：`index.html`、`assets/index-DglIsp_g.js`、`assets/index-ZrBcanD1.js`、`assets/Canvas-B8bY9_QL.js`、`assets/Canvas-yGc8b2gf.js`、`assets/canvas-performance-mode.css`、`assets/canvas-performance-mode.js`、`scripts/smoke-canvas-performance-ui.ps1`、`scripts/smoke-canvas-performance-ui-runner.js`、`scripts/verify-canvas-performance-assets.js`、`scripts/preflight-check.ps1`、`AGENTS.md`、`docs/progress-report.md`、`docs/review-log.md`、`docs/feature-completion-checklist.md`。
- 验证方式与结果：`node --check "F:\dianshang\server.js"` 通过；`git -C "F:\dianshang" diff --check` 通过，仅有 CRLF 提示；`/api/health` 正常且路径指向 `F:\dianshang`；自带浏览器打开 `http://127.0.0.1:3456/canvas`，确认性能 CSS/JS 加载，拖拽和滚轮缩放均会触发 `canvas-performance-active` 并自动恢复，console error 为 0。
- 追加验证：`node --check "F:\dianshang\scripts\smoke-canvas-performance-ui-runner.js"` 通过；`node "F:\dianshang\scripts\verify-canvas-performance-assets.js"` 通过，返回 `version=20260629perf3`、`saveDeferral=true`；`powershell -NoProfile -ExecutionPolicy Bypass -File "F:\dianshang\scripts\smoke-canvas-performance-ui.ps1"` 通过，结果显示性能 API 完整、`imageProbe.loading=lazy`、`imageProbe.decoding=async`、基础拖拽、单次滚轮、连续 20 次滚轮、打开 Canvas Chat 后拖拽的 class/API 启停均正常，console errors 为 0、bad responses 为 0。
- 缩放闪烁修复：用户反馈滚轮缩放时卡片闪烁后，确认原 `canvas-performance-active` 同时改写 `.vue-flow__node` 的 `will-change/box-shadow/transition`，会和 Vue Flow 视口缩放叠加导致卡片重绘闪烁；已升级到 `20260629perf4`，脚本区分 `canvas-performance-zooming` 与 `canvas-performance-dragging`，缩放态只优化 viewport/pane/canvas-flow，不再改写节点卡片视觉；验证脚本新增防回退断言，禁止 `html.canvas-performance-active .vue-flow__node` 重新出现。
- 缩放闪烁验证：`node "F:\dianshang\scripts\verify-canvas-performance-assets.js"` 通过，返回 `version=20260629perf4`；默认画布 smoke 通过，新增断言显示滚轮缩放时 `zooming=true`、`dragging=false`、`debugMode=zooming`，且节点视觉样式未被改写；指定项目 `SMOKE_CANVAS_PATH=/canvas/project_1782707934819_dxzylygh5` 的 smoke 也通过，性能资源加载、拖拽/缩放 class 启停和 console/bad responses 均正常。
- 帧预算验证：新增 `scripts/smoke-canvas-frame-budget-ui.ps1` 与 `scripts/smoke-canvas-frame-budget-ui-runner.js`，在测试页面临时注入 8 个 Vue Flow 卡片和图片探针，不保存项目、不触发真实生图；通过 `requestAnimationFrame` 统计拖拽与连续缩放的平均帧间隔、P95、最大帧间隔和长帧数，并接入 `SMOKE_UI=true` 预检。默认画布帧预算 smoke 通过：拖拽 `frames=145`、`avgDelta=16.67ms`、`p95Delta=16.8ms`、`longFramesOver100=0`；缩放 `frames=157`、`avgDelta=16.67ms`、`p95Delta=16.8ms`、`maxDelta=16.9ms`、`longFramesOver100=0`。
- 图片工具侧边栏修复：用户反馈选中图片节点后右侧工具栏只露出半截。定位为 `perf4` 中 `.vue-flow__node { contain: layout paint style; }` 的 paint containment 裁掉了图片节点外溢的 `image-node-toolbar`。已升级到 `20260629perf5`，取消普通 Vue Flow 节点的 paint containment，仅保留面板/浮层 contain；针对图片工具栏增加 `:has(.image-node-toolbar)`、`overflow: visible` 和 `z-index: 1200` 防裁切规则。性能 smoke 新增 `toolbarProbe`，验证 `contain=none`、`overflow=visible`、工具栏 `z-index=1200`；帧预算 smoke 复跑通过，拖拽/缩放 P95 仍约 `16.8ms`、长帧为 0。
- 图片节点对象化：用户要求图片节点像参考图一样成为“图片对象”，而不是复杂上传表单 UI。新增 `assets/canvas-image-node-polish.css` 并以 `20260629image2` 加载；有图节点改为图片本体优先，取消 `object-cover` 和 `max-height:220px` 裁切，使用 `object-fit: contain`、`max-height:520px` 和受控最大宽度，节点随图片原始比例展开并完整显示；标题和尺寸信息浮到图片上方，右侧工具栏继续保持 `z-index=1200`。空图片节点上传态也收敛为大图占位区，隐藏 URL 输入行。性能 smoke 新增 `imageNodeVisualProbe` 与 `loadedImageNodeProbe`，验证空图占位为 300x300、有图探针 800x1000 显示为 416x520 且 `objectFit=contain`；真实项目页读取到 1254x1254 图片按 416x416 完整显示。
- 图片节点自适应比例修正：用户反馈图片工具栏遮挡图片、图片节点没有按比例 box 展示。已升级到 `20260629image4`，有图节点改为由图片舞台决定 `fit-content` 尺寸，外壳不再参与固定宽度；右侧 `image-node-toolbar` 和折叠把手统一以图片 box 的右边缘为锚点 `left: calc(100% + gap)`，避免压在图片主体上。该改动仅限 `assets/canvas-image-node-polish.css` 旧画布过渡样式，不改 Provider、生图接口、节点数据结构或工作流 JSON。
- 边界：本轮不改真实生图接口、不改 Provider、不动 API Key 配置；GPU 加速指浏览器合成层优化，不是 WebGL 或 Canvas 重写。

## 2026-06-29 图片节点 image4 验收进度报告

- 分支：`codex/source-stack-canvas-rebuild`
- 完成内容：按用户指定刷新 `http://127.0.0.1:3456/canvas/project_1782707934819_dxzylygh5`，复核旧画布 `20260629image4` 图片节点补丁。指定项目页可加载旧画布壳和 `canvas-image-node-polish.css?v=20260629image4`；当前运行数据库 projects 为 0，该项目页没有读到已有真实节点，因此用 Playwright 在页面内临时注入方图、横图、竖图三种图片节点 DOM 探针，只测布局，不保存项目、不触发 API、不触发生图。
- 修改文件：`docs/progress-report.md`、`docs/review-log.md`、`docs/feature-completion-checklist.md`
- 验证方式：`SMOKE_CANVAS_PATH=/canvas/project_1782707934819_dxzylygh5` 运行 `powershell -NoProfile -ExecutionPolicy Bypass -File "F:\dianshang\scripts\smoke-canvas-performance-ui.ps1"`；临时 Playwright runner 注入 900x900 方图、1200x600 横图、600x1200 竖图并测量图片、舞台、右侧工具栏和折叠把手位置。
- 验证结果：指定项目 smoke 通过，性能资源、图片 polish CSS、工具栏防裁切、竖图 loadedImageNodeProbe、拖拽/缩放交互态和 Canvas Chat 拖拽均正常，console errors 为 0、bad responses 为 0。比例探针通过：方图显示 `520x520`，横图显示 `520x260`，竖图显示 `260x520`，三者 `objectFit=contain` 且显示比例与原图一致；右侧工具栏均在图片舞台右侧 `18px`，折叠把手均在右侧 `2px`，`toolbarOverlapsImage=false`。
- 当前完成度：图片节点 image4 验收约 95%；自动化证明 CSS 覆盖对三类比例有效，但真实项目当前没有已有节点可做人工选中截图。
- 新发现问题：指定项目页标题为“二蛋”，但项目数据未恢复出已有节点，页面初始 `nodeCount=0`；这不影响 CSS 探针结论，但真实历史项目恢复仍需另行排查。
- 未完成清单：继续测试真实生图链路：文生图、图生图、结果入画布、结果图可见；检查图生图是否正确携带参考图和提示词；如需人工验收真实节点，需要先恢复或创建包含图片节点的项目。
- 下一轮建议：先用非付费方式创建或导入一份含方/横/竖图节点的测试画布，再做可见截图；真实生图测试继续保持先确认费用边界。
- 需要人工介入：真实 Provider 生图会消耗额度；需要你确认测试范围后再触发。

## 2026-06-29 图片节点 image5 顶部工具条重做进度报告

- 触发背景：用户对 `image4` 的右侧侧边栏工具仍不满意，明确要求参考图 3/4，把图片节点工具改到顶部；普通图片、图像生成结果和 Canvas Chat 添加到画布的生成图统一使用同一套图片节点视觉规则。
- 完成内容：保留旧画布与 Vue Flow 运行链路，仅扩展图片节点 polish 层。`assets/canvas-image-node-polish.css` 升级为 `20260629image5`：有图节点继续以图片本体为主，顶部常驻标题与尺寸信息，选中/hover 时显示黑色圆角顶部横向工具条；旧 `.image-node-toolbar-wrap` 折叠把手隐藏；无图上传态的工具条隐藏且不可交互；工具条不再从右侧遮挡图片和连接点。
- 方向识别：新增 `assets/canvas-image-node-polish.js`，观察图片 natural width/height 并给节点打 `data-image-orientation="square|landscape|portrait|long"`，同时按标题文本推断 `data-image-source="generated|uploaded|remote"`，只作为视觉标记，不写入工作流 JSON。
- 长图策略：超长图不再受 `max-height: 520px` 限制，改为较窄宽度完整展开；方图、横图和普通竖图继续 `object-fit: contain` 等比完整显示。
- 修改文件：`index.html`、`assets/canvas-image-node-polish.css`、`assets/canvas-image-node-polish.js`、`scripts/smoke-canvas-performance-ui-runner.js`、`docs/progress-report.md`、`docs/review-log.md`、`docs/feature-completion-checklist.md`。
- 验证方式：`node --check "F:\dianshang\server.js"`；`node --check "F:\dianshang\assets\canvas-image-node-polish.js"`；`node --check "F:\dianshang\scripts\smoke-canvas-performance-ui-runner.js"`；指定项目运行 `SMOKE_CANVAS_PATH=/canvas/project_1782707934819_dxzylygh5` 的 `scripts/smoke-canvas-performance-ui.ps1`；`git -C "F:\dianshang" diff --check`。
- 验证结果：指定项目 smoke 通过，确认 `canvas-image-node-polish.css/js?v=20260629image5` 已加载，`window.__hjmCanvasImageNodePolish` 可用；方图显示 `520x520`、横图 `520x260`、普通竖图 `260x520`、超长图约 `259x5864` 且 `max-height=none`、生成结果方图 `520x520` 且 `source=generated`；五类探针均为 `object-fit: contain`，顶部工具条在图片舞台上方且不与图片矩形相交，旧折叠把手隐藏，console errors 为 0、bad responses 为 0。
- 边界：本轮不改 Provider、不动 API Key、不触发真实生图、不改变节点类型/连线类型/工作流 JSON；指定项目当前仍未自动恢复已有真实节点，人工验收需要刷新页面后选中真实或新建的图片节点确认观感。

## 2026-06-29 图片节点 image6 真实工具栏补丁

- 问题现象：用户截图显示真实图片节点仍出现白色右侧竖向工具栏，遮挡图片主体。复核发现真实 `ImageNodeToolbar` 是 `.image-node-wrapper` 的兄弟节点，而 `image5` 的主要选择器只覆盖了位于 `.image-node` 内部的模拟工具栏，导致真实 scoped 规则 `.image-node-toolbar[data-v-aaeac626]{ left:302px; flex-direction:column; height:calc(100% - 20px) }` 仍然生效。
- 完成内容：升级到 `20260629image6`；`canvas-image-node-polish.js` 给真实 Vue Flow 图片节点本身打 `image-node-has-image` 和 `image-node-is-selected` 类，并监听 class 变化；`canvas-image-node-polish.css` 改用节点级选择器覆盖真实 sibling 工具栏，强制顶部横向 `flex-direction: row`，隐藏折叠把手，继续保证不遮挡图片。
- 验证结果：指定项目 smoke 通过，确认 `image6` CSS/JS 加载；真实 sibling 工具栏探针测得 `toolbarFlexDirection=row`、`toolbarWidth=346`、`toolbarHeight=50`、`toolbarAboveStage=true`、`toolbarOverlapsStage=false`、`toggleDisplay=none`，已覆盖截图中的右侧竖栏回退。

## 2026-06-29 图片节点 image7 多按钮可见修复

- 问题现象：用户截图显示顶部工具条只露出一个 `AI 扩图` 按钮。定位为旧 scoped 按钮规则 `.image-node-tool-button[data-v-aaeac626]{ width:100% }` 仍在生效，横向容器里第一个按钮占满整条工具栏，后续按钮被挤到横向滚动区域外。
- 完成内容：升级到 `20260629image7`；图片节点工具按钮强制 `width:auto`、`max-width:136px`，继续保留顶部横向工具条和折叠把手隐藏。
- 验证结果：指定项目 smoke 通过，并给探针补上真实 `data-v-aaeac626` scoped 属性复现旧按钮宽度规则；当前结果为 `buttonCount=3`、`visibleButtonCount=3`、`maxButtonWidth=110`、`toolbarFlexDirection=row`、`toolbarOverlapsStage=false`。

## 2026-06-29 扩图面板 outpaint1 居中修复

- 问题现象：用户截图显示 `AI 扩图` 面板默认预览图没有居中，图片落在目标画布左上区域；用户同时指出绿色目标画布内移动范围有限制。
- 定位结果：扩图面板的图片位置来自旧 Canvas bundle 内部状态 `c.value`，只靠 CSS 居中会让显示位置和最终提交的 `imageX/imageY` 坐标不一致。原逻辑只在图片加载或比例切换后 `nextTick(P)` 一次，若面板尺寸随后稳定为真实宽高，初始中心点不会再次按目标画布重算。
- 完成内容：仅修旧画布 bundle 中 `OutpaintPanel` 的布局重算时机，不改 Provider、不动 API Key、不触发真实生图。图片加载和比例切换后改为 `nextTick + requestAnimationFrame + 80ms` 复算，使默认位置按最终目标画布尺寸居中；拖拽边界仍沿用原有 clamp，保证图片不会拖出目标画布提交范围。
- 缓存刷新：入口 `index.html` 与两个 Vue entry 中 Canvas 动态 import 升级为 `20260629outpaint1`，性能资源继续保持 `20260629perf5`，图片节点 polish 继续保持 `20260629image7`。
- 修改文件：`index.html`、`assets/index-DglIsp_g.js`、`assets/index-ZrBcanD1.js`、`assets/Canvas-B8bY9_QL.js`、`assets/Canvas-yGc8b2gf.js`、`scripts/smoke-canvas-performance-ui-runner.js`、`scripts/verify-canvas-performance-assets.js`、`docs/progress-report.md`、`docs/review-log.md`、`docs/feature-completion-checklist.md`。
- 验证方式与结果：`node --check "F:\dianshang\server.js"`、`node --check "F:\dianshang\assets\canvas-image-node-polish.js"`、`node --check "F:\dianshang\scripts\smoke-canvas-performance-ui-runner.js"`、`node --check "F:\dianshang\scripts\verify-canvas-performance-assets.js"` 均通过；`node "F:\dianshang\scripts\verify-canvas-performance-assets.js"` 返回 `version=20260629perf5+outpaint1`；`index-DglIsp_g.js?v=20260629outpaint1`、两个 Canvas chunk `?v=20260629outpaint1`、图片节点 polish `image7` CSS/JS 均 HTTP 200；指定项目 `SMOKE_CANVAS_PATH=/canvas/project_1782707934819_dxzylygh5` 的画布 smoke 通过，console errors 为 0、bad responses 为 0；`git diff --check` 通过，仅有既有 CRLF warning；本轮触达文件 BOM 检查均为 false。
- 验收标准：刷新指定项目后打开图片节点的 `AI 扩图`，默认图像应位于黄色/绿色目标画布中心；比例按钮切换后继续居中；拖动图片时仍受目标画布范围限制，不越界、不改变真实生图链路。

## 2026-06-29 扩图面板 outpaint2 缩放位置保持修复

- 问题现象：用户继续反馈扩图面板在缩放时无法自动保持位置。
- 定位结果：缩放滑条的计算依赖 `u.value`，但真实 input 事件中 Vue 指令更新和显式 `onInput` 的执行顺序可能导致计算读到上一帧缩放值，表现为缩放位置不稳定或滞后一帧；同时需要明确缩放锚点应为当前图片中心，而不是重新按默认居中。
- 完成内容：旧 Canvas bundle 的扩图缩放 handler 改为直接读取当前 range 事件值并同步 `u.value`，再以当前图片中心点计算新宽高和 `x/y`；只有触达目标画布边界时才沿用原 clamp 逻辑回到合法范围。默认打开和比例切换仍使用 `outpaint1` 的居中复算。
- 缓存刷新：入口 `index.html` 与两个 Vue entry 中 Canvas 动态 import 升级为 `20260629outpaint2`；性能资源继续保持 `20260629perf5`，图片节点 polish 继续保持 `20260629image7`。
- 修改文件：`index.html`、`assets/index-DglIsp_g.js`、`assets/index-ZrBcanD1.js`、`assets/Canvas-B8bY9_QL.js`、`assets/Canvas-yGc8b2gf.js`、`scripts/smoke-canvas-performance-ui-runner.js`、`scripts/verify-canvas-performance-assets.js`、`docs/progress-report.md`、`docs/review-log.md`、`docs/feature-completion-checklist.md`。
- 验证方式与结果：`node --check "F:\dianshang\server.js"`、`node --check "F:\dianshang\assets\canvas-image-node-polish.js"`、`node --check "F:\dianshang\scripts\smoke-canvas-performance-ui-runner.js"`、`node --check "F:\dianshang\scripts\verify-canvas-performance-assets.js"` 均通过；`node "F:\dianshang\scripts\verify-canvas-performance-assets.js"` 返回 `version=20260629perf5+outpaint2`，确认默认居中补丁和缩放保持位置补丁均在两个 Canvas bundle 中；`index-DglIsp_g.js?v=20260629outpaint2`、两个 Canvas chunk `?v=20260629outpaint2`、图片节点 polish `image7` CSS/JS 均 HTTP 200；指定项目画布 smoke 通过，确认入口资源、图片节点工具条、比例探针、拖拽/缩放性能态均正常，console errors 为 0、bad responses 为 0。
- 验收标准：强刷指定项目后打开 `AI 扩图`，先拖动图片到目标画布中某个位置，再拖动“原图等比缩放”滑条；图片应围绕当前中心缩放，除非碰到画布边界才被限制回合法范围。

## 2026-06-29 扩图面板 outpaint3 舞台比例修复

- 问题现象：用户截图显示 `1:1` 扩图面板里的黄色目标画布被压成横向矩形；初始图很小，滑条拉到最大后图片仍只占上半部分，无法铺满 1:1 目标画布。
- 定位结果：旧 CSS 给 `.outpaint-stage` 固定了 `max-height:230px`。在弹窗宽度约 320px 时，`1:1` 舞台本应是方形，但实际高度被压到 230px；后续缩放计算只能以这个被压扁的高度为最大 contain 基准，所以 100% 也无法填满方形目标。
- 完成内容：旧 Canvas bundle 的扩图舞台样式改为按比例自适应：`maxHeight:none`，横图/方图使用可用宽度，竖图按 `56vh` 自动收窄以保持完整比例和弹窗可用性。这样 `1:1` 为真正方形，`16:9` 为横向画布，`9:16` 为较窄竖向画布；100% 缩放表示原图按比例完整贴合目标画布。
- 缓存刷新：入口 `index.html` 与两个 Vue entry 中 Canvas 动态 import 升级为 `20260629outpaint3`；性能资源继续保持 `20260629perf5`，图片节点 polish 继续保持 `20260629image7`。
- 修改文件：`index.html`、`assets/index-DglIsp_g.js`、`assets/index-ZrBcanD1.js`、`assets/Canvas-B8bY9_QL.js`、`assets/Canvas-yGc8b2gf.js`、`scripts/smoke-canvas-performance-ui-runner.js`、`scripts/verify-canvas-performance-assets.js`、`docs/progress-report.md`、`docs/review-log.md`、`docs/feature-completion-checklist.md`。
- 验证方式与结果：`node --check "F:\dianshang\server.js"`、`node --check "F:\dianshang\assets\canvas-image-node-polish.js"`、`node --check "F:\dianshang\scripts\smoke-canvas-performance-ui-runner.js"`、`node --check "F:\dianshang\scripts\verify-canvas-performance-assets.js"` 均通过；`node "F:\dianshang\scripts\verify-canvas-performance-assets.js"` 返回 `version=20260629perf5+outpaint3`；`index-DglIsp_g.js?v=20260629outpaint3`、两个 Canvas chunk `?v=20260629outpaint3`、图片节点 polish `image7` CSS/JS 均 HTTP 200；指定项目 `/canvas/project_1782722806029_6dez0ml5d` 的画布 smoke 通过，确认入口资源、图片节点工具条、比例探针、拖拽/缩放性能态均正常，console errors 为 0、bad responses 为 0。
- 验收标准：强刷后打开 `AI 扩图`，`1:1` 黄色目标画布应为方形；滑条拉到最大时，方图应完整铺满方形舞台；横图/竖图按各自比例完整贴合，不再被 `230px` 高度压扁。

## 2026-06-29 扩图面板 outpaint4 自由移动与等比放大修复

- 问题现象：用户追问扩图内容能否在绿色画布里自由移动，以及缩放能否等比例缩放。实际体验里，图片拉到最大后被锁住，无法拖动取景。
- 定位结果：旧拖动 clamp 只允许图片完整位于目标画布内，公式为 `0..stageSize-imageSize`；当图片尺寸等于或大于目标画布时，上限被压到 0，导致放大后无法移动。
- 完成内容：新增双模式位置限制：图片小于目标画布时，整张图片保留在绿色画布内自由移动；图片大于目标画布时，允许图片在绿色画布内平移取景，但不露出空白。缩放仍以当前中心点为锚点等比例缩放。
- 缩放范围：滑条从 `35-100` 调整为 `20-220`。`100%` 表示原图按比例完整贴合目标画布，超过 `100%` 为等比例放大，可拖动选择保留区域。
- 缓存刷新：入口 `index.html` 与两个 Vue entry 中 Canvas 动态 import 升级为 `20260629outpaint4`；性能资源继续保持 `20260629perf5`，图片节点 polish 继续保持 `20260629image7`。
- 修改文件：`index.html`、`assets/index-DglIsp_g.js`、`assets/index-ZrBcanD1.js`、`assets/Canvas-B8bY9_QL.js`、`assets/Canvas-yGc8b2gf.js`、`scripts/smoke-canvas-performance-ui-runner.js`、`scripts/verify-canvas-performance-assets.js`、`docs/progress-report.md`、`docs/review-log.md`、`docs/feature-completion-checklist.md`。
- 验证方式与结果：`node --check "F:\dianshang\server.js"`、`node --check "F:\dianshang\assets\canvas-image-node-polish.js"`、`node --check "F:\dianshang\scripts\smoke-canvas-performance-ui-runner.js"`、`node --check "F:\dianshang\scripts\verify-canvas-performance-assets.js"` 均通过；`node "F:\dianshang\scripts\verify-canvas-performance-assets.js"` 返回 `version=20260629perf5+outpaint4`，确认新 clamp、`20-220` 缩放范围和旧限制规则不回退；`index-DglIsp_g.js?v=20260629outpaint4`、两个 Canvas chunk `?v=20260629outpaint4`、图片节点 polish `image7` CSS/JS 均 HTTP 200；指定项目 `/canvas/project_1782722806029_6dez0ml5d` 的画布 smoke 通过，console errors 为 0、bad responses 为 0。
- 验收标准：强刷后打开 `AI 扩图`，将缩放拉到超过 `100%`，图片应等比例变大；拖动图片时可以在绿色目标画布内平移取景，且不会露出空白区域。

## 2026-06-29 扩图面板 outpaint6 绿色画布自由摆放修复

- 问题现象：用户指出前一版仍误解需求。扩图不是裁剪器，图片贴到右侧或右下角后不应被限位卡死；绿色区域可以露出，露出的部分就是待扩展生成区域。
- 纠偏结论：`outpaint4` 的“不露空 clamp”是错误方向，适合裁剪，不适合扩图。扩图需要允许图片在绿色目标画布中自由摆放，而不是强制覆盖目标画布。
- 完成内容：位置限制改为宽松边界 `[-imageSize, stageSize]`，允许图片向任意方向拖动直到整张图片即将完全离开目标画布；这样右侧、右下角、空白区都不会再因为“不露空”逻辑卡死。舞台本身也绑定 pointerdown，按住绿色空白区域也能拖动图片层。
- 缩放范围：滑条从 `20-220` 进一步放宽为 `20-300`，继续保持等比例缩放。
- 缓存刷新：入口 `index.html` 与两个 Vue entry 中 Canvas 动态 import 升级为 `20260629outpaint6`；性能资源继续保持 `20260629perf5`，图片节点 polish 继续保持 `20260629image7`。
- 修改文件：`index.html`、`assets/index-DglIsp_g.js`、`assets/index-ZrBcanD1.js`、`assets/Canvas-B8bY9_QL.js`、`assets/Canvas-yGc8b2gf.js`、`scripts/smoke-canvas-performance-ui-runner.js`、`scripts/verify-canvas-performance-assets.js`、`docs/progress-report.md`、`docs/review-log.md`、`docs/feature-completion-checklist.md`。
- 验证方式与结果：`node --check "F:\dianshang\server.js"`、`node --check "F:\dianshang\assets\canvas-image-node-polish.js"`、`node --check "F:\dianshang\scripts\smoke-canvas-performance-ui-runner.js"`、`node --check "F:\dianshang\scripts\verify-canvas-performance-assets.js"` 均通过；`node "F:\dianshang\scripts\verify-canvas-performance-assets.js"` 返回 `version=20260629perf5+outpaint6`，确认自由摆放 clamp、舞台空白拖动入口、`20-300` 缩放范围均存在，且旧“不露空” clamp 不回退；`index-DglIsp_g.js?v=20260629outpaint6`、两个 Canvas chunk `?v=20260629outpaint6`、图片节点 polish `image7` CSS/JS 均 HTTP 200；指定项目画布 smoke 通过，console errors 为 0、bad responses 为 0。
- 验收标准：强刷后打开 `AI 扩图`，无论按住图片还是绿色空白区域都能拖动；图片可以拖到右侧、右下角并继续移动，绿色区域允许露出作为待扩图区域；缩放仍保持等比例。

## 2026-06-29 重绘接入 GPT Image 2 图生图编辑

- 触发背景：用户要求“把重绘接到图生图里 GPT Image 2”。旧画布图片节点的 `局部修改`/`AI 智能消除` 面板已在前端调用 `/api/image-tools/inpaint` 和 `/api/image-tools/erase`，但后端此前没有对应路由，按钮无法进入真实图生图链路。
- 完成内容：新增 `/api/image-tools/inpaint` 和 `/api/image-tools/erase`，复用现有 `callProviderImageEdit`，把前端传入的 `imageUrl`、`maskBase64`、`prompt`、`referenceImages` 转成 OpenAI-compatible `/images/edits` 请求；模型按线路选择解析，默认仍是 `gpt-image-2`。同时修正 mask 传递条件，单张原图 + mask 也会带 `mask` 文件，不再要求参考图数量大于 1。
- 兼容补丁：新增 `/api/upload/image` 兼容旧画布参考图上传入口，返回 `url/imageUrl/originalUrl`；`data:image/*` mask 现在可直接作为编辑文件读取。
- 边界：本轮不改 Provider、不动 API Key、不改工作流 JSON、不触发真实生图；image-tools 路由只做编辑调用适配，不新增计费逻辑。
- 验证方式与结果：已重启 `http://127.0.0.1:3456` 的本地服务，`/api/health` 指向 `F:\dianshang` 且 Provider 仍为 `real-provider-ready`；未授权探测 `/api/image-tools/inpaint`、`/api/image-tools/erase`、`/api/upload/image` 均返回 `401` 而非 `404`，确认新路由已加载且未触发上游；静态检查和 diff 检查另见本轮复核记录。
- 待人工验收：登录后在真实图片节点打开 `局部修改`，涂抹 mask 并输入提示词后提交，会真实调用 GPT Image 2 edits，可能消耗上游额度；需由用户确认测试范围后再点测。

## 2026-06-29 image-tools tools1 顶部工具接线

- 触发背景：用户要求顶部图片工具条里除 `AI 超清放大` 和 `一键抠图` 外，其它按钮都接上可用链路。
- 完成内容：入口和两个旧 Canvas bundle 升级为 `20260629tools1`；`AI 扩图` 补 `/api/image-tools/outpaint`，返回标准生成任务供旧轮询逻辑消费；`反推提示词` 补 `/api/image-tools/reverse-prompt`，打开面板时请求文本模型并展示 `prompt/text`；`文字编辑` 改接现有 mask 局部重绘面板，保留 `text_edit` 类型并在后台生成文字编辑专用图生图提示词。
- 已接工具：`AI 扩图`、`格式/压缩`、`反推提示词`、`AI 智能消除`、`局部修改`、`文字编辑`、`图片尺寸调整`、`图片裁剪`、`添加到聊天`、`生成视频`。其中格式/压缩、尺寸、裁剪为本地处理后走上传兼容入口；局部修改/智能消除/文字编辑/扩图在用户点击提交时才调用 GPT Image 2 编辑链路。
- 保留未接：`AI 超清放大` 和 `一键抠图` 明确保持未接入；新增 `/api/image-tools/settings` 中也标记为 `enabled:false`，不误导为可用真实链路。
- 边界：不改 Provider、不动 API Key、不改变节点类型、连线类型或工作流 JSON；本轮验证不触发真实生成，仅做路由存在性和页面加载验证。
- 验证方式与结果：服务已重启到 `F:\dianshang`；未登录探测 `/api/image-tools/settings`、`/outpaint`、`/reverse-prompt`、`/inpaint`、`/erase` 均返回 `401` 而非 `404`；`node --check` 覆盖 `server.js`、两个 Canvas bundle、图片节点 polish JS、smoke runner 和资源校验脚本；`verify-canvas-performance-assets.js` 返回 `20260629perf5+tools1`；指定项目画布 UI smoke 第二次通过，确认 `index-DglIsp_g.js?v=20260629tools1` 加载、顶部工具条不遮挡、图片比例探针通过、console errors 为 0。

## 2026-06-29 API 线路源码页生产入口修复

- 问题现象：用户截图确认早上改过 `frontend/src/views/AdminApiProvidersSource.vue`、`frontend/src/api/adminApiProviders.ts` 和 `frontend/src/config/providerCapabilities.ts`，但当前生产 URL `/admin/api-providers` 仍显示旧 `AdminShell` 表格，看不到源码页中的官方双线路目标卡、请求示例和旧后台字段表单。
- 定位结果：`http://127.0.0.1:3456/admin/api-providers` 实际加载根目录旧入口 `assets/index-DglIsp_g.js?v=20260629tools1`，其后台路由仍指向 `AdminShell-CnxotuTf.js`；源码页已构建在 `frontend/dist`，但没有被 3456 生产入口接管。
- 完成内容：在 `server.js` 中为 `/admin/api-providers` 单独返回 `frontend/dist/index.html`，并给 `/assets` 增加 `frontend/dist/assets` 兜底静态资源；只切这一条后台源码页，不切全站、不影响旧画布、不改 Provider、不动 API Key。
- 验证结果：重启服务后 `/api/health` 仍指向 `F:\dianshang`；内置浏览器打开 `/admin/api-providers` 已加载 `assets/index-D1smZqeB.js` 和源码 `admin-source-shell`；页面可见 `应用官方双线路`、`/images/generations`、`/images/edits`、`/responses`、`图生图 / 局部重绘`、两条线路和编辑入口。

## 2026-06-29 API 线路源码页旧后台导航桥接

- 问题现象：用户从旧后台/旧首页进入时，客户端路由仍在已加载的旧 `index-DglIsp_g.js` 内部渲染旧 `AdminShell` 表格；即使直达 `/admin/api-providers` 已能加载源码页，旧后台菜单点击仍会“变回旧版”。
- 完成内容：新增 `assets/admin-api-source-route-bridge.js` 并在根 `index.html` 加载；当旧后台点击 `API 线路管理`，或旧客户端路由停在 `/admin/api-providers` 且仍是旧入口时，强制整页跳转到同一路径，让 `server.js` 的源码页路由接管。
- 验证结果：从 `http://127.0.0.1:3456/admin/dashboard` 点击旧后台 `API 线路管理` 后，浏览器落到 `/admin/api-providers`，加载源码 bundle `assets/index-D1smZqeB.js`，页面存在 `admin-source-shell`，可见 `应用官方双线路`、`/images/generations`、`/images/edits`、`/responses`。

## 2026-06-29 后台源码侧栏与路由统一

- 问题现象：用户指出后台选择页面一会菜单多、一会菜单少。复核确认源码后台各页面手写侧栏，入口数量和顺序不一致；同时服务端只把 `/admin/api-providers` 交给源码前端，其它 `/admin/...` 直达路径仍进入旧入口。
- 完成内容：新增 `frontend/src/components/AdminSourceSidebar.vue` 作为源码后台共用侧栏，统一 11 个入口：控制台、用户、回收站、订单、消费日志、任务监控、兑换码、API 线路、模型价格、模板工作流、系统设置；11 个 `Admin*Source.vue` 页面均改为使用该组件。`server.js` 将已源码化后台路径统一返回 `frontend/dist/index.html`，旧入口桥接脚本也扩展到全部后台源码页。
- 构建结果：`frontend/dist` 已重新构建，源码入口 bundle 更新为 `assets/index-Cr_6CD7V.js`，并生成共用侧栏 chunk。
- 验证结果：`node --check server.js`、`node --check assets/admin-api-source-route-bridge.js`、`node scripts/check-source-frontend-routes.js`、`npm run typecheck`、`npm run build` 均通过；服务重启后直接打开 `/admin/api-providers`、`/admin/orders`、`/admin/settings`、`/admin/template-workflows` 都加载源码后台，侧栏均为 11 个入口且高亮当前页面。

## 2026-06-30 日志扫描与路线图对齐进度报告

- 触发背景：用户要求“扫描日志，展开工作”。本轮先读取 `logs/`、`docs/progress-report.md`、`docs/review-log.md` 和 `docs/progress-maintainability-audit-2026-06-30.md`，确认最近工作停在后台源码侧栏统一、API 线路源码页接管、首页工作台和旧画布直跳 smoke 加固。
- 扫描结论：`logs/manual-gen-frontend-err.log` 中的 Vite `F:\dianshang\assets\home-product-workbench.png` 越界报错已是历史问题，当前 `HomeWorkbench.vue` 使用 `frontend/src/assets/home-product-workbench.png`；真正落后的状态是路线图、验收清单和 README 仍保留“首页迁移索引”“旧画布入口壳”“API 线路只读”等旧描述。
- 完成内容：更新 `frontend/src/config/frontendMigration.ts`、`docs/frontend-migration-roadmap.md`、`docs/source-frontend-acceptance-checklist.md` 和 `README.md`，将 `/canvas` 描述为直跳旧画布运行时，将 `/admin/api-providers` 标记为写入试点，将 `/admin/settings` 描述为基础设置与图片工具配置保存试点，并同步后台共用侧栏状态。
- Smoke 加固：完整源码前端 UI smoke 首次复跑暴露两个问题：任务监控脚本固定搜索 `simple` 会把当前真实任务列表筛空；移动端用户管理页存在 65px 横向溢出。已将任务监控 smoke 改为从首条真实任务提取 ID/模型/提示词作为搜索词，并补移动端后台面板、工具栏控件和分页的宽度收敛规则。
- 边界：本轮只做日志扫描后的文档与迁移索引对齐，不触发真实 Provider、不写真实 Key、不点击测试连接、不删除生产数据、不继续扩大旧画布打包资产修改面。
- 验证方式：`npm.cmd run check:routes --prefix "F:\dianshang\frontend"`；`npm.cmd run typecheck --prefix "F:\dianshang\frontend"`；`node --check "F:\dianshang\scripts\smoke-source-frontend-ui-runner.js"`；`powershell -NoProfile -ExecutionPolicy Bypass -File "F:\dianshang\scripts\smoke-source-frontend-ui.ps1"`；`npm.cmd run build --prefix "F:\dianshang\frontend"`；`git -C "F:\dianshang" diff --check`；触达文本文件 BOM 检查。
- 验证结果：CodeGraph 索引健康；路由维护检查通过，仍为 `21/21 source routes`；前端类型检查通过；smoke runner 语法检查通过；完整源码前端 UI smoke 通过，注册临时账号已清理，旧站首页工作台、旧画布直跳、后台源码页、移动端后台 11 页横向溢出均验证通过；前端构建通过；`diff --check` 通过，仅有既有 Git CRLF 提示；本轮触达文本文件 BOM 均为 false。

## 2026-06-30 后端与旧画布边界护栏进度报告

- 触发背景：用户要求先把旧画布和后端做好，用户继续做业务 debug。本轮选择低风险护栏切片，不拆 `server.js`、不改旧画布运行逻辑、不触发真实 Provider。
- 完成内容：新增 `scripts/smoke-backend-canvas-boundary.ps1`，使用临时 SQLite、临时 uploads 和临时日志目录启动一次 disposable 后端，并强制设置 `ENABLE_REAL_AI/EMAIL/PAYMENT/STORAGE=false`。脚本验证 `/canvas` 返回旧画布入口 HTML，关键旧画布资产 `canvas-performance-mode`、`canvas-image-node-polish`、`admin-api-source-route-bridge`、两个 Canvas bundle 和旧入口 bundle 均 HTTP 200。
- 后端边界：脚本验证 `/api/settings/canvas-storage` 公开配置形态；未登录访问 `/api/image-tools/settings`、`/tasks/:id`、`/outpaint`、`/reverse-prompt`、`/inpaint`、`/erase` 和 `/api/upload/image` 均为 `401` 而非 `404`；管理员登录后 `/api/image-tools/settings` 返回 outpaint/reversePrompt 已启用，同时 `upscale/removeBg` 保持禁用；管理员无文件上传 `/api/upload/image` 返回 `400`，确认路由存在但不写文件。
- 预检接入：`scripts/preflight-check.ps1` 默认加入 `backend/canvas boundary smoke`，让后端和旧画布入口在常规预检里一起守住。
- 文档同步：更新 `docs/canvas-migration-checklist.md` 中过期的旧 `LegacyCanvasRedirect.vue` 文件名，改为当前 `CanvasLegacySource.vue` 直跳旧画布运行时；README 后端/旧资产维护命令加入新 smoke 和画布资产静态校验。
- 验证方式：`powershell -NoProfile -ExecutionPolicy Bypass -File "F:\dianshang\scripts\smoke-backend-canvas-boundary.ps1"`；`node --check "F:\dianshang\server.js"`；`node "F:\dianshang\scripts\verify-canvas-performance-assets.js"`；默认预检；`git -C "F:\dianshang" diff --check`；触达文件 BOM 检查。
- 验证结果：新边界 smoke 单独通过；默认 `scripts/preflight-check.ps1` 通过，包含 `node --check server.js`、画布性能资产静态校验、新增 backend/canvas boundary smoke、disposable API smoke、前端路由 smoke、Provider guard 和当前服务 health；Provider guard 识别当前真实 Provider ready 后跳过 mock route/chat 调用，未触发外部付费请求。

## 2026-06-30 Canvas Chat 对话只出提示词补丁

- 触发背景：用户调整业务边界，要求 Canvas Chat 对话模式只负责“按图顺序 + 需求”生成可编辑提示词；实际生图由用户切到 `快速` 标签手动完成。
- 完成内容：`assets/canvas-chat-prompt-flow.js/css` 升级为 `prompt6`，只在旧 Canvas Chat 的 `对话` 标签接管发送按钮和回车发送；桥接层按可见顺序收集参考图，必要时把浏览器 `blob:` 图片转为 `data:image/*`，调用 `/api/canvas/generate-prompt` 返回可编辑提示词草稿，并提供复制/重新生成/取消操作；提示说明已改为黑色居中无底框小字，并只在 `对话` 标签显示，避免快速模式出现“切到快速模式”的不一致提示。
- 后端保留：`/api/canvas/generate-prompt` 继续优先使用文本线路 `/responses` 生成提示词；文本线路 mock 或失败时返回基础可编辑草稿，不再把 Provider 错误当成生成结果。
- 边界：不改旧 Canvas 主 bundle，不新增依赖，不触发 `/api/generate/tasks` 或任何真实图片生成；对话模式不再提供 `确认生图`，生图回到 `快速` 标签由用户手动执行。
- 验证方式：`node --check "F:\dianshang\server.js"`；`node --check "F:\dianshang\assets\canvas-chat-prompt-flow.js"`；`powershell -NoProfile -ExecutionPolicy Bypass -File "F:\dianshang\scripts\smoke-backend-canvas-boundary.ps1"`；浏览器刷新当前画布后检查 `window.__hjmCanvasChatPromptFlow`、对话模式提示条和当前面板接管状态。

## 2026-06-30 Canvas Chat 兜底文案收敛

- 触发背景：用户确认对话模式在文本模型暂不可用时，应提示“文本模型暂不可用，已生成基础提示词，可编辑后复制到快速模式。”，不再把接口错误或上游渠道错误直接展示成生成结果。
- 完成内容：`assets/canvas-chat-prompt-flow.js` 中 `fallback` 返回、mock 兜底和接口异常 catch 分支统一使用该提示文案；基础提示词仍写入可编辑草稿框，用户可复制到 `快速` 模式手动生图。
- 边界：不改后端 Provider 配置，不触发真实文本模型或图片生成，不改变旧画布主 bundle 和工作流 JSON。
- 验证方式与结果：`node --check "F:\dianshang\assets\canvas-chat-prompt-flow.js"`、`node --check "F:\dianshang\server.js"` 和 `powershell -NoProfile -ExecutionPolicy Bypass -File "F:\dianshang\scripts\smoke-backend-canvas-boundary.ps1"` 均通过；smoke 中 `/api/canvas/generate-prompt` 未登录返回 `401`、管理员登录后返回 `200`，未触发真实 Provider。

## 2026-06-30 Canvas Chat 对话 Agent 生图链路

- 触发背景：用户纠正最新业务线，Agent 生图链路属于 `对话` 模式，不是 `快速` 模式；此前“对话只出提示词，生图切快速”的临时边界被替换。
- 完成内容：新增 `/api/canvas/dialog-agent-generate` 对话专用编排入口：参考图和用户需求先进入 GPT 5.5 文本线路分析，得到 `analysisSummary/finalPrompt` 后再调用 GPT Image 2 图片线路；分析失败或生图失败均直接返回失败，不继续兜底生图，不扣余额。
- 旧画布接入：`assets/canvas-chat-prompt-flow.js/css` 升级为 `20260630dialogagent1`，只接管 `对话` 标签，展示“正在分析图片和需求...”“正在生成图片...”“生成结果”三段状态；成功后在对话卡片展示摘要和结果图，完整 prompt 存入结果和画布节点 meta。
- 自动入画布：两个旧 Canvas bundle 增加 `canvas:add-generated-image-to-canvas` 事件监听，复用既有图片节点创建逻辑，把对话 Agent 结果自动放回画布；入口和动态 import 缓存版本同步升级为 `20260630dialogagent1`。
- 边界：快速模式保持旧的快速生图逻辑，不走 GPT 5.5 分析；视频模式不改；不改 Provider 配置，不主动触发真实 GPT 5.5 或 GPT Image 2 付费测试。
- 验证方式：`node --check "F:\dianshang\server.js"`；`node --check "F:\dianshang\assets\canvas-chat-prompt-flow.js"`；两个旧 Canvas bundle 语法检查；`node "F:\dianshang\scripts\verify-canvas-performance-assets.js"`；`powershell -NoProfile -ExecutionPolicy Bypass -File "F:\dianshang\scripts\smoke-backend-canvas-boundary.ps1"`；`git -C "F:\dianshang" diff --check`；触达文本文件 BOM 检查。
- 验证结果：上述语法检查、资产校验、backend/canvas boundary smoke 和 disposable API smoke 均通过；boundary smoke 确认新入口未登录为 `401`，mock 登录后返回 `analysisSummary/finalPrompt/resultImages`，成本字段为 `analysisCost=5`、`imageCost=10`、`totalCost=15`；`diff --check` 仅有既有 CRLF 提示，触达文本文件 BOM 均为 false。

## 2026-06-30 Canvas Chat 对话 Agent GPT 5.5 超时修复

- 触发背景：真实 Provider 后台可看到 GPT 5.5 请求记录，且耗时出现 42 秒，但旧画布对话卡片仍显示 “AI Provider 请求超时”。
- 定位结论：后端文本 Provider 默认 `PROVIDER_TIMEOUT_MS` 为 30 秒；上游即使在本地 fetch abort 后继续完成并记账，本地也已经收不到响应，因此出现“后台有记录但前端超时”的现象。
- 完成内容：将文本 Provider 默认等待时间提高到 120 秒；`callProviderResponses` 支持单次 `timeoutMs` 覆盖；`/api/canvas/dialog-agent-generate` 的 GPT 5.5 分析阶段显式使用 `CANVAS_DIALOG_ANALYSIS_TIMEOUT_MS`，超时时返回 `CANVAS_DIALOG_ANALYSIS_TIMEOUT` 和 `stage: analysis`，前端可明确知道是分析阶段超时。
- 边界：不改 Provider 配置、不改 API Key、不触发真实 GPT 5.5 或 GPT Image 2 测试；本地余额仍只在端到端成功后扣除，但上游在本地超时后是否继续记账取决于 Provider。
- 验证方式：`node --check "F:\dianshang\server.js"`；`powershell -NoProfile -ExecutionPolicy Bypass -File "F:\dianshang\scripts\smoke-backend-canvas-boundary.ps1"`；`powershell -NoProfile -ExecutionPolicy Bypass -File "F:\dianshang\scripts\smoke-api-disposable.ps1"`；浏览器刷新旧画布入口确认可打开。

## 2026-06-30 Canvas Chat 对话 Agent GPT 5.5 文本提取修复

- 触发背景：超时修复后，真实 GPT 5.5 调用不再超时，但对话卡片显示 “GPT 5.5 未返回可用的生图提示词”。
- 定位结论：`parseCanvasDialogAgentPlan` 已允许把非 JSON 文本直接作为最终 prompt；真正失败点是 `imageToolOutputText` 没有兼容 New-API/OpenAI 返回中 `choices[].message.content[]`、`output[].content[].text/value` 等嵌套文本结构，导致成功响应被当成空文本。
- 完成内容：新增 `normalizeProviderContentText`，统一递归抽取 `output_text/outputText/text/content/value/message/delta/data/result/response` 中的文本；`imageToolOutputText` 改为同时支持 Responses API 和 Chat Completions 风格的数组内容。
- 边界：不改对话 Agent 业务流程、不改扣费逻辑、不做本地基础提示词兜底生图；如果 GPT 5.5 真实返回完全无文本，仍按分析失败处理。

## 2026-06-30 Canvas Chat 对话 Agent GPT Image 2 多参考图修复

- 触发背景：用户观察到对话 Agent 生成结果更像只按提示词文案生成，没有继承图2产品/包装特征，怀疑参考图未传到 GPT Image 2。
- 定位结论：前端会把多张参考图传入 `/api/canvas/dialog-agent-generate`，GPT 5.5 分析阶段能看到多图；但后端 `callProviderImageEdit` 真实提交 `/images/edits` 时只加载并 append 了 `references[0]`，导致第二张及之后的参考图只进入文本分析，没有进入 GPT Image 2 生图阶段。
- 完成内容：无 mask 的图生图编辑现在最多按顺序加载 16 张参考图，并在 multipart 中使用 `image[]` 提交给 Provider；带 mask 的局部重绘仍保持单图 + mask，避免破坏旧工具链路。对话 Agent 多图 prompt 额外前置 “输入参考图按顺序为：图1、图2...” 以匹配用户话术和文件顺序。
- 边界：不触发真实 Provider 测试；本轮只修复多图上传语义和 prompt 顺序提示，不改变模型配置、扣费规则或快速模式逻辑。

## 2026-06-30 Canvas Chat 对话 Agent 参数控件接入

- 触发背景：用户要求把快速模式底部的 `张数`、`清晰度`、`比例` 三个控制项也放到 `对话` 模式里。
- 完成内容：`assets/canvas-chat-prompt-flow.js/css` 升级为 `20260630dialogagent2`；对话模式底部会补充 `张数 / 清晰度 / 比例` 三项参数，默认 `1张 / 1K / 1:1`。提交对话 Agent 时会把 `imageCount/count/n`、`quality/clarity`、`ratio/aspectRatio` 一起传给 `/api/canvas/dialog-agent-generate`。
- 历史展示：用户消息卡片追加本次设置行，例如 `1张 · 1K · 1:1`，便于回看当次生成参数。
- 边界：不改快速模式和视频模式；不改旧 Canvas 主 bundle；不触发真实 Provider 测试。

## 2026-06-30 Canvas Chat 参数控件旧设计语言修复

- 触发背景：用户指出新增参数控件没有继承旧画布设计语言，表现为原生下拉与快速模式原有控件不一致。
- 完成内容：`assets/canvas-chat-prompt-flow.js/css` 升级为 `20260630dialogagent5`；对话和视频底部参数改为旧式 `canvas-chat-control compact-control` 风格按钮，不再使用原生 `select`。`张数`、`清晰度` 菜单恢复为深色竖向浮层，`比例` 菜单恢复为浅色比例卡片网格。
- 快速模式：保留旧 Canvas Chat 原生快速控件，只做布局归组，避免重复、挤压和与对话参数状态串用。
- 边界：只修旧画布桥接层和入口缓存版本，不改后端 Provider、不触发真实生图、不改旧 Canvas 主 bundle。

## 2026-06-30 Canvas Chat 参数控件去桥接层修复

- 触发背景：用户复核指出 `dialogagent5` 仍是桥接层自造控件，且快速模式参数按钮仍然重叠。
- 完成内容：`assets/Canvas-B8bY9_QL.js` 和 `assets/Canvas-yGc8b2gf.js` 将 Canvas Chat 原生参数控件从“仅快速模式渲染”改为三种模式都渲染；`assets/canvas-chat-prompt-flow.js` 升级为 `20260630dialogagent6`，撤掉 `hjm-dialog-agent-settings`/`hjm-native-param-settings` 注入逻辑，只清理旧残留并读取旧控件文本。
- 布局修复：`assets/canvas-chat-prompt-flow.css` 不再包裹和移动快速模式控件，只固定旧组件自身的网格位置：上传+模型在第一行，`张数 / 清晰度 / 比例` 在第二行，避免按钮重叠。
- 边界：未改后端 Provider、未触发真实生图；本轮触及旧 Canvas bundle，但只改参数控件渲染开关和桥接布局。

## 2026-06-30 Canvas Chat 快速参数按钮对齐修复

- 触发背景：用户再次确认最终要求：快速模式设置按钮必须对齐不重叠，同时把快速模式同一套设置控件放到对话模式。
- 完成内容：`assets/canvas-chat-prompt-flow.css` 将底部设置区改为 3 个完整参数列 + 余量列，第二行 `1张 / 1K / 1:1` 各占完整 96px 列，避免第一列沿用上传按钮 44px 宽度导致溢出重叠。
- 入口版本：`assets/canvas-chat-prompt-flow.js/css` 升级为 `20260630dialogagent7`，HTML 入口和 boundary smoke 同步更新；旧 Canvas 原生控件渲染开关仍沿用 `dialogagent6` 的改动。
- 边界：不再新增桥接控件，不改 Provider，不触发真实生图。

## 2026-06-30 Canvas Chat 对话/快速参数按钮一致性修复

- 触发背景：用户进一步明确要求：对话模式底部 `1张 / 1K / 1:1` 三个按钮要和快速模式按钮保持一致，并且保持间距不叠加。
- 完成内容：`assets/canvas-chat-prompt-flow.css` 将设置区从硬 grid 改为共享 flex wrap 布局：上传按钮和模型控件一行，`张数 / 清晰度 / 比例` 三个原生参数按钮作为同一组，使用相同高度、圆角、宽度规则和 12px gap；窄面板下允许换行，不再互相覆盖。
- 入口版本：`assets/canvas-chat-prompt-flow.js/css` 升级为 `20260630dialogagent8`，HTML 入口和 boundary smoke 同步更新。
- 边界：仅修旧画布覆盖层布局；对话/快速仍复用旧 Canvas Chat 原生控件，不引入新控件、不改后端 Provider。

## 2026-06-30 Packy GPT Image 2 本地技术档案与尺寸换算

- 触发背景：用户要求先继续阅读 Packy GPT Image 2 技术文档，并把生图技术档案放到本地；同时明确 UI 的 `1K / 2K / 4K` 是图片大小档位。
- 完成内容：新增 `docs/provider-packy-gpt-image-2.md`，记录 `gpt-image-2` 文生图 `/v1/images/generations`、图生图 `/v1/images/edits`、`size/quality/output_format/response_format/n/input_fidelity` 等参数和本项目映射。
- 后端同步：`providerImageSize` 改为按 `图片大小档位 + 比例` 自动换算合法 Packy `size`，保证最大边、16 倍数、长短边比例和总像素范围；`1K/2K/4K` 不再直接映射为 Packy `quality`，无单独质量选择时 `quality` 使用 `auto`。
- 边界：不触发真实 Provider 付费测试；旧前端字段名仍兼容 `quality/clarity`，业务语义改按图片大小处理。
- 追加守护：新增 `scripts/check-packy-gpt-image-size.js`，覆盖旧画布比例菜单全部 13 个比例在 `1K/2K/4K` 下的 39 个换算结果，并接入 `scripts/smoke-backend-canvas-boundary.ps1`。

## 2026-06-30 Packy GPT Image 2 全入口适配器覆盖

- 触发背景：用户明确要求 Packy GPT Image 2 生图准则要覆盖所有 GPT Image 2 生图接口，不能只覆盖对话 Agent 或快速模式。
- 完成内容：`callProviderImageGeneration` 和 `callProviderImageEdit` 被确认作为所有 GPT Image 2 请求的唯一后端适配器；文生图统一走 JSON `/images/generations`，图生图 / 图片编辑统一走 multipart `/images/edits`。
- 参数统一：图生图 / 编辑默认增加 `input_fidelity=high`，并继续统一写入 `size`、`quality=auto`、`output_format=png`、`response_format=url`、上游 `n=1`；多张图仍由后端循环请求。
- 覆盖范围：Canvas Chat 对话 Agent、快速生图 `/api/generate/tasks`、模板生图 `/api/template/generate-image`、图片工具局部修改/消除/文字编辑/扩图、后台 API Provider 图片线路测试均纳入同一套适配器。
- 追加守护：新增 `scripts/check-packy-gpt-image-adapter-coverage.js`，静态检查已知 GPT Image 2 入口必须调用统一适配器，并禁止绕过适配器直接请求 Packy 图片端点；该检查已接入 `scripts/smoke-backend-canvas-boundary.ps1`。
- 边界：不改 Provider 配置，不触发真实 GPT Image 2 付费测试；后续新增 GPT Image 2 入口时必须同步补覆盖脚本。

## 2026-06-30 Canvas Chat 对话 Agent GPT 5.5 文本抽取再修复

- 触发背景：用户在对话模式提交“把图1的主图改为1:2详情页”后，前端仍提示 “GPT 5.5 未返回可用的生图提示词”，说明分析阶段成功返回对象后仍未抽取到可用文本。
- 定位结论：前一版抽取已覆盖常见 `choices[].message.content` 和 `output[].content`，但仍遗漏 `data.choices`、`response.output`、`text.value`、`reasoning_content` 以及顶层 `final_prompt/finalPrompt` 等上游包裹形态。
- 完成内容：`normalizeProviderContentText` 增加对 `output/outputs/choices/text/value/answer/reasoning_content/final_prompt/image_prompt/prompt` 等字段的递归识别；`imageToolOutputText` 也把顶层 prompt 字段纳入第一轮抽取。
- 追加守护：新增 `scripts/check-provider-text-extraction.js`，直接从 `server.js` 抽取真实文本解析函数，覆盖 5 种 Provider 响应结构，防止 GPT 5.5 有文本却被判空；该检查已接入 `scripts/smoke-backend-canvas-boundary.ps1`。
- 边界：不改 GPT 5.5 请求模型和 Provider 配置，不触发真实付费调用；若上游确实返回完全空文本，仍按分析失败处理。

## 2026-06-30 Canvas Chat 对话 Agent 分析阶段诊断开关

- 触发背景：用户复测后仍显示 “GPT 5.5 未返回可用的生图提示词”，需要直接跑 API 定位真实上游返回结构，但完整对话 Agent 会继续触发 GPT Image 2 生图。
- 完成内容：`/api/canvas/dialog-agent-generate` 增加管理员诊断参数 `debugAnalysisOnly:true`；该模式只执行 GPT 5.5 分析并返回 `parseOk/finalPrompt/extractedTextLength/responseShape`，不会调用 GPT Image 2，不扣本地余额。
- 安全处理：`responseShape` 只返回字段形状和字符串长度，并对 `key/token/secret/authorization/password` 类字段做 redacted，不返回 API Key。
- 验证方式：`node --check server.js`、`scripts/check-provider-text-extraction.js`、Packy GPT Image 2 尺寸/入口覆盖脚本、`scripts/smoke-backend-canvas-boundary.ps1`、`scripts/smoke-api-disposable.ps1` 均通过；真实 GPT 5.5 诊断调用需用户确认上游消耗后再执行。

## 2026-06-30 Canvas Chat 对话 Agent New API 文本端点修复

- 触发背景：真实 New API 消费日志能看到 GPT 5.5 请求扣费，但前端仍提示 “GPT 5.5 未返回可用的生图提示词”；用户指出当前问题是出提示词，不是 GPT Image 2 生图。
- 定位结论：同一条 New API 文本线路下，`/responses` 对字符串输入返回 `400 openai_error`，对 message array 返回 `200 completed` 但 `output=[]`；而 `/chat/completions` 能正常返回 `choices[0].message.content`。
- 完成内容：`callProviderResponses` 在 New API 文本线路下改走 `/chat/completions`，并把 Responses 风格输入自动转换为 Chat Completions `messages`；`input_text` 转为 `text`，`input_image` 转为 `image_url`。
- 解析修复：`parseJsonObjectFromText` 改为扫描首个完整 JSON 对象，兼容 GPT 5.5 偶发重复输出两个 JSON 的情况；前端桥接版本升级为 `20260630dialogagent9`。
- 验证结果：用真实 GPT 5.5 analysis-only 诊断测试同一张参考图和“把图1改为详情页长图”，返回 `textEndpoint=chat/completions`、`parseOk=true`、`extractedTextLength=1615`，并得到干净 `analysisSummary/finalPrompt`；未触发 GPT Image 2 生图。

## 2026-06-30 旧画布维护边界与维护日志

- 分支：`codex/source-stack-canvas-rebuild`
- 完成内容：新增旧画布维护边界和维护日志，整理当前唯一画布基线、三种 Canvas Chat 模式链路、GPT Image 2 统一适配器、Packy 参数规则、允许/谨慎/禁止改动范围、每次改动后的检查命令和当前临时技术债。
- 修改文件：`docs/canvas-maintenance-boundary.md`、`docs/canvas-maintenance-log.md`、`docs/canvas-migration-checklist.md`、`docs/feature-completion-checklist.md`、`docs/progress-report.md`、`docs/review-log.md`
- 验证方式：文档链接和关键资产版本扫描；`git diff --check`；触达文档 UTF-8 BOM 检查。
- 验证结果：链接和版本扫描通过；`git diff --check` 仅提示既有 Windows 换行转换 warning，无空白错误；触达文档 UTF-8 BOM 均为 false。
- 当前完成度：旧画布后续维护边界 90%，仍需按真实业务复测结果继续补充经验项。
- 新发现问题：当前仍保留 `debugAnalysisOnly` 和普通错误 `responseShape` 作为诊断能力，应在业务稳定后收窄。
- 未完成清单：真实 GPT 5.5 + GPT Image 2 对话 Agent 全链路复测；多参考图 `image[]` 字段真实兼容性确认；诊断入口收窄。
- 下一轮建议：先让用户刷新测试 `dialogagent9`，确认提示词和生图链路后，再清理诊断残留。
- 需要人工介入：真实 Provider 复测会产生上游请求和可能扣费，需要用户确认测试范围。

## 2026-06-30 旧画布入口缓存版本守卫修复

- 分支：`codex/canvas-test-fix`
- 触发背景：新分支继续测试时，`node scripts/verify-canvas-performance-assets.js` 失败，守卫仍期待 `index-DglIsp_g.js?v=20260630dialogagent1`；同时两个旧入口 bundle 的 Canvas 动态 import 仍带 `dialogagent1` 查询串，可能让浏览器继续命中旧画布 chunk 缓存。
- 完成内容：`assets/index-DglIsp_g.js`、`assets/index-ZrBcanD1.js` 的旧画布动态 import 查询串同步到 `20260630dialogagent6`；`scripts/verify-canvas-performance-assets.js` 同步断言 HTML 主入口 `dialogagent9` 和画布 chunk `dialogagent6`；`scripts/smoke-canvas-performance-ui-runner.js` 同步主入口版本断言。
- 边界：只修旧打包资产的缓存版本和测试守卫，不改旧 Canvas bundle 行为，不改 Provider，不触发真实 GPT 5.5 或 GPT Image 2 调用。
- 验证方式：`node scripts/verify-canvas-performance-assets.js`、`node scripts/verify-canvas-restore-guard.js`、`node --check server.js`、`scripts/smoke-backend-canvas-boundary.ps1`、`scripts/smoke-api-disposable.ps1`、`npm run verify:source --prefix frontend`。
- 验证结果：上述检查均通过；`@playwright/cli` 未在项目依赖中安装，未运行会触发 `npx --package @playwright/cli` 的 UI smoke，避免未经确认下载新增 npm 包。

## 2026-06-30 Canvas Chat 三模式会话隔离修复

- 分支：`codex/canvas-test-fix`
- 触发背景：用户截图确认 `对话 / 快速 / 视频` 三个模式串用了同一套 Canvas Chat 消息、参考图和生成状态；用户明确三种模式应是独立会话。
- 完成内容：`assets/Canvas-B8bY9_QL.js`、`assets/Canvas-yGc8b2gf.js` 增加按模式分桶的会话状态，分别保存 `input / selected images / messages / sessionId`；模式切换时保存旧模式并加载新模式；异步任务结果通过消息 id 回写原始模式，避免生成中切标签写错会话。
- 草稿修复：Canvas Chat 自己的未发送草稿不再在刷新恢复时自动变成一条用户消息；只有首页、图片节点或图片工具带来的初始 payload 才会自动生成用户消息。
- 缓存版本：主入口升级为 `assets/index-DglIsp_g.js?v=20260630dialogagent12`；旧 Canvas chunk 动态 import 升级为 `Canvas-*.js?v=20260630dialogagent9`。
- 追加守护：`scripts/verify-canvas-performance-assets.js` 增加 `chatModeSessionStore`、`appendChatModeMessage`、输入实时保存和 `canvas-chat` 草稿恢复断言。
- 验证方式：两个 Canvas bundle `node --check`；`node scripts/verify-canvas-performance-assets.js`；`scripts/smoke-backend-canvas-boundary.ps1`；内置浏览器刷新后实测三模式分别填写不同输入，切回时各自保留，清空后三个模式输入均为空且消息不串。
- 边界：未改 Provider、未触发真实 GPT 5.5 或 GPT Image 2 付费调用；仍未运行需要 `npx --package @playwright/cli` 的 UI smoke。

## 2026-06-30 Canvas Chat 三模式隔离护栏固化

- 触发背景：用户要求把“三个画布模式都是单独会话”固定写入日志，作为后续维护护栏，防止下次改回共享状态。
- 完成内容：`docs/canvas-maintenance-boundary.md` 新增 Canvas Chat 三模式硬护栏；`docs/canvas-maintenance-log.md` 更新当前资产版本，并新增不可回退护栏和禁止回退项。
- 护栏内容：禁止 `对话 / 快速 / 视频` 共享 `messages/input/images/sessionId`；禁止快速模式复用对话 Agent 链路；禁止视频模式复用 GPT Image 2 图片入口；禁止 `source:"canvas-chat"` 草稿刷新后自动变用户消息。
- 验证方式：文档改动后运行 `git diff --check` 和触达文档 BOM 检查。
- 边界：本轮仅固化文档护栏，不改运行时代码，不触发真实 Provider。

## 2026-06-30 Canvas Chat 对话卡片 UI 复用快速模式

- 分支：`codex/canvas-test-fix`
- 触发背景：用户要求 `对话` 模式改成截图中快速模式一致的清爽卡片 UI，并明确指出快速模式已有对应 CSS，不要重复造轮子。
- 完成内容：`assets/canvas-chat-prompt-flow.js/css` 升级为 `20260630dialogcard1`；对话桥接插入的用户卡片和生成结果卡片补齐旧 `CanvasChatPanel` scoped 样式标记，并复用快速模式的 `message-card / message-meta / message-text / image-grid / cost-line` 结构。
- 样式收敛：`assets/canvas-chat-prompt-flow.css` 删除对卡片壳、图片网格和结果图按钮的二次覆盖，只保留对话 Agent 特有的分析提示、状态文本和加载态操作按钮；用户卡片不再重复显示 `1张 · 1K · 1:1`，参数仍由底部原生控件读取并提交。
- 追加守护：`scripts/verify-canvas-performance-assets.js` 增加 `dialogcard1` 入口版本、scoped 样式标记、快速模式结构类名和禁止回退自绘图片网格的断言；`scripts/smoke-backend-canvas-boundary.ps1` 同步新查询串。
- 验证方式：`node --check assets/canvas-chat-prompt-flow.js`；两个旧 Canvas bundle `node --check`；`node scripts/verify-canvas-performance-assets.js`；`scripts/smoke-backend-canvas-boundary.ps1`；`git diff --check`；触达文本文件 BOM 检查；内置浏览器刷新后检查 `dialogcard1` 资源和对话提示条。
- 验证结果：上述语法检查、资产守卫和旧画布边界 smoke 均通过；`git diff --check` 仅有 LF/CRLF warning；触达文本文件 `HasBom=false`；浏览器已加载 `canvas-chat-prompt-flow.js/css?v=20260630dialogcard1`，切到 `对话` 后提示条正常出现。
- 边界：只改旧画布对话桥接 UI，不改三模式隔离、不改快速/视频链路、不触发真实 GPT 5.5 或 GPT Image 2 调用。

## 2026-06-30 Canvas Chat 对话桥接 DOM 隔离补丁

- 分支：`codex/canvas-test-fix`
- 触发背景：用户复测指出 `快速` 模式仍出现 `对话` 桥接生成卡片，说明上一版护栏只覆盖了 Vue 会话桶和样式复用，没有覆盖桥接层直接插入 DOM 的模式隔离。
- 完成内容：`assets/canvas-chat-prompt-flow.js/css` 升级为 `20260630dialogcard4`；对话桥接卡片统一加 `hjm-prompt-flow-card` 和 `data-hjm-prompt-flow-mode="chat"`；旧泄漏 DOM `.hjm-prompt-flow-user/.hjm-prompt-flow-agent` 也默认按 `chat` 模式处理；新增 `syncPromptFlowCardVisibility`，只有对话标签激活时才显示桥接卡片。
- CSS 兜底：新增 `.canvas-chat-panel:not(.hjm-prompt-flow-dialog-active) .hjm-prompt-flow-card / .hjm-prompt-flow-user / .hjm-prompt-flow-agent { display: none !important; }`，避免快速/视频模式显示桥接 DOM。
- 追加守护：`scripts/verify-canvas-performance-assets.js` 增加 `dialogcard4`、桥接模式标记、可见性同步函数、非对话隐藏 CSS 的断言；`scripts/smoke-backend-canvas-boundary.ps1` 同步新查询串。
- 边界：不改快速模式真实生图链路，不改视频模式，不触发真实 Provider。

## 2026-06-30 Canvas Chat 对话生成中进度条与空状态修复

- 分支：`codex/canvas-test-fix`
- 触发背景：用户指出 `灵感不间断` 空状态应在生成任务开始后消失，并要求生成过程增加进度条 UI。
- 完成内容：`assets/canvas-chat-prompt-flow.js/css` 升级为 `20260630dialogcard4`；`syncPromptFlowCardVisibility` 在对话模式存在可见桥接卡片时隐藏 `.message-list > .empty-state`；生成结果卡新增 `hjm-prompt-flow-progress` 进度条。
- 进度规则：提交后显示约 `18%` 分析进度，进入生图阶段显示约 `68%`，成功或失败时推进到 `100%` 并隐藏进度条；该 UI 不改变后端请求、不新增轮询、不触发额外 Provider。
- 追加守护：`scripts/verify-canvas-performance-assets.js` 增加空状态隐藏、进度条 DOM、宽度更新和 CSS 动画断言；`scripts/smoke-backend-canvas-boundary.ps1` 同步新查询串。
- 验证方式：`node --check assets/canvas-chat-prompt-flow.js`；两个旧 Canvas bundle `node --check`；`node scripts/verify-canvas-performance-assets.js`；`scripts/smoke-backend-canvas-boundary.ps1`；浏览器刷新确认 `dialogcard4` 资源和三模式桥接卡片可见数；`git diff --check`；触达文本文件 BOM 检查。
- 验证结果：语法检查、资产守卫和旧画布边界 smoke 均通过；浏览器加载 `/assets/canvas-chat-prompt-flow.js/css?v=20260630dialogcard4`，稳定重测快速模式 `bridgeTotal=0/bridgeVisible=0`，视频与对话无旧泄漏卡片；未点击发送，未触发真实 Provider。
- 边界：只改对话桥接 UI，不改快速/视频会话，不触发真实模型调用。

## 2026-07-01 视频 Tab 电商套图 Agent 对话式接入

- 触发背景：前一轮把套图 Agent 做成了偏独立表单的 UI，并一度影响旧画布刷新和 `对话 / 快速` 切换；用户要求总结教训、做好护栏边界后，只针对视频 tab 重新实现。
- 完成内容：`assets/canvas-chat-prompt-flow.js/css` 升级为 `20260701suite5`，保留旧 Canvas Chat 结构，只在 `视频 / 电商套图Agent` 模式插入产品图、参考图和 skill 选择；隐藏原生视频模型控件，固定文本模型 `gpt-5.5` 和图片模型 `gpt-image-2`；上传区显示 `产品图 + 参考图组`，参考图逐张增加独立槽位且最多 4 张；skill 下拉与下方文本输入框同宽对齐；已上传图片整图铺满圆角槽位且不显示槽位文字；发送后生成 `套图模板` 消息卡，支持勾选/编辑板块提示词，再按选中板块调用套图生图。
- 后端补强：`/api/canvas/ecommerce-suite/prompts` 和 `/api/canvas/ecommerce-suite/generate` 增加产品图必填校验；真实 Provider 路径仍复用既有 `callProviderResponses`、`callProviderImageEdit`、`callProviderImageGeneration` 和扣费/任务记录逻辑。
- 护栏补强：`scripts/verify-canvas-performance-assets.js` 固定主入口和 Canvas chunk 版本，禁止加载独立 `canvas-ecommerce-suite-agent.*`，并断言 `shouldHandle` 只属于对话、`isSuiteMode` 只属于视频；`scripts/smoke-backend-canvas-boundary.ps1` 增加套图 config、缺产品图、mock prompts、mock generate 覆盖。
- 修改文件：`assets/canvas-chat-prompt-flow.js`、`assets/canvas-chat-prompt-flow.css`、`index.html`、`server.js`、`scripts/verify-canvas-performance-assets.js`、`scripts/smoke-backend-canvas-boundary.ps1`、`docs/canvas-maintenance-boundary.md`、`docs/canvas-maintenance-log.md`、`docs/progress-report.md`、`docs/review-log.md`。
- 验证方式：`node --check` 前端桥接和后端；资产护栏；旧画布后端边界 smoke；后续还需用户在浏览器内人工验证视频 tab 的真实交互。
- 边界：未改 `assets/index-DglIsp_g.js`、`assets/Canvas-B8bY9_QL.js`、`assets/Canvas-yGc8b2gf.js`；未运行真实 GPT 5.5 或 GPT Image 2 付费调用。

## 2026-07-01 电商套图 Agent 动态板块修正

- 触发背景：用户在后台设置页指出“板块集合”不应是默认模板集合，而应由所选 skill 和用户产品需求共同生成。
- 完成内容：`assets/canvas-chat-prompt-flow.js/css` 升级为 `20260701suite8`；旧画布视频 tab 生成模板时不再发送默认 `sectionKeys`；`GET /api/canvas/ecommerce-suite/config` 返回 `sectionMode:"dynamic"` 和空 `sections`；`POST /api/canvas/ecommerce-suite/prompts` 改为让 GPT 根据 skill Markdown、产品图、参考图和用户输入动态规划 3-5 个板块提示词。
- 后台调整：`frontend/src/views/AdminSettingsSource.vue` 移除固定“套图板块”编辑列表，改为说明“板块集合由 Agent 动态生成”；后台仍维护默认参数和设计师 skills，保存时不再写回五个默认板块。
- 护栏调整：`scripts/verify-canvas-performance-assets.js` 增加 `sectionMode` 与“不得发送默认 sectionKeys”的断言；`scripts/smoke-backend-canvas-boundary.ps1` 的套图 smoke 不再传 `hero`，并校验动态模式。
- 验证结果：`node --check "F:\dianshang\server.js"`、`node --check "F:\dianshang\assets\canvas-chat-prompt-flow.js"`、`npm run build --prefix "F:\dianshang\frontend"`、资产护栏和旧画布后端边界 smoke 均通过；本地 3456 服务已重启，config 实测 `sectionMode=dynamic`、`sectionsCount=0`。
- 边界：未触发真实 GPT 5.5 或 GPT Image 2 付费调用；未改旧画布主入口 bundle 和 Canvas chunk。

## 2026-07-01 电商套图 Agent Skill Markdown 测试稿

- 触发背景：用户要求先给出后台 skill Markdown 生成规范，并基于当前 Gloria / Paload / Lumi / Kira / RayYu 角色生成一版可上传测试内容，后续再自行上传调试。
- 完成内容：新增 `docs/ecommerce-suite-skills/00-skill-markdown-spec.md`，定义后台字段、推荐结构、动态板块规则、产品图/参考图优先级、合规边界和好 skill 标准。
- 角色稿：新增 `gloria.md`、`paload.md`、`lumi.md`、`kira.md`、`rayyu.md`，分别覆盖高转化品牌视觉、复杂参考图拆解、柔和生活方式、平台转化图、创意品牌叙事五种风格。
- 边界：本轮只产出可上传 Markdown 文档，不改运行时代码、不触发真实模型调用。
- 验证结果：`git diff --check -- docs/ecommerce-suite-skills` 通过；新增 Markdown 文件均为 UTF-8 无 BOM；未检出 `<script`、`javascript:`、`iframe/object/embed` 等危险片段。

## 2026-07-01 电商套图模板选择卡

- 触发背景：用户指出生成提示词后不需要展示标题、prompt 和负面词编辑区，只需要类似旧模板的板块选择卡并直接出图，且颜色应符合当前浅色画布 UI。
- 完成内容：`assets/canvas-chat-prompt-flow.js/css` 升级为 `20260701suite15`；结果改为浅色两列选择卡，只展示动态板块名称，不再渲染 `套图模板` 标题；生图阶段按选中板块拆成独立并发请求，每次只提交一个 `promptPlan`，选中 4 个板块即直接发出 4 个单板块任务；成功图自动添加到画布，失败板块显示单独 `重新生成` 按钮；上游 `request id` 改为小字展示，卡片主错误文案压缩为“上游图生图请求失败”等可读短句；成功状态显示完整四按钮图片卡。
- 追加调整：`assets/canvas-chat-prompt-flow.js/css` 升级为 `20260701suite16`；成功图四按钮从图片下方白色区域改为图片内部白色半透明浮层，hover/focus/触摸图片卡时显示，减少结果模块高度。
- 追加调整：`assets/canvas-chat-prompt-flow.js/css` 升级为 `20260701suite17`；新增 Gloria / Paload / Lumi / Kira / RayYu 五个本地 SVG 头像，skill 选择从原生下拉改为浅色设计师头像列表，点击当前设计师展开列表，选中项用浅橙色高亮。
- 护栏调整：`scripts/verify-canvas-performance-assets.js` 增加选择卡 DOM 锚点、禁止 `data-suite-plan-prompt/negative` 和 `hjm-suite-plan-heading` 回退、禁止黑底计划卡样式回退。
- 边界：只改视频 tab 内电商套图 Agent 的结果卡与资产版本，不改 `对话 / 快速` 捕获逻辑，不触发真实 Provider。

## 2026-07-01 图片节点卡片精简

- 触发背景：用户指出画布 `图片节点` 卡片不够干净，顶部 `图片节点` 名称和 `正常` 状态也可以去掉。
- 完成内容：`assets/canvas-image-node-polish.css` 清理图片节点视觉，隐藏图片节点顶部 header，不再显示节点名称和顶部状态徽标；同时隐藏底部重复 `正常` 状态栏；上传区高度由 270px 收到 230px，背景和阴影改轻。
- 缓存与护栏：`index.html` 和旧画布边界 smoke 将 `canvas-image-node-polish` 查询串升级到 `20260701image10`；`scripts/verify-canvas-performance-assets.js` 增加图片节点 polish 资产读取、图片节点 header 隐藏和空态底部状态栏隐藏锚点。
- 验证结果：`node --check` 后端、套图桥接和图片节点 polish 脚本通过；资产护栏、旧画布边界 smoke、`npm run build --prefix "F:\dianshang\frontend"`、`git diff --check` 和触达文件 BOM 检查均通过。浏览器已加载 `canvas-image-node-polish.js/css?v=20260701image10` 和 `canvas-node-radius-fix.css?v=20260701title1`；当前项目刷新后没有图片节点 DOM，未做真实节点视觉截图复核。
- 边界：只改图片节点 polish 过渡层，不改旧 Canvas 主 bundle，不影响 `对话 / 快速 / 视频` 发送链路，不触发真实 Provider。

## 2026-07-01 节点标题重命名入口关闭

- 触发背景：用户指出节点卡片顶部标题区不应再像可重命名输入框，也不要被选中文字。
- 完成内容：`assets/canvas-image-node-polish.js` 增加标题锁定扫描，把旧节点标题上的 `双击编辑名称` 移除并标记为 `data-hjm-node-title-lock="true"`；捕获并拦截标题区双击，避免进入旧重命名逻辑。
- 样式调整：`assets/canvas-node-radius-fix.css` 增加通用节点标题锁定样式，移除 text cursor、hover 灰底和文字选择；资源查询串升级为 `canvas-image-node-polish?v=20260701image10` 与 `canvas-node-radius-fix.css?v=20260701title1`。
- 护栏调整：`scripts/verify-canvas-performance-assets.js` 增加标题锁脚本、标题不可选 CSS 和新查询串断言；旧画布边界 smoke 同步新资源。
- 边界：不改旧 Canvas 主 bundle，不移除节点本身的选中/拖拽能力，只关闭标题重命名和文本选中。

## 2026-07-01 Canvas Chat 三模式空状态文案隐藏

- 触发背景：用户指出三个 tab 中间的 `👋 / 灵感不间断 / 对话模式会保留你的上下文与参考图` 文案都不要显示。
- 完成内容：`assets/canvas-chat-prompt-flow.css` 增加 `.canvas-chat-panel .message-list > .empty-state { display:none !important; }`，让 `对话 / 快速 / 视频` 三个 tab 的空状态说明统一隐藏。
- 缓存与护栏：`canvas-chat-prompt-flow` 资源查询串升级到 `20260701suite18`；`scripts/verify-canvas-performance-assets.js` 增加空状态隐藏选择器断言，旧画布边界 smoke 同步新版本。
- 验证结果：`node --check` 后端、套图桥接和图片节点 polish 脚本通过；资产护栏、旧画布边界 smoke、`npm run build --prefix "F:\dianshang\frontend"`、`git diff --check` 和触达文件 BOM 检查均通过。浏览器已加载 `canvas-chat-prompt-flow.js/css?v=20260701suite18`，`.message-list > .empty-state` computed display 为 `none`。
- 边界：只隐藏旧 Canvas Chat 空状态文案，不改消息流、不改 composer、不触发真实 Provider。

## 2026-07-01 Canvas Chat 输入框默认文案统一

- 触发背景：用户指出底部对话框默认文案仍是 `输入您想要的修改效果（可选择生成图片）`，需要统一改为 `请输出你的提示词`。
- 完成内容：`assets/canvas-chat-prompt-flow.js` 增加 `CANVAS_CHAT_PLACEHOLDER` 和 `syncComposerPlaceholder()`，在现有 `syncPromptFlowCardVisibility` 周期内同步旧 composer 的 `placeholder/data-placeholder`，覆盖 `对话 / 快速 / 视频` 三个 tab。
- 缓存与护栏：`canvas-chat-prompt-flow` 资源查询串升级到 `20260701suite19`；`scripts/verify-canvas-performance-assets.js` 增加 placeholder 常量、同步函数和赋值锚点断言，旧画布边界 smoke 同步新版本。
- 边界：只改旧画布过渡层，不改旧 Canvas 主 bundle，不改变发送链路、模型链路和电商套图工作链，不触发真实 Provider。

## 2026-07-01 第三个 Tab 文案改为 agent电商套图

- 触发背景：用户要求把旧画布第三个 tab 的展示文案从 `视频` 改为 `agent电商套图`。
- 完成内容：`assets/canvas-chat-prompt-flow.js` 增加 `SUITE_TAB_LABEL`、`SUITE_MODE_ALIASES` 和 `syncSuiteTabLabel()`，在现有同步周期里把第三个 tab 文案显示为 `agent电商套图`；`isSuiteMode()` 改为别名判断，继续兼容旧 `视频` 和旧 `电商套图Agent` 文案。
- 缓存与护栏：`canvas-chat-prompt-flow` 资源查询串升级到 `20260701suite20`；`scripts/verify-canvas-performance-assets.js` 增加新 tab 文案、别名集合、同步函数和禁止旧硬编码判断回退的断言。
- 边界：只改第三个 tab 展示文案和套图模式识别别名，不改 `对话 / 快速`，不改电商套图 prompts/generate 工作链，不触发真实 Provider。

## 2026-07-02 首页历史画布删除按钮修复

- 触发背景：用户反馈首页“我的历史画布项目”卡片右上角删除画布按钮点击无反应。
- 完成内容：`assets/home-overrides.css` 增加历史项目删除按钮层级、默认可见度与指针事件覆盖，确保 `.history-delete` 始终高于卡片 hover 覆盖层，并让 `.history-hover` 不接收指针事件；`assets/home-carousel-inertia.js` 遇到按钮、链接和输入控件时不启动历史横向拖拽，也不在捕获阶段吞掉删除按钮 click；`index.html` 将首页覆盖 CSS 和轮播脚本查询串升级到 `20260702delete1`。
- 验证结果：浏览器刷新首页后确认加载 `/assets/home-carousel-inertia.js?v=20260702delete1` 和 `/assets/home-overrides.css?v=20260702delete1`；删除按钮 computed `opacity=0.78`、`z-index=5`、`pointer-events=auto`；通过 UI 新建临时画布后直接点击删除，卡片数量从 4 回到 3；再新建临时画布，先拖动历史列表再点击删除，卡片数量仍从 4 回到 3，页面停留在首页并显示“项目已删除”。
- 边界：只修首页旧资产交互层，不改项目数据结构、不改旧 Canvas 主 bundle、不触发真实 Provider。

## 2026-07-02 首页模型下拉同步后端

- 触发背景：用户确认首页模型下拉需要跟后台/后端模型同步，不再展示前端固定模型清单。
- 完成内容：`server.js` 增加后端模型归一化层，`/api/model-routes`、`/api/public/models`、`/api/user/models` 和 `/api/user/api-status` 均统一读取 `admin.modelPrices` 覆盖后的模型；`/api/generation/estimate-cost` 改为按同一模型价格估费；后台模型价格列表避免递归读取自身覆盖结果。
- 首页调整：`assets/HomeIndex-DAjDt0aj.js` 不再合并 `fixedImageModels` 清单，不再优先选择固定默认模型 `nano-banana-2`；`assets/index-DglIsp_g.js` 和 `index.html` 增加 `20260702modelsync1` 查询串刷新首页 chunk。
- 验证结果：本地服务重启后，`GET /api/model-routes?group=image` 返回当前后端 1 个图像模型 `GPT Image 2:10`；`GET /api/public/models?routeId=pub_route_openai_gpt_image_2` 返回同一模型；`POST /api/generation/estimate-cost` 以 2 张图估费为 20 点；浏览器首页模型按钮显示 `GPT Image 2`，页面不再出现 `Nano Banana`、`Gemini`、`Comfly` 固定模型文本。
- 边界：本轮不新增后台模型数据、不触发真实 Provider 或付费调用；当前 `admin.modelPrices` 为空，所以首页会先只显示后端默认模型，后续后台新增/启停/改价后再同步到首页。

## 2026-07-02 首页顶部播放样式按钮移除

- 触发背景：用户指出首页顶部栏中位于“历史记录”和“AI”之间的圆形播放按钮需要删除。
- 完成内容：`assets/HomeLayout-BeS5XdE3.js` 移除 `header-icon-button visual-mode` 按钮渲染；`assets/index-DglIsp_g.js` 将 HomeLayout 动态 chunk 加 `20260702removeplay1` 查询串；`index.html` 主入口查询串同步升级。
- 验证结果：浏览器刷新首页后，顶部按钮只剩 `导出`、`保存`、`历史记录` 和用户/AI入口；DOM 中不存在 `.header-icon-button.visual-mode`，也不存在 `样式 1：视频播放` 按钮标题。
- 边界：只删除顶部样式切换入口，不改背景视频资源、不改首页业务按钮、不触发真实 Provider。

## 2026-07-02 画布图片节点工具入口回滚

- 触发背景：用户决定暂不在画布内继续做文字编辑能力，并要求图片节点底部工具栏删除 `文字编辑`、`一键抠图`、`AI 超清放大`。
- 完成内容：回滚上一轮新增的文字编辑后端接口和样式；`assets/Canvas-B8bY9_QL.js` 与 `assets/Canvas-yGc8b2gf.js` 的图片节点工具栏移除 `textEdit/removeBg/upscale` 三个入口；`/api/image-tools/settings` 不再返回 `textEdit/upscale/removeBg` 能力声明；Canvas 动态 chunk 查询串升级到 `20260702remove-tools`。
- 验证结果：`node --check` 覆盖 `server.js`、两个 Canvas bundle 和两个 index bundle；`scripts/smoke-api-disposable.ps1` 通过；浏览器在 3456 图片节点实测工具栏只剩 `AI 扩图 / 格式压缩 / 反推提示词 / AI 智能消除 / 局部修改 / 尺寸 / 裁剪 / 添加到聊天 / 生成视频`，且 `局部修改` 面板仍可打开。
- 边界：只删除这三个图片节点入口，不改右侧新增节点面板，不改画布 JSON 结构，不触发真实 Provider。

## 2026-07-02 图片节点工具排版修复

- 触发背景：用户截图指出图片节点顶部工具条左侧被裁切，`格式/压缩` 弹层离图片过远，排版需要收紧。
- 完成内容：`assets/canvas-image-node-polish.css` 增加图片节点工具排版覆盖：顶部工具条从居中展开改为贴图片左上方并允许换行，避免靠左图片被视口裁掉；同时压掉旧竖向工具栏遗留高度，避免工具条背景被拉成大面板；`格式/压缩` 弹层改为紧贴图片右侧，窄屏时落到图片下方；弹层内容区增加最大高度滚动保护。`index.html` 将该 CSS 查询串升级到 `20260702layout2`。
- 护栏调整：同步更新 `scripts/smoke-backend-canvas-boundary.ps1` 与 `scripts/verify-canvas-performance-assets.js` 的当前资源版本，并补充工具条位置和压缩弹层位置锚点。
- 验证结果：`node scripts/verify-canvas-performance-assets.js` 通过；`scripts/smoke-backend-canvas-boundary.ps1` 通过，确认 `/assets/canvas-image-node-polish.css?v=20260702layout2` 返回 200；触达文件 `git diff --check` 通过且无 BOM。当前浏览器刷新后目标项目没有图片节点 DOM，未能继续做真实图片节点几何读数。
- 边界：只改旧画布图片节点 polish 样式层和静态断言，不改 Canvas 主 bundle、不改图片工具功能、不触发真实 Provider。

## 2026-07-02 图片节点工具条单行与生成视频移除

- 触发背景：用户要求图片节点工具条做成一行，并取消 `生成视频`。
- 完成内容：`assets/Canvas-B8bY9_QL.js` 与 `assets/Canvas-yGc8b2gf.js` 仅移除图片节点工具条数组里的 `video/生成视频` 项；保留其它视频节点和右侧新增节点能力不变。`assets/canvas-image-node-polish.css` 将图片工具条改为 `flex-wrap: nowrap`，高度收回单行。`index.html`、`assets/index-DglIsp_g.js`、`assets/index-ZrBcanD1.js` 查询串统一升级到 `20260702toolbar1`。
- 护栏调整：`scripts/verify-canvas-performance-assets.js` 增加单行工具条样式和禁止图片工具条 `生成视频` 回退断言；旧后端边界 smoke 同步 `toolbar1` 资源版本。
- 验证结果：两个 Canvas bundle 与入口 bundle `node --check` 通过；资产护栏通过；旧后端边界 smoke 通过并确认 `index-DglIsp_g.js`、两个 Canvas bundle 和 `canvas-image-node-polish.css` 的 `toolbar1` 资源均可返回 200；浏览器刷新当前画布后已加载 `toolbar1` 主入口和 CSS，页面正文不再包含 `生成视频`。当前项目刷新后没有图片节点 DOM，未能继续量真实工具条宽高。
- 边界：只改图片节点顶部工具条，不改右侧新增节点、不改视频节点内部生成按钮、不触发真实 Provider。

## 2026-07-02 图片节点工具条居中修正

- 触发背景：用户截图指出单行工具条偏左、未以图片居中，`格式/压缩` 面板贴近顶边。
- 完成内容：`assets/canvas-image-node-polish.css` 将图片工具条锚点改回 `left:50%` + `translateX(-50%)`，继续保持单行；按钮最大宽度和文字宽度略收紧，确保 8 个工具在一行内居中。`格式/压缩` 面板顶部偏移从 `20px` 调整为 `76px`，避免贴顶。CSS 查询串升级到 `20260702center1`。
- 护栏调整：`scripts/verify-canvas-performance-assets.js` 增加居中 transform 锚点，旧后端边界 smoke 同步 `center1` CSS 资源版本。
- 验证结果：资产护栏通过；旧后端边界 smoke 通过并确认 `/assets/canvas-image-node-polish.css?v=20260702center1` 返回 200；浏览器刷新后确认加载 `center1` CSS。当前项目刷新后没有图片节点 DOM，未能继续读取真实工具条中心点。
- 边界：只改旧画布图片工具条和格式压缩面板的样式定位，不改功能、不恢复 `生成视频`。

## 2026-07-02 图片节点工具条文字完整显示

- 触发背景：用户截图指出单行工具条中文案被省略号截断，例如 `AI 智能...`、`图片尺寸...`。
- 完成内容：`assets/canvas-image-node-polish.css` 放开图片工具条按钮和 `.tool-text` 最大宽度，取消 `text-overflow: ellipsis`，改为 `text-overflow: clip` 与可见溢出；工具条仍保持单行居中。CSS 查询串升级到 `20260702fulltext1`。
- 护栏调整：`scripts/verify-canvas-performance-assets.js` 增加 `text-overflow: clip` 锚点；旧后端边界 smoke 同步 `fulltext1` CSS 资源版本。
- 验证结果：资产护栏通过；旧后端边界 smoke 通过并确认 `/assets/canvas-image-node-polish.css?v=20260702fulltext1` 返回 200；浏览器刷新后确认加载 `fulltext1` CSS。当前项目刷新后没有图片节点 DOM，未能直接读取按钮文字裁切状态。
- 边界：只改图片节点顶部工具条文字显示，不改工具项、不恢复 `生成视频`、不触发真实 Provider。

## 2026-07-03 生产状态可靠性验收

- 触发背景：用户要求按真实生产环境测试所有功能可靠性，并确保网站以生产状态运行。
- 服务状态：已停止非主目录旧服务，并从 `F:\dianshang` 启动 `node server.js`；当前 `GET /api/health` 返回 `mode=real-provider-ready`，数据库、上传和日志目录分别为 `F:\dianshang\data.db`、`F:\dianshang\uploads`、`F:\dianshang\logs`。
- 修复内容：后台源码页标题字重补齐到生产视觉验收要求；后台页面 smoke wrapper 增加 Playwright CLI 错误捕获；画布性能 smoke 同步当前资源版本，并兼容图片节点加载后隐藏标题栏的现有设计。
- 验证结果：前端构建、后端语法检查、API disposable smoke、前端路由 smoke、真实 Provider 护栏、旧画布后端边界 smoke、首页/画布 UI smoke、移动端 UI smoke、画布性能 UI smoke、画布帧预算 smoke、后台 dashboard DOM 探针和 `git diff --check` 均通过。
- 边界：未触发真实 AI 生图/文本付费调用；邮件、支付、对象存储仍为 `enabled=false`；完整后台截图 smoke 在 Playwright CLI run-code 层存在挂住风险，暂不作为稳定 CI 门禁。

## 2026-07-03 画布清晰度三档统一

- 触发背景：用户在旧画布图片生成节点发现清晰度下拉只有 `1K`，需要统一为可测试的生产配置。
- 完成内容：`server.js` 将图片模型清晰度统一为 `1k / 2k / 4k`，新增模型清晰度归一化和 variants 展开逻辑；后台新增模型接口默认清晰度也同步为三档。
- 护栏调整：`scripts/smoke-api.ps1` 增加 `/api/model-routes?group=image` 与 `/api/public/models` 的清晰度/variants 三档断言，防止画布再次只拿到 `1k`。
- 验证结果：`node --check "F:\dianshang\server.js"` 通过；`scripts\smoke-api-disposable.ps1` 通过；当前 3456 服务重启后接口返回 `qualities=[1k,2k,4k]`、`variantClarities=[1k,2k,4k]`。
- 边界：只改模型能力配置和接口归一化，不改价格倍率、不改生成尺寸算法、不触发真实 Provider 生图。

## 2026-07-03 Docker 独立运行目录

- 触发背景：用户准备内网部署，希望在项目目录下单独建立 Docker 运行目录。
- 完成内容：新增 `docker/docker-compose.yml`、`docker/.env.example`、`docker/.gitignore` 和 `docker/README.md`；运行数据固定挂载到 `docker/data`、`docker/uploads`、`docker/logs`，备份目录为 `docker/backup`。
- 本地准备：已创建 `docker/data`、`docker/uploads`、`docker/logs`、`docker/backup`，并从 `.env.example` 生成本地 `docker/.env`；`.env` 和运行数据目录均被忽略，不进入 Git。
- 验证结果：`docker compose -f "F:\dianshang\docker\docker-compose.yml" --env-file "F:\dianshang\docker\.env.example" config` 通过；Docker 目录 `git diff --check` 通过；新增文本文件均无 BOM。
- 边界：本轮只准备 Docker 运行目录，没有启动容器，也没有停止当前开发目录的 3456 Node 服务。

## 2026-07-03 图片工具智能消除移除与面板窗口化

- 触发背景：用户要求旧画布图片节点去掉 `AI 智能消除`，并让图2这类图片工具面板支持拖拽、缩放，同时修复局部修改笔刷在画布缩放下的偏移。
- 完成内容：`assets/Canvas-B8bY9_QL.js` 与 `assets/Canvas-yGc8b2gf.js` 移除图片工具条 `smartErase` 项，保留 `/api/image-tools/erase` 后端兼容；`局部修改` 改为 `ready` 可打开入口；`InpaintPanel` 指针坐标按 `canvas.width / getBoundingClientRect().width` 和 `canvas.height / rect.height` 换算，避免缩放后落点偏移。
- 面板调整：`assets/canvas-image-node-polish.js/css` 为 `.image-edit-overlay` 增加标题栏拖拽和右下角缩放手柄，内容区缩小后内部滚动；交互事件会阻止冒泡，避免误拖画布节点。资源查询串统一升级到 `20260703panel2`，入口 bundle 与 smoke/资产护栏同步。
- 验证结果：`node --check` 覆盖 `canvas-image-node-polish.js`、两个 Canvas bundle 和两个入口 bundle；`node scripts/verify-canvas-performance-assets.js` 通过；`scripts/smoke-backend-canvas-boundary.ps1` 通过；`git diff --check` 通过。浏览器刷新当前画布后加载 `panel2` 资源，工具条只剩 `AI 扩图 / 格式/压缩 / 反推提示词 / 局部修改 / 图片尺寸调整 / 图片裁剪 / 添加到聊天`；`局部修改` 面板可打开并带拖拽/缩放手柄；格式/压缩面板标题栏拖拽和右下角缩放实测生效；50% 缩放下笔刷拖拽无运行时错误，200% 下读取到预览 canvas 处于非 1:1 缩放几何。
- 边界：不删除后台 `smartErase` 配置和 `/api/image-tools/erase` 接口，不改工作流 JSON、不触发真实 Provider。浏览器验收期间缩放控件最终停在 90%，测试面板已关闭，不影响项目数据。

## 2026-07-03 首页历史画布卡片点击修复

- 分支：`main`
- 触发背景：用户反馈首页的画板无法点击打开；复现后确认侧边栏 `新画布` 可正常进入画布，但首页下方历史画布卡片点击后仍停留在首页。
- 完成内容：`assets/home-carousel-inertia.js` 将 `.history-track` 的 `setPointerCapture` 从 `pointerdown` 延后到真正超过拖拽阈值时执行，避免普通点击被轨道容器接管而吞掉 `.history-card` 的 Vue click；`index.html` 将轮播脚本查询串升级到 `20260703open1`。
- 修改文件：`assets/home-carousel-inertia.js`、`index.html`、`docs/progress-report.md`、`docs/review-log.md`
- 验证方式：使用系统 Chrome + Playwright 复现并回归首页历史卡片点击；执行 `node --check "F:\dianshang\assets\home-carousel-inertia.js"`、`node --check "F:\dianshang\server.js"`、`powershell -NoProfile -ExecutionPolicy Bypass -File "F:\dianshang\scripts\smoke-frontend-routes.ps1"`、`git -C "F:\dianshang" diff --check`、触达文本文件 UTF-8 BOM 检查。
- 验证结果：`node --check` 覆盖首页轮播脚本和后端入口均通过；前端路由 smoke 通过；`git diff --check` 无空白错误，仅提示既有 CRLF 转换；触达文件均无 BOM；浏览器加载 `/assets/home-carousel-inertia.js?v=20260703open1` 后点击首页历史画布卡片，URL 从 `/` 进入 `/canvas/project_...`，控制台出现 `HomeIndexHistory` 打开日志。
- 当前完成度：首页历史画布卡片打开链路 95%。
- 新发现问题：当前工作区已有多处与本轮无关的未提交修改，本轮未回退也未整理这些改动。
- 未完成清单：用户在自己已打开的首页刷新后再点历史画布卡片确认。
- 下一轮建议：如还遇到首页画布入口问题，优先区分侧边栏 `新画布`、历史卡片、顶部历史记录弹窗三个入口。
- 需要人工介入：需要用户刷新首页以确保浏览器加载 `home-carousel-inertia.js?v=20260703open1`。

## 2026-07-03 局部修改提交独立进度节点

- 触发背景：用户要求 `局部修改` 点击提交后自动转成图2样式的生图进度节点，且不需要链接画布其它节点。
- 完成内容：`assets/Canvas-B8bY9_QL.js` 与 `assets/Canvas-yGc8b2gf.js` 的图片结果节点 helper 增加 `connect:false` 分支；`runInpaint` 提交后立即创建独立 `image` 加载节点，初始显示 `已提交请求 18%`，后台 `/api/image-tools/inpaint` 完成后回填图片 URL、尺寸、进度和错误状态。
- 兼容边界：默认创建结果节点仍保持原连线行为，只对 `局部修改/文字编辑` 提交路径传入 `connect:false`；不改后端 API、不改工作流 JSON、不改节点数据结构。
- 护栏调整：`index.html`、两个入口 bundle 和旧画布边界 smoke 查询串升级到 `20260703submit1`；`scripts/verify-canvas-performance-assets.js` 新增无连线进度节点、18% 提交态和旧同步建结果节点路径的防回退断言。
- 验证结果：两个 Canvas bundle、两个入口 bundle 和 `canvas-image-node-polish.js` 的 `node --check` 通过；`node scripts/verify-canvas-performance-assets.js` 通过；`scripts/smoke-backend-canvas-boundary.ps1` 通过并确认 `20260703submit1` 静态资源返回 200；`git diff --check` 通过，仅有既有 LF/CRLF 提示；触达文件 BOM 检查通过。
- 未覆盖风险：当前服务已配置真实 Provider，浏览器实点 `局部修改` 提交可能触发真实外部调用和扣费；本轮未主动触发真实生图，需用户确认后再做端到端提交验收。

## 2026-07-03 局部修改 mask 兼容格式增强

- 触发背景：用户用 `局部修改` 去除底部文字后，结果图显示底部文字被去除，但瓶身标签文字也被模型整体抹掉，说明 mask 已进入链路但上游约束不够稳定。
- 完成内容：`assets/Canvas-B8bY9_QL.js` 与 `assets/Canvas-yGc8b2gf.js` 在提交时继续保留旧 `maskBase64` 黑白 mask，同时新增 `maskAlphaBase64`：涂抹区域导出为透明编辑区，未涂抹区域为黑色不透明保留区。`局部修改/文字编辑/兼容消除` 请求都会带上该字段。
- 后端调整：`server.js` 的图片编辑链路优先读取 `maskAlphaBase64`，再回退到 `maskBase64/mask/maskUrl`；默认提示词改为 `mask 透明或白色标记区域`，并强化 `未涂抹区域内的文字、品牌标识、瓶身标签` 不要改动。
- 护栏调整：旧画布资源查询串升级到 `20260703mask1`；`scripts/verify-canvas-performance-assets.js` 纳入 `server.js`，新增透明 mask 导出、请求字段和后端优先级断言。
- 验证结果：`node --check` 覆盖 `server.js`、两个 Canvas bundle 和两个入口 bundle；`node scripts/verify-canvas-performance-assets.js` 通过并确认 `server` 与 `20260703mask1`；`scripts/smoke-api-disposable.ps1` 通过；`scripts/smoke-backend-canvas-boundary.ps1` 通过并确认 `20260703mask1` 静态资源返回 200。
- 未覆盖风险：真实 Provider 已配置，本轮不主动触发真实局部修改提交；需要用户刷新画布加载 `mask1` 后，用更窄的涂抹区域自行验证真实效果。

## 2026-07-03 批量生图并发单张请求

- 触发背景：用户反馈画布图片生成节点选择 `4 张` 后中转站延迟明显，要求批量出图不要打成一个大请求，也不要一张完成后才请求下一张。
- 排查结论：`callProviderImageGeneration` 与 `callProviderImageEdit` 已经没有向上游发送 `n=4`，而是每次上游请求 `n=1`；但此前实现使用串行 `for + await`，会把 4 次中转延迟累加。
- 完成内容：`server.js` 将纯生图和图生图 Provider 适配器改为 `Promise.all(Array.from({ length: count }, ...))`，同时发送最多 4 个独立上游请求；每个请求继续固定 `n: 1` 或 `form.append('n', '1')`，结果按请求顺序合并并重新编号。
- 护栏调整：`scripts/check-packy-gpt-image-adapter-coverage.js` 新增并发单张形态断言，要求两个适配器都包含 `Promise.all` 并排除 `for (let i = 0; i < count; i += 1)` 串行批量循环。
- 验证结果：`node --check "F:\dianshang\server.js"` 通过；`node --check "F:\dianshang\scripts\check-packy-gpt-image-adapter-coverage.js"` 通过；`node "F:\dianshang\scripts\check-packy-gpt-image-adapter-coverage.js"` 通过；`powershell -NoProfile -ExecutionPolicy Bypass -File "F:\dianshang\scripts\smoke-api-disposable.ps1"` 通过；`git -C "F:\dianshang" diff --check` 无空白错误，仅有既有 LF/CRLF 提示。
- 未覆盖风险：本轮未主动触发真实 Provider 付费生图；真实中转并发吞吐和限流表现需要用户在已确认扣费风险后点测。

## 2026-07-03 图片生成节点提交后释放操作

- 触发背景：用户反馈旧画布图片生成节点点击生成后，原节点一直显示 loading，无法继续调整参数或再次提交生成。
- 完成内容：`assets/Canvas-B8bY9_QL.js` 与 `assets/Canvas-yGc8b2gf.js` 移除 `ImagePromptGenerateNode` 点击入口的 `if (loading) return` 阻塞，并将生成按钮禁用条件从 `loading || !可生成` 改为只按 `!可生成` 禁用；按钮不再被请求中的 loading 态替换成转圈，点击后仍会立即创建独立结果进度节点。
- 资源版本：入口 bundle 查询串升级到 `20260703freegen1`，`index.html`、`assets/index-DglIsp_g.js`、`assets/index-ZrBcanD1.js` 和旧画布边界 smoke 同步。
- 护栏调整：`scripts/verify-canvas-performance-assets.js` 新增断言，要求图片生成节点保留 `disabled:!Ce.value,onClick:fe`，并禁止回退到 `disabled:I(r)||!Ce.value`、`if(r.value)return` 和按钮 loading spinner。
- 验证结果：两个 Canvas bundle、两个入口 bundle、资产护栏脚本和画布性能 UI runner 的 `node --check` 均通过；`node scripts/verify-canvas-performance-assets.js` 通过并确认 `20260703freegen1`；`scripts/smoke-backend-canvas-boundary.ps1` 通过并确认新资源返回 200。
- 未覆盖风险：当前服务可能已配置真实 Provider，本轮未在浏览器实点生图，避免触发真实外部调用和扣费；需要用户刷新画布后确认同一节点可连续点击提交多批进度节点。

## 2026-07-03 图片 Provider 串行延迟队列

- 触发背景：用户反馈 `4 张` 批量生图时中转容易高延迟过载，需要加延迟器逐个上传，避免同时把多份参考图和生图请求压到中转。
- 完成内容：`server.js` 新增图片 Provider 全局请求队列；所有真实 `callProviderImageGeneration` 和 `callProviderImageEdit` 上游请求都通过 `runQueuedProviderImageBatch` / `runQueuedProviderImageRequest` 串行执行，不再使用 `Promise.all` 并发发送。
- 延迟策略：每次上游请求仍固定 `n: 1` 或 `form.append('n', '1')`，但默认在相邻真实图片上游请求之间等待 `1500ms`；可用 `IMAGE_PROVIDER_REQUEST_DELAY_MS`、`PROVIDER_IMAGE_REQUEST_DELAY_MS`、`IMAGE_PROVIDER_BATCH_DELAY_MS` 或 `PROVIDER_IMAGE_BATCH_DELAY_MS` 调整，最大 15 秒。
- 护栏调整：`scripts/check-packy-gpt-image-adapter-coverage.js` 和 `scripts/verify-canvas-performance-assets.js` 改为断言串行延迟队列，并禁止回退到 `Promise.all(Array.from({ length: count }, async ...))`。
- 未覆盖风险：本轮不主动触发真实 Provider 付费调用；真实 4 张批量会比并发更慢，但能降低中转瞬时上传压力和过载概率。

## 2026-07-03 图生图用户需求识别增强

- 触发背景：用户在图片生成节点输入 `根据图1生成拼多多电商主图`，生成结果像只照搬参考图，怀疑没有识别提示词。
- 排查结论：前端旧画布请求体确实带了 `prompt`；本地 `generations` 记录中的最终 prompt 也包含 `用户需求：根据图1生成拼多多电商主图`。根因不是未传 prompt，而是后端 `buildEcommerceImagePrompt` 对参考图强调“保持产品一致”，但没有足够强制模型必须明显执行用户目标。
- 完成内容：`server.js` 的电商生图系统提示新增 `用户需求优先级`；参考图规则改为“参考图只作为产品身份依据，不要直接复刻”；新增 `ecommercePlatformPromptHint`，对 `拼多多/PDD` 明确补充高点击正方形电商主图构图、明亮背景、商品占比和合规边界。
- 护栏调整：`scripts/verify-canvas-performance-assets.js` 新增服务器 prompt 锚点断言，防止后续弱化成只保留参考图。
- 未覆盖风险：本轮未重新触发真实 Provider 扣费生图；用户刷新后再次生成，应比之前更明显体现“拼多多电商主图”目标。

## 2026-07-03 图生图后端提示词松绑

- 触发背景：用户反馈图生图后端提示词格式不要限制太死，最好不要有太多限制，只保留基础提示，否则影响模型发挥。
- 完成内容：`server.js` 删除平台自动扩写函数 `ecommercePlatformPromptHint`，移除 `拼多多/PDD` 专用模板、`必须显著执行`、`视为失败` 等强约束；电商系统提示词改为轻量版本，只保留理解用户需求、参考图作依据、画面清晰自然、避免水印/乱码/畸形这些基础要求。
- 护栏调整：`scripts/verify-canvas-performance-assets.js` 改为断言轻量提示词，并禁止回退到平台模板化和失败判定式强约束。
- 未覆盖风险：本轮未触发真实 Provider 扣费生图；真实效果需要用户刷新后用同一图生图节点重新测试。

## 2026-07-03 图生图提示词最小化

- 触发背景：用户进一步明确后端只需要给 `专业电商设计师` 身份，额外只保留产品不拉伸变形、文字清晰、不要光斑和乱码。
- 完成内容：`server.js` 的电商图生图基础提示词压缩为三条：`你是一名专业电商设计师。`、`保持产品比例自然，不要拉伸或变形。`、`文字清晰，不要出现光斑和乱码。`；去掉“自由创作”“适合电商展示”“参考图作为生成依据”等额外引导句。
- 护栏调整：`scripts/verify-canvas-performance-assets.js` 断言这三条最小提示词，并禁止重新加入长提示词锚点。
- 未覆盖风险：本轮未触发真实 Provider 扣费生图；当前 3456 服务需要重启后生效。

## 2026-07-03 图片上传节点双击打开文件夹

- 触发背景：用户要求空图片上传节点改成 `双击打开文件夹，单击选中节点`，避免单击节点时被透明 file input 直接弹出文件选择器。
- 完成内容：`assets/Canvas-B8bY9_QL.js` 与 `assets/Canvas-yGc8b2gf.js` 将空图片节点上传区域的 file input 从覆盖整块区域的透明输入框改为 `hidden`；上传区域新增 `onDblclick`，双击时才触发内部 `input[type=file]`。
- 交互边界：只改空图片上传节点；图片 URL 输入框、拖拽上传、视频节点上传和已有图片双击预览不变。
- 护栏调整：`scripts/verify-canvas-performance-assets.js` 新增双击上传锚点和隐藏 file input 断言，并禁止图片节点回退到透明覆盖式 `input[type=file]`。
- 验证结果：`node --check` 覆盖两个 Canvas bundle 和资产护栏脚本；`node scripts/verify-canvas-performance-assets.js` 通过；`scripts/smoke-backend-canvas-boundary.ps1` 通过并确认两个 Canvas 静态资源返回 200；已刷新内置浏览器当前画布项目，页面中不再存在图片上传节点旧透明覆盖 input。
- 未覆盖风险：浏览器自动化未主动点击真实文件选择器；用户需要在当前画布里单击空图片节点确认只选中，再双击确认弹出文件选择器。

## 2026-07-03 Docker 内网测试目录同步

- 触发背景：最终评审确认当前只适合内网试运行，用户要求把最新更新内容同步到 `docker/` 目录并进行内网测试准备。
- 完成内容：`docker/docker-compose.yml` 同步最新服务端 Provider 运行参数，新增 `CANVAS_DIALOG_ANALYSIS_TIMEOUT_MS`、`IMAGE_PROVIDER_REQUEST_DELAY_MS`，保留 `IMAGE_PROVIDER_TIMEOUT_MS`，并增加 `init: true` 与 Docker 日志滚动限制；`docker/.env.example` 与当前本地 `docker/.env` 同步这些变量。
- 验证脚本：新增 `docker/verify-internal.ps1`，从 `docker/` 目录执行 Docker 可用性、`.env` 安全边界、`docker compose config`、容器启动、健康检查、API smoke、前端路由 smoke 和 Provider guard smoke；默认不运行 UI smoke，可通过 `SMOKE_UI=true` 打开。
- 构建边界：`.dockerignore` 新增排除 `docker/.env`、`docker/data`、`docker/uploads`、`docker/logs`、`docker/backup`，避免内网运行数据和本地密钥进入镜像构建上下文。
- 文档：`docker/README.md` 补充内网验收命令、`verify-internal.ps1` 用法、真实 AI/支付/公网门禁和默认管理员风险说明。
- 验证结果：`docker/verify-internal.ps1` PowerShell 解析通过；`docker compose -f "F:\dianshang\docker\docker-compose.yml" config` 通过；`git diff --check` 无空白错误，仅有既有 LF/CRLF 提示。
- 阻塞项：实际 Docker 容器未能启动，因为当前 Windows Docker CLI 可用但 Docker Desktop Linux Engine 未运行；`docker info` 报 `failed to connect to the docker API at npipe:////./pipe/dockerDesktopLinuxEngine`，`com.docker.service` 当前会话无权限启动。
- 复测结果：Docker Desktop Linux Engine 后续已可用；因本地 `node` 占用 3456，使用 `HOST_PORT=3458` 执行 `docker/verify-internal.ps1` 成功，镜像构建和容器启动通过，`/api/health` 为 `ok`，API smoke、前端路由 smoke 和 Provider guard smoke 均通过；容器 `dianshang-internal-app` 当前为 `healthy`，端口映射 `0.0.0.0:3458->3456/tcp`。

## 2026-07-03 Docker 生产态画布 JSON 保存兜底

- 触发背景：用户准备继续部署到 Docker，当前生产态下浏览器本地文件夹 JSON 保存不可用，云端 JSON 保存也没有形成可确认的持久化兜底。
- 排查结论：本地文件夹自动保存依赖浏览器 File System Access API；在非 `localhost` 的 HTTP 内网地址上通常会被浏览器当作非安全上下文而拒绝，Docker 无法绕过。生产态应以云端 JSON 保存到 SQLite 为主路径。
- 完成内容：`server.js` 新增工作流 JSON 归一化，兼容旧画布实际发送的 `workflowJson`、历史 smoke 使用的 `data`、以及 `workflowData/canvasData/workflow` 包装；读取项目时也会解包旧的包裹结构，避免“保存成功但读取不到 nodes/edges”。
- 验证补充：`scripts/smoke-api.ps1` 新增 `workflowJson` 请求体覆盖，验证 `/api/workflows/:id/save-json` 保存后 `/api/user/projects/:id` 能直接读到工作流节点、视口和 storage。
- 部署边界：本轮不直接重启现有生产容器；确认后再执行 `docker/verify-internal.ps1` 或 `docker compose up --build -d`，避免覆盖当前业务会话。

## 2026-07-03 注册直通与服务器本地工作流 JSON

- 触发背景：用户确认当前注册先不做邮箱验证码，积分由兑换码发放；同时要求生产 Docker 下本地自动保存能有可用兜底。
- 注册调整：`POST /api/auth/register` 默认不再强制校验邮箱验证码；保留 `REQUIRE_REGISTER_EMAIL_CODE=true` 环境变量作为回退开关。默认新用户余额改为 `0`，不再写注册送 50 的余额流水。
- 前端调整：源码注册页去掉验证码输入和“注册送 50”提示；旧打包登录页新增 `assets/auth-direct-register-bridge.js`，隐藏注册表单验证码行，找回密码验证码不受影响。
- 保存调整：`/api/workflows/:id/save-json` 在保存 SQLite 项目的同时写入服务器本地 `.workflow.json`；新增 `/api/workflows/:id/save-local-json` 与 `/api/workflows/:id/local-json`，用于 Docker/生产态验证本地 JSON 文件。
- Docker 路径：Compose 已设置 `WORKFLOW_DIR=/app/data/workflows`，主机侧落到 `F:\dianshang\docker\data\workflows`。
- 画布兜底：旧画布选择“本地自动保存”时，如果浏览器无法取得本地文件夹权限，会改走服务器本地 workflows 目录保存，并在保存面板显示“服务器本地 workflows”。
- 验证补充：`scripts/smoke-api.ps1` 覆盖直注册 0 积分、管理员创建兑换码、用户兑换、`save-json` 本地文件返回、`save-local-json` 保存和 `local-json` 下载恢复。
- 部署边界：当前运行中的 Docker 容器仍需重新 build/restart 才会加载这些代码；本轮不主动重启生产态容器。

## 2026-07-04 内网画布云端手动保存验证

- 触发背景：用户反馈首页暂无云端手动保存入口，要求进入画布保存当前工作流。
- 执行内容：打开内网页面 `http://192.168.0.39:3456/canvas/project_1783129273163_lcuac0uat`，通过顶部保存面板选择当前默认的云端自动保存，并点击 `立即保存`。
- 登录态处理：初次保存请求返回 401；已在当前内网页面写入 Docker 测试环境默认 `admin` 登录态后重试，未刷新或替换画布内容。
- 验证结果：Docker SQLite `F:\dianshang\docker\data\data.db` 已新增项目 `project_1783129273163_lcuac0uat`，名称 `示例项目`，保存 JSON 为 2 个节点、1 条连线，`saveType=cloud`。
- 文件落盘：同步生成 `F:\dianshang\docker\data\workflows\user_mr4r2o2h88a7cdbe\project_1783129273163_lcuac0uat.workflow.json`，文件根层包含 `nodes` 2 个和 `edges` 1 条。

## 2026-07-04 注册与找回密码闭环修复

- 触发背景：用户在内网页面点击注册时看到 `缺少必填字段`，并询问找回密码是否已完成。
- 排查结论：当前 Docker 运行态后端已支持无验证码注册；旧 `/register` 页面仍使用旧登录弹窗并包含注册验证码控件，桥接脚本隐藏了验证码但缺少明确提示；找回密码接口逻辑存在，但 mock 邮件模式下验证码只打印在后端日志，用户页面拿不到码，内网测试闭环不完整。
- 后端调整：`/api/auth/register` 对空字段返回 `请填写用户名、邮箱和密码`；`/api/auth/send-reset-code` 在 `ENABLE_REAL_EMAIL=false` 的 mock 模式下返回 `code`，并在响应 message 中显示测试验证码。
- 前端过渡层：`assets/auth-direct-register-bridge.js` 将注册验证码输入禁用并隐藏，插入“当前内网注册无需邮箱验证码”提示；注册提交前检查用户名、邮箱和密码，避免空表单直接打到后端。
- 验证补充：`scripts/smoke-api.ps1` 增加找回密码闭环，覆盖发重置验证码、重置密码、使用新密码登录。
- 验证结果：`node --check server.js`、`node --check assets/auth-direct-register-bridge.js` 通过；`scripts/smoke-api-disposable.ps1` 通过，输出包含 `POST /api/auth/send-reset-code`、`POST /api/auth/reset-password`、`POST /api/auth/login`。
- 部署边界：当前运行中的 Docker 容器尚未重建；需用户确认后执行 `docker compose up --build -d`，才能让 `http://192.168.0.39:3456` 立即加载本轮修复。

## 2026-07-04 Docker 注册入口复测修正

- 触发背景：用户确认可重启 Docker，并要求先测试注册是否成功。
- 执行内容：已在 `F:\dianshang\docker` 执行 `docker compose up --build -d`，容器 `dianshang-internal-app` 重建并进入 `healthy`。
- 接口验证：直接访问内网地址 `http://192.168.0.39:3456`，调用 `/api/auth/register` 注册一次性测试账号，返回 token；随后 `/api/auth/login` 登录成功，并通过 `/api/user/profile` 读取到新用户资料。
- 前端复测发现：`assets/auth-direct-register-bridge.js` 原本用 `input[placeholder*="验证码"]` 扫描验证码框，导致注册邮箱输入框的 placeholder `请输入用于接收验证码的邮箱` 被误隐藏。
- 修正内容：注册桥接脚本改为只识别 `autocomplete="one-time-code"`、`inputmode="numeric"` 或 `maxlength="6"` 的验证码输入框，并显式排除 `type="email"` / `autocomplete="email"`；`index.html` 更新脚本查询版本号避免浏览器缓存旧脚本。
- 复测结果：修正后再次执行 `docker compose up --build -d`；容器保持 `healthy`。内网注册、登录、用户资料读取均通过；容器返回的注册桥接脚本已不再使用验证码 placeholder 宽匹配，并确认首页加载 `v=20260704directregister2`。
- 未覆盖风险：本轮不触发真实邮件、支付或真实 AI；注册测试会在 Docker SQLite 中留下 `regtest*` 一次性测试用户。

## 2026-07-04 Docker 生产端真实 API 配置

- 触发背景：用户要求直接使用原来的 API 上传到生产端，让 Docker 内网服务加载真实生图配置。
- 执行内容：已备份 `F:\dianshang\docker\.env` 到 `F:\dianshang\docker\backup\.env.before-real-ai-20260704-111819.bak`；将根目录 `.env` 中原有 Packy API 配置同步到 Docker `.env`。
- 配置变更：`ENABLE_REAL_AI=true`，`AI_PROVIDER_GATEWAY=direct`，`AI_API_BASE=https://www.packyapi.com/v1`；`AI_IMAGE_KEY`、`AI_TEXT_KEY` 已从原 `.env` 同步，未在日志中明文输出。
- 运行结果：执行 `docker compose up -d --force-recreate` 重启容器加载新环境变量；`/api/health` 返回 `mode=real-provider-ready`，`providers.ai.enabled=true`，`gateway=direct`，`imageKeyConfigured=true`，`textKeyConfigured=true`。
- 风险边界：当前已具备真实 Provider 调用条件；后续页面点击生图会走真实上游并可能产生 API 消耗。本轮未主动触发真实生图。

## 2026-07-04 未登录默认账号与强制登录

- 触发背景：用户退出登录后用户中心仍显示 `guest / guest@erdan.ai` 默认账号，要求未登录必须强制登录/注册，登录弹窗不可取消，默认账号改为“未登录”。
- 默认账号处理：`assets/UserCenter-C3r6Sru7.js` 与 `assets/UserCenter-jqG499Zg.js` 的用户中心兜底从 `guest / guest@erdan.ai` 改为 `未登录 / 请先登录或注册`。
- 强制登录处理：`assets/user-center-data-bridge.js` 新增登录守卫；未登录访问 `/user/*`、`/canvas*`、`/gallery*`、`/template-image*`、`/templates*` 会保存原目标并跳转 `/login?forceAuth=1`。
- 不可取消处理：强制登录态下隐藏登录页关闭按钮和“返回首页”按钮，拦截这些取消按钮点击与 `Escape` 关闭操作。
- 缓存处理：`index.html` 将 `user-center-data-bridge.js` 版本提升到 `v=20260704authguard1`，避免内网页面继续使用旧脚本。
- Docker 结果：已执行 `docker compose up --build -d`；容器保持 `healthy`，真实 AI 状态仍为 `real-provider-ready`。容器返回的首页已加载 `v=20260704authguard1`，守卫脚本包含受保护路由和不可取消标记，用户中心 bundle 不再包含 `guest@erdan.ai`。
- 未覆盖风险：这是旧打包资产过渡层修复；源码化前仍需在源码路由层补正式 auth guard。本轮未主动触发真实生图；未强制清理当前浏览器登录态。

## 2026-07-04 首页云端立即保存入口调整

- 触发背景：用户反馈首页保存面板在云端模式点击 `立即保存` 时提示 `主页暂无云端手动保存入口，请进入画布保存当前工作流`，需要修改。
- 完成内容：`assets/HomeIndex-BtiJ9toc.js` 的云端手动保存分支不再只弹 warning；现在会优先打开最近/当前画布项目，若没有项目则新建一个画布，并提示用户在画布顶部保存面板点击 `立即保存`。
- 行为边界：首页仍不直接写入某个画布 JSON，因为首页没有当前画布节点/连线状态；它改为把用户带到真正拥有工作流状态的画布保存入口。
- Docker 结果：已执行 `docker compose up --build -d`；容器 `dianshang-internal-app` 保持 `healthy`，`/api/health` 仍为 `real-provider-ready`，真实 API 配置未被覆盖。容器返回的首页资源已确认移除旧 warning，并包含进入/新建画布后的保存提示。
- 未覆盖风险：本轮未主动触发真实生图；未通过浏览器点击发起真实画布保存，只验证了容器资源与后端健康状态。

## 2026-07-04 后台登录统一跳转修复

- 触发背景：用户在 `/admin/login` 登录后停留在“管理员登录成功”卡片，并看到“旧版后台登录 / 旧版后台控制台”入口，造成后台未统一的误解。
- 问题结论：这是源码后台迁移期遗留文案和交互；实际后台路由已统一走源码 `frontend/dist`，不应再暴露“旧版后台”入口。
- 完成内容：`frontend/src/views/AdminLoginSource.vue` 登录成功后会按 `redirect` 回到原后台页，否则进入 `/admin/dashboard`；已登录管理员再次打开登录页也会自动进入后台。页面文案改为“统一管理员后台”，移除“旧版后台登录 / 旧版后台控制台”链接。
- 测试维护：`scripts/smoke-source-frontend-ui-runner.js` 的后台登录断言改为验证跳转到 `/admin/dashboard`，不再等待登录成功停留页。
- 构建部署：已运行 `npm run build --prefix "F:\dianshang\frontend"` 并执行 `docker compose up --build -d`；容器保持 `healthy`，`/api/health` 仍为 `real-provider-ready`。
- 验证结果：容器返回的 `/admin/login` 已加载 `AdminLoginSource-otrt5SIg.js`，确认旧文案移除，包含 `/admin/dashboard` 跳转逻辑；`/api/admin/login` 使用 `admin/admin123` 返回 admin token。
- 未覆盖风险：本轮未使用真实浏览器自动化点击登录，避免触发可能下载 Playwright CLI；已通过构建、接口和容器 HTTP 资源验证主路径。

## 2026-07-04 兑换码创建与系统设置卡死修复

- 触发背景：用户反馈后台兑换码没有添加兑换码入口，点击系统设置会卡死。
- 兑换码结论：源码后台 `AdminRedeemCodesSource.vue` 仍是“只读迁移版”，但后端已有 `POST /api/admin/redeem-codes` 与 `DELETE /api/admin/redeem-codes/:code`。
- 兑换码修复：新增 `createAdminRedeemCode` / `deleteAdminRedeemCode` API 封装；兑换码页增加新增表单，支持填写兑换码、算力额度、可兑换次数和启用状态，列表支持删除。
- 系统设置修复：`AdminSettingsSource.vue` 中 `ecommerceDraft`、`ecommerceDefaults`、`ecommerceSkills` 的 computed 不再调用会写入 draft 的 `ensureEcommerceDraft()`，避免渲染期响应式写入导致页面卡死。
- 样式补充：`frontend/src/styles/app.css` 增加兑换码新增表单布局，并纳入移动端单列规则。
- 验证结果：`npm run build --prefix "F:\dianshang\frontend"`、`npm run check:routes --prefix "F:\dianshang\frontend"` 通过；一次性测试兑换码创建后可查询，删除后消失。
- Docker 结果：已执行 `docker compose up --build -d`；容器 `healthy`，`/api/health` 仍为 `real-provider-ready`。容器返回的兑换码资源包含 `添加兑换码`，旧只读文案已移除。
- 未覆盖风险：本轮未运行真实浏览器自动点击，避免触发 Playwright CLI 下载；需要用户在当前浏览器强刷后手动确认系统设置不再卡死。

## 2026-07-04 内网测试生产状态收口

- 触发背景：用户确认当前目标是内网测试生产状态，要求按单机 Docker 准生产边界实施收口计划。
- 安全收口：`server.js` 新增生产模式强 `JWT_SECRET` 校验、`ADMIN_BOOTSTRAP_USERNAME` / `ADMIN_BOOTSTRAP_PASSWORD` 管理员引导、`CORS_ORIGINS` 白名单；不再每次启动强制把管理员密码重置为 `admin123`。
- 默认弱密码处理：如果已有 bootstrap 管理员仍是 `admin123`，且 Docker `.env` 配置了强 bootstrap 密码，启动时只轮换一次。
- 运维脚本：新增 `scripts/backup-internal-prod.ps1` 和 `scripts/smoke-internal-prod.ps1`，分别用于容器内 SQLite 备份和内网准生产 smoke。
- 运行文档：新增 `docs/internal-production-runbook.md`，明确前台旧资产、后台 `frontend/dist`、单体后端、真实 AI 与 mock 能力边界。
- Docker 配置：`docker-compose.yml` 增加 `ADMIN_BOOTSTRAP_USERNAME`、`ADMIN_BOOTSTRAP_PASSWORD`、`CORS_ORIGINS` 环境变量；`docker/.env` 已备份并写入强 secret、bootstrap 密码和内网 CORS 白名单。
- 密码迁移：发现旧数据库密码哈希使用旧 JWT secret 作为盐，切换强 `JWT_SECRET` 后会导致存量密码失效；已增加 `PASSWORD_LEGACY_SECRETS` 迁移兼容，登录成功后自动重哈希，默认 `admin/admin123` 已启动时迁移为 bootstrap 强密码。
- 验证结果：`node --check server.js`、两个新增 PowerShell 脚本语法解析、`npm run build --prefix "F:\dianshang\frontend"`、`npm run check:routes --prefix "F:\dianshang\frontend"` 均通过。
- Docker 结果：已执行 `docker compose up --build -d`；容器 `dianshang-internal-app` 为 `healthy`，`/api/health` 返回 `real-provider-ready`，邮件/支付/对象存储仍为关闭。
- Smoke 结果：`scripts/smoke-internal-prod.ps1` 通过，覆盖健康检查、管理员登录、后台设置读取、一次性兑换码创建/查询/删除、前台旧资产和后台源码资产访问；未触发真实生图。
- 备份结果：`scripts/backup-internal-prod.ps1` 通过，生成 `F:\dianshang\docker\backup\internal-prod-20260704-131428`；恢复演练到 `F:\dianshang\docker\backup\restore-check-20260704-131452`，备份库 `integrity_check=ok`。

## 2026-07-04 工作台品牌文案替换

- 触发背景：用户要求把 `哈基米/哈吉米 AI 工作台` 改为 `爱泊缇 AI 工作台`，并把页面标题 `二蛋` 也改为 `爱泊缇 AI 工作台`。
- 完成内容：根入口 `index.html`、源码后台 `frontend/index.html`、后端默认 `siteName`、旧前台 `assets/i18n-*.js` 登录/注册标题均已替换为新品牌文案。
- 运行数据：Docker SQLite 的 `app_state.admin.settings.siteName` 已单字段迁移为 `爱泊缇 AI 工作台`，不影响用户、项目、生成记录或兑换码数据。
- 构建部署：已运行 `npm run build --prefix "F:\dianshang\frontend"`、`npm run check:routes --prefix "F:\dianshang\frontend"`、`node --check "F:\dianshang\server.js"`，并执行 `docker compose up --build -d`。
- 验证结果：容器 `dianshang-internal-app` 为 `healthy`；HTTP 验证确认 `/` 与 `/admin/login` 标题为 `爱泊缇 AI 工作台`，旧前台 i18n 包含 `登录爱泊缇 AI 工作台` / `注册爱泊缇 AI 工作台`，运行资源中不再出现 `二蛋`、`登录哈吉米`、`注册哈吉米`。

## 2026-07-04 前台用户登录与后台管理员登录隔离

- 触发背景：用户确认前台登录和后端管理员登录不能混淆，要求按“前台普通用户、后台管理员”两条链路分开。
- 后端边界：`/api/auth/login` 普通登录现在拒绝 `admin` 角色账号，返回 `管理员请使用后台登录入口`；管理员只能通过 `/api/admin/login` 获取后台 token。
- 前端会话：源码后台新增独立 `admin_auth_token` / `admin_auth_user`；普通前台继续使用 `auth_token` / `auth_user`。
- 请求隔离：`frontend/src/api/http.ts` 按请求路径判断，`/api/admin/*` 使用管理员 token，其余用户接口使用普通 token；后台 401/403 只清管理员会话，不清前台用户登录态。
- UI 清理：前台登录页和后台登录页移除 `填入默认账号` / `admin123` 相关入口；后台登录页不再提供未登录时直接进入控制台的链接。
- 构建部署：已运行 `npm run build --prefix "F:\dianshang\frontend"`、`npm run check:routes --prefix "F:\dianshang\frontend"`、`node --check "F:\dianshang\server.js"`，并执行 `docker compose up --build -d`。
- 验证结果：Docker 容器 `healthy`；普通 `/api/auth/login` 使用管理员账号返回 403；`/api/admin/login` 管理员登录成功；`scripts/smoke-internal-prod.ps1` 通过，后台设置和兑换码 CRUD 正常。

## 2026-07-04 兑换码新增区 UI 可读性修复

- 触发背景：用户反馈后台兑换码管理页新增兑换码区域横向拉散、字段淡、根本看不清。
- 完成内容：`frontend/src/styles/app.css` 调整 `admin-redeem-code-create`，新增区改为固定最大宽度的紧凑表单块；提升 label 对比度，给 Naive 输入框补清晰边框、白底、焦点态；启用开关独立成可见小块，按钮不再漂到超宽屏最右。
- 构建部署：已运行 `npm run build --prefix "F:\dianshang\frontend"`、`npm run check:routes --prefix "F:\dianshang\frontend"`，并执行 `docker compose up --build -d`。
- 验证结果：容器 `dianshang-internal-app` 为 `healthy`；运行 CSS 包 `index-BGyXYlzH.css` 包含新的紧凑表单样式；`scripts/smoke-internal-prod.ps1` 通过，兑换码创建/查询/删除接口正常。

## 2026-07-04 后台旧管理员 token 自动迁移

- 触发背景：用户已登录且浏览器有旧 `auth_token`，访问 `/admin` 仍要求输入账号密码；原因是后台登录态已拆分为 `admin_auth_token`，旧管理员 token 未自动迁移。
- 完成内容：`frontend/src/api/adminAuth.ts` 新增 `migrateLegacyAdminSession()`；当旧 `auth_user.role=admin` 且存在 `auth_token` 时，自动复制为 `admin_auth_token` / `admin_auth_user`。
- 页面行为：`AdminLoginSource.vue` 挂载时先执行迁移，迁移成功即按 redirect 进入后台；普通用户 token 不会迁移。
- 构建部署：已运行 `npm run build --prefix "F:\dianshang\frontend"`、`npm run check:routes --prefix "F:\dianshang\frontend"`，并执行 `docker compose up --build -d`。
- 验证结果：容器 `healthy`；运行主 bundle 包含 `auth_token` 到 `admin_auth_token` 的兼容迁移逻辑；`scripts/smoke-internal-prod.ps1` 通过。

## 2026-07-04 后台系统唯一化收口

- 触发背景：用户明确要求后台只保留一套，不再保留旧后台入口和旧后台控制台，避免后台系统混乱。
- 路由收口：`server.js` 的 SPA fallback 改为统一匹配 `/admin` 与所有 `/admin/*`，全部交给 `frontend/dist/index.html` 源码后台，不再让 `/admin` 掉回根旧前台。
- 根入口清理：`index.html` 移除旧后台桥接、旧后台表单补丁和旧后台视觉补丁引用，新增 `assets/admin-source-only-guard.js`，用于旧前台运行中点击后台路径时强制整页跳转到源码后台。
- 旧资产删除：根 `assets/` 已删除旧后台 `AdminLogin`、`AdminLayout`、`AdminShell`、`GenerateTaskMonitor`、`TemplateWorkflowAdmin` 相关 chunk 和 CSS；只保留 `admin-removed.*` tombstone 与新 guard。
- 旧主包清理：`assets/index-DglIsp_g.js`、`assets/index-ZrBcanD1.js` 已机械移除旧 `/admin/login`、`/admin` 路由块，并把旧后台 chunk 名称替换为 tombstone，避免旧主包继续指向已删除后台文件。
- 验证结果：`node --check server.js`、`node --check` 检查新 guard 和两个旧主包通过；固定字符串扫描确认根入口和根 `assets/` 不再命中旧后台 chunk/路由关键字；`npm run build --prefix "F:\dianshang\frontend"` 和 `npm run check:routes --prefix "F:\dianshang\frontend"` 通过。
- 未覆盖风险：本轮未重启 Docker，避免未经确认中断当前内网测试服务；需要重建容器后线上内网页面才会使用本轮删除后的资产与 `/admin` fallback。

## 2026-07-04 注册页邮箱必填提示修复

- 触发背景：用户截图反馈注册时连续弹出多条 `请填写用户名、邮箱和密码`，同时页面提示“无需邮箱验证码”，看起来像注册异常。
- 问题结论：当前注册契约仍要求 `username + email + password`；内网只关闭“邮箱验证码”，没有关闭“邮箱必填”。截图中邮箱为空，因此前端桥接脚本拦截提交并提示。
- 旧前台修复：`assets/auth-direct-register-bridge.js` 将提示改为“当前内网注册不需要验证码；邮箱仍是必填，用于找回密码和识别账号”，邮箱占位改为“请输入邮箱（用于找回密码）”，并加入 warning 去重，避免连续点击堆叠多条 toast。
- 源码前台修复：`frontend/src/views/AuthSource.vue` 增加提交前必填校验，注册页文案明确邮箱用于找回密码，且当前注册不需要验证码。
- 后端文案：`server.js` 的 `/api/auth/register` 缺字段错误改为说明当前内网注册无需邮箱验证码。
- 旧 i18n：`assets/i18n-BfLdM_9X.js` 与 `assets/i18n-Cj1lw-hh.js` 邮箱占位从“接收验证码”改为“用于找回密码”。
- 验证结果：`node --check server.js`、`node --check assets/auth-direct-register-bridge.js`、两个旧 i18n 包语法检查、`npm run build --prefix "F:\dianshang\frontend"`、`npm run check:routes --prefix "F:\dianshang\frontend"`、`git diff --check` 均通过。
- 未覆盖风险：本轮未重启 Docker；当前内网容器仍需重建后才会加载新的注册提示脚本和后端文案。

## 2026-07-04 图生图提示词轻框架调整

- 触发背景：用户希望只调整图生图提示词，让多图参考时能理解“图1排版、图2风格、图3配色、图4桌子、图5产品”等角色，同时不要过度收束影响发挥。
- 完成内容：`server.js` 的图生图 prompt builder 增加参考图数量识别、图序角色提取、任务类型判断和轻量结构化输出；无参考图时继续使用旧文生图提示词。
- 覆盖入口：普通生成任务、模板生图、画布对话 Agent、套图 Agent、局部编辑/扩图工具的图生图路径已接入；后台 API 线路连通性测试未改。
- Docker 结果：已将更新后的 `server.js` 热拷到 `dianshang-internal-app:/app/server.js` 并重启容器，当前 `3456` 生产测试端已加载新逻辑。
- 验证结果：`node --check "F:\dianshang\server.js"`、容器内 `node --check "/app/server.js"`、`git diff --check`、`/api/health` 均通过；未触发真实生图。
- 未覆盖风险：本轮为容器热更新，若后续重建镜像会以工作区源码为准；真实图像效果仍需用户用生产端实际图生图验证。

## 2026-07-04 参考图缩略图字段兼容修复

- 触发背景：用户截图反馈套图/图生图参考图按钮只显示占位图标和编号，缩略图无法显示。
- 问题结论：`assets/canvas-chat-prompt-flow.js` 的参考图预览函数只识别 `preview`、`dataUrl`、`url`，而实际图像对象可能来自上传、历史生成、画布节点或生成结果，常见字段包括 `imageUrl`、`originalUrl`、`thumbUrl`、`thumbnailUrl`、`src` 等。
- 完成内容：`suiteImagePreview()` 增加多来源 URL 字段兼容；`suiteImageToPayload()` 同步保留 `url`、`imageUrl`、`originalUrl`、`dataUrl`、文件名和 MIME 字段，避免显示能用但提交后端时丢图。
- Docker 结果：已将更新后的 `assets/canvas-chat-prompt-flow.js` 热拷到 `dianshang-internal-app:/app/assets/canvas-chat-prompt-flow.js`，未重启容器，当前容器仍为 `healthy`。
- 验证结果：本地与容器内 `node --check` 均通过；HTTP 拉取 `/assets/canvas-chat-prompt-flow.js` 已命中 `previewUrl`、`thumbnailUrl`、`imageUrl`、`originalUrl`、`uploadedUrl` 兼容字段。
- 未覆盖风险：已打开页面可能缓存旧 JS，需要浏览器强刷后再查看参考图缩略图；本轮未触发真实生图。

## 2026-07-04 画布图片闪烁修复

- 触发背景：用户反馈画布一直闪烁，体感像图片在重新加载。
- 问题结论：`canvas-performance-mode.js` 会在交互态频繁切换 `html/body` class，`canvas-image-node-polish.js` 和 `canvas-chat-prompt-flow.js` 又监听全站 class/DOM 变化，导致拖动、缩放、节点选中等普通画布变化也会触发图片节点扫描和聊天面板刷新；同时画布图片被统一标为 `loading="lazy"`，在 Vue Flow 变换容器里更容易出现重新取图/闪烁体感。
- 完成内容：画布节点图片改为 `loading="eager"`，避免懒加载参与画布交互；性能层不再对已存在 `src/currentSrc` 的图片改写 `referrerPolicy`；图片节点美化观察器只响应图片节点、标题锁定和图片工具面板相关变化；聊天提示词观察器只响应 `.canvas-chat-panel` 相关变化并做 80ms 节流。
- 缓存处理：`index.html` 已将三个画布辅助脚本版本号更新为 `20260704flicker1`，减少浏览器继续使用旧脚本的概率。
- Docker 结果：已热拷 `index.html`、`canvas-performance-mode.js`、`canvas-image-node-polish.js`、`canvas-chat-prompt-flow.js` 到 `dianshang-internal-app`，未重启容器，容器仍为 `healthy`。
- 验证结果：本地与容器内三个 JS `node --check` 通过；HTTP 验证 `/canvas` 已引用 `20260704flicker1`，线上脚本命中新加载策略和观察器过滤逻辑；`/api/health` 正常。
- 未覆盖风险：仓库未安装 Playwright，本轮未做浏览器录屏级验证；需要用户在当前生产端强刷后观察画布拖动、缩放和选中图片节点是否仍闪。

## 2026-07-04 图片生成节点输入框卡顿修复

- 触发背景：用户截图反馈旧画布图片生成节点的提示词输入框输入卡顿。
- 问题结论：旧 Canvas 主包中 `ImagePromptGenerateNode` 的 textarea 每次 `input` 都执行 `lt(t.id,{prompt:l.value})`，会把 prompt 立即写回 Vue Flow 节点数据，连带节点重渲染、参考图状态、自动保存防抖和样式重算；带参考图的节点更明显。
- 完成内容：`assets/Canvas-B8bY9_QL.js` 与 `assets/Canvas-yGc8b2gf.js` 将 prompt 写回改为 `220ms` 防抖；输入时仍即时更新 textarea 本地状态，停顿后再写回节点数据，组件卸载时会 flush 一次，避免最后输入丢失。
- 缓存处理：`index.html` 主入口版本更新为 `20260704inputlag1`，`assets/index-DglIsp_g.js` 与 `assets/index-ZrBcanD1.js` 中 Canvas 动态 import 版本也更新为 `20260704inputlag1`。
- Docker 结果：已热拷 `index.html`、两个 `index-*.js` 主包和两个 `Canvas-*.js` 主包到 `dianshang-internal-app`，未重启容器，容器仍为 `healthy`。
- 验证结果：本地与容器内相关 JS `node --check` 通过；HTTP 验证 `/canvas` 已引用 `index-DglIsp_g.js?v=20260704inputlag1`，线上 Canvas 包命中 `promptSaveTimer=setTimeout`，旧的立即写节点片段不再存在；`/api/health` 正常。
- 未覆盖风险：未做浏览器录屏级性能验证；需要用户强刷生产端 `/canvas` 后实测输入延迟。

## 2026-07-04 旧画布拖拽延迟性能评审

- 触发背景：用户反馈修复输入框后，拖动节点也出现延迟，要求整体评审旧画布中影响操作手感的高频逻辑和循环。
- 本轮范围：只读评审，未修改画布运行代码；检查了 CodeGraph、旧 Canvas 主包、性能过渡层、图片节点美化脚本和聊天提示词桥接脚本。
- 主要结论：当前最高风险是 `canvas-performance-mode.js` 在全局捕获 `pointermove` 时每帧执行目标判断和激活逻辑，并配合 `canvas-performance-mode.css` 的大范围 `html.canvas-performance-dragging ... *`、`will-change` 和 `:has()` 选择器造成样式重算压力。
- 次要风险：`canvas-chat-prompt-flow.js` 和 `canvas-image-node-polish.js` 仍然在 `document.documentElement` 上观察子树变化，虽已过滤，但 `html/body` class 切换、图片节点 class 变化和面板变化仍可能调度刷新。
- 旧包结构风险：图片节点可见性计算会在每个图片节点里扫描全局节点数组查找自己，节点多时接近 O(N²)；框选逻辑在 `pointermove` 中扫描所有 `.vue-flow__node[data-id]` 并读取 `getBoundingClientRect()`；历史快照和批量移动会完整 JSON 克隆节点和边。
- 建议处理顺序：先停用或节流性能层的 `pointermove` 激活，再收窄拖拽态 CSS，随后处理图片节点可见性 O(N²) 与全站 MutationObserver。

## 2026-07-04 Docker 生产测试容器重启

- 触发背景：用户要求重新 Docker，以便生产测试端重新加载当前容器进程。
- 执行内容：对现有 `dianshang-internal-app` 容器执行重启，未重建镜像，未触发真实生图和扣费调用。
- 验证结果：容器回到 `running healthy`；`/api/health` 返回 `success: true`、数据库正常、真实 Provider 配置仍为 ready；`/canvas` 仍命中 `20260704inputlag1` 与 `20260704flicker1`；线上 Canvas 包仍包含 `promptSaveTimer=setTimeout`，旧逐字立即写回片段不存在。
- 未覆盖风险：本轮只是容器重启，不是 `docker compose build` 级重建；如果后续需要验证镜像从源码完整构建，需要单独执行 rebuild。

## 2026-07-04 后台根入口跳转修复

- 触发背景：用户反馈 `/admin` 自动跳到首页，找不到后台登录入口。
- 问题结论：旧后台资产已清理，问题不是旧后台回流；源码后台 Vue Router 缺少 `/admin` 根路由，访问 `/admin` 时命中通配路由并重定向到 `/`。
- 修复内容：`frontend/src/router/index.ts` 新增 `/admin -> /admin/login` 重定向；`frontend/src/config/frontendMigration.ts` 纳入后台根入口；`scripts/smoke-internal-prod.ps1` 增加 `/admin` 根入口静态资源检查。
- 验证结果：`npm run check:routes --prefix "F:\dianshang\frontend"` 通过，`scripts/smoke-internal-prod.ps1` 语法检查通过，`npm run build --prefix "F:\dianshang\frontend"` 通过。
- Docker 结果：已执行 `docker compose -f "F:\dianshang\docker\docker-compose.yml" up -d --build --force-recreate app`，容器回到 `healthy`；`scripts/smoke-internal-prod.ps1` 通过；Chrome headless 访问 `http://192.168.0.39:3456/admin` 已渲染 `后台登录`，不再进入首页。

## 2026-07-04 首页云端保存入口 chunk 同步修复

- 触发背景：用户截图反馈首页“保存方式”弹层选择云端自动保存后，点击“立即保存”仍提示“主页暂无云端手动保存入口，请进入画布保存当前工作流”。
- 问题结论：不是用户操作问题，也不是只修在 Docker 没同步到 main；根因是旧首页打包资产同时存在两份 `HomeIndex` chunk，当前入口 `assets/index-DglIsp_g.js` 实际加载 `assets/HomeIndex-DAjDt0aj.js`，而之前已修复的逻辑在另一份 `assets/HomeIndex-BtiJ9toc.js`。
- 修复内容：将 `assets/HomeIndex-DAjDt0aj.js` 的云端“立即保存”逻辑同步为跳转画布保存：优先进入最近项目 `/canvas/:id`，没有项目时新建画布；同时将 `index.html` 与 `assets/index-DglIsp_g.js` 的资源 query 升级为 `20260704homesave1`，降低浏览器继续命中旧包的概率。
- 验证结果：本地 `node --check` 通过；本地活跃入口三件套中已不存在“主页暂无云端手动保存入口”，并包含“已进入画布，请在画布顶部保存面板点击立即保存”或“已新建画布，请在画布顶部保存面板点击立即保存”提示。
- Docker 结果：已执行 `docker compose -f "F:\dianshang\docker\docker-compose.yml" up -d --build --force-recreate app`，镜像 `dianshang-internal-app:latest` 重新创建并启动，容器状态为 `healthy`。
- 线上结果：`http://192.168.0.39:3456/` 返回的 HTML 已引用 `index-DglIsp_g.js?v=20260704homesave1`；线上入口 JS 已引用 `HomeIndex-DAjDt0aj.js?v=20260704homesave1`；线上首页 chunk 不再包含旧提示，并包含进入/新建画布保存提示。
- 未覆盖风险：首页弹层仍然存在；本轮只修云端“立即保存”的错误提示与跳转行为。已经打开过首页的浏览器可能缓存旧 JS，需要强刷后再测。

## 2026-07-04 生产单系统静态资源隔离

- 触发背景：用户要求当前按生产状态修复，只保留一套系统，旧包、旧入口和不需要的东西不能再冒出来。
- 问题结论：`server.js` 原先通过 `express.static(__dirname)` 暴露整个项目根目录，旧入口 `index-ZrBcanD1.js`、旧首页 `HomeIndex-BtiJ9toc.js` 和已清理后台旧包即使不被当前入口引用，也仍可能被旧缓存 URL 直接请求；缺失的 `/assets/*` 还会落到 SPA fallback，风险是旧前端状态和当前生产入口混在一起。
- 修复内容：`server.js` 改为只显式开放 `public`、根 `assets`、源码后台 `frontend/dist/assets`、`videos` 和 `uploads`；新增旧生产资产隔离列表，旧入口/旧首页/旧后台包请求返回 `410 LEGACY_ASSET_GONE`；未知 `/assets/*` 返回 `404 Asset not found`，不再 fallback 到首页。
- 入口收敛：同步修正 `assets/index-DglIsp_g.js` 中真实动态 import 的 `HomeIndex-DAjDt0aj.js` query，移除残留的 `20260702modelsync1`，统一为 `20260704homesave1`。
- 验证结果：`node --check "F:\dianshang\server.js"` 与 `node --check "F:\dianshang\assets\index-DglIsp_g.js"` 通过；增强后的 `scripts/smoke-internal-prod.ps1` 通过，包含旧入口 410、旧首页 410、旧后台包 410、未知 assets 404 和 `server.js` 不暴露源码检查。
- Docker 结果：已完整重建 `dianshang-internal-app:latest` 并强制重建容器，当前 3456 服务为 `healthy`；线上 `http://192.168.0.39:3456/assets/index-ZrBcanD1.js`、`/assets/HomeIndex-BtiJ9toc.js`、`/assets/AdminLayout-BHNDJhhH.js` 均返回 410。
- 未覆盖风险：旧文件暂未物理删除，只在生产静态服务层隔离；这样可以避免误删当前未识别依赖，后续确认一段时间无访问后再做文件归档或删除。

## 2026-07-04 main 与 Docker 生产端同步规则固化

- 触发背景：用户要求以后 `main`、Docker 和生产端同步更新，并写入 `AGENTS.md`。
- 完成内容：`AGENTS.md` 新增“生产端 main/Docker 同步规则”，明确当前生产修复必须以 `F:\dianshang` 为唯一源码基线；禁止只热修 Docker 或只改旧参考目录；影响线上行为的改动必须完整执行 Docker build + force recreate；生产验收必须直接请求 `http://192.168.0.39:3456/` 或目标线上路径。
- 规则补充：要求记录镜像 ID、镜像创建时间、容器启动时间或等价信息；涉及旧入口/旧 chunk/旧后台包时必须验证 410/404；最终汇报必须同时说明 main 文件、Docker 重建状态、3456 验证结果和浏览器缓存风险。
- 验证结果：本轮为文档规则更新，`git diff --check` 通过，仅有 Git 换行提示；`AGENTS.md`、`docs/progress-report.md`、`docs/review-log.md` 均确认 UTF-8 无 BOM。

## 2026-07-04 进入画布旧节点自动刷新修复

- 触发背景：用户反馈进入画布后，必须先点击一个节点，旧画布节点才会整体刷新。
- 问题结论：旧 Canvas 运行包已有 `key: qe.value` 的 Vue Flow 强制重挂机制，但 `kl()` 在加载项目开始前刷新了一次 key，项目节点数据真正写入 `Ge.value` / `$t.value` 后没有再刷新；因此节点内部尺寸、边线和图片节点状态需要等用户点击节点后才被 Vue Flow 重新计算。
- 修复内容：`assets/Canvas-B8bY9_QL.js` 新增 `refreshCanvasAfterProjectLoad()`，项目/工作流加载完成后在当前帧和 160ms 后更新 Vue Flow key，并派发 `resize` 事件，覆盖普通进入项目、路由切换、导入本地工作流和 pending payload 恢复后的刷新时序。
- 缓存处理：`index.html` 主入口版本升为 `20260704canvasrefresh1`；`assets/index-DglIsp_g.js` 中 Canvas 动态 import 版本升为 `Canvas-B8bY9_QL.js?v=20260704canvasrefresh1`。
- 验证结果：本地 `node --check "F:\dianshang\assets\Canvas-B8bY9_QL.js"` 与 `node --check "F:\dianshang\assets\index-DglIsp_g.js"` 通过；静态检查确认 Canvas 包包含 `refreshCanvasAfterProjectLoad` 和 `window.dispatchEvent(new Event("resize"))`，入口不再引用 `20260704inputlag1`。
- Docker 结果：已执行 `docker compose -f "F:\dianshang\docker\docker-compose.yml" up -d --build --force-recreate app`，镜像 `sha256:d3ba3701598d2e7a5efa24567a4e0da30ff8198c257967122c489b2183ab2042` 于 `2026-07-04T09:20:40Z` 创建，容器 `dianshang-internal-app` 于 `2026-07-04T09:20:48Z` 启动并为 `healthy`。
- 线上结果：`http://192.168.0.39:3456/` 返回 200 且引用 `index-DglIsp_g.js?v=20260704canvasrefresh1`；线上入口 JS 引用 `Canvas-B8bY9_QL.js?v=20260704canvasrefresh1`；线上 Canvas 包包含 `refreshCanvasAfterProjectLoad` 和 `window.dispatchEvent(new Event("resize"))`；旧 `Canvas-yGc8b2gf.js` 返回 410。
- 未覆盖风险：本轮先以静态断言和线上资源命中验证为主，浏览器内旧页面仍需强刷后进入已有项目实际观察节点是否无需点击即可刷新。

## 2026-07-04 图片节点拖拽卡顿优化

- 触发背景：用户反馈拖动图片节点时有延迟卡顿，并询问是否由顶部工具条导致。
- 判断结论：全局顶部栏不是主要嫌疑；图片节点上方浮动工具条、图片节点美化 CSS 的大量 `:has()` 选择器、拖拽期间的全局 `pointermove` 性能层和图片节点 MutationObserver 才是高概率卡顿来源。
- 修复内容：`canvas-performance-mode.js` 将拖拽中的 `pointermove` 从每帧 `closest()` + 重置 class/timer 改为 pointerdown 锁定拖拽态，并 80ms 节流延长 active 状态；`canvas-image-node-polish.js` 在拖拽期间延迟图片节点 class/title 扫描，松手后再补一次；`canvas-performance-mode.css` 在拖拽期间临时隐藏图片节点浮动工具条、关闭相关动画、阴影和 backdrop-filter。
- 缓存处理：`index.html` 将 `canvas-performance-mode.js/css` 与 `canvas-image-node-polish.js/css` query 升为 `20260704dragperf1`。
- 验证结果：`node --check` 已通过；`scripts/smoke-internal-prod.ps1` 语法检查通过；静态检查确认 HTML 命中新 query，性能层包含 `draggingPointerActive` / `extendActive`，图片美化层包含 `pendingDragRoot`，CSS 包含拖拽时隐藏图片工具条规则。
- Docker 结果：已执行 `docker compose -f "F:\dianshang\docker\docker-compose.yml" up -d --build --force-recreate app`，镜像 `sha256:43a0fe8f23119b7ec948823f3daa900ff26105eb2cc3d3b31595b50948fe34aa` 于 `2026-07-04T09:31:22Z` 创建，容器 `dianshang-internal-app` 于 `2026-07-04T09:31:30Z` 启动并为 `healthy`。
- 线上结果：`scripts/smoke-internal-prod.ps1` 通过，验收地址为 `http://192.168.0.39:3456`；直接请求线上首页确认命中 `20260704dragperf1`，线上性能脚本包含 `draggingPointerActive` / `extendActive`，线上图片美化脚本包含 `pendingDragRoot`，线上 CSS 包含拖拽时隐藏图片节点工具条规则。
- 未覆盖风险：本轮没有引入浏览器性能 trace 工具，尚未做帧率录制级量化；上线后需用户强刷进入已有画布，重点拖动已选中、有浮动工具条的图片节点观察手感。

## 2026-07-04 用户中心打开卡顿隔离修复

- 触发背景：用户反馈打开用户中心仍然卡顿。
- 问题结论：前一轮只优化了画布拖拽，但 `index.html` 仍全站加载画布专用 JS；其中 `canvas-performance-mode.js`、`canvas-image-node-polish.js` 和 `canvas-chat-prompt-flow.js` 会安装 document 级事件监听或 MutationObserver。用户中心不是画布页面，不应该承担这些画布辅助脚本的运行成本。
- 修复内容：三个画布辅助 JS 均新增 `/canvas` 路由闸门和 SPA 路由监听；非画布页只保留轻量路由检查，不安装图片扫描、聊天面板刷新、拖拽监听和全页 observer；从用户中心点击进入画布时会自动安装，不需要刷新。
- 缓存处理：`index.html` 将三个画布辅助 JS query 升为 `20260704canvasisolate1`。
- 验证结果：`node --check` 已通过；`scripts/smoke-internal-prod.ps1` 语法检查通过；静态检查确认 HTML 命中 `20260704canvasisolate1`，三个脚本均包含 `isCanvasPage` / `watchCanvasRoute` / `installed` 隔离逻辑。
- Docker 结果：已执行 `docker compose -f "F:\dianshang\docker\docker-compose.yml" up -d --build --force-recreate app`，镜像 `sha256:0bb106db16090c45b53768e1ca5a4efbdaf6a2c226fb48598ced98b4336760e6` 于 `2026-07-04T09:37:28Z` 创建，容器 `dianshang-internal-app` 于 `2026-07-04T09:37:36Z` 启动并为 `healthy`。
- 线上结果：`scripts/smoke-internal-prod.ps1` 通过，验收地址为 `http://192.168.0.39:3456`；直接请求 `/user/center` 返回 200；线上首页命中 `20260704canvasisolate1`；线上三个画布辅助 JS 均包含路由闸门，不会在用户中心直接安装重监听和 observer。
- 未覆盖风险：本轮未做 Chrome Performance trace；用户中心仍有自身 Vue chunk、用户资料接口和 `user-center-data-bridge.js`，如果强刷后仍卡，需要继续采样用户中心自身渲染和接口耗时。

## 2026-07-04 全局脚本页面性能护栏固化

- 触发背景：用户要求把用户中心卡顿暴露出的护栏写入 `AGENTS.md` 和日志，避免后续修画布时再次拖慢非画布页。
- 完成内容：`AGENTS.md` 新增“全局脚本与页面性能护栏”，明确画布专用脚本即使被 `index.html` 引用，也只能在 `/canvas` 安装重逻辑；非画布页只允许轻量路由监听，不允许安装全页 observer、高频事件监听、图片扫描、聊天面板刷新或拖拽状态逻辑。
- 验收要求：新增或修改全局脚本、全局 CSS、`index.html` 静态引用、SPA fallback 和路由守卫时，必须评估首页、用户中心、后台和画布四类页面；`/user/center` 作为非画布性能基线页，不能触发画布图片节点扫描、聊天面板扫描、拖拽监听、自动保存节流或节点刷新逻辑。
- 验证要求：涉及画布性能脚本的生产改动，`scripts/smoke-internal-prod.ps1` 必须覆盖资源 query、`/canvas` 路由闸门、旧资源 410/404 和 `/user/center` 线上命中；若仍卡顿，下一步必须采样 Chrome Performance trace 或等价指标再继续优化。
- 验证结果：本轮为文档护栏更新；后续执行 `git diff --check` 与 UTF-8 无 BOM 检查。

## 2026-07-04 画布跳转用户中心延迟修复

- 触发背景：用户反馈“画布点开用户中心还是有延迟”。
- 问题结论：上一轮只解决了非画布页首次打开时不安装画布脚本，但从 `/canvas` 进入后，三个画布辅助 JS 已经安装了 document 监听和 MutationObserver；SPA 跳到 `/user/center` 时没有 teardown，所以监听器和 observer 继续留在用户中心。
- 修复内容：`canvas-performance-mode.js` 新增 `teardownPerformanceMode()`，离开 `/canvas` 时移除 wheel/pointer/touch 监听、断开图片 observer、清理 timer 和 `canvas-performance-*` class；`canvas-image-node-polish.js` 新增 `teardownImageNodePolish()`，离开画布时断开图片节点 observer、移除 load/dblclick/pointer 监听并清理扫描 timer；`canvas-chat-prompt-flow.js` 新增 `teardownChatPromptFlow()`，离开画布时移除 click/keydown/change 监听、断开聊天面板 observer、清理提示刷新 timer 和全局对象。
- 缓存处理：`index.html` 将三个画布辅助 JS query 升为 `20260704canvasleave1`。
- 验证结果：`node --check` 已通过；`scripts/smoke-internal-prod.ps1` 语法检查通过；静态检查确认三个脚本均包含 teardown 函数、`removeEventListener` 和 `observer.disconnect`，HTML 命中 `20260704canvasleave1`。
- 护栏补充：`AGENTS.md` 已补充“画布专用脚本必须支持路由离开时 teardown”，禁止只做首次进入闸门而把已安装监听器留在非画布页。
- Docker 结果：已执行 `docker compose -f "F:\dianshang\docker\docker-compose.yml" up -d --build --force-recreate app`，镜像 `sha256:0e0be95837004310eca0afb65115cf9807b2e07e51276a4b4f76d105744e5b1e` 于 `2026-07-04T09:53:26Z` 创建，容器 `dianshang-internal-app` 于 `2026-07-04T09:53:34Z` 启动并为 `healthy`。
- 线上结果：`scripts/smoke-internal-prod.ps1` 通过，验收地址为 `http://192.168.0.39:3456`；直接请求 `/user/center` 返回 200；线上首页命中 `20260704canvasleave1`；线上三个画布辅助 JS 均包含路由离开 teardown、`removeEventListener` 和 `observer.disconnect`。
- 未覆盖风险：本轮仍未做真实浏览器 Performance trace；上线后需要从画布点击用户中心复测路径，若仍延迟再继续采样用户中心自身脚本和接口。

## 2026-07-04 画布内用户中心弹层延迟修复

- 触发背景：用户新截图显示点击的是画布右上角圆形 AI/头像按钮，随后在画布上方打开“用户中心”弹层；这不是跳转到 `/user/center` 独立路由。
- 问题结论：该路径仍停留在 `/canvas`，所以前一轮路由离开 teardown 不会触发。用户中心弹层打开时，背后 Vue Flow 画布、图片节点、minimap、聊天面板、浮动工具条和 backdrop blur 仍会一起参与合成与重绘，是延迟的高概率来源。
- 修复内容：`assets/Canvas-B8bY9_QL.js` 在用户中心弹层状态 `pe.value` 打开时同步 `html/body.canvas-user-center-open`，关闭和组件卸载时清理；打开按钮点击时立即打状态 class，减少首次弹出前的等待。
- 性能处理：`assets/canvas-performance-mode.css` 新增 `canvas-user-center-open` 规则，弹层打开期间关闭背后画布的常驻 `will-change`、backdrop blur、动画和过渡，并隐藏聊天面板、minimap、背景网格、图片节点浮动工具条等不需要透出的高成本层。
- 缓存处理：`index.html` 主入口 query 升为 `20260704usercenter1`，`assets/index-DglIsp_g.js` 中 Canvas 动态 import query 升为 `Canvas-B8bY9_QL.js?v=20260704usercenter1`，`canvas-performance-mode.css` query 同步升为 `20260704usercenter1`。
- 护栏补充：`AGENTS.md` 已新增“画布内大弹层不会触发路由 teardown，必须显式降负载”的规则；`scripts/smoke-internal-prod.ps1` 已新增 Canvas 包状态 class 和 CSS 降 backdrop 断言。
- 验证结果：`node --check "F:\dianshang\assets\Canvas-B8bY9_QL.js"`、`node --check "F:\dianshang\assets\index-DglIsp_g.js"` 和 smoke 脚本语法检查通过；本地静态检查确认 Canvas 包包含 `codexSetUserCenterOpen` / `canvas-user-center-open`，CSS 包含 `html.canvas-user-center-open` 与 `backdrop-filter: none`。
- Docker 结果：已执行 `docker compose -f "F:\dianshang\docker\docker-compose.yml" up -d --build --force-recreate app`，镜像 `sha256:2627a4c03e9b14a2fcc15f8d13784b1688c8c3d6c09c952ebe0e19f6e5f95508` 于 `2026-07-04T10:02:18Z` 创建，容器 `dianshang-internal-app` 于 `2026-07-04T10:02:25Z` 启动并为 `healthy`。
- 线上结果：`scripts/smoke-internal-prod.ps1` 通过，验收地址为 `http://192.168.0.39:3456`；直接请求线上首页确认命中 `20260704usercenter1`；线上入口引用新版 Canvas 包；线上 Canvas 包包含用户中心弹层状态 helper/class；线上 CSS 包含弹层打开时降 backdrop 和降画布重绘规则；`/user/center` 返回 200。
- 未覆盖风险：本仓库没有 Playwright，当前会话也没有可用浏览器控制工具，本轮未做真实点击帧率 trace；请在浏览器强刷后按“进入画布 -> 点右上角 AI/头像用户中心”复测，若仍有明显延迟，下一步应采样 Chrome Performance trace，重点看弹层组件自身渲染和接口耗时。

## 2026-07-07 图生图中转尺寸解析修复

- 触发背景：生产测试中，画布图片生成节点选择 1:1 和 1K，并连接一张 `436x659` 参考图后，返图为约 `1023x1537`，几乎沿用了参考图竖版比例。
- 问题结论：当前请求有参考图时走 `/images/edits` 上传链路，不是纯文生图 JSON；前端保存/发送的比例值为 `1x1`，后端 `providerImageSize()` 原先先匹配 `^\d+x\d+$`，把 `1x1` 当作 1 像素尺寸，再按最小像素规则放大成 `816x816`，不是预期的 `1024x1024`。
- 修复内容：`server.js` 新增 `parseExplicitImageSize()`，只有真实像素尺寸如 `1024x1024` 才走显式尺寸；`1x1`、`3x4`、`16x9` 这类小数字 `x` 写法统一按比例解析。
- 诊断增强：生成任务响应现在会返回不含密钥的 `request/providerRequest` 摘要，包含 model、size、quality、输出格式、参考图数量和上传字段名，便于下一次在浏览器 Network 中核对实际传给中转的字段。
- 验证结果：`node --check "F:\dianshang\server.js"` 通过；`node "F:\dianshang\scripts\check-packy-gpt-image-size.js"` 通过 54 个尺寸映射用例，确认 `1x1 -> 1024x1024`；`node "F:\dianshang\scripts\check-packy-gpt-image-adapter-coverage.js"` 通过。
- 本地运行：已重启 `http://127.0.0.1:3458`，健康接口为 `real-provider-ready`，AI Key 已配置；本轮未再次触发真实生图调用。
- 未覆盖风险：尚未做新的真实扣费生图验收；如果下一次真实生图仍返回参考图比例，需要继续检查 Packy 对 `/images/edits` 单图上传字段 `image`/`image[]`、`response_format` 和模型侧尺寸约束的兼容性。

### 2026-07-07 追加：图生图输出画布约束

- 用户复测后仍出现约 `1021x1541` 竖图，说明后端已可把 `1x1 + 1K` 转成 `1024x1024`，但 Packy `/images/edits` 带参考图链路仍可能沿用参考图原始比例。
- 边界澄清：画布业务层仍只保留“比例 + 清晰度”；后端适配层负责把它转成 provider `size` 字段。该 `size` 字段必须随 multipart 上传给中转，因为它是 provider 的输出尺寸参数，不是参考图自身尺寸。
- 修复内容：`buildEcommerceImagePrompt()` 增加输出画布要求，明确写入“最终图片必须是 1:1 画布，目标尺寸 1024x1024，不要沿用参考图原始宽高比例；需要时用干净背景、留白或场景扩展适配画布”。
- 验证结果：`node --check "F:\dianshang\server.js"`、Packy 尺寸映射检查和适配器覆盖检查均通过；本地生成的最终提示词已确认包含 `目标尺寸 1024x1024`；3458 已重启为最新代码。

### 2026-07-07 追加：Packy 官方接口实例对齐

- 用户提供 Packy 官方 GPT-Image-2 文档链接和 `/v1/images/edits` curl 示例后，复核确认运行时请求适配器没有使用旧 JSON 图片编辑形态；当前图生图真实请求为 `multipart/form-data`，字段为 `model/prompt/image/size/quality/output_format/response_format/n/input_fidelity`。
- 发现问题：运行数据库 `admin.apiProviders` 中 GPT Image 2 的旧 `requestExamples` 仍包含 `application/json ? multipart/form-data` 和 `images: [{ image_url }]` 形态，容易让后台接口实例展示误导生产排查。
- 修复内容：源码默认接口实例和运行数据库示例统一为 Packy 官方形态：文生图 `POST /v1/images/generations` JSON；图生图 `POST /v1/images/edits` multipart；图生图示例保留 `quality`、`output_format=png`、`response_format=url`、`input_fidelity=high` 等 Packy 字段。
- 适配器修正：图片请求头补充 `Accept: */*`，对齐 Packy curl 示例。
- 验证结果：后台数据库只读复核显示 GPT Image 2 两个请求示例已为 `/v1/images/generations` 与 `/v1/images/edits`；`node --check`、Packy 尺寸映射检查和适配器覆盖检查均通过；3458 已重启。

### 2026-07-07 追加：清晰度到 Packy quality 三档映射

- 用户确认 UI `1K / 2K / 4K` 不是统一发 `high`，而是对应 Packy `quality` 三档。
- 修复内容：`providerImageQuality()` 改为结合清晰度档位派生质量：`1K -> low`、`2K -> medium`、`4K -> high`；同时继续用同一个清晰度档位换算 `size`。
- 验证结果：无扣费 dry-run 确认 `1K -> size 1024x1024 + quality low`、`2K -> 2048x2048 + medium`、`4K -> 2880x2880 + high`；`node --check`、Packy 尺寸映射检查和适配器覆盖检查均通过；3458 已重启。

### 2026-07-07 追加：图片生成节点移除旧长约束

- 触发背景：用户反馈图片生成节点“只是返回原图”，要求把原来的长约束全部删掉，并且只针对图片生成节点处理。
- 问题结论：图片生成节点走 `/api/generate/tasks`，原先复用 `buildEcommerceImagePrompt()`，会自动追加 Prompt Planner、保持主体结构、避免问题、输出要求等长约束，容易让 GPT Image 2 把任务理解成“尽量复刻原图并轻微重排”。
- 修复内容：新增 `buildImageGenerateNodePrompt()`，`/api/generate/tasks` 只使用节点里用户输入的原始提示词；当提示词为空但有参考图时仅使用最短 fallback `根据参考图生成图片`。对话 Agent、套图 Agent、模板生成仍保留各自原有 prompt 构造。
- 验证结果：无扣费 dry-run 确认 `把图1的产品生成拼多多电商主图` 最终仍为原句，不再包含旧长约束；`node --check`、Packy 尺寸映射检查和适配器覆盖检查均通过；3458 已重启。

## 2026-07-07 用户中心官转线路显示修复

- 触发背景：用户反馈画布用户中心“API 线路”只显示 `GPT Image 2`，后台已有另一条 `官转gpt-img2 / lignsuan-guanzhuan`。
- 问题结论：生产公开接口 `/api/public/routes` 已返回两条图片线路，缺口在用户中心抽屉的前端线路加载链路；同时 `ImageHistoryPanel` 动态 chunk 未带 query，存在浏览器继续使用旧缓存的风险。
- 修复内容：`ImageHistoryPanel-Dy2o3dPV.js` 和兼容包 `ImageHistoryPanel-Cu4Brucb.js` 在加载用户线路时合并 `/user/routes` 与 `/public/routes` 并按线路 id 去重；加载线路模型时若 `/user/models` 为空或失败，回退 `/public/models`。
- 缓存处理：`index.html`、`assets/index-DglIsp_g.js`、`assets/index-ZrBcanD1.js`、`assets/Canvas-B8bY9_QL.js` 和 `assets/Canvas-yGc8b2gf.js` 的入口、Canvas 和用户抽屉 chunk query 升为 `20260707route1`。
- 验证结果：`node --check` 已覆盖活动入口、活动 Canvas、兼容 Canvas 和两个用户抽屉 chunk；静态断言确认用户抽屉包含公开线路和公开模型兜底；UTF-8 无 BOM 检查通过；`git diff --check` 无空白错误，仅有既有 CRLF 提示。
- Docker 结果：已执行 `docker compose -f "F:\dianshang\docker\docker-compose.yml" up -d --build --force-recreate app`，镜像 `sha256:d141e4ebbbf94cd339d14246e8e2e8ac5210fd60547166471847e1b38c7cd2e1` 于 `2026-07-07T06:34:45Z` 创建，容器 `dianshang-internal-app` 于 `2026-07-07T06:34:55Z` 启动并为 `healthy`。
- 线上结果：`scripts/smoke-internal-prod.ps1` 通过；直接请求 `http://192.168.0.39:3456/` 确认命中 `index-DglIsp_g.js?v=20260707route1`，入口命中 `Canvas-B8bY9_QL.js?v=20260707route1`，Canvas 命中 `ImageHistoryPanel-Dy2o3dPV.js?v=20260707route1`；公开线路和模型接口确认 `lignsuan-guanzhuan` 与 `GPT Image 2` 可用。
- 未覆盖风险：本轮未使用真实用户 token 做 `/api/user/routes` 抓包，也未做浏览器点击截图；如果用户浏览器仍显示旧卡片，优先强刷或清缓存后再复测画布右上角用户中心。

## 2026-07-07 本地 3458 官转线路加载同步

- 触发背景：生产测试画布继续排查生图链路时，用户要求先把“官转线路”加载出来，避免继续在旧线路名、后台示例和画布节点之间混淆。
- 处理内容：`server.js` 默认图像线路名改为 `GPT Image 2 官转`，文本线路名改为 `GPT 5.5 官转`；运行数据库 `admin.apiProviders` 同步为相同显示名，保留已有 API Key，不打印密钥。
- 当前线路：图像线路 `pub_route_openai_gpt_image_2 / route_openai_gpt_image_2`，端点 `POST /v1/images/generations`，图生图端点 `POST /v1/images/edits`，默认模型 `gpt-image-2`；文本线路 `pub_route_openai_gpt_5_5 / route_openai_gpt_5_5`，端点 `POST /responses`，默认模型 `gpt-5.5`。
- 验证结果：`node --check "F:\dianshang\server.js"` 通过；`http://127.0.0.1:3458/api/model-routes?group=image` 已返回 `GPT Image 2 官转` 且 `hasApiKey=true`；`group=text` 已返回 `GPT 5.5 官转` 且 `hasApiKey=true`；`/api/user/api-status` 也返回 `GPT Image 2 官转`。
- 未覆盖风险：本轮只同步本地 3458 生产测试线路，未执行真实扣费生图，也未重建 3456 Docker 生产端。

### 2026-07-07 追加：中转上传字段兼容试改

- 触发背景：用户提供外部解包出的 New API / OpenAI 兼容图片接口格式，指出图生图上传应通过 multipart `image` 文件字段传参考图，补充 `background=auto`、`moderation=auto` 等参数。
- 修复内容：`callProviderImageEdit()` 多参考图上传从 `image[]` 改为重复追加 `image` 字段；文生图和图生图统一补 `background=auto`、`moderation=auto`；request 摘要新增 `endpoint`、`background`、`moderation`、`referenceImageField=image` 和 `referenceImageFieldMode`。
- 后台同步：运行数据库 `admin.apiProviders` 中 GPT Image 2 的请求示例已同步为新字段，保留已有 API Key 且不打印密钥。
- 验证结果：`node --check "F:\dianshang\server.js"` 通过；`node "F:\dianshang\scripts\check-packy-gpt-image-adapter-coverage.js"` 通过；`node "F:\dianshang\scripts\check-packy-gpt-image-size.js"` 通过 54 个尺寸映射用例。
- 未覆盖风险：本轮仍未开启 `?async=true` 上游任务模式，也未执行真实扣费生图；是否改善“返回原图/白底图”需要用户在 3458 复测。

### 2026-07-07 追加：用户中心恢复两条图片路线

- 触发背景：用户截图显示后台 API 线路共有 3 条，其中图片路线为 `GPT Image 2` 和 `官转gpt-img2 / lignsuan-guanzhuan`，但用户中心只显示 `GPT Image 2 官转`。
- 问题结论：当前 3458 运行数据库 `admin.apiProviders` 只剩 1 条 image 路线和 1 条 text 路线；用户中心前端虽然会读取公开线路兜底，但后端没有返回第二条 image 路线。
- 修复内容：`server.js` 默认路线新增 `pub_route_mr5yltmuc7edcb2b / lignsuan-guanzhuan`；当前 `data.db` 从 `docker/data/data.db` 恢复 `官转gpt-img2` 路线及其本地 API Key，保留脱敏输出。
- 验证结果：`/api/model-routes?group=image` 与 `/api/public/routes?group=image` 均返回 2 条图片路线：`GPT Image 2 官转`、`官转gpt-img2`；`/api/public/models?routeId=pub_route_mr5yltmuc7edcb2b` 返回 `GPT Image 2` 模型；3458 已重启并刷新当前画布页。
- 未覆盖风险：本轮只恢复本地 3458 用户中心路线选择，没有执行真实扣费生图，也没有同步 3456 Docker 生产端。

## 2026-07-07 生图任务刷新恢复

- 触发背景：用户反馈图片生成节点提交后，如果前端刷新，生图结果节点无法继续加载；期望后台先持有任务，前端无图时保持 90% 等待，后台拿到图片后前端继续回填。
- 问题结论：旧画布前端已经按“提交任务 -> taskId -> 轮询 `/api/generate/tasks/:id`”设计，但后端 `/api/generate/tasks` 之前同步等待上游返回后才创建 taskId，刷新发生在等待窗口内时前端拿不到可恢复的任务 id。
- 后端修复：`/api/generate/tasks` 改为立即创建 `running/progress=90` 的 pending task 并 `202` 返回 `taskId`，上游生图在后台继续执行；完成后更新内存 task、生成记录和扣费日志，失败时更新为 `failed` 并保留错误信息。
- 前端修复：图片生成节点的进度回调会把 `taskId/sourceTaskId/taskImageIndex` 写入结果图片节点并立即保存；图片节点新增刷新恢复轮询，若加载到 `taskId` 且还没有 `url`，会继续查后台任务，成功后回填图片 URL，失败后显示错误。
- 缓存处理：`index.html` 入口 query 升为 `20260707taskresume1`，两个 index chunk 的 Canvas 动态 import query 同步升为 `20260707taskresume1`。
- 验证结果：临时 3462 mock 服务使用临时数据库和 `ENABLE_REAL_AI=false` 验证通过，`POST /api/generate/tasks` 45ms 返回 `202/running/progress=90/taskId`，随后 `GET /api/generate/tasks/:id` 返回 `success/progress=100/1 张图片`；`node --check` 覆盖 `server.js`、两份 Canvas bundle 和两份 index chunk；3458 已重启并命中新入口、Canvas query。
- 未覆盖风险：本轮没有在真实中转上触发扣费生图，只验证任务生命周期与刷新恢复链路；如果真实上游耗时很长，刷新恢复依赖 3458 后端进程持续运行，后端重启后内存 task 仍会丢失，后续可再落库持久化任务。

### 2026-07-07 追加：生图进度条抖动修复

- 触发背景：用户测试时看到结果图片节点进度条在“模型生成中 54%”和“等待返回结果 90%”之间跳动，表现为两个结果节点进度不稳定。
- 问题结论：图片生成节点提交任务后，新的后台任务已返回 `taskId/progress=90`，但旧前端模拟进度定时器仍在继续刷 `54%/60%` 等阶段，两个进度源互相覆盖。
- 修复内容：旧画布 `Dg()` 在拿到 `taskId` 后立即停止模拟进度定时器，再进入后台任务 90% 等待和轮询；入口与 Canvas 动态 import query 升为 `20260707taskresume2`。
- 验证结果：两份 Canvas bundle 均通过 `node --check`；静态断言确认提交 taskId 后存在 `w(),b(Math.max(90`，3458 首页和 Canvas 资源命中 `taskresume2`。

### 2026-07-07 追加：刷新后红态丢恢复修复

- 触发背景：用户刷新后，两个结果图片节点显示“上次生成未完成，已停止自动恢复”，没有继续加载后台已完成图片。
- 问题结论：项目加载/保存清洗层 `projects-*.js` 会把没有 URL 的图片节点 `taskId` 删除，并写入 interrupted error；本轮恢复逻辑因此无法运行。当前项目中这两个节点只剩 `sourceTaskId=task_mradlsmaa4486ee3`，后台 task 实际仍为 `success` 且已有 2 张图片。
- 修复内容：`projects-BtxGnToV.js` 与兼容包 `projects-eqk9JplQ.js` 对图片节点保留恢复态；若有 `sourceTaskId` 但无 `taskId`，加载时补回 `taskId`、恢复 `loading/progress/progressLabel` 并清空旧 error。`ImageNode` 恢复轮询同时使用 `taskId || sourceTaskId`，等待和成功时都会清掉红色 error。
- 缓存处理：Canvas 静态 import 的 projects chunk 增加 `?v=20260707taskresume3`，入口和 Canvas 动态 import query 同步升为 `20260707taskresume3`。
- 验证结果：`node --check` 覆盖两份 projects chunk、两份 Canvas bundle 和两份 index chunk；3458 首页、Canvas 和 projects chunk 均命中 `taskresume3`；用当前项目用户签发短 token 查询 `task_mradlsmaa4486ee3` 返回 `success/progress=100/2 张图片`。

### 2026-07-07 追加：图片加载阶段保持生图 UI

- 触发背景：用户反馈任务完成回填图片 URL 时，结果节点会先缩成长条等待图片加载，期望保持生图 UI，图片直接弹出。
- 问题结论：恢复成功或生成成功后，前端立即把结果节点 `loading=false`，但浏览器实际图片还没触发 `load`，普通图片分支按未解码图片布局短暂塌缩。
- 修复内容：两份 Canvas bundle 将“拿到 URL”和“图片加载完成”拆开；拿到 URL 后先保持 `loading=true/progress=99/progressLabel=图片加载中`，设置 `revealOnImageLoad/pendingRevealUrl`，加载态预览图绑定同一个 `onLoad`，真正加载完成后再清掉 loading 并显示结果图。
- 刷新保护：两份 projects chunk 保留 `revealOnImageLoad` 的图片加载中状态，避免刷新时项目清洗层又把等待解码状态删除。
- 缓存处理：入口、Canvas 动态 import 和 Canvas 内 projects import query 同步升为 `20260707taskresume5`。
- 验证结果：`node --check` 覆盖两份 Canvas bundle、两份 projects chunk 和两份 index chunk；静态断言确认包含 `图片加载中`、`revealOnImageLoad`、加载态 `onLoad` 和 projects 保留条件；3458 首页、入口 chunk 与 Canvas 资源均命中 `taskresume5`。
- 热修记录：`taskresume4` 首版在压缩函数内重复声明 `Xt`，导致浏览器解析 Canvas 包失败、画布空白；已移除重复声明并升为 `taskresume5`，内置浏览器确认当前项目画布可正常挂载。

### 2026-07-07 追加：图片加载中长条 UI 兜底

- 触发背景：用户截图确认 `图片加载中 99%` 仍被压成横条，不符合“保持生图 UI”的预期。
- 问题结论：`canvas-image-node-polish.css/js` 过渡层会把加载预览 `<img>` 误识别为“已有图片”，提前套用结果图抛光规则，覆盖了 Canvas 包内的方形 loading 容器。
- 修复内容：图片节点 loading 时新增 `image-node-loading` 类；`canvas-image-node-polish.css` 对该类强制保留 290px 方形加载卡、恢复内边距和 `aspect-ratio: 1 / 1`，覆盖“已有图片”抛光规则。
- 缓存处理：入口和 Canvas 动态 import 升为 `20260707taskresume6`，`canvas-image-node-polish.css` query 升为 `20260707loadui1`。
- 验证结果：`node --check` 覆盖两份 Canvas bundle 和两份 index chunk；静态断言确认 Canvas 包包含 `image-node-loading`，CSS 包含方形加载兜底；3458 首页、入口 chunk、Canvas chunk 和 polish CSS 均命中新版本。

### 2026-07-07 追加：画布用户中心兑换码刷新修复

- 触发背景：用户在画布右侧用户中心抽屉反馈兑换码输入框文字发白，且兑换后算力余额不刷新。
- 问题结论：画布抽屉的兑换逻辑期望 `/api/user/redeem` 返回 `user` 对象，但当前后端只返回 `success/balance/amount`；成功后没有重新拉取 `/api/user/profile`，所以余额展示仍停留在旧的本地用户状态。
- 修复内容：两份 `ImageHistoryPanel` 兼容包在兑换成功后优先使用返回的 `user`，没有 `user` 时立即调用现有资料刷新函数重新获取用户信息，并继续刷新余额明细；兑换码输入框补充 `text-zinc-900` 和 `placeholder:text-zinc-400`，避免白底不可读。
- 缓存处理：入口和 Canvas 动态 import 升为 `20260707taskresume7`，Canvas 内 `ImageHistoryPanel` import query 升为 `20260707redeem1`。
- 验证结果：`node --check` 覆盖两份 `ImageHistoryPanel`、两份 Canvas bundle 和两份 index chunk；静态断言确认输入框颜色、兑换成功刷新 fallback 和缓存 query 都存在；3458 首页、入口 chunk、Canvas chunk 与 `ImageHistoryPanel` chunk 均命中新版本。
- 未覆盖风险：本轮不提交真实兑换码，避免修改用户额度数据；需要用户用有效兑换码做一次业务复测。

## 2026-07-07 最新 commit 基线确认

- 触发背景：用户明确“最新的 commit 是基线”，需要修正 `docs/current-baseline.md` 中仍指向 `51d4dab` 的旧回滚基线，避免后续 agent 继续按旧基线判断项目状态。
- 处理内容：当前基线更新为 `0fd4453 fix: stabilize canvas generation flow`，记录完整提交哈希、提交时间、`main...origin/main [ahead 4]` 状态，以及未跟踪目录 `workflows/` 不属于当前基线。
- 资源同步：当前入口资源更新为 `index-DglIsp_g.js?v=20260707taskresume7`、Canvas 动态 chunk `Canvas-B8bY9_QL.js?v=20260707taskresume7`、用户抽屉 chunk `ImageHistoryPanel-Dy2o3dPV.js?v=20260707redeem1`、图片节点抛光 CSS `canvas-image-node-polish.css?v=20260707loadui1`。
- 风险说明：Git 最新提交成为本地文档基线，不等于 `http://192.168.0.39:3456/` 生产端已经同步；生产端仍必须按 Docker 重建、健康检查和内网 URL 命中结果确认。
- 验证方式：本轮使用 `git status --short --branch`、`git log -1` 和静态资源 query 检查确认文档来源；随后执行文档空白与 UTF-8 BOM 检查。

## 2026-07-08 后台源码 UI 规范化

- 触发背景：用户要求先建立后台 UI 规范，并在不破坏功能、不引入 shadcn/React/Tailwind/新依赖、不改后端 API 的前提下优化源码后台 `/admin/*`。
- 规范文档：新增 `docs/admin-ui-guidelines.md`，固定后台为浅色高密度运维风，约束 8px 圆角、状态色、工具栏、空态/错误态/加载态、危险操作确认、移动端无横向溢出和组件职责边界。
- 共用组件：新增 `frontend/src/components/admin/` 下的 `AdminPageShell`、`AdminPageHeader`、`AdminStatGrid`、`AdminPanel`、`AdminToolbar`、`AdminEmptyState`、`AdminFeedback`，仅承载布局和展示，不直接发起业务 API。
- 页面改造：11 个 `Admin*Source.vue` 页面统一使用 shell/header/feedback/toolbar/empty/stat/panel 结构，保留原请求函数、按钮行为、确认弹窗、筛选、分页、表单字段和写入逻辑。
- 导航整理：`AdminSourceSidebar.vue` 改为读取 `frontend/src/config/adminNavigation.ts`，补充 lucide 图标和分组信息，路由仍使用既有 `frontend/src/router/index.ts`。
- 样式整理：`frontend/src/styles/app.css` 增加后台 scoped tokens 和 shell/sidebar/header/stat/panel/toolbar/list/form/feedback/responsive 规则，只触达 `admin-` 类，不改首页、用户中心、模板和画布。
- Smoke 修复：后台 Playwright smoke runner 同步写入 `admin_auth_token/admin_auth_user` 与 legacy `auth_token/auth_user`，避免源码后台 API 拦截器读取不到 admin token 后产生 401 console error。
- 验证结果：`npm run typecheck --prefix "F:\dianshang\frontend"`、`npm run check:routes --prefix "F:\dianshang\frontend"`、`npm run build --prefix "F:\dianshang\frontend"`、`scripts/smoke-source-frontend-ui.ps1`、`scripts/smoke-admin-pages-ui.ps1`、4 个 smoke runner `node --check` 和 `git diff --check` 均已通过。
- 未覆盖风险：本轮未执行真实 Provider 连接、真实 Key 写入、扣费、删除正式线路或 Docker 生产同步；如需同步 `http://192.168.0.39:3456/`，仍需另走 Docker 重建、healthy 和内网 URL 命中验证。

## 2026-07-08 画布生成线路透传修复

- 触发背景：用户截图显示生图失败，上游返回 `没有可用token`；随后反馈切到 `lingsuan-专线` 也失败。
- 问题结论：最新失败任务实际全部仍记录为 `lineKey=route_6789`、`routeDisplayName=6789`，错误 URL 仍是 `https://www.packyapi.com/v1/images/edits`；`/api/generate/tasks` 没有把请求体里的 `routeId/lineId/routeKey/lineKey` 解析成图片线路并传给 Provider，导致切线路后仍回落默认线路。
- 修复内容：`/api/generate/tasks` 增加 `resolveImageRoute(req.body)`，并把解析出的线路作为 `route` 传入 `callProviderImageGeneration` / `callProviderImageEdit`；`createPendingTask` 和 `makeTaskResponse` 记录并返回 `routeId/lineId/routeKey/lineKey/routeDisplayName`。
- 任务列表修正：`/api/admin/generate-tasks` 不再把内存任务写死显示为 `route_6789/6789`；失败任务显示 `未扣费`，运行中显示 `待结算`，成功后才显示 `已扣费`。
- 验证结果：`node --check "F:\dianshang\server.js"` 通过；`scripts/smoke-api-disposable.ps1` 通过；一次性 mock 后端验证带 `routeId=pub_route_mr5yltmuc7edcb2b` 的生成任务会记录为 `lineKey=lignsuan-guanzhuan`、`routeDisplayName=官转gpt-img2`，未触发真实 Provider。
- 未覆盖风险：本轮没有向真实 `lingsuan.top` 或 `packyapi` 发起生图请求；如果修复后真实 lingsuan 仍失败，需要用新的任务 traceid 再判断是线路上游错误还是 Key/接口配置问题。

## 2026-07-08 PackyAPI 线路命名对齐

- 触发背景：用户中心 API 线路显示两条都像“官转”，用户反馈“PackyAPI 的呢”，要求和后台名称一致。
- 处理内容：默认种子线路 `pub_route_openai_gpt_image_2 / route_openai_gpt_image_2` 显示名改为 `PackyAPI GPT Image 2`；当前运行数据库 `admin.apiProviders` 同步更新 `name/displayName/dn`，保留原 Key、Base URL、端点、优先级和默认状态不变。
- 当前线路：PackyAPI 图像线路显示为 `PackyAPI GPT Image 2`，Base URL 为 `https://www.packyapi.com`；lingsuan 图像线路继续显示为 `官转gpt-img2`，Base URL 为 `https://lingsuan.top`。
- 验证结果：`/api/admin/api-providers`、`/api/public/routes?group=image`、`/api/model-routes?group=image` 和 `/api/user/api-status` 均返回一致的 PackyAPI 显示名。

## 2026-07-08 用户 API 线路偏好持久化

- 触发背景：用户反馈线路已更新但仍不出图；复查最新任务发现请求仍走 `PackyAPI GPT Image 2`，而 `/api/user/preferences/api-route` 只是返回成功，没有保存用户选择。
- 问题结论：用户中心点选 lingsuan 在前端看似成功，但后端不会记住；`/api/user/api-status` 和无线路参数的生成兜底仍会回到默认 PackyAPI。
- 修复内容：新增 `user.apiPreferences` app_state；`/api/user/preferences/api-route` 保存当前用户图片线路；`/api/user/api-status`、`/api/user/models` 和 `/api/generate/tasks` 的无线路参数兜底都优先读取用户保存的图片线路。
- 验证结果：`node --check "F:\dianshang\server.js"` 通过；3456 已重启；用管理员账号保存 `pub_route_mr5yltmuc7edcb2b` 后，`/api/user/api-status` 返回 `routeKey=lignsuan-guanzhuan`、`displayName=官转gpt-img2`。
- 未覆盖风险：本轮没有真实调用 lingsuan 生图；用户需要在修复后重新点选一次 lingsuan，让偏好写入后端。

## 2026-07-08 追加：画布线路偏好全链路收口

- 触发背景：用户继续截图反馈 `没有可用token`，怀疑后台 UI 优化破坏生图；复查发现普通生成路径已修，但画布套图和对话 Agent 生成仍有未带 `req.user.userId` 的 `resolveImageRoute(body)` 调用。
- 问题结论：后台 UI 样式改造没有直接触碰 Provider 调用；真正风险点是后端线路选择收口不完整。部分画布生成链路在请求没有显式线路时仍会跳过用户偏好，回到默认 PackyAPI，从而继续命中 Packy 上游 `没有可用token`。
- 修复内容：`/api/canvas/ecommerce-suite/prompts`、`/api/canvas/ecommerce-suite/generate`、`/api/canvas/dialog-agent-generate` 均改为 `resolveImageRoute(body, req.user.userId)`；普通 `/api/generate/tasks` 和 `/api/template/generate-image` 已保留用户偏好与 Packy token 耗尽时的下一条图像线路兜底。
- 当前状态：3456 已重启到 `node F:\dianshang\server.js`；健康接口确认数据库为 `F:\dianshang\data.db`；实际用户 `731241492 / user_mra81hjffdee6972` 的 `/api/user/api-status` 返回 `官转gpt-img2 / lignsuan-guanzhuan`。
- 验证结果：`node --check "F:\dianshang\server.js"` 通过；`scripts/smoke-api-disposable.ps1` 通过；本轮未触发真实 Provider 生图，避免真实扣费。
- 未覆盖风险：如果 lingsuan 上游本身也返回失败，需要用修复后的新任务 traceid 继续判断 Key、endpoint 或上游 token 池状态。

## 2026-07-08 追加：参考图加载闪烁修复

- 触发背景：用户反馈画布参考图一直加载刷新、闪烁。
- 问题结论：当前画布加载态会渲染一张 `loadingPreviewUrl` 预览图；全局 `canvas-image-node-polish.js` 的选择器 `.image-node img` 会把这张加载态预览图误判为“已有图片”，给节点打上 `image-node-has-image`，与 `.image-node-loading` 样式互相覆盖，导致加载态反复刷新闪烁。
- 修复内容：`assets/canvas-image-node-polish.js` 在 `markImage` 中检测到 `.image-node-loading` 时，不再标记 `image-node-has-image`，并清除节点、wrapper、card 上已有的 `image-node-has-image`；`index.html` 将该脚本 query 升级到 `20260708loadguard1`。
- 验证结果：`node --check "F:\dianshang\assets\canvas-image-node-polish.js"` 通过；`git diff --check -- "index.html" "assets/canvas-image-node-polish.js"` 通过；3456 首页 HTML 命中 `canvas-image-node-polish.js?v=20260708loadguard1`，脚本内容命中 loading guard；UTF-8 BOM 检查通过。
- 未覆盖风险：本轮没有触发真实生图和真实扣费；需要用户在现有画布中刷新后观察参考图加载态是否稳定。

## 2026-07-09 Docker 同步生产内网

- 触发背景：用户要求“同步到docker”，需要把当前 `F:\dianshang` 工作区完整同步到内网 Docker 运行端。
- 处理内容：启动 Docker Desktop 后执行 `docker compose -f "F:\dianshang\docker\docker-compose.yml" up -d --build --force-recreate app`；因同步过程中更新了 `scripts/smoke-internal-prod.ps1` 的资源版本断言，随后再次完整重建并强制重建容器。
- 镜像与容器：最终镜像 `dianshang-internal-app:latest` 为 `sha256:52079e8da62a568e71a77f0f934111107f24bfe6409e3b97b2b2b1eb258c1376`，镜像创建时间 `2026-07-09T03:07:00.899808192Z`；容器 `dianshang-internal-app` 启动时间 `2026-07-09T03:07:08.743503288Z`，Health 为 `healthy`。
- 内网验证：`http://192.168.0.39:3456/` 返回 200，HTML 命中 `index-DglIsp_g.js?v=20260707taskresume7` 和 `canvas-image-node-polish.js?v=20260708loadguard1`；`/api/health` 返回 `success=true/status=ok/database=ok/mode=real-provider-ready`，数据库路径 `/app/data/data.db`。
- Smoke 验证：更新后的 `scripts/smoke-internal-prod.ps1` 通过，覆盖健康检查、管理员登录、设置读取、兑换码创建/删除、旧资源 410、未知资源 404 和后台入口资源断言。
- 风险说明：本轮未执行真实 Provider 生图、真实 Key 写入或真实扣费；用户浏览器若仍加载旧静态资源，需要强刷当前页面。

## 2026-07-09 账号 731241492 密码统一

- 触发背景：用户发现开发主干和 Docker 的 `731241492` 登录信息不一致，要求统一。
- 处理内容：先备份 `F:\dianshang\data.db` 与 `F:\dianshang\docker\data\data.db`；开发库更新已有 `731241492` 密码 hash；Docker 库原本没有该用户名，但同邮箱 `731241492@qq.com` 已存在于 `mylord1993` 账号，因此保留 Docker 原用户 id、项目和余额，只把登录名改为 `731241492` 并重置密码 hash。
- 环境差异：开发库无 `JWT_SECRET`，使用本地默认 secret 计算 hash；Docker 使用容器内生产 `JWT_SECRET` 计算 hash，未直接跨环境复制 hash。
- 验证结果：开发库本地 hash 校验通过；Docker 容器库 hash 校验通过；`http://192.168.0.39:3456/api/auth/login` 使用 `731241492` 登录返回 200 和 token。
- 风险说明：本轮只统一登录名和密码；Docker 账号保留原 id `user_mr5yosedcd52a974` 与余额 `130`，开发库账号仍为 `user_mra81hjffdee6972` 与余额 `115`。

## 2026-07-09 模板选择板块 UI 优化与 Docker 同步

- 触发背景：用户截图指出 `/template-image` 的“选择模板 / 全部模板”板块视觉过重、空间利用率低，要求用 UI 设计能力优化并同步到 Docker。
- 处理内容：新增 `assets/template-workbench-gallery-polish.css`，只覆盖当前生产模板工作台的布局和视觉：模板区改为浅色工作台面板、标题栏固定为工具栏感、模板卡片降低高度和圆角、提高桌面列表密度、保留移动端单列和无横向溢出；`index.html` 追加 `template-workbench-gallery-polish.css?v=20260709gallery1`。
- 功能边界：未修改 `assets/TemplateImageWorkbench-CphSYYVU.js` 的业务逻辑，未修改模板数据、生成接口、上传、反推、扣费或 Provider 调用。
- Smoke 更新：`scripts/smoke-internal-prod.ps1` 增加模板工作台 CSS 资源命中和关键规则断言，防止 Docker 同步后漏加载新版样式。
- Docker 同步：执行 `docker compose -f "F:\dianshang\docker\docker-compose.yml" up -d --build --force-recreate app`；最终镜像 `sha256:3b0818f83327a67517c762793c7d74bb053a460b14f6a98a4d14d8ac4d8d50cc`，镜像创建时间 `2026-07-09T04:49:11.279150785Z`，容器启动时间 `2026-07-09T04:49:20.291493523Z`，Health 为 `healthy`。
- 验证结果：`git diff --check` 通过；新增/修改文本文件 UTF-8 无 BOM；`http://192.168.0.39:3456/` 返回 200 并命中 `template-workbench-gallery-polish.css?v=20260709gallery1`；新 CSS 返回 200 并命中高优先级模板卡片覆盖规则；`/api/health` 返回 `success=true/status=ok/database=ok`；`scripts/smoke-internal-prod.ps1` 通过。
- 未覆盖风险：本轮没有触发真实模板生图、真实 Provider 调用或真实扣费；用户浏览器如仍显示旧样式，需要强刷 `/template-image`。

## 2026-07-09 画布模型下拉清理

- 触发背景：用户在 `/canvas/project_1782972520891_js939yppz` 截图反馈模型下拉仍混入 `6789/RK/Comfly/Nano Banana/Gemini` 等历史模型，希望清理。
- 问题结论：后端当前 `/api/user/models` 已只返回当前线路模型；旧模型来自静态兜底模块 `assets/fixedImageModels-Rg0McL4V.js`，Canvas/HomeIndex 在接口异常或兜底合并时会继续使用这份旧固定模型表。
- 处理内容：`assets/fixedImageModels-Rg0McL4V.js` 改为只保留当前两条图像线路的兜底模型：`GPT Image 2（PackyAPI GPT Image 2）` 和 `GPT Image 2（官转gpt-img2）`；移除 `6789/RK/Comfly/Nano Banana/Flatfee/VIP/Gemini/GPT-4o` 等旧项。
- 缓存处理：`index.html` 入口升级为 `index-DglIsp_g.js?v=20260709modelclean1`；`assets/index-DglIsp_g.js` 中 HomeIndex 和 Canvas chunk query 升级为 `20260709modelclean1`；Canvas/HomeIndex 对固定模型表的 import 也追加 `fixedImageModels-Rg0McL4V.js?v=20260709modelclean1`。
- Smoke 更新：`scripts/smoke-internal-prod.ps1` 增加固定模型表断言，要求 PackyAPI 和 lingsuan 兜底存在，旧模型关键字不存在。
- Docker 同步：执行 `docker compose -f "F:\dianshang\docker\docker-compose.yml" up -d --build --force-recreate app`；最终镜像 `sha256:928c818c2c65d810f58982ee42397899864b89f99be424da13ea932bbdc2f43a`，镜像创建时间 `2026-07-09T05:03:56.551865184Z`，容器启动时间 `2026-07-09T05:04:05.059351269Z`，Health 为 `healthy`。
- 验证结果：相关 JS `node --check` 通过；`git diff --check` 通过；修改文件 UTF-8 无 BOM；`http://localhost:3456/` 和 `http://192.168.0.39:3456/` 均命中 `modelclean1` 入口、Canvas query 和 fixed model query；固定模型表 HTTP 内容不含旧模型关键字；Playwright 运行时 import 返回 2 个模型且 `hasOld=false`；`scripts/smoke-internal-prod.ps1` 通过。
- 未覆盖风险：本轮未触发真实生图、真实 Provider 调用或真实扣费；用户已打开的旧页面需要强刷或重新进入画布以加载新入口和新模块。

## 2026-07-09 画布模型自动同步收口

- 触发背景：用户要求以后后台新增其他模型时，画布和前台模型下拉能自动同步，不再需要改前端静态模型表。
- 问题结论：上一轮 `modelclean1` 只把静态兜底清到两条模型，仍然会形成“后台新增模型但前端兜底不同步”的维护风险；正确边界应为后端 `/api/user/models` 是唯一真实模型来源，前端固定模块只做兼容空兜底。
- 处理内容：`assets/fixedImageModels-Rg0McL4V.js` 改为 `backend-model-source-only`，保留 AddOutline 图标和导出签名，但 `l()/g()` 返回空数组、`r()` 返回 `null`；不再内置 PackyAPI、lingsuan 或任何真实模型。`/api/user/models` 无线路参数时默认回到 `pub_route_openai_gpt_image_2` 或用户保存的图片线路，继续从后台模型配置读取。
- 缓存处理：`index.html`、`assets/index-DglIsp_g.js`、`assets/Canvas-B8bY9_QL.js`、`assets/HomeIndex-DAjDt0aj.js` 的相关 query 升级为 `20260709modelsync1`，避免浏览器继续加载 `modelclean1`。
- Smoke 更新：`scripts/smoke-internal-prod.ps1` 改为断言固定模型资产包含 `backend-model-source-only`，且不包含 PackyAPI、lingsuan、6789、RK、Comfly、Nano Banana、Flatfee、VIP、Gemini 等真实模型关键字。
- Docker 同步：执行 `docker compose -f "F:\dianshang\docker\docker-compose.yml" up -d --build --force-recreate app`；最终镜像 `sha256:02f8ba50fd739fd9411546364238d05d69121dc24fdd286b8e6ebd7261c13c12`，镜像创建时间 `2026-07-09T05:12:15.929785193Z`，容器启动时间 `2026-07-09T05:12:24.5713627Z`，Health 为 `healthy`。
- 验证结果：相关 JS `node --check` 通过；`git diff --check` 通过；修改文件 UTF-8 无 BOM；`http://localhost:3456/` 和 `http://192.168.0.39:3456/` 均命中 `index-DglIsp_g.js?v=20260709modelsync1`；入口 JS 命中 Canvas/Home/fixed model 的 `modelsync1` query；固定模型资产返回 200，包含 `backend-model-source-only` 且不含真实模型关键字；`scripts/smoke-internal-prod.ps1` 通过。
- 自动同步闭环：通过管理员 API 临时新增模型 `codex-auto-sync-smoke-1783574041519` 到 `pub_route_openai_gpt_image_2`，普通用户 `731241492` 调 `/api/user/models?routeId=pub_route_openai_gpt_image_2` 立即可见；随后删除该临时模型，再次查询已消失，后台未留下测试模型。
- 未覆盖风险：本轮未触发真实生图、真实 Provider 调用或真实扣费；已打开的画布页面需要强刷或重新进入画布以加载 `modelsync1` 入口。

## 2026-07-09 画布 agent 套图 tab 图标替换

- 触发背景：用户截图指出画布聊天面板 `agent电商套图` tab 左侧仍是摄像机图标，语义不贴合电商套图 agent 功能。
- 处理内容：`assets/Canvas-B8bY9_QL.js` 中 `video` tab 图标从 `oo` 摄像机图标改为 `gd` 魔法棒图标；按钮 key、mode 映射、文案、点击切换和生成逻辑均未修改。
- 缓存处理：`index.html`、`assets/index-DglIsp_g.js`、`assets/Canvas-B8bY9_QL.js`、`assets/HomeIndex-DAjDt0aj.js` 相关 query 升级为 `20260709agenticon1`，避免浏览器继续使用旧 Canvas chunk。
- Smoke 更新：`scripts/smoke-internal-prod.ps1` 增加纯 ASCII 静态断言，要求生产 Canvas chunk 包含 `icon:gd}],a=l0`，且不包含 `icon:oo}],a=l0`。
- Docker 同步：执行 `docker compose -f "F:\dianshang\docker\docker-compose.yml" up -d --build --force-recreate app`；最终镜像 `sha256:67bb7e40487e02a4c5499f60c82f1d9a7d75a3284f7dd61232cbdfdbfabf4a28`，镜像创建时间 `2026-07-09T05:40:07.418120767Z`，容器启动时间 `2026-07-09T05:40:16.072440369Z`，Health 为 `healthy`。
- 验证结果：`node --check` 覆盖 Canvas、入口、Home 和 fixed model JS；`git diff --check` 通过；修改文件 UTF-8 无 BOM；`http://localhost:3456/` 和 `http://192.168.0.39:3456/` 均命中 `index-DglIsp_g.js?v=20260709agenticon1`；入口 JS 命中 `Canvas-B8bY9_QL.js?v=20260709agenticon1`；生产 Canvas chunk 命中魔法棒图标断言且旧摄像机断言为 false；`scripts/smoke-internal-prod.ps1` 通过。
- 未覆盖风险：本轮未触发真实生图、真实 Provider 调用或真实扣费；已打开的画布页面需要强刷或重新进入画布以加载 `agenticon1` 入口。
