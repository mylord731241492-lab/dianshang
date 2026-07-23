# 功能完善清单

状态只使用：`完成`、`进行中`、`待复核`、`待实现`、`阻塞`。

| 模块 | 状态 | 完成度 | 说明 | 下一步 |
| --- | --- | --- | --- | --- |
| 首页 | 待复核 | 90% | 已按旧站实际首页重新迁移，而不是重做新首页：固定顶部栏、导出/保存/历史记录、登录、左侧首页/新画布/模板/图库/指南导航、浅色玻璃背景、中心生成面板、Chat/Fast/AI 专业绘图 Agent、添加图片、提示词、模型/张数/比例/清晰度、预计算力、生成按钮、我的历史画布项目和新建项目入口已恢复。Playwright 已验证桌面和 390px 移动端横向溢出为 0，重新加载无 401/403、无 pageerror。 | 人工对照旧站首页视觉细节；登录后测试首页真实上传/生成、历史项目读取；继续迁入旧首页保存弹窗、历史项目拖拽惯性和完整项目恢复。 |
| 画布 | 待复核 | 95% | 已新增旧画布性能过渡层，交互态降低毛玻璃/重阴影/动画成本，图片节点懒加载和异步解码，并将自动保存降频；缩放闪烁已修复为 `perf4`：滚轮缩放只启用 viewport/pane/canvas-flow 合成层，不再改写 `.vue-flow__node` 阴影/滤镜/transition；图片节点右侧工具侧边栏裁切已修复为 `perf5`：取消普通 `.vue-flow__node` 的 paint containment，对图片节点、工具栏 wrapper 和工具栏显式保持 `overflow: visible`，并用 toolbarProbe 验证工具栏完整外溢；图片节点已对象化并升级为 `20260629image4`：有图节点使用 `object-fit: contain` 按原始宽高比完整显示，图片舞台以 `fit-content` 作为自适应比例 box，标题和尺寸信息浮到图片上方，右侧工具栏和折叠把手挂在图片 box 右边缘，空图节点收敛为大图上传占位且隐藏 URL 输入行；本轮指定项目 `/canvas/project_1782707934819_dxzylygh5` smoke 通过，并用临时 DOM 探针验证方图 `520x520`、横图 `520x260`、竖图 `260x520` 均完整等比显示，右侧工具栏距图片舞台 `18px`、折叠把手距舞台 `2px` 且不遮挡图片；基础画布、工具栏和项目页可打开；当前策略明确为本地优先；新增 `scripts/smoke-canvas-json-ui.ps1`，已验证后端保存/读取 2 节点 1 连线 JSON，并通过真实 `.workflow.json` 文件输入导入到前端，画布渲染 2 个节点且 console 0 error；首页/画布入口 smoke 已确认桌面 Vue Flow、工具栏和节点内容可渲染；本轮移动端 smoke 确认 390x844 画布 Vue Flow 存在、节点数为 2、无横向溢出、无 console/bad response；已修复图片节点、文生图节点和图片生成节点外层/内层圆角不一致；小地图已改半透明，Canvas Chat 已下移避开顶部工具条；用户中心侧栏标题颜色已统一为深色；画布生图接口已接入 Provider 图片生成入口，真实 `gpt-image-2` 已返回 `mock=false` 图片，远程结果图会走 `/api/proxy-image` 同源代理且 HTTP 200。 | 继续人工验收浏览器画布节点点击生成、真实选中图片节点右侧工具侧边栏是否完整露出、本地文件夹授权保存、文本/视频节点视觉一致性、缩放 20 次是否仍有卡片闪烁和更多节点选中态；指定项目当前未读到已有节点，如需截图验收需先创建或导入含方图/横图/竖图的测试画布；如后续要云端项目自动恢复，再补前端加载逻辑。 |
| 模板 | 待复核 | 97% | 旧模板页仍可用；源码模板页 `/template-image` 第一版已迁入 `frontend/`，可加载 10 个模板、显示素材槽、填写提示词、选择线路/模型/比例/清晰度，并接入 `/api/template/reverse-prompt` 和 `/api/template/generate-image`；未登录自动提示先登录，不触发真实付费生成；本轮登录态只做页面加载回测，不点反推/生成，确认 10 个模板、2 个素材槽、无 4xx/5xx API；截图已归档到 `docs/design-references/template-image-source-2026-06-26.png` 和 `docs/design-references/template-image-source-login-2026-06-26.png`。 | 真实反推/生成会调用外部模型并可能消耗算力，需人工确认后再验收。 |
| 图库 | 待复核 | 98% | 旧图库仍可用；源码图库页 `/gallery` 第一版已迁入 `frontend/`，对接 `/api/user/generations`，支持统计、搜索、模型筛选、打开图片、复制链接和删除记录；未登录自动提示先登录；本轮登录态确认加载 13 张记录、无 4xx/5xx API；截图已归档到 `docs/design-references/gallery-source-2026-06-26.png` 和 `docs/design-references/gallery-source-login-2026-06-26.png`。 | 删除记录是破坏性操作，需确认测试数据后再点测；后续补移动端图库专项截图。 |
| 用户中心 | 待复核 | 98% | 真实表单登录后用户中心显示用户资料、余额、兑换码和 API 线路；源码登录/注册页已迁入 `frontend/`；源码 `/user/center` 第一版已接入 `/api/user/profile`、`/api/user/balance-logs`、`/api/user/api-status` 和退出登录；源码 `/user/records` 已接入生成历史和余额流水；源码 `/user/redeem` 已接入兑换码提交、余额展示和最近流水。已用默认账号 `admin/admin123` 验证用户资料、余额、API 状态、13 条生成记录和 16 条余额流水，无 4xx 响应；本轮修复 `/user/records` 390px 横向溢出，移动端 records/redeem 均为 0 溢出；截图已归档到 `docs/design-references/user-center-source-2026-06-26.png`、`docs/design-references/user-records-source-2026-06-26.png`、`docs/design-references/user-redeem-source-2026-06-26.png`、`docs/design-references/user-records-source-mobile-390x844-2026-06-26.png`、`docs/design-references/user-redeem-source-mobile-390x844-2026-06-26.png`。 | 兑换码真实提交不在自动化中测试，需使用测试兑换码再验收；头像上传/预设头像编辑暂未迁移。 |
| 后台 | 待复核 | 99% | 已归档 10 个后台页面桌面截图；`scripts/smoke-admin-pages-ui.ps1` 可自动登录并复跑 Dashboard、用户、订单、日志、兑换码、API 线路、模型价格、任务监控、模板工作流、系统设置全页面截图；后台截图 runner 已自动审计标题颜色/字重、旧薄荷按钮残留、表格行高、sticky 操作列宽度和按钮样本，10 页复核通过：标题均为深色 900、旧薄荷按钮 0、最大行高 85px、sticky 操作列 226px；Dashboard 兼容字段和模型占比已修；后台表格密度、卡片阴影、按钮字距、图标线宽、任务监控提示词显示已统一；系统设置 `保存设置` 按钮已从偏亮薄荷/糖果感回调为前台同系 emerald 绿白搭配；用户管理、API 线路、模型价格等宽表右侧操作按钮已做横向滚动和固定操作列保护；模板工作流页橙色主按钮、选中模板卡和 checkbox 已统一为清新绿色；后台移动端顶部按钮已避免“返回前台”拆成竖字，API 线路等宽表 sticky 操作列已收窄；后台 UI smoke 已验证系统设置保存、API 线路新增弹窗、兑换码创建弹窗、模板工作流保存；后台保存刷新回显 UI smoke 已覆盖系统设置、API 线路、模型价格、模板工作流四条复杂配置链路，截图后自动恢复/清理临时数据；后台删除/恢复 UI smoke 已加固并通过；后台写入 disposable smoke 已验证用户软删除、回收站恢复、永久匿名化、兑换码增删、API 线路/模型增删；后台配置重启持久化 smoke 已验证 settings、API 线路、模型价格、模板工作流重启后不丢。 | 后台 10 页和保存回显截图仍需人工确认最终观感；API 线路/任务监控等宽表仍依赖横向滚动；移动端后台表格如需更高体验，后续可单独做卡片化。 |
| 部署 | 待复核 | 96% | Docker CLI/Compose 已确认可用，当前 `docker --version` 为 29.5.3、Compose 为 v5.1.4；已使用 `node:20-bookworm` 完成镜像构建并启动容器；本机 Node 占用 `3456` 时，可用 `HOST_PORT=3457` 映射宿主机端口，容器内部仍保持 `PORT=3456`；本轮 `verify-internal-deploy.ps1` 在 `HOST_PORT=3457` 下完整通过：health、API smoke、前端路由 smoke、容器 restart 后 SQLite 仍 ok，最终 `dianshang-app` 为 healthy。 | 后续做服务器/Nginx/HTTPS 部署演练；公司内网多机访问还需要按实际 IP、防火墙和路由再测。 |
| New-API | 待复核 | 90% | Provider Adapter 默认 New-API，未配置 key 或未启用 `ENABLE_REAL_AI=true` 时 mock 回落；后台 API 线路新增已能保留 displayName、Base URL、接口格式等 New-API 配置字段；新增 `scripts/smoke-provider-guard.ps1`，验证 `/api/health` 中 New-API/CPA 边界、后台线路测试 mock 回落和 `/api/chat/completions` mock 回落，避免无 key 时误打外部服务；API 线路新增/编辑弹窗已补字段标签和填写说明，手动接一个 New-API 时更容易看懂；`/api/generate/tasks` 与 `/api/template/generate-image` 已接入 OpenAI-compatible `/images/generations`，上游远程图片通过 `/api/proxy-image` 转同源地址；真实文本 ping 已通过，正确 Base URL 为 `https://www.packyapi.com/v1`；换成生图可用 key 后，真实 `gpt-image-2` 生图已通过。 | 浏览器画布节点和模板页真实生成仍需人工点测；Docker 容器还未重建到本轮代码。 |
| CPA | 待实现 | 20% | 只作为 New-API 后置渠道写入架构边界，本项目不直接管理。 | 等 New-API 部署后配置渠道。 |
| 源码化新栈 | 待复核 | 100% | 已在 `F:\dianshang` 固定源码化分支目录；`AGENTS.md` 和 `README.md` 已写入阶段门禁、禁止搓轮子、环境确认、CodeGraph 索引和维护测试规则；新画布方向已按用户要求全部废止，`frontend/` 不再承载 Vue Flow 画布，已删除新画布组件、Store、类型、运行适配器和 Infinite-Canvas 模板，并卸载 `@vue-flow/*` 依赖；`/canvas` 已改为源码旧画布入口壳，运行时继续内嵌/链接旧后端画布；源码前端 Playwright 点击 smoke 已覆盖注册清理、未登录边界、登录、首页迁移索引导航、旧画布源码入口、用户中心快捷导航、图库、模板、生成记录、兑换页、移动端、退出登录、源码后台登录、只读 Dashboard、只读用户管理、只读回收站、只读任务监控、只读消费日志、只读订单管理、只读兑换码管理、只读模型价格、只读 API 线路、只读模板工作流和只读系统设置；本轮把剩余 `/canvas`、`/admin/recycle-bin`、`/admin/settings` 一起源码化，首页统计更新为 21/0/21，并用 Playwright 和自带浏览器验收。 | 进入人工总体验收；写入类后台动作、真实生成、真实兑换、图库删除和旧画布深度操作仍需单独确认测试数据后再测。 |
| 测试护栏 | 进行中 | 100% | 已有前端路由 smoke、API smoke、后台 UI smoke；新增 `scripts/smoke-canvas-performance-ui.ps1`，覆盖旧画布性能资源加载、拖拽/滚轮交互态 class 启停、交互态 will-change、动态图片 lazy/async 探针，并已接入 `SMOKE_UI=true`；新增 `scripts/smoke-canvas-frame-budget-ui.ps1`，临时注入 8 个 Vue Flow 卡片和图片探针，采样拖拽/连续缩放期间 rAF 帧间隔，默认画布已验证拖拽和缩放 P95 均约 16.8ms、长帧为 0；新增 `scripts/verify-canvas-performance-assets.js`，防止性能资源版本、保存延迟锚点、节流值、缩放闪烁 CSS 和帧预算 smoke 接入回退；前端路由 smoke 已补 `/admin/recycle-bin`；`scripts/smoke-home-canvas-ui.ps1` 覆盖首页入口、历史画布惯性 ready、画布 Vue Flow 渲染和 console/bad response 零错误，并接入 `SMOKE_UI=true` 的预检和 Docker 部署验证；本轮加固 `scripts/smoke-mobile-ui.ps1`，支持 `SMOKE_BASE_URL` 和自动 open session，覆盖 390x844 首页、模板、画布、用户兑换码、后台 Dashboard、API 线路、模板工作流，并检查横向溢出、标题拆字、画布节点、console/bad response；后台 10 页截图 runner 已升级为视觉审计护栏，会检查标题、旧按钮色、表格行高和 sticky 操作列；新增 `scripts/smoke-admin-save-echo-ui.ps1`，覆盖后台系统设置、API 线路、模型价格、模板工作流保存后刷新回显，并接入 `SMOKE_UI=true` 预检和 Docker 部署验证；`scripts/smoke-source-frontend-ui.ps1` 已覆盖 Vue3 源码前端注册临时账号并清理、未登录态边界、登录、首页迁移索引跳转、旧画布源码入口、用户中心快捷导航、图库搜索/刷新、模板切换/填写、生成记录搜索/刷新、兑换页填写但不提交、移动端 records/redeem 溢出检查、退出登录、源码后台登录、后台 Dashboard、后台用户管理只读搜索、后台回收站只读搜索、后台任务监控只读搜索、后台消费日志只读搜索、后台订单管理只读搜索、后台兑换码管理只读搜索、后台模型价格只读搜索、后台 API 线路只读搜索、后台模板工作流只读搜索和后台系统设置只读搜索，并已接入 `preflight-check.ps1` 的 `SMOKE_UI=true` 分支；本轮将源码前端 smoke 的页面等待从 `networkidle` 改为 DOM 就绪加短暂稳定等待，避免本地开发服务长请求导致卡死；新增 `scripts/smoke-provider-guard.ps1`，默认验证 New-API/CPA 边界和无 key mock 回落；`smoke-api.ps1` 已补未登录 `/api/generation/estimate-cost` 和 `/api/user/api-status` mock 回落；`preflight-check.ps1` 默认改用 disposable API smoke，避免污染人工测试库；`SMOKE_UI=true` 可选开关已覆盖源码前端点击、首页/画布、画布性能、画布帧预算、移动端 7 页、后台 10 页截图、后台保存回显、模板上传/反推/生成、图库多图/空状态、画布 JSON 导入和用户中心桌面/移动布局；新增 `SMOKE_PERSISTENCE=true` 可选开关，一条命令验证后台 settings、API 线路、模型价格和模板工作流重启后不丢；父脚本已检查 native/子脚本退出码，避免子脚本失败仍显示通过。 | 后续把服务器/Nginx/HTTPS 实机验证接入部署验收；如 UI smoke 总耗时过长，再拆分源码前端与旧前端两个开关。 |
| 源码前端工程化 | 待复核 | 100% | 已新增 `scripts/check-source-frontend-routes.js`、`npm run check:routes`、`npm run verify:source` 和 `docs/source-frontend-acceptance-checklist.md`；首页阶段状态已更新为源码入口完成、旧画布锁定、后台只读完成；已删除未使用的旧桥接组件，当前迁移索引和 Vue Router 均为 21 个源码入口。 | 按验收清单做人工总体验收；写入、删除、真实生成和真实兑换仍需单独确认测试数据。 |
| 文档审查 | 进行中 | 99% | 已建立进度报告、功能清单、review log、轻量平台 ADR、每轮推进复核清单；已新增 2026-06-25 前后端与后台视觉人工可测计划，并归档后台与前端截图；本轮追加后台截图复跑、表格视觉修复和内置浏览器抽查记录。 | 每轮推进持续追加，并按 `docs/iteration-review-checklist.md` 收尾。 |

