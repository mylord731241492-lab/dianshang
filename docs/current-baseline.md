# 当前项目基线与防混淆地图

> 最后更新：2026-07-22，北京时间。
> 当前提交基线：`main` 最新提交 `f72a9c9 feat: refine admin ui and canvas model sync`。

本文件是后续修改前的第一入口。`docs/progress-report.md` 和 `docs/review-log.md` 是时间线流水账，不是当前状态的唯一准绳。

## 当前准绳

- Git 基线：`f72a9c92e0a771baf1f1c3f8f974098c06992ddf`，提交时间 `2026-07-09 13:44:17 +0800`。
- 当前分支：`main`，相对 `origin/main` 为 `ahead 5`。
- 当前工作树：存在模板 UI、历史提示词复制和本轮 `/chat/` 集成等未提交改动；未跟踪目录 `workflows/` 仍不属于提交基线，纳入前必须先确认用途。
- 回滚前现场备份分支：`codex/backup-before-rollback-20260707-130326`。
- 回滚前未提交改动：`stash@{0}`，消息为 `pre-rollback-to-51d4dab-20260707`。
- 当前 Git 基线不自动代表 `http://192.168.0.39:3456/` 已同步。生产端是否命中本基线仍必须通过 Docker 重建、容器健康检查和内网 URL 验证确认，不能从 Git 状态推断。

## 阅读顺序

1. `docs/current-baseline.md`：先确认当前基线和哪些记录容易误导。
2. `AGENTS.md`：项目纪律、生产同步、测试和禁止事项。
3. `CONTEXT.md`：项目固定术语，尤其是“画布”只指当前唯一画布。
4. `docs/agents/`：agent 本地任务、标签和文档阅读约定。
5. `docs/api-contract-next.md`、`docs/api-contracts.md`：接口契约。
6. `docs/backend-module-boundaries.md`：后端后续拆分边界。
7. `docs/admin-ui-guidelines.md`：后台源码 UI 规范和复用组件边界。
8. `docs/canvas-maintenance-boundary.md`、`docs/canvas-migration-checklist.md`：当前画布边界。
9. `docs/internal-production-runbook.md`：生产 Docker 操作规则。
10. `docs/progress-report.md`、`docs/review-log.md`：只作为历史检索和复盘，不直接当作当前实现说明。

## 项目地图

按 `codebase-design` 的语言，本项目现在还不是深模块结构，而是几个大实现挤在一起：

| 区域 | 当前角色 | 修改规则 |
| --- | --- | --- |
| `index.html` | 旧打包 SPA 的入口 interface，负责挂载当前有效静态资源 query。 | 改入口必须同步评估首页、用户中心、后台和画布，并更新生产 smoke。 |
| `assets/` | 当前打包运行时和过渡 adapter，包含画布、桥接脚本和页面 chunk。 | 画布开发统一在当前画布链路中进行；禁止另起第二套画布。 |
| `frontend/` | Vue 3 源码壳和部分源码化页面，包含源码后台 `/admin/*`。 | 新源码改动必须走 TypeScript/build 验证；后台 UI 优先复用 `frontend/src/components/admin/` 和 `docs/admin-ui-guidelines.md`；不在这里另起第二套画布。 |
| `server.js` | Express + SQLite 单体 implementation，承载 `/api/*`、Provider、后台、项目和生图逻辑。 | 未确认模块边界前不拆文件；改后必须 `node --check` 和相关 smoke。 |
| `scripts/` | 验证 adapter 集合，包含当前 smoke 和历史专项脚本。 | 先确认脚本断言是否匹配当前入口 query；旧脚本失败不一定代表业务失败。 |
| `docs/` | 契约、边界、流水账和复核记录。 | 当前状态写到本文件或明确的边界文档；流水账只追加复盘。 |
| `docs/agents/` | agent 技能和本地协作约定。 | 只记录工作方式，不记录业务现状；业务现状仍回到本文件。 |

## `/chat/` 独立聊天集成状态

- 当前实现采用固定 LibreChat `v0.8.6-rc1`，上游提交 `947bfa4c40e6b8c84346d23c1678cd83071c5179`。固定归档已纳入 `integrations/librechat/upstream/LibreChat-0.8.6-rc1.tar.gz`，SHA-256 为 `ccc1adcbe0e7ab62839c2ab952bb2b3d6d7371eab8aaa13d84fbce4c629fb5ad`，来源与许可证记录在 `integrations/librechat/UPSTREAM.md`；构建不再依赖本机 `F:\dev-cache`。选择该 RC 是因为原生 `SKILL.md` Skills 从此版本加入；`v0.8.3` 不支持 Skills。
- 页面边界固定为：主站 `/`、`/api/*`、`/assets/*`；聊天 `/chat/*`；聊天 API 别名 `/chat-api/*`。聊天是独立 React 应用，不进入 `frontend/` Vue 工程，也不使用 iframe。
- 主站 `server.js` 已提供一次性 SSO、独立文本桥接、幂等计费和 MCP 生图报价/确认；原 `/api/chat/completions`、现有生图路由和画布契约继续保留。
- Docker 目标栈位于 `docker/docker-compose.yml` 的 `chat` profile；隔离测试栈为 `docker/docker-compose.chat-test.yml`，默认暴露 `3457`，也可用 `CHAT_TEST_GATEWAY_PORT` 改测试端口。正式切换时叠加 `docker/docker-compose.chat-production.yml`，清空 app 的宿主机端口并只让 gateway 暴露 `3456`。
- 2026-07-16 正式 `192.168.0.39:3456` 已切换到四容器统一网关：`dianshang-internal-gateway` 是唯一宿主机端口入口，app、LibreChat、MongoDB 不直接暴露宿主机端口，四个容器均为 `healthy`。当前 app 镜像为 `sha256:2c4396ad51ddd7bc3a52034cea16195d645356558af3f1bbe1dd5ea48070d74b`，LibreChat 镜像为 `sha256:82be11bb122de6b6a8b0db8c890a26729ace27e63ccc760072b06b99455edfda`。
- `@modelcontextprotocol/sdk` 已从 `1.17.0` 精确升级并锁定为 `1.29.0`；官方 npm registry 审计为 0 个漏洞，LibreChat 工具续接、Chat 图片工具和完整无费用集成回归均通过。
- 正式 Chat 使用主站账号一次性 SSO，LibreChat 自身邮箱登录、注册、社交登录和密码重置全部关闭。无写入生产设置的 API smoke 已验证 SSO 单次消费、会话创建、模型桥接、用户级 MCP 重连和两个生图工具；隔离浏览器已验证自动进入 `/chat/c/new`、4 个后台托管智能体、技能按钮与 Skills 区域，不发送消息、不调用 Provider、不扣费。
- 2026-07-17 已用最终源码 ZIP 和 `internal-prod-20260716-180342` 真实数据包在系统随机临时目录完成一次完整离线恢复：SQLite SHA-256 与清单一致，`quick_check`、`integrity_check` 均为 `ok`，恢复出 9 个用户、18 个项目、75 条生成记录、193 条余额流水、32 个上传文件和 22 个工作流，临时目录随后安全清理。本机 Docker Desktop/Engine 随后按用户要求重新启动，Engine 版本为 `29.5.3`；四个正式容器在 `2026-07-17T01:23:33Z` 至 `01:23:34Z` 启动并全部 `healthy`，只有 gateway 暴露 `3456`。生产只读 smoke 与隔离浏览器 Chat 自动登录验收通过。本机仍只有 `default`、`desktop-linux` 两个本地 context，没有远程服务器 context。
- 2026-07-17 正式 Chat 一笔 `gpt-5.5 /responses` 请求在上游 lingsuan 返回 HTTP 502 后已自动退回 5 点，账号余额恢复为 45；LibreChat 随后用同一消息 ID 自动重试，才显示了二次 409，实际没有第二次 Provider 调用。主站现已把 Provider HTTP 失败、超时、网络失败和无效格式统一转换为 HTTP 200 的中文“已自动退款”助手消息；已退款的同消息 ID 重放也只返回该消息，不再显示 409，不会再调用上游。假 Provider 回归已验证首次 502 + 同 ID 重试只命中一次上游，费用净变化为 0；本轮修复没有发送真实 Provider 请求。
- 本轮 Chat 修复发布前完成一致性备份 `docker/backup/internal-prod-20260717-111256`，随后按正式 Chat Compose 从主工作区完整重建 app。当前 app 镜像为 `sha256:0e521ae8e7ba160e1e6084c3c20860b0e74aa2b8249df9d2eb668b5e38b4bf08`，创建于 `2026-07-17T03:13:28.33862125Z`，容器启动于 `2026-07-17T03:13:47.933026439Z`。app、LibreChat、MongoDB、gateway 四容器均为 `healthy`；生产只读 smoke 通过，`127.0.0.1:3456` 和 `192.168.0.39:3456` 的首页、健康接口、`/chat/` 均为 200。本次只改 app 后端，无需强制刷新 Chat 静态资源；已经显示的旧错误消息不会被追溯改写，新发送的消息才使用新链路。
- 2026-07-10 已通过一次性本地测试库验证 SSO 单次消费、SSE、错误密钥、MCP 工具列表、生图报价/确认、生成历史和 mock 扣费链路。
- 2026-07-10 已完成 LibreChat `v0.8.6-rc1` 固定源码包 SHA-256 校验、Docker 镜像构建和隔离栈实跑。由于旧参考容器仍占用 `3457`，本轮网关使用 `3464`；app、MongoDB、LibreChat、gateway 均为 healthy，`/chat/`、`/chat/c/new`、Skills UI、一次性 SSO、模型桥接和 MCP 工具 smoke 通过。
- 简体中文补丁已覆盖 Skills 列表、创建、编辑、上传、权限、错误提示及相关无障碍标签；`3464` 当前显示“技能 / 创建技能 / 我的技能 / 暂无技能”，locale bundle smoke 负责防止以后回退英文。
- 主站登录回跳已在 `assets/chat-entry-link.js` 收口：仅接受 `/chat` 或 `/chat/*` 站内目标，使用 `sessionStorage` 暂存，登录拿到主站 token 后自动回到 `/chat/`。`3464` 浏览器实测未登录访问 `/chat/` 会进入 `login?redirect=/chat/`，登录成功后到 `/chat/c/new`。
- `3464` 浏览器已完成一轮 mock 文本对话，返回本地 mock 回复且未触发真实 Provider；用户 A 创建私有 `private-skill-a` 后，切换到用户 B 显示“暂无技能”，未看到用户 A 的技能，私有 Skills 跨用户隔离通过。
- 源码后台已增加 `/admin/chat-settings`：管理员可热更新 Chat 访问、文本对话、MCP 生图、允许模型和维护提示，并查看部署/Skills/密钥状态。连接测试只探测主站桥接与 LibreChat `/health`，不会调用模型或扣费。
- `3464` 已验证设置保存回显和恢复原值；关闭访问、文本、MCP 后对应 SSO/模型/MCP 接口分别返回 503/403/403，恢复后完整集成 smoke 继续通过。
- `3464` 已启用真实文本中转测试：后台 `gpt-5.5` 通过主站已配置官转线路的 Responses 协议返回 `OK`；LibreChat SSE 桥接也返回 `OK` 与 `[DONE]`，测试管理员幂等扣除 5 点测试算力并记录 `completed`。普通 smoke 不执行真实调用，付费 smoke 必须显式传 `-ConfirmPaidCall`。
- `scripts/start-librechat-real-test.ps1` 可从主站 `data.db` 只读加载已配置文本线路并重建 `3464`，无需复制或输出 API Key。
- Chat 后台浅色主题已局部覆盖 Naive UI 深色变量：输入/下拉为白底深色字和常驻边框，顶部提示、真实调用警告及多选模型标签均使用高对比度文字；集成 smoke 会检查生产 CSS bundle，防止重新退回白字透明框。
- `3464` 的 Docker 直连 Provider 曾间歇出现 `ECONNRESET: Client network socket disconnected before secure TLS connection was established`。主站现对真实文本 Provider 请求复用 keep-alive HTTPS 连接，并且只对“TLS 尚未建立”的该类重置最多重试两次；普通超时、HTTP 错误和已建立连接后的失败不会自动重放。2026-07-10 重建后，容器内 20 次无鉴权 HTTPS 探针全部完成 TLS 并返回预期 401，未触发 Provider 内容生成。
- 2026-07-13 用户在 `/chat/` 真实发送消息时出现 `400 status code (no body)`，根因是当时 Chat 预览账号余额为 0，而 `gpt-5.5` 每次需要 5 点；请求在调用 Provider 前被拒绝，没有新增扣费。LibreChat 集成接口现同时返回主站 `code/message` 和 OpenAI 标准 `error.message/type/code`，OpenAI SDK 已验证能显示明确中文错误，不再吞成 `no body`。用户随后明确授权通过 3464 后台接口给 `chatpreview1783664988609` 增加 10 点测试算力；正式 3456 数据未受影响。
- 充值后用户主动发送了两次真实消息；两次均到达 Provider，但 Provider Responses 返回内容未被当前转换器识别，主站均自动退款，余额保持 10。LibreChat 随后的同消息 ID 自动重试被幂等门禁拦截；3464 现会按 `refunded/completed/reserved` 返回明确的 409 原因，并在首次 Responses 格式异常时只记录脱敏响应结构，避免自动重试造成第二次 Provider 消耗。
- 用户随后主动完成第三次受控诊断，脱敏 shape 确认 Packy 返回 `status=completed`、`error=null`、`output=[]`，并非本地漏读已有文本；该次也已退款。3464 现把“HTTP 200 但 output 为空”转换为正常流式中文提示，明确本次已退款并建议输入具体问题，不再返回 502 触发 LibreChat 自动重试与 409。
- 最终人工验收确认同一账号和 `gpt-5.5 /responses` 线路存在间歇性差异：前一笔真实请求成功返回“收到。”、charge 状态为 `completed` 并扣除 5 点；下一笔“请只回复 OK”由 Packy 返回 `status=completed` 但 `output=[]`，charge 状态为 `refunded`，页面正常显示中文退款提示。当前测试余额为 5 点，证明主站账号映射、扣费、退款、SSE 展示和幂等保护均已工作；剩余问题是上游 Responses 线路偶发空输出，不能通过自动重试规避，否则可能产生重复 Provider 费用。
- 2026-07-13 再次真实测试前，测试库中的文本线路 Base URL 已被改为 `lingsuan.top/v1`（缺少协议头），因此请求在本地以 `Invalid URL` 失败并自动退款，未到达 Provider。Codex 仅发起一次请求 `manual-retest-1783917204270`；另有一笔更早的同类浏览器请求，二者均为 `refunded`，当前余额仍为 5。恢复测试前必须把 Base URL 改为与 API Key 对应的完整地址，例如 `https://lingsuan.top/v1` 或原 Packy 地址，且再次付费调用仍需确认。
- 用户随后明确提供 `https://lingsuan.top/v1`，3464 文本线路已通过现有后台 API 保存为该完整地址；模型仍为 `gpt-5.5`、接口仍为 `/responses`、线路启用，测试余额保持 5，本次未调用 Provider。数据库无费用检查同时确认该线路没有独立 `apiKey`，会回退使用全局中转 Key；切换到 lingsuan 后必须由用户在后台填写与该平台对应的线路 Key，不能直接沿用来源不明或 Packy 的全局 Key。
- 用户保存 lingsuan 线路 Key 并明确要求重新测试后，脱敏检查确认 `https://lingsuan.top/v1`、`/responses`、`gpt-5.5`、启用状态和独立 Key 均有效。Codex 只发送请求 `manual-lingsuan-retest-1783917466339`，上游 HTTP 200 返回 `OK`，usage 为 4686 输入、5 输出、4691 总 Tokens；charge 状态为 `completed`，测试余额从 5 扣至 0。由此确认 lingsuan 的真实文本中转、主站账号计费和响应转换已经打通。
- `hajimi-website` MCP 已改为 Chat 内置能力：`chatMenu: false` 隐藏聊天勾选项，LibreChat 后端在构建每次对话的临时 Agent 时强制合并该 MCP；侧栏“MCP 设置”和智能体“添加 MCP 服务器工具”也已由小型补丁隐藏。普通用户无需选择或管理服务器，模型仍可使用 `prepare_image_generation` 和 `execute_image_generation`；主站报价、下一轮确认码、余额与幂等门禁保持不变。
- 2026-07-13 首版内置 MCP 补丁曾在 `buildOptions` 中替换整个 `req.body`，导致上层中间件把 `endpointOption` 写回旧对象，页面报 `Endpoint option not provided`。现改为保留原请求对象并只更新 `req.body.ephemeralAgent`；`mcpSettings.allowedAddresses` 仅放行 Docker 内部 `app:3456`。3464 最新 LibreChat 镜像 `sha256:853fe7c27958e7c620e08b6503cfbd3f659a41cce57779b94120212649bc9c82` 已部署且 healthy。
- MCP 配置包含动态用户身份头，因此应用启动时共享连接显示 0 tools 不代表用户链路失败。无费用 smoke 现通过第二张一次性票据创建真实 LibreChat 会话，用户级重连返回 `oauthRequired=false`，并确认两个生图工具均可见；页面临时关闭文本桥接后的初始化探针返回预期 403，不再出现 `Endpoint option not provided`，测试设置已恢复，预览账号余额保持 100。
- 用户明确要求为当前 3464 预览账号增加 100 点后，已通过现有后台增量余额接口把 `chatpreview1783664988609` 从 0 调整为 100，流水为 `admin_adjust +100`，备注“3464 Chat 内置 MCP 人工验收充值”。本次充值未发送 Chat 消息、未调用 Provider，也未修改正式 3456 数据。
- 2026-07-13 首次真实 MCP 报价已成功调用 `prepare_image_generation`，但 Responses 第一步返回 `tool_calls` 后，旧实现过早把消息级文本扣费标记为 `completed`，导致 LibreChat 用同一消息 ID 提交工具结果时被 `409 CHAT_REQUEST_COMPLETED` 拦截，未进入最终报价回复，更未执行生图。现已增加 `chat_text_steps`：同一消息只扣一次文本费用，每个工具循环步骤按“模型 + 消息链”指纹幂等；返回工具调用时只完成步骤，最终回复后才完成消息，完全相同的步骤即使改变 SSE/温度参数重放也仍返回 409。临时数据库 + 假 Provider 回归已验证“工具调用、工具续传、最终回复、单次扣费、重复续传拦截”；3464 app 镜像 `sha256:454aea5749b17ffaa31739e022d15ce31f0bafc5f84e29582641ea0c68dabbf1` 已重建并 healthy，完整 Chat smoke 和旧 API disposable smoke 通过。测试账号余额保持 95，旧报价已过期，真实图片执行仍待用户新开消息按报价确认，正式 3456 未切换。
- 上述 app 重建曾直接运行测试 Compose，因 `CHAT_TEST_ENABLE_REAL_AI` 的安全默认值为 `false`，3464 一度回退到 Mock 并向用户显示“本地 mock 回复”。该 Mock 消息没有新增扣费，账号仍为 95。现已重新使用 `scripts/start-librechat-real-test.ps1 -Port 3464` 从主站数据库只读加载已保存文本线路，运行容器确认 `ENABLE_REAL_AI=true`、Provider Base/Key 已配置，四容器 healthy，完整无费用 Chat smoke 通过。后续真实测试栈重建必须使用该脚本，不能直接用未设置环境变量的 Compose 命令覆盖运行模式。
- 2026-07-13 Chat 文生图/图生图链路已完成两项根因修复：LibreChat 实际图片目录 `/app/client/public/images` 现在使用独立持久卷，当前第二张上传图已迁移并在强制重建容器后通过 SHA-256 一致性验证；LibreChat 同时会把当前消息附件路径作为服务端动态 MCP 头传给主站，报价自动识别有无参考图，并分别路由到 `/images/edits` multipart 图生图或 `/images/generations` JSON 文生图。此前已经丢失的第一张附件无法从空目录恢复，后续重新上传即可。
- 新增 `scripts/test-chat-image-generation-tools.js`，使用临时 SQLite、假 Provider 和本地 PNG，无费用覆盖文生图、图生图、报价、下一轮确认、20 点分两笔扣费、生成历史、报价完成状态及接口分流；该测试与工具续接回归已接入完整 Chat smoke。`3464` 当前 app 镜像为 `sha256:33245c9a762255c2099ae021d4621a07c2713e6faef4a07549c9845daebd3187`，LibreChat 镜像为 `sha256:ab43fc0982b9378fab41b925d98db844ca83ade8f0f3f243d23207b42e905e92`，app、LibreChat、gateway 均 healthy。
- 用户最近一次真实图像对话在文本 Provider 阶段返回 `Concurrency limit exceeded for account`，对应文本预扣已自动退款；测试账号 `chatpreview1783664988609` 当前余额为 95。本轮修复和验收没有调用真实 Provider，也没有执行真实文生图或图生图；下一次人工验证必须发送新消息，不能重试已退款消息 ID。
- 用户随后在原消息“左右拉长”上再次生成，旧 Responses 转换器把上游 `image_generation_call.result` 当作普通文本，LibreChat 因而显示约 247 万字符的 `iVBOR...`。现有数据无费用解码确认它是一张 1326×1187、约 1.86 MB 的 PNG 促销手举牌，文字为“源头工厂直发 / 7天无理由 / 运费险保障”；这说明上游已经生成图片，但绕过了主站报价、图片计费和历史记录。该旧请求只完成 5 点文本扣费，测试账号当前余额为 90，Codex 未擅自调整余额。
- Responses 桥接现会识别生图和带附件编辑意图，强制调用网站 `prepare_image_generation`；确认码消息强制调用 `execute_image_generation`。进入网站生图流程后，文本 Provider 只收到“附件由工具读取”的占位说明，不再接收图片字节；任何上游原生 `image_generation_call` 兜底结果都会被丢弃并自动退款，Base64 不再进入 Chat。
- 图片 Provider 的 `b64_json` 也已收口：主站校验 PNG/JPEG/WebP/GIF 文件签名后写入持久化 `/uploads/generated/`，MCP 和 `generations` 只保存短 URL。临时数据库 + 假 Provider 回归已验证字节一致、聊天无 Base64、报价工具调用、上游绕过退款、文生图/图生图分流、扣费和历史记录。
- 2026-07-15 lingsuan 图片线路曾先采用线路级 SSE 过渡配置，不再根据 `lingsuan.top` 域名自动切换机制。该旧版本为 `b64_json / true / 0`，Packy 为 `url / false / 0`；共享解析器兼容 JSON 与 SSE，只接受最终事件，不把 partial 预览当成成品。最终 Base64 先校验比例和文件签名，再写入 `/uploads/generated/`。HTTP 200 空图返回 `PROVIDER_IMAGE_EMPTY_BILLED_RESPONSE`，本地不扣算力、不写历史且禁止自动重试。
- 上述 SSE 过渡版曾完整重建到正式 3456：镜像 `sha256:f2300589cb0ff65753603c3be7b0cd88ed13820775b164861bd46e00703a8cc2`。该部署记录只代表 2026-07-15 的旧生产状态，不能再作为 `lingsuan-images` 官方非流式规则已上线的证明。
- 用户明确确认后执行了一次受控 lingsuan 图生图诊断：请求只发送 `ratio=1:1`、`quality=high`，明确省略 `size`，保留 `stream=true / partial_images=0 / response_format=b64_json`，并禁用重试。上游 HTTP 200、SSE 依次返回 partial 和 completed，耗时 102687ms，最终原始 PNG 仍为 `1254×1254`、1939841 字节。结合此前 `2048×2048 + medium` 和 `2880×2880 + high` 两笔真实请求也都返回 `1254×1254`，确认当前 lingsuan 线路不会通过比例和质量自动推导大尺寸，也不是本地 `size` 参数或落盘缩放造成。本次直连不会扣本地用户算力，但上游可能记录一笔真实费用；全程只发一次且未重试。
- 用户再次明确确认后，按 OpenAI 官方 Image Edit 格式执行一笔 4K 对照：`POST /v1/images/edits`，multipart 仅含 `model/image[]/prompt/size=2880x2880/quality=high/output_format=png/n=1`，完全移除 `stream/partial_images/response_format/input_fidelity/ratio/background/moderation`。上游以普通 JSON 返回 `data[0].b64_json`，耗时 60985ms，原始 PNG 为 `2880×2880`、7534579 字节，证明 lingsuan 能兑现真实 4K；此前 `1254×1254` 来自流式/扩展请求方式，而非本地压缩。该对照只发一次、未重试、未扣本地用户算力；生产线路尚未切换到官方非流式格式。
- 2026-07-16 主工作区已实现并部署独立 `apiFormat=lingsuan-images`：不识别域名；固定 `/v1/images/generations`、`/v1/images/edits`、非流式 JSON/Base64；图生图使用 `image[]`；出站白名单移除 `stream/partial_images/response_format/input_fidelity/ratio/background/moderation`。后台接口格式下拉已增加 `Lingsuan Images`，选择后锁定接口、返回格式和流式开关；后端新增/编辑/批量保存都会规范化冲突字段。假 Provider 抓包验证 4K 方图为 `2880x2880 + high` 且字段集合严格正确，Packy 仍为 URL 非流式。`node --check`、适配器覆盖、图片工具动态回归、54 组尺寸映射、disposable API smoke、后端画布边界、Vue build 和后台 Playwright 保存回读均通过，未调用真实 Provider，未修改注册或兑换码实现。生产数据先备份到 `docker/backup/internal-prod-20260716-095040`，随后完整重建镜像 `sha256:840f25b0f1235ad595e489474f9c4477e3608ffa29eb5a033bb762f41e2986fe`（创建 `2026-07-16T01:52:55.225127908Z`，容器启动 `2026-07-16T01:53:57.827614075Z`）并确认 `healthy`。生产 lingsuan 线路已通过后台 API 切换和回读，Base URL、模型、线路 Key、密钥存在状态保持不变，Packy 未变；3456 公开元数据、新后台 chunk 和旧 chunk 404 均通过。未点击线路测试、未调用真实 Provider。
- 3464 最终 app 镜像为 `sha256:89ddba21361b573ee7f3aa1968da20c9a01e6a078b1ec505c1a5efb2fe09b588`；app、LibreChat、gateway 均 healthy，完整集成 smoke 重跑通过。正式 3456 首页和健康接口仍为 200，本次没有再次调用真实 Provider。
- 2026-07-13 Chat 首页已增加“智能体 / Skills”工作区：主站后台 `/admin/chat-settings` 是托管智能体唯一配置入口，可新增、编辑、启停和删除，普通用户侧不开放 LibreChat 原生智能体创建入口。默认提供电商主图设计师、商品详情页策划、小红书种草助手和促销海报设计师；点击后复用 LibreChat 原生临时智能体、系统指令、Skills 与内置网站生图工具，Skills 卡片与输入框技能按钮共用同一待提交队列。
- 新增登录用户接口 `GET /api/chat/home-catalog`，只返回后台已启用且模型已开放的智能体定义；Provider Key、MCP 密钥和 MongoDB 信息不进入响应。3464 已完成干净上游补丁重放、LibreChat 完整前端编译、四容器健康检查、完整无费用集成 smoke 和浏览器选择交互验证，未发送模型或生图请求；正式 3456 未切换。
- 正式 `3456` 已切到统一网关；普通 Chat 验收仍默认禁止真实文本或真实生图调用，只有用户明确发起或显式确认的消息才允许进入 Provider 和现有计费链路。
- npm 缓存固定为 `F:\dev-cache\npm`，pip 缓存固定为 `F:\dev-cache\pip`；Docker WSL 数据通过 junction 从 `%LOCALAPPDATA%\Docker\wsl` 指向 `F:\DockerDesktopData\wsl`。迁移后原容器、镜像和数据卷均保留，Docker 构建缓存已清理，C 盘空闲约 36 GB。
- 主站直连模式下访问 `/chat/` 不再落入 Vue SPA 形成空蓝屏：`server.js` 会返回 503 聊天启动提示页；`/chat`、`/CHAT` 和 `/CHAT/` 统一 308 到 `/chat/`。统一网关上线后 `/chat/*` 会在到达 app 前由 LibreChat 接管。

