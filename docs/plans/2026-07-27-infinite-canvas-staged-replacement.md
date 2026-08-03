# Infinite Canvas 分阶段替换实施计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.
>
> **给 Kimi：** 必须逐任务执行，每个门禁通过后再进入下一任务。不得直接在 `F:\dianshang` 当前脏工作树修改，不得未经确认操作正式 `3456`、真实 Provider、真实账号余额或生产数据。

**目标：** 将 `basketikun/infinite-canvas` v0.10.0 改造成符合哈吉米 AI 现有账号、云端资产库、后台系统提示词、账号私有提示词、项目、任务、计费和图片工具接口的候选画布；在隔离环境完成自动化与人工验收后，原子替换生产唯一 `/canvas`，并保留明确回滚能力。

> **2026-07-29 用户优先级修正：** 用户明确本项目以“迁移 GitHub 原版功能”为主要目标。Task 10 不能再以删除原版 Agent 面板并换成三模式业务助手作为功能迁移完成证明。Task 13 虽已通过原范围自动化，但 Task 14 暂缓；必须先执行 `Task 13A：Agent 功能等价迁移`。详细差异、任务和验收见 `docs/infinite-canvas-agent-feature-migration.md`。

**架构：** 保留 Infinite Canvas 的 React 19 画布源码与成熟交互，不把它重写成 Vue，也不使用 iframe。候选源码固定放入 `integrations/infinite-canvas/`；浏览器除拖拽、连线、缩放、撤销重做等纯交互外，只调用哈吉米 AI 同源 `/api/*`。提示词分为“管理员在后台发布的系统提示词”和“当前账号私有提示词”，两者均由后端数据库保存并通过不同权限 API 提供；资产元数据由后端按账号管理，文件由后端对象存储适配器写入用户确认的云存储。Provider Key、对象存储密钥、计费、任务和文件删除权限始终只在后端。开发期只在独立工作树和独立 `3466` 候选端口运行，生产 `3456` 始终只有一个生效的 `/canvas`；人工验收通过后才一次性切换路由。

**技术栈：** React 19、TypeScript、Vite 7、Zustand、Ant Design、现有 Node.js/Express、SQLite、后端对象存储适配器、S3 兼容或用户指定云存储、Axios/fetch、Docker Compose、PowerShell smoke、Node 内置测试、Playwright/浏览器验收。

---

## 0. 执行者先读：当前事实与不可突破边界

### 0.1 固定事实

- 主工作区：`F:\dianshang`。
- 候选工作树：`F:\dianshang-worktrees\infinite-canvas-candidate`。
- 上游预览源码：`F:\dianshang-worktrees\infinite-canvas-preview`。
- 上游固定版本：tag `v0.10.0`。
- 上游固定提交：`a0287a5e346e219bd488d084295542213912d816`。
- 上游许可证：仓库根 `LICENSE` 为 AGPL-3.0；用户为上游联合作者并持有授权（2026-07-27 确认），许可记录见 Task 2 的 `PRIVATE-LICENSE-REFERENCE.md`。
- 部署形态：内网 Docker 部署，不公网暴露；云存储选型优先考虑内网 MinIO 容器（仍需用户在 Task 6 确认后才实施）。
- `server.js` 为 9300+ 行单文件且行尾混合 CRLF/LF；新增后端领域（资产、提示词等）必须落成 `backend/` 下独立模块（参照 `backend/billing/`、`backend/generation/` 先例），`server.js` 只做挂载；SQLite 加列复用 `backend/generation/task-repository.js` 的 `ensureColumn` 幂等迁移模式。
- 上游 `web/src/pages/canvas/project.tsx` 为 2987 行单文件且含 10+ 处 Provider 直连，Task 5/8/9/10 集中修改它，必须小步提交、逐任务过门禁，不得并行改动。
- 前端测试运行器约束：`node --experimental-strip-types --test` 仅适用于零应用源码 import 的纯契约测试（无 tsconfig 路径别名、无 JSX、无不可擦除 TS 语法，且需 Node ≥ 22.6，执行前先验证 Node 版本）；涉及组件或上游源码 import 的测试改用 web 工作区内 vitest（作为新依赖需用户批准）。各 Task 中的 strip-types 命令均按此约束执行。
- 当前唯一生产画布：`/canvas`、`/canvas/:projectId`。
- 当前生产画布运行资产：`assets/Canvas-*.js`、`assets/Canvas-*.css` 及现有 `assets/canvas-*.js/css` 过渡层。
- 当前源码入口壳：`frontend/src/views/CanvasLegacySource.vue`。
- 当前项目 API：`/api/user/projects*`。
- 当前上传 API：`/api/upload/image`。
- 当前持久生图任务：`/api/generate/tasks*`。
- 当前兼容生图入口：`/api/template/generate-image`。
- 当前图片工具：`/api/image-tools/outpaint`、`inpaint`、`erase`、`reverse-prompt`。
- 当前提示词扩写：`/api/canvas/enhance-prompt`。
- 当前 Canvas Chat：`/api/canvas/dialog-agent-generate`、`/api/canvas/ecommerce-suite/*`。
- 当前没有账号资产表、账号提示词表或真正的对象存储适配器。
- 当前所谓“云端图片”实际仍是服务器本地 `docker/uploads` + SQLite 引用，不能作为本计划的云端资产验收结果。
- 旧基线明确关闭 S3/MinIO；本计划开始实施前必须用 ADR 记录用户的新决定，并确认具体云存储方案。
- 正式入口：`http://192.168.0.39:3456/`。
- 候选默认入口：`http://127.0.0.1:3466/canvas`。

### 0.2 当前已知冲突

- `docs/canvas-migration-checklist.md` 和 `AGENTS.md` 仍记录“禁止继续 Infinite-Canvas 迁移”，这是 2026-07-07 废止旧方案后的有效护栏。
- 用户已于 2026-07-27 重新提出“先改造、隔离测试、再替换”的新目标，但开始编码前仍必须新增 ADR，并由用户确认该 ADR 后才更新旧护栏。
- CodeGraph 当前仍返回已经删除的 `frontend/src/views/CanvasStudio.vue`，属于已知索引滞后。不得把该路径当现状。
- `F:\dianshang` 当前有其他未提交改动。不得覆盖、格式化、暂存或提交这些无关改动。

### 0.3 硬性禁令

- 不得在正式 `3456` 同时暴露“旧画布”和“候选画布”两个用户入口。
- 不得把候选版挂成 `/canvas-next`、`/new-canvas` 后长期留在生产。
- 不得使用 iframe。
- 不得让浏览器保存或直连 Provider API Key。
- 不得把对象存储 Access Key、Secret、Bucket 管理权限或永久签名 URL 交给浏览器。
- 不得绕过 `callProviderImageGeneration`、`callProviderImageEdit`、持久任务、余额预占和退款逻辑。
- 不得让 Infinite Canvas 继续使用 IndexedDB 作为登录用户项目的唯一事实源。
- 不得让 Infinite Canvas 使用 IndexedDB/localStorage 作为账号资产库或账号提示词库的事实源。
- 不得继续把服务器本地 `uploads` 描述成已经完成的云端资产库。
- 不得在未确认云存储厂商、Endpoint、Region、Bucket、访问方式、费用和备份策略前安装或启用 S3/MinIO SDK。
- 不得把 Base64 大图写入项目 JSON。
- 不得自动覆盖或批量转换现有用户项目。
- 不得未经确认安装新 npm 包、启动新生产服务、调用真实 Provider 或产生费用。
- 不得修改正式 Docker、生产数据库或正式容器，直到任务 13 的人工切换门禁被用户明确放行。

## 1. 目标形态

```text
浏览器 /canvas
  └─ Infinite Canvas React UI
       ├─ auth/profile adapter ─────────────── /api/user/profile
       ├─ project repository ──────────────── /api/user/projects*
       ├─ cloud asset repository ───────────── /api/user/assets*
       ├─ cloud upload adapter ─────────────── /api/user/assets/upload
       ├─ system prompt repository ─────────── /api/prompts/system*
       ├─ private prompt repository ────────── /api/user/prompts*
       ├─ generation task adapter ──────────── /api/generate/tasks*
       ├─ compatibility generation adapter ─── /api/template/generate-image
       ├─ image tool adapter ───────────────── /api/image-tools/*
       ├─ prompt adapter ───────────────────── /api/canvas/enhance-prompt
       └─ assistant adapter ────────────────── /api/canvas/dialog-agent-generate
                                                /api/canvas/ecommerce-suite/*

Express/SQLite/Provider/余额/任务/云存储适配器继续是唯一后台
```

生产切换前：

```text
3456 /canvas  -> 当前画布
3466 /canvas  -> 候选画布 + 隔离 SQLite + Mock/Fake Provider
```

生产切换后：

```text
3456 /canvas  -> 候选画布（唯一入口）
旧镜像        -> 只用于紧急回滚，不再提供第二入口
```

## 2. 项目数据格式

候选项目必须保存为带版本的信封，不直接把上游 Store 裸对象写入数据库：

```ts
export type HjmInfiniteCanvasProjectEnvelope = {
  schema: "hjm.infinite-canvas.project";
  schemaVersion: 1;
  engine: "infinite-canvas";
  upstreamVersion: "0.10.0";
  project: {
    nodes: CanvasNodeData[];
    connections: CanvasConnection[];
    chatSessions: CanvasAssistantSession[];
    activeChatId: string | null;
    backgroundMode: CanvasBackgroundMode;
    showImageInfo: boolean;
    viewport: ViewportTransform;
  };
  references?: {
    assetIds?: string[];
    prompts?: Array<{
      scope: "system" | "user";
      promptId: string;
      version?: number;
      contentSnapshot: string;
    }>;
  };
};
```

规则：

- 数据库 `projects.id` 使用服务器返回的 `proj_*`，不再使用浏览器临时 nanoid 作为最终项目 ID。
- 图片、视频、音频节点优先保存账号所属 `assetId`、受控访问 URL、对象键、尺寸、MIME、字节数和必要元数据。
- 节点引用提示词时保存 `scope + promptId + version + contentSnapshot`；管理员后续修改/停用系统提示词，或用户修改/删除自己的提示词时，不追溯改写已有项目内容。
- `blob:`、`data:image/*`、本机绝对路径不得进入服务器项目 JSON。
- IndexedDB 只允许保存按 `userId + projectId` 隔离的崩溃恢复草稿；服务器成功保存后清理对应草稿。
- 退出登录、401 或切换账号时必须清空当前用户内存态，不得显示上一用户项目。
- 旧项目识别不到上述信封时进入“旧项目导入”流程，原记录保持不变。

## 3. 上线阻断级功能矩阵

