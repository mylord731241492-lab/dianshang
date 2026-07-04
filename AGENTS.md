# 哈吉米AI 本地克隆 (hjm-mb.com)

> Clone of www.hjm-mb.com — AI电商图片生成平台
> 提取日期: 2026-06-22 | 目标: 本地完整运行 + 复刻

## 新分支源码化规则

当前分支 `codex/source-stack-canvas-rebuild` 曾用于启动全新源码技术栈和新版画布。2026-06-26 用户已明确要求新画布全部废止，画布回滚到旧 `assets/` 打包资产；后续禁止继续推进 Vue Flow 新画布和 Infinite-Canvas 节点迁移。

### 主工作目录

- 主目录固定为 `F:\dianshang`。
- 后续并行工作树统一放在 `F:\dianshang-worktrees\*`。
- 文档、验证命令和人工验收说明必须优先使用 `F:\dianshang` 路径。

### 必须使用的成熟基座

- 前端源码：Vue 3 + Vite + TypeScript。
- 路由：Vue Router。
- 状态：Pinia。
- API：Axios。
- UI：Naive UI。
- 画布：旧 `assets/Canvas-*.js/css` 打包画布；`frontend/` 只保留跳转旧画布入口。
- 图标：lucide-vue-next。
- 后端目标：Node.js + TypeScript，先兼容旧 Express `/api/*`，再逐步模块化。
- 后续生产基础设施：Postgres 或 MySQL、Redis、BullMQ、AI Worker、S3 兼容对象存储。
- AI 网关：New-API -> CPA/上游模型。

### 阶段划分与门禁

- Phase 0：纪律基线。必须先完成 AGENTS、README、API 契约、后端边界、画布迁移清单和记录反馈。
- Phase 1：前端源码壳。只允许在 `frontend/` 使用 Vue 3 + Vite + TypeScript + Naive UI + Pinia + Axios 继续开发。
- Phase 2：新版画布已废止。只允许回到旧画布做最小修复，不允许继续开发 Vue Flow 新画布。
- Phase 3：API 契约与后端模块边界。先写契约和边界，不直接推倒 `server.js`。
- Phase 4：生产基础设施。NestJS、Prisma、Postgres/MySQL、Redis/BullMQ、MinIO/S3 进入前必须先完成方案、环境确认和迁移验收点。

### CodeGraph 索引规则

- 每轮涉及代码结构、接口、调用链、影响面、架构或 bug 定位时，必须先检查 CodeGraph。
- 如果 CodeGraph 未初始化，先问用户是否运行 `codegraph init -i`，得到确认后再执行。
- 已初始化后优先使用 `codegraph_status`、`codegraph_files`、`codegraph_context` 等结构索引工具。
- 只有查文本、日志、配置字符串或 CodeGraph 无法覆盖时，才使用 `rg`。

### 环境与下载确认

- 任何新软件、全局工具、数据库、Redis、Docker 服务、对象存储、New-API、CPA、CodeGraph 初始化，都必须先问用户。
- 任何新增 npm 包，也必须先说明用途、开源项目、许可证、官网或 GitHub，再等待确认。
- 缺成熟基座时停下来问用户下载或配置，不允许写自研替代实现。
- 真实密钥、真实账号、真实付费调用、生产部署和批量数据操作必须先说明风险并等待确认。

### 禁止事项

- 禁止继续开发新画布、迁移 Infinite-Canvas 节点体系或引入新的画布引擎。
- 禁止自研画布拖拽、连线、缩放、小地图和视口系统。
- 禁止自研 UI 组件库、状态库、HTTP Client、模型网关、Token 分发和账号池。
- 禁止继续把大功能写进旧 `assets/*.js`；只有阻塞级 bug 可短期修旧资产。
- 禁止绕过 TypeScript、构建、smoke 或文档记录。
- 禁止在当前内网过渡阶段临时引入 Kubernetes、微服务或自研队列。
- 禁止在 API 契约未记录前新增或修改重要接口。
- 禁止在后端模块边界未确认前拆分 `server.js`。

### 维护与测试

- 新前端改动后运行 `npm run build --prefix "F:\dianshang\frontend"`。
- 文档改动后运行 `git -C "F:\dianshang" diff --check` 并检查 UTF-8 无 BOM。
- 旧后端改动后运行 `node --check "F:\dianshang\server.js"` 和 `powershell -NoProfile -ExecutionPolicy Bypass -File "F:\dianshang\scripts\smoke-api-disposable.ps1"`。
- 每轮更新 `docs/progress-report.md`、`docs/review-log.md` 和必要时的 `docs/feature-completion-checklist.md`。
- 架构边界以 `docs/adr/0002-source-first-technology-stack.md` 为准。
- 并行任务树 `docs/plans/2026-06-26-source-stack-canvas-rebuild-plan.md` 已因新画布废止而失效，只作历史记录；画布最新边界以 `docs/canvas-migration-checklist.md` 为准。

