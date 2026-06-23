# 哈吉米AI 本地克隆 (hjm-mb.com)

> Clone of www.hjm-mb.com — AI电商图片生成平台
> 提取日期: 2026-06-22 | 目标: 本地完整运行 + 复刻

## 项目现状

### 已完成
| 模块 | 状态 | 详情 |
|------|:---:|------|
| 前端 | OK | 47文件, 1.7MB JS+CSS, Vue3 SPA 完整还原 |
| 后端 | OK | Express + SQLite, 42 API端点, JWT认证 |
| 画布 | OK | Canvas-yGc8b2gf.js 722KB, 节点编辑器完整 |
| 模板 | OK | 10个电商模板, template-data.json |
| 数据库 | OK | SQLite: users/projects/generations/balance_logs |
| 登录 | OK | admin/admin123, 注册送50算力 |

### 待配置
| 项目 | 状态 | 位置 |
|------|:---:|------|
| 中转站Key | 未填 | .env 文件 |
| 邮件发送 | 控制台 | 验证码打印到Node console |

### 已知问题
1. 未登录时画布401 — 正常,登录后OK
2. 新画布0节点 — 正常,需手动"新增节点"
3. 生图返回占位图 — 未配中转站Key时用placehold.co
4. Google Fonts外链 — 字体从fonts.googleapis.com加载

## 架构

```
前端: Vue 3 + Rolldown/Vite + Vue Flow + Naive UI
后端: Express (Node.js) + better-sqlite3
认证: JWT HS256 (7天过期)
生图: OpenAI兼容中转站API
```

## 文件结构

```
hjm-mb-clone/
├── index.html              # SPA入口 (已改本地路径)
├── server.js               # 后端 (21KB, 全部42端点)
├── template-data.json      # 10个模板配置 (10KB)
├── package.json            # 依赖: express, better-sqlite3, multer, jsonwebtoken, node-fetch
├── .env                    # 需填写API Key
├── data.db                 # SQLite (自动生成)
├── assets/                 # 47个前端文件 (JS+CSS+图片)
├── videos/                 # home-background.mp4 (3MB)
├── public/                 # logo.png
└── uploads/                # 用户上传目录
```

## API端点

### 公开 (无需登录)
```
GET  /api/public/routes             -> 5条图像路线
GET  /api/public/models?routeId=X   -> 路线下的模型列表
GET  /api/model-routes?group=text   -> 文本/图像/视频路线
GET  /api/template/settings         -> 10个模板+平台+比例配置
GET  /api/settings/canvas-storage   -> 画布设置
POST /api/auth/send-email-code      -> 发送验证码 (console.log)
POST /api/auth/send-reset-code      -> 发送重置码
POST /api/auth/register             -> 注册 (需验证码)
POST /api/auth/login                -> 登录 (username+password)
POST /api/auth/reset-password       -> 重置密码
```

### 用户 (需JWT)
```
GET  /api/user/profile              -> 用户信息
GET  /api/user/routes               -> 可用路线
GET  /api/user/models?routeId=X     -> 路线模型
GET  /api/user/api-status           -> API状态+模型
GET  /api/user/balance-logs         -> 余额记录
GET  /api/user/projects             -> 画布项目列表
POST /api/user/projects             -> 创建项目
GET  /api/user/projects/:id         -> 获取项目
PUT  /api/user/projects/:id         -> 更新项目 (name+data)
DEL  /api/user/projects/:id         -> 删除项目
POST /api/user/redeem               -> 兑换码
POST /api/user/avatar/upload        -> 上传头像 (multipart)
GET  /api/user/generations          -> 生成历史
```

### AI生成 (需JWT)
```
POST /api/generation/estimate-cost  -> 估费
POST /api/template/generate-image   -> AI生图 (对接中转站)
POST /api/template/reverse-prompt   -> 图片反推提示词
POST /api/chat/completions          -> Chat对话 (OpenAI格式)
```

### 管理 (需admin角色)
```
GET  /api/admin/users               -> 用户列表
GET  /api/admin/dashboard           -> 统计数据
```

## 数据库表

```
users       (id, username, email, password_hash, role, balance, avatar_url, status, created_at)
email_codes (email, code, type, expires_at, created_at)
balance_logs(id, user_id, type, change_amount, before_balance, after_balance, remark, created_at)
projects    (id, user_id, name, data JSON, created_at, updated_at)
generations (id, user_id, model_key, prompt, result_url, cost, status, created_at)
redeem_codes(code PRIMARY KEY, amount, max_uses, used_count, enabled)
```

## 模型 (5图像路线 + 1文本路线)

```
6789(默认):      GPT Image 2(10pt), Flatfee(3.5pt), VIP(5pt), Nano Banana 2(15pt), Pro(16pt), Gemini 3 Pro(20pt)
comfly-google:    Gemini 3.1 Flash(10pt), Nano Banana Pro(20pt), Gemini 3 Pro(20pt), 2.5 Flash(8pt)
comfly-openai+:   GPT Image 2 All(4pt), GPT Image 2(4pt), GPT-4o Image(15pt), GPT-4 All(15pt), GPT-4o All(15pt)
RK:               GPT Image 2(5pt)
哈吉米:            GPT Image-2(6pt), GPT Image 2 Pro(10pt)
flowstudio(text): GPT 5.5(5pt)
```

## 10个电商模板

main-image(主图), baiditu(白底图), sub-image-replica(副图), detail-page(详情页),
scene(场景图), model(模特图), packaging(包装图), poster(海报), xiaohongshu(小红书), custom(自定义)

## 启动

```bash
cd C:\Users\pc\Desktop\hjm-mb-clone
npm install   # 已完成
npm start     # http://localhost:3456
# 管理员: admin / admin123
```

## 待办

P0:
- 填好.env的API Key后测试真实生图
- 本地化Google Fonts

P1:
- 真实邮件发送
- 支付/充值系统
- 视频生成模型对接

P2:
- 安全响应头(CSP/HSTS)
- 登录速率限制