| 能力 | 候选要求 | 后端来源 | 是否阻断替换 |
| --- | --- | --- | :---: |
| 登录、退出、头像、余额 | 使用现有主站会话 | `/api/user/profile` | 是 |
| 项目列表、创建、改名、删除 | 服务器权威存储 | `/api/user/projects*` | 是 |
| 自动保存、刷新恢复 | 节点、连线、视口完整恢复 | `/api/user/projects/:id` | 是 |
| 旧项目保护 | 非破坏性导入，原项目不覆盖 | 现有 projects 表 | 是 |
| 文本、图片、生成配置、分组节点 | 保留上游交互 | 候选前端 | 是 |
| 拖拽、框选、连线、缩放、小地图、撤销重做 | 保留上游交互 | 候选前端 | 是 |
| 云端资产列表、搜索、分页 | 按账号隔离，后端返回元数据 | `/api/user/assets` | 是 |
| 云端上传 | 后端接收文件并写对象存储 | `/api/user/assets/upload` | 是 |
| 云端资产改名、标签、删除 | 删除前检查归属，后端操作对象存储 | `/api/user/assets/:id` | 是 |
| 后台系统提示词 | 管理员 CRUD、发布、停用、排序和版本 | `/api/admin/system-prompts*` | 是 |
| 用户读取系统提示词 | 只读已发布内容、搜索、分类 | `/api/prompts/system*` | 是 |
| 账号自定义提示词 | 私有 CRUD、搜索、收藏、插入画布 | `/api/user/prompts*` | 是 |
| 文生图、图生图、多参考图 | 持久任务、幂等、轮询 | `/api/generate/tasks*` | 是 |
| 局部重绘 | 原图 + mask + prompt | `/api/image-tools/inpaint` | 是 |
| 智能擦除 | 原图 + mask | `/api/image-tools/erase` | 是 |
| AI 扩图 | 原图 + 布局参数 | `/api/image-tools/outpaint` | 是 |
| 反推提示词 | 使用文本路线 | `/api/image-tools/reverse-prompt` | 是 |
| AI 扩写 | 免费且不自动生图 | `/api/canvas/enhance-prompt` | 是 |
| 裁剪、尺寸调整、九宫格 | 浏览器本地处理后上传 | 候选前端 + upload | 是 |
| 生成历史 | 可插入画布 | `/api/user/generations` | 是 |
| 对话、快速、电商套图三模式 | 三套独立状态 | `/api/canvas/*` | 是 |
| 失败退款、取消、人工重试 | 显示真实任务状态 | `/api/generate/tasks*` | 是 |
| 视频/音频生成 | 后端无正式契约时隐藏或禁用 | 无 | 否 |
| 原版 Agent 核心用户能力 | 复用 Infinite Canvas MCP 工具，由服务端 Lingsuan Agent Runtime 驱动；画布读写、确认/拒绝、会话、停止、诊断和站点工具必须等价迁移 | `/api/canvas/*`、`/api/user/*`、`/api/generate/tasks*` | 是 |
| 上游 Local URL、Token、本机 Codex/Claude 和插件配置 | 网页版明确不恢复，普通用户无需安装本地程序 | 无 | 否 |
| 上游插件市场、配置/API Key 页 | 从主站候选版移除 | 无 | 否 |
| 上游独立首页、图片台、视频台 | 不进入 `/canvas` 候选范围 | 无 | 否 |

### 3.1 后端 API 总原则

只有以下行为允许完全在浏览器本地完成：

- 拖拽、框选、连线、缩放、小地图和视口。
- 撤销、重做和未提交的临时编辑状态。
- 裁剪、mask 绘制、九宫格切分等不涉及账号数据持久化的瞬时计算。

以下能力必须经过同源后端 API：

- 登录、用户资料、余额、权限。
- 项目列表、项目详情、创建、保存、改名、删除和旧项目导入。
- 资产上传、列表、搜索、标签、改名、删除、访问授权和对象存储。
- 后台系统提示词的管理员创建、编辑、发布、停用、排序和版本管理。
- 普通用户只读访问已发布系统提示词。
- 账号自定义提示词的创建、读取、编辑、删除、搜索和收藏。
- 模型路线、模型价格、生成参数和能力开关。
- 文生图、图生图、局部重绘、擦除、扩图、反推和扩写。
- 生成任务的幂等、排队、取消、重试、退款和历史。
- Canvas Chat、快速模式和电商套图。

候选运行 bundle 中不得存在 Provider 直连、对象存储直连、浏览器持久化账号资产或浏览器持久化账号提示词的生产路径。

---

### Task 1：建立新立项 ADR 与执行工作树

**文件：**

- 新建：`docs/adr/0005-infinite-canvas-atomic-replacement.md`
- 修改：`docs/canvas-migration-checklist.md`
- 修改：`docs/canvas-maintenance-boundary.md`
- 修改：`docs/current-baseline.md`
- 修改：`AGENTS.md`

**Step 1：确认实施基线**

运行：

```powershell
git -C "F:\dianshang" status --short
git -C "F:\dianshang" rev-parse HEAD
git -C "F:\dianshang" branch --show-current
```

预期：

- 记录当前提交和分支。
- 如果主工作区有未提交改动，不处理、不暂存、不提交。
- 向用户确认候选工作树应基于哪个已提交 `BASE_COMMIT`。
- 当前主工作区有 17 个未提交改动（含 `server.js`、`scripts/smoke-internal-prod.ps1` 等，在 `codex/generation-stability-10-users` 分支上），候选工作树基于已提交 BASE_COMMIT 不包含这些改动；必须与用户确认这些在途改动的回流时机与合并协调策略。

**Step 2：创建独立工作树**

得到用户确认的提交后运行：

```powershell
git -C "F:\dianshang" worktree add -b "codex/infinite-canvas-candidate" "F:\dianshang-worktrees\infinite-canvas-candidate" "<BASE_COMMIT>"
```

预期：

- 新工作树分支为 `codex/infinite-canvas-candidate`。
- `F:\dianshang` 的未提交改动保持原样。

**Step 3：写 ADR**

ADR 必须明确：

- 本计划取代 2026-07-07 的“继续禁止 Infinite Canvas 迁移”结论，但不恢复已废止的 Vue Flow 重建方案。
- 只保留一个生产 `/canvas`。
- 候选测试只能在独立工作树、独立端口和隔离数据中进行。
- 保留 React 源码，不重写 Vue，不使用 iframe。
- 后端继续复用现有 `/api/*`、Provider、计费和队列；资产文件从服务器本地 `uploads` 演进为后端管理的云对象存储。
- 新增账号私有资产与账号私有提示词两个后端领域，前端不得以 IndexedDB 代替。
- 云存储的厂商、Endpoint、Region、Bucket、访问策略、费用、生命周期和备份恢复必须由用户确认；没有确认不得自行选择 MinIO、AWS S3 或其他供应商。
- 明确正式 compose 事实源：根目录 `docker-compose.internal.yml`（容器 `dianshang-app`）与 `docker/docker-compose.yml`（容器 `dianshang-internal-app`）并存，ADR 必须指明哪一份是正式部署事实源以及另一份的角色。
- 只有用户签署候选验收后才能切换。
- 回滚通过上一正式镜像和一致性备份完成。

**Step 4：等待用户批准 ADR**

停止执行并把 ADR 给用户审阅。没有明确批准，不得修改 `AGENTS.md` 中的禁止事项，也不得导入源码。

**Step 5：更新边界文档**

用户批准后，把旧文档改成：

- 禁止在生产长期并列两套画布。
- 允许本 ADR 定义的隔离候选改造。
- 候选未过门禁前，当前 `/canvas` 仍是唯一生产事实。
- 旧 ADR 中“不启用 S3/MinIO”的决定被本次用户需求重新打开，但只在新的存储 ADR 和配置确认后实施。
- 旧 `2026-06-26-source-stack-canvas-rebuild-plan.md` 继续仅作历史记录。

**Step 6：处理 CodeGraph**

CodeGraph 当前索引滞后。先向用户说明用途并获得确认，再运行项目允许的 CodeGraph 刷新命令。刷新后确认不再出现已删除的：

```text
frontend/src/views/CanvasStudio.vue
frontend/src/stores/canvas.ts
frontend/src/types/canvas.ts
```

**Step 7：验证文档**

运行：

```powershell
git -C "F:\dianshang-worktrees\infinite-canvas-candidate" diff --check
```

预期：无空白错误、无 BOM、无无关文件变化。

**Step 8：提交**

```powershell
git -C "F:\dianshang-worktrees\infinite-canvas-candidate" add AGENTS.md docs/adr/0005-infinite-canvas-atomic-replacement.md docs/canvas-migration-checklist.md docs/canvas-maintenance-boundary.md docs/current-baseline.md
git -C "F:\dianshang-worktrees\infinite-canvas-candidate" commit -m "docs: authorize isolated infinite canvas candidate"
```

---

### Task 2：固定上游源码、许可证明和依赖门禁

**文件：**

- 新建：`integrations/infinite-canvas/UPSTREAM.md`
- 新建：`integrations/infinite-canvas/LICENSE.upstream`
- 新建：`integrations/infinite-canvas/PRIVATE-LICENSE-REFERENCE.md`
- 新建：`docs/research/2026-07-27-infinite-canvas-dependency-license-inventory.md`
- 导入：`integrations/infinite-canvas/web/`
- 导入：`integrations/infinite-canvas/VERSION`
- 导入：`integrations/infinite-canvas/CHANGELOG.md`

**Step 1：验证预览源码**

```powershell
git -C "F:\dianshang-worktrees\infinite-canvas-preview" rev-parse HEAD
git -C "F:\dianshang-worktrees\infinite-canvas-preview" describe --tags --exact-match
git -C "F:\dianshang-worktrees\infinite-canvas-preview" status --short
```

预期：

- HEAD 为 `a0287a5e346e219bd488d084295542213912d816`。
- tag 为 `v0.10.0`。
- 上游预览工作树干净。

**Step 2：导入固定源码**

只导入 Web 运行所需源码、版本、变更记录和上游许可证。不得复制上游 `.git`、本地缓存或 `node_modules`。以 `web/package-lock.json` 为唯一依赖事实源；上游 `bun.lock` 不导入。

**Step 3：记录许可**

`PRIVATE-LICENSE-REFERENCE.md` 只记录：

- 首行必须注明：用户为上游联合作者并持有授权（2026-07-27 确认）；上游仓库 LICENSE 为 AGPL-3.0，本授权取代 AGPL 对本项目的约束。
- 授权方。
- 授权日期。
- 授权对象/项目。
- 允许修改、内网部署和并入现有项目的范围。
- 原始授权文件的离线保管位置或摘要指纹。

不得把包含个人信息、签名、价格或保密条款的完整许可上传到公开仓库。

**Step 4：生成依赖清单**

从 `web/package-lock.json` 和 `package.json` 生成直接依赖、版本、用途、许可证和官方链接清单。禁止先执行安装再补许可说明。清单必须特别标注：`antd` 为 v6 大版本、`@ant-design/pro-components` 为 3.0.0-beta.3 预发布依赖。

**Step 5：等待依赖批准**

向用户说明这些依赖来自固定上游 v0.10.0，候选版不会升级版本，也不会添加新的画布引擎。用户确认后才允许执行：

