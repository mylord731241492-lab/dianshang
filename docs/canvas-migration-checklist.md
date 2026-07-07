# 画布统一清单

## 2026-07-07 术语更新

项目现在只有一个画布。后续画布开发、修复和验收统一指当前 `/canvas` 画布运行链路，不再使用两套画布的并列叫法。历史上的独立重建方案已废止，不再继续推进 Infinite-Canvas 全节点迁移、提示词模板库迁移或独立运行适配器。

## 当前唯一验收入口

- 画布地址：`http://127.0.0.1:3456/canvas`
- 画布资产：`assets/Canvas-*.js`、`assets/Canvas-*.css`
- 画布后端：`server.js` 现有 `/api/*`
- 前端源码入口：`frontend/src/views/CanvasLegacySource.vue` 进入当前画布运行链路。

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

- 禁止在 `frontend/` 内另起第二套画布。
- 禁止继续迁移 Infinite-Canvas 节点体系到当前项目主线。
- 画布如有问题，就在当前画布运行链路中做最小修复，并优先保持当前可运行版本。
- 真实生图、图库、历史、本地保存等能力，仍按当前画布现有接口验收。
- 如未来重新立项第二套画布，必须重新写 ADR、验收标准和人工确认，不沿用本次已废止方案。

## 当前护栏

- `scripts/verify-canvas-performance-assets.js` 静态验证当前画布性能层、图片节点 polish、扩图和 image-tools 接线锚点。
- `scripts/smoke-backend-canvas-boundary.ps1` 使用临时 SQLite 和临时 uploads 启动后端，验证 `/canvas` 画布入口、关键画布资产、`/api/settings/canvas-storage`、`/api/image-tools/*` 和 `/api/upload/image` 边界；该脚本强制禁用真实 AI/邮件/支付/存储，不触发上游付费调用。

## 关联文档

- 画布以外页面迁移见 `docs/frontend-migration-roadmap.md`。
- 当前画布后续维护边界见 `docs/canvas-maintenance-boundary.md`。
- 当前画布近期维护日志和技术债见 `docs/canvas-maintenance-log.md`。
- GPT Image 2 参数和 Packy 适配准则见 `docs/provider-packy-gpt-image-2.md`。