## 2026-07-13 Chat 内置 MCP 清单追加

- 文本桥接已补消息内工具循环状态：`chat_text_charges` 继续保证整条用户消息只扣一次，`chat_text_steps` 对每次 Provider 步骤做指纹幂等；工具调用后可继续提交工具结果，完全相同的步骤重放仍被拦截。
- 假 Provider 回归在修复前稳定复现 `409 CHAT_REQUEST_COMPLETED`，修复后验证工具调用、工具续传、最终回复、单次 5 点扣费和重复续传 409；该回归已接入完整 Chat smoke。
- `hajimi-website` 已从用户可选服务器改为后端默认注入的内置能力，普通用户不再看到聊天勾选、侧栏 MCP 设置或智能体 MCP 添加入口。
- MCP 工具仍只包含主站控制的 `prepare_image_generation` 和 `execute_image_generation`，报价、下一轮确认码、余额、幂等和生成历史边界不变。
- 内置注入保留原 `req.body`，避免 LibreChat 上层中间件丢失 `endpointOption`；回归 smoke 会拒绝再次替换请求对象。
- MCP 私网白名单只允许 `app:3456`；用户级 SSO 会话重连返回非 OAuth 状态，并实际列出两个生图工具。
- 固定 LibreChat 源码补丁重放、完整前端构建、3464 容器健康、无费用集成 smoke 和页面 403 隔离探针均通过。
- LibreChat 的 `/app/client/public/images` 已增加独立持久卷；当前第二张上传图迁移后通过一次强制容器重建和 SHA-256 校验，附件不再因滚动更新丢失。
- 当前消息附件会由 LibreChat 服务端自动传入 MCP 上下文：有附件走 `/images/edits` multipart 图生图，无附件走 `/images/generations` JSON 文生图，模型无需手动填写图片 URL。
- 无费用端到端回归已覆盖两种生图模式、报价、确认、扣费、历史和幂等；真实图片输出需用户用一条新消息人工验证，正式 3456 尚未部署。
- 真实重试已证明上游能返回 PNG，但旧文本桥接把 `image_generation_call.result` Base64 当文字展示并绕过图片报价；现已强制生图意图走网站工具，确认消息走执行工具，原生图片输出兜底退款且不进入聊天。
- 图片 API 返回 `b64_json`、裸 Base64 或 HTTP(S) URL 时都会先写入 `/uploads/generated/` 持久目录，MCP、图片工具与历史只返回本地短 URL；Base64 与 URL 两类假 Provider 回归均验证字节一致。当前测试账号余额为 90，需用新消息继续人工验证，不能沿用旧回复重试。

