# 当前项目基线与防混淆地图

> 最后更新：2026-07-07，北京时间。
> 当前基线：`main` 已回滚到 `51d4dab fix: improve canvas production performance guards`。

本文件是后续修改前的第一入口。`docs/progress-report.md` 和 `docs/review-log.md` 是时间线流水账，不是当前状态的唯一准绳。

## 当前准绳

- Git 基线：`51d4dab`，提交时间 `2026-07-04 18:05:31 +0800`。
- 当前分支：`main`，相对 `origin/main` 仍 `ahead 2`，因为远端停在 `1e058fc`。
- 回滚前现场备份分支：`codex/backup-before-rollback-20260707-130326`。
- 回滚前未提交改动：`stash@{0}`，消息为 `pre-rollback-to-51d4dab-20260707`。
- 本次 Git 回滚没有重建 Docker，也没有同步 `http://192.168.0.39:3456/`。生产端是否已回到本基线必须通过 Docker 重建和内网 URL 验证确认，不能从 Git 状态推断。

## 阅读顺序

1. `docs/current-baseline.md`：先确认当前基线和哪些记录容易误导。
2. `AGENTS.md`：项目纪律、生产同步、测试和禁止事项。
3. `CONTEXT.md`：项目固定术语，尤其是“画布”只指当前唯一画布。
4. `docs/agents/`：agent 本地任务、标签和文档阅读约定。
5. `docs/api-contract-next.md`、`docs/api-contracts.md`：接口契约。
6. `docs/backend-module-boundaries.md`：后端后续拆分边界。
7. `docs/canvas-maintenance-boundary.md`、`docs/canvas-migration-checklist.md`：当前画布边界。
8. `docs/internal-production-runbook.md`：生产 Docker 操作规则。
9. `docs/progress-report.md`、`docs/review-log.md`：只作为历史检索和复盘，不直接当作当前实现说明。

## 项目地图

按 `codebase-design` 的语言，本项目现在还不是深模块结构，而是几个大实现挤在一起：

| 区域 | 当前角色 | 修改规则 |
| --- | --- | --- |
| `index.html` | 旧打包 SPA 的入口 interface，负责挂载当前有效静态资源 query。 | 改入口必须同步评估首页、用户中心、后台和画布，并更新生产 smoke。 |
| `assets/` | 当前打包运行时和过渡 adapter，包含画布、桥接脚本和页面 chunk。 | 画布开发统一在当前画布链路中进行；禁止另起第二套画布。 |
| `frontend/` | Vue 3 源码壳和部分源码化页面。 | 新源码改动必须走 TypeScript/build 验证；不在这里另起第二套画布。 |
| `server.js` | Express + SQLite 单体 implementation，承载 `/api/*`、Provider、后台、项目和生图逻辑。 | 未确认模块边界前不拆文件；改后必须 `node --check` 和相关 smoke。 |
| `scripts/` | 验证 adapter 集合，包含当前 smoke 和历史专项脚本。 | 先确认脚本断言是否匹配当前入口 query；旧脚本失败不一定代表业务失败。 |
| `docs/` | 契约、边界、流水账和复核记录。 | 当前状态写到本文件或明确的边界文档；流水账只追加复盘。 |
| `docs/agents/` | agent 技能和本地协作约定。 | 只记录工作方式，不记录业务现状；业务现状仍回到本文件。 |

## 当前入口资源

当前 `index.html` 引用的主资源版本：

- 主入口：`/assets/index-DglIsp_g.js?v=20260704usercenter1`
- 画布辅助 JS：`canvas-performance-mode.js?v=20260704canvasleave1`
- 图片节点辅助 JS：`canvas-image-node-polish.js?v=20260704canvasleave1`
- Canvas Chat 辅助 JS：`canvas-chat-prompt-flow.js?v=20260704canvasleave1`
- 画布性能 CSS：`canvas-performance-mode.css?v=20260704usercenter1`

后续如果改静态资源 query，必须同时更新生产 smoke 和最终汇报里的生产命中结果。

## 容易混淆的历史

- 2026-07-06 到 2026-07-07 的异步生图恢复、Provider 传输、官转线路隔离、参考图分析旁路和撤回等改动，已经不在当前 `main` 基线里。它们只存在于回滚前备份分支和 stash 中。
- CodeGraph 当前索引在回滚后仍可能列出已删除的独立画布重建方案源码路径，例如 `frontend/src/views/CanvasStudio.vue`、`frontend/src/stores/canvas.ts` 和 `frontend/src/types/canvas.ts`；`Test-Path` 与 `git ls-files` 已确认这些路径当前不存在。后续结构分析前应先确认或刷新 CodeGraph 索引。
- 后续文档和汇报统一使用“画布”或“当前画布”，不要再把当前开发对象写成两套画布。
- `scripts/verify-canvas-performance-assets.js` 在当前基线仍会断言旧资源 `canvas-performance-mode.js?v=20260629perf5`，需要单独梳理后才能作为可信验证脚本。
- `assets/` 内存在多组 hash chunk 是历史缓存隔离和旧入口兼容结果，不能因为看起来重复就直接删除。
- `docs/progress-report.md` 和 `docs/review-log.md` 体量很大，里面的“已完成”“已验证”必须结合对应日期和当前 Git 基线判断。

## 后续修改门禁

- 开始任何代码修改前，先说明本轮目标是否仍基于 `51d4dab`。
- 查结构、接口、调用链、影响面或 bug 时，先用 CodeGraph。
- 修改当前打包资产前，先确认不能在 `frontend/` 或 `server.js` 的已有 seam 上解决。
- 修改生产行为前，先确认是否会触发 Docker 重建、真实账号、真实扣费或外部 Provider 调用。
- 文档更新后运行 `git -C "F:\dianshang" diff --check` 并检查 UTF-8 无 BOM。
- 拆分本地任务时优先使用 `docs/agents/issue-tracker.md` 和 `docs/agents/triage-labels.md`，不要默认创建远端 issue。

## 下一步建议

1. 先修正或废弃过期验证脚本，尤其是 `verify-canvas-performance-assets.js` 里与当前 query 不匹配的断言。
2. 给 `assets/` 建一个 active resource manifest，列出当前入口、动态 chunk 和允许 410/404 的旧资源。
3. 把 `server.js` 的当前路由按 `docs/backend-module-boundaries.md` 建只读索引，不急着拆代码。
4. 再决定是否把回滚前 stash 中的某些小修复 cherry-pick 回来；每次只拿一个明确问题，验证后再继续。
