# 后台 UI 规范

> 当前基线：`0fd4453 fix: stabilize canvas generation flow`。
> 适用范围：源码后台 `/admin/*` 页面，不包含当前画布、前台首页、模板页、图库或用户中心。

## 设计方向

后台采用高密度运维风：浅色工作台、稳定侧栏、紧凑列表、明确状态、低装饰、强可扫描性。后台不是营销页，不使用大 Hero、浮夸渐变、装饰图形或会降低信息密度的卡片堆叠。

## 基础规则

- 圆角统一 8px；按钮、输入框、面板、列表行和提示条保持一致。
- 主色为冷静的绿色操作色，辅助使用蓝色信息、琥珀警告、红色危险；禁止整页只靠单一绿色表达层级。
- 页面结构统一为：侧栏、页头操作区、反馈条、统计区、内容面板。
- 文案直接描述业务对象和状态，不在页面里解释 UI 本身。
- 图标统一使用 `lucide-vue-next`；可识别操作优先使用图标+短文字。
- 列表优先高密度行布局，长文本必须省略或换行到明确区域，不能挤压操作按钮。
- 真实写入、删除、测试连接、写入真实 Key、扣费或外部 Provider 调用必须保留确认。

## 组件规范

- `AdminPageShell`：只负责后台页面骨架和侧栏，不承载业务状态。
- `AdminPageHeader`：统一返回前台、标题、说明和右侧操作按钮。
- `AdminFeedback`：统一错误和成功提示，错误优先展示。
- `AdminStatGrid`：统一统计卡片，数值使用本地中文数字格式。
- `AdminPanel`：统一内容面板，允许页面通过 slot 放置表单、列表和工具栏。
- `AdminToolbar`：统一筛选/搜索区域，移动端自动单列。
- `AdminEmptyState`：统一空态，避免页面各自写散落的空白文案。

## 可维护性规则

- 共用组件只做布局和展示，不直接请求接口。
- 页面自己的 API 调用、确认弹窗、表单字段、保存和刷新逻辑必须留在对应 `Admin*Source.vue`。
- 后台样式集中放在 `frontend/src/styles/app.css` 的后台区域；新增页面级 class 必须挂在 `admin-` 前缀下。
- 新后台页面必须接入 `frontend/src/config/adminNavigation.ts`，同时同步 `frontend/src/config/frontendMigration.ts` 和 Vue Router。
- 不新增 UI 依赖；shadcn 只作为设计参考，实际实现继续使用 Vue 3、Naive UI 和 lucide。

## 验收标准

- `npm run check:routes --prefix "F:\dianshang\frontend"` 通过。
- `npm run build --prefix "F:\dianshang\frontend"` 通过。
- `scripts/smoke-source-frontend-ui.ps1` 覆盖后台桌面和移动端页面，无横向溢出、无 4xx/5xx、无 console error。
- 后台页面 smoke 覆盖标题、按钮颜色、行高、操作列宽度和截图归档。
- 生产同步必须另走 Docker 重建、容器 healthy 和内网 URL 命中验证。
