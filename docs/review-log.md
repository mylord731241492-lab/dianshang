# 审查与复核记录

## 当前基线提示

当前 `main` 已回滚到 `51d4dab fix: improve canvas production performance guards`。复核任何问题前先读 `docs/current-baseline.md`，再按日期查本文件。

本文件是复核历史，不是当前实现清单。尤其是 2026-07-06/07 的生图链路实验，在本次回滚后的 `main` 中不属于当前基线。

## 审查规则

每轮完成后记录：

- 已验证的命令和页面。
- 新发现的风险。
- 未覆盖的测试。
- 需要人工确认的事项。
- 下一轮优先级。
- 优先复用已有接口、成熟开源项目和当前技术栈能力，不重复造轮子；新增能力前先确认是否已有 New-API、CPA、Docker Compose、现有 `/api/*` 或前端模块可复用。

## 2026-07-07 当前画布真实生图生产测试复核

### 已验证

- 3458 已从 mock 切到真实 AI 调用模式，健康检查返回 `mode=real-provider-ready`、`providers.ai.enabled=true`、`imageKeyConfigured=true`。
- 当前画布提示词为“生成电商主图”，参考图已连到图片生成节点。
- 点击一次“生成图片节点”后，页面先显示 `已提交请求 12%`，随后停在 `等待返回结果 94%`，最后成功回填结果节点。
- SQLite 最新 `generations` 记录为 `gen_mra8repd7838d326`，状态 `completed`，模型 `gpt-image-2`，扣费 `10`。
- 结果地址为 `/api/proxy-image?url=https%3A%2F%2Fexternal-resources-2.packyapi.com%2Ffiles%2F2bb7f59a-3a83-4feb-a648-07e9f31c9391.png`，属于真实上游返回，不是 `/api/mock-image/...`。
- 浏览器 DOM 中 `文生图` 节点已加载，图片自然尺寸 `1022x1539`，显示尺寸约 `345x520`。

### 结论

- 当前 3458 的真实生图主链路已跑通：画布提交、后端调用 New-API/上游、数据库记录、前端结果节点回填均成功。
- 用户提供了 `admin / admin123456789`，但当前浏览器标签已有登录态，实际运行账号是 `731241492`，本次扣费发生在该用户下；生成后该用户余额为 `0`。

### 未覆盖

- 未切换到 admin 账号再跑第二次，避免重复真实扣费。
- 未做完整 `NODE_ENV=production` 启动验证；当前本地强 JWT_SECRET 不满足生产门禁。

## 2026-07-07 当前画布 mock 生图结果图复核

### 已验证

- 使用 CodeGraph 做结构入口检查后，因当前画布为压缩 bundle，本轮改用精确字符串定位结果图 URL 归一化逻辑。
- 内置浏览器在 `http://127.0.0.1:3458/canvas/project_1783402782710_xeqb6t8wr` 复现到破图：结果节点 `文生图` 的 `src` 被写成 `data:image/png;base64,/api/mock-image/...`，浏览器自然尺寸为 0，显示成小破图。
- 后端 mock 模式返回 `/api/mock-image/:seed.svg?...` 是合理相对 URL；问题在前端白名单没有放行 `/api/mock-image/`，把它误当成 base64 纯内容。
- 已在 `assets/Canvas-B8bY9_QL.js` 和 `assets/Canvas-yGc8b2gf.js` 中补齐 `/api/mock-image/` 白名单，并把已误包成 `data:image/...,(\/api\/mock-image\/...)` 的旧值解回正常 URL。
- 已把 `index.html` 主入口和两个入口 bundle 的 Canvas 动态 import query 升级为 `20260707mockimage1`。
- 已更新 `scripts/smoke-internal-prod.ps1` 的入口/Canvas query，并增加 Canvas 包必须包含 mock image URL 白名单的断言。
- `node --check` 检查四个 JS 包通过，PowerShell `PSParser` 检查 smoke 脚本通过。
- 本地 3458 刷新后，旧破图节点恢复为 `/api/mock-image/...`，自然尺寸 `1024x1024`；再次点击生成后节点数从 3 到 4，两个 `文生图` 均正常加载，`badMockWrapped=0`。

### 结论

- 本轮修的是当前画布 mock 生图结果节点显示链路，不是模型能力、真实 Provider 或后端生成逻辑。
- 当前本地 3458 mock 路径已恢复；用户截图里的小破图现象应由前端 URL 白名单缺失导致。

### 未覆盖

- 未重建 Docker，未验证 `http://192.168.0.39:3456/`，因为当前测试服务器 3456 可能走真实 Provider，需用户确认后再同步。
- 控制台仍有 `projects-BtxGnToV.js` 的本地资源迁移/JPG 转换 warning，本轮未展开，后续若出现历史记录落盘或素材恢复异常再单独排查。

## 2026-07-07 回滚后文档去混淆复核

### 已验证

- 当前 `HEAD` 为 `51d4dab`，`main...origin/main [ahead 2]`。
- CodeGraph 索引健康，当前项目仍索引 137 个文件和 102 个路由。
- 但 CodeGraph 文件列表在本次回滚后仍包含已删除的独立画布重建方案源码路径；`Test-Path` 和 `git ls-files` 已确认 `frontend/src/views/CanvasStudio.vue`、`frontend/src/stores/canvas.ts`、`frontend/src/types/canvas.ts`、`frontend/src/api/canvasRunner.ts` 和 `frontend/public/system-prompts/infinite-canvas-prompt-templates.md` 当前均不存在。
- 当前 `index.html` 主入口为 `index-DglIsp_g.js?v=20260704usercenter1`，画布辅助脚本为 `20260704canvasleave1`。
- 当前 `server.js` 约 4328 行，仍是 Express + SQLite 单体实现。
- 本轮新增 `docs/current-baseline.md`，把当前 Git 基线、备份分支、stash、生产未同步状态、阅读顺序和易混淆历史集中到一个入口。
- 本轮新增 `AGENTS.md` 的 `## Agent skills` 入口，以及 `docs/agents/issue-tracker.md`、`docs/agents/triage-labels.md`、`docs/agents/domain.md`，明确本仓库默认走本地 Markdown 工作项，不把历史日志或远端 issue 流程误当成当前开发状态。
- 本轮新增 `CONTEXT.md`，把“画布”固定为当前唯一画布；历史替代实现统一称为“已废止的独立画布重建方案”，不再用两套画布的并列叫法描述当前开发对象。

### 结论

- 后续 agent 不应直接从 `progress-report.md` 或本文件推断当前实现；必须先看 `docs/current-baseline.md`。
- 后续 agent 如需拆任务，先使用 `docs/agents/` 的本地约定；除非用户明确要求，不主动创建 GitHub issue、PR 或远端协作流程。
- 2026-07-06/07 的后续生图任务恢复和官转线路实验目前只保留在回滚前备份分支和 stash 中，不属于当前 `main`。
- 当前源码没有混入已废止的独立画布重建方案源码文件；混淆点来自 CodeGraph 回滚后索引滞后和历史日志残留。结构分析前应先刷新或复核 CodeGraph。

### 未覆盖

- 本轮没有重建 Docker，没有验证 `http://192.168.0.39:3456/` 是否已同步到本 Git 基线。
- 本轮没有修复过期验证脚本；`verify-canvas-performance-assets.js` 仍需下一步处理。
- 本轮没有刷新 CodeGraph 索引；刷新或重建索引需先得到用户确认。

## 2026-07-04 画布默认云端保存复核

### 已验证

- CodeGraph 索引正常；本轮定位到旧画布保存模式来自 `canvasSave` Pinia 状态和旧打包保存分片。
- `index.html` 启动脚本在不支持 `showDirectoryPicker` 的环境里，将缺省或旧的 `canvasSaveMode=local` 切换为 `cloud`。
- `assets/localWorkflowFileSystem-CxAxbYWk.js` 和 `assets/localWorkflowFileSystem-B3l-tt5f.js` 的 `canvasSaveMode` 默认值从 `local` 改为 `cloud`。
- `/api/settings/canvas-storage` 当前返回可用，旧画布不会因为管理员关闭云端保存而自动回退到本地。
- `node --check assets/localWorkflowFileSystem-CxAxbYWk.js`、`node --check assets/localWorkflowFileSystem-B3l-tt5f.js`、`node --check server.js` 均通过。
- `docker compose up --build -d` 已重建并替换 `dianshang-internal-app`；`verify-internal.ps1` 通过 health、API smoke、前端路由 smoke 和 Provider guard。
- 内网首页 `http://192.168.0.39:3456/` 返回 200，且包含云端初始化脚本；容器内两个保存分片均确认 `saveMode:m("canvasSaveMode","cloud")`。

### 结论

- 本轮只把内网测试主路径切到云端/服务器保存，不改本地文件夹 API、不引入 HTTPS 证书、不触发真实 AI 或付费调用。
- 本地文件夹保存仍保留为用户手动选择的增强能力；浏览器不支持时不应再成为默认阻塞点。

### 未覆盖

- 其他机器的本地文件夹授权仍需后续单独处理。
- Playwright UI smoke 未启用；本轮通过 HTTP 首页内容、容器文件和 API smoke 验证生产端静态资源已同步。

## 2026-07-03 画布连线统一复核

### 已验证

- CodeGraph 索引正常，确认本轮是旧打包画布资产内的连线渲染与加载归一化问题。
- `assets/Canvas-B8bY9_QL.js` 和 `assets/Canvas-yGc8b2gf.js` 中默认边从 `smoothstep` 改为 `default`，新建普通边会走左侧同类 Bezier 曲线。
- 旧项目加载和本地工作流导入从直接使用 `r.edges` 改为 `(r.edges || []).map(Sg)`，保存过的直角灰线会在加载时统一。
- 图片参考边、图片顺序边、提示词顺序边和视频角色边统一为 `#3b82f6`、`2px`。
- `assets/Canvas-D1auYH9L.css` 的默认 edge、选中 edge 和连接预览线同步改为蓝色线条。
- `node --check assets/Canvas-B8bY9_QL.js`、`node --check assets/Canvas-yGc8b2gf.js`、`node --check scripts/verify-canvas-performance-assets.js` 均通过。
- `node scripts/verify-canvas-performance-assets.js` 和 `scripts/smoke-backend-canvas-boundary.ps1` 均通过；`git diff --check` 无 whitespace 错误；触碰文件无 BOM。
- 已刷新当前浏览器项目 `project_1783050909233_5t381nrb6`，采样到 9 条 `.vue-flow__edge-path`，全部为 `rgb(59, 130, 246)`、`2px`，且 path 均包含 `C` 曲线段。

### 结论

- 本轮只处理连线视觉和加载归一化，不改节点结构、生图接口、扣费或外部 Provider 调用。
- 旧工作流再次保存后，边类型可能从旧 `smoothstep` 变成 `default`，这是为了统一曲线形态。

### 未覆盖

- 需要用户在真实画布复杂项目中确认所有边的视觉观感。
- 未做真实生图或上传相关测试，本轮无必要触发付费链路。

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

## 2026-06-30 旧画布入口缓存版本复核

### 已确认

- `index.html` 当前加载 `assets/index-DglIsp_g.js?v=20260630dialogagent9`，与后端画布边界 smoke 的入口断言一致。
- 旧入口 bundle 里的 `/canvas` 动态 import 已从 `Canvas-*.js?v=20260630dialogagent1` 同步到 `20260630dialogagent6`，避免浏览器继续使用旧查询串缓存画布 chunk。
- `scripts/verify-canvas-performance-assets.js` 已覆盖主入口 `dialogagent9` 和两个 Canvas chunk `dialogagent6`，本轮重跑通过。
- `scripts/smoke-canvas-performance-ui-runner.js` 的主入口版本断言已同步到 `dialogagent9`。

### 需要继续验证

- 项目未安装 `@playwright/cli`，现有画布 UI smoke 脚本会通过 `npx --package @playwright/cli` 取包；本轮按下载确认规则未执行该类 UI smoke。
- 真实浏览器端还需在允许使用该 UI smoke 依赖后跑 `smoke-canvas-performance-ui.ps1`、`smoke-canvas-json-ui.ps1` 或等价人工页面复测。

## 2026-06-30 Canvas Chat 三模式会话隔离复核

### 已确认

- `对话 / 快速 / 视频` 现在使用独立会话桶保存输入框、参考图、消息列表和 `sessionId`。
- 切换模式时会先保存旧模式状态，再加载目标模式状态；不会把一个模式的消息列表直接渲染到另一个模式。
- 生成任务回调按消息 id 查找原始模式会话并回写，降低“生成中切标签后结果写到当前标签”的风险。
- `source:"canvas-chat"` 的未发送草稿刷新后不再自动转成用户消息；这避免输入框草稿污染消息历史。
- 浏览器实测：三个模式分别输入不同文本，切换返回后各自保留；清空后三个模式输入均为空，消息数不串。

### 需要继续验证

- 本轮没有触发真实模型调用，未覆盖真实生成中长时间切换模式后的最终图片回写。
- 若后续要验证完整 UI smoke，需要先确认是否允许 `npx --package @playwright/cli` 获取该依赖。

## 2026-06-30 Canvas Chat 三模式隔离护栏复核

### 已确认

- `docs/canvas-maintenance-boundary.md` 已把三模式隔离提升为硬护栏：不能共享消息、输入、参考图、生成中状态或 `sessionId`。
- `docs/canvas-maintenance-log.md` 已新增不可回退护栏，并把当前入口版本固定为 `dialogagent12 / canvasdialogagent9`。
- 维护日志明确禁止把快速模式改成对话 Agent 链路，禁止视频模式复用 GPT Image 2 图片入口，禁止 Canvas Chat 草稿刷新后变成用户消息。
- 后续如果改 Canvas Chat 状态管理，必须同步守护断言并跑旧画布边界 smoke。

### 需要继续验证

- 本轮是文档护栏固化，没有重新触发 UI 或真实 Provider 测试。

## 2026-06-30 Canvas Chat 对话卡片 UI 复核

### 已确认

- 快速模式现有消息卡片来源为旧 `CanvasChatPanel` 的 `article.message-card`、`.message-meta`、`.image-grid` 和 `.cost-line`，对应样式是 Vue scoped 后的 `data-v-b10121f4` 选择器。
- `assets/canvas-chat-prompt-flow.js` 已改为给桥接 DOM 补齐旧组件 scoped 样式标记，让对话桥接卡片直接吃快速模式现有 CSS。
- 对话桥接不再生成单独的参数展示行，避免用户消息卡片和快速模式卡片出现不同信息层级。
- `assets/canvas-chat-prompt-flow.css` 已删除对 `.hjm-prompt-flow-result-grid figure` 和 `.hjm-prompt-flow-images figure` 的二次图片网格覆盖，降低后续重复造轮子的风险。
- `scripts/verify-canvas-performance-assets.js` 已增加结构锚点，后续若移除 scoped 复用或重新定义桥接图片网格会失败。
- 验证已通过：桥接 JS 和两个旧 Canvas bundle 语法检查、资产守卫、旧画布边界 smoke、BOM 检查；浏览器已加载 `dialogcard1` 资源并能在对话模式显示桥接提示条。

### 需要继续验证

- 本轮不触发真实 Provider；完整成功图卡片仍需在用户允许真实生成或已有结果重放场景下做人工视觉复核。

## 2026-06-30 Canvas Chat 对话桥接 DOM 隔离复核

### 已确认

- 上一版护栏缺口已定位：`assets/canvas-chat-prompt-flow.js` 直接向 `.message-list` append DOM，这条路径没有进入旧组件的三模式会话桶，因此切到 `快速` 时可能继续显示桥接卡片。
- `dialogcard4` 已要求所有桥接卡片带 `hjm-prompt-flow-card` 和 `data-hjm-prompt-flow-mode="chat"`。
- 新增 `syncPromptFlowCardVisibility`，根据当前标签给面板切换 `hjm-prompt-flow-dialog-active`，并把非对话状态下的桥接卡片隐藏。
- CSS 已增加非对话模式兜底隐藏规则，防止 JS 时序落后一拍时卡片闪回。
- `scripts/verify-canvas-performance-assets.js` 已把这些 DOM 隔离锚点加入守卫。

### 需要继续验证

- 浏览器已刷新到 `dialogcard4`；稳定重测 `快速` 模式 `bridgeTotal=0`、`bridgeVisible=0`，视频与对话无旧泄漏卡片。

## 2026-06-30 Canvas Chat 对话任务进度 UI 复核

### 已确认

- `灵感不间断` 是旧 Canvas Chat 的 `.empty-state`，当桥接层直接插入任务卡片时，Vue 自身消息数组仍可能为空，因此必须由桥接层主动隐藏。
- `syncPromptFlowCardVisibility` 已扩展为同时管理桥接卡片可见性和 `.message-list > .empty-state` 显隐。
- 生成结果卡已新增 `hjm-prompt-flow-progress`，加载阶段可见，成功或失败后隐藏。
- `scripts/verify-canvas-performance-assets.js` 已增加空状态隐藏和进度条相关锚点，防止退回纯文字状态。

### 需要继续验证

- 进度条结构已由资产守卫覆盖；完整真实生成过程的视觉确认仍需用户允许实际调用后再做。

## 2026-07-01 视频 Tab 电商套图 Agent 复核

### 已确认