```powershell
npm ci --prefix "F:\dianshang-worktrees\infinite-canvas-candidate\integrations\infinite-canvas\web"
```

预期：严格使用上游 lockfile；不得运行 `npm update`。

**Step 6：基线构建**

```powershell
npm run typecheck --prefix "F:\dianshang-worktrees\infinite-canvas-candidate\integrations\infinite-canvas\web"
npm run build --prefix "F:\dianshang-worktrees\infinite-canvas-candidate\integrations\infinite-canvas\web"
```

预期：两条命令均退出 0。

**Step 7：提交**

```powershell
git -C "F:\dianshang-worktrees\infinite-canvas-candidate" add integrations/infinite-canvas docs/research/2026-07-27-infinite-canvas-dependency-license-inventory.md
git -C "F:\dianshang-worktrees\infinite-canvas-candidate" commit -m "chore: vendor licensed infinite canvas v0.10.0"
```

---

### Task 3：增加可切换但单入口的画布运行时

**文件：**

- 修改：`Dockerfile`
- 修改：`docker/docker-compose.yml`
- 修改：`docker/.env.example`
- 修改：`server.js`
- 修改：`integrations/infinite-canvas/web/vite.config.ts`
- 新建：`scripts/test-infinite-canvas-runtime-route.js`

**Step 1：先写失败测试**

测试必须启动 disposable 后端并断言：

- `CANVAS_RUNTIME=legacy` 时 `/canvas` 返回当前入口。
- `CANVAS_RUNTIME=infinite` 时 `/canvas` 和 `/canvas/proj_test` 返回候选 `index.html`。
- 候选静态资源从 `/canvas-app/assets/*` 返回。
- 未知 `/api/*` 仍返回 API 404，不落入候选 HTML。
- 两种模式都只存在一个 `/canvas` 用户入口。

运行：

```powershell
node "F:\dianshang-worktrees\infinite-canvas-candidate\scripts\test-infinite-canvas-runtime-route.js"
```

预期：首次失败，错误为候选运行时尚未实现。

**Step 2：增加构建阶段**

在 `Dockerfile` 增加独立 `canvas-build` stage：

```dockerfile
FROM ${NODE_IMAGE} AS canvas-build

WORKDIR /build/infinite-canvas/web

COPY integrations/infinite-canvas/web/package*.json ./
RUN npm ci

COPY integrations/infinite-canvas/VERSION ../VERSION
COPY integrations/infinite-canvas/CHANGELOG.md ../CHANGELOG.md
COPY integrations/infinite-canvas/web/ ./

ENV VITE_BASE=/canvas-app/
RUN npm run build
```

运行时镜像复制：

```dockerfile
COPY --from=canvas-build /build/infinite-canvas/web/dist /app/integrations/infinite-canvas/web/dist
```

**Step 3：增加运行时开关**

规则：

```text
CANVAS_RUNTIME=legacy    -> 当前画布
CANVAS_RUNTIME=infinite  -> 候选画布
其他值                   -> 启动失败，不静默猜测
```

正式 `.env` 在切换前保持 `legacy`。候选 Docker 明确传 `infinite`。

**Step 4：增加 Express 路由**

候选静态资源使用：

```text
/canvas-app/*
```

候选 HTML 使用：

```text
/canvas
/canvas/:projectId
```

候选路由必须放在源码前端 SPA fallback 之前；不得影响 `/`、`/user/center`、`/admin/*`、`/chat/*` 和 `/api/*`。

**Step 5：让健康接口暴露脱敏状态**

`/api/health` 增加：

```json
{
  "canvasRuntime": "legacy"
}
```

只暴露运行时名称，不暴露文件路径或密钥。

**Step 6：运行测试**

```powershell
node "F:\dianshang-worktrees\infinite-canvas-candidate\scripts\test-infinite-canvas-runtime-route.js"
node --check "F:\dianshang-worktrees\infinite-canvas-candidate\server.js"
npm run build --prefix "F:\dianshang-worktrees\infinite-canvas-candidate\integrations\infinite-canvas\web"
```

预期：全部通过。

**Step 7：提交**

```powershell
git -C "F:\dianshang-worktrees\infinite-canvas-candidate" add Dockerfile docker/docker-compose.yml docker/.env.example server.js integrations/infinite-canvas/web/vite.config.ts scripts/test-infinite-canvas-runtime-route.js
git -C "F:\dianshang-worktrees\infinite-canvas-candidate" commit -m "feat: add single-route canvas runtime switch"
```

---

### Task 4：接入主站认证、用户信息和同源 HTTP

**文件：**

- 新建：`integrations/infinite-canvas/web/src/integrations/hajimi/http.ts`
- 新建：`integrations/infinite-canvas/web/src/integrations/hajimi/auth.ts`
- 新建：`integrations/infinite-canvas/web/src/integrations/hajimi/auth.test.ts`
- 修改：`integrations/infinite-canvas/web/src/stores/use-user-store.ts`
- 修改：`integrations/infinite-canvas/web/src/layouts/user-layout.tsx`
- 修改：`integrations/infinite-canvas/web/src/router.tsx`
- 修改：`server.js`（扩展源码前端路由白名单纳入 `/login`）

**Step 1：写认证失败测试**

至少覆盖：

- 从 `localStorage.auth_token` 读取 JWT。
- 请求自动发送 `Authorization: Bearer <token>`。
- 401 清除 `auth_token`、`auth_user` 和候选用户内存态。
- 401 跳转 `/login?redirect=/canvas...`。
- 不读取 `api_key`、`apiKey` 或上游 Provider Key。

运行：

```powershell
node --experimental-strip-types --test "F:\dianshang-worktrees\infinite-canvas-candidate\integrations\infinite-canvas\web\src\integrations\hajimi\auth.test.ts"
```

预期：首次失败。

**Step 2：实现同源客户端**

客户端要求：

- `baseURL` 为空字符串，只请求当前 origin。
- 默认超时不短于现有图片任务轮询需要。
- 统一解析后端 `{ message, code }`。
- 不在日志打印 token、图片 Base64、完整提示词或响应正文。

**Step 3：实现认证引导**

加载 `/canvas*` 时：

1. 没有 token：跳登录。
2. 有 token：调用 `/api/user/profile`。
3. 成功：写入 `use-user-store`。
4. 401：清理并跳登录。
5. 其他错误：显示可重试错误页，不假装未登录。

**Step 4：收敛候选路由**

第一阶段只保留：

```text
/canvas
/canvas/:id
```

移除或不可达：

```text
/
/image
/video
/assets
/prompts
/config
```

主站 Logo、返回首页、用户中心、头像和余额使用主站数据。

注意：`/login` 当前不在源码前端路由白名单（`sourceFrontendRoutePattern`，server.js 只放行 `/admin/*` 和 `/gallery`），401 跳转会落入旧 SPA 兜底。本任务必须同步扩展该白名单纳入 `/login`，并在 Task 3 的路由测试脚本中补充对应断言。

**Step 5：运行测试**

```powershell
node --experimental-strip-types --test "F:\dianshang-worktrees\infinite-canvas-candidate\integrations\infinite-canvas\web\src\integrations\hajimi\auth.test.ts"
npm run typecheck --prefix "F:\dianshang-worktrees\infinite-canvas-candidate\integrations\infinite-canvas\web"
npm run build --prefix "F:\dianshang-worktrees\infinite-canvas-candidate\integrations\infinite-canvas\web"
```

预期：全部通过。

**Step 6：提交**

```powershell
git -C "F:\dianshang-worktrees\infinite-canvas-candidate" add integrations/infinite-canvas/web/src
git -C "F:\dianshang-worktrees\infinite-canvas-candidate" commit -m "feat: connect canvas to main site authentication"
```

---

### Task 5：把项目 Store 改成服务器权威存储

**文件：**

- 新建：`integrations/infinite-canvas/web/src/integrations/hajimi/project-schema.ts`
- 新建：`integrations/infinite-canvas/web/src/integrations/hajimi/projects-api.ts`
- 新建：`integrations/infinite-canvas/web/src/integrations/hajimi/projects-api.test.ts`
- 新建：`integrations/infinite-canvas/web/src/integrations/hajimi/project-draft-cache.ts`
- 修改：`integrations/infinite-canvas/web/src/stores/canvas/use-canvas-store.ts`
- 修改：`integrations/infinite-canvas/web/src/pages/canvas/index.tsx`
- 修改：`integrations/infinite-canvas/web/src/pages/canvas/project.tsx`
- 修改：`integrations/infinite-canvas/web/src/components/canvas/canvas-project-card.tsx`

**Step 1：写项目契约测试**

覆盖：

- 列表兼容读取 `items/projects/list/data`，内部统一为 `items`。
- 创建发送 `{ name, data: envelope }` 并使用服务器返回 ID。
- 详情读取 `{ project }` 或顶层字段。
- 更新发送 `{ name, data: envelope }`。
- 删除只删除当前登录用户项目。
- 无法识别的 data 标记为 `legacy`，不抛弃原数据。
- 序列化结果不含 `data:image/`、`blob:` 和 Windows 绝对路径。

运行：

```powershell
node --experimental-strip-types --test "F:\dianshang-worktrees\infinite-canvas-candidate\integrations\infinite-canvas\web\src\integrations\hajimi\projects-api.test.ts"
```

预期：首次失败。

**Step 2：实现异步项目仓库**

上游的同步 `createProject(): string` 必须改为异步服务器创建。导航只能使用服务器返回的 `proj_*`。同时必须显式禁用上游 zustand `persist` 对整个画布 Store 的 localForage/IndexedDB 持久化（含 400ms 防抖写入窗口，封装于 `web/src/lib/localforage-storage.ts`），仅保留按 `userId + projectId` 隔离的崩溃恢复草稿。

**Step 3：实现自动保存**

规则：

- 本地节点操作立即更新 UI。
- 合并保存间隔建议 1000ms。
- 拖拽、缩放连续事件不得每帧调用 PUT。
- 切换项目、关闭页面和退出登录前尝试 flush。
- 保存状态显示“保存中 / 已保存 / 保存失败”。
- 保存失败保留当前用户的恢复草稿，并提供重试。
- 服务器保存成功后删除同项目草稿。

**Step 4：实现项目加载**

- `/canvas` 只请求列表。
- `/canvas/:id` 再请求详情。
- 加载失败不创建空项目覆盖原项目。
- 404 显示项目不存在。
- 403/跨用户访问不泄漏项目名称或数据。

**Step 5：运行测试**

```powershell
node --experimental-strip-types --test "F:\dianshang-worktrees\infinite-canvas-candidate\integrations\infinite-canvas\web\src\integrations\hajimi\projects-api.test.ts"
npm run typecheck --prefix "F:\dianshang-worktrees\infinite-canvas-candidate\integrations\infinite-canvas\web"
npm run build --prefix "F:\dianshang-worktrees\infinite-canvas-candidate\integrations\infinite-canvas\web"
```

预期：全部通过。

**Step 6：提交**