## 后台源码 UI 当前约定

- 后台源码页面只指 `frontend/src/views/Admin*Source.vue` 和 `frontend/src/components/AdminSourceSidebar.vue`，不包括当前打包资产里的旧后台。
- 视觉和交互规范以 `docs/admin-ui-guidelines.md` 为入口：8px 圆角、浅色工作台、高密度列表、明确状态色、统一工具栏、统一空态/错误态/加载态、危险操作二次确认、移动端无横向溢出。
- 共用展示组件集中在 `frontend/src/components/admin/`；组件只封装布局和展示，不直接调用 `/api/admin/*`，业务页面继续保留原有请求函数、确认弹窗、表单字段和写入逻辑。
- 后台导航配置集中在 `frontend/src/config/adminNavigation.ts`；路由仍以 `frontend/src/router/index.ts` 为准，不因导航配置新增后台路由。

## 当前入口资源

当前入口及画布相关资源版本：

- 当前主入口：`/assets/index-DglIsp_g.js?v=20260714opperf4`
- 当前 Canvas 动态 chunk：`/assets/Canvas-B8bY9_QL.js?v=20260714opperf4`
- 当前 Canvas 内用户抽屉 chunk：`/assets/ImageHistoryPanel-Dy2o3dPV.js?v=20260709historycopy1`
- 当前 Canvas 项目数据 chunk：`/assets/projects-BtxGnToV.js?v=20260714opperf4`
- 当前 Canvas 图片预览运行时：`/assets/canvas-image-preview-runtime.js?v=20260714opperf4`
- 画布辅助 JS：`canvas-performance-mode.js?v=20260704canvasleave1`
- 图片节点辅助 JS：`canvas-image-node-polish.js?v=20260708loadguard1`
- Canvas Chat 辅助 JS：`canvas-chat-prompt-flow.js?v=20260704canvasleave1`
- 画布性能 CSS：`canvas-performance-mode.css?v=20260704usercenter1`
- 图片节点抛光 CSS：`canvas-image-node-polish.css?v=20260721promptread1`

后续如果改静态资源 query，必须同时更新生产 smoke 和最终汇报里的生产命中结果。

## 2026-07-14 画布操作延迟优化与单页验收

- 优化范围只覆盖当前 `/canvas` 的本地操作、历史快照和浏览器持久化，不涉及中转、Provider、模型响应或付费调用。
- `assets/Canvas-B8bY9_QL.js` 的画布状态快照不再通过 `JSON.stringify/parse` 复制 Base64 图片字符串，改为保持 JSON 语义的递归结构克隆；历史初始化、历史入栈、分组操作和撤销恢复统一复用该克隆。
- 普通拖拽与 Alt 拖拽结束后改走现有 800ms 合并保存，松开指针时不再同步保存整份项目；离开画布、切项目和卸载时仍保留立即保存兜底。
- 节点拖拽和视口变化只写轻量布局补丁；浏览器本地项目库不再因每次节点移动、平移或缩放立即重写整份工作流，完整保存和删除会同步清理布局补丁。
- `assets/projects-BtxGnToV.js` 移除了 `e.map(mt)` 之后的第二次 JSON 深拷贝；`mt/ft` 现有清洗与 JSON 数据格式不变。
- 同规模 9 张图片、约 65.15MB 文本载荷基准中，旧 JSON 深拷贝中位耗时 140.69ms、瞬时堆增量约 195.45MB；新结构克隆中位耗时 0.04ms、堆增量约 0.02MB。
- 当前生产镜像 `sha256:6813e03c38d389c39f7e221264352225e1bc14561c9475c0120d68b1bcab9bd4` 已完整重建，`dianshang-internal-app` healthy，`scripts/smoke-internal-prod.ps1` 通过；3456 已命中 `opperf4` 入口、Canvas、项目数据 chunk 和图片预览运行时。
- 单页 Playwright 复测使用 10 节点、9 张 2528×1696 图片、80% 缩放：拖拽往返、平移往返和缩放往返均精确复位；操作期间长任务为 0，最终通过轮松手后稳定耗时为 24.22–39.28ms，保存定时器漂移约 1ms，无页面错误或控制台错误。
- 复测从首次导航前拦截项目写入和生成请求；服务端项目数据与 `updated_at` 前后完全一致，没有调用中转或模型接口。
- 本轮没有调用真实中转或模型接口，没有产生 Provider 费用。

## 2026-07-14 画布大图常驻内存优化

- `assets/projects-BtxGnToV.js` 在项目从 IndexedDB 或本地摘要恢复后，对长度超过 1024 的 `data:image/*`、Base64 和 mask 大字符串执行本次加载作用域内的引用归一；同一图片的 `url/imageUrl/originalUrl/thumbUrl/thumbnailUrl/base64` 等别名复用一个字符串值，不设置跨项目或全局常驻缓存。
- 去重只调整浏览器内存引用，项目 JSON 序列化结果前后完全一致，不改变工作流格式、图片内容、服务端存储或自动保存边界；不同图片不会合并。
- 同一生产项目、同一浏览器配置、9 张 2528×1696 图片、每张 6 个别名的强制 GC 对照：`Runtime.getHeapUsage.usedSize` 从 `210175460` 字节（约 200.44MiB）降至 `20717148` 字节（约 19.76MiB），减少约 90.14%；9 张图片仍全部解码，DOM 节点 4916、事件监听器 2306，前后不变。
- Playwright 重新真实命中可见节点：拖拽前进/复位稳定耗时 38.68/38.56ms，平移前进/复位 38.97/35.80ms，缩放往返 24.49ms；三类操作均准确复位、长任务为 0，生产项目 `data` 和 `updated_at` 未变化。
- 图片解码位图、浏览器图片缓存与 GPU 显存不计入 JS 堆；因此任务管理器仍可能显示较高进程内存。本轮已消除可证明的 JS 字符串重复，未迁移图片资产格式，也未调用中转或模型接口。

## 2026-07-14 画布 1024px 预览与解码资源治理

- 当前图片资产索引支持 `previews.w1024` WebP；旧素材有 `w500` 时直接复用。图片节点常态加载最长边不超过 1024px 的运行时预览，选中、编辑、下载或 `forceOriginal` 时临时使用原图。原有 `url/imageUrl/originalUrl/assetId/localFileName`、工作流 JSON 和自动保存格式均未改变。
- 内联 Base64、`/uploads` 和代理图片由 `assets/canvas-image-preview-runtime.js` 生成 WebP 预览；GIF、SVG、小图和转换失败继续回退原图。预览池最多并发转换 2 张、最多保留 24 个闲置项、闲置 30 秒回收；离开 `/canvas` 会撤销 Object URL 和定时器，900 画布单位预加载边界外会释放节点引用。
- 固定 10 节点、9 张 2528×1696 图片复测中，9 张常态图片均为 1024×687 Blob 预览，估算解码像素内存为 25,325,568 字节（24.15MiB），低于 35MiB；强制 GC 后 JS 堆为 16,972,388 字节（16.19MiB），低于 30MiB。选中单张会切换到 2528×1696 原图，取消选中 31.43ms 恢复预览；离屏后引用数归零，Fit View 返回后 145.53ms 恢复。
- 操作回归通过：拖拽、平移、缩放均准确复位，稳定耗时 23.25–35.26ms，操作期超过 150ms 的长任务为 0；生产项目 `data` 与 `updated_at` 前后不变，生成请求全部拦截。
- 严格进程内存门禁未通过，当前不能宣称整个内存优化目标完成：Renderer + GPU 私有内存中位数由稳定基线 776.05MiB 升至 1267.52MiB（+63.33%），Working Set 由 1042.90MiB 升至 1425.94MiB（+36.73%），未达到下降 30%。已按计划保留当前版本并采集 `output/playwright/canvas-memory-infra-trace.json.gz`；轨迹显示强制 GC 后 Renderer allocator-accounted private footprint 约 223MiB，但 `cc/image_memory` 仍约 58.40MiB，并保留两个约 16.36MiB 的原图光栅缓存项。Windows 进程私有内存还受 Chromium/PartitionAlloc 保留区影响，不能用像素和 JS 堆改善替代该门禁。
- 生产已完整重建镜像 `sha256:6813e03c38d389c39f7e221264352225e1bc14561c9475c0120d68b1bcab9bd4`，容器 healthy；`/`、`/canvas`、`/user/center` 直连、资源哈希、当前资源命中和旧资源 410/404 均通过。现有画布标签需刷新一次以加载 `opperf4` 并释放旧解码缓存。本轮未调用中转、Provider、模型或付费接口。