- 本轮重新实现前已回滚上一轮越界改动，旧画布刷新恢复。
- 新实现只挂在 `assets/canvas-chat-prompt-flow.js/css`，没有新增独立 `canvas-ecommerce-suite-agent.js/css`，没有改主入口 bundle 和旧 Canvas chunk。
- `shouldHandle(panel)` 仍严格只匹配 `对话`，新增 `isSuiteMode(panel)` 只匹配 `视频 / 电商套图Agent`。
- 发送按钮和回车提交已显式分流：对话走原 `handleSubmit`，视频走 `handleSuiteSubmit`，快速不被桥接层接管。
- 套图模式已隐藏原生视频模型控件，不显示 `Seedance Pro`；请求体固定传 `gpt-5.5` 生成提示词、`gpt-image-2` 做图生图。
- 上传区已改为产品图和参考图中间独立 `+` 号；参考图逐张新增独立槽位，最多 4 张。
- skill 下拉已改为 100% 宽度，与下方文本输入框对齐。
- 已上传图片槽位只显示整图铺满圆角卡片，不显示 `产品图 / 参考图` 文字，也不再缩成小图。
- 后端套图接口 mock smoke 已覆盖：config 正常、未登录 401、缺产品图 400、生成提示词成功、mock 生图成功。

### 需要继续验证

- 当前环境没有本地 Playwright 依赖，本轮未下载新包做 UI 自动化。
- 需要用户在浏览器里人工验证：`对话 / 快速` 能正常切换和点击；视频 tab 能上传产品图、参考图，发送后出现 `套图模板` 卡片；勾选板块后 mock/真实生图路径按预期。
- 真实 GPT 5.5 或 GPT Image 2 链路会产生上游请求和可能扣费，未在本轮触发。

## 2026-07-01 电商套图 Agent 动态板块复核

### 已确认

- 业务链路应为：产品图 + 参考图 + 用户需求 + 所选 skill Markdown -> GPT 动态生成本次板块提示词 -> 用户勾选/编辑 -> img2 根据产品图和参考图生成对应板块图片。
- 后台不再展示固定“套图板块/板块集合”编辑列表；后台只维护默认参数和设计师 skills。
- `/api/canvas/ecommerce-suite/config` 已返回 `sectionMode:"dynamic"`，并对前台暴露空 `sections`，防止前端按默认模板集合渲染或提交。
- 旧画布过渡层已移除生成模板请求里的默认 `sectionKeys`，不会再默认发送 `hero/selling-points/effect/tech/scene`。
- `scripts/verify-canvas-performance-assets.js` 已增加“不发送默认 sectionKeys”和动态模式锚点，`scripts/smoke-backend-canvas-boundary.ps1` 已用不带 sectionKeys 的请求覆盖 prompt mock。

### 需要继续验证

- 真实 GPT 返回的动态板块名称和数量需要用户用实际产品图、参考图和 skill 文档人工验收；本轮只覆盖 mock 与接口边界。

## 2026-07-01 电商套图 Skill Markdown 复核

### 已确认

- Skill Markdown 会被后端作为 `设计师 Markdown` 拼入 `/api/canvas/ecommerce-suite/prompts` 的文本模型上下文，不会在前台执行。
- 新增测试稿统一强调动态板块：根据产品图、参考图、用户需求和所选 skill 生成 3-5 个板块，不套固定五件套。
- 五个角色差异已拉开：Gloria 偏高转化品牌视觉，Paload 偏参考图结构拆解，Lumi 偏柔和生活方式，Kira 偏平台点击转化，RayYu 偏创意概念和品牌叙事。
- 新增文件已检查 UTF-8 无 BOM，并扫描危险脚本片段为空。

### 需要继续验证

- 需要用户在后台逐个上传 `.md` 后，用真实产品图和参考图观察动态板块是否符合各角色差异。

## 2026-07-01 电商套图模板选择卡复核

### 已确认

- 结果卡从 prompt 编辑器改为浅色板块选择卡，避免用户直接面对标题、prompt 和负面词输入区。
- 选择卡内部已移除 `套图模板` 标题，避免标题占用 grid 单元导致首个板块错位到右侧。
- 生图链路仍使用后端返回的 `promptPlans[]`，勾选状态只决定哪些板块提交给 `/api/canvas/ecommerce-suite/generate`。
- 生图提交已改为每个板块一个独立请求，4 个板块会形成 4 次后端 generate 调用；suite14 按用户确认的工作链恢复为前端立即并发发出多个单板块任务，不等待上一个完成。
- suite15 只优化失败卡片展示：上游 `upstream error: do request failed (request id: ...)` 不再整段占满卡片，主文案压缩为“上游图生图请求失败”，request id 小字保留，原始错误放在卡片 title 中。
- suite16 只优化成功卡片布局：图片下方四按钮白色区域改为图片内白色半透明浮层，hover/focus/触摸打开，压缩套图结果卡高度；不改变生图请求和自动上画布逻辑。
- suite17 只优化 skill 选择体验：五个默认设计师补本地头像，前台从原生 select 改为浅色头像列表，后台默认 skill 也补 avatarUrl；不改变 prompts/generate 请求体和 skill Markdown 拼装逻辑。
- 成功图片会自动触发旧画布 `canvas:add-generated-image-to-canvas` 事件；失败任务保留单板块重试按钮，重试成功后替换为完整图片卡。
- 护栏新增禁止编辑字段和黑底卡片回退的断言，范围仍限制在 `视频 / 电商套图Agent` 模式。

### 需要继续验证

- 需要在浏览器中用实际产品图、参考图和 skill 生成一次模板，人工确认卡片数量、名称和浅色视觉符合预期。

## 2026-07-01 图片节点卡片精简复核

### 已确认

- 图片节点空态 DOM 中右上徽标和底部状态栏会同时输出 `正常`，重复文字来自底部 `.flex.h-8` 状态栏。
- 用户后续明确要求顶部 `图片节点` 名称和顶部 `正常` 徽标也去掉，因此图片节点顶部 header 已整体隐藏。
- 本轮只通过 `assets/canvas-image-node-polish.css` 精简图片节点卡片，没有改旧 Canvas 主 bundle。
- `canvas-image-node-polish` 资源查询串已升级为 `20260701image10`，避免浏览器继续缓存旧空态样式。
- 静态护栏已增加图片节点 polish 资产读取、`image10` 版本、图片节点 header 隐藏和空态底部状态栏隐藏选择器检查。
- `assets/canvas-node-radius-fix.css?v=20260701title1` 负责通用节点标题锁定，移除 text cursor、hover 灰底和文本选择。
- 验证已通过：后端/桥接/图片节点 polish 语法检查、资产护栏、旧画布边界 smoke、前端 build、`git diff --check` 和 BOM 检查。
- 浏览器刷新后确认已加载 `canvas-image-node-polish.js/css?v=20260701image10` 和 `canvas-node-radius-fix.css?v=20260701title1`；当前项目刷新后没有图片节点 DOM 可做实时视觉断言。

### 需要继续验证

- 浏览器刷新后确认图片节点不再显示顶部 `图片节点` 名称和 `正常` 徽标，底部也不显示重复 `正常`。

## 2026-07-01 Canvas Chat 三模式空状态文案复核

### 已确认

- 空状态文案位于旧 Canvas Chat 的 `.message-list > .empty-state`，会在 `对话 / 快速 / 视频` 没有消息时显示。
- 本轮用 `assets/canvas-chat-prompt-flow.css` 统一隐藏该空状态，不改旧 Canvas 主 bundle。
- `canvas-chat-prompt-flow.js/css` 资源查询串已升级到 `20260701suite18`。
- 静态护栏已增加 `.canvas-chat-panel .message-list > .empty-state` 选择器检查。
- 浏览器刷新后确认已加载 `canvas-chat-prompt-flow.js/css?v=20260701suite18`，空状态元素仍在 DOM 中但 computed display 为 `none`。

### 需要继续验证

- 浏览器刷新后切换三个 tab，确认 `👋 / 灵感不间断 / 对话模式会保留你的上下文与参考图` 均不再显示。

## 2026-07-01 Canvas Chat 输入框默认文案复核

### 已确认

- 底部输入框默认文案来自旧 Canvas Chat composer 的原生 `placeholder`，不能通过重写 composer 解决。
- 本轮只在 `assets/canvas-chat-prompt-flow.js` 的现有同步周期里补 `syncComposerPlaceholder()`，把 `placeholder/data-placeholder` 统一为 `请输出你的提示词`。
- `canvas-chat-prompt-flow.js/css` 资源查询串已升级到 `20260701suite19`。
- 静态护栏已增加 `CANVAS_CHAT_PLACEHOLDER`、`syncComposerPlaceholder()` 和 placeholder 赋值锚点检查。

### 需要继续验证

- 浏览器刷新后确认底部输入框显示 `请输出你的提示词`，并切换 `对话 / 快速 / 视频` 后文案不回退。

## 2026-07-01 第三个 Tab 文案复核

### 已确认

- 第三个 tab 的旧底层文案可能仍由旧 Canvas 主 bundle 输出为 `视频`，因此本轮只在 `assets/canvas-chat-prompt-flow.js` 过渡层同步展示文案。
- 前台展示文案统一为 `agent电商套图`，`isSuiteMode()` 继续兼容旧 `视频`、旧 `电商套图Agent` 和当前 `agent电商套图` 三个别名。
- `canvas-chat-prompt-flow.js/css` 资源查询串已升级到 `20260701suite20`。
- 静态护栏已增加 `SUITE_TAB_LABEL`、`SUITE_MODE_ALIASES`、`syncSuiteTabLabel()` 和禁止旧硬编码 suite 判断回退的断言。

### 需要继续验证

- 浏览器刷新后确认 tab 显示为 `对话 / 快速 / agent电商套图`，点击第三个 tab 后电商套图 composer 仍出现，`对话 / 快速` 仍可切换。

## 2026-07-02 首页历史画布删除按钮复核

### 已确认

- 首页历史项目删除函数已在旧 HomeIndex bundle 中存在，后端 `DELETE /api/user/projects/:id` 也存在；本轮问题定位为首页卡片 hover 层与按钮层级/指针事件需要加固。
- `assets/home-overrides.css` 已补 `.history-delete { z-index: 5; pointer-events: auto; }` 和 `.history-hover { pointer-events: none; }`，不改旧 HomeIndex JS 和项目存储模块。
- 浏览器刷新后 computed style 确认新规则生效。
- UI 验证中先新建临时画布，再点击第一张临时卡片删除按钮；删除后卡片数从 3 降回 2，当前 URL 保持 `http://localhost:3456/`，页面提示“项目已删除”。
- 追加复核后确认：多个同名空白画布会让删除成功看起来像无变化；同时历史横向拖拽脚本可能在捕获阶段吞掉拖拽后的第一次 click。
- `assets/home-carousel-inertia.js` 已对 `button/a/input/textarea/select/[role="button"]/.history-delete` 放行，避免删除按钮参与横向拖拽；捕获 click 遇到交互元素时直接放行并清理拖拽状态。
- `assets/home-overrides.css` 已让删除按钮默认可见，减少必须 hover 才能精确点击的问题；`index.html` 已给首页覆盖 CSS 和轮播脚本加 `20260702delete1` 查询串，避免缓存旧交互脚本。
- 浏览器验证：直接点击临时画布删除按钮，卡片数 `4 -> 3`；先拖动历史列表再点击临时画布删除按钮，卡片数仍 `4 -> 3`；两次均停留首页并提示“项目已删除”。

### 需要继续验证

- 用户后续可在自己的目标画布卡片上再点一次删除，确认右上角按钮无需确认即可直接删除对应卡片。

## 2026-07-02 首页模型同步后端复核

### 已确认

- 首页旧 `HomeIndex` 原先把后端线路模型与 `fixedImageModels` 固定清单合并，导致页面出现 `Nano Banana`、`Gemini`、`Comfly` 等不完全来自后端的选项。
- `server.js` 原先 `/api/model-routes`、`/api/public/models`、`/api/user/models` 只读取 `IMG/TXT` 常量，后台 `admin.modelPrices` 只在后台模型价格页使用。
- 本轮新增统一模型归一化层：基础模型先来自路线默认模型，再叠加 `admin.modelPrices` 的价格、启停和新增模型覆盖。
- 首页旧包已改为不再合并固定图片模型，不再使用 `nano-banana-2` 固定默认值；刷新入口为 `HomeIndex-DAjDt0aj.js?v=20260702modelsync1`。
- 本地接口验证：当前后端图像模型列表只有 `GPT Image 2`，价格 10 点；估费接口 2 张图返回 20 点。
- 浏览器验证：首页模型按钮显示 `GPT Image 2`，页面文本中不再出现固定清单里的 `Nano Banana`、`Gemini`、`Comfly`。

### 需要继续验证

- 后续在后台新增一个测试模型并启用后，刷新首页确认新模型出现在下拉；再禁用该模型，确认首页不再展示。

## 2026-07-02 首页顶部播放按钮移除复核

### 已确认

- 用户截图箭头指向的按钮对应旧 HomeLayout 的 `header-icon-button visual-mode`，标题为 `样式 1：视频播放`。
- 本轮已从 `assets/HomeLayout-BeS5XdE3.js` 渲染结构中移除该按钮，并将 HomeLayout 动态 import 升级为 `HomeLayout-BeS5XdE3.js?v=20260702removeplay1`。
- `index.html` 主入口已升级到 `index-DglIsp_g.js?v=20260702removeplay1`，避免浏览器继续加载旧依赖表。
- 浏览器刷新后确认顶部按钮只剩 `导出`、`保存`、`历史记录` 和用户/AI入口；`.header-icon-button.visual-mode` 不存在，`样式 1：视频播放` 标题也不存在。

### 需要继续验证

- 用户刷新当前首页后确认截图中箭头位置不再出现圆形播放按钮。

## 2026-07-02 画布图片节点工具入口回滚复核

### 已确认

- 上一轮文字编辑新增的 `/api/image-tools/text-edit/ocr` 和 `/api/image-tools/text-edit` 已随 `server.js` 回滚移除。
- 图片节点工具栏数组已删除 `textEdit`、`removeBg`、`upscale` 三项；缓存查询串改为 `20260702remove-tools`。
- `/api/image-tools/settings` 已不再声明 `textEdit/upscale/removeBg`。
- 浏览器 3456 实测图片节点底部工具栏中不存在 `文字编辑`、`一键抠图`、`AI 超清放大`，`局部修改` 面板仍可打开。

### 需要继续验证

- 用户在自己的生产测试画布刷新后确认图片节点底部工具栏不再出现这三个入口。

## 2026-07-02 图片节点工具排版复核

### 已确认

- 本轮只处理截图中的旧画布图片节点排版，不恢复 `文字编辑`、`一键抠图`、`AI 超清放大`。
- 顶部 `.image-node-toolbar` 已改为贴图片左上方、最大宽度 760px、允许换行，并显式恢复 `height:auto`，避免旧竖向工具栏高度把背景拉成大面板。
- `格式/压缩` 对应 `.image-edit-overlay:has(.convert-panel)` 已改为 `left: calc(100% + 16px)`，不再沿用旧右侧竖向工具栏时代的 `+134px` 间距；窄屏时弹层落到图片下方。
- `canvas-image-node-polish.css` 查询串已升级到 `20260702layout2`，静态护栏已同步当前入口和 Canvas 动态 chunk 版本。
- `node scripts/verify-canvas-performance-assets.js` 与旧后端边界 smoke 均通过，后者确认新 `layout2` CSS 可由 3456 正常返回。

### 需要继续验证

- 浏览器刷新目标项目后当前没有图片节点 DOM 可读；后续有真实图片节点时，仍需肉眼确认工具条不再被左侧裁切，弹层与图片间距合理。

## 2026-07-02 图片节点工具条单行复核

### 已确认

- 图片节点工具条数组已删除 `key:"video", label:"生成视频"` 这一项；其它 `生成视频` 文案仅属于视频配置节点内部按钮，未扩大删除。
- 工具条样式已改为 `flex-wrap: nowrap`、`max-height: 52px`，保持单行紧凑展示。
- 入口资源升级到 `20260702toolbar1`，避免浏览器继续加载 `layout2/remove-tools` 旧版本。
- 静态验证、边界 smoke 和浏览器资源检查均确认 `toolbar1` 已生效；当前刷新后的项目没有图片节点 DOM，只能确认页面正文不再出现 `生成视频`。

### 需要继续验证

- 刷新当前画布后选中图片节点，确认工具条一行展示且不再出现 `生成视频`。

## 2026-07-02 图片节点工具条居中复核

### 已确认

- 工具条定位已从贴左改回以图片中心为锚点：`left: 50%` 和 `translateX(-50%)`。
- 工具条仍保持 `flex-wrap: nowrap`，按钮和文字最大宽度已收紧，避免恢复两行。
- `格式/压缩` 面板顶部偏移已提升到 `76px`，避免贴近画布顶边。
- CSS 查询串升级到 `20260702center1`，静态护栏已增加居中 transform 断言。
- 边界 smoke 确认 `center1` CSS 可由 3456 返回；浏览器刷新后也确认已加载该 CSS。当前项目刷新后没有图片节点 DOM，未能读取真实中心点差值。

### 需要继续验证

- 刷新当前画布后确认工具条在图片上方居中，`格式/压缩` 面板不再顶边。

## 2026-07-02 图片节点工具条文字完整显示复核

### 已确认

- 图片工具条按钮已取消最大宽度限制，`.tool-text` 已取消 `max-width: 72px` 和省略号。
- 工具条仍保持 `flex-wrap: nowrap` 与居中 transform，不恢复两行布局。
- CSS 查询串升级到 `20260702fulltext1`，避免浏览器继续加载截断文字的 `center1`。
- 浏览器刷新后确认已加载 `fulltext1` CSS；当前项目没有图片节点 DOM，无法直接读取长文案是否裁切。

### 需要继续验证

- 刷新当前画布后确认 `AI 智能消除`、`图片尺寸调整` 等长文案完整显示。

## 2026-07-03 生产状态可靠性验收复核

### 已确认