```powershell
git -C "F:\dianshang-worktrees\infinite-canvas-candidate" add integrations/infinite-canvas/web/src
git -C "F:\dianshang-worktrees\infinite-canvas-candidate" commit -m "feat: persist infinite canvas projects through site api"
```

---

### Task 6：建立账号隔离的云端资产库

**文件：**

- 新建：`docs/adr/0006-cloud-asset-storage.md`
- 修改：`docs/backend-module-boundaries.md`
- 修改：`docs/api-contracts.md`
- 修改：`docs/api-contract-next.md`
- 修改：`docs/deployment.md`
- 修改：`docker/.env.example`
- 修改：`docker/docker-compose.yml`
- 修改：`server.js`
- 新建：`scripts/test-user-cloud-assets.js`
- 新建：`scripts/smoke-cloud-storage-adapter.ps1`
- 新建：`integrations/infinite-canvas/web/src/integrations/hajimi/assets-api.ts`
- 新建：`integrations/infinite-canvas/web/src/integrations/hajimi/assets-api.test.ts`
- 修改：`integrations/infinite-canvas/web/src/services/image-storage.ts`
- 修改：`integrations/infinite-canvas/web/src/services/file-storage.ts`
- 修改：`integrations/infinite-canvas/web/src/stores/use-asset-store.ts`
- 修改：`integrations/infinite-canvas/web/src/components/canvas/asset-picker-modal.tsx`

**Step 1：写失败测试**

覆盖：

- 用户 A 上传的资产只出现在 A 的列表。
- 用户 B 不能读取、修改、删除或签发 A 的资产访问 URL。
- 上传文件由后端写入 Fake Storage，浏览器不接触存储密钥。
- 项目 JSON 保存 `assetId`，不保存 Blob、Base64、永久签名 URL或对象存储凭据。
- `/api/user/generations` 的图片可由后端导入当前账号资产库。
- 用户退出后清空资产内存态。
- 删除资产只做账号资产库软删除，第一阶段不立即物理删除仍可能被项目引用的云对象。
- 访问 URL 短时有效，过期后必须重新经后端签发。

运行：

```powershell
node "F:\dianshang-worktrees\infinite-canvas-candidate\scripts\test-user-cloud-assets.js"
```

预期：首次失败，错误为 `user_assets` 表和 `/api/user/assets*` 尚未实现。

**Step 2：确认云存储方案**

开始安装 SDK 或配置服务前，必须让用户明确以下信息：

```text
存储厂商：
协议：S3 兼容 / 厂商专用
Endpoint：
Region：
Bucket：
Bucket 是否私有：
允许的文件类型和单文件上限：
访问 URL 有效期：
生命周期/回收策略：
费用与流量限制：
备份和恢复方式：
```

没有确认时只实现 Fake Storage 契约测试，停止真实云存储接入。不得自行下载或启动 MinIO。

**Step 3：审批成熟 SDK**

若选择 S3 兼容协议，向用户说明并申请安装：

- `@aws-sdk/client-s3`：S3 兼容对象上传、读取和元数据操作；AWS SDK for JavaScript v3；Apache-2.0；<https://github.com/aws/aws-sdk-js-v3>。
- `@aws-sdk/s3-request-presigner`：生成短期签名读取 URL；同一官方项目和许可证。

获得确认后固定兼容版本并更新 lockfile。不得自研 S3 签名算法。

**Step 4：写存储 ADR**

`docs/adr/0006-cloud-asset-storage.md` 必须明确：

- 对象存储只保存文件；账号归属、名称、标签、MIME、尺寸和状态保存在 SQLite。
- Bucket 默认私有。
- 浏览器不持有对象存储密钥。
- 浏览器通过后端获得短时读取 URL。
- 候选 Fake Storage 与真实对象存储实现同一接口。
- 生产配置缺失时返回 `503 ASSET_STORAGE_UNAVAILABLE`，不得静默回退服务器本地目录并声称云端成功。
- 旧 `/uploads/*` 继续兼容历史项目，不能在本任务删除。

**Step 5：建立资产元数据表**

在现有 SQLite 初始化与迁移护栏中增加：

```sql
CREATE TABLE IF NOT EXISTS user_assets (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  name TEXT NOT NULL,
  object_key TEXT NOT NULL,
  storage_provider TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL DEFAULT 0,
  width INTEGER,
  height INTEGER,
  checksum_sha256 TEXT,
  tags_json TEXT NOT NULL DEFAULT '[]',
  source TEXT NOT NULL DEFAULT 'upload',
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  deleted_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_user_assets_owner_updated
  ON user_assets(user_id, updated_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_assets_owner_object
  ON user_assets(user_id, object_key);
```

所有查询必须带 `user_id=req.user.userId`。

**Step 6：定义后端存储接口**

后端实现必须至少包含：

```ts
type ObjectStorage = {
  putObject(input: {
    key: string;
    body: Buffer;
    contentType: string;
    checksumSha256: string;
  }): Promise<void>;
  createSignedReadUrl(input: {
    key: string;
    expiresInSeconds: number;
  }): Promise<string>;
  headObject(key: string): Promise<{
    sizeBytes: number;
    contentType: string;
  }>;
};
```

对象键固定按账号命名：

```text
users/<userId>/assets/<assetId>/<safe-file-name>
```

不得使用用户原始文件名直接拼接路径，不得允许 `..`、反斜杠或绝对路径。

**Step 7：冻结资产 API 契约**

必须提供：

```text
GET    /api/user/assets?q=&kind=&cursor=&limit=
POST   /api/user/assets/upload
GET    /api/user/assets/:id
GET    /api/user/assets/:id/access-url
PUT    /api/user/assets/:id
DELETE /api/user/assets/:id
POST   /api/user/assets/import-generation
```

响应中可返回短期 `accessUrl`，但项目数据只保存 `assetId`。列表必须分页，不能一次返回全部账号资产。

**Step 8：实现前端上传适配**

任何来源都先上传：

- 本地文件。
- 剪贴板图片。
- 局部裁剪结果。
- 九宫格结果。
- 上游生成返回的 Blob/Data URL。

统一提交到 `/api/user/assets/upload`，成功后节点保存 `assetId` 和展示所需元数据。

**Step 9：改造资产列表**

资产选择器只从 `/api/user/assets` 分页读取，支持：

- 图片/视频/音频类型筛选。
- 名称搜索。
- 标签。
- 上传时间排序。
- 插入画布。
- 改名和软删除。

生成历史不是资产库；只有用户点击“保存到资产库”或候选生成成功按确认策略自动归档时，后端才创建 `user_assets` 记录。

**Step 10：删除错误清理逻辑**

上游 `cleanupUnusedImages` 只能清理候选浏览器临时 Blob/Object URL。浏览器不得调用对象存储删除接口，也不得物理删除云对象。

**Step 11：运行验证**

```powershell
node "F:\dianshang-worktrees\infinite-canvas-candidate\scripts\test-user-cloud-assets.js"
node --experimental-strip-types --test "F:\dianshang-worktrees\infinite-canvas-candidate\integrations\infinite-canvas\web\src\integrations\hajimi\assets-api.test.ts"
powershell -NoProfile -ExecutionPolicy Bypass -File "F:\dianshang-worktrees\infinite-canvas-candidate\scripts\smoke-cloud-storage-adapter.ps1" -UseFakeStorage
node --check "F:\dianshang-worktrees\infinite-canvas-candidate\server.js"
npm run typecheck --prefix "F:\dianshang-worktrees\infinite-canvas-candidate\integrations\infinite-canvas\web"
npm run build --prefix "F:\dianshang-worktrees\infinite-canvas-candidate\integrations\infinite-canvas\web"
```

预期：

- 全部通过。
- A/B 用户隔离通过。
- 浏览器构建产物中没有 Provider Key 或对象存储密钥。
- Fake Storage 只用于候选自动化，不能算真实云存储验收。

**Step 12：提交**

```powershell
git -C "F:\dianshang-worktrees\infinite-canvas-candidate" add docs/adr/0006-cloud-asset-storage.md docs/backend-module-boundaries.md docs/api-contracts.md docs/api-contract-next.md docs/deployment.md docker/.env.example docker/docker-compose.yml server.js scripts/test-user-cloud-assets.js scripts/smoke-cloud-storage-adapter.ps1 integrations/infinite-canvas/web/src
git -C "F:\dianshang-worktrees\infinite-canvas-candidate" commit -m "feat: add account-scoped cloud asset library"
```

---

### Task 7：建立“系统提示词 + 我的提示词”双层云端提示词库

**文件：**

- 修改：`docs/backend-module-boundaries.md`
- 修改：`docs/api-contracts.md`
- 修改：`docs/api-contract-next.md`
- 修改：`server.js`
- 新建：`scripts/test-system-prompts-api.js`
- 新建：`scripts/test-user-prompts-api.js`
- 新建：`frontend/src/api/adminSystemPrompts.ts`
- 新建：`frontend/src/views/AdminSystemPromptsSource.vue`
- 修改：`frontend/src/config/adminNavigation.ts`
- 修改：`frontend/src/router/index.ts`
- 新建：`integrations/infinite-canvas/web/src/integrations/hajimi/prompts-api.ts`
- 新建：`integrations/infinite-canvas/web/src/integrations/hajimi/prompts-api.test.ts`
- 修改：`integrations/infinite-canvas/web/src/stores/use-prompt-source-store.ts`
- 新建：`integrations/infinite-canvas/web/src/components/hajimi/prompt-library-panel.tsx`
- 修改：`integrations/infinite-canvas/web/src/pages/canvas/project.tsx`

**Step 1：写后端失败测试**

覆盖：

- 只有管理员能创建、编辑、发布、停用、排序和删除系统提示词。
- 普通用户只能读取已发布的系统提示词。
- 停用的系统提示词不出现在普通用户列表，但已保存项目中的文本快照不改变。
- 每次修改系统提示词内容都会增加 `version`。
- 用户 A 创建的提示词只出现在 A 的列表。
- 用户 B 不能读取、编辑或删除 A 的提示词。
- 支持创建、详情、编辑、软删除、搜索、分类、标签、收藏和分页。
- 401、404 和字段校验错误使用稳定错误码。
- HTML/脚本内容只按普通文本保存和展示，不作为 HTML 执行。
- 删除提示词不追溯删除已保存到项目中的文本快照。

运行：

```powershell
node "F:\dianshang-worktrees\infinite-canvas-candidate\scripts\test-system-prompts-api.js"
node "F:\dianshang-worktrees\infinite-canvas-candidate\scripts\test-user-prompts-api.js"
```

预期：首次失败，错误为 `system_prompts`、`user_prompts` 表及对应 API 尚未实现。

**Step 2：建立两张提示词表**

在现有 SQLite 初始化与迁移护栏中增加：

