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
