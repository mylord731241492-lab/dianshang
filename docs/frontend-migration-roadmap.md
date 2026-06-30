# 前端源码化迁移路线图

## 当前决策

- 新画布已废止，`/canvas` 继续使用旧后端画布运行时。
- `frontend/` 已成为 Vue3 + Vite + TypeScript 源码前端主入口。
- 迁移索引当前为 `21 / 0 / 21`：21 个源码入口、0 个旧桥接入口、21 个总入口。
- 后台源码页已统一使用 `AdminSourceSidebar.vue` 共用侧栏，11 个后台入口数量和顺序一致。
- `/admin/settings` 和 `/admin/api-providers` 已进入写入试点；真实测试连接、真实 Key、删除正式数据和外部付费调用仍需单独确认测试数据与回滚方式。
- 新增依赖前必须先说明用途、来源、许可证和官网/GitHub，并等待确认。

## 路由迁移索引

| 区域 | 路由 | 当前承载 | 状态 | 说明 |
| --- | --- | --- | --- | --- |
| 前台 | `/` | `frontend/` | 源码完成 | 迁移首页和验收入口。 |
| 画布 | `/canvas` | `frontend/` 直跳旧画布运行时 | 源码入口完成 | 新画布废止；源码入口直接整页跳转旧画布运行时，本地保存必须在旧画布顶层页使用。 |
| 模板 | `/template-image` | `frontend/` | 源码待人工复核 | 已接模板选择、素材槽、反推、生成和结果区；真实生成需确认后测试。 |
| 图库 | `/gallery` | `frontend/` | 源码待人工复核 | 已对接 `/api/user/generations`，删除动作需确认测试数据。 |
| 认证 | `/login`、`/register` | `frontend/` | 源码待人工复核 | 登录已用 `admin/admin123` 验证，注册 smoke 会创建并清理临时账号。 |
| 用户 | `/user/center` | `frontend/` | 源码待人工复核 | 已接用户资料、余额流水、API 状态和退出登录。 |
| 用户 | `/user/records`、`/user/redeem` | `frontend/` | 源码待人工复核 | 记录读取已接入；真实兑换码提交需确认后测试。 |
| 后台 | `/admin/login` | `frontend/` | 源码完成 | 已接管理员登录。 |
| 后台 | `/admin/dashboard` | `frontend/` | 只读源码完成 | 展示统计、排行、线路和最近任务；后台共用侧栏已统一。 |
| 后台 | `/admin/users` | `frontend/` | 只读源码完成 | 列表、搜索、筛选、分页和刷新；写入动作未开放。 |
| 后台 | `/admin/recycle-bin` | `frontend/` | 只读源码完成 | 空状态和只读列表已验收；恢复/永久删除未开放。 |
| 后台 | `/admin/orders` | `frontend/` | 只读源码完成 | 订单搜索和筛选已接入；退款/补单/改状态未开放。 |
| 后台 | `/admin/logs` | `frontend/` | 只读源码完成 | 消费日志读取、搜索和筛选已接入。 |
| 后台 | `/admin/generate-tasks` | `frontend/` | 只读源码完成 | 任务读取、搜索和筛选已接入；取消/删除未开放。 |
| 后台 | `/admin/redeem-codes` | `frontend/` | 只读源码完成 | 兑换码读取、搜索和筛选已接入；创建/删除未开放。 |
| 后台 | `/admin/api-providers` | `frontend/` | 写入试点 | 已恢复旧后台字段表单、保存回显、默认线路、删除、API Key 掩码展示和官方双线路应用；测试连接、拉模型和真实 Key 付费验证需人工确认。 |
| 后台 | `/admin/model-prices` | `frontend/` | 只读源码完成 | 模型价格读取和筛选已接入；保存/新增/删除未开放。 |
| 后台 | `/admin/template-workflows` | `frontend/` | 只读源码完成 | 模板工作流摘要读取已接入；保存/编辑未开放。 |
| 后台 | `/admin/settings` | `frontend/` | 保存试点 | 已接系统设置读取；开放基础设置和图片工具线路、模型、提示词模板配置的保存回显。 |

## 工程化护栏

- `frontend/src/config/frontendMigration.ts` 是迁移索引来源。
- `frontend/src/router/index.ts` 是实际路由来源。
- `frontend/src/api/http.ts` 统一承载 Axios 实例、Bearer Token 注入和 API 错误文案解析，页面只保留业务兜底文案。
- `scripts/check-source-frontend-routes.js` 会检查迁移索引和 Router 是否一致，并阻止旧桥接组件重新混入。
- `scripts/smoke-source-frontend-ui.ps1` 是源码前端主 smoke，覆盖注册清理、登录、旧站首页工作台、用户、模板、图库、旧画布直跳入口、后台源码页和移动端横向溢出。
- `docs/source-frontend-acceptance-checklist.md` 是人工验收 runbook。

## 下一阶段建议顺序

1. 人工跑一轮源码前端总体验收，优先确认首页工作台、旧画布直跳和后台统一侧栏。
2. 按原值记录、保存、刷新回显、恢复原值的顺序验收系统设置和 API 线路两个写入试点。
3. 写入试点稳定后，再评估模型价格、模板工作流等复杂后台写入，不先碰真实生产数据。
4. 最后在用户确认额度后做真实 New-API 生图、模板反推、画布节点生成、图库回写和余额流水闭环。

## 验收规则

- 每个源码页面必须能直接刷新访问。
- 每个页面至少覆盖桌面 1440px 和移动 390px 的基本布局。
- 写入、删除、真实扣费、真实模型调用必须先确认测试数据和回滚方式。
- 新后端接管前，源码前端必须继续兼容旧 Express API 的关键响应字段。
