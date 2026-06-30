# Packy GPT Image 2 技术档案

> 来源：https://docs.packyapi.com/docs/paint/GPTImage.html  
> 记录日期：2026-06-30  
> 本档用于本地后端和旧画布调用 `gpt-image-2` 时查参数，不替代线上文档最终解释。

## 模型与接口

- 模型固定为 `gpt-image-2`。
- 文生图使用 `POST /v1/images/generations`，请求体为 `application/json`。
- 图生图 / 图片编辑使用 `POST /v1/images/edits`，请求体为 `multipart/form-data`。
- Chat Completions 不是 `gpt-image-2` 出图入口，`size`、`quality`、`output_format` 等 Images 参数不会按图片接口生效。

## 文生图字段

```json
{
  "model": "gpt-image-2",
  "prompt": "string",
  "size": "1024x1024",
  "quality": "auto",
  "output_format": "png",
  "response_format": "url",
  "n": 1
}
```

## 图生图 / 图片编辑字段

```text
model=gpt-image-2
prompt=string
image=@/path/to/image.jpg
mask=@/path/to/mask.png      # 可选，局部修改时使用
size=1024x1024
quality=auto
output_format=png
response_format=url
n=1
input_fidelity=high          # 可选，图片编辑时尽量保留原图主体和细节
```

## 尺寸规则

- `size` 可传 `auto` 或合法尺寸字符串，例如 `1024x1024`、`3840x2160`、`2160x3840`。
- 最大边长必须小于或等于 `3840` 像素。
- 宽和高都必须是 `16` 的倍数。
- 长边与短边比例不能超过 `3:1`。
- 总像素数必须不少于 `655360`，且不超过 `8294400`。

## 质量规则

- `quality` 可选：`low`、`medium`、`high`、`auto`。
- 不确定时使用 `auto`。
- `quality` 不是图片大小档位；本项目 UI 的 `1K / 2K / 4K` 应按图片大小档位处理。

## 本项目映射

- UI `张数`：映射到内部请求次数。Packy `n` 固定传 `1`，多张图由后端循环调用。
- UI `图片大小`：`1K / 2K / 4K` 映射为目标长边档位：
  - `1K` -> 目标长边约 `1024`
  - `2K` -> 目标长边约 `2048`
  - `4K` -> 目标长边约 `3840`
- UI `比例`：只作为宽高比例输入，后端必须自动换算为符合 Packy 限制的 `size=宽x高`。
- 后端换算后仍需保证宽高为 `16` 的倍数、最大边不超过 `3840`、总像素数在合法范围内、长短边比例不超过 `3:1`。
- UI 没有单独质量控件时，`quality` 传 `auto`。

## 常见换算预期

| UI 大小 | UI 比例 | Packy size 预期 |
| --- | --- | --- |
| 1K | 1:1 | `1024x1024` |
| 1K | 16:9 | 约 `1088x608`，因最小总像素限制会略大于 1024 长边 |
| 2K | 1:1 | `2048x2048` |
| 2K | 3:4 | `1536x2048` |
| 4K | 16:9 | `3840x2160` |
| 4K | 9:16 | `2160x3840` |
| 4K | 1:1 | 约 `2880x2880`，因总像素上限不能传 `3840x3840` |

## 不支持或不建议

- `stream` 不支持。
- `partial_images` 不支持。
- `style` 不建议用于 `gpt-image-2`。
- `background=transparent` 不支持；需要背景参数时优先使用默认值或 `opaque`。

