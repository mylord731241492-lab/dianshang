# 每轮推进复核清单

每次推进完成前必须按本清单复核，并把结果写入 `docs/progress-report.md`、`docs/feature-completion-checklist.md` 和 `docs/review-log.md`。

## 1. 范围确认

- 本轮是否只做当前 PRD 相关改动。
- 是否避免大规模重写打包前端资产。
- 是否复用已有 `/api/*`、现有前端模块、New-API、CPA、Docker Compose 等已有能力。
- 是否没有提交 `.env`、数据库、uploads、日志、缓存或真实密钥。

## 2. 架构护栏

- 7 月前默认仍是 Express 一体服务 + SQLite。
- 未经确认不引入 Postgres、Redis、BullMQ、Worker、Kubernetes 或微服务拆分。
- Provider Adapter 默认面向 New-API。
- CPA 只作为 New-API 后置渠道，不直接暴露给前端或员工。
- `ENABLE_REAL_AI=false` 或缺少 key 时必须 mock 回落。

## 3. 后端验证

- 运行 `node --check server.js`。
- 本地默认运行 `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/smoke-api-disposable.ps1`，避免污染人工测试库。
- 只有需要验证当前已启动服务真实数据时，才设置 `SMOKE_USE_CURRENT_API=true` 运行 `scripts\preflight-check.ps1`。
- 修改后台 settings、API 线路、模型价格或模板工作流时，设置 `SMOKE_PERSISTENCE=true` 运行 `scripts\preflight-check.ps1`，确认重启后配置不丢。
- 检查 `/api/health` 返回 JSON，且包含数据库、provider、mock/real、运行路径。
- 如修改 `assets/home-carousel-inertia.js`，运行 `node --check assets/home-carousel-inertia.js`。
- 如修改其他打包 JS，针对修改文件运行 `node --check`。

## 4. 前端验收

- 至少覆盖本轮修改页面或用户最近指出的问题页面。
- 页面不能空白，入口可点击，有合理响应。
- Console 不能出现新的关键错误。
- 修改首页、模板、图库、画布、后台时，更新功能完成清单。
- 视觉 1:1 无法自动确认时，明确标记为需要人工确认。
- 需要后台逐页截图、画布 JSON 导入或用户中心桌面/移动布局证据时，设置 `SMOKE_UI=true` 运行 `scripts\preflight-check.ps1`；默认预检跳过 UI smoke，避免每次都启动浏览器。

## 5. 部署验收

- 本地无 Docker 时，至少运行并记录 `docker` 命令不可用。
- 有 Docker 时运行：

```powershell
docker compose -f docker-compose.internal.yml config
docker compose -f docker-compose.internal.yml up --build -d
Invoke-RestMethod -Method Get -Uri "http://127.0.0.1:3456/api/health"
```

- 容器重启后确认 SQLite 数据、uploads、logs 不丢。
- 需要部署后视觉/画布增强验收时，设置 `SMOKE_UI=true` 运行 `scripts\verify-internal-deploy.ps1`；服务器无浏览器环境时，在本地设置 `SMOKE_BASE_URL=http://服务器IP:3456` 单独运行 UI smoke。

## 6. 文档同步

每轮必须写入：

- 本轮完成内容。
- 修改文件。
- 验证命令和结果。
- 当前完成度估算。
- 新发现问题。
- 未完成清单。
- 下一轮建议。
- 需要人工介入项。

## 7. Git 收尾

- 运行 `git status --short --branch`。
- 改动通过验证后再提交。
- 提交信息说明真实改动，不夸大完成范围。
- 推送当前阶段分支，失败时记录原因和需要人工处理项。
