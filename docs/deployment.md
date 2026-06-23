# 部署与维护说明

## 当前定位

本项目当前是打包后的 Vue 前端资产 + Express/SQLite 本地后端。默认运行在 mock 模式，真实 AI、邮件、支付、云存储都必须显式开启。

## 本地启动

```powershell
$OutputEncoding = [console]::InputEncoding = [console]::OutputEncoding = [System.Text.UTF8Encoding]::new()
Copy-Item ".env.example" ".env"
npm install
npm start
```

默认地址：

- 前台：`http://127.0.0.1:3456/`
- 后台：`http://127.0.0.1:3456/admin/login`
- 管理员：`admin / admin123`

## 环境变量

| 字段 | 默认 | 说明 |
| --- | --- | --- |
| `PORT` | `3456` | 本地服务端口 |
| `JWT_SECRET` | 本地开发默认值 | 生产环境必须改成长随机值 |
| `ENABLE_REAL_AI` | `false` | 是否启用真实 AI 调用 |
| `ENABLE_REAL_EMAIL` | `false` | 是否启用真实邮件 |
| `ENABLE_REAL_PAYMENT` | `false` | 是否启用真实支付 |
| `ENABLE_REAL_STORAGE` | `false` | 是否启用真实云存储 |
| `AI_API_BASE` | provider 占位地址 | OpenAI-compatible 服务地址 |
| `AI_IMAGE_KEY` | 占位值 | 生图 key，不允许提交到 Git |
| `AI_TEXT_KEY` | 占位值 | 文本 key，不允许提交到 Git |
| `AI_IMAGE_MODEL` | `gpt-image-2` | 生图模型名 |
| `AI_TEXT_MODEL` | `gpt-5.5` | 文本模型名 |

## 健康检查

```powershell
Invoke-RestMethod -Method Get -Uri "http://127.0.0.1:3456/api/health"
```

健康检查应返回服务状态、数据库状态、mock/real provider 开关和关键表数量。

## SQLite 备份与恢复

备份前建议先停止服务，或至少同时保留 WAL 文件。

```powershell
Copy-Item "data.db" "backup\data.db"
Copy-Item "data.db-wal" "backup\data.db-wal" -ErrorAction SilentlyContinue
Copy-Item "data.db-shm" "backup\data.db-shm" -ErrorAction SilentlyContinue
```

恢复时停止服务后覆盖同名文件，再启动服务。

## PM2 部署参考

```powershell
npm install -g pm2
pm2 start server.js --name dianshang
pm2 save
```

## Nginx 反代参考

```nginx
server {
  listen 80;
  server_name example.com;

  location / {
    proxy_pass http://127.0.0.1:3456;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

## 入库规则

- 提交源码、构建前端资产、文档、模板数据。
- 不提交 `.env`、`node_modules/`、`data.db*`、`uploads/`、日志和临时文件。
- 真实 key 只放本机 `.env` 或后续后台安全配置。

## 后续维护顺序

1. 稳定前端 1:1 验收。
2. 将后台设置、API 线路、模型价格、模板工作流持久化到 SQLite。
3. 拆分 `server.js` 为 Auth/User/Projects/Generation/Template/Admin/Provider/DB 模块。
4. 增加自动化接口冒烟测试。
5. 通过 Provider Adapter 接真实 AI 服务。
