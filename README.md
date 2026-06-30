# 哈吉米 AI 电商工作台源码化分支

本分支用于从旧的打包资产维护模式，迁移到源码优先的新技术栈。当前旧内网版本是稳定基线；新画布已废止，画布功能回滚到旧打包资产。

## 技术栈边界

### 当前过渡栈

- 旧前端：已打包 Vue 资产，位于 `assets/`。
- 旧后端：`server.js`，Express + better-sqlite3 + SQLite。
- 旧部署：`npm start`、Docker Compose、mock/New-API Adapter。

### 新源码目标栈

- 前端：Vue 3、Vite、TypeScript、Vue Router。
- 状态：Pinia。
- API：Axios。
- UI：Naive UI。
- 图标：lucide-vue-next。
- 画布：`frontend/` 提供旧画布源码入口壳，运行时继续使用旧打包资产中的哈基米旧画布；不再承载新画布。
- 后端目标：Node.js + TypeScript，先兼容旧 `/api/*`，再逐步模块化。
- 数据目标：内网继续 SQLite；生产阶段迁移 Postgres 或 MySQL。
- 任务目标：Redis + BullMQ + AI Worker。
- 文件目标：S3 兼容对象存储。
- AI 网关：New-API/官方 OpenAI 兼容上游；本项目不自研通用模型网关、账号池或渠道调度。

## 阶段门禁

- Phase 0：纪律基线，完成 AGENTS、README、API 契约、后端边界、画布迁移清单和记录反馈。
- Phase 1：前端源码壳，只在 `frontend/` 中继续 Vue 3 + Vite + TypeScript 开发。
- Phase 2：新版画布已废止；画布只回滚旧版本，不再继续迁移 Vue Flow 画布。
- Phase 3：API 契约和后端边界，先文档化再拆代码。
- Phase 4：生产基础设施，NestJS、Prisma、Postgres/MySQL、Redis/BullMQ、MinIO/S3 进入前必须先确认环境和迁移验收点。

## 环境与人工确认

- 任何系统软件、全局 CLI、数据库、Redis、Docker 服务、对象存储、New-API/CPA 配置，必须先问用户。
- 新增 npm 包前，必须先说明用途、开源项目、许可证、官网或 GitHub，并等待确认。
- 缺成熟开源基座时停止推进，先让用户下载或配置，不写自研替代品。
- 每轮涉及代码结构时先检查 CodeGraph；未初始化时先问用户是否运行 `codegraph init -i`。

## 禁止搓轮子

- 禁止继续开发新画布；旧画布问题优先在旧资产和现有后端接口内做最小修复。
- 禁止自研 UI 组件库；使用 Naive UI，必要样式只做业务布局和品牌层。
- 禁止自研全局状态库；使用 Pinia。
- 禁止自研 HTTP Client；使用 Axios。
- 禁止自研 AI 网关、Token 分发、模型渠道和账号池；复用 New-API/CPA。
- 禁止继续把大功能写进旧 `assets/*.js`；旧打包资产只允许阻塞级 bug 修复。
- 禁止绕开 TypeScript 类型检查；类型问题必须修到 `npm run build` 通过。

## 新前端命令

```powershell
cd "F:\dianshang\frontend"
npm install
npm run dev
npm run build
```

默认开发地址：`http://127.0.0.1:5173`

Vite 会把 `/api` 和 `/uploads` 代理到旧后端 `http://127.0.0.1:3456`。`frontend/` 的 `/canvas` 是源码直跳入口，会整页跳转到旧后端画布 `http://127.0.0.1:3456/canvas`；本地文件夹授权和保存必须在旧画布顶层页面执行。新后端准备接管接口前，不在 `F:\dianshang` 根目录安装后端依赖；本阶段复用旧项目后端作为稳定基线：

```powershell
cd "C:\Users\pc\Desktop\hjm-mb-clone"
node server.js
```

## 画布回滚状态

新画布已废止并从 `frontend/` 构建链路移除：

- 已删除 `frontend/src/views/CanvasStudio.vue`。
- 已删除新画布 Store、类型、运行适配器和 Infinite-Canvas 模板文件。
- 已卸载 `@vue-flow/*` 依赖。
- `frontend/src/views/CanvasLegacySource.vue` 只负责直跳旧画布运行时，不嵌入旧画布 iframe，不开发新画布。
- 后续画布验收以旧后端 `http://127.0.0.1:3456/canvas` 为准。

