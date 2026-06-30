# 2026-06-30 开发进度与可维护性审计

## 结论

`F:\dianshang` 已经从“只能改打包资产的本地克隆”推进到“旧画布稳定运行 + Vue 3 源码前端逐页接管 + Express/SQLite 兼容后端继续承载真实 API 线路”的过渡生产测试项目。当前可用于继续验收，但还不适合直接当作长期生产架构定稿。

最重要的进展是：源码前端已经建立，后台源码页和生产入口已统一，API 线路可写试点已跑通，旧画布图片节点和顶部工具链路已做多轮修复，GPT Image 2 的文生图/图生图编辑路线已接入后端适配层。

最重要的维护风险是：`server.js` 仍是单文件大后端，旧画布仍依赖打包 JS 与 CSS/JS 覆盖补丁，部分文档状态落后于实际实现，真实模型调用和写入类后台动作还缺完整人工验收闭环。

## 当前完成度

### 前端源码化

- `frontend/` 已建立 Vue 3 + Vite + TypeScript 工程。
- 迁移路由检查为 `21/21 source routes`。
- 后台源码页已统一使用 `AdminSourceSidebar.vue`，11 个后台入口数量和顺序一致。
- 生产服务端已将已迁移的 `/admin/...` 路径统一交给 `frontend/dist/index.html`。
- 首页、登录注册、用户中心、图库、模板、生成记录、兑换页、后台只读页已进入源码维护路径。

### 旧画布保留与补丁

- 新画布已废止，继续保留旧画布运行时。
- 图片节点已完成 `image7` 级别 polish：图片等比完整显示，顶部信息栏，顶部横向工具条，普通图片/生成结果/Canvas Chat 添加图片视觉规则统一。
- 扩图面板已完成 `outpaint6`：绿色目标画布允许自由摆放，缩放保持等比例，露出区域作为待扩图区域。
- 旧画布性能补丁已覆盖交互态降级、缩放闪烁、自动保存降频。

### API 与生成链路

- API 线路按 Packy / OpenAI-compatible 档案收敛：
  - `gpt-image-2` 文生图：`/images/generations`
  - `gpt-image-2` 图生图/编辑：`/images/edits`
  - `gpt-5.5` 文本：`/responses`
- 后台 API 线路页支持保存、编辑、默认线路、API Key 掩码回显。
- 真实文生图链路已跑通过；远程图片通过 `/api/proxy-image` 同源代理。
- 图片工具中除高清放大和一键抠图外，扩图、反推提示词、智能消除、局部修改、文字编辑、尺寸/裁剪/压缩等已接入现有链路或后端适配入口。

### 工程护栏

- 已有 `AGENTS.md`、README、ADR、API 契约、后端边界、画布迁移清单、源码前端验收清单。
- 已有路由维护脚本、源码前端 smoke、画布性能 smoke、API smoke、资源版本校验脚本。
- `.gitignore` 已排除 `.env`、SQLite 数据库、uploads、logs、node_modules、dist、缓存目录。

## 可维护性风险

### 高风险

- `server.js` 约 2400 行，仍集中承载认证、用户、后台、Provider、模板、图片工具、SPA fallback；继续加功能会明显提高回归风险。
- 旧画布核心逻辑仍在 `assets/Canvas-*.js` 打包产物中修补，短期有效，长期不利于代码审查和精确回归测试。
- `frontend/dist` 是构建产物且被 `.gitignore` 忽略；线上运行依赖源码构建步骤或本地已有 dist，部署文档需要明确 `npm run build --prefix frontend`。

### 中风险

- 文档部分状态已经落后于实现，例如 `frontend-migration-roadmap.md` 仍描述 API 线路为只读，而实际已进入可写试点。
- Provider Adapter 仍偏 OpenAI-compatible，更多中转站差异格式尚未配置化。
- 后台 API 线路、模型价格、模板工作流、系统设置仍主要通过 SQLite `app_state` 或兼容结构承载，尚未拆为清晰业务表。
- Playwright UI smoke 偶发会话未打开，需要继续加固启动和重试逻辑。

### 低风险

- 文档和设计截图较多，仓库体积可接受，但后续应避免继续把大体积截图快照无限追加。
- Windows CRLF warning 仍存在，不影响当前检查，但建议后续统一 `.gitattributes`。

## 建议下一步

1. 更新过期路线图，把 API 线路状态从“只读”改为“可写试点”，同步系统设置和后台统一侧栏状态。
2. 把 `server.js` 按低风险边界拆出 Provider、image-tools、admin-api-providers、SPA fallback 四块，先不改变行为。
3. 为 API 线路保存、Key 掩码、官方双线路、image-tools 路由补后端单元/集成级 smoke，减少依赖人工页面验证。
4. 对真实生图继续执行人工确认制度：每次触发 GPT Image 2/GPT 5.5 前明确额度、输入和回滚记录。
5. 画布继续只做旧运行时阻塞级修复；新需求优先进入源码化计划，不继续扩大打包产物修改面。

## 本次上传前检查

- GitHub CLI 已登录 `mylord731241492-lab`。
- 目标仓库 `mylord731241492-lab/web` 存在，当前无默认分支，适合首次推送。
- 候选提交未包含 `.env`、`data.db`、`uploads/`、`logs/`、`node_modules/`。
- 敏感扫描命中均为 `.env.example`、Docker 占位符或 smoke 测试假 key，未发现真实 API Key 形态进入候选提交。
