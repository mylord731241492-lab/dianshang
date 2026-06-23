# 前端 1:1 验收清单

> 本清单用于把本地克隆从“能打开”推进到“可按页面验收”。当前项目是线上构建产物 + 本地 Express 兼容层，因此验收以页面行为和视觉一致性为主。

## 验收环境

- 本地地址：`http://localhost:3456`
- 管理员账号：`admin / admin123`
- 桌面视口：`1440x900`
- 移动视口：`390x844`
- 设计截图归档：`docs/design-references/`

## 页面清单

| 页面 | 路由 | 桌面截图 | 移动截图 | 当前状态 | 必过验收点 |
| --- | --- | --- | --- | --- | --- |
| 首页 | `/` | `home-desktop-1440x900.png` | `home-mobile-390x844.png` | 已归档 | 首屏、导航、图库入口、登录入口无裸样式 |
| 登录 | `/login` | `login-desktop-1440x900.png` | `login-mobile-390x844.png` | 已归档 | 表单、切换注册、错误提示、登录成功跳转 |
| 注册 | `/register` | `register-desktop-1440x900.png` | `register-mobile-390x844.png` | 已归档 | 验证码、注册成功、重复账号提示 |
| 画布 | `/canvas` | `canvas-desktop-1440x900.png` | `canvas-mobile-390x844.png` | 已归档 | 工具栏、节点面板、生成入口、保存、导出、历史记录 |
| 模板 | `/template-image` | `template-image-desktop-1440x900.png` | `template-image-mobile-390x844.png` | 已归档 | 模板列表、上传区、反推、生成、任务队列、结果区 |
| 用户中心 | `/user/center` | `user-center-desktop-1440x900.png` | `user-center-mobile-390x844.png` | 已归档 | 余额、兑换码、头像、API 线路选择 |
| 后台控制台 | `/admin/dashboard` | `admin-dashboard-desktop-1440x900.png` | `admin-dashboard-mobile-390x844.png` | 已归档 | 统计卡片、模型使用、线路统计、用户排行 |
| API 线路 | `/admin/api-providers` | `admin-api-providers-desktop-1440x900.png` | `admin-api-providers-mobile-390x844.png` | 已归档 | 线路列表、测试连接、拉取模型、分页数量 |
| 任务监控 | `/admin/generate-tasks` | `admin-generate-tasks-desktop-1440x900.png` | `admin-generate-tasks-mobile-390x844.png` | 已归档 | 任务统计、任务表、详情、删除记录 |
| 模板工作流 | `/admin/template-workflows` | `admin-template-workflows-desktop-1440x900.png` | `admin-template-workflows-mobile-390x844.png` | 已归档 | 模板数据、保存、平台/质量/比例配置 |

## 通用验收标准

- 页面不得出现浏览器默认 input/file/button 样式暴露。
- 页面不得出现明显空白区、错位、遮挡、文字溢出。
- Console 不得出现阻断主流程的 404/500 或未捕获异常。
- 点击可见按钮必须有合理反馈：跳转、弹窗、toast、mock 数据、禁用说明之一。
- 桌面和移动端都必须能完成核心路径：登录、打开画布、打开模板、生成 mock 图片、查看历史、进入后台。

## 当前已知通过项

- `/`、`/login`、`/register`、`/canvas`、`/template-image`、`/user/center`、后台主要页面可打开。
- 已归档 10 个重点路由的桌面 `1440x900` 和移动 `390x844` 截图。
- 模板工作区有可用文字/图片模型线路，反推和生成按钮不再被线路错误拦截。
- 图片历史可以同步后端生成记录。
- 后台 API 线路管理显示 `共 6 条`。
- 后台任务监控显示本地生成记录。

## 验证命令

```powershell
$OutputEncoding = [console]::InputEncoding = [console]::OutputEncoding = [System.Text.UTF8Encoding]::new()
node --check "C:\Users\pc\Desktop\hjm-mb-clone\server.js"
Invoke-RestMethod -Method Get -Uri "http://localhost:3456/api/template/settings"
```