## 2026-06-29 image5 清单追加

- 画布图片节点当前以 `20260629image5` 为准，覆盖上表中 `image4` 的“右侧工具栏挂在图片 box 右边缘”描述。
- 当前图片节点规则：顶部常驻标题/尺寸信息，选中或 hover 时显示顶部黑色横向工具条；旧右侧大工具栏和折叠把手隐藏；空图上传态工具条隐藏且不可交互。
- 新增 `assets/canvas-image-node-polish.js`，按图片自然宽高标记 `square/landscape/portrait/long`，并将图像生成结果、文生图、对话生成图片等结果图标记为 `generated`，仅用于视觉样式，不参与保存。
- 指定项目 smoke 已验证：方图、横图、普通竖图、超长图、生成结果图 5 类探针完整等比显示，顶部工具条在图片上方且不遮挡，长图不再受 `520px` 高度限制。
- 画布完成度临时上调到 96%；剩余为人工刷新真实节点、选中普通图片和生成结果节点做观感验收，以及真实生图链路在确认额度后继续测试。

## 2026-06-29 image6 清单追加

- 画布图片节点当前以 `20260629image6` 为准，覆盖上面的 `image5` 版本号。
- 修正范围：真实 `ImageNodeToolbar` 是图片卡片的兄弟节点，不是 `.image-node` 内部子节点；已改为 JS 给 Vue Flow 图片节点本身打标，CSS 用节点级选择器强制顶部横向工具条。
- 自动化已补真实 sibling 工具栏探针，验证不再回退到右侧竖栏：`flex-direction=row`，宽度大于高度，工具条在图片上方且不遮挡。

## 2026-06-29 outpaint1 清单追加

- 扩图面板当前以 `20260629outpaint1` 为准；入口 app bundle 和两个 Canvas 动态 import 已升级，避免继续加载旧扩图逻辑。
- 修正范围：`AI 扩图` 面板默认打开和切换目标比例后，等待面板尺寸稳定再重新计算图片在目标画布中的居中位置。
- 保留原有目标画布边界限制：拖动图片时仍限制在黄色/绿色画布范围内，避免扩图提交坐标越界。
- 已完成静态和浏览器 smoke：`verify-canvas-performance-assets.js` 返回 `20260629perf5+outpaint1`，指定项目画布 smoke 通过，新增入口和 Canvas chunk 资源均为 200。

## 2026-06-30 Canvas Chat prompt6 清单追加

- Canvas Chat 对话业务线新增旧画布桥接层 `assets/canvas-chat-prompt-flow.js/css?v=20260630prompt6`，只接管 `对话` 标签，不影响 `快速` 和 `视频`；提示说明已弱化为黑色居中无底框小字，并只在 `对话` 标签显示。
- 新流程：按可见顺序收集参考图，用户填写需求后调用 `/api/canvas/generate-prompt` 生成可编辑提示词草稿；不再提供 `确认生图`，真实生图由用户切到 `快速` 标签手动完成。
- 后端提示词接口在文本线路不可用或 mock 模式下返回基础草稿，避免继续把 `gpt-5.5` Provider 错误展示成“生成结果”。
- 当前剩余：用户强刷后人工确认 `对话` 标签只出现提示词草稿和复制操作；真实生图链路继续在 `快速` 标签按费用边界人工点测。
- 当前画布完成度维持 `待复核`：需要用户强刷后人工打开真实图片节点扩图面板，确认默认居中和比例切换居中。

## 2026-06-29 outpaint2 清单追加

- 扩图面板当前以 `20260629outpaint2` 为准，覆盖上面的 `outpaint1` 入口版本。
- 修正范围：`原图等比缩放` 滑条现在读取当前 input 事件值，并以当前图片中心为缩放锚点，避免缩放时丢失已调整的位置。
- 目标画布边界限制继续保留：靠近边缘缩放时会被限制回合法范围，普通区域不应跳回默认中心。
- 已完成静态和浏览器 smoke：`verify-canvas-performance-assets.js` 返回 `20260629perf5+outpaint2`，指定项目画布 smoke 通过，新增入口和 Canvas chunk 资源均为 200。
- 当前需要人工复核：拖动图片到非默认位置后连续缩放，确认位置保持；切换比例后仍默认居中。

## 2026-06-29 outpaint3 清单追加

- 扩图面板当前以 `20260629outpaint3` 为准，覆盖上面的 `outpaint2` 入口版本。
- 修正范围：扩图目标舞台不再被旧 CSS `max-height:230px` 压扁；`1:1` 应显示为真实方形，横竖比例按按钮切换完整呈现。
- 缩放含义调整为更符合直觉：100% 表示原图按比例完整贴合当前目标画布，初始 62% 则是在这个最大 fit 尺寸上的缩小。
- 已完成静态和浏览器 smoke：`verify-canvas-performance-assets.js` 返回 `20260629perf5+outpaint3`，指定项目画布 smoke 通过，新增入口和 Canvas chunk 资源均为 200。
- 当前需要人工复核：`1:1` 拉满铺满方形目标，`16:9/9:16` 不再变形，拖动和缩放仍受目标画布合法范围限制。

## 2026-06-29 outpaint4 清单追加

- 扩图面板当前以 `20260629outpaint4` 为准，覆盖上面的 `outpaint3` 入口版本。
- 修正范围：扩图内容支持在绿色目标画布中自由拖动取景；图片小于画布时保持整图在画布内，图片大于画布时允许平移但不露空。
- 缩放范围扩大为 `20-220`，并保持严格等比例缩放；`100%` 为完整贴合目标画布，超过 `100%` 为放大取景。
- 已完成静态和浏览器 smoke：`verify-canvas-performance-assets.js` 返回 `20260629perf5+outpaint4`，指定项目画布 smoke 通过，新增入口和 Canvas chunk 资源均为 200。
- 当前需要人工复核：超过 `100%` 后拖动图片，确认可以选择保留区域，且提交前预览不露空。

## 2026-06-29 outpaint6 清单追加

- 扩图面板当前以 `20260629outpaint6` 为准，覆盖上面的 `outpaint4/outpaint5` 入口版本。
- 需求纠偏：扩图允许绿色区域露出作为待生成区域，不采用裁剪器“不露空”限制。
- 修正范围：图片在绿色目标画布中自由摆放，拖到右侧、右下角、左上角都不应提前卡死；只保留防止整张图完全拖离画布后找不到的宽松边界。
- 舞台空白区域也能拖动图片层；缩放范围为 `20-300`，保持等比例缩放。
- 已完成静态和浏览器 smoke：`verify-canvas-performance-assets.js` 返回 `20260629perf5+outpaint6`，指定项目画布 smoke 通过，新增入口和 Canvas chunk 资源均为 200。
- 当前需要人工复核：按住绿色空白拖动、图片本体拖动、放大后拖动都能自由定位。

## 2026-06-29 image-tools 图生图接线清单追加

- `局部修改`/重绘已接入 `/api/image-tools/inpaint`，后端复用 GPT Image 2 的 OpenAI-compatible `/images/edits` 图生图编辑链路。
- `AI 智能消除` 已接入 `/api/image-tools/erase`，同样走原图 + mask + prompt 的编辑链路。
- `maskBase64` 已映射为 Provider multipart `mask` 文件；单张原图加 mask 不再误退回纯文生图。
- 旧画布参考图上传入口 `/api/upload/image` 已补齐，避免面板上传参考图 404。
- 本轮已完成语法和路由存在性验证，未触发真实生图；真实结果节点创建仍需用户确认额度后人工点测。

## 2026-06-29 tools1 顶部图片工具接线清单追加

- 入口 app bundle 和两个 Canvas 动态 import 当前以 `20260629tools1` 为准，覆盖上面的 `outpaint6` 入口版本。
- 已接上：`AI 扩图`、`格式/压缩`、`反推提示词`、`AI 智能消除`、`局部修改`、`文字编辑`、`图片尺寸调整`、`图片裁剪`、`添加到聊天`、`生成视频`。
- 暂不接：`AI 超清放大`、`一键抠图`，并在 `/api/image-tools/settings` 中标记为未启用。
- `AI 扩图` 走 `/api/image-tools/outpaint`，复用 GPT Image 2 图生图编辑并返回任务结果；`反推提示词` 走 `/api/image-tools/reverse-prompt`；`文字编辑` 走同一套 mask 重绘面板和 `/api/image-tools/inpaint`，但保留 `text_edit` 类型。
- 已完成静态、资源和页面 smoke：`verify-canvas-performance-assets.js` 返回 `20260629perf5+tools1`，指定项目画布 smoke 通过并确认顶部工具条不遮挡、比例探针正常、console errors 为 0。
- 当前仍需人工点测：登录后逐个打开顶部工具面板；真实提交会调用外部模型并可能消耗额度，需用户确认测试范围。

