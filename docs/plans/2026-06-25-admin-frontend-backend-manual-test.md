# 2026-06-25 今日目标：前端 + 后端 + 后台视觉统一到人工可测版本

## 目标

今天把项目收口到内网人工测试版本：前端主流程能点通，后端接口稳定返回 JSON，后台逐页截图复核并做基础视觉统一。

## 范围

- 前端：继续小补丁修首页、模板、图库、画布、用户中心的明显 UI 问题。
- 后端：保持现有 `/api/*` 路径不变，补齐 Dashboard、模板、图库、用户中心、后台配置保存的兼容字段。
- 后台：逐页看截图，修标题、图标、按钮、表格密度、卡片间距、字重和字距。
- 截图：后台保存到 `docs/design-references/admin-2026-06-25/`，前端主流程保存到 `docs/design-references/frontend-2026-06-25/`。
- New-API：只保留配置入口和 mock 回落，不接真实 key。

## 后台截图页面

- `/admin/dashboard`
- `/admin/users`
- `/admin/orders`
- `/admin/logs`
- `/admin/redeem-codes`
- `/admin/api-providers`
- `/admin/model-prices`
- `/admin/generate-tasks`
- `/admin/template-workflows`
- `/admin/settings`

## 验收标准

- 页面不空白、不 404、不 500。
- 后台每页有桌面截图记录。
- 标题、按钮、表格、卡片排版肉眼统一。
- 保存类操作有反馈，刷新后能回显。
- 无真实 key 时仍走 mock。
- Docker 可用时容器保持 healthy；Docker Desktop 未启动时记录为待人工重启复核。

## 固定验证命令

```powershell
node --check server.js
node --check assets/home-carousel-inertia.js
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\smoke-frontend-routes.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\smoke-api.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\smoke-api-disposable.ps1
Invoke-RestMethod http://127.0.0.1:3456/api/health
docker compose -f docker-compose.internal.yml ps
git status --short --branch
```

## 当前承诺

- 不重写前端框架。
- 不动已经确认的画布卡片结构。
- 不造 New-API / CPA 轮子。
- 不提交真实密钥。
- 每轮修复后更新进度文档并提交推送。
- 后台视觉优化必须逐页看截图，重点复核标题、图标、按钮、字距、表格密度和卡片间距。

## 当前执行状态

- 已完成：后台 10 页桌面截图归档；后台图标线宽、标题字重、按钮图标尺寸和表格密度做过一轮小补丁。
- 已完成：图库删除持久化、保存链接复制、用户中心真实记录桥接、头像随机/上传保存验证。
- 已完成：模板反推接口补齐 `rawText/prompts` 兼容字段，接口层可返回 3 条提示词。
- 进行中：模板真实上传素材后的 UI 闭环还要继续人工点测。
- 进行中：后台保存/删除/弹窗关闭仍需人工逐页点测。
- 待复核：Docker Desktop 打开后执行 `docker compose -f docker-compose.internal.yml ps`。
