# 画布迁移清单

## 2026-06-26 决策更新

新画布迁移已废止。后续画布功能回滚到哈基米旧画布，不再继续推进 Vue Flow 新画布、Infinite-Canvas 全节点迁移、提示词模板库迁移或新画布运行适配器。

## 当前唯一验收入口

- 旧画布地址：`http://127.0.0.1:3456/canvas`
- 旧画布资产：`assets/Canvas-*.js`、`assets/Canvas-*.css`
- 旧画布后端：`server.js` 现有 `/api/*`
- 新前端跳转：`frontend/src/views/LegacyCanvasRedirect.vue`

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

## 关联文档

- 画布以外页面迁移见 `docs/frontend-migration-roadmap.md`。