## 2026-06-29 API 线路源码页旧后台导航清单追加

- `/admin/api-providers` 直达生产入口已切到源码后台 `frontend/dist/index.html`。
- 旧后台菜单进入 `API 线路管理` 已增加桥接，避免客户端路由继续显示旧 `AdminShell` 表格。
- 已完成浏览器复核：从 `/admin/dashboard` 点击 `API 线路管理` 后加载源码页，可见官方双线路卡片、文生图 `/images/generations`、图生图 `/images/edits` 和文本 `/responses`。
- 当前需要人工复核：在你的当前浏览器刷新一次，从旧后台菜单重新进入，确认不再回到旧版线路表。

## 2026-06-29 后台源码侧栏与路由统一清单追加

- 源码后台 11 个已迁移管理页已统一使用 `AdminSourceSidebar.vue`，菜单数量和顺序不再按页面漂移。
- 生产服务端已将 `/admin/login`、Dashboard、用户、回收站、任务、日志、订单、兑换码、模型、API 线路、模板工作流、系统设置统一交给源码前端入口。
- 旧入口桥接脚本已扩展到全部后台源码页，旧后台菜单点击会进入源码后台，不只针对 API 线路。
- 已完成构建和浏览器抽查：API 线路、订单、系统设置、模板工作流均显示同一套 11 个菜单并高亮当前页面。

## 2026-06-30 日志扫描与路线图对齐清单追加

- 已扫描最近日志、进度报告、复核日志和 2026-06-30 可维护性审计，确认下一步先处理文档状态滞后，而不是继续扩大代码改动面。
- `docs/frontend-migration-roadmap.md`、`docs/source-frontend-acceptance-checklist.md`、`README.md` 和 `frontend/src/config/frontendMigration.ts` 已同步当前事实：首页为旧站工作台、`/canvas` 直跳旧画布运行时、后台 11 页共用侧栏、API 线路和系统设置为写入试点。
- 源码前端 UI smoke 已加固任务监控搜索，不再依赖固定 `simple` 测试词；移动端后台用户页 65px 横向溢出已修复，复跑确认后台移动端页面横向溢出为 0。
- 当前仍需人工总体验收：后台 11 页侧栏一致性、API 线路/系统设置写入试点保存回显、真实生图与图生图工具链路需在确认额度后再测。

## 2026-06-30 后端与旧画布边界护栏清单追加

- 新增 `scripts/smoke-backend-canvas-boundary.ps1`，用临时数据库启动后端，验证旧画布入口和关键资产、image-tools 路由、上传入口和 canvas storage 边界。
- 新 smoke 已接入 `scripts/preflight-check.ps1` 默认链路，后续改后端或旧画布入口时会自动检查不返回 404、不误开启未接工具、不触发真实 Provider。
- `docs/canvas-migration-checklist.md` 和 README 已同步当前入口与维护命令。

## 2026-06-30 Canvas Chat 兜底文案清单追加

- 对话模式只出提示词的业务线保持不变：不提供确认生图，不调用 `/api/generate/tasks`，真实生图由用户切到 `快速` 模式手动完成。
- 文本模型不可用、mock 兜底或提示词接口异常时，统一展示：“文本模型暂不可用，已生成基础提示词，可编辑后复制到快速模式。”
- 兜底时仍生成本地基础提示词草稿，并保持可编辑、可复制。

## 2026-06-30 Canvas Chat dialogagent1 清单追加

- 最新边界覆盖前面的 prompt-only 临时方案：Agent 生图链路现在归属 `对话` 模式，`快速` 模式继续保持原快速生图逻辑。
- 后端新增 `/api/canvas/dialog-agent-generate`：GPT 5.5 分析参考图和需求，输出 `analysisSummary/finalPrompt`，再调用 GPT Image 2 生图；任一阶段失败都不继续、不扣费。
- 对话前端桥接升级为 `assets/canvas-chat-prompt-flow.js/css?v=20260630dialogagent1`，卡片显示分析状态、生成状态和最终结果，完整 prompt 仅存入任务和图片节点 meta。
- 旧 Canvas bundle 动态 import 升级为 `20260630dialogagent1`，并监听 `canvas:add-generated-image-to-canvas`，对话 Agent 成功图会自动落到画布。
- boundary smoke 覆盖新入口未登录 `401` 和 mock 成功响应，快速/视频仍需人工确认不会串用对话 Agent 状态。
- 已完成语法检查、资产校验、backend/canvas boundary smoke、disposable API smoke、diff/BOM 检查；真实 Provider 点测需用户确认额度后再做。

## 2026-06-30 Canvas Chat dialogagent2 清单追加

- 对话模式底部新增 `张数`、`清晰度`、`比例` 三个参数控件，默认 `1张 / 1K / 1:1`。
- 对话 Agent 提交会带上 `imageCount/count/n`、`quality/clarity`、`ratio/aspectRatio`，不再固定只生成 1 张 1:1。
- 用户消息卡片显示本次参数摘要，便于回看历史生成设置。
- 入口 `canvas-chat-prompt-flow.js/css` 版本升级为 `20260630dialogagent2`；快速和视频模式保持原逻辑。

## 2026-06-30 Canvas Chat dialogagent5 清单追加

- 对话/视频参数控件已从原生下拉改回旧画布设计语言：紧凑圆角按钮、深色张数/清晰度菜单、浅色比例卡片菜单。
- 快速模式继续使用旧 Canvas Chat 自带控件；桥接层只负责布局归组，不替换快速菜单逻辑。
- 入口 `canvas-chat-prompt-flow.js/css` 版本升级为 `20260630dialogagent5`，边界 smoke 已同步检查该版本。
- 当前仍需人工复核：刷新当前画布，分别打开三种模式下的参数菜单，确认和用户截图中的旧控件语言一致。

## 2026-06-30 Canvas Chat dialogagent6 清单追加

- `dialogagent5` 的桥接层控件方案已废弃；当前以 `dialogagent6` 为准。
- 旧 Canvas Chat 原生参数控件已在 `对话 / 快速 / 视频` 三种模式中渲染，不再通过桥接层新建一套按钮或菜单。
- 快速模式控件不再被移动进 `hjm-native-param-settings` wrapper，布局只靠网格位置固定，避免 `1张` 与 `1K` 重叠。
- 当前仍需人工复核：刷新当前项目页后确认三种模式底部参数按钮排布一致，快速模式不重叠。

## 2026-06-30 Canvas Chat dialogagent7 清单追加

- 快速模式底部设置区改为三个完整参数列，`1张 / 1K / 1:1` 不再使用上传按钮的 44px 窄列。
- 对话模式继续复用旧 Canvas Chat 原生设置控件，不新增第二套 UI。
- 入口 `canvas-chat-prompt-flow.js/css` 版本升级为 `20260630dialogagent7`，用于强制刷新最新对齐样式。

## 2026-06-30 Canvas Chat dialogagent8 清单追加

- 对话和快速模式底部 `1张 / 1K / 1:1` 三个参数按钮统一为同一套原生 `.compact-control` 按钮样式。
- 参数按钮组改为 flex wrap + 固定 gap，避免硬网格在窄面板或缩放下再次重叠。
- 入口 `canvas-chat-prompt-flow.js/css` 版本升级为 `20260630dialogagent8`，用于刷新一致性修复。

## 2026-06-30 Packy GPT Image 2 技术档案清单追加

- 新增本地技术档案 `docs/provider-packy-gpt-image-2.md`，后续 GPT Image 2 接口参数以该文件和 Packy 官方链接为优先参考。
- `1K / 2K / 4K` 明确为图片大小档位；比例自动换算为 Packy 合法 `size`。
- Packy `quality` 与图片大小解耦，默认使用 `auto`，避免把 `1K` 误发成低质量。
- 旧画布比例菜单 13 个比例已全部纳入 `scripts/check-packy-gpt-image-size.js`，并接入后端画布边界 smoke。

## 2026-06-30 Packy GPT Image 2 全入口覆盖清单追加

- 所有 GPT Image 2 文生图入口统一走 `callProviderImageGeneration`，所有图生图 / 图片编辑入口统一走 `callProviderImageEdit`。
- 对话 Agent、快速生图、模板生图、图片工具和后台 Provider 测试已纳入统一适配器覆盖。
- 图生图 / 编辑默认发送 `input_fidelity=high`，同时继承统一尺寸、质量、输出格式、`response_format=url` 和上游 `n=1` 准则。
- 新增 `scripts/check-packy-gpt-image-adapter-coverage.js` 并接入 backend/canvas boundary smoke，防止当前已知入口绕过统一适配器。

## 2026-06-30 Canvas Chat GPT 5.5 文本抽取清单追加

- 对话 Agent 分析阶段的文本抽取已支持更多 Provider 响应包裹：`data.choices`、`response.output`、`text.value`、`reasoning_content`、顶层 `final_prompt/finalPrompt`。
- 新增 `scripts/check-provider-text-extraction.js`，用真实 `server.js` 函数验证 GPT 5.5 有文本时不会被误判为空。
- 该检查已接入 `scripts/smoke-backend-canvas-boundary.ps1`，后续后端/旧画布边界验证会自动覆盖。

