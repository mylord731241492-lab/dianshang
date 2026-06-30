# Source Stack Canvas Rebuild Implementation Plan

> 2026-06-26 状态更新：本计划已废止。用户已要求新画布全部废止并回滚旧画布。后续不得按本计划继续推进 Vue Flow 新画布、Infinite-Canvas 节点迁移或新画布运行适配器。最新画布边界见 `docs/canvas-migration-checklist.md`。

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 在新分支上用成熟开源技术栈重建前端源码和画布，逐步替代旧打包资产维护模式。

**Architecture:** 先保留旧 Express API 作为兼容后端，新建 `frontend/` 源码工程承接所有新增前端功能。画布交互使用 Vue Flow，业务状态使用 Pinia，UI 使用 Naive UI，后续再按模块拆分后端并接入真实任务队列。

**Tech Stack:** Vue 3、Vite、TypeScript、Vue Router、Pinia、Axios、Naive UI、lucide-vue-next、Vue Flow、Express 兼容 API、后续 Node.js TypeScript、Prisma/Drizzle、Postgres/MySQL、Redis、BullMQ、S3 兼容对象存储、New-API/CPA。

---

## 并行任务树

```text
Root: 源码化电商工作台
├─ Lane A: 前端源码壳与设计系统
├─ Lane B: 新版画布与工作流
├─ Lane C: API 契约与后端模块化
├─ Lane D: AI 任务队列与资源存储
└─ Lane E: 测试、部署、文档和回归护栏
```

Lane A、B、C 可以并行推进；D 必须等 C 的任务模型确定后开始；E 贯穿所有 Lane。

## Task 1: 固化源码前端基座

**Files:**

- Modify: `frontend/package.json`
- Modify: `frontend/vite.config.ts`
- Modify: `frontend/src/main.ts`
- Modify: `frontend/src/router/index.ts`
- Test: `frontend` build

**Step 1: 校验依赖只使用成熟包**

确认 `package.json` 中前端依赖只包含 Vue、Vite、TypeScript、Vue Router、Pinia、Axios、Naive UI、lucide-vue-next、Vue Flow 相关包。

**Step 2: 运行构建**

Run:

```powershell
npm run build --prefix "F:\dianshang\frontend"
```

Expected: `vue-tsc` 和 `vite build` 通过。

**Step 3: 记录结果**

把构建结果写入 `docs/progress-report.md` 和 `docs/review-log.md`。

## Task 2: 新版画布第一阶段

**Files:**

- Modify: `frontend/src/views/CanvasStudio.vue`
- Modify: `frontend/src/stores/canvas.ts`
- Modify: `frontend/src/types/canvas.ts`
- Modify: `frontend/src/styles/app.css`
- Test: `npm run build --prefix frontend`

**Step 1: 保持 Vue Flow 为唯一画布交互核心**

禁止新增自研拖拽、连线、缩放、小地图、坐标换算和视口控制代码。节点新增、连接、视口适配必须通过 Vue Flow。

**Step 2: 完成基础工作流**

实现并验证：

- 新增提示词节点。
- 新增生图节点。
- 新增结果节点。
- 节点连接。
- 节点参数编辑。
- 本地保存。
- JSON 导入导出。

**Step 3: 运行构建**

Run:

```powershell
npm run build --prefix "F:\dianshang\frontend"
```

Expected: 构建通过，且没有新增 TypeScript 报错。

## Task 3: API 契约

**Files:**

- Create: `docs/api-contract-next.md`
- Modify: `frontend/src/api/http.ts`
- Modify: `docs/progress-report.md`
- Test: 文档 diff 和后端 smoke

**Step 1: 记录现有兼容 API**

按模块列出新前端会依赖的接口：

- Auth。
- User。
- Projects。
- Generation。
- Gallery。
- Admin。
- Provider。

**Step 2: 标记兼容字段**

对旧前端遗留字段、mock 字段和新源码字段分别标记，避免后续删错。

**Step 3: 运行后端 smoke**

Run:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File "F:\dianshang\scripts\smoke-api-disposable.ps1"
```

Expected: 旧 API 兼容层仍通过。

## Task 4: 后端模块化准备

**Files:**

- Create: `docs/backend-module-boundaries.md`
- Modify: `server.js` only when implementing a reviewed split
- Test: `node --check server.js`

**Step 1: 先写边界，不急拆代码**

记录后端模块目标：

- `auth`
- `users`
- `projects`
- `generation`
- `gallery`
- `admin`
- `provider`
- `billing`

**Step 2: 定义每个模块的输入输出**

每个模块写清楚路由、数据库表、外部依赖、错误码和测试脚本。

**Step 3: 拆分前先补测试**

任何拆分都必须先有对应 smoke 或单元测试，避免迁移时破坏旧接口。

## Task 5: AI 任务队列设计

**Files:**

- Create: `docs/architecture-ai-worker-queue.md`
- Modify: `docs/known-gaps.md`
- Test: 文档审查

**Step 1: 明确不自研网关**

Provider Adapter 只连接 New-API；CPA 只做 New-API 后置渠道。

**Step 2: 定义队列职责**

BullMQ Worker 负责：

- 生图任务执行。
- 失败重试。
- 超时处理。
- 任务状态回写。
- 生成结果入库。

**Step 3: 定义暂不实现项**

当前阶段不接 Redis、不启动 Worker，只写设计和接口预留。

## Task 6: 测试与维护护栏

**Files:**

- Modify: `README.md`
- Modify: `AGENTS.md`
- Modify: `docs/iteration-review-checklist.md`
- Modify: `docs/review-log.md`

**Step 1: 写清楚强制命令**

至少包括：

```powershell
npm run build --prefix "F:\dianshang\frontend"
git -C "F:\dianshang" diff --check
```

后端改动时增加：

```powershell
node --check "F:\dianshang\server.js"
powershell -NoProfile -ExecutionPolicy Bypass -File "F:\dianshang\scripts\smoke-api-disposable.ps1"
```

**Step 2: 写清楚禁止项**

重复写明禁止自研画布、UI 组件库、状态库、HTTP Client、AI 网关和账号池。

**Step 3: 每轮记录**

每轮必须更新：

- `docs/progress-report.md`
- `docs/review-log.md`

## Task 7: 多工作树并行建议

**Files:**

- No code required

**Step 1: 为每条 Lane 创建独立工作树**

建议目录：

```text
F:\dianshang-worktrees\frontend-shell
F:\dianshang-worktrees\canvas-flow
F:\dianshang-worktrees\api-contract
F:\dianshang-worktrees\worker-queue
```

**Step 2: 分支命名**

```text
codex/frontend-shell
codex/canvas-flow
codex/api-contract
codex/worker-queue
```

**Step 3: 合并顺序**

先合并 API 契约和测试护栏，再合并画布功能，再合并 Worker 设计。任何 Lane 合并前必须跑对应构建或 smoke。
