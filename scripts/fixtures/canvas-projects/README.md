# 旧画布项目合成脱敏样本（canvas-projects fixtures）

本目录是 Task 12「非破坏性旧项目导入」的测试样本，全部为**手工构造的合成数据**，
用于 `integrations/infinite-canvas/web/src/integrations/hajimi/legacy-project-import.test.ts`。

## 脱敏声明

- 所有样本均为合成构造：不来自真实数据库、不来自真实用户导出。
- 不包含真实用户名、token、完整提示词、付费响应或个人图片。
- 文本内容统一使用「占位」前缀的合成句子；模型名、taskId、文件名均为 `synthetic` 占位。
- 内嵌图片为脚本生成的 2x2 纯色 PNG（base64 内联，约 75 字节），不含任何真实图像内容。

## 旧格式证据来源（字段名以代码证据为准）

- `server.js` `normalizeWorkflowJson`（server.js:456）：项目 data 可能包裹在
  `workflowJson` / `workflowData` / `canvasData` / `workflow` / `data` 之下，需逐层解包；
  顶层可含 `nodes` / `edges` / `viewport` / `storage` / `thumbnail`（server.js:480-486）。
- `assets/canvas-project-restore-guard.js`：旧画布项目节点结构为
  `{ id, type: "text" | "imageConfig", position: { x, y }, data: { content, label, prompt, model, size } }`，
  连线结构为 `{ id, source, target, sourceHandle, targetHandle }`。
- `assets/Canvas-B8bY9_QL.js`（压缩 bundle，短上下文提取）：
  - 保存载荷为 `{ nodes, edges, viewport, storage, chatSessions }`，导出文件为 `*.workflow.json`；
  - 视口为 Vue Flow 形态 `{ x, y, zoom }`（`getViewport: () => ({ x, y, zoom })`）；
  - 图片节点 data 含 `url / taskId / label / model / loading / progress / progressLabel / error`；
  - `llmConfig` 节点 data 含 `outputContent`；聊天消息含 `{ id, role, text, status, cost, taskId, images, createdAt }`；
  - chatSessions 顶层会话含 `{ id, source, mode, projectId, createdAt, referenceImages, messages }`。
- 视口 `zoom` 映射为信封 `viewport.k`；旧格式没有 `backgroundMode` / `showImageInfo`，导入时使用默认值。

### 证据不足的假设（如实注明）

- chatSessions 的消息字段名来自 bundle 中 `appendChatModeMessage` 的参数形态，
  会话持久化到项目 JSON 时的精确子字段未逐字段核实；转换器按上述形态处理，
  无法识别的字段一律进 warnings 而不是猜测。
- 旧节点未持久化宽高（Vue Flow 运行时计算），导入时使用固定默认尺寸。
- 旧格式没有 `activeChatId`，导入后固定为 `null`。

## 样本清单

| 文件 | 构造内容 | 覆盖点 |
| --- | --- | --- |
| `empty-project.sanitized.json` | 空 nodes/edges，默认视口 | 空项目转换 |
| `text-and-image-nodes.sanitized.json` | `canvasData` 包裹；text 节点 + data:image 内联图片节点 | 解包、内联图必须先上传 |
| `generation-node.sanitized.json` | imageConfig 节点 + 带 taskId 与 `/uploads/` 结果引用的 image 节点 | 生成节点映射 |
| `connected-nodes.sanitized.json` | text → imageConfig 一条连线 | 连线映射 |
| `ten-nodes-nine-images.sanitized.json` | 1 text + 9 张内联小图 + 3 条连线 | 性能样本（Task 13 复用） |
| `legacy-chat-state.sanitized.json` | chatSessions + `storage` 字段 | 旧 Chat 状态、不可转换字段进 warnings |
| `unsafe-references.sanitized.json` | blob: URL、本机绝对路径、data:image 三类不安全引用 | 拒绝/剥离策略 |

## 禁止批量迁移

按 Task 12 Step 4：在全部 fixture 转换证据与人工验收通过之前，
**不得编写任何数据库批量迁移脚本**。旧项目只能在用户打开时显式确认后逐个导入，
原项目记录保持不变。
