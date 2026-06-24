# 审查与复核记录

## 审查规则

每轮完成后记录：

- 已验证的命令和页面。
- 新发现的风险。
- 未覆盖的测试。
- 需要人工确认的事项。
- 下一轮优先级。

## 2026-06-24

### 已审查结论

- 当前项目仍是 Express 一体服务：静态前端资产 + `/api/*` + SQLite。
- 7 月前内网部署不建议一步到位引入 Postgres、Redis、BullMQ、Worker。
- New-API/CPA 应作为外部基础设施复用，本项目只保留 Provider Adapter 和业务层记录。
- Docker 轻量版应持久化 SQLite、uploads、logs，避免容器重建丢数据。

### 风险

- 当前前端是打包资产，复杂 1:1 修复会受限。
- SQLite 适合内网小范围，后续多人高并发或计费上线前需迁移 Postgres。
- 真实 AI、邮件、支付、对象存储尚未接入，不能按生产功能对外承诺。
- New-API/CPA 账号池涉及合规、额度和安全风险，需要部署方确认。
- 本机未检测到 `docker` 命令，本轮只能验证 Compose 文件已生成，不能完成容器实跑。

### 待人工确认

- 内网部署方式：Windows 服务器、Linux 服务器还是公司内网机器。
- 是否有统一域名和 Nginx/HTTPS 要求。
- New-API/CPA 是否已部署，或是否需要后续单独编排。
- 前端 1:1 的页面截图基准和验收优先级。

## 2026-06-24 后台接口 smoke 扩展

### 已验证

- 临时端口 `4568` 使用独立 SQLite 数据库启动成功。
- 扩展后的 `scripts/smoke-api.ps1` 覆盖后台 users、orders、usage logs、redeem codes、generate tasks、template workflows、settings 和 public routes。
- 兑换码新增、模板工作流 PUT、settings PATCH 均返回 `success: true`。

### 未覆盖

- 用户删除/恢复/永久匿名化等破坏性后台操作。
- 订单状态变更、任务取消/删除等需要更细测试数据的写接口。
- 前端后台页面的可视化和交互验收。
