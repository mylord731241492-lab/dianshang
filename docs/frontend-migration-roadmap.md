# 前端源码化迁移路线图

## 当前决策

- 新画布已废止，`/canvas` 继续使用旧后端画布运行时。
- `frontend/` 已成为 Vue3 + Vite + TypeScript 源码前端主入口。
- 迁移索引当前为 `21 / 0 / 21`：21 个源码入口、0 个旧桥接入口、21 个总入口。
- 后台页面当前以只读源码页为主；`/admin/settings` 已作为低风险保存试点，其他写入类动作需要单独确认测试数据和回滚方式后再迁移。
- 新增依赖前必须先说明用途、来源、许可证和官网/GitHub，并等待确认。

## 路由迁移索引

| 区域 | 路由 | 当前承载 | 状态 | 说明 |
| --- | --- | --- | --- | --- |
| 前台 | `/` | `frontend/` | 源码完成 | 迁移首页和验收入口。 |
| 画布 | `/canvas` | `frontend/` 入口壳 + 旧画布运行时 | 源码入口完成 | 新画布废止，只保留旧画布新窗口入口；本地保存必须在旧画布顶层页使用。 |
| 模板 | `/template-image` | `frontend/` | 源码待人工复核 | 已接模板选择、素材槽、反推、生成和结果区；真实生成需确认后测试。 |
| 图库 | `/gallery` | `frontend/` | 源码待人工复核 | 已对接 `/api/user/generations`，删除动作需确认测试数据。 |
| 认证 | `/login`、`/register` | `frontend/` | 源码待人工复核 | 登录已用 `admin/admin123` 验证，注册 smoke 会创建并清理临时账号。 |
| 用户 | `/user/center` | `frontend/` | 源码待人工复核 | 已接用户资料、余额流水、API 状态和退出登录。 |
| 用户 | `/user/records`、`/user/redeem` | `frontend/` | 源码待人工复核 | 记录读取已接入；真实兑换码提交需确认后测试。 |
| 后台 | `/admin/login` | `frontend/` | 源码完成 | 已接管理员登录。 |
| 后台 | `/admin/dashboard` | `frontend/` | 只读源码完成 | 展示统计、排行、线路和最近任务。 |
| 后台 | `/admin/users` | `frontend/` | 只读源码完成 | 列表、搜索、筛选、分页和刷新；写入动作未开放。 |
| 后台 | `/admin/recycle-bin` | `frontend/` | 只读源码完成 | 空状态和只读列表已验收；恢复/永久删除未开放。 |
| 后台 | `/admin/orders` | `frontend/` | 只读源码完成 | 订单搜索和筛选已接入；退款/补单/改状态未开放。 |
| 后台 | `/admin/logs` | `frontend/` | 只读源码完成 | 消费日志读取、搜索和筛选已接入。 |
| 后台 | `/admin/generate-tasks` | `frontend/` | 只读源码完成 | 任务读取、搜索和筛选已接入；取消/删除未开放。 |
| 后台 | `/admin/redeem-codes` | `frontend/` | 只读源码完成 | 兑换码读取、搜索和筛选已接入；创建/删除未开放。 |
| 后台 | `/admin/api-providers` | `frontend/` | 只读源码完成 | API 线路读取和 masked key 展示已接入；测试/保存/删除未开放。 |
| 后台 | `/admin/model-prices` | `frontend/` | 只读源码完成 | 模型价格读取和筛选已接入；保存/新增/删除未开放。 |
| 后台 | `/admin/template-workflows` | `frontend/` | 只读源码完成 | 模板工作流摘要读取已接入；保存/编辑未开放。 |
| 后台 | `/admin/settings` | `frontend/` | 保存试点 | 已接系统设置读取；开放站点名称、注册开关、模板生图、图库历史、Mock 模式、默认算力和上传上限保存回显。 |

## 工程化护栏

- `frontend/src/config/frontendMigration.ts` 是迁移索引来源。
- `frontend/src/router/index.ts` 是实际路由来源。
- `frontend/src/api/http.ts` 统一承载 Axios 实例、Bearer Token 注入和 API 错误文案解析，页面只保留业务兜底文案。
- `scripts/check-source-frontend-routes.js` 会检查迁移索引和 Router 是否一致，并阻止旧桥接组件重新混入。
- `scripts/smoke-source-frontend-ui.ps1` 是源码前端主 smoke，覆盖注册清理、登录、首页迁移索引、用户、模板、图库、旧画布入口、后台只读页和移动端横向溢出。
- `docs/source-frontend-acceptance-checklist.md` 是人工验收 runbook。

## 下一阶段建议顺序

1. 人工跑一轮源码前端总体验收，优先确认页面可用性和视觉一致性。
2. 人工按原值记录、保存、刷新回显、恢复原值的顺序验收系统设置保存试点。
3. 写入试点稳定后，再迁移 API 线路、模型价格、模板工作流这三类复杂后台写入。
4. 最后做真实 New-API 生图、模板反推、画布节点生成、图库回写和余额流水闭环。

## 验收规则

- 每个源码页面必须能直接刷新访问。
- 每个页面至少覆盖桌面 1440px 和移动 390px 的基本布局。
- 写入、删除、真实扣费、真实模型调用必须先确认测试数据和回滚方式。
- 新后端接管前，源码前端必须继续兼容旧 Express API 的关键响应字段。
