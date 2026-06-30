# 画布迁移清单

## 2026-06-26 决策更新

新画布迁移已废止。后续画布功能回滚到哈基米旧画布，不再继续推进 Vue Flow 新画布、Infinite-Canvas 全节点迁移、提示词模板库迁移或新画布运行适配器。

## 当前唯一验收入口

- 旧画布地址：`http://127.0.0.1:3456/canvas`
- 旧画布资产：`assets/Canvas-*.js`、`assets/Canvas-*.css`
- 旧画布后端：`server.js` 现有 `/api/*`
- 新前端跳转：`frontend/src/views/CanvasLegacySource.vue` 直接整页跳转旧画布运行时。

## 已废止内容

- `frontend/src/views/CanvasStudio.vue`
- `frontend/src/stores/canvas.ts`
- `frontend/src/types/canvas.ts`
- `frontend/src/api/canvasRunner.ts`
- `frontend/public/system-prompts/infinite-canvas-prompt-templates.md`
- `@vue-flow/core`
- `@vue-flow/background`
- `@vue-flow/controls`
- `@vue-flow/minimap`

## 后续规则

- 禁止继续在 `frontend/` 内开发新画布。
- 禁止继续迁移 Infinite-Canvas 节点体系到当前项目主线。
- 旧画布如有问题，只做最小修复，并优先保持当前可运行旧版本。
- 真实生图、图库、历史、本地保存等能力，仍按旧画布现有接口验收。
- 如未来重新立项新画布，必须重新写 ADR、验收标准和人工确认，不沿用本次已废止方案。

## 当前护栏

- `scripts/verify-canvas-performance-assets.js` 静态验证旧画布性能层、图片节点 polish、扩图和 image-tools 接线锚点。
- `scripts/smoke-backend-canvas-boundary.ps1` 使用临时 SQLite 和临时 uploads 启动后端，验证 `/canvas` 旧画布入口、关键旧画布资产、`/api/settings/canvas-storage`、`/api/image-tools/*` 和 `/api/upload/image` 边界；该脚本强制禁用真实 AI/邮件/支付/存储，不触发上游付费调用。

## 关联文档

- 画布以外页面迁移见 `docs/frontend-migration-roadmap.md`。
- 旧画布后续维护边界见 `docs/canvas-maintenance-boundary.md`。
- 旧画布近期维护日志和技术债见 `docs/canvas-maintenance-log.md`。
- GPT Image 2 参数和 Packy 适配准则见 `docs/provider-packy-gpt-image-2.md`。