```sql
CREATE TABLE IF NOT EXISTS system_prompts (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT '',
  tags_json TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'draft',
  sort_order INTEGER NOT NULL DEFAULT 0,
  version INTEGER NOT NULL DEFAULT 1,
  created_by TEXT NOT NULL,
  updated_by TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  deleted_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_system_prompts_status_sort
  ON system_prompts(status, sort_order, updated_at DESC);

CREATE TABLE IF NOT EXISTS user_prompts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT '',
  tags_json TEXT NOT NULL DEFAULT '[]',
  is_favorite INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  deleted_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_user_prompts_owner_updated
  ON user_prompts(user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_prompts_owner_favorite
  ON user_prompts(user_id, is_favorite, updated_at DESC);
```

`user_prompts` 的所有 SQL 必须带 `user_id=req.user.userId`。

`system_prompts` 的写接口必须使用现有 `admin` 守卫；普通用户读取接口只返回 `status='published' AND deleted_at IS NULL`。

**Step 3：冻结提示词 API**

必须提供：

```text
GET    /api/prompts/system?q=&category=&tag=&cursor=&limit=

GET    /api/user/prompts?q=&category=&tag=&favorite=&cursor=&limit=
POST   /api/user/prompts
GET    /api/user/prompts/:id
PUT    /api/user/prompts/:id
DELETE /api/user/prompts/:id

GET    /api/admin/system-prompts?q=&status=&category=&cursor=&limit=
POST   /api/admin/system-prompts
GET    /api/admin/system-prompts/:id
PUT    /api/admin/system-prompts/:id
DELETE /api/admin/system-prompts/:id
```

请求字段：

```ts
type UserPromptInput = {
  title: string;
  content: string;
  category?: string;
  tags?: string[];
  isFavorite?: boolean;
};

type SystemPromptInput = {
  title: string;
  content: string;
  category?: string;
  tags?: string[];
  status: "draft" | "published" | "disabled";
  sortOrder?: number;
};
```

边界：

- 标题去除首尾空白后必填。
- 内容去除首尾空白后必填。
- 标题、内容、分类、标签数量和单项长度必须有后端上限。
- 列表必须分页。
- 删除为软删除。
- 不允许管理员接口无审计地读取所有用户提示词正文。
- 系统提示词和用户提示词允许同名，不按标题互相覆盖。
- 普通用户不得修改系统提示词；可以“复制到我的提示词”后编辑自己的副本。
- 系统提示词修改、停用或删除不追溯修改已保存项目中的 `contentSnapshot`。

**Step 4：实现两套后端 CRUD**

接口返回统一结构：

```json
{
  "success": true,
  "item": {
    "id": "prompt_xxx",
    "scope": "user",
    "title": "白底商品主图",
    "content": "保持产品结构不变……",
    "category": "电商主图",
    "tags": ["白底", "产品"],
    "isFavorite": true,
    "createdAt": "2026-07-27T00:00:00.000Z",
    "updatedAt": "2026-07-27T00:00:00.000Z"
  }
}
```

系统提示词响应额外返回：

```json
{
  "scope": "system",
  "version": 3,
  "status": "published",
  "sortOrder": 20
}
```

**Step 5：实现后台系统提示词页面**

新增 `/admin/system-prompts`，复用现有 `AdminPageShell`、`AdminPageHeader`、`AdminPanel`、`AdminToolbar` 和表格规范，至少支持：

- 搜索和分类筛选。
- 草稿、已发布、已停用状态筛选。
- 新建和编辑。
- 发布、停用和软删除。
- 排序。
- 内容预览。
- 显示版本和最后更新时间。

所有保存动作调用 `/api/admin/system-prompts*`，不得把系统提示词写进前端常量或 `app_state` 大 JSON。

**Step 6：写画布前端失败测试**

覆盖：

- “系统提示词”只从 `/api/prompts/system` 获取。
- “我的提示词”只从 `/api/user/prompts` 获取。
- 普通用户不能在系统提示词 Tab 看到编辑和删除按钮。
- 系统提示词支持“复制到我的提示词”。
- 创建、编辑、删除、收藏全部调用后端。
- 搜索和分页参数正确。
- 点击提示词可插入当前文本节点、生成配置节点或 Assistant 输入框。
- 插入项目时保存 `scope + promptId + version + contentSnapshot`。
- 401 清空内存态并跳登录。
- localStorage/IndexedDB 不保存账号提示词正文作为权威副本。

**Step 7：替换上游本地提示词 Store**

`use-prompt-source-store.ts` 只保留 UI 查询状态和当前选择；提示词数据由后端 Query 获取。不得继续使用 `localForageStorage` 持久化账号提示词。

**Step 8：实现画布内提示词库**

左侧“提示词库”固定分为：

```text
系统提示词
我的提示词
```

共同支持：

- 搜索。
- 分类与标签筛选。
- 插入当前节点。
- 复制文本。

“系统提示词”支持：

- 只读查看。
- 复制到“我的提示词”。

“我的提示词”支持：

- 收藏。
- 新建。
- 编辑。
- 删除。

账号 A 的“我的提示词”切换到账号 B 后必须立即消失；已发布系统提示词对两个账号一致可见。

**Step 9：运行验证**

```powershell
node "F:\dianshang-worktrees\infinite-canvas-candidate\scripts\test-system-prompts-api.js"
node "F:\dianshang-worktrees\infinite-canvas-candidate\scripts\test-user-prompts-api.js"
node --experimental-strip-types --test "F:\dianshang-worktrees\infinite-canvas-candidate\integrations\infinite-canvas\web\src\integrations\hajimi\prompts-api.test.ts"
node --check "F:\dianshang-worktrees\infinite-canvas-candidate\server.js"
npm run typecheck --prefix "F:\dianshang-worktrees\infinite-canvas-candidate\integrations\infinite-canvas\web"
npm run build --prefix "F:\dianshang-worktrees\infinite-canvas-candidate\integrations\infinite-canvas\web"
npm run build --prefix "F:\dianshang-worktrees\infinite-canvas-candidate\frontend"
```

预期：全部通过；管理员/普通用户权限、系统提示词发布状态和 A/B 私有提示词隔离通过；浏览器存储中没有提示词权威副本。

**Step 10：提交**

```powershell
git -C "F:\dianshang-worktrees\infinite-canvas-candidate" add docs/backend-module-boundaries.md docs/api-contracts.md docs/api-contract-next.md server.js scripts/test-system-prompts-api.js scripts/test-user-prompts-api.js frontend/src integrations/infinite-canvas/web/src
git -C "F:\dianshang-worktrees\infinite-canvas-candidate" commit -m "feat: add system and account prompt libraries"
```

---

### Task 8：接入持久生图任务、幂等、扣费和退款状态

**文件：**

- 新建：`integrations/infinite-canvas/web/src/integrations/hajimi/generation-api.ts`
- 新建：`integrations/infinite-canvas/web/src/integrations/hajimi/generation-api.test.ts`
- 新建：`integrations/infinite-canvas/web/src/integrations/hajimi/models-api.ts`
- 新建：`integrations/infinite-canvas/web/src/integrations/hajimi/models-api.test.ts`
- 修改：`integrations/infinite-canvas/web/src/components/canvas/canvas-node-generation.ts`
- 修改：`integrations/infinite-canvas/web/src/pages/canvas/project.tsx`
- 修改：`integrations/infinite-canvas/web/src/components/image-generation-pending.tsx`
- 修改：`docs/api-contracts.md`
- 修改：`docs/api-contract-next.md`

**Step 1：先冻结请求契约**

在 API 文档写清：

- 文生图字段。
- 图生图 `image[]` 字段。
- 比例、清晰度、张数、模型和 routeId。
- `Idempotency-Key` 与 `clientRequestId`。
- HTTP 202 任务响应。
- 任务轮询、取消、人工重试。
- 局部成功、退款、Provider 退化和计费歧义。
- 成功结果对应的云端 `assetId` 和短时展示 URL。
- `/api/user/routes`、`/api/user/models?routeId=*` 返回的账号可用线路、模型、价格和能力。

不得猜字段后直接编码。

使用现有幂等迁移方式为 `generations` 增加可空 `asset_id TEXT`，并增加 `(user_id, asset_id)` 索引；旧生成记录保持 `asset_id=NULL`，通过显式“保存到资产库”导入，不做启动时批量复制。

**Step 2：写失败测试**

使用假 fetch/fake Provider 覆盖：

- 同一用户同一操作只提交一次 Provider 任务。
- 202 后轮询到 success。
- pending/running/failed/cancelled/partial 均有明确 UI 状态。
- 429 显示 `Retry-After`。
- 失败显示本地已退款与上游计费未知的区别。
- 取消只调用一次。
- 人工重试使用新幂等键。
- 浏览器请求只指向同源 `/api/*`。
- 模型、价格和能力开关只从后端读取，不读取上游本地 Provider 配置。
- 成功结果由后端写入账号云端资产库并返回 `assetId`。

**Step 3：实现任务适配**

禁止直接复用上游 `requestGeneration`/`requestEdit` 的 Provider 直连逻辑。候选版统一通过哈吉米 API。

生成成功后由后端：

1. 校验上游图片。
2. 写入用户云对象存储前缀。
3. 创建 `user_assets(source='generated')`。
4. 把 `generations.asset_id` 关联到资产。
5. 返回 `assetId` 和短时展示 URL。

云存储落盘失败不得自动重放 Provider；按现有结果保存失败规则记录退款与上游计费歧义。

**Step 4：接入后端模型与线路**

生成配置节点必须从后端读取：

```text
GET /api/user/routes
GET /api/user/models?routeId=<id>
POST /api/generation/estimate-cost
```

不得显示或保存 Base URL、API Key、Provider 原始配置。

**Step 5：实现节点状态**

节点至少保存：

```ts
{
  taskId: string;
  assetId?: string;
  status: "pending" | "running" | "success" | "failed" | "cancelled";
  stage?: string;
  progressText?: string;
  resultUrls?: string[];
  billingStatus?: string;
  errorCode?: string;
}
```

刷新项目后，对非终态 taskId 继续查询，不重新提交。

**Step 6：刷新余额与历史**

任务成功、失败退款或取消后重新读取用户资料与生成历史，不在前端自行计算余额。

**Step 7：运行验证**

```powershell
node --experimental-strip-types --test "F:\dianshang-worktrees\infinite-canvas-candidate\integrations\infinite-canvas\web\src\integrations\hajimi\generation-api.test.ts"
node --experimental-strip-types --test "F:\dianshang-worktrees\infinite-canvas-candidate\integrations\infinite-canvas\web\src\integrations\hajimi\models-api.test.ts"
npm run typecheck --prefix "F:\dianshang-worktrees\infinite-canvas-candidate\integrations\infinite-canvas\web"
npm run build --prefix "F:\dianshang-worktrees\infinite-canvas-candidate\integrations\infinite-canvas\web"
node --check "F:\dianshang-worktrees\infinite-canvas-candidate\server.js"
```

预期：全部通过，不触发真实 Provider。

**Step 8：提交**

```powershell
git -C "F:\dianshang-worktrees\infinite-canvas-candidate" add integrations/infinite-canvas/web/src docs/api-contracts.md docs/api-contract-next.md
git -C "F:\dianshang-worktrees\infinite-canvas-candidate" commit -m "feat: connect canvas to persistent generation tasks"
```

