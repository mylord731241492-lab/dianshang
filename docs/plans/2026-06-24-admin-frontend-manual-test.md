# Admin + Frontend Manual Test Implementation Plan

> **For Codex:** 后续对话先读本文件，再读 `docs/progress-report.md`、`docs/feature-completion-checklist.md` 和 `docs/review-log.md`。

**Goal:** 今天先把后台和前端打通到可人工测试，不扩架构。

**Architecture:** 继续使用 Express 一体服务 + 打包前端资产 + SQLite + Docker Compose。New-API 只保留配置入口和 mock 回落，不接真实 key。

**Tech Stack:** Node.js, Express, SQLite, Docker Compose, bundled Vue assets.

---

## 当前状态

- 🟢 Docker 已跑通：`dianshang-app` 为 `healthy`，端口 `3456` 可访问。
- 🟢 后台接口基本可测：登录、Dashboard、用户、订单、日志、兑换码、API 线路、模型价格、任务、模板工作流、设置。
- 🟡 前端需要继续人工点测：首页、模板、图库、画布、用户中心、后台。
- 🔴 暂不接真实 New-API key、支付、邮件、云存储。

## 今日目标

- 🟢 后台能登录、能看数据、能保存配置。
- 🟢 模板页能打开，能生成 mock 结果。
- 🟢 图库能显示生成历史。
- 🟢 画布能打开，基础工具栏和保存提示不报错。
- 🟢 Docker 内网访问正常。

## 执行顺序

1. 后台人工测试
   - 打开 `/admin/login`，使用 `admin / admin123` 登录。
   - 检查 Dashboard、用户、订单、日志、兑换码、API 线路、模型价格、任务、模板工作流、设置。
   - 优先修明显问题：按钮没反馈、保存不回显、弹窗无法关闭。

2. 前端人工测试
   - 首页：入口跳转正常。
   - 模板：上传区、提示词、生成、结果区可用。
   - 图库：空状态、历史记录、多图显示可用。
   - 画布：打开项目、工具栏、历史、保存提示可用。
   - 用户中心：资料、余额、生成记录可见。

3. New-API 边界
   - 后台只保留配置能力。
   - `.env` 只写占位说明，不提交真实 key。
   - 未启用 `ENABLE_REAL_AI=true` 时必须 mock 回落。
   - 不重复实现 New-API/CPA 的网关、额度和账号池能力。

4. 收尾
   - 更新进度报告和功能清单。
   - 运行验证命令。
   - 提交并推送 `codex/backend-platform`。

## 验证命令

```powershell
node --check server.js
node --check assets/home-carousel-inertia.js
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\smoke-api.ps1
Invoke-RestMethod http://127.0.0.1:3456/api/health
docker compose -f docker-compose.internal.yml ps
git status --short --branch
```

## 人工测试地址

```text
http://127.0.0.1:3456/
http://192.168.0.39:3456/
```

## 承诺

- 🟡 我会优先修人工测试中出现的真实问题。
- 🟡 我会每轮更新进度、问题和完成清单。
- 🔴 真实 New-API key、服务器域名、HTTPS 后面再配置，不在今天强行接。