## 2026-07-15 上线安全阻塞修复与生产发布

- 用户已确认当前仅做小范围内网分发，普通用户找回密码改为凭 `username + newPassword` 直接重置，不再走邮箱和验证码；新密码至少 6 位，管理员账号拒绝公开重置。旧 `POST /api/auth/send-reset-code` 统一返回 `410 RESET_CODE_FLOW_DISABLED`，不再生成任何重置码。注册与兑换码实现、配置和数据均未修改。
- 当前前台通过 `assets/auth-direct-register-bridge.js?v=20260715directreset1` 将旧登录弹窗的找回密码表单收口为用户名、新密码、确认密码；邮箱和验证码控件被禁用并隐藏。该方案的账号冒用风险已由用户接受，但不得直接用于公网。
- `/api/proxy-image` 新地址改为服务端 HMAC 签名；未签名任意目标返回 `403 IMAGE_PROXY_FORBIDDEN`。目标及每次重定向都执行协议、端口、DNS 和私网/特殊用途地址检查，只允许常见光栅图片，并以流式读取限制最大响应体，避免 SSRF、重定向绕过和无界内存占用。
- 历史兼容不从用户可写项目数据签发代理权限。生产库只读审计为 `quick_check=ok`：4 个项目和 35 条生成记录含旧代理地址，项目内 49 处旧目标全部能在真实生成记录中找到来源；这些目标继续走无签名兼容集合和完整地址安全检查，生成历史响应会升级为签名 URL，按签名 URL 删除旧记录仍可匹配。
- `scripts/backup-internal-prod.ps1` 改为显式 `-ConfirmMaintenanceWindow`：短暂停止应用后调用 `scripts/backup-sqlite.js` 使用宿主机 `better-sqlite3` backup API 备份，执行 `quick_check/integrity_check`，再恢复原运行状态并等待健康。未确认维护窗口时脚本拒绝执行。
- 新增 `scripts/test-launch-security-guards.js` 与 `scripts/test-sqlite-backup.js`：前者用生产临时库验证重置码泄露关闭、未签名代理拒绝、内网/localhost 拒绝、项目签名 oracle 关闭、旧生成记录兼容和删除路径；后者验证备份数据库两项完整性检查及 25 行数据一致。当前专项测试、语法检查、一次性 API smoke、backend/canvas boundary smoke、Provider TLS 重试/适配器覆盖、备份脚本 PowerShell 解析和维护窗口拒绝门禁均通过。
- 用户已确认把当前工作区全部改动一起发布。生产一致性备份位于 `docker/backup/internal-prod-20260715-100024`，数据库 `quick_check=ok`、`integrity_check=ok`，维护窗口约 10.3 秒并恢复 healthy。`app` 已按强制重建门禁发布为镜像 `sha256:73e9e0eea09d2d3d890ac6a12d65d8f07b7c3047fb2b124c4e905d4999be80cf`，镜像创建时间 `2026-07-15T02:01:50.979150879Z`，容器启动时间 `2026-07-15T02:03:13.959364319Z`，当前 healthy。
- `scripts/smoke-internal-prod.ps1` 已在 `http://192.168.0.39:3456` 通过；`/canvas`、`/user/center`、`/admin/login` 直连均为 200，旧入口资源继续返回 410/404。线上首页命中 `auth-direct-register-bridge.js?v=20260715directreset1`，旧重置码接口返回 `410 RESET_CODE_FLOW_DISABLED`，账号直重置缺字段契约返回 `400 RESET_FIELDS_REQUIRED`。隔离浏览器确认线上找回密码只显示用户名、新密码、确认密码，控制台 0 错误。本轮未调用真实 Provider 或产生费用。

## 2026-07-15 Windows Docker 迁移准备

- 后续服务器目标已固定为 Windows Server + Docker Compose；当前阶段继续使用 SQLite 和 bind mount，不新增 Postgres、Redis、MinIO/S3 或备份软件。
- `scripts/backup-internal-prod.ps1` 已升级为格式版本 2 的便携数据包：SQLite、`docker/data` 中的工作流、`docker/uploads` 图片和 `docker/logs` 在同一短停机窗口采集，清单只使用相对路径并记录字节数、SHA-256 与数据库完整性结果。
- 真实 `docker/.env` 不写入数据包，只记录 SHA-256；迁移时必须通过单独安全渠道复制同一份配置。源代码目录也与数据包分开复制。
- 新增 `scripts/restore-internal-prod-windows.ps1`：默认只恢复到空的 `data/uploads/logs`，拒绝覆盖、包篡改、ZIP 越界路径、`.env` 指纹不一致和损坏 SQLite；默认不启动 Docker，显式 `-StartApp` 才构建并等待健康。
- `scripts/test-windows-server-migration.ps1` 已在系统临时目录完整通过，覆盖数据库 3 行数据、工作流 JSON、图片 SHA-256、日志内容、`.env` 指纹不匹配写入前拒绝、重复恢复拒绝和篡改包拒绝；没有停止或修改当前 3456 生产容器，也没有调用 Provider。
- 当前所谓“云端图片”仍是服务器本地文件 `docker/uploads`，其 URL/生成元数据位于 SQLite，迁移和备份必须两者成对处理。用户已确认内部数据量较小，备份只保留在本机 `docker/backup`，不配置云盘、NAS、S3/MinIO 或自动异地同步；迁移服务器时再人工复制选定数据包。
- 可选 Chat profile 的 MongoDB 和 LibreChat 命名卷不属于当前主站迁移包；正式启用并产生需保留数据后必须另做卷级迁移。
- 该决策记录在 `docs/adr/0003-windows-docker-portable-data-migration.md`，服务器步骤见 `docs/internal-production-runbook.md`。本轮仅修改脚本和文档，未重建当前生产 Docker。

## 2026-07-15 图库入口与生成图片本地持久化

- Playwright 独立浏览器确认正式 `/gallery` 曾返回 200 但 `RouterView` 为空；根因是服务器只让 `/admin/*` 使用 `frontend/dist`，图库仍落入没有 `GallerySource` chunk 的根旧入口。`server.js` 现只额外把 `/gallery` 分发到源码入口，首页、画布、注册和兑换码路由不变。
- 正式图库现命中 `/assets/index-DmNWOEif.js` 与 `GallerySource-BFlvOHL9.js`，10 条历史记录均有卡片；3 张现存图片正常显示，7 张早期 Packy 外链的上游源站已直接返回 404，无法从现有数据恢复。页面会明确显示“历史图片源已失效”，不改写或删除历史记录，并移除了指向访问者本机 `127.0.0.1` 的错误旧版链接。
- 继续审计发现旧实现只对 `b64_json`/Base64 落盘，Provider 返回 HTTP(S) URL 时仍把外链写入 `generations.result_url`，正是旧图失效的根因。现在全部现有文生图、图生图、画布 Agent、异步任务和图片编辑调用点都会在写库或返回前下载远程图，复用 DNS/私网/端口/重定向/类型/大小门禁，并按 SHA-256 去重写入 `/uploads/generated/`；任何未落盘的 HTTP(S) 图片都被硬门禁拒绝写入历史。
- `readProxyImageBody` 同时支持 Web Stream 和当前 `node-fetch` 的 Node Stream，20 MiB 默认/30 MiB 上限不变。无费用假 Provider 回归同时覆盖 Base64 与 URL 返回，确认落盘字节一致、MCP/图片工具/`generations` 只返回本地短 URL、文生图/图生图两笔计费和历史正确；安全代理专项与一次性 API smoke 均通过。
- 最终生产镜像为 `sha256:f15acd6c47de5d45314f100059624343f8dbefec0f5a82e698d23cb313907f22`，镜像创建时间 `2026-07-15T03:41:03.868251117Z`，容器启动时间 `2026-07-15T03:42:29.925239199Z`，当前 healthy。`scripts/smoke-internal-prod.ps1 -ReadOnly` 通过并跳过兑换码增删；本轮没有真实 Provider 调用或费用，注册和兑换码实现未修改。
- `/chat/` 仍按当前基线返回 503 启动提示，因为正式 3456 尚未切统一 Chat 网关；本轮未启用新的 Docker 服务。

## 容易混淆的历史

- 2026-07-06 到 2026-07-07 的回滚前实验不能整体当作当前事实；只有已经进入 `f7a036b` 和 `0fd4453` 等当前 `main` 最新提交链的改动，才属于当前基线。
- 当前基线已包含画布生图链路稳定化、Provider 适配对齐、刷新恢复、图片加载中 UI 兜底和画布用户中心兑换刷新修复；未进入最新提交的历史实验仍只存在于备份分支、stash 或历史流水账中。
- CodeGraph 当前索引在回滚后仍可能列出已删除的独立画布重建方案源码路径，例如 `frontend/src/views/CanvasStudio.vue`、`frontend/src/stores/canvas.ts` 和 `frontend/src/types/canvas.ts`；`Test-Path` 与 `git ls-files` 已确认这些路径当前不存在。后续结构分析前应先确认或刷新 CodeGraph 索引。
- 后续文档和汇报统一使用“画布”或“当前画布”，不要再把当前开发对象写成两套画布。
- `scripts/verify-canvas-performance-assets.js` 已同步到当前生产资源版本，并与新的 `scripts/verify-canvas-operation-performance.js` 一同通过。
- `assets/` 内存在多组 hash chunk 是历史缓存隔离和旧入口兼容结果，不能因为看起来重复就直接删除。
- `docs/progress-report.md` 和 `docs/review-log.md` 体量很大，里面的“已完成”“已验证”必须结合对应日期和当前 Git 基线判断。

## 后续修改门禁

- 开始任何代码修改前，先说明本轮目标是否仍基于当前 `f72a9c9` 提交基线及工作树中的用户改动。
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
## 2026-07-14 生图 Provider TLS 握手前断开重试

- `server.js` 已对图片生成和图生图 Provider 请求增加精确、有限的安全重试：仅匹配 `Client network socket disconnected before secure TLS connection was established`，最多重试 2 次，退避 400ms/800ms。
- 普通 `socket hang up`、请求超时、业务 4xx/5xx 不自动重试，避免请求可能已送达后造成重复生图或上游重复扣费。
- multipart 图生图每次重试都会重新构造 `FormData`，不会复用已消费的请求体。
- `3464` 测试 App 已重建为镜像 `sha256:48301f183641c7fe3be5f094858ca25a293ff170fbd7e66d94c7a389cda872d6` 并通过完整集成 smoke；正式 `3456` 尚未重建，当前生产行为仍为修复前版本。

## 2026-07-15 明日 Windows Docker 上线门禁收口

- Dockerfile 已改为多阶段构建：`frontend-build` 固定从 `frontend/package-lock.json` 执行 `npm ci`、TypeScript 检查和 Vite build，运行镜像再复制 `/build/frontend/dist`。`.dockerignore` 同时排除任意层级 `node_modules` 与宿主机 `frontend/dist`；使用 `--no-cache` 的干净镜像构建已通过，镜像内确认存在源码生成的 `frontend/dist/index.html`，且不存在根 `.env` 或 `docker/.env`。
- 新增 `scripts/package-internal-prod-source.ps1` 与安全回归：从当前完整工作树生成带 `release-manifest.json` 的源码 ZIP，每个文件记录字节数和 SHA-256；包内排除密钥、SQLite、uploads、logs、backup、Git、缓存、依赖和宿主机构建产物，避免迁移时手工挑文件漏改动。
- 后台不再显示不可追溯的推算数据：今日用户/生成按 SQLite 当日记录计算；历史生成没有线路字段时 `routeUsage.available=false` 且列表为空；支付关闭时订单 GET 返回 `available=false` 和空列表、状态修改返回 `409 PAYMENT_DISABLED`；任务历史不再伪造默认线路、1024×1024、standard、0 张参考图或 `local-mock` 队列模式。
- 管理员重置用户密码仍要求显式新密码，但成功响应不再回显明文密码。普通用户账号直重置、注册和兑换码契约均未改变。
- 新增公开只读 `GET /api/chat/status`。当前 `ENABLE_LIBRECHAT=false` 时首页侧栏不展示 AI 对话入口，直接 `/chat/` 继续返回明确 503；正式统一 Chat 网关和命名卷仍未切入 3456。
- 新增 `scripts/test-internal-production-launch-gates.js`，并更新生产只读 smoke 的 Chat 状态/资源版本断言。语法、前端构建、上线门禁、安全专项、一次性 API、画布边界、生图本地持久化、源码包和 Windows 恢复演练均通过，未调用真实 Provider。
- 生产 app 已完整重建为镜像 `sha256:0ee3306d842471e418c1265e91f7dbe5d38060dc87db1f6e557dd40be255f065`，镜像创建时间 `2026-07-15T04:31:50.782731494Z`，容器启动时间 `2026-07-15T04:34:25.441593209Z`，当前 healthy。`/`、`/canvas`、`/user/center`、`/gallery`、`/admin/login`、`/api/health`、`/api/chat/status` 均为 200，`/chat/` 为预期 503；生产 `smoke-internal-prod.ps1 -ReadOnly` 通过，没有增删兑换码。
- 隔离浏览器确认首页侧栏没有不可用 Chat 入口；Dashboard、订单页和任务页分别显示数据真实性提示、支付未启用空态、线路/规格未记录，浏览器控制台 0 error。生产 SQLite 只读 `quick_check=ok`，用户 9、项目 17、生成 57；9 条新式本地生成图、35 条旧代理记录仍保留。
- npm 官方审计确认现有 `@modelcontextprotocol/sdk 1.17.0` 受高危公告影响，修复版本为 `1.29.0`。当前风险入口受 `ENABLE_LIBRECHAT=false` 和内部服务鉴权拦截，不阻塞不含 Chat 的核心内网上线；依赖升级按项目规则必须单独确认，正式启用 Chat/MCP 前不得跳过。
- 10:00 的旧备份是格式 v2 工具更新前生成，不能作为新恢复脚本的最终迁移包。新备份/恢复代码和临时演练已通过；最终格式 v2 生产备份仍需在明确维护窗口确认后重新生成。

## 2026-07-15 服务器生图持久化与浏览器下载行为

- 生图结果继续由后端在写历史和扣费前保存到 Docker 持久化目录 `/app/uploads/generated`，宿主机对应 `docker/uploads/generated`；SQLite `generations.result_url` 保存 `/uploads/generated/<sha256>.<ext>` 短地址。
- 当前画布原有的兼容分支会在内网 HTTP 不支持 File System Access API 时自动创建 `<a download>`。现已改为 `server` 模式：结果直接使用服务器图片，不再触发浏览器下载；用户主动点击下载、导出或转换下载的入口未修改。
- 服务器存图修复时主入口、Canvas 和项目存储资源 query 为 `20260715serverstore1`。Docker 构建会执行 `scripts/patch-canvas-server-image-storage.js`，对当前打包画布资产做幂等、精确目标校验，避免新服务器构建时漏掉该阻塞修复；后续比例字段修复已把主入口和 Canvas query 再升级为 `20260715ratio1`，项目存储 chunk 仍为 `20260715serverstore1`。
- 生产只读关联检查：SQLite `quick_check=ok`；17 个项目全部存在对应用户目录下的 `.workflow.json`，没有当前项目缺工作流镜像；9 个 `/uploads` 数据引用全部命中文件，没有缺图。目录另保留 4 个无当前项目的历史工作流文件和 3 个无当前数据库引用的图片文件，本轮不自动删除。
- 正式镜像 `sha256:89843db7969b10fb1f6fc876c757acb3fbb0ed831b32d5f9278e0dbc83b88da1`，创建时间 `2026-07-15T05:03:13.151828813Z`，容器启动时间 `2026-07-15T05:04:00.210105291Z`，当前 healthy。生产只读 smoke、资源命中和旧资源隔离通过。
- Playwright 命名隔离会话直接调用线上生成图保存助手，返回 `mode=server`、`clientAutoDownloadDisabled=true`、下载事件数 `0`，控制台 0 错误；未调用真实 Provider，未修改注册、兑换码、项目、余额或生成数据。

## 2026-07-15 后台核心操作闭环

