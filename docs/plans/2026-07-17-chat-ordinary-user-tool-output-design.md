# Chat 普通用户生图工具展示设计

## 目标与边界

当前 `/chat/` 面向普通用户，但内置 `hajimi-website` MCP 的生图报价和执行结果仍使用 LibreChat 通用工具卡展示。用户会看到 `prepare_image_generation`、服务器名、Parameters 和原始 JSON；这些内容属于内部协议，不应成为产品正文。本轮只处理 `prepare_image_generation` 与 `execute_image_generation`，不改变其他通用工具、报价确认码、幂等、扣费、图片 Provider 或附件协议。

验收时，报价阶段只显示生成方式、模型、数量、参考图数量、预计算力、余额和确认语句；生成阶段只显示完成状态、消耗、余额和结果图片。用户不得看到 `quoteId`、`taskId`、`modelKey`、MCP 服务器名、工具参数或原始 JSON。

## 方案选择

方案一只修改 MCP 文本输出，仍会保留技术工具标题和参数入口，不符合普通用户产品。方案三新增专用报价组件，体验更强，但会引入新的前后端协议和较大维护面。本轮采用方案二：主站同时保留 `structuredContent` 供工具续传，另返回面向用户的中文 Markdown；LibreChat 只对两个内置生图工具替换通用工具卡。

页面始终保留已经完成的中文报价或图片结果，即使后续助手续接失败也不能隐藏确认码；只有尚未完成且已经离开当前步骤的状态提示可以隐藏。连续工具调用被分组时，跳过“使用了 N 个工具”的技术摘要。错误只显示普通用户可理解的重试提示，具体内部错误仍留在服务日志和协议层。

## 数据流与验证

主站 MCP 返回值继续包含完整 `structuredContent`，但 LibreChat 持久消息只保证保存普通用户 `content[0].text`，下一轮不能依赖模型读取内部 `quoteId`。`execute_image_generation` 因此允许只提交确认码，并在服务端按“当前用户 + 确认码哈希”定位 pending 报价。报价/结果工具续接由主站本地整理，明确的“确认生图 CODE”也由主站本地生成执行工具调用，不再二次依赖文本 Provider。生成完成文本使用站内 `/uploads/generated/*` 图片地址，不包含 Provider 外链或 Base64。

回归测试直接断言 MCP 可见文本包含中文报价/完成提示且不含内部字段；LibreChat 固定源码补丁通过静态断言、补丁应用、TypeScript/前端构建和浏览器 smoke 验证。生产发布必须同时完整重建 app 与 LibreChat，并确认四容器健康。自动验收只做报价或假 Provider，不执行真实生图。