- 当前 3456 服务由 `F:\dianshang` 目录运行，`/api/health` 返回 `real-provider-ready`，真实 AI 网关 Key 已配置，数据库、上传目录和日志目录均指向主目录。
- 已完成生产向非付费验收：构建、后端语法、API 一次性数据库 smoke、前端路由、真实 Provider 护栏、旧画布边界、首页/画布 UI、移动端 UI、画布性能和帧预算均通过。
- 后台源码页 dashboard DOM 探针确认标题为 `控制台 Dashboard`，颜色为 `rgb(15, 23, 42)`，字重为 `900`，并加载最新 `frontend/dist` 资源。
- Playwright 残留进程已清理，当前残留计数为 0。

### 需要继续验证

- 真实 AI 生图、真实文本模型、真实扣费和真实外部网关链路需要用户确认后再触发，避免未经确认的付费调用。
- 邮件发送、支付充值和对象存储当前在健康检查中仍为关闭状态，不能认定为完整生产闭环。
- `smoke-admin-pages-ui.ps1` 的完整后台截图流程仍受 Playwright CLI run-code 挂住影响，建议后续改造成更轻量、可超时退出的后台页面探针后再纳入稳定门禁。

## 2026-07-03 画布清晰度三档复核

### 已确认

- 根因是图片模型接口把 provider 画质枚举和画布清晰度尺寸档混用，且默认 variants 只有 `clarity=1k`。
- `server.js` 已统一图片模型 `qualities` 为 `1k / 2k / 4k`，并按三档生成 variants。
- `scripts/smoke-api.ps1` 已增加接口回归断言，临时数据库 API smoke 通过。
- 当前 3456 服务已重启，`/api/model-routes?group=image` 和 `/api/public/models?routeId=pub_route_openai_gpt_image_2` 均返回 `1k / 2k / 4k` variants。

### 需要继续验证

- 用户当前已打开的画布页面需要刷新一次，旧页面内存中的模型选项才会重新读取接口。
- 选择 `2K` 或 `4K` 后点击生成会走真实 Provider，可能产生真实外部调用和扣费，应由用户自行确认后测试。

## 2026-07-03 Docker 运行目录复核

### 已确认

- `docker/docker-compose.yml` 使用上级目录作为 build context，继续复用根目录 `Dockerfile`，容器名为 `dianshang-internal-app`。
- 数据、上传和日志均使用可见 bind mount：`docker/data`、`docker/uploads`、`docker/logs`，方便内网部署备份。
- `docker/.env.example` 提供内网运行配置模板，本地 `docker/.env` 已生成且被忽略。
- `docker compose config` 校验通过，新增 Docker 文本文件无 BOM。

### 需要继续验证

- 如果要让 Docker 使用 `3456`，需要先停止当前开发目录的 Node 服务；否则把 `docker/.env` 的 `HOST_PORT` 改成 `3457`。
- 真正启动容器前，需要把 `docker/.env` 中的 `JWT_SECRET` 和真实 Provider 配置改成内网生产值。

## 2026-07-03 图片工具面板窗口化复核

### 已确认

- 图片节点工具条已删除 `AI 智能消除` / `smartErase`，当前浏览器工具条文本为 `AI 扩图`、`格式/压缩`、`反推提示词`、`局部修改`、`图片尺寸调整`、`图片裁剪`、`添加到聊天`。
- `局部修改` 已从 pending 改为 ready；浏览器中点击后可打开 `局部修改` 面板，面板包含 `data-hjm-panel-window="true"` 和右下角缩放手柄。
- `.image-edit-overlay` 标题栏拖拽实测生效：格式/压缩面板从 `(1370,383)` 移动到 `(1270,453)`，未拖动画布节点。
- 右下角缩放实测生效：格式/压缩面板从约 `336x576` 放大到约 `427x647`，内容区 `overflow:auto`。
- 笔刷坐标已从屏幕坐标直减 rect 改为按 canvas 内部像素比例换算；50% 缩放下预览 canvas 内部 `215x183`、屏幕显示约 `135x114`，笔刷拖拽无运行时错误。
- 资产护栏和旧画布边界 smoke 已同步到 `20260703panel2` 并通过。

### 需要继续验证

- 自动化浏览器在 200% 缩放下能读取到预览 canvas 内部 `215x183`、屏幕显示约 `539x457` 的非 1:1 几何，但面板被放大到自动化可点击区域外，未能完成 200% 实笔刷落点截图；代码锚点和 50% 实测已覆盖偏移修复核心路径。
- 浏览器验收后当前画布缩放值停在 `90%`，测试面板已关闭；如需恢复到用户原先视图，可手动点一次缩小或刷新项目视图。

## 2026-07-03 首页历史画布卡片点击复核

### 已确认

- 根因是 `assets/home-carousel-inertia.js` 在 `pointerdown` 阶段立刻对 `.history-track` 调用 `setPointerCapture`，普通点击最终也会以轨道容器作为 click target，导致 `.history-card` 上的打开项目事件收不到。
- 修复后只有超过拖拽阈值并进入真实横向拖动时才捕获指针，普通点击保留原生目标并继续触发历史画布卡片的 Vue click。
- `index.html` 已把首页轮播脚本查询串升级为 `home-carousel-inertia.js?v=20260703open1`，避免继续加载旧拦截逻辑。

### 需要继续验证

- 用户当前浏览器需要刷新首页后再点历史画布卡片，确认能进入对应 `/canvas/<projectId>`。
- 本轮不改历史项目数据结构、不改旧 Canvas 主 bundle、不触发真实 Provider。

## 2026-07-03 局部修改提交节点复核

### 已确认

- `局部修改/文字编辑` 提交路径不再等待 `/api/image-tools/inpaint` 返回后才创建结果节点，而是先创建一个 `loading:true` 的图片节点。
- 该节点初始进度为 `18`，文案为 `已提交请求`，符合图2所示的生图节点提交态。
- 新增图片节点通过 `connect:false` 跳过 `imageOrder` 边创建，不会自动链接原图片节点或其它画布节点。
- 后台完成后只回填同一个新节点的图片 URL、缩略图、尺寸、`progress=100` 和错误状态，不新增第二个结果节点。
- 默认图片工具结果节点仍保留原连线行为，避免影响扩图、压缩、尺寸调整等既有链路。

### 需要继续验证

- 当前服务已配置真实 Provider，浏览器里实点 `提交` 可能触发真实外部调用和扣费；需要用户确认后再做端到端提交验收。
- 若后续要把其它图片工具也改成无连线提交态，应先明确每个工具的画布关系语义，不能直接全局关闭 helper 的默认连线。

## 2026-07-03 局部修改 mask 结果复核

### 已确认

- 用户实测结果里底部涂抹区域被明显重绘，说明前端 mask 字段并非完全丢失。
- 结果同时把瓶身标签文字洗掉，说明上游模型对“去掉文字”的理解越过了涂抹区边界，黑白 mask 对当前 Provider 约束不够稳。
- 前端现在会同时提交 `maskBase64` 和 `maskAlphaBase64`，其中 `maskAlphaBase64` 将涂抹区域转成透明编辑区，适配更多 OpenAI-compatible Images Edit 实现。
- 后端优先使用 `maskAlphaBase64`，保留旧 `maskBase64` 回退，避免破坏历史旧画布请求。
- 默认提示词已强化未涂抹区域保留，特别点名文字、品牌标识、瓶身标签和商品结构不要改。

### 需要继续验证

- 需要用户刷新画布加载 `20260703mask1` 后，再用更窄的 mask 重试；真实提交会触发 Provider 调用和可能扣费。
- 如果 `maskAlphaBase64` 后仍大幅改动未涂抹区域，下一步应记录一次上游响应与请求 meta，判断是 Provider 忽略 mask 还是 GPT Image 2 模型本身软约束问题。

## 2026-07-03 批量生图请求形态复核

### 已确认

- 截图中的 `4 张` 批量出图不是前端直接请求中转站，而是后端 `/api/generate/tasks` 或 `/api/template/generate-image` 进入 Provider 适配器。
- 纯生图和带参考图的图生图适配器都固定向上游发送单张请求：JSON 生图为 `n: 1`，multipart 图生图为 `form.append('n', '1')`。
- 高延迟根因更可能是旧实现串行等待：第 1 张返回后才发第 2 张，4 张会累加 4 次上游耗时。
- 已改为并发单张：最多 4 个独立请求同时发出，返回后按请求顺序合并图片，扣费和任务记录仍按用户选择的张数计算。
- 覆盖脚本已增加防回退断言，避免后续重新变成 `n=4` 单请求或串行 `for count`。

### 需要继续验证

- 本轮只跑 mock/disposable API 和静态请求形态护栏，没有主动触发真实中转付费调用。
- 真实环境如仍慢，下一步应记录每个独立请求的开始/结束时间和上游状态码，区分是中转并发限流、单张模型耗时，还是图片参考上传体积导致的慢。

## 2026-07-03 图片生成节点连续提交复核

### 已确认

- 截图对应的是旧画布 `ImagePromptGenerateNode`，此前按钮禁用和点击入口都绑定到同一个生成 composable 的 `loading`。
- 点击后结果进度节点已经会先创建，但原图片生成节点会因为 `loading=true` 被锁住，不能继续点击生成。
- 已移除原节点入口的 `if(r.value)return`，并把按钮禁用改成只看 `!Ce.value`，也就是只在没有提示词且没有参考图时禁用。
- 按钮文案不再被请求中的 spinner 替换；生成中的状态继续由右侧独立结果节点承载。
- 资源查询串升级到 `20260703freegen1`，旧页面需要刷新后才会拿到这版 Canvas bundle。

### 需要继续验证

- 未主动触发真实 Provider 生图；用户刷新画布后可在同一图片生成节点上连续点两次，预期会出现两批独立进度结果节点。
- 如果连续点击很多次，后端会同时接收多批真实任务，仍会按模型价格和张数扣算力；真实使用时需要留意余额和上游限流。

## 2026-07-03 图片 Provider 过载保护复核

### 已确认

- 上一版“并发单张”能避免 `n=4` 大请求，但会让 4 张批量或连续点击时同时向中转发出多次真实图片请求。
- 带参考图的图生图路径每次请求都会 multipart 上传参考图；并发 4 次会把同一批参考图重复同时上传到中转，容易造成高延迟或限流。
- `server.js` 已加入进程内全局图片 Provider 队列，文生图和图生图都必须排队进入真实上游请求。
- 默认相邻真实图片请求间隔为 `1500ms`，且可用环境变量调整；请求返回的 `request` meta 会带 `queueMode: serial-delayed` 和 `queueDelayMs`。
- 覆盖脚本已反向更新：现在禁止 `Promise.all(Array.from({ length: count }, async ...))` 的图片上游并发形态。

### 需要继续验证

- 本轮不触发真实中转扣费调用；需要用户刷新后用 `4 张` 小批量确认中转延迟是否下降。
- 如果仍过载，下一步优先把延迟从 `1500ms` 提高到 `3000ms` 或增加按线路/模型的队列状态日志。

## 2026-07-03 图片生成提示词识别复核

### 已确认

- 截图里的 `根据图1生成拼多多电商主图` 已进入前端请求体，旧画布节点会以 `prompt: de` 发送到 `/api/template/generate-image`。
- 本地最新 `generations` 记录里也能看到最终 prompt 包含 `用户需求：根据图1生成拼多多电商主图`，所以不是输入框内容丢失。
- 旧后端 prompt 对图生图过于强调“保持产品包装与识别信息一致”，对“必须执行用户目标”的约束不够强，容易让模型输出接近参考图的商品摆拍。
- 已增强 `buildEcommerceImagePrompt`：用户需求优先、参考图不得直接复刻、拼多多/PDD 自动补强为高点击正方形电商主图方向。

### 需要继续验证

- 未触发真实 Provider 重新生图；用户需要刷新后用相同提示词再试。
- 如果仍然只是复刻参考图，下一步应在请求 meta 中记录上游 request id 和最终 prompt，并尝试为“主图/海报/场景/标签”做更细的模板化 prompt 分支。

## 2026-07-03 图生图提示词松绑复核

### 已确认

- 上一版为了解决“拼多多主图不明显”加入的平台模板和失败判定过硬，可能限制图生图模型发挥。
- `server.js` 已删除 `ecommercePlatformPromptHint`，不再按 `拼多多/PDD` 自动补充高点击主图模板。
- 后端电商图生图 prompt 现在只保留基础约束：理解用户需求、参考图作为依据、画面清晰自然、避免水印/乱码/畸形。
- 护栏脚本已反向约束，禁止恢复 `用户提到拼多多/PDD`、`视觉执行要求`、`视为失败` 等强格式。

### 需要继续验证

- 未触发真实 Provider 扣费调用；用户刷新后再测试同一节点。
- 如果后续某些场景仍需要强提示词，应放到用户输入或模板配置里，而不是后端全局硬编码。

## 2026-07-03 图生图最小提示词复核

### 已确认

- 用户最终确认：后端只需要加一个 `专业电商设计师` 身份，不需要额外格式限制。
- 唯一保留的基础要求为：产品不要拉伸变形、文字清晰、不要出现光斑和乱码。
- `server.js` 已按该边界压缩提示词；请求仍会保留用户原始 `用户需求`。
- 护栏脚本已禁止回退到 `自由完成画面创作`、`适合电商展示`、平台识别和其它长提示词。

### 需要继续验证

- 未触发真实 Provider 扣费调用；重启后端后生效。

## 2026-07-03 图片上传节点单击/双击交互复核

### 已确认

- 空图片上传节点之前用透明 `input[type=file]` 覆盖整块上传区域，导致单击节点主体会直接打开文件选择器。
- 两个旧 Canvas bundle 已把该图片 file input 改为隐藏输入框，并把触发文件选择器的动作迁移到上传区域 `dblclick`。
- 单击空图片节点时不再由 file input 截获点击，预期由 Vue Flow 执行节点选中。
- 资产护栏脚本已要求双击触发逻辑存在，并禁止图片节点回退到透明覆盖式 file input。

### 需要继续验证

- 用户在当前画布里实测：单击空图片节点应只出现选中边框，双击上传区域才弹出文件选择器。
- 本轮未修改视频上传节点，它仍保留原来的点击上传行为。

## 2026-07-03 Docker 内网测试目录复核

### 已确认

- `docker/` 目录已作为内网运行目录整理：Compose 从 `F:\dianshang` 构建镜像，运行数据挂载到 `docker/data`、`docker/uploads`、`docker/logs`。
- `docker/docker-compose.yml` 已包含最新图片 Provider 队列相关变量：`IMAGE_PROVIDER_TIMEOUT_MS`、`CANVAS_DIALOG_ANALYSIS_TIMEOUT_MS`、`IMAGE_PROVIDER_REQUEST_DELAY_MS`。
- `docker/verify-internal.ps1` 已加入 Docker daemon 前置检查、Compose 配置检查、健康检查、API smoke、前端路由 smoke 和 Provider guard smoke。
- `.dockerignore` 已排除 `docker/.env` 和 Docker 运行数据目录，避免密钥/SQLite/uploads/logs 进入镜像上下文。
- 静态验证通过：PowerShell 解析通过，`docker compose config` 通过，`git diff --check` 无空白错误。

### 需要继续验证

- 当前机器 Docker Desktop Linux Engine 未运行，实际 `docker compose up --build -d` 未执行成功。
- `com.docker.service` 当前会话无权限启动；需要用户手动启动 Docker Desktop 或用管理员权限启动 Docker 服务后，再执行 `powershell -NoProfile -ExecutionPolicy Bypass -File "F:\dianshang\docker\verify-internal.ps1"`。
- 长期内网试运行前必须替换 `docker/.env` 中的 `JWT_SECRET` 占位值；`ENABLE_REAL_PAYMENT` 继续保持 `false`。

### 复测结果

- Docker Engine 后续恢复可用后，已用 `HOST_PORT=3458` 成功执行 `docker/verify-internal.ps1`。
- 容器 `dianshang-internal-app` 已启动并进入 `healthy`，访问地址为 `http://127.0.0.1:3458`。
- 已通过健康检查、API smoke、前端路由 smoke 和 Provider guard smoke；当前运行模式为 `mock`，未启用真实 AI、邮件、支付或对象存储。

## 2026-07-03 Docker 生产态保存方式复核

### 已确认

- 旧画布本地 JSON 自动保存依赖浏览器文件夹写入授权；Docker/Node 后端无法替浏览器授权。
- 内网 HTTP 生产地址下，本地文件夹保存很可能不可用；`localhost` 或 HTTPS 才是浏览器支持这类 API 的稳定环境。
- 旧画布云端保存实际发送 `{ title, workflowJson }` 到 `/api/workflows/:id/save-json`。
- 后端已兼容 `workflowJson` 并在读取项目时解包，云端 JSON 会落到 Docker 挂载的 SQLite `DB_PATH=/app/data/data.db`。
- API smoke 已补充 `workflowJson` 覆盖，避免后续只测 `data` 包装而漏掉旧画布真实请求体。

### 需要继续验证

- 本轮未直接重启现有生产 Docker 容器，避免影响当前业务会话。
- 确认可重启后，需要重新执行 `powershell -NoProfile -ExecutionPolicy Bypass -File "F:\dianshang\docker\verify-internal.ps1"` 并在画布里点一次“云端自动保存/立即保存”。

## 2026-07-03 注册与工作流本地保存复核

### 已确认