- 生产只读审计确认用户管理、回收站、任务监控和模型价格此前只有展示；现已补齐真实操作：用户状态、余额、密码、安全检查和软删除，回收站恢复/永久匿名化，运行时任务取消和历史任务删除，模型新增/编辑/启停/删除。订单/支付继续保持未启用空态，注册与兑换码业务实现未修改。
- 后端同时修正四个会造成“按钮成功但实际没变化”的缺口：普通用户列表不再返回 `deleted/purged`；历史任务删除会真实删除 SQLite `generations`；内置模型删除使用持久 tombstone，刷新后不会复现；取消任务后迟到的上游结果不再写入本地历史。取消不能撤回已发出的上游请求，仍可能产生 Provider 费用。
- 管理员操作增加生产保护：当前管理员不能自停用或自删除，用户状态只允许 `active/disabled/banned`，余额调整必须为非零且结果不得为负，新密码至少 6 位，永久匿名化只允许回收站用户。安全检查改为实际检查账号状态、余额、用户名/邮箱重复和最新余额日志一致性，不再返回固定演示结论。
- `scripts/smoke-admin-write-disposable.ps1` 已修复子脚本失败仍返回成功的假绿，并强制 `ENABLE_REAL_AI=false`；新增 `scripts/smoke-admin-core-ui-disposable.ps1`，使用命名隔离浏览器和一次性数据库走通用户调余额/删除/恢复、历史任务删除、模型新增/禁用/删除。标准一次性 API smoke、Vue TypeScript/Vite build 和 `node --check` 均通过。
- 生产 app 已完整重建为镜像 `sha256:6b3a47e6053915e28b59ccb144478dba08ba5e43d662a51737859d40b73a5c55`，镜像创建时间 `2026-07-15T06:29:30.304309114Z`，容器启动时间 `2026-07-15T06:30:32.650403754Z`，当前 healthy。`scripts/smoke-internal-prod.ps1 -ReadOnly` 通过；3456 直连命中 `AdminUsersSource-D6HV2j0t.js`、`AdminRecycleBinSource-CJB3VTkr.js`、`AdminGenerateTasksSource-B3k_WCZf.js`、`AdminModelPricesSource-Bk-8Nme4.js`，生产只读 API 为用户 9、回收站 0、任务 57、模型 3，`/user/center` 仍为 200。本轮没有对生产用户、余额、任务或模型执行写操作。最早一次临时生图回归在保护加固前误继承根 `.env` 的 `ENABLE_REAL_AI=true`，可能已向上游发出 1 次请求；进程在未返回结果时终止，无法排除上游费用。此后 disposable 脚本固定 `ENABLE_REAL_AI=false`，生产验收没有调用 Provider。

## 2026-07-15 生图比例字段契约统一

- 已确认当前画布快速生图把节点比例同时写入 `size` 和 `ratio`，造成 `size: "1x1"` 与模板链路 `ratio: "1:1"` 混用。现统一为画布只提交冒号格式的 `ratio`；后端把 `1x1`、`1X1`、`1×1` 规范为 `1:1`，且冲突时 `ratio` 优先。
- Provider Adapter 不再从混用字段直接取值，而是把规范比例与清晰度换算成像素 `size`；`1K + 1:1` 固定发送 `1024x1024`。旧客户端只传 `size: "1x1"` 和显式像素 `size: "1024x1024"` 仍兼容。
- 主入口和 Canvas query 已升级为 `20260715ratio1`；Docker 资产补丁、画布静态断言、后端边界 smoke 和生产只读 smoke 的资源断言同步更新。
- `node --check`、54 组比例尺寸映射、6 组适配器覆盖、画布资源/预览/操作性能断言、Vue TypeScript/Vite build、一次性 API smoke 和画布边界 smoke 已通过，均强制关闭真实 AI，没有调用 Provider。
- Provider 返回图片会在本地持久化、写入生成历史和扣系统算力前读取真实宽高。2026-07-21 起，只要返图能解码为有效图片，即使实际比例偏差超过 3% 或尺寸无法读取，也必须保存并把本地 URL 返回画布；结果同时携带比例警告元数据。空结果、无效图片和落盘失败仍按失败处理；不本地裁切、不自动重试 Provider。
- 正式 app 已完整重建为镜像 `sha256:2f0345ef97b67d710e084b1b0fb31cd3c7c0386d7ff47b233858a58562c00fe5`（创建 `2026-07-15T08:00:06.66215565Z`，容器启动 `2026-07-15T08:01:13.068379554Z`）并为 `healthy`。生产只读 smoke、`/`、`/canvas`、`/user/center`、`/gallery`、`/admin/login` 和 `/api/health` 直连均通过，线上已命中 `20260715ratio1` 且不再包含旧混用请求。未执行真实 Provider 生图；注册和兑换码实现未修改。

## 2026-07-15 图生图上行比例提示补强

- 用户在生产端真实复测两次 `1:1 + 1K` 图生图，上游 `/v1/images/edits` 各计费 `$0.10`，实际都返回 `1086x1448`。此前错误提示中的“不扣费”只指本系统算力，不能撤销已完成的上游调用；现已改为明确提示“系统算力未扣，但上游可能已经计费”。
- Packy 2026-07-09 官方文档和本地假 Provider 抓包共同确认：图片编辑应发送 multipart `size=1024x1024`，当前请求确实已发送该值；`1:1` 或 `1x1` 都不应直接作为官方 `size`。本次异常不是字段分隔符再次混乱。
- 当前图片生成节点此前把用户原始提示词直接传给中转，缺少最终画布约束。现只在该节点的上行 Prompt 末尾追加目标比例、像素尺寸、重新构图/扩展场景、保持商品完整和不得继承参考图原比例；不恢复其他旧电商约束，不做本地裁切、拉伸或二次 Provider 请求。
- 无费用回归实际捕获到 `size=1024x1024` 和新增的 `1:1` Prompt，并验证每张图仍只调用一次 `/v1/images/edits`。`node --check`、54 组尺寸映射、6 组适配器覆盖、Chat/快速生图假 Provider 集成、一次性 API smoke 和画布边界 smoke 均通过。
- 正式 app 已完整重建为镜像 `sha256:05a1b447005dd403ef0a204fc54445628305f8318448c172da795ee87b4938df`（创建 `2026-07-15T08:38:18.015661056Z`，容器启动 `2026-07-15T08:39:15.548309452Z`）并为 `healthy`。容器源码断言确认上行 Prompt 约束存在、本地裁切实现不存在；生产只读 smoke、容器内假 Provider 回归和六个 3456 路径直连通过，部署验证没有调用真实 Provider。注册和兑换码实现未修改。
- 上行画布约束不是硬编码 `1:1`：菜单的 `1:1`、`2:3`、`3:2`、`3:4`、`4:3`、`4:5`、`5:4`、`9:16`、`16:9`、`1:2`、`2:1`、`9:21`、`21:9` 均动态写入各自规范比例和 Provider 像素尺寸；`1K/2K/4K` 共 39 组菜单组合已逐项验证，另有 15 组历史 `x` 格式兼容，共 54 组。
- `自动` 单独处理：Provider 仍接收 `size=auto`，Prompt 改为允许模型按内容自然选择比例，不再产生“严格为 auto / 目标尺寸 auto”的无意义文本。
- 包含全比例和自动模式修复的最新正式镜像为 `sha256:248b679d9f36e74bb9b32bc8364ac59854dfc78e130afaa76e7144307be63249`（创建 `2026-07-15T08:51:08.293799047Z`，容器启动 `2026-07-15T08:52:09.744467889Z`），当前 `healthy`。容器内 54 组矩阵、假 Provider 集成、生产只读 smoke 和六个生产路径均通过，没有调用真实 Provider。

## 2026-07-16 Lingsuan 官方 JSON 请求头动态修复

- 生产画布最新 4K 图生图任务已确认实际发送 `/v1/images/edits + image[] + size=2880x2880 + quality=high`，但上游原图仍为 `1254×1254`；与成功返回 `2880×2880` 的纯官方手测逐项对比后，唯一明确协议差异为成功手测使用 `Accept: application/json`，画布适配器仍使用公共 `Accept: */*`。
- 主工作区已新增动态请求头选择：仅当当前后台线路的 `apiFormat` 或 `requestFormat` 为 `lingsuan-images` 时，文生图和图生图发送 `Accept: application/json`；不判断 Base URL、域名、线路名称或固定 routeId，后续更换地址、Key 或新增线路时仍由后台接口格式决定。其他线路继续保持原有流式或 `*/*` 行为。
- `node --check`、Lingsuan/Packy 假 Provider 隔离回归、Packy 适配器覆盖和 disposable API smoke 均通过；没有调用真实 Provider，没有修改注册、兑换码、用户数据或生产线路配置。
- 部署前完成便携备份 `docker/backup/internal-prod-20260716-103721`，随后从主工作区完整重建正式 app。新镜像为 `sha256:1369cb86df070ff9fd965f3fe4bf582db4f8157ffb7774c75a09f3dc8a5ca1f2`（创建 `2026-07-16T02:38:23.878782124Z`，容器启动 `2026-07-16T02:39:22.695184885Z`）并为 `healthy`。容器源码确认动态规则在文生图/图生图两处生效，生产线路仍为 `lingsuan-images / b64_json / false / 0` 且 Key 存在；容器内假 Provider 抓包、生产只读 smoke 和六个 3456 路径均通过。未调用真实 Provider，用户可直接进行人工生图复测；本次仅改后端，无需强刷前端缓存。
- 用户随后在正式画布完成一笔真实 4K 图生图复测：任务 `task_mrmwnll7980e4a1c` 走 `lignsuan-guanzhuan`，出站元数据为 `/v1/images/edits + image[] + size=2880x2880 + quality=high + output_format=png + n=1`；服务器保存原始文件 `/uploads/generated/e4ef7bb3eeb62baf62024e360c8e259e.png`，PNG 文件头和任务实际尺寸均为 `2880×2880`，7330656 字节。生成历史 `gen_mrmwojlm625df4c6` 状态 completed，本地按现有规则扣除 10 点（100→90）。这笔真实结果确认动态 `Accept: application/json` 修复已经在正式 3456 生效。

## 2026-07-16 Packy 图片编辑失败诊断

- 用户切回 Packy 后产生 3 条失败任务：`task_mrmx6rgsb887ae6b` 与 `task_mrmxdf6uec1d456f` 分别在约 1.9 秒和 2.2 秒被上游拒绝，错误均为 `Unknown parameter: 'response_format'`，Packy request id 为 `01KXMDSQQ5VD1F7X331J88AERA`、`01KXME37DJ62VV9HMGV9J0D892`；`task_mrmx71v28565a90d` 在约 22.8 秒后 `socket hang up`。
- 生产备份对比确认 Packy 在 `internal-prod-20260715-100024`、Lingsuan 部署前 `internal-prod-20260716-095040`、请求头修复前 `internal-prod-20260716-103721` 和当前数据库中的配置一致，均为 `apiFormat=requestFormat=openai-images`、`https://www.packyapi.com/v1` 与 `/images/edits`。Lingsuan 分支只匹配 `lingsuan-images`，非 Lingsuan 请求头仍为原来的 `Accept: */*`；本轮问题不是 Lingsuan 修改覆盖 Packy。
- Packy 2026-07-09 官方 `gpt-image-2` 文档要求使用 `Sora` 分组令牌，并在 `/v1/images/edits` 示例中明确包含 `response_format=url`；当前 Packy 实际通道却拒绝该字段，说明线路 Key 分组或 Packy 当前上游渠道与其文档契约不一致。项目历史曾出现 `codex` 分组没有 `gpt-image-2` 渠道，需优先在 Packy 后台确认当前线路 Key 是否确属 `Sora` 分组。
- 容器不带鉴权连续 5 次请求 Packy `/v1/models` 均正常完成 TLS 并返回预期 401，基础连通正常；单次 socket hang up 更像 Packy 上游/长连接的独立中断。3 笔失败没有新增本地生成历史或算力流水，余额仍为 90；socket hang up 是否产生 Packy 侧费用只能以其账单为准。本轮只诊断，未修改代码或线路配置，也未追加真实调用。
- 用户进一步提供 Packy 控制台截图，确认当前新分组名为 `image`，并且该分组明确挂载 `gpt-image-2`（页面时间 2026-07-16 11:00）；三条失败任务与该时间一致，且上游已经完成鉴权和模型路由后才返回参数错误。因此上一条“非 Sora 分组即根因”的推断被新证据推翻，不能要求用户换回 Sora。
- 当前更准确的边界是 Packy `image` 分组实际契约与其公开教程不一致：控制台已允许模型，但当前通道拒绝教程示例中的 `response_format`。后续修复应新增后台可选的独立 `Packy Images` 请求规则，用严格白名单适配该分组，不按域名硬编码、不修改 Lingsuan 或通用 OpenAI Images；在用户明确要求实现前不改代码、不追加真实付费测试。

## 2026-07-16 Packy Images 独立规则上线

- 主工作区已新增显式 `apiFormat=requestFormat=packy-images`，由后台线路格式选择，不识别 Packy 域名、线路名称或固定 routeId。Lingsuan 的 `lingsuan-images` 和通用 `openai-images` 保持独立。
- Packy 文生图固定 `/v1/images/generations`，只发送 `model/prompt/size/quality/output_format/n`；图生图固定 `/v1/images/edits`，使用单数 `image`，只发送 `model/image/prompt/size/quality/output_format/n`，有 mask 时才追加。`response_format/background/moderation/input_fidelity/stream/partial_images/ratio` 均不发送。
- Packy 请求固定非流式，但共享响应解析器仍自动接受 URL 或 Base64；服务器继续在写历史和扣算力前把结果持久化到 `/uploads/generated/`。后台下拉新增 `Packy Images`，固定端点和非流式开关，请求预览明确显示单数 `image` 与不发送 `response_format`。
- `node --check`、6 入口适配器覆盖、Lingsuan/Packy 假 Provider 动态抓包、disposable API smoke、Vue TypeScript/Vite build 和后台隔离浏览器 UI smoke 均通过。动态抓包覆盖 Packy 文生图严格 JSON、图生图严格 multipart、URL 返回及 Lingsuan Base64 隔离；没有调用真实 Provider。
- 部署前便携备份为 `docker/backup/internal-prod-20260716-112559`。正式 app 已从主工作区完整重建为镜像 `sha256:c42419ac54287b52a015aa728c6fc75b12b0c6d39515311cffcd26ebf5313e16`（创建 `2026-07-16T03:27:17.334834357Z`，容器启动 `2026-07-16T03:27:59.302108363Z`），当前 `healthy`。
- 生产 Packy 线路已通过现有后台 API 从 `openai-images` 切为 `packy-images`；Base URL、模型、线路 Key、API Key 存在状态、倍率、优先级、默认和启用状态保持不变。公开元数据回读为六字段文生图、单数 `image` 七字段图生图，线上后台命中 `/assets/index-CMKVadPU.js` 和 `/assets/AdminApiProvidersSource-CWwBsMFT.js`，旧线路 chunk 返回 404；生产只读 smoke、`/canvas` 和 `/user/center` 均通过。
- 本轮没有点击 Provider 线路测试，也没有由 Codex 发起真实付费生图；真实 `image` 分组验证留给用户手动执行且不自动重试。注册和兑换码实现未修改。

## 2026-07-16 Packy 4K 两次失败诊断

- 用户在正式画布先完成一笔 Packy 1K 图生图：任务 `task_mrmyphn47a631c80` 使用当前 `packy-images` 线路，51.2 秒成功并生成历史 `gen_mrmyql5fb23fecfc`，本地扣除 10 点（90→80）。这证明新线路、鉴权、模型、单数 `image` 和严格字段规则能够完成真实请求。
- 随后两笔 4K 图生图失败。`task_mrmypmhd9368d31d` 创建于 03:41:31Z，前面 1K 请求仍占用串行队列约 45 秒；1K 完成后该请求运行约 180 秒，最终任务总耗时 226.4 秒并报 `Provider 图生图超时`。容器配置 `IMAGE_PROVIDER_TIMEOUT_MS=180000`，时间线精确对应本地 AbortController 超时。
- 第二笔 `task_mrmyvckla61b276f` 没有排队，27.1 秒后由 Packy 连接返回 `socket hang up`，没有 HTTP 状态、参数错误或 request id。普通 socket hang up 和超时均不触发自动重试，只有 TLS 建连前断开才允许有限重试。
- 两笔 4K 失败均为 `chargeStatus=未完成`，没有新增本地 `generations` 或 `balance_logs`；03:42:16Z 的唯一新增扣费属于成功的 1K。上游是否对超时或断连请求计费仍必须以 Packy 账单为准。
- 当前证据不支持“Packy Images 字段仍然写错”：字段错误应快速返回 4xx，且同线路 1K 已成功。首笔明确暴露本地 180 秒超时不足，第二笔则是 Packy 主动断连。诊断轮只读检查，没有改代码、超时、线路或数据，也没有发起额外 Provider 请求。

## 2026-07-16 Packy 独立 360 秒超时上线

- `packy-images` 现通过格式规则使用独立 `PACKY_IMAGE_PROVIDER_TIMEOUT_MS`，默认 360000ms；文生图和图生图两处统一生效。Lingsuan 和通用线路继续使用现有 `IMAGE_PROVIDER_TIMEOUT_MS=180000`。
- 只延长 Packy 单次请求等待时间；串行队列、严格字段、URL/Base64 解析和扣费流程未改。普通 `socket hang up` 与 AbortError 仍不自动重试，避免上游可能已接单时重复付费。
- 静态适配器覆盖和假 Provider 动态回归确认 Packy 成功请求元数据为 `timeoutMs=360000`；后端语法、Lingsuan/Packy 隔离和 disposable API smoke 全部通过，没有调用真实 Provider。
- 部署前便携备份为 `docker/backup/internal-prod-20260716-115848`。正式 app 已完整重建为镜像 `sha256:9d51431cda131e748f963faa479fa9a56d2cdb17bba1b8e21eda710b6e62ed8c`（创建 `2026-07-16T03:59:39.663535673Z`，容器启动 `2026-07-16T04:00:27.926045613Z`），当前 `healthy`。
- 容器源码确认 360 秒常量和 generation/edit 两个调用点均存在；生产 Packy 线路仍为 `packy-images`、非流式、六字段文生图和单数 `image` 七字段图生图。生产只读 smoke、`/`、`/canvas` 和 `/user/center` 均通过。本轮未发真实图片请求，等待用户单次人工复测。
- 用户随后在正式画布完成 Packy 4K 人工复测：部署后唯一新任务 `task_mrmzxzpkab2ee8f4` 使用 `/v1/images/edits`、单数 `image`、`2880x2880`、`high` 和 `timeoutMs=360000`，196.6 秒成功。服务器文件 `/uploads/generated/68656a105c54edb6e2e877993add22db.png` 为 9280326 字节，PNG IHDR 原始尺寸 `2880×2880`；生成历史 `gen_mrn027fxb3e21d64` completed，本地正常扣除 10 点（80→70）。
- 用户截图中的 socket hang up 节点属于重建前失败任务残留；容器重建后的任务列表没有新失败项。当前画布会保留旧错误节点，不会因后续任务成功自动清除，成功图片可通过新结果节点或图库记录确认。

