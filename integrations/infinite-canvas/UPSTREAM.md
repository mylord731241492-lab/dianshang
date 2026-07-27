# 上游来源记录（Infinite Canvas 候选）

## 固定来源

- 上游仓库：https://github.com/basketikun/infinite-canvas
- 固定 tag：`v0.10.0`
- 固定提交：`a0287a5e346e219bd488d084295542213912d816`
- 导入日期：2026-07-27

## 导入范围

- 仅导入 `web/` 运行源码（React 19 + Vite 前端），以及上游仓库根的 `VERSION`、`CHANGELOG.md`、`LICENSE`（另存为 `LICENSE.upstream`）。
- 明确排除：`canvas-agent/`、`plugins/`、`docs/`、`.github/`、`bun.lock`、`node_modules`、`dist` 及任何缓存目录。

## 许可说明

- 上游仓库 `LICENSE` 为 AGPL-3.0，全文见 `LICENSE.upstream`。
- 用户为上游联合作者并持有授权（2026-07-27 确认），该授权取代 AGPL 对本项目的约束；授权字段见 `PRIVATE-LICENSE-REFERENCE.md`。

## 版本约束

- 候选版固定上游 `v0.10.0`，不升级上游版本、不跟随上游 main；如未来确需升级，必须重新固定 tag/提交、更新本文件与依赖清单，并经用户确认。