## 2026-06-30 Canvas Chat 分析诊断清单追加

- `/api/canvas/dialog-agent-generate` 支持管理员诊断参数 `debugAnalysisOnly:true`，仅跑 GPT 5.5 分析，不进入 GPT Image 2 生图。
- 诊断返回 `parseOk`、`finalPrompt`、`extractedTextLength`、`extractedTextPreview` 和脱敏后的 `responseShape`，用于定位真实上游返回结构。
- backend/canvas boundary smoke 已覆盖 mock 下的 analysis-only 响应，确认不影响正常对话 Agent mock 成功路径。

## 2026-06-30 Canvas Chat New API 文本端点清单追加

- New API 文本线路下 `callProviderResponses` 改用 `/chat/completions` 获取 GPT 5.5 提示词，避免 `/responses` 扣费但 `output=[]`。
- Responses 风格输入会自动转换为 Chat Completions `messages`，支持 `input_text` 和 `input_image`。
- JSON 解析已支持从重复 JSON 输出中提取第一个完整对象，保证 `analysisSummary/finalPrompt` 干净可用。
- 入口版本升级为 `assets/canvas-chat-prompt-flow.js/css?v=20260630dialogagent9`。

## 2026-06-30 旧画布维护边界清单追加

- 新增 `docs/canvas-maintenance-boundary.md`，明确旧画布唯一入口、可改/慎改/禁改范围、对话/快速/视频三条链路、GPT Image 2 统一适配器和每次修改后的检查命令。
- 新增 `docs/canvas-maintenance-log.md`，记录 `dialogagent9` 当前资产版本、New API 文本端点修复、参数控件修正、Packy GPT Image 2 准则、多参考图修正和当前临时技术债。
- `docs/canvas-migration-checklist.md` 已补充维护边界、维护日志和 Packy 技术档案链接，便于后续接手时先看边界再动代码。

## 2026-07-13 Chat 首页智能体与 Skills 清单追加

- [x] 主站后台是托管智能体唯一配置入口，支持新增、编辑、启停和删除。
- [x] 默认提供 4 个电商智能体，首页只返回已启用且模型已开放的项目。
- [x] Chat 首页显示智能体与当前用户可访问的 Skills。
- [x] 智能体选择接入系统指令、模型、Skills 和网站生图工具状态。
- [x] Skill 选择复用输入框原生待提交队列并显示选择状态。
- [x] 普通用户不显示 LibreChat 原生智能体创建入口，私有 Skills 创建保持可用。
- [x] 完成前后端构建、干净上游补丁重放、完整无费用 smoke 和 3464 浏览器验收。
- [ ] 正式 3456 发布，需用户另行确认切换统一网关。

## 2026-07-14 画布操作延迟第一轮清单追加

- [x] 复现并量化拖拽、缩放后保存和连续悬停的主线程延迟，不调用中转或模型。
- [x] 画布历史与持久化快照移除 Base64 图片字符串的 JSON stringify/parse 深拷贝。
- [x] 普通拖拽和 Alt 拖拽结束改走已有合并保存，离开画布/切项目仍保留立即保存。
- [x] 项目存储移除清洗后的冗余 JSON 二次深拷贝，工作流 JSON 格式保持不变。
- [x] 新增画布操作性能断言，更新当前资源版本、画布边界 smoke 和生产 smoke。
- [x] 完成语法、静态断言、边界 smoke、Docker 全量重建、容器健康和 3456 资源命中验证。
- [x] 确认生产页恢复原 10 节点、9 图片节点项目，重复重画布复测页已清理。
- [x] 节点拖拽和视口变化改走轻量布局补丁，普通布局操作不再立即重写浏览器本地整份工作流。
- [x] 在单页 10 节点、9 张大图、80% 缩放状态补测拖拽、平移、缩放和悬停；操作期长任务为 0，最终通过轮松手后 24.22–39.28ms 稳定，手感验收通过。
- [x] Playwright 从首次导航前拦截项目写入与生成请求，确认生产项目数据和更新时间前后不变。

## 2026-07-14 画布大图常驻内存清单追加

- [x] 以强制 GC 的 CDP 堆指标建立 9 张大图、每张 6 个别名的优化前基线。
- [x] 确认生产数据库与 workflow JSON 不含大 Base64，定位为浏览器运行态别名重复与图片解码占用。
- [x] 项目恢复时归一相同图片大字符串引用，不建立全局缓存，不改变工作流 JSON。
- [x] 新增相同图片归一、不同图片隔离、JSON 等价和恢复入口回归断言。
- [x] 强制 GC 后 JS 堆由约 200.44MiB 降至约 19.76MiB，9 张图片、DOM 与监听器数量保持不变。
- [x] 修正 Playwright 视口外假拖拽，真实拖动可见节点并复位；拖拽、平移、缩放均无长任务。
- [x] 完成语法、静态断言、边界 smoke、Docker 全量重建、生产 smoke、3456 三页面直连和资源哈希验证。
- [x] 确认生产项目未写入，未调用中转、模型或付费接口。

## 2026-07-14 画布图片解码与 GPU 内存清单追加

- [x] 本地素材索引增加 `previews.w1024`，保留 `w500/w200/w100`，不批量迁移旧素材。
- [x] 内联 Base64、`/uploads` 和代理图片生成最长边 1024px WebP 预览；GIF、SVG、小图和失败路径回退原图。
- [x] 图片节点常态使用预览，选中、编辑、下载和 `forceOriginal` 使用原图；运行时字段不进入工作流 JSON。
- [x] 复用 900 画布单位边界，离屏释放引用，返回后 500ms 内从缓存恢复。
- [x] 预览池实现 24 个闲置项上限、30 秒 TTL、最多 2 张并发转换及离开 `/canvas` 统一撤销。
- [x] 固定 10 节点、9 张 2528×1696 图片的估算解码像素内存为 24.15MiB，不超过 35MiB。
- [x] 强制 GC 后 JS 堆为 16.19MiB，不超过 30MiB。
- [x] 选中切换原图、取消恢复预览、离屏释放、缓存恢复、JSON 隔离和生成请求拦截通过。
- [x] 拖拽、平移、缩放准确复位，稳定耗时低于 250ms，操作期无超过 150ms 的长任务。
- [x] 新增预览选择、缓存复用、并发限制、TTL、Object URL 撤销和运行态隔离回归断言。
- [ ] Renderer + GPU 私有内存中位数较稳定基线下降至少 30%；实测由 776.05MiB 升至 1267.52MiB（+63.33%），当前未通过。
- [x] 私有内存门禁未通过后保留当前版本，并采集 memory-infra trace 和摘要定位剩余原图/GPU 缓存。
- [x] 完成语法、静态断言、前端构建、画布边界 smoke、Docker 完整重建、容器健康、生产 smoke、旧资源隔离、三页面直连和资源哈希验证。
- [x] 确认生产项目 `data` 与 `updated_at` 不变，未调用中转、Provider、模型或付费接口。

## 2026-07-15 Windows Docker 上线门禁清单追加

- [x] Docker 使用多阶段构建从 `frontend/package-lock.json` 自动生成 `frontend/dist`，不依赖宿主机忽略产物。
- [x] 干净 `--no-cache` 镜像构建通过，镜像内前端入口存在，真实 `.env` 未进入镜像。
- [x] Dashboard 今日数据改为真实日期聚合，无法追溯的线路统计不再平均伪造。
- [x] 支付关闭时订单页明确不可用且为空，不再从用户数据生成演示订单，写接口返回 409。
- [x] 任务历史不再填充固定线路、尺寸、质量、参考图和 mock 队列模式。
- [x] 管理员重置密码响应移除明文密码；普通找回密码、注册和兑换码保持原契约。
- [x] Chat 未部署时首页侧栏隐藏入口，公开状态接口与 `/chat/` 503 边界一致。
- [x] 新增带文件 SHA-256 清单的源码发布包，并验证不含密钥、数据库、图片数据、日志、备份和依赖目录。
- [x] 语法、前端构建、上线门禁、安全专项、API、画布、生图持久化、源码包和 Windows 恢复演练通过。
- [x] 正式 3456 完整重建、容器 healthy、只读 smoke、主要路由和浏览器后台真实性提示通过。
- [ ] 经维护窗口确认后重新生成格式 v2 的最终生产迁移备份。
- [x] 正式启用 Chat/MCP 前，已按用户确认把 `@modelcontextprotocol/sdk` 精确升级到 `1.29.0`；官方审计 0 漏洞，工具续接、图片工具、SSO、MCP 和完整无费用集成验证通过。

## 2026-07-16 Chat 正式内网版清单追加

