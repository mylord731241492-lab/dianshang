# Infinite Canvas 候选依赖与许可证清单（2026-07-27）

> 数据源：`integrations/infinite-canvas/web/package.json`（直接 dependencies/devDependencies）与 `integrations/infinite-canvas/web/package-lock.json`（lockfileVersion 3，`packages` 条目的 `license` 字段）。
> 上游固定：`basketikun/infinite-canvas` tag `v0.10.0`，提交 `a0287a5e346e219bd488d084295542213912d816`。
> 本清单最初只做盘点；2026-07-27 已按用户批准完成锁文件同步与基线安装（详见"特别标注"）。

## 特别标注（必读）

- **`antd` 锁定为 v6 大版本（`^6.4.2`，锁定 6.4.2）**：与常见的 antd v4/v5 差异较大，候选改造时不得按 v4/v5 API 经验假设行为。
- **`@ant-design/pro-components` 为 `3.0.0-beta.3` 预发布依赖**：beta 版 API 可能不稳定，升级或替换前必须单独评估并经用户确认。
- **`@codemirror/lang-javascript`（`^6.2.5`）声明于 `package.json` 但不存在于 `package-lock.json`**：lock 与清单不一致，`npm ci` 会因此报错，执行安装前必须先向用户报告并确认处理方式。**（2026-07-27 更新：已按用户批准用 `npm install --package-lock-only --legacy-peer-deps` 同步锁文件，`@codemirror/lang-javascript@6.2.5` 已进入 `package-lock.json`；因上游 lockfile 本身以 `--legacy-peer-deps` 生成——`@ant-design/pro-components@3.0.0-beta.3` 的 peer 要求 `antd@^5.11.2` 与根 `antd@6.4.2` 冲突——`npm ci` 同样需加 `--legacy-peer-deps`，未出现额外 peer 警告输出。）**

## dependencies（28 项）

| 包名 | 锁定版本 | 用途 | 许可证 | 官方链接 |
| --- | --- | --- | --- | --- |
| @ant-design/icons | 6.2.2 | Ant Design 图标库 | MIT | https://www.npmjs.com/package/@ant-design/icons |
| @ant-design/pro-components | 3.0.0-beta.3 | Ant Design Pro 高级组件（预发布） | MIT | https://www.npmjs.com/package/@ant-design/pro-components |
| @codemirror/lang-javascript | 未入 lock（声明 ^6.2.5） | CodeMirror JavaScript 语言支持 | MIT（lock 无条目，按上游包元数据） | https://www.npmjs.com/package/@codemirror/lang-javascript |
| @codemirror/lang-json | 6.0.2 | CodeMirror JSON 语言支持 | MIT | https://www.npmjs.com/package/@codemirror/lang-json |
| @tanstack/react-query | 5.100.9 | 服务端状态/数据请求缓存 | MIT | https://www.npmjs.com/package/@tanstack/react-query |
| @uiw/react-codemirror | 4.25.9 | CodeMirror 的 React 封装（代码编辑器） | MIT | https://www.npmjs.com/package/@uiw/react-codemirror |
| antd | 6.4.2 | Ant Design v6 UI 组件库 | MIT | https://www.npmjs.com/package/antd |
| axios | 1.16.0 | HTTP Client | MIT | https://www.npmjs.com/package/axios |
| class-variance-authority | 0.7.1 | 组件样式变体管理（shadcn 体系） | Apache-2.0 | https://www.npmjs.com/package/class-variance-authority |
| clsx | 2.1.1 | className 条件拼接 | MIT | https://www.npmjs.com/package/clsx |
| copy-to-clipboard | 4.0.2 | 剪贴板复制 | MIT | https://www.npmjs.com/package/copy-to-clipboard |
| dayjs | 1.11.20 | 日期时间处理 | MIT | https://www.npmjs.com/package/dayjs |
| fflate | 0.8.3 | 压缩/解压（ZIP 等） | MIT | https://www.npmjs.com/package/fflate |
| file-saver | 2.0.5 | 浏览器端文件保存/导出 | MIT | https://www.npmjs.com/package/file-saver |
| localforage | 1.10.0 | 浏览器本地存储（IndexedDB 封装） | Apache-2.0 | https://www.npmjs.com/package/localforage |
| lucide-react | 1.16.0 | Lucide 图标 React 组件 | ISC | https://www.npmjs.com/package/lucide-react |
| motion | 12.38.0 | 动画库（原 framer-motion） | MIT | https://www.npmjs.com/package/motion |
| nanoid | 5.1.11 | 唯一 ID 生成 | MIT | https://www.npmjs.com/package/nanoid |
| radix-ui | 1.4.3 | 无样式可访问组件原语（shadcn 基座） | MIT | https://www.npmjs.com/package/radix-ui |
| react | 19.2.5 | React 19 运行时 | MIT | https://www.npmjs.com/package/react |
| react-dom | 19.2.5 | React DOM 渲染器 | MIT | https://www.npmjs.com/package/react-dom |
| react-router | 7.18.0（声明 ^7.12.0） | 路由核心 | MIT | https://www.npmjs.com/package/react-router |
| react-router-dom | 7.18.0（声明 ^7.12.0） | 路由 DOM 绑定 | MIT | https://www.npmjs.com/package/react-router-dom |
| shadcn | 4.7.0 | shadcn CLI/组件体系 | MIT | https://www.npmjs.com/package/shadcn |
| streamdown | 2.5.0 | 流式 Markdown 渲染（AI 输出展示） | Apache-2.0 | https://www.npmjs.com/package/streamdown |
| tailwind-merge | 3.6.0 | Tailwind class 合并去重 | MIT | https://www.npmjs.com/package/tailwind-merge |
| tailwindcss | 4.2.4 | Tailwind CSS v4 样式框架 | MIT | https://www.npmjs.com/package/tailwindcss |
| tw-animate-css | 1.4.0 | Tailwind 动画工具集 | MIT | https://www.npmjs.com/package/tw-animate-css |
| zustand | 5.0.12 | 轻量状态管理 | MIT | https://www.npmjs.com/package/zustand |

