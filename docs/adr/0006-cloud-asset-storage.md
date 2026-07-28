# ADR-0006：账号隔离云端资产库存储方案

## 状态

Accepted（2026-07-27 用户拍板，真实云存储暂缓）

## 背景

ADR-0005 重新打开了旧基线"不启用 S3/MinIO"的决定，要求画布资产从服务器本地 `uploads` 演进为后端管理的云对象存储，但厂商、Endpoint、Region、Bucket、费用和备份策略必须经用户确认。计划 Task 6 原步骤要求先确认云存储方案再安装 SDK。

2026-07-27 用户明确拍板：

- **真实云存储暂缓**：不安装任何对象存储 SDK（`@aws-sdk/*` 等未批准），不接 MinIO 或外部厂商。本阶段只实现 Fake Storage 与完整契约。
- `ENABLE_REAL_STORAGE=true` 且没有可用的真实存储实现时，资产写接口必须返回 `503 ASSET_STORAGE_UNAVAILABLE`，不得静默回退服务器本地 `uploads` 并假装云端成功。
- 文件限制：图片单文件 ≤ 20MB，仅 PNG/JPEG/WebP；视频/音频单文件 ≤ 50MB，仅 MP4/WebM/MP3/WAV/M4A。后端必须校验真实文件头（magic bytes），拒绝 SVG 和伪造 MIME。
- Bucket 语义为私有；签名读取 URL 有效期 15 分钟，过期必须重新经后端签发。
- 删除 = 软删除，不立即物理删除仍可能被项目引用的对象。

## 决策

- **职责拆分**：对象存储只保存文件字节；账号归属、名称、标签、MIME、尺寸、SHA-256、来源和状态保存在 SQLite `user_assets` 表。所有 `user_assets` 查询强制带 `user_id = 当前登录用户`，跨用户访问一律返回 404，不泄漏资产存在性。
- **统一 `ObjectStorage` 接口**：`putObject / createSignedReadUrl / headObject`。Fake Storage（本地测试目录文件型）与将来的 S3 兼容实现实现同一接口；浏览器对两者的体验完全一致。Fake Storage 只用于候选自动化与本地开发，不得作为真实云存储验收结果。
- **真实驱动暂不实现**：当前没有获批准的 SDK，因此 `ENABLE_REAL_STORAGE=true` 时资产写接口一律返回 `503 ASSET_STORAGE_UNAVAILABLE`（无论是否填写 `OBJECT_STORAGE_*` 占位配置），绝不回退服务器本地目录。待用户确认厂商与 SDK 后再补充真实驱动。
- **对象键规范**：`users/<userId>/assets/<assetId>/<safe-file-name>`。`safe-file-name` 由服务端生成（随机名 + 白名单扩展名），不使用用户原始文件名直接拼接，不允许 `..`、反斜杠或绝对路径。
- **私有 Bucket 与签名读取 URL**：浏览器不持有任何对象存储密钥，也不直连对象存储。浏览器通过 `GET /api/user/assets/:id/access-url`（需登录、校验归属）获得 15 分钟短时效读取 URL。URL 形态为 `/api/asset-content/:assetId?expires=<unix>&sig=<hmac>`，后端校验 HMAC 签名、过期时间和资产状态后从 `ObjectStorage` 读回内容；将来 S3 实现可在同一接口下换成 presigned URL，前端无感知。`ASSET_URL_SIGNING_SECRET` 可单独配置，缺省由 `JWT_SECRET` 派生，密钥不出现在任何响应中。
- **magic bytes 校验**：后端按文件头识别真实类型（PNG/JPEG/WebP/MP4/WebM/MP3/WAV/M4A），声明 MIME 与识别结果不一致、SVG、或可执行文件伪装图片一律拒绝；图片超过 20MB、视频/音频超过 50MB 返回 `413 ASSET_FILE_TOO_LARGE`。不引入 `file-type` 等新依赖，校验逻辑在 `backend/assets/` 内手写。
- **软删除**：`DELETE /api/user/assets/:id` 只设置 `deleted_at` 与 `status='deleted'`，列表、详情、签发和内容读取立即失效；云对象不立即物理删除，因为项目 JSON 仍可能引用 `assetId`。物理回收由后续独立的回收策略任务决定。
- **生成历史 ≠ 资产库**：`generations` 记录只有用户显式"保存到资产库"时才经 `POST /api/user/assets/import-generation` 复制为当前账号资产（source=`generation`），不自动归档。
- **旧 `/uploads/*` 兼容**：历史项目和生成记录引用的本地 `uploads` 文件继续可读，本任务不删除、不迁移；import-generation 会把被导入的本地文件复制进对象存储，原文件保留。
- **项目 JSON 只保存 `assetId`**：节点元数据通过 `storageKey = "asset:<assetId>"` 携带资产引用与展示元数据（尺寸、MIME、字节数）；`blob:`、`data:*`、永久 URL 和存储凭据不得进入项目 JSON。
- **浏览器 IndexedDB 降级为瞬态缓存**：账号资产的事实源是 `/api/user/assets*`；IndexedDB 只允许保留按用户隔离的瞬态缓存（如导入暂存），退出登录或 401 时清空。

## 后果

- 候选环境可以在没有真实云厂商的情况下完成账号隔离、上传校验、签名读取、软删除和分页的完整自动化验收（`scripts/test-user-cloud-assets.js`、`scripts/smoke-cloud-storage-adapter.ps1`）。
- 切换真实云存储时只需要在 `backend/assets/` 增加新的 `ObjectStorage` 实现并打开 `ENABLE_REAL_STORAGE`，API 契约、前端和 `user_assets` 表结构不变。
- Fake Storage 的磁盘占用随测试增长，生产部署不得依赖它；部署文档已标明该限制。

## 参考

- `docs/plans/2026-07-27-infinite-canvas-staged-replacement.md`（Task 6）
- `docs/adr/0005-infinite-canvas-atomic-replacement.md`
- `docs/backend-module-boundaries.md`
- `scripts/test-user-cloud-assets.js`
