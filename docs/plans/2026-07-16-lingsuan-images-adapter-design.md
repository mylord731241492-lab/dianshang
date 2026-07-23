# Lingsuan Images 独立适配规则设计

## 目标

把已通过真实 4K 对照验证的 Lingsuan 官方 OpenAI Images 请求格式固化为可在后台选择的独立 `apiFormat`，以后新增或编辑线路时只需选择 `Lingsuan Images` 并填写 Base URL、API Key 和模型。

## 边界

- 规则标识固定为 `lingsuan-images`，不根据 Host 推断。
- 不修改 Packy、通用 OpenAI Images、注册或兑换码逻辑。
- 不新增重试，不在测试中调用真实 Provider。

## 请求契约

- 文生图：`POST /v1/images/generations`，JSON 仅包含 `model/prompt/size/quality/output_format/n`。
- 图生图：`POST /v1/images/edits`，multipart 仅包含 `model/image[]/prompt/size/quality/output_format/n`；有真实 mask 时追加 `mask`。
- 禁止发送 `stream/partial_images/response_format/input_fidelity/ratio/background/moderation`。
- 响应固定按普通 JSON `data[].b64_json` 解析，随后复用现有图片校验与服务器落盘逻辑。

## 后台行为

- 接口格式下拉增加 `Lingsuan Images`。
- 选择后锁定 `/v1/images/generations`、`/v1/images/edits`、非流式和 Base64 返回。
- 前端保存和后端新增/编辑/批量保存都执行规范化，避免矛盾字段进入线路状态。

## 验收

- 假 Provider 抓包验证 4K 方图为 `2880x2880 + high`，图生图字段名为 `image[]`，扩展字段不存在。
- 普通 JSON Base64 能落盘为本地短 URL。
- Packy 继续 URL 非流式。
- 通过后端语法、54 组尺寸、适配器覆盖、图片工具动态回归、API smoke、画布边界、Vue build 和后台 UI 保存回读。
- 生产完成标准另含 Docker 完整重建、容器 healthy、镜像信息、生产线路保存回读和 3456 直连验证。
