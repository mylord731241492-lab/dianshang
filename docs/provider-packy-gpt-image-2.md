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
  "background": "auto",
  "output_format": "png",
  "moderation": "auto",
  "response_format": "url",
  "n": 1
}
```

## 图生图 / 图片编辑字段

```text
model=gpt-image-2
prompt=string
image=@/path/to/image.jpg
image=@/path/to/second-image.jpg  # 可选，多参考图时重复 image 字段，不使用 image[]
mask=@/path/to/mask.png      # 可选，局部修改时使用
size=1024x1024
quality=auto
background=auto
output_format=png
moderation=auto
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
- 本项目 UI 的 `1K / 2K / 4K` 同时作为图片大小档位和质量档位输入，后端统一换算为 Packy `size` 与 `quality`。

## 本项目映射

- UI `张数`：映射到内部请求次数。Packy `n` 固定传 `1`，多张图由后端循环调用。
- UI `图片大小`：`1K / 2K / 4K` 映射为目标长边档位：
  - `1K` -> 目标长边约 `1024`
  - `2K` -> 目标长边约 `2048`
  - `4K` -> 目标长边约 `3840`
- UI `清晰度` 对 Packy `quality` 的映射：
  - `1K` -> `low`
  - `2K` -> `medium`
  - `4K` -> `high`
- UI `比例`：只作为宽高比例输入，后端必须自动换算为符合 Packy 限制的 `size=宽x高`。
- 后端换算后仍需保证宽高为 `16` 的倍数、最大边不超过 `3840`、总像素数在合法范围内、长短边比例不超过 `3:1`。
- UI 没有单独质量控件时，`quality` 由 `1K / 2K / 4K` 清晰度档位派生；只有明确选择自动质量时才传 `auto`。
- 图片编辑 / 图生图默认传 `input_fidelity=high`，尽量保留参考图主体、包装结构和细节；只有明确需要弱化原图约束时才允许改为 `low`。
- 文生图和图生图统一传 `background=auto`、`moderation=auto`。
- 多参考图上传时统一重复追加 multipart 字段 `image`，不使用 `image[]`。

## 本项目统一接入覆盖

- 所有 `gpt-image-2` 文生图请求必须走 `callProviderImageGeneration`，由该适配器统一写入 `size`、`quality`、`background=auto`、`output_format`、`moderation=auto`、`response_format=url` 和 `n=1`。
- 所有 `gpt-image-2` 图生图 / 图片编辑请求必须走 `callProviderImageEdit`，由该适配器统一写入 multipart 图片、mask、`size`、`quality`、`background=auto`、`output_format`、`moderation=auto`、`response_format=url`、`n=1` 和 `input_fidelity=high`。
- 当前已纳入统一适配器的入口：
  - Canvas Chat 对话 Agent：`/api/canvas/dialog-agent-generate`
  - 快速生图任务：`/api/generate/tasks`
  - 模板生图：`/api/template/generate-image`
  - 图片工具：局部修改、智能消除、文字编辑、扩图
  - 后台 API Provider 图片线路测试
- 禁止在新入口里直接 `fetch` Packy `/v1/images/generations` 或 `/v1/images/edits`；新增 GPT Image 2 入口时必须同时更新 `scripts/check-packy-gpt-image-adapter-coverage.js`。

## 旧画布比例菜单换算表

| UI 比例 | 1K size | 2K size | 4K size |
| --- | --- | --- | --- |
| 1:1 | `1024x1024` | `2048x2048` | `2880x2880` |
| 2:3 | `688x1024` | `1360x2048` | `2352x3520` |
| 3:2 | `1024x688` | `2048x1360` | `3520x2352` |
| 3:4 | `768x1024` | `1536x2048` | `2496x3312` |
| 4:3 | `1024x768` | `2048x1536` | `3312x2496` |
| 4:5 | `816x1024` | `1632x2048` | `2576x3216` |
| 5:4 | `1024x816` | `2048x1632` | `3216x2576` |
| 9:16 | `624x1072` | `1152x2048` | `2160x3840` |
| 16:9 | `1072x624` | `2048x1152` | `3840x2160` |
| 1:2 | `576x1152` | `1024x2048` | `1920x3840` |
| 2:1 | `1152x576` | `2048x1024` | `3840x1920` |
| 9:21 | `544x1232` | `880x2048` | `1648x3840` |
| 21:9 | `1232x544` | `2048x880` | `3840x1648` |

说明：`1K` 在极宽或极高比例下会因 Packy 最小总像素限制略大于 1024 长边；`4K + 1:1` 会因总像素上限降到 `2880x2880`，不能传 `3840x3840`。

## 不支持或不建议

- `stream` 不支持。
- `partial_images` 不支持。
- `style` 不建议用于 `gpt-image-2`。
- `background=transparent` 不支持；需要背景参数时优先使用默认值或 `opaque`。
