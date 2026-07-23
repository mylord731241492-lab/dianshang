# Packy Images 独立适配设计

## 背景

当前 PackyAPI 的 `image` 分组能够识别 `gpt-image-2`，但该分组会拒绝通用 OpenAI Images 请求中的 `response_format`。现有 Packy 路线仍使用 `openai-images` 通用格式，因此文生图会收到 `Unknown parameter: 'response_format'`，图生图也可能携带该分组不支持的扩展字段。

Lingsuan 已经使用独立的 `lingsuan-images` 格式。Packy 不能复用该格式，因为二者的图生图文件字段不同：Lingsuan 使用 `image[]`，Packy 使用单数 `image`。

## 目标

- 新增后台可选的 `packy-images` 请求格式，不按域名或线路 ID 硬编码。
- Packy 文生图和图生图只发送已确认的字段白名单。
- 兼容 Packy 返回 URL 或 Base64，不要求上游接收 `response_format`。
- 保持 `lingsuan-images` 和通用 `openai-images` 的既有行为互不影响。
- 生产数据库中的现有 Packy 路线由后台配置切换到 `packy-images`，后续可以自行切换格式。

## 请求契约

### 文生图

- 端点：`POST /v1/images/generations`
- 内容类型：`application/json`
- 允许字段：`model`、`prompt`、`size`、`quality`、`output_format`、`n`

### 图生图 / 局部重绘

- 端点：`POST /v1/images/edits`
- 内容类型：`multipart/form-data`
- 允许字段：`model`、`image`、`prompt`、`size`、`quality`、`output_format`、`n`
- 有遮罩时额外允许：`mask`
- Packy 使用单数 `image`，不使用 `image[]`。

### 明确禁止发送

`response_format`、`background`、`moderation`、`input_fidelity`、`stream`、`partial_images`、`ratio`。

## 响应处理

沿用统一图片响应解析器，同时接受：

- `data[].url`
- `data[].b64_json`
- 流式或非流式响应中已经支持的图片字段

`packy-images` 本身固定发送非流式请求；不通过请求字段强制 URL 或 Base64。后台保留 URL 作为展示元数据，但请求体中不写 `response_format`。

## 后台行为

- 接口格式新增 `Packy Images`。
- 选中后固定图像分类、生成端点、编辑端点、非流式和零局部预览。
- 请求预览明确展示 Packy 白名单，并注明返回 URL/Base64 自动识别。
- 保存时只改当前线路，不影响其他线路。

## 验收标准

- 回归测试证明 Packy 文生图 JSON 不包含所有禁用字段。
- 回归测试证明 Packy 图生图 multipart 使用 `image`，且不包含所有禁用字段。
- Lingsuan 仍使用 `image[]`、Base64、非流式格式。
- 通用 `openai-images` 仍保留原有扩展字段能力。
- 后端语法检查、专项回归、前端构建和 disposable smoke 全部通过。
- Docker 完整重建后容器健康，3456 返回新资源，Packy 路线实际配置为 `packy-images`。
- 不由自动化发起真实付费生图；最终真实请求由用户手动测试并观察日志。