---

### Task 9：接入局部重绘、擦除、扩图、反推和扩写

**文件：**

- 新建：`integrations/infinite-canvas/web/src/integrations/hajimi/image-tools-api.ts`
- 新建：`integrations/infinite-canvas/web/src/integrations/hajimi/image-tools-api.test.ts`
- 修改：`integrations/infinite-canvas/web/src/components/canvas/canvas-node-mask-edit-dialog.tsx`
- 修改：`integrations/infinite-canvas/web/src/components/canvas/canvas-image-toolbar-tools.tsx`
- 修改：`integrations/infinite-canvas/web/src/pages/canvas/project.tsx`
- 修改：`scripts/smoke-backend-canvas-boundary.ps1`

**Step 1：写失败测试**

至少覆盖：

- 局部编辑发送原图、PNG mask、prompt 到 `/api/image-tools/inpaint`。
- 智能擦除发送原图与 mask 到 `/api/image-tools/erase`。
- 扩图发送原图、目标比例和布局参数到 `/api/image-tools/outpaint`。
- 反推只调用 `/api/image-tools/reverse-prompt`。
- AI 扩写只调用 `/api/canvas/enhance-prompt`，成功后回填文本但不生图。
- mask 透明区/保留区语义与后端一致。
- 一个按钮操作只产生一次请求。
- 图片工具成功结果由后端写入当前账号云端资产库并返回 `assetId`。

**Step 2：实现局部重绘**

保留上游已经完成的：

- 画笔。
- 擦除。
- 8–160px 笔刷。
- 重置。
- 修改要求。

替换的只有提交层：不得调用上游浏览器直连 `requestEdit`。

**Step 3：实现结果回写**

成功结果：

- 作为新图片节点插入，不无提示覆盖原图。
- 与原节点保持可追溯关系。
- 节点保存云端 `assetId` 和本次短时展示 URL，不保存永久签名 URL。
- 保存项目后刷新仍可显示。

**Step 4：扩展 disposable smoke**

使用假 Provider 验证原图、mask 和 prompt 到达后端适配器；不把 Base64 和提示词打印到终端。

**Step 5：运行验证**

```powershell
node --experimental-strip-types --test "F:\dianshang-worktrees\infinite-canvas-candidate\integrations\infinite-canvas\web\src\integrations\hajimi\image-tools-api.test.ts"
powershell -NoProfile -ExecutionPolicy Bypass -File "F:\dianshang-worktrees\infinite-canvas-candidate\scripts\smoke-backend-canvas-boundary.ps1"
npm run typecheck --prefix "F:\dianshang-worktrees\infinite-canvas-candidate\integrations\infinite-canvas\web"
npm run build --prefix "F:\dianshang-worktrees\infinite-canvas-candidate\integrations\infinite-canvas\web"
```

预期：全部通过，无真实调用、无余额变化。

**Step 6：提交**

```powershell
git -C "F:\dianshang-worktrees\infinite-canvas-candidate" add integrations/infinite-canvas/web/src scripts/smoke-backend-canvas-boundary.ps1
git -C "F:\dianshang-worktrees\infinite-canvas-candidate" commit -m "feat: connect canvas image editing tools"
```

---

### Task 10：替换上游 Agent 面板并保持三模式隔离

> **2026-07-29 复核结论：** 本任务已在 `fee1146` 按旧计划完成，但只完成了业务助手替换，没有完成原版 Agent 功能等价迁移。该提交不得再作为 Agent 迁移完成证据；缺失能力统一进入 Task 13A。

**文件：**

- 新建：`integrations/infinite-canvas/web/src/integrations/hajimi/canvas-assistant-api.ts`
- 新建：`integrations/infinite-canvas/web/src/integrations/hajimi/canvas-assistant-api.test.ts`
- 新建：`integrations/infinite-canvas/web/src/components/hajimi/hjm-canvas-assistant-panel.tsx`
- 修改：`integrations/infinite-canvas/web/src/pages/canvas/project.tsx`
- 修改：`integrations/infinite-canvas/web/src/components/canvas/canvas-agent-chat-ui.tsx`

**Step 1：写三模式隔离测试**

分别建立：

```text
dialog
quick
ecommerce-suite
```

断言三者不共享：

- 消息。
- 草稿。
- 参考图。
- sessionId。
- 生成中状态。
- taskId。

异步完成必须写回任务创建时的原模式，不得写入当前可见模式。

**Step 2：移除本地 Agent 连接入口**

候选版不得要求用户执行：

```text
npx -y @basketikun/canvas-agent
```

不得显示 Codex 插件、MCP、Connect token 或 Local URL 配置。

**Step 3：接入现有三模式**

- 对话：`/api/canvas/dialog-agent-generate`。
- 快速：`/api/generate/tasks`。
- 电商套图：`/api/canvas/ecommerce-suite/config|prompts|generate`。

**Step 4：保持计费边界**

- 对话分析失败不继续生图。
- 快速模式不经过对话 Agent。
- 套图提示词由当前 skill/产品图/参考图动态生成。
- 不在前端预估或扣除余额。

**Step 5：运行测试**

```powershell
node --experimental-strip-types --test "F:\dianshang-worktrees\infinite-canvas-candidate\integrations\infinite-canvas\web\src\integrations\hajimi\canvas-assistant-api.test.ts"
npm run typecheck --prefix "F:\dianshang-worktrees\infinite-canvas-candidate\integrations\infinite-canvas\web"
npm run build --prefix "F:\dianshang-worktrees\infinite-canvas-candidate\integrations\infinite-canvas\web"
```

预期：全部通过。

**Step 6：提交**

```powershell
git -C "F:\dianshang-worktrees\infinite-canvas-candidate" add integrations/infinite-canvas/web/src
git -C "F:\dianshang-worktrees\infinite-canvas-candidate" commit -m "feat: replace local canvas agent with site workflows"
```

---

### Task 11：品牌化、功能收口和非画布隔离

**文件：**

- 修改：`integrations/infinite-canvas/web/src/layouts/user-layout.tsx`
- 修改：`integrations/infinite-canvas/web/src/components/layout/app-top-nav.tsx`
- 修改：`integrations/infinite-canvas/web/src/router.tsx`
- 修改：`integrations/infinite-canvas/web/src/styles/*`
- 新建：`scripts/check-infinite-canvas-browser-boundary.js`

**Step 1：先写静态失败门禁**

构建产物不得包含可用入口或提示：

- API Key 输入。
- Provider Base URL 输入。
- 上游 `/config`。
- 上游本地 Agent 连接。
- 上游插件市场。
- 浏览器直连 `/images/generations`、`/images/edits`。
- `api.openai.com` 或其他上游 Provider 域名。
- 浏览器直连对象存储上传、删除或 Bucket 管理接口。
- 使用 localForage/localStorage 持久化账号资产列表或账号提示词正文。
- 在前端硬编码模型、价格、余额、账号权限或对象存储配置。

允许在 `UPSTREAM.md`、许可证和测试断言中出现文字，不允许在运行 bundle 中出现可执行调用。

**Step 2：主站视觉接入**

保留上游画布主体，只调整：

- 哈吉米 AI Logo 和名称。
- 返回首页、用户中心、生成记录入口。
- 用户头像和余额。
- 与主站一致的中文错误提示和绿色品牌色。

禁止为了视觉统一重写拖拽、连线、缩放、小地图或节点渲染。

**Step 3：收口未接功能**

第一轮隐藏或明确禁用：

- 视频生成。
- 音频生成。
- 本地 Codex Agent。
- 插件市场。
- Provider 配置。

不得留下点击后直接访问外网或假成功的按钮。

**Step 4：隔离全局副作用**

候选脚本、样式、observer 和事件监听只在候选 React 页面加载。离开 `/canvas` 后不影响：

- `/`
- `/user/center`
- `/admin/*`
- `/chat/*`

**Step 5：验证全部业务请求经后端**

浏览器网络断言必须证明：

- 项目、资产、提示词、模型、估费、生成、图片工具、历史、余额和 Assistant 请求均命中同源 `/api/*`。
- 只有后端签发的短时资产读取 URL可以访问对象内容。
- 没有浏览器向 Provider 或对象存储发起带密钥的请求。

**Step 6：运行验证**

```powershell
node "F:\dianshang-worktrees\infinite-canvas-candidate\scripts\check-infinite-canvas-browser-boundary.js"
npm run typecheck --prefix "F:\dianshang-worktrees\infinite-canvas-candidate\integrations\infinite-canvas\web"
npm run build --prefix "F:\dianshang-worktrees\infinite-canvas-candidate\integrations\infinite-canvas\web"
npm run build --prefix "F:\dianshang-worktrees\infinite-canvas-candidate\frontend"
```

预期：全部通过。

**Step 7：提交**

```powershell
git -C "F:\dianshang-worktrees\infinite-canvas-candidate" add integrations/infinite-canvas/web/src scripts/check-infinite-canvas-browser-boundary.js
git -C "F:\dianshang-worktrees\infinite-canvas-candidate" commit -m "feat: align candidate canvas with main site shell"
```

---

### Task 12：非破坏性旧项目导入

**文件：**

- 新建：`integrations/infinite-canvas/web/src/integrations/hajimi/legacy-project-import.ts`
- 新建：`integrations/infinite-canvas/web/src/integrations/hajimi/legacy-project-import.test.ts`
- 新建：`integrations/infinite-canvas/web/src/components/hajimi/legacy-project-import-dialog.tsx`
- 新建：`scripts/fixtures/canvas-projects/README.md`
- 新建：`scripts/fixtures/canvas-projects/*.sanitized.json`

**Step 1：收集脱敏样本**

只从 disposable 数据库或用户明确允许的导出文件收集：

- 空项目。
- 文本 + 图片节点。
- 生成节点。
- 连线。
- 10 节点/9 图片项目。
- 带旧 Chat 状态项目。

样本不得包含真实用户名、token、完整提示词、付费响应或个人图片。

**Step 2：写转换失败测试**

每个 fixture 断言：

- 原文件不修改。
- 转换输出符合 `schemaVersion: 1`。
- 能转换的节点、连线和视口数量正确。
- 无法转换的字段写入 warnings。
- `data:image/*` 必须先上传或拒绝转换，不得直接保存。

**Step 3：实现显式导入**

打开旧项目时显示：

```text
这是旧版画布项目。导入会创建一份新版副本，原项目不会修改。
```

用户确认后：

1. 读取旧项目。
2. 转换。
3. POST 新项目，名称追加“（新版副本）”。
4. 导航到新项目。
5. 原项目保留。

**Step 4：禁止批量自动迁移**

没有全部 fixture 和人工验收证据前，不得写数据库批量迁移脚本。

**Step 5：运行测试**

