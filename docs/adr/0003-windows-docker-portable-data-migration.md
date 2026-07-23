# ADR-0003：Windows Docker 便携数据迁移包

## Status

Accepted

## Context

当前应用先在本机和小范围内网使用，后续整体迁移到 Windows Server + Docker Compose。主站持久化状态不是单一数据库文件：

- SQLite 保存用户、余额、项目、生成记录、系统配置及图片 URL/元数据。
- `docker/data/workflows` 保存工作流文件。
- `docker/uploads` 保存用户上传和服务端落盘的生成图片。
- `docker/logs` 保存运行日志。
- `docker/.env` 保存 JWT、密码迁移和 Provider 等真实密钥。

只复制 SQLite 会丢图片和工作流；只复制目录又无法证明数据库一致性，也容易在目标服务器误覆盖已有数据。当前规模不需要为了迁移提前引入 Postgres、MinIO/S3、Redis 或额外备份软件。

## Decision

继续使用 SQLite 和 Docker bind mount，新增格式版本为 2 的 Windows Docker 数据迁移包：

```text
internal-prod-YYYYMMDD-HHMMSS/
├─ manifest.json
├─ database/data.db
└─ archives/
   ├─ data.zip
   ├─ uploads.zip
   └─ logs.zip
```

决策约束：

1. 备份目标固定为本机 `docker/backup/internal-prod-YYYYMMDD-HHMMSS`，不配置云盘、NAS、S3/MinIO 或自动异地同步；实际迁移服务器时再人工复制选定的数据包。
2. 备份必须由 `-ConfirmMaintenanceWindow` 显式确认，并在同一个短维护窗口内停止应用、备份 SQLite、归档工作流/图片/日志，然后恢复原容器状态。
3. `manifest.json` 只记录相对路径；每个制品记录字节数和 SHA-256，数据库同时执行 `quick_check` 与 `integrity_check`。
4. 真实 `docker/.env` 不进入数据包，避免密钥随备份扩散；清单只记录其 SHA-256，源文件通过单独的安全/离线渠道复制。
5. 源代码目录与数据包分开复制。目标服务器应先放好同版本源码和 `docker/.env`，再恢复数据。
6. 恢复脚本默认拒绝非空的 `data/uploads/logs`，不提供覆盖模式；包完整性、`.env` 指纹、ZIP 路径和 SQLite 完整性任一失败都停止恢复。
7. 恢复默认只落盘，不自动启动或调用 Provider；只有显式传入 `-StartApp` 才执行 Docker Compose 构建和健康等待。
8. 目标服务器有宿主机 Node.js 时直接执行校验；没有时复用或构建应用 Docker 镜像执行同一校验，不额外要求安装 Node.js。
9. 当前可选 Chat profile 的 MongoDB、LibreChat uploads/images/logs 是 Docker 命名卷，不属于主站数据包。只有正式启用并产生需保留的 Chat 数据后，另行建立命名卷迁移步骤。

## Non-functional requirements

| 目标 | 当前门禁 |
| --- | --- |
| 数据一致性 | SQLite、工作流、图片和日志在同一停机窗口内采集。 |
| 完整性 | 每个制品校验字节数和 SHA-256；SQLite 执行两项 PRAGMA 校验。 |
| 误操作保护 | 无确认参数拒绝；目标非空拒绝；没有覆盖恢复。 |
| 密钥保护 | `.env` 不进入迁移包，仅保留指纹。 |
| 可移植性 | 清单无本机绝对路径；目标固定为 Windows + Docker Compose。 |
| 可验证性 | 临时目录演练覆盖数据库、工作流、图片、日志、重复恢复和篡改拒绝。 |
| RPO | 取决于本机 `docker/backup` 中最近一次人工维护窗口备份；当前无自动持续或异地备份。 |
| RTO | 小规模数据目标为一次复制、恢复、构建和 smoke 的维护时长。 |

## Failure and recovery

- 备份阶段任一步骤失败，脚本仍在 `finally` 中尝试恢复原本正在运行的容器；未生成有效清单的数据目录不能作为迁移包使用。
- 数据包传输后先运行清单校验，任何字节数或 SHA-256 不一致都视为传输损坏。
- 恢复只对空目录执行。若落盘中途失败，目标目录会变为非空，必须人工检查并清空该次失败目标后重新开始，不能加覆盖参数绕过。
- Docker 启动失败不回滚已经恢复的数据；修正 `.env` 或服务器配置后直接重新启动，不能再次执行覆盖恢复。
- 服务器地址变化时，先使用原 `.env` 完成指纹校验和恢复；随后只修改 `HOST_PORT`、`CORS_ORIGINS` 等网络字段。若恢复前已改动，必须显式允许指纹变化并人工确认 `JWT_SECRET` 等密钥未丢失。

## Consequences

### Positive

- 保持现有轻量架构，不增加数据库、对象存储或运维依赖。
- 数据库记录与实际图片/工作流一起迁移，避免只迁 SQLite 后出现资源丢失。
- 可以在本机反复做无 Docker、无 Provider、无生产数据改动的恢复演练。

### Negative

- 备份需要短暂停机，数据越多维护窗口越长。
- SQLite 仍不支持多实例写入；未来扩展到公网、高并发或多节点时仍需迁移数据库和对象存储。
- `.env` 需要单独安全保管；丢失原密钥可能影响 JWT、历史密码迁移和 Provider 配置。

## Alternatives considered

**现在迁移到 Postgres + MinIO/S3**

暂不采用。能改善多实例和对象存储能力，但会扩大本轮范围，需要新增服务、依赖、数据迁移和更长验收周期，不符合当前小范围内网目标。

**停机后直接复制整个 `docker` 目录**

暂不采用。操作简单，但没有数据库完整性、制品哈希、相对路径清单和空目标恢复门禁。

**只备份 SQLite**

拒绝。图片、工作流和日志是独立文件，数据库中的 URL/元数据无法替代真实文件。

## References

- `scripts/backup-internal-prod.ps1`
- `scripts/portable-migration-manifest.js`
- `scripts/restore-internal-prod-windows.ps1`
- `scripts/test-windows-server-migration.ps1`
- `docs/internal-production-runbook.md`
