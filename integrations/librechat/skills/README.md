# Skills 模板

本目录保存内网审核过的 `SKILL.md` 上传模板，不包含脚本执行权限或外部密钥。

- 管理员：在 LibreChat 的 Skills 页面上传模板，审核后可按角色权限共享或公开。
- 普通用户：可创建和使用自己的私有 Skills，默认没有共享或公开权限。
- 内网管理员审核并公开的共享 Skill 默认激活，确保普通用户能在 Chat 首页直接选择；配置项为 `defaultActiveOnShare: true`。用户仍可在 Skills 页面手动停用。
- 第一版不启用外部 GitHub Skill Sync，也不允许用户安装外部 MCP。

`ecommerce-image/SKILL.md` 只允许引导主站的生图报价与确认工具。修改后应重新上传或在 Skills 页面更新，不能假设文件挂载会自动覆盖数据库内容。

当前审核模板还包含：

- `image-reverse-describe`：单图中立、可逆、可重建的结构化反推。
- `image-deep-read`：在描述事实之上推断意图、传播功能、质量与风险。
- `style-grammar-distill`：聚合同一作者多份报告，提炼带覆盖度和置信度的风格语法。

三项图片分析 Skill 通过 `scripts/sync-librechat-reviewed-skills.js` 同步到 LibreChat，并以 `skill_viewer` 公开共享。目录文件是可恢复源码，生产实际状态仍以 MongoDB 中的 Skill 和 ACL 为准。
