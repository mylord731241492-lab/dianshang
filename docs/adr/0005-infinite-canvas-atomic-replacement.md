# ADR-0005：Infinite Canvas 隔离候选改造与原子替换

## 状态

Accepted（2026-07-27 用户批准）

## 背景

2026-06-26 的独立重建方案已由用户明确废止，2026-07-07 用户进一步明确项目只有一个画布，`AGENTS.md` 与 `docs/canvas-migration-checklist.md` 据此写入"禁止另起第二套画布、禁止继续 Infinite-Canvas 节点迁移"的护栏。

2026-07-27 用户提出新目标：将 `basketikun/infinite-canvas` v0.10.0 改造为符合本系统账号、云端资产库、后台系统提示词、账号私有提示词、项目、任务、计费和图片工具接口的候选画布，在隔离环境完成自动化与人工验收后，原子替换生产唯一 `/canvas`，并保留明确回滚能力。详细执行步骤见 `docs/plans/2026-07-27-infinite-canvas-staged-replacement.md`。

本 ADR 取代 2026-07-07 的"继续禁止 Infinite Canvas 迁移"结论，但不恢复已废止的 Vue Flow 重建方案；`docs/plans/2026-06-26-source-stack-canvas-rebuild-plan.md` 继续仅作历史记录。

## 决策

- 生产始终只保留一个 `/canvas` 用户入口。候选未过门禁前，当前 `/canvas` 仍是唯一生产事实；切换通过 `CANVAS_RUNTIME=legacy|infinite` 单变量完成，不新增 `/canvas-next` 等长期并列入口。
- 候选改造只在独立工作树 `F:\dianshang-worktrees\infinite-canvas-candidate`（分支 `codex/infinite-canvas-candidate`，基线提交 `617ab32e774d3fb84877b3394a7d62685502de21`）、独立候选端口 `3466` 和隔离 SQLite/存储中进行。正式 `3456` 在人工切换门禁前不受影响。
- 保留 Infinite Canvas 的 React 19 源码与成熟交互，固定上游 tag `v0.10.0`（提交 `a0287a5e346e219bd488d084295542213912d816`），源码放入 `integrations/infinite-canvas/`。不重写为 Vue，不使用 iframe。
- 后端继续复用现有 `/api/*`、Provider、计费和持久任务队列（ADR-0004）。浏览器除纯画布交互外只调用同源 `/api/*`；Provider Key、对象存储密钥、计费和文件删除权限始终只在后端。
- 资产文件从服务器本地 `uploads` 演进为后端管理的云对象存储；新增"账号私有资产"与"账号私有提示词"两个后端领域，元数据存 SQLite，前端不得以 IndexedDB/localStorage 代替服务端事实源。新后端领域落成 `backend/` 下独立模块（参照 `backend/billing/`、`backend/generation/`），`server.js` 只做挂载。
- 云存储的厂商、Endpoint、Region、Bucket、访问策略、费用、生命周期和备份恢复必须由用户确认；没有确认不得自行选择 MinIO、AWS S3 或其他供应商，不得安装或启用对应 SDK。当前部署形态为内网 Docker（不公网暴露），选型优先考虑内网 MinIO 容器，但仍以用户在 Task 6 的明确确认为准。
- 旧基线中"不启用 S3/MinIO"的决定被本次需求重新打开，但只在云存储方案经用户确认并另行记录（计划 ADR-0006）后实施。
- 只有用户签署候选验收（人工验收门禁通过）后才能切换生产 `/canvas`。
- 回滚通过上一正式 app 镜像和切换前一致性备份完成；`CANVAS_RUNTIME=legacy` 的上一正式配置随备份保留。

## 许可

- 上游仓库 `LICENSE` 为 AGPL-3.0。用户为上游联合作者并持有授权（2026-07-27 确认），该授权取代 AGPL 对本项目的约束。
- 授权方、授权日期、授权范围和原始授权文件保管位置由 Task 2 的 `integrations/infinite-canvas/PRIVATE-LICENSE-REFERENCE.md` 记录；包含个人信息、签名、价格或保密条款的完整许可不上传公开仓库。

## 部署事实源

- 正式部署（`3456`）的 compose 事实源为 `docker/docker-compose.yml`（项目 `dianshang-internal`，容器 `dianshang-internal-app`）。
- 根目录 `docker-compose.internal.yml`（容器 `dianshang-app`）不再作为正式事实源，仅作历史参考，后续由独立任务评估合并或清理。

## 在途改动协调

- 主工作区 `F:\dianshang` 在 `codex/generation-stability-10-users` 分支上有 17 个未提交改动（含 `server.js`、`scripts/smoke-internal-prod.ps1` 等）。候选工作树基于已提交基线，不包含这些改动；不得覆盖、暂存或提交它们。
- 在途改动的回流时机与候选分支合并策略，由用户在候选合并回主线前确认。

## 非目标

- 不恢复 Vue Flow 重建方案，不重写画布交互。
- 不在本阶段接入真实云存储或真实 Provider；Fake Storage / Mock Provider 结果不得作为云端资产或真实生图验收。
- 候选范围不含视频/音频生成、上游本地 Codex Agent、插件市场和 Provider 配置页。
- 未经用户确认不安装新 npm 包、不启动新生产服务、不产生费用、不修改正式 Docker/数据库/容器。

## 参考

- `docs/plans/2026-07-27-infinite-canvas-staged-replacement.md`
- `docs/adr/0001-lightweight-internal-platform.md`
- `docs/adr/0004-single-node-persistent-generation-queue.md`
- `docs/canvas-migration-checklist.md`
- `docs/canvas-maintenance-boundary.md`
- `AGENTS.md`