## 2026-07-17 画布反推提示词 502 修复

- 画布图片节点的 `/api/image-tools/reverse-prompt` 此前错误调用 `resolveRequestImageRoute`。前端只提交 `imageUrl` 时，空线路 ID 会退到首条 Packy 图片线路，随后文本调用被送到 `/chat/completions`，稳定复现 `PROVIDER_CHAT_FAILED / Provider returned 502`。
- 当前实现改用 `resolveTextRoute`，默认模型跟随文本线路；服务器先读取 `/uploads/generated/...` 等原图，再以 Responses 多模态 `input_image` 发送，不再只把图片地址拼进提示词。
- 新增 `scripts/test-reverse-prompt-provider-route.js`：使用临时数据库、临时图片和本地假 Provider，错误路径固定返回 502，正确 `/responses` 路径断言模型、图片 Data URL 和提示词返回。该回归已接入 `scripts/smoke-backend-canvas-boundary.ps1`。
- `node --check server.js`、定向假 Provider 回归、一次性 API smoke 和画布后端边界 smoke 均通过，没有调用真实 Provider、没有扣费。用户确认维护窗口后完成一致性备份 `docker/backup/internal-prod-20260717-103952`，并使用正式 Chat 生产 Compose 叠加配置完整重建 app。新镜像为 `sha256:f7b9d13dc4b8b2ae9407c2683e0345bab9cbc17b5d821112135dfe12260df393`（创建 `2026-07-17T02:40:51.240873181Z`，容器启动 `2026-07-17T02:41:14.973224356Z`），四容器均为 `healthy`。
- 容器源码已确认反推入口命中 `resolveTextRoute` 和多模态 `input_image`；生产只读 smoke 通过。`127.0.0.1:3456` 与 `192.168.0.39:3456` 的首页、目标画布、用户中心和健康接口均为 200；未授权反推请求返回 401 且未触发 Provider。本轮部署验证没有真实反推、没有扣费。

## 2026-07-17 Chat 结构化电商简报直接报价修复

- 用户在“电商主图设计师”中提交 `平台淘宝，800x800，目标人群年轻女性和家庭，主打...` 后，模型已理解内容但要求用户重复同一句。根因是 `responsesRequestFromChat` 只识别“生图/生成/设计”等显式动词，该完整结构化简报没有被强制路由到 `prepare_image_generation`。
- 当前新增严格结构化判定：消息必须同时包含电商平台、画布尺寸/比例、目标人群/卖点/商品规格三类信号，才按新生图需求强制选择报价工具。普通聊天、确认码、图片编辑、幂等计费和附件替换规则未改。
- `scripts/test-librechat-tool-continuation.js` 已加入用户原句。旧实现稳定断言 `tool_choice=undefined`；修复后假 Provider 抓包确认 `tool_choice={type:function,name:prepare_image_generation}`，并确认该请求进入报价工作流的 `reserved` 状态。
- 文本线路 Base URL 同轮按用户确认从 `https://lingsuan.top` 恢复为历史验证成功的 `https://lingsuan.top/v1`，端点仍为 `/responses`，Key、格式、启用状态保持不变；未点击线路测试、未调用真实 Provider。
- 发布前一致性备份为 `docker/backup/internal-prod-20260717-115201`。正式 app 已完整重建为镜像 `sha256:134ace2477f629452e4e7e5bd7ca8ebd168aca67d0f107ce467ce2484556a9be`（创建 `2026-07-17T03:53:18.078030611Z`，容器启动 `2026-07-17T03:53:37.750287629Z`），四容器均为 `healthy`。
- Chat 工具续接、Chat 图片工具、一次性 API、画布后端边界、生产只读 smoke、Chat 无费用浏览器验收全部通过；`127.0.0.1:3456` 与 `192.168.0.39:3456` 的首页、Chat、画布和用户中心均为 200。自动验收没有发送消息，账号 `731241492` 余额保持 45。

## 2026-07-17 Chat 中文附件名 ByteString 修复

- 用户在 `/chat/` 上传参考图后调用 `prepare_image_generation`，LibreChat 报 `Cannot convert argument to a ByteString ... value of 26410`。本地用 `/images/未命名图片.png` 稳定复现同一异常；码点 26410 对应“未”，错误发生在 Fetch 构造请求 Header 时，早于 MCP、流式返回和 Provider 调用。
- 根因是 LibreChat 把附件路径 UTF-8 JSON 原文写入 `X-Chat-Reference-Images`。当前补丁改为 `b64url:<payload>` 的 ASCII 安全 Header，主站解码后继续使用原路径；旧的原始 JSON Header 仍保持兼容。用户身份、报价确认码、扣费和图片 Provider 协议未改。
- `scripts/test-chat-image-generation-tools.js` 增加中文附件路径回归：修复前稳定抛出 ByteString，修复后参考图数量为 1 并进入 `image-to-image` 报价。固定 LibreChat 源码包补丁应用、补丁后控制器语法、Chat 工具续接、图片工具、一次性 API 和后端边界 smoke 全部通过，均未调用真实 Provider。
- 发布前一致性备份为 `docker/backup/internal-prod-20260717-124018`。正式 app 镜像为 `sha256:92224b69d98ff3f5d4fb605f651eac18c383cc944805fb5fd18abf7cc7703920`（创建 `2026-07-17T04:41:21.749092354Z`，容器启动 `2026-07-17T05:13:40.830591484Z`）；LibreChat 镜像为 `sha256:94c533b032ae0e0208dca7693920c93237f42ae5d3a219bb3e4a283120968db0`（创建 `2026-07-17T05:13:01.02144Z`，容器启动 `2026-07-17T05:13:47.700884022Z`）。四容器均为 `healthy`。
- 容器源码确认编码端和解码端同时命中新逻辑。生产 MCP 使用中文附件路径完成一次只报价探针，结果为 `image-to-image / referenceImageCount=1`，随后删除测试报价；没有执行图片生成或调用 Provider。生产只读 smoke、Chat 无费用浏览器 smoke，以及本机/内网首页、`/chat/`、`/user/center` 均通过。

## 2026-07-17 Chat 生图工具普通用户展示修复

- Chat 面向普通用户，内置 `prepare_image_generation` 与 `execute_image_generation` 不再展示函数名、`hajimi-website`、Parameters 或原始 JSON。报价阶段展示中文报价、算力和确认码，生图完成后展示中文结果和图片；已完成的报价/结果即使后续助手续接失败也保持可见，其他通用工具仍保持原展示。
- 主站 MCP 的 `content[].text` 已改为普通用户中文 Markdown；内部 `quoteId/modelKey/taskId/instruction` 仅保留在 `structuredContent`，但执行不再依赖 LibreChat 持久化这些字段。用户下一条消息的确认码可在服务端按当前用户定位 pending 报价，5 分钟有效期、下一条消息确认、幂等计费和图片 Provider 协议保持不变。
- 回归覆盖后端用户文案无内部字段、工具续接、固定 LibreChat 源码补丁、完整前端构建和 `ToolCall` 组件 28 个用例；无费用生产报价探针确认线上用户文案可读并立即删除报价，账号 `731241492` 余额保持 40。
- 发布前备份为 `docker/backup/internal-prod-20260717-141643`。正式 app 镜像 `sha256:1a8c7cbc2d19c4f62d7bdfa2255595b0f6438ef88581c83388231d965f67d763`（创建 `2026-07-17T06:17:32.942078675Z`，启动 `2026-07-17T06:18:00.520394287Z`）；LibreChat 镜像 `sha256:c80e109d54ccbfb269997c2f0a4793b316ad8f6ddc86b60b0107a328b4749dbc`（创建 `2026-07-17T06:17:12.60538999Z`，启动 `2026-07-17T06:18:06.745303227Z`）。四容器均为 `healthy`。
- 生产只读 smoke、Chat 浏览器 smoke、旧资源隔离和本机/内网的首页、`/chat/`、Chat 子路由、画布、用户中心、后台 Chat 设置、健康接口均通过。部署包含新的 LibreChat PWA 资源，用户复测前需对 `/chat/` 执行一次 `Ctrl+F5`。

## 2026-07-17 Chat 图生图确认续接修复

- 用户截图对应的最新会话并非“没有接图生图”：`prepare_image_generation` 已收到 2 张参考图并创建 `image-to-image` 报价，但没有进入 `execute_image_generation`，因此没有新增 generation，也没有调用图片 Provider。卡点有两个：完成的报价卡片在 `isLast=false` 时被隐藏；下一轮确认又依赖文本 Provider 续接，并且 LibreChat 会话没有可靠持久化内部 `quoteId`。
- 当前完成的报价/结果始终向普通用户可见；用户下一条消息精确回复 `确认生图 CODE` 时，主站直接产生内置 `execute_image_generation` 工具调用，不再先请求文本 Provider。执行工具只需确认码，服务端按当前用户和确认码哈希定位 pending 报价，再沿用原有图生图 `/images/edits` 路径、有效期、下一条消息约束、幂等计费和退款逻辑。
- 工具结果后的助手续接也改为本地中文消息，避免文本 Provider 的 502 把已经成功的报价或图片结果覆盖成退款错误。普通聊天仍走原文本线路，图片 Provider 协议和模型适配器未改。
- 后端语法、工具续接、Chat 图片工具、一次性 API、画布后端边界、固定 LibreChat 补丁、完整前端构建和 `ToolCall` 组件 28/28 用例均通过。生产使用已过期历史确认码 `9D7FD4` 做无费用探针：仅凭确认码成功定位当前用户报价，并在过期门禁停止；余额保持 30、报价仍为 pending、generation 数量不变、没有调用 Provider。
- 发布前备份为 `docker/backup/internal-prod-20260717-155419`。正式 app 镜像为 `sha256:df61e8df09906e7bfe291a8d411dee7d090edaec98f1ea95812f08f4bff8b6bb`（创建 `2026-07-17T07:55:12.749572625Z`，容器启动 `2026-07-17T08:06:54.997269386Z`）；LibreChat 镜像为 `sha256:5c2ec27743db1bf2d1401b1f2c8e23f2c6d9a7683034b321021ff8dbd7032775`（创建 `2026-07-17T08:01:02.377631028Z`，容器启动 `2026-07-17T08:07:01.355393763Z`）。两者均从 `F:\dianshang` 完整重建并为 `healthy`，没有重启 Docker Desktop。
- 生产只读 smoke、Chat 浏览器 smoke、旧资源隔离以及本机/内网的首页、`/chat/`、Chat 子路由、画布、用户中心、后台 Chat 设置和健康接口均通过；线上 Chat 入口为 `/chat/assets/index.CEEARJSz.js`。历史确认码已过期，用户需在 `/chat/` 强刷后重新发送两图需求，取得新确认码再人工确认；确认后会真实调用图片 Provider 并按报价扣费。

## 2026-07-17 画布重复生图排队修复

- 事故复盘确认画布不是 mock：生产线路实际为 `cx-vip / 高速专线 img2`，请求进入 lingsuan 图片编辑接口；连续点击共创建 17 个任务。全局 Promise 队列一次只放行一个 Provider 请求，多个 Cloudflare 524 每个占用约 120 秒，前端又用本地计时把未出队任务显示为 90% 左右，因此出现“中转站暂无记录、页面一直排队”的组合现象。
- 根因有三处：画布按钮只在提示词为空时禁用、提交处理器没有同步锁；后端接受同一用户的多个活跃任务；任务在真正取得 Provider 槽位前就标记为 `running`。现保留 Provider 全局串行边界，但增加同一用户最多一个 `pending/running` 任务的门禁，重复请求返回 `409 IMAGE_GENERATION_ALREADY_ACTIVE` 且不创建任务、不调用 Provider；排队任务为 `pending`，仅在实际出站时切换为 `running`。
- 当前 Canvas 增加立即提交锁和忙碌禁用，接受任务后按后端 `pending/running` 显示“排队中/等待返回结果”，不再用假进度把排队任务推到 90%。主入口与 Canvas query 为 `20260717queueguard1`；Docker 幂等资产补丁和生产资源断言已同步。
- 新增无费用假 Provider 回归：修复前首个任务错误为 `running`；修复后首个任务为 `pending`，第二次快速提交为 409，`activeTaskId` 一致、Provider 只收到一次请求、历史和扣费各一次。后端语法、画布资源/预览/操作性能断言、Chat 图片工具、一次性 API、画布边界 smoke 和 Vue build 均通过，没有用自动验收调用真实 Provider。
- 部署前快照为 17 个任务全部结束：11 个失败、6 个成功、0 个活跃。旧实现允许 6 个成功任务各扣 10 点，账号 `731241492` 当前余额为 `-30`；本轮没有擅自退款或改账，需用户确认后单独处理。
- 一致性备份为 `docker/backup/internal-prod-20260717-165407`。正式 app 镜像为 `sha256:e61093fd64edbae1113226a03ed7c7e11e2229dbec516d4eec20d1925f47b41f`（创建 `2026-07-17T08:55:30.168643393Z`，容器启动 `2026-07-17T08:57:14.258560203Z`），当前 app、gateway、LibreChat、MongoDB 全部 `healthy`。生产只读 smoke、Chat 无费用 UI smoke、旧资源 410/404，以及本机/内网的首页、画布、用户中心、后台、Chat 和健康接口均通过。用户复测画布前需 `Ctrl+F5`；真实 Provider 仍可能独立返回 524，本修复只防止重复堆单并如实展示队列状态。

## 2026-07-17 画布连续多批生图能力恢复

- 上一轮新增的账号级 `409 IMAGE_GENERATION_ALREADY_ACTIVE` 和 Canvas `generationSubmitLocked` 超出了用户需求，并回退了 2026-07-03 已确认的“同一节点连续点击创建多批独立结果节点”能力。当前已全部撤销：同一账号每次合法提交都返回 HTTP 202、创建独立任务，生成按钮只在没有提示词/参考图时禁用。
- 保留上一轮正确部分：任务先以 `pending` 和低位排队进度返回，真正取得 Provider 槽位后才转为 `running`，不再用本地假进度把未出队任务显示为 90%。2026-07-03 为避免多份参考图同时上传导致中转过载而建立的全局串行 Provider 队列保持不变；因此可以连续提交多批，但上游仍按保护队列逐个出站。
- 无费用回归先在旧代码上稳定得到第二次提交 409；修复后同一账号两次快速提交均为 202、任务 ID 不同、两次假 Provider 调用均成功、生成历史与扣费各两笔。画布资源/预览/操作性能、Chat 图片工具、一次性 API、画布边界和 Vue build 全部通过，没有触发真实 Provider。
- 当前入口和 Canvas query 为 `20260717multisubmit1`。一致性备份为 `docker/backup/internal-prod-20260717-174410`；正式 app 镜像为 `sha256:586be741ec20e465ddc5f47ccf7368883e39538eaa5104040c7cc82dd5c8a7ca`（创建 `2026-07-17T09:45:00.182529455Z`，容器启动 `2026-07-17T09:45:19.666241165Z`），四容器均为 `healthy`。
- 生产只读 smoke、旧资源 410/404、本机与内网的首页、画布、用户中心、后台、Chat、健康接口全部通过；线上 Canvas 不含提交锁，容器后端不含账号级 409，仍保留真实 pending/running 状态。本轮没有执行余额写操作；发布后只读回查账号 `731241492` 当前余额为 `70`。用户复测前需 `Ctrl+F5`。

## 2026-07-17 画布反推提示词剪贴板修复

- 当前反推弹窗旧实现使用 `navigator.clipboard?.writeText(...)`，在 `http://192.168.0.39` 等非安全内网页面中 Clipboard API 不存在时会跳过实际写入，却仍提示“提示词已复制”，因此系统剪贴板为空。
- 反推弹窗现在先在安全上下文使用 Clipboard API；API 不可用或写入失败时自动创建不可见只读 textarea，选择完整提示词并调用浏览器复制命令，最后清理 DOM。两条路径都失败时才提示“复制失败，请手动选择提示词”，不再假报成功。
- 新增直接抽取当前 Canvas 反推按钮处理器执行的回归，覆盖安全 Clipboard API、HTTP textarea 回退和明确失败三条路径；旧实现稳定失败于“HTTP 回退未写入提示词”，修复后全部通过。画布资源/预览/操作性能、画布边界和 Vue build 同时通过，没有调用真实 Provider。
- 当前入口和 Canvas query 为 `20260717reversecopy1`。部署前等待 1 个运行中生图任务自然结束，再生成一致性备份 `docker/backup/internal-prod-20260717-181703`；没有中断任务或修改余额、队列策略。
- 正式 app 镜像为 `sha256:af7a8223d49986c4a63881db9a06f15f79d5f1fa03894a1b062fd1641bedd816`（创建 `2026-07-17T10:17:57.88842705Z`，容器启动 `2026-07-17T10:18:17.150331353Z`），四容器全部 `healthy`。生产只读 smoke、旧资源隔离、127/192 六类入口及线上回退代码命中检查通过；用户需 `Ctrl+F5` 后重新打开反推弹窗测试。

## 2026-07-20 Chat 生图续接、线路选择与一键确认发布