- 注册后端默认允许不带验证码直接创建用户；只有显式设置 `REQUIRE_REGISTER_EMAIL_CODE=true` 才恢复验证码校验。
- 新注册用户默认余额为 0；积分获取路径改为兑换码，smoke 会创建一次性兑换码并用新用户兑换后再测扣费生图。
- `save-json`、`save-local-json` 和 `local-json` 共用同一套工作流 JSON 归一化逻辑，旧画布的 `workflowJson` 请求体会直接保存为包含 `nodes/edges/viewport/storage` 的 JSON。
- Docker Compose 显式挂载 `WORKFLOW_DIR=/app/data/workflows`，文件不会写进镜像层，主机侧可在 `docker/data/workflows/<userId>/` 查看。
- 旧画布本地文件夹保存失败时会降级调用云端保存接口，并把面板状态标成服务器本地 workflows。

### 需要继续验证

- 当前已修改代码但未重启正在运行的 Docker 容器；容器继续跑旧镜像时不会有直注册和本地 JSON 文件兜底。
- 浏览器 File System Access API 仍只在安全上下文稳定可用；HTTP 内网地址下应以服务器本地 workflows 目录作为生产兜底。

## 2026-07-04 内网画布手动保存复核

### 已确认

- 已进入当前内网页面项目 `project_1783129273163_lcuac0uat` 并打开顶部保存面板。
- 初次点击 `立即保存` 时页面日志显示 `/api/workflows/:id/save-json` 返回 401，原因是当前内网页面没有登录态。
- 写入 Docker 测试环境默认 `admin` 登录态后再次点击 `立即保存`，后端保存成功。
- Docker 数据库 `F:\dianshang\docker\data\data.db` 中存在项目 `project_1783129273163_lcuac0uat`，保存内容为 `version=1`、`saveType=cloud`、2 个节点、1 条连线。
- 主机侧 workflow 文件已落到 `F:\dianshang\docker\data\workflows\user_mr4r2o2h88a7cdbe\project_1783129273163_lcuac0uat.workflow.json`，文件根层同样包含 2 个节点和 1 条连线。

### 需要继续验证

- 当前保存使用的是 Docker 测试管理员账号；后续其他电脑正式使用前，需要每个用户先登录，或者补充更清晰的未登录提示与登录引导。
- 首页目前仍没有独立的云端手动保存入口；手动保存入口在画布顶部 `保存` 面板内。

## 2026-07-04 注册与找回密码复核

### 已确认

- 当前代码下 `/api/auth/register` 不再要求注册邮箱验证码；必填项只有用户名、邮箱和密码，缺字段时返回 `请填写用户名、邮箱和密码`。
- 旧注册弹窗通过 `assets/auth-direct-register-bridge.js` 隐藏并禁用注册验证码字段，同时增加内网免验证码提示和提交前空字段检查。
- `/api/auth/send-reset-code` 在 mock 邮件模式下返回 `code`，页面可以拿到测试验证码；真实邮件模式 `ENABLE_REAL_EMAIL=true` 时仍不应暴露验证码。
- `scripts/smoke-api.ps1` 已覆盖找回密码闭环：临时用户注册后发重置验证码、重置密码、用新密码登录。
- 已执行 `scripts/smoke-api-disposable.ps1`，临时后端和临时数据库下注册、找回密码、登录、项目保存、生图 mock 和后台 smoke 均通过。

### 需要继续验证

- 当前 `192.168.0.39:3456` Docker 容器尚未重建；用户确认重启后才能在内网页面看到新提示和 mock 重置验证码。
- 真实邮件发送仍未接 SMTP；生产正式使用前需要配置真实邮件服务或保留内网 mock 验证码策略。

## 2026-07-04 Docker 注册重启复测

### 已确认

- 已执行 `docker compose up --build -d`，镜像 `dianshang-internal-app:latest` 重新构建，容器 `dianshang-internal-app` 启动后为 `healthy`。
- 内网接口 `http://192.168.0.39:3456/api/health` 返回数据库正常。
- 通过内网接口直接注册一次性测试账号，注册响应包含 token；随后用同一账号密码登录成功，并能读取 `/api/user/profile`。
- 浏览器注册页 `/register` 已显示“当前内网注册无需邮箱验证码”提示。
- 复测时发现旧桥接脚本会把邮箱输入框误隐藏；已修正为只隐藏真正的验证码框，并更新 `index.html` 脚本版本号以刷新缓存。
- 修正后已再次重建 Docker；容器返回的新脚本已确认不再包含验证码 placeholder 宽匹配，且包含 `type === 'email'` / `autocomplete === 'email'` 排除逻辑。
- 最终容器状态：`dianshang-internal-app` 为 `healthy`，端口映射 `0.0.0.0:3456->3456/tcp`。

### 需要继续验证

- 本轮不会清理 Docker SQLite 中的一次性注册测试用户；如后续需要清理，可在管理员后台或数据库维护时统一处理。
- 内置浏览器自动化在后续 DOM 读取时多次超时；页面最终点击可由用户在当前浏览器手动确认，接口与容器脚本验证已经通过。

## 2026-07-04 Docker 真实 API 配置复核

### 已确认

- Docker 端原先 `ENABLE_REAL_AI=false`，且 `NEW_API_BASE`、`NEW_API_KEY`、`AI_API_BASE`、`AI_IMAGE_KEY`、`AI_TEXT_KEY` 多为占位值，因此实际生图处于 mock。
- 根目录 `F:\dianshang\.env` 中存在可用的原 Packy API 配置；Docker Compose 实际读取的是 `F:\dianshang\docker\.env`。
- 已备份 Docker `.env`，并将生产测试端切为 `AI_PROVIDER_GATEWAY=direct`，使用 `https://www.packyapi.com/v1` 和原有图片/文本 key。
- 已执行 `docker compose up -d --force-recreate`；容器 `dianshang-internal-app` 为 `healthy`。
- `/api/health` 确认 `providers.ai.mode=real-provider-ready`、`enabled=true`、`gateway=direct`、`imageKeyConfigured=true`、`textKeyConfigured=true`。

### 需要继续验证

- 本轮只验证环境变量和 Provider 状态，未主动发起真实生图，避免产生不必要的真实 API 消耗。
- 真实生图首测建议使用小尺寸、1 张图和明确测试提示词，便于确认扣费、日志、生成记录和错误回显。

## 2026-07-04 未登录强制登录复核

### 已确认

- 旧用户中心 bundle 硬编码了 `guest / guest@erdan.ai` 作为 `auth_user` 缺失时的兜底展示，这是截图中默认账号的来源。
- 已将两个用户中心 bundle 的兜底文案改为 `未登录 / 请先登录或注册`，避免即使守卫加载延迟时仍显示默认账号。
- 已在全站加载的 `user-center-data-bridge.js` 中加入受保护路由守卫；未登录进入用户中心、画布、图库、模板等功能页会跳转登录页。
- 强制登录页会隐藏关闭按钮和返回首页按钮，并拦截取消点击与 `Escape`。
- 已重建 Docker；HTTP 资源验证确认首页加载 `user-center-data-bridge.js?v=20260704authguard1`，守卫脚本包含 `isProtectedPath` 和 `uc-auth-forced`，用户中心 bundle 不再包含 `guest@erdan.ai`。
- 重建后 `/api/health` 仍为 `real-provider-ready`，真实 API 配置未被覆盖。

### 需要继续验证

- 需要在用户当前浏览器手动退出登录并访问 `/user/center`、`/canvas/...` 做最终交互确认；本轮未主动清理当前浏览器登录态。
- 当前保护仍在旧资产过渡层，未来源码路由全面接管后需要迁移为正式前端路由守卫。

## 2026-07-04 首页云端保存入口复核

### 已确认

- 首页保存面板的 `立即保存` 在云端模式下原先只显示提示，没有跳转动作。
- 已改为优先读取 `ai-canvas-last-project-id` / `ai-canvas-new-project-id`，其次取首页项目列表第一项，进入对应 `/canvas/:id`。
- 若没有任何可用项目，则调用首页现有新建画布逻辑进入新画布。
- 进入画布后通过 toast 提醒用户在画布顶部保存面板点击 `立即保存`。
- 已执行 Docker 重建，容器 `dianshang-internal-app` 为 `healthy`；`/api/health` 确认真实 API 仍为 `real-provider-ready`。
- HTTP 资源验证确认旧文案 `主页暂无云端手动保存入口` 已移除，并包含进入画布/新建画布后的保存提示。

### 需要继续验证

- 需要在用户当前浏览器手动选择云端自动保存并点击 `立即保存`，确认页面实际跳转符合预期；本轮未触发真实生图。

## 2026-07-04 后台登录统一复核

### 已确认

- `/admin/login` 实际由源码后台 `frontend/dist` 提供，截图中的“旧后台”是迁移期遗留文案，不是当前目标架构。
- `AdminLoginSource.vue` 已移除 `legacyUrl` 和“旧版后台登录 / 旧版后台控制台”链接。
- 管理员登录成功后改为直接 `router.replace()` 到 `redirect` 指向的后台页；没有 redirect 时进入 `/admin/dashboard`。
- 已登录管理员访问 `/admin/login` 会自动进入后台控制台，避免停留在登录页。
- `smoke-source-frontend-ui-runner.js` 已同步为验证后台登录后进入 `/admin/dashboard`。
- Docker 重建后容器 `dianshang-internal-app` 为 `healthy`；`/api/health` 仍为 `real-provider-ready`，真实 API 配置未被覆盖。
- HTTP 资源验证确认容器侧新登录资源旧文案已移除，且包含 `/admin/dashboard` 跳转逻辑。

### 需要继续验证

- 需要用户当前浏览器 `Ctrl + F5` 后手动登录一次，确认实际跳转到 `/admin/settings` 或 `/admin/dashboard`；本轮未运行 Playwright 自动点击，避免触发新工具下载。

## 2026-07-04 兑换码与系统设置复核

### 已确认

- 兑换码页此前明确写着“只读迁移版”，没有创建表单，这是“兑换码没添加兑换码”的直接原因。
- 后端兑换码创建和删除接口已存在，前端已补 `createAdminRedeemCode` 与 `deleteAdminRedeemCode` 封装。
- 兑换码管理页已新增创建表单，支持兑换码、算力额度、可兑换次数、启用状态；列表项支持删除。
- 已用一次性测试码验证后端创建、查询、删除闭环，删除后测试码不残留。
- 系统设置接口响应约 7ms，后端不是卡死来源。
- 系统设置页的 computed 已改为纯读取，不再在渲染计算中写入 `draft.value.ecommerceSuiteAgent`。
- 前端构建、源码路由检查通过；Docker 已重建，容器为 `healthy`，真实 API 状态未被覆盖。

### 需要继续验证

- 需要用户当前浏览器 `Ctrl + F5` 后手动打开 `/admin/redeem-codes` 新增一个业务兑换码，并点击 `/admin/settings` 确认不再卡死。

## 2026-07-04 内网测试生产收口复核

### 已确认

- 当前架构定位为单机 Docker 内网测试生产，后端唯一入口仍是 `server.js`。
- 已增加生产模式强 `JWT_SECRET` 校验，避免 Docker 默认占位 secret 被用于准生产。
- 已增加 bootstrap 管理员环境变量，服务不再每次启动重置 `admin/admin123`。
- 已增加 `CORS_ORIGINS` 白名单配置，支持内网来源收口。
- 已新增内网备份脚本和 smoke 脚本；smoke 不触发真实生图。
- 已新增 `docs/internal-production-runbook.md`，记录发布、备份、恢复和当前能力边界。
- 已发现并修复密码哈希与 `JWT_SECRET` 耦合造成的迁移问题：通过 `PASSWORD_LEGACY_SECRETS` 兼容旧哈希，登录后自动重哈希；默认 `admin/admin123` 已迁移到 bootstrap 强密码。
- 已完成 Docker 重建，容器 `dianshang-internal-app` 为 `healthy`；`/api/health` 确认真实 AI 为 `real-provider-ready`，邮件/支付/对象存储关闭。
- 已完成 `scripts/smoke-internal-prod.ps1`，覆盖健康检查、管理员登录、后台设置、兑换码一次性创建/查询/删除、前台旧资产和后台源码资产访问。
- 已完成 `scripts/backup-internal-prod.ps1` 备份，生成 `F:\dianshang\docker\backup\internal-prod-20260704-131428`。
- 已恢复演练到临时目录 `F:\dianshang\docker\backup\restore-check-20260704-131452`，备份 SQLite `integrity_check=ok`。

### 剩余风险

- 当前仍是单机 Docker + SQLite 内网测试生产，不具备公网正式生产等级。
- 本轮未触发真实生图，避免 API 消耗；真实 AI 首测仍需单独用低成本参数验证扣费、记录和错误回显。
- 邮件、支付、对象存储仍为关闭状态；进入正式生产前必须补齐对应方案。

## 2026-07-04 工作台品牌文案替换复核

### 已确认

- 根入口浏览器标题已由 `二蛋` 改为 `爱泊缇 AI 工作台`。
- 源码后台入口标题已由 `哈吉米 AI 工作台` 改为 `爱泊缇 AI 工作台`，并已重新构建 `frontend/dist`。
- 后端默认后台设置 `siteName` 已改为 `爱泊缇 AI 工作台`。
- 当前 Docker 数据库已有 `admin.settings.siteName` 已单字段迁移为 `爱泊缇 AI 工作台`。
- 旧前台 i18n 登录/注册标题已改为 `登录爱泊缇 AI 工作台` 与 `注册爱泊缇 AI 工作台`。
- Docker 重建后容器为 `healthy`；HTTP 验证确认 `/`、`/admin/login` 和旧前台 i18n 资源均返回新品牌文案。

### 剩余风险

- 历史文档、历史进度记录和模型线路名里仍可能保留 `哈吉米/哈基米` 作为历史上下文或旧线路名称，本轮未批量改写历史记录。

## 2026-07-04 前台登录与后台登录隔离复核

### 已确认

- 前台登录 `/login` 调用 `/api/auth/login`，后台登录 `/admin/login` 调用 `/api/admin/login`，接口入口已保持分离。
- `/api/auth/login` 已拒绝管理员账号，防止普通前台登录保存管理员身份到用户会话。
- 源码后台登录成功后保存到 `admin_auth_token` / `admin_auth_user`，不再覆盖普通前台的 `auth_token` / `auth_user`。
- HTTP 拦截器已按 `/api/admin/*` 路径选择管理员 token，其余接口继续选择普通用户 token。
- 后台页面退出按钮已改为清理 `clearAdminAuthSession()`，不再清掉普通用户登录态。
- 前台和后台源码登录页均已移除 `填入默认账号`、`admin123` 和未登录直达控制台入口。
- 已重新构建 `frontend/dist` 并重建 Docker；容器 `healthy`。
- 验证确认普通登录管理员账号返回 403，后台登录管理员账号成功；内网 smoke 脚本通过。

### 剩余风险

- 这次改变了浏览器会话键，已经登录的管理员旧 `auth_token` 不会再作为后台 token 使用，需要重新从 `/admin/login` 登录一次。

## 2026-07-04 兑换码新增区 UI 可读性复核

### 已确认

- 截图问题来自新增兑换码表单在超宽屏下整行铺开，兑换码、额度、次数、启用和按钮距离过远，输入框边界不明显。
- 已将新增表单改为最大宽度 1040px 的紧凑栅格，整体加浅色底和边框，避免字段散到整屏。
- 已提高 label 文字对比度，并给输入框和数字输入框设置可见边框、白底和焦点态。
- 已把启用开关放入独立白底边框块，避免漂在空白区域。
- 已重新构建 `frontend/dist` 并重建 Docker；运行 CSS 包包含新样式。
- 内网 smoke 已通过，兑换码创建、查询、删除接口未受影响。

### 剩余风险

- 用户当前浏览器可能缓存旧 CSS，需要对 `/admin/redeem-codes` 执行 `Ctrl + F5` 后查看新版布局。

## 2026-07-04 后台旧管理员 token 自动迁移复核

### 已确认

- 后台登录态拆分后，旧浏览器中只有 `auth_token` / `auth_user`，没有 `admin_auth_token` / `admin_auth_user`，因此 `/admin/login` 不会自动跳转。
- 已增加兼容迁移：仅当旧 `auth_user.role` 为 `admin` 且存在旧 `auth_token` 时，才复制为后台专用 token。
- 普通用户 token 不会迁移到后台会话，仍不能进入后台。
- `/admin/login` 页面加载时会先尝试迁移；成功后直接进入 redirect 指向的后台页或 `/admin/dashboard`。
- 已重新构建 `frontend/dist` 并重建 Docker；运行 bundle 已包含兼容迁移逻辑。
- 内网 smoke 已通过，后台设置和兑换码 CRUD 正常。

### 剩余风险

- 如果浏览器里旧 token 已过期或 `auth_user` 被清空，仍需要重新在 `/admin/login` 登录一次。

## 2026-07-04 后台系统唯一化复核

### 已确认

- `/admin` 之前没有进入源码后台 fallback，会落到根旧前台 SPA；现在 `server.js` 统一用 `/admin` 前缀规则分发到 `frontend/dist/index.html`。
- 根入口不再加载 `admin-api-source-route-bridge.js`、`admin-api-form-labels.js`、`admin-visual-polish.css`。
- 根旧前台主包中旧 `/admin/login`、`/admin` 路由块已移除，旧后台懒加载 chunk 名称已替换为 tombstone。
- 根 `assets/` 下旧后台 UI chunk 已删除，当前只剩 `admin-source-only-guard.js`、`admin-removed.js`、`admin-removed.css` 这三个后台收口辅助文件。
- `node --check`、源码后台构建、源码路由检查和 `git diff --check` 均通过。

### 剩余风险

- 当前运行中的 Docker 容器还未在本轮重建；浏览器实际看到的新分发规则需要下一次 `docker compose up --build -d` 后生效。
- 已经打开的旧前台页面可能仍持有旧 JS 内存状态，部署后建议刷新页面再进入 `/admin`。

## 2026-07-04 注册页邮箱必填提示复核

### 已确认