```powershell
node --experimental-strip-types --test "F:\dianshang-worktrees\infinite-canvas-candidate\integrations\infinite-canvas\web\src\integrations\hajimi\legacy-project-import.test.ts"
npm run typecheck --prefix "F:\dianshang-worktrees\infinite-canvas-candidate\integrations\infinite-canvas\web"
npm run build --prefix "F:\dianshang-worktrees\infinite-canvas-candidate\integrations\infinite-canvas\web"
```

预期：全部通过，原 fixture 哈希不变。

**Step 6：提交**

```powershell
git -C "F:\dianshang-worktrees\infinite-canvas-candidate" add integrations/infinite-canvas/web/src scripts/fixtures/canvas-projects
git -C "F:\dianshang-worktrees\infinite-canvas-candidate" commit -m "feat: add non-destructive legacy canvas import"
```

---

### Task 13：建立完整候选 smoke、性能和跨用户验收

**文件：**

- 新建：`docker/docker-compose.canvas-candidate.yml`
- 新建：`scripts/smoke-infinite-canvas-candidate.ps1`
- 新建：`scripts/smoke-infinite-canvas-candidate-ui-runner.js`
- 新建：`docs/infinite-canvas-candidate-acceptance.md`
- 修改：`scripts/preflight-check.ps1`

**Step 1：建立隔离 Compose**

候选要求：

- 容器名不能和正式容器冲突。
- 只绑定 `127.0.0.1:3466`。
- 使用 `.scratch/infinite-canvas-candidate/` 下独立 DB、uploads、workflows 和 logs。
- `CANVAS_RUNTIME=infinite`。
- `ENABLE_REAL_AI=false`。
- `ENABLE_REAL_STORAGE=false`，使用进程内 Fake Storage 或候选专用文件型测试适配器。
- `ENABLE_REAL_EMAIL=false`。
- `ENABLE_REAL_PAYMENT=false`。
- 不挂载正式 `docker/data` 或 `docker/uploads`。
- 不启动或重建正式 gateway、app、LibreChat、MongoDB。

**Step 2：API smoke**

至少验证：

- 未登录 `/canvas` 静态页可加载，但用户 API 返回 401。
- 测试用户登录。
- 新建项目。
- 保存 2 节点 1 连线。
- 重新读取内容一致。
- 上传图片并产生账号资产记录。
- 资产列表分页、搜索、改名、软删除和短时访问 URL。
- 管理员创建、发布、停用系统提示词，普通用户只读已发布内容。
- 用户创建、编辑、搜索、收藏和删除自己的提示词。
- Fake Provider 生图只执行一次。
- 局部重绘、擦除、扩图使用正确端点。
- 取消与人工重试。
- 删除测试项目。
- 测试结束余额回到预期值。

**Step 3：浏览器 smoke**

桌面 `1440×900` 和移动端 `390×844` 覆盖：

- 项目列表、新建、改名、删除。
- 文本、图片、配置、分组节点。
- 拖拽、框选、连线、缩放 20 次、小地图、撤销重做。
- 上传图片并从云端资产库重新插入画布。
- 资产库分页、搜索、标签、改名和软删除。
- “系统提示词 / 我的提示词”双 Tab。
- 系统提示词只读、搜索、插入和复制到我的提示词。
- 我的提示词新建、编辑、收藏、搜索、插入节点和刷新恢复。
- 局部重绘弹窗：画笔、擦除、笔刷大小、提示词。
- 自动保存后刷新恢复。
- 浏览器控制台 0 error。
- 无意外 4xx/5xx。
- 无横向页面溢出。

若上游画布未适配移动端导致移动端检查项失败，允许降级为"桌面项阻断、移动端问题记录到验收文档"；不得伪造移动端通过。

**Step 4：性能基线**

至少使用“10 节点、9 图片”的脱敏 fixture：

- 首次恢复不出现长时间白屏。
- 连续拖拽、缩放和打开大弹层不出现明显冻结。
- 自动保存不在指针移动期间逐帧发送请求。
- 项目 JSON 不含 Base64。
- 离屏图片策略不造成无限 Blob URL 增长。

如仍有卡顿，必须采样 Chrome Performance trace，再决定优化；不得只凭主观感受声称完成。

**Step 5：跨用户隔离**

用户 A 创建项目并上传图片后，切换用户 B：

- B 列表看不到 A 项目。
- B 不能 GET A 项目 ID。
- B 资产库看不到 A 资产，不能签发 A 资产的访问 URL。
- B 提示词库看不到 A 提示词，不能读取、编辑或删除 A 提示词。
- A 和 B 都能看到同一批已发布系统提示词，但都不能通过普通用户 API 修改。
- B 内存和 IndexedDB 草稿不显示 A 节点或缩略图。
- B 的 localStorage/IndexedDB 中没有 A 的资产元数据或提示词正文权威副本。
- 切回 A 后数据仍可恢复。

**Step 6：运行全套候选验证**

```powershell
node --check "F:\dianshang-worktrees\infinite-canvas-candidate\server.js"
node "F:\dianshang-worktrees\infinite-canvas-candidate\scripts\test-user-cloud-assets.js"
node "F:\dianshang-worktrees\infinite-canvas-candidate\scripts\test-system-prompts-api.js"
node "F:\dianshang-worktrees\infinite-canvas-candidate\scripts\test-user-prompts-api.js"
npm run typecheck --prefix "F:\dianshang-worktrees\infinite-canvas-candidate\integrations\infinite-canvas\web"
npm run build --prefix "F:\dianshang-worktrees\infinite-canvas-candidate\integrations\infinite-canvas\web"
npm run build --prefix "F:\dianshang-worktrees\infinite-canvas-candidate\frontend"
powershell -NoProfile -ExecutionPolicy Bypass -File "F:\dianshang-worktrees\infinite-canvas-candidate\scripts\smoke-backend-canvas-boundary.ps1"
powershell -NoProfile -ExecutionPolicy Bypass -File "F:\dianshang-worktrees\infinite-canvas-candidate\scripts\smoke-cloud-storage-adapter.ps1" -UseFakeStorage
powershell -NoProfile -ExecutionPolicy Bypass -File "F:\dianshang-worktrees\infinite-canvas-candidate\scripts\smoke-infinite-canvas-candidate.ps1" -Port 3466
git -C "F:\dianshang-worktrees\infinite-canvas-candidate" diff --check
```

预期：全部通过，正式 `3456` 容器启动时间、镜像 ID和健康状态不变。

**Step 7：提交**

```powershell
git -C "F:\dianshang-worktrees\infinite-canvas-candidate" add docker/docker-compose.canvas-candidate.yml scripts/smoke-infinite-canvas-candidate.ps1 scripts/smoke-infinite-canvas-candidate-ui-runner.js scripts/preflight-check.ps1 docs/infinite-canvas-candidate-acceptance.md
git -C "F:\dianshang-worktrees\infinite-canvas-candidate" commit -m "test: add isolated infinite canvas acceptance suite"
```

---

### Task 13A：Agent 功能等价迁移

**状态：** `ready-for-agent`，阻断 Task 14–17。

**执行依据：**

- `docs/infinite-canvas-agent-feature-migration.md`
- 原版固定 tag `v0.10.0` / commit `a0287a5e346e219bd488d084295542213912d816`
- 删除前候选源码 `fee1146^`

**必须完成：**

- 固定为网页版多用户方案：不依赖用户电脑的 Codex、Local URL、Connect token 或本地 MCP。
- 复用 Infinite Canvas 原版 `canvas-agent` 的 MCP 工具、schema 和画布会话语义；不使用 `hajimi-website` MCP 代替画布 MCP。
- 增加按 `userId + projectId + agentSessionId + browserSessionId` 隔离的服务端 Agent 会话代理，由后端 Lingsuan 文本路线驱动工具调用。
- 画布读取与结构化写操作的端到端自然语言路径。
- 写操作提案、确认、拒绝、幂等执行和结果回传。
- 项目、任务、提示词、素材和生图配置等站点工具的哈吉米 API 等价实现。
- 会话新建、恢复、删除、刷新持久化、停止请求和脱敏诊断。
- 图片/节点引用、三模式隔离、跨账号隔离、任务计费和退款边界。
- Agent 专项自动化，以及 3466 与 3467 的人工 A/B 验收。

**门禁：**

- 禁止要求普通用户安装本地 Codex/Canvas Agent，禁止使用 Local URL 或 Connect token；流式事件使用站内认证后的 SSE/WebSocket。
- 不得浏览器直连 Provider，不得绕过持久任务、计费、退款和账号数据 API。
- 保持 Fake Provider、隔离数据和 `127.0.0.1:3466`，不触发真实费用。
- 原 Task 13 全量回归仍必须通过。
- 未完成前不得把 Task 14 标记为通过，不得进入正式切换。

---

### Task 14：候选版人工验收门禁

**文件：**

- 修改：`docs/infinite-canvas-candidate-acceptance.md`
- 修改：`docs/feature-completion-checklist.md`
- 修改：`docs/progress-report.md`
- 修改：`docs/review-log.md`

**Step 1：提供候选入口**

只给用户：

```text
http://127.0.0.1:3466/canvas
```

同时明确：

- 这是隔离数据。
- 当前为 Mock/Fake Provider。
- 正式 `3456` 未变。

**Step 2：用户逐项确认**

必须由用户实际确认：

- 画布拖拽、缩放、连线手感。
- 节点布局与工具条。
- 上传和生成结果落图。
- 局部重绘。
- 扩图。
- 智能擦除。
- 保存、刷新、重新进入项目。
- 云端资产上传、搜索、改名、插入画布和重新登录恢复。
- 后台新增并发布系统提示词，普通账号刷新后只读可见并可插入节点。
- 普通账号不能编辑系统提示词，但能复制成“我的提示词”。
- 账号自定义提示词的新建、编辑、收藏、搜索和插入节点。
- 对话、快速、电商套图三模式。
- 桌面主要使用路径。

**Step 3：真实云存储验收**

用户提供并确认云存储配置及可能费用后，使用候选专用前缀完成：

- 上传一张测试图片。
- 后端 `headObject` 校验大小和 MIME。
- 退出登录后重新登录，资产仍在账号资产库。
- 短时访问 URL 可显示图片，过期后不能继续使用。
- 用户 B 无法签发用户 A 的访问 URL。
- 软删除后资产不再出现在普通列表。

测试对象键必须位于候选前缀，不能覆盖生产对象。没有真实云存储验收证据，不得把“云端资产库”标记完成。

**Step 4：真实 Provider 单笔点测**

只有用户再次明确同意费用后，才允许：

- 使用隔离测试账号。
- 每项最多一笔。
- 先记录余额。
- 只测一个模型和一张图。
- 记录任务、上游调用次数、扣费或退款。
- 测后恢复候选为 Mock/Fake。

未获确认则跳过，不能把 Fake Provider 结果写成“真实生图已通过”。

**Step 5：签署切换决定**

用户必须明确回复等价于：

```text
候选画布验收通过，允许替换正式 /canvas。
```

没有这句话或同等明确授权，任务停止在候选环境。

---

### Task 15：生产切换前准备