- Chat 的“电商主图设计师”由后台托管智能体指令、当前对话和参考图共同组织生图需求；Skills 是可选能力，不是每次生成提示词的必经层。截图中的用户可见文字是方案摘要，实际报价与执行由内置 `hajimi-website` 图片工具完成。
- 报价工具成功后仍显示“上游 AI 服务暂时不可用”的根因不在图片 Provider：LibreChat 会把 MCP 工具结果放在 assistant 的 content-array `tool_call.output` 中，旧续接判断只识别标准尾随 `role=tool` 消息，因而错误再次调用文本 Provider并在 502/超时后显示退款。主站现在同时识别两种结果结构，并为报价与图片结果返回本地中文续接，不再重复调用文本 Provider。
- Chat 输入栏增加“生图线路”选择，复用现有 `/api/model-routes?group=image`、`/api/user/api-status` 和 `/api/user/preferences/api-route`。创建报价时会把线路 ID、key 和名称锁进 `chat_image_quotes.request_json`；报价后再切换下拉框不会改变该笔报价的实际执行线路。
- 报价卡增加“确认并生成”按钮，从用户可见报价中提取六位确认码并通过 LibreChat 标准 `submitMessage` 提交精确的 `确认生图 CODE`；提交期间禁用按钮防止快速重复点击。手工回复仍作为兼容回退，原 5 分钟有效期、余额检查、单次执行和退款门禁均未绕过。
- 回归与构建通过：`test-librechat-tool-continuation.js`、`test-chat-image-generation-tools.js`、一次性 API、画布后端边界、固定 LibreChat 补丁、完整 LibreChat 前端构建和 `ToolCall` 组件 29/29 用例。生产无费用 smoke 通过 SSO、托管智能体、用户级 MCP、模型桥接和两个生图工具；自动验收未发送 Chat 消息、未执行真实生图、未调用 Provider。
- 维护前活动任务为 0；一致性备份为 `docker/backup/internal-prod-20260720-112113`。正式 app 镜像为 `sha256:06328875c8c9c028bf930e3843c01e8cbe0f18e9558b7dd12de69f4ddcd1d57c`（创建 `2026-07-20T03:22:25.297944773Z`，启动 `2026-07-20T03:23:00.153651439Z`）；LibreChat 镜像为 `sha256:7da252c039708a99bb10623758f2a1c02e9af027af3c9eae188e8fbb6d88ac76`（创建 `2026-07-20T03:22:04.029941844Z`，启动 `2026-07-20T03:23:06.370648737Z`）。app、LibreChat、MongoDB、gateway 全部 `healthy`。
- `127.0.0.1:3456` 与 `192.168.0.39:3456` 的首页、`/chat/`、画布、用户中心和健康接口均为 200；线上 Chat 资源 `/chat/assets/index.2lAYBjDl.js` 同时命中线路选择器与确认按钮。用户复测前需在 `/chat/` 执行一次 `Ctrl+F5`，重新创建报价后按钮才会出现在新报价卡中。

## 2026-07-20 Chat 生产 MCP 完整工具名确认路由修复

- 最新失败会话中的 `确认生图 932EE2` 没有进入任一图片线路：LibreChat 生产环境传入的工具名是 `prepare_image_generation_mcp_hajimi-website` / `execute_image_generation_mcp_hajimi-website`，主站只按 `endsWith('execute_image_generation')` 查找，因而确认消息错误回落到 `gpt-5.5` 文本线路并收到 502；三次文本预留均已自动退款，图片 Provider 没有收到请求。
- `chatImageToolName` 现在同时兼容历史短工具名、尾缀兼容名和 LibreChat 的 `工具名_mcp_服务名` 生产格式，并原样返回客户端提供的完整 execute 工具名。未修改两条图片 Provider 适配器、线路选择、报价有效期、计费或退款规则。
- 新增生产格式回归：修复前稳定误调假文本 Provider；修复后 `确认生图 ABC123` 直接返回 `execute_image_generation_mcp_hajimi-website`，参数仍为确认码，文本 Provider 请求数不增加。后端语法、工具续接、Chat 图片工具、一次性 API、一次性后台写入和画布边界 smoke 全部通过。
- 维护前活动任务为 0；备份为 `docker/backup/internal-prod-20260720-115227`。正式 app 镜像为 `sha256:5bdf35fec37461ffe4c4961095d2eca8efb0bcdbeb5325b11d1bc83ce3e6021e`（创建 `2026-07-20T03:53:09.59898336Z`，容器启动 `2026-07-20T03:53:39.899608308Z`）。app、LibreChat、MongoDB、gateway 全部 `healthy`。
- `127.0.0.1:3456` 与 `192.168.0.39:3456` 的 `/admin`、`/admin/chat-settings`、`/chat/`、`/api/health` 均为 200；生产只读 smoke 和完整无费用 LibreChat 集成 smoke 通过。自动验收没有执行真实生图或调用 Provider。历史确认码 `932EE2` 已过期，用户需刷新 `/chat/` 后重新创建报价，并在 5 分钟内点击“确认并生成”。

## 2026-07-20 Chat 生图结果图片渲染修复

- 真实生图已经成功保存，截图中的 `/uploads/generated/72b6536e7fb28537b55f41da603fb622.png` 在本机和内网均返回 HTTP 200、`image/png`，大小 1,939,192 字节。未显示图片的根因是哈吉米工具卡统一使用 LibreChat `OutputRenderer`，该组件通过 `<pre>` 输出纯文本，不解析 `![生成图片](...)` Markdown。
- 当前仅把 `execute_image_generation` 的成功输出交给 LibreChat 既有安全 Markdown 渲染器；`prepare_image_generation` 报价卡仍沿用原纯文本、复制按钮和“确认并生成”交互。工具输出内容、Mongo 会话结构、上下文文本、图片 Provider、报价、计费和退款均未修改。
- 新增真实 `ToolCall` 组件回归：旧实现 29 个既有用例通过、新增图片用例失败并显示原始 `<pre>`；修复后 30/30 通过，DOM 生成 `<img alt="生成图片 1" src="/uploads/generated/result.png">`。固定补丁语法、完整 LibreChat 前端构建、生产 Chat 浏览器 smoke 和无费用集成 smoke 均通过。
- 维护前活动任务为 0；备份为 `docker/backup/internal-prod-20260720-123157`。Compose 因 LibreChat 依赖关系同时重建 app：app 镜像 `sha256:6f528bdba4992d2baf2f741ab744bf13dabfbfd8529fed75920621ccd99ad08e`（创建 `2026-07-20T04:32:59.603412223Z`，启动 `2026-07-20T04:33:26.5631995Z`）；LibreChat 镜像 `sha256:64c3fce3a49ae935e2f481c50995f34e19322cd825abf6557f9a90bdcd387420`（创建 `2026-07-20T04:32:36.393045526Z`，启动 `2026-07-20T04:33:32.899391891Z`）。四容器全部 `healthy`。
- 127/192 生产只读 smoke、Chat、SSO、用户级 MCP、模型桥接和图片资源检查通过，新入口为 `/chat/assets/index.7-3Zm5Bb.js`。未发送新对话、未执行生图、未产生 Provider 费用。用户需在 `/chat/` 执行一次 `Ctrl+F5`；历史结果会重新渲染为图片，无需再次生成。

## 2026-07-20 Chat 电商主图方案表单流程发布

- 电商主图对话改为“产品图 + 参考图 → 方案表单 → 用户确认/填写文案修改 → 重新生成最终提示词和报价 → 原始参考图图生图 → 继续修改或再出一版”的闭环；初次方案阶段不调用图片 Provider，也不扣费。
- 新增 `prepare_ecommerce_image_plan` 与 `confirm_ecommerce_image_plan`，方案按用户和 LibreChat 会话保存 30 分钟。确认时“文案修改（选填）”优先级高于表单原字段；文本修改会恢复当前会话保存的原始产品图和参考图，不要求普通用户重复上传。
- LibreChat 工具卡展示只读文案字段、空白文案修改框和“确认方案”按钮；图片完成后展示“修改这张”“再出一版”“完成”。报价确认与既有线路锁定、有效期、余额、幂等和退款规则保持不变。
- 本地假 Provider 回归、一次性 API smoke、前端构建、固定补丁应用和补丁后 TSX 转译通过；未调用真实 Provider。发布前一致性备份为 `docker/backup/internal-prod-20260720-141106`。
- 首次重建后的完整集成 smoke 发现 `serverInstructions` 块缩进不一致，LibreChat 因 YAML 无效而未注册 MCP；修正并用容器内 LibreChat YAML 解析器验证后重新全量构建。正式 app 镜像为 `sha256:7822895a387098a30967d7cea2688f36bdfc20d91864c417e3a6e53c57d0c974`（创建 `2026-07-20T06:25:10.810973479Z`，启动 `2026-07-20T06:25:38.264474495Z`），LibreChat 镜像为 `sha256:78b891d4b8a843172519ab5d302268776011adee72df75626023ceb03dc6abdc`（创建 `2026-07-20T06:12:58.051958509Z`，启动 `2026-07-20T06:25:45.000950402Z`）；四容器均为 `healthy`。
- 生产只读 smoke、完整无费用 LibreChat 集成 smoke、127/192 入口与 Chat 浏览器 smoke 通过；用户级 MCP 已暴露四个工具，新入口 `/chat/assets/index.7YakS8m_.js` 命中方案表单、确认方案和循环修改控件，旧入口 `/chat/assets/index.7-3Zm5Bb.js` 返回 410。自动验收没有执行真实生图或产生 Provider 费用，用户复测前需在 `/chat/` 执行一次 `Ctrl+F5`。

## 2026-07-20 Chat 电商主图设计师 v2 正式基线

- 本轮只重整托管智能体 ID `ecommerce-main-image`；LibreChat 临时智能体、文本桥接和网站 MCP 全程显式传递 `hjm_managed_agent_id` / `X-Chat-Agent-ID`，不再按名称或提示词猜测。旧会话缺少 ID 时要求重新选择智能体或新建会话，其他智能体仍走原模型和原图片报价工具。
- 后台文本 API 路线实际模型键为 `gpt-5.6-terra`；Chat 模型目录、全部托管智能体、请求示例、计费记录和 Provider 请求现已动态同步到该键，每次 5 算力。历史 `gpt-5.5`/`gpt-5.6` 名称自动映射到当前路线，不新增重复线路。只有该智能体进入两阶段流程；其他智能体仍保持原工具策略。
- 首轮最多读取 4 张 PNG/JPEG/WebP 原图并按上传顺序发送真实 `input_image`。图片角色服从用户提示词，没有固定“图1产品、图2参考”；v2 方案保存可编辑 `designPrompt`、`referenceRoles[]`、动态 `copyItems[]`。文案名称和内容可编辑、来源只读，可新增和删除行；历史固定字段会转换为动态行展示。
- “确认方案”会把原需求、原图、原方案、用户编辑方案、动态文案和补充要求再次交给 GPT‑5.6 生成 `finalPrompt`。服务端只附加准确文案、图片角色、禁止额外乱码/水印等确定性约束后创建报价；确认报价前不会调用图片 Provider。修改这张/再出一版会携带最初参考图和上一版结果重新进入方案修订。
- 本地验证已通过：后端语法、Chat/MCP 假 Provider 回归、最多 4 张和旧会话边界、无效 GPT 输出退款、一次性 API、画布后端边界、Vue 完整构建、LibreChat 完整前端构建及 `ToolCall` 33/33 用例。方案前没有图片 Provider 请求，反向角色“图1排版、图2产品”贯穿方案、最终提示词和报价。
- 真实多模态探测在 SQLite 一致性副本和临时端口成功：Provider 收到 `gpt-5.6-terra` 和两张真实 `input_image`，正确判定“图1只参考氛围、图2为唯一产品”，返回 10 条动态文案并调用方案工具；只扣 5 算力，没有创建报价或调用图片 Provider。
- 发布前活动生成任务为 0，旧 pending 记录仅为未确认报价；一致性备份为 `docker/backup/internal-prod-20260720-160830`。生产历史智能体指令已通过一次性 `migration.ecommerceMainImageWorkflow.v2` 更新，后续管理员修改不会被启动覆盖。正式 app 镜像为 `sha256:35f1809f45ed6d2c8b85c1c894b66a117943a91b4f518e98da9e297df2b4bd48`（创建 `2026-07-20T08:27:02.356292464Z`，启动 `2026-07-20T08:27:10.1057717Z`），LibreChat 镜像为 `sha256:99979eb4bfa37748ef3984769ec3cd083f4ec22729efd4643afe56e629f19849`（创建 `2026-07-20T08:16:27.623511096Z`，启动 `2026-07-20T08:16:40.544816969Z`）；四容器均为 `healthy`。
- 127/192 只读生产 smoke、无费用 LibreChat 集成 smoke 和生产 Chat 浏览器 smoke 通过；新入口 `/chat/assets/index.1S4zO-n7.js` 为 200，上一版 `/chat/assets/index.7YakS8m_.js` 为 410。生产目录返回 `ecommerce-main-image → gpt-5.6-terra`，未触发新生图或生产 Provider 调用。用户复测前需在 `/chat/` 执行一次 `Ctrl+F5`。

## 2026-07-20 Chat 电商主图设计师真实闭环测图

- 已使用生产账号 `731241492` 完成一次付费闭环：GPT‑5.6 首轮方案成功、确认方案后二次生成 `finalPrompt` 成功、创建报价、明确确认报价并调用真实图片 Provider，最终生成记录 `gen_mrszl6t882d8bd4f` 状态为 `completed`。
- 首次二次 GPT 调用超过原 120 秒门限并按规则退款 5 算力；现仅为 `ecommerce-main-image` 将文本 Provider 超时提高到 240 秒，普通 Chat 智能体保持原超时。重试后 GPT‑5.6 两次成功调用各扣 5 算力。
- 默认线路“官转gpt-img2”真实返回 HTTP 524，失败报价未扣生图费用；相同 `finalPrompt` 与原始参考图切换“高速专线 img2”后成功，图片费用 10 算力。账号余额从 655 变为 635，本次净消耗 20 算力。
- 结果文件为 `/uploads/generated/d3f21e46b8d1e5a6a63475b273850bc2.png`，大小 1,567,143 字节；`127.0.0.1:3456` 与 `192.168.0.39:3456` 均返回 HTTP 200、`image/png`，并已人工查看内容。
- 超时修复已从 `F:\dianshang` 完整重建 app；当前镜像为 `sha256:7e1f9dfd41c28461fd3612f25fe8cd2b725d717370b07d9ebaa7d2151cd1bcd4`（创建 `2026-07-20T08:46:08.929890626Z`，启动 `2026-07-20T08:46:15.290867619Z`），健康检查连续通过。

## 2026-07-20 画布图片生成节点隐藏提示词移除（已发布）

- 用户确认图片生成节点只应承担参考图、模型、比例、清晰度、张数和节点可见提示词，不允许后端自动追加系统提示词；以后如增加系统提示词模板，必须直接体现在节点卡中并可编辑。
- `/api/generate/tasks` 的 `buildImageGenerateNodePrompt()` 已恢复为只返回节点输入；空提示词且有参考图时使用“根据参考图生成图片”，完全空白时使用“生成图片”。已删除“最终输出画布必须严格为”“重新构图或扩展场景”“不得沿用参考图原始宽高比例”等隐藏追加内容。
- 比例、像素尺寸、清晰度和张数仍以独立 Provider 参数发送；带参考图仍调用 `/v1/images/edits`。模板生图、Chat 电商主图设计师和局部绘图链路未改。
- 本地红绿回归、后端语法、54 组尺寸映射、6 组适配器覆盖、Chat 图片工具假 Provider、一次性 API 和后端/画布边界 smoke 均通过，没有调用真实 Provider或扣费。
- 发布前活动任务检查未发现 `pending/running` 生图任务；一致性备份为 `docker/backup/internal-prod-20260720-174657`。首次只使用基础 Compose 启动时，app 试图绑定宿主机 `3456` 并与统一 gateway 冲突；镜像构建已成功但容器未启动。随后立即叠加 `docker-compose.chat-production.yml` 清空 app 宿主机端口并恢复正式拓扑，没有修改数据卷或中断 gateway。
- 正式 app 镜像为 `sha256:e4391ee734994c19fa0fcf82958135c1f063756af30d7978520bc6b55da48812`（创建 `2026-07-20T09:47:51.12820143Z`，启动 `2026-07-20T09:51:30.109984323Z`）。app、gateway、LibreChat、MongoDB 四容器均为 `healthy`；只有 gateway 暴露宿主机 `3456`。
- 容器源码已确认 `buildImageGenerateNodePrompt()` 只返回节点提示词，且不再包含“重新构图或扩展场景”。生产只读 smoke 通过；`127.0.0.1:3456` 与 `192.168.0.39:3456` 的首页、画布和健康接口均为 200。后端修改无需强刷浏览器，下一笔新生成任务直接生效。

## 2026-07-21 Provider 有效返图保留（已发布）

- 生产真实请求暴露出旧比例断言会在落盘前丢弃有效返图：请求 `576x1152`、上游实际 `853x1844`，中转已完成并计费，但画布只收到失败状态。
- 当前公共返图持久化链只要解码出有效图片，就先写入 `/uploads/generated/` 并返回本地 URL；比例偏差超过 3% 或尺寸未知改为成功结果警告。画布任务、模板和 Chat 均复用该行为；空结果、无效图片和落盘失败仍失败。
- 发布前活动任务为 0，一致性备份为 `docker/backup/internal-prod-20260721-101127`。正式 app 镜像为 `sha256:2190dad5a1498e051e8a20879b3a3b191071e43e36ea8e8ce20aa7bbe2515281`（创建 `2026-07-21T02:12:37.2750164Z`，启动 `2026-07-21T02:12:47.5355797Z`）。app、gateway、LibreChat、MongoDB 四容器均为 `healthy`，只有 gateway 暴露宿主机 `3456`。
- 容器内比例不匹配落盘回归、生产只读 smoke 和 `192.168.0.39:3456` 的首页、画布、用户中心、Chat、健康接口均通过。自动验收没有调用真实 Provider；该后端修复无需强刷浏览器。