- 截图中的注册表单用户名和密码已填写，但邮箱为空；当前后端注册接口仍要求邮箱，因此拦截是符合现有账号契约的。
- 旧文案“无需邮箱验证码”和邮箱占位“接收验证码”组合在一起会误导用户，以为邮箱也不用填。
- 旧前台桥接脚本已把提示改为“验证码不用，邮箱仍必填”，并把邮箱占位改成找回密码用途。
- 旧前台桥接脚本已对 warning 做 1.8 秒去重，并在拦截时调用 `stopImmediatePropagation()`，减少重复提交和重复 toast。
- 源码注册页已增加前端必填校验，不会再直接把空邮箱提交到后端。
- 后端 `/api/auth/register` 缺字段文案已同步说明“当前内网注册无需邮箱验证码”。
- 构建、路由检查、JS 语法检查和 diff 检查均通过。

### 剩余风险

- 邮箱仍是必填字段；如果后续要完全取消邮箱，需要调整数据库唯一约束、找回密码流程和注册 API 契约，不能只改前端。
- 当前 Docker 容器未在本轮重建；上线到内网后需要强刷注册页，避免浏览器继续使用旧 bridge 缓存。

## 2026-07-04 图生图提示词轻框架复核

### 已确认

- 用户明确要求只改图生图提示词，不改纯文生图。
- `buildEcommerceImagePrompt()` 已按参考图数量分支：无参考图时保持旧提示词结构；有参考图时才启用 Prompt Planner 轻框架。
- 新框架重点处理图序角色：排版、风格、配色、桌子/背景/道具、产品、标签、文案等参考来源不互相污染。
- 普通生成任务、模板生图、画布对话 Agent、套图 Agent、局部编辑/扩图工具的图生图路径已接入。
- 已热更新并重启 `dianshang-internal-app`，容器健康检查和 `/api/health` 正常。
- 本轮只做语法、健康和关键字符串验证，没有发起真实生图请求。

### 剩余风险

- 轻框架的真实效果需要用生产端图生图样例观察，尤其是多图复杂引用和贴标类任务。
- 本轮容器为热拷贝更新；如果后续重新创建容器，需确保使用当前工作区源码构建。

## 2026-07-04 参考图缩略图字段兼容复核

### 已确认

- 截图中参考图按钮、编号和占位图标都已渲染，说明 UI 样式和按钮结构存在，问题集中在预览地址没有从图像对象中取到。
- 旧逻辑只读取 `preview`、`dataUrl`、`url`，无法覆盖生成结果、历史图、画布节点或上传对象里常见的 `imageUrl`、`originalUrl`、`thumbnailUrl`、`thumbUrl`、`src`、`uploadedUrl` 字段。
- 已扩展 `suiteImagePreview()` 的字段识别范围，参考图按钮和聊天卡片复用同一预览逻辑。
- 已同步扩展 `suiteImageToPayload()`，把可用 URL 继续写入 `url`、`imageUrl` 和 `originalUrl`，避免缩略图显示正常但生图请求缺参考图。
- 已热拷贝静态脚本到 `dianshang-internal-app`，容器保持 `healthy`，没有触发真实生图。
- 本地脚本语法检查、容器内脚本语法检查和线上资产字段命中检查均通过。

### 剩余风险

- 浏览器可能缓存旧 `canvas-chat-prompt-flow.js`；需要对生产端页面强刷后再确认缩略图。
- 本轮没有真实上传多来源图片逐项回归，若还有特殊字段名，需要按实际对象继续补兼容映射。

## 2026-07-04 画布图片闪烁复核

### 已确认

- 闪烁链路不是后端生图造成，本轮没有触发真实生图；问题集中在画布前端辅助脚本的 DOM 观察和图片加载策略。
- `canvas-performance-mode.js` 在滚轮、拖拽、触摸移动时会切换 `canvas-performance-active` 等 `html/body` class。
- `canvas-image-node-polish.js` 旧观察器监听全站 class/title 变化，遇到 `html/body` 或普通画布节点 class 抖动时也会调度扫描，容易造成画布图片节点反复测量和重打标。
- `canvas-chat-prompt-flow.js` 旧观察器监听全站 class 变化，非聊天面板的画布节点变化也会回落到 `getPanel()` 并刷新聊天面板，增加交互期间 DOM 压力。
- 已将画布节点图片设为 eager，保留普通非画布图片 lazy；同时避免对已有图片源改写 `referrerPolicy`。
- 两个观察器已收窄到相关 DOM：图片节点美化只看图片节点、标题锁定和图片工具面板；聊天提示词只看 `.canvas-chat-panel` 及其子树，并做 80ms 节流。
- `index.html` 已更新脚本 query 版本，容器内和 HTTP 线上资产均已命中新代码；容器健康检查正常。

### 剩余风险

- 本轮没有浏览器自动化录屏验证，因为当前仓库未安装 Playwright，且没有新增依赖确认。
- 如果用户强刷后仍看到闪烁，需要进一步在浏览器 DevTools 里确认是否是 Vue Flow 主包反复卸载图片节点，或远程图片服务本身响应慢导致重绘。

## 2026-07-04 图片生成节点输入框卡顿复核

### 已确认

- 卡顿发生在旧画布 `ImagePromptGenerateNode` 的提示词 textarea，不是聊天面板输入框。
- 旧逻辑中 textarea 的 `onInput` 每个字符都会执行 `lt(t.id,{prompt:l.value})`，直接更新 Vue Flow 节点数据。
- 节点数据更新会推动父级节点数组变化、节点重渲染、自动保存调度和样式重算；截图节点还带两张参考图，输入期间的重绘成本更高。
- 已将 prompt 写回节点数据改为 220ms 防抖，用户输入时只更新本地 textarea 状态，停顿后再同步到节点数据。
- 组件卸载时会清理防抖定时器并 flush 当前 prompt，降低离开页面时丢最后输入的风险。
- 已更新入口和 Canvas 动态 import query，生产端拉取的新 Canvas 包包含 `promptSaveTimer=setTimeout`，旧立即写节点片段已不存在。
- 容器内 JS 语法检查、HTTP 线上资产命中和健康检查均通过，没有触发真实生图。

### 剩余风险

- 本轮未使用浏览器录屏或 Performance 面板实测输入帧率；仍需用户在生产端强刷后实际输入验证。
- 如果仍卡，需要继续拆旧 Canvas 主包里的自动保存、参考图缩略图渲染和复杂 CSS `:has()` 样式重算。

## 2026-07-04 旧画布拖拽延迟性能评审

### 已确认

- 本轮未修改生产画布代码，只做性能链路审计。
- `assets/canvas-performance-mode.js` 在 `pointermove` 捕获阶段会对画布目标执行 `closest()` 判断，并持续调用 `setActive()` 维护拖拽态。
- `assets/canvas-performance-mode.css` 的拖拽态样式作用面过大，包含 `.canvas-chat-panel *`、`aside[class*="absolute"] *`、`section[class*="absolute"] *`，且在 `html` class 切换时触发较大范围级联重算。
- 同一 CSS 中 `.vue-flow__node:has(...)` 选择器在节点 class 频繁变化时有潜在样式匹配成本，尤其是图片节点、选中态和工具栏出现时。
- `assets/canvas-chat-prompt-flow.js` 仍在 `document.documentElement` 上监听 class/childList 变化，虽然有相关性过滤，但 `html/body` 或包含聊天面板的根节点变化仍可能调度聊天面板刷新。
- `assets/canvas-image-node-polish.js` 仍监听全站 class/title 变化，图片节点拖动、选中、标题状态变化时可能触发图片打标扫描。
- 旧 Canvas 主包中图片节点可见性计算依赖全局节点数组查找当前节点；图片节点越多，拖拽或视口变化时的重复计算越重。
- 框选逻辑在 `pointermove` 中读取所有节点 DOM 的 `getBoundingClientRect()`；普通拖单个节点不是主因，但框选会明显吃性能。
- 历史栈 `Io()` / `qo()` 会完整 JSON 克隆节点和边；批量复制、Alt 拖拽、撤销记录会随节点数量增长而卡顿。

### 建议

- P0：先把 `canvas-performance-mode.js` 的 `pointermove` 激活改成 RAF 节流或只在 `pointerdown/pointerup` 切换状态，避免拖拽热路径反复跑全局逻辑。
- P0：缩小 `canvas-performance-mode.css` 拖拽态选择器范围，去掉 `aside[class*="absolute"] *`、`section[class*="absolute"] *` 这类全局后代选择器，优先只作用旧画布必要面板。
- P1：用显式 class 替代 `.vue-flow__node:has(...)`，减少节点状态变化时的 CSS 匹配成本。
- P1：拖拽活跃时暂停或延后 `canvas-chat-prompt-flow.js`、`canvas-image-node-polish.js` 的观察器刷新。
- P2：重做图片节点可见性判断，避免每个图片节点都扫描全局节点数组；框选扫描改为 RAF 节流。

## 2026-07-04 Docker 生产测试容器重启复核

### 已确认

- 已重启现有 `dianshang-internal-app` 容器，容器状态恢复为 `running healthy`。
- `/api/health` 返回正常，数据库路径、上传目录、日志目录和 workflows 目录均可用。
- 当前服务仍处于 `real-provider-ready`，本轮没有调用生图接口，也没有触发扣费。
- `/canvas` 返回页面仍加载 `index-DglIsp_g.js?v=20260704inputlag1`，并保留 `canvas-performance-mode.js?v=20260704flicker1` 等画布辅助脚本版本。
- 线上 Canvas 包仍包含 `promptSaveTimer=setTimeout`，旧的 `T=()=>{lt(t.id,{prompt:l.value})}` 立即写回逻辑未恢复。

### 剩余风险

- 本轮是 `docker restart`，不是镜像重建；如果未来从镜像重新拉起容器，需要再次确认工作区源码和镜像内容一致。

## 2026-07-04 后台根入口跳转复核

### 已确认

- 旧后台资产仍然是清理状态，本轮问题不是旧后台入口残留。
- 服务端 `/admin` fallback 已指向源码后台 `frontend/dist/index.html`，服务端路径不是根因。
- 源码 Vue Router 原先没有 `/admin` 根路由，导致访问 `/admin` 命中 `/:pathMatch(.*)*` 并跳回 `/` 首页。
- 已新增 `/admin -> /admin/login` 重定向，并纳入源码路由维护清单。
- 已给内网准生产 smoke 增加 `/admin` 根入口资源检查，避免只测 `/admin/login` 漏掉根入口。
- 容器已重新构建并强制重建，当前 3456 服务为 `healthy`；Chrome headless 实测 `/admin` 渲染后台登录页。

### 剩余风险

- 浏览器里已经打开的旧后台页面可能保留旧 JS 内存状态；部署后需要强刷或重新打开 `/admin`。

## 2026-07-04 首页云端保存入口 chunk 同步复核

### 已确认

- 截图中的提示来自旧首页资产里的固定 toast 文案：“主页暂无云端手动保存入口，请进入画布保存当前工作流”。
- 当前 `index.html` 加载的是 `assets/index-DglIsp_g.js`，该入口动态导入 `assets/HomeIndex-DAjDt0aj.js`；之前已修复的同类逻辑位于另一份 `assets/HomeIndex-BtiJ9toc.js`，因此重建容器后仍可能命中未同步的旧逻辑。
- 已将 `HomeIndex-DAjDt0aj.js` 与 `HomeIndex-BtiJ9toc.js` 的云端“立即保存”行为对齐：有最近项目时进入对应画布，没有最近项目时新建画布，并提示用户在画布顶部保存面板保存。
- 已将 `index.html` 与 `assets/index-DglIsp_g.js` 的缓存 query 更新为 `20260704homesave1`。
- 本地检查确认当前活跃入口和两份首页 chunk 均不再包含“主页暂无云端手动保存入口”旧提示。
- 已完整重建并强制重建 Docker app 容器，当前 3456 服务为 `healthy`，不是只热拷或只重启。
- 线上 HTTP 复核确认首页 HTML、入口 JS、`HomeIndex-DAjDt0aj.js` 均命中 `20260704homesave1`，旧提示文案在线上 chunk 中不存在。

### 剩余风险

- 浏览器或代理可能缓存旧 `HomeIndex-DAjDt0aj.js`；部署后建议对 `http://192.168.0.39:3456/` 强刷再点“立即保存”。

## 2026-07-04 生产单系统静态资源隔离复核

### 已确认

- 当前首页唯一生产入口为 `index-DglIsp_g.js?v=20260704homesave1`，真实动态 import 和 Vite 预加载表都已指向 `HomeIndex-DAjDt0aj.js?v=20260704homesave1`。
- `server.js` 已移除整目录静态暴露，不再用 `express.static(__dirname)` 作为生产静态入口。
- 生产静态资源只显式开放 `public`、根 `assets`、源码后台 `frontend/dist/assets`、`videos` 与 `uploads`。
- 旧生产入口链路已服务端隔离：`index-ZrBcanD1.js`、`HomeIndex-BtiJ9toc.js`、旧后台 `AdminLayout-BHNDJhhH.js` 均返回 410。
- 未知 `/assets/not-a-production-asset.js` 返回 404，不再 fallback 成首页 HTML。
- `/server.js` 不再暴露 Node 源码内容。
- 增强后的内网准生产 smoke 已覆盖以上隔离检查并通过；当前 Docker 容器为强制重建后的 `healthy` 状态。

### 剩余风险

- 历史文件仍保留在工作区，当前通过服务端隔离避免生产命中；如后续需要物理删除，应先基于访问日志或引用图再做归档删除。

## 2026-07-04 main 与 Docker 生产端同步规则复核

### 已确认

- `AGENTS.md` 已新增生产端同步规则，明确 `F:\dianshang` 是生产修复的唯一源码基线。
- 规则已禁止只在 Docker 容器内热修、只拷贝容器文件或只改旧参考目录后声称完成。
- 规则已要求影响线上行为的改动必须执行 `docker compose -f "F:\dianshang\docker\docker-compose.yml" up -d --build --force-recreate app`。
- 规则已要求 Docker 重建后确认容器 `healthy`，并记录镜像 ID、镜像创建时间、容器启动时间或等价信息。
- 规则已要求生产验收直接请求 `http://192.168.0.39:3456/` 或相关线上路径，确认实际 HTML、入口 JS、chunk query、API 或目标行为命中新版本。
- 规则已覆盖旧入口、旧 chunk、旧后台包和静态资源隔离检查，要求用 410/404 等状态避免旧系统再次被拉起。

### 剩余风险

- 这是协作纪律规则更新，不会自动改写历史未提交状态；后续每次生产修复仍需按规则执行验证和汇报。

## 2026-07-04 进入画布旧节点自动刷新复核

### 已确认

- 当前生产入口只使用 `Canvas-B8bY9_QL.js`，旧 `Canvas-yGc8b2gf.js` 已被生产静态隔离，本轮只修当前活跃 Canvas 包。
- 旧 Canvas 包中 Vue Flow 使用 `key: qe.value` 支持强制重挂，但原逻辑只在 `kl()` 开始加载项目时更新 key，节点数组和边数组加载完成后没有再次更新。
- 已新增 `refreshCanvasAfterProjectLoad()`：加载完成后两次更新 `qe.value` 并派发 `resize`，让 Vue Flow 在节点数据落地后重新计算节点内部状态、尺寸和边线。
- 已覆盖普通进入项目、路由切换、导入本地工作流，以及 `Nc()` / `Pc()` 处理 pending payload 后的刷新。
- 已将根入口和 Canvas 动态 import query 升级为 `20260704canvasrefresh1`，避免浏览器继续使用旧 Canvas 包。
- `scripts/smoke-internal-prod.ps1` 已新增生产端断言：入口必须引用新版 Canvas 包，线上 Canvas 包必须包含自动刷新 hook 和 resize 刷新。
- 已完整执行 Docker build + force recreate，镜像 `sha256:d3ba3701598d2e7a5efa24567a4e0da30ff8198c257967122c489b2183ab2042`，容器当前为 `healthy`。
- 已直接请求 `http://192.168.0.39:3456/`、新版入口 JS 和新版 Canvas 包，确认 192.168 生产测试端命中新 query、新 Canvas 自动刷新 hook 和 resize 刷新；旧 `Canvas-yGc8b2gf.js` 返回 410。

### 剩余风险

- 缺少浏览器级自动化复现脚本；本轮主要通过静态资源断言、线上命中和用户强刷后的实际观察闭环。

## 2026-07-04 图片节点拖拽卡顿复核

### 已确认

- 全局顶部栏本身没有拖拽中循环逻辑，只是固定 Header 和按钮状态展示，不是本轮第一嫌疑。
- 图片节点上方浮动工具条更可疑：它依赖选中/hover 状态展示，并叠加了 `:has()`、阴影、backdrop-filter 与 transition；拖动图片节点时这些规则会跟随节点 class/hover/dragging 状态参与样式重算。
- `canvas-performance-mode.js` 原先在 document 捕获层监听 `pointermove`，每次移动都执行 `isCanvasTarget(event.target)` 和 `setActive()`，会反复 `closest()`、写 class、清理和重建 timer。
- `canvas-image-node-polish.js` 原先观察整页 class/title 变动，虽然已有过滤，但图片节点拖拽时的 class 变化仍可能调度图片节点扫描。
- 已改为拖拽开始时锁定拖拽态，拖拽中 80ms 节流延长状态；图片节点扫描拖拽期间延迟到松手后；拖拽期间隐藏图片节点浮动工具条并关闭相关重视觉效果。
- `index.html` 已将相关辅助脚本和 CSS query 升级为 `20260704dragperf1`，`scripts/smoke-internal-prod.ps1` 已增加生产端资源和优化逻辑断言。
- 已完整执行 Docker build + force recreate，镜像 `sha256:43a0fe8f23119b7ec948823f3daa900ff26105eb2cc3d3b31595b50948fe34aa`，容器当前为 `healthy`。
- 已直接请求 `http://192.168.0.39:3456/`、线上 `canvas-performance-mode.js`、`canvas-image-node-polish.js` 和 `canvas-performance-mode.css`，确认 192.168 生产测试端命中 `20260704dragperf1` 与拖拽优化逻辑。

