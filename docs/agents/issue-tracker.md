# Agent Issue Tracker

> 本文件约定 agent 在本仓库如何记录计划、拆分任务和追踪状态。它不是产品路线图，也不是生产发布证明。

## 当前结论

- 本仓库有 GitHub 远端，但默认不把本地整理工作同步成 GitHub issue 或 PR。
- 用户没有明确要求远端协作时，所有 agent 工作项先写本地 Markdown。
- 任何会影响远端仓库、真实账号、发布、部署或费用的动作，都必须先说明风险并等待用户确认。

## 默认位置

- 临时计划：`.scratch/<topic>/PLAN.md`
- 任务拆解：`.scratch/<topic>/issues/<NN>-<slug>.md`
- 复盘记录：优先追加到 `docs/review-log.md`
- 当前事实：优先更新 `docs/current-baseline.md`

`.scratch/` 是工作草稿区，不替代 `AGENTS.md`、ADR、API 契约或当前基线文档。

## 工作项模板

```md
# <任务标题>

- 状态：
- 背景：
- 当前基线：
- 相关文件：
- 验收标准：
- 验证方式：
- 风险：
- 下一步：
```

## 何时使用 GitHub

只有用户明确提出创建 issue、PR、提交、推送或同步远端时，才使用 GitHub 流程。使用前先确认：

- 本轮是否基于当前 `main` 和 `docs/current-baseline.md`。
- 是否需要分支、提交和推送。
- 是否会暴露内部地址、密钥、截图、生产日志或业务数据。
