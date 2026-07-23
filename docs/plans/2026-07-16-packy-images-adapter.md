# Packy Images Adapter Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use executing-plans to implement this plan task-by-task.

**Goal:** 为 PackyAPI `image` 分组增加独立、后台可切换的严格图片请求格式，消除 `response_format` 等不兼容字段并保持其他线路隔离。

**Architecture:** 以线路的 `apiFormat` / `requestFormat` 选择 `packy-images` 适配器。后端在统一图片调用函数内部按适配器构造字段白名单，继续复用现有尺寸、质量、排队、响应解析、图片持久化和扣费流程；后台只负责选择格式与展示固定规则。

**Tech Stack:** Node.js、Express、Vue 3、TypeScript、Naive UI、Docker Compose。

---

### Task 1: 锁定 Packy 请求契约

**Files:**
- Modify: `scripts/check-packy-gpt-image-adapter-coverage.js`
- Modify: `scripts/test-chat-image-generation-tools.js`

1. 添加 Packy 文生图严格 JSON 字段断言。
2. 添加 Packy 图生图 multipart 单数 `image` 和禁用字段断言。
3. 保留 Lingsuan `image[]` 与 Base64 断言，验证线路隔离。
4. 先运行专项测试，确认新断言在旧实现上失败。

### Task 2: 实现后端 `packy-images` 适配器

**Files:**
- Modify: `server.js`

1. 增加格式常量、线路识别函数和请求示例。
2. 在保存线路时规范化固定端点和非流式配置。
3. 文生图只发送六个白名单字段。
4. 图生图只发送白名单字段并使用单数 `image`。
5. 继续使用统一 URL/Base64 响应解析器。
6. 运行语法检查与专项测试。

### Task 3: 增加后台格式选项

**Files:**
- Modify: `frontend/src/views/AdminApiProvidersSource.vue`

1. 添加 `Packy Images` 选项和格式判断。
2. 选中后固定端点、非流式和响应自动识别配置。
3. 更新请求预览与字段说明。
4. 构建前端验证 TypeScript 和模板。

### Task 4: 更新 smoke 与项目记录

**Files:**
- Modify: `scripts/smoke-api.ps1`
- Modify: `docs/current-baseline.md`
- Modify: `docs/progress-report.md`
- Modify: `docs/review-log.md`
- Modify if needed: `docs/feature-completion-checklist.md`

1. 更新默认 Packy 路线契约断言。
2. 运行 disposable API smoke，禁止真实 Provider 调用。
3. 记录 Packy 与 Lingsuan 的独立格式边界。
4. 检查 UTF-8 无 BOM 和 `git diff --check`。

### Task 5: 完整重建并切换生产配置

**Files:**
- Runtime data: Docker 挂载的 SQLite / `app_state`

1. 执行生产备份。
2. 使用 Docker Compose `--build --force-recreate app` 完整重建。
3. 确认容器 healthy，并记录镜像 ID、镜像创建时间、容器启动时间。
4. 通过现有后台 API 将 Packy 路线格式切为 `packy-images`，保留 Base URL、API Key、模型和计费配置。
5. 直接验证 `http://192.168.0.39:3456/`、后台新资源和 Packy 路线配置。
6. 不执行真实付费生图，由用户手动测试，Codex 观察日志。

> 本轮遵循项目生产规则直接在主工作区实施。由于工作区已有用户改动，不创建额外工作树，也不自动提交或整理无关改动。