### 剩余风险

- 尚未做 Chrome Performance trace 对比；如果用户强刷后仍卡，需要进一步采样拖拽期间的 Layout/Recalculate Style/Long Task，并考虑减少图片节点 CSS 中的 `:has()` 规则数量。

## 2026-07-04 用户中心打开卡顿复核

### 已确认

- 用户中心当前真实入口为 `UserCenter-C3r6Sru7.js`，页面本身结构不复杂，主要是资料卡、余额入口和少量按钮。
- `index.html` 此前仍在所有页面加载画布辅助 JS：`canvas-performance-mode.js`、`canvas-image-node-polish.js`、`canvas-chat-prompt-flow.js`。
- 这些脚本在画布页合理，但在用户中心会额外挂 document 级监听或 MutationObserver，开页和路由切换时可能参与 DOM 扫描，是用户中心卡顿的高概率来源。
- 已给三个画布 JS 增加 `/canvas` 路由闸门和 SPA 路由监听：非画布页不安装重逻辑；后续从用户中心进入画布仍会自动安装。
- `scripts/smoke-internal-prod.ps1` 已增加生产端断言：首页必须引用 `20260704canvasisolate1`，线上三个画布 JS 必须包含 `watchCanvasRoute` 隔离逻辑。
- 已完整执行 Docker build + force recreate，镜像 `sha256:0bb106db16090c45b53768e1ca5a4efbdaf6a2c226fb48598ced98b4336760e6`，容器当前为 `healthy`。
- 已直接请求 `http://192.168.0.39:3456/user/center`、线上首页和三个画布辅助 JS，确认用户中心入口 200，生产端命中 `20260704canvasisolate1` 与路由隔离逻辑。

### 剩余风险

- 如果隔离后用户中心仍卡，下一步应继续检查 `user-center-data-bridge.js` 的 app MutationObserver、用户资料接口响应时间，以及 UserCenter chunk 的首屏渲染耗时。

## 2026-07-04 全局脚本页面性能护栏复核

### 已确认

- 已在 `AGENTS.md` 固化护栏：画布专用脚本只能在 `/canvas` 路由安装重逻辑，非画布页不得安装全页 observer、高频 document 事件监听、图片扫描、聊天面板刷新或拖拽状态逻辑。
- 已明确 `/user/center` 是非画布性能基线页；用户中心卡顿时先查全局脚本越界安装，再查 `user-center-data-bridge.js`、接口耗时和 UserCenter chunk 自身渲染。
- 已要求涉及画布性能脚本的生产改动必须更新 `scripts/smoke-internal-prod.ps1`，验证线上 HTML query、脚本路由闸门、旧资源 410/404 和 `http://192.168.0.39:3456/user/center`。
- 已把“不能为了修画布把监听器、`querySelectorAll` 扫描、`:has()` 重样式规则或长任务扩散到用户中心和后台”写成明确禁止项。

### 剩余风险

- 护栏依赖后续执行时遵守；如果未来引入新的全局脚本或样式，仍需要在 smoke 和最终汇报中显式说明非画布页影响面。

## 2026-07-04 画布跳转用户中心延迟复核

### 已确认

- 用户反馈的路径是“先在画布，再点用户中心”，不同于直接打开用户中心。
- 已确认上一轮只做了首次安装闸门：非画布页初始打开不会安装画布脚本，但进入过 `/canvas` 后，已安装的 document 监听和 MutationObserver 没有在路由离开时拆掉。
- 已给 `canvas-performance-mode.js`、`canvas-image-node-polish.js`、`canvas-chat-prompt-flow.js` 分别补充 teardown，离开 `/canvas` 后清理事件监听、observer、timer、状态 class 和全局对象。
- `index.html` 已将三个画布辅助 JS query 升级为 `20260704canvasleave1`。
- `scripts/smoke-internal-prod.ps1` 已增加 teardown 断言，要求线上脚本同时包含路由闸门和路由离开清理函数。
- `AGENTS.md` 已补充硬护栏：禁止只做首次进入闸门而把已安装监听器留在非画布页。
- 已完整执行 Docker build + force recreate，镜像 `sha256:0e0be95837004310eca0afb65115cf9807b2e07e51276a4b4f76d105744e5b1e`，容器当前为 `healthy`。
- 已直接请求 `http://192.168.0.39:3456/user/center`、线上首页和三个画布辅助 JS，确认用户中心入口 200，生产端命中 `20260704canvasleave1`，三个脚本均包含 teardown、`removeEventListener` 和 `observer.disconnect`。

### 剩余风险

- 用户浏览器需要强刷后按“画布 -> 用户中心”路径复测体感；如果仍延迟，应继续采样用户中心自身脚本和接口。

## 2026-07-04 画布内用户中心弹层延迟复核

### 已确认

- 用户新截图中的入口是画布右上角圆形 AI/头像按钮，打开的是 Canvas 内部 `qp` 用户中心弹层，不是 `/user/center` 路由页。
- Canvas 包中该弹层由 `pe.value` 控制，渲染点为 `te(qp,{show:pe.value,...})`；因此页面仍停留在 `/canvas`，路由离开 teardown 不会执行。
- 已在 Canvas 包中新增 `codexSetUserCenterOpen()`，打开弹层时立即给 `html/body` 添加 `canvas-user-center-open`，关闭或组件卸载时清理，避免状态残留到其它页面。
- 已在 `canvas-performance-mode.css` 中新增 `canvas-user-center-open` 降负载规则：关闭背后画布的 `will-change`、backdrop blur、动画和过渡，并隐藏聊天面板、minimap、背景网格、图片节点浮动工具条等弹层背后不需要交互的层。
- 已将入口 query 升级为 `20260704usercenter1`，Canvas 动态 import query 升级为 `Canvas-B8bY9_QL.js?v=20260704usercenter1`，性能 CSS query 升级为 `20260704usercenter1`。
- `scripts/smoke-internal-prod.ps1` 已新增断言：线上首页必须命中 `20260704usercenter1`，线上 Canvas 包必须包含 `codexSetUserCenterOpen` 和 `canvas-user-center-open`，线上 CSS 必须包含 `html.canvas-user-center-open` 和 `backdrop-filter: none`。
- 已完整执行 Docker build + force recreate，镜像 `sha256:2627a4c03e9b14a2fcc15f8d13784b1688c8c3d6c09c952ebe0e19f6e5f95508`，容器当前为 `healthy`。
- 已直接请求 `http://192.168.0.39:3456/`、新版入口 JS、新版 Canvas 包、新版性能 CSS 和 `/user/center`，确认生产端命中新 query、新弹层状态 helper/class 和 CSS 降负载规则。

### 剩余风险

- 本轮未安装新依赖，也没有可用浏览器控制工具，因此没有做点击级 Performance trace。若强刷后点击画布右上角用户中心仍延迟，应继续用 Chrome Performance 采样，区分弹层组件渲染、接口响应、头像资源加载和背后画布合成耗时。

## 2026-07-07 图生图中转尺寸复核

### 已确认

- 这条生产测试路径带参考图，因此后端会调用 `callProviderImageEdit()`，上传给中转的是 multipart `/images/edits`，不是无参考图时的 JSON `/images/generations`。
- 当前画布项目中的图片生成节点保存 `size: "1x1"`、`clarity: "1k"`，参考图为 `436x659`，已生成返图约 `1023x1537`，返图比例与参考图高度比例高度一致。
- 根因不是用户界面没选 1:1，而是 `providerImageSize()` 把 `1x1` 误判成显式像素尺寸，实际计算为 `816x816`，导致传给中转的尺寸不是标准 `1024x1024`。
- 已修复为：`1024x1024` 这类真实像素尺寸继续按显式尺寸处理；`1x1`、`3x4`、`16x9` 这类小数字 `x` 写法按比例处理。
- 生成任务响应已增加不含密钥的 `request/providerRequest` 摘要，下一次生产测试可直接在 Network 里看到 `size`、`quality`、`referenceImageField` 和参考图数量。

### 验证

- `node --check "F:\dianshang\server.js"` 通过。
- `node "F:\dianshang\scripts\check-packy-gpt-image-size.js"` 通过，新增覆盖 `1x1`、`3x4`、`4x3`、`9x16`、`16x9`。
- `node "F:\dianshang\scripts\check-packy-gpt-image-adapter-coverage.js"` 通过。
- 已重启本地 3458，健康接口为 `real-provider-ready`，本轮未再次调用真实生图。

### 剩余风险

- 尚未再次扣费生图确认 Packy 是否严格按 `1024x1024` 返回；如果仍返回参考图比例，下一步优先验证单图字段是否需要统一为 `image[]`，以及 GPT 图像模型是否接受当前 `response_format: "url"` 兼容写法。

### 追加复核

- 用户复测后仍返回约 `1021x1541`，但当前后端函数对该节点参数的计算结果已是 `providerSize: "1024x1024"`。
- 进一步判断：比例没有混到业务上传图本身，而是 provider edit 请求必须同时包含参考图文件和输出尺寸字段；若中转或模型忽略 `size`，就会倾向保留参考图原比例。
- 已补充 `ecommercePromptOutputCanvasText()`，把目标比例和尺寸写入最终提示词，给模型层和 provider `size` 字段同向约束。
- 静态验证确认当前提示词会包含：`最终图片必须是 1:1 画布，目标尺寸 1024x1024。不要沿用参考图原始宽高比例`。

### Packy 官方文档复核

- 用户提供 Packy 官方 GPT-Image-2 文档后，确认 `/v1/images/edits` 应使用 `multipart/form-data`，字段为 `model`、`prompt`、`image`、`size`、`quality`、`output_format`、`response_format`，可选 `mask` 和 `input_fidelity`。
- 运行时 dry-run 结果已对齐 Packy 字段形态：`size`、`quality`、`output_format=png`、`response_format=url`、`input_fidelity=high`、`image=<file>`。
- 后台旧接口实例曾显示 `application/json ? multipart/form-data` 和 `images: [{ image_url }]`，该示例不是 Packy 官方编辑接口形态；已清理运行数据库 `admin.apiProviders` 中 GPT Image 2 的 `requestExamples`，并同步源码默认示例。
- 用户进一步确认 UI 清晰度三档应映射 Packy `quality`：`1K -> low`、`2K -> medium`、`4K -> high`；已修正此前把默认 `standard` 统一发 `high` 的处理。

### 图片生成节点 prompt 复核

- 用户要求“原来的约束全删了，只针对图片生成节点”。
- 已确认图片生成节点使用 `/api/generate/tasks`；该入口此前复用 `buildEcommerceImagePrompt()`，会追加多段保真和电商约束，导致生成结果更像原图复刻。
- 已改为 `/api/generate/tasks` 调用 `buildImageGenerateNodePrompt()`，只传用户在节点里输入的原始提示词；不影响 `/api/canvas/dialog-agent-generate`、`/api/canvas/ecommerce-suite/*` 和 `/api/template/generate-image`。
- 静态检查已增加约束：Quick generate tasks 入口必须包含 `buildImageGenerateNodePrompt`，且不能再包含 `buildEcommerceImagePrompt`。

## 2026-07-07 用户中心官转线路显示复核

### 已确认

- 线上 `/api/public/routes` 返回两条图片线路：`route_openai_gpt_image_2` 和 `lignsuan-guanzhuan`，其中 `lignsuan-guanzhuan` 显示名为 `官转gpt-img2`。
- 线上 `/api/public/models?routeId=pub_route_mr5yltmuc7edcb2b` 返回 `GPT Image 2`，`routeKey` 为 `lignsuan-guanzhuan`，模型为启用状态。
- 用户中心抽屉已改为合并 `/user/routes` 与 `/public/routes`；如果用户侧接口短暂只回一条，公开启用线路仍会进入卡片列表。
- 线路模型加载已增加 `/public/models` 兜底，避免用户侧模型接口为空时显示“当前线路暂无可用模型”。
- 入口缓存链路已升级到 `20260707route1`，生产 HTML、入口 JS、Canvas chunk 和 `ImageHistoryPanel` chunk 均已直接请求确认命中新版本。
- Docker 已完整重建并 force recreate；`dianshang-internal-app` 当前为 `healthy`，镜像为 `sha256:d141e4ebbbf94cd339d14246e8e2e8ac5210fd60547166471847e1b38c7cd2e1`。
- `scripts/smoke-internal-prod.ps1` 已补充用户抽屉 chunk 与公开线路、公开模型兜底断言，并已通过。

### 剩余风险

- 未持有用户当前浏览器 token，未直接抓 `/api/user/routes` 的登录态响应；本轮依靠公开接口兜底保证后台启用线路可见。
- 如果浏览器仍只显示一张卡，优先强刷当前页面，确认 Network 中加载的是 `ImageHistoryPanel-Dy2o3dPV.js?v=20260707route1`。

## 2026-07-07 本地 3458 官转线路加载复核

### 已确认

- 当前本地 3458 的运行数据库 `admin.apiProviders` 已包含图像官转线路 `pub_route_openai_gpt_image_2 / route_openai_gpt_image_2`，显示名为 `GPT Image 2 官转`。
- 该图像线路保留已有 API Key，公开响应只返回 `hasApiKey=true` 和脱敏 Key；实际端点为 `https://www.packyapi.com` + `/v1/images/generations`，图生图端点为 `/v1/images/edits`。
- 文本官转线路 `pub_route_openai_gpt_5_5 / route_openai_gpt_5_5` 已同步显示名 `GPT 5.5 官转`，端点为 `/responses`。
- `server.js` 默认 RTS 名称已同步，避免后续重置 `admin.apiProviders` 时又回到无“官转”的旧显示名。

### 验证

- `node --check "F:\dianshang\server.js"` 通过。
- `GET http://127.0.0.1:3458/api/model-routes?group=image` 返回 `GPT Image 2 官转`、`/v1/images/generations`、`/v1/images/edits`、`defaultImageModel=gpt-image-2`、`hasApiKey=true`。
- `GET http://127.0.0.1:3458/api/model-routes?group=text` 返回 `GPT 5.5 官转`、`/responses`、`defaultTextModel=gpt-5.5`、`hasApiKey=true`。
- `GET http://127.0.0.1:3458/api/user/api-status` 返回 provider 名称 `GPT Image 2 官转`。

### 剩余风险

- 本轮没有执行真实生图扣费请求；只确认线路加载、名称、端点和密钥配置状态。
- 本轮没有重建 3456 Docker 生产端；当前变更只面向 `http://127.0.0.1:3458` 本地生产测试。

## 2026-07-07 中转上传字段兼容试改复核

### 已确认

- 图片生成节点仍走本地后端 `/api/generate/tasks`，没有改为前端直连中转，也没有改 prompt 组装。
- `callProviderImageEdit()` 已改为多参考图重复追加 multipart `image` 字段；单图和多图均不再使用 `image[]`。
- 文生图 JSON `/v1/images/generations` 和图生图 multipart `/v1/images/edits` 都会发送 `background=auto`、`moderation=auto`。
- 生成任务响应的 `request/providerRequest` 摘要会暴露不含密钥的 `endpoint`、`background`、`moderation`、`referenceImageField=image` 和 `referenceImageFieldMode`，便于浏览器 Network 核对。
- 运行数据库 `admin.apiProviders` 的 GPT Image 2 请求示例已同步，后台示例不再出现 `image[]` 或缺少 `background/moderation` 的旧形态。

### 验证

- `node --check "F:\dianshang\server.js"` 通过。
- `node "F:\dianshang\scripts\check-packy-gpt-image-adapter-coverage.js"` 通过，并断言不能再出现 `form.append('image[]'`。
- `node "F:\dianshang\scripts\check-packy-gpt-image-size.js"` 通过 54 个尺寸映射用例。

### 剩余风险

- 本轮没有启用 New API `?async=true` 与上游任务轮询；刷新恢复能力仍是后续独立改造项。
- 本轮没有执行真实扣费生图；字段兼容是否提升生成效果，需要用户在当前 3458 画布实测。

## 2026-07-07 用户中心两条图片路线复核

### 已确认

- 用户后台截图中图片路线应为两条：默认 `GPT Image 2` 和普通线路 `官转gpt-img2 / lignsuan-guanzhuan`。
- 当前 3458 的 `data.db` 之前只保存了 1 条 image 路线，导致用户中心只能渲染一张图片线路卡片。
- `docker/data/data.db` 中保留了 `pub_route_mr5yltmuc7edcb2b / lignsuan-guanzhuan` 的真实本地 API Key；本轮从该本地生产副本恢复到当前 3458 `admin.apiProviders`。
- `server.js` 默认 RTS 已增加 `官转gpt-img2`，避免 `admin.apiProviders` 被重置或缺失时默认状态又少一条图片路线。

### 验证

- `GET http://127.0.0.1:3458/api/model-routes?group=image` 返回 2 条：`GPT Image 2 官转` 与 `官转gpt-img2`。
- `GET http://127.0.0.1:3458/api/public/routes?group=image` 返回同样 2 条图片路线。
- `GET http://127.0.0.1:3458/api/public/models?routeId=pub_route_mr5yltmuc7edcb2b` 返回 `GPT Image 2`，`routeKey=lignsuan-guanzhuan`。
- 当前 3458 已重启，并刷新了内置浏览器画布页。

### 剩余风险

