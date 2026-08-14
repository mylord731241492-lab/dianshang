# E2E CDP 验收测试

用本机 Chromium（CDP 驱动）对 `127.0.0.1:3468` 候选环境做端到端验收。每个 `tests/*.test.js` 独立可跑，`run-all.js` 统一调度。

## 前置

1. 启动本地候选服务（3468，`CANVAS_RUNTIME=infinite`）。
2. 本机存在 Chromium（默认 `%LOCALAPPDATA%/ms-playwright/chromium-1223/chrome-win64/chrome.exe`，可用 `E2E_CHROME` 覆盖）。
3. 测试账号 `test01 / test123456`（脚本自动登录）。

## 运行

```bash
node scripts/e2e-cdp/run-all.js                 # 免费测试全跑（默认）
node scripts/e2e-cdp/run-all.js --with-ai       # 含真实计费测试（生图/AI 工具，每个约 10-30 算力）
node scripts/e2e-cdp/run-all.js user-center-align superresolve   # 指定子集
```

## 环境变量

| 变量 | 默认 | 说明 |
| --- | --- | --- |
| `E2E_BASE` | `http://127.0.0.1:3468` | 被测服务地址 |
| `E2E_PROJECT_ID` | 各脚本内置 | 画布测试项目 |
| `E2E_CHROME` | playwright chromium | 浏览器路径 |
| `E2E_WORK_DIR` | 仓库 `.scratch/` | 截图与下载落盘目录 |
| `E2E_DB_PATH` | `.scratch/infinite-canvas-local/data/data.db` | 本地库（查账验证用） |

## 测试清单

免费（默认跑）：user-center-align（用户中心+选线）、ui-preferences（设置账号绑定）、predeploy-routes（SPA 路由+画布可达）、home-no-examples、copy-image、dblclick-preview、selected-ui、replace-image、node-drag、mention-verify、toolbar-local（工具栏本地工具）。

付费（`--with-ai`，文件头标 `// AI_COST: true`）：chain-generation（多图选图→链式下游生图+查库验证）、toolbar-ai（反推/局部编辑/擦除/扩图/放大/多角度）、superresolve。

## 约定

- 测试只操作本地 3468 测试库，不碰生产数据与 Docker。
- 截图落 `.scratch/` 供人工复核；视觉改动必须截图验收（见 `docs/review-log.md` 流程约定）。