- [x] LibreChat 固定为 `v0.8.6-rc1`，源码归档和 SHA-256 随项目保存，Docker 构建不再依赖本机外部缓存路径。
- [x] 正式栈固定为 gateway、app、LibreChat、MongoDB 四容器；只有 gateway 暴露宿主机 `3456`，四容器均为 `healthy`。
- [x] LibreChat 自身登录、注册、社交登录和密码重置关闭；主站用户通过 60 秒一次性票据自动登录。
- [x] 生产 API 无写设置 smoke 通过：SSO 单次消费、LibreChat 会话、模型桥接、用户级 MCP 重连与两个生图工具均正常。
- [x] 隔离浏览器真实入口通过：自动到 `/chat/c/new`，4 个托管智能体、技能按钮与 Skills 区域可见，无独立登录/注册页、无 5xx。
- [x] 验收没有发送文本或生图消息，没有调用 Provider、没有新增扣费；注册和兑换码实现未修改。
- [x] 明天服务器迁移使用全新 Chat 命名卷；今天的 Chat 验收映射和记录不迁移，主站 SQLite、工作流和图片仍按现有迁移包恢复。

## 2026-07-15 后台核心操作补齐

- [x] 用户管理补齐状态、余额、密码、实际安全检查和软删除，当前管理员禁止自停用/自删除。
- [x] 回收站补齐恢复和永久匿名化，非 `deleted` 用户拒绝永久操作。
- [x] 任务监控补齐运行时取消和 SQLite 历史删除；迟到上游结果不再入库，并明确上游费用无法由本地取消保证撤回。
- [x] 模型价格补齐新增、编辑、启停、删除；内置模型删除使用持久 tombstone，刷新不复现。
- [x] disposable 写回归、标准 API smoke 和命名隔离浏览器真实按钮流程通过；测试服务强制关闭真实 AI。
- [x] 正式 3456 完整重建，四个新后台 chunk 和只读 API 命中；注册、兑换码、支付边界及生产业务数据未修改。

## 2026-07-15 生图比例字段契约清单追加

- [x] 当前画布快速生图只发送 `ratio: "1:1"` 语义，不再把比例写成 `size: "1x1"`。
- [x] 后端兼容旧 `1x1/1X1/1×1`，冲突时 `ratio` 优先；Provider 请求只使用换算后的像素 `size`，例如 `1024x1024`。
- [x] 尺寸映射、适配器覆盖、画布静态资源、Vue build、一次性 API smoke 和画布边界 smoke 通过，未调用真实 Provider。
- [x] Provider 返回图片在保存、写历史和扣系统算力前校验真实宽高，允许 3% 比例误差；错误比例回归已验证任务失败且系统余额、历史不变，上游已完成的请求仍可能产生费用。
- [x] 正式 Docker 已完整重建并直接验证 3456 命中 `20260715ratio1`，容器为 `healthy`，生产只读 smoke 通过；真实官转生图留给用户人工测试。

## 2026-07-15 图生图上行比例提示补强

- [x] 官方文档与假 Provider 抓包确认 `/v1/images/edits` 使用 `size=1024x1024`，没有改回 `1:1` 或 `1x1` 作为官方 `size`。
- [x] 图片生成节点上行 Prompt 追加目标比例/尺寸和不得继承参考图比例约束；不做本地裁切、不发第二次 Provider 请求。
- [x] 假 Provider 集成、API/画布 smoke、生产只读 smoke 和容器源码断言通过；正式镜像为 `sha256:05a1b447005dd403ef0a204fc54445628305f8318448c172da795ee87b4938df`，容器 `healthy`。
- [x] 13 个固定比例 × `1K/2K/4K` 的 39 组菜单组合全部动态写入对应比例/像素尺寸；15 组旧 `x` 格式兼容同时通过，总计 54 组。
- [x] `自动` 使用 `size=auto` 和自然构图 Prompt，不再输出字面量“严格为 auto”。最新正式镜像 `sha256:248b679d9f36e74bb9b32bc8364ac59854dfc78e130afaa76e7144307be63249` 为 `healthy`。

## 2026-07-15 lingsuan 流式 Base64 返图

- [x] 图片响应方式改为线路级配置；lingsuan 独立保存 `stream=true`、`partial_images=0`、`response_format=b64_json`，Packy 独立保存 `stream=false`、`response_format=url`，不再按域名判断。
- [x] 后台线路编辑器显示当前线路请求预览并可保存返回格式、流式开关、预览数量；保存 lingsuan 不会改动 Packy、API Key 或其他接口字段。
- [x] 统一解析 JSON 与 SSE 最终事件，兼容 `b64_json/result/data/images/results/output`，忽略 partial 预览。
- [x] 上游 Base64 只保存脱敏长度摘要，最终图片写入服务器 `/uploads/generated/`，浏览器与数据库不接收原始 Base64。
- [x] HTTP 200 空图返回明确上游计费风险，本地不扣算力、不写历史、不自动重试。
- [x] 假 Provider 回归覆盖流式 Base64、partial 丢弃、URL 回退、空结果、比例错误；54 组比例映射、适配器、后端边界和 disposable API smoke 通过，未调用真实 Provider。
- [x] 线路级配置版本已完整重建为 `sha256:f2300589cb0ff65753603c3be7b0cd88ed13820775b164861bd46e00703a8cc2` 并为 `healthy`；生产 lingsuan 三字段保存回读、Packy 隔离、容器专项回归、只读 smoke、六个 3456 路径和线上后台新 chunk 均通过。
- [x] 用户确认的一次真实省略 `size` 诊断已完成：`ratio=1:1 + quality=high` 仍返回 `1254×1254`，证明 lingsuan 不会自动推导 2K/4K；请求只发一次、未重试、未扣本地算力。
- [x] 用户确认的一次纯 OpenAI 官方 4K 对照已完成：`/v1/images/edits + image[] + size=2880x2880 + quality=high` 普通 JSON 返回真实 `2880×2880` PNG；流式扩展字段全部省略，只发一次、未重试、未扣本地算力。
- [x] 主工作区已新增 `apiFormat=lingsuan-images` 独立适配规则：固定官方接口、普通 JSON/Base64、`image[]` 和严格出站字段白名单；后台新增格式选项并锁定冲突字段，新增/编辑/批量保存均会规范化。
- [x] 无费用假 Provider 抓包确认 4K 方图发送 `2880x2880 + high`，JSON/multipart 不含流式和中转扩展字段；Packy URL 非流式隔离、54 组尺寸、后端/前端/API/UI 回归全部通过。
- [x] 正式 app 已完整重建为 `sha256:840f25b0f1235ad595e489474f9c4477e3608ffa29eb5a033bb762f41e2986fe` 并为 `healthy`；生产 lingsuan 线路已保存回读，Packy 与线路 Key 等字段保持不变，3456 公开元数据、新后台 chunk 和旧 chunk 404 验证通过。
- [x] Lingsuan 请求头已改为由后台 `apiFormat/requestFormat=lingsuan-images` 动态选择 `Accept: application/json`；不依赖域名、线路名或固定 ID，文生图和图生图均覆盖，其他线路保持隔离。
- [x] Lingsuan/Packy 假 Provider 抓包、语法、适配器覆盖和 disposable API smoke 通过，未调用真实 Provider。
- [x] 本次请求头修复已完整重建正式 Docker；镜像 `sha256:1369cb86df070ff9fd965f3fe4bf582db4f8157ffb7774c75a09f3dc8a5ca1f2` 为 `healthy`，容器源码、后台线路配置、假 Provider 抓包、生产只读 smoke 和 3456 路径已验证。
- [x] 正式画布真实 4K 图生图复测已完成：请求为 `/v1/images/edits + image[] + 2880x2880 + high`，服务器原始 PNG 为真实 `2880×2880`、7330656 字节，生成历史和 10 点本地扣费正常。
- [x] Packy 新 `image` 分组已增加后台可选 `Packy Images` 严格白名单：文生图六字段、图生图单数 `image` 七字段，省略 `response_format` 等扩展字段；URL/Base64 自动解析，Lingsuan/通用线路保持隔离。
- [x] Packy/Lingsuan 假 Provider 抓包、语法、适配器覆盖、disposable API、Vue build 和隔离后台 UI smoke 通过；正式镜像 `sha256:c42419ac54287b52a015aa728c6fc75b12b0c6d39515311cffcd26ebf5313e16` 为 `healthy`，生产 Packy 已切为 `packy-images`，3456 新旧资源隔离通过。
- [x] 用户在正式画布完成 Packy 1K 图生图真实复测：51.2 秒成功，生成历史和 10 点本地扣费正常，证明 `packy-images` 严格字段链路可用。
- [x] Packy 4K 的本地超时已按 `packy-images` 独立延长到 360 秒，文生图/图生图共同生效；Lingsuan/通用线路仍为 180 秒，普通断连不自动重试。正式镜像 `sha256:9d51431cda131e748f963faa479fa9a56d2cdb17bba1b8e21eda710b6e62ed8c` 为 `healthy`。
- [x] 用户在生产画布完成 Packy 4K 人工复测：`2880x2880 + high` 在 196.6 秒成功，落盘文件为真实 `2880×2880`、9280326 字节，生成历史和 10 点扣费正常；截图中的 socket hang up 为重建前旧失败节点残留。

## 2026-07-17 服务器迁移前最终门禁

