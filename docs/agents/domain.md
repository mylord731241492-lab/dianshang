# Agent Domain Docs

> 本文件是 agent 读项目文档的路线图。目标是先确认当前事实，再进入历史记录，避免把回滚前实验当成当前源码状态。

## 单一事实入口

1. `docs/current-baseline.md`：当前 Git 基线、入口资源、回滚备份、生产同步状态和易混淆历史。
2. `AGENTS.md`：项目纪律、禁止事项、验证规则、生产 Docker 同步规则和 agent 技能入口。
3. `CONTEXT.md`：项目固定术语，尤其是“画布”只指当前唯一画布。
4. `docs/agents/*.md`：agent 本地任务、标签和文档阅读约定。
5. `docs/adr/`：架构决策记录，尤其是 `0002-source-first-technology-stack.md`。
6. `docs/api-contract-next.md`、`docs/api-contracts.md`：接口契约。
7. `docs/backend-module-boundaries.md`：后端模块边界。
8. `docs/canvas-maintenance-boundary.md`、`docs/canvas-migration-checklist.md`：当前画布维护边界。
9. `docs/progress-report.md`、`docs/review-log.md`：历史检索和复盘，只能结合日期与 Git 基线使用。

## 历史记录阅读规则

- `progress-report.md` 的“已完成”只对该日期、该分支、该 Git/Docker 状态成立。
- `review-log.md` 的“已验证”只说明当时验证过，不证明当前回滚后仍然存在。
- 2026-07-06 到 2026-07-07 的生图恢复、Provider 传输、官转线路隔离和参考图旁路实验，不属于当前 `main` 的 `51d4dab` 基线。
- “画布”是唯一开发对象；历史上的替代实现只称为“已废止的独立画布重建方案”，不要再用两套画布的叫法制造并列关系。
- 需要恢复历史实验时，先从备份分支或 stash 中抽取一个明确小问题，不做批量合并。
- 回滚后如果 CodeGraph 仍列出 Git 或文件系统中不存在的路径，先记录为索引滞后；涉及结构判断时，得到用户确认后再刷新 CodeGraph。

## 代码区域词汇

| 区域 | 领域含义 |
| --- | --- |
| `index.html` | 当前打包 SPA 的静态入口和资源版本锚点。 |
| `assets/` | 当前打包运行时代码、画布过渡层和缓存隔离资源。 |
| `frontend/` | Vue 3 源码壳和渐进源码化页面，不承载第二套画布。 |
| `server.js` | Express + SQLite 单体后端，先保持兼容，再按已记录边界逐步模块化。 |
| `scripts/` | smoke、资源断言和历史专项验证脚本，使用前先确认断言是否仍匹配当前基线。 |
| `docs/` | 契约、边界、ADR、历史流水和复核记录。 |

## 后续补充

如果后续需要更完整的领域语言，可以新增根目录 `CONTEXT.md`。新增前必须先确认它不会和 `docs/current-baseline.md`、ADR 或 API 契约重复。
