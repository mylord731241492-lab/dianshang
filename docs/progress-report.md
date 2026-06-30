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