- [x] 最终源码包与格式 v2 生产备份哈希复核通过。
- [x] 用真实备份在随机临时目录完成空目标恢复，SQLite `quick_check`/`integrity_check` 均为 `ok`。
- [x] 恢复结果包含 9 个用户、18 个项目、75 条生成记录、193 条余额流水、32 个上传文件和 22 个工作流。
- [x] 恢复演练未启动容器、未调用 Provider、未修改主工作区数据，临时目录已安全清理。
- [x] 用户确认后重新启动本机 Docker Engine，正式四容器全部 `healthy`，只读生产 smoke 与 Chat UI 验收通过。
- [ ] 如需迁移到另一台服务器，提供远程服务器连接、服务器 IP 与目标安装目录后，执行目标机四容器部署和服务器 URL 验收。

## 2026-07-20 Chat 电商主图方案表单流程

- [x] 两张参考图的电商主图请求先生成方案表单，方案阶段不创建报价、不调用图片 Provider。
- [x] 表单列出主标题、副标题、卖点、角标、页脚、规格和其他文字，并提供空白“文案修改（选填）”。
- [x] 确认方案时重新生成最终提示词；非空文案修改具有最高优先级，并复用会话保存的原始产品图和参考图创建图生图报价。
- [x] 图片结果提供“修改这张”“再出一版”“完成”，纯文本修改可继续进入方案确认循环。
- [x] 后端/补丁/测试语法、Chat 假 Provider 回归、一次性 API smoke、Vue 构建、固定补丁应用和补丁后 TSX 转译通过，未产生真实费用。
- [x] 一致性备份后完整重建正式 app 与 LibreChat；修正 YAML 缩进后四容器 `healthy`，生产/集成/浏览器 smoke 与 127/192 路径验收通过，未调用真实 Provider。

## 2026-07-21 Provider 有效返图不吞图

- [x] 定位到有效返图在持久化前被比例断言抛错丢弃：请求 `576x1152`、上游实际返回 `853x1844`，此前因此只显示失败节点。
- [x] 有效 PNG/JPEG/WebP/GIF/BMP 改为先保留并返回本地 URL；比例偏差或尺寸未知只写成功结果警告，不再阻断画布显示。
- [x] 空结果、无效图片签名、无法解码和落盘失败仍保持失败，不写历史、不扣系统算力、不自动发起第二次付费请求。
- [x] 尺寸、适配器、队列、Chat 假 Provider、一次性 API 和后端/画布边界回归通过，未调用真实 Provider。
- [x] 一致性备份后完整重建正式 Docker；四容器健康，容器源码和专项回归命中新逻辑，生产只读 smoke、旧资源隔离及 3456 的首页、画布、用户中心、Chat、健康接口通过。

## 2026-07-21 Chat 图像分析 Skills 与试用引导

- [x] 将 `image-reverse-describe`、`image-deep-read`、`style-grammar-distill` 及 14 个参考文件整理为 LibreChat 原生 Skill，修正错误引用目录并通过本地校验。
- [x] 三项 Skill 均允许用户手动选择、默认不强制执行；生产 MongoDB 已核验 3 条 public viewer ACL，普通用户可见。
- [x] Chat Skills 区增加准备材料、示例指令和一键选择的试用引导，三个引导按钮只在对应 Skill 实际可访问时显示。
- [x] 同步脚本通过 LibreChat API 完成导入、更新、参考文件上传和公开共享，并对 HTTP 200/SSE 权限假成功做强制失败校验。
- [x] 管理员无效邮箱只在 Chat SSO 内部使用安全兜底地址；普通用户邮箱验证和主站账号数据保持不变。
- [x] 完整 LibreChat 构建、静态集成、生产只读和普通用户浏览器 smoke 通过；浏览器确认三个引导卡可见且可选中，未发送消息或调用 Provider。
- [x] 一致性备份与 LibreChat Mongo 归档后使用正式双 Compose 全量重建；四容器均健康，3456 五条主要路径返回 200。

## 2026-07-21 画布图片生成节点提示词可读性

- [x] 将图片生成节点默认宽度从 `410px` 提高到 `480px`，并为窄屏保留视口宽度上限。
- [x] 将提示词框默认最小高度从 `124px` 提高到 `168px`，正文改为 `15px/600/1.8`，提高文字和 placeholder 对比度。
- [x] 样式只命中 `.vue-flow` 内的图片生成节点，不改变工作流 JSON、历史项目、提示词、连线、生成或非画布页面。
- [x] 资产、操作性能、后端画布边界和 Vue 完整构建通过；生产浏览器计算样式与截图复核通过。

## 2026-07-21 画布图片生成节点免费 AI 提示词扩写

- [x] 图片生成节点提示词框右下角增加“AI 扩写”，成功后回填可编辑文本，不自动生图。
- [x] 后端按可见顺序读取最多 4 张真实 PNG/JPEG/WebP，并与当前提示词一起发送给 `gpt-5.6-terra` 多模态文本线路。
- [x] 扩写提示词补齐图片角色、主体、构图、场景、光影、材质、文字、成像质量与负面约束，同时避免把所有内容都升级成硬锁定。
- [x] 用户免费：响应 `free=true/costPoints=0`，不修改余额；同一用户只允许一个并发扩写请求。
- [x] Provider 失败、输出过短、用户中途编辑或离开画布时不覆盖原提示词；按钮不调用 `/api/generate/tasks`。
- [x] 适配层只在 `/canvas` 安装，离开画布断开 observer、取消请求并清理按钮、class 和调试对象。
- [x] 语法、静态资产、假 Provider 多模态与余额、后端/画布 boundary smoke、Vue 构建及 Playwright UI/teardown 回归通过；未调用真实 Provider。
- [x] 用户确认后完成正式 Docker 一致性备份、完整重建、四容器健康和 `192.168.0.39:3456` 生产验收；线上新资源哈希与主工作区一致。
- [x] 活动任务为 0 后完成一致性备份和正式 app 完整重建，四容器健康，生产只读、Chat 和 3456 五条路径通过。
- [x] 浏览器验收自动创建的空白示例项目已删除并回查 404；未调用 Provider、未产生费用。

## 2026-07-21 画布大参考图上传稳定性

- [x] 对比真实成功/失败任务，确认故障集中在 `3840×3840`、12–14MB 参考图的 `/v1/images/edits` multipart，而不是域名完全不可达。
- [x] 画布仅压缩 Provider 出站副本：最长边 `2048`、目标上限 `4MB`、高质量 WebP；原图、项目 JSON、历史和本地资产保持不变。
- [x] 后端在 Provider 前拒绝仍超过 `5MB` 的单图，返回 `PROVIDER_REFERENCE_IMAGE_TOO_LARGE`，不调用上游、不扣算力、不写历史。
- [x] `ECONNRESET/socket hang up` 显示明确上传连接重置原因；图生图 POST 不自动重试，避免重复费用。
- [x] Chromium 实测 11.45MB/3840 方图压为 45KB/2048 方图，小图不变；假 Provider、尺寸、适配器、API、画布边界、Vue build 和生产 smoke 全部通过。
- [x] 活动任务为 0 后完成一致性备份和正式双 Compose 重建；四容器健康，3456 六个路径为 200，线上画布哈希与 main 一致，未调用真实 Provider。

## 2026-07-22 图片 Provider 首连接稳定性

- [x] 从正式 gateway 与任务状态确认浏览器已提交，失败发生在 Provider 上传连接阶段。
- [x] 用生产同款 `node-fetch` 无费用复现 TLS 前 `ECONNRESET`，并确认容器 IPv6 到 lingsuan 不可达。
- [x] 受控真实测试以 16,691 字节合成 PNG 复现三次 TLS 建连失败；复制库余额不变、生产数据未写入，排除大图体积是必要条件。
- [x] 分层探针确认宿主机可经 IPv6/Clash 访问，Docker 直连 lingsuan IPv4 超时、经 `host.docker.internal:7890` 成功；系统和容器全局 Proxy 均未启用。
- [x] 使用 `https-proxy-agent@7.0.6` 只代理精确 `lingsuan.top` 图片 HTTPS；其他 Provider、文本与 HTTP 假 Provider 直连。未命中代理时仍使用 IPv4 keep-alive 与地址轮换，歧义 socket reset 不重放。
- [x] 图生图任务返回脱敏的参考图字节、MIME、连接族和安全重试次数，不暴露图片、提示词或 Key。
- [x] 定向路由、DNS 顺序反转、pre-TLS、正常/超限图生图、尺寸、适配器、Chat 图片工具、API/画布 smoke 与 Vue 构建通过；候选和正式容器代理 HEAD 均 3/3 成功。
- [x] 一致性备份后完成正式双 Compose 重建；四容器健康，生产 smoke、旧资源隔离和六条 3456 路径通过。
- [ ] 修复后真实返图待正式发布后由用户单次复测；本轮不再重复付费提交。

## 2026-07-22 昨日中午生图链路复位