## devDependencies（9 项）

| 包名 | 锁定版本 | 用途 | 许可证 | 官方链接 |
| --- | --- | --- | --- | --- |
| @tailwindcss/postcss | 4.2.4 | Tailwind v4 PostCSS 插件 | MIT | https://www.npmjs.com/package/@tailwindcss/postcss |
| @types/file-saver | 2.0.7 | file-saver 类型定义 | MIT | https://www.npmjs.com/package/@types/file-saver |
| @types/node | 20.19.39 | Node.js 类型定义 | MIT | https://www.npmjs.com/package/@types/node |
| @types/react | 19.1.12 | React 类型定义 | MIT | https://www.npmjs.com/package/@types/react |
| @types/react-dom | 19.1.9 | React DOM 类型定义 | MIT | https://www.npmjs.com/package/@types/react-dom |
| @vitejs/plugin-react | 5.2.0 | Vite React 插件 | MIT | https://www.npmjs.com/package/@vitejs/plugin-react |
| prettier | 3.8.3 | 代码格式化 | MIT | https://www.npmjs.com/package/prettier |
| typescript | 5.9.3 | TypeScript 编译器 | Apache-2.0 | https://www.npmjs.com/package/typescript |
| vite | 7.3.6 | Vite 7 构建工具 | MIT | https://www.npmjs.com/package/vite |

## 许可证汇总

- MIT：32 项（含按上游包元数据归类的 @codemirror/lang-javascript）；Apache-2.0：4 项（class-variance-authority、localforage、streamdown、typescript）；ISC：1 项（lucide-react）。均为宽松许可证，无 copyleft 依赖。
- 间接（传递）依赖未逐项列出；`package-lock.json` 为唯一锁定事实源。

## 约束声明

- 依赖来自固定上游 `v0.10.0`，候选版**不升级版本、不新增画布引擎**。
- 安装时严格 `npm ci`，**禁止 `npm update`**、禁止手工改动 `package-lock.json`。
- 执行任何安装命令前需用户批准；本清单生成过程未运行安装。