### 生产端 main/Docker 同步规则

- 当前生产修复必须以主工作区 `F:\dianshang` 为唯一源码基线；禁止只在 Docker 容器内热修、只拷贝容器文件或只改旧参考目录后声称完成。
- 如遇紧急热修必须先说明原因；热修后同一轮必须把完全相同的改动回写到 `F:\dianshang`，并重新构建 Docker 验证，不能留下“容器有、main 没有”的状态。
- 任何影响线上行为的代码、静态资源、配置、路由、后台、画布或脚本改动后，必须执行 `docker compose -f "F:\dianshang\docker\docker-compose.yml" up -d --build --force-recreate app`；仅 `docker restart` 不能作为 main 与生产端同步的证明。
- Docker 重建后必须确认 `dianshang-internal-app` 为 `healthy`，并记录镜像 ID、镜像创建时间、容器启动时间或等价信息，证明 3456 当前运行的是最新镜像。
- 生产端验收必须直接请求 `http://192.168.0.39:3456/` 或相关线上路径，确认 HTML、入口 JS、动态 chunk query、API 或目标行为已经命中新版本；不能只看本地文件、构建输出或容器内文件。
- 涉及旧入口、旧 chunk、旧后台包、缓存 query 或静态资源隔离时，必须在 smoke 或 HTTP 检查中验证旧资源返回预期状态（例如 410/404），避免旧系统再次被浏览器缓存或旧 URL 拉起。
- 最终汇报必须同时说明：main 工作区改了哪些文件、Docker 是否完整重建、3456 生产端验证结果、是否仍需用户强刷浏览器缓存。

## 项目现状

### 已完成
| 模块 | 状态 | 详情 |
|------|:---:|------|
| 前端 | OK | 47文件, 1.7MB JS+CSS, Vue3 SPA 完整还原 |
| 后端 | OK | Express + SQLite, 42 API端点, JWT认证 |
| 画布 | OK | Canvas-yGc8b2gf.js 722KB, 节点编辑器完整 |
| 模板 | OK | 10个电商模板, template-data.json |
| 数据库 | OK | SQLite: users/projects/generations/balance_logs |
| 登录 | OK | admin/admin123, 注册送50算力 |

### 待配置
| 项目 | 状态 | 位置 |
|------|:---:|------|
| 中转站Key | 未填 | .env 文件 |
| 邮件发送 | 控制台 | 验证码打印到Node console |

### 已知问题
1. 未登录时画布401 — 正常,登录后OK
2. 新画布已废止 — 正常,画布入口回到旧 `/canvas`
3. 生图返回占位图 — 未配中转站Key时用placehold.co
4. Google Fonts外链 — 字体从fonts.googleapis.com加载

## 架构

```
前端: 旧打包 Vue 资产 + 可选 frontend 源码壳
后端: Express (Node.js) + better-sqlite3
认证: JWT HS256 (7天过期)
生图: OpenAI兼容中转站API
```

## 文件结构

```
hjm-mb-clone/
├── index.html              # SPA入口 (已改本地路径)
├── server.js               # 后端 (21KB, 全部42端点)
├── template-data.json      # 10个模板配置 (10KB)
├── package.json            # 依赖: express, better-sqlite3, multer, jsonwebtoken, node-fetch
├── .env                    # 需填写API Key
├── data.db                 # SQLite (自动生成)
├── assets/                 # 47个前端文件 (JS+CSS+图片)
├── videos/                 # home-background.mp4 (3MB)
├── public/                 # logo.png
└── uploads/                # 用户上传目录
```

## API端点

### 公开 (无需登录)
```
GET  /api/public/routes             -> 5条图像路线
GET  /api/public/models?routeId=X   -> 路线下的模型列表
GET  /api/model-routes?group=text   -> 文本/图像/视频路线
GET  /api/template/settings         -> 10个模板+平台+比例配置
GET  /api/settings/canvas-storage   -> 画布设置
POST /api/auth/send-email-code      -> 发送验证码 (console.log)
POST /api/auth/send-reset-code      -> 发送重置码
POST /api/auth/register             -> 注册 (需验证码)
POST /api/auth/login                -> 登录 (username+password)
POST /api/auth/reset-password       -> 重置密码
```

