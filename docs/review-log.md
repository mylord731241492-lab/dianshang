# 审查与复核记录

## 当前基线提示

当前 `main` 已回滚到 `51d4dab fix: improve canvas production performance guards`。复核任何问题前先读 `docs/current-baseline.md`，再按日期查本文件。

本文件是复核历史，不是当前实现清单。尤其是 2026-07-06/07 的生图链路实验，在本次回滚后的 `main` 中不属于当前基线。

## 审查规则

每轮完成后记录：

- 已验证的命令和页面。
- 新发现的风险。
- 未覆盖的测试。
- 需要人工确认的事项。
- 下一轮优先级。
- 优先复用已有接口、成熟开源项目和当前技术栈能力，不重复造轮子；新增能力前先确认是否已有 New-API、CPA、Docker Compose、现有 `/api/*` 或前端模块可复用。

## 2026-07-13 Chat MCP 工具续传 409 复核

### 已验证

- 截图、app 日志和 SQLite 一致证明 `prepare_image_generation` 已成功报价；失败发生在 LibreChat 把工具结果交回文本模型时，旧 `chat_text_charges` 已被第一段 `tool_calls` 过早置为 `completed`。
- 新增的 `scripts/test-librechat-tool-continuation.js` 使用临时数据库和本地假 Provider 直达真实集成路由。修复前同一消息的第二段稳定返回 `409 CHAT_REQUEST_COMPLETED`；修复后第二段 200、最终回复正确、余额只减少 5 点，完全相同的第二段重放仍返回 409。
- `chat_text_steps` 只记录消息内步骤指纹和状态，不保存提示词、工具结果或 Provider Key；合法续传必须以尾部工具消息对应前一条 assistant `tool_calls`，不能仅凭相同消息 ID 绕过幂等。
- `node --check server.js`、`scripts/smoke-api-disposable.ps1`、`scripts/smoke-librechat-integration.ps1 -BaseUrl http://127.0.0.1:3464` 均通过。
- 3464 app 已完整重建，容器 healthy；镜像 ID `sha256:454aea5749b17ffaa31739e022d15ce31f0bafc5f84e29582641ea0c68dabbf1`，创建时间 `2026-07-13T06:44:22.38772197Z`，容器启动时间 `2026-07-13T06:44:50.31017249Z`。
- app 重建使 LibreChat 中已有 MCP 长连接同时中断，第一次完整 smoke 命中 LibreChat 15 秒内存熔断器；只重启测试 LibreChat 容器清理熔断状态后，完整 smoke 重跑通过。该过程未修改 MongoDB 或正式 3456。
- 运行库已存在 `chat_text_steps`；预览账号余额保持 95，未发生本轮 Provider 调用。正式 `http://192.168.0.39:3456/` 返回 200，未切换或重建。

### 剩余风险

- 截图中的一次性报价已过期，不能用于真实执行；需重新发起生图请求，并在下一条用户消息输入新确认码。
- 本轮遵守费用门禁，没有执行真实图片 Provider；图片消息展示、生成历史和真实图片扣费仍需一次人工付费验收。
- 按当前 `gpt-5.5=5`、`gpt-image-2=10` 配置，重新请求报价与下一条消息确认会产生两次文本费用和一次图片费用，完整验收预计合计 20 点；测试账号当前 95 点足够执行。

## 2026-07-13 Chat 真实测试模式恢复复核

- 用户看到“本地 mock 回复”后，容器内脱敏状态确认 `ENABLE_REAL_AI=false`，而 Base URL 与 Key 仍存在；说明是运行开关回退，不是中转配置丢失，也不是工具续传 409 再现。
- 根因是最终 app 重建直接使用 `docker-compose.chat-test.yml`，该文件为避免误付费把 `CHAT_TEST_ENABLE_REAL_AI` 默认设为 `false`。
- 使用既有 `scripts/start-librechat-real-test.ps1 -Port 3464` 从主站 `data.db` 只读加载已保存文本线路并重新创建测试栈；未输出 Key，未发送 Provider 请求。
- 运行容器确认 `ENABLE_REAL_AI=true`、Provider 地址和 Key 均已配置；四容器 healthy，完整无费用 LibreChat smoke 通过。
- 预览账号余额仍为 95，最新 charge 仍是此前报价消息的 `completed / 5`，Mock 消息没有产生新扣费。
- 后续重建 3464 真实测试 app 必须走专用脚本；Compose 的 Mock 默认值保留，避免普通 smoke 或误操作产生真实费用。

## 2026-07-13 Chat 内置 MCP 测试充值复核

- 用户明确要求为 3464 当前测试账号增加 100 点。
- 现有后台接口按增量语义执行，余额从 0 变为 100，流水记录 `before=0`、`after=100`、`change=100`。
- 本轮没有发送 Chat 消息、调用文本模型或生图 Provider；正式 3456 数据未受影响。

## 2026-07-13 Chat 内置 MCP 复核

### 已验证

- 固定 LibreChat `v0.8.6-rc1` 源码包可重复应用新增补丁，后端构建文件语法通过。
- `hajimi-website` 配置为 `chatMenu: false`，后端构建临时 Agent 时始终合并该 MCP，已有用户选择不会丢失。
- 侧栏“MCP 设置”、智能体“添加 MCP 服务器工具”和聊天 `hajimi-website` 勾选项在登录态 DOM 中均不存在；Skills 和消息输入仍正常。
- 3464 新镜像 healthy；完整无费用 Chat smoke 通过，MCP endpoint 仍公开 `prepare_image_generation` 与 `execute_image_generation`。

### 风险与未覆盖

- 本轮没有发送文本、报价或生图请求，没有产生 Provider 费用；当前测试账号余额为 0。
- 真实模型是否按指令先报价、下一轮确认后执行，仍需补充算力并由用户确认后验收。
- 正式 `3456` 未重建或切换，当前改动仅部署于 3464 隔离测试栈。

## 2026-07-13 lingsuan 真实文本成功验收复核

### 已验证

- lingsuan 文本线路已保存完整 Base URL、独立 Key、`/responses` 和 `gpt-5.5`，脱敏检查通过。
- 经用户明确确认，Codex 仅发送一次请求 `manual-lingsuan-retest-1783917466339`，上游返回 HTTP 200、正文 `OK`。
- 对应 charge 为 `completed`；测试账号余额从 5 扣为 0，无退款或重复请求。
- 测试栈四容器均为 healthy。

### 风险与未覆盖

- 上游报告 4686 输入 Tokens、5 输出 Tokens，虽然主站当前按固定 5 点扣费，但 Provider 实际 Token 消耗需要持续关注。
- 本次验证的是主站集成桥接，未在 Chat 页面再发第二次付费消息；当前账号余额为 0。
- 真实 MCP 生图和正式 `3456` 切换仍未执行。

## 2026-07-13 lingsuan 文本线路地址修正复核

### 已验证

- 3464 文本线路已保存完整 Base URL `https://lingsuan.top/v1`，保留 `/responses`、`gpt-5.5` 和启用状态。
- 本次仅保存配置并读取脱敏状态，没有请求 Provider、没有扣点，账号余额仍为 5。
- 测试栈四容器均为 healthy。

### 风险与未覆盖

- 当前线路没有独立保存 API Key，会使用全局 Key；若全局 Key 属于 Packy，则不能用于 lingsuan。
- 用户仍需在后台填入 lingsuan 对应 Key，之后的真实鉴权和模型响应尚未验证。
- 正式 `3456` 未重建或切换。

## 2026-07-13 LibreChat 真实文本重新测试复核

### 已验证

- 用户明确确认一次真实文本测试后，Codex 只发送请求 `manual-retest-1783917204270`，未自动重试。
- 请求失败原因为当前测试库文本线路 Base URL 保存成 `lingsuan.top/v1`，Node Fetch 报 `Invalid URL`，未连接 Provider。
- 对应 5 点预扣已原路退款，账号余额仍为 5；另有一笔更早的同类浏览器请求同样完成退款。

### 风险与未覆盖

- 本次不能用于判断 Packy 或 lingsuan 模型稳定性，因为 URL 在发出网络请求前已被拒绝。
- API Key 必须与所属平台的完整 Base URL 配套，修正配置后不得在未确认的情况下自动发起真实测试。
- 正式 `3456` 未重建或切换。

## 2026-07-13 LibreChat 真实文本最终人工验收复核

### 已验证

- 3464 测试栈 app、MongoDB、LibreChat、gateway 四容器均为 healthy。
- 同一预览账号的请求 `6ecdd80a-b264-4e56-b2ee-f4622df368a4` 在 Mongo 中保存文本“收到。”，对应 `chat_text_charges.status=completed`。
- 随后的请求 `ae66f2d8-faee-4bfc-8ff0-8856042f15b5` 收到 Packy `status=completed`、`error=null`、`output=[]`；对应 charge 为 `refunded`，页面显示“本次请求已自动退款”，没有出现自动重试后的 409。
- 当前预览账号余额为 5，证明一笔成功扣 5 点、一笔失败退 5 点的账务结果正确。

### 结论与风险

- 账号映射、余额同步、幂等扣费、失败退款和 SSE 中文兜底均已通过真实请求验证。
- 剩余故障位于当前 Packy `gpt-5.5 /responses` 上游兼容性/稳定性：相同接入链路既能返回“收到。”，也可能返回空 `output`。
- 不增加空响应自动重试；上游已接受并完成一次请求时，重试可能再次消耗 Provider 额度。
- 本轮未修改业务代码、未发起额外 Provider 请求、未执行真实生图；正式 `3456` 未重建或切换。

## 2026-07-13 LibreChat 零余额错误提示修复复核

### 已验证

- app 日志明确记录 `INSUFFICIENT_BALANCE`：需要 5 点、当前 0 点；LibreChat 同时记录 `400 status code (no body)`。
- SQLite 复核时预览账号 `chatpreview1783664988609` 余额为 0；失败请求没有生成新的 `chat_text_charges`，因此没有 Provider 调用或待退款扣费。用户随后明确授权通过 3464 后台余额接口增加 10 点，最新流水为 `admin_adjust`，变动为 0 → 10。
- 直接调用集成 Chat 接口返回 OpenAI 兼容错误体：顶层保留 `code/message/cost/balance`，嵌套 `error.message/type/code`。
- LibreChat 容器内 OpenAI SDK将同一零余额响应解析为 `400 算力不足，需要 5，当前 0`，证明原始 `no body` 症状已消除。
- 新增回归断言在旧容器上先失败；重建后 `node --check`、disposable API smoke 和完整 LibreChat 集成 smoke 均通过。

### 结论

- 本次 400 不是 Provider、TLS、Responses 请求格式或 Chat 页面故障，而是余额门禁正常生效后错误结构不兼容。
- 3464 已能向 LibreChat 展示明确中文错误；当前测试账号已有 10 点，可继续两次每次 5 点的文本验收。

### 未覆盖

- 已按用户明确授权修改 3464 测试账号余额；尚未重新发送真实文本消息，充值操作本身未产生 Provider 消耗。
- 正式 `3456` 未重建，本修复当前仅存在于 `3464` 隔离测试栈。

## 2026-07-13 Chat 已退款消息幂等提示与响应结构诊断复核

### 已验证

- 充值后产生两条不同 request ID 的真实文本 charge，状态均为 `refunded`；每条 `chat -5` 后都有对应 `chat_refund +5`，当前余额仍为 10。
- 随后的 409 来自 LibreChat 对同一消息 ID 的自动重试；幂等门禁阻止了第二次 Provider 调用，不能取消。
- 3464 现按 charge 状态区分 `CHAT_REQUEST_REFUNDED`、`CHAT_REQUEST_COMPLETED` 和 `CHAT_REQUEST_IN_PROGRESS`。
- 使用现有 refunded request ID 做无付费回归，返回“上一轮请求失败且已退款，请发送一条新消息”，余额未变化。
- Provider Responses 无文本/工具调用时会记录脱敏 `providerResponseShape`，不记录提示词、正文、Key 或 Authorization。
- `node --check`、disposable API smoke、3464 完整 LibreChat 集成 smoke 均通过，测试 app 镜像已重建。

### 结论

- 409 不是余额映射问题，而是前一次 Provider 格式异常退款后的自动重试保护。
- 当前首要问题是识别 Provider 实际 Responses shape；未采集 shape 前不应盲目放宽解析或允许相同消息 ID 重放。

### 未覆盖

- 本轮修复后没有再发起真实 Provider 请求，因此新的脱敏 shape 日志尚未生成。
- 正式 `3456` 未重建或同步。

## 2026-07-13 Provider 空 output 退款提示修复复核

### 已验证

- 第三次受控诊断的上游响应为 `status=completed`、`error=null`、`output=[]`、`tools=[]`，没有可转换的文本或函数调用。
- Mongo 中用户消息为“测试”，消息映射、conversation ID 和模型 `gpt-5.5` 均正常，排除用户文本丢失和账号映射故障。
- 第三次主站 charge 自动退款，账号余额恢复并保持 10；当前三条真实 Chat charge 均为 `refunded`。
- 空 output 现在生成正常 Chat Completion/SSE 提示，不再返回 502，因此 LibreChat 不会自动重试同一消息并覆盖成 409。
- Provider text extraction 5 个既有 Responses/choices 嵌套用例继续通过；语法、disposable API smoke、3464 完整 Chat smoke 均通过。

### 结论

- 原问题不是本地已有文本解析遗漏，而是 Packy 在当前 LibreChat Agents 长 instructions 场景实际返回空 output。
- 对空 output 退款并以 200 流式提示结束，是当前最安全的降级：不误扣主站算力，也不触发自动重复付费请求。

### 未覆盖

- 尚未用具体提示词验证 Provider 非空输出；该调用可能消耗真实 Provider Token。
- 正式 `3456` 未重建，本修复仅部署在 3464。

## 2026-07-10 Chat Provider TLS 稳定性修复复核

### 已验证

- app 容器首次 8 次 TLS 探针中 4 次复现与用户相同的握手前 `ECONNRESET`，因此反馈环直接覆盖原始故障。
- DNS 同时返回 Cloudflare IPv4/IPv6；Node 实际连接 IPv4，分别固定两个 IPv4 测试后均可成功，未发现证书、域名或单个地址持续失效。
- 宿主机 `curl` 经 `127.0.0.1:7890` 代理稳定到达上游；app 容器未配置代理，确认差异位于 Docker 直连出口。
- `fetchProvider` 只在错误码为 `ECONNRESET` 且错误文案明确包含 TLS 尚未建立时重试；共享 Agent 开启 HTTPS keep-alive。smoke 对三处真实文本调用入口和窄范围错误条件做静态断言。
- `node --check server.js`、disposable API smoke、`3464` Chat 集成 smoke 全部通过；修复后容器内 20 次无鉴权 Provider HTTPS 请求全部返回预期 401，`tlsRetries=0`。
- `3464` 首页、`/chat/`、后台设置页均返回 200；测试栈四容器 healthy；正式 `192.168.0.39:3456/` 和 `/api/health` 仍返回 200且未切换 Chat 网关。

### 结论

- 根因是 Docker 直连 Provider 的 TLS 握手链路间歇重置，不是 API Key、模型、Responses 请求体或后台设置错误。
- 修复不会重试普通 HTTP 错误、超时或已经建立 TLS 后的失败，避免盲目重放可能计费的请求。

### 未覆盖

- 本轮为避免额外费用，没有再次发起真实模型内容生成；最终业务探针由用户在后台明确确认后执行。
- 正式 `3456` 未重建或切换，生产站行为保持不变。

## 2026-07-07 当前画布真实生图生产测试复核

### 已验证

- 3458 已从 mock 切到真实 AI 调用模式，健康检查返回 `mode=real-provider-ready`、`providers.ai.enabled=true`、`imageKeyConfigured=true`。
- 当前画布提示词为“生成电商主图”，参考图已连到图片生成节点。
- 点击一次“生成图片节点”后，页面先显示 `已提交请求 12%`，随后停在 `等待返回结果 94%`，最后成功回填结果节点。
- SQLite 最新 `generations` 记录为 `gen_mra8repd7838d326`，状态 `completed`，模型 `gpt-image-2`，扣费 `10`。
- 结果地址为 `/api/proxy-image?url=https%3A%2F%2Fexternal-resources-2.packyapi.com%2Ffiles%2F2bb7f59a-3a83-4feb-a648-07e9f31c9391.png`，属于真实上游返回，不是 `/api/mock-image/...`。
- 浏览器 DOM 中 `文生图` 节点已加载，图片自然尺寸 `1022x1539`，显示尺寸约 `345x520`。

### 结论

- 当前 3458 的真实生图主链路已跑通：画布提交、后端调用 New-API/上游、数据库记录、前端结果节点回填均成功。
- 用户提供了 `admin / admin123456789`，但当前浏览器标签已有登录态，实际运行账号是 `731241492`，本次扣费发生在该用户下；生成后该用户余额为 `0`。

### 未覆盖

- 未切换到 admin 账号再跑第二次，避免重复真实扣费。
- 未做完整 `NODE_ENV=production` 启动验证；当前本地强 JWT_SECRET 不满足生产门禁。

## 2026-07-07 当前画布 mock 生图结果图复核

### 已验证

- 使用 CodeGraph 做结构入口检查后，因当前画布为压缩 bundle，本轮改用精确字符串定位结果图 URL 归一化逻辑。
- 内置浏览器在 `http://127.0.0.1:3458/canvas/project_1783402782710_xeqb6t8wr` 复现到破图：结果节点 `文生图` 的 `src` 被写成 `data:image/png;base64,/api/mock-image/...`，浏览器自然尺寸为 0，显示成小破图。
- 后端 mock 模式返回 `/api/mock-image/:seed.svg?...` 是合理相对 URL；问题在前端白名单没有放行 `/api/mock-image/`，把它误当成 base64 纯内容。
- 已在 `assets/Canvas-B8bY9_QL.js` 和 `assets/Canvas-yGc8b2gf.js` 中补齐 `/api/mock-image/` 白名单，并把已误包成 `data:image/...,(\/api\/mock-image\/...)` 的旧值解回正常 URL。
- 已把 `index.html` 主入口和两个入口 bundle 的 Canvas 动态 import query 升级为 `20260707mockimage1`。
- 已更新 `scripts/smoke-internal-prod.ps1` 的入口/Canvas query，并增加 Canvas 包必须包含 mock image URL 白名单的断言。
- `node --check` 检查四个 JS 包通过，PowerShell `PSParser` 检查 smoke 脚本通过。
- 本地 3458 刷新后，旧破图节点恢复为 `/api/mock-image/...`，自然尺寸 `1024x1024`；再次点击生成后节点数从 3 到 4，两个 `文生图` 均正常加载，`badMockWrapped=0`。

### 结论

- 本轮修的是当前画布 mock 生图结果节点显示链路，不是模型能力、真实 Provider 或后端生成逻辑。
- 当前本地 3458 mock 路径已恢复；用户截图里的小破图现象应由前端 URL 白名单缺失导致。

### 未覆盖

- 未重建 Docker，未验证 `http://192.168.0.39:3456/`，因为当前测试服务器 3456 可能走真实 Provider，需用户确认后再同步。
- 控制台仍有 `projects-BtxGnToV.js` 的本地资源迁移/JPG 转换 warning，本轮未展开，后续若出现历史记录落盘或素材恢复异常再单独排查。

## 2026-07-07 回滚后文档去混淆复核

### 已验证

- 当前 `HEAD` 为 `51d4dab`，`main...origin/main [ahead 2]`。
- CodeGraph 索引健康，当前项目仍索引 137 个文件和 102 个路由。
- 但 CodeGraph 文件列表在本次回滚后仍包含已删除的独立画布重建方案源码路径；`Test-Path` 和 `git ls-files` 已确认 `frontend/src/views/CanvasStudio.vue`、`frontend/src/stores/canvas.ts`、`frontend/src/types/canvas.ts`、`frontend/src/api/canvasRunner.ts` 和 `frontend/public/system-prompts/infinite-canvas-prompt-templates.md` 当前均不存在。
- 当前 `index.html` 主入口为 `index-DglIsp_g.js?v=20260704usercenter1`，画布辅助脚本为 `20260704canvasleave1`。
- 当前 `server.js` 约 4328 行，仍是 Express + SQLite 单体实现。
- 本轮新增 `docs/current-baseline.md`，把当前 Git 基线、备份分支、stash、生产未同步状态、阅读顺序和易混淆历史集中到一个入口。
- 本轮新增 `AGENTS.md` 的 `## Agent skills` 入口，以及 `docs/agents/issue-tracker.md`、`docs/agents/triage-labels.md`、`docs/agents/domain.md`，明确本仓库默认走本地 Markdown 工作项，不把历史日志或远端 issue 流程误当成当前开发状态。
- 本轮新增 `CONTEXT.md`，把“画布”固定为当前唯一画布；历史替代实现统一称为“已废止的独立画布重建方案”，不再用两套画布的并列叫法描述当前开发对象。

### 结论

- 后续 agent 不应直接从 `progress-report.md` 或本文件推断当前实现；必须先看 `docs/current-baseline.md`。
- 后续 agent 如需拆任务，先使用 `docs/agents/` 的本地约定；除非用户明确要求，不主动创建 GitHub issue、PR 或远端协作流程。
- 2026-07-06/07 的后续生图任务恢复和官转线路实验目前只保留在回滚前备份分支和 stash 中，不属于当前 `main`。
- 当前源码没有混入已废止的独立画布重建方案源码文件；混淆点来自 CodeGraph 回滚后索引滞后和历史日志残留。结构分析前应先刷新或复核 CodeGraph。

### 未覆盖

- 本轮没有重建 Docker，没有验证 `http://192.168.0.39:3456/` 是否已同步到本 Git 基线。
- 本轮没有修复过期验证脚本；`verify-canvas-performance-assets.js` 仍需下一步处理。
- 本轮没有刷新 CodeGraph 索引；刷新或重建索引需先得到用户确认。

## 2026-07-04 画布默认云端保存复核

### 已验证

- CodeGraph 索引正常；本轮定位到旧画布保存模式来自 `canvasSave` Pinia 状态和旧打包保存分片。
- `index.html` 启动脚本在不支持 `showDirectoryPicker` 的环境里，将缺省或旧的 `canvasSaveMode=local` 切换为 `cloud`。
- `assets/localWorkflowFileSystem-CxAxbYWk.js` 和 `assets/localWorkflowFileSystem-B3l-tt5f.js` 的 `canvasSaveMode` 默认值从 `local` 改为 `cloud`。
- `/api/settings/canvas-storage` 当前返回可用，旧画布不会因为管理员关闭云端保存而自动回退到本地。
- `node --check assets/localWorkflowFileSystem-CxAxbYWk.js`、`node --check assets/localWorkflowFileSystem-B3l-tt5f.js`、`node --check server.js` 均通过。
- `docker compose up --build -d` 已重建并替换 `dianshang-internal-app`；`verify-internal.ps1` 通过 health、API smoke、前端路由 smoke 和 Provider guard。
- 内网首页 `http://192.168.0.39:3456/` 返回 200，且包含云端初始化脚本；容器内两个保存分片均确认 `saveMode:m("canvasSaveMode","cloud")`。

### 结论

- 本轮只把内网测试主路径切到云端/服务器保存，不改本地文件夹 API、不引入 HTTPS 证书、不触发真实 AI 或付费调用。
- 本地文件夹保存仍保留为用户手动选择的增强能力；浏览器不支持时不应再成为默认阻塞点。

### 未覆盖

- 其他机器的本地文件夹授权仍需后续单独处理。
- Playwright UI smoke 未启用；本轮通过 HTTP 首页内容、容器文件和 API smoke 验证生产端静态资源已同步。

## 2026-07-03 画布连线统一复核

### 已验证

- CodeGraph 索引正常，确认本轮是旧打包画布资产内的连线渲染与加载归一化问题。
- `assets/Canvas-B8bY9_QL.js` 和 `assets/Canvas-yGc8b2gf.js` 中默认边从 `smoothstep` 改为 `default`，新建普通边会走左侧同类 Bezier 曲线。
- 旧项目加载和本地工作流导入从直接使用 `r.edges` 改为 `(r.edges || []).map(Sg)`，保存过的直角灰线会在加载时统一。
- 图片参考边、图片顺序边、提示词顺序边和视频角色边统一为 `#3b82f6`、`2px`。
- `assets/Canvas-D1auYH9L.css` 的默认 edge、选中 edge 和连接预览线同步改为蓝色线条。
- `node --check assets/Canvas-B8bY9_QL.js`、`node --check assets/Canvas-yGc8b2gf.js`、`node --check scripts/verify-canvas-performance-assets.js` 均通过。
- `node scripts/verify-canvas-performance-assets.js` 和 `scripts/smoke-backend-canvas-boundary.ps1` 均通过；`git diff --check` 无 whitespace 错误；触碰文件无 BOM。
- 已刷新当前浏览器项目 `project_1783050909233_5t381nrb6`，采样到 9 条 `.vue-flow__edge-path`，全部为 `rgb(59, 130, 246)`、`2px`，且 path 均包含 `C` 曲线段。

### 结论

- 本轮只处理连线视觉和加载归一化，不改节点结构、生图接口、扣费或外部 Provider 调用。
- 旧工作流再次保存后，边类型可能从旧 `smoothstep` 变成 `default`，这是为了统一曲线形态。

### 未覆盖

- 需要用户在真实画布复杂项目中确认所有边的视觉观感。
- 未做真实生图或上传相关测试，本轮无必要触发付费链路。

## 2026-06-26 技术栈补救决策复核

### 已验证

- 对比视频参考中的源码型全栈思路：前端保留 `frontend/src/*`，后端按模型/视图组织，数据库和后台管理有稳定边界。
- 对比当前项目现状：前端为打包 Vue 资产，后端为 Express + SQLite，一部分功能依赖 bridge 脚本和 override CSS。
- 新增 `docs/adr/0002-source-first-technology-stack.md`，明确当前过渡栈和正式源码目标栈。
- 更新 `docs/iteration-review-checklist.md`，要求新增复杂前端能力先判断是否进入后续源码工程，避免继续大规模改打包 JS。
- 更新 `docs/known-gaps.md`，把技术栈补救路线列为显式缺口。

### 结论

- 当前不建议立即切 Django/MySQL，也不建议推倒 Express/SQLite 内网版本。
- 正式补救方向是 Vue 3 + Vite + TypeScript 前端源码化，Node.js + TypeScript 后端模块化，后续按阶段引入 Postgres/MySQL、Redis、BullMQ、Worker 和对象存储。
- Django Admin 的效率可以作为后台能力参考，但当前核心栈继续沿用 Vue/Node 更能复用已有验证成果。

### 未覆盖

- 尚未建立 API 契约文档。
- 尚未盘点每个 bridge/override 对应的源码化迁移项。
- 尚未开始 `server.js` 模块拆分和 `frontend/` 源码工程。

## 2026-06-26 新分支源码栈与画布启动复核

### 已验证

- 已切换到 `codex/source-stack-canvas-rebuild` 新分支。
- 已新增 `frontend/` 源码工程，依赖限定为成熟开源基座：Vue、Vite、TypeScript、Vue Router、Pinia、Axios、Naive UI、lucide-vue-next、Vue Flow。
- 已实现新版画布第一版：节点、连线、视口、Controls、MiniMap 和背景全部来自 Vue Flow。
- 已通过 `npm run build --prefix frontend`，覆盖 TypeScript 类型检查和 Vite 生产构建。
- 已新增 `README.md` 和更新 `AGENTS.md`，明确禁止自研画布、UI 组件库、状态库、HTTP Client、AI 网关和账号池。
- 已新增 `docs/plans/2026-06-26-source-stack-canvas-rebuild-plan.md`，按 Lane A-E 写明并行任务树。

### 结论

- 新分支已从旧打包资产修补模式切到源码前端模式。
- 当前新版画布是可构建的起点，但尚未承载旧画布全部业务能力。
- 后续应先做 API 契约和旧画布能力盘点，再扩大新画布功能。

### 未覆盖

- 尚未启动浏览器做新前端视觉检查。
- 尚未接真实后端生成任务。
- 尚未建立多工作树目录。

## 2026-06-25 后台全页面截图复跑

### 已验证

- 使用自带 Playwright CLI 跑通 `scripts/smoke-admin-pages-ui.ps1`。
- 自动登录后台后逐页打开并截图：Dashboard、用户、订单、日志、兑换码、API 线路、模型价格、任务监控、模板工作流、系统设置。
- 截图归档：`docs/design-references/admin-2026-06-25/full-*-desktop-1440x900.png`。
- 每页都校验了关键标题；结果均为 `ok: true`，未出现 404/500。
- 自动采集到的后台顶部标题颜色为 `rgb(2, 6, 23)`，字重 `900`，标题不再是浅灰。
- `node --check server.js`、`node --check assets/home-carousel-inertia.js`、前端路由 smoke 和 disposable API smoke 均通过。

### 视觉结论

- Dashboard、模板工作流、模型价格、用户管理抽查截图可进入人工测试。
- 图标线宽、按钮字距、表格密度和卡片间距整体保持工具台风格。
- 用户管理和模型价格页操作按钮较多，但当前没有把页面挤爆；后续如追更高完成度，可单独压缩操作列或做二级菜单。

### 新发现问题

- 首次新增截图脚本时缺少 Playwright `open` session 步骤，已补齐并复跑通过。
- `docker compose -f docker-compose.internal.yml ps` 因 Docker Desktop daemon 未运行失败，本轮不把容器状态算作已复核。

### 未覆盖

- 后台移动端卡片化体验。
- 保存类复杂弹窗关闭/回显的全量人工点测。
- 服务器部署后的远程浏览器截图。

## 2026-06-25 画布 JSON 导入与保存恢复复核

### 已验证

- `scripts/smoke-canvas-json-ui.ps1` 已跑通。
- 通过 `/api/workflows/:id/save-json` 保存临时画布 JSON，内容为 2 个节点、1 条连线。
- 通过 `/api/user/projects/:id` 读取确认 JSON 未丢字段。
- 浏览器打开 `/canvas/:id` 后，用页面隐藏 JSON 文件 input 导入 `.workflow.json`，模拟真实本地文件导入。
- 前端导入后 `hasVueFlow: true`、`nodeCount: 2`、console `0 errors`。
- 截图归档：`docs/design-references/frontend-2026-06-25/canvas-json-smoke-desktop-1440x900.png`。
- smoke 结束后自动删除临时项目，避免污染当前人工测试库。
- 第一次失败残留的 `canvas_json_smoke_*` 临时项目已按前缀清理，`/api/health` 项目数回到 3。
- `node --check server.js`、`node --check assets/home-carousel-inertia.js`、前端路由 smoke 和 disposable API smoke 均通过。

### 结论

- 当前阶段“画布走本地，到时候自己 JSON 导入”的策略是可测的：JSON 文件导入路径已经能渲染节点。
- 后端 `/api/workflows/:id/save-json` 可作为后续云端保存兼容接口继续保留。

### 风险

- 直接打开 `/canvas/:id` 目前不会自动从服务端项目 JSON 恢复节点；当前证据证明的是本地 JSON 文件导入，而不是云端项目自动恢复。
- 本地文件夹授权保存必须由人工在浏览器里选择目录，自动化只能覆盖无授权时的提示和 JSON 导入。
- `docker compose -f docker-compose.internal.yml ps` 因 Docker Desktop daemon 未运行失败，本轮不把容器状态算作已复核。

## 2026-06-25 统一预检与 UI smoke 护栏复核

### 已验证

- `scripts/preflight-check.ps1` 默认 API smoke 已改为 `scripts/smoke-api-disposable.ps1`，不再默认污染当前人工测试库。
- `SMOKE_UI=true` 已接入后台全页截图 smoke 和画布 JSON 导入 smoke。
- `scripts/preflight-check.ps1` 和 `scripts/verify-internal-deploy.ps1` 已增加 native 命令退出码检查，避免子脚本失败后父脚本继续显示通过。
- `SMOKE_UI=true` 的统一预检已通过，覆盖 Node 静态检查、disposable API smoke、前端路由 smoke、后台 10 页截图、画布 JSON 导入、health 和 git status。
- health 前后保持 `users: 22`、`projects: 3`、`redeem_codes: 10`，确认本轮更新后的默认预检不再增加当前库测试数据。

### 新发现问题

- 旧版 preflight 调用子 PowerShell 脚本后没有检查 `$LASTEXITCODE`，曾出现 canvas UI smoke 失败但父脚本继续打印 `Preflight checks passed`；该问题已修复。
- Playwright 连续跑多个 session 时，`open` 后 5 秒偶尔不够，已调整为 8 秒等待。

### 未覆盖

- Docker Desktop daemon 当前未运行，`docker compose -f docker-compose.internal.yml ps` 仍失败；容器状态本轮不算已复核。
- 服务器无桌面环境时，`SMOKE_UI=true` 需要在本地浏览器机器上设置 `SMOKE_BASE_URL` 指向服务器地址再跑。

## 2026-06-25 后台配置重启持久化复核

### 已验证

- 新增 `scripts/smoke-admin-persistence-disposable.ps1`，使用临时 SQLite 和临时运行目录，不污染当前人工测试库。
- 脚本会写入后台 settings、API 线路、模型价格和模板工作流。
- 写入后停止 Node 进程并用同一临时数据库重启服务。
- 重启后读取确认：
  - `settings.persistenceSmokeAt/defaultCredits` 存在。
  - 新增 API 线路和 `baseUrl` 存在。
  - 新增模型价格和 `pricePoints` 存在。
  - 模板工作流 `persistenceSmokeAt` 存在。
- `preflight-check.ps1` 已新增 `SMOKE_PERSISTENCE=true` 可选入口。

### 结论

- 当前 SQLite `app_state` 对后台 settings、API 线路、模型价格、模板工作流具备重启持久化能力。

### 未覆盖

- Docker volume 层面的容器重启持久化仍需 Docker daemon 或服务器环境验证。
- 生产迁移到独立业务表仍是后续维护项，不影响当前内网轻量版测试。

## 2026-06-24

### 已审查结论

- 当前项目仍是 Express 一体服务：静态前端资产 + `/api/*` + SQLite。
- 7 月前内网部署不建议一步到位引入 Postgres、Redis、BullMQ、Worker。
- New-API/CPA 应作为外部基础设施复用，本项目只保留 Provider Adapter 和业务层记录。
- Docker 轻量版应持久化 SQLite、uploads、logs，避免容器重建丢数据。

### 风险

- 当前前端是打包资产，复杂 1:1 修复会受限。
- SQLite 适合内网小范围，后续多人高并发或计费上线前需迁移 Postgres。
- 真实 AI、邮件、支付、对象存储尚未接入，不能按生产功能对外承诺。
- New-API/CPA 账号池涉及合规、额度和安全风险，需要部署方确认。
- 本机未检测到 `docker` 命令，本轮只能验证 Compose 文件已生成，不能完成容器实跑。

### 待人工确认

- 内网部署方式：Windows 服务器、Linux 服务器还是公司内网机器。
- 是否有统一域名和 Nginx/HTTPS 要求。
- New-API/CPA 是否已部署，或是否需要后续单独编排。
- 前端 1:1 的页面截图基准和验收优先级。

## 2026-06-24 后台接口 smoke 扩展

### 已验证

- 临时端口 `4568` 使用独立 SQLite 数据库启动成功。
- 扩展后的 `scripts/smoke-api.ps1` 覆盖后台 users、orders、usage logs、redeem codes、generate tasks、template workflows、settings 和 public routes。
- 兑换码新增、模板工作流 PUT、settings PATCH 均返回 `success: true`。

### 未覆盖

- 用户删除/恢复/永久匿名化等破坏性后台操作。
- 订单状态变更、任务取消/删除等需要更细测试数据的写接口。
- 前端后台页面的可视化和交互验收。

## 2026-06-24 前端入口复核

### 已验证

- 临时端口 `4569` 上 `/`、`/template-image`、`/canvas`、`/user/center`、`/admin/dashboard` 均可渲染。
- 未登录访问 `/user/center` 会跳转 `/login?redirect=/user/center`。
- 未登录访问 `/admin/dashboard` 会跳转 `/admin/login?redirect=/admin/dashboard`。
- 首页 `图库` 入口可点击，页面显示 `图片生成历史`、`共 0 张` 和空状态。
- 画布未选择本地保存文件夹属于预期状态，新 console 事件已降级为 warning。

### 未覆盖

- 登录态下用户中心和后台真实页面交互。
- 模板生成 mock 图片后图库历史同步。
- 画布选择本地文件夹后的真实本地自动保存。
- 移动端截图和视觉 1:1 对照。

## 2026-06-24 登录态与图库闭环

### 已验证

- 真实用户登录表单可进入 `/user/center`，显示用户、余额、兑换码和 API 线路模块。
- 真实管理员登录表单可进入 `/admin/dashboard`，显示统计卡片、模型使用、用户排行和线路统计。
- `/api/template/generate-image` 会写入 `generations`，`/api/user/generations` 返回生成历史。
- 首页实际加载的旧 `imageHistory-s5iwPTNE.js` 已复用 `/api/user/generations` 同步后端历史，图库显示 `共 1 张`。

### 风险与原则

- 发现新旧两套打包资产并存，后续前端补丁必须先确认 `index.html` 当前实际引用链路。
- 不新增重复图库接口，不自研额外同步层；优先复用已有 `/api/user/generations`。
- 后续 AI 网关继续复用 New-API/CPA，不在本项目内重造分发和账号池。

### 未覆盖

- 模板页面前端按钮级生成流程。
- 多图生成、删除历史、保存链接。
- 后台子页面真实交互和移动端布局。

## 2026-06-24 轻量平台架构护栏

### 已验证

- 临时端口 `4573` 使用独立 SQLite 数据库启动成功。
- `scripts/preflight-check.ps1` 已串联 `node --check server.js`、`node --check assets/home-carousel-inertia.js`、`scripts/smoke-api.ps1`、`/api/health` 和 `git status`。
- 预检通过，`/api/health` 明确返回 mock 模式、New-API 网关配置、CPA 预期后置关系、数据库状态和运行路径。

### 架构结论

- 7 月前继续采用 Express 一体服务 + SQLite + Docker Compose/PM2 的轻量内网平台路线。
- Postgres、Redis、BullMQ、独立 Worker 暂不进入当前阶段，避免拖慢内网部署。
- New-API 作为真实 AI 网关首选；CPA 只作为 New-API 后置渠道；本项目不自研 AI 网关和账号池。
- Open WebUI 暂不纳入核心链路，避免偏离电商画布、模板、图库、后台业务平台定位。

### 风险

- CodeGraph 在 `C:\Users\pc\Desktop\hjm-mb-clone` 未初始化，本轮未使用结构索引。
- 本机仍无法运行 Docker CLI，Docker Compose 只能保留配置级和文档级验证。
- 统一预检脚本依赖已有服务可访问；如 3456 被占用或服务未启动，需要先用临时端口启动。

### 未覆盖

- Docker 容器真实启动、健康检查和重启持久化。
- New-API 真实 token 联通。
- 前端模板、后台子页、画布长流程的浏览器级复核。

## 2026-06-24 内网测试优先策略复核

### 已审查结论

- 部署路径改为先公司内网测试，稳定后再服务器部署。
- 内网测试阶段允许无 `.env` 或 `.env` 保持占位值，必须 mock 跑通；服务器正式部署前再开启严格密钥检查。
- 画布当前明确保持本地优先，使用浏览器本地存储、本地文件夹授权和 JSON 导入/导出；不把画布服务端化作为当前部署阻塞项。
- New-API/CPA 继续复用外部开源项目，本项目只保留 Provider Adapter 和业务记录，不内置网关、额度、账号池和统计面板。

### 已调整

- `scripts/preflight-check.ps1`：画布本地恢复守卫改为可选检查，避免成为内网部署默认闸门。
- `scripts/verify-internal-deploy.ps1`：无 `.env` 或占位 `.env` 时允许内网 mock 验收；服务器正式部署可通过 `REQUIRE_ENV_FILE=true` 和 `REQUIRE_PRODUCTION_SECRETS=true` 强制检查。
- 新增 `docs/internal-test-rollout-checklist.md`，拆分内网测试和服务器部署验收项。

### 风险

- 内网测试阶段如果长期不做服务器严格检查，迁移服务器时仍需补 Nginx/HTTPS、备份恢复和访问权限。
- 画布本地 JSON 适合当前个人/小范围使用；如果后续要团队协同画布，需要单独立项服务端项目存储。

## 2026-06-24 模板/图库 smoke 闭环

### 已验证

- `http://127.0.0.1:3456/template-image` 可加载 10 个模板，侧栏显示自定义、小红书、海报、包装、模特、场景、详情页、副图、白底图和主图模板。
- 点击主图模板后，页面显示复刻参考图、自家产品图、提示词输入、生成设置、反推提示词、生成图片、任务队列和结果区。
- `http://127.0.0.1:3456/admin/dashboard` 登录态可显示用户数、订单金额、今日生成、消耗点数、模型使用、用户排行和 API 线路。
- 临时端口 `4575` 的扩展 smoke 覆盖模板设置、模型线路、注册、用户 profile、模板反推、模板生成、用户图库历史和后台接口，全部通过。

### 风险与原则

- 不新增重复模板接口，不重造图库同步层；继续复用 `/api/template/settings`、`/api/template/generate-image` 和 `/api/user/generations`。
- PowerShell 5 对 UTF-8 无 BOM `.ps1` 中文字符串解析不稳定，自动 smoke 中的测试 prompt 使用 ASCII，文档和前端仍保持中文。
- 模板页首次进入曾出现 `共 0 个模板`，刷新后恢复 10 个；后续若复现，优先检查本地草稿恢复逻辑和实际加载资产，不先改后端。

### 未覆盖

- 上传真实图片或模拟文件后的反推按钮前端完整闭环。
- 模板结果卡片的预览、发送到画布、删除和刷新。
- 后台 users/orders/logs/api-providers/template-workflows 子页逐页视觉和写操作。

## 2026-06-24 后台子页与前端路由 smoke

### 已验证

- 后台 `dashboard/users/orders/logs/generate-tasks/redeem-codes/api-providers/model-prices/template-workflows/settings` 均可渲染。
- `orders` 显示订单表格和关闭订单入口。
- `logs` 显示消费日志筛选和流水表格。
- `template-workflows` 显示模板列表、模板配置、图片槽、平台和保存配置入口。
- `settings` 显示注册赠送、云端保存、图片节点工具开关和保存设置入口。
- 新增 `scripts/smoke-frontend-routes.ps1`，覆盖 SPA 路由 fallback 和核心静态资产。
- 临时端口 `4577` 的 `scripts/preflight-check.ps1` 已包含 API smoke、前端路由 smoke、health 和 git status，全部通过。

### 风险与原则

- 首次批量读取后台部分页面时曾短暂拿到空文本，增加等待和逐页复核后正常；后续如果用户遇到空白，优先检查懒加载时序、登录态和实际加载资产。
- 前端路由 smoke 只验证 HTTP 层和 SPA shell/核心资产，不等同视觉 1:1。
- 继续复用现有后台组件和接口，不新建另一套后台管理系统。

### 未覆盖

- 后台按钮级写操作：API 线路新增/编辑/删除、模型新增、模板工作流保存、系统设置保存。
- 移动端后台布局。
- Docker 容器内的同一套前端路由 smoke。

## 2026-06-24 后台写操作 smoke

### 已验证

- `scripts/smoke-admin-write.ps1` 要求 `SMOKE_ALLOW_WRITES=true`，避免默认误跑破坏性写操作。
- 临时 SQLite 库中验证用户状态、余额调整、安全检查、重置密码、软删除、回收站恢复、永久匿名化。
- 临时 SQLite 库中验证订单状态 mock patch、兑换码创建删除。
- 临时 SQLite 库中验证 API 线路新增、编辑、测试连接、拉取模型、设默认、删除。
- 临时 SQLite 库中验证路线模型新增、编辑、启停、删除。
- 临时 SQLite 库中验证模板工作流保存和系统设置保存。
- 默认 `scripts/preflight-check.ps1` 会跳过后台写操作；设置 `SMOKE_ALLOW_WRITES=true` 后完整 preflight 通过。

### 风险与原则

- 写操作 smoke 只应在临时库、测试库或明确允许的环境运行。
- 不新增后台系统，不重造配置中心；继续复用现有 `/api/admin/*`、SQLite/app_state 和 mock provider 回落。
- 订单状态接口当前是 mock 返回，不持久化订单状态；如果后续要做真实订单管理，需要独立持久化订单表和支付状态机。

### 未覆盖

- 浏览器 UI 点击级写操作。
- Docker 容器重启后 API 线路、模型价格、模板工作流、系统设置的持久化验证。
- New-API 真实网关下的 API 线路测试连接。

## 2026-06-24 内网部署验收脚本

### 已验证

- 本机 `docker --version` 不可用，当前无法执行容器构建和 Compose 实跑。
- `scripts/verify-internal-deploy.ps1` PowerShell 解析检查通过。
- 临时端口 `4581` 的默认 `scripts/preflight-check.ps1` 通过，覆盖 API smoke、前端路由 smoke、health 和 Git 状态。
- `docs/deployment.md` 已补充服务器验收脚本、容器 restart 后健康检查、写操作 smoke 安全开关。

### 风险与原则

- 不把未实跑的 Docker 验收记为完成；当前只是把服务器验收工具和操作步骤补齐。
- New-API/CPA 仍作为外部基础设施复用，本项目容器只承载业务平台和 Provider Adapter。
- `SMOKE_ALLOW_WRITES=true` 只允许在测试库或临时库使用，不应直接对正式业务库执行。

### 未覆盖

- `docker compose -f docker-compose.internal.yml config`
- `docker compose -f docker-compose.internal.yml up --build -d`
- 容器 restart 后 SQLite volume 持久化。
- Nginx/HTTPS/域名配置。

## 2026-06-24 后台 UI 写操作与 New-API 配置回显

### 已验证

- 临时端口 `4582` 使用独立 SQLite 数据目录进行浏览器 UI 写操作，不触碰本机正常库。
- 后台兑换码创建表单的前端字段 `points/totalCount/perUserLimit/status` 已能写入后端，并在表格回显为前端列需要的 `点数/总次数/每人上限/剩余次数/状态`。
- 后台 API 线路新增已能保留 `displayName/baseUrl/category/apiFormat`，New-API 风格 Base URL 不再被 mock 默认地址覆盖。
- 模板工作流页点击 `保存配置` 后出现 `模板工作流已保存`。
- 系统设置页点击 `保存设置` 后出现 `系统设置已保存`。
- `scripts/smoke-admin-write.ps1` 增加兑换码前端字段和 API 线路 `displayName/baseUrl` 断言。

### 风险与原则

- 本轮仍不接真实 New-API key，不触发外部模型费用；只验证业务平台配置字段可以保存和回显。
- 继续保留 Express 一体服务 + SQLite + Provider Adapter 的轻量内网路线，不引入 Redis/Worker/Postgres。
- 写操作 UI 验收应继续使用临时库或测试库，正式库需要人工确认。

### 未覆盖

- 后台 `n-dialog` 创建类弹窗保存成功后不会自动关闭，关闭/取消按钮在本次浏览器自动化中表现不稳定；需要前端 polish 阶段修复。
- API 线路 `测试连接` 在真实 New-API token 下的联通和错误格式。
- users/orders/model-prices 的浏览器 UI 写操作全覆盖。

## 2026-06-24 画布保存恢复 API 长流程

### 已验证

- `scripts/smoke-api.ps1` 已覆盖画布项目创建、`/api/workflows/:id/save-json` 云保存、`/api/user/projects/:id` 读取恢复、项目列表缩略图、`PUT /api/user/projects/:id` 更新恢复和删除清理。
- 临时端口 `4584` 的默认 `scripts/preflight-check.ps1` 通过，画布 smoke 最终删除测试项目，`/api/health` 中 `projects: 0`，没有残留测试项目。
- `/api/user/projects` 响应补齐 `success/projects/list/data/total` 兼容字段，保持前端已有 `items` 不变。

### 风险与原则

- 本轮只补业务平台接口兼容和 smoke，不引入新的画布存储服务，不重造 workflow 引擎。
- 画布真实 UI 的拖拽、连线、上传、保存按钮仍需浏览器交互验收；API 长流程只能证明后端持久化和恢复链路可用。
- 继续使用 SQLite 作为 7 月前轻量内网版本的持久化层。

### 未覆盖

- 浏览器 UI 点击级：新增节点、上传素材、点击保存、刷新/重新进入同一项目恢复。
- 本地文件夹授权后的本地保存路径。
- 多用户并发编辑冲突和版本历史。

## 2026-06-24 画布浏览器 UI 与内网部署护栏复核

### 已验证

- 临时服务中打开 `/canvas` 后会自动进入动态项目页，画布工具栏、保存、历史记录、AI、工程节点、新增节点、工作流模板、文本、图片、图片生成、文生图、视频生成、撤销、重做和缩放入口可见。
- 初始画布可见 `.vue-flow`，示例状态下有 2 个节点和 1 条边，页面不是空壳。
- 点击 `保存` 可打开保存面板，显示本地自动保存、云端自动保存、选择本地文件夹和立即保存；未授权本地文件夹时提示 `请先选择本地保存文件夹`，属于预期限制。
- 点击 `历史记录` 可打开图片生成历史面板，空数据时显示 `共 0 张` 和空状态。
- 点击 `新增节点` 后可见文本节点、LLM 文本生成、图片生成节点、文生图配置、视频生成配置、图片节点和视频节点；点击文本节点后节点数增加。
- Docker Compose 配置不再硬依赖 `.env` 文件，缺少 `.env` 时仍会使用占位环境变量并保持 `ENABLE_REAL_AI=false` 的 mock 回落。

### 风险与原则

- 不在打包前端资产里大规模重写画布逻辑；动态示例项目刷新恢复问题先登记为前端 polish 缺口。
- 本项目继续按 Express 一体服务 + SQLite + Provider Adapter -> New-API 的轻量内网架构推进，不引入 Postgres、Redis、BullMQ、Worker 或 Open WebUI。
- New-API/CPA 继续复用外部成熟项目，本项目只保存业务配置、任务记录和平台状态。

### 未覆盖

- 动态示例项目刷新后节点可能变 0，需要修复恢复逻辑或默认示例数据注入。
- 本地文件夹授权后的真实本地保存流程。
- 上传素材、连线、生成节点和重新进入同一项目的完整 UI 长流程。
- Docker 容器真实构建、启动、healthcheck 和重启持久化。

## 2026-06-24 画布示例项目刷新恢复守卫

### 已验证

- 新增 `assets/canvas-project-restore-guard.js`，在主 Vue 模块加载前检查 `ai-canvas-projects-summary` 和旧摘要键。
- 仅当项目名为 `示例项目` 且 `canvasData.nodes` 缺失或为空时，自动补回 2 个示例节点和 1 条边；不修改普通用户项目。
- `scripts/verify-canvas-restore-guard.js` 使用 mock `localStorage` 验证：空示例项目会被修复，普通项目保持不变。
- `scripts/smoke-frontend-routes.ps1` 已覆盖 `/assets/canvas-project-restore-guard.js` 静态资产可访问。
- `scripts/preflight-check.ps1` 已接入守卫验证。

### 风险与原则

- 该修复复用现有本地项目摘要键和现有示例节点结构，不新增画布状态系统。
- 不直接重写 `Canvas-B8bY9_QL.js` 大包，降低压缩前端资产误伤风险。
- 守卫只处理本地摘要层；如果 IndexedDB 中已有真实空项目，仍以用户真实项目为准，不强行覆盖。

### 未覆盖

- 浏览器中刷新同一动态项目后的节点数二次确认。
- 上传素材、连线、生成节点和重新进入同一项目的完整 UI 长流程。

## 2026-06-24 Docker 前可测试状态复核

### 已验证

- 临时端口 `4594` 使用一次性 SQLite 执行 `scripts/preflight-check.ps1`，Node 语法、API smoke、前端路由 smoke 和 health 全部通过。
- 临时端口 `4596` 使用一次性 SQLite 执行 `SMOKE_ALLOW_WRITES=true scripts/smoke-admin-write.ps1`，后台写操作全部通过。
- Docker CLI、Docker Compose 和 Docker Engine 已安装可用；项目 Compose config 已通过。

### 结论

- 当前已经达到 Docker 前的本机 mock 可测试状态。
- 真实 New-API、邮件、支付、云存储无需现在配置。
- Docker 容器实跑仍需人工确认后再执行，避免占用端口或影响当前手动测试。

### 未覆盖

- 浏览器人工视觉验收。
- Docker 容器启动、重启持久化和容器内 healthcheck。
- 真实 New-API token 联通。

## 2026-06-24 Docker 启动排障

### 已验证

- Docker CLI、Compose 和 Engine 可用，项目 `docker-compose.internal.yml config` 通过。
- 官方 `node:20-alpine` 拉取 metadata 时出现 `registry-1.docker.io ... EOF`，属于 Docker Hub 网络/镜像源问题。
- 使用 `docker.m.daocloud.io/library/node:20-alpine` 可进入构建，但 `better-sqlite3` 在 Alpine/musl 下没有可用预编译包，`npm ci` 触发 `node-gyp`，因缺 Python/编译工具失败。
- 已将 Dockerfile 默认基础镜像切换为 `node:20-bookworm-slim`，并通过 `NODE_IMAGE` build arg 支持按环境替换镜像源。
- 本机 Node 服务已启动在 `http://127.0.0.1:3456/`，health 正常，可先进行人工页面验收。

### 结论

- 当前 Docker 未启动成功不是前后端业务代码失败，而是基础镜像拉取和 Alpine 原生依赖编译问题。
- 不建议在 Dockerfile 里堆 Alpine 编译工具，优先复用 Debian slim + `better-sqlite3` 预编译包，保持镜像简单可维护。

### 未覆盖

- `node:20-bookworm-slim` 镜像完整下载后的容器构建。
- 容器健康检查和 Docker volume 重启持久化。

## 2026-06-24 Docker 镜像网络重试复核

### 已验证

- 停止本机 Node 服务后，`3456` 已释放，可用于 Docker 容器绑定。
- `docker.m.daocloud.io/library/node:20-bookworm-slim` 在 metadata 阶段 EOF。
- `docker.1ms.run/library/node:20-bookworm-slim` 在 anonymous token 阶段 EOF。
- 本地 `docker images` 为空，没有可复用的 Node 基础镜像缓存。
- 容器没有启动，`docker compose ps` 为空。
- 本机 Node 服务已恢复，供人工继续测试。

### 结论

- Docker 当前阻塞条件是外部镜像源网络不可用，不是应用、端口、Compose 或 SQLite 问题。
- 已保留 `NODE_IMAGE` 可配置能力，后续只需切换到可用镜像源或稳定网络重试。

### 未覆盖

- Docker 容器首次完整构建。
- Docker volume 持久化和容器重启验收。

## 2026-06-24 Docker 实跑复核

### 已验证

- 人工下载 `node:20-bookworm` 后，使用该镜像完成 `docker compose -f docker-compose.internal.yml build`。
- 构建阶段 `npm ci --omit=dev` 通过，`better-sqlite3` 未再因缺 Python/编译工具失败。
- 停止本机 Node 服务后，`docker compose -f docker-compose.internal.yml up -d` 成功启动 `dianshang-app`。
- `docker compose ps` 显示容器 `healthy`，端口映射为 `0.0.0.0:3456->3456/tcp`。
- `http://127.0.0.1:3456/api/health` 返回 `success: true`、`status: ok`、`mode: mock`、`database: ok`，运行路径为 `/app/data`、`/app/uploads`、`/app/logs`。
- 首页 `http://127.0.0.1:3456/` 返回 200。
- 执行 `scripts/smoke-api.ps1` 后重启容器，`/api/health` 仍正常，`users/generations/balance_logs/redeem_codes/app_state` 表计数保留，证明 SQLite volume 基础持久化有效。

### 结论

- Docker 本地内网测试路径已跑通，不需要现在引入 Postgres、Redis、Worker、Open WebUI。
- 默认镜像应使用 `node:20-bookworm`，避免 slim 镜像缺少 `better-sqlite3` 编译工具。
- 真实 New-API、CPA、邮件、支付、云存储仍保持关闭，不影响 mock 测试。

### 未覆盖

- 人工浏览器完整点击测试 Docker 服务。
- 服务器/Nginx/HTTPS 正式部署验收。

## 2026-06-24 今日人工测试计划落库

### 已确认

- 新增 `docs/plans/2026-06-24-admin-frontend-manual-test.md` 作为下一轮上下文恢复入口。
- 今日目标锁定为后台与前端打通到人工可测，不扩 Postgres/Redis/Worker/Open WebUI。
- New-API 只保留配置入口和 mock 回落，不提交真实 key。

### 需要继续验证

- 后台 UI 点击级人工测试：弹窗关闭、按钮反馈、保存回显。
- 前端人工测试：首页、模板、图库、画布、用户中心。
- 其他电脑访问 `http://192.168.0.39:3456/` 的防火墙情况。

## 2026-06-24 画布节点圆角审查

### 已确认

- 图片节点外层需要 `overflow-visible` 保留连接点和右侧加号，不能直接裁剪整个节点。
- 圆角割裂来自内部 header/footer 背景没有单独圆角，尤其选中态橙色边框下更明显。
- 新增 `assets/canvas-node-radius-fix.css`，只修内部 header/footer 圆角，不改变节点尺寸和连接点行为。
- 浏览器验证：图片节点 footer 为 `0px 0px 23px 23px`，文生图 header 为 `23px 23px 0px 0px`，外层仍为 `overflow: visible`。

### 需要继续验证

- 用户当前视角下的肉眼确认。
- 其他节点类型是否也有同类内部背景压圆角的问题。

## 2026-06-24 画布选中态外层圆角复核

### 已确认

- 最新截图里的剩余割裂不只来自内部背景层，也来自 `.vue-flow__node` 外层默认 `8px` 圆角。
- 已将图片节点和文生图节点外层圆角补到 `24px`，图片生成节点外层圆角补到 `28px`。
- 外层继续保持 `overflow: visible`，连接点、右侧加号和选中手柄不会被裁掉。
- Docker 容器已重建，浏览器 computed style 已确认新规则生效。

### 需要继续验证

- 用户已肉眼确认圆角问题无明显异常，本项通过。
- 文本节点、视频节点是否也需要按原站视觉扩大圆角。

## 2026-06-24 画布小地图与聊天面板复核

### 已确认

- 右下角小地图原样式为纯白背景，和深色点阵画布割裂。
- 已将小地图外壳改为暗色半透明玻璃，并将 SVG mask 改为半透明白，避免内部仍出现白块。
- 左侧 Canvas Chat 面板原位置 `top: 56px`，顶部浮动工具条实际高度约 `73px`，存在阴影遮挡。
- 已将桌面端面板下移到 `top: 96px`，移动端仍保持全屏。
- 按参考图把桌面端面板调整为完整浮动卡片：左侧保留 `24px` 空隙，底部保留约 `22px` 空隙，四角圆角为 `24px`。

### 需要继续验证

- 用户肉眼确认透明度是否合适。
- 用户肉眼确认聊天浮动卡片位置、圆角和底部留白是否合适。

## 2026-06-24 画布用户中心标题颜色复核

### 已确认

- 用户反馈只需要修字体颜色，卡片式结构、圆角、阴影和布局不应继续调整。
- 画布内用户中心不是 Naive Modal，而是自定义 `aside` 侧栏，因此通用弹窗选择器无法命中。
- 已将颜色覆盖收窄到用户中心侧栏：`aside[class*="max-w-[414px]"][class*="bg-[#f5f6f8]"]`。
- 已验证 `admin`、`算力余额`、`算力明细`、`兑换码`、`API 线路` 的 computed color 从浅色变为 `rgb(24, 24, 27)`。

### 需要继续验证

- 用户刷新原页面后肉眼确认标题颜色是否统一。
- 后续如果侧栏 DOM 类名变动，需重新收窄选择器，避免影响其他画布弹层。

## 2026-06-25 后台视觉与接口复核

### 已确认

- 后台 10 个页面已归档桌面截图：`docs/design-references/admin-2026-06-25/`。
- Dashboard 前端读取 `userTotal`，后端原来只返回 `totalUsers`，导致卡片显示 `--`；已补兼容字段。
- Dashboard 模型占比前端读取 `modelUsage.list[].percent`，后端原来未返回，导致只显示 `%`；已补百分比。
- API 线路页操作按钮列过窄，按钮竖排导致行高约 `226px`；已给后台表格操作列保留宽度并禁止按钮竖排，行高降到 `58px`。
- 任务监控提示词列被压窄，中文竖排导致行高约 `348px`；已允许表格横向滚动，并将长提示词单行省略，行高降到约 `92px`。
- 本轮视觉补丁独立在 `assets/admin-visual-polish.css`，通过后台根布局选择器收窄，不改画布卡片结构。

### 需要继续验证

- 后台保存类操作需要用户人工点击确认：API 线路保存、模型价格保存、模板工作流保存、系统设置保存。
- 模型价格页线路筛选项仍有重复，当前不阻塞人工测试，但后续应从数据/前端状态层收敛。
- Docker Desktop 当前未在本轮确认运行，`docker compose ps` 无法连接 daemon，需要用户打开后再复核容器 `healthy`。
- 本机 Node 启动日志在 PowerShell 读取时中文显示乱码，服务本身正常，后续可改启动日志为 ASCII 或统一输出编码。

## 2026-06-25 后台保存回显与模型价格筛选复核

### 已确认

- `scripts/smoke-admin-write.ps1` 已在临时端口 `4594` 和一次性 SQLite 数据库上完整通过，覆盖后台写操作，不污染当前人工测试数据库。
- `/api/admin/model-prices` 原来把模型行放进 `list/items/data`，打包前端会把这些模型行当作线路筛选项，导致同一线路重复出现。
- 已调整 `/api/admin/model-prices`：`list/items/data/routes/providers` 返回线路分组，`models/prices/rows` 保留完整模型行。
- 浏览器复核 `/admin/model-prices`：筛选按钮只剩 `全部模型、6789、comfly-google、comfly-openai-plus、RK、哈吉米、flowstudio`，表格模型行仍正常显示。

### 需要继续验证

- `scripts/smoke-api.ps1` 仍会在当前本地库留下测试用户、生成记录和兑换码；建议下一轮改成可选临时库模式。
- Docker Desktop 未启动时无法验证 compose 容器状态，仍需用户打开后复核。

## 2026-06-25 Disposable API Smoke 护栏复核

### 已确认

- 新增 `scripts/smoke-api-disposable.ps1`，通过临时端口和临时 SQLite 数据库运行完整 API smoke。
- 脚本会继承原有 `scripts/smoke-api.ps1` 的覆盖范围，避免重复维护两套断言。
- 首次验证发现临时 DB 文件可能在 Node 退出后短暂被占用；已增加 `Wait-Process` 和清理重试。
- 最终验证通过，退出码为 `0`，没有继续写入当前 `3456` 人工测试数据库。

### 需要继续验证

- Docker Desktop 未启动，容器状态仍无法复核。
- 后续如果要验证当前真实服务写入，仍可直接运行原 `scripts/smoke-api.ps1`；日常提交前建议优先用 disposable 脚本。

## 2026-06-25 前端主流程与用户中心真实数据复核

### 已确认

- 前端桌面截图已归档到 `docs/design-references/frontend-2026-06-25/`，包含首页、图库、模板、模板工作区和用户中心关键页面。
- 首页可渲染，首页 `图库` 入口可打开生成历史弹层。
- 模板页可显示 10 个模板，模板图库入口可打开，模板工作区可进入上传槽、提示词、生成设置、结果区和任务队列。
- `/user/records` 打包前端原来只显示 `generation_logs`、`balance_logs`、`暂无新任务` 等占位文案；已通过 `assets/user-center-data-bridge.js` 追加真实生成记录和余额流水。
- `/user/redeem` 打包前端原来显示 `本地演示 / 后端待接入`；已追加后端兑换码提交入口，并说明成功后会写入余额流水。
- 浏览器验证 `/user/records` 可见 `真实记录` 和生成/流水数量，`/user/redeem` 可见 `兑换码提交` 与 `已接后端`，console 无页面错误。

### 需要继续验证

- 用户中心桌面端仍是窄移动式布局，当前可测试但不是最终桌面 1:1。
- 兑换码成功/失败提示需要用户手动点测一次。
- 图库删除、保存链接、多图显示仍需人工点测。
- Docker Desktop 未启动时无法复核 compose 容器状态。

## 2026-06-25 图库删除持久化复核

### 已确认

- 原图库弹层 `删除` 按钮只修改前端列表：删除后页面从 `共 4 张` 变 `共 3 张`，但 `/api/user/generations` 仍为 `4` 条，刷新后恢复 `共 4 张`。
- 已新增生成历史删除接口，支持 `DELETE /api/user/generations/:id`，也支持按 `resultUrl/prompt` 删除，便于打包前端图库卡片只暴露图片链接时同步后端。
- 已新增 `assets/gallery-persistence-bridge.js`，只在 `图片生成历史` 弹层中捕获 `删除` 按钮，不影响画布、后台或其他页面。
- 浏览器复核删除持久化：删除前 API `4` 条，删除后 API `3` 条；刷新后图库仍显示 `共 3 张`。
- `scripts/smoke-api.ps1` 已增加生成历史删除断言，disposable API smoke 通过。

### 需要继续验证

- `保存链接` 需要人工确认是剪贴板复制还是本地文件夹保存，后续再决定是否补持久化记录。
- `清空` 暂未接后端批量删除；如果要启用真实批量清空，必须增加二次确认，避免误删全部历史。

## 2026-06-25 图库保存链接与头像保存复核

### 已确认

- 原图库单张 `保存链接` 点击后没有稳定写入剪贴板；已在 `assets/gallery-persistence-bridge.js` 中补充复制逻辑。
- 单张 `保存链接` 现在会复制当前卡片图片 URL。
- `保存全部链接` 会复制图库弹层内所有图片 URL，一行一个；浏览器验证得到 `3` 条链接。
- 用户中心头像设置控件存在：随机头像、上传、预设头像。
- 随机头像已验证会写回后端，`/api/user/profile` 中 `avatarUrl` 从 `/avatars/avatar-vip.svg` 变为 `/avatars/avatar-2d.svg`。

### 需要继续验证

- 头像上传文件入口还未用真实图片文件点测。
- 复制出来的图片 URL 可能是本地 mock SVG 或外部 placeholder，服务器部署后需要确认访问路径是否符合内网使用习惯。
- 图库 `清空` 仍保持前端行为，未接后端批量删除。

## 2026-06-25 模板反推兼容与后台视觉复核

### 已确认

- `/api/template/reverse-prompt` 原来只返回 `rawPrompt/suggestions`，打包前端反推逻辑读取的是 `rawText/prompts`，导致接口 200 但页面仍显示 `提示词选择 0 条`。
- 已补齐 `rawText`、`prompts`、`items/list/data`，同时保留 `rawPrompt/suggestions`，避免影响现有 smoke 和后续兼容。
- 后台 10 个页面已重新截图归档：Dashboard、用户、订单、日志、兑换码、API 线路、模型价格、任务监控、模板工作流、系统设置。
- `redeem-codes` 页面自动文本检查出现 `has500=true` 是因为页面包含 `500` 点数文本，不是 HTTP 500 或页面错误。
- 后台视觉补丁继续限制在 `assets/admin-visual-polish.css`，未触碰前台画布卡片和模板结构。

### 需要继续验证

- 模板页完整 UI 闭环仍需真实上传素材后确认：提示词卡片出现、生成按钮调用 `/api/template/generate-image`、结果写入图库历史。
- Dashboard 右侧排行表在 1440 宽度下仍偏挤，后续可针对该半宽卡片做单独表格布局优化。
- 后台保存/删除/弹窗关闭仍需人工逐页点测，当前 smoke 已覆盖接口写入，但没有完全覆盖交互手感。

## 2026-06-25 模板真实上传生成闭环复核

### 已确认

- Codex 内置浏览器不支持文件上传，已改用独立 Playwright CLI 验证模板上传链路。
- `/template-image` 选择 `一键主图反推复刻` 后，参考图槽和产品图槽均可上传本地 `logo.png`。
- 上传后页面状态从 `待上传` 进入可生成状态，素材统计显示 `2 张素材`。
- 点击 `反推提示词` 后，页面显示 `提示词选择 3 条`，并出现 `高转化主图`、`场景氛围图`、`极简白底图` 三张提示词卡片。
- 点击 `生成图片` 后，页面显示 `已完成`、`当前 1 张`、`1 个已完成`，结果卡可见 `进画布` 和 `下载`。
- 网络请求确认 `/api/template/reverse-prompt` 和 `/api/template/generate-image` 均为 200。
- `/api/user/generations` 最新记录为本次模板生成结果，说明图库历史后端写入成功。
- `scripts/smoke-api.ps1` 已新增 `rawText/prompts` 字段断言，避免后续兼容字段回退。

### 需要继续验证

- 这次验证使用的是 mock 图片结果，后续接 New-API 后必须复测真实生图。
- Playwright CLI 登录态目前只写入 `auth_token`，顶部仍显示 `登录`，但接口调用已通过；后续如果要长期自动化，应写专用脚本处理 `auth_user` JSON 引号。
- 1440 截图中上传素材预览区域显示了 `logo.png` 文件名，生成结果本身正常；需要你在真实浏览器里确认这是测试素材/截图加载问题，还是预览卡片需要继续修。
- 模板页“进画布”按钮、下载文件名和批量生成还未作为本轮重点验证。

## 2026-06-25 后台内置浏览器截图与交互 Smoke 复核

### 已确认

- 已使用内置浏览器归档后台 10 页截图：Dashboard、用户、订单、日志、兑换码、API 线路、模型价格、任务监控、模板工作流、系统设置。
- 页面均能打开，未出现空白、404 或 500。
- 新增 `scripts/smoke-admin-ui.ps1` 与 `scripts/smoke-admin-ui-runner.js`，通过浏览器内登录后验证关键后台交互。
- 已验证 `系统设置 -> 保存设置` 有成功提示。
- 已验证 `API 线路管理 -> 新增线路` 弹窗能打开，且包含 Base URL、API Key、接口路径等字段。
- 已验证 `兑换码管理 -> 创建兑换码` 弹窗能打开，且包含兑换码、点数、次数、过期时间等字段。
- 已验证 `模板工作流 -> 保存配置` 可点击，页面不报错。
- 已归档交互截图：
  - `admin-ui-smoke-dashboard-desktop-1440x900.png`
  - `admin-ui-smoke-settings-desktop-1440x900.png`
  - `admin-ui-smoke-api-provider-modal-desktop-1440x900.png`
  - `admin-ui-smoke-redeem-modal-desktop-1440x900.png`
  - `admin-ui-smoke-template-workflows-desktop-1440x900.png`

### 需要继续验证

- 后台删除/恢复确认还没有全部纳入自动化。
- Dashboard 用户排行表在 1440 视口下仍偏宽，后续可单独做表格列压缩。
- 后台视觉这轮只做复核和护栏，没有再改动已确认的画布卡片布局。

## 2026-06-25 后台写入 Disposable Smoke 复核

### 已确认

- 新增 `scripts/smoke-admin-write-disposable.ps1`，默认使用临时端口 `4596` 和临时 SQLite。
- 脚本会自动设置 `SMOKE_ALLOW_WRITES=true`，只允许后台写入 smoke 在临时库执行。
- 已验证通过用户软删除、回收站恢复、永久匿名化，不会误删当前人工测试库中的真实数据。
- 已验证兑换码创建/删除、API 线路创建/更新/删除、线路模型创建/更新/禁用/删除。
- 已验证模板工作流和系统设置保存。
- 临时服务结束后会停止 Node 进程，并清理临时目录。

### 需要继续验证

- 这是后端写入路径验证，不等同于前端确认弹窗手感验证。
- 下一步仍需用浏览器点测后台用户删除、回收站恢复、永久删除的确认弹窗。

## 2026-06-25 用户中心兑换码与后台删除恢复 UI Smoke 复核

### 已确认

- 新增 `scripts/smoke-user-redeem-ui.ps1` 与 runner。
- `/user/redeem` 错误码提交会显示红色提示 `兑换码不存在`。
- `/user/redeem` 有效码提交会显示绿色提示 `兑换成功，增加 3 算力`。
- 新增 `scripts/smoke-admin-delete-ui.ps1` 与 runner。
- 后台用户删除会打开页面内确认弹窗，包含管理员密码、删除原因和 `确认删除` 按钮。
- 确认删除后用户进入回收站，回收站行可见。
- 点击恢复后显示 `用户已恢复`，回收站回到空状态。
- smoke 使用临时用户，结束后通过 API 做清理，避免留下测试账号。

### 需要继续验证

- 用户中心桌面端仍是窄移动式布局，后续如果追 1:1 桌面视觉需要单独优化。
- 后台用户表操作列较密，1440 下可用但仍可做细化。
- 后台永久删除前端弹窗还未单独截图；后端路径已由 disposable write smoke 覆盖。

## 2026-06-25 移动端关键页面截图 Smoke 复核

### 已确认

- 新增 `scripts/smoke-mobile-ui.ps1` 与 runner。
- 移动端截图目录：`docs/design-references/mobile-2026-06-25/`。
- 已归档首页、模板页、画布页、用户中心兑换码、后台 Dashboard、后台 API 线路、后台模板工作流 390x844 截图。
- 首页移动端标题原先在 390 宽下断成 `工作 / 台`，已通过 `assets/home-overrides.css` 移动端字号修复。
- 画布移动端核心内容可见，包含新增节点面板和底部缩放控件。
- 后台移动端 Dashboard 可见统计卡片，API 线路和模板工作流可见核心内容。

### 需要继续验证

- 后台移动端表格信息密度仍偏高，API 线路页默认只露出前两列，需要后续看是否做移动端专门卡片化。
- 画布移动端本地保存提示会占据顶部空间，这是当前本地画布策略带来的提示，不属于本轮错误。

## 2026-06-25 后台截图复跑与 Dashboard 表格复核

### 已确认

- 已重新跑通 `scripts/smoke-admin-ui.ps1`，后台主截图覆盖 Dashboard、系统设置、API 线路弹窗、兑换码弹窗和模板工作流。
- 已重新跑通 `scripts/smoke-admin-delete-ui.ps1`，后台删除确认、回收站行和恢复完成截图均已归档。
- 已重新跑通 `scripts/smoke-mobile-ui.ps1`，移动端首页、模板、画布、用户兑换码、后台 Dashboard、API 线路、模板工作流均非空白。
- 已用 Codex 内置浏览器打开 `/admin/dashboard` 和 `/admin/api-providers` 抽查，API 线路页 console error 为 0。
- Dashboard 右侧用户消费排行表原先被全局 `min-width: 980px` 撑宽裁切，本轮已改为随容器收缩，截图中最后使用列不再被直接裁掉。
- 删除/恢复 UI smoke 失败原因是表格刷新导致按钮 DOM 在点击前被替换，已改为按当前 DOM 行查找按钮并立即点击，复跑通过。

### 需要继续验证

- 移动端后台表格仍采用横向表格方案，已经更紧凑，但是否需要卡片化要等人工看图决定。
- Playwright CLI 截图脚本不能并行复用同一个 session；后续自动化应串行执行，或显式拆不同 session。
- Docker Desktop daemon 当前仍需人工打开后再复核容器状态。

## 2026-06-25 图库多图与空状态复核

### 已确认

- 新增 `scripts/smoke-gallery-ui.ps1` 与 runner。
- 已验证临时用户生成 2 张 mock 图后，首页图库弹窗显示 `共 2 张`，两张图片卡片可见。
- 已验证 `保存全部链接` 会写入 2 条图片链接；smoke 使用测试剪贴板，不依赖系统剪贴板权限。
- 初次严格复核发现真实问题：后端删除生成记录后，前端图库仍从 localStorage 复活旧图。
- 已修复 `imageHistory` 同步逻辑：登录态下以后端 `/api/user/generations` 为生成历史权威来源，同时保留本地文件夹/浏览器缓存类素材。
- 修复后重新跑通，删除后 API 为 0 条，重开图库显示 `共 0 张` 和 `还没有图片生成历史`。
- 已归档截图：
  - `gallery-multi-state-desktop-1440x900.png`
  - `gallery-empty-state-desktop-1440x900.png`

### 需要继续验证

- 移动端图库多图和空状态还没有单独截图。
- 图库空状态视觉可用但偏朴素，后续如果追细节可统一空状态图标、按钮禁用态和弹窗内间距。

## 2026-06-25 移动端图库入口复核

### 已确认

- 390x844 首页原本没有可点击的 `图库` 入口，导致移动端图库无法人工打开。
- 已在 `gallery-persistence-bridge.js` 增加移动端首页专用轻量入口，只在 `/` 且 `max-width: 720px` 时显示。
- 移动端入口打开后复用 `/api/user/generations`，不是单独假数据。
- 已验证移动端多图状态：`共 2 张`，图片卡片、保存链接按钮可见。
- 已验证移动端空状态：`共 0 张`，显示 `还没有图片生成历史`。
- 移动端图库弹窗已做文本转义，避免真实提示词中的符号污染 HTML。
- 已归档截图：
  - `gallery-multi-mobile-390x844.png`
  - `gallery-empty-mobile-390x844.png`

### 需要继续验证

- 这是轻量补入口，不是完整重做移动端导航；后续如追 1:1，需要把首页、模板、图库移动端导航体系一起统一。
- 移动端保存到本地文件夹能力仍依赖浏览器权限，当前 smoke 只覆盖复制链接。

## 2026-06-25 后台全页截图复跑复核

### 已确认

- 已使用 Playwright 重新执行 `scripts/smoke-admin-pages-ui.ps1`。
- 后台 10 个页面全部返回 `ok:true`，包含 Dashboard、用户、订单、日志、兑换码、API 线路、模型价格、任务监控、模板工作流、系统设置。
- 截图目录：`docs/design-references/admin-2026-06-25/`。
- 截图文件：`full-dashboard-desktop-1440x900.png`、`full-users-desktop-1440x900.png`、`full-orders-desktop-1440x900.png`、`full-logs-desktop-1440x900.png`、`full-redeem-codes-desktop-1440x900.png`、`full-api-providers-desktop-1440x900.png`、`full-model-prices-desktop-1440x900.png`、`full-generate-tasks-desktop-1440x900.png`、`full-template-workflows-desktop-1440x900.png`、`full-settings-desktop-1440x900.png`。
- 脚本已读取标题样式：标题颜色统一为 `rgb(2, 6, 23)`，标题字重统一为 `900`。
- 当前截图 smoke 未发现 404、500 或空白页。

### 需要继续验证

- 需要人工看图判断后台标题、按钮、图标、字距、表格密度是否达到“工具台”观感。
- 后台移动端表格目前仍是横向表格方案，是否卡片化等人工确认后再做。

## 2026-06-25 后台操作列视觉复核

### 已确认

- 逐页查看后台桌面截图后，发现用户管理、API 线路、模型价格等页面右侧操作按钮容易被表格宽度挤到画面外。
- 已在 `assets/admin-visual-polish.css` 增加后台表格卡片横向滚动保护。
- 已将带按钮的最后一列设为右侧固定列，并允许按钮在操作列内换行，保证“编辑、禁用、设默认、测试连接、拉取模型、删除”等关键操作在截图和人工测试时可见。
- 已重新执行 `scripts/smoke-admin-pages-ui.ps1`，后台 10 页全部 `ok:true`。
- 已执行前端路由 smoke、API smoke、`/api/health` 和 JS 语法检查，均通过。

### 需要继续验证

- 多操作按钮完整可见后，用户管理/API 线路行高会增加；如果人工看图觉得偏松，下一轮应改成“更多操作”菜单或详情抽屉。
- `docker compose -f docker-compose.internal.yml ps` 当前失败，原因是 Docker Desktop daemon 未运行，需要启动 Docker Desktop 后复核容器。

## 2026-06-25 用户中心桌面布局复核

### 已确认

- 用户中心原始打包页桌面端仍使用 `max-w-[430px]` 手机壳布局，人工测试时显得过窄。
- 已在 `user-center-data-bridge.js` 对 `/user/*` 页面增加桌面端布局补丁：960px 以上使用 980px 外壳和两栏 grid，移动端不触发。
- 已增加用户页头像破图兜底，坏图会隐藏，避免显示浏览器破图标。
- 新增 `scripts/smoke-user-center-layout-ui.ps1` 和 runner，覆盖 `/user/center`、`/user/records`、`/user/redeem` 桌面截图，以及 `/user/center` 移动端截图。
- 已将用户中心布局 smoke 接入 `SMOKE_UI=true` 的 `preflight-check.ps1` 和 `verify-internal-deploy.ps1`。
- `SMOKE_UI=true scripts\preflight-check.ps1` 已通过，覆盖后台截图、画布 JSON 导入和用户中心布局。

### 需要继续验证

- 目前头像兜底是隐藏坏图，视觉上是空头像底色；如果需要更精致，下一轮补文字头像或固定默认头像资源。
- 用户中心桌面两栏已可测，但是否接近目标站观感仍需人工确认。

## 2026-06-25 用户中心默认头像复核

### 已确认

- 原兜底只是隐藏坏图，截图中头像区域仍显得空。
- 已改为默认文字头像：头像图片加载失败时，在头像圆形容器里显示当前用户首字母。
- `scripts\smoke-user-center-layout-ui.ps1` 已增加校验：如果存在 broken image，则必须出现 `.uc-avatar-fallback`。
- 桌面截图 `user-center-desktop-1440x900.png` 和移动端截图 `user-center-mobile-390x844.png` 已显示 `A` 默认头像。

### 需要继续验证

- 当前是首字母兜底，足够人工测试；若要更接近品牌视觉，可后续换成固定默认头像图片。

## 2026-06-25 内置浏览器后台截图与 Docker daemon 复核

### 已确认

- 已使用内置浏览器登录后台，并生成 10 张桌面截图：`manual-audit-dashboard/users/orders/logs/redeem-codes/api-providers/model-prices/generate-tasks/template-workflows/settings-desktop-1440x900.png`。
- 10 个后台页面均非空白、非 404，浏览器 console error 为 0。
- 自动文本检测在兑换码页命中 `500`，从页面业务上看大概率是积分数值，需要人工看图确认，不按真实 500 错误处理。
- `docker --version` 可用，版本为 29.5.3。
- `docker compose version` 可用，版本为 v5.1.4。
- `scripts\verify-internal-deploy.ps1` 已增加 `docker info`，现在会在 `docker available` 阶段提前检查 Docker Server。
- 当前失败信息为：`failed to connect to the docker API at npipe:////./pipe/dockerDesktopLinuxEngine`。
- 结论：Docker CLI/Compose 已安装，Docker Desktop daemon 未运行；不是项目代码或镜像配置本身失败。

### 需要继续验证

- 人工查看 10 张后台 `manual-audit` 截图，重点看标题、图标、按钮、字距、表格密度和卡片间距是否接受。
- 打开 Docker Desktop 并等待 Engine running 后，重新执行 `scripts\verify-internal-deploy.ps1`。
- 只有完整通过后，才能把部署护栏从 `待复核` 改为 `完成`。

## 2026-06-25 后台主按钮颜色复核

### 已确认

- 系统设置页 `保存设置` 原样式为 Naive UI 默认亮薄荷绿：`rgb(99, 226, 183)`，文字为黑色，和后台工具台风格不统一。
- 已在 `assets/admin-visual-polish.css` 的后台作用域中覆盖 `.n-button.n-button--primary-type`。
- 新样式使用清新 emerald 绿主色、白色文字、低饱和边框和轻阴影，避免继续出现荧光薄荷绿，同时不压成黑绿。
- 内置浏览器已归档截图：`docs/design-references/admin-2026-06-25/settings-button-fresh-green-desktop-1440x900.png`。

### 需要继续验证

- 你人工确认新的清新绿色按钮是否符合预期。
- 继续按后台页面截图审查其他明显突兀的颜色、按钮密度和标题层级。

## 2026-06-25 后台用户表格操作列复核

### 已确认

- 用户管理页右侧 sticky 操作列原阴影过宽，形成大片白色遮罩，视觉上盖住注册时间/最后登录一部分。
- 已将操作列宽度从 240px 调整为 226px，并加入轻边线。
- 已将操作列阴影从 `-16px 0 24px rgba(248, 250, 252, 0.88)` 收敛为 `-6px 0 14px rgba(248, 250, 252, 0.58)`。
- 已将表格按钮高度从 28px 压到 26px，字号从 12px 压到 11px，减少多按钮行高压力。
- 内置浏览器已归档截图：`docs/design-references/admin-2026-06-25/users-action-column-polish-desktop-1440x900.png`。

### 需要继续验证

- 用户管理宽表仍然信息密度高，日期列会截断；如果人工测试觉得仍然拥挤，下一步应做“更多操作”菜单或详情抽屉，而不是继续压缩表格。
- API 线路、模型价格等宽表需要继续按同样标准复核。

## 2026-06-25 后台 API 线路与模型价格宽表复核

### 已确认

- 已重新截取 `API 线路管理` 和 `模型价格` 两页，文件为 `api-providers-action-column-polish-desktop-1440x900.png`、`model-prices-action-column-polish-desktop-1440x900.png`。
- API 线路页操作列包含 6 个按钮：编辑、禁用、设默认、测试连接、拉取模型、删除；按钮高度已统一为 26px。
- 模型价格页操作列包含 3 个按钮：编辑价格、禁用、删除；按钮高度已统一为 26px。
- 两页操作列均继承 226px 宽度、轻边线和小阴影，未再出现上一轮那种大片白色遮罩。
- 两页均非 404/500，适合进入人工点测。

### 需要继续验证

- API 线路仍是超宽配置表，右侧部分字段需要横向滚动；如果后续追后台体验，应做列显隐、详情抽屉或“更多操作”菜单。
- 继续复核订单、日志、任务监控的状态色、表格密度和按钮层级。

## 2026-06-25 后台任务监控操作按钮复核

### 已确认

- 订单管理和消费日志当前截图可测，没有发现必须立即修复的视觉阻断问题。
- 任务监控操作列原来存在两个明显问题：竖排按钮被拉成 197px 长条色块；sticky 操作列背景半透明，导致参数/时间文字透出。
- 已将 `td:last-child` 下的竖排按钮容器右对齐，`admin-ghost`、`admin-danger` 表格按钮改为内容宽度。
- 已将 sticky 操作列背景改为纯白，避免底层文字透出。
- Playwright 验证：`详情` 按钮 58x26，`删除记录` 按钮 60x26，操作列背景 `rgb(255, 255, 255)`。
- 已归档截图：`docs/design-references/admin-2026-06-25/generate-tasks-action-buttons-polish-desktop-1440x900.png`。

### 需要继续验证

- 任务监控仍是宽表，参数/时间列需要横向滚动；如果后续追更好体验，应做详情抽屉或列显隐。
- 继续复核兑换码、模板工作流和系统设置的弹窗/保存回显视觉。

## 2026-06-25 后台模板工作流绿色统一复核

### 已确认

- 兑换码创建弹窗和 API 线路弹窗的主按钮已经是绿色白字，暂不需要改。
- 模板工作流页原先仍有橙色主按钮和橙色选中态：`新增`、`保存配置`、`生成预览`、`新增图片槽`、`新增字段`、选中模板卡和 checkbox。
- 已在后台作用域 CSS 中覆盖 `bg-orange-500`、`bg-orange-50 text-orange-600`、`border-orange-200 bg-orange-50`，统一为 emerald 绿系。
- 已统一后台 checkbox：`accent-color: #10b981`。
- 内置浏览器验证：页面按钮未再检测到 `rgb(249, 115, 22)` 橙色背景，checkbox accent-color 为 `rgb(16, 185, 129)`。
- 已归档截图：`docs/design-references/admin-2026-06-25/template-workflows-green-actions-desktop-1440x900.png`。

### 需要继续验证

- 人工确认模板工作流绿色统一后的观感。
- 继续复核兑换码创建/删除弹窗、API 线路保存回显和系统设置保存提示。

## 2026-06-25 后台弹窗绿色按钮复核

### 已确认

- 已重新打开兑换码创建弹窗和 API 线路新增弹窗，截图归档为 `redeem-modal-green-review-desktop-1440x900.png`、`api-provider-modal-green-review-desktop-1440x900.png`。
- 兑换码弹窗 `创建` 按钮为绿色白字，API 线路弹窗 `保存` 按钮为绿色白字。
- 两个弹窗均非 404/500，也未出现 `Internal Server Error` 或 `Cannot GET`。
- 本轮没有改动画布卡片、画布用户面板和前端主流程结构。

### 需要继续验证

- 弹窗内部主按钮仍使用 Naive 默认绿，和外层后台主按钮不是完全同一个渐变；目前视觉方向一致，后续可按人工反馈统一到同一套按钮 token。
- 继续验证系统设置保存提示、兑换码删除确认和 API 线路保存回显。

## 2026-06-25 后台删除/回收站 UI 复核

### 已确认

- `smoke-admin-ui.ps1` 通过，系统设置保存点击、API 线路弹窗、兑换码弹窗和模板工作流保存点击均可执行。
- `smoke-admin-delete-ui.ps1` 初次失败点是回收站页面行等待和计数过严；诊断显示前端回收站实际能显示刚删除的用户。
- 已加固 `smoke-admin-delete-ui-runner.js`：进入回收站后等待目标用户名出现，匹配行数改为至少 1；恢复后等待目标用户名消失。
- 已把 `/admin/recycle-bin` 加入 `smoke-frontend-routes.ps1`，后续前端路由 smoke 会覆盖回收站入口。
- 重跑后删除/恢复 UI smoke 通过，截图已刷新：`admin-user-delete-target-desktop-1440x900.png`、`admin-user-delete-confirm-desktop-1440x900.png`、`admin-user-recycle-row-desktop-1440x900.png`、`admin-user-restore-complete-desktop-1440x900.png`。

### 需要继续验证

- 删除确认和回收站恢复已经可测；后续仍需人工确认交互文案和按钮危险色是否符合预期。
- Docker 容器状态仍依赖 Docker Desktop Engine，当前不能把部署验证标为完成。

## 2026-06-25 模板/图库主流程 UI 复核

### 已确认

- 新增 `scripts/smoke-template-ui.ps1` 和 `scripts/smoke-template-ui-runner.js`。
- 模板 UI smoke 已覆盖：选中“一键主图反推复刻”、上传参考设计图、上传产品素材图、反推提示词、生成 mock 图片、确认生成记录写入 `/api/user/generations`。
- 模板流程截图已归档：`template-main-image-selected-desktop-1440x900.png`、`template-uploaded-desktop-1440x900.png`、`template-reverse-prompts-desktop-1440x900.png`、`template-generate-result-desktop-1440x900.png`。
- 图库 UI smoke 已重跑通过，覆盖桌面 2 张生成历史、保存全部链接复制 2 行、移动端 2 张生成历史、删除后桌面/移动端空状态。
- `preflight-check.ps1` 的 `SMOKE_UI=true` 分支已加入模板 UI smoke 和图库 UI smoke，后续一轮 UI 预检会覆盖这两条主流程。

### 需要继续验证

- 模板页真实 New-API 接入后，提示词结构和生成结果耗时需要重新校准。
- 当前模板 UI smoke 使用 `logo.png` 作为测试素材，适合验证链路，不代表真实商品图视觉质量。
- 你需要人工看模板上传/反推/生成截图，确认布局和手感是否接受。

## 2026-06-25 Docker HOST_PORT 部署复核

### 已确认

- Docker Desktop Engine 已可用，`docker info` 正常返回 Server 信息。
- 默认 `3456` 端口被本地 Node 服务占用时，Docker 直接启动会报端口绑定失败。
- 已新增 `HOST_PORT`：宿主机端口可设为 `3457`，容器内部仍保持 `PORT=3456`。
- 使用 `HOST_PORT=3457` 完整执行 `scripts\verify-internal-deploy.ps1` 通过：compose config、build、up、health、API smoke、前端路由 smoke、restart persistence smoke、compose ps。
- 最终容器状态为 healthy，映射 `0.0.0.0:3457->3456/tcp`。

### 需要继续验证

- 服务器部署时建议只使用一个正式端口，避免 Node 本地服务和 Docker 同时抢端口。
- 公司内网访问需要按实际服务器 IP、防火墙入站规则和路由策略再测。

## 2026-06-25 后台按钮颜色清新化复核

### 已确认

- 按人工反馈，后台主按钮不再使用偏亮、偏糖果感的薄荷渐变。
- `assets/admin-visual-polish.css` 只调整后台主按钮颜色、边框和阴影，不改后台卡片结构、圆角、高度、表格布局。
- Playwright 已重新打开 `/admin/settings`，`保存设置` 按钮 computed style 为：背景 `rgb(16, 185, 129)`、文字 `rgb(255, 255, 255)`、边框 `rgba(16, 185, 129, 0.9)`、轻阴影 `rgba(16, 185, 129, 0.18)`。
- 截图已归档：`settings-save-button-fresh-green-desktop-1440x900.png`。
- 后台 UI smoke 已通过，覆盖 Dashboard、系统设置保存、API 线路弹窗、兑换码弹窗、模板工作流保存。
- `/api/generation/estimate-cost` 已改为未登录可 mock 预估，`smoke-api.ps1` 已补 public estimate 覆盖，避免首页未登录 401 刷红。

### 需要继续验证

- 后台 10 页还要继续逐页看标题、图标、按钮、字距、表格密度和空状态。
- 这次没有做后台整体风格重排，只处理颜色突兀点；后续视觉问题继续按截图逐个收。
- 新颜色需要人工确认是否比原截图里的浅薄荷按钮舒服。

## 2026-06-25 首页/画布入口 UI Smoke 复核

### 已确认

- 新增 `scripts/smoke-home-canvas-ui.ps1` 和 `scripts/smoke-home-canvas-ui-runner.js`。
- 首页检查项包含：`电商自动化工作台`、`Beta`、`电商全流程工作台`、`我的历史画布项目`、`新画布`、`模板`、`图库`，并验证 `.history-track` 的 `data-inertia-ready=1`。
- 画布检查项包含：Vue Flow 容器、工具栏文字、画布节点文字，当前 smoke 打开后可渲染 2 个节点。
- 本轮修复未登录 `/api/user/api-status` 401，和未登录 `/api/generation/estimate-cost` 一样走 mock 兜底；重跑首页/画布 UI smoke 后 console error 为 0，badResponses 为 0。
- 新脚本已接入 `preflight-check.ps1` 和 `verify-internal-deploy.ps1` 的 `SMOKE_UI=true` 分支。
- Docker 已用 `HOST_PORT=3457` 重新构建并跑通部署验证，容器内 API smoke 覆盖 public `/api/user/api-status`。

### 需要继续验证

- 首页移动端和画布移动端还没有纳入这个新 smoke，本轮只覆盖桌面 1440x900。
- 画布本地自动保存提醒是当前本地优先策略的预期提示，后续需要人工确认是否影响使用感。
- 后台逐页视觉复核仍要继续，尤其是标题、按钮、图标和表格密度。

## 2026-06-25 后台 10 页视觉审计护栏

### 已确认

- 已重跑后台 10 页 `full-*.png` 截图：Dashboard、用户、订单、日志、兑换码、API 线路、模型价格、任务监控、模板工作流、系统设置。
- `smoke-admin-pages-ui-runner.js` 已从“截图可打开”增强为“截图 + 样式审计”：标题颜色/字重、按钮样本、旧薄荷按钮残留、表格行高、sticky 操作列宽度都会被检查。
- 本轮 10 页全部通过：标题颜色均为深色 `rgb(2, 6, 23)`，标题字重均为 `900`，旧薄荷按钮残留 0。
- 表格行高审计通过：普通表格 58px，用户/API 线路/任务监控等复杂行最大 85px，未超过 92px。
- sticky 操作列审计通过：当前固定操作列宽度 226px，未超过 245px，背景为白色。

### 需要继续验证

- 视觉审计能抓基础一致性，但不能替代人工审美判断；仍需要人工确认宽表操作列、按钮密度和列表可读性。
- 用户管理、API 线路、任务监控仍是宽表结构，若后续觉得操作列拥挤，建议做“更多操作”菜单或详情抽屉。
- 后台移动端还没有做专项体验优化。

## 2026-06-25 后台保存刷新回显 UI 验证

### 已确认

- 新增 `scripts/smoke-admin-save-echo-ui.ps1` 和 `scripts/smoke-admin-save-echo-ui-runner.js`。
- 系统设置页已验证：临时修改“新用户注册赠送”数值，打开真实后台页面、点击保存、刷新后仍能回显，然后恢复原设置。
- API 线路页已验证：临时创建 New-API 风格线路，刷新页面能看到线路名称和 Base URL，截图后删除临时线路。
- 模型价格页已验证：临时创建模型价格，刷新页面能看到模型名称，截图后删除临时模型。
- 模板工作流页已验证：通过真实 UI 修改第一个模板名称、点击保存配置、刷新后输入框仍回显，截图后恢复原模板配置。
- 截图已归档：`save-echo-settings-desktop-1440x900.png`、`save-echo-api-provider-desktop-1440x900.png`、`save-echo-model-prices-desktop-1440x900.png`、`save-echo-template-workflows-desktop-1440x900.png`。
- 新脚本已接入 `preflight-check.ps1` 和 `verify-internal-deploy.ps1` 的 `SMOKE_UI=true` 分支。

### 需要继续验证

- 这轮覆盖的是桌面后台复杂配置链路；后台移动端表格/弹窗还没有专项优化。
- Playwright 自动截图能证明打开和回显，但最终视觉舒适度仍需要人工看截图确认。
- New-API 真实 token 接入后，API 线路“测试连接”和模型同步还需要再做真实网关验收。

## 2026-06-25 移动端主流程 Smoke 加固

### 已确认

- `scripts/smoke-mobile-ui.ps1` 现在会读取 `SMOKE_BASE_URL`、检查 `/api/health`，并自动打开 Playwright session，后续可用于本地 `3456` 和 Docker `3457`。
- 移动端 runner 已覆盖 390x844 首页、模板、画布、用户兑换码、后台 Dashboard、后台 API 线路、后台模板工作流。
- 首页移动端验证结果：`horizontalOverflow=0`，标题没有拆成单字，console error 为 0，bad response 为 0。
- 画布移动端验证结果：Vue Flow 存在，节点数为 2，横向溢出为 0。
- 后台移动端三页可打开并截图，未出现 404/500 或关键 console 错误。
- `SMOKE_UI=true` 的预检和 Docker 部署验证链已接入移动端 smoke。

### 需要继续验证

- 后台移动端仍偏“能用优先”，复杂表格没有做卡片化，后续如果要给手机端正式使用，需要单独做设计。
- 移动端截图能证明无空白和无明显溢出，但视觉审美仍需要人工看图确认。

## 2026-06-25 后台移动端视觉微调

### 已确认

- 顶部操作按钮新增移动端 nowrap 规则，`返回前台` 不再在 390 宽度下拆成竖字。
- 后台移动端表格最小宽度调整为 820px，保留横向滚动策略。
- 移动端 sticky 操作列从 226px 收窄到 188px，表格按钮缩小到 10.5px/50px，API 线路页面右侧按钮压迫感降低。
- 重跑 `scripts/smoke-mobile-ui.ps1` 通过：首页、模板、画布、用户兑换码、后台 Dashboard、API 线路、模板工作流均无 404/500、无 console error、无 bad response。
- 人工查看最新 `admin-dashboard-mobile-390x844.png`、`admin-api-providers-mobile-390x844.png`、`admin-template-workflows-mobile-390x844.png`，顶部按钮和 API 线路操作列较上一版更自然。

### 需要继续验证

- 当前仍不是后台移动端正式卡片化方案，只是内网人工测试阶段的视觉压迫修复。
- 用户管理、订单、日志、任务监控等更多后台宽表移动端截图后续可继续专项抽查。

## 2026-06-25 New-API/CPA Provider 护栏

### 已确认

- 新增 `scripts/smoke-provider-guard.ps1`。
- `/api/health` 当前返回 `providers.ai.gateway = new-api`，并声明 `routesThroughNewApi=true`、`cpaExpectedBehindNewApi=true`。
- 当前未启用真实 AI，Provider guard 验证后台 API 线路测试返回 `mock:true`。
- 当前未启用真实 AI，Provider guard 验证 `/api/chat/completions` 返回本地 mock 响应。
- 脚本已接入 `preflight-check.ps1` 和 `verify-internal-deploy.ps1`，以后默认预检会检查无 key mock 回落护栏。

### 需要继续验证

- 真实 New-API 地址和 token 还没有配置，真实网关联通测试未执行。
- CPA 只作为 New-API 后置渠道，本项目不保存 CPA 账号池凭据；CPA 是否可用需要在 New-API 后台单独验证。

## 2026-06-25 API 线路弹窗可读性

### 已确认

- 原 API 线路新增/编辑弹窗只有 placeholder，没有字段 label；已有值时用户无法判断每个白色输入框含义。
- 新增 `assets/admin-api-form-labels.js`，运行时只增强 API 线路弹窗，不影响其他页面。
- 弹窗现在会显示 18 个中文字段名和说明：后端真实名称、前端展示名称、线路标识、渠道类型、接口格式、Base URL、API Key、聊天接口、生图接口、视频接口、默认聊天模型、默认生图模型、默认视频模型、优先级、线路倍率、状态、默认线路、备注。
- API Key 说明明确：编辑时留空表示不修改，不要把真实 key 提交到 Git。

### 需要继续验证

- 用户手动填真实 New-API 线路后，需要继续测后台“测试连接”。
- 模板反推和模板生图当前仍是 mock 逻辑，真实 New-API 连通后需要继续补这两条业务调用链。

## 2026-06-25 画布生图接通排查

### 已确认

- 本地服务重启后，`.env` 中的 key 已被识别：`/api/health` 返回 `textKeyConfigured=true`、`imageKeyConfigured=true`。
- 当前仍是 mock 模式：`/api/health` 返回 `providers.ai.enabled=false`，原因是 `.env` 没有启用 `ENABLE_REAL_AI=true`。
- `/api/generate/tasks` 已改为真实启用时调用 Provider Adapter 的图片生成；未启用时继续 mock。
- `/api/template/generate-image` 已改为真实启用时调用 Provider Adapter 的图片生成；未启用时继续 mock。
- 新增 `/api/proxy-image`，用于把上游远程图片转为本地同源地址，降低画布本地素材保存时的跨域 `Failed to fetch`。
- 已验证 mock 模式下画布生图和模板生图都返回 `success=true`、`mock=true`，返回的 `/api/mock-image/*.svg` 可 200 打开。
- 本地 Node `3456` 已运行本轮代码；Docker `3457` 重建时 Docker Desktop 报 `metadata.db: input/output error`，随后 `docker compose ps` 返回 `Docker Desktop is unable to start`，说明容器尚未更新到本轮代码，且 Docker 引擎需要人工重启。

### 需要继续验证

- 真实 New-API 尚未启用，不应声称真实生图已跑通。
- 开启真实调用需要人工在 `.env` 加 `ENABLE_REAL_AI=true` 并重启服务；这可能产生费用。
- 真实 New-API 的 `/images/generations` 返回结构、模型名和尺寸参数还需要一次实测；如果 New-API 使用自定义 endpoint，需要继续调整 Provider Adapter。
- 模板反推仍是 mock 文案，后续需要接 `/chat/completions` 或专门的反推 workflow。
- Docker Desktop 需要人工重启后再重建容器，确认 `docker compose ps` 可用，以及 `http://127.0.0.1:3457/api/proxy-image` 不再是 404。

## 2026-06-25 New-API 真实联通测试

### 已确认

- `.env` 加入 `ENABLE_REAL_AI=true` 并重启本地 Node 后，`/api/health` 已显示真实模式：`enabled=true`、`mode=real-provider-ready`。
- Packy API 根路径 `https://www.packyapi.com` 返回网页 HTML，不是 OpenAI-compatible API JSON；正确 Base URL 已确认为 `https://www.packyapi.com/v1`。
- 后台 API 线路测试已通过真实文本 ping：`New-API 网关连接正常`，延迟约 3.9 秒。
- `server.js` 已修复 HTML 200 误判问题：如果 `/chat/completions` 没有返回 `choices`，会返回 `PROVIDER_CHAT_BAD_RESPONSE`。

### 需要继续验证

- 真实生图仍未通过，上游返回：`分组 codex 下模型 gpt-image-2 无可用渠道（distributor）`。
- 需要在 Packy/New-API 后台给 `codex` 分组配置可用的 `gpt-image-2` 生图渠道，或更换有生图权限的 key/分组。
- 如果 Packy 后台实际生图模型名不是 `gpt-image-2`，需要同步修改 `.env` 的 `AI_IMAGE_MODEL`。
- Docker Desktop 仍需人工重启后重建容器，当前本地 Node `3456` 是真实联通测试依据。

## 2026-06-25 画布生图模型类型保护

### 已确认

- `/api/model-routes?group=image` 返回图片线路和图片模型，`/api/model-routes?group=text` 返回文本线路和文本模型。
- 画布后端图片生成入口已新增模型类型保护：如果请求误传 `gpt-5.5` 这类文本模型，后端会回落到 `AI_IMAGE_MODEL` 或默认图片模型，不再拿文本模型请求 `/images/generations`。
- 验证时故意传 `model=gpt-5.5`，后端实际请求回落到 `gpt-image-2`，说明保护生效。

### 需要继续验证

- Packy token/分组仍是真实阻塞点：`gpt-image-2` 返回 `分组 codex 下模型 gpt-image-2 无可用渠道`。
- `gemini-3-pro-image-preview` 返回 `当前令牌未覆盖供应商 Google（已选分组=[codex mimo-officially]）`。
- 需要人工在 Packy/New-API 后台确认 token 所属分组、供应商覆盖和生图渠道。

## 2026-06-25 真实生图联通成功

### 已确认

- 用户更换生图可用 key 后，Packy `/v1/models` 可见 `gpt-image-2`。
- `/api/generate/tasks` 使用 `gpt-image-2` 已真实返回图片：`success=true`、`mock=false`、`providerMode=real-provider-ready`。
- 上游远程图已通过 `/api/proxy-image` 转为本地同源地址，代理请求返回 HTTP 200。
- 任务响应已补顶层 `modelKey/model` 字段，便于前端和日志展示。

### 需要继续验证

- 浏览器画布节点真实点击生成尚待人工确认。
- 模板页真实生图尚待人工确认。
- Docker Desktop 仍需重启后重建容器，本轮真实生图成功基于本地 Node `3456`。

## 2026-06-25 Packy 生图参数兼容

### 已确认

- Packy `/images/generations` 不接受 `response_format` 参数，画布错误 `Unknown parameter: 'response_format'` 来自这里。
- 移除 `response_format` 后，真实 `gpt-image-2` 生图成功。
- 图片生成耗时约 27 秒，本轮将图片超时独立设置为 180 秒，文本请求仍保持 30 秒。
- 返回的远程结果图经 `/api/proxy-image` 代理后 HTTP 200。

### 需要继续验证

- 前端画布节点真实点击后是否等待足够久。
- 模板页真实生图是否复用同一条兼容路径。

## 2026-06-26 源码化技术栈任务树启动

### 已确认

- 主目录固定为 `F:\dianshang`，并行工作树统一规划为 `F:\dianshang-worktrees\*`。
- CodeGraph 已在 `F:\dianshang` 初始化，结构定位和调用链分析后续优先用索引工具。
- 新前端成熟基座固定为 Vue 3、Vite、TypeScript、Vue Router、Pinia、Axios、Naive UI、lucide-vue-next、Vue Flow。
- 新画布继续基于 Vue Flow，不自研拖拽、连线、缩放、视口和小地图。
- 后端暂不创建 NestJS 工程，先写 API 契约和模块边界，避免推倒当前可运行旧版本。
- `docs/api-contract-next.md`、`docs/backend-module-boundaries.md`、`docs/canvas-migration-checklist.md` 已作为第一批迁移边界文档落地。
- `.codegraph/` 已加入 `.gitignore`，本地索引不会进入版本库。

### 需要继续验证

- API 契约需要继续对照真实 `/api/*` 路由、字段和错误码做逐项复核。
- 新版 `/canvas` 需要人工点测节点新增、属性面板、连线、JSON 导入导出、本地保存和生成入口。
- 后端模块边界需要补充数据库表归属、错误码归属和 smoke 覆盖关系。
- 未经确认不安装新依赖、不引入数据库/Redis/对象存储、不真实调用外部服务。

## 2026-06-26 哈基米旧画布 UI 迁移

### 已确认

- 用户明确要求新版画布 UI 继续使用哈基米旧画布的整体布局和卡片板块。
- `Infinite-Canvas-main.zip` 是用户提供的画布源码参考，但本轮 UI 主风格以用户截图中的哈基米旧画布为准。
- Vue Flow 继续作为底层成熟画布引擎；顶部工具条、左侧 Canvas Chat、右侧 Create Node、节点卡片视觉为本项目业务 UI。
- 默认节点坐标已整体避开左侧 Canvas Chat，且导入或读取旧本地缓存时会自动右移避免遮挡。
- 浏览器截图已归档：`docs/design-references/canvas-hjm-legacy-layout-final-2026-06-26.png`。

### 需要继续验证

- 用户人工确认新版 `/canvas` 与截图中的旧哈基米画布视觉接近度。
- 右侧节点菜单的“文生图、视频生成、撤销、重做”目前是 UI 占位，还未接完整动作。
- 左侧快速模式输入框还未接真实生成任务，只完成 UI 迁移。

## 2026-06-26 Infinite-Canvas 节点与模板迁移

### 已确认

- 新 Vue Flow 画布已注册 Infinite-Canvas 第一批全量节点：图片、提示词、循环、LLM、API生成、MS生成、视频生成、RunningHub、ComfyUI、LTX Director、Output、分组、提示词组。
- 所有节点通过同一个 Store 注册表创建，避免后续继续搓临时节点。
- 提示词模板直接来自 `Infinite-Canvas-main` 的系统模板 Markdown，已进入 `frontend/public/system-prompts/infinite-canvas-prompt-templates.md`。
- 浏览器自动化已验证：13 类节点都能创建，提示词模板可见并可应用，运行按钮可让节点进入 ready/done 状态，图片和视频示例输出字段存在。

### 需要继续验证

- 真实外部执行器尚未逐项接入；当前是前端运行状态与示例输出跑通。
- 后续接真实执行器前，需要确认 ComfyUI、RunningHub、ModelScope、LTX、视频 API 的环境、密钥和本机/局域网地址。
- 提示词模板目前先显示搜索结果前 8 个；后续需要补分类 Tab、详情预览、正向/完整应用两个按钮，与 Infinite-Canvas 行为完全对齐。

## 2026-06-26 Infinite-Canvas 运行适配器

### 已确认

- 新增 `canvasRunner` 适配器，避免把运行逻辑散写在画布组件内。
- `generator` 和 `msgen` 已接入本地成熟接口 `/api/generate/tasks`。
- `llm` 已接入本地成熟接口 `/api/chat/completions`。
- 适配器会从 Vue Flow 连线收集上游提示词和参考图，符合 Infinite-Canvas 的节点输入输出迁移方向。
- 未登录浏览器验证中，真实后端接口返回 401，节点进入 error 并显示明确原因；没有执行真实外部付费调用。
- `video`、`ltxDirector`、`comfy`、`rh` 当前可完成前端运行状态，但真实外部执行器仍需要环境配置。

### 需要继续验证

- 登录态下真实 `generator` 生图需要人工确认，因为可能消耗算力。
- 登录态下真实 `llm` 文本改写需要人工确认，因为可能消耗模型额度。
- ComfyUI、RunningHub、LTX、视频生成必须先确认环境和密钥，不能写自研替代执行器。

## 2026-06-26 新画布废止并回滚旧画布

### 已确认

- 用户明确要求“新画布直接全部废止，回滚到旧画布”。
- `frontend/` 中的新画布已经从构建链路移除：删除 `CanvasStudio.vue`、新画布 Store、类型、运行适配器和 Infinite-Canvas 提示词模板文件。
- 已卸载 `@vue-flow/core`、`@vue-flow/background`、`@vue-flow/controls`、`@vue-flow/minimap`，新前端不再依赖 Vue Flow。
- `frontend/src/views/LegacyCanvasRedirect.vue` 负责把新前端 `/canvas` 跳转到旧后端 `http://127.0.0.1:3456/canvas`。
- 旧画布资产 `assets/Canvas-*.js/css` 和旧后端 `server.js` 未被本轮修改。

### 需要继续验证

- 人工打开 `http://127.0.0.1:3456/canvas`，确认回到旧画布。
- 后续画布问题只在旧画布链路做最小修复，不继续推进新画布或 Infinite-Canvas 节点迁移。

## 2026-06-26 前端源码化迁移骨架

### 已确认

- 前端源码化不再包含新画布。
- 未迁移页面使用统一桥接组件跳转旧前端，避免旧功能断链。
- `frontend/src/config/frontendMigration.ts` 成为页面迁移索引，每个路由标记 source 或 legacy。
- 首页显示迁移索引，便于人工确认哪些页面还在旧版、哪些已进入源码。

### 需要继续验证

- `/template-image` 是下一批最适合迁移的核心业务页。
- 后台页面数量多，建议最后迁移。

## 2026-06-26 模板生图页源码迁移

### 已确认

- `/template-image` 已由 `frontend/` 源码承载，不再桥接旧页面。
- 模板配置来自 `/api/template/settings`，当前可加载 10 个模板。
- 图片/文本线路来自 `/api/model-routes?group=image/text`。
- 反推和生成沿用旧后端接口，不新造业务接口。
- 无登录验证只触发本地 401，不会发生真实付费生成。

### 需要继续验证

- 登录态真实上传和反推。
- 登录态真实生成前需人工确认算力消耗。
- 移动端 390px 布局还需截图复核。

## 2026-06-26 图库页源码迁移

### 已确认

- `/gallery` 已由 `frontend/` 源码承载，不再桥接旧页面。
- 图库历史读取复用 `/api/user/generations`。
- 删除记录复用 `DELETE /api/user/generations/:id`，未新增后端接口。
- 无登录验证只触发预期 401，并显示中文登录提示。
- 截图已归档：`docs/design-references/gallery-source-2026-06-26.png`。

### 需要继续验证

- 登录态真实图库数据。
- 删除记录需要测试数据确认后再点测。
- 移动端布局需补截图。

## 2026-06-26 登录注册源码迁移

### 已确认

- `/login` 和 `/register` 已由 `frontend/` 源码承载。
- 登录接口复用 `/api/auth/login`。
- 注册流程复用 `/api/auth/send-email-code` 和 `/api/auth/register`。
- 已用默认账号 `admin/admin123` 验证登录成功。
- 登录后 token 写入 `auth_token`，源码图库页可带 token 请求，不再出现 401。

### 需要继续验证

- 注册新账号完整路径。
- 源码前端退出登录。
- 登录态下模板页上传/反推/生成。

## 2026-06-26 用户中心源码迁移

### 已确认

- `/user/center` 已由 `frontend/` 源码承载。
- 用户资料复用 `/api/user/profile`。
- 余额流水复用 `/api/user/balance-logs`。
- API 状态复用 `/api/user/api-status`。
- 已用 `admin/admin123` 验证登录态用户中心，无 4xx 响应。
- 截图已归档：`docs/design-references/user-center-source-2026-06-26.png`。

### 需要继续验证

- `/user/records` 和 `/user/redeem` 仍需源码迁移。
- 头像上传和头像预设编辑暂未迁移。
- 移动端布局需补截图。

## 2026-06-26 生成记录与兑换码源码迁移

### 已确认

- `/user/records` 已由 `frontend/` 源码承载，生成历史复用 `/api/user/generations`，余额流水复用 `/api/user/balance-logs`。
- `/user/redeem` 已由 `frontend/` 源码承载，用户余额复用 `/api/user/profile`，兑换提交复用 `/api/user/redeem`，最近流水复用 `/api/user/balance-logs`。
- 已用默认账号 `admin/admin123` 验证登录态访问；生成记录页显示 13 条生成记录和 16 条余额流水；兑换页显示当前算力 `999989` 和 8 条最近流水。
- 浏览器验收没有 page error，也没有 4xx/5xx API 响应。
- 截图已归档：`docs/design-references/user-records-source-2026-06-26.png`、`docs/design-references/user-redeem-source-2026-06-26.png`。

### 需要继续验证

- 真实兑换码提交会改变余额，自动化未提交兑换码；需要测试码或人工确认后再测。
- 移动端布局还需补 390px 截图。
- 头像上传/预设头像编辑暂未进入源码化迁移。

## 2026-06-26 用户模块移动端与登录态前台回测

### 已确认

- 390x844 移动端打开 `/user/records` 时，初次回测发现横向溢出 90px，原因是生成图片卡片被图片固有宽度撑开。
- 已补源码 CSS 约束，复跑后 `/user/records` 的 `scrollWidth=clientWidth=390`，横向溢出为 0。
- `/user/redeem` 移动端同样为 0 横向溢出，余额和最近流水可见。
- 登录态 `/template-image` 只做非付费加载回测，确认 10 个模板、2 个素材槽、无 4xx/5xx API。
- 登录态 `/gallery` 确认 13 张记录、无 4xx/5xx API。
- 截图已归档：`docs/design-references/user-records-source-mobile-390x844-2026-06-26.png`、`docs/design-references/user-redeem-source-mobile-390x844-2026-06-26.png`、`docs/design-references/template-image-source-login-2026-06-26.png`、`docs/design-references/gallery-source-login-2026-06-26.png`。

### 需要继续验证

- 浏览器仍有一个非 API 的 404 静态资源提示，业务 API 无 4xx/5xx；后续可单独补 favicon 或定位静态资源。
- 真实模板反推/生成会消耗模型额度，本轮未点击。
- 图库删除和兑换码提交会改数据，本轮未点击。
- 部分历史中文 prompt 显示为问号，疑似早期数据编码遗留，需要另开数据修复任务。

## 2026-06-26 Codex 自带浏览器前台源码页点测

### 已确认

- 已按用户要求使用 Codex 自带浏览器可见窗口点测，不再只依赖 headless 截图。
- 默认账号 `admin/admin123` 可在源码登录页登录，登录后跳转 `/gallery`。
- 桌面视口点测结果：
  - `/gallery`：标题“图库历史”，13 张图库卡片，横向溢出 0。
  - `/template-image`：标题“模板生图工作台”，10 个模板按钮，2 个素材槽，横向溢出 0。
  - `/user/records`：标题“生成记录”，2 个面板、13 条生成记录、16 条流水，横向溢出 0。
  - `/user/redeem`：标题“兑换码”，余额 `999989`、8 条最近流水，横向溢出 0。
- 移动端视口点测结果：
  - `/user/records`：横向溢出 0，13 条生成记录和 16 条流水可见。
  - `/user/redeem`：横向溢出 0，余额 `999989` 可见。
- 自带浏览器页面业务控制台错误为 0。
- 截图已归档：`docs/design-references/iab-gallery-source-login-2026-06-26.png`、`docs/design-references/iab-template-image-source-login-2026-06-26.png`、`docs/design-references/iab-user-records-source-2026-06-26.png`、`docs/design-references/iab-user-redeem-source-2026-06-26.png`、`docs/design-references/iab-user-records-mobile-390x844-2026-06-26.png`、`docs/design-references/iab-user-redeem-mobile-390x844-2026-06-26.png`。

### 需要继续验证

- 本轮没有触发真实生成、兑换码提交和图库删除，避免消耗额度或改数据。
- 自带浏览器运行环境出现过 Codex/Statsig 统计请求超时日志，不影响本地业务页；后续只把业务页面控制台作为验收依据。
- 注册新账号和后台源码页仍未进入本轮点测。

## 2026-06-26 源码前端 Playwright 点击 Smoke

### 已确认

- 新增 `scripts/smoke-source-frontend-ui.ps1` 和 `scripts/smoke-source-frontend-ui-runner.js`，专门覆盖 `frontend/` Vue3 源码页，并接入 `scripts/preflight-check.ps1` 的 `SMOKE_UI=true` 分支。
- 脚本使用 Playwright CLI，不新增依赖；`npx` 已确认可用。
- 点击链路已跑通：
  - 登录页填写 `admin/admin123` 并点击登录。
  - 图库页填写搜索词 `simple`，确认至少 1 张卡片，再点击刷新。
  - 模板页点击“白底图”，确认选中模板发生变化，再填写提示词文本。
  - 生成记录页填写搜索词 `simple`，确认至少 1 条记录，再点击刷新。
  - 兑换码页填写测试文本，但只点击刷新，不提交兑换码。
  - 390x844 移动端复核 records/redeem 横向溢出为 0。
- 脚本输出无 4xx/5xx API、无业务 console error。
- 截图已归档到 `docs/design-references/source-frontend-2026-06-26/`。

### 需要继续验证

- 真实生成、兑换码提交和图库删除仍需要人工确认费用和测试数据后再测。

## 2026-06-26 源码前端注册点击 Smoke

### 已确认

- `/register` 注册页已纳入 `scripts/smoke-source-frontend-ui-runner.js`。
- Playwright 会填写唯一临时用户名、邮箱和密码，点击“发送验证码”，确认验证码自动填入，再点击“注册”。
- 注册成功后确认跳转 `/gallery`，并保存注册成功截图。
- 注册产生的临时用户会通过后台登录接口清理：先软删除，再调用回收站永久删除接口。
- 清理后脚本清空本地登录态，再继续默认账号 `admin/admin123` 的原有源码前端点击回归。
- 重新运行 `scripts/smoke-source-frontend-ui.ps1` 已通过，结果包含 `register ok` 和 `register-cleanup ok`。

### 需要继续验证

- 注册 smoke 使用当前本地服务和当前库，虽然会清理临时用户，但仍属于写入型测试；生产环境运行前需要确认测试库或 disposable 环境。
- 真实生成、真实兑换码提交和图库删除仍没有自动执行，避免费用和数据变化。

## 2026-06-26 源码前端导航与退出登录 Smoke

### 已确认

- 首页迁移索引已纳入 `scripts/smoke-source-frontend-ui-runner.js`。
- Playwright 会打开 `/`，确认“前端迁移索引”，点击 `/user/center` 源码入口进入用户中心。
- 用户中心会检查横向溢出为 0，并点击“图库历史”快捷按钮确认可导航到图库页。
- 脚本末尾会回到用户中心点击“退出登录”，确认跳转 `/login`，并确认 localStorage 中 `auth_token` 和 `auth_user` 已清空。
- 重新运行源码前端 smoke 已通过，结果包含 `home-index-user-navigation ok` 和 `logout ok`。

### 需要继续验证

- 真实付费和破坏性动作仍未自动执行。
- 后台源码化页面尚未进入 `frontend/`。

## 2026-06-26 源码前端未登录边界与自带浏览器点击复核

### 已确认

- `scripts/smoke-source-frontend-ui-runner.js` 已移除 `networkidle` 硬等待，统一使用 DOM 就绪加短暂稳定等待，避免源码前端 smoke 在本地开发服务中卡死。
- 源码前端 smoke 已新增未登录态边界：
  - `/gallery` 显示“请先登录”提示，预期 401 被白名单识别。
  - `/user/center` 显示“请先登录后查看用户中心。”
  - `/user/records` 显示“请先登录后查看生成记录。”
  - `/user/redeem` 显示“请先登录后兑换。”
- 重新运行源码前端 smoke 已通过，覆盖注册清理、未登录边界、默认账号登录、首页跳转、用户中心快捷导航、图库、模板、记录、兑换页、移动端和退出登录。
- 已按用户要求使用 Codex 自带浏览器真实点击当前页面：兑换页填写测试码但不提交、点击刷新、点击用户中心、从用户中心点击图库历史、进入生成记录并搜索 `simple`。
- 自带浏览器复核的 `/user/redeem`、`/user/center`、`/gallery`、`/user/records` 横向溢出均为 0。

### 需要继续验证

- 本轮仍未触发真实生成、兑换码提交、图库删除，避免费用和数据变化。
- Codex 自带浏览器运行时出现 Statsig 统计请求超时日志，但本地业务页面检查通过；后续仍以业务 API 和页面错误作为验收依据。

## 2026-06-26 源码首页迁移看板复核

### 已确认

- 首页迁移看板直接读取 `frontendMigrationRoutes`，没有硬编码新增路由列表。
- 页面显示 `8` 个源码页面、`13` 个旧版桥接、`21` 个总入口。
- 阶段卡显示“前台源码化”“旧画布保留”“后台迁移”，和当前画布废止、后台桥接策略一致。
- Playwright smoke 已新增首页统计和阶段卡断言，避免后续路由变化时看板静默失真。
- Codex 自带浏览器已打开首页并检查横向溢出为 0；滚动到迁移索引后点击“模板生图”，成功进入 `/template-image`。

### 需要继续验证

- 首页看板只解决迁移透明度，不代表后台页面已源码化。
- CodeGraph 索引仍显示已废止的新画布文件，后续结构分析前需要重建或谨慎对照磁盘状态。

## 2026-06-26 源码后台登录复核

### 已确认

- `/admin/login` 已由 `frontend/` 源码承载，并从迁移配置中的 `legacy` 改为 `source`。
- 登录接口复用 `/api/admin/login`，不新增后端接口、不新增依赖。
- 登录成功后写入源码前端 `auth_token/auth_user`，页面展示“管理员登录成功”。
- Playwright smoke 已覆盖后台登录源码页，确认默认管理员账号可登录并保存 session。
- Codex 自带浏览器点测通过：填写 `admin/admin123` 后显示成功态，再访问 `/user/center` 可读取 admin 资料，证明源码前端 session 生效。

### 需要继续验证

- 旧后台运行在 `http://127.0.0.1:3456`，源码前端运行在 `http://127.0.0.1:5173`，两个 origin 的 localStorage 不共享；旧后台仍需旧入口登录。
- 后台其余页面仍是旧桥接，下一步应从只读 Dashboard 开始迁移，不先动删除、保存、价格等写入页。

## 2026-06-26 源码后台 Dashboard 复核

### 已确认

- `/admin/dashboard` 已由 `frontend/` 源码承载，并从迁移配置中的 `legacy` 改为 `source`。
- Dashboard 只调用只读接口：`/api/admin/dashboard` 和 `/api/admin/dashboard/user-credit-ranking`。
- 页面展示 6 张统计卡、模型使用、线路概览、用户消耗排行和最近生成任务。
- Playwright smoke 已覆盖桌面 Dashboard、刷新按钮、排行/任务行数和 390x844 移动端横向溢出。
- Codex 自带浏览器点测通过：打开 `/admin/dashboard`，点击“刷新”，页面横向溢出为 0。

### 需要继续验证

- 后台 Dashboard 是只读迁移，不代表用户管理、API 线路、模型价格等写入页已源码化。
- `F:\dianshang` 后端依赖未安装，独立启动会缺 `express`；本轮继续复用旧项目后端 `C:\Users\pc\Desktop\hjm-mb-clone`。

## 2026-06-26 源码后台用户管理只读复核

### 已确认

- `/admin/users` 已由 `frontend/` 源码承载，并从迁移配置中的 `legacy` 改为 `source`。
- 用户页只调用只读接口 `/api/admin/users`，不提供删除、改余额、重置密码等写入动作。
- 页面支持关键词搜索、角色/状态筛选、分页和刷新，统计卡显示总数、当前页、启用账户、管理员和余额。
- Playwright smoke 已覆盖桌面用户管理搜索 `admin`、刷新、统计卡数量、列表行数、`admin@local` 可见性，以及 390x844 移动端横向溢出。
- Codex 自带浏览器点测通过：打开 `/admin/users`，搜索 `admin`，点击“查询”和“刷新”，页面横向溢出为 0。

### 需要继续验证

- 当前用户管理页是只读迁移，不代表旧后台的删除、恢复、改余额、重置密码等写入能力已源码化。
- CodeGraph 当前 Vue 索引数量少于实际源码页，继续结构分析前应考虑重建索引或以构建结果为准。

## 2026-06-26 源码后台任务监控只读复核

### 已确认

- `/admin/generate-tasks` 已由 `frontend/` 源码承载，并从迁移配置中的 `legacy` 改为 `source`。
- 任务监控页只调用只读接口 `/api/admin/generate-tasks`，不调用取消任务和删除任务接口。
- 页面支持关键词搜索、状态筛选、分页和刷新，统计卡显示总数、成功、运行中、等待、失败和当前页消耗。
- Playwright smoke 已覆盖桌面任务监控搜索 `simple`、刷新、统计卡数量、列表行数、`gpt-image-2` 可见性，以及 390x844 移动端横向溢出。
- Codex 自带浏览器点测通过：打开 `/admin/generate-tasks`，搜索 `simple`，点击“查询”和“刷新”，页面横向溢出为 0。

### 需要继续验证

- 当前任务监控页是只读迁移，不代表旧后台的取消任务、删除任务等写入能力已源码化。
- 旧接口不支持关键词服务端搜索，本轮是当前页前端筛选；新后端接管时需要在 API 契约里补正式 keyword 参数。

## 2026-06-26 源码后台消费日志只读复核

### 已确认

- `/admin/logs` 已由 `frontend/` 源码承载，并从迁移配置中的 `legacy` 改为 `source`。
- 消费日志页只调用只读接口 `/api/admin/usage-logs`，不调用余额调整或用户写入接口。
- 页面支持关键词搜索、类型筛选、分页和刷新，统计卡显示总数、当前页收入、当前页消耗、生成记录和兑换记录。
- Playwright smoke 已覆盖桌面消费日志搜索 `注册赠送`、刷新、统计卡数量、列表行数、文本可见性，以及 390x844 移动端横向溢出。
- Codex 自带浏览器点测通过：打开 `/admin/logs`，搜索 `注册赠送`，点击“查询”和“刷新”，页面横向溢出为 0。

### 需要继续验证

- 当前消费日志页是只读迁移，不代表旧后台余额调整、用户删除、兑换码管理等写入能力已源码化。
- 旧接口的 `logs` 字段是全量数组，`items` 是分页数组；本轮已修正前端归一化优先级，但新后端契约需要把字段含义固定下来。

## 2026-06-26 源码后台订单管理只读复核

### 已确认

- `/admin/orders` 已由 `frontend/` 源码承载，并从迁移配置中的 `legacy` 改为 `source`。
- 订单管理页只调用只读接口 `/api/admin/orders`，不调用 `/api/admin/orders/:id/status`。
- 页面支持订单号/用户/邮箱搜索、状态筛选、分页和刷新，统计卡显示订单总数、当前页金额、已支付、待支付、已关闭和当前页算力。
- Playwright smoke 已覆盖桌面订单管理搜索 `HJM`、刷新、统计卡数量、列表行数、`HJM000001` 可见性，以及 390x844 移动端横向溢出。
- Codex 自带浏览器点测通过：打开 `/admin/orders`，搜索 `HJM000001`，点击“查询”和“刷新”，桌面横向溢出为 0；390x844 视口复核横向溢出仍为 0。

### 需要继续验证

- 当前订单管理页是只读迁移，不代表旧后台订单改状态、退款、补单等写入能力已源码化。
- 旧接口的 `orders` 字段是全量数组，`items` 是分页数组；本轮已修正前端归一化优先级，但新后端契约需要把字段含义固定下来。

## 2026-06-26 源码后台兑换码管理只读复核

### 已确认

- `/admin/redeem-codes` 已由 `frontend/` 源码承载，并从迁移配置中的 `legacy` 改为 `source`。
- 兑换码管理页只调用只读接口 `/api/admin/redeem-codes`，不调用 `POST /api/admin/redeem-codes` 或 `DELETE /api/admin/redeem-codes/:code`。
- 页面支持兑换码/状态/算力搜索、状态筛选、分页和刷新，统计卡显示兑换码总数、当前页算力、启用中、已禁用、已用尽和剩余次数。
- Playwright smoke 已新增桌面兑换码管理搜索 `HAJIMI`、刷新、统计卡数量、列表行数、`HAJIMI2024` 可见性，以及 390x844 移动端横向溢出检查。
- Codex 自带浏览器点测通过：打开 `/admin/redeem-codes`，搜索 `HAJIMI`，点击“查询”和“刷新”，桌面横向溢出为 0；390x844 视口复核横向溢出仍为 0。

### 需要继续验证

- 当前兑换码管理页是只读迁移，不代表旧后台兑换码创建、删除、发放等写入能力已源码化。
- 旧接口的 `codes` 字段是全量数组，`items` 是分页数组；本轮已修正前端归一化优先级，但新后端契约需要把字段含义固定下来。

## 2026-06-26 源码后台模型价格只读复核

### 已确认

- `/admin/model-prices` 已由 `frontend/` 源码承载，并从迁移配置中的 `legacy` 改为 `source`。
- 模型价格页只调用只读接口 `/api/admin/model-prices`，不调用模型价格保存、新增或删除接口。
- 页面支持模型/线路/类型搜索、类型筛选、分页和刷新，统计卡显示线路数量、模型总数、启用模型、图片模型、文本模型和当前筛选总价。
- Playwright smoke 已新增桌面模型价格搜索 `gpt-image-2`、刷新、统计卡数量、列表行数、`GPT Image 2` 可见性，以及 390x844 移动端横向溢出检查。
- Codex 自带浏览器点测通过：打开 `/admin/model-prices`，搜索 `gpt-image-2`，点击“查询”和“刷新”，桌面横向溢出为 0；390x844 视口复核横向溢出仍为 0。

### 需要继续验证

- 当前模型价格页是只读迁移，不代表旧后台模型价格保存、新增模型、删除模型等写入能力已源码化。
- 旧接口的 `items` 是全量线路而不是模型级分页；新后端契约需要把模型级分页、搜索和类型筛选固定下来。

## 2026-06-26 源码后台 API 线路只读复核

### 已确认

- `/admin/api-providers` 已由 `frontend/` 源码承载，并从迁移配置中的 `legacy` 改为 `source`。
- API 线路页只调用只读接口 `/api/admin/api-providers`，不调用测试、新增、保存、删除、设默认或拉模型接口。
- 页面支持线路/模型/Base URL 搜索、类型筛选、分页和刷新，统计卡显示线路总数、启用线路、图片线路、文本线路、默认线路和模型总数。
- 已源码化后台页侧栏中的 API 线路入口已改为 `/admin/api-providers`，不再跳回旧后台线路页。
- Playwright smoke 已新增桌面 API 线路搜索 `route_6789`、刷新、统计卡数量、列表行数、masked key 可见性，以及 390x844 移动端横向溢出检查。
- Codex 自带浏览器点测通过：打开 `/admin/api-providers`，搜索 `route_6789`，点击“查询”和“刷新”，桌面横向溢出为 0；390x844 视口复核横向溢出仍为 0。

### 需要继续验证

- 当前 API 线路页是只读迁移，不代表旧后台 API 线路测试、新增、保存、删除、设默认、拉模型等写入能力已源码化。
- 旧接口的 `items` 是全量线路而不是真正分页；新后端契约需要固定线路级分页、搜索、类型筛选和密钥脱敏规则。

## 2026-06-26 源码后台模板工作流只读复核

### 已确认

- `/admin/template-workflows` 已由 `frontend/` 源码承载，并从迁移配置中的 `legacy` 改为 `source`。
- 模板工作流页只调用只读接口 `/api/admin/template-workflows`，不调用 `PUT /api/admin/template-workflows`。
- 页面支持模板/分类/标签搜索、分类筛选和刷新，统计卡显示模板总数、启用模板、分类数量、素材槽、字段数量和比例选项。
- 页面展示平台、清晰度、比例和模型配置摘要，并按模板展示素材槽、字段和输出上限。
- Playwright smoke 已新增桌面模板工作流搜索 `白底图`、刷新、统计卡数量、列表行数、平台/比例摘要可见性，以及 390x844 移动端横向溢出检查。
- Codex 自带浏览器点测通过：打开 `/admin/template-workflows`，搜索 `白底图`，点击“查询”和“刷新”，桌面横向溢出为 0；390x844 视口复核横向溢出仍为 0。

### 需要继续验证

- 当前模板工作流页是只读迁移，不代表旧后台模板保存、新增、删除、字段编辑等写入能力已源码化。
- 旧接口 GET 一次返回完整模板配置；新后端契约需要固定模板级分页、搜索、分类筛选和写入权限边界。

## 2026-06-26 剩余三入口源码化收尾复核

### 已确认

- `/canvas`、`/admin/recycle-bin`、`/admin/settings` 已从迁移配置中的 `legacy` 改为 `source`，首页迁移统计为 21/0/21。
- `/canvas` 已由 `CanvasLegacySource.vue` 承载源码入口壳，页面明确“不重启新画布、不引入 Vue Flow、不自研画布”，并内嵌/链接旧后端画布。
- `/admin/recycle-bin` 只调用 `GET /api/admin/recycle-bin/users`，不调用恢复或永久删除接口。
- `/admin/settings` 只调用 `GET /api/admin/settings`，不调用 `PATCH /api/admin/settings`。
- Playwright smoke 已覆盖旧画布源码入口、回收站只读搜索、系统设置只读搜索，以及三者 390x844 移动端横向溢出检查。
- Codex 自带浏览器点测通过：桌面 `/canvas`、`/admin/recycle-bin`、`/admin/settings` 均横向溢出为 0；390x844 视口三页横向溢出仍为 0。

### 需要继续验证

- 当前 `/canvas` 是源码入口壳，不代表旧画布内部代码已迁入 `frontend/`；这符合“新画布废止、回滚旧画布”的既定边界。
- 当前回收站测试库为空，本轮已覆盖空状态；有删除用户时的卡片视觉和恢复/永久删除写入动作需另行确认测试数据后再验收。
- 当前系统设置页是只读迁移，不代表保存设置、图片工具配置写入等能力已源码化。

## 2026-06-26 Vue3 源码工程化护栏复核

### 已确认

- 首页阶段状态已从早期迁移文案改为当前事实：源码入口完成、旧画布锁定、后台只读完成。
- 已删除未使用的 `LegacyRouteRedirect.vue`，当前源码路由不再依赖旧桥接组件。
- `scripts/check-source-frontend-routes.js` 已新增，检查 `frontendMigrationRoutes` 与 Vue Router 的 21 个路径一致，并确认所有迁移入口都是 `source`。
- `frontend/package.json` 已新增 `check:routes`、`smoke:source` 和 `verify:source`，便于后续进入人工验收前先跑基础护栏。
- `docs/source-frontend-acceptance-checklist.md` 已新增，明确可直接跑通的功能、暂不自动执行的写入动作和下一阶段验收顺序。

### 验证

- `npm.cmd run check:routes --prefix "F:\dianshang\frontend"` 通过，输出 `Source frontend route maintenance check passed: 21/21 source routes.`
- `node --check "F:\dianshang\scripts\check-source-frontend-routes.js"` 通过。
- `npm.cmd run build --prefix "F:\dianshang\frontend"` 通过。
- `powershell -NoProfile -ExecutionPolicy Bypass -File "F:\dianshang\scripts\smoke-source-frontend-ui.ps1"` 通过。
- `git -C "F:\dianshang" diff --check` 通过，仅有 CRLF 提示。
- UTF-8 BOM、尾随空格和 `frontend/src` 旧桥接残留检查通过。

### 需要继续验证

- 写入、删除、扣费、真实模型调用和新后端依赖安装仍需用户确认后再执行。

## 2026-06-26 系统设置保存试点复核

### 已确认

- `frontend/src/api/adminSettings.ts` 已新增 `updateAdminSettings()`，复用现有 Axios，不新增依赖。
- `/admin/settings` 已从纯只读页升级为保存试点页，当前只开放低风险基础字段草稿：站点名称、注册开关、模板生图、图库历史、Mock 模式、默认算力和上传上限。
- 图片工具配置仍保持只读，未开放复杂线路、模型和提示词模板写入。
- smoke 断言已改为检查保存试点区和保存按钮存在，但不点击保存。

### 验证

- `node --check "F:\dianshang\scripts\smoke-source-frontend-ui-runner.js"` 通过。
- `npm.cmd run typecheck --prefix "F:\dianshang\frontend"` 通过。
- `npm.cmd run check:routes --prefix "F:\dianshang\frontend"` 通过。
- `npm.cmd run build --prefix "F:\dianshang\frontend"` 通过。
- `powershell -NoProfile -ExecutionPolicy Bypass -File "F:\dianshang\scripts\smoke-source-frontend-ui.ps1"` 通过，且未触发系统设置保存。

### 需要继续验证

- 保存按钮的真实写入回显需要人工确认测试值和恢复方式后再点测。

## 2026-06-26 旧画布入口崩溃复核

### 已确认

- 用户反馈崩溃时处于 `/canvas` 移动端入口；旧后端健康检查正常，旧画布项目页可 200 返回。
- 临时 Playwright 诊断打开旧画布项目页 8 秒，无 page crash、无 console error、无 4xx/5xx 静态资源错误。
- 诊断中唯一异常级信号是旧画布 warning：`canvas:chat-session-change:skip-not-ready`，属于旧画布初始化时序提示，不是页面崩溃栈。
- 为降低移动端和自带浏览器压力，`/canvas` 源码入口已改为默认不加载 iframe，只显示轻量入口和手动加载按钮。

### 验证

- `npm.cmd run typecheck --prefix "F:\dianshang\frontend"` 通过。
- `node --check "F:\dianshang\scripts\smoke-source-frontend-ui-runner.js"` 通过。
- `npm.cmd run build --prefix "F:\dianshang\frontend"` 通过。
- `npm.cmd run check:routes --prefix "F:\dianshang\frontend"` 通过。
- `powershell -NoProfile -ExecutionPolicy Bypass -File "F:\dianshang\scripts\smoke-source-frontend-ui.ps1"` 通过；`/canvas` 断言更新为默认 `iframeCount=0` 且存在“加载旧画布预览”按钮。

### 需要继续验证

- 旧画布内部的节点新增、上传、生成、保存恢复仍需要单独长流程验收。
- 如果点击“加载旧画布预览”仍导致浏览器崩溃，应进一步禁用入口页 iframe，只保留新窗口打开。

## 2026-06-26 旧画布本地保存权限复核

### 已确认

- 截图中的报错来自浏览器 File System Access API：`requestPermission` 不能在当前上下文请求权限。
- 旧画布在 iframe 里运行时属于嵌入上下文，不适合执行本地文件夹授权。
- `/canvas` 源码入口已移除 iframe 预览，只保留新窗口打开旧画布，并写明本地保存必须在新窗口旧画布中使用。

### 需要继续验证

- 用户需要从 `/canvas` 点击“新窗口打开旧画布”，在 `127.0.0.1:3456/canvas` 顶层页里重新选择本地文件夹。
- 如果顶层旧画布仍报同样错误，再继续查是否缺少用户手势、浏览器权限策略或 File System Access API 兼容性。

## 2026-06-26 Vue3 API 错误处理收敛复核

### 已确认

- CodeGraph 本轮调用超时，不是“未初始化”返回；已按工具不可用处理，改用本地源码读取和自动化护栏推进。
- `frontend/src/api/http.ts` 已集中提供 `getApiErrorMessage()`，统一处理 401、403、后端 `message/error` 字段和 JS Error。
- 用户页、模板页、图库页和后台源码页仍保留各自业务兜底文案，未登录提示没有被抹平。
- `/canvas` 和 `/admin/settings` 的路线图与 README 描述已同步到当前事实。

### 验证

- `npm.cmd run typecheck --prefix "F:\dianshang\frontend"` 通过。
- `npm.cmd run check:routes --prefix "F:\dianshang\frontend"` 通过，输出 `Source frontend route maintenance check passed: 21/21 source routes.`。
- `npm.cmd run build --prefix "F:\dianshang\frontend"` 通过。
- `powershell -NoProfile -ExecutionPolicy Bypass -File "F:\dianshang\scripts\smoke-source-frontend-ui.ps1"` 通过，且 `/canvas` 仍为 `iframeCount=0`。
- `git -C "F:\dianshang" diff --check` 通过，仅有 CRLF 提示。
- `rg` 检查确认视图层不再散落 `response?.data?.message` 和 `(error as Error)?.message` 解析。
- 本轮关键文件 BOM 和尾随空白检查为空。

### 需要继续验证

- CodeGraph 后续如继续超时，需要单独确认是否重建索引或重启 MCP 服务。

## 2026-06-26 系统设置图片工具可配置复核

### 已确认

- 用户反馈准确：此前图片工具配置只有展示标签，没有线路、模型和提示词模板选择控件。
- 本轮复用现有 API 线路数据，不新增 npm 包、不新增后端接口。
- `/admin/settings` 图片工具配置现在提供启用开关、图片线路下拉、模型下拉和提示词模板输入。
- 页面顶部文案已从“复杂图片工具配置只读”改为“开放基础设置和图片工具线路、模型、提示词模板配置”。

### 验证

- `npm.cmd run typecheck --prefix "F:\dianshang\frontend"` 通过。
- `npm.cmd run build --prefix "F:\dianshang\frontend"` 通过。
- `powershell -NoProfile -ExecutionPolicy Bypass -File "F:\dianshang\scripts\smoke-source-frontend-ui.ps1"` 第二次重跑通过；第一次失败停在 Playwright CLI session 未打开，不是页面逻辑错误。
- `git -C "F:\dianshang" diff --check` 通过，仅有 CRLF 提示。
- 自带浏览器刷新 `/admin/settings`，确认图片工具区有 4 个工具卡、4 个开关、8 个下拉和 4 个提示词输入框。

### 需要继续验证

- 真实保存仍需人工按“记录原值 -> 修改 -> 保存 -> 刷新回显 -> 恢复原值”的顺序验收。

## 2026-06-26 系统设置基础开关点击复核

### 已确认

- 用户反馈成立：基础设置里的 Naive UI `n-switch` 滑块本体点击后状态不变。
- 右侧文字按钮此前可以工作，但滑块本体不工作会误导人工验收。
- 已替换为自控按钮式滑块，点击滑块和文字按钮都会走同一个状态切换函数。

### 验证

- 自带浏览器逐个点击 7 个滑块，全部能改变草稿状态，并逐个恢复测试前状态。
- 自带浏览器逐个点击 7 个文字按钮，全部能改变草稿状态，并逐个恢复测试前状态。
- `npm.cmd run typecheck --prefix "F:\dianshang\frontend"` 通过。
- `npm.cmd run check:routes --prefix "F:\dianshang\frontend"` 通过。
- `npm.cmd run build --prefix "F:\dianshang\frontend"` 通过。
- `git -C "F:\dianshang" diff --check` 通过，仅有 CRLF 提示。

### 需要继续验证

- 用户人工点击保存前仍需记录原值；本轮未保存真实配置。

## 2026-06-26 API 官方双线路收敛复核

### 已确认

- 用户要求成立：旧 API 多线路列表应收敛，不再继续保留 `6789`、`comfly-*`、`RK`、`哈吉米`、`flowstudio` 等旧目标线路。
- 当前目标只保留两条线路：图片 `GPT Image 2 / gpt-image-2`，文本 `GPT 5.5 / gpt-5.5`。
- 图片请求格式按官方 Images 生成形态记录为 `POST /images/generations`，请求体示例包含 `model/prompt/size/quality/n`。
- 文本请求格式按官方 Responses 形态记录为 `POST /responses`，请求体示例包含 `model/input`。
- 本轮没有新增 npm 依赖，没有调用真实外部 AI 接口。

### 验证

- `node --check "F:\dianshang\server.js"` 通过。
- `node --check "C:\Users\pc\Desktop\hjm-mb-clone\server.js"` 通过。
- `npm.cmd run typecheck --prefix "F:\dianshang\frontend"` 通过。
- `npm.cmd run check:routes --prefix "F:\dianshang\frontend"` 通过，输出 `21/21 source routes`。
- `npm.cmd run build --prefix "F:\dianshang\frontend"` 通过。
- `git -C "F:\dianshang" diff --check` 通过，仅有 CRLF 提示。
- 兼容后端重启后 `/api/health` 正常，模型配置为 `textModel=gpt-5.5`、`imageModel=gpt-image-2`。
- 已调用本地整包替换接口写入运行数据库，复核 `/api/admin/api-providers` 为 2 条线路、默认模型为 `gpt-image-2,gpt-5.5`，旧线路名匹配为 false。
- 已删除 3 条早期 `ui-echo-model-*` 模型价格覆盖行，复核 `/api/admin/model-prices` 模型键只剩 `gpt-image-2,gpt-5.5`。
- 自带浏览器打开 `/admin/api-providers`，显示 2 条线路、2 张官方目标卡、`/images/generations`、`/responses`、无旧线路文本，横向溢出为 0。
- 完整源码前端 smoke 通过；首次失败为脚本选择器把 `/images/generations` 误解析成正则，已修正。

### 需要继续验证

- 历史生成记录、消费日志和仪表盘模型使用统计仍可能显示旧历史模型或旧线路名；这属于历史业务数据，若用户要求“历史也清洗”，必须另开数据迁移任务并先备份。
- 新后端真正接管时，需要把 `POST /responses` 与 `POST /images/generations` 的请求构造迁移到 Provider Adapter，且先确认 Key、代理网关和费用边界。

## 2026-06-26 API 图生图能力补齐复核

### 已确认

- 图生图不应作为第三条 API 线路处理；它属于 `GPT Image 2` 图片线路下的第二个官方请求能力。
- 图片线路现在包含两个请求示例：`文生图 /images/generations` 与 `图生图 / 局部重绘 /images/edits`。
- `/images/edits` 示例包含 `images` 和 `prompt`，局部重绘场景保留 `mask` 字段；真实文件上传时可走 `multipart/form-data`，URL/base64 引用可按 JSON 形态表达。

### 验证

- 已重启兼容后端并写入运行数据库，复核图片线路 `requestExamples=2`，包含 `/images/edits`。
- `node --check "F:\dianshang\server.js"` 通过。
- `node --check "C:\Users\pc\Desktop\hjm-mb-clone\server.js"` 通过。
- `npm.cmd run typecheck --prefix "F:\dianshang\frontend"` 通过。
- `npm.cmd run check:routes --prefix "F:\dianshang\frontend"` 通过，输出 `21/21 source routes`。
- `npm.cmd run build --prefix "F:\dianshang\frontend"` 通过。
- `git -C "F:\dianshang" diff --check` 通过，仅有 CRLF 提示。
- 自带浏览器打开 `/admin/api-providers`，确认页面显示 `/images/generations`、`/images/edits`、`/responses` 和“图生图 / 局部重绘”，横向溢出为 0。
- 完整源码前端 smoke 通过。

### 需要继续验证

- 当前只是配置与后台展示补齐，未实现真实图生图上传、mask 画布、Provider Adapter 调用和任务结果回写。

## 2026-06-26 Provider 能力注册表复核

### 已确认

- 线路不是前端功能路由；线路只描述上游 Provider 和模型能力。
- 能力展示不应继续散落在 API 线路页或 API client 文件里。
- 已新增 `frontend/src/config/providerCapabilities.ts`，作为当前前端能力展示注册表。
- 后续新增中转站差异应落到后端 Provider Adapter，不在前端页面里手写各家请求格式。

### 验证

- `npm.cmd run typecheck --prefix "F:\dianshang\frontend"` 通过。
- `npm.cmd run check:routes --prefix "F:\dianshang\frontend"` 通过，输出 `21/21 source routes`。
- `node --check "F:\dianshang\scripts\smoke-source-frontend-ui-runner.js"` 通过。
- `git -C "F:\dianshang" diff --check` 通过，仅有 CRLF 提示。
- `npm.cmd run build --prefix "F:\dianshang\frontend"` 通过。
- 自带浏览器打开 `/admin/api-providers`，确认文生图 `/images/generations`、图生图 `/images/edits`、文本生成 `/responses` 都存在，横向溢出为 0。

### 需要继续验证

- 新后端接管时，需要把这份前端注册表升级为后端能力元数据来源，避免前后端双份配置长期漂移。

## 2026-06-26 API 线路旧后台表单恢复复核

### 已确认

- 用户反馈成立：源码后台此前不像原 HJM 后台，缺少旧后台已有的 API 线路新增/编辑表单。
- 旧后台字段已对齐到源码页：后端真实名称、前端展示名称、线路标识 code、渠道类型、接口格式、Base URL、API Key、聊天接口、生图接口、视频接口、默认模型、优先级、线路倍率、状态、默认线路和备注。
- API Key 不在页面明文回显；后端仍返回 `sk-local-********` 掩码。编辑时留空表示不修改，这是当前安全边界。
- 当前 `real-provider-ready`，所以本轮未自动点击“测试连接”，避免触发真实外部请求。

### 验证

- `node --check "F:\dianshang\server.js"` 通过。
- `node --check "C:\Users\pc\Desktop\hjm-mb-clone\server.js"` 通过。
- `npm.cmd run typecheck --prefix "F:\dianshang\frontend"` 通过。
- `npm.cmd run build --prefix "F:\dianshang\frontend"` 通过。
- `git -C "F:\dianshang" diff --check` 通过，仅有 CRLF 提示。
- 已重启兼容后端，`/api/health` 正常，当前 Provider 状态为 `real-provider-ready`。
- Playwright 浏览器烟测通过核心本地链路：登录管理员、打开 `/admin/api-providers`、新增临时 `codex-smoke` 线路、确认列表出现、打开编辑表单、删除临时线路。
- 删除后复核运行数据库无 `route_codex_smoke_*` 残留，API 线路回到 `route_openai_gpt_image_2,route_openai_gpt_5_5` 两条。

### 需要继续验证

- 人工验收时可点击“新增线路”和“编辑”确认旧后台字段是否满足你的实际配置习惯。
- 若要让后台写入的真实 API Key 直接接管付费调用，需要先设计密钥加密存储、权限控制、审计日志和 Provider Adapter 读取策略；当前实现不把真实 Key 明文回显。

## 2026-06-26 首页旧客户端能力补回复核

### 已确认

- 用户反馈成立：Vue3 首页此前只是迁移索引，不是旧客户端业务首页。
- 已用 Playwright 打开旧首页 `http://127.0.0.1:3456/` 对照首屏能力，旧首页包含模式切换、添加图片、提示词、模型/张数/比例/清晰度、预计算力、生成和历史画布入口。
- 第一版纠偏：此前误做成新业务工作台壳，用户指出不是旧首页迁移；已撤掉该版。
- Vue3 首页已按旧站实际运行首页迁移：固定顶部栏、左侧导航、浅色玻璃背景、中心生成面板和“我的历史画布项目”横向列表。
- 首页快速生图复用现有模板生成 API，不新增第二套生成逻辑；首屏不再主动请求需要登录的项目接口，避免未登录状态产生 401/403。

### 验证

- `npm.cmd run typecheck --prefix "F:\dianshang\frontend"` 通过。
- `npm.cmd run check:routes --prefix "F:\dianshang\frontend"` 通过，输出 `21/21 source routes`。
- `npm.cmd run build --prefix "F:\dianshang\frontend"` 通过。
- `git -C "F:\dianshang" diff --check` 通过，仅有 CRLF 提示。
- Playwright 新首页桌面检查通过：旧版 `.home-header`、`.side-rail`、`.hero-panel` 和“我的历史画布项目”均存在，横向溢出为 0。
- Playwright 390px 移动端检查通过：主标题、生成按钮和历史画布项目可见，横向溢出为 0。
- 重新加载后 console 仅有 Vite debug 连接日志，无 401/403、无 pageerror；背景图不再通过工程外 `@fs/F:/dianshang/assets` 路径加载。

### 需要继续验证

- 人工登录后输入真实提示词点击首页快速生图，确认 Provider 返回、余额扣减和图库写入。
- 旧首页的本地保存弹窗、历史项目拖拽惯性、完整项目恢复等深层交互仍需继续按旧站 assets 迁入。
## 2026-06-29 旧画布性能优化复核

### 已确认

- 本轮只优化 `F:\dianshang` 当前生产测试项目，不再改 `C:\Users\pc\Desktop\hjm-mb-clone`。
- 新增 `canvas-performance-active` 交互态，拖拽、缩放、节点移动时降低旧画布重阴影、毛玻璃、hover transform 和动画成本。
- 图片节点和聊天面板图片已做懒加载与异步解码；不新增缩略图服务，不改变图片 URL 策略。
- 自动保存只做降频和合并等待，不改变旧工作流 JSON 格式。

### 验证

- `node --check "F:\dianshang\server.js"` 通过。
- `git -C "F:\dianshang" diff --check` 通过，仅有 CRLF 提示。
- `/api/health` 正常，数据库和上传目录均指向 `F:\dianshang`。
- 自带浏览器打开 `http://127.0.0.1:3456/canvas`，确认 `canvas-performance-mode.css/js?v=20260629perf3` 已加载。
- 浏览器模拟拖动画布后 `canvas-performance-active=true`，约 0.9 秒后恢复为 false；模拟滚轮缩放同样触发并恢复。
- 页面 Vue Flow 存在、节点数为 2、console error 为 0；节点图片未破图，已应用异步解码。
- 旧画布自动保存和视口保存 timer 已加入性能态延迟：交互仍活跃时调用 `noteSaveDeferred()` 并重新排队，等待拖拽/缩放结束后合并保存；不改变工作流 JSON 格式。
- 新增 `scripts/smoke-canvas-performance-ui.ps1` 和 `scripts/smoke-canvas-performance-ui-runner.js`，并接入 `SMOKE_UI=true` 预检。
- 新增 `scripts/verify-canvas-performance-assets.js`，静态防回退检查 `perf3` 版本、保存延迟锚点、`J4=1400` 和旧 `900/250` 节流锚点不再存在。
- `node "F:\dianshang\scripts\verify-canvas-performance-assets.js"` 通过，返回 `version=20260629perf3`、`saveDeferral=true`。
- `powershell -NoProfile -ExecutionPolicy Bypass -File "F:\dianshang\scripts\smoke-canvas-performance-ui.ps1"` 通过；自动复核性能资源加载、性能 API、基础拖拽、单次滚轮、连续 20 次滚轮、打开 Canvas Chat 后拖拽、交互态 `will-change: transform`、动态图片探针 `loading=lazy/decoding=async`、console errors 为 0、bad responses 为 0。
- 用户反馈缩放时卡片闪烁后已复核并修复：性能态拆分为 `canvas-performance-zooming` 与 `canvas-performance-dragging`，滚轮缩放只给 Vue Flow viewport/pane/canvas-flow 启用合成层，不再对 `.vue-flow__node` 改写阴影、滤镜、transition 或 hover transform。
- 缓存版本已升级到 `20260629perf4`；`scripts/verify-canvas-performance-assets.js` 新增防回退检查，确保性能 CSS 不再包含 `html.canvas-performance-active .vue-flow__node`。
- 默认画布 smoke 通过缩放闪烁回归断言：滚轮后 `zooming=true`、`dragging=false`、`debugMode=zooming`，节点视觉样式在缩放前后保持一致。
- 指定项目 smoke 已通过：`SMOKE_CANVAS_PATH=/canvas/project_1782707934819_dxzylygh5`，确认该 URL 加载 `perf4` 资源，拖拽/缩放性能态启停正常，console errors 为 0，bad responses 为 0。
- 新增帧预算 smoke：`scripts/smoke-canvas-frame-budget-ui.ps1` 会临时注入 8 个 Vue Flow 卡片和图片探针，并采样拖拽/连续缩放期间的 `requestAnimationFrame` 帧间隔；默认画布复核通过，拖拽 `avgDelta=16.67ms`、`p95Delta=16.8ms`、长帧 0，缩放 `avgDelta=16.67ms`、`p95Delta=16.8ms`、长帧 0。
- `scripts/verify-canvas-performance-assets.js` 已纳入帧预算 smoke 文件和 `preflight-check.ps1` 接入点检查，避免后续性能验收脚本被遗漏。
- 图片节点右侧工具栏半截问题已修复：取消普通 `.vue-flow__node` 的 paint containment，避免裁掉节点外溢的 `image-node-toolbar`；新增工具栏防裁切规则和 `toolbarProbe` 自动断言，当前结果为 `nodeContain=none`、`nodeOverflow=visible`、`toolbarZIndex=1200`。
- 缓存版本已升级到 `20260629perf5`；性能 smoke 与帧预算 smoke 均通过，移除节点 paint containment 后未观察到帧预算回退。
- 图片节点展示形态已改为图片对象优先：新增 `assets/canvas-image-node-polish.css?v=20260629image2`，只做旧画布 CSS 过渡覆盖，不新增依赖、不重写画布、不改节点数据结构；有图节点取消 `object-cover` 和 `max-height:220px` 裁切，改为 `object-fit: contain` 与 `max-height:520px`，让图片按原始比例完整显示；标题和尺寸信息浮到图片上方，右侧工具栏继续保持外溢可点击。
- 性能 smoke 已新增 `imageNodeVisualProbe` 和 `loadedImageNodeProbe`：空图占位为 300x300、URL 输入行隐藏、工具栏 `z-index=1200`；800x1000 有图探针显示为 416x520，`imageObjectFit=contain`，顶部信息为 absolute。真实项目页复核到 1254x1254 图片按 416x416 完整显示。
- 帧预算 smoke 复跑通过：拖拽 `avgDelta=16.67ms`、`p95Delta=16.8ms`、长帧 0；缩放 `avgDelta=16.77ms`、`p95Delta=16.8ms`、`maxDelta=33.2ms`、长帧 0。
- 用户反馈图片工具栏遮挡图片后，图片节点补丁升级到 `20260629image4`：有图节点的外壳、舞台和图片统一按图片比例 box 自适应，工具栏与折叠把手改为挂在该 box 右侧，不再使用旧固定卡片宽度定位；已验证 CSS 资源可由 `http://127.0.0.1:3456/assets/canvas-image-node-polish.css?v=20260629image4` 返回 200，`node --check` 和 `git diff --check` 通过。
- 本轮追加指定项目验收：`SMOKE_CANVAS_PATH=/canvas/project_1782707934819_dxzylygh5` 的画布性能 smoke 通过，确认 `20260629image4` 资源加载、工具栏防裁切、竖图 loadedImageNodeProbe、拖拽/缩放性能态和 Canvas Chat 拖拽无 console error、无 bad response。
- 本轮追加比例专项探针：在指定项目页临时注入方图、横图、竖图三类图片节点，不保存项目、不触发接口。测得方图 `520x520`、横图 `520x260`、竖图 `260x520`，均为 `object-fit: contain`；右侧工具栏均位于图片舞台右侧 `18px`，折叠把手位于右侧 `2px`，且 `toolbarOverlapsImage=false`。
- 当前没有继续修改 `assets/canvas-image-node-polish.css`，因为遮挡问题未在指定项目 smoke 或三比例探针中复现。

### 需要继续验证

- 用户人工拖动画布 10 秒、缩放 20 次，观察是否比优化前更顺滑。
- 用户人工选中真实图片节点，确认右侧图片工具侧边栏完整露出，不再只剩半截。
- 如指定项目未恢复已有图片节点，需要先创建或导入含方图、横图、竖图的测试画布，再做人工截图确认顶部标题/尺寸不遮挡图片主体。
- 生成结果加入画布后继续拖动，确认大图节点不再明显阻塞。
- 如果仍卡，第二阶段再规划旧画布源码化、缩略图缓存、节点虚拟化和更细粒度渲染拆分。

## 2026-06-29 图片节点顶部工具条复核

### 已确认

- 本轮继续只改 `F:\dianshang` 旧画布过渡层，不重写画布引擎，不改 Provider，不动 API Key，不触发真实生图。
- `index.html` 已把图片节点 polish 资源升级到 `20260629image5`，并新增 `assets/canvas-image-node-polish.js`。
- 图片节点 JS 会按图片自然宽高打 `square`、`landscape`、`portrait`、`long` 方向标记；`图像生成结果`、`文生图`、`对话生成图片` 等生成图会被标为 `data-image-source="generated"`。
- 有图图片节点保留顶部标题/尺寸信息，选中或 hover 时显示顶部黑色横向工具条；旧右侧大侧栏和折叠把手不再展示。
- 无图上传态的旧工具条已隐藏并禁用 pointer events，避免空节点残留可点击浮层。
- 超长图已从普通 `max-height: 520px` 限制中分离，改为较窄宽度完整展开。

### 验证

- `node --check "F:\dianshang\server.js"` 通过。
- `node --check "F:\dianshang\assets\canvas-image-node-polish.js"` 通过。
- `node --check "F:\dianshang\scripts\smoke-canvas-performance-ui-runner.js"` 通过。
- 指定项目 `SMOKE_CANVAS_PATH=/canvas/project_1782707934819_dxzylygh5` 的画布性能 smoke 通过：`imageNodePolishCssLoaded=true`、`imageNodePolishJsLoaded=true`、`hasImagePolishApi=true`。
- 图片比例专项探针通过：方图 `520x520`、横图 `520x260`、竖图 `260x520`、长图约 `259x5864` 且 `imageMaxHeight=none`、生成结果图 `520x520` 且 `source=generated`。
- 顶部工具条专项断言通过：工具条 `display=flex`、`position=absolute`、`z-index=1220`，位于图片舞台上方，且与图片矩形无交集；`.image-node-toolbar-wrap` 为 `display=none`。

### 需要继续验证

- 用户在浏览器中刷新指定项目，选中真实图片节点确认顶部工具条观感。
- 用真实普通图片节点和真实图像生成结果节点各选中一次，确认二者视觉一致。
- 真实生图链路仍需用户确认额度和测试范围后再做。

## 2026-06-29 图片节点 image6 回归复核

### 已确认

- 用户截图中的右侧白色竖向工具栏来自真实构建里的 `ImageNodeToolbar` scoped 组件，旧规则为 `left:302px`、`flex-direction:column`、`height:calc(100% - 20px)`。
- `image5` 的 smoke 探针把工具栏放在 `.image-node` 内部，未覆盖真实 sibling 结构，这是本次漏测原因。
- 已升级 `image6`：JS 给 Vue Flow 图片节点本身打 `image-node-has-image/image-node-is-selected`，CSS 以节点级选择器覆盖 sibling 工具栏，强制顶部横向显示。

### 验证

- `node --check "F:\dianshang\server.js"` 通过。
- `node --check "F:\dianshang\assets\canvas-image-node-polish.js"` 通过。
- `node --check "F:\dianshang\scripts\smoke-canvas-performance-ui-runner.js"` 通过。
- 指定项目 smoke 通过：`imageNodePolishCssLoaded=true`、`imageNodePolishJsLoaded=true`、真实 sibling 工具栏 `toolbarFlexDirection=row`、`toolbarWidth=346`、`toolbarHeight=50`、`toolbarAboveStage=true`、`toolbarOverlapsStage=false`。

### 需要继续验证

- 用户在当前打开的浏览器页强刷后，选中截图中的真实图片节点，确认右侧白色竖栏消失，顶部黑色横向工具条出现。

## 2026-06-29 扩图面板 outpaint1 复核

### 已确认

- 本轮只修旧画布扩图面板定位逻辑，不改 Provider、不动 API Key、不触发真实生图。
- 扩图面板默认位置属于组件状态计算问题：原逻辑只在图片 load 和比例切换后排一次 `nextTick(P)`，在面板实际目标画布尺寸稳定后不会二次居中。
- 已在两个旧 Canvas bundle 中将扩图重算改为 `nextTick + requestAnimationFrame + 80ms`，确保默认打开和切换比例后按最终画布尺寸重新计算中心点。
- 拖拽边界仍使用原有 clamp 逻辑，保持图片移动受目标画布范围限制，避免提交坐标越界。
- 入口缓存版本已升级到 `20260629outpaint1`；性能资源仍为 `20260629perf5`，图片节点工具条仍为 `20260629image7`。
- 静态验证已通过：`verify-canvas-performance-assets.js` 检查两个 Canvas bundle 均包含二次重算补丁，并确认旧 `Dt(P)` 扩图锚点不再存在。
- 指定项目 smoke 已通过，确认 `outpaint1` 入口资源加载、旧画布基础交互、图片节点工具条和比例探针均正常；本 smoke 不触发真实扩图接口。

### 需要继续验证

- 用户强刷当前浏览器页后，打开真实图片节点的 `AI 扩图`，确认默认图像在目标画布中心。
- 依次点 `1:1`、`3:2`、`4:3`、`16:9`、`9:16`，确认每次切换后仍居中。
- 在目标画布内拖动图片，确认移动范围仍受限制且不会跑出黄色/绿色区域。

## 2026-06-29 扩图面板 outpaint2 复核

### 已确认

- 本轮继续只修旧画布扩图面板，不改 Provider、不动 API Key、不触发真实生图。
- 用户反馈缩放时无法自动保持位置后，复核缩放 handler 发现其依赖 `u.value`，在 input 事件顺序下可能读到上一帧值。
- 已将缩放 handler 改为读取当前 range 事件值，并以当前图片中心点为锚点计算新尺寸和位置。
- 原有 clamp 边界保留：图片靠近画布边缘时，缩放后会被限制在黄色/绿色目标画布内，这是预期限制。
- 入口缓存版本已升级到 `20260629outpaint2`；静态护栏会检查新缩放 handler 和旧 handler 不回退。
- 静态和页面 smoke 已通过：`verify-canvas-performance-assets.js` 返回 `20260629perf5+outpaint2`，指定项目加载 `outpaint2` 入口成功，console errors 为 0、bad responses 为 0。

### 需要继续验证

- 强刷后打开 `AI 扩图`，先把图片拖到非默认位置，再滑动“原图等比缩放”，确认图片围绕当前位置缩放。
- 在画布边缘附近重复缩放，确认只在越界时被 clamp，不在普通区域突然跳回默认中心。

## 2026-06-29 扩图面板 outpaint3 复核

### 已确认

- 用户截图确认 `outpaint2` 仍有问题：`1:1` 黄色舞台不是方形，滑条拉满后图片也没有按方形目标铺满。
- 根因是 CSS 的 `.outpaint-stage { max-height: 230px }` 压扁了比例舞台；缩放计算本身拿到的是被压扁后的 DOM 尺寸。
- 已改为由组件 inline style 覆盖舞台尺寸：`maxHeight:none`，横图/方图占满可用宽度，竖图按视口高度自动收窄，保证比例不变。
- 静态护栏已增加舞台比例样式断言，并禁止回退到旧的单一 `aspectRatio` 写法。
- 静态和页面 smoke 已通过：`verify-canvas-performance-assets.js` 返回 `20260629perf5+outpaint3`，指定项目加载 `outpaint3` 入口成功，console errors 为 0、bad responses 为 0。

### 需要继续验证

- 强刷后打开 `AI 扩图`，确认 `1:1` 舞台为方形。
- 将缩放拉到最大，确认方图完整铺满方形舞台。
- 切换 `16:9` 和 `9:16`，确认舞台形状跟随比例变化而不是被固定高度压扁。

## 2026-06-29 扩图面板 outpaint4 复核

### 已确认

- 用户希望扩图内容能在绿色画布里自由移动，并且缩放保持等比例。
- 旧 clamp 对放大后的图片不友好：图片一旦等于或大于目标画布，`max(0, stageSize-imageSize)` 变成 0，拖动被锁死。
- 已新增双模式 clamp：图片小于画布时限制在画布内；图片大于画布时允许在画布内平移取景，同时不露空。
- 缩放范围已从 `35-100` 改成 `20-220`，其中 `100%` 是完整贴合，超过 `100%` 是等比例放大取景。
- 静态护栏已检查新 clamp、`20-220` 滑条范围，并禁止旧拖动 clamp 和旧滑条范围回退。
- 静态和页面 smoke 已通过：`verify-canvas-performance-assets.js` 返回 `20260629perf5+outpaint4`，指定项目加载 `outpaint4` 入口成功，console errors 为 0、bad responses 为 0。

### 需要继续验证

- 强刷后打开 `AI 扩图`，将缩放拉到超过 `100%`，确认图片等比例放大。
- 放大后拖动图片，确认能在绿色画布中平移取景，且不会露出黄色/绿色空白。

## 2026-06-29 扩图面板 outpaint6 复核

### 已确认

- 用户纠正成立：扩图不是裁剪，绿色区域露出不是错误，而是待生成区域；不应使用“不露空”限位。
- `outpaint4` 的 clamp 会在右侧和右下角让图片卡死，违背自由摆放需求。
- 已将位置限制放宽到 `[-imageSize, stageSize]`，允许图片在绿色目标画布内外自由摆放，只避免整张图完全拖走后找不到。
- 舞台空白区域也已绑定拖动开始事件，按住绿色空白处也能移动图片层。
- 缩放范围改为 `20-300`，保持等比例缩放。
- 静态和页面 smoke 已通过：`verify-canvas-performance-assets.js` 返回 `20260629perf5+outpaint6`，指定项目加载 `outpaint6` 入口成功，console errors 为 0、bad responses 为 0。

### 需要继续验证

- 强刷后打开 `AI 扩图`，在绿色空白区域按住拖动，确认图片跟随移动。
- 把图片拖到右侧、右下角和左上角，确认不会提前卡死。
- 缩放到较大比例后继续拖动，确认仍能自由摆放。

## 2026-06-29 重绘接入 GPT Image 2 图生图复核

### 已确认

- 前端旧画布 `局部修改` 面板提交字段为 `imageUrl`、`maskBase64`、`prompt`、`referenceImages`，并同步等待 `/api/image-tools/inpaint` 返回最终图片。
- 后端此前缺少 `/api/image-tools/inpaint` 和 `/api/image-tools/erase`，因此按钮没有接入真实图生图编辑链路。
- 已新增两个 image-tools 路由，统一复用 `callProviderImageEdit`，请求目标为线路配置的 `/images/edits`，默认模型保持 `gpt-image-2`。
- 已修正 mask 读取：`maskBase64`/`mask`/`maskUrl` 独立于参考图数量发送，支持单原图 + 单 mask 的局部重绘。
- 已新增 `/api/upload/image` 兼容旧画布参考图上传入口。
- 服务已重启，`/api/health` 指向 `F:\dianshang`；未授权探测三个新入口均返回 `401` 而不是 `404`，确认路由已加载且没有触发真实上游。
- 最终检查通过：`node --check` 覆盖 `server.js`、图片节点 polish JS、画布性能 runner 和资源验证脚本；`verify-canvas-performance-assets.js` 返回 `20260629perf5+outpaint6`；指定项目画布 UI smoke 通过，console errors 为 0、bad responses 为 0；`git diff --check` 仅有既有 CRLF warning；本轮触达文件 BOM 均为 false。

### 需要继续验证

- 用户确认额度后，登录态选中真实图片节点，打开 `局部修改`，涂抹 mask 并提交，确认返回 GPT Image 2 edits 结果图并创建 `局部修改结果` 图片节点。
- 同样验证 `AI 智能消除` 是否按 mask 消除并创建 `智能消除结果` 节点。
- 若上游对 Packy/OpenAI-compatible `/images/edits` 的 multipart 字段有差异，再追加 Provider Adapter 配置化。

## 2026-06-29 image-tools tools1 顶部工具接线复核

### 已确认

- 用户要求除 `AI 超清放大` 和 `一键抠图` 外，其它顶部图片工具都接上。
- `AI 扩图` 已补后端 `/api/image-tools/outpaint`，复用 GPT Image 2 图生图编辑链路，并返回标准 `taskId/resultImages`，旧画布原有轮询可继续使用。
- `反推提示词` 已补 `/api/image-tools/reverse-prompt`，前端面板从 mock 文案改为打开时请求当前图片并展示返回提示词。
- `文字编辑` 已从空的 `textEdit` 面板改为复用 mask 局部重绘面板，提交时保留 `type/operation=text_edit`，后台用文字编辑专用提示词调用 `/images/edits`。
- `格式/压缩`、`图片尺寸调整`、`图片裁剪`、`添加到聊天`、`生成视频` 沿用旧画布已有本地/节点链路；其中本地结果上传依赖已补齐的 `/api/upload/image`。
- `AI 超清放大` 和 `一键抠图` 保持未接入，`/api/image-tools/settings` 明确返回 `enabled:false`，避免误判。
- 入口缓存版本已升级为 `20260629tools1`，资源校验增加 `/image-tools/reverse-prompt` 与 `operation:"text_edit"` 锚点。
- 服务已重启，`/api/health` 指向 `F:\dianshang`；未授权路由探测全部为 `401` 而非 `404`，未触发真实上游。
- 静态和页面验证通过：`node --check` 覆盖后端、两个 Canvas bundle、图片 polish JS 和验证脚本；`verify-canvas-performance-assets.js` 返回 `20260629perf5+tools1`；第二次画布 UI smoke 通过，console errors 为 0、bad responses 为 0。第一次 smoke 仍复现一次已知 Playwright 会话未打开问题，重跑成功。

### 需要继续验证

- 登录态选中真实图片节点，依次打开 `AI 扩图`、`反推提示词`、`文字编辑`，确认面板和标题符合预期。
- 用户确认额度后，再点提交 `AI 扩图`、`反推提示词`、`智能消除`、`局部修改`、`文字编辑`，确认真实 GPT Image 2/文本模型返回结果。
- 后续若要接 `AI 超清放大` 或 `一键抠图`，需要单独确认使用的 Provider 能力和返回格式。

## 2026-06-29 API 线路源码页旧后台导航复核

### 已确认

- 直达 `/admin/api-providers` 已由 `server.js` 返回 `frontend/dist/index.html`，源码页 bundle 为 `assets/index-D1smZqeB.js`。
- 旧后台仪表盘仍由根 `index.html` 和旧 bundle `assets/index-DglIsp_g.js` 承载，菜单点击此前会在旧客户端路由内渲染旧 `AdminShell` 表格。
- 已新增 `assets/admin-api-source-route-bridge.js`，旧后台点击 `API 线路管理` 时会整页跳转到 `/admin/api-providers`，交给源码页入口接管。
- 浏览器复核：从 `/admin/dashboard` 点击旧后台 `API 线路管理` 后，页面加载源码 `admin-source-shell`，可见 `应用官方双线路`、`/images/generations`、`/images/edits`、`/responses`。

### 需要继续验证

- 用户当前浏览器如果停留在已加载的旧页面，需要刷新一次或重新点击菜单；之后应稳定进入新版源码线路管理。
- 后续若继续把更多后台页面源码化，需要逐页接管入口，避免旧 Vue Router 和源码 Vue Router 同时管理同一路径。

## 2026-06-29 后台源码侧栏与路由统一复核

### 已确认

- 后台源码页此前各自维护侧栏，Dashboard、任务监控、API 线路等页面的菜单入口数量不一致，属于迁移未同步完成。
- 已抽出 `AdminSourceSidebar.vue` 统一后台源码页侧栏，11 个已迁移后台页面均改用共用组件，避免后续单页漏改。
- 服务端源码入口从单独 `/admin/api-providers` 扩展为全部已迁移 `/admin/...` 后台路径，直达订单、系统设置、模板工作流不再进入旧入口。
- 浏览器复核：`/admin/api-providers`、`/admin/orders`、`/admin/settings`、`/admin/template-workflows` 均加载源码 bundle，侧栏都是同一套 11 个入口，且当前页高亮正确。

### 需要继续验证

- 其它后台页如用户、回收站、任务监控、消费日志、兑换码、模型价格可按同一方式继续人工点一遍，主要风险是个别页面接口数据为空或权限提示，不是侧栏同步问题。

## 2026-06-30 日志扫描与路线图对齐复核

### 已确认

- CodeGraph 索引健康：103 个文件、10640 个节点、21982 条边，可继续用于结构性定位。
- `logs/manual-gen-frontend-err.log` 里的 Vite 资产越界错误已经被当前源码修正；`HomeWorkbench.vue` 现在从 `frontend/src/assets/home-product-workbench.png` 加载图片，不再引用工程外 `F:\dianshang\assets`。
- 维护审计指出的文档滞后成立：`docs/frontend-migration-roadmap.md` 和 `docs/source-frontend-acceptance-checklist.md` 仍把 API 线路写成纯只读，并保留首页迁移索引、旧画布入口壳等旧表述。
- 已将路线图、验收清单、README 和迁移索引同步到当前事实：旧站首页工作台、`/canvas` 直跳旧画布运行时、后台 11 页共用侧栏、`/admin/settings` 与 `/admin/api-providers` 为写入试点。
- 完整源码前端 UI smoke 首次复跑发现脚本固定搜索 `simple` 会使当前任务监控列表筛空；已改为从首条真实任务提取搜索词，避免测试数据变化导致误报。
- 完整源码前端 UI smoke 随后发现移动端用户管理页横向溢出 65px；已在移动端后台布局中收敛面板、工具栏控件和分页宽度，复跑后移动端后台 11 页横向溢出均为 0。

### 需要继续验证

- 后续可按路线图建议人工点一轮后台 11 页，重点看共用侧栏、写入试点提示和真实浏览器观感。

## 2026-06-30 后端与旧画布边界护栏复核

### 已确认

- 本轮没有拆分 `server.js`，也没有修改旧 Canvas bundle 逻辑；只新增后端/旧画布边界 smoke 和维护文档。
- `scripts/smoke-backend-canvas-boundary.ps1` 使用 disposable 数据目录和禁用真实外部能力的环境启动后端，避免污染当前生产测试库或触发上游。
- 新 smoke 覆盖旧画布入口 HTML、性能层、图片节点 polish、源码后台桥接脚本、两个旧 Canvas bundle、canvas storage 配置、image-tools 路由 auth 边界和上传入口 auth/400 边界。
- `upscale` 和 `removeBg` 在 `/api/image-tools/settings` 中仍保持 `enabled:false`，防止未确认 Provider 能力前被误认为已接入。

### 需要继续验证

- 后续如果继续改 image-tools 真实提交链路，需要在用户确认额度后另行做登录态人工点测；当前 smoke 只验证边界，不触发真实生成。

## 2026-06-30 Canvas Chat 对话只出提示词业务线复核

### 已确认

- 用户最新确认的业务线是：先按顺序上传参考图，再填写提示词需求，先生成可编辑提示词；真实生图由用户切到 `快速` 标签手动完成。
- 复核旧画布运行态时，当前对话模式底部模型为 `GPT 5.5 (GPT 5.5)`；旧 Canvas 包中没有 `确认生图`、`确认提示词` 文案，也没有 `/api/generate/tasks` 调用，只有 `/api/chat/completions`。
- 已新增 `assets/canvas-chat-prompt-flow.js/css` 作为旧画布桥接层，只在 `对话` 标签接管发送，不影响 `快速` 和 `视频` 标签。
- 桥接层会收集当前对话最近一组可见参考图，并在提交给后端前把 `blob:` 预览图转为 `data:image/*`，避免后端图生图读取不到参考图。
- 新增 `/api/canvas/generate-prompt`，文本线路真实可用时走 `/responses` 生成提示词；mock 或失败时返回基础可编辑草稿。桥接层已移除 `确认生图` 和 `/api/generate/tasks` 调用。
- boundary smoke 已加入新 JS/CSS 资源、未登录 401 边界和管理员登录后的提示词草稿返回形态，避免接口或资源 404 回退。

### 需要继续验证

- 刷新当前画布后，在 `对话` 标签上传两张图并输入需求，确认出现“提示词草稿”卡片和 `复制提示词` 按钮，且不再新增 `gpt-5.5` 失败结果卡。
- 切到 `快速` 标签后，由用户自行粘贴提示词并触发真实生图；该步骤会产生外部调用和算力消耗，不纳入本轮自动验证。

## 2026-06-30 Canvas Chat 兜底文案复核

### 已确认

- 当前 `/api/canvas/generate-prompt` 路由已加载；未登录访问返回 `401` 而非旧的 `404`。
- 文本模型暂不可用时，业务上只需要保留基础提示词草稿并提醒用户复制到 `快速` 模式，不应把上游渠道或接口错误直接暴露在卡片里。
- 已将 `assets/canvas-chat-prompt-flow.js` 的 `fallback`、mock 和接口异常分支统一收敛为：“文本模型暂不可用，已生成基础提示词，可编辑后复制到快速模式。”

### 需要继续验证

- 强刷当前画布后，在 `对话` 标签触发一次提示词生成，确认状态文案一致且草稿仍可编辑、可复制。

## 2026-06-30 Canvas Chat 对话 Agent 生图链路复核

### 已确认

- 最新业务线已改为 `对话` 模式执行 Agent 生图：参考图和需求先由 GPT 5.5 分析，再把最终提示词交给 GPT Image 2 生图。
- 新增 `/api/canvas/dialog-agent-generate`，与普通 `/api/generate/tasks` 快速生图入口分开，避免把快速模式语义改乱。
- 对话桥接层只在 `对话` 标签拦截发送，`快速` 和 `视频` 标签不显示对话 Agent 分析状态，也不走 GPT 5.5 分析。
- 对话结果成功后会派发 `canvas:add-generated-image-to-canvas`，两个旧 Canvas bundle 已监听该事件并复用既有图片节点创建逻辑。
- boundary smoke 已覆盖未登录 `401`、mock 登录后返回 `analysisSummary/finalPrompt/resultImages`，并校验 `analysisCost=5`、`imageCost=10`、`totalCost=15`。
- 语法检查、静态资产校验、backend/canvas boundary smoke、disposable API smoke、diff/BOM 检查均已通过；本轮未触发真实 GPT 5.5 或 GPT Image 2 付费调用。

### 需要继续验证

- 强刷当前画布后，用真实登录态在 `对话` 标签上传参考图并输入需求，确认前端依次显示分析、生成、结果，并且结果图自动落到画布。
- 真实 Provider 模式下点击会产生 GPT 5.5 和 GPT Image 2 上游调用及算力扣除；本轮自动验证只跑 mock，不做真实付费点测。

## 2026-06-30 Canvas Chat 对话 Agent GPT 5.5 超时复核

### 已确认

- 用户截图中的上游后台记录显示 GPT 5.5 请求耗时可达 42 秒；后端此前文本 Provider 默认超时为 30 秒。
- 本地超时由 `callProviderResponses` 的 `AbortController` 主动触发；上游记录存在不代表本地仍能拿到响应，Provider 可能在连接断开后继续完成并记账。
- 已将文本 Provider 默认等待时间调为 120 秒，并让对话 Agent 分析阶段显式传入 `CANVAS_DIALOG_ANALYSIS_TIMEOUT_MS`。
- 分析阶段再次超时时，后端返回 `CANVAS_DIALOG_ANALYSIS_TIMEOUT`、`stage: analysis` 和明确文案，避免继续显示泛化的 “AI Provider 请求超时”。

### 需要继续验证

- 真实登录态下再次发起对话 Agent 生图，确认 42 秒级 GPT 5.5 分析能正常进入后续 GPT Image 2 生图阶段。
- 若 GPT 5.5 超过 120 秒仍超时，需要再评估是否改为异步任务轮询，避免 HTTP 长连接等待。

## 2026-06-30 Canvas Chat 对话 Agent GPT 5.5 文本提取复核

### 已确认

- 超时修复后出现的新错误是 “GPT 5.5 未返回可用的生图提示词”，说明文本 Provider HTTP 调用已经成功，失败发生在本地解析阶段。
- 当前 `parseCanvasDialogAgentPlan` 在有文本时会把原始文本作为 prompt 兜底，因此空 prompt 的根因是 `imageToolOutputText` 没能从 Provider 响应结构中抽取文本。
- 已补充 `normalizeProviderContentText`，支持 `choices[].message.content[]`、`output[].content[]`、`text.value`、`output_text` 等常见嵌套结构。

### 需要继续验证

- 用户重新测试真实对话 Agent 请求，确认 GPT 5.5 分析结果能进入 GPT Image 2 生图阶段。
- 若仍返回无 prompt，需要临时记录 Provider 响应 shape，再按真实结构补充解析。

## 2026-06-30 Canvas Chat 对话 Agent GPT Image 2 多参考图复核

### 已确认

- `assets/canvas-chat-prompt-flow.js` 会按可见顺序收集多张参考图，并把它们作为 `referenceImages` 传给 `/api/canvas/dialog-agent-generate`。
- GPT 5.5 分析阶段使用 `canvasDialogReferencesForAnalysis` 读取全部参考图，因此“图1/图2”的文本分析输入是完整的。
- GPT Image 2 编辑阶段此前只执行 `loadReferenceImageFile(references[0])` 并 append 单个 `image`，所以第二张参考图没有作为图片文件进入 `/images/edits`。
- 已改为无 mask 时按顺序提交多张 `image[]`，并在 request meta 中记录 `submittedReferenceImageCount` 和 `referenceImageField`。

### 需要继续验证

- 真实对话 Agent 重新测试“把图1的产品改为图2产品，文案也对应”，确认生成结果更明显继承图2瓶型、包装和文字风格。
- 若 Provider 不接受 `image[]` 字段，需要根据上游实际接口改为重复 `image` 字段或线路配置化字段名。

## 2026-06-30 Canvas Chat 对话 Agent 参数控件复核

### 已确认

- 对话模式旧 DOM 原本只有上传图片、文本模型和发送按钮，没有 `张数`、`清晰度`、`比例` 控件。
- 桥接层已在 `对话` 标签底部补充三项控件，并在提交时读取当前值。
- 请求体现在会带上 `imageCount/count/n`、`quality/clarity`、`ratio/aspectRatio`；后端已有 `providerImageSize` 和 `providerImageQuality` 处理这些字段。

### 需要继续验证

- 刷新旧画布后确认对话模式底部出现 `1张`、`1K`、`1:1` 三个控件。
- 选择 `2张` 或其它比例后发送一次真实对话 Agent 请求，确认后端返回对应数量和尺寸倾向。

## 2026-06-30 Canvas Chat 参数控件设计语言复核

### 已确认

- 用户截图确认旧设计语言应为：底部紧凑按钮、张数/清晰度深色竖向菜单、比例浅色卡片网格。
- `dialogagent5` 已移除对话/视频参数中的原生 `select`，改为注入旧式按钮和自绘菜单。
- 快速模式继续保留旧 Canvas Chat 自带参数控件，只由桥接样式做网格归组，避免和对话新增控件混用。

### 需要继续验证

- 刷新旧画布后，在 `对话`、`快速`、`视频` 三个标签分别打开参数菜单，确认视觉语言一致且没有控件重叠。
- 点击比例卡片后确认按钮文案和对话 Agent 请求体中的 `ratio/aspectRatio` 同步更新。

## 2026-06-30 Canvas Chat 参数控件去桥接层复核

### 已确认

- `dialogagent5` 的方向已判定为错误：它仍在桥接层自绘一套参数控件，并且移动快速模式原控件导致重叠。
- `dialogagent6` 已改为启用旧 Canvas Chat 组件原生参数控件，三种模式共享同一套按钮和菜单行为。
- 桥接脚本不再创建 `hjm-dialog-agent-settings` 或 `hjm-native-param-settings`，只清理旧残留并从原控件读取 `张数 / 清晰度 / 比例`。

### 需要继续验证

- 用户刷新当前画布后确认：对话模式参数控件来自旧组件，快速模式按钮不再重叠，比例菜单仍是旧卡片网格。
- 若仍有缓存残留，需要强刷或重开当前项目页，确认入口 HTML 已加载 `dialogagent6`。

## 2026-06-30 Canvas Chat 快速设置对齐复核

### 已确认

- 快速模式重叠根因是 CSS 第一列仍按上传按钮 `44px` 计算，而 `1张` 按钮强制 `82px`，导致从第一列溢出到第二列。
- `dialogagent7` 将底部网格改为三个完整参数列，上传按钮只占第一列的一小块，不再决定参数列宽。
- 对话模式设置控件仍来自旧 Canvas Chat 原生控件，不新增桥接 UI。

### 需要继续验证

- 刷新当前项目页后确认快速模式 `1张 / 1K / 1:1` 横向对齐且无重叠。
- 切到对话模式确认同一套设置控件可见。

## 2026-06-30 Canvas Chat 对话/快速三按钮一致性复核

### 已确认

- 用户最终强调的是底部 `张数 / 清晰度 / 比例` 三个按钮本身，而不是模型下拉或额外桥接控件。
- `dialogagent8` 已把参数按钮布局改为同一套 flex wrap 规则，覆盖 `对话` 和 `快速` 两种模式；三按钮使用同样的 `.compact-control` 原生按钮样式。
- 参数按钮之间使用固定 `12px` gap，并用 `calc((100% - 24px) / 3)` 控制单个按钮宽度；窄面板时只会等宽压缩或换行，不会重叠。

### 需要继续验证

- 刷新当前项目页后分别查看 `对话` 和 `快速`：`1张 / 1K / 1:1` 视觉一致，且任意面板宽度下按钮不压住彼此。

## 2026-06-30 Packy GPT Image 2 尺寸参数复核

### 已确认

- Packy `gpt-image-2` 出图必须使用 Images API；文生图为 JSON，图生图/编辑为 multipart。
- `1K / 2K / 4K` 在本项目按图片大小档位处理，不再当作 Packy `quality`。
- Packy `quality` 只输出 `low / medium / high / auto`；旧前端字段如果传 `1k/2k/4k`，后端会把它用于 `size` 换算，同时把真实 `quality` 归一为 `auto`。
- `n` 向上游固定传 `1`，多张由后端循环请求，符合当前 Packy 编辑接口限制。
- 已补本地守护脚本，覆盖 `1:1 / 2:3 / 3:2 / 3:4 / 4:3 / 4:5 / 5:4 / 9:16 / 16:9 / 1:2 / 2:1 / 9:21 / 21:9` 全部比例。

### 需要继续验证

- 不付费环境先用本地换算断言覆盖常见比例；真实 Provider 点测需用户确认额度后进行。

## 2026-06-30 Packy GPT Image 2 全入口覆盖复核

### 已确认

- 当前后端所有 GPT Image 2 出图路径都应收敛到 `callProviderImageGeneration` 或 `callProviderImageEdit`，不再由各业务入口分别拼 Provider 参数。
- 已知入口覆盖：Canvas Chat 对话 Agent、快速生图任务、模板生图、图片工具局部修改/消除/文字编辑/扩图、后台 API Provider 图片线路测试。
- 图生图 / 图片编辑统一补 `input_fidelity=high`，以提高保留参考图主体、包装结构和细节的概率。
- 新增 `scripts/check-packy-gpt-image-adapter-coverage.js`，检查已知入口调用统一适配器，并禁止源码中出现绕过适配器的 Packy 图片端点直连。

### 需要继续验证

- 后续新增任何 GPT Image 2 入口时，必须把该入口加入覆盖脚本；否则静态检查只能覆盖当前已知入口。
- 真实 Provider 对多参考图字段名 `image[]`、`input_fidelity=high` 的实际兼容性仍需在用户确认额度后点测。

## 2026-06-30 Canvas Chat 对话 Agent GPT 5.5 文本抽取复核

### 已确认

- 用户截图里的失败点发生在分析阶段：后端未拿到 `finalPrompt`，因此不会进入 GPT Image 2 生图阶段。
- 已增强文本抽取函数，支持从 `data.choices`、`response.output`、`text.value`、`reasoning_content`、顶层 `final_prompt/finalPrompt` 等结构中取出 GPT 5.5 文本。
- 新增回归脚本 `scripts/check-provider-text-extraction.js`，直接抽取 `server.js` 中的真实函数运行 5 个样例，避免解析代码再次漂移。

### 需要继续验证

- 当前修复未触发真实 GPT 5.5 调用；用户刷新并重新提交后，应确认对话卡片能进入“正在生成图片...”阶段。
- 如果仍失败，需要查看真实上游响应体字段名，再把该结构加入抽取回归样例。

## 2026-06-30 Canvas Chat 分析诊断 API 复核

### 已确认

- 为避免完整对话 Agent 继续触发 GPT Image 2，已新增 `debugAnalysisOnly:true` 诊断模式。
- 诊断模式仅管理员可用，只跑 GPT 5.5 分析阶段，返回解析是否成功、抽取文本长度、最终 prompt 和响应结构摘要。
- 响应结构摘要会隐藏 key/token/secret/authorization/password 等敏感字段。

### 需要继续验证

- 待用户确认允许一次真实 GPT 5.5 上游调用后，用诊断模式跑当前失败请求，查看 `responseShape` 和 `extractedTextPreview`。
- 如果 `parseOk=false` 且 `responseShape` 显示新的字段路径，把该结构加入 `scripts/check-provider-text-extraction.js` 再修复。

## 2026-06-30 Canvas Chat New API 文本端点复核

### 已确认

- 本轮真实 API 对照显示：New API 的 `gpt-5.5 /responses` 会产生消费但可能返回 `completed + output=[]`，导致本地拿不到提示词。
- 同一条文本线路改用 `/chat/completions` 后能正常返回 `choices[0].message.content`，并且支持把参考图按 `image_url` 传给 GPT 5.5。
- `callProviderResponses` 现保留函数名以减少影响面，但 New API 文本线路内部走 Chat Completions；普通非 New API 路线仍保留 Responses 逻辑。
- `parseJsonObjectFromText` 已兼容连续两个 JSON 对象，只取第一个完整对象，避免把重复 JSON 整段塞进 `finalPrompt`。

### 需要继续验证

- 用户刷新旧画布后重新走对话模式，应先出现 GPT 5.5 生成的真实提示词并继续进入后续图片生成。
- 后续如果 New API 后台把 GPT 5.5 路线切回真正可用的 `/responses`，再评估是否需要配置化端点选择。

## 2026-06-30 旧画布维护边界复核

### 已确认

- 已新增 `docs/canvas-maintenance-boundary.md`，把当前唯一旧画布入口、资产、后端接口、对话/快速/视频三条链路、GPT Image 2 统一适配器和禁改项写成可执行边界。
- 已新增 `docs/canvas-maintenance-log.md`，把 `dialogagent9` 当前资产版本、New API 文本端点修复、参数控件去桥接层、Packy GPT Image 2 准则、多参考图修复和临时技术债集中记录。
- `docs/canvas-migration-checklist.md` 已链接维护边界、维护日志和 Packy 技术档案，后续接手不需要从长进度日志里翻线索。

### 需要继续验证

- 文档本轮只固化维护边界，没有再次触发真实 Provider。
- 业务链路稳定后，优先清理或收窄 `debugAnalysisOnly` 与普通错误里的 `responseShape`。

## 2026-06-30 旧画布入口缓存版本复核

### 已确认

- `index.html` 当前加载 `assets/index-DglIsp_g.js?v=20260630dialogagent9`，与后端画布边界 smoke 的入口断言一致。
- 旧入口 bundle 里的 `/canvas` 动态 import 已从 `Canvas-*.js?v=20260630dialogagent1` 同步到 `20260630dialogagent6`，避免浏览器继续使用旧查询串缓存画布 chunk。
- `scripts/verify-canvas-performance-assets.js` 已覆盖主入口 `dialogagent9` 和两个 Canvas chunk `dialogagent6`，本轮重跑通过。
- `scripts/smoke-canvas-performance-ui-runner.js` 的主入口版本断言已同步到 `dialogagent9`。

### 需要继续验证

- 项目未安装 `@playwright/cli`，现有画布 UI smoke 脚本会通过 `npx --package @playwright/cli` 取包；本轮按下载确认规则未执行该类 UI smoke。
- 真实浏览器端还需在允许使用该 UI smoke 依赖后跑 `smoke-canvas-performance-ui.ps1`、`smoke-canvas-json-ui.ps1` 或等价人工页面复测。

## 2026-06-30 Canvas Chat 三模式会话隔离复核

### 已确认

- `对话 / 快速 / 视频` 现在使用独立会话桶保存输入框、参考图、消息列表和 `sessionId`。
- 切换模式时会先保存旧模式状态，再加载目标模式状态；不会把一个模式的消息列表直接渲染到另一个模式。
- 生成任务回调按消息 id 查找原始模式会话并回写，降低“生成中切标签后结果写到当前标签”的风险。
- `source:"canvas-chat"` 的未发送草稿刷新后不再自动转成用户消息；这避免输入框草稿污染消息历史。
- 浏览器实测：三个模式分别输入不同文本，切换返回后各自保留；清空后三个模式输入均为空，消息数不串。

### 需要继续验证

- 本轮没有触发真实模型调用，未覆盖真实生成中长时间切换模式后的最终图片回写。
- 若后续要验证完整 UI smoke，需要先确认是否允许 `npx --package @playwright/cli` 获取该依赖。

## 2026-06-30 Canvas Chat 三模式隔离护栏复核

### 已确认

- `docs/canvas-maintenance-boundary.md` 已把三模式隔离提升为硬护栏：不能共享消息、输入、参考图、生成中状态或 `sessionId`。
- `docs/canvas-maintenance-log.md` 已新增不可回退护栏，并把当前入口版本固定为 `dialogagent12 / canvasdialogagent9`。
- 维护日志明确禁止把快速模式改成对话 Agent 链路，禁止视频模式复用 GPT Image 2 图片入口，禁止 Canvas Chat 草稿刷新后变成用户消息。
- 后续如果改 Canvas Chat 状态管理，必须同步守护断言并跑旧画布边界 smoke。

### 需要继续验证

- 本轮是文档护栏固化，没有重新触发 UI 或真实 Provider 测试。

## 2026-06-30 Canvas Chat 对话卡片 UI 复核

### 已确认

- 快速模式现有消息卡片来源为旧 `CanvasChatPanel` 的 `article.message-card`、`.message-meta`、`.image-grid` 和 `.cost-line`，对应样式是 Vue scoped 后的 `data-v-b10121f4` 选择器。
- `assets/canvas-chat-prompt-flow.js` 已改为给桥接 DOM 补齐旧组件 scoped 样式标记，让对话桥接卡片直接吃快速模式现有 CSS。
- 对话桥接不再生成单独的参数展示行，避免用户消息卡片和快速模式卡片出现不同信息层级。
- `assets/canvas-chat-prompt-flow.css` 已删除对 `.hjm-prompt-flow-result-grid figure` 和 `.hjm-prompt-flow-images figure` 的二次图片网格覆盖，降低后续重复造轮子的风险。
- `scripts/verify-canvas-performance-assets.js` 已增加结构锚点，后续若移除 scoped 复用或重新定义桥接图片网格会失败。
- 验证已通过：桥接 JS 和两个旧 Canvas bundle 语法检查、资产守卫、旧画布边界 smoke、BOM 检查；浏览器已加载 `dialogcard1` 资源并能在对话模式显示桥接提示条。

### 需要继续验证

- 本轮不触发真实 Provider；完整成功图卡片仍需在用户允许真实生成或已有结果重放场景下做人工视觉复核。

## 2026-06-30 Canvas Chat 对话桥接 DOM 隔离复核

### 已确认

- 上一版护栏缺口已定位：`assets/canvas-chat-prompt-flow.js` 直接向 `.message-list` append DOM，这条路径没有进入旧组件的三模式会话桶，因此切到 `快速` 时可能继续显示桥接卡片。
- `dialogcard4` 已要求所有桥接卡片带 `hjm-prompt-flow-card` 和 `data-hjm-prompt-flow-mode="chat"`。
- 新增 `syncPromptFlowCardVisibility`，根据当前标签给面板切换 `hjm-prompt-flow-dialog-active`，并把非对话状态下的桥接卡片隐藏。
- CSS 已增加非对话模式兜底隐藏规则，防止 JS 时序落后一拍时卡片闪回。
- `scripts/verify-canvas-performance-assets.js` 已把这些 DOM 隔离锚点加入守卫。

### 需要继续验证

- 浏览器已刷新到 `dialogcard4`；稳定重测 `快速` 模式 `bridgeTotal=0`、`bridgeVisible=0`，视频与对话无旧泄漏卡片。

## 2026-06-30 Canvas Chat 对话任务进度 UI 复核

### 已确认

- `灵感不间断` 是旧 Canvas Chat 的 `.empty-state`，当桥接层直接插入任务卡片时，Vue 自身消息数组仍可能为空，因此必须由桥接层主动隐藏。
- `syncPromptFlowCardVisibility` 已扩展为同时管理桥接卡片可见性和 `.message-list > .empty-state` 显隐。
- 生成结果卡已新增 `hjm-prompt-flow-progress`，加载阶段可见，成功或失败后隐藏。
- `scripts/verify-canvas-performance-assets.js` 已增加空状态隐藏和进度条相关锚点，防止退回纯文字状态。

### 需要继续验证

- 进度条结构已由资产守卫覆盖；完整真实生成过程的视觉确认仍需用户允许实际调用后再做。

## 2026-07-01 视频 Tab 电商套图 Agent 复核

### 已确认

- 本轮重新实现前已回滚上一轮越界改动，旧画布刷新恢复。
- 新实现只挂在 `assets/canvas-chat-prompt-flow.js/css`，没有新增独立 `canvas-ecommerce-suite-agent.js/css`，没有改主入口 bundle 和旧 Canvas chunk。
- `shouldHandle(panel)` 仍严格只匹配 `对话`，新增 `isSuiteMode(panel)` 只匹配 `视频 / 电商套图Agent`。
- 发送按钮和回车提交已显式分流：对话走原 `handleSubmit`，视频走 `handleSuiteSubmit`，快速不被桥接层接管。
- 套图模式已隐藏原生视频模型控件，不显示 `Seedance Pro`；请求体固定传 `gpt-5.5` 生成提示词、`gpt-image-2` 做图生图。
- 上传区已改为产品图和参考图中间独立 `+` 号；参考图逐张新增独立槽位，最多 4 张。
- skill 下拉已改为 100% 宽度，与下方文本输入框对齐。
- 已上传图片槽位只显示整图铺满圆角卡片，不显示 `产品图 / 参考图` 文字，也不再缩成小图。
- 后端套图接口 mock smoke 已覆盖：config 正常、未登录 401、缺产品图 400、生成提示词成功、mock 生图成功。

### 需要继续验证

- 当前环境没有本地 Playwright 依赖，本轮未下载新包做 UI 自动化。
- 需要用户在浏览器里人工验证：`对话 / 快速` 能正常切换和点击；视频 tab 能上传产品图、参考图，发送后出现 `套图模板` 卡片；勾选板块后 mock/真实生图路径按预期。
- 真实 GPT 5.5 或 GPT Image 2 链路会产生上游请求和可能扣费，未在本轮触发。

## 2026-07-01 电商套图 Agent 动态板块复核

### 已确认

- 业务链路应为：产品图 + 参考图 + 用户需求 + 所选 skill Markdown -> GPT 动态生成本次板块提示词 -> 用户勾选/编辑 -> img2 根据产品图和参考图生成对应板块图片。
- 后台不再展示固定“套图板块/板块集合”编辑列表；后台只维护默认参数和设计师 skills。
- `/api/canvas/ecommerce-suite/config` 已返回 `sectionMode:"dynamic"`，并对前台暴露空 `sections`，防止前端按默认模板集合渲染或提交。
- 旧画布过渡层已移除生成模板请求里的默认 `sectionKeys`，不会再默认发送 `hero/selling-points/effect/tech/scene`。
- `scripts/verify-canvas-performance-assets.js` 已增加“不发送默认 sectionKeys”和动态模式锚点，`scripts/smoke-backend-canvas-boundary.ps1` 已用不带 sectionKeys 的请求覆盖 prompt mock。

### 需要继续验证

- 真实 GPT 返回的动态板块名称和数量需要用户用实际产品图、参考图和 skill 文档人工验收；本轮只覆盖 mock 与接口边界。

## 2026-07-01 电商套图 Skill Markdown 复核

### 已确认

- Skill Markdown 会被后端作为 `设计师 Markdown` 拼入 `/api/canvas/ecommerce-suite/prompts` 的文本模型上下文，不会在前台执行。
- 新增测试稿统一强调动态板块：根据产品图、参考图、用户需求和所选 skill 生成 3-5 个板块，不套固定五件套。
- 五个角色差异已拉开：Gloria 偏高转化品牌视觉，Paload 偏参考图结构拆解，Lumi 偏柔和生活方式，Kira 偏平台点击转化，RayYu 偏创意概念和品牌叙事。
- 新增文件已检查 UTF-8 无 BOM，并扫描危险脚本片段为空。

### 需要继续验证

- 需要用户在后台逐个上传 `.md` 后，用真实产品图和参考图观察动态板块是否符合各角色差异。

## 2026-07-01 电商套图模板选择卡复核

### 已确认

- 结果卡从 prompt 编辑器改为浅色板块选择卡，避免用户直接面对标题、prompt 和负面词输入区。
- 选择卡内部已移除 `套图模板` 标题，避免标题占用 grid 单元导致首个板块错位到右侧。
- 生图链路仍使用后端返回的 `promptPlans[]`，勾选状态只决定哪些板块提交给 `/api/canvas/ecommerce-suite/generate`。
- 生图提交已改为每个板块一个独立请求，4 个板块会形成 4 次后端 generate 调用；suite14 按用户确认的工作链恢复为前端立即并发发出多个单板块任务，不等待上一个完成。
- suite15 只优化失败卡片展示：上游 `upstream error: do request failed (request id: ...)` 不再整段占满卡片，主文案压缩为“上游图生图请求失败”，request id 小字保留，原始错误放在卡片 title 中。
- suite16 只优化成功卡片布局：图片下方四按钮白色区域改为图片内白色半透明浮层，hover/focus/触摸打开，压缩套图结果卡高度；不改变生图请求和自动上画布逻辑。
- suite17 只优化 skill 选择体验：五个默认设计师补本地头像，前台从原生 select 改为浅色头像列表，后台默认 skill 也补 avatarUrl；不改变 prompts/generate 请求体和 skill Markdown 拼装逻辑。
- 成功图片会自动触发旧画布 `canvas:add-generated-image-to-canvas` 事件；失败任务保留单板块重试按钮，重试成功后替换为完整图片卡。
- 护栏新增禁止编辑字段和黑底卡片回退的断言，范围仍限制在 `视频 / 电商套图Agent` 模式。

### 需要继续验证

- 需要在浏览器中用实际产品图、参考图和 skill 生成一次模板，人工确认卡片数量、名称和浅色视觉符合预期。

## 2026-07-01 图片节点卡片精简复核

### 已确认

- 图片节点空态 DOM 中右上徽标和底部状态栏会同时输出 `正常`，重复文字来自底部 `.flex.h-8` 状态栏。
- 用户后续明确要求顶部 `图片节点` 名称和顶部 `正常` 徽标也去掉，因此图片节点顶部 header 已整体隐藏。
- 本轮只通过 `assets/canvas-image-node-polish.css` 精简图片节点卡片，没有改旧 Canvas 主 bundle。
- `canvas-image-node-polish` 资源查询串已升级为 `20260701image10`，避免浏览器继续缓存旧空态样式。
- 静态护栏已增加图片节点 polish 资产读取、`image10` 版本、图片节点 header 隐藏和空态底部状态栏隐藏选择器检查。
- `assets/canvas-node-radius-fix.css?v=20260701title1` 负责通用节点标题锁定，移除 text cursor、hover 灰底和文本选择。
- 验证已通过：后端/桥接/图片节点 polish 语法检查、资产护栏、旧画布边界 smoke、前端 build、`git diff --check` 和 BOM 检查。
- 浏览器刷新后确认已加载 `canvas-image-node-polish.js/css?v=20260701image10` 和 `canvas-node-radius-fix.css?v=20260701title1`；当前项目刷新后没有图片节点 DOM 可做实时视觉断言。

### 需要继续验证

- 浏览器刷新后确认图片节点不再显示顶部 `图片节点` 名称和 `正常` 徽标，底部也不显示重复 `正常`。

## 2026-07-01 Canvas Chat 三模式空状态文案复核

### 已确认

- 空状态文案位于旧 Canvas Chat 的 `.message-list > .empty-state`，会在 `对话 / 快速 / 视频` 没有消息时显示。
- 本轮用 `assets/canvas-chat-prompt-flow.css` 统一隐藏该空状态，不改旧 Canvas 主 bundle。
- `canvas-chat-prompt-flow.js/css` 资源查询串已升级到 `20260701suite18`。
- 静态护栏已增加 `.canvas-chat-panel .message-list > .empty-state` 选择器检查。
- 浏览器刷新后确认已加载 `canvas-chat-prompt-flow.js/css?v=20260701suite18`，空状态元素仍在 DOM 中但 computed display 为 `none`。

### 需要继续验证

- 浏览器刷新后切换三个 tab，确认 `👋 / 灵感不间断 / 对话模式会保留你的上下文与参考图` 均不再显示。

## 2026-07-01 Canvas Chat 输入框默认文案复核

### 已确认

- 底部输入框默认文案来自旧 Canvas Chat composer 的原生 `placeholder`，不能通过重写 composer 解决。
- 本轮只在 `assets/canvas-chat-prompt-flow.js` 的现有同步周期里补 `syncComposerPlaceholder()`，把 `placeholder/data-placeholder` 统一为 `请输出你的提示词`。
- `canvas-chat-prompt-flow.js/css` 资源查询串已升级到 `20260701suite19`。
- 静态护栏已增加 `CANVAS_CHAT_PLACEHOLDER`、`syncComposerPlaceholder()` 和 placeholder 赋值锚点检查。

### 需要继续验证

- 浏览器刷新后确认底部输入框显示 `请输出你的提示词`，并切换 `对话 / 快速 / 视频` 后文案不回退。

## 2026-07-01 第三个 Tab 文案复核

### 已确认

- 第三个 tab 的旧底层文案可能仍由旧 Canvas 主 bundle 输出为 `视频`，因此本轮只在 `assets/canvas-chat-prompt-flow.js` 过渡层同步展示文案。
- 前台展示文案统一为 `agent电商套图`，`isSuiteMode()` 继续兼容旧 `视频`、旧 `电商套图Agent` 和当前 `agent电商套图` 三个别名。
- `canvas-chat-prompt-flow.js/css` 资源查询串已升级到 `20260701suite20`。
- 静态护栏已增加 `SUITE_TAB_LABEL`、`SUITE_MODE_ALIASES`、`syncSuiteTabLabel()` 和禁止旧硬编码 suite 判断回退的断言。

### 需要继续验证

- 浏览器刷新后确认 tab 显示为 `对话 / 快速 / agent电商套图`，点击第三个 tab 后电商套图 composer 仍出现，`对话 / 快速` 仍可切换。

## 2026-07-02 首页历史画布删除按钮复核

### 已确认

- 首页历史项目删除函数已在旧 HomeIndex bundle 中存在，后端 `DELETE /api/user/projects/:id` 也存在；本轮问题定位为首页卡片 hover 层与按钮层级/指针事件需要加固。
- `assets/home-overrides.css` 已补 `.history-delete { z-index: 5; pointer-events: auto; }` 和 `.history-hover { pointer-events: none; }`，不改旧 HomeIndex JS 和项目存储模块。
- 浏览器刷新后 computed style 确认新规则生效。
- UI 验证中先新建临时画布，再点击第一张临时卡片删除按钮；删除后卡片数从 3 降回 2，当前 URL 保持 `http://localhost:3456/`，页面提示“项目已删除”。
- 追加复核后确认：多个同名空白画布会让删除成功看起来像无变化；同时历史横向拖拽脚本可能在捕获阶段吞掉拖拽后的第一次 click。
- `assets/home-carousel-inertia.js` 已对 `button/a/input/textarea/select/[role="button"]/.history-delete` 放行，避免删除按钮参与横向拖拽；捕获 click 遇到交互元素时直接放行并清理拖拽状态。
- `assets/home-overrides.css` 已让删除按钮默认可见，减少必须 hover 才能精确点击的问题；`index.html` 已给首页覆盖 CSS 和轮播脚本加 `20260702delete1` 查询串，避免缓存旧交互脚本。
- 浏览器验证：直接点击临时画布删除按钮，卡片数 `4 -> 3`；先拖动历史列表再点击临时画布删除按钮，卡片数仍 `4 -> 3`；两次均停留首页并提示“项目已删除”。

### 需要继续验证

- 用户后续可在自己的目标画布卡片上再点一次删除，确认右上角按钮无需确认即可直接删除对应卡片。

## 2026-07-02 首页模型同步后端复核

### 已确认

- 首页旧 `HomeIndex` 原先把后端线路模型与 `fixedImageModels` 固定清单合并，导致页面出现 `Nano Banana`、`Gemini`、`Comfly` 等不完全来自后端的选项。
- `server.js` 原先 `/api/model-routes`、`/api/public/models`、`/api/user/models` 只读取 `IMG/TXT` 常量，后台 `admin.modelPrices` 只在后台模型价格页使用。
- 本轮新增统一模型归一化层：基础模型先来自路线默认模型，再叠加 `admin.modelPrices` 的价格、启停和新增模型覆盖。
- 首页旧包已改为不再合并固定图片模型，不再使用 `nano-banana-2` 固定默认值；刷新入口为 `HomeIndex-DAjDt0aj.js?v=20260702modelsync1`。
- 本地接口验证：当前后端图像模型列表只有 `GPT Image 2`，价格 10 点；估费接口 2 张图返回 20 点。
- 浏览器验证：首页模型按钮显示 `GPT Image 2`，页面文本中不再出现固定清单里的 `Nano Banana`、`Gemini`、`Comfly`。

### 需要继续验证

- 后续在后台新增一个测试模型并启用后，刷新首页确认新模型出现在下拉；再禁用该模型，确认首页不再展示。

## 2026-07-02 首页顶部播放按钮移除复核

### 已确认

- 用户截图箭头指向的按钮对应旧 HomeLayout 的 `header-icon-button visual-mode`，标题为 `样式 1：视频播放`。
- 本轮已从 `assets/HomeLayout-BeS5XdE3.js` 渲染结构中移除该按钮，并将 HomeLayout 动态 import 升级为 `HomeLayout-BeS5XdE3.js?v=20260702removeplay1`。
- `index.html` 主入口已升级到 `index-DglIsp_g.js?v=20260702removeplay1`，避免浏览器继续加载旧依赖表。
- 浏览器刷新后确认顶部按钮只剩 `导出`、`保存`、`历史记录` 和用户/AI入口；`.header-icon-button.visual-mode` 不存在，`样式 1：视频播放` 标题也不存在。

### 需要继续验证

- 用户刷新当前首页后确认截图中箭头位置不再出现圆形播放按钮。

## 2026-07-02 画布图片节点工具入口回滚复核

### 已确认

- 上一轮文字编辑新增的 `/api/image-tools/text-edit/ocr` 和 `/api/image-tools/text-edit` 已随 `server.js` 回滚移除。
- 图片节点工具栏数组已删除 `textEdit`、`removeBg`、`upscale` 三项；缓存查询串改为 `20260702remove-tools`。
- `/api/image-tools/settings` 已不再声明 `textEdit/upscale/removeBg`。
- 浏览器 3456 实测图片节点底部工具栏中不存在 `文字编辑`、`一键抠图`、`AI 超清放大`，`局部修改` 面板仍可打开。

### 需要继续验证

- 用户在自己的生产测试画布刷新后确认图片节点底部工具栏不再出现这三个入口。

## 2026-07-02 图片节点工具排版复核

### 已确认

- 本轮只处理截图中的旧画布图片节点排版，不恢复 `文字编辑`、`一键抠图`、`AI 超清放大`。
- 顶部 `.image-node-toolbar` 已改为贴图片左上方、最大宽度 760px、允许换行，并显式恢复 `height:auto`，避免旧竖向工具栏高度把背景拉成大面板。
- `格式/压缩` 对应 `.image-edit-overlay:has(.convert-panel)` 已改为 `left: calc(100% + 16px)`，不再沿用旧右侧竖向工具栏时代的 `+134px` 间距；窄屏时弹层落到图片下方。
- `canvas-image-node-polish.css` 查询串已升级到 `20260702layout2`，静态护栏已同步当前入口和 Canvas 动态 chunk 版本。
- `node scripts/verify-canvas-performance-assets.js` 与旧后端边界 smoke 均通过，后者确认新 `layout2` CSS 可由 3456 正常返回。

### 需要继续验证

- 浏览器刷新目标项目后当前没有图片节点 DOM 可读；后续有真实图片节点时，仍需肉眼确认工具条不再被左侧裁切，弹层与图片间距合理。

## 2026-07-02 图片节点工具条单行复核

### 已确认

- 图片节点工具条数组已删除 `key:"video", label:"生成视频"` 这一项；其它 `生成视频` 文案仅属于视频配置节点内部按钮，未扩大删除。
- 工具条样式已改为 `flex-wrap: nowrap`、`max-height: 52px`，保持单行紧凑展示。
- 入口资源升级到 `20260702toolbar1`，避免浏览器继续加载 `layout2/remove-tools` 旧版本。
- 静态验证、边界 smoke 和浏览器资源检查均确认 `toolbar1` 已生效；当前刷新后的项目没有图片节点 DOM，只能确认页面正文不再出现 `生成视频`。

### 需要继续验证

- 刷新当前画布后选中图片节点，确认工具条一行展示且不再出现 `生成视频`。

## 2026-07-02 图片节点工具条居中复核

### 已确认

- 工具条定位已从贴左改回以图片中心为锚点：`left: 50%` 和 `translateX(-50%)`。
- 工具条仍保持 `flex-wrap: nowrap`，按钮和文字最大宽度已收紧，避免恢复两行。
- `格式/压缩` 面板顶部偏移已提升到 `76px`，避免贴近画布顶边。
- CSS 查询串升级到 `20260702center1`，静态护栏已增加居中 transform 断言。
- 边界 smoke 确认 `center1` CSS 可由 3456 返回；浏览器刷新后也确认已加载该 CSS。当前项目刷新后没有图片节点 DOM，未能读取真实中心点差值。

### 需要继续验证

- 刷新当前画布后确认工具条在图片上方居中，`格式/压缩` 面板不再顶边。

## 2026-07-02 图片节点工具条文字完整显示复核

### 已确认

- 图片工具条按钮已取消最大宽度限制，`.tool-text` 已取消 `max-width: 72px` 和省略号。
- 工具条仍保持 `flex-wrap: nowrap` 与居中 transform，不恢复两行布局。
- CSS 查询串升级到 `20260702fulltext1`，避免浏览器继续加载截断文字的 `center1`。
- 浏览器刷新后确认已加载 `fulltext1` CSS；当前项目没有图片节点 DOM，无法直接读取长文案是否裁切。

### 需要继续验证

- 刷新当前画布后确认 `AI 智能消除`、`图片尺寸调整` 等长文案完整显示。

## 2026-07-03 生产状态可靠性验收复核

### 已确认

- 当前 3456 服务由 `F:\dianshang` 目录运行，`/api/health` 返回 `real-provider-ready`，真实 AI 网关 Key 已配置，数据库、上传目录和日志目录均指向主目录。
- 已完成生产向非付费验收：构建、后端语法、API 一次性数据库 smoke、前端路由、真实 Provider 护栏、旧画布边界、首页/画布 UI、移动端 UI、画布性能和帧预算均通过。
- 后台源码页 dashboard DOM 探针确认标题为 `控制台 Dashboard`，颜色为 `rgb(15, 23, 42)`，字重为 `900`，并加载最新 `frontend/dist` 资源。
- Playwright 残留进程已清理，当前残留计数为 0。

### 需要继续验证

- 真实 AI 生图、真实文本模型、真实扣费和真实外部网关链路需要用户确认后再触发，避免未经确认的付费调用。
- 邮件发送、支付充值和对象存储当前在健康检查中仍为关闭状态，不能认定为完整生产闭环。
- `smoke-admin-pages-ui.ps1` 的完整后台截图流程仍受 Playwright CLI run-code 挂住影响，建议后续改造成更轻量、可超时退出的后台页面探针后再纳入稳定门禁。

## 2026-07-03 画布清晰度三档复核

### 已确认

- 根因是图片模型接口把 provider 画质枚举和画布清晰度尺寸档混用，且默认 variants 只有 `clarity=1k`。
- `server.js` 已统一图片模型 `qualities` 为 `1k / 2k / 4k`，并按三档生成 variants。
- `scripts/smoke-api.ps1` 已增加接口回归断言，临时数据库 API smoke 通过。
- 当前 3456 服务已重启，`/api/model-routes?group=image` 和 `/api/public/models?routeId=pub_route_openai_gpt_image_2` 均返回 `1k / 2k / 4k` variants。

### 需要继续验证

- 用户当前已打开的画布页面需要刷新一次，旧页面内存中的模型选项才会重新读取接口。
- 选择 `2K` 或 `4K` 后点击生成会走真实 Provider，可能产生真实外部调用和扣费，应由用户自行确认后测试。

## 2026-07-03 Docker 运行目录复核

### 已确认

- `docker/docker-compose.yml` 使用上级目录作为 build context，继续复用根目录 `Dockerfile`，容器名为 `dianshang-internal-app`。
- 数据、上传和日志均使用可见 bind mount：`docker/data`、`docker/uploads`、`docker/logs`，方便内网部署备份。
- `docker/.env.example` 提供内网运行配置模板，本地 `docker/.env` 已生成且被忽略。
- `docker compose config` 校验通过，新增 Docker 文本文件无 BOM。

### 需要继续验证

- 如果要让 Docker 使用 `3456`，需要先停止当前开发目录的 Node 服务；否则把 `docker/.env` 的 `HOST_PORT` 改成 `3457`。
- 真正启动容器前，需要把 `docker/.env` 中的 `JWT_SECRET` 和真实 Provider 配置改成内网生产值。

## 2026-07-03 图片工具面板窗口化复核

### 已确认

- 图片节点工具条已删除 `AI 智能消除` / `smartErase`，当前浏览器工具条文本为 `AI 扩图`、`格式/压缩`、`反推提示词`、`局部修改`、`图片尺寸调整`、`图片裁剪`、`添加到聊天`。
- `局部修改` 已从 pending 改为 ready；浏览器中点击后可打开 `局部修改` 面板，面板包含 `data-hjm-panel-window="true"` 和右下角缩放手柄。
- `.image-edit-overlay` 标题栏拖拽实测生效：格式/压缩面板从 `(1370,383)` 移动到 `(1270,453)`，未拖动画布节点。
- 右下角缩放实测生效：格式/压缩面板从约 `336x576` 放大到约 `427x647`，内容区 `overflow:auto`。
- 笔刷坐标已从屏幕坐标直减 rect 改为按 canvas 内部像素比例换算；50% 缩放下预览 canvas 内部 `215x183`、屏幕显示约 `135x114`，笔刷拖拽无运行时错误。
- 资产护栏和旧画布边界 smoke 已同步到 `20260703panel2` 并通过。

### 需要继续验证

- 自动化浏览器在 200% 缩放下能读取到预览 canvas 内部 `215x183`、屏幕显示约 `539x457` 的非 1:1 几何，但面板被放大到自动化可点击区域外，未能完成 200% 实笔刷落点截图；代码锚点和 50% 实测已覆盖偏移修复核心路径。
- 浏览器验收后当前画布缩放值停在 `90%`，测试面板已关闭；如需恢复到用户原先视图，可手动点一次缩小或刷新项目视图。

## 2026-07-03 首页历史画布卡片点击复核

### 已确认

- 根因是 `assets/home-carousel-inertia.js` 在 `pointerdown` 阶段立刻对 `.history-track` 调用 `setPointerCapture`，普通点击最终也会以轨道容器作为 click target，导致 `.history-card` 上的打开项目事件收不到。
- 修复后只有超过拖拽阈值并进入真实横向拖动时才捕获指针，普通点击保留原生目标并继续触发历史画布卡片的 Vue click。
- `index.html` 已把首页轮播脚本查询串升级为 `home-carousel-inertia.js?v=20260703open1`，避免继续加载旧拦截逻辑。

### 需要继续验证

- 用户当前浏览器需要刷新首页后再点历史画布卡片，确认能进入对应 `/canvas/<projectId>`。
- 本轮不改历史项目数据结构、不改旧 Canvas 主 bundle、不触发真实 Provider。

## 2026-07-03 局部修改提交节点复核

### 已确认

- `局部修改/文字编辑` 提交路径不再等待 `/api/image-tools/inpaint` 返回后才创建结果节点，而是先创建一个 `loading:true` 的图片节点。
- 该节点初始进度为 `18`，文案为 `已提交请求`，符合图2所示的生图节点提交态。
- 新增图片节点通过 `connect:false` 跳过 `imageOrder` 边创建，不会自动链接原图片节点或其它画布节点。
- 后台完成后只回填同一个新节点的图片 URL、缩略图、尺寸、`progress=100` 和错误状态，不新增第二个结果节点。
- 默认图片工具结果节点仍保留原连线行为，避免影响扩图、压缩、尺寸调整等既有链路。

### 需要继续验证

- 当前服务已配置真实 Provider，浏览器里实点 `提交` 可能触发真实外部调用和扣费；需要用户确认后再做端到端提交验收。
- 若后续要把其它图片工具也改成无连线提交态，应先明确每个工具的画布关系语义，不能直接全局关闭 helper 的默认连线。

## 2026-07-03 局部修改 mask 结果复核

### 已确认

- 用户实测结果里底部涂抹区域被明显重绘，说明前端 mask 字段并非完全丢失。
- 结果同时把瓶身标签文字洗掉，说明上游模型对“去掉文字”的理解越过了涂抹区边界，黑白 mask 对当前 Provider 约束不够稳。
- 前端现在会同时提交 `maskBase64` 和 `maskAlphaBase64`，其中 `maskAlphaBase64` 将涂抹区域转成透明编辑区，适配更多 OpenAI-compatible Images Edit 实现。
- 后端优先使用 `maskAlphaBase64`，保留旧 `maskBase64` 回退，避免破坏历史旧画布请求。
- 默认提示词已强化未涂抹区域保留，特别点名文字、品牌标识、瓶身标签和商品结构不要改。

### 需要继续验证

- 需要用户刷新画布加载 `20260703mask1` 后，再用更窄的 mask 重试；真实提交会触发 Provider 调用和可能扣费。
- 如果 `maskAlphaBase64` 后仍大幅改动未涂抹区域，下一步应记录一次上游响应与请求 meta，判断是 Provider 忽略 mask 还是 GPT Image 2 模型本身软约束问题。

## 2026-07-03 批量生图请求形态复核

### 已确认

- 截图中的 `4 张` 批量出图不是前端直接请求中转站，而是后端 `/api/generate/tasks` 或 `/api/template/generate-image` 进入 Provider 适配器。
- 纯生图和带参考图的图生图适配器都固定向上游发送单张请求：JSON 生图为 `n: 1`，multipart 图生图为 `form.append('n', '1')`。
- 高延迟根因更可能是旧实现串行等待：第 1 张返回后才发第 2 张，4 张会累加 4 次上游耗时。
- 已改为并发单张：最多 4 个独立请求同时发出，返回后按请求顺序合并图片，扣费和任务记录仍按用户选择的张数计算。
- 覆盖脚本已增加防回退断言，避免后续重新变成 `n=4` 单请求或串行 `for count`。

### 需要继续验证

- 本轮只跑 mock/disposable API 和静态请求形态护栏，没有主动触发真实中转付费调用。
- 真实环境如仍慢，下一步应记录每个独立请求的开始/结束时间和上游状态码，区分是中转并发限流、单张模型耗时，还是图片参考上传体积导致的慢。

## 2026-07-03 图片生成节点连续提交复核

### 已确认

- 截图对应的是旧画布 `ImagePromptGenerateNode`，此前按钮禁用和点击入口都绑定到同一个生成 composable 的 `loading`。
- 点击后结果进度节点已经会先创建，但原图片生成节点会因为 `loading=true` 被锁住，不能继续点击生成。
- 已移除原节点入口的 `if(r.value)return`，并把按钮禁用改成只看 `!Ce.value`，也就是只在没有提示词且没有参考图时禁用。
- 按钮文案不再被请求中的 spinner 替换；生成中的状态继续由右侧独立结果节点承载。
- 资源查询串升级到 `20260703freegen1`，旧页面需要刷新后才会拿到这版 Canvas bundle。

### 需要继续验证

- 未主动触发真实 Provider 生图；用户刷新画布后可在同一图片生成节点上连续点两次，预期会出现两批独立进度结果节点。
- 如果连续点击很多次，后端会同时接收多批真实任务，仍会按模型价格和张数扣算力；真实使用时需要留意余额和上游限流。

## 2026-07-03 图片 Provider 过载保护复核

### 已确认

- 上一版“并发单张”能避免 `n=4` 大请求，但会让 4 张批量或连续点击时同时向中转发出多次真实图片请求。
- 带参考图的图生图路径每次请求都会 multipart 上传参考图；并发 4 次会把同一批参考图重复同时上传到中转，容易造成高延迟或限流。
- `server.js` 已加入进程内全局图片 Provider 队列，文生图和图生图都必须排队进入真实上游请求。
- 默认相邻真实图片请求间隔为 `1500ms`，且可用环境变量调整；请求返回的 `request` meta 会带 `queueMode: serial-delayed` 和 `queueDelayMs`。
- 覆盖脚本已反向更新：现在禁止 `Promise.all(Array.from({ length: count }, async ...))` 的图片上游并发形态。

### 需要继续验证

- 本轮不触发真实中转扣费调用；需要用户刷新后用 `4 张` 小批量确认中转延迟是否下降。
- 如果仍过载，下一步优先把延迟从 `1500ms` 提高到 `3000ms` 或增加按线路/模型的队列状态日志。

## 2026-07-03 图片生成提示词识别复核

### 已确认

- 截图里的 `根据图1生成拼多多电商主图` 已进入前端请求体，旧画布节点会以 `prompt: de` 发送到 `/api/template/generate-image`。
- 本地最新 `generations` 记录里也能看到最终 prompt 包含 `用户需求：根据图1生成拼多多电商主图`，所以不是输入框内容丢失。
- 旧后端 prompt 对图生图过于强调“保持产品包装与识别信息一致”，对“必须执行用户目标”的约束不够强，容易让模型输出接近参考图的商品摆拍。
- 已增强 `buildEcommerceImagePrompt`：用户需求优先、参考图不得直接复刻、拼多多/PDD 自动补强为高点击正方形电商主图方向。

### 需要继续验证

- 未触发真实 Provider 重新生图；用户需要刷新后用相同提示词再试。
- 如果仍然只是复刻参考图，下一步应在请求 meta 中记录上游 request id 和最终 prompt，并尝试为“主图/海报/场景/标签”做更细的模板化 prompt 分支。

## 2026-07-03 图生图提示词松绑复核

### 已确认

- 上一版为了解决“拼多多主图不明显”加入的平台模板和失败判定过硬，可能限制图生图模型发挥。
- `server.js` 已删除 `ecommercePlatformPromptHint`，不再按 `拼多多/PDD` 自动补充高点击主图模板。
- 后端电商图生图 prompt 现在只保留基础约束：理解用户需求、参考图作为依据、画面清晰自然、避免水印/乱码/畸形。
- 护栏脚本已反向约束，禁止恢复 `用户提到拼多多/PDD`、`视觉执行要求`、`视为失败` 等强格式。

### 需要继续验证

- 未触发真实 Provider 扣费调用；用户刷新后再测试同一节点。
- 如果后续某些场景仍需要强提示词，应放到用户输入或模板配置里，而不是后端全局硬编码。

## 2026-07-03 图生图最小提示词复核

### 已确认

- 用户最终确认：后端只需要加一个 `专业电商设计师` 身份，不需要额外格式限制。
- 唯一保留的基础要求为：产品不要拉伸变形、文字清晰、不要出现光斑和乱码。
- `server.js` 已按该边界压缩提示词；请求仍会保留用户原始 `用户需求`。
- 护栏脚本已禁止回退到 `自由完成画面创作`、`适合电商展示`、平台识别和其它长提示词。

### 需要继续验证

- 未触发真实 Provider 扣费调用；重启后端后生效。

## 2026-07-03 图片上传节点单击/双击交互复核

### 已确认

- 空图片上传节点之前用透明 `input[type=file]` 覆盖整块上传区域，导致单击节点主体会直接打开文件选择器。
- 两个旧 Canvas bundle 已把该图片 file input 改为隐藏输入框，并把触发文件选择器的动作迁移到上传区域 `dblclick`。
- 单击空图片节点时不再由 file input 截获点击，预期由 Vue Flow 执行节点选中。
- 资产护栏脚本已要求双击触发逻辑存在，并禁止图片节点回退到透明覆盖式 file input。

### 需要继续验证

- 用户在当前画布里实测：单击空图片节点应只出现选中边框，双击上传区域才弹出文件选择器。
- 本轮未修改视频上传节点，它仍保留原来的点击上传行为。

## 2026-07-03 Docker 内网测试目录复核

### 已确认

- `docker/` 目录已作为内网运行目录整理：Compose 从 `F:\dianshang` 构建镜像，运行数据挂载到 `docker/data`、`docker/uploads`、`docker/logs`。
- `docker/docker-compose.yml` 已包含最新图片 Provider 队列相关变量：`IMAGE_PROVIDER_TIMEOUT_MS`、`CANVAS_DIALOG_ANALYSIS_TIMEOUT_MS`、`IMAGE_PROVIDER_REQUEST_DELAY_MS`。
- `docker/verify-internal.ps1` 已加入 Docker daemon 前置检查、Compose 配置检查、健康检查、API smoke、前端路由 smoke 和 Provider guard smoke。
- `.dockerignore` 已排除 `docker/.env` 和 Docker 运行数据目录，避免密钥/SQLite/uploads/logs 进入镜像上下文。
- 静态验证通过：PowerShell 解析通过，`docker compose config` 通过，`git diff --check` 无空白错误。

### 需要继续验证

- 当前机器 Docker Desktop Linux Engine 未运行，实际 `docker compose up --build -d` 未执行成功。
- `com.docker.service` 当前会话无权限启动；需要用户手动启动 Docker Desktop 或用管理员权限启动 Docker 服务后，再执行 `powershell -NoProfile -ExecutionPolicy Bypass -File "F:\dianshang\docker\verify-internal.ps1"`。
- 长期内网试运行前必须替换 `docker/.env` 中的 `JWT_SECRET` 占位值；`ENABLE_REAL_PAYMENT` 继续保持 `false`。

### 复测结果

- Docker Engine 后续恢复可用后，已用 `HOST_PORT=3458` 成功执行 `docker/verify-internal.ps1`。
- 容器 `dianshang-internal-app` 已启动并进入 `healthy`，访问地址为 `http://127.0.0.1:3458`。
- 已通过健康检查、API smoke、前端路由 smoke 和 Provider guard smoke；当前运行模式为 `mock`，未启用真实 AI、邮件、支付或对象存储。

## 2026-07-03 Docker 生产态保存方式复核

### 已确认

- 旧画布本地 JSON 自动保存依赖浏览器文件夹写入授权；Docker/Node 后端无法替浏览器授权。
- 内网 HTTP 生产地址下，本地文件夹保存很可能不可用；`localhost` 或 HTTPS 才是浏览器支持这类 API 的稳定环境。
- 旧画布云端保存实际发送 `{ title, workflowJson }` 到 `/api/workflows/:id/save-json`。
- 后端已兼容 `workflowJson` 并在读取项目时解包，云端 JSON 会落到 Docker 挂载的 SQLite `DB_PATH=/app/data/data.db`。
- API smoke 已补充 `workflowJson` 覆盖，避免后续只测 `data` 包装而漏掉旧画布真实请求体。

### 需要继续验证

- 本轮未直接重启现有生产 Docker 容器，避免影响当前业务会话。
- 确认可重启后，需要重新执行 `powershell -NoProfile -ExecutionPolicy Bypass -File "F:\dianshang\docker\verify-internal.ps1"` 并在画布里点一次“云端自动保存/立即保存”。

## 2026-07-03 注册与工作流本地保存复核

### 已确认

- 注册后端默认允许不带验证码直接创建用户；只有显式设置 `REQUIRE_REGISTER_EMAIL_CODE=true` 才恢复验证码校验。
- 新注册用户默认余额为 0；积分获取路径改为兑换码，smoke 会创建一次性兑换码并用新用户兑换后再测扣费生图。
- `save-json`、`save-local-json` 和 `local-json` 共用同一套工作流 JSON 归一化逻辑，旧画布的 `workflowJson` 请求体会直接保存为包含 `nodes/edges/viewport/storage` 的 JSON。
- Docker Compose 显式挂载 `WORKFLOW_DIR=/app/data/workflows`，文件不会写进镜像层，主机侧可在 `docker/data/workflows/<userId>/` 查看。
- 旧画布本地文件夹保存失败时会降级调用云端保存接口，并把面板状态标成服务器本地 workflows。

### 需要继续验证

- 当前已修改代码但未重启正在运行的 Docker 容器；容器继续跑旧镜像时不会有直注册和本地 JSON 文件兜底。
- 浏览器 File System Access API 仍只在安全上下文稳定可用；HTTP 内网地址下应以服务器本地 workflows 目录作为生产兜底。

## 2026-07-04 内网画布手动保存复核

### 已确认

- 已进入当前内网页面项目 `project_1783129273163_lcuac0uat` 并打开顶部保存面板。
- 初次点击 `立即保存` 时页面日志显示 `/api/workflows/:id/save-json` 返回 401，原因是当前内网页面没有登录态。
- 写入 Docker 测试环境默认 `admin` 登录态后再次点击 `立即保存`，后端保存成功。
- Docker 数据库 `F:\dianshang\docker\data\data.db` 中存在项目 `project_1783129273163_lcuac0uat`，保存内容为 `version=1`、`saveType=cloud`、2 个节点、1 条连线。
- 主机侧 workflow 文件已落到 `F:\dianshang\docker\data\workflows\user_mr4r2o2h88a7cdbe\project_1783129273163_lcuac0uat.workflow.json`，文件根层同样包含 2 个节点和 1 条连线。

### 需要继续验证

- 当前保存使用的是 Docker 测试管理员账号；后续其他电脑正式使用前，需要每个用户先登录，或者补充更清晰的未登录提示与登录引导。
- 首页目前仍没有独立的云端手动保存入口；手动保存入口在画布顶部 `保存` 面板内。

## 2026-07-04 注册与找回密码复核

### 已确认

- 当前代码下 `/api/auth/register` 不再要求注册邮箱验证码；必填项只有用户名、邮箱和密码，缺字段时返回 `请填写用户名、邮箱和密码`。
- 旧注册弹窗通过 `assets/auth-direct-register-bridge.js` 隐藏并禁用注册验证码字段，同时增加内网免验证码提示和提交前空字段检查。
- `/api/auth/send-reset-code` 在 mock 邮件模式下返回 `code`，页面可以拿到测试验证码；真实邮件模式 `ENABLE_REAL_EMAIL=true` 时仍不应暴露验证码。
- `scripts/smoke-api.ps1` 已覆盖找回密码闭环：临时用户注册后发重置验证码、重置密码、用新密码登录。
- 已执行 `scripts/smoke-api-disposable.ps1`，临时后端和临时数据库下注册、找回密码、登录、项目保存、生图 mock 和后台 smoke 均通过。

### 需要继续验证

- 当前 `192.168.0.39:3456` Docker 容器尚未重建；用户确认重启后才能在内网页面看到新提示和 mock 重置验证码。
- 真实邮件发送仍未接 SMTP；生产正式使用前需要配置真实邮件服务或保留内网 mock 验证码策略。

## 2026-07-04 Docker 注册重启复测

### 已确认

- 已执行 `docker compose up --build -d`，镜像 `dianshang-internal-app:latest` 重新构建，容器 `dianshang-internal-app` 启动后为 `healthy`。
- 内网接口 `http://192.168.0.39:3456/api/health` 返回数据库正常。
- 通过内网接口直接注册一次性测试账号，注册响应包含 token；随后用同一账号密码登录成功，并能读取 `/api/user/profile`。
- 浏览器注册页 `/register` 已显示“当前内网注册无需邮箱验证码”提示。
- 复测时发现旧桥接脚本会把邮箱输入框误隐藏；已修正为只隐藏真正的验证码框，并更新 `index.html` 脚本版本号以刷新缓存。
- 修正后已再次重建 Docker；容器返回的新脚本已确认不再包含验证码 placeholder 宽匹配，且包含 `type === 'email'` / `autocomplete === 'email'` 排除逻辑。
- 最终容器状态：`dianshang-internal-app` 为 `healthy`，端口映射 `0.0.0.0:3456->3456/tcp`。

### 需要继续验证

- 本轮不会清理 Docker SQLite 中的一次性注册测试用户；如后续需要清理，可在管理员后台或数据库维护时统一处理。
- 内置浏览器自动化在后续 DOM 读取时多次超时；页面最终点击可由用户在当前浏览器手动确认，接口与容器脚本验证已经通过。

## 2026-07-04 Docker 真实 API 配置复核

### 已确认

- Docker 端原先 `ENABLE_REAL_AI=false`，且 `NEW_API_BASE`、`NEW_API_KEY`、`AI_API_BASE`、`AI_IMAGE_KEY`、`AI_TEXT_KEY` 多为占位值，因此实际生图处于 mock。
- 根目录 `F:\dianshang\.env` 中存在可用的原 Packy API 配置；Docker Compose 实际读取的是 `F:\dianshang\docker\.env`。
- 已备份 Docker `.env`，并将生产测试端切为 `AI_PROVIDER_GATEWAY=direct`，使用 `https://www.packyapi.com/v1` 和原有图片/文本 key。
- 已执行 `docker compose up -d --force-recreate`；容器 `dianshang-internal-app` 为 `healthy`。
- `/api/health` 确认 `providers.ai.mode=real-provider-ready`、`enabled=true`、`gateway=direct`、`imageKeyConfigured=true`、`textKeyConfigured=true`。

### 需要继续验证

- 本轮只验证环境变量和 Provider 状态，未主动发起真实生图，避免产生不必要的真实 API 消耗。
- 真实生图首测建议使用小尺寸、1 张图和明确测试提示词，便于确认扣费、日志、生成记录和错误回显。

## 2026-07-04 未登录强制登录复核

### 已确认

- 旧用户中心 bundle 硬编码了 `guest / guest@erdan.ai` 作为 `auth_user` 缺失时的兜底展示，这是截图中默认账号的来源。
- 已将两个用户中心 bundle 的兜底文案改为 `未登录 / 请先登录或注册`，避免即使守卫加载延迟时仍显示默认账号。
- 已在全站加载的 `user-center-data-bridge.js` 中加入受保护路由守卫；未登录进入用户中心、画布、图库、模板等功能页会跳转登录页。
- 强制登录页会隐藏关闭按钮和返回首页按钮，并拦截取消点击与 `Escape`。
- 已重建 Docker；HTTP 资源验证确认首页加载 `user-center-data-bridge.js?v=20260704authguard1`，守卫脚本包含 `isProtectedPath` 和 `uc-auth-forced`，用户中心 bundle 不再包含 `guest@erdan.ai`。
- 重建后 `/api/health` 仍为 `real-provider-ready`，真实 API 配置未被覆盖。

### 需要继续验证

- 需要在用户当前浏览器手动退出登录并访问 `/user/center`、`/canvas/...` 做最终交互确认；本轮未主动清理当前浏览器登录态。
- 当前保护仍在旧资产过渡层，未来源码路由全面接管后需要迁移为正式前端路由守卫。

## 2026-07-04 首页云端保存入口复核

### 已确认

- 首页保存面板的 `立即保存` 在云端模式下原先只显示提示，没有跳转动作。
- 已改为优先读取 `ai-canvas-last-project-id` / `ai-canvas-new-project-id`，其次取首页项目列表第一项，进入对应 `/canvas/:id`。
- 若没有任何可用项目，则调用首页现有新建画布逻辑进入新画布。
- 进入画布后通过 toast 提醒用户在画布顶部保存面板点击 `立即保存`。
- 已执行 Docker 重建，容器 `dianshang-internal-app` 为 `healthy`；`/api/health` 确认真实 API 仍为 `real-provider-ready`。
- HTTP 资源验证确认旧文案 `主页暂无云端手动保存入口` 已移除，并包含进入画布/新建画布后的保存提示。

### 需要继续验证

- 需要在用户当前浏览器手动选择云端自动保存并点击 `立即保存`，确认页面实际跳转符合预期；本轮未触发真实生图。

## 2026-07-04 后台登录统一复核

### 已确认

- `/admin/login` 实际由源码后台 `frontend/dist` 提供，截图中的“旧后台”是迁移期遗留文案，不是当前目标架构。
- `AdminLoginSource.vue` 已移除 `legacyUrl` 和“旧版后台登录 / 旧版后台控制台”链接。
- 管理员登录成功后改为直接 `router.replace()` 到 `redirect` 指向的后台页；没有 redirect 时进入 `/admin/dashboard`。
- 已登录管理员访问 `/admin/login` 会自动进入后台控制台，避免停留在登录页。
- `smoke-source-frontend-ui-runner.js` 已同步为验证后台登录后进入 `/admin/dashboard`。
- Docker 重建后容器 `dianshang-internal-app` 为 `healthy`；`/api/health` 仍为 `real-provider-ready`，真实 API 配置未被覆盖。
- HTTP 资源验证确认容器侧新登录资源旧文案已移除，且包含 `/admin/dashboard` 跳转逻辑。

### 需要继续验证

- 需要用户当前浏览器 `Ctrl + F5` 后手动登录一次，确认实际跳转到 `/admin/settings` 或 `/admin/dashboard`；本轮未运行 Playwright 自动点击，避免触发新工具下载。

## 2026-07-04 兑换码与系统设置复核

### 已确认

- 兑换码页此前明确写着“只读迁移版”，没有创建表单，这是“兑换码没添加兑换码”的直接原因。
- 后端兑换码创建和删除接口已存在，前端已补 `createAdminRedeemCode` 与 `deleteAdminRedeemCode` 封装。
- 兑换码管理页已新增创建表单，支持兑换码、算力额度、可兑换次数、启用状态；列表项支持删除。
- 已用一次性测试码验证后端创建、查询、删除闭环，删除后测试码不残留。
- 系统设置接口响应约 7ms，后端不是卡死来源。
- 系统设置页的 computed 已改为纯读取，不再在渲染计算中写入 `draft.value.ecommerceSuiteAgent`。
- 前端构建、源码路由检查通过；Docker 已重建，容器为 `healthy`，真实 API 状态未被覆盖。

### 需要继续验证

- 需要用户当前浏览器 `Ctrl + F5` 后手动打开 `/admin/redeem-codes` 新增一个业务兑换码，并点击 `/admin/settings` 确认不再卡死。

## 2026-07-04 内网测试生产收口复核

### 已确认

- 当前架构定位为单机 Docker 内网测试生产，后端唯一入口仍是 `server.js`。
- 已增加生产模式强 `JWT_SECRET` 校验，避免 Docker 默认占位 secret 被用于准生产。
- 已增加 bootstrap 管理员环境变量，服务不再每次启动重置 `admin/admin123`。
- 已增加 `CORS_ORIGINS` 白名单配置，支持内网来源收口。
- 已新增内网备份脚本和 smoke 脚本；smoke 不触发真实生图。
- 已新增 `docs/internal-production-runbook.md`，记录发布、备份、恢复和当前能力边界。
- 已发现并修复密码哈希与 `JWT_SECRET` 耦合造成的迁移问题：通过 `PASSWORD_LEGACY_SECRETS` 兼容旧哈希，登录后自动重哈希；默认 `admin/admin123` 已迁移到 bootstrap 强密码。
- 已完成 Docker 重建，容器 `dianshang-internal-app` 为 `healthy`；`/api/health` 确认真实 AI 为 `real-provider-ready`，邮件/支付/对象存储关闭。
- 已完成 `scripts/smoke-internal-prod.ps1`，覆盖健康检查、管理员登录、后台设置、兑换码一次性创建/查询/删除、前台旧资产和后台源码资产访问。
- 已完成 `scripts/backup-internal-prod.ps1` 备份，生成 `F:\dianshang\docker\backup\internal-prod-20260704-131428`。
- 已恢复演练到临时目录 `F:\dianshang\docker\backup\restore-check-20260704-131452`，备份 SQLite `integrity_check=ok`。

### 剩余风险

- 当前仍是单机 Docker + SQLite 内网测试生产，不具备公网正式生产等级。
- 本轮未触发真实生图，避免 API 消耗；真实 AI 首测仍需单独用低成本参数验证扣费、记录和错误回显。
- 邮件、支付、对象存储仍为关闭状态；进入正式生产前必须补齐对应方案。

## 2026-07-04 工作台品牌文案替换复核

### 已确认

- 根入口浏览器标题已由 `二蛋` 改为 `爱泊缇 AI 工作台`。
- 源码后台入口标题已由 `哈吉米 AI 工作台` 改为 `爱泊缇 AI 工作台`，并已重新构建 `frontend/dist`。
- 后端默认后台设置 `siteName` 已改为 `爱泊缇 AI 工作台`。
- 当前 Docker 数据库已有 `admin.settings.siteName` 已单字段迁移为 `爱泊缇 AI 工作台`。
- 旧前台 i18n 登录/注册标题已改为 `登录爱泊缇 AI 工作台` 与 `注册爱泊缇 AI 工作台`。
- Docker 重建后容器为 `healthy`；HTTP 验证确认 `/`、`/admin/login` 和旧前台 i18n 资源均返回新品牌文案。

### 剩余风险

- 历史文档、历史进度记录和模型线路名里仍可能保留 `哈吉米/哈基米` 作为历史上下文或旧线路名称，本轮未批量改写历史记录。

## 2026-07-04 前台登录与后台登录隔离复核

### 已确认

- 前台登录 `/login` 调用 `/api/auth/login`，后台登录 `/admin/login` 调用 `/api/admin/login`，接口入口已保持分离。
- `/api/auth/login` 已拒绝管理员账号，防止普通前台登录保存管理员身份到用户会话。
- 源码后台登录成功后保存到 `admin_auth_token` / `admin_auth_user`，不再覆盖普通前台的 `auth_token` / `auth_user`。
- HTTP 拦截器已按 `/api/admin/*` 路径选择管理员 token，其余接口继续选择普通用户 token。
- 后台页面退出按钮已改为清理 `clearAdminAuthSession()`，不再清掉普通用户登录态。
- 前台和后台源码登录页均已移除 `填入默认账号`、`admin123` 和未登录直达控制台入口。
- 已重新构建 `frontend/dist` 并重建 Docker；容器 `healthy`。
- 验证确认普通登录管理员账号返回 403，后台登录管理员账号成功；内网 smoke 脚本通过。

### 剩余风险

- 这次改变了浏览器会话键，已经登录的管理员旧 `auth_token` 不会再作为后台 token 使用，需要重新从 `/admin/login` 登录一次。

## 2026-07-04 兑换码新增区 UI 可读性复核

### 已确认

- 截图问题来自新增兑换码表单在超宽屏下整行铺开，兑换码、额度、次数、启用和按钮距离过远，输入框边界不明显。
- 已将新增表单改为最大宽度 1040px 的紧凑栅格，整体加浅色底和边框，避免字段散到整屏。
- 已提高 label 文字对比度，并给输入框和数字输入框设置可见边框、白底和焦点态。
- 已把启用开关放入独立白底边框块，避免漂在空白区域。
- 已重新构建 `frontend/dist` 并重建 Docker；运行 CSS 包包含新样式。
- 内网 smoke 已通过，兑换码创建、查询、删除接口未受影响。

### 剩余风险

- 用户当前浏览器可能缓存旧 CSS，需要对 `/admin/redeem-codes` 执行 `Ctrl + F5` 后查看新版布局。

## 2026-07-04 后台旧管理员 token 自动迁移复核

### 已确认

- 后台登录态拆分后，旧浏览器中只有 `auth_token` / `auth_user`，没有 `admin_auth_token` / `admin_auth_user`，因此 `/admin/login` 不会自动跳转。
- 已增加兼容迁移：仅当旧 `auth_user.role` 为 `admin` 且存在旧 `auth_token` 时，才复制为后台专用 token。
- 普通用户 token 不会迁移到后台会话，仍不能进入后台。
- `/admin/login` 页面加载时会先尝试迁移；成功后直接进入 redirect 指向的后台页或 `/admin/dashboard`。
- 已重新构建 `frontend/dist` 并重建 Docker；运行 bundle 已包含兼容迁移逻辑。
- 内网 smoke 已通过，后台设置和兑换码 CRUD 正常。

### 剩余风险

- 如果浏览器里旧 token 已过期或 `auth_user` 被清空，仍需要重新在 `/admin/login` 登录一次。

## 2026-07-04 后台系统唯一化复核

### 已确认

- `/admin` 之前没有进入源码后台 fallback，会落到根旧前台 SPA；现在 `server.js` 统一用 `/admin` 前缀规则分发到 `frontend/dist/index.html`。
- 根入口不再加载 `admin-api-source-route-bridge.js`、`admin-api-form-labels.js`、`admin-visual-polish.css`。
- 根旧前台主包中旧 `/admin/login`、`/admin` 路由块已移除，旧后台懒加载 chunk 名称已替换为 tombstone。
- 根 `assets/` 下旧后台 UI chunk 已删除，当前只剩 `admin-source-only-guard.js`、`admin-removed.js`、`admin-removed.css` 这三个后台收口辅助文件。
- `node --check`、源码后台构建、源码路由检查和 `git diff --check` 均通过。

### 剩余风险

- 当前运行中的 Docker 容器还未在本轮重建；浏览器实际看到的新分发规则需要下一次 `docker compose up --build -d` 后生效。
- 已经打开的旧前台页面可能仍持有旧 JS 内存状态，部署后建议刷新页面再进入 `/admin`。

## 2026-07-04 注册页邮箱必填提示复核

### 已确认

- 截图中的注册表单用户名和密码已填写，但邮箱为空；当前后端注册接口仍要求邮箱，因此拦截是符合现有账号契约的。
- 旧文案“无需邮箱验证码”和邮箱占位“接收验证码”组合在一起会误导用户，以为邮箱也不用填。
- 旧前台桥接脚本已把提示改为“验证码不用，邮箱仍必填”，并把邮箱占位改成找回密码用途。
- 旧前台桥接脚本已对 warning 做 1.8 秒去重，并在拦截时调用 `stopImmediatePropagation()`，减少重复提交和重复 toast。
- 源码注册页已增加前端必填校验，不会再直接把空邮箱提交到后端。
- 后端 `/api/auth/register` 缺字段文案已同步说明“当前内网注册无需邮箱验证码”。
- 构建、路由检查、JS 语法检查和 diff 检查均通过。

### 剩余风险

- 邮箱仍是必填字段；如果后续要完全取消邮箱，需要调整数据库唯一约束、找回密码流程和注册 API 契约，不能只改前端。
- 当前 Docker 容器未在本轮重建；上线到内网后需要强刷注册页，避免浏览器继续使用旧 bridge 缓存。

## 2026-07-04 图生图提示词轻框架复核

### 已确认

- 用户明确要求只改图生图提示词，不改纯文生图。
- `buildEcommerceImagePrompt()` 已按参考图数量分支：无参考图时保持旧提示词结构；有参考图时才启用 Prompt Planner 轻框架。
- 新框架重点处理图序角色：排版、风格、配色、桌子/背景/道具、产品、标签、文案等参考来源不互相污染。
- 普通生成任务、模板生图、画布对话 Agent、套图 Agent、局部编辑/扩图工具的图生图路径已接入。
- 已热更新并重启 `dianshang-internal-app`，容器健康检查和 `/api/health` 正常。
- 本轮只做语法、健康和关键字符串验证，没有发起真实生图请求。

### 剩余风险

- 轻框架的真实效果需要用生产端图生图样例观察，尤其是多图复杂引用和贴标类任务。
- 本轮容器为热拷贝更新；如果后续重新创建容器，需确保使用当前工作区源码构建。

## 2026-07-04 参考图缩略图字段兼容复核

### 已确认

- 截图中参考图按钮、编号和占位图标都已渲染，说明 UI 样式和按钮结构存在，问题集中在预览地址没有从图像对象中取到。
- 旧逻辑只读取 `preview`、`dataUrl`、`url`，无法覆盖生成结果、历史图、画布节点或上传对象里常见的 `imageUrl`、`originalUrl`、`thumbnailUrl`、`thumbUrl`、`src`、`uploadedUrl` 字段。
- 已扩展 `suiteImagePreview()` 的字段识别范围，参考图按钮和聊天卡片复用同一预览逻辑。
- 已同步扩展 `suiteImageToPayload()`，把可用 URL 继续写入 `url`、`imageUrl` 和 `originalUrl`，避免缩略图显示正常但生图请求缺参考图。
- 已热拷贝静态脚本到 `dianshang-internal-app`，容器保持 `healthy`，没有触发真实生图。
- 本地脚本语法检查、容器内脚本语法检查和线上资产字段命中检查均通过。

### 剩余风险

- 浏览器可能缓存旧 `canvas-chat-prompt-flow.js`；需要对生产端页面强刷后再确认缩略图。
- 本轮没有真实上传多来源图片逐项回归，若还有特殊字段名，需要按实际对象继续补兼容映射。

## 2026-07-04 画布图片闪烁复核

### 已确认

- 闪烁链路不是后端生图造成，本轮没有触发真实生图；问题集中在画布前端辅助脚本的 DOM 观察和图片加载策略。
- `canvas-performance-mode.js` 在滚轮、拖拽、触摸移动时会切换 `canvas-performance-active` 等 `html/body` class。
- `canvas-image-node-polish.js` 旧观察器监听全站 class/title 变化，遇到 `html/body` 或普通画布节点 class 抖动时也会调度扫描，容易造成画布图片节点反复测量和重打标。
- `canvas-chat-prompt-flow.js` 旧观察器监听全站 class 变化，非聊天面板的画布节点变化也会回落到 `getPanel()` 并刷新聊天面板，增加交互期间 DOM 压力。
- 已将画布节点图片设为 eager，保留普通非画布图片 lazy；同时避免对已有图片源改写 `referrerPolicy`。
- 两个观察器已收窄到相关 DOM：图片节点美化只看图片节点、标题锁定和图片工具面板；聊天提示词只看 `.canvas-chat-panel` 及其子树，并做 80ms 节流。
- `index.html` 已更新脚本 query 版本，容器内和 HTTP 线上资产均已命中新代码；容器健康检查正常。

### 剩余风险

- 本轮没有浏览器自动化录屏验证，因为当前仓库未安装 Playwright，且没有新增依赖确认。
- 如果用户强刷后仍看到闪烁，需要进一步在浏览器 DevTools 里确认是否是 Vue Flow 主包反复卸载图片节点，或远程图片服务本身响应慢导致重绘。

## 2026-07-04 图片生成节点输入框卡顿复核

### 已确认

- 卡顿发生在旧画布 `ImagePromptGenerateNode` 的提示词 textarea，不是聊天面板输入框。
- 旧逻辑中 textarea 的 `onInput` 每个字符都会执行 `lt(t.id,{prompt:l.value})`，直接更新 Vue Flow 节点数据。
- 节点数据更新会推动父级节点数组变化、节点重渲染、自动保存调度和样式重算；截图节点还带两张参考图，输入期间的重绘成本更高。
- 已将 prompt 写回节点数据改为 220ms 防抖，用户输入时只更新本地 textarea 状态，停顿后再同步到节点数据。
- 组件卸载时会清理防抖定时器并 flush 当前 prompt，降低离开页面时丢最后输入的风险。
- 已更新入口和 Canvas 动态 import query，生产端拉取的新 Canvas 包包含 `promptSaveTimer=setTimeout`，旧立即写节点片段已不存在。
- 容器内 JS 语法检查、HTTP 线上资产命中和健康检查均通过，没有触发真实生图。

### 剩余风险

- 本轮未使用浏览器录屏或 Performance 面板实测输入帧率；仍需用户在生产端强刷后实际输入验证。
- 如果仍卡，需要继续拆旧 Canvas 主包里的自动保存、参考图缩略图渲染和复杂 CSS `:has()` 样式重算。

## 2026-07-04 旧画布拖拽延迟性能评审

### 已确认

- 本轮未修改生产画布代码，只做性能链路审计。
- `assets/canvas-performance-mode.js` 在 `pointermove` 捕获阶段会对画布目标执行 `closest()` 判断，并持续调用 `setActive()` 维护拖拽态。
- `assets/canvas-performance-mode.css` 的拖拽态样式作用面过大，包含 `.canvas-chat-panel *`、`aside[class*="absolute"] *`、`section[class*="absolute"] *`，且在 `html` class 切换时触发较大范围级联重算。
- 同一 CSS 中 `.vue-flow__node:has(...)` 选择器在节点 class 频繁变化时有潜在样式匹配成本，尤其是图片节点、选中态和工具栏出现时。
- `assets/canvas-chat-prompt-flow.js` 仍在 `document.documentElement` 上监听 class/childList 变化，虽然有相关性过滤，但 `html/body` 或包含聊天面板的根节点变化仍可能调度聊天面板刷新。
- `assets/canvas-image-node-polish.js` 仍监听全站 class/title 变化，图片节点拖动、选中、标题状态变化时可能触发图片打标扫描。
- 旧 Canvas 主包中图片节点可见性计算依赖全局节点数组查找当前节点；图片节点越多，拖拽或视口变化时的重复计算越重。
- 框选逻辑在 `pointermove` 中读取所有节点 DOM 的 `getBoundingClientRect()`；普通拖单个节点不是主因，但框选会明显吃性能。
- 历史栈 `Io()` / `qo()` 会完整 JSON 克隆节点和边；批量复制、Alt 拖拽、撤销记录会随节点数量增长而卡顿。

### 建议

- P0：先把 `canvas-performance-mode.js` 的 `pointermove` 激活改成 RAF 节流或只在 `pointerdown/pointerup` 切换状态，避免拖拽热路径反复跑全局逻辑。
- P0：缩小 `canvas-performance-mode.css` 拖拽态选择器范围，去掉 `aside[class*="absolute"] *`、`section[class*="absolute"] *` 这类全局后代选择器，优先只作用旧画布必要面板。
- P1：用显式 class 替代 `.vue-flow__node:has(...)`，减少节点状态变化时的 CSS 匹配成本。
- P1：拖拽活跃时暂停或延后 `canvas-chat-prompt-flow.js`、`canvas-image-node-polish.js` 的观察器刷新。
- P2：重做图片节点可见性判断，避免每个图片节点都扫描全局节点数组；框选扫描改为 RAF 节流。

## 2026-07-04 Docker 生产测试容器重启复核

### 已确认

- 已重启现有 `dianshang-internal-app` 容器，容器状态恢复为 `running healthy`。
- `/api/health` 返回正常，数据库路径、上传目录、日志目录和 workflows 目录均可用。
- 当前服务仍处于 `real-provider-ready`，本轮没有调用生图接口，也没有触发扣费。
- `/canvas` 返回页面仍加载 `index-DglIsp_g.js?v=20260704inputlag1`，并保留 `canvas-performance-mode.js?v=20260704flicker1` 等画布辅助脚本版本。
- 线上 Canvas 包仍包含 `promptSaveTimer=setTimeout`，旧的 `T=()=>{lt(t.id,{prompt:l.value})}` 立即写回逻辑未恢复。

### 剩余风险

- 本轮是 `docker restart`，不是镜像重建；如果未来从镜像重新拉起容器，需要再次确认工作区源码和镜像内容一致。

## 2026-07-04 后台根入口跳转复核

### 已确认

- 旧后台资产仍然是清理状态，本轮问题不是旧后台入口残留。
- 服务端 `/admin` fallback 已指向源码后台 `frontend/dist/index.html`，服务端路径不是根因。
- 源码 Vue Router 原先没有 `/admin` 根路由，导致访问 `/admin` 命中 `/:pathMatch(.*)*` 并跳回 `/` 首页。
- 已新增 `/admin -> /admin/login` 重定向，并纳入源码路由维护清单。
- 已给内网准生产 smoke 增加 `/admin` 根入口资源检查，避免只测 `/admin/login` 漏掉根入口。
- 容器已重新构建并强制重建，当前 3456 服务为 `healthy`；Chrome headless 实测 `/admin` 渲染后台登录页。

### 剩余风险

- 浏览器里已经打开的旧后台页面可能保留旧 JS 内存状态；部署后需要强刷或重新打开 `/admin`。

## 2026-07-04 首页云端保存入口 chunk 同步复核

### 已确认

- 截图中的提示来自旧首页资产里的固定 toast 文案：“主页暂无云端手动保存入口，请进入画布保存当前工作流”。
- 当前 `index.html` 加载的是 `assets/index-DglIsp_g.js`，该入口动态导入 `assets/HomeIndex-DAjDt0aj.js`；之前已修复的同类逻辑位于另一份 `assets/HomeIndex-BtiJ9toc.js`，因此重建容器后仍可能命中未同步的旧逻辑。
- 已将 `HomeIndex-DAjDt0aj.js` 与 `HomeIndex-BtiJ9toc.js` 的云端“立即保存”行为对齐：有最近项目时进入对应画布，没有最近项目时新建画布，并提示用户在画布顶部保存面板保存。
- 已将 `index.html` 与 `assets/index-DglIsp_g.js` 的缓存 query 更新为 `20260704homesave1`。
- 本地检查确认当前活跃入口和两份首页 chunk 均不再包含“主页暂无云端手动保存入口”旧提示。
- 已完整重建并强制重建 Docker app 容器，当前 3456 服务为 `healthy`，不是只热拷或只重启。
- 线上 HTTP 复核确认首页 HTML、入口 JS、`HomeIndex-DAjDt0aj.js` 均命中 `20260704homesave1`，旧提示文案在线上 chunk 中不存在。

### 剩余风险

- 浏览器或代理可能缓存旧 `HomeIndex-DAjDt0aj.js`；部署后建议对 `http://192.168.0.39:3456/` 强刷再点“立即保存”。

## 2026-07-04 生产单系统静态资源隔离复核

### 已确认

- 当前首页唯一生产入口为 `index-DglIsp_g.js?v=20260704homesave1`，真实动态 import 和 Vite 预加载表都已指向 `HomeIndex-DAjDt0aj.js?v=20260704homesave1`。
- `server.js` 已移除整目录静态暴露，不再用 `express.static(__dirname)` 作为生产静态入口。
- 生产静态资源只显式开放 `public`、根 `assets`、源码后台 `frontend/dist/assets`、`videos` 与 `uploads`。
- 旧生产入口链路已服务端隔离：`index-ZrBcanD1.js`、`HomeIndex-BtiJ9toc.js`、旧后台 `AdminLayout-BHNDJhhH.js` 均返回 410。
- 未知 `/assets/not-a-production-asset.js` 返回 404，不再 fallback 成首页 HTML。
- `/server.js` 不再暴露 Node 源码内容。
- 增强后的内网准生产 smoke 已覆盖以上隔离检查并通过；当前 Docker 容器为强制重建后的 `healthy` 状态。

### 剩余风险

- 历史文件仍保留在工作区，当前通过服务端隔离避免生产命中；如后续需要物理删除，应先基于访问日志或引用图再做归档删除。

## 2026-07-04 main 与 Docker 生产端同步规则复核

### 已确认

- `AGENTS.md` 已新增生产端同步规则，明确 `F:\dianshang` 是生产修复的唯一源码基线。
- 规则已禁止只在 Docker 容器内热修、只拷贝容器文件或只改旧参考目录后声称完成。
- 规则已要求影响线上行为的改动必须执行 `docker compose -f "F:\dianshang\docker\docker-compose.yml" up -d --build --force-recreate app`。
- 规则已要求 Docker 重建后确认容器 `healthy`，并记录镜像 ID、镜像创建时间、容器启动时间或等价信息。
- 规则已要求生产验收直接请求 `http://192.168.0.39:3456/` 或相关线上路径，确认实际 HTML、入口 JS、chunk query、API 或目标行为命中新版本。
- 规则已覆盖旧入口、旧 chunk、旧后台包和静态资源隔离检查，要求用 410/404 等状态避免旧系统再次被拉起。

### 剩余风险

- 这是协作纪律规则更新，不会自动改写历史未提交状态；后续每次生产修复仍需按规则执行验证和汇报。

## 2026-07-04 进入画布旧节点自动刷新复核

### 已确认

- 当前生产入口只使用 `Canvas-B8bY9_QL.js`，旧 `Canvas-yGc8b2gf.js` 已被生产静态隔离，本轮只修当前活跃 Canvas 包。
- 旧 Canvas 包中 Vue Flow 使用 `key: qe.value` 支持强制重挂，但原逻辑只在 `kl()` 开始加载项目时更新 key，节点数组和边数组加载完成后没有再次更新。
- 已新增 `refreshCanvasAfterProjectLoad()`：加载完成后两次更新 `qe.value` 并派发 `resize`，让 Vue Flow 在节点数据落地后重新计算节点内部状态、尺寸和边线。
- 已覆盖普通进入项目、路由切换、导入本地工作流，以及 `Nc()` / `Pc()` 处理 pending payload 后的刷新。
- 已将根入口和 Canvas 动态 import query 升级为 `20260704canvasrefresh1`，避免浏览器继续使用旧 Canvas 包。
- `scripts/smoke-internal-prod.ps1` 已新增生产端断言：入口必须引用新版 Canvas 包，线上 Canvas 包必须包含自动刷新 hook 和 resize 刷新。
- 已完整执行 Docker build + force recreate，镜像 `sha256:d3ba3701598d2e7a5efa24567a4e0da30ff8198c257967122c489b2183ab2042`，容器当前为 `healthy`。
- 已直接请求 `http://192.168.0.39:3456/`、新版入口 JS 和新版 Canvas 包，确认 192.168 生产测试端命中新 query、新 Canvas 自动刷新 hook 和 resize 刷新；旧 `Canvas-yGc8b2gf.js` 返回 410。

### 剩余风险

- 缺少浏览器级自动化复现脚本；本轮主要通过静态资源断言、线上命中和用户强刷后的实际观察闭环。

## 2026-07-04 图片节点拖拽卡顿复核

### 已确认

- 全局顶部栏本身没有拖拽中循环逻辑，只是固定 Header 和按钮状态展示，不是本轮第一嫌疑。
- 图片节点上方浮动工具条更可疑：它依赖选中/hover 状态展示，并叠加了 `:has()`、阴影、backdrop-filter 与 transition；拖动图片节点时这些规则会跟随节点 class/hover/dragging 状态参与样式重算。
- `canvas-performance-mode.js` 原先在 document 捕获层监听 `pointermove`，每次移动都执行 `isCanvasTarget(event.target)` 和 `setActive()`，会反复 `closest()`、写 class、清理和重建 timer。
- `canvas-image-node-polish.js` 原先观察整页 class/title 变动，虽然已有过滤，但图片节点拖拽时的 class 变化仍可能调度图片节点扫描。
- 已改为拖拽开始时锁定拖拽态，拖拽中 80ms 节流延长状态；图片节点扫描拖拽期间延迟到松手后；拖拽期间隐藏图片节点浮动工具条并关闭相关重视觉效果。
- `index.html` 已将相关辅助脚本和 CSS query 升级为 `20260704dragperf1`，`scripts/smoke-internal-prod.ps1` 已增加生产端资源和优化逻辑断言。
- 已完整执行 Docker build + force recreate，镜像 `sha256:43a0fe8f23119b7ec948823f3daa900ff26105eb2cc3d3b31595b50948fe34aa`，容器当前为 `healthy`。
- 已直接请求 `http://192.168.0.39:3456/`、线上 `canvas-performance-mode.js`、`canvas-image-node-polish.js` 和 `canvas-performance-mode.css`，确认 192.168 生产测试端命中 `20260704dragperf1` 与拖拽优化逻辑。

### 剩余风险

- 尚未做 Chrome Performance trace 对比；如果用户强刷后仍卡，需要进一步采样拖拽期间的 Layout/Recalculate Style/Long Task，并考虑减少图片节点 CSS 中的 `:has()` 规则数量。

## 2026-07-04 用户中心打开卡顿复核

### 已确认

- 用户中心当前真实入口为 `UserCenter-C3r6Sru7.js`，页面本身结构不复杂，主要是资料卡、余额入口和少量按钮。
- `index.html` 此前仍在所有页面加载画布辅助 JS：`canvas-performance-mode.js`、`canvas-image-node-polish.js`、`canvas-chat-prompt-flow.js`。
- 这些脚本在画布页合理，但在用户中心会额外挂 document 级监听或 MutationObserver，开页和路由切换时可能参与 DOM 扫描，是用户中心卡顿的高概率来源。
- 已给三个画布 JS 增加 `/canvas` 路由闸门和 SPA 路由监听：非画布页不安装重逻辑；后续从用户中心进入画布仍会自动安装。
- `scripts/smoke-internal-prod.ps1` 已增加生产端断言：首页必须引用 `20260704canvasisolate1`，线上三个画布 JS 必须包含 `watchCanvasRoute` 隔离逻辑。
- 已完整执行 Docker build + force recreate，镜像 `sha256:0bb106db16090c45b53768e1ca5a4efbdaf6a2c226fb48598ced98b4336760e6`，容器当前为 `healthy`。
- 已直接请求 `http://192.168.0.39:3456/user/center`、线上首页和三个画布辅助 JS，确认用户中心入口 200，生产端命中 `20260704canvasisolate1` 与路由隔离逻辑。

### 剩余风险

- 如果隔离后用户中心仍卡，下一步应继续检查 `user-center-data-bridge.js` 的 app MutationObserver、用户资料接口响应时间，以及 UserCenter chunk 的首屏渲染耗时。

## 2026-07-04 全局脚本页面性能护栏复核

### 已确认

- 已在 `AGENTS.md` 固化护栏：画布专用脚本只能在 `/canvas` 路由安装重逻辑，非画布页不得安装全页 observer、高频 document 事件监听、图片扫描、聊天面板刷新或拖拽状态逻辑。
- 已明确 `/user/center` 是非画布性能基线页；用户中心卡顿时先查全局脚本越界安装，再查 `user-center-data-bridge.js`、接口耗时和 UserCenter chunk 自身渲染。
- 已要求涉及画布性能脚本的生产改动必须更新 `scripts/smoke-internal-prod.ps1`，验证线上 HTML query、脚本路由闸门、旧资源 410/404 和 `http://192.168.0.39:3456/user/center`。
- 已把“不能为了修画布把监听器、`querySelectorAll` 扫描、`:has()` 重样式规则或长任务扩散到用户中心和后台”写成明确禁止项。

### 剩余风险

- 护栏依赖后续执行时遵守；如果未来引入新的全局脚本或样式，仍需要在 smoke 和最终汇报中显式说明非画布页影响面。

## 2026-07-04 画布跳转用户中心延迟复核

### 已确认

- 用户反馈的路径是“先在画布，再点用户中心”，不同于直接打开用户中心。
- 已确认上一轮只做了首次安装闸门：非画布页初始打开不会安装画布脚本，但进入过 `/canvas` 后，已安装的 document 监听和 MutationObserver 没有在路由离开时拆掉。
- 已给 `canvas-performance-mode.js`、`canvas-image-node-polish.js`、`canvas-chat-prompt-flow.js` 分别补充 teardown，离开 `/canvas` 后清理事件监听、observer、timer、状态 class 和全局对象。
- `index.html` 已将三个画布辅助 JS query 升级为 `20260704canvasleave1`。
- `scripts/smoke-internal-prod.ps1` 已增加 teardown 断言，要求线上脚本同时包含路由闸门和路由离开清理函数。
- `AGENTS.md` 已补充硬护栏：禁止只做首次进入闸门而把已安装监听器留在非画布页。
- 已完整执行 Docker build + force recreate，镜像 `sha256:0e0be95837004310eca0afb65115cf9807b2e07e51276a4b4f76d105744e5b1e`，容器当前为 `healthy`。
- 已直接请求 `http://192.168.0.39:3456/user/center`、线上首页和三个画布辅助 JS，确认用户中心入口 200，生产端命中 `20260704canvasleave1`，三个脚本均包含 teardown、`removeEventListener` 和 `observer.disconnect`。

### 剩余风险

- 用户浏览器需要强刷后按“画布 -> 用户中心”路径复测体感；如果仍延迟，应继续采样用户中心自身脚本和接口。

## 2026-07-04 画布内用户中心弹层延迟复核

### 已确认

- 用户新截图中的入口是画布右上角圆形 AI/头像按钮，打开的是 Canvas 内部 `qp` 用户中心弹层，不是 `/user/center` 路由页。
- Canvas 包中该弹层由 `pe.value` 控制，渲染点为 `te(qp,{show:pe.value,...})`；因此页面仍停留在 `/canvas`，路由离开 teardown 不会执行。
- 已在 Canvas 包中新增 `codexSetUserCenterOpen()`，打开弹层时立即给 `html/body` 添加 `canvas-user-center-open`，关闭或组件卸载时清理，避免状态残留到其它页面。
- 已在 `canvas-performance-mode.css` 中新增 `canvas-user-center-open` 降负载规则：关闭背后画布的 `will-change`、backdrop blur、动画和过渡，并隐藏聊天面板、minimap、背景网格、图片节点浮动工具条等弹层背后不需要交互的层。
- 已将入口 query 升级为 `20260704usercenter1`，Canvas 动态 import query 升级为 `Canvas-B8bY9_QL.js?v=20260704usercenter1`，性能 CSS query 升级为 `20260704usercenter1`。
- `scripts/smoke-internal-prod.ps1` 已新增断言：线上首页必须命中 `20260704usercenter1`，线上 Canvas 包必须包含 `codexSetUserCenterOpen` 和 `canvas-user-center-open`，线上 CSS 必须包含 `html.canvas-user-center-open` 和 `backdrop-filter: none`。
- 已完整执行 Docker build + force recreate，镜像 `sha256:2627a4c03e9b14a2fcc15f8d13784b1688c8c3d6c09c952ebe0e19f6e5f95508`，容器当前为 `healthy`。
- 已直接请求 `http://192.168.0.39:3456/`、新版入口 JS、新版 Canvas 包、新版性能 CSS 和 `/user/center`，确认生产端命中新 query、新弹层状态 helper/class 和 CSS 降负载规则。

### 剩余风险

- 本轮未安装新依赖，也没有可用浏览器控制工具，因此没有做点击级 Performance trace。若强刷后点击画布右上角用户中心仍延迟，应继续用 Chrome Performance 采样，区分弹层组件渲染、接口响应、头像资源加载和背后画布合成耗时。

## 2026-07-07 图生图中转尺寸复核

### 已确认

- 这条生产测试路径带参考图，因此后端会调用 `callProviderImageEdit()`，上传给中转的是 multipart `/images/edits`，不是无参考图时的 JSON `/images/generations`。
- 当前画布项目中的图片生成节点保存 `size: "1x1"`、`clarity: "1k"`，参考图为 `436x659`，已生成返图约 `1023x1537`，返图比例与参考图高度比例高度一致。
- 根因不是用户界面没选 1:1，而是 `providerImageSize()` 把 `1x1` 误判成显式像素尺寸，实际计算为 `816x816`，导致传给中转的尺寸不是标准 `1024x1024`。
- 已修复为：`1024x1024` 这类真实像素尺寸继续按显式尺寸处理；`1x1`、`3x4`、`16x9` 这类小数字 `x` 写法按比例处理。
- 生成任务响应已增加不含密钥的 `request/providerRequest` 摘要，下一次生产测试可直接在 Network 里看到 `size`、`quality`、`referenceImageField` 和参考图数量。

### 验证

- `node --check "F:\dianshang\server.js"` 通过。
- `node "F:\dianshang\scripts\check-packy-gpt-image-size.js"` 通过，新增覆盖 `1x1`、`3x4`、`4x3`、`9x16`、`16x9`。
- `node "F:\dianshang\scripts\check-packy-gpt-image-adapter-coverage.js"` 通过。
- 已重启本地 3458，健康接口为 `real-provider-ready`，本轮未再次调用真实生图。

### 剩余风险

- 尚未再次扣费生图确认 Packy 是否严格按 `1024x1024` 返回；如果仍返回参考图比例，下一步优先验证单图字段是否需要统一为 `image[]`，以及 GPT 图像模型是否接受当前 `response_format: "url"` 兼容写法。

### 追加复核

- 用户复测后仍返回约 `1021x1541`，但当前后端函数对该节点参数的计算结果已是 `providerSize: "1024x1024"`。
- 进一步判断：比例没有混到业务上传图本身，而是 provider edit 请求必须同时包含参考图文件和输出尺寸字段；若中转或模型忽略 `size`，就会倾向保留参考图原比例。
- 已补充 `ecommercePromptOutputCanvasText()`，把目标比例和尺寸写入最终提示词，给模型层和 provider `size` 字段同向约束。
- 静态验证确认当前提示词会包含：`最终图片必须是 1:1 画布，目标尺寸 1024x1024。不要沿用参考图原始宽高比例`。

### Packy 官方文档复核

- 用户提供 Packy 官方 GPT-Image-2 文档后，确认 `/v1/images/edits` 应使用 `multipart/form-data`，字段为 `model`、`prompt`、`image`、`size`、`quality`、`output_format`、`response_format`，可选 `mask` 和 `input_fidelity`。
- 运行时 dry-run 结果已对齐 Packy 字段形态：`size`、`quality`、`output_format=png`、`response_format=url`、`input_fidelity=high`、`image=<file>`。
- 后台旧接口实例曾显示 `application/json ? multipart/form-data` 和 `images: [{ image_url }]`，该示例不是 Packy 官方编辑接口形态；已清理运行数据库 `admin.apiProviders` 中 GPT Image 2 的 `requestExamples`，并同步源码默认示例。
- 用户进一步确认 UI 清晰度三档应映射 Packy `quality`：`1K -> low`、`2K -> medium`、`4K -> high`；已修正此前把默认 `standard` 统一发 `high` 的处理。

### 图片生成节点 prompt 复核

- 用户要求“原来的约束全删了，只针对图片生成节点”。
- 已确认图片生成节点使用 `/api/generate/tasks`；该入口此前复用 `buildEcommerceImagePrompt()`，会追加多段保真和电商约束，导致生成结果更像原图复刻。
- 已改为 `/api/generate/tasks` 调用 `buildImageGenerateNodePrompt()`，只传用户在节点里输入的原始提示词；不影响 `/api/canvas/dialog-agent-generate`、`/api/canvas/ecommerce-suite/*` 和 `/api/template/generate-image`。
- 静态检查已增加约束：Quick generate tasks 入口必须包含 `buildImageGenerateNodePrompt`，且不能再包含 `buildEcommerceImagePrompt`。

## 2026-07-07 用户中心官转线路显示复核

### 已确认

- 线上 `/api/public/routes` 返回两条图片线路：`route_openai_gpt_image_2` 和 `lignsuan-guanzhuan`，其中 `lignsuan-guanzhuan` 显示名为 `官转gpt-img2`。
- 线上 `/api/public/models?routeId=pub_route_mr5yltmuc7edcb2b` 返回 `GPT Image 2`，`routeKey` 为 `lignsuan-guanzhuan`，模型为启用状态。
- 用户中心抽屉已改为合并 `/user/routes` 与 `/public/routes`；如果用户侧接口短暂只回一条，公开启用线路仍会进入卡片列表。
- 线路模型加载已增加 `/public/models` 兜底，避免用户侧模型接口为空时显示“当前线路暂无可用模型”。
- 入口缓存链路已升级到 `20260707route1`，生产 HTML、入口 JS、Canvas chunk 和 `ImageHistoryPanel` chunk 均已直接请求确认命中新版本。
- Docker 已完整重建并 force recreate；`dianshang-internal-app` 当前为 `healthy`，镜像为 `sha256:d141e4ebbbf94cd339d14246e8e2e8ac5210fd60547166471847e1b38c7cd2e1`。
- `scripts/smoke-internal-prod.ps1` 已补充用户抽屉 chunk 与公开线路、公开模型兜底断言，并已通过。

### 剩余风险

- 未持有用户当前浏览器 token，未直接抓 `/api/user/routes` 的登录态响应；本轮依靠公开接口兜底保证后台启用线路可见。
- 如果浏览器仍只显示一张卡，优先强刷当前页面，确认 Network 中加载的是 `ImageHistoryPanel-Dy2o3dPV.js?v=20260707route1`。

## 2026-07-07 本地 3458 官转线路加载复核

### 已确认

- 当前本地 3458 的运行数据库 `admin.apiProviders` 已包含图像官转线路 `pub_route_openai_gpt_image_2 / route_openai_gpt_image_2`，显示名为 `GPT Image 2 官转`。
- 该图像线路保留已有 API Key，公开响应只返回 `hasApiKey=true` 和脱敏 Key；实际端点为 `https://www.packyapi.com` + `/v1/images/generations`，图生图端点为 `/v1/images/edits`。
- 文本官转线路 `pub_route_openai_gpt_5_5 / route_openai_gpt_5_5` 已同步显示名 `GPT 5.5 官转`，端点为 `/responses`。
- `server.js` 默认 RTS 名称已同步，避免后续重置 `admin.apiProviders` 时又回到无“官转”的旧显示名。

### 验证

- `node --check "F:\dianshang\server.js"` 通过。
- `GET http://127.0.0.1:3458/api/model-routes?group=image` 返回 `GPT Image 2 官转`、`/v1/images/generations`、`/v1/images/edits`、`defaultImageModel=gpt-image-2`、`hasApiKey=true`。
- `GET http://127.0.0.1:3458/api/model-routes?group=text` 返回 `GPT 5.5 官转`、`/responses`、`defaultTextModel=gpt-5.5`、`hasApiKey=true`。
- `GET http://127.0.0.1:3458/api/user/api-status` 返回 provider 名称 `GPT Image 2 官转`。

### 剩余风险

- 本轮没有执行真实生图扣费请求；只确认线路加载、名称、端点和密钥配置状态。
- 本轮没有重建 3456 Docker 生产端；当前变更只面向 `http://127.0.0.1:3458` 本地生产测试。

## 2026-07-07 中转上传字段兼容试改复核

### 已确认

- 图片生成节点仍走本地后端 `/api/generate/tasks`，没有改为前端直连中转，也没有改 prompt 组装。
- `callProviderImageEdit()` 已改为多参考图重复追加 multipart `image` 字段；单图和多图均不再使用 `image[]`。
- 文生图 JSON `/v1/images/generations` 和图生图 multipart `/v1/images/edits` 都会发送 `background=auto`、`moderation=auto`。
- 生成任务响应的 `request/providerRequest` 摘要会暴露不含密钥的 `endpoint`、`background`、`moderation`、`referenceImageField=image` 和 `referenceImageFieldMode`，便于浏览器 Network 核对。
- 运行数据库 `admin.apiProviders` 的 GPT Image 2 请求示例已同步，后台示例不再出现 `image[]` 或缺少 `background/moderation` 的旧形态。

### 验证

- `node --check "F:\dianshang\server.js"` 通过。
- `node "F:\dianshang\scripts\check-packy-gpt-image-adapter-coverage.js"` 通过，并断言不能再出现 `form.append('image[]'`。
- `node "F:\dianshang\scripts\check-packy-gpt-image-size.js"` 通过 54 个尺寸映射用例。

### 剩余风险

- 本轮没有启用 New API `?async=true` 与上游任务轮询；刷新恢复能力仍是后续独立改造项。
- 本轮没有执行真实扣费生图；字段兼容是否提升生成效果，需要用户在当前 3458 画布实测。

## 2026-07-07 用户中心两条图片路线复核

### 已确认

- 用户后台截图中图片路线应为两条：默认 `GPT Image 2` 和普通线路 `官转gpt-img2 / lignsuan-guanzhuan`。
- 当前 3458 的 `data.db` 之前只保存了 1 条 image 路线，导致用户中心只能渲染一张图片线路卡片。
- `docker/data/data.db` 中保留了 `pub_route_mr5yltmuc7edcb2b / lignsuan-guanzhuan` 的真实本地 API Key；本轮从该本地生产副本恢复到当前 3458 `admin.apiProviders`。
- `server.js` 默认 RTS 已增加 `官转gpt-img2`，避免 `admin.apiProviders` 被重置或缺失时默认状态又少一条图片路线。

### 验证

- `GET http://127.0.0.1:3458/api/model-routes?group=image` 返回 2 条：`GPT Image 2 官转` 与 `官转gpt-img2`。
- `GET http://127.0.0.1:3458/api/public/routes?group=image` 返回同样 2 条图片路线。
- `GET http://127.0.0.1:3458/api/public/models?routeId=pub_route_mr5yltmuc7edcb2b` 返回 `GPT Image 2`，`routeKey=lignsuan-guanzhuan`。
- 当前 3458 已重启，并刷新了内置浏览器画布页。

### 剩余风险

- 本轮未对 `官转gpt-img2` 做真实扣费生图测试；用户可在用户中心切换后自行验证效果。
- 本轮未同步 3456 Docker 生产端。

## 2026-07-07 生图结果节点刷新恢复复核

### 已确认

- `/api/generate/tasks` 已从同步等待上游返回改为真正任务式提交：先创建内存 pending task，立即返回 `202`、`taskId`、`status=running`、`progress=90`。
- 后台任务完成后会用同一个 taskId 更新 `status=success`、`progress=100`、`resultImages/images`，并在成功后写入 `generations` 与扣费日志；失败会更新 `status=failed` 与 `errorMessage`。
- 旧画布图片生成节点在收到进度回调中的 `taskId` 后，会把 `taskId/sourceTaskId/taskImageIndex` 保存进每个结果图片节点，并把生成节点的 `outputNodeIds` 同步保存。
- 图片节点新增刷新恢复逻辑：加载到 `taskId` 且没有 `url` 时自动轮询 `/api/generate/tasks/:id`，成功后回填 `url/imageUrl/originalUrl/thumbUrl/thumbnailUrl`，失败后显示错误。
- 入口缓存已升级到 `20260707taskresume1`，当前 3458 首页和 index chunk 均命中新 query。

### 验证

- `node --check "F:\dianshang\server.js"` 通过。
- `node --check` 已覆盖 `assets/Canvas-B8bY9_QL.js`、`assets/Canvas-yGc8b2gf.js`、`assets/index-DglIsp_g.js`、`assets/index-ZrBcanD1.js`。
- 静态断言确认两个 Canvas bundle 均包含 `resumeImageTask=async`、`anTaskId=gt.taskId`，入口 chunk 包含新的 Canvas query。
- 临时 3462 mock 服务使用临时数据库与 `ENABLE_REAL_AI=false` 验证：`POST /api/generate/tasks` 返回 `202/running/progress=90/taskId`，随后轮询同一 taskId 返回 `success/progress=100/1 张图片`。
- 3458 已重启，健康检查为 `real-provider-ready`，首页命中 `index-DglIsp_g.js?v=20260707taskresume1`，入口命中 `Canvas-B8bY9_QL.js?v=20260707taskresume1`。

### 剩余风险

- 本轮没有触发真实扣费生图；真实上游返回慢或失败时，需要用户在 3458 画布复测节点刷新恢复体验。
- 当前 task 仍保存在后端内存中；浏览器刷新可恢复，后端进程重启仍不能恢复未完成任务。后续若要覆盖服务重启，需要把 pending task 落库并加启动恢复或任务队列。

## 2026-07-07 生图进度条抖动复核

### 已确认

- 抖动来源是两个前端进度源同时写结果图片节点：旧模拟进度 interval 继续写 `模型生成中 54%`，后台 task 提交后又写 `等待返回结果 90%`。
- 两份 Canvas bundle 已在拿到 `taskId` 后调用 `w()` 停止模拟进度 interval，再写入 90% 等待状态。
- 入口缓存已升级到 `20260707taskresume2`，避免浏览器继续加载上一版 `taskresume1` Canvas 包。

### 验证

- `node --check "F:\dianshang\assets\Canvas-B8bY9_QL.js"` 通过。
- `node --check "F:\dianshang\assets\Canvas-yGc8b2gf.js"` 通过。
- 静态断言确认两个 Canvas bundle 均包含 `w(),b(Math.max(90,Number(_.progress||90))`。
- 3458 首页命中 `index-DglIsp_g.js?v=20260707taskresume2`，入口 chunk 命中 `Canvas-B8bY9_QL.js?v=20260707taskresume2`。

### 剩余风险

- 本轮没有重新触发真实扣费生图；请在当前画布刷新后复测，预期拿到 taskId 后进度保持 90% 等待，不再回落到 54%。

## 2026-07-07 刷新后红态丢恢复复核

### 已确认

- 用户当前项目 `project_1783411452337_62mwdhz9p` 中，红态结果节点 `node_8/node_9` 的 `taskId` 已被项目清洗层删除，只剩 `sourceTaskId=task_mradlsmaa4486ee3`，并被写入 `error=上次生成未完成，已停止自动恢复`。
- 后端任务并未丢失：用项目用户短 token 查询 `/api/generate/tasks/task_mradlsmaa4486ee3` 返回 `success`、`progress=100`、`resultImages=2`。
- `projects-BtxGnToV.js` 和兼容包 `projects-eqk9JplQ.js` 已改为：图片节点存在 `sourceTaskId` 且无 URL 时，加载时补回 `taskId`，保留恢复进度状态并清空旧 interrupted error。
- `ImageNode` 恢复轮询已改为使用 `taskId || sourceTaskId`；恢复等待和成功回填时都会清掉 error，避免红态继续挡住图片。
- Canvas 对 projects chunk 的静态 import 已带 `?v=20260707taskresume3`，入口缓存也同步升级。

### 验证

- `node --check` 已覆盖 `projects-BtxGnToV.js`、`projects-eqk9JplQ.js`、`Canvas-B8bY9_QL.js`、`Canvas-yGc8b2gf.js`、`index-DglIsp_g.js`、`index-ZrBcanD1.js`。
- 静态断言确认 projects chunk 包含 `!a.taskId&&a.sourceTaskId&&!ne(a)&&(a.taskId=a.sourceTaskId`，Canvas 包包含 `sourceTaskId)||""`。
- 3458 首页命中 `index-DglIsp_g.js?v=20260707taskresume3`，Canvas 命中 projects chunk query，projects chunk 命中保留 `sourceTaskId` 的逻辑。
- 当前任务 `task_mradlsmaa4486ee3` 后端查询结果为 `success/progress=100/2 张图片`。

### 剩余风险

- 如果用户刷新前 3458 后端进程重启，内存 task 仍可能丢；当前这一次任务还在内存中，可以刷新后恢复。

## 2026-07-07 图片加载阶段保持生图 UI 复核

### 已确认

- 图片生成任务成功拿到 URL 时，旧画布不再立刻切到普通图片分支，而是保持结果节点的生图加载 UI。
- 两份 Canvas bundle 已把成功态拆为两段：`progress=99/progressLabel=图片加载中` 先展示加载 UI，加载态预览图 `onLoad` 触发后再清理 `loading/revealOnImageLoad/pendingRevealUrl` 并展示最终图片。
- 普通生成成功和刷新恢复成功两条路径都写入 `revealOnImageLoad/pendingRevealUrl`，避免只有恢复链路稳定、首次生成仍缩成长条。
- 两份 projects chunk 已保留 `revealOnImageLoad` 图片节点的加载状态，刷新时不会把该状态误清洗掉。
- `taskresume4` 首版在压缩函数内重复声明 `Xt`，导致浏览器解析 `Canvas-B8bY9_QL.js` 报错并出现空白画布；已移除重复声明并升级到 `20260707taskresume5`。
- 入口缓存已升级到 `20260707taskresume5`，当前 3458 静态资源命中新版。

### 验证

- `node --check` 已覆盖 `assets/Canvas-B8bY9_QL.js`、`assets/Canvas-yGc8b2gf.js`、`assets/projects-BtxGnToV.js`、`assets/projects-eqk9JplQ.js`、`assets/index-DglIsp_g.js`、`assets/index-ZrBcanD1.js`。
- 静态断言确认两个 Canvas bundle 均包含 `progressLabel:"图片加载中"`、`revealOnImageLoad:!0,pendingRevealUrl` 和加载态 `onLoad:Ke,onError:je`。
- 静态断言确认两个 projects chunk 均包含 `a.revealOnImageLoad&&ne(a)`。
- `http://127.0.0.1:3458/`、入口 chunk 和 `Canvas-B8bY9_QL.js?v=20260707taskresume5` 均命中新版本。
- 内置浏览器直接打开 `http://127.0.0.1:3458/canvas/project_1783411452337_62mwdhz9p`，确认 `#app` 已挂载且存在画布节点；新版本不再产生 `Identifier 'Xt' has already been declared` 解析错误。

### 剩余风险

- 本轮没有再次触发真实扣费生图；用户可在 3458 当前画布复测，预期任务完成后节点保持生图卡片到图片加载完成，再直接显示图片结果。

## 2026-07-07 图片加载中长条 UI 兜底复核

### 已确认

- 用户截图中的 `图片加载中 99%` 横条状态不正确，应保持方形生图/结果图加载 UI。
- 根因不是 Canvas loading 容器本身；Canvas 包里的 loading 容器已经是 `aspect-square`。
- 根因是 `canvas-image-node-polish.css/js` 看到加载预览 `<img>` 后，把 loading 节点提前当作“已有图片”节点处理，套用了结果图尺寸和工具条布局。
- 两份 Canvas bundle 已在图片节点 loading 时加 `image-node-loading` 类。
- `canvas-image-node-polish.css` 已针对 `image-node-loading` 覆盖抛光规则，强制 290px 方形加载卡、恢复 padding，并把加载容器固定为 `aspect-ratio: 1 / 1`。

### 验证

- `node --check` 已覆盖 `assets/Canvas-B8bY9_QL.js`、`assets/Canvas-yGc8b2gf.js`、`assets/index-DglIsp_g.js`、`assets/index-ZrBcanD1.js`。
- 静态断言确认两份 Canvas bundle 包含 `image-node-loading`。
- 静态断言确认 `assets/canvas-image-node-polish.css` 包含 `.image-node.image-node-loading` 和 `aspect-ratio: 1 / 1`。
- 3458 首页命中 `index-DglIsp_g.js?v=20260707taskresume6`，入口 chunk 命中 `Canvas-B8bY9_QL.js?v=20260707taskresume6`，polish CSS 命中 `?v=20260707loadui1`。

### 剩余风险

- 本轮没有再次触发真实扣费生图；需要用户复测实际生成中的 loading 节点，预期不再出现横条。

## 2026-07-07 画布用户中心兑换码刷新复核

### 已确认

- 用户反馈发生在画布右侧用户中心抽屉，不是独立 `/user/redeem` 页面。
- 后端 `/api/user/redeem` 当前成功响应为 `success/balance/amount`，不包含 `user`。
- 画布抽屉旧逻辑只执行 `Ye(R.user)`，当 `R.user` 为空时不会刷新本地用户状态，导致 `算力余额` 不跟随刷新。
- 兑换码输入框缺少显式文字色和 placeholder 色，在白底场景下可读性不足。

### 处理

- 两份 `ImageHistoryPanel` 已改为兑换成功后 `R.user ? Ye(R.user) : await me()`，兼容当前后端返回结构。
- 两份 `ImageHistoryPanel` 的兑换码输入框已补 `text-zinc-900` 和 `placeholder:text-zinc-400`。
- 入口、Canvas 动态 import 和 Canvas 内 `ImageHistoryPanel` import query 已升到 `taskresume7/redeem1`，避免浏览器继续用旧资源。

### 验证

- `node --check` 已覆盖 `assets/ImageHistoryPanel-Dy2o3dPV.js`、`assets/ImageHistoryPanel-Cu4Brucb.js`、两份 Canvas bundle 和两份 index chunk。
- 静态断言确认两份 `ImageHistoryPanel` 均包含输入框可读颜色和兑换成功后的资料刷新 fallback。
- `http://127.0.0.1:3458/` 已命中 `index-DglIsp_g.js?v=20260707taskresume7`，入口 chunk 已命中 `Canvas-B8bY9_QL.js?v=20260707taskresume7`，Canvas chunk 已命中 `ImageHistoryPanel-Dy2o3dPV.js?v=20260707redeem1`。

### 剩余风险

- 本轮没有真实提交兑换码，避免改动当前账号余额；需要用户用有效兑换码复测一次，预期成功提示后余额和算力明细一起更新。

## 2026-07-07 最新 commit 基线复核

### 已确认

- 用户明确最新 commit 是当前基线，本轮按 `HEAD` 而不是旧回滚点 `51d4dab` 更新项目事实入口。
- 当前 `HEAD` 为 `0fd44536ca9dd1ca1f791be7a717e86d178c84f1`，短哈希 `0fd4453`，提交信息 `fix: stabilize canvas generation flow`，提交时间 `2026-07-07 17:05:28 +0800`。
- 当前 `main` 相对 `origin/main` 为 `ahead 4`；工作树存在未跟踪目录 `workflows/`，它不是本次确认的基线内容。

### 处理

- `docs/current-baseline.md` 已把当前基线、当前准绳、入口资源、容易混淆的历史和后续修改门禁统一改为最新提交口径。
- 文档明确：最新 Git 基线不自动等于 3456 生产端已同步，生产仍要走 Docker 重建、健康检查和内网 URL 验证。

### 验证

- 已用 `git status --short --branch`、`git log -1` 和资源 query 检查确认文档内容来源。
- 本轮未修改业务代码，因此不运行前端构建或后端 smoke；只执行文档检查和 UTF-8 BOM 检查。

## 2026-07-08 后台源码 UI 规范化复核

### 已确认

- 本轮只覆盖源码后台 `/admin/*`，不引入 shadcn、React、Tailwind 或新依赖。
- 共用后台组件只负责布局和展示，业务 API 仍由各后台页面现有函数调用。
- 11 个后台源码页的原有刷新、搜索、筛选、分页、确认弹窗、表单字段和写入入口保留。

### 处理

- 新增 `docs/admin-ui-guidelines.md`，把后台 UI 风格和维护边界固化为可复用规范。
- 新增 `frontend/src/components/admin/` 展示组件，并把 11 个后台源码页统一到 `AdminPageShell`、`AdminPageHeader`、`AdminFeedback`、`AdminToolbar`、`AdminEmptyState`、`AdminStatGrid` 和 `AdminPanel`。
- `AdminSourceSidebar.vue` 改为读取 `frontend/src/config/adminNavigation.ts`，导航项带分组和 lucide 图标。
- `frontend/src/styles/app.css` 增加后台 scoped tokens 与布局规则，控制高密度工作台、列表、面板、工具栏和移动端溢出。
- 后台 UI smoke runner 修复 admin token 注入，避免 `/api/admin/*` 源码拦截器在 smoke 中误报 401。

### 验证

- `npm run typecheck --prefix "F:\dianshang\frontend"` 通过。
- `npm run check:routes --prefix "F:\dianshang\frontend"` 通过，输出 `Source frontend route maintenance check passed: 22/22 source routes.`。
- `npm run build --prefix "F:\dianshang\frontend"` 通过。
- `powershell -NoProfile -ExecutionPolicy Bypass -File "F:\dianshang\scripts\smoke-source-frontend-ui.ps1"` 通过。
- `powershell -NoProfile -ExecutionPolicy Bypass -File "F:\dianshang\scripts\smoke-admin-pages-ui.ps1"` 通过，并刷新后台页面截图归档。
- `node --check` 覆盖 4 个后台 UI smoke runner，通过。
- `git -C "F:\dianshang" diff --check` 通过。

### 剩余风险

- 本轮没有执行真实 Provider 连接、真实 API Key 写入、真实扣费或正式线路删除。
- 本轮没有同步 3456 生产端；如需发布，仍必须完整 Docker 重建、确认容器 healthy 并验证内网 URL 命中新版本。

## 2026-07-08 画布生成线路透传复核

### 已确认

- 用户截图中的 `traceid: 90005eac393dc0186d45d5597bc88172` 对应任务 `task_mrbpje16fc7be21e`。
- 2026-07-08 14:36 到 14:42 的 6 条失败任务都显示 `lineKey=route_6789`、`routeDisplayName=6789`，并且错误来自 `https://www.packyapi.com/v1/images/edits`。
- 本地 `.env` 和后台线路均有 Key；失败主因不是本地完全未配置 Key。

### 处理

- `/api/generate/tasks` 已解析请求体里的图片线路，并把 `route` 传给 Provider 调用。
- `createPendingTask` 和 `makeTaskResponse` 已携带线路元数据，后台任务列表可以看到真实线路。
- 后台任务列表不再写死 `route_6789/6789`；失败任务不再显示 `已扣费`。

### 验证

- `node --check "F:\dianshang\server.js"` 通过。
- `powershell -NoProfile -ExecutionPolicy Bypass -File "F:\dianshang\scripts\smoke-api-disposable.ps1"` 通过。
- 一次性 mock 后端验证：`routeId=pub_route_mr5yltmuc7edcb2b` 的生成任务返回 `lineKey=lignsuan-guanzhuan`、`routeDisplayName=官转gpt-img2`。

### 剩余风险

- 本轮避免真实 Provider 调用，没有实际扣费测试 `lingsuan.top`。
- 如用户复测 lingsuan 后仍失败，需要拿新的任务 ID 或 traceid 判断真实上游错误。

## 2026-07-08 PackyAPI 线路命名复核

### 已确认

- 用户中心显示两条图像线路时，PackyAPI 线路旧名 `GPT Image 2 官转` 容易和 lingsuan 的 `官转gpt-img2` 混淆。
- PackyAPI 线路实际 Base URL 仍是 `https://www.packyapi.com`，并没有丢失。

### 处理

- `server.js` 默认 PackyAPI 图像线路名改为 `PackyAPI GPT Image 2`。
- 当前 `data.db` 的 `admin.apiProviders` 同步更新 PackyAPI 线路 `name/displayName/dn`。
- 未修改 API Key、Base URL、endpoint、默认线路和优先级。

### 验证

- `/api/admin/api-providers` 返回 PackyAPI 线路 `PackyAPI GPT Image 2`。
- `/api/public/routes?group=image`、`/api/model-routes?group=image` 和 `/api/user/api-status` 与后台返回一致。

## 2026-07-08 用户 API 线路偏好复核

### 已确认

- 最新失败任务仍是 PackyAPI：`lineKey=route_openai_gpt_image_2`，错误为 `没有可用token`。
- `/api/user/preferences/api-route` 修复前没有写入任何持久状态，只返回请求体里的 route。
- `/api/user/api-status` 修复前固定读取 `routeState()[0]`，会回到默认 PackyAPI。

### 处理

- 新增 `user.apiPreferences` 状态，按 `userId` 保存 `imageRouteId/imageRouteKey`。
- `/api/user/preferences/api-route` 保存用户选择的图片线路。
- `/api/user/api-status`、`/api/user/models` 和 `/api/generate/tasks` 在请求未显式带线路时读取用户图片线路偏好。

### 验证

- `node --check "F:\dianshang\server.js"` 通过。
- 3456 已重启到新 `server.js`。
- 保存 `pub_route_mr5yltmuc7edcb2b` 后，`/api/user/api-status` 返回 `官转gpt-img2`。

### 剩余风险

- 本轮未触发真实 Provider 生图，不验证 lingsuan 上游可用性。
- 修复前用户点过的线路不会自动补写，需用户重新点选一次目标线路。

## 2026-07-08 画布线路偏好全链路复核

### 已确认

- 用户最新截图仍是 `没有可用token`；该错误语义来自 Provider token 池，不是前端 UI 渲染错误。
- 健康接口确认当前 3456 进程读取 `F:\dianshang\data.db`，不是临时 smoke 数据目录。
- 实际用户 `731241492 / user_mra81hjffdee6972` 的保存偏好已存在，使用有效本地 JWT 查询 `/api/user/api-status` 返回 `官转gpt-img2 / lignsuan-guanzhuan`。
- 复查代码发现画布套图与对话 Agent 路径仍有 `resolveImageRoute(body)`，缺少 `req.user.userId`，会在无显式线路参数时绕过用户偏好。

### 处理

- `/api/canvas/ecommerce-suite/prompts`、`/api/canvas/ecommerce-suite/generate`、`/api/canvas/dialog-agent-generate` 已统一传入 `req.user.userId`。
- 3456 已重启到 `node F:\dianshang\server.js`。
- 普通生成任务保留 Packy `没有可用token` 时自动尝试下一条启用图像线路的兜底逻辑。

### 验证

- `node --check "F:\dianshang\server.js"` 通过。
- `powershell -NoProfile -ExecutionPolicy Bypass -File "F:\dianshang\scripts\smoke-api-disposable.ps1"` 通过。
- `/api/health` 返回数据库路径 `F:\dianshang\data.db`。
- 实际用户 `/api/user/api-status` 返回 `mock=false` 且 provider 为 `pub_route_mr5yltmuc7edcb2b / lignsuan-guanzhuan`。

### 剩余风险

- 未执行真实 Provider 生图，避免真实扣费。
- 如果修复后新任务仍失败，需要以新的 traceid 判断是否为 lingsuan 上游 token、Key 或 endpoint 配置问题。

## 2026-07-08 参考图加载闪烁复核

### 已确认

- 闪烁发生在画布参考图/图片节点加载态，不属于后台 UI 页面。
- 当前入口使用 `Canvas-B8bY9_QL.js?v=20260707taskresume7`，同时全局加载 `canvas-image-node-polish.js`。
- Canvas 包在 loading 状态会渲染预览 `<img>`；polish 脚本旧逻辑会扫描 `.image-node img` 并给节点添加 `image-node-has-image`。
- `image-node-has-image` 与 `image-node-loading` 同时存在时，会触发已有图片抛光样式和加载态样式竞争，是参考图加载刷新闪烁的直接风险点。

### 处理

- `canvas-image-node-polish.js` 的 `markImage` 增加 loading guard：遇到 `.image-node-loading` 时清除 `image-node-has-image` 并返回。
- `index.html` 将 polish 脚本 query 升为 `20260708loadguard1`，避免继续命中旧缓存。

### 验证

- `node --check "F:\dianshang\assets\canvas-image-node-polish.js"` 通过。
- `git -C "F:\dianshang" diff --check -- "index.html" "assets/canvas-image-node-polish.js"` 通过。
- `http://127.0.0.1:3456/` HTML 命中 `canvas-image-node-polish.js?v=20260708loadguard1`。
- `http://127.0.0.1:3456/assets/canvas-image-node-polish.js?v=20260708loadguard1` 内容命中 `image-node-loading` guard。

### 剩余风险

- 本轮未执行真实 Provider 生图，不验证真实生成结果回填。
- 用户浏览器如仍缓存旧页面，需要刷新当前画布后再观察。

## 2026-07-09 Docker 同步复核

### 已确认

- 用户要求同步到 Docker，必须以 `F:\dianshang` 当前工作区为源码基线完整重建，不能只 restart。
- 初次执行 compose 时 Docker engine 未启动；启动 Docker Desktop 后 engine 版本为 `29.5.3`。
- 首次重建后为了让生产 smoke 跟上当前资源版本，更新了 `scripts/smoke-internal-prod.ps1`，因此又执行了一次完整 Docker 重建。

### 处理

- 执行 `docker compose -f "F:\dianshang\docker\docker-compose.yml" up -d --build --force-recreate app`。
- 更新 `scripts/smoke-internal-prod.ps1` 的资源断言到当前版本：`20260707taskresume7`、`20260707redeem1`、`20260707loadui1`、`20260708loadguard1`。
- 最终容器 `dianshang-internal-app` 已强制重建并启动。

### 验证

- 最终镜像 ID：`sha256:52079e8da62a568e71a77f0f934111107f24bfe6409e3b97b2b2b1eb258c1376`。
- 镜像创建时间：`2026-07-09T03:07:00.899808192Z`。
- 容器启动时间：`2026-07-09T03:07:08.743503288Z`。
- 容器 Health：`healthy`。
- `http://192.168.0.39:3456/` 返回 200，并命中 `index-DglIsp_g.js?v=20260707taskresume7` 与 `canvas-image-node-polish.js?v=20260708loadguard1`。
- `http://192.168.0.39:3456/api/health` 返回 `success=true/status=ok/database=ok/mode=real-provider-ready`。
- `scripts/smoke-internal-prod.ps1` 通过。

### 剩余风险

- 本轮未发起真实生图请求，避免真实扣费。
- 浏览器端如果仍有旧缓存，需要强刷页面后再复测画布参考图加载和生图线路。

## 2026-07-09 账号 731241492 密码统一复核

### 已确认

- 开发库 `F:\dianshang\data.db` 存在 `731241492 / user_mra81hjffdee6972`。
- Docker 库 `F:\dianshang\docker\data\data.db` 原本不存在用户名 `731241492`，但同邮箱 `731241492@qq.com` 属于 `mylord1993 / user_mr5yosedcd52a974`。
- 两个环境的 `JWT_SECRET` 不同，因此不能把开发库 password hash 直接复制到 Docker。

### 处理

- 备份开发库和 Docker 库。
- 开发库更新 `731241492` 的密码 hash，并保持账号 active。
- Docker 库保留原用户 id、余额、项目关联，只把 `mylord1993` 登录名改为 `731241492`，并按 Docker 生产 `JWT_SECRET` 重置密码 hash。

### 验证

- 开发库 hash 校验通过。
- Docker 容器 `/app/data/data.db` hash 校验通过。
- Docker 内网登录接口 `POST /api/auth/login` 返回 200、token 和用户 `731241492`。

### 剩余风险

- 开发库与 Docker 库的用户 id 和余额仍不同：开发为 `user_mra81hjffdee6972 / 115`，Docker 为 `user_mr5yosedcd52a974 / 130`。
- 本轮未同步项目、生成记录、余额流水等业务数据，只统一登录名和密码。

## 2026-07-09 模板选择板块 UI 优化复核

### 已确认

- 截图对应当前生产静态包中的 `/template-image` 模板工作台，不是 `frontend/src/views/TemplateImageSource.vue` 源码页。
- 模板页已有稳定类名：`.template-workbench`、`.template-preset-gallery`、`.template-gallery-grid`、`.template-card`，可以通过独立 CSS 做低风险视觉覆盖。
- 该路由的 chunk CSS 会懒加载注入，因此新增样式需要使用更高优先级选择器覆盖旧的本地 1:1 卡片补丁。

### 处理

- 新增 `assets/template-workbench-gallery-polish.css`，限定在 `.template-workbench` 下优化模板选择区域。
- `index.html` 引用 `template-workbench-gallery-polish.css?v=20260709gallery1`。
- `scripts/smoke-internal-prod.ps1` 增加模板工作台样式资源和关键 CSS 规则断言。
- 完整重建 Docker：`docker compose -f "F:\dianshang\docker\docker-compose.yml" up -d --build --force-recreate app`。

### 验证

- `git -C "F:\dianshang" diff --check` 通过。
- `assets/template-workbench-gallery-polish.css`、`index.html`、`scripts/smoke-internal-prod.ps1` 均为 UTF-8 无 BOM。
- 最终镜像 ID：`sha256:3b0818f83327a67517c762793c7d74bb053a460b14f6a98a4d14d8ac4d8d50cc`。
- 镜像创建时间：`2026-07-09T04:49:11.279150785Z`。
- 容器启动时间：`2026-07-09T04:49:20.291493523Z`。
- 容器 Health：`healthy`。
- `http://192.168.0.39:3456/` 返回 200，并命中 `template-workbench-gallery-polish.css?v=20260709gallery1`。
- `http://192.168.0.39:3456/assets/template-workbench-gallery-polish.css?v=20260709gallery1` 返回 200，并命中 `.template-workbench .template-card[data-v-bc16861b]` 高优先级覆盖。
- `http://192.168.0.39:3456/api/health` 返回 `success=true/status=ok/database=ok`。
- `scripts/smoke-internal-prod.ps1` 通过。

### 剩余风险

- 本轮未执行真实模板生成，不验证真实 Provider 成图和扣费。
- 用户浏览器可能仍缓存旧页面，需要在 `/template-image` 强刷后再看最终样式。

## 2026-07-09 画布模型下拉清理复核

### 已确认

- 后端开发库 `admin.apiProviders` 当前只保留 PackyAPI 图像线、lingsuan 图像线和 GPT 5.5 文本线。
- `/api/user/models` 对当前用户返回的模型列表已经是干净的 `GPT Image 2`。
- 截图中的 `6789/RK/Comfly/Nano Banana/Gemini` 来自静态兜底模块 `assets/fixedImageModels-Rg0McL4V.js`，不是后台当前线路配置。

### 处理

- 重写 `assets/fixedImageModels-Rg0McL4V.js`，固定兜底模型只保留 PackyAPI 和 lingsuan 两项。
- `index.html` 入口 query 升为 `20260709modelclean1`。
- `assets/index-DglIsp_g.js` 中 HomeIndex/Canvas 动态 chunk query 升为 `20260709modelclean1`。
- `assets/HomeIndex-DAjDt0aj.js` 与 `assets/Canvas-B8bY9_QL.js` 对固定模型模块的 import 追加 `?v=20260709modelclean1`，避免浏览器继续使用旧模块缓存。
- `scripts/smoke-internal-prod.ps1` 增加固定模型表断言。

### 验证

- `node --check` 覆盖 `assets/fixedImageModels-Rg0McL4V.js`、`assets/index-DglIsp_g.js`、`assets/Canvas-B8bY9_QL.js`、`assets/HomeIndex-DAjDt0aj.js`。
- `git -C "F:\dianshang" diff --check` 通过。
- 修改文件均为 UTF-8 无 BOM。
- 最终镜像 ID：`sha256:928c818c2c65d810f58982ee42397899864b89f99be424da13ea932bbdc2f43a`。
- 镜像创建时间：`2026-07-09T05:03:56.551865184Z`。
- 容器启动时间：`2026-07-09T05:04:05.059351269Z`。
- 容器 Health：`healthy`。
- `http://localhost:3456/` 与 `http://192.168.0.39:3456/` 均命中 `index-DglIsp_g.js?v=20260709modelclean1`。
- `assets/index-DglIsp_g.js?v=20260709modelclean1` 命中 `Canvas-B8bY9_QL.js?v=20260709modelclean1` 与 `fixedImageModels-Rg0McL4V.js?v=20260709modelclean1`。
- `assets/fixedImageModels-Rg0McL4V.js?v=20260709modelclean1` 返回 200，包含 PackyAPI/lingsuan 兜底，不包含 `Nano Banana|Comfly|route_6789|route_rk|Flatfee|VIP|Gemini`。
- Playwright 浏览器运行时 import 固定模型模块，返回 `count=2`、`hasOld=false`。
- `scripts/smoke-internal-prod.ps1` 通过。

### 剩余风险

- 本轮未执行真实生图和真实扣费。
- 已打开的画布页面如果仍显示旧模型，需要强刷页面或重新进入画布，让浏览器加载 `modelclean1` 入口。

## 2026-07-09 画布模型自动同步复核

### 已确认

- `modelclean1` 仍保留两条前端固定兜底模型，后续后台新增模型时仍可能出现前端兜底不同步。
- 画布和首页已存在从 `/api/user/models` 拉后台模型的主链路，静态固定模型模块只需要保留导出兼容，不应该再承载真实模型数据。

### 处理

- `assets/fixedImageModels-Rg0McL4V.js` 改为后端模型唯一来源模式：导出 `backend-model-source-only` 标记，固定模型数组和线路模型数组都返回空。
- `/api/user/models` 的默认线路兜底改为 `pub_route_openai_gpt_image_2`，并继续优先使用用户保存的图片线路。
- 入口、Canvas、Home 和 fixed model import query 统一升级为 `20260709modelsync1`。
- `scripts/smoke-internal-prod.ps1` 增加 backend-source-only 断言，并阻止真实模型关键字再次进入固定模型资产。

### 验证

- `node --check` 覆盖 `assets/fixedImageModels-Rg0McL4V.js`、`assets/index-DglIsp_g.js`、`assets/Canvas-B8bY9_QL.js`、`assets/HomeIndex-DAjDt0aj.js`、`server.js`。
- `git -C "F:\dianshang" diff --check` 通过。
- 修改文件均为 UTF-8 无 BOM。
- 最终镜像 ID：`sha256:02f8ba50fd739fd9411546364238d05d69121dc24fdd286b8e6ebd7261c13c12`。
- 镜像创建时间：`2026-07-09T05:12:15.929785193Z`。
- 容器启动时间：`2026-07-09T05:12:24.5713627Z`。
- 容器 Health：`healthy`。
- `http://localhost:3456/` 与 `http://192.168.0.39:3456/` 均命中 `index-DglIsp_g.js?v=20260709modelsync1`。
- `assets/index-DglIsp_g.js?v=20260709modelsync1` 命中 `Canvas-B8bY9_QL.js?v=20260709modelsync1`、`HomeIndex-DAjDt0aj.js?v=20260709modelsync1` 和 `fixedImageModels-Rg0McL4V.js?v=20260709modelsync1`。
- `assets/fixedImageModels-Rg0McL4V.js?v=20260709modelsync1` 返回 200，包含 `backend-model-source-only`，不包含 PackyAPI、lingsuan、6789、RK、Comfly、Nano Banana、Flatfee、VIP、Gemini 等真实模型关键字。
- `scripts/smoke-internal-prod.ps1` 通过。
- 临时新增模型 `codex-auto-sync-smoke-1783574041519` 到后台线路 `pub_route_openai_gpt_image_2` 后，普通用户模型接口立即可见；删除后再次查询不可见，确认前端模型来源会自动跟后台同步。

### 剩余风险

- 本轮未执行真实生图和真实扣费。
- 已打开的画布页面如果仍显示旧模型，需要强刷页面或重新进入画布，让浏览器加载 `modelsync1` 入口。

## 2026-07-09 画布 agent 套图 tab 图标复核

### 已确认

- 用户截图中的 `agent电商套图` tab 对应当前 Canvas chunk 内的 `video` tab 配置。
- 该 tab 之前使用 `icon:oo`，视觉上是摄像机图标；对于当前 agent 电商套图入口，魔法棒更符合“AI 自动生成套图”的语义。

### 处理

- `assets/Canvas-B8bY9_QL.js` 将 `video` tab 的图标引用从 `oo` 改为 `gd`。
- 静态资源 query 统一升级为 `20260709agenticon1`。
- `scripts/smoke-internal-prod.ps1` 增加图标引用断言，防止后续又回退到摄像机图标。

### 验证

- `node --check` 覆盖 `assets/Canvas-B8bY9_QL.js`、`assets/index-DglIsp_g.js`、`assets/HomeIndex-DAjDt0aj.js`、`assets/fixedImageModels-Rg0McL4V.js`。
- `git -C "F:\dianshang" diff --check` 通过。
- 修改文件均为 UTF-8 无 BOM。
- 最终镜像 ID：`sha256:67bb7e40487e02a4c5499f60c82f1d9a7d75a3284f7dd61232cbdfdbfabf4a28`。
- 镜像创建时间：`2026-07-09T05:40:07.418120767Z`。
- 容器启动时间：`2026-07-09T05:40:16.072440369Z`。
- 容器 Health：`healthy`。
- `http://localhost:3456/` 与 `http://192.168.0.39:3456/` 均命中 `index-DglIsp_g.js?v=20260709agenticon1`。
- `assets/index-DglIsp_g.js?v=20260709agenticon1` 命中 `Canvas-B8bY9_QL.js?v=20260709agenticon1`。
- `assets/Canvas-B8bY9_QL.js?v=20260709agenticon1` 返回 200，包含 `icon:gd}],a=l0`，不包含 `icon:oo}],a=l0`。
- `scripts/smoke-internal-prod.ps1` 通过。

### 剩余风险

- 本轮只替换 tab 图标，不改 agent 生成逻辑。
- 已打开的画布页面如果仍显示旧摄像机图标，需要强刷页面或重新进入画布，让浏览器加载 `agenticon1` 入口。

## 2026-07-09 画布恢复图片入口移除复核

### 已确认

- 用户截图中的按钮对应当前 Canvas chunk 顶部工具栏里的 `恢复图片` 按钮，title 为 `一键恢复本地图片`。
- 该入口用途不清晰，且不是当前画布核心生成链路必需入口。

### 处理

- `assets/Canvas-B8bY9_QL.js` 移除恢复图片按钮渲染节点。
- 静态资源 query 统一升级为 `20260709restorehide1`。
- `scripts/smoke-internal-prod.ps1` 增加断言，防止恢复图片按钮入口重新出现在生产 Canvas chunk。

### 验证

- `node --check` 覆盖 `assets/Canvas-B8bY9_QL.js`、`assets/index-DglIsp_g.js`、`assets/HomeIndex-DAjDt0aj.js`、`assets/fixedImageModels-Rg0McL4V.js`。
- `git -C "F:\dianshang" diff --check` 通过。
- 修改文件均为 UTF-8 无 BOM。
- 最终镜像 ID：`sha256:842ed6809d651ac50ff324a45efcdf58575d52f3620e2c5bc146e0fbf3b115db`。
- 镜像创建时间：`2026-07-09T05:59:17.768166901Z`。
- 容器启动时间：`2026-07-09T05:59:26.674911027Z`。
- 容器 Health：`healthy`。
- `http://localhost:3456/` 与 `http://192.168.0.39:3456/` 均命中 `index-DglIsp_g.js?v=20260709restorehide1`。
- `assets/index-DglIsp_g.js?v=20260709restorehide1` 命中 `Canvas-B8bY9_QL.js?v=20260709restorehide1`。
- `assets/Canvas-B8bY9_QL.js?v=20260709restorehide1` 返回 200，不包含 `恢复图片`、`一键恢复本地图片` 和旧按钮 class 模式。
- `agent电商套图` tab 仍保留 `icon:gd}],a=l0` 魔法棒图标。
- `scripts/smoke-internal-prod.ps1` 通过。

### 剩余风险

- 本轮只移除按钮入口，没有删除底层本地图片恢复/授权逻辑，避免误伤图片节点加载。
- 已打开的画布页面如果仍显示旧按钮，需要强刷页面或重新进入画布，让浏览器加载 `restorehide1` 入口。

## 2026-07-09 前端登录态脏数据复核

### 已确认

- 生产入口中的登录态初始化会分别读取 `auth_token` 和 `auth_user`。
- 如果浏览器 localStorage 中只残留 `auth_user`，但没有 `auth_token`，UI 仍可能拿旧用户对象渲染头像/用户名区域。
- 首页不是强制登录页；登录弹窗主要由生成、上传等需要登录动作触发。

### 处理

- `frontend/src/api/auth.ts` 的 `readAuthUser()` 在读取用户前先检查 `auth_token`。
- 没有 `auth_token` 时清理 `auth_user` 并返回 `null`。
- `assets/index-DglIsp_g.js` 的入口登录态初始化同步改为 token 缺失时清理 `auth_user`。
- `index.html` 入口 query 升为 `20260709authstrict1`。
- `scripts/smoke-internal-prod.ps1` 增加入口静态断言。

### 验证

- `npm run check:routes --prefix "F:\dianshang\frontend"` 通过。
- `npm run build --prefix "F:\dianshang\frontend"` 通过。
- `node --check` 覆盖 `assets/index-DglIsp_g.js`、`assets/Canvas-B8bY9_QL.js`、`assets/HomeIndex-DAjDt0aj.js`、`assets/fixedImageModels-Rg0McL4V.js`。
- `git -C "F:\dianshang" diff --check` 通过。
- 修改文件均为 UTF-8 无 BOM。
- 最终镜像 ID：`sha256:f3dbb94f5fca73253546e4b34b41be7deb84925201071d160c727115e016343e`。
- 镜像创建时间：`2026-07-09T06:12:18.658511164Z`。
- 容器启动时间：`2026-07-09T06:12:27.218623096Z`。
- 容器 Health：`healthy`。
- `http://localhost:3456/` 与 `http://192.168.0.39:3456/` 均命中 `index-DglIsp_g.js?v=20260709authstrict1`。
- `assets/index-DglIsp_g.js?v=20260709authstrict1` 返回 200，包含 token 缺失时 `localStorage.removeItem(qn)` 的登录态清理逻辑。
- `scripts/smoke-internal-prod.ps1` 通过。

### 剩余风险

- 内置 Playwright 运行时缺少 `playwright-core`，未执行真实浏览器 localStorage 自动化断言。
- 本轮只收口前端脏登录态，不改变后端 token 校验和登录接口。

## 2026-07-09 画布历史记录提示词复制

### 已确认

- “图片生成历史”弹层由 `assets/ImageHistoryPanel-Dy2o3dPV.js` 提供。
- 历史记录数据已经包含完整 `prompt` 字段，来源包括本地 `ai-canvas-image-history` 和 `/api/user/generations`。
- 当前需求不需要修改后端接口、数据库或真实生图链路。

### 处理

- 每条历史记录卡片新增 `复制提示词` 按钮。
- 复制完整 `prompt`，无提示词时显示轻提示。
- 复制逻辑提供 Clipboard API 与临时 textarea 两级路径。
- 操作按钮行允许换行，避免移动端新增按钮后横向溢出。
- 入口、Canvas 和历史弹层 chunk query 升为 `20260709historycopy1`。
- 生产 smoke 增加历史弹层复制功能静态断言。

### 验证

- `node --check` 覆盖 `assets/ImageHistoryPanel-Dy2o3dPV.js`、`assets/Canvas-B8bY9_QL.js`、`assets/index-DglIsp_g.js`。
- `git -C "F:\dianshang" diff --check` 通过。
- 修改文件均为 UTF-8 无 BOM。
- Docker 已完整重建，最终镜像 ID：`sha256:74cb8f83d6b7b117557fdcbf90d8a2cb133cf16825f908ba70cac3c6226bb33c`。
- 镜像创建时间：`2026-07-09T06:29:40.397396808Z`。
- 容器启动时间：`2026-07-09T06:29:48.925365595Z`。
- 容器 Health：`healthy`。
- `http://192.168.0.39:3456/` 命中 `index-DglIsp_g.js?v=20260709historycopy1`。
- 生产入口命中 `Canvas-B8bY9_QL.js?v=20260709historycopy1` 和 `ImageHistoryPanel-Dy2o3dPV.js?v=20260709historycopy1`。
- 生产历史弹层 chunk 包含 `复制提示词`、`提示词已复制` 和 `navigator.clipboard.writeText`。
- `scripts/smoke-internal-prod.ps1` 通过。

### 剩余风险

- 本轮只做静态 chunk 交互热修，不触发真实生图、真实 Provider 调用或真实扣费。
- 已打开的画布页面需要强刷或重新进入画布后才能加载新 query。

## 2026-07-10 模板 UI 复核

### 已确认

- 3456 当前模板路由由打包资产工作台提供，源码模板页暂不是普通前台路由的生产 fallback。
- 模板画廊左侧清单和主卡片区重复展示同一批 10 个模板；1440 下主卡片区只能显示 3 列，移动端重复清单先占约 190px。
- 源码模板页受全局 Naive UI 深色主题影响，浅色表单中的输入文本和占位文本对比度不足。

### 处理

- 当前运行画廊隐藏重复清单，以视觉模板卡片作为唯一主选择入口；压缩卡片并优化 1440/1024/390 三档密度。
- 当前运行编辑区重新分配四栏宽度；1180 以下模板切换列表改为横向滚动，不再纵向占满首屏。
- 源码模板页局部恢复亮色组件主题，并重做顶部栏、模板选择、素材区、生成设置、空态和操作区。
- 模板覆盖 CSS query 升为 `20260710gallery2`，生产 smoke 断言同步更新。

### 验证

- `npm run build --prefix "F:\dianshang\frontend"` 通过。
- `npm run check:routes --prefix "F:\dianshang\frontend"` 通过，22/22 源码路由维护检查通过。
- 浏览器实测当前画廊：1440 为 4 列、1024 为 3 列、390 为 1 列，重复侧栏为 `display:none`，无横向溢出。
- 浏览器实测当前编辑区：1280 列宽为 `166px 318px 514px 146px`；1024 和 390 的模板列表为横向滚动，页面无横向溢出。
- 模板卡片点击进入对应模板成功；源码页模板切换成功；浏览器控制台无 error/warn。

### 剩余风险

- 本轮未执行 Docker 重建，3456 生产容器尚未同步 `20260710gallery2`。
- 本轮未上传真实素材、未触发提示词反推、真实生图、Provider 调用或扣费。
- 当前模板封面仍以统一示意图为主，尚未接入后台可维护的真实案例封面。

## 2026-07-10 LibreChat 单域名集成阶段复核

### 已确认

- LibreChat `v0.8.6-rc1` 原生支持由 `DOMAIN_CLIENT` 派生 `<base href>`、Router basename 和 Agent Skills；当前补丁只承担主站 SSO、返回首页和必要白标，没有长期散改上游源码。`v0.8.3` 经源码复核不含 Skills，因此没有继续使用。
- 主站与聊天职责保持隔离：主站继续拥有用户、余额、Provider、生图和生成历史；LibreChat 负责聊天记录、Agents 与 Skills。
- 正式部署使用基础 Compose 加 `docker-compose.chat-production.yml` 覆盖：app 不映射宿主机端口，gateway 独占 `3456`；回滚时仍可只启动基础 Compose 的 app。
- 新桥接接口均位于 `/api/integrations/librechat/*`，旧 `/api/chat/completions` 没有改成新协议；画布和现有 `/api/*` 路由未迁移。

### 已验证

- `node --check server.js`、LibreChat 补丁脚本语法、两份 Compose `config --quiet` 通过。
- 一次性本地服务验证：票据可消费一次、重复消费 401；文本 mock 非流式与 SSE 正常；错误服务密钥 401；MCP 可发现两个生图工具，报价后使用下一消息确认可生成 mock 图片并写入现有历史。
- 首页“AI 对话”按钮通过 Playwright 桌面截图检查，布局与现有导航一致；用户中心路由未出现该按钮。
- LibreChat `v0.8.3` 的上游依赖安装、数据包构建和 Vite 前端编译成功，但源码复核确认它不含 Skills，因此该构建结果已废止；当前固定的 `v0.8.6-rc1` 仍需重新完整编译。

### 阻塞与风险

- Docker 在导出 LibreChat 最终镜像时报告 `/var/lib/desktop-containerd/... input/output error`；随后 Docker 内容库读取 blob 也报 I/O 错误。宿主机 `C:` 盘为 0 GB，可回收构建缓存约 20.7 GB。
- 在获得“只清理 Docker 构建缓存”的确认并完成 3457 实跑前，不把 Docker、子路由刷新、自动浏览器 SSO、Skills UI 和聊天故障隔离记为通过。
- 当前未切换 3456，未执行真实 Provider 或真实付费调用。

## 2026-07-10 `/chat/` 直连蓝屏复核

- 复现：当前 app 直连 `3456` 访问 `/chat/` 时返回主站 `index.html`，Vue Router 没有聊天路由，页面 DOM 为空，只显示深色全局背景。
- 修复：在 SPA fallback 前增加聊天路径兜底；`/chat`、`/CHAT`、`/CHAT/` 返回 308 到 `/chat/`，`/chat/` 和聊天子路由在网关未启动时返回 503 状态页。
- 隔离：规则不匹配 `/api/*`、`/assets/*`、首页、后台或画布；统一网关上线后 `/chat/*` 在 Nginx 层被接管，不会进入 app 兜底。
- 预览：`http://127.0.0.1:3463/chat/` 已确认显示启动提示和“返回首页”，不再为空蓝屏；正式 `3456` 本轮未重启。

## 2026-07-10 LibreChat 容器与浏览器验收复核

### 已确认

- Docker WSL 数据盘已迁到 `F:\DockerDesktopData\wsl`，C 盘原路径为 junction；迁移后原有容器、镜像和数据卷未丢失。
- LibreChat `v0.8.6-rc1` 使用官方固定源码包和 SHA-256 校验构建，不再在 Dockerfile 内浮动克隆 GitHub。
- 测试端口参数化后，本轮使用 `3464`，没有停止占用 `3457` 的旧参考容器，也没有切换正式 `3456`。

### 已验证

- `dianshang-chat-test-app-1`、`chat-mongodb-1`、`librechat-1`、`gateway-1` 均为 healthy。
- `/`、`/api/health`、`/chat/`、`/chat/c/new`、`/gateway-health` 均返回 200；`/chat`、`/CHAT`、`/CHAT/` 均 308 到 `/chat/`。
- `scripts/smoke-librechat-integration.ps1 -BaseUrl http://127.0.0.1:3464` 全部通过，覆盖 SSO 单次消费、模型桥接、MCP 工具、错误密钥和用户隔离。
- 应用内浏览器登录测试用户后进入 `/chat/c/new`，Skills 面板可打开，返回首页按钮存在，控制台无 error。

### 剩余风险

- 主站登录页目前登录成功后进入用户中心，不自动消费查询参数 `redirect=/chat/`；已登录后再次进入 `/chat/` 可自动完成 SSO。该体验问题不阻塞当前聊天页面和 SSO 链路，但正式切换前应决定是否补回登录后重定向。
- 本轮只验证 mock/隔离链路，没有执行真实文本、真实生图或真实扣费；正式 `3456` 尚未切换统一网关。

## 2026-07-10 LibreChat 中文与后台边界复核

- `zh-Hans` 原文件缺少 Skills 新功能词条，导致已有中文界面在 Skills 区回退到英文；本轮通过结构化 JSON 补丁补齐，不直接修改缓存中的上游源码。
- 全新源码补丁校验、LibreChat 镜像构建、四容器健康检查、完整 SSO/MCP smoke 和浏览器 DOM 检查通过；locale bundle 包含“技能 / 创建技能 / 我的技能 / 暂无技能 / 控制面板”。
- 当前同步含义：主站用户 ID/邮箱会映射成独立聊天账号，模型、余额、计费和生图调用由主站后端负责；聊天记录、消息和 Skills 存在 LibreChat MongoDB，不会自动出现在现有管理后台列表。
- `3464` 使用独立测试数据库，截图中的 `chatpreview...@local.test` 仅为测试账号；正式 `3456` 尚未部署统一网关，因此不能称为已同步到生产后台。

## 2026-07-10 LibreChat 登录回跳与 Skills 隔离复核

### 已验证

- 未登录进入 `/chat/` 会跳到主站 `login?redirect=/chat/`，主站登录成功后自动进入 `/chat/c/new`；回跳逻辑只允许 `/chat` 和 `/chat/*`，不接受外部 URL。
- `3464` 使用 `ENABLE_REAL_AI=false` 完成一轮聊天，消息写入独立会话并得到本地 mock 回复。
- 用户 A 创建私有 Skill 后切换到用户 B，用户 B 列表为“暂无技能”，未出现用户 A 的 Skill，跨用户隔离通过。
- 聊天页“注销”只清聊天会话；主站 token 尚在时再次进入聊天会自动 SSO。主站“退出登录”后再访问聊天则回到主站登录页，行为符合双会话边界。
- 更新后的 `scripts/smoke-librechat-integration.ps1 -BaseUrl http://127.0.0.1:3464` 全部通过；四个测试容器均为 healthy，正式 `192.168.0.39:3456` 首页和健康接口保持 200。

### 剩余风险

- 浏览器验证覆盖私有 Skills，尚未验证管理员公共 Skill 发布及普通用户可见性。
- 真实 Provider、真实生图、真实扣费和正式 `3456` 网关切换仍未执行，需要单独确认后验收。

## 2026-07-10 Chat 后台设置复核

### 已确认

- 环境变量、MongoDB 和内部密钥继续由 Docker 管理；后台只提供状态，不返回明文，也不伪装成可即时保存的配置。
- 可热更新策略独立保存在 `admin.chatSettings`，不修改旧 `/api/chat/completions`、模板、画布或现有生图入口。
- 连接测试只访问内部 `/health` 和本地配置，不调用 Provider，不产生扣费。

### 已验证

- 页面保存测试值后立即回显，并已恢复原维护提示；连接测试五项全部通过。
- 访问、文本和 MCP 开关分别约束 SSO、模型桥接和 MCP 路由，状态码为 503/403/403；恢复原值后完整 LibreChat smoke 通过。
- 源码前端 23/23 路由、typecheck/build、后端语法、API disposable smoke、390px 无横向溢出和浏览器控制台检查通过。

### 剩余风险

- 管理员公共 Skill 发布仍需单独做角色权限验收；本页只展示当前固定策略。
- 正式 `3456` 尚未部署该后台页面，真实 Provider、真实文本扣费和真实生图未执行。

## 2026-07-10 Chat 真实中转复核

### 已验证

- 未确认真实调用时 `/api/admin/chat/test-provider` 返回 400；常规集成 smoke 不产生 Provider 请求。
- 主站已配置 GPT 5.5 官转线路的 `/responses` 请求返回 200；后台真实测试最终返回 `OK` 并报告 Responses 协议和 Token 用量。
- LibreChat 文本桥接把 Chat 消息转换为 Responses 消息数组，再把结果转换为 SSE；真实请求返回 `OK` 和 `[DONE]`。
- 测试管理员余额从 999999 变为 999994，最新 `chat_text_charges` 为 `gpt-5.5 / 5 / completed`，余额日志为 `AI 对话: gpt-5.5`。

### 风险

- 官转线路会附加较长的上游上下文，本次后台真实测试报告 6592 total tokens；后续不要把真实测试加入普通 smoke。
- 工具调用已做 Responses 到 Chat `tool_calls` 转换，但真实 MCP 生图仍未执行；该操作需另行确认费用。
- 正式 `3456` 没有同步本轮代码和真实 Provider 配置。

## 2026-07-10 Chat 后台浅色控件复核

### 根因

- 根 `App.vue` 使用 Naive UI `darkTheme`，Chat 后台虽然是浅色布局，但输入、Select、Alert 和多选 Tag 继续继承深色主题变量，导致白字落在白色或浅色背景、默认边框透明。

### 已验证

- 修复前：输入文字 `rgba(255,255,255,.82)`、背景 `rgba(255,255,255,.1)`、边框变量 `1px solid #0000`；Alert 正文同样为白色。
- 修复后：输入文字 `rgb(15,23,42)`、背景白色、边框 `1px solid #b8c7d1`；真实调用警告正文 `rgb(124,45,18)`；顶部提示正文 `rgb(30,58,138)`；模型标签 `rgb(6,95,70)`。
- 浏览器 computed-style 断言和生产 CSS bundle smoke 通过，页面横向溢出为 0，未触发真实 API 调用。

## 2026-07-13 Chat 内置 MCP Endpoint 回归复核

### 根因

- `buildEndpointOption` 使用 `req.body.endpointOption = await builder(...)`。JavaScript 会在等待 builder 前保留左侧旧对象引用；内置 MCP 补丁在 builder 内整体替换 `req.body` 后，endpoint 配置被写入旧对象，Agent 从新对象读取时得到空值。
- LibreChat MCP 起初还因私网 SSRF 门禁拒绝 `http://app:3456`。精确加入 `allowedAddresses: ['app:3456']` 后，域名拒绝消失，没有放宽其他私网地址。

### 已验证

- 回归检查在修复前以 `Built-in MCP patch must preserve req.body` 失败，修复后同一检查通过。
- 固定 LibreChat 源码包重放补丁、生成文件语法检查和完整 Docker 前端构建通过；测试容器健康，镜像为 `sha256:853fe7c27958e7c620e08b6503cfbd3f659a41cce57779b94120212649bc9c82`。
- 用户级 SSO 会话重连 `hajimi-website` 成功，`oauthRequired=false`，工具列表包含 `prepare_image_generation` 与 `execute_image_generation`。启动时共享连接显示 0 tools 是动态用户头无法在无用户上下文中解析，不作为用户链路失败判据。
- 页面隔离探针在文本桥接关闭时返回预期 403，容器新日志没有 `Endpoint option not provided`；设置已恢复开启，预览账号余额仍为 100。

### 剩余边界

- 本轮不执行真实 Provider 或真实生图，未验证模型实际选择 MCP 工具后的报价交互；该人工验收会使用测试账号 100 点额度，需由用户主动继续。
- 正式 3456 未部署 Chat 网关，本轮只更新 3464 的 LibreChat 测试容器。

## 2026-07-13 Chat 文生图与图生图修复复核

### 根因

- LibreChat 图片落盘目录是 `/app/client/public/images`，原 Compose 只挂载 `/app/uploads`，所以重建容器后旧附件路径仍留在 MongoDB、文件本体却消失并触发 `ENOENT`。
- 当前消息附件没有进入 MCP 请求上下文，`prepare_image_generation` 只能依赖模型主动生成 `referenceImages` 参数，图生图可能被误判为文生图。

### 已验证

- 正式与测试 Compose 都增加图片持久卷；迁移当前附件后强制重建 LibreChat，文件仍存在且 SHA-256 一致。
- LibreChat 服务端提取当前消息最多 4 个附件路径，经 `X-Chat-Reference-Images` 动态头传入主站；主站只把受控 `/images/*` 地址转换为内部 LibreChat URL，并在报价中记录模式和参考图数量。
- 假 Provider 回归实际收到一次 `/v1/images/generations` JSON 和一次 `/v1/images/edits` multipart，同时验证报价、确认、扣费、历史与一次性消费；完整 Chat smoke 和旧 API disposable smoke 全部通过。
- 3464 三个对外相关容器均 healthy，聊天子路由、SSO、模型桥接、MCP 工具和静态资源隔离通过；测试账号余额仍为 95，本轮没有真实 Provider 消耗。

### 剩余边界

- 已经在旧无卷容器中丢失的第一张附件无法恢复，用户需要重新上传；当前第二张附件已迁移并持久化。
- 真实 Provider 图片输出仍需用户发送一条新消息完成付费人工验收；此前并发上限失败的消息已退款，不能直接点击重试。
- 正式 3456 未重建、未切换 Chat 网关。

## 2026-07-13 Chat 图片 Base64 泄漏复核

### 根因

- `responsesToChatCompletion()` 复用了面向多种 Provider 的宽松文本提取器；当 Responses 输出项为 `image_generation_call` 时，递归读取 `result`，将 PNG Base64 误认成回答文字。
- 带图“左右拉长”被文本模型直接执行，绕过网站 MCP 报价、确认、10 点图片计费和 `generations`，因此页面虽拿到真实图片字节，却无法显示为图片。

### 已验证

- 现有 Mongo 消息 Base64 解码为有效 PNG，签名 `89504e470d0a1a0a`，不是错误文本；测试账号因此前旧版本请求扣除 5 点，余额从 95 变为 90。
- 带图编辑回归在修复前返回 `stop + Base64`，修复后返回 `tool_calls + prepare_image_generation`；发给文本 Provider 的 input 不再含 `input_image`。
- 无工具兜底场景模拟上游原生图片输出，响应不含 Base64，文本预扣状态为 `refunded`；图片 Provider `b64_json` 场景则落盘为 `/uploads/generated/<sha256>.png`，字节与上游完全一致。
- 最终镜像、容器健康、完整 3464 smoke、旧 API smoke、正式 3456 首页和健康接口均通过。

### 剩余边界

- 当前会话里旧的 247 万字符消息仍是历史数据，修复不会自动改写 MongoDB；请新开消息测试，避免继续重试旧回复。
- 本轮未对真实账号自动退款或改余额；如需补回旧错误请求的 5 点，需要用户明确授权后台调整。
- 正式 3456 未部署本轮 Chat 代码。

## 2026-07-13 Chat 首页托管智能体复核

### 结论

- 托管智能体配置归属主站后台，Chat 用户端只读，未另建一套智能体数据库或开放普通用户修改系统指令。
- 首页卡片使用 LibreChat 原生 `ephemeralAgent`、`promptPrefix` 和 Skills 队列，不是只向输入框填一段角色提示词；会话提交时由既有 Agent/MCP 链路处理。
- 4 个默认智能体、目录登录门禁、后台保存回显、Skills 选择和生图能力开关均有静态或实际验证覆盖。

### 剩余边界

- 本轮只部署到 3464 隔离测试栈；正式 3456 仍未切换统一网关。
- 未执行真实文本或图片生成，智能体回答质量与默认系统指令仍需用户后续按业务效果调整。
## 2026-07-14 账号 731241492 密码重置复核

- 生产数据库中的 `731241492` 账号存在、状态为 active；密码使用哈希保存，无法读取原明文。
- 按用户明确要求设置新密码，维护记录不保存明文密码。
- 数据库备份：`docker/data/backups/data.db.before-password-reset-731241492-20260714-023059.db`。
- 正式重置接口返回成功；生产登录接口返回 200，用户资料接口确认账号映射正确。
- 未修改管理员密码、用户角色、余额或其他业务数据。
## 2026-07-14 生图 Provider TLS 安全重试复核

- 正确原因：当前截图错误发生在 TLS 握手完成前，请求体尚未发送，有限重试不会造成重复生图。
- 重试边界严格限定为握手前断开；`socket hang up`、超时及上游业务错误保持原有失败行为。
- 文生图 JSON 请求体可安全复用；图生图 multipart 请求体在每次尝试时重新构造。
- 测试覆盖确认最多 3 次总尝试，非目标错误只有 1 次尝试。
- `3464` 镜像、容器健康和集成 smoke 通过；正式 `3456` 未发布，未进行真实付费调用。

## 2026-07-14 画布操作性能第一轮复核

### 已确认

- 当前运行对象仍是唯一 `/canvas` 画布，没有新增画布实现、引擎或依赖。
- 优化前拖拽和缩放后的延迟尖峰来自本地快照与持久化，测试期间没有中转或 Provider 网络请求。
- 新结构克隆对代表性节点、数组、`undefined`、`NaN` 和日期的结果与原 JSON 快照一致，并隔离根对象、节点数组和节点数据对象。
- 拖拽离开关键路径后，切项目、离开画布和组件卸载仍调用立即保存，未删除数据安全兜底。
- 项目存储仍先执行现有 `mt/ft` 清洗，移除的只是清洗后冗余的 JSON 二次深拷贝，工作流 JSON 结构未改。
- 生产 smoke 已直接读取 `20260714opperf1` 资源并断言旧深拷贝和同步拖拽保存锚点不存在；旧入口隔离状态保持 410/404。

### 量化结果

- 9 张图片、65.15MB 文本载荷：旧快照中位 140.69ms、堆增量约 195.45MB；新快照中位 0.04ms、堆增量约 0.02MB。
- Docker 镜像 `sha256:3f2186238ec115c5bca559c8604547e40c6f80f694108dc17f3fc7607ae6c7fa`，创建时间 `2026-07-14T04:38:00.630175903Z`；容器启动时间 `2026-07-14T04:38:41.325060589Z`，健康状态 healthy。

### 未覆盖风险

- 生产复测页成功恢复 10 节点、9 图片节点，但双开同项目造成两个大图页面同时驻留，污染了操作期指标；重复页已清理，不能据此声称优化后拖拽手感已经人工通过。
- 下一轮必须在只保留一个生产画布页的条件下，按相同动作补测拖拽往返、缩放往返和连续悬停，并与优化前 1.039 秒任务/0.703 秒脚本基线对比。
- Base64 大图常驻内存仍是第二阶段问题；本轮只减少复制和关键路径阻塞，没有迁移图片资产格式。
- 本轮未触发任何真实中转或模型调用。

## 2026-07-14 画布操作性能最终复核

### 已确认

- 生产页命中 `20260714opperf2` 的入口、Canvas 和项目数据 chunk；最终 Docker 镜像为 `sha256:5ed20315d951fbfe34285a32366221bbe96f72aee8735164944179641623fb61`，容器 healthy。
- 节点拖拽和视口变化只走轻量布局补丁，完整保存、切项目、离开画布和删除项目的原有数据安全边界保留。
- 单页 Playwright 反馈环使用 10 节点、9 张 2528×1696 图片和 80% 缩放；测试写入与生成请求均从首次导航前拦截。

### 量化结果

- 节点拖拽往返精确复位，松手后稳定耗时 39.28/24.22ms；平移往返精确复位，稳定耗时 30.14/31.96ms；缩放往返精确复位，稳定耗时 30.39ms。
- 三类操作及连续悬停期间长任务均为 0；保存定时器漂移约 1ms；页面错误、控制台错误和生成请求均为 0。
- 服务端项目 `data` 与 `updated_at` 前后完全一致，确认隔离复测没有改写生产项目。

### 结论与剩余边界

- 优化前松手后约 0.6–1 秒的主线程阻塞已不再出现；当前重图单页下释放后约 1–2 帧稳定，操作手感验收通过。
- 9 张大图仍会带来约 331MB 的浏览器 JS 堆占用；这是常驻内存治理问题，不是本轮拖拽、平移和缩放延迟的阻塞项。
- 本轮未触发真实中转、文本模型、图片模型或付费调用。

## 2026-07-14 画布大图常驻内存复核

### 已确认

- 生产数据库与 workflow JSON 只有约 14KB，不含大 Base64；大字符串在浏览器本地图片资产恢复后进入运行态。
- `projects-BtxGnToV.js` 的去重只在单次项目加载树内生效，Map 在遍历完成后即可回收；没有新增全局缓存，也没有改变 JSON 内容、图片字段或保存协议。
- 回归断言覆盖：相同大图别名归一、不同图片不合并、JSON 串前后完全一致、项目恢复入口确实调用去重函数。
- 生产资源命中 `20260714opperf3`；镜像 `sha256:8a7b16835e221c62fdb467baed74d4492a0ed55f00ac6747c6a78f2a2112ffe4` 与容器均已核验，线上文件 SHA-256 与主工作区一致。

### 量化结果

- CDP 连续三次强制 GC 后，JS 堆由 `210175460` 字节降至 `20717148` 字节，减少约 90.14%；backing storage 从 `46044524` 降至 `41639515` 字节。
- 9 张 2528×1696 图片全部加载，图片 src 总字符数 `39655125` 不变；DOM 为 2 个 document、4916 个节点、2306 个监听器，前后完全一致。
- 修正审计脚本后真实拖动可见 `node_3` 40px 并复位；拖拽、平移、缩放和连续悬停均无长任务、无页面错误、无控制台错误，生产项目未写入。

### 结论与剩余边界

- 本轮消除了可证明的 Base64/data URL 重复字符串常驻，JS 堆问题已显著缓解，操作性能没有回退。
- 解码位图、浏览器图片缓存和 GPU 显存仍会计入浏览器进程总内存；若后续还要继续降低任务管理器数值，应进入图片分辨率/缩略图和离屏解码资源释放方案，不能再靠 JS 字符串去重解决。
- 本轮未触发中转、Provider、模型或付费调用。

## 2026-07-14 画布 1024px 预览与内存门禁复核

### 已确认

- 当前唯一 `/canvas` 已接入 1024px WebP 常态预览，选中、编辑、下载和显式原图请求仍使用原图；运行时 URL、缓存和引用状态不会进入工作流 JSON。
- 预览池实现 24 个闲置上限、30 秒 TTL、最多 2 张并发转换、离开画布统一撤销；本地素材索引只扩展 `previews.w1024`，没有升级索引版本或批量改写旧素材。
- 固定 10 节点、9 大图的像素解码估算从 163.55MiB 降到 24.15MiB，强制 GC 后 JS 堆为 16.19MiB；选中切换原图、取消恢复、离屏释放和返回缓存恢复均通过。
- 拖拽、平移、缩放准确复位，稳定耗时 23.25–35.26ms，操作期长任务为 0；生产项目未写入，所有生成请求均被拦截。
- 静态断言、语法检查、前端构建、画布边界 smoke、完整 Docker 重建、生产 smoke、三页面直连、资源哈希和旧资源 410/404 已通过。当前生产镜像为 `sha256:6813e03c38d389c39f7e221264352225e1bc14561c9475c0120d68b1bcab9bd4`，容器 healthy。

### 未通过门禁

- Renderer + GPU 私有内存中位数未下降 30%，反而从 776.05MiB 升至 1267.52MiB；Working Set 从 1042.90MiB 升至 1425.94MiB。因此本轮只能确认像素解码、JS 堆和操作性能达标，不能确认进程私有内存目标完成。
- 已按失败分支采集 `output/playwright/canvas-memory-infra-trace.json.gz`。轨迹中 Renderer 强制 GC 后 allocator-accounted private footprint 约 223MiB，主要剩余包括 `partition_alloc`、V8、`cc/image_memory` 约 58.40MiB，以及两个约 16.36MiB 的完整原图光栅缓存项；GPU 侧 `shared_images` 约 36.91MiB、资源内存约 20.19MiB。
- 下一步应围绕 Chromium 原图解码缓存和预览转换发生位置做专项验证，不能用已达标的 JS 堆代替 Windows 进程私有内存门禁。本轮未调用中转、Provider、模型或付费接口。

## 2026-07-15 上线阻塞项安全复核

### 已确认

- 旧 `/api/auth/send-reset-code` 已按账号直重置方案统一关闭，返回 `410 RESET_CODE_FLOW_DISABLED`；不生成六位验证码，stdout/stderr 不记录邮箱或重置码。
- 任意未签名代理地址返回 `403 IMAGE_PROXY_FORBIDDEN`；正确签名的 `127.0.0.1` 和 `localhost` 仍返回 `403 IMAGE_PROXY_PRIVATE_ADDRESS`。项目 JSON 中写入代理 URL不会获得签名或兼容权限。
- 历史无签名兼容只来自 `generations.result_url`，仍会再次执行地址安全检查；生成历史响应升级为签名 URL，旧记录可继续按升级后的 URL 删除。
- 只读生产库 `quick_check=ok`。4 个项目、35 条生成记录含旧代理 URL；项目 JSON 中识别出的 49 处目标全部能在生成记录中找到，不需要生产数据迁移。
- 备份脚本 PowerShell 语法通过；未传 `-ConfirmMaintenanceWindow` 会在任何 Docker 操作前拒绝，避免误停生产。

### 验证结果

- `node --check server.js`：通过。
- `node --check scripts/test-launch-security-guards.js`：通过。
- `node scripts/test-launch-security-guards.js`：通过，输出 `resetCodeFlow=disabled`、`directPasswordReset=user-only`、`unsignedProxy=IMAGE_PROXY_FORBIDDEN`、`privateProxy/localhostProxy=IMAGE_PROXY_PRIVATE_ADDRESS`、`projectSigningOracle=blocked`、`legacyProxyAllowlist=validated`。
- `node scripts/test-sqlite-backup.js`：通过，备份 `quick_check=ok`、`integrity_check=ok`，25 行探针数据完整。
- `scripts/backup-internal-prod.ps1` PowerShell Parser 与维护窗口拒绝门禁：通过。
- `scripts/smoke-api-disposable.ps1`、`scripts/smoke-backend-canvas-boundary.ps1`、`scripts/test-provider-pre-tls-retry.js`、`scripts/check-packy-gpt-image-adapter-coverage.js`：通过；均使用临时库或静态/假 Provider 验证，没有修改生产注册、兑换码、项目或余额。

### 未覆盖风险

- 用户已确认当前工作区全部改动纳入本次发布；正式一致性备份、完整镜像重建、容器健康、3456 直连和旧资源隔离均已通过。
- 真实 Provider 生图尚未调用，本轮没有产生 Provider 费用；如需额外做付费冒烟，仍应单独确认。

## 2026-07-15 内网账号直重置复核

### 已确认

- 当前找回密码契约为 `username + newPassword`，不再依赖邮箱或验证码；新密码少于 6 位会被拒绝。
- 普通用户重置后可使用新密码登录；公开入口拒绝管理员账号，不影响受管理员保护的后台重置接口。
- 旧登录弹窗实际运行资产只显示用户名、新密码、确认新密码，邮箱和验证码均被禁用并隐藏；注册表单既有逻辑和兑换码实现没有修改。
- Playwright 隔离浏览器使用临时账号和临时数据库完成端到端验证，页面返回登录态后新密码登录成功，浏览器控制台 0 错误。
- `node --check server.js`、桥接脚本语法、专项安全回归均通过；旧重置码流程关闭和图片代理安全断言继续通过。

### 风险与发布边界

- 该方案无法证明操作者是账号本人，知道用户名即可重置；这是用户为小范围内网分发明确接受的便利性取舍，不能用于公网。
- 正式 `192.168.0.39:3456` 已完整重建，镜像 `sha256:73e9e0eea09d2d3d890ac6a12d65d8f07b7c3047fb2b124c4e905d4999be80cf`、容器 healthy；生产 smoke、三个主要页面直连、旧资源隔离和账号直重置契约均通过。
- 隔离浏览器已确认线上找回密码表单只显示用户名、新密码、确认密码，控制台 0 错误。已有打开的旧页面需要刷新一次以加载 `20260715directreset1`。
## 2026-07-15 Windows Docker 迁移复核

- 复核结论：当前 SQLite + 文件存储足以支撑小范围内网并迁移到单台 Windows Docker 服务器，现阶段没有必须提前引入 Postgres 或 S3/MinIO 的阻塞项。
- 发现并修正一致性缺口：原备份流程在数据库备份后先恢复容器、再压缩工作流/图片/日志，存在时间点不一致风险；现全部采集完成后才恢复服务。
- 恢复安全门禁：确认参数、格式版本、相对路径、制品字节数/SHA-256、ZIP 路径、`.env` 指纹、空目标目录、SQLite 两项完整性检查。
- 验证：PowerShell 语法解析通过；临时 Windows 目录恢复演练通过；`.env` 指纹不一致、重复恢复和篡改包均按预期失败。未在真实服务器执行恢复，无宿主机 Node.js 的 Docker 校验回退和 `-StartApp` 分支留待迁移窗口结合服务器 Docker 实测。
- 边界：主站图片文件在 `docker/uploads`，元数据在 SQLite；用户确认备份只保留在本机 `docker/backup`，不做云端/NAS/对象存储同步。可选 Chat 命名卷尚未纳入主站迁移包。

## 2026-07-15 图库与生成图片本地化复核

### 根因

- `/gallery` 仍由根旧入口处理，而该入口不含 `GallerySource` 动态 chunk，导致 URL 和 HTML 均为 200 但 Vue `RouterView` 为空。
- `normalizeTaskImage` 只会把 Base64 写入 `/uploads/generated`；Provider 返回 URL 时直接签名代理并写入 `generations.result_url`。正式历史中的 7 张 Packy 外链现已由源站返回 404，证明外链不是可靠持久化。
- 成功远程响应还暴露 `readProxyImageBody` 仅支持 Web Stream，而项目实际 `node-fetch` 返回 Node Stream。

### 修改

- `/gallery` 单独切到源码入口；图库增加失效图片占位并移除错误的 `127.0.0.1` 旧版链接。
- 增加 Provider URL 下载、图片魔数校验、SHA-256 去重落盘和外链写库硬门禁；全部现有生图/编辑调用点在扣费与写历史前完成落盘。复用既有 SSRF、重定向、端口、类型和大小限制。
- 代理响应体读取兼容 Web Stream 与 Node Stream；生产模式始终禁止私网 Provider 图片持久化，测试私网开关仅在非生产假 Provider 回归中生效。
- 生产 smoke 增加 `-ReadOnly`，在用户明确要求不动兑换码时跳过临时增删，但保留读取与权限检查；增加源码图库入口断言。

### 验证

- 修复前 URL 假 Provider 回归返回 `/api/proxy-image?...` 并按预期失败；修复后 Base64 与 URL 两条链路均写入 `/uploads/generated/<sha256>.png`，文件字节一致，两条 `generations` 记录和两笔扣费正确。
- `node --check server.js`、`npm run build --prefix frontend`、`scripts/test-launch-security-guards.js`、`scripts/smoke-api-disposable.ps1`、`scripts/smoke-internal-prod.ps1 -ReadOnly` 均通过。
- 正式镜像 `sha256:f15acd6c47de5d45314f100059624343f8dbefec0f5a82e698d23cb313907f22`、容器 healthy；图库真实浏览器结果为 10 卡片、3 张已加载图片、7 个失效占位，无错误旧版链接。未调用真实 Provider，未修改注册或兑换码实现及生产数据。

### 剩余边界

- 7 张已经被 Packy 删除的旧图无法从当前 SQLite 或外链恢复；本轮保留历史元数据，不伪造、不删除。后续若找到原文件，可另做一次受控导入。
- 正式 `/chat/` 仍为 503 启动提示，启用统一 Chat 网关需要单独确认 Docker 服务切换。

## 2026-07-15 明日上线门禁复核

### 发现与修复

- 发现 Dockerfile 只复制本机 `frontend/dist`，但该目录被 Git 忽略；新服务器仅凭源码无法稳定复现后台和图库。改为多阶段源码构建，并用 `.dockerignore` 排除宿主机 dist，干净构建验证通过。
- 发现后台订单、Dashboard 线路统计和历史任务存在演示或固定字段，会让管理员把推算值当真实运营数据。后端改为只返回可追溯字段，源码后台同步显示不可用或未记录提示。
- 发现管理员密码重置响应返回明文新密码。更新逻辑保留，响应已脱敏，并用临时生产服务验证新密码仍可登录。
- 发现首页无论 Chat 是否部署都会插入入口。新增不含敏感信息的公开状态接口，脚本请求失败或 `accessReady=false` 时不插入入口，登录回跳同样受门禁控制。
- 发现当前工作树大量未提交，不适合人工挑文件迁移。新增源码 ZIP 与文件级 SHA-256 清单，安全回归确认排除密钥和持久化数据。

### 验证与生产状态

- 所有隔离测试、前端 build、Windows 恢复演练、源码包测试和 Docker `--no-cache` 构建通过；无真实 Provider 请求。
- 正式镜像 `sha256:0ee3306d842471e418c1265e91f7dbe5d38060dc87db1f6e557dd40be255f065`，容器 healthy；生产只读 smoke 通过，旧资源仍为 410/404。
- 直接请求 `/`、`/canvas`、`/user/center`、`/gallery`、`/admin/login`、`/api/health`、`/api/chat/status` 均为 200，`/chat/` 为预期 503。Dashboard、订单、任务生产 API 命中新契约。
- Playwright 独立会话确认首页侧栏未显示不可用 Chat 入口；Dashboard 有数据质量提示，订单为支付关闭空态，任务显示线路/规格未记录；API 请求均为 200，控制台错误 0。
- 生产 SQLite `quick_check=ok`，用户/项目/生成数量为 9/17/57；注册、兑换码和生产内容数据未改。

### 尚未执行

- 最终格式 v2 数据迁移包需要短暂停止 app，等待明确维护窗口确认。
- `@modelcontextprotocol/sdk 1.17.0` 官方审计为高危，修复版本 `1.29.0`；当前 Chat 关闭，不作为主站核心阻塞，但正式启用 Chat/MCP 前必须经依赖升级确认并完成回归。

## 2026-07-15 服务器生图与自动下载复核

### 根因与修复

- 后端已经把新生图保存到 `/uploads/generated`，但画布仍调用旧的“保存到用户本地文件夹”助手；在 `192.168.0.39` 的 HTTP 环境中浏览器不提供 File System Access API，该助手自动退化成 `<a download>`，造成每次生成后弹出浏览器下载。
- 只修改生成图保存助手的无本地文件夹分支为 `server` 模式，并让画布把该模式视为正常服务器持久化结果。用户明确点击的图片下载、视频下载和格式转换下载代码未移除。
- 当前画布只有打包资产可用于生产，因此增加精确字符串计数和幂等校验脚本，并在 Docker 构建阶段执行；未另起第二套画布，也未改注册或兑换码。

### 验证与边界

- 生产资源包含 `clientAutoDownloadDisabled` 标记且已不存在生成图的自动 `pe(blob, fileName)` 降级；独立 Playwright 会话监听下载事件，调用真实线上模块读取已有服务器图片后得到 `mode=server`、下载数 0、控制台 0 错误。
- 后端假 Provider 回归确认生图文件字节落盘、历史和计费链路正常；生产只读核对确认 9 个本地图片引用全部存在。没有执行真实生图或产生 Provider 费用。
- 17 个当前项目均有匹配工作流文件；4 个历史工作流文件与 3 个图片文件当前无数据库引用，可能来自已删除项目或历史生成，本轮保留以避免误删。35 条旧代理生成记录及已失效上游图片不会因本次修复自动恢复。
- 最终格式 v2 迁移备份仍未生成；需要用户确认 10–30 秒维护窗口后，才能把当前 SQLite、工作流和图片目录打成最终迁移包。

## 2026-07-15 后台核心功能复核

### 发现

- 四个源码后台页只有查询和刷新，后端虽然已有部分写接口，但任务历史删除与内置模型删除并不真正生效；用户软删后仍会出现在普通列表。
- 管理员安全检查固定返回“正常”，属于演示结果，不能作为生产判断。
- 原后台写回归把注册送算力写死为 50，且父脚本未检查子 PowerShell 退出码，存在失败仍显示通过的假绿；测试服务还会继承真实 AI 开关。

### 修复

- 用户、回收站、任务和模型价格页面补齐真实操作与反馈；服务器增加参数约束、自锁保护、回收站状态门禁、实际安全一致性检查、历史任务删除和模型删除 tombstone。
- `completePendingTask/failPendingTask` 尊重已取消状态，避免迟到结果再次改回成功或失败并写入历史；明确上游请求及费用无法由本地取消保证撤回。
- 写回归按实际初始余额计算，检查子进程退出码并强制关闭真实 AI；新增一次性数据库隔离浏览器回归和独立完成标记，修复两轮自动化假绿后才判定通过。

### 验证与边界

- `node --check`、Vue build、后台一次性写回归、标准 disposable API smoke、隔离浏览器真实按钮流程、Docker 完整重建和生产只读 smoke 全部通过。
- 正式镜像 `sha256:6b3a47e6053915e28b59ccb144478dba08ba5e43d662a51737859d40b73a5c55` healthy；3456 命中新后台 chunks，生产用户 9、回收站 0、任务 57、模型 3，只读验证未写生产数据。
- 订单/支付仍按未启用处理；安全检查没有登录审计表可用，因此只覆盖账号、余额、身份重复和余额日志一致性。注册与兑换码未改。首轮临时生图回归误继承根 `.env` 的真实 AI 开关，可能已发出 1 次上游请求；进程在无结果时终止，无法排除费用。后续脚本已固定关闭真实 AI，正式生产验收没有调用 Provider。

## 2026-07-15 生图比例字段复核

### 发现

- 当前画布快速生图请求把同一个节点值同时写入 `size` 和 `ratio`，节点保存值使用 `1x1`，而模板和后端默认值使用 `1:1`；虽然旧解析器两者都能换算，但字段语义和优先级不清晰。

### 修复

- 画布网络请求只保留规范 `ratio` 并把 `x/X/×` 转为冒号；不改节点工作流 JSON，避免破坏旧项目恢复。
- 后端新增比例规范化和统一 Provider 尺寸解析，`ratio` 优先，旧 `size: "1x1"` 与显式 `size: "1024x1024"` 继续兼容；官方请求中的 `size` 保持真实像素。
- Provider 返回图片在本地持久化、生成历史和扣系统算力前读取真实宽高；比例误差超过 3% 或无法识别尺寸时拒绝结果。成功结果记录实际宽高，错误比例不会自动重试；已发出的上游请求仍可能产生 Provider 费用。
- 入口/Canvas query 升级为 `20260715ratio1`，Docker 幂等资产补丁和生产静态断言同步更新。

### 验证与边界

- `node --check`、比例尺寸映射、适配器覆盖、错误比例不扣费/不写历史的集成回归、画布资产/预览/操作性能断言、Vue build、一次性 API smoke 和画布边界 smoke 全部通过，测试强制 `ENABLE_REAL_AI=false`。
- 未执行真实生图、未产生本轮 Provider 费用；未修改注册、兑换码或生产业务数据。
- 正式 Docker 已完整重建为 `sha256:2f0345ef97b67d710e084b1b0fb31cd3c7c0386d7ff47b233858a58562c00fe5`，容器为 `healthy`；生产只读 smoke、六个生产路径直连、线上 query 和新旧请求形态断言均通过。

## 2026-07-15 真实付费复测后的上行 Prompt 复核

### 证据

- 用户提供的 Packy 账单显示两次生产 `/v1/images/edits` 各计费 `$0.10`；应用错误卡记录请求 `1024x1024`、实际 `1086x1448`。原错误文案把“系统算力未扣”写成“未扣费”，容易误解为上游也不会收费，现已纠正。
- Packy 2026-07-09 官方文档明确图片编辑使用 multipart `size="1024x1024"`；当前 `callProviderImageEdit()` 抓包也包含该字段，因此不应把官方 `size` 改成 `1:1` 或 `1x1`。
- 真实异常与 2026-07-07 的竖版参考图继承问题一致。快速图片生成入口调用 `buildImageGenerateNodePrompt()`，该函数此前只返回用户原始提示词，没有把节点选择的比例和像素尺寸传入 Prompt；这是本次可在本地修复的上行缺口。

### 修复

- `buildImageGenerateNodePrompt()` 现在只追加一段画布约束：目标比例、Provider 像素尺寸、重新构图或扩展场景、保持商品完整、不得沿用参考图宽高比。其他旧电商约束不恢复。
- 明确拒绝本地裁切方案：不修改 Provider 返回像素、不拉伸、不补边、不二次调用上游。比例保护仍用于暴露上游错误，并明确上游费用边界。

### 验证

- 先建立假 Provider 失败回归，确认旧 multipart Prompt 缺少 `1:1` 画布文本；修复后同一集成测试捕获到 `size=1024x1024`、新增画布约束，且只发生一次 `/v1/images/edits` 调用。
- `node --check`、54 组尺寸映射、6 组适配器覆盖、Chat/快速生图假 Provider 集成、一次性 API smoke、画布边界 smoke、容器内假 Provider 集成和生产只读 smoke 均通过，没有真实 Provider 调用。
- 正式镜像为 `sha256:05a1b447005dd403ef0a204fc54445628305f8318448c172da795ee87b4938df`，容器 `healthy`；生产源码含上行画布约束且不含本地裁切实现，`/`、`/canvas`、`/user/center`、`/gallery`、`/admin/login`、`/api/health` 均为 200。

### 全比例补充复核

- 用户指出比例菜单不止 `1:1` 后，结构检查确认 `buildImageGenerateNodePrompt()` 使用动态 `targetRatio/targetSize`，固定比例没有硬编码；但现有集成只验证 `1:1`，且 `auto` 分支确实缺少专门处理。
- 新回归先稳定复现 `auto` Prompt 失败，再验证修复。菜单 13 个固定比例在 `1K/2K/4K` 下共 39 组，加旧 `x` 分隔符 15 组，总计 54 组，全部同时检查上行规范比例和像素尺寸。
- 自动模式不再拼接字面量 `auto` 的严格约束；固定比例继续严格约束目标比例/尺寸。该修复仍不包含本地裁切或二次 Provider 请求。
- 正式镜像 `sha256:248b679d9f36e74bb9b32bc8364ac59854dfc78e130afaa76e7144307be63249` 已完整重建并为 `healthy`；容器源码动态比例/自动分支断言、54 组矩阵、假 Provider 集成、生产只读 smoke 和六个生产路由均通过，无真实 Provider 调用。

## 2026-07-15 lingsuan 流式 Base64 返图复核

### 结论

- 原故障不是本地漏读已有图片：该次真实上游响应只有 `revised_prompt/usage`，没有 URL、`b64_json` 或其他图片字段。旧客户端同时没有请求 `stream`，无法消费 lingsuan 主要使用的流式返图。
- lingsuan 现在使用 Images API 流式 Base64 契约；`partial_images=0` 只请求最终事件，服务端消费 `image_generation.completed` / `image_edit.completed` 等完成事件。其他线路不受影响。
- 空图保护只阻止本地扣算力、历史写入和自动重试，不能撤销已经到达上游的费用；错误文案已经明确区分两类费用。

### 验证

- 失败回归先确认旧请求缺少 `stream`；修复后假 Provider 抓包确认 JSON 和 multipart 均包含 `stream=true`、`partial_images=0`、`response_format=b64_json`。
- 假 SSE 先发送一张无效 partial，再发送有效 completed Base64；最终只落盘 completed 图片且聊天不含 Base64。另覆盖流式 URL 回退、HTTP 200 空图、错误比例、本地不扣费和不写历史。
- 首次生产元数据检查发现相同模型名让 lingsuan 错取 Packy 示例；精确线路匹配修复后，disposable smoke 和线上 `/api/public/routes` 均确认 lingsuan 显示新契约。
- 最终镜像 `sha256:3010e87bf56dd59948c9df7096e56cccbabf53dbf3a5d0274c2542aaa845e37f` 创建于 `2026-07-15T09:28:10.572359575Z`，容器启动于 `2026-07-15T09:29:11.924433944Z` 并为 `healthy`；生产只读 smoke 和六个主要路径通过。
- 全部验证使用假 Provider 或只读请求，没有向真实中转发送生图，也没有修改注册、兑换码或生产业务数据。

### 线路级配置纠正复核

- 原实现把 lingsuan 行为绑在 `lingsuan.top` Host 上，且后台编辑器始终展示 Packy 默认参考；这会让相同线路在更换测试域名时失去流式参数，也无法从后台记录判断真实请求方式，属于机制边界错误。
- 现由每条线路显式保存 `imageResponseFormat/imageStream/imagePartialImages`，请求适配器只读取选中线路；精确线路默认仅用于兼容未迁移记录，不再读取 Host。生产 lingsuan 为 `b64_json/true/0`，Packy 为 `url/false/0`。
- 后台保存 lingsuan 后，回读确认 Base URL、文生图接口、图生图接口、默认模型、线路 Key 与脱敏 API Key 均未变化；Packy 的协议字段、Base URL 和脱敏 Key 也保持不变，没有扰动其他后台机制。
- 正式镜像 `sha256:f2300589cb0ff65753603c3be7b0cd88ed13820775b164861bd46e00703a8cc2` 创建于 `2026-07-15T09:51:19.649104907Z`，容器启动于 `2026-07-15T09:52:19.709518674Z` 并为 `healthy`。容器源码确认不存在 Host 白名单；专项假 Provider、生产只读 smoke、六个主要路径、公开线路元数据和线上后台 chunk 均通过。
- 本轮唯一生产业务写入是 lingsuan 线路的三个响应配置字段；没有点击 Provider 实际测试，没有真实文本/生图调用和新费用，注册、兑换码、其他线路与历史数据未修改。真实上游能否按该 SSE 契约返图仍需用户主动新建一笔测试，不能自动重试此前已计费任务。

### 省略 size 的真实诊断复核

- 用户先自行完成 2K 和 4K 各一笔真实测试：上行分别为 `2048×2048 + medium`、`2880×2880 + high`，两笔 SSE Base64 均成功落盘，但 PNG 文件头都为 `1254×1254`；说明质量参数已正确分档，实际尺寸仍被上游降级。
- 经用户明确确认，再执行一次单独付费诊断：multipart 字段列表含 `ratio/quality/stream/partial_images/response_format` 且不含 `size`，值为 `1:1/high/true/0/b64_json`；代码只调用一次 fetch，重试关闭。
- 上游 HTTP 200，102687ms 后返回 partial 与 completed；最终 completed PNG 为 `1254×1254`、1939841 字节。文件按原始 Base64 直接写入服务器，没有裁切、缩放或二次编码。
- 结论：当前 lingsuan `gpt-image-2 /images/edits` 不会从 `ratio + quality=high` 自动推导 2K/4K，且显式 `size` 也未被兑现。继续修改本地参数无法证明可获得真实大尺寸，应以中转方支持说明或更换可兑现尺寸的线路处理。
- 本次直连未写本地用户历史、未扣本地算力，可能产生一笔上游费用；未自动重试，注册、兑换码和后台配置均未修改。

### 纯官方 4K 对照复核

- 中转账单显示此前请求确实识别为 2K/4K，说明请求档位与计费没有丢失；需要区分“计费档位”“流式返回图片”和“落盘实际像素”。
- 官方文档核对确认 `2880×2880` 满足 `gpt-image-2` 最大边、16 倍数、3:1 和 8294400 总像素约束；图生图官方 cURL 使用 `/v1/images/edits` 与 `image[]`，`gpt-image-2` 不应发送 `input_fidelity`。
- 用户确认的唯一一次对照严格发送 `model/image[]/prompt/size=2880x2880/quality=high/output_format=png/n=1`，Accept 为普通 JSON；没有发送任何 SSE 或中转扩展字段，也没有重试。
- HTTP 200 响应为 `created/data/usage`，`data[0]` 为 `revised_prompt/b64_json`；Base64 原字节直接写盘后是 7534579 字节、`2880×2880` PNG。由此确认本地无压缩，真正 4K 可由纯官方非流式格式取得。
- 当前生产线路仍配置为 `b64_json + stream=true + partial_images=0`；本轮只是付费诊断，没有修改后台或业务代码。若切换生产，应以官方非流式格式建立失败回归、移除 `input_fidelity/response_format/stream/partial_images`、使用 `image[]` 和 `/v1/images/edits`，再完成 Docker 重建与 3456 验收。

## 2026-07-16 lingsuan-images 独立规则复核

### 结论

- 主工作区已经把实测成功的官方非流式格式固化为独立 `apiFormat=lingsuan-images`，而不是继续修改所有 OpenAI Images 线路或按 `lingsuan.top` 域名特判。
- 规则以出站白名单控制字段：文生图为 `model/prompt/size/quality/output_format/n`，图生图为 `model/image[]/prompt/size/quality/output_format/n`；mask 仅在真实存在时追加。`stream/partial_images/response_format/input_fidelity/ratio/background/moderation` 不会发送。
- 后台选择该格式后锁定官方 endpoint、非流式和 Base64 解析；服务端再次规范化，避免手工请求或旧 UI 写入矛盾配置。Packy 和通用线路逻辑未改。

### 验证

- 动态假 Provider 回归故意通过后台提交旧 endpoint、`response_format=url`、`stream=true`、`partial_images=3`，回读仍被规范化为 `/v1/images/*`、`b64_json/false/0`；实际 4K 图生图抓包为 `2880x2880 + high + image[]` 且字段集合严格正确。
- Packy 后台线路测试仍发送 URL 非流式请求。54 组 `1K/2K/4K` 尺寸映射、语法、静态适配器覆盖、disposable API、后端画布边界、Vue build 和后台 Playwright 保存回读全部通过。
- 部署前生成便携备份 `docker/backup/internal-prod-20260716-095040`；随后从主工作区完整重建镜像 `sha256:840f25b0f1235ad595e489474f9c4477e3608ffa29eb5a033bb762f41e2986fe`，创建于 `2026-07-16T01:52:55.225127908Z`，容器启动于 `2026-07-16T01:53:57.827614075Z` 并为 `healthy`。
- 使用容器内 5 分钟短期管理员令牌调用现有后台 API，未重置或修改管理员密码。生产 lingsuan 路线保存回读为 `lingsuan-images / b64_json / false / 0 / image[]`，Base URL、模型、线路 Key、密钥存在状态保持不变，Packy 未变。
- 3456 健康、数据库、公开元数据、新后台入口 `/assets/index-DNcduN1c.js`、新线路 chunk `/assets/AdminApiProvidersSource-Dkk-OV3_.js` 和旧 chunk 404 全部通过。未点击 Provider 测试，没有真实调用和费用；注册、兑换码实现未改。生产 smoke 创建后删除的临时 `SMOKE*` 兑换码已无残留。

## 2026-07-16 Lingsuan Accept 动态规则复核

### 结论

- 本轮没有把 Lingsuan 域名、现有线路名或 routeId 写入请求逻辑。判断入口仍是后台可保存的 `apiFormat/requestFormat=lingsuan-images`，因此后续新增线路或更换 Base URL/API Key 时，只需在后台选择对应接口格式。
- Lingsuan 文生图和图生图现统一发送 `Accept: application/json`，对齐已成功返回真实 `2880×2880` 的官方格式；其他线路继续使用原有 SSE Accept 或 `*/*`，不会被一起改动。

### 验证

- 假 Provider 实际断言 Lingsuan generation/edit 的 Accept 均为 `application/json`，Packy generation 仍为 `*/*`；官方字段白名单和 `2880x2880 + high` 断言继续通过。
- `node --check server.js`、`node --check scripts/test-chat-image-generation-tools.js`、图片工具动态回归、Packy 适配器覆盖和 disposable API smoke 均通过。本轮没有调用真实 Provider、没有费用，也没有修改注册和兑换码实现。
- 生产部署前生成便携备份 `docker/backup/internal-prod-20260716-103721`；随后从主工作区完整重建镜像 `sha256:1369cb86df070ff9fd965f3fe4bf582db4f8157ffb7774c75a09f3dc8a5ca1f2`，创建于 `2026-07-16T02:38:23.878782124Z`，容器启动于 `2026-07-16T02:39:22.695184885Z` 并为 `healthy`。
- 容器内源码确认 helper 存在、动态格式判断存在且 generation/edit 共两处调用；生产线路回读仍为 `lingsuan-images / b64_json / false / 0`，Key 已配置且线路启用。容器内假 Provider 抓包、生产只读 smoke 和六个 3456 路径通过；未调用真实 Provider，没有费用。本次仅后端变更，用户无需强刷浏览器缓存即可复测。
- 用户在正式画布主动发起任务 `task_mrmwnll7980e4a1c` 后，监控确认线路、endpoint、字段名、4K 尺寸和 high 质量均正确；完成结果的服务器原始 PNG 为 `2880×2880`、7330656 字节，不是本地裁切、放大或压缩所得。
- 对应生成历史 `gen_mrmwojlm625df4c6` completed，本地扣除 10 点（100→90）。本轮 Codex 只做只读监控，没有额外 Provider 调用或自动重试；正式 4K 返回已经人工验收通过。

## 2026-07-16 Packy 图生图失败复核

- 失败模式已由生产任务详情复现：两次快速 HTTP 参数拒绝和一次 22.8 秒连接挂断，不是同一个本地错误。两条参数拒绝均带 Packy request id，适合交给 Packy 查询实际命中渠道。
- Lingsuan 隔离结论由三份备份和当前源码共同确认：Packy 配置在 Lingsuan 修改前后完全一致；`isLingsuanImagesRoute` 只认后台格式 `lingsuan-images`，Packy 的 `openai-images` 不进入该分支；Packy Accept 仍为 `*/*`。
- Packy 官方文档自身同时要求 `Sora` 分组令牌并声明编辑接口支持 `response_format=url`，而实际通道拒绝该字段。当前不能在没有确认 Key 分组的情况下把问题归因于本地字段，也不应自动重试真实生图。
- 容器 5 次无鉴权 Packy HTTPS 探针全部成功建立连接；本地生成数和流水数保持 71/189，失败任务未扣系统算力。上游是否计费需查 Packy 账单。本轮未改代码、未改配置、未发付费请求。
- 用户随后以 Packy 控制台截图证明新 `image` 分组已包含 `gpt-image-2`，页面时间与失败任务一致；上游能返回带 request id 的参数校验错误也说明 Key 和模型路由已通过。此前“非 Sora 分组导致失败”的结论作废。
- 最终诊断边界改为 Packy `image` 分组实际参数契约与公开教程不一致。建议后续增加显式 `Packy Images` 后台格式和严格白名单，不用域名特判、不回滚 Lingsuan；真实验证仍由用户主动触发且禁止自动重试。

## 2026-07-16 Packy Images 独立规则复核

### 结论

- `packy-images` 已作为显式后台接口格式上线，不依赖域名或现有线路 ID。Packy 文生图仅发送 `model/prompt/size/quality/output_format/n`，图生图仅发送 `model/image/prompt/size/quality/output_format/n`，mask 按需追加。
- Packy 不再发送 `response_format/background/moderation/input_fidelity/stream/partial_images/ratio`；图生图使用单数 `image`。Lingsuan 仍使用 `lingsuan-images + image[] + Accept: application/json`，通用 OpenAI Images 分支保留原扩展能力。
- Packy 固定非流式请求，响应解析不依赖请求中的 `response_format`，URL 与 Base64 均可进入现有图片持久化和比例校验流程。

### 验证与部署

- 新增失败回归先在旧实现上命中缺少 Packy 分支；修复后假 Provider 抓包确认文生图与图生图字段集合、单数 `image`、URL 返回和 Lingsuan 隔离。语法、6 入口覆盖、disposable API、Vue build 和后台隔离浏览器 UI smoke 通过。
- 备份 `docker/backup/internal-prod-20260716-112559` 完成后，从主工作区完整重建镜像 `sha256:c42419ac54287b52a015aa728c6fc75b12b0c6d39515311cffcd26ebf5313e16`；镜像创建于 `2026-07-16T03:27:17.334834357Z`，容器启动于 `2026-07-16T03:27:59.302108363Z`，状态 `healthy`。
- 使用 5 分钟短期管理员令牌调用现有后台 API，仅把生产 Packy 线路格式从 `openai-images` 改为 `packy-images`。回读确认 Base URL、模型、Key 存在状态、倍率、优先级、默认和启用状态全部保留，生成/编辑示例不含禁用字段。
- 3456 命中 `/assets/index-CMKVadPU.js`、`/assets/AdminApiProvidersSource-CWwBsMFT.js` 和新 `packy-images` 元数据，旧 `/assets/AdminApiProvidersSource-Dkk-OV3_.js` 为 404；生产只读 smoke、`/canvas`、`/user/center` 均为通过。
- 本轮没有调用真实 Provider 或产生由 Codex 发起的费用，没有修改注册、兑换码或用户余额。Packy `image` 分组最终真实返图仍由用户手动验证，失败时不自动重试。

## 2026-07-16 Packy 4K 两次失败复核

- 当前 `packy-images` 并非全部失效：正式任务 `task_mrmyphn47a631c80` 以 1K 图生图在 51.2 秒成功，生成历史与 10 点扣费正常。
- 第一笔 4K 在前一笔 1K 后排队约 45 秒，随后恰好达到 `IMAGE_PROVIDER_TIMEOUT_MS=180000` 才失败；226.4 秒任务总耗时由排队和 180 秒请求超时组成。本地超时是该笔的直接终止原因。
- 第二笔 4K 27.1 秒后 socket hang up，没有收到 Provider HTTP 响应，因此与字段 4xx 拒绝不同，属于 Packy/其上游主动断开连接。
- 图片请求仅对 TLS 建连前断开做有限重试；普通 socket hang up 和 AbortError 都不会重试。两笔 4K 均未写本地生成历史和余额流水，上游是否计费未知。
- 结论：严格字段修复已由真实 1K 成功证明；4K 当前同时暴露 180 秒超时不足和 Packy 连接稳定性问题。若实施修复，应优先增加 Packy 线路级超时而非恢复扩展字段，且不得对 socket hang up 自动重试。

## 2026-07-16 Packy 360 秒超时部署复核

- 已增加 `PACKY_IMAGE_PROVIDER_TIMEOUT_MS=360000` 默认值，并由 `isPackyImagesRoute` 选择。`callProviderImageGeneration` 与 `callProviderImageEdit` 都先解析路线级超时，再创建 AbortController timer。
- Packy 成功响应的内部请求元数据记录 `timeoutMs`，假 Provider 动态回归断言为 360000；Lingsuan/通用路线仍读取原全局图片超时。没有增加 socket hang up 或超时自动重试。
- 语法、适配器覆盖、Lingsuan/Packy 动态回归和 disposable API smoke 通过。备份 `internal-prod-20260716-115848` 后完整重建正式镜像 `sha256:9d51431cda131e748f963faa479fa9a56d2cdb17bba1b8e21eda710b6e62ed8c`，容器为 `healthy`。
- 容器源码、生产 Packy 路线、六/七字段请求示例、生产只读 smoke 和 3456 三个页面路径均通过。未发真实 Provider 请求；是否同时解决 Packy 主动 socket hang up 不能由超时改动保证，需用户单次复测判断。
- 用户单次生产复测 `task_mrmzxzpkab2ee8f4` 已成功，实际 Provider 请求元数据为 `2880x2880 / high / timeoutMs=360000 / image`，总耗时 196.6 秒。生成历史 `gen_mrn027fxb3e21d64` completed，文件头复核为 `2880×2880` PNG、9280326 字节，本地扣费 10 点。
- 新容器启动后没有失败任务。用户发送的 socket hang up 截图对应画布保留的旧失败卡片，而不是本次新任务；后端修复已由超过 180 秒后仍成功完成的真实 4K 结果验收。

## 2026-07-16 Chat 正式内网版复核

- 版本边界已固定：LibreChat `v0.8.6-rc1` 归档、上游提交和 SHA-256 均有本地记录；MCP SDK 精确锁定 `1.29.0`，官方审计 0 漏洞，不使用浮动版本。
- 生产拓扑符合简单内网边界：单机四容器、一个对外端口，不引入 Redis、Postgres、MinIO、队列或微服务；gateway 故障域与 app/Chat 路由分流保持明确。
- 密钥未输出到源码、发布包或日志；app 与 LibreChat 共享 bridge secret，其余 JWT/refresh/credentials 密钥独立。Compose 配置确认 app、LibreChat、MongoDB 无宿主机端口。
- API 复核使用已有有效普通用户和短期 JWT，不注册新主站用户、不写后台 Chat 设置；验证 SSO 票据不可复用、服务密钥和用户绑定错误会被拒绝、LibreChat 会话和 MCP 工具可用。
- 浏览器复核按真实产品流程注入主站短期登录态，由 LibreChat 自行申请一次性票据；直接把票据拼入 `/chat/?ticket=` 被确认不是产品协议，相关错误测试已纠正。最终 `/chat/c/new`、托管智能体和 Skills 页面通过。
- LibreChat 首次握手的匿名 logout 401 与无 Agent 创建权限 403 属于已知权限探测；UI smoke 只豁免这两个明确 URL，其他控制台错误和所有 5xx 仍会失败。
- 当前迁移脚本只覆盖主站 SQLite/工作流/图片/日志，不覆盖 Chat 命名卷。明天按用户确认采用全新 Chat 卷；若以后要求保留聊天历史或私有 Skills，需另行实现并演练四个卷的停机备份恢复。

## 2026-07-17 最终迁移制品复核

- 使用真实最终备份而非合成样本完成恢复演练，源码包、环境文件指纹、数据库、数据归档、上传归档和日志归档均通过正式脚本门禁。
- 恢复只允许空目标目录，路径逃逸、覆盖现有持久目录和环境文件指纹不一致仍会被拒绝；本轮目标位于系统临时目录并在验证后清理。
- 恢复后的数据库哈希、SQLite 两项完整性检查和四张核心表计数均与生产备份相符；32 个上传文件和 22 个工作流文件已实际展开。
- 本机 Docker 服务当前停止且没有远程 context，因此本轮不能声称服务器已部署或 `3456` 在线。剩余工作是外部部署动作，而不是继续修改应用代码。

## 2026-07-17 本机服务启动复核

- Docker Desktop 启动由用户明确授权；Engine 就绪后只执行正式 Compose `up -d --no-build`，复用前一轮完整构建并验收过的镜像。
- 四容器镜像 ID 与 2026-07-16 固定版本一致，容器全部 `healthy`，宿主机端口边界仍只有 gateway 的 `3456`。
- 生产只读 smoke 保留旧资源 410/404 隔离；Chat UI 通过主站短期登录态完成 SSO，不发送消息和 Provider 请求。
- 当前可确认的是本机 `192.168.0.39:3456` 已恢复在线；仍没有远程服务器 context，不能把本机拉起等同于已经迁移到另一台服务器。

## 2026-07-17 画布反推提示词 502 修复复核

### 已确认

- 用户截图对应的是画布图片节点 `/api/image-tools/reverse-prompt`，不是模板工作台的 `/api/template/reverse-prompt`。
- 失败回归证明空图片线路 ID 会由 `findRouteByAnyId` 退到首条 Packy 图片线路，文本反推因此走 `/chat/completions` 并返回截图中的 502。
- 修复后同一回归只请求文本线路 `/responses`，请求模型为 `gpt-5.5`，多模态内容包含从 `/uploads/generated/...` 读取的 `data:image/png;base64,...`，接口返回可复制提示词。
- 后端语法、一次性 API smoke、画布后端边界 smoke 全部通过；没有真实 Provider 调用、系统扣费或生产数据写入。

### 发布复核

- 用户确认维护窗口后，一致性备份 `docker/backup/internal-prod-20260717-103952` 完成，app 随后从主工作区完整重建为镜像 `sha256:f7b9d13dc4b8b2ae9407c2683e0345bab9cbc17b5d821112135dfe12260df393`；镜像创建时间 `2026-07-17T02:40:51.240873181Z`，容器启动时间 `2026-07-17T02:41:14.973224356Z`。
- app、LibreChat、MongoDB、gateway 四容器均为 `healthy`；容器源码确认反推入口已使用 `resolveTextRoute` 和多模态 `input_image`。
- 生产只读 smoke 通过；`127.0.0.1:3456` 与 `192.168.0.39:3456` 的首页、目标画布、用户中心和健康接口均为 200；未授权反推探针为 401，没有触发真实 Provider。

### 仍需用户验证

- 关闭当前保留旧错误文字的反推弹窗后重新打开，再执行一次真实反推。真实反推会调用文本 Provider；本轮自动验收没有代替用户发送该调用。

## 2026-07-17 Chat 结构化电商简报报价复核

### 已确认

- 截图中的问题不是流式解析：文本模型成功返回了普通文字，但主站没有为完整电商简报设置报价工具 `tool_choice`，模型因此要求用户重复同一句。
- 集成失败回归直接捕获出站 Provider 请求，旧值为 `tool_choice=undefined`；修复后同一原句强制 `prepare_image_generation`，能进入现有报价/确认码流程。
- 新判定要求平台、尺寸/比例、目标人群/卖点/商品规格三类信号同时存在，控制了普通咨询被误判为生图的风险。
- 生产文本线路恢复为 `https://lingsuan.top/v1/responses`，没有改 Key、接口格式或启用状态；本轮没有向文本或图片 Provider 发送自动测试请求。

### 发布与验证

- 一致性备份 `docker/backup/internal-prod-20260717-115201` 完成后，app 完整重建为镜像 `sha256:134ace2477f629452e4e7e5bd7ca8ebd168aca67d0f107ce467ce2484556a9be`；四容器均为 `healthy`。
- 容器源码和 SQLite 脱敏回读分别确认结构化判定与 `/v1` Base URL 生效；专项回归、Chat 图片工具、一次性 API、画布边界、生产只读 smoke 和 Chat 无费用浏览器 smoke 通过。
- 用户复测必须发送一条新消息；不要对旧的 completed/refunded 消息使用原消息 ID 重试。实际文本分析与报价会调用真实 Provider，结果和费用由该次新请求产生。

## 2026-07-17 Chat 502/409 故障复核

### 已确认

- 页面 409 是二次现象：首次 lingsuan Responses 请求返回 HTTP 502，本地扣除的 5 点在 15 秒后全额退回；LibreChat 自动重试时才命中 `refunded` 幂等门禁。
- app 容器在故障前后没有重启；上一笔同路线 Chat 在约 10 分钟前正常完成，因此该现象是间歇上游 502，不是线路完全失效或本地容器中断。
- 旧实现对首次 Provider HTTP 失败返回非 200，诱发 LibreChat 重试；新实现在保留退款与幂等门禁的前提下，将该类失败转为 HTTP 200 中文助手消息。
- 假 Provider 回归同时覆盖首次 502 和同 ID 重放，确认两次客户端响应均可读、上游只调用一次、charge 为 `refunded`、余额净变化为 0。

### 风险边界

- 本地只能保证系统算力已退还且没有第二次 Provider 调用；首次 HTTP 502 是否被上游计费，仍需以 lingsuan 账单为准。
- 已完成与处理中消息的重复提交仍返回 409；只有已退款失败会转为可读的正常助手消息。

### 发布复核

- 短维护窗口先完成 `internal-prod-20260717-111256` 数据、上传文件和工作流备份，app 恢复健康后再开始重建。
- app 从 `F:\dianshang` 完整重建并替换，镜像 ID 与容器实际使用的 ID 均为 `sha256:0e521ae8e7ba160e1e6084c3c20860b0e74aa2b8249df9d2eb668b5e38b4bf08`；容器内代码包含新退款响应逻辑，不是容器热修。
- app、LibreChat、MongoDB、gateway 四容器全部 `healthy`；生产只读 smoke、旧资源隔离、本机/192.168.0.39 的首页、健康接口和 Chat 页均通过。
- 此修复不改 LibreChat 前端包，不需要清理浏览器静态缓存。用户只需发一条新消息验证；旧的红色 409 消息会保留在历史中。

## 2026-07-17 Chat 中文附件 ByteString 故障复核

### 已确认

- 这次失败不是流式没做好，也不是 Provider 502：异常在 LibreChat 创建 MCP Fetch Header 时发生，请求尚未到主站 MCP，更未触达图片 Provider。
- `X-Chat-Reference-Images` 原来是附件路径的原始 JSON；只要路径含中文，Fetch 的 ByteString 转换就会拒绝。用户错误中的码点 26410 正好对应测试文件名首字“未”。
- 编码端现使用 Base64URL，Header 全部为 ASCII；主站解码后仍能识别中文 `/images/*` 路径。旧 JSON 形式仍兼容，身份映射和最多 4 张附件边界不变。
- 回归在修复前得到同一 ByteString，修复后得到 `referenceImageCount=1`；生产只报价探针也得到相同结果且已删除报价，没有 Provider 调用或扣费。

### 发布复核

- 一致性备份为 `docker/backup/internal-prod-20260717-124018`；app 与 LibreChat 都从 `F:\dianshang` 完整重建，没有容器热修。
- app 实际镜像为 `sha256:92224b69d98ff3f5d4fb605f651eac18c383cc944805fb5fd18abf7cc7703920`，LibreChat 实际镜像为 `sha256:94c533b032ae0e0208dca7693920c93237f42ae5d3a219bb3e4a283120968db0`，四容器全部 `healthy`。
- 生产只读 smoke、Chat 无费用浏览器 smoke、本机与内网的首页、`/chat/`、`/user/center` 均通过。用户可在 `/chat/` 新开一条消息并重新上传参考图复测；旧失败消息仍保留历史错误，不代表新请求未生效。

## 2026-07-17 Chat 生图工具普通用户展示复核

### 已确认

- 原截图不是流式协议本身缺失，而是 LibreChat 通用 MCP `ToolCall` 组件默认把函数名、服务器名、参数和 `content` 原样作为技术卡片展示；主站同时把完整结构化结果序列化进 `content[].text`，因此用户看到了 JSON。
- 只隐藏工具卡片会在最终模型续接尚未完成时连确认码一起隐藏。当前处理保留等待阶段的普通用户报价，并在最终助手回复出现后隐藏中间工具消息。
- 机器续接继续读取 `structuredContent`，用户展示读取中文 Markdown。报价、确认码、生图执行、退款、幂等和扣费边界未改变，其他 LibreChat 工具也未被全局改写。
- `ToolCall` 组件定向测试 28/28 通过，覆盖技术字段不可见与最终回复后中间消息隐藏；生产 bundle 命中新文案，MCP 只报价探针确认没有内部字段，报价已清理且余额未变化。

### 发布复核

- 备份为 `docker/backup/internal-prod-20260717-141643`；app 与 LibreChat 均由 `F:\dianshang` 完整重建，没有容器热修。
- app 镜像为 `sha256:1a8c7cbc2d19c4f62d7bdfa2255595b0f6438ef88581c83388231d965f67d763`，LibreChat 镜像为 `sha256:c80e109d54ccbfb269997c2f0a4793b316ad8f6ddc86b60b0107a328b4749dbc`；四容器全部 `healthy`。
- 生产只读 smoke、Chat 浏览器 smoke、旧资源隔离和本机/内网全部目标入口通过。未发起真实文本或图片 Provider 请求；用户需在 `/chat/` 强刷后以新消息验证新展示。

## 2026-07-17 Chat 图生图确认续接故障复核

### 已确认

- 用户会话已经接入图生图报价，参考图数量为 2、模式为 `image-to-image`；未调用图生图的准确含义是 execute 阶段没有发生，而不是附件识别或 prepare 路由缺失。
- 上一版“最终回复出现后隐藏工具消息”的处理不适合报价确认流程：当最终文本 Provider 502 时，唯一可用的确认码也被隐藏。另一个边界是 LibreChat 只可靠保存工具文本，不能让下一轮执行依赖内部 `structuredContent.quoteId`。
- 当前报价/结果始终保留可见；精确确认码和工具结果续接由主站本地完成，不再受文本 Provider 502 影响。执行只需要确认码，但仍绑定当前用户、报价状态、5 分钟有效期和下一条消息，不能跨用户或复用已执行报价。
- 假 Provider 回归确认带参考图的执行继续进入现有图片编辑路径。生产过期码探针只验证路由与门禁，没有调用真实图片 Provider、没有扣费或新增 generation；探针前后账号余额均为 30。

### 发布复核

- 备份为 `docker/backup/internal-prod-20260717-155419`；app 与 LibreChat 均由 `F:\dianshang` 完整重建，没有容器热修，也没有重启 Docker Desktop。
- app 镜像为 `sha256:df61e8df09906e7bfe291a8d411dee7d090edaec98f1ea95812f08f4bff8b6bb`，LibreChat 镜像为 `sha256:5c2ec27743db1bf2d1401b1f2c8e23f2c6d9a7683034b321021ff8dbd7032775`；两个容器全部 `healthy`。
- 生产只读 smoke、Chat 浏览器 smoke、旧资源隔离和本机/内网目标入口通过；Chat 已加载新包 `/chat/assets/index.CEEARJSz.js`。旧确认码 `9D7FD4` 已过期，必须用新消息创建新报价后再确认，届时会产生真实 Provider 调用和报价扣费。

## 2026-07-17 画布重复生图与假排队状态复核

### 已确认

- 画布请求走真实 lingsuan 图片编辑线路，不是 mock；中转站暂时看不到记录，是因为请求仍在本地全局串行队列等待前序 524 结束。
- 旧前端允许连续点击且使用本地计时推进进度；旧后端允许同一用户重复入队，并在真正出站前标记 `running`。三者共同造成多个节点卡在 12%/18%/90% 和队列越来越慢。
- 新实现保留单并发 Provider 保护，只限制同一用户同时一个活跃图片任务；其他用户仍可进入全局队列。重复提交返回明确 409 和当前任务 ID，不创建任务、不扣费、不调用 Provider。
- pending 状态只显示低位排队进度，取得 Provider 槽位后才切换 running。无费用假 Provider 回归确认两次快速提交仅产生一次外部调用、一次历史和一次扣费。

### 发布与风险

- 备份 `docker/backup/internal-prod-20260717-165407` 后，app 从 `F:\dianshang` 完整重建；实际镜像 `sha256:e61093fd64edbae1113226a03ed7c7e11e2229dbec516d4eec20d1925f47b41f`，创建时间 `2026-07-17T08:55:30.168643393Z`，容器启动时间 `2026-07-17T08:57:14.258560203Z`。四容器均为 `healthy`。
- 生产只读 smoke、Chat 无费用 UI smoke、当前资源版本、旧资源 410/404、本机和内网六类入口全部通过。自动验收没有发送真实生图请求。
- 事故前已入队任务最终为 11 失败、6 成功；账号 `731241492` 余额为 `-30`。这是旧并发门禁缺失留下的真实数据，本轮未擅自退款或修改余额。
- 此修复不能消除 lingsuan 自身的 Cloudflare 524；用户强刷后应只点击一次测试。若单个新任务仍超时，应继续针对 Provider/线路处理，不再用重复点击重试。

## 2026-07-17 账号级单任务限制回退复核

### 已确认

- 截图红字来自上一轮新增的后端 `IMAGE_GENERATION_ALREADY_ACTIVE`，不是 Provider、余额或流式返回错误；Canvas 的长时间提交锁也会阻止同一节点连续创建结果。
- 这两处限制违背 2026-07-03 已确认的多批提交交互，属于修复范围扩张。当前已撤销，合法的两次提交都必须返回 202、创建不同任务并分别计费。
- 全局串行 Provider 队列是此前中转过载保护，不会拒绝任务；多个已接受任务继续分别显示 pending/running。若要改为多个上游请求真正并发，需要单独评估 lingsuan 限流和重复上传风险。

### 验证与发布

- 失败回归在修复前稳定得到第二次 409；修复后两次提交均为 202、假 Provider 调用 2 次、历史 2 条、扣费 2 笔。语法、资产、性能、API、画布边界和前端构建均通过。
- 备份 `docker/backup/internal-prod-20260717-174410` 后从主工作区完整重建 app。实际镜像 `sha256:586be741ec20e465ddc5f47ccf7368883e39538eaa5104040c7cc82dd5c8a7ca`，创建时间 `2026-07-17T09:45:00.182529455Z`，启动时间 `2026-07-17T09:45:19.666241165Z`，四容器全部 `healthy`。
- 生产只读 smoke、当前资源、旧资源隔离及本机/内网全部目标入口通过；线上源码确认 Canvas 无提交锁、后端无账号级 409。自动验收未调用真实 Provider，生产余额未改。

## 2026-07-17 反推提示词复制空剪贴板复核

### 已确认

- 反推结果字段正常，按钮也收到完整提示词；故障发生在浏览器剪贴板写入。非安全 HTTP 上下文没有 `navigator.clipboard` 时，可选链返回 `undefined`，旧处理器仍执行成功提示。
- 新处理器只在实际写入成功后提示成功；非安全上下文使用隐藏 textarea 回退，并验证 `execCommand("copy")` 返回值。Clipboard API 和回退都失败时显示错误，不再吞异常。
- 执行回归直接抽取当前 Canvas `PromptReversePanel` 的按钮函数，而不是复制一份实现；覆盖原生成功、HTTP 回退成功和全部失败三种结果。

### 发布复核

- 部署前发现 1 个生图任务运行中，等待其自然结束到 0 活跃后再备份和重建；没有取消或中断用户任务。备份为 `docker/backup/internal-prod-20260717-181703`。
- app 从 `F:\dianshang` 完整重建，实际镜像 `sha256:af7a8223d49986c4a63881db9a06f15f79d5f1fa03894a1b062fd1641bedd816`，创建时间 `2026-07-17T10:17:57.88842705Z`，启动时间 `2026-07-17T10:18:17.150331353Z`，四容器全部 `healthy`。
- 生产只读 smoke、旧资源 410/404、本机/内网全部入口和线上 Canvas 代码检查通过；新资源包含 HTTP 回退和清理逻辑，旧“可选链后无条件成功”代码已消失。未调用真实 Provider，余额和图片队列策略未修改。

## 2026-07-20 Chat 生图线路与一键确认发布复核

### 已确认

- “电商主图设计师”默认靠托管智能体 instructions、对话和附件组织图片需求；Skills 可选，截图没有显示 Skill 调用。报价和执行属于内置网站 MCP 工具，不应让普通用户理解或复制内部结构。
- 报价后出现上游退款文案是文本续接误调用：完整 MCP 名称和 content-array 工具输出没有进入本地续接分支。修复后工具输出不会再次请求文本 Provider，标准尾随 tool 消息仍兼容。
- 生图线路选择使用现有用户偏好接口，报价把选择结果固化到请求 JSON，避免确认前切换线路改变已有报价。确认按钮只提取严格六位字母数字码并调用标准消息提交流程，不直接执行后端接口，不绕过报价、计费或幂等门禁。

### 验证与发布

- 固定源码补丁成功应用，完整 LibreChat 前端构建通过；`ToolCall` 29/29 用例确认按钮发送 `确认生图 932EE2`，续接和两条图片 Provider 适配器假回归通过。Windows PowerShell 5 的中文静态断言已改为 Unicode 正则，集成 smoke 随后完整通过。
- 维护前读取到 `activeCount=0`，便携备份为 `docker/backup/internal-prod-20260720-112113`。app 镜像 `sha256:06328875c8c9c028bf930e3843c01e8cbe0f18e9558b7dd12de69f4ddcd1d57c`，LibreChat 镜像 `sha256:7da252c039708a99bb10623758f2a1c02e9af027af3c9eae188e8fbb6d88ac76`，创建和容器启动时间均为 2026-07-20 本轮，四容器全部 `healthy`。
- 生产只读 smoke、Chat UI smoke、无费用集成 smoke、本机/内网五类入口及线上静态资源命中均通过。`/chat/assets/index.2lAYBjDl.js` 包含“选择生图线路”和“确认并生成图片”；自动检查没有发送消息、没有真实生图和 Provider 费用。

## 2026-07-20 Chat 生产 MCP 工具名路由复核

### 已确认

- 三次 `确认生图 932EE2` 均只形成文本线路 502 与自动退款，没有 `execute_image_generation` 工具调用、generation 或图片 Provider 请求；因此不能据此判断两条生图线路都故障。
- 根因是生产 MCP 名称为 `execute_image_generation_mcp_hajimi-website`，旧 `endsWith('execute_image_generation')` 无法命中。最小修复增加 `startsWith('execute_image_generation_mcp_')` 兼容，同时保留已有短名称和后缀名称语义。
- 生产同形测试在旧代码上稳定失败并误调假文本 Provider；修复后返回完整 execute 名称、参数 `{ confirmationCode: 'ABC123' }`，文本 Provider 计数不变，账务仍按原工具续接状态机处理。

### 验证与发布

- 本地后端语法、工具续接、两条图片适配器、一次性 API、后台写入和画布边界 smoke 全部通过；没有真实 Provider 请求。部署前活动任务为 0，备份为 `docker/backup/internal-prod-20260720-115227`。
- app 从主工作区完整构建，镜像 `sha256:5bdf35fec37461ffe4c4961095d2eca8efb0bcdbeb5325b11d1bc83ce3e6021e`，创建时间 `2026-07-20T03:53:09.59898336Z`，启动时间 `2026-07-20T03:53:39.899608308Z`；App、LibreChat、MongoDB、gateway 全部 `healthy`。
- 生产只读 smoke、完整无费用 LibreChat 集成 smoke、容器源码命中以及 127/192 的 `/admin`、后台 Chat 设置、Chat、健康接口均通过。自动验收未执行真实生图；旧确认码 `932EE2` 已过期，需用新报价人工验证真实 Provider。

## 2026-07-20 Chat 生图结果 Markdown 渲染复核

### 已确认

- 生成图片本体存在且本机/内网均可直接读取；截图中的原始 Markdown 来自 `OutputRenderer` 的 `<pre>` 纯文本策略，而不是 URL、网关、图片持久化或 Provider 故障。
- 生产 Mongo 中该结果仍是一个 assistant content-array，包含 `execute_image_generation_mcp_hajimi-website` tool call 和本地完成文本。修复只改变 React 展示组件，不改变工具结果、上下文入库或下一轮请求，因此不会额外污染上下文，也不会把 1.9 MB 图片字节塞进文本上下文。
- 最小修复只针对 execute 成功输出启用 LibreChat Markdown；prepare 报价继续使用纯文本渲染，避免改变复制和确认交互。

### 验证与发布

- 组件回归在旧实现精确失败于找不到 `img`，DOM 证据为包含完整 Markdown 的 `<pre>`；修复后 30/30，用例确认正确的 `alt` 和 `/uploads/generated/result.png` 地址。完整生产构建同时通过。
- 活动任务为 0，备份 `docker/backup/internal-prod-20260720-123157` 后从主工作区重建 app 与 LibreChat。镜像分别为 `sha256:6f528bdba4992d2baf2f741ab744bf13dabfbfd8529fed75920621ccd99ad08e` 和 `sha256:64c3fce3a49ae935e2f481c50995f34e19322cd825abf6557f9a90bdcd387420`，四容器全部 `healthy`。
- 生产浏览器 smoke、无费用集成 smoke、127/192 只读 smoke、Chat 新入口和原图片资源均通过。新入口 `/chat/assets/index.7-3Zm5Bb.js` 为 200；没有发送消息、调用 Provider或新增费用。历史会话刷新后即可重新渲染图片。

## 2026-07-20 Chat 电商主图方案表单流程复核

### 已确认

- 旧流程把“方案说明”和“生图报价”混在一次工具调用中，用户无法逐项确认文案；图片完成后也没有面向普通用户的循环修改入口。新流程把方案、最终提示词/报价、执行拆成三个明确阶段。
- 方案表单列出主标题、副标题、卖点、角标、页脚、规格和其他文字，下面始终保留空白“文案修改（选填）”。该输入非空时作为最高优先级写入最终提示词；确认前不创建报价、不扣费、不调用图片 Provider。
- 方案按用户和 `conversationId` 保存，结果修改时复用原始产品图和参考图。会话外、过期或同消息确认仍受服务端门禁约束；原报价线路锁定、余额检查、幂等执行和失败退款未绕过。

### 验证与发布

- 后端语法、Chat 工具和续接假 Provider 回归、一次性 API smoke、Vue 构建、固定 LibreChat 补丁应用和补丁后 TSX 转译均通过；自动验证未产生真实费用。
- 发布前活动任务为 0，一致性备份为 `docker/backup/internal-prod-20260720-141106`。首次完整构建后集成 smoke 精确发现 YAML 块缩进错误导致 MCP 配置被 LibreChat 丢弃；修正、用运行时同款解析器验证并再次全量构建后，启动日志确认 `hajimi-website` 已注册且不再有 YAML 错误。
- app/LibreChat 镜像分别为 `sha256:7822895a387098a30967d7cea2688f36bdfc20d91864c417e3a6e53c57d0c974`、`sha256:78b891d4b8a843172519ab5d302268776011adee72df75626023ceb03dc6abdc`，四容器 `healthy`。生产只读、完整无费用集成、127/192 路径和 Chat 浏览器 smoke 均通过；新入口 `/chat/assets/index.7YakS8m_.js` 命中所有新控件，旧入口返回 410，未发送真实生图。

## 2026-07-20 Chat 电商主图设计师 v2 实现复核

### 已确认

- 旧版把图片角色固定为产品/参考并在服务端机械拼接文案；新实现以明确 `ecommerce-main-image` ID 为唯一入口，让 GPT‑5.6 两次查看原图和用户修改。服务端只做归属、格式、计费和确定性安全约束，不再补写创意布局。
- v2 方案把创意主体保存在 `designPrompt`，表格只承载可识别、可编辑的动态 `copyItems`；来源标记由服务端按稳定 ID保留，客户端无法伪造。历史 `fields/copy` 仅作为兼容输入转换为动态行。
- 报价与生图边界清晰：准备方案和确认方案均不调用图片 Provider；GPT 返回 `finalPrompt` 后才创建报价，下一次明确确认才执行。修订会恢复原始参考图和上一版结果。

### 验证与发布门禁

- 后端、MCP、LibreChat UI 和两个前端构建门禁全部通过；`ToolCall` 33/33，用例覆盖完整方案编辑、名称/内容编辑、来源只读、增删行和旧卡片。假 Provider 抓包确认反向角色请求含真实 `input_image`。
- 用户确认后台原 `GPT 5.5` 实际为 GPT‑5.6 API 后，核对持久化路线发现真实模型键为 `gpt-5.6-terra`。已让模型目录、全部托管智能体、请求示例、计费与 Provider 请求动态跟随后台路线；旧 `gpt-5.5`/`gpt-5.6` 名称作为兼容别名，不新增重复模型。
- 真实多模态探测成功：请求模型 `gpt-5.6-terra`，两张原图均以 `input_image` 发送，正确判定图1氛围参考、图2唯一产品并返回 10 条动态文案；账本扣 5 算力，没有报价或图片 Provider 调用。
- 发布前活动生成任务 0，备份 `docker/backup/internal-prod-20260720-160830` 后完整重建；一次性迁移同时把生产历史智能体指令升级为 v2。app/LibreChat 镜像分别为 `sha256:35f1809f45ed6d2c8b85c1c894b66a117943a91b4f518e98da9e297df2b4bd48`、`sha256:99979eb4bfa37748ef3984769ec3cd083f4ec22729efd4643afe56e629f19849`，四容器健康。127/192、新旧入口隔离、生产只读、无费用 Chat 集成与浏览器 smoke 均通过。

## 2026-07-20 Chat 电商主图真实闭环复核

### 已确认

- GPT‑5.6 方案、方案确认后的 `finalPrompt`、报价确认、真实图生图、文件落盘和前端可访问链路已完整跑通，不是 mock。
- 真实测试暴露的是两类独立上游问题：二次 GPT 在原 120 秒门限内未返回；默认图片线路返回 Cloudflare 524。前者已通过仅作用于 `ecommerce-main-image` 的 240 秒超时修复，后者通过用户可选备用图片线路成功完成，不做静默线路切换。
- 失败的 GPT 调用已退款 5 算力，失败图片报价未扣费；成功的两次 GPT 调用和一次图片生成共扣 20 算力，账本与余额一致。

### 验证与结果

- 生成记录 `gen_mrszl6t882d8bd4f` 完成；文件 `/uploads/generated/d3f21e46b8d1e5a6a63475b273850bc2.png` 为 1,567,143 字节 PNG，本机和内网地址均返回 200，并已人工查看生成内容。
- 专用超时修复通过 `node --check` 与工具续接回归，并从主工作区完整重建 app。当前镜像 `sha256:7e1f9dfd41c28461fd3612f25fe8cd2b725d717370b07d9ebaa7d2151cd1bcd4`，创建 `2026-07-20T08:46:08.929890626Z`，启动 `2026-07-20T08:46:15.290867619Z`，健康检查连续通过。

## 2026-07-20 画布图片生成节点隐藏提示词移除复核

### 已确认

- 截图中的图片生成节点走 `/api/generate/tasks`。此前 `buildImageGenerateNodePrompt()` 会在节点文字后追加目标比例、像素尺寸、重新构图、扩展场景和禁止沿用参考图画幅；这段内容不是用户在节点卡中输入的。
- 用户要求节点卡成为提示词唯一事实来源。当前实现只发送节点可见文字；只有输入为空时保留最短兜底。比例和尺寸继续通过请求参数表达，不再重复写进 Prompt。
- 本次没有修改 `/api/template/generate-image`、Chat 电商主图设计师的已确认方案流程或 `/api/image-tools/*` 局部绘图链路。

### 验证与发布状态

- 回归先在旧实现上失败于 `Image node prompt must not append hidden canvas constraints`；修改后 54 组比例/尺寸全部通过，假 Provider multipart 同时确认 Prompt 无隐藏词且 `size/quality` 未丢失。
- 后端语法、适配器覆盖、Chat 图片工具、一次性 API 和后端/画布边界 smoke 全部通过。所有测试使用临时数据库和假 Provider，没有真实费用。
- 活动任务检查未发现 `pending/running`；一致性备份为 `docker/backup/internal-prod-20260720-174657`。基础 Compose 单独启动触发宿主机 `3456` 端口冲突，新镜像虽已构建但 app 未启动；使用正式生产覆盖文件重新启动后恢复为“gateway 独占宿主机端口、app 仅容器网络”的正确拓扑。
- 正式 app 镜像 `sha256:e4391ee734994c19fa0fcf82958135c1f063756af30d7978520bc6b55da48812` 已运行且健康；四个正式容器全部 `healthy`。容器内函数源码和关键词反向检查确认隐藏提示词不存在，生产只读 smoke 与 127/192 首页、画布、健康接口全部通过。

## 2026-07-21 Provider 有效返图不吞图复核

### 已确认

- 根因不是中转未返图，而是 `persistProviderImageResults()` 在文件落盘前调用比例断言；超过 3% 时直接抛出 `PROVIDER_IMAGE_ASPECT_RATIO_MISMATCH`，有效图片字节随请求结束丢失。
- 当前实现只对空内容、无效签名、无法解码或落盘失败保持失败。可解码返图始终写入 `/uploads/generated/` 并返回本地 URL；比例偏差或尺寸未知只附加警告元数据，不阻断画布、模板或 Chat 的成功结果。
- 已经被旧逻辑丢弃且上游未提供可回查下载地址的历史图片无法从本地恢复；修复作用于后续返图。

### 验证

- 回归先在旧实现上按预期失败于缺少非阻断警告函数；修复后用与请求比例不符的有效 PNG 验证仍会落盘、返回本地 URL 和实际尺寸，并携带 `PROVIDER_IMAGE_ASPECT_RATIO_MISMATCH` 警告。
- `node --check`、尺寸映射、适配器覆盖、队列保护、Chat 假 Provider、一次性 API 和后端/画布边界 smoke 通过，未发起真实 Provider 请求。
- 活动任务为 0；一致性备份 `docker/backup/internal-prod-20260721-101127` 后完整重建正式 app。镜像 `sha256:2190dad5a1498e051e8a20879b3a3b191071e43e36ea8e8ce20aa7bbe2515281` 已运行且健康，四个正式容器全部 `healthy`，gateway 拓扑未变。
- 容器内专项回归、生产只读 smoke、旧资源 410/404 隔离，以及 `192.168.0.39:3456` 的 `/`、`/canvas`、`/user/center`、`/chat/`、`/api/health` 均通过；没有真实 Provider 调用。

## 2026-07-21 Chat 图像分析 Skills 发布复核

### 已确认

- 压缩包中的三项能力均已转换为 LibreChat 原生 Skill，正文与全部 14 个引用文件一致落库；没有把 Skill 原文硬编码进托管智能体系统提示词，也没有让三项能力默认无条件执行。
- 公开共享通过 LibreChat 权限 API 写入 public viewer ACL。同步脚本会校验权限响应中的 public grant；无浏览器 User-Agent 导致的 HTTP 200/SSE 假成功已被发现并修复。
- Chat 首页试用引导只在对应 Skill 确实出现在当前用户列表时渲染。三个按钮共用现有 `selectSkill`，选中后作用于下一条消息；风格语法引导明确要求同一作者至少 4–5 份分析报告。
- 主站管理员的无效邮箱兼容仅发生在管理员 Chat SSO 建号阶段，普通用户的邮箱校验和主站账号记录未放宽或改写。

### 验证与发布

- `node --check`、Reviewed Skills dry-run、固定 LibreChat 静态集成 smoke、完整 LibreChat 前端构建均通过；Skills 数据核验为 3 项、14 个文件、3 条公开 viewer ACL，且全部 `userInvocable=true`、`alwaysApply=false`。
- 一致性备份 `docker/backup/internal-prod-20260721-104817` 与 `archives/librechat-mongodb.archive.gz` 已生成，Mongo 恢复 dry-run 0 失败。正式 app/LibreChat 镜像分别为 `sha256:41ec57f8db7b4f722d646373fe7f1f4f0a87b478e2c50864ead8184e774ac5df`、`sha256:a85c2b93ddf3d7efa3b99167dbabd5a5184b9d50906dbf97cf4513c6dd57df40`，四容器均健康。
- 生产只读 smoke 与普通用户 Chat 浏览器 smoke 通过；实际页面存在 Skills、试用引导、三张引导卡和生图线路选择，点击精确反推卡后 `aria-pressed=true`，无 5xx 或控制台错误。验收未发送消息、未调用 Provider、未产生费用。

## 2026-07-21 画布图片生成节点提示词可读性复核

### 已确认

- 难读原因来自当前运行 CSS：节点宽 `410px`，提示词编辑器默认 `124px/13px`，且正文没有显式字重；不是后端 Prompt、节点 JSON 或浏览器数据异常。
- 新规则只覆盖当前 `.vue-flow` 内的图片生成节点，将节点提高到 `480px`、编辑器提高到 `168px`，正文设为 `15px/600/1.8`，并保留窄屏上限和原有纵向 resize。没有改动提示词上行、比例尺寸参数、节点连线、缩放或生成按钮行为。
- 非画布页不会匹配这些选择器；没有新增 observer、事件监听、依赖或另一套画布实现。

### 验证与发布

- `verify-canvas-performance-assets.js`、`verify-canvas-operation-performance.js`、`smoke-backend-canvas-boundary.ps1` 和 `npm run build --prefix frontend` 全部通过；新资源 query 和关键尺寸、字号、字重均有静态门禁。
- 活动任务为 0，备份 `docker/backup/internal-prod-20260721-114800` 后完整重建正式 app。镜像 `sha256:059e38b6fb1a253858ccce73182098d3518d09323b45a7559dccd2f7e7cf5299` 已健康运行，四容器健康且只有 gateway 暴露 3456。
- 生产普通用户浏览器实际计算值为节点宽 `480px`、输入框高 `168px`、字号 `15px`、字重 `600`、行高 `27px`；截图已人工查看。只读生产 smoke、Chat smoke、旧资源隔离和五条主要路径通过，没有 Provider 调用或费用。
- 浏览器进入 `/canvas` 自动创建的空白示例项目 `project_1784605930261_2aitwynf9` 已由同一验收账号删除，随后 GET 返回 404，生产未留下该测试数据。

## 2026-07-21 画布图片生成节点免费 AI 扩写复核

### 已确认

- 原历史 `/api/canvas/generate-prompt` 只接收参考图数量和图序标签，不读取图片内容，不能满足“把上传图片和当前文本一起交给 GPT‑5.6 扩写”的目标。新接口实际加载最多 4 张 PNG/JPEG/WebP 并发送多模态 `input_image`，不会把图片线路误作文本线路。
- 新编排规则保留用户明确要求、主体身份、Logo、标签和指定文字，同时把非核心背景、构图、光影、材质和空间层次放入允许优化范围，避免旧全局硬锁定导致输出过短、过于保守。成像质量要求采用焦点、曝光、高光、阴影、材质和压缩糊感等可执行语言。
- 用户选择平台承担文本调用成本；后端没有任何余额查询、扣减或流水写入，响应固定 `costPoints=0`。服务端并发门禁和前端加载禁用可以阻止同一用户同时重复提交，但该免费能力仍会产生平台 Provider 成本。
- 按钮适配层没有修改旧 Canvas bundle，也没有新增第二套画布；只在 `/canvas` 安装，离开路由完整 teardown。按钮只触发提示词接口，成功后回填 Vue textarea，不触发生图。

### 验证与发布

- `node --check`、`verify-canvas-performance-assets.js`、假 Provider 多模态/免费余额回归、`smoke-backend-canvas-boundary.ps1`、`npm run build --prefix frontend` 全部通过。测试确认原提示词和真实图片 Data URL 进入 `gpt-5.6-terra` 请求，超出 4 张时 Provider 调用次数不增加。
- Playwright 真实 DOM 回归通过：资源加载、按钮右下角布局、输入框留白、参考图请求、353 字回填、零生图请求和 `/user/center` teardown 均符合预期；局部截图人工确认按钮清晰可见且不遮挡输入。
- 测试只使用本地 mock 或本机假 Provider，没有真实外部调用和费用。Playwright/临时后端均已停止；系统临时测试目录的递归清理由本机策略拒绝，未改用跨 shell 删除，目录不在项目工作区。
- 用户确认发布后，活动任务为 0；一致性备份 `docker/backup/internal-prod-20260721-124434` 后使用正式双 Compose 完整重建 app。新镜像 `sha256:81f732edba3dfb65a94402b097573b6e1d140a5337e22c787c0edfd4ca11d5ca`（创建 `2026-07-21T04:45:26.60737217Z`，启动 `2026-07-21T04:45:45.892305863Z`）已健康运行，其他三个正式容器同样健康。
- 生产只读 smoke 验证旧资源 410、无效资源 404、新接口未认证 401；3456 的首页、画布、用户中心、后台、Chat 和健康接口均为 200，线上新 JS/CSS 与本地 SHA-256 一致。Playwright 直访用户中心的未登录守卫后，扩写调试对象为 `undefined`、按钮和宿主均为 0。全程未调用真实 Provider；发布资源 query 已变化，用户需在画布执行一次 `Ctrl+F5`。

## 2026-07-21 Docker Provider 强制代理撤回复核

### 已确认

- 真实任务 `task_mruccezn126c81a8` 返回 `socket hang up`；`task_mrucdmk853a7f2d6` 返回 Cloudflare `524 origin_response_timeout`，说明请求已经到达 `lingsuan.top`，但其源站 120 秒内没有完成响应。
- 强制 VPN 代理不是稳定修复。当前容器直连 `lingsuan.top` 和 Packy 均已恢复，且同一用户在代理变更前有近似提示词成功记录，因此已撤回代理而不是继续让用户试错。
- 两个失败任务均没有新增 `balance_logs` 扣费记录；用户余额为 `415`。两条图片路线当前共享同一域名，切换路线不构成不同上游。

### 验证与发布

- 代码、依赖、Compose、正式环境和文档中的代理实现已逐项清除；`server.js` 语法、pre-TLS 回归、Compose 展开和 `git diff --check` 通过。
- 一致性备份 `docker/backup/internal-prod-20260721-155357` 后完整重建 app；镜像 `sha256:17acdbad9309a29dc43a9137edb5e9b5974375846d6708b3364669a4ecc08464` 已健康运行，四个正式容器全部健康。
- 容器直连免费 HEAD 返回 HTTP `403`，生产 smoke、旧资源隔离和 `192.168.0.39:3456` 的首页、画布、用户中心、后台、Chat 全部通过。没有再次调用真实图片接口；如果直连仍返回 524，需要中转站处理源站超时或配置真正独立的备用 Provider。
## 2026-07-21 画布大参考图上传失败复核

- 结论：故障不是 Docker 完全无法访问 `lingsuan.top`，而是 12–14MB、3840 方图直接进入 `/v1/images/edits` multipart 后更容易触发上游连接重置；早晨小图成功与当前大图失败可以同时成立。
- 修复边界正确：只改变 Provider 出站副本，不改变用户原图、节点、项目或历史；后端超限护栏位于扣费和 Provider 调用之前。
- 风险控制：普通 socket reset 不自动重试，因为请求可能已经到达上游；错误信息改为暴露脱敏的 `cause.code`，不返回密钥。前端压缩失败会保留原图，由后端护栏明确终止，不会静默发送超限文件。
- 验证：Chromium 压缩实跑、同源 URL 转换、假 Provider 不触达、余额/历史不变、Node 语法、54 组尺寸、6 组适配器、API/画布 smoke、Vue build、Docker 完整重建、容器健康、线上资源哈希和六个生产路径均通过。Chromium 曾在正式收口前捕获补丁字符串 URL 正则转义错误，修复并重新构建后复测通过；未执行真实付费生图。

## 2026-07-22 图片 Provider 首连接失败复核

- 证据链：gateway 在 18:08 与 18:11 均收到 `/api/generate/tasks` 并返回 202；对应任务最终错误为 `ETIMEDOUT` 与 `ECONNRESET`。中转无请求记录不能反推浏览器未提交，只能说明连接未形成完整上游请求。
- 用户授权的一次真实反馈环使用本地生成的 16,691 字节 PNG、复制生产数据库和一次性候选容器；任务 `task_mrveq1ed8585d440` 在三次 TLS 建连后仍以 `ECONNRESET` 失败，复制库余额未变，生产数据库未写入。失败发生在极小 multipart 上，因此不能再归因于参考图体积。
- 根因反馈环最终确认宿主机可经 IPv6 或 Clash 访问 lingsuan，而 Docker 直连该域名的 IPv4 超时；Docker 经 `host.docker.internal:7890` 返回 HTTP 404。Windows 系统代理、WinHTTP、持久化代理环境变量和正式容器全局代理均未启用，因此不是本机 Proxy 被改坏。
- 安全边界：只重试能证明请求尚未进入 HTTP 上游阶段的错误；普通 `socket hang up` 或仅有 `ECONNRESET` 的歧义错误仍只发一次。未改变用户 VPN、Clash 规则、提示词、参考图原件、计费或线路配置。
- 代码复核：`https-proxy-agent@7.0.6` 只服务于精确 `lingsuan.top` 图片 HTTPS；全局代理为空，其他 Provider、文本和 HTTP 假 Provider 直连。未命中代理时保留 IPv4 DNS 轮换；任务诊断只记录 `transportMode`、尺寸/MIME/重试次数，不记录代理凭据、Key、提示词或图片。
- 定向路由红绿回归、候选/正式容器各 3 次免费代理 HEAD、假 Provider、smoke 与构建全部通过。活动任务为 0 后生成备份 `docker/backup/internal-prod-20260722-101000` 并完整重建 app；正式镜像 `sha256:52aec167cd9cf1a497397eee1531bc67ca09f25460a74b2348f7d893cbb5605c` 健康，四容器、生产 smoke 和六条 3456 路径通过。未自动执行新的付费生图。

## 2026-07-22 昨日中午生图链路复位复核

- 复位锚点来自生产数据库：本地 `2026-07-21 11:42:30` 的 `gen_mru3y5gbc3bcca54` 为中午前最后一个成功生成。`internal-prod-20260721-114800` 是紧随其后的数据备份，但不含源码；当时镜像已被清理，不能冒充二进制级镜像回滚。
- 按当天会话日志复原默认 HTTPS 直连和画布 `20260717reversecopy1`，撤回后加的代理、IPv4 agent、参考图压缩与后端体积护栏；当前业务数据库、上传和 Chat 卷保持不变。首次镜像构建被只识别新 query 的资产补丁脚本安全拦截，旧容器未受影响；补丁脚本接受中午 query 后重新构建成功。
- Node/Compose/画布静态断言、适配器、pre-TLS、队列、54 组尺寸、Vue build、一次性 API 与后端边界 smoke 全部通过。正式镜像 `sha256:c3cea04b0cc34f89aeb5652c8fbc2d1cb081a32d220ff3706478dc904969b266` 健康，四容器及生产六条路径通过，代理环境变量为空。
- 发布后无 Key、无费用的默认直连 HEAD 连续 3 次超时约 5 秒。复位已完成，但外部网络状态没有随代码回到昨日；未提交付费任务，因此真实生图恢复状态仍为未验证。
- 用户明确授权后只提交一次生产图生图任务 `task_mrvi9x06eec6b09e`。输入为 1,231,012 字节 PNG，Provider 请求为 `/v1/images/edits`、1024×1024、high、`https-default-direct`；任务从 pending 进入 running 后在约 21.5 秒以 `ETIMEDOUT` 结束。管理员余额 `999959 → 999959`，没有新增生成扣费。该反馈环确认画布/主站提交与参考图读取正常，失败发生在默认直连 Provider 阶段。
- 新路线 `packyapi` 并未遗漏：用户在核对期间提交的 `task_mrvihcpx82a601ae` 已走 `www.packyapi.com/v1/images/edits`，2 张 PNG 共 2,611,708 字节，约 18 秒后连接被重置。对应用户余额为 `380`，该时段没有 balance log 或 generation 记录。无 Key HEAD 返回 403，故 Packy DNS/TLS/基础 HTTP 可达，失败范围缩小到真实 multipart 上传或其后端处理阶段；没有进行重复付费提交。
- 配置复核发现 `packyapi` 的 `apiFormat/requestFormat` 为 `new-api`，而后端只有显式 `packy-images` 才启用 Packy 字段白名单。既有 `check-packy-gpt-image-adapter-coverage.js`、Chat 图片工具假 Provider 回归和 disposable API smoke 均通过，证明严格适配器本身无需重写；修复只需纠正生产路线格式，不需要删除任务状态、计费或统一响应解析。
- 一致性备份 `internal-prod-20260722-112609` 后通过管理员 API 将单条路线切换为 `packy-images`，完整重建 app 并确认配置跨重启持久化。镜像 `sha256:1aa02a9684c56a6758b02242decc30f113776b812b6bb1076b31c7365ab89284` 健康，四容器与生产 smoke 通过。
- 真实回归 `task_mrviwwh4a187fc4c` 的请求元数据确认 endpoint 为 `/v1/images/edits`，两张图使用重复单数 `image`，禁用字段集合为空；任务成功生成 `/uploads/generated/d0b8900b9927660f3eef4a11f9532244.png`。图片签名、1024×1024 尺寸、1,004,794 字节文件和生产 200 均通过；扣费恰好 10 点且仅发生一次。正确假设为“路线格式误配”，不是参考图护栏或前端异步任务机制。
- 对其余线路的完成审计使用同一输入消除图片、提示词、尺寸和质量差异。官转与高速专线分别在 21,353ms、21,338ms 以 `ETIMEDOUT` 结束；两条请求均为 `/v1/images/edits`、`image[]` 重复字段、2,242,146 字节参考图、`https-default-direct`。管理员余额和 balance log 均未变化；额外免费 HEAD 同样超时。证据支持共同域名直连路径故障，而不是线路字段、护栏或单个 Token 池响应。

## 2026-07-22 lingsuan 定向代理恢复复核

- 正确假设：当前 Docker/宿主机 IPv4 到 lingsuan Cloudflare 地址无法建 TCP；Docker 没有可用 IPv6，而宿主机 Clash CONNECT 可达。三次容器直连均只出现 DNS lookup、没有 `connect/secureConnect`；容器 IPv6立即 `ENETUNREACH`，代理 CONNECT 11ms 成功。中转后台没有失败请求记录与该层级完全一致。
- 被排除：请求格式、参考图、提示词、Key、任务队列和扣费护栏。官转/高速使用同一严格 `lingsuan-images` 请求形状同时超时，而同输入 Packy严格适配器真实成功；两笔失败时段没有 generation 或 balance log。
- 修复只恢复精确域名的图片代理，不恢复全局 Provider 代理、图片 IPv4 DNS 轮换、参考图压缩或体积护栏。非 lingsuan 图片请求的 Agent 保持 `undefined`，避免改变 Packy 已验证链路；普通图生图 POST 仍不因歧义 socket reset 自动重放。
- 本地和最终容器专项回归、完整 smoke、正式六路径与免费双域探针均通过。最终镜像与 main 同步，备份、镜像创建/启动时间及无全局代理证据已记录。
- 真实反馈环已闭合：预检为 `pending=0/running=0` 后只提交 `task_mrvmoep3457ee321` 一次，没有自动或人工重试。任务明确命中高速专线、严格 `lingsuan-images`、重复 `image[]` 和 `https-proxy`，约 45.1 秒成功；两张参考图、模型、提示词、尺寸和质量与 Packy 成功对照保持一致。
- 结果文件 `/uploads/generated/96571fa1fa352aa8aa8b4d2e57062e3b.png` 为有效 1024×1024 PNG，1,059,847 字节，生产 HTTP 200；数据库只增加 `gen_mrvmpcck75004ed4` 和一条 `-10` 流水，余额 `999949→999939`。因此修复结论从“基础到站”升级为“完整真实图生图、返图持久化与单次扣费均正常”。
- 后续三线单次复测又暴露稳定性差异：官转 `task_mrvn67doe2a8727b` 和高速 `task_mrvn7hbn55b2af53` 使用相同双图与参数，均在约 17.6 秒收到 `ECONNRESET`；路由、严格字段、参考图读取和定向代理元数据均正确，余额与历史无变化。高速此前成功而本次失败，说明“能返图”已证实，但共享 lingsuan/代理路径尚不稳定。
- Packy 对照 `task_mrvn8qho2704de0d` 以相同输入约 40.1 秒成功；文件 `/uploads/generated/b1cf1b9e5ef3fc3b7444f46589e279a4.png` 为 1,008,284 字节有效 PNG，生产 200，且只有一条 10 点扣费。三条任务全部终态后 `pending=0/running=0`，没有任何自动或人工重试。

## 2026-07-22 Clash 规则与三线最终复核

- 直接证据推翻“Codex 先前写坏 Clash 规则”：修改前 `override.yaml` 只有 `items: []`，且配置树中没有 lingsuan/Docker 自定义规则；此前变更是让 Docker 的灵算图片请求显式进入既有 `7890`，随后被 Clash 的兜底 `MATCH` 送到 VPN 节点。
- 在逐文件备份后新增官方覆盖机制支持的首位 `DIRECT` 规则，重载后的实际 `work/config.yaml` 包含该规则且 Mihomo `-t` 成功。连续五次容器探针和核心日志共同证明流量已从 VPN 节点改为 `DIRECT`，不是只改了未生效的源文件。
- 公平真实回归使用同一提示词、两张参考图、`gpt-image-2`、单图和 low 参数。高速与 Packy 首次即成功；官转第一次仍由上游重置，但零扣费，免费鉴权 200 且隔数分钟后的受控复测成功。因此本地 Clash 路由故障已解除，同时仍保留“Provider 歧义 reset 不自动重放”的费用护栏。
- 三条成功任务对应三条且仅三条生成记录与扣费流水，三张 PNG 落盘/生产 200；无活动任务。普通用户读取到三条路线均启用，四个正式容器健康，当前可以交付其他用户使用。

## 2026-07-22 1:1 返图偏差复核

- 排除“画布没加 1:1”：节点当前值为 `1x1`，生成适配层会规范为 `ratio=1:1`，后端再生成 Provider `size`。两笔异常任务元数据均为 `size=1024x1024`，说明比例在到达中转前未丢失。
- 排除“把 Provider size 改为 1X1 即可”：现有兼容测试确认 `1x1/1X1/1×1` 都只作为站内比例输入，最终都映射为 `1024x1024`；严格 Lingsuan 适配器按已验证的官方非流式字段白名单有意省略 `ratio`。
- 正确假设：两张异常文件本身就是上游返回的非方图，并已有比例偏差警告；最新 `4K + 1:1` 任务实际发送 `2880x2880 + high` 后收到 Provider 502。截图显示的当前 4K 状态不代表更早已生成结果的历史请求档位。
- 本轮没有更改站内请求契约或生产状态，避免以无文档的 `ratio=1X1` 扩展字段破坏已验证过的 Lingsuan 官方请求。

## 2026-07-22 Clash 重启时间线复核

- 正确假设：`15:29:30/15:29:32` 的两笔立即失败来自 Clash 已关闭、7890 尚未监听；core 在 `15:29:42` 才恢复 mixed proxy。错误中的目标 `192.168.65.254:7890` 是 Docker 对 `host.docker.internal:7890` 的解析结果，不是 Provider 地址。
- 排除“换节点改变灵算出口”：重启后的实际配置和 core 日志仍命中 `DomainSuffix(lingsuan.top) using DIRECT`。节点选择只影响其他代理规则；但关闭或重载 core 会使 Docker 的入口短暂消失，并中断在途连接。
- 当前免费探针证实入口已恢复，同时 5 次中仍有 1 次远端 reset，故后续 `ECONNRESET` 不能全部归因于节点选择。未进行付费重放。

## 2026-07-22 部署前真实生图复核

- 以用户自然产生的任务作为反馈环，避免额外付费：Packy `task_mrvs30bp6d4cce16` 的 4K 方图与高速 `task_mrvs3721bfeab920` 的 1K 方图均成功，文件头尺寸与请求一致，生产下载字节分别为 9,084,705、1,182,373。
- 生产健康、结果 URL、免费灵算到站与只读 smoke 均通过，证明当前应用、数据库、生成任务、Provider、落盘和网关链路可用。
- 剩余风险不是“完全不能生图”，而是灵算 4K 仍有 524 且本机灵算依赖 Clash 作为 Docker CONNECT 入口。目标服务器迁移必须重新验证出口并重设 `LINGSUAN_IMAGE_PROXY_URL`，不能复制一个目标机不存在的 `host.docker.internal:7890` 服务。

## 2026-07-22 服务器直连隔离复核

- 采用独立最后层 Compose 覆盖，而不是修改当前工作站覆盖或真实 `.env`：这样服务器可明确清空灵算代理，本机正在服务的 3456 仍保留现有 Clash 转接。
- 实际 `docker compose config` 输出证明覆盖顺序正确；服务器组合没有 `host.docker.internal:7890`，工作站组合没有被清空。源码包测试证明新文件会进入可迁移发布包且不带私有 `.env`。
- 本轮只准备未来服务器配置，没有把服务器模式应用到当前生产，因此无需为未启用的覆盖文件重建现有 app。

## 2026-07-22 当前宿主机代理隔离复核

- 正确假设：用户关闭“系统代理”后 Codex 无法联网，因此不能用关闭 Clash 作为生产方案；真正耦合点是正式 app 的 `LINGSUAN_IMAGE_PROXY_URL=http://host.docker.internal:7890`。Windows 系统代理可继续开启，同时让容器应用走原生 HTTPS 直连。
- 变更前后各 10 次容器直连探针全部到站，正式 app 完整重建后变量为空、容器 healthy、重启次数 0、内网健康接口和只读 smoke 通过。最新用户任务在切换前已成功返回，所谓“刚刚崩了”没有对应容器重启或服务宕机证据。
- 将 Chat 正式 Compose 默认改为空，防止下一次两文件重建回退到 Clash；保留显式代理能力和服务器清空覆盖。本轮未修改 Windows、Clash 或 VPN 配置，也未由 Codex 发起真实生图。

## 2026-07-23 10 用户稳定生图架构复核

- 旧不稳定并非单一网络问题：内存任务无法跨重启、多个入口各自扣费、同域线路可能并发放大、批量任务长期占槽、客户端重复提交和合成进度共同放大了偶发 Provider 故障。当前改造把这些本地可控风险收口到持久任务、预占账务和统一调度。
- 账务正确性以 SQLite 事务和唯一索引保证，不依赖 Worker 内存状态。测试证明同键重放不重复调用 Provider，余额只够一单时第二单拒绝，部分成功只结算成功图片，失败、取消和中断只退款一次，所有测试用户余额均非负。
- 调度正确性以任务项为粒度验证：同用户最多一个运行中，同失败域最多一个，全局上限可配置为 3；10 用户首轮均先于任一用户第二轮开始，批量任务不会持续占住线路。队列满返回 429 与 Retry-After。
- 故障策略保持费用优先：只允许建连前安全重试，普通歧义断连和跨线路切换均不自动重放；三次瞬态失败开启失败域熔断，运行中取消与重启中断明确记录上游费用歧义。
- 参考图只在任务目录落盘，数据库请求 JSON 已脱敏；4 张、5 MiB/张、16 MiB 合计、24 MiB 请求体和 24 小时清理均有边界。假 Provider 回归覆盖超限、落盘失败、超时、断连、5xx、熔断恢复和连接复用。
- 剩余风险：当前仍是单实例 SQLite + 进程内 Worker，不支持多实例竞争；Provider 自身的 524/reset 不会被本地架构消除；Docker/3456 和真实线路尚未在本轮候选代码上验证。进入生产必须另行备份、完整重建、容器健康和内网 URL 验收。

## 2026-07-23 自审与压力复核

- 标准审查确认三个代码缺陷：队列满时 `finally` 绕过退避、非瞬态失败未重置熔断计数、运行中取消只记录普通取消。三项均新增回归并修复。
- 规格审查确认活动输入目录可能被 24 小时清理误删、部分成功缺 `warnings`、后台未直接显示熔断和阶段耗时；均已修复。关于 `fetch.agent` 的初步质疑经源码核对被排除：项目调用的是 `node-fetch@3`，不是 Node 全局 Undici fetch；实际缺口是直连图片请求未统一使用连接池，现已使用独立 keep-alive Agent，文本链路不受影响。真实网络复核发现强制 IPv4 在宿主机 0/10、IPv6 10/10，而 Docker IPv4 10/10；每次新建 TLS 时自动竞速在宿主机仅 8/20，显式 IPv6 为 20/20，故最终采用可配置的确定性地址族：Windows 默认 6、Linux/Docker 默认 4，可用 `PROVIDER_IMAGE_IP_FAMILY=4|6|auto` 覆盖。
- 50 个相同幂等键并发请求只生成 1 个任务、1 次预占和 1 次 Provider 调用。30 个在途任务可接受，第 31 个返回 429 与 Retry-After；三种失败域实测全局并发 3，同失败域始终为 1。
- 服务级故障注入覆盖超时、socket 断连、400、503 和熔断恢复；非瞬态 400 会打断连续计数，第三个连续瞬态失败后熔断窗口内不向上游发请求。运行中取消返回 `TASK_CANCELLED_UPSTREAM_UNKNOWN` 并提示核对上游账单。
- 20 轮 600 任务浸泡后存活堆和外部内存回落，未发现 JavaScript/Buffer 泄漏；RSS 高水位约 294MiB、空闲约 285MiB，属于仍需生产监控的原生/V8 保留内存。当前候选仍不支持多实例 Worker，也未验证 Docker/3456 或真实付费线路。
- 流程偏差：API 契约文档提交晚于部分实现提交。远端分支已推送，修正顺序需要改写历史，不在未获授权时强推；本轮仅记录，不声称满足“契约先于实现”的提交顺序。
- 中转复核的最终正确假设是“地址族可用性因运行环境相反”：当前 Windows 宿主机 IPv4 连续超时但 IPv6 稳定，Docker 没有可用 IPv6但 IPv4 稳定。无条件 IPv4 和纯自动竞速都被数据否定，确定性环境默认值加显式覆盖通过全新 TLS 20/20 与无 Key multipart 5/5。仍不能排除带 Key、大参考图、长时间上游生成阶段的 reset/5xx。
- Packy 对照证明剩余问题不全由地址族造成：选对宿主 IPv6/Docker IPv4 后，全新 TLS 仍分别出现 1/10 和 2/10、复轮 Docker 2/20 超时。故本地修复目标是消除确定性的坏路径与并发放大，不承诺替外部中转消除瞬态网络失败。

## 2026-07-23 Lingsuan 真实大图反馈环复核

- 验证假设成立：Windows 宿主机显式 IPv6 不仅能完成无 Key 探针，也能完成 712,420 字节 JPEG 的真实 multipart 上传和 2880×2880 上游生成。attempt 记录为 `https-ipv6-pool`、HTTP 200、74,945ms、`preTlsRetryCount=0`。
- 唯一性证据完整：幂等键只对应 1 个任务，任务只有 1 个 item 和 1 个 attempt；任务受理后只轮询 GET/SQLite，没有第二次 POST、没有安全连接重试、没有跨线路切换。
- 账务证据完整：10 点只预占一次并最终结算，账户 40→30；任务为 `success/done/settled`，生成历史新增 1 条。成功链路不存在退款记录是预期行为，预占流水即实际余额变更，结算只改变任务账务状态。
- 落盘证据完整：结果 PNG 为 2880×2880、7,299,921 字节，HTTP 200 下载内容与磁盘文件一致；人工检查无破图或尺寸降级。
- 安全边界：Lingsuan 路线 Key 仅以内存变量传入临时 3458 进程，未出现在命令输出、源码、Git 或 3458 数据库。验证后真实进程已停止，3458 恢复 Mock；3456 Docker 未执行生命周期或写操作。
- 仍不应过度推论：这是单笔真实反馈环，只能排除本次连接、上传、生成和保存故障；外部瞬态 timeout/reset/5xx 仍可能发生，真实 10 用户并发也因费用与上游限额未执行。

## 2026-07-23 Lingsuan 五任务突发复核

- 假设 1 成立：5 个用户的提交在 85ms 内全部受理，同失败域最大上游并发始终为 1，排队顺序为 1–4；任务、item、attempt 均为 5，没有丢失或重复。
- 假设 2 部分成立：全部请求选择 `https-ipv6-pool` 且 `preTlsRetryCount=0`，排除了本轮的地址族和 TLS 建连问题；但只有 3 笔 HTTP 200，不能把连接成功等同于上游生成稳定。
- 假设 3 命中：第一笔 HTTP 400 返回 `skipped_mainline=true`，第五笔 HTTP 524。两者都发生在几十秒至两分钟的上游处理后，未触发自动重放；第一笔后续任务仍可继续成功，说明单笔失败没有毒化队列。
- 假设 4 成立：成功三笔结算 30 点，失败两笔退款 20 点，余额均非负；三张结果全部为 2880×2880、HTTP 与磁盘一致。恢复 Mock 并重启 3458 后，5 个终态和 5 个 attempt 仍完整。
- 正确诊断是“本地突发队列稳定，上游真实生成不稳定”：60% 成功率不足以宣称 Lingsuan 稳定。尤其 HTTP 524 代表请求可能已在上游执行，禁止自动重试是合理的费用保护；是否实际扣费需查上游账单。

## 2026-07-23 自适应降载修复复核

- RED 用例首先证明旧调度器同域连续启动间隔为 0ms、单次 524 后下一单仍立即启动、`失败-成功-成功-成功-524` 会因成功清零而无法熔断；修复后分别由启动间隔、错误冷却和 5 次滑动窗口覆盖。
- 结构化分类识别 `skipped_mainline` 与 524，显式 `transient` 优先于通用 HTTP 4xx 判断。允许列表测试确认 Authorization 不进入诊断元数据；任务与 attempt 均能恢复 CF-Ray、请求号和计费歧义字段。
- 一次性假 Provider 验证 524 任务失败退款、未确认人工重试返回 409、确认后新任务受线路冷却而保持排队，取消后退款；Provider 调用数没有因人工重试绕过冷却增长。
- 10 用户完整故障注入和 3 轮 90 任务 soak 通过；P95 53.8ms，同域最大并发 1，三域最大并发 3。RSS 最高约 190.8MiB，堆采样曾回落至 34.9MiB，没有观察到持续对象泄漏。
- 两次真实 4K 验证均命中 Provider 鉴权拒绝，不属于网络 timeout/reset。错误分类为非瞬态、上游预计未扣费；站内预占 20 点全部退款，任务和流水一一对应。由于已达到授权上限，没有更换 Key 后继续测试。
- 规格与工程标准双轴复核补出并关闭了四类边界：并行成功误清冷却、HTTP 200 内嵌 `skipped_mainline`、进程中断/落盘失败缺少计费风险，以及参考图检查后复制前被清理导致 500。对应回归均先失败后修复，最终无剩余规格硬偏差。
- 剩余风险：当前有效 Lingsuan Key 需由用户/线路方更新后才能验证真实成功链；524 的上游账单仍只能由线路账单审计确认。候选尚未应用到 Docker/3456。