## 2026-07-21 Chat 图像分析 Skills 与试用引导（已发布）

- `image1234.zip` 中的三项能力已按 LibreChat 原生 Skill 结构整理并发布：`image-reverse-describe`（图像精确反推，6 个参考文件）、`image-deep-read`（图像深读，5 个参考文件）、`style-grammar-distill`（风格语法提炼，3 个参考文件）。压缩包中误写为 `reference/` 的目录已统一为 Skill 正文实际引用的 `references/`。
- 生产同步只走 LibreChat Skills、文件上传和权限 API；`scripts/sync-librechat-reviewed-skills.js` 支持本地校验、重复同步和公开权限确认。当前 MongoDB 为 3 个 Skill、14 个参考文件、3 条 public viewer ACL；三项能力均 `userInvocable=true`、`alwaysApply=false`，普通用户可见但只有手动选择后才参与下一条消息。
- Chat 首页 Skills 区新增“试用引导”，分别给出准备材料、示例指令和一键选择按钮。普通用户隔离浏览器已确认三张引导卡实际来自可访问的 Skill 列表，点击“精确反推一张图”后会进入选中状态。
- 主站管理员邮箱不符合 LibreChat 邮箱格式时，SSO 仅在 Chat 内为管理员生成 `@internal.local` 内部兜底地址；普通用户仍执行原邮箱校验，主站账号资料不被改写。
- 发布前一致性备份为 `docker/backup/internal-prod-20260721-104817`，其中包含 `archives/librechat-mongodb.archive.gz`；`mongorestore --dryRun --nsInclude LibreChat.*` 通过。正式 app 镜像为 `sha256:41ec57f8db7b4f722d646373fe7f1f4f0a87b478e2c50864ead8184e774ac5df`（创建 `2026-07-21T02:53:42.208026466Z`，启动 `2026-07-21T02:54:30.571734765Z`），LibreChat 镜像为 `sha256:a85c2b93ddf3d7efa3b99167dbabd5a5184b9d50906dbf97cf4513c6dd57df40`（创建 `2026-07-21T02:54:04.038528761Z`，启动 `2026-07-21T02:54:37.276561964Z`）。四个正式容器全部 `healthy`，仍只有 gateway 暴露宿主机 `3456`。
- 完整 LibreChat 构建、固定集成静态 smoke、生产只读 smoke、普通用户 Chat 浏览器 smoke，以及 `192.168.0.39:3456` 的首页、画布、用户中心、Chat 和健康接口均通过。验收没有发送消息、没有调用 Provider、没有产生费用；前端资源已更新，用户首次复测 `/chat/` 前需执行一次 `Ctrl+F5`。

## 2026-07-21 画布图片生成节点提示词可读性（已发布）

- 当前唯一 `/canvas` 图片生成节点原宽度为 `410px`，提示词框默认最小高度 `124px`，正文仅 `13px` 且没有明确字重。现通过现有画布样式过渡层将节点默认宽度提高到 `480px`（窄屏保留视口上限），提示词框提高到 `168px`，正文改为 Windows 优先中文字体、`15px`、`600` 字重和 `1.8` 行高，placeholder 同步加深。
- 样式严格限定在 `.vue-flow .image-prompt-generate-node` 与其 `.prompt-input`，不修改节点 JSON、提示词内容、连线、缩放、生成逻辑或历史项目数据，也不会命中首页、用户中心、后台或 Chat。旧节点和新节点均直接使用同一显示规则，输入框仍可手动纵向拉伸。
- 画布资产断言、操作性能回归、后端/画布边界 smoke 和 `frontend` Vue 完整构建通过。生产浏览器实测计算值为节点 `480px`、提示词框 `168px`、正文 `15px/600`、行高 `27px`，截图人工检查文字清晰；验收没有调用 Provider。
- 发布前活动任务为 `pending=0、running=0`，一致性备份为 `docker/backup/internal-prod-20260721-114800`。正式 app 镜像为 `sha256:059e38b6fb1a253858ccce73182098d3518d09323b45a7559dccd2f7e7cf5299`（创建 `2026-07-21T03:49:17.866751293Z`，启动 `2026-07-21T03:49:24.971488Z`）；app、gateway、LibreChat、MongoDB 四容器全部 `healthy`。
- 生产只读 smoke、Chat 普通用户 smoke、旧资源隔离以及 `192.168.0.39:3456` 的首页、画布、用户中心、Chat 和健康接口全部通过。浏览器验收自动创建的 `示例项目 project_1784605930261_2aitwynf9` 已在同轮删除并回查 404，没有留下测试项目；用户复测画布前需执行一次 `Ctrl+F5`。

## 2026-07-21 画布图片生成节点免费 AI 提示词扩写（已发布）

- 当前唯一 `/canvas` 图片生成节点新增独立适配层 `assets/canvas-prompt-enhancer.js/css`，在提示词框右下角显示“AI 扩写”。按钮只扩写并回填可编辑文本，不调用 `/api/generate/tasks`，不会自动生图；请求期间若用户继续修改提示词，返回结果不会覆盖新编辑。
- 新增认证接口 `POST /api/canvas/enhance-prompt`：接收当前提示词和最多 4 张 PNG/JPEG/WebP 真实参考图，按画布可见顺序以 `input_image(detail=high)` 交给当前 `gpt-5.6-terra` 文本线路。编排规则要求识别图片角色、区分硬锁定与允许优化，并补齐主体、构图、场景、光影、材质、文字、成像质量和必要负面约束，目标长度约 500–900 个中文字符。
- 用户明确选择免费策略：接口固定返回 `free=true/costPoints=0`，不读取或修改用户余额；同一用户只允许一个并发扩写请求。Provider 失败或输出过短时返回错误并保留原提示词，不用本地短模板冒充真实结果；仅 `ENABLE_REAL_AI=false` 的本地 mock 环境返回明确标记的基础草稿。
- 适配层只在 `/canvas` 安装 MutationObserver；离开画布会断开 observer、取消在途请求、删除按钮/宿主 class/调试对象，不影响首页、用户中心、后台和 Chat。新资源 query 为 `20260721enhance1`。
- 本地验证通过：后端与新脚本语法、画布静态资产断言、假 Provider 多模态回归、5 张图上限、余额前后不变、完整后端/画布 boundary smoke、Vue `vue-tsc + Vite` 构建、Playwright 按钮/参考图上传/回填/不生图/离开画布 teardown 以及截图人工复核。所有测试均未调用真实 Provider。
- 用户确认发布后，活动任务为 `pending=0、running=0`；一致性备份为 `docker/backup/internal-prod-20260721-124434`。正式双 Compose 已完整重建 app，新镜像为 `sha256:81f732edba3dfb65a94402b097573b6e1d140a5337e22c787c0edfd4ca11d5ca`（创建 `2026-07-21T04:45:26.60737217Z`，启动 `2026-07-21T04:45:45.892305863Z`）；app、gateway、LibreChat、MongoDB 四容器全部 `healthy`，仍只有 gateway 暴露宿主机 `3456`。
- 生产只读 smoke、旧资源隔离、未认证扩写接口 `401`、首页/画布/用户中心/后台/Chat/健康接口直连均通过；线上 `canvas-prompt-enhancer.js/css` 与主工作区 SHA-256 完全一致。Playwright 直访 `/user/center` 按预期进入登录守卫，扩写调试对象未安装且按钮/宿主数量均为 0。自动验收未调用真实 Provider、未产生费用；用户复测画布前需执行一次 `Ctrl+F5`。
- CodeGraph 本轮仍返回已删除的独立画布源码路径，已标记为索引滞后；用户没有确认刷新，因此未执行索引刷新，结构事实以 Git、实际文件系统和本文件为准。

## 2026-07-21 Docker Provider 强制代理撤回（已发布）

- 临时将外部 AI Provider 强制接入宿主机 Clash `7890` 后，真实任务连续出现 `socket hang up` 和 Cloudflare `524 origin_response_timeout`。同一账号在变更前曾以近似包装提示词成功返图；随后免费探测确认容器对 `lingsuan.top` 与 Packy 均已恢复直连，继续强制走 VPN 不再合理。
- 已完整撤回 `AI_PROVIDER_PROXY_URL`、`HttpsProxyAgent`、相关依赖、Compose 环境变量和回归脚本，恢复变更前的 Docker 直连行为；没有修改 Clash、TUN、Windows 路由或用户项目数据。
- 两个失败任务均未写入生成扣费流水，用户余额保持 `415`。两条当前图片线路仍都指向 `https://lingsuan.top`，其中一条失败响应明确由其 Cloudflare 返回，Ray ID 为 `a1e88c0a2b9c51ae`；中转源站超时仍需线路方处理，切换这两条同域线路不能规避。
- 最新一致性备份为 `docker/backup/internal-prod-20260721-155357`。恢复后的 app 镜像为 `sha256:17acdbad9309a29dc43a9137edb5e9b5974375846d6708b3364669a4ecc08464`（创建 `2026-07-21T07:55:40.455464336Z`，启动 `2026-07-21T07:56:01.926975971Z`），四个正式容器全部 `healthy`。
- 容器内确认不存在代理环境变量，直连 `lingsuan.top` 免费 HEAD 返回 HTTP `403`、耗时约 `2.45s`；生产 smoke、旧资源隔离和首页、画布、用户中心、后台、Chat 均通过。为避免再次触发上游计费，本轮没有自动重试真实生图。

## 2026-07-21 画布大参考图上传稳定性（已发布）

- 真实任务对比确认失败集中在 `3840×3840`、单张约 12–14MB 的参考图；同一生产镜像下约 232–318KB 的参考图可以成功，基础 DNS/TCP/HEAD 可达不能代表大体积 `/v1/images/edits` multipart 稳定。
- 当前画布在请求 `/api/generate/tasks` 前只处理出站副本：最长边超过 `2048` 或体积超过 `4MB` 时使用高质量缩放并编码为 WebP；Data URL、同源 `/uploads`/图片代理 URL 和 `blob:` 均进入该链路，跨域 URL 不由浏览器擅自抓取。原画布图片、项目 JSON、历史资产和本地文件均不改。浏览器回归把 `3840×3840`、11,452,278 字节的 PNG 副本压为 `2048×2048`、45,354 字节 WebP，`800×600` 小图保持字节不变，同源 URL 成功转换为出站 Data URL。
- 后端在构造 Provider multipart 前增加单图 `5MB` 护栏；超限任务返回 `PROVIDER_REFERENCE_IMAGE_TOO_LARGE`，不触达 Provider、不扣本地算力、不写生成历史。底层 `ECONNRESET/socket hang up` 现在会显示“上传连接被重置”及 `cause.code`，但图生图 POST 仍不自动重试，避免重复上游费用。
- 相关缓存 query 已更新为 `20260721refcompress2`；静态资产、浏览器压缩、假 Provider 超限不触达、尺寸/适配器、disposable API、后端/画布边界、Vue 构建和生产只读 smoke 均通过。
- 发布前活动任务为 `pending=0、running=0`；一致性备份为 `docker/backup/internal-prod-20260721-173217`。首次构建因旧资产补丁脚本只识别历史 query 而失败，旧生产容器保持健康；后续 Chromium 验收又捕获并修正了补丁字符串中的 URL 正则转义，最终正式双 Compose 完整重建成功。app 镜像为 `sha256:2036d4ab36971b09ba2a1f63d5071b29e61baf59846ff2b43df62c4436d5d317`（创建 `2026-07-21T09:51:54.702682879Z`，启动 `2026-07-21T09:52:01.577283321Z`），四个正式容器全部 `healthy`。
- `192.168.0.39:3456` 的首页、画布、用户中心、后台、Chat 和健康接口均为 200；线上画布 SHA-256 与 main 一致。app 内无代理环境变量，直连 `lingsuan.top` 免费 HEAD 返回 403、约 1.5 秒。本轮没有发起真实生图或产生费用；用户首次复测画布前需要 `Ctrl+F5`。

## 2026-07-22 图片 Provider 定向代理恢复（已发布）

- 最新失败任务 `task_mruhq0e1fe1d03c3` 与 `task_mruhu1sq50a1bd95` 均已由正式 gateway 接收并返回 202，随后分别在 Provider 上传阶段出现 `ETIMEDOUT` 与 `ECONNRESET`；不是浏览器未提交，也不是 5MB 护栏拒绝。中转后台没有记录是因为连接没有形成完整的上游 HTTP 请求。
- 用户授权的一次受控真实测试 `task_mrveq1ed8585d440` 使用本地生成的 16,691 字节 PNG 和复制数据库，仍在三次 TLS 建连中以 `ECONNRESET` 失败，`preTlsRetryCount=2`；复制库余额保持 `380`，生产余额和生产数据未写入。这排除了“大图上传”是本次连接故障的必要条件。
- 火绒网络修复后的分层探针确认 Windows 系统代理关闭、WinHTTP 直连、用户/系统/正式容器代理环境变量为空。宿主机访问 lingsuan 可走 IPv6，Docker 直连其 IPv4 超时；Docker 通过 `host.docker.internal:7890` 使用现有 Clash 能立即得到 HTTP 404，因此根因是 Docker 到该域名的直连 IPv4 路径，不是系统 Proxy 被修改。
- 已加入 MIT 依赖 `https-proxy-agent@7.0.6`。正式双 Compose 只设置 `LINGSUAN_IMAGE_PROXY_URL=http://host.docker.internal:7890`；`server.js` 仅让主机名精确为 `lingsuan.top` 的图片 HTTPS 请求走代理，文本、Packy/其他 Provider 和 HTTP 假 Provider保持直连，容器全局 `HTTP_PROXY/HTTPS_PROXY/ALL_PROXY` 均为空。
- 未命中定向代理时仍保留 IPv4 keep-alive、DNS 地址轮换和仅建连前最多 2 次安全重试；普通 `socket hang up/ECONNRESET` 不重放。图生图任务新增脱敏 `transportMode`，不记录代理地址、凭据、图片、提示词或 Key。
- 定向路由红绿回归、pre-TLS、适配器、正常/超限图生图、54 组尺寸、Chat 图片工具、一次性 API、后端/画布边界 smoke 与 Vue 构建全部通过。候选镜像和正式容器分别通过 3/3 免费代理 HEAD，均成功触达中转站。
- 发布前活动任务为 0，一致性备份为 `docker/backup/internal-prod-20260722-101000`。正式 app 镜像为 `sha256:52aec167cd9cf1a497397eee1531bc67ca09f25460a74b2348f7d893cbb5605c`（创建 `2026-07-22T02:08:58.935616126Z`，启动 `2026-07-22T02:10:50.546054751Z`）；app、gateway、LibreChat、MongoDB 四容器全部健康。
- 生产 smoke 和 `192.168.0.39:3456` 的首页、画布、用户中心、后台、Chat、健康接口全部为 200；旧资源隔离仍通过。发布后未自动执行付费生图，最终图片返还需用户只提交一次新任务验证；本次仅后端和 Compose 变化，无需强刷浏览器。

## 2026-07-22 回退至昨日中午生图链路（已发布，覆盖上一节）

- 按用户要求从生产 SQLite 定位到 2026-07-21 中午前最后一个成功记录：本地时间 `11:42:30`（数据库 UTC `03:42:30`），生成记录 `gen_mru3y5gbc3bcca54`，模型 `gpt-image-2`，状态 `completed`。紧随该节点的一致性备份为 `docker/backup/internal-prod-20260721-114800`；该备份只含数据，不含源码，且当时 Docker 镜像已被清理，因此源码行为依据当天会话日志与资源 query 复原。
- 回退只覆盖图片生成出站链路，不回滚当前 SQLite、上传文件、用户项目、余额或 Chat 数据。操作前活动任务为 `pending=0、running=0`，当前数据一致性备份为 `docker/backup/internal-prod-20260722-104926`。
- 已撤回中午后加入的定向 Clash 代理、`https-proxy-agent`、图片专用 IPv4 agent/DNS 轮换、5MB 后端护栏和画布 2048/4MB 出站压缩；恢复 Node 默认 HTTPS 直连，以及画布 `20260717reversecopy1` 参考图处理行为。容器未设置 `LINGSUAN_IMAGE_PROXY_URL` 或全局 `HTTP_PROXY/HTTPS_PROXY/ALL_PROXY`。
- 适配器、pre-TLS、队列、54 组尺寸、画布资产、前端构建、一次性 API、后端/画布边界和 Compose 检查均通过。正式 app 镜像为 `sha256:c3cea04b0cc34f89aeb5652c8fbc2d1cb081a32d220ff3706478dc904969b266`（创建 `2026-07-22T03:03:06.285092893Z`，启动 `2026-07-22T03:03:25.863415854Z`），四个正式容器全部健康。
- 生产 smoke、旧资源隔离及 `192.168.0.39:3456` 的首页、画布、用户中心、后台、Chat、健康接口均通过。回退后的容器默认直连免费 HEAD 连续 3 次约 5 秒超时，说明代码已复位但当前 Docker 到中转域名的直连网络状态与昨日中午不同；本轮未发起付费生图，不能据此宣称真实返图已恢复。画布资源 query 已回退，用户复测前需 `Ctrl+F5`。
- 用户随后明确要求真实出图测试。唯一任务 `task_mrvi9x06eec6b09e` 使用现有 1,231,012 字节、1024×1024 PNG 参考图，走 `高速专线 img2 / gpt-image-2` 的 `/v1/images/edits`，请求被主站正常接受并从 `pending` 进入 `running`，约 21.5 秒后以 `ETIMEDOUT` 失败；任务元数据显示 `transportMode=https-default-direct`，证明失败仍位于 Docker 默认直连 Provider 的网络阶段。未提交第二次任务，管理员余额保持 `999959`，没有新增扣费。
- 用户新加的独立路线为 `packyapi`（`pub_route_mrvhcfjybdb7efd6`，`https://www.packyapi.com`）。用户任务 `task_mrvihcpx82a601ae` 已明确命中该路线：2 张 PNG 共 2,611,708 字节、1024×1024、`/v1/images/edits`，约 18 秒后以 `ECONNRESET` 失败，余额保持 `380` 且无新增生成记录或扣费。容器对相同 Packy endpoint 的无 Key HEAD 在约 3.3 秒返回 403，说明域名基础连通，但真实 multipart/Provider 处理未成功。检测到该用户任务在途时，Codex 的第二次测试提交被安全检查主动停止，没有创建重复任务。
- 后续复核确认该新路线实际保存为通用 `apiFormat/requestFormat=new-api`，因此没有命中项目已有的 `packy-images` 严格硬接适配器；这不是参考图体积护栏导致。现有回归已证明严格适配器只发送 `model/image/prompt/size/quality/output_format/n`（多图重复单数 `image`），不发送 `response_format/stream/partial_images/background/moderation/input_fidelity`，并兼容 URL、Base64、JSON 或 SSE 返回。
- 活动任务为 0 后生成一致性备份 `docker/backup/internal-prod-20260722-112609`，仅将 `pub_route_mrvhcfjybdb7efd6` 切换为 `packy-images`；Key、模型、价格和其他路线保持不变。正式 app 完整重建为镜像 `sha256:1aa02a9684c56a6758b02242decc30f113776b812b6bb1076b31c7365ab89284`（创建 `2026-07-22T03:27:48.935098214Z`，启动 `2026-07-22T03:28:10.841703791Z`），四容器健康、生产 smoke 通过，Packy 格式跨重启保留。
- 严格硬接真实验收任务 `task_mrviwwh4a187fc4c` 使用 2 张 PNG（1,231,012 + 1,011,134 字节）、重复单数 `image`、1024×1024、low，经 `https-default-direct` 成功返图。结果为 `/uploads/generated/d0b8900b9927660f3eef4a11f9532244.png`，文件 1,004,794 字节、1024×1024，生产 URL 返回 200；管理员仅按成功结果扣 10 点（`999959 → 999949`）。Packy 路线已恢复，lingsuan 默认直连超时仍是独立未解决问题。
- 用户要求继续测试其余两条线路。使用与 Packy 成功任务完全相同的 2 张参考图、提示词、1024×1024、low 参数串行各提交一次：`官转gpt-img2` 任务 `task_mrvj4v6ia5c95ccf` 在 21,353ms 后 `ETIMEDOUT`，`高速专线 img2` 任务 `task_mrvj639j8a868d87` 在 21,338ms 后同样 `ETIMEDOUT`。两者均为严格 `lingsuan-images`、重复 `image[]`、`https-default-direct`，余额保持 `999949` 且无新增扣费；随后无 Key HEAD 仍在约 5 秒超时。结论是两条站内线路虽名称与 Key 不同，但共享 `https://lingsuan.top` 的当前 Docker 直连故障，切换二者不能绕过；当前可用真实出图路线为 Packy。

