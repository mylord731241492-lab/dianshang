# Chat 后台设置设计

## 目标

在源码后台增加 `/admin/chat-settings`，让管理员能够在不接触容器密钥、不触发真实模型费用的前提下，查看 Chat 部署状态、调整可热更新策略并运行内部连接测试。

## 配置边界

- Docker 管理：`ENABLE_LIBRECHAT`、`ENABLE_REAL_AI`、LibreChat/MongoDB 地址、内部服务密钥和 SSO TTL。后台只显示状态，不返回明文。
- 主站运行时管理：Chat 访问、文本对话、MCP 生图工具、允许文本模型和维护提示，保存到 `app_state` 的 `admin.chatSettings`。
- LibreChat 固定配置：私有 Skills 开放、用户公开分享关闭、外部 MCP 安装关闭。第一版只读展示，避免保存后需要重建却让管理员误以为即时生效。

## 数据流

1. 页面通过管理员 JWT 调用 `GET/PATCH /api/admin/chat/settings`。
2. SSO、模型桥接、Chat Completions 和 MCP 路由在每次请求时读取运行时策略。
3. `POST /api/admin/chat/test` 检查部署开关、密钥状态、运行时访问、模型数量和 LibreChat 内部 `/health`，不请求 Provider。
4. `POST /api/admin/chat/test-provider` 必须显式确认真实调用，按线路自动选择 Responses 或 Chat Completions，固定短提示词和最多 16 tokens，并返回响应、耗时、协议和用量。
5. 页面提供 `/chat/` 直达入口，方便保存后立即人工测试。

## 验收

- 保存、刷新和恢复原值可回显。
- 关闭访问时 SSO 返回 503；关闭文本或 MCP 时对应接口返回 403；恢复后完整集成 smoke 通过。
- 测试环境五项连接检查通过，桌面和 390px 无横向溢出，浏览器控制台无错误。
- 真实中转测试与 LibreChat SSE 桥接分别返回有效文本；Responses 线路会转换为 OpenAI Chat Completions/SSE。
- 正式 `3456` 不重建、不切换，不执行真实 Provider 或生图调用。