### 用户 (需JWT)
```
GET  /api/user/profile              -> 用户信息
GET  /api/user/routes               -> 可用路线
GET  /api/user/models?routeId=X     -> 路线模型
GET  /api/user/api-status           -> API状态+模型
GET  /api/user/balance-logs         -> 余额记录
GET  /api/user/projects             -> 画布项目列表
POST /api/user/projects             -> 创建项目
GET  /api/user/projects/:id         -> 获取项目
PUT  /api/user/projects/:id         -> 更新项目 (name+data)
DEL  /api/user/projects/:id         -> 删除项目
POST /api/user/redeem               -> 兑换码
POST /api/user/avatar/upload        -> 上传头像 (multipart)
GET  /api/user/generations          -> 生成历史
```

### AI生成 (需JWT)
```
POST /api/generation/estimate-cost  -> 估费
POST /api/template/generate-image   -> AI生图 (对接中转站)
POST /api/template/reverse-prompt   -> 图片反推提示词
POST /api/chat/completions          -> Chat对话 (OpenAI格式)
```

### 管理 (需admin角色)
```
GET  /api/admin/users               -> 用户列表
GET  /api/admin/dashboard           -> 统计数据
```

## 数据库表

```
users       (id, username, email, password_hash, role, balance, avatar_url, status, created_at)
email_codes (email, code, type, expires_at, created_at)
balance_logs(id, user_id, type, change_amount, before_balance, after_balance, remark, created_at)
projects    (id, user_id, name, data JSON, created_at, updated_at)
generations (id, user_id, model_key, prompt, result_url, cost, status, created_at)
redeem_codes(code PRIMARY KEY, amount, max_uses, used_count, enabled)
```

## 模型 (5图像路线 + 1文本路线)

```
6789(默认):      GPT Image 2(10pt), Flatfee(3.5pt), VIP(5pt), Nano Banana 2(15pt), Pro(16pt), Gemini 3 Pro(20pt)
comfly-google:    Gemini 3.1 Flash(10pt), Nano Banana Pro(20pt), Gemini 3 Pro(20pt), 2.5 Flash(8pt)
comfly-openai+:   GPT Image 2 All(4pt), GPT Image 2(4pt), GPT-4o Image(15pt), GPT-4 All(15pt), GPT-4o All(15pt)
RK:               GPT Image 2(5pt)
哈吉米:            GPT Image-2(6pt), GPT Image 2 Pro(10pt)
flowstudio(text): GPT 5.5(5pt)
```

## 10个电商模板

main-image(主图), baiditu(白底图), sub-image-replica(副图), detail-page(详情页),
scene(场景图), model(模特图), packaging(包装图), poster(海报), xiaohongshu(小红书), custom(自定义)

## 启动

```bash
cd C:\Users\pc\Desktop\hjm-mb-clone
npm install   # 已完成
npm start     # http://localhost:3456
# 管理员: admin / admin123
```

## 待办

P0:
- 填好.env的API Key后测试真实生图
- 本地化Google Fonts

P1:
- 真实邮件发送
- 支付/充值系统
- 视频生成模型对接

P2:
- 安全响应头(CSP/HSTS)
- 登录速率限制

## 当前生产测试项目边界

- 当前生产测试目录固定为 `F:\dianshang`；`C:\Users\pc\Desktop\hjm-mb-clone` 只允许作为旧版参考，不作为继续开发或验收基线。
- 画布继续使用现有旧画布和 Vue Flow 运行链路；禁止新建自研画布、WebGL 重写或替换渲染引擎。
- 真实 Provider、API Key、扣费和外部付费调用相关改动必须先说明风险并等待确认。

## 旧画布性能过渡层

- `assets/canvas-performance-mode.css` 和 `assets/canvas-performance-mode.js` 是旧画布过渡优化层，只用于交互态 GPU 合成、降重绘、图片懒解码和临时关闭重视觉效果。
- 交互态统一使用 `canvas-performance-active` 标记；新增样式必须集中挂在该类或明确的旧画布选择器下，禁止散落到无关页面。
- `will-change` 只能在拖拽、缩放、节点移动等交互态开启，禁止长期常驻，避免显存占用反而拖慢页面。
- 自动保存只允许做降频和合并，不改变工作流 JSON 格式，不破坏历史项目恢复。
- 后续如果进入第二阶段源码化旧画布组件，应迁移这些性能规则，不得把过渡层扩展成第二套画布实现。
