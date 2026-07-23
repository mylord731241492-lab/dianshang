# Chat 内网生产启用实施计划

## 目标

在不引入额外基础设施的前提下，把既有 Chat 测试方案固定为可迁移的单机内网生产栈：主应用、MongoDB、LibreChat 和 Nginx gateway 四个容器，共用 `http://服务器IP:3456`，主站路径不变，Chat 位于 `/chat/`。

## 固定边界

- 主站继续使用 Express + SQLite + bind mount。
- LibreChat 固定 `v0.8.6-rc1`、提交 `947bfa4c40e6b8c84346d23c1678cd83071c5179` 和现有局部补丁。
- MCP SDK 精确锁定 `1.29.0`，不使用范围版本。
- Chat 只允许主站一次性 SSO；关闭 LibreChat 邮箱登录、注册、找回密码和社交登录。
- 用户不能安装外部 MCP；网站生图 MCP 为内置能力，只允许 Docker 内部 `app:3456`。
- 保留私有 Skills，不开放公共分享。
- 不增加 Redis、Postgres、MinIO、搜索、支付或邮件。
- 今天的 Chat 生产数据视为验收数据；明天服务器首次启动使用全新 Chat 命名卷，不迁移测试聊天历史。主站 SQLite、工作流和图片仍完整迁移。

## 实施步骤

1. 把 `@modelcontextprotocol/sdk` 从 `1.17.0` 精确升级到 `1.29.0`，运行官方 npm audit、MCP 工具续接和生图工具回归。
2. 将固定 LibreChat 上游归档放入 `integrations/librechat/upstream/`，Docker 构建只使用项目内上下文，移除机器绝对路径依赖。
3. 为生产 smoke 增加复用现有管理员和跳过设置写入选项，避免污染主站业务数据。
4. 为 `docker/.env` 生成独立强随机 Chat 密钥，启用 Chat，并固定当前内网 origin 和统一 gateway 端口。
5. 先构建 app/LibreChat 镜像，再进行主站维护窗口备份，最后用 `chat` profile 与 production override 切换统一 gateway。
6. 验证四容器健康、主站原路径、`/chat/`、SSO、模型桥接、MCP 工具、Skills 中文资源、后台连接检查和生产数据不变。
7. 更新生产运行手册、迁移说明和当前基线；生成包含固定上游归档的最新版源码 ZIP。

## 验收标准

- `npm audit --omit=dev` 为 0 个已知漏洞。
- 四容器均为 `healthy`，宿主机只由 gateway 暴露 3456；app、MongoDB 和 LibreChat 不直接暴露端口。
- `/`、`/canvas`、`/user/center`、`/admin/*` 保持 200，`/chat/` 和 `/chat/c/new` 返回 LibreChat shell。
- 主站登录用户可通过一次性 SSO 创建 LibreChat 会话；票据不可复用。
- 用户级 MCP 可见 `prepare_image_generation` 和 `execute_image_generation`，错误内部密钥和错误用户映射被拒绝。
- 验收不调用真实文本或图片 Provider，不创建主站测试用户，不修改注册和兑换码逻辑。