- 本轮未对 `官转gpt-img2` 做真实扣费生图测试；用户可在用户中心切换后自行验证效果。
- 本轮未同步 3456 Docker 生产端。

## 2026-07-07 生图结果节点刷新恢复复核

### 已确认

- `/api/generate/tasks` 已从同步等待上游返回改为真正任务式提交：先创建内存 pending task，立即返回 `202`、`taskId`、`status=running`、`progress=90`。
- 后台任务完成后会用同一个 taskId 更新 `status=success`、`progress=100`、`resultImages/images`，并在成功后写入 `generations` 与扣费日志；失败会更新 `status=failed` 与 `errorMessage`。
- 旧画布图片生成节点在收到进度回调中的 `taskId` 后，会把 `taskId/sourceTaskId/taskImageIndex` 保存进每个结果图片节点，并把生成节点的 `outputNodeIds` 同步保存。
- 图片节点新增刷新恢复逻辑：加载到 `taskId` 且没有 `url` 时自动轮询 `/api/generate/tasks/:id`，成功后回填 `url/imageUrl/originalUrl/thumbUrl/thumbnailUrl`，失败后显示错误。
- 入口缓存已升级到 `20260707taskresume1`，当前 3458 首页和 index chunk 均命中新 query。

### 验证

- `node --check "F:\dianshang\server.js"` 通过。
- `node --check` 已覆盖 `assets/Canvas-B8bY9_QL.js`、`assets/Canvas-yGc8b2gf.js`、`assets/index-DglIsp_g.js`、`assets/index-ZrBcanD1.js`。
- 静态断言确认两个 Canvas bundle 均包含 `resumeImageTask=async`、`anTaskId=gt.taskId`，入口 chunk 包含新的 Canvas query。
- 临时 3462 mock 服务使用临时数据库与 `ENABLE_REAL_AI=false` 验证：`POST /api/generate/tasks` 返回 `202/running/progress=90/taskId`，随后轮询同一 taskId 返回 `success/progress=100/1 张图片`。
- 3458 已重启，健康检查为 `real-provider-ready`，首页命中 `index-DglIsp_g.js?v=20260707taskresume1`，入口命中 `Canvas-B8bY9_QL.js?v=20260707taskresume1`。

### 剩余风险

- 本轮没有触发真实扣费生图；真实上游返回慢或失败时，需要用户在 3458 画布复测节点刷新恢复体验。
- 当前 task 仍保存在后端内存中；浏览器刷新可恢复，后端进程重启仍不能恢复未完成任务。后续若要覆盖服务重启，需要把 pending task 落库并加启动恢复或任务队列。

## 2026-07-07 生图进度条抖动复核

### 已确认

- 抖动来源是两个前端进度源同时写结果图片节点：旧模拟进度 interval 继续写 `模型生成中 54%`，后台 task 提交后又写 `等待返回结果 90%`。
- 两份 Canvas bundle 已在拿到 `taskId` 后调用 `w()` 停止模拟进度 interval，再写入 90% 等待状态。
- 入口缓存已升级到 `20260707taskresume2`，避免浏览器继续加载上一版 `taskresume1` Canvas 包。

### 验证

- `node --check "F:\dianshang\assets\Canvas-B8bY9_QL.js"` 通过。
- `node --check "F:\dianshang\assets\Canvas-yGc8b2gf.js"` 通过。
- 静态断言确认两个 Canvas bundle 均包含 `w(),b(Math.max(90,Number(_.progress||90))`。
- 3458 首页命中 `index-DglIsp_g.js?v=20260707taskresume2`，入口 chunk 命中 `Canvas-B8bY9_QL.js?v=20260707taskresume2`。

### 剩余风险

- 本轮没有重新触发真实扣费生图；请在当前画布刷新后复测，预期拿到 taskId 后进度保持 90% 等待，不再回落到 54%。

## 2026-07-07 刷新后红态丢恢复复核

### 已确认

- 用户当前项目 `project_1783411452337_62mwdhz9p` 中，红态结果节点 `node_8/node_9` 的 `taskId` 已被项目清洗层删除，只剩 `sourceTaskId=task_mradlsmaa4486ee3`，并被写入 `error=上次生成未完成，已停止自动恢复`。
- 后端任务并未丢失：用项目用户短 token 查询 `/api/generate/tasks/task_mradlsmaa4486ee3` 返回 `success`、`progress=100`、`resultImages=2`。
- `projects-BtxGnToV.js` 和兼容包 `projects-eqk9JplQ.js` 已改为：图片节点存在 `sourceTaskId` 且无 URL 时，加载时补回 `taskId`，保留恢复进度状态并清空旧 interrupted error。
- `ImageNode` 恢复轮询已改为使用 `taskId || sourceTaskId`；恢复等待和成功回填时都会清掉 error，避免红态继续挡住图片。
- Canvas 对 projects chunk 的静态 import 已带 `?v=20260707taskresume3`，入口缓存也同步升级。

### 验证

- `node --check` 已覆盖 `projects-BtxGnToV.js`、`projects-eqk9JplQ.js`、`Canvas-B8bY9_QL.js`、`Canvas-yGc8b2gf.js`、`index-DglIsp_g.js`、`index-ZrBcanD1.js`。
- 静态断言确认 projects chunk 包含 `!a.taskId&&a.sourceTaskId&&!ne(a)&&(a.taskId=a.sourceTaskId`，Canvas 包包含 `sourceTaskId)||""`。
- 3458 首页命中 `index-DglIsp_g.js?v=20260707taskresume3`，Canvas 命中 projects chunk query，projects chunk 命中保留 `sourceTaskId` 的逻辑。
- 当前任务 `task_mradlsmaa4486ee3` 后端查询结果为 `success/progress=100/2 张图片`。

### 剩余风险

- 如果用户刷新前 3458 后端进程重启，内存 task 仍可能丢；当前这一次任务还在内存中，可以刷新后恢复。

## 2026-07-07 图片加载阶段保持生图 UI 复核

### 已确认

- 图片生成任务成功拿到 URL 时，旧画布不再立刻切到普通图片分支，而是保持结果节点的生图加载 UI。
- 两份 Canvas bundle 已把成功态拆为两段：`progress=99/progressLabel=图片加载中` 先展示加载 UI，加载态预览图 `onLoad` 触发后再清理 `loading/revealOnImageLoad/pendingRevealUrl` 并展示最终图片。
- 普通生成成功和刷新恢复成功两条路径都写入 `revealOnImageLoad/pendingRevealUrl`，避免只有恢复链路稳定、首次生成仍缩成长条。
- 两份 projects chunk 已保留 `revealOnImageLoad` 图片节点的加载状态，刷新时不会把该状态误清洗掉。
- `taskresume4` 首版在压缩函数内重复声明 `Xt`，导致浏览器解析 `Canvas-B8bY9_QL.js` 报错并出现空白画布；已移除重复声明并升级到 `20260707taskresume5`。
- 入口缓存已升级到 `20260707taskresume5`，当前 3458 静态资源命中新版。

### 验证

- `node --check` 已覆盖 `assets/Canvas-B8bY9_QL.js`、`assets/Canvas-yGc8b2gf.js`、`assets/projects-BtxGnToV.js`、`assets/projects-eqk9JplQ.js`、`assets/index-DglIsp_g.js`、`assets/index-ZrBcanD1.js`。
- 静态断言确认两个 Canvas bundle 均包含 `progressLabel:"图片加载中"`、`revealOnImageLoad:!0,pendingRevealUrl` 和加载态 `onLoad:Ke,onError:je`。
- 静态断言确认两个 projects chunk 均包含 `a.revealOnImageLoad&&ne(a)`。
- `http://127.0.0.1:3458/`、入口 chunk 和 `Canvas-B8bY9_QL.js?v=20260707taskresume5` 均命中新版本。
- 内置浏览器直接打开 `http://127.0.0.1:3458/canvas/project_1783411452337_62mwdhz9p`，确认 `#app` 已挂载且存在画布节点；新版本不再产生 `Identifier 'Xt' has already been declared` 解析错误。

### 剩余风险

- 本轮没有再次触发真实扣费生图；用户可在 3458 当前画布复测，预期任务完成后节点保持生图卡片到图片加载完成，再直接显示图片结果。

## 2026-07-07 图片加载中长条 UI 兜底复核

### 已确认

- 用户截图中的 `图片加载中 99%` 横条状态不正确，应保持方形生图/结果图加载 UI。
- 根因不是 Canvas loading 容器本身；Canvas 包里的 loading 容器已经是 `aspect-square`。
- 根因是 `canvas-image-node-polish.css/js` 看到加载预览 `<img>` 后，把 loading 节点提前当作“已有图片”节点处理，套用了结果图尺寸和工具条布局。
- 两份 Canvas bundle 已在图片节点 loading 时加 `image-node-loading` 类。
- `canvas-image-node-polish.css` 已针对 `image-node-loading` 覆盖抛光规则，强制 290px 方形加载卡、恢复 padding，并把加载容器固定为 `aspect-ratio: 1 / 1`。

### 验证

- `node --check` 已覆盖 `assets/Canvas-B8bY9_QL.js`、`assets/Canvas-yGc8b2gf.js`、`assets/index-DglIsp_g.js`、`assets/index-ZrBcanD1.js`。
- 静态断言确认两份 Canvas bundle 包含 `image-node-loading`。
- 静态断言确认 `assets/canvas-image-node-polish.css` 包含 `.image-node.image-node-loading` 和 `aspect-ratio: 1 / 1`。
- 3458 首页命中 `index-DglIsp_g.js?v=20260707taskresume6`，入口 chunk 命中 `Canvas-B8bY9_QL.js?v=20260707taskresume6`，polish CSS 命中 `?v=20260707loadui1`。

### 剩余风险

- 本轮没有再次触发真实扣费生图；需要用户复测实际生成中的 loading 节点，预期不再出现横条。

## 2026-07-07 画布用户中心兑换码刷新复核

### 已确认

- 用户反馈发生在画布右侧用户中心抽屉，不是独立 `/user/redeem` 页面。
- 后端 `/api/user/redeem` 当前成功响应为 `success/balance/amount`，不包含 `user`。
- 画布抽屉旧逻辑只执行 `Ye(R.user)`，当 `R.user` 为空时不会刷新本地用户状态，导致 `算力余额` 不跟随刷新。
- 兑换码输入框缺少显式文字色和 placeholder 色，在白底场景下可读性不足。

### 处理

- 两份 `ImageHistoryPanel` 已改为兑换成功后 `R.user ? Ye(R.user) : await me()`，兼容当前后端返回结构。
- 两份 `ImageHistoryPanel` 的兑换码输入框已补 `text-zinc-900` 和 `placeholder:text-zinc-400`。
- 入口、Canvas 动态 import 和 Canvas 内 `ImageHistoryPanel` import query 已升到 `taskresume7/redeem1`，避免浏览器继续用旧资源。

### 验证

- `node --check` 已覆盖 `assets/ImageHistoryPanel-Dy2o3dPV.js`、`assets/ImageHistoryPanel-Cu4Brucb.js`、两份 Canvas bundle 和两份 index chunk。
- 静态断言确认两份 `ImageHistoryPanel` 均包含输入框可读颜色和兑换成功后的资料刷新 fallback。
- `http://127.0.0.1:3458/` 已命中 `index-DglIsp_g.js?v=20260707taskresume7`，入口 chunk 已命中 `Canvas-B8bY9_QL.js?v=20260707taskresume7`，Canvas chunk 已命中 `ImageHistoryPanel-Dy2o3dPV.js?v=20260707redeem1`。

### 剩余风险

- 本轮没有真实提交兑换码，避免改动当前账号余额；需要用户用有效兑换码复测一次，预期成功提示后余额和算力明细一起更新。

## 2026-07-07 最新 commit 基线复核

### 已确认

- 用户明确最新 commit 是当前基线，本轮按 `HEAD` 而不是旧回滚点 `51d4dab` 更新项目事实入口。
- 当前 `HEAD` 为 `0fd44536ca9dd1ca1f791be7a717e86d178c84f1`，短哈希 `0fd4453`，提交信息 `fix: stabilize canvas generation flow`，提交时间 `2026-07-07 17:05:28 +0800`。
- 当前 `main` 相对 `origin/main` 为 `ahead 4`；工作树存在未跟踪目录 `workflows/`，它不是本次确认的基线内容。

### 处理

- `docs/current-baseline.md` 已把当前基线、当前准绳、入口资源、容易混淆的历史和后续修改门禁统一改为最新提交口径。
- 文档明确：最新 Git 基线不自动等于 3456 生产端已同步，生产仍要走 Docker 重建、健康检查和内网 URL 验证。

### 验证

- 已用 `git status --short --branch`、`git log -1` 和资源 query 检查确认文档内容来源。
- 本轮未修改业务代码，因此不运行前端构建或后端 smoke；只执行文档检查和 UTF-8 BOM 检查。

## 2026-07-08 后台源码 UI 规范化复核

### 已确认

- 本轮只覆盖源码后台 `/admin/*`，不引入 shadcn、React、Tailwind 或新依赖。
- 共用后台组件只负责布局和展示，业务 API 仍由各后台页面现有函数调用。
- 11 个后台源码页的原有刷新、搜索、筛选、分页、确认弹窗、表单字段和写入入口保留。

### 处理

- 新增 `docs/admin-ui-guidelines.md`，把后台 UI 风格和维护边界固化为可复用规范。
- 新增 `frontend/src/components/admin/` 展示组件，并把 11 个后台源码页统一到 `AdminPageShell`、`AdminPageHeader`、`AdminFeedback`、`AdminToolbar`、`AdminEmptyState`、`AdminStatGrid` 和 `AdminPanel`。
- `AdminSourceSidebar.vue` 改为读取 `frontend/src/config/adminNavigation.ts`，导航项带分组和 lucide 图标。
- `frontend/src/styles/app.css` 增加后台 scoped tokens 与布局规则，控制高密度工作台、列表、面板、工具栏和移动端溢出。
- 后台 UI smoke runner 修复 admin token 注入，避免 `/api/admin/*` 源码拦截器在 smoke 中误报 401。

### 验证

- `npm run typecheck --prefix "F:\dianshang\frontend"` 通过。
- `npm run check:routes --prefix "F:\dianshang\frontend"` 通过，输出 `Source frontend route maintenance check passed: 22/22 source routes.`。
- `npm run build --prefix "F:\dianshang\frontend"` 通过。
- `powershell -NoProfile -ExecutionPolicy Bypass -File "F:\dianshang\scripts\smoke-source-frontend-ui.ps1"` 通过。
- `powershell -NoProfile -ExecutionPolicy Bypass -File "F:\dianshang\scripts\smoke-admin-pages-ui.ps1"` 通过，并刷新后台页面截图归档。
- `node --check` 覆盖 4 个后台 UI smoke runner，通过。
- `git -C "F:\dianshang" diff --check` 通过。

### 剩余风险

- 本轮没有执行真实 Provider 连接、真实 API Key 写入、真实扣费或正式线路删除。
- 本轮没有同步 3456 生产端；如需发布，仍必须完整 Docker 重建、确认容器 healthy 并验证内网 URL 命中新版本。

## 2026-07-08 画布生成线路透传复核

### 已确认

- 用户截图中的 `traceid: 90005eac393dc0186d45d5597bc88172` 对应任务 `task_mrbpje16fc7be21e`。
- 2026-07-08 14:36 到 14:42 的 6 条失败任务都显示 `lineKey=route_6789`、`routeDisplayName=6789`，并且错误来自 `https://www.packyapi.com/v1/images/edits`。
- 本地 `.env` 和后台线路均有 Key；失败主因不是本地完全未配置 Key。

### 处理

- `/api/generate/tasks` 已解析请求体里的图片线路，并把 `route` 传给 Provider 调用。
- `createPendingTask` 和 `makeTaskResponse` 已携带线路元数据，后台任务列表可以看到真实线路。
- 后台任务列表不再写死 `route_6789/6789`；失败任务不再显示 `已扣费`。

### 验证

- `node --check "F:\dianshang\server.js"` 通过。
- `powershell -NoProfile -ExecutionPolicy Bypass -File "F:\dianshang\scripts\smoke-api-disposable.ps1"` 通过。
- 一次性 mock 后端验证：`routeId=pub_route_mr5yltmuc7edcb2b` 的生成任务返回 `lineKey=lignsuan-guanzhuan`、`routeDisplayName=官转gpt-img2`。

### 剩余风险

- 本轮避免真实 Provider 调用，没有实际扣费测试 `lingsuan.top`。
- 如用户复测 lingsuan 后仍失败，需要拿新的任务 ID 或 traceid 判断真实上游错误。

## 2026-07-08 PackyAPI 线路命名复核

### 已确认

- 用户中心显示两条图像线路时，PackyAPI 线路旧名 `GPT Image 2 官转` 容易和 lingsuan 的 `官转gpt-img2` 混淆。
- PackyAPI 线路实际 Base URL 仍是 `https://www.packyapi.com`，并没有丢失。

### 处理

- `server.js` 默认 PackyAPI 图像线路名改为 `PackyAPI GPT Image 2`。
- 当前 `data.db` 的 `admin.apiProviders` 同步更新 PackyAPI 线路 `name/displayName/dn`。
- 未修改 API Key、Base URL、endpoint、默认线路和优先级。

### 验证

- `/api/admin/api-providers` 返回 PackyAPI 线路 `PackyAPI GPT Image 2`。
- `/api/public/routes?group=image`、`/api/model-routes?group=image` 和 `/api/user/api-status` 与后台返回一致。

## 2026-07-08 用户 API 线路偏好复核

### 已确认

