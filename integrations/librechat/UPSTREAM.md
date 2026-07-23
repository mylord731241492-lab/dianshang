# LibreChat 上游说明

- 项目：https://github.com/danny-avila/LibreChat
- Skills 文档：https://www.librechat.ai/docs/features/skills
- 版本：`v0.8.6-rc1`
- 提交：`947bfa4c40e6b8c84346d23c1678cd83071c5179`
- 许可证：MIT
- 固定归档：`integrations/librechat/upstream/LibreChat-0.8.6-rc1.tar.gz`
- 归档 SHA-256：`ccc1adcbe0e7ab62839c2ab952bb2b3d6d7371eab8aaa13d84fbce4c629fb5ad`

Docker 构建只读取项目内固定归档，先校验 SHA-256，再应用 `patches/` 中的局部补丁。源码发布包会携带该 7 MB 归档，服务器不需要额外配置本机缓存目录或在线克隆上游仓库。
补丁只负责主站一次性 SSO 和“返回首页”入口；子目录部署使用 LibreChat 原生 `DOMAIN_CLIENT` 支持。

选择该固定 RC 是因为 LibreChat 的原生 Agent Skills（`SKILL.md`、私有创建和分享权限）从此版本加入；`v0.8.3` 不包含 Skills。管理员和普通用户通过 LibreChat 的 Skills 页面创建或上传，公共分享继续由角色权限控制。
