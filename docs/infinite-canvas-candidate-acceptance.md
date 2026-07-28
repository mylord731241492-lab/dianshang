# Infinite Canvas 候选环境验收

## 结论

Task 13 的隔离候选环境位于 `http://127.0.0.1:3466/canvas`。自动化阻断项已通过，候选环境继续保留给 Task 14 人工验收；未切换正式 `/canvas`，未重建或重启正式 3456 容器。

候选环境固定使用：

- `CANVAS_RUNTIME=infinite`
- `ENABLE_REAL_AI=false`
- `ENABLE_REAL_STORAGE=false`
- `ENABLE_REAL_EMAIL=false`
- `ENABLE_REAL_PAYMENT=false`
- Fake Provider、Fake Storage 和候选目录内的独立 SQLite/上传/工作流/日志数据

因此本轮不会调用零算中转或其他真实 Provider，不会产生真实扣费，也不能据此判定真实中转链路已经连通。

## 隔离边界

- Compose 文件：`docker/docker-compose.canvas-candidate.yml`
- 容器：`dianshang-canvas-candidate`
- 监听：仅 `127.0.0.1:3466`
- 候选数据：`.scratch/infinite-canvas-candidate/`
- 正式容器：`dianshang-internal-app`
- 正式端口：3456，本轮不执行正式 Compose、重启、重建或数据挂载

自动化在运行前后对正式容器 ID、镜像 ID、启动时间和健康状态做完全一致断言。最近一次通过时：

- 候选镜像/容器：`sha256:98f547a41a6435f47e46e607cf38fb191dc7737326ecde53f1bdfa099d473add`，`2026-07-28T09:56:50.302165838Z`，`healthy`
- 正式容器指纹：`6511deb920aabc66657973665e1cc6cfa66ee1cc79d8a4ccd197adcf5911f2b0|sha256:2e40b8e29d10d4ec9e2c00cf564bd06a4f7e692a8a93055a4243d838562267b0|2026-07-28T01:11:18.984994951Z|healthy`

## 自动化验收范围

### API 与数据边界

- 健康检查、无限画布运行时和未登录 401
- 用户 A/B 注册、管理员候选登录和候选测试余额
- 项目创建、保存、读取、删除及跨用户 404 隔离
- 素材上传、分页、游标、搜索、改名、标签、短时访问地址、软删除及跨用户隔离
- 系统提示词创建、发布、禁用、普通用户只读和管理员权限
- 用户提示词创建、编辑、收藏、搜索、删除及跨用户隔离
- 生图任务幂等、逐图结算、取消退款、重试和终态
- 局部重绘、智能擦除、扩图的 Fake Provider 契约

### 1440×900 桌面端阻断项

- 项目列表新建、画布内改名、列表改名和删除
- 文本、图片、生成配置、组节点创建
- 节点拖动、连线、撤销、重做、Ctrl 框选
- 连续 20 次滚轮缩放、小地图、视图重置
- 本地图片上传
- 云端素材库可见入口、分页、搜索、改名、标签、插回画布和软删除
- 系统/个人提示词的复制、新建、编辑、收藏和插入
- 局部遮罩编辑对话框、画笔、擦除、笔刷大小和蒙版绘制
- 自动保存、刷新恢复和服务端项目 envelope
- 用户 A/B 切换后项目、素材、提示词、LocalStorage 与 IndexedDB 权限数据隔离
- 浏览器控制台零错误、意外 HTTP 4xx/5xx 为零、页面无横向溢出

### 性能与恢复样本

- 固定 10 个节点，其中 9 个图片节点共同引用同一个云端素材
- 10 节点恢复时间必须小于 15 秒
- 9 张图片全部恢复
- 拖动期间项目保存请求不超过 1 次
- 连续 20 次滚轮缩放
- 打开/关闭素材库后 Blob URL 数量不异常增长
- 项目 JSON 不包含 `data:image/`、`blob:` 或短时签名地址

验收过程中发现并修复两个恢复缺陷：空 `content` 的 `storageKey` 图片未重新解析；同一素材并发恢复时重复创建 Blob URL并相互撤销。

### 390×844 移动端

- 主画布区域可见
- 10 个节点全部恢复
- 页面无横向溢出

当前自动化结果为通过。移动端仍属于候选兼容路径，Task 14 需要人工确认触控、工具栏可达性和弹窗操作体验。

## 复现命令

完整隔离验收：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File "F:\dianshang-worktrees\infinite-canvas-candidate\scripts\smoke-infinite-canvas-candidate.ps1" -Port 3466
```

复用已构建容器，只跑 API 与 UI：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File "F:\dianshang-worktrees\infinite-canvas-candidate\scripts\smoke-infinite-canvas-candidate.ps1" -Port 3466 -SkipBuild
```

仅调试浏览器验收：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File "F:\dianshang-worktrees\infinite-canvas-candidate\scripts\smoke-infinite-canvas-candidate.ps1" -Port 3466 -SkipBuild -UiOnly
```

通过总预检显式启用：

```powershell
$env:SMOKE_INFINITE_CANVAS_CANDIDATE = "true"
powershell -NoProfile -ExecutionPolicy Bypass -File "F:\dianshang-worktrees\infinite-canvas-candidate\scripts\preflight-check.ps1"
```

## Task 14 人工门禁

人工验收前保持候选容器运行，访问 `http://127.0.0.1:3466/canvas`。建议依次确认：

1. 桌面端创建项目，添加并拖动四类节点，连接后撤销/重做。
2. 上传图片，打开云端素材库，完成搜索、改名、标签和插回画布。
3. 新建个人提示词，复制系统提示词，并分别插入生成配置节点。
4. 对图片打开局部编辑，检查画笔、擦除、笔刷大小和弹窗布局。
5. 刷新页面，确认节点、连线、图片和画布视口恢复。
6. 在 390×844 或真实手机视口检查工具栏、侧栏和主要弹窗是否可操作。
7. 明确记录“通过”或具体问题后，再决定是否进入正式切换方案。

未经用户确认，不执行 Task 14 之后的正式切换、真实 Provider、正式对象存储或正式 3456 重建。