- [x] 从生产数据定位中午前最后成功点：本地 `2026-07-21 11:42:30`，记录 `gen_mru3y5gbc3bcca54`。
- [x] 在保留当前数据库、上传和 Chat 数据的前提下，回退定向代理、图片 IPv4 agent、参考图压缩与 5MB 护栏，恢复默认 HTTPS 直连和 `20260717reversecopy1`。
- [x] 活动任务为 0，当前一致性备份 `internal-prod-20260722-104926` 后完成正式 app 全量重建；四容器健康、生产 smoke 和六条主要路径通过。
- [x] 容器中 `LINGSUAN_IMAGE_PROXY_URL` 与全局代理变量均为空，确认发布的是回退版本。
- [x] 用户授权后只执行一次真实最小图生图；主站正常接收并进入 running，余额未扣且没有重试。
- [x] 核对新 `packyapi` 路线：用户真实任务已命中该独立域名；基础 HEAD 可达，失败任务未扣费，Codex 未重复提交。
- [x] 确认 Packy 失败根因为路线误配为 `new-api`；切到 `packy-images` 后，两图重复单数 `image` 的真实任务成功返图且只扣一次 10 点。
- [x] 使用与 Packy 成功任务相同的双图输入，分别单次测试官转和高速专线；两条任务均已到终态，错误、耗时、请求字段和零扣费均有记录。
- [ ] lingsuan 默认直连仍以 `ETIMEDOUT` 失败；该问题与已恢复的 Packy 路线分开处理。

## 2026-07-22 lingsuan 图片定向代理再次恢复

- [x] 同输入差分确认两条失败线路共享 `lingsuan.top`；Docker/宿主机 IPv4 建连超时、容器 IPv6 `ENETUNREACH`、宿主机代理 CONNECT 11ms 成功。
- [x] 经用户确认加入 `https-proxy-agent@7.0.6`，只为精确 `lingsuan.top` 图片 HTTPS 注入 Agent；Packy、其他域名、文本和系统代理保持不变。
- [x] 定向路由、严格适配器、pre-TLS、队列、Chat 图片工具、尺寸、API/画布 smoke、Vue build、Compose 与生产 smoke 全部通过。
- [x] 活动任务为 0 后完成一致性备份和正式双 Compose 重建；最终镜像 `sha256:494af9881703ab78c686495c811746ac297762a3ca3dba74b7237ac4ed0d373e` 健康，3456 六条路径均为 200。
- [x] 正式容器没有全局代理；无费用探针确认 lingsuan 定向代理 799ms 到站，Packy 默认直连 1125ms 到站。
- [x] 用户确认后仅提交一次真实 lingsuan 图生图：`task_mrvmoep3457ee321` 经 `https-proxy` 约 45.1 秒成功，1024×1024 PNG 已落盘且生产 URL 200；余额只扣一次 10 点，没有重试或切线。

## 2026-07-22 三条图片线路同输入复测

- [x] 官转、高速与 Packy 各串行提交一次相同双图、提示词、1024×1024、low 请求；没有重试或自动切线。
- [x] 官转和高速均约 17.6 秒 `ECONNRESET`，路由与 `https-proxy` 元数据正确，失败任务无返图、无生成记录、无本地扣费。
- [x] Packy 约 40.1 秒成功，1024×1024 PNG 已落盘且生产 URL 200；仅新增一条完成记录和一次 10 点扣费，复测后无活动任务。

## 2026-07-22 Clash 直连覆盖与三线恢复

- [x] 证明修改前 Clash 无 lingsuan/Docker 自定义规则，并在 `mihomo-party-before-lingsuan-direct-20260722-135518` 完成逐文件备份。
- [x] 通过持久化 `+rules` 首位加入 `DOMAIN-SUFFIX,lingsuan.top,DIRECT`，重载后实际配置命中且 Mihomo 语法检查通过。
- [x] 正式容器免费 HEAD 5/5 到站，Clash 日志 5/5 显示 `using DIRECT`；两个灵算 Key 免费鉴权均为 200。
- [x] 高速、Packy、官转均取得本轮真实成功返图；首次官转 reset 无返图/无扣费，间隔复测成功，未加入歧义 POST 自动重试。
- [x] 三张结果均为有效 PNG 且生产 URL 200；仅三条成功记录与三次 10 点扣费，最终无活动任务。
- [x] 普通用户可见三条路线均为 `enabled/active`，四个正式容器健康，可交付其他用户使用。

## 2026-07-22 画布 1:1 比例诊断

- [x] 当前项目节点确认保存 `size=1x1`，站内 `ratio=1:1` 到 Provider 像素 `size` 的转换测试通过。
- [x] 两笔异常竖图任务确认真实请求均含 `size=1024x1024`，返图原始像素分别为 `1139×1381`、`1058×1486`，比例偏差来自上游响应。
- [x] 最新 `4K + 1:1` 任务确认发送 `2880x2880 + high`；终态为 Provider 502，没有返图或本地成功扣费。
- [x] 本轮未修改请求字段、源码、线路或生产部署，未发起额外真实图片请求。

## 2026-07-22 Clash 关闭影响复核

- [x] 两笔 `ECONNREFUSED 192.168.65.254:7890` 与 Clash core 尚未监听的时间线吻合。
- [x] 当前 7890 已恢复监听，持久覆盖和运行配置继续包含 `lingsuan.top -> DIRECT`。
- [x] 免费容器探针 4/5 到站，core 日志确认全部使用 DIRECT；未发起真实生图。
- [x] 确认更换 VPN 节点不改变灵算出口，但关闭或重载 Clash 会影响在途请求。

## 2026-07-22 服务器部署前生图门禁

- [x] Packy 4K 用户任务成功，原始 PNG 为准确 `2880×2880`，生产 URL 200。
- [x] 高速专线 1K 用户任务成功，原始 PNG 为准确 `1024×1024`，生产 URL 200。
- [x] 正式 app/网关/LibreChat/MongoDB 健康，数据库健康，生产只读 smoke 与灵算免费 5/5 到站通过。
- [x] 记录高速专线 4K 仍有 524，不将“能生图”夸大为所有线路、档位完全稳定。
- [ ] 实际迁移前等待活动任务归零、创建一致性备份，并按目标服务器网络设置 `CHAT_PUBLIC_ORIGIN` 与 `LINGSUAN_IMAGE_PROXY_URL`。

## 2026-07-23 10 用户稳定生图候选

- [x] SQLite 持久任务、任务项和 Provider 尝试表已接入；提交与余额预占同事务，结算/退款幂等。
- [x] 用户幂等键、每用户 3 个非终态、全站 30 个、全局并发 3、失败域并发 1 和用户运行中 1 个的默认护栏已接入。
- [x] 批量任务逐图公平重排、失败域熔断、待执行/运行中取消、pending 恢复和 running 中断退款已覆盖。
- [x] `/api/generate/tasks`、模板和 Chat/MCP 生图统一任务服务；画布提交稳定幂等键并展示真实阶段。
- [x] 10 用户 3 轮 30 任务假 Provider 验收通过；队列、账务、部分成功、超限、落盘失败、熔断和重启恢复专项通过。
- [ ] Docker/3456、真实 Provider 和付费链路尚未切换；必须另行确认后执行一致性备份、完整重建、健康检查和生产 URL 验收。

## 2026-07-23 稳定生图自审与压力测试

- [x] 修复队列满载忙重试，并以 100ms 退避回归证明不会微任务热循环。
- [x] 修复熔断连续失败语义；超时/断连/400/503 和熔断恢复均有服务级假 Provider 覆盖。
- [x] 运行中取消记录 `TASK_CANCELLED_UPSTREAM_UNKNOWN` 和上游计费歧义；待执行取消仍保持普通取消。
- [x] 24 小时输入清理跳过等待中和运行中任务，终态及孤儿目录仍可清理。
- [x] 50 并发幂等风暴、30+1 队列容量、三失败域全局 3 并发和重启恢复通过。
- [x] 20 轮额外 600 任务浸泡通过；存活堆和外部内存未持续增长，RSS 峰值约 294MiB。
- [x] Provider/队列专项、一次性 API、后端/画布边界和 Vue 构建通过。
- [ ] Docker/3456、真实 Provider、付费调用和生产发布仍等待单独确认。

## 2026-07-22 服务器灵算直连配置

- [x] 新增独立 `docker-compose.server-direct.yml`，服务器 app 的 `LINGSUAN_IMAGE_PROXY_URL` 显式为空。
- [x] 本机 Compose 解析仍为 7890，服务器三文件 Compose 解析为空，两套语法检查通过。
- [x] Docker README、迁移运行手册和源码发布包必需文件断言已同步，发布包测试通过。
- [ ] 实际服务器启动后验证容器直连 `lingsuan.top:443`，再经用户确认执行一笔真实生图验收。

## 2026-07-22 当前内网宿主机代理解耦

- [x] 保留 Windows 系统代理和 Clash，确认 Codex 联网不受影响。
- [x] 正式 app 的 `LINGSUAN_IMAGE_PROXY_URL` 已清空，切换前后容器直连探针均连续 10/10 到站。
- [x] Chat 正式 Compose 默认改为直连，代理仅允许通过 `.env` 显式启用。
- [x] 正式 app 完整重建为新镜像，容器 healthy、生产健康接口 200、只读 smoke 通过。
- [ ] 用户确认费用后执行一笔直连真实生图验收。