- 最新失败任务仍是 PackyAPI：`lineKey=route_openai_gpt_image_2`，错误为 `没有可用token`。
- `/api/user/preferences/api-route` 修复前没有写入任何持久状态，只返回请求体里的 route。
- `/api/user/api-status` 修复前固定读取 `routeState()[0]`，会回到默认 PackyAPI。

### 处理

- 新增 `user.apiPreferences` 状态，按 `userId` 保存 `imageRouteId/imageRouteKey`。
- `/api/user/preferences/api-route` 保存用户选择的图片线路。
- `/api/user/api-status`、`/api/user/models` 和 `/api/generate/tasks` 在请求未显式带线路时读取用户图片线路偏好。

### 验证

- `node --check "F:\dianshang\server.js"` 通过。
- 3456 已重启到新 `server.js`。
- 保存 `pub_route_mr5yltmuc7edcb2b` 后，`/api/user/api-status` 返回 `官转gpt-img2`。

### 剩余风险

- 本轮未触发真实 Provider 生图，不验证 lingsuan 上游可用性。
- 修复前用户点过的线路不会自动补写，需用户重新点选一次目标线路。

## 2026-07-08 画布线路偏好全链路复核

### 已确认

- 用户最新截图仍是 `没有可用token`；该错误语义来自 Provider token 池，不是前端 UI 渲染错误。
- 健康接口确认当前 3456 进程读取 `F:\dianshang\data.db`，不是临时 smoke 数据目录。
- 实际用户 `731241492 / user_mra81hjffdee6972` 的保存偏好已存在，使用有效本地 JWT 查询 `/api/user/api-status` 返回 `官转gpt-img2 / lignsuan-guanzhuan`。
- 复查代码发现画布套图与对话 Agent 路径仍有 `resolveImageRoute(body)`，缺少 `req.user.userId`，会在无显式线路参数时绕过用户偏好。

### 处理

- `/api/canvas/ecommerce-suite/prompts`、`/api/canvas/ecommerce-suite/generate`、`/api/canvas/dialog-agent-generate` 已统一传入 `req.user.userId`。
- 3456 已重启到 `node F:\dianshang\server.js`。
- 普通生成任务保留 Packy `没有可用token` 时自动尝试下一条启用图像线路的兜底逻辑。

### 验证

- `node --check "F:\dianshang\server.js"` 通过。
- `powershell -NoProfile -ExecutionPolicy Bypass -File "F:\dianshang\scripts\smoke-api-disposable.ps1"` 通过。
- `/api/health` 返回数据库路径 `F:\dianshang\data.db`。
- 实际用户 `/api/user/api-status` 返回 `mock=false` 且 provider 为 `pub_route_mr5yltmuc7edcb2b / lignsuan-guanzhuan`。

### 剩余风险

- 未执行真实 Provider 生图，避免真实扣费。
- 如果修复后新任务仍失败，需要以新的 traceid 判断是否为 lingsuan 上游 token、Key 或 endpoint 配置问题。

## 2026-07-08 参考图加载闪烁复核

### 已确认

- 闪烁发生在画布参考图/图片节点加载态，不属于后台 UI 页面。
- 当前入口使用 `Canvas-B8bY9_QL.js?v=20260707taskresume7`，同时全局加载 `canvas-image-node-polish.js`。
- Canvas 包在 loading 状态会渲染预览 `<img>`；polish 脚本旧逻辑会扫描 `.image-node img` 并给节点添加 `image-node-has-image`。
- `image-node-has-image` 与 `image-node-loading` 同时存在时，会触发已有图片抛光样式和加载态样式竞争，是参考图加载刷新闪烁的直接风险点。

### 处理

- `canvas-image-node-polish.js` 的 `markImage` 增加 loading guard：遇到 `.image-node-loading` 时清除 `image-node-has-image` 并返回。
- `index.html` 将 polish 脚本 query 升为 `20260708loadguard1`，避免继续命中旧缓存。

### 验证

- `node --check "F:\dianshang\assets\canvas-image-node-polish.js"` 通过。
- `git -C "F:\dianshang" diff --check -- "index.html" "assets/canvas-image-node-polish.js"` 通过。
- `http://127.0.0.1:3456/` HTML 命中 `canvas-image-node-polish.js?v=20260708loadguard1`。
- `http://127.0.0.1:3456/assets/canvas-image-node-polish.js?v=20260708loadguard1` 内容命中 `image-node-loading` guard。

### 剩余风险

- 本轮未执行真实 Provider 生图，不验证真实生成结果回填。
- 用户浏览器如仍缓存旧页面，需要刷新当前画布后再观察。

## 2026-07-09 Docker 同步复核

### 已确认

- 用户要求同步到 Docker，必须以 `F:\dianshang` 当前工作区为源码基线完整重建，不能只 restart。
- 初次执行 compose 时 Docker engine 未启动；启动 Docker Desktop 后 engine 版本为 `29.5.3`。
- 首次重建后为了让生产 smoke 跟上当前资源版本，更新了 `scripts/smoke-internal-prod.ps1`，因此又执行了一次完整 Docker 重建。

### 处理

- 执行 `docker compose -f "F:\dianshang\docker\docker-compose.yml" up -d --build --force-recreate app`。
- 更新 `scripts/smoke-internal-prod.ps1` 的资源断言到当前版本：`20260707taskresume7`、`20260707redeem1`、`20260707loadui1`、`20260708loadguard1`。
- 最终容器 `dianshang-internal-app` 已强制重建并启动。

### 验证

- 最终镜像 ID：`sha256:52079e8da62a568e71a77f0f934111107f24bfe6409e3b97b2b2b1eb258c1376`。
- 镜像创建时间：`2026-07-09T03:07:00.899808192Z`。
- 容器启动时间：`2026-07-09T03:07:08.743503288Z`。
- 容器 Health：`healthy`。
- `http://192.168.0.39:3456/` 返回 200，并命中 `index-DglIsp_g.js?v=20260707taskresume7` 与 `canvas-image-node-polish.js?v=20260708loadguard1`。
- `http://192.168.0.39:3456/api/health` 返回 `success=true/status=ok/database=ok/mode=real-provider-ready`。
- `scripts/smoke-internal-prod.ps1` 通过。

### 剩余风险

- 本轮未发起真实生图请求，避免真实扣费。
- 浏览器端如果仍有旧缓存，需要强刷页面后再复测画布参考图加载和生图线路。

## 2026-07-09 账号 731241492 密码统一复核

### 已确认

- 开发库 `F:\dianshang\data.db` 存在 `731241492 / user_mra81hjffdee6972`。
- Docker 库 `F:\dianshang\docker\data\data.db` 原本不存在用户名 `731241492`，但同邮箱 `731241492@qq.com` 属于 `mylord1993 / user_mr5yosedcd52a974`。
- 两个环境的 `JWT_SECRET` 不同，因此不能把开发库 password hash 直接复制到 Docker。

### 处理

- 备份开发库和 Docker 库。
- 开发库更新 `731241492` 的密码 hash，并保持账号 active。
- Docker 库保留原用户 id、余额、项目关联，只把 `mylord1993` 登录名改为 `731241492`，并按 Docker 生产 `JWT_SECRET` 重置密码 hash。

### 验证

- 开发库 hash 校验通过。
- Docker 容器 `/app/data/data.db` hash 校验通过。
- Docker 内网登录接口 `POST /api/auth/login` 返回 200、token 和用户 `731241492`。

### 剩余风险

- 开发库与 Docker 库的用户 id 和余额仍不同：开发为 `user_mra81hjffdee6972 / 115`，Docker 为 `user_mr5yosedcd52a974 / 130`。
- 本轮未同步项目、生成记录、余额流水等业务数据，只统一登录名和密码。

## 2026-07-09 模板选择板块 UI 优化复核

### 已确认

- 截图对应当前生产静态包中的 `/template-image` 模板工作台，不是 `frontend/src/views/TemplateImageSource.vue` 源码页。
- 模板页已有稳定类名：`.template-workbench`、`.template-preset-gallery`、`.template-gallery-grid`、`.template-card`，可以通过独立 CSS 做低风险视觉覆盖。
- 该路由的 chunk CSS 会懒加载注入，因此新增样式需要使用更高优先级选择器覆盖旧的本地 1:1 卡片补丁。

### 处理

- 新增 `assets/template-workbench-gallery-polish.css`，限定在 `.template-workbench` 下优化模板选择区域。
- `index.html` 引用 `template-workbench-gallery-polish.css?v=20260709gallery1`。
- `scripts/smoke-internal-prod.ps1` 增加模板工作台样式资源和关键 CSS 规则断言。
- 完整重建 Docker：`docker compose -f "F:\dianshang\docker\docker-compose.yml" up -d --build --force-recreate app`。

### 验证

- `git -C "F:\dianshang" diff --check` 通过。
- `assets/template-workbench-gallery-polish.css`、`index.html`、`scripts/smoke-internal-prod.ps1` 均为 UTF-8 无 BOM。
- 最终镜像 ID：`sha256:3b0818f83327a67517c762793c7d74bb053a460b14f6a98a4d14d8ac4d8d50cc`。
- 镜像创建时间：`2026-07-09T04:49:11.279150785Z`。
- 容器启动时间：`2026-07-09T04:49:20.291493523Z`。
- 容器 Health：`healthy`。
- `http://192.168.0.39:3456/` 返回 200，并命中 `template-workbench-gallery-polish.css?v=20260709gallery1`。
- `http://192.168.0.39:3456/assets/template-workbench-gallery-polish.css?v=20260709gallery1` 返回 200，并命中 `.template-workbench .template-card[data-v-bc16861b]` 高优先级覆盖。
- `http://192.168.0.39:3456/api/health` 返回 `success=true/status=ok/database=ok`。
- `scripts/smoke-internal-prod.ps1` 通过。

### 剩余风险

- 本轮未执行真实模板生成，不验证真实 Provider 成图和扣费。
- 用户浏览器可能仍缓存旧页面，需要在 `/template-image` 强刷后再看最终样式。

## 2026-07-09 画布模型下拉清理复核

### 已确认

- 后端开发库 `admin.apiProviders` 当前只保留 PackyAPI 图像线、lingsuan 图像线和 GPT 5.5 文本线。
- `/api/user/models` 对当前用户返回的模型列表已经是干净的 `GPT Image 2`。
- 截图中的 `6789/RK/Comfly/Nano Banana/Gemini` 来自静态兜底模块 `assets/fixedImageModels-Rg0McL4V.js`，不是后台当前线路配置。

### 处理

- 重写 `assets/fixedImageModels-Rg0McL4V.js`，固定兜底模型只保留 PackyAPI 和 lingsuan 两项。
- `index.html` 入口 query 升为 `20260709modelclean1`。
- `assets/index-DglIsp_g.js` 中 HomeIndex/Canvas 动态 chunk query 升为 `20260709modelclean1`。
- `assets/HomeIndex-DAjDt0aj.js` 与 `assets/Canvas-B8bY9_QL.js` 对固定模型模块的 import 追加 `?v=20260709modelclean1`，避免浏览器继续使用旧模块缓存。
- `scripts/smoke-internal-prod.ps1` 增加固定模型表断言。

### 验证

- `node --check` 覆盖 `assets/fixedImageModels-Rg0McL4V.js`、`assets/index-DglIsp_g.js`、`assets/Canvas-B8bY9_QL.js`、`assets/HomeIndex-DAjDt0aj.js`。
- `git -C "F:\dianshang" diff --check` 通过。
- 修改文件均为 UTF-8 无 BOM。
- 最终镜像 ID：`sha256:928c818c2c65d810f58982ee42397899864b89f99be424da13ea932bbdc2f43a`。
- 镜像创建时间：`2026-07-09T05:03:56.551865184Z`。
- 容器启动时间：`2026-07-09T05:04:05.059351269Z`。
- 容器 Health：`healthy`。
- `http://localhost:3456/` 与 `http://192.168.0.39:3456/` 均命中 `index-DglIsp_g.js?v=20260709modelclean1`。
- `assets/index-DglIsp_g.js?v=20260709modelclean1` 命中 `Canvas-B8bY9_QL.js?v=20260709modelclean1` 与 `fixedImageModels-Rg0McL4V.js?v=20260709modelclean1`。
- `assets/fixedImageModels-Rg0McL4V.js?v=20260709modelclean1` 返回 200，包含 PackyAPI/lingsuan 兜底，不包含 `Nano Banana|Comfly|route_6789|route_rk|Flatfee|VIP|Gemini`。
- Playwright 浏览器运行时 import 固定模型模块，返回 `count=2`、`hasOld=false`。
- `scripts/smoke-internal-prod.ps1` 通过。

### 剩余风险

- 本轮未执行真实生图和真实扣费。
- 已打开的画布页面如果仍显示旧模型，需要强刷页面或重新进入画布，让浏览器加载 `modelclean1` 入口。

## 2026-07-09 画布模型自动同步复核

### 已确认

- `modelclean1` 仍保留两条前端固定兜底模型，后续后台新增模型时仍可能出现前端兜底不同步。
- 画布和首页已存在从 `/api/user/models` 拉后台模型的主链路，静态固定模型模块只需要保留导出兼容，不应该再承载真实模型数据。

### 处理

- `assets/fixedImageModels-Rg0McL4V.js` 改为后端模型唯一来源模式：导出 `backend-model-source-only` 标记，固定模型数组和线路模型数组都返回空。
- `/api/user/models` 的默认线路兜底改为 `pub_route_openai_gpt_image_2`，并继续优先使用用户保存的图片线路。
- 入口、Canvas、Home 和 fixed model import query 统一升级为 `20260709modelsync1`。
- `scripts/smoke-internal-prod.ps1` 增加 backend-source-only 断言，并阻止真实模型关键字再次进入固定模型资产。

### 验证

- `node --check` 覆盖 `assets/fixedImageModels-Rg0McL4V.js`、`assets/index-DglIsp_g.js`、`assets/Canvas-B8bY9_QL.js`、`assets/HomeIndex-DAjDt0aj.js`、`server.js`。
- `git -C "F:\dianshang" diff --check` 通过。
- 修改文件均为 UTF-8 无 BOM。
- 最终镜像 ID：`sha256:02f8ba50fd739fd9411546364238d05d69121dc24fdd286b8e6ebd7261c13c12`。
- 镜像创建时间：`2026-07-09T05:12:15.929785193Z`。
- 容器启动时间：`2026-07-09T05:12:24.5713627Z`。
- 容器 Health：`healthy`。
- `http://localhost:3456/` 与 `http://192.168.0.39:3456/` 均命中 `index-DglIsp_g.js?v=20260709modelsync1`。
- `assets/index-DglIsp_g.js?v=20260709modelsync1` 命中 `Canvas-B8bY9_QL.js?v=20260709modelsync1`、`HomeIndex-DAjDt0aj.js?v=20260709modelsync1` 和 `fixedImageModels-Rg0McL4V.js?v=20260709modelsync1`。
- `assets/fixedImageModels-Rg0McL4V.js?v=20260709modelsync1` 返回 200，包含 `backend-model-source-only`，不包含 PackyAPI、lingsuan、6789、RK、Comfly、Nano Banana、Flatfee、VIP、Gemini 等真实模型关键字。
- `scripts/smoke-internal-prod.ps1` 通过。
- 临时新增模型 `codex-auto-sync-smoke-1783574041519` 到后台线路 `pub_route_openai_gpt_image_2` 后，普通用户模型接口立即可见；删除后再次查询不可见，确认前端模型来源会自动跟后台同步。

### 剩余风险

- 本轮未执行真实生图和真实扣费。
- 已打开的画布页面如果仍显示旧模型，需要强刷页面或重新进入画布，让浏览器加载 `modelsync1` 入口。

## 2026-07-09 画布 agent 套图 tab 图标复核

### 已确认

- 用户截图中的 `agent电商套图` tab 对应当前 Canvas chunk 内的 `video` tab 配置。
- 该 tab 之前使用 `icon:oo`，视觉上是摄像机图标；对于当前 agent 电商套图入口，魔法棒更符合“AI 自动生成套图”的语义。

### 处理

- `assets/Canvas-B8bY9_QL.js` 将 `video` tab 的图标引用从 `oo` 改为 `gd`。
- 静态资源 query 统一升级为 `20260709agenticon1`。
- `scripts/smoke-internal-prod.ps1` 增加图标引用断言，防止后续又回退到摄像机图标。

### 验证

- `node --check` 覆盖 `assets/Canvas-B8bY9_QL.js`、`assets/index-DglIsp_g.js`、`assets/HomeIndex-DAjDt0aj.js`、`assets/fixedImageModels-Rg0McL4V.js`。
- `git -C "F:\dianshang" diff --check` 通过。
- 修改文件均为 UTF-8 无 BOM。
- 最终镜像 ID：`sha256:67bb7e40487e02a4c5499f60c82f1d9a7d75a3284f7dd61232cbdfdbfabf4a28`。
- 镜像创建时间：`2026-07-09T05:40:07.418120767Z`。
- 容器启动时间：`2026-07-09T05:40:16.072440369Z`。
- 容器 Health：`healthy`。
- `http://localhost:3456/` 与 `http://192.168.0.39:3456/` 均命中 `index-DglIsp_g.js?v=20260709agenticon1`。
- `assets/index-DglIsp_g.js?v=20260709agenticon1` 命中 `Canvas-B8bY9_QL.js?v=20260709agenticon1`。
- `assets/Canvas-B8bY9_QL.js?v=20260709agenticon1` 返回 200，包含 `icon:gd}],a=l0`，不包含 `icon:oo}],a=l0`。
- `scripts/smoke-internal-prod.ps1` 通过。

### 剩余风险

- 本轮只替换 tab 图标，不改 agent 生成逻辑。
- 已打开的画布页面如果仍显示旧摄像机图标，需要强刷页面或重新进入画布，让浏览器加载 `agenticon1` 入口。