**文件：**

- 修改：`scripts/smoke-internal-prod.ps1`
- 新建：`scripts/verify-cloud-assets-manifest.js`
- 修改：`docs/internal-production-runbook.md`
- 修改：`docs/current-baseline.md`
- 修改：`docs/feature-completion-checklist.md`

**Step 1：冻结候选提交**

记录：

- Git commit。
- 候选镜像 ID。
- 候选 HTML 和入口 JS SHA-256。
- v0.10.0 上游提交。
- 全部测试结果。

**Step 2：检查正式任务**

确认正式环境：

- `pending=0`。
- `running=0`。
- 无正在上传、保存或生成的用户操作。

**Step 3：获得维护窗口确认**

备份会短暂停止 app。必须再次获得用户明确确认后运行：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File "F:\dianshang\scripts\backup-internal-prod.ps1" -ConfirmMaintenanceWindow
```

预期：

- SQLite `quick_check=ok`。
- SQLite `integrity_check=ok`。
- uploads、workflows、logs 和数据库均进入同一备份目录。
- 备份清单包含 `user_assets` 和 `user_prompts` 行数、账号分布、对象键摘要和对象存储配置指纹，不包含对象存储密钥。
- 对象存储的版本控制、生命周期或独立备份策略已按存储 ADR 验证；只备份 SQLite 不能算云资产恢复完成。
- 正式容器恢复健康。

**Step 4：更新生产 smoke**

切换后的 smoke 必须断言：

- `/api/health.canvasRuntime=infinite`。
- `/canvas` 和 `/canvas/:id` 命中候选 HTML。
- 候选入口 JS/CSS 为 200 且 hash 匹配。
- 首页、用户中心、后台、Chat 不加载候选 observer 或 bundle。
- 旧 Canvas 主入口和已废止 query 返回 410/404，不能回落 HTML。
- 项目、上传、图片工具和任务 API 仍可达。
- 账号资产 API、账号提示词 API 和对象存储签名访问 smoke 通过。

**Step 5：准备回滚命令**

回滚必须使用：

- 上一正式 app 镜像 ID。
- 切换前一致性备份。
- `CANVAS_RUNTIME=legacy` 的上一正式配置。

不得临时在容器内改文件。

---

### Task 16：原子替换正式 `/canvas`

**前置条件：**

- Task 1–15 全部完成。
- 候选自动化验证全部通过。
- 用户人工验收通过。
- 用户明确授权生产切换。
- 一致性备份成功。
- 正式活动任务为 0。

**Step 1：从主工作区同步已审查提交**

正式发布必须以 `F:\dianshang` 为唯一源码基线。不得从候选容器复制文件回主目录，也不得只在容器热修。

**Step 2：设置唯一运行时**

正式环境设置：

```text
CANVAS_RUNTIME=infinite
ENABLE_REAL_STORAGE=true
OBJECT_STORAGE_ENDPOINT=<已确认值>
OBJECT_STORAGE_REGION=<已确认值>
OBJECT_STORAGE_BUCKET=<已确认值>
```

不得新增 `/canvas-next`。

对象存储 Access Key 和 Secret 只进入正式安全环境文件，不写入 Git、日志、备份包、前端构建参数或浏览器运行时配置。

**Step 3：完整重建**

按正式 Chat 双 Compose 和 `docs/internal-production-runbook.md` 的当前命令完整构建、强制重建 app；如 gateway 配置有变，也必须完整重建 gateway。

不得用 `docker restart` 代替构建与重建。

**Step 4：确认容器与镜像**

记录：

- app 镜像 ID。
- 镜像创建时间。
- 容器创建时间。
- 容器启动时间。
- app、gateway、LibreChat、MongoDB 健康状态。
- 只有 gateway 暴露正式 `3456`。

**Step 5：运行生产验证**

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File "F:\dianshang\scripts\smoke-internal-prod.ps1"
```

并直接请求：

```text
http://127.0.0.1:3456/
http://127.0.0.1:3456/canvas
http://127.0.0.1:3456/user/center
http://127.0.0.1:3456/admin/login
http://127.0.0.1:3456/chat/
http://192.168.0.39:3456/
http://192.168.0.39:3456/canvas
```

预期：

- 所有预期页面返回 200。
- `/canvas` 命中新入口 hash。
- 旧入口资源返回 410/404。
- 浏览器控制台无错误。
- 登录后项目列表、创建、保存和刷新恢复通过。
- 账号资产上传、列表、重新登录恢复和签名读取通过。
- 后台系统提示词发布/停用、普通用户只读访问和版本快照通过。
- 账号自定义提示词创建、编辑、搜索、插入和跨账号隔离通过。
- 不执行真实生图，除非用户再次单独确认费用。

**Step 6：人工快速验收**

用户至少完成：

- 打开一个旧项目并走“新版副本”导入。
- 新建项目。
- 上传图片。
- 从云端资产库重新插入刚上传的图片。
- 管理员发布一条系统提示词，普通账号确认只读可见并复制到“我的提示词”。
- 创建一条账号自定义提示词，刷新后重新插入节点。
- 添加节点并连线。
- 刷新确认保存。
- 打开局部重绘弹窗。

**Step 7：观察窗口**

切换后观察：

- 401/403/404/5xx。
- 项目保存失败。
- 上传失败。
- 任务重复提交。
- 余额或退款异常。
- 浏览器内存和卡顿。

达到回滚条件立即停止继续试用。

---

### Task 17：回滚、清理和最终文档

**回滚触发条件：**

- 大面积无法打开 `/canvas`。
- 登录用户看不到自己的项目。
- 项目保存后丢失节点或连线。
- 跨用户数据泄漏。
- 同一操作重复扣费或重复调用 Provider。
- 局部重绘/生图绕过后台直连上游。
- 账号资产跨用户泄漏、签名 URL 权限失效或对象存储写入持续失败。
- 账号自定义提示词跨用户泄漏、保存丢失或浏览器本地副本覆盖云端数据。
- 生产页面出现持续 5xx。
- 性能明显差于候选验收且影响正常使用。

**Step 1：回滚**

- 重新部署上一正式镜像。
- 恢复 `CANVAS_RUNTIME=legacy`。
- 按生产规则完整重建/强制重建，不只 restart。
- 不删除切换期间已经写入的云对象或 `user_assets/user_prompts` 数据；先隔离新入口并保留证据。
- 如果数据发生不可接受写入，再按备份恢复流程处理；没有数据损坏时不得无理由回滚整个数据库。

**Step 2：验证回滚**

- `/api/health.canvasRuntime=legacy`。
- 当前旧画布恢复。
- 现有项目可打开。
- 首页、用户中心、后台、Chat 正常。
- 容器全部 healthy。

**Step 3：成功后清理**

只有稳定观察期结束后才：

- 停止并移除 `3466` 候选容器。
- 保留候选测试报告和固定上游源码。
- 不删除切换前备份。
- 不立即删除旧画布源码资产；先由后续独立任务评估，但生产路由必须继续隔离旧入口。

**Step 4：更新最终事实**

更新：

- `docs/current-baseline.md`
- `docs/canvas-migration-checklist.md`
- `docs/canvas-maintenance-boundary.md`
- `docs/feature-completion-checklist.md`
- `docs/progress-report.md`
- `docs/review-log.md`
- `docs/internal-production-runbook.md`

最终文档必须明确：

- 当前唯一画布已经是改造后的 Infinite Canvas。
- 上游固定版本和许可记录位置。
- 项目 JSON schema 版本。
- API 映射。
- 云资产表、对象存储适配器、Bucket/前缀、短时访问 URL 和恢复策略。
- 系统提示词表、后台管理 API、普通用户只读 API、发布状态和版本规则。
- 账号私有提示词表、API、隔离规则和项目文本快照规则。
- 候选与生产测试证据。
- 正式镜像 ID和容器时间。
- 旧项目导入规则。
- 回滚方式。
- 是否需要用户 Ctrl+F5。

**Step 5：最终检查**

```powershell
git -C "F:\dianshang" diff --check
node --check "F:\dianshang\server.js"
npm run typecheck --prefix "F:\dianshang\integrations\infinite-canvas\web"
npm run build --prefix "F:\dianshang\integrations\infinite-canvas\web"
npm run build --prefix "F:\dianshang\frontend"
powershell -NoProfile -ExecutionPolicy Bypass -File "F:\dianshang\scripts\smoke-backend-canvas-boundary.ps1"
powershell -NoProfile -ExecutionPolicy Bypass -File "F:\dianshang\scripts\smoke-internal-prod.ps1"
```

预期：全部通过。

---

## 4. Kimi 每轮汇报模板

每完成一个 Task，必须按以下格式汇报：

```markdown
## Task N 完成情况

- 修改内容：
- 修改文件：
- 新增依赖：无 / 已获批准的依赖清单
- 是否触发真实 Provider：否 / 是（附用户授权和调用次数）
- 是否影响正式 3456：否 / 是（附维护窗口授权）
- 验证命令：
- 验证结果：
- 未覆盖风险：
- 下一门禁：
```

不得只回复“已完成”或只贴截图。

## 5. 最终验收定义

只有同时满足以下条件，才能声明“替换完成”：

1. 生产只有一个 `/canvas`。
2. 候选 React 画布通过主站 JWT 登录。
3. 项目服务器保存、刷新恢复和跨用户隔离通过。
4. 项目 JSON 无 Base64/Blob URL。
5. 账号资产库使用真实云对象存储，项目保存 `assetId`，浏览器没有对象存储密钥或永久访问 URL。
6. 账号资产的上传、列表、搜索、改名、软删除、重新登录恢复和跨用户隔离通过。
7. 后台系统提示词的创建、发布、停用、排序、版本和普通用户只读访问通过。
8. 账号自定义提示词的 CRUD、搜索、收藏、重新登录恢复和跨用户隔离通过。
9. 系统提示词与用户提示词均按 `scope + promptId + version + contentSnapshot` 保存引用，不追溯破坏已有项目。
10. 除纯画布交互外，项目、资产、提示词、模型、生成、图片工具、历史、余额和 Assistant 全部走同源后台 API。
11. 文生图、图生图、局部重绘、擦除、扩图、反推和扩写均走现有后台。
12. 任务幂等、取消、人工重试、失败退款状态正确。
13. 三种 Canvas Chat 模式状态隔离。
14. 旧项目通过“创建新版副本”非破坏性导入。
15. 桌面与移动端核心 smoke 通过，控制台无错误。
16. 首页、用户中心、后台和 Chat 不加载候选画布重逻辑。
17. 旧画布入口资源被 410/404 隔离。
18. Docker 完整重建，容器 healthy，镜像和时间证据完整。
19. `127.0.0.1:3456` 和 `192.168.0.39:3456` 直接验证通过。
20. 用户人工确认新画布可用。
21. 回滚镜像、SQLite 一致性备份和云对象恢复策略可用。

任何一项缺失，都只能汇报“候选阶段完成”或“部分验收通过”，不能声称已替换完成。