## API 线路收敛

当前目标只保留两条 API 线路：

- 图片线路：`GPT Image 2`，模型键 `gpt-image-2`，官方请求形态 `POST /images/generations`，最小请求体 `{ "model": "gpt-image-2", "prompt": "string" }`。
- 图生图能力归属同一图片线路，官方请求形态 `POST /images/edits`，最小请求体 `{ "model": "gpt-image-2", "images": [{ "image_url": "..." }], "prompt": "string" }`；局部重绘时额外传 `mask`。
- 文本线路：`GPT 5.5`，模型键 `gpt-5.5`，官方请求形态 `POST /responses`，最小请求体 `{ "model": "gpt-5.5", "input": "string" }`。

后台 `/admin/api-providers` 现在是写入试点页，允许整包替换为上述两条线路；不得继续恢复旧的多渠道列表，不得新增自研网关字段。真实供应商 Key、New-API/CPA 配置或外部付费测试仍需人工确认。

前端能力展示已收敛到 `frontend/src/config/providerCapabilities.ts`。后续新增模型或中转站时，优先扩展能力注册表和后端 Provider Adapter，不在页面里手写请求 JSON，不让 API 线路反向控制前端功能模块。

## 维护测试

每次改动至少运行：

```powershell
npm run check:routes --prefix "F:\dianshang\frontend"
npm run build --prefix "F:\dianshang\frontend"
git diff --check
```

改 `frontend/` 源码页面或交互时额外运行：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File "F:\dianshang\scripts\smoke-source-frontend-ui.ps1"
```

该 smoke 会用 Playwright CLI 跑注册临时账号、清理临时账号、未登录态图库/用户中心/生成记录/兑换页边界、登录默认账号、旧站首页工作台导航、旧画布直跳入口、用户中心快捷导航、图库搜索/刷新、模板切换/填写、生成记录搜索/刷新、兑换码页填写但不提交、移动端 records/redeem 横向溢出检查、退出登录、源码后台登录、源码后台 Dashboard、源码后台用户管理只读搜索、源码后台任务监控只读搜索、源码后台消费日志只读搜索、源码后台订单管理只读搜索、源码后台兑换码管理只读搜索、源码后台模型价格只读搜索、源码后台 API 线路目标展示、源码后台模板工作流只读搜索、源码后台回收站只读搜索、源码后台系统设置保存试点展示和移动端后台横向溢出检查；不会触发真实生成、兑换码提交、后台兑换码创建/删除、后台模型价格保存、后台 API 线路测试/拉模型、后台模板工作流保存、后台回收站恢复/永久删除、后台系统设置保存、后台任务取消/删除、后台订单状态修改、后台余额修改、后台用户写入或图库删除。API 线路整包替换和真实 Key 测试属于人工确认动作，smoke 只检查按钮和目标配置展示。

源码前端一键基础校验：

```powershell
npm run verify:source --prefix "F:\dianshang\frontend"
```

完整人工验收按 `docs/source-frontend-acceptance-checklist.md` 执行；写入、删除、真实扣费和真实模型调用必须先确认测试数据与回滚方式。

改旧后端时额外运行：

```powershell
node --check "F:\dianshang\server.js"
powershell -NoProfile -ExecutionPolicy Bypass -File "F:\dianshang\scripts\smoke-backend-canvas-boundary.ps1"
powershell -NoProfile -ExecutionPolicy Bypass -File "F:\dianshang\scripts\smoke-api-disposable.ps1"
```

改旧打包资产时额外运行对应 `node --check assets/<file>.js` 和 `node "F:\dianshang\scripts\verify-canvas-performance-assets.js"`，并在 `docs/progress-report.md` 说明为什么必须改旧资产。

## 迁移记录

- 架构决策：`docs/adr/0002-source-first-technology-stack.md`
- 并行任务树：`docs/plans/2026-06-26-source-stack-canvas-rebuild-plan.md`
- API 契约：`docs/api-contract-next.md`
- 后端边界：`docs/backend-module-boundaries.md`
- 画布迁移清单：`docs/canvas-migration-checklist.md`
- 前端迁移路线图：`docs/frontend-migration-roadmap.md`
- 源码前端验收清单：`docs/source-frontend-acceptance-checklist.md`
- 每轮反馈：`docs/progress-report.md`
- 审查记录：`docs/review-log.md`