## 2026-07-22 lingsuan 图片定向代理再次恢复（已发布，覆盖默认直连结论）

- 同输入对照与分层探针最终确认：官转和高速专线并非两条独立网络路径，二者都连接 `lingsuan.top`；Docker/宿主机直连 IPv4 均无法完成 TCP 建连，宿主机直连 IPv6 可达，但 Docker 容器 IPv6 返回 `ENETUNREACH`。Docker 到 `host.docker.internal:7890` 的 HTTP CONNECT 在约 11ms 内成功，因此失败点是当前 IPv4 出站路径，不是图片、提示词、Key、适配器、队列或计费护栏。
- 经用户确认重新加入 MIT 依赖 `https-proxy-agent@7.0.6`。`server.js` 只对主机名精确为 `lingsuan.top` 的图片 HTTPS 请求注入 `HttpsProxyAgent`；Packy、其他图片域名、文本请求和 HTTP 假 Provider 均不注入该代理。正式容器只设置 `LINGSUAN_IMAGE_PROXY_URL=http://host.docker.internal:7890`，全局 `HTTP_PROXY/HTTPS_PROXY/ALL_PROXY` 保持为空，Windows 用户/系统代理和 WinHTTP 均未修改。
- 定向代理行为回归、Packy/Lingsuan 严格适配器、pre-TLS、队列、Chat 图片工具、54 组尺寸、一次性 API、后端/画布边界、Vue 构建、双 Compose 和官方 registry 依赖检查均已执行。官方 `npm audit` 仍报告项目原有 4 个间接依赖问题（1 low、2 moderate、1 high），本轮没有用破坏性升级混入紧急网络修复。
- 发布前活动任务为 `pending=0、running=0`，一致性备份为 `docker/backup/internal-prod-20260722-130026`。最终正式 app 镜像为 `sha256:494af9881703ab78c686495c811746ac297762a3ca3dba74b7237ac4ed0d373e`（创建 `2026-07-22T05:04:25.677671664Z`，启动 `2026-07-22T05:04:48.687154435Z`）；app、gateway、LibreChat、MongoDB 均为 `healthy`。
- 最终正式容器内无 Key、无费用探针确认：lingsuan 经定向代理在 799ms 返回 HTTP 404，Packy 保持默认直连并在 1125ms 返回 HTTP 403；两个状态均证明 TCP/TLS/HTTP 已建立。生产 smoke、旧资源隔离及 `192.168.0.39:3456` 的首页、画布、用户中心、后台、Chat、健康接口全部通过。
- 用户确认后只提交一次生产真实图生图任务 `task_mrvmoep3457ee321`，固定命中“高速专线 img2”与 `https://lingsuan.top/v1/images/edits`。两张 PNG 参考图共 2,242,146 字节，以重复 `image[]`、`1024x1024`、`low`、单图请求发送；任务通过 `https-proxy` 在约 45.1 秒进入 `success`，`preTlsRetryCount=0`，没有重试或切换线路。
- 结果 `/uploads/generated/96571fa1fa352aa8aa8b4d2e57062e3b.png` 已真实落盘：1024×1024、1,059,847 字节、PNG，生产 URL 返回 HTTP 200 且下载字节一致。新增生成记录仅 `gen_mrvmpcck75004ed4` 一条；管理员余额 `999949→999939`，仅新增一条 `-10` 生图流水。修复后的 lingsuan 真实 multipart、返图持久化和成功后单次扣费闭环均已验证。
- 用户随后确认三条线路使用完全相同输入各复测一次，三次均串行且没有重试或回退：官转 `task_mrvn67doe2a8727b` 与高速 `task_mrvn7hbn55b2af53` 均在约 17.6 秒以 `ECONNRESET` 失败；两者确认命中各自路线、`image[]`、2,242,146 字节参考图与 `https-proxy`，均无返图、生成记录或扣费。结合高速此前约 45.1 秒成功，当前结论是共享 lingsuan/代理路径存在间歇性上传断连，不能视为稳定备用线路。
- 同轮 Packy `task_mrvn8qho2704de0d` 经 `https-default-direct`、重复单数 `image` 在约 40.1 秒成功。结果 `/uploads/generated/b1cf1b9e5ef3fc3b7444f46589e279a4.png` 为 1024×1024 PNG、1,008,284 字节，生产 URL 返回 HTTP 200；仅新增生成记录 `gen_mrvn9lf51eff3491` 和一条 `-10` 流水，余额 `999939→999929`。本轮复测后活动任务为 0，当前稳定可用路线仍是 Packy。

## 2026-07-22 Clash 直连覆盖与三线恢复（已生效）

- 复核确认此前 Clash Party 没有针对 `lingsuan.top`、Docker 或 `host.docker.internal` 的自定义规则；原 `override.yaml` 为 `items: []`。Docker 仅通过 `LINGSUAN_IMAGE_PROXY_URL=http://host.docker.internal:7890` 把灵算图片请求交给 Clash，因而命中了原配置末尾的 `MATCH` 并使用 VPN 节点。Windows 系统代理、WinHTTP 与容器全局 `HTTP_PROXY/HTTPS_PROXY/ALL_PROXY` 均未改动。
- 修改前已备份 Clash Party 配置到 `docker/backup/mihomo-party-before-lingsuan-direct-20260722-135518`。新增持久化全局覆盖 `override/lingsuan-direct.yaml`，以 `+rules` 把 `DOMAIN-SUFFIX,lingsuan.top,DIRECT` 插入规则首位；重载后生成配置第 1177 行命中该规则，Mihomo 配置检查退出码为 0。
- 正式容器经 `7890` 连续 5 次无 Key HEAD 均返回 HTTP 404，耗时 649–2602ms；Clash 核心日志逐条显示 `match DomainSuffix(lingsuan.top) using DIRECT`。官转与高速两个 Key 的无费用 `/v1/models` 鉴权均返回 HTTP 200，排除 Key 失效。
- 同输入真实测试中，高速 `task_mrvofoux91284e5d` 约 62.7 秒成功，生成 `/uploads/generated/dd2e0eedcc73a920c628ce362a0c462f.png`（1024×1024、1,065,379 字节）；Packy `task_mrvohobed0186240` 约 47.7 秒成功，生成 `/uploads/generated/44af8de188f5a4f24aac2556bc07528f.png`（1024×1024、990,626 字节）。
- 官转首次 `task_mrvoeka9a8b2afb8` 仍在约 17.6 秒被上游以 `ECONNRESET` 重置，没有返图、生成记录或本地扣费；间隔数分钟后的唯一受控复测 `task_mrvolm0c0abfccb6` 约 80.2 秒成功，生成 `/uploads/generated/a95c6c6a52bd686af4038d6e22a7361b.png`（Provider 实际返回 1254×1254、1,534,826 字节）。普通歧义 POST 仍不自动重试。
- 三张成功图均为有效 PNG，生产 URL 均返回 HTTP 200 且下载字节与落盘一致。只新增三条完成记录与三条 `-10` 流水，管理员余额 `999929→999899`；首次失败未扣费。最终 `pending=0、running=0`，四个正式容器健康，普通用户 `/api/user/routes?group=image` 可见官转、高速、Packy 三条路线均为 `enabled/active` 且包含 `gpt-image-2`。本轮只修改宿主机 Clash 覆盖和文档，未修改应用源码、Docker 配置或生产镜像，因此未重建现有 app 镜像。

## 2026-07-22 画布 1:1 返图比例偏差诊断（未改代码）

- 项目 `project_1784280159585_crccxjfjt` 的图片生成节点 `node_202` 实际保存 `size=1x1`；画布提交层会将 `1x1/1X1/1×1` 统一为站内 `ratio=1:1`，Provider 适配器再转换为像素 `size`。严格 `lingsuan-images` 出站不发送非官方 `ratio` 扩展字段，因此后台 Provider JSON 不出现 `ratio` 是既定契约，并非比例在前端丢失。
- 截图中的两张竖图分别来自 `task_mrvqnpd47d11efc6` 与 `task_mrvqr9xf19740577`；两笔真实出站均为 `/v1/images/edits + size=1024x1024 + quality=low`，但上游原始 PNG 分别为 `1139×1381`、`1058×1486`，后端已记录 `PROVIDER_IMAGE_ASPECT_RATIO_MISMATCH`。偏差发生在上游返图，不是本地展示拉伸或落盘改尺寸。
- 用户随后实际以当前节点的 `4K + 1:1` 发起 `task_mrvr2lgzd00d1249`；出站已正确升级为 `size=2880x2880 + quality=high`，但上游约 128 秒后返回 HTTP 502，未生成图片、未完成本地扣费。截图中当前“4K”选择不能反推此前两张已有结果也是 4K 请求。
- 本轮只做只读诊断与现有无费用适配器测试，没有修改源码、线路、Clash、Docker 或生产镜像，也没有由 Codex 发起真实生图。不能用把官方像素 `size` 改成 `1X1` 的方式修复：`1X1` 仅是站内兼容输入格式，Provider 的尺寸字段仍应是 `1024x1024/2880x2880`。

## 2026-07-22 Clash 关闭与灵算断连复核（未改代码）

- 用户确认刚才关闭并重新打开 Clash。任务 `task_mrvrhxlje1961568` 与 `task_mrvrhz4b241a20f6` 分别在 `15:29:30`、`15:29:32` 立即失败，底层错误均为 `connect ECONNREFUSED 192.168.65.254:7890`；Clash core 日志显示 `15:29:42` 才重新开始监听 `127.0.0.1:7890`，时间线完全吻合。
- 当前链路是 `Docker -> host.docker.internal:7890 -> Clash DIRECT -> lingsuan.top`。`DIRECT` 表示 Clash 收到请求后不使用 VPN 节点，并不表示 Docker 绕过 Clash 进程；因此单纯更换节点不会改变灵算出口，但关闭 Clash、切配置导致 core 重载或在上传中切换时会造成瞬时拒绝/断连。
- 复核时 7890 已由 mihomo 重新监听，生成配置和持久覆盖均保留 `DOMAIN-SUFFIX,lingsuan.top,DIRECT`。容器无 Key 免费 HEAD 连续 5 次为 4 次 HTTP 403 到站、1 次 `ECONNRESET`；core 日志逐条显示灵算命中 `DIRECT`。说明关闭造成的本地拒绝已恢复，但灵算直连仍存在独立的间歇 reset。
- 本轮没有发送真实生图、没有修改 Clash、代码、Compose 或生产镜像。

## 2026-07-22 服务器部署前生图门禁复核（可准备部署）

- 本轮没有由 Codex 发起付费请求，而是监测用户已提交任务。Packy 任务 `task_mrvs30bp6d4cce16` 以 `/v1/images/edits + size=2880x2880 + quality=high` 经默认直连成功，原始 PNG `/uploads/generated/af6e1a76652216abb620d68472e072fa.png` 为准确 `2880×2880`、9,084,705 字节。
- Clash 恢复后的高速专线任务 `task_mrvs3721bfeab920` 以两张参考图、`1024x1024 + low` 经 `https-proxy` 成功，原始 PNG `/uploads/generated/c3e39cd32db5fc094bb5ba61c0e5d559.png` 为准确 `1024×1024`、1,182,373 字节；同一恢复窗口此前另有三笔高速 1K 成功。两张结果的正式 `192.168.0.39:3456` URL 均返回 HTTP 200。
- 正式 app 镜像仍为 `sha256:494af9881703ab78c686495c811746ac297762a3ca3dba74b7237ac4ed0d373e`，容器健康且 failing streak 为 0；四个正式容器健康，`/api/health` 数据库正常，生产只读 smoke 全部通过。免费灵算 HEAD 本轮 5/5 到站。
- 当前满足“至少能真实生图”的部署门槛，但不能宣称全部档位稳定：高速专线一笔 4K 任务 `task_mrvryxhr360ba620` 仍返回 524。部署前应等待当前用户活动任务全部终态并生成一致性备份。
- 服务器不能无条件照搬本机 `LINGSUAN_IMAGE_PROXY_URL=http://host.docker.internal:7890`：Packy 默认直连不依赖 Clash；灵算应先验证服务器自身 IPv4/IPv6 直连，直连可用时将该变量置空，不能直连时配置服务器可达的稳定 CONNECT 代理。`CHAT_PUBLIC_ORIGIN` 同步改为服务器实际地址。

## 2026-07-22 目标服务器灵算直连覆盖（已准备，未应用本机）

- 用户明确目标服务器不部署 Clash，直接访问图片中转。新增 `docker/docker-compose.server-direct.yml`，只覆盖 app 的 `LINGSUAN_IMAGE_PROXY_URL` 为显式空字符串；服务器启动时把该文件放在基础 Compose 与 Chat 正式覆盖之后。
- 双配置解析已验证：当前工作站两文件组合仍为 `LINGSUAN_IMAGE_PROXY_URL=http://host.docker.internal:7890`；追加服务器覆盖后三文件组合为 `LINGSUAN_IMAGE_PROXY_URL=""`。两套 `docker compose config --quiet` 均通过，互不串线。
- `docker/README.md` 与 `docs/internal-production-runbook.md` 已写入服务器直连命令、迁移步骤和无 Key 到站门禁；源码发布包测试新增服务器覆盖文件为必需项，打包、排除项、字节数与 SHA-256 清单测试通过。
- 该覆盖文件尚未用于当前 3456，本机生产容器、Clash 规则和镜像均未变，因此本轮不重建当前正式 app。实际服务器启动前仍需先验证服务器 Docker 容器可直连 `lingsuan.top:443`。

## 2026-07-22 当前内网宿主机与 Clash 解耦

- 用户澄清需要保留 Windows 系统代理供 Codex 联网，修复对象是当前 `192.168.0.39` Docker Desktop 宿主机。只读探针确认 Windows 用户代理仍为 `127.0.0.1:7890`，旧正式 app 同时设置了 `LINGSUAN_IMAGE_PROXY_URL=http://host.docker.internal:7890`，因此关闭或重载 Clash 会直接中断灵算图片请求。
- 在不关闭系统代理和 Clash 的情况下，正式 app 容器对 `https://lingsuan.top/v1/models` 的无 Key 直连探针切换前后均连续 10/10 到站。正式 app 已使用常规两文件生产命令完整重建，运行环境为 `LINGSUAN_IMAGE_PROXY_URL=`；镜像 `sha256:5c9877f80107cfb76586f1211ed5812a8fcf922f28224f1f6e462e1ce0b41cf7`，创建时间 `2026-07-22T09:16:22Z`、容器启动时间 `2026-07-22T09:16:40Z`，容器 healthy、重启次数 0、生产健康接口 200、只读 smoke 通过。
- `docker-compose.chat-production.yml` 的默认值同步改为空；今后常规两文件重建也保持 app 直连。宿主机系统代理继续服务 Codex，应用容器不再依赖 Clash 的 7890 入口；只有 `.env` 明确填写时才启用图片专用代理。目标服务器覆盖仍保留，用于显式阻止迁移环境带入代理值。
- 切换前用户自然提交的最新任务已成功返回约 1.98MB 图片，四个正式容器均未发生重启；本轮没有由 Codex 发起付费生图。
