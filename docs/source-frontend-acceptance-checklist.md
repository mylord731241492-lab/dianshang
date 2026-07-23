# Vue3 源码前端验收清单

本清单用于把当前 `frontend/` 从“页面能打开”推进到“可以持续维护、可以测试、可以跑通主功能”。当前阶段不安装新依赖、不接管新后端、不触发真实付费或删除动作。

## 启动基线

1. 启动旧后端稳定基线：

```powershell
cd "C:\Users\pc\Desktop\hjm-mb-clone"
node server.js
```

2. 启动 Vue3 源码前端：

```powershell
cd "F:\dianshang\frontend"
npm run dev
```

3. 浏览器访问：

- 源码前端：`http://127.0.0.1:5173`
- 旧后端健康检查：`http://127.0.0.1:3456/api/health`
- 旧画布运行时：`http://127.0.0.1:3456/canvas`

## 自动化验收

每轮源码前端改动必须先过：

```powershell
npm run check:routes --prefix "F:\dianshang\frontend"
npm run build --prefix "F:\dianshang\frontend"
powershell -NoProfile -ExecutionPolicy Bypass -File "F:\dianshang\scripts\smoke-source-frontend-ui.ps1"
git -C "F:\dianshang" diff --check
```

`check:routes` 的责任是防止 `frontendMigrationRoutes` 和 Vue Router 漂移，并确保没有旧桥接组件重新混进源码路由。

## 当前已源码化入口

- 首页：`/`
- 旧画布直跳入口：`/canvas`
- 模板生图：`/template-image`
- 图库：`/gallery`
- 登录/注册：`/login`、`/register`
- 用户中心：`/user/center`
- 生成记录：`/user/records`
- 兑换码：`/user/redeem`
- 后台登录：`/admin/login`
- 后台只读页：`/admin/dashboard`、`/admin/users`、`/admin/recycle-bin`、`/admin/orders`、`/admin/logs`、`/admin/generate-tasks`、`/admin/redeem-codes`、`/admin/model-prices`、`/admin/template-workflows`
- 后台写入试点页：`/admin/api-providers`、`/admin/chat-settings`、`/admin/settings`

## 可直接跑通的功能

使用默认账号 `admin / admin123` 验收：

- 登录后进入图库，确认历史记录可加载。
- 首页显示旧站工作台导航、生成面板和历史画布项目区。
- 用户中心能读取用户资料、余额流水和 API 状态。
- 生成记录和兑换码页面能打开，兑换码页面只填写不提交。
- 模板页能加载模板、素材槽、线路、模型、比例和清晰度。
- 后台 Dashboard、用户、订单、日志、任务、兑换码、模型价格、模板工作流和回收站都能只读搜索和刷新。
- API 线路页已进入写入试点：可查看官方双线路、编辑旧后台字段、保存回显和 API Key 掩码；真实测试连接、拉模型、写入真实 Key 或删除正式线路前必须确认。
- 系统设置页已进入保存试点：可编辑基础设置和图片工具线路、模型、提示词模板；人工测试保存前必须记录原值，保存后再改回原值。
- Chat 设置页可查看部署与安全边界，编辑访问、文本、MCP 生图、允许模型和维护提示，并运行不产生模型费用的内部连接测试。
- Chat 设置页的“实际 API 中转测试”必须经过二次确认；结果显示模型、协议、耗时、Tokens 和响应内容。上游可能附加数千 Tokens，该操作只在明确确认后执行。
- 390px 移动端关键页无横向溢出。

## 暂不自动执行的功能

这些动作会写数据、删除数据、消耗额度或依赖真实外部服务，必须先确认测试数据和回滚方式：

- 模板真实反推和真实生图。
- 画布节点真实生成。
- 图库删除。
- 兑换码真实提交。
- 用户头像上传或保存。
- 后台用户删除、改余额、重置密码。
- 回收站恢复或永久删除。
- 订单状态修改、退款、补单。
- 任务取消或删除。
- API 线路真实测试连接、拉模型、写入真实 Key 或删除正式线路。
- 模型价格新增、保存、删除。
- 模板工作流保存、新增、删除和字段编辑。
- 系统设置中会影响真实业务流量、真实模型调用或大范围功能开关的配置变更。

## 下一阶段验收顺序

1. 先跑完整源码前端 smoke，确认页面层没有退化。
2. 人工验收系统设置、API 线路和 Chat 设置三个写入试点，按原值记录、保存、刷新回显、恢复原值的顺序执行。
3. 写入试点通过后，再评估模型价格和模板工作流这两类复杂写入。
4. 最后在确认额度后接入真实 New-API 生图、模板反推、画布节点生成和图库回写。
