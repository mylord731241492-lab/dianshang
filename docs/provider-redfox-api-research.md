# RedFoxHub API 调研与本项目适用性

> 调研日期：2026-07-22
> 调研范围：仅使用 RedFoxHub 官网、官网动态 API 文档、官方服务条款/隐私政策及官方 GitHub SDK；未注册账号、未充值、未调用付费接口。公开内容会变化，接入前应重新核对。

## 结论

RedFoxHub 的核心定位是“新媒体数据 API + Agent Skills + 少量 AI 搜索/生成工具”，不是通用大模型网关。它最值得本项目关注的能力是抖音、小红书、公众号、B站、今日头条和 TikTok 的账号/作品查询，以及热点、竞品和内容研究；GPT 图片、豆包图片/视频可作为候选补充线路，但不能替代 New-API，也不能作为当前 Provider 配置即插即用。[官网首页](https://redfox.hk/) [API 目录](https://redfox.hk/apis) [官方 Python SDK](https://github.com/redfox-data/redfox-python-sdk)

RedFox API **不兼容 OpenAI API**：它使用 `REDFOX_API_KEY` 或 `X-API-KEY`，路径是自定义 `/story/api/*`，响应包为 `code/msg/data`；图片、视频和 AI 搜索采用“提交任务 → 轮询结果”的异步协议。当前项目图片/文本 Provider 使用 `Authorization: Bearer` 和 OpenAI/Packy/Lingsuan 协议，因此必须新增独立 RedFox 适配器或业务模块，不能只填 Base URL 和 Key。[API 文档](https://redfox.hk/apis) [GPT 图片提交](https://redfox.hk/apis/tool/HUV4KRFQ) [GPT 图片结果](https://redfox.hk/apis/tool/H9NINDBH) [官方 SDK 客户端](https://github.com/redfox-data/redfox-python-sdk/blob/main/redfox/client.py) [官方 GPT 图片模块](https://github.com/redfox-data/redfox-python-sdk/blob/main/redfox/endpoints/gpt_image.py)

建议定位为：

- **高价值、差异化能力**：为电商运营增加小红书/抖音/公众号/B站的竞品账号、爆款内容、互动数据、选题和趋势检索。[官方 SDK 能力表](https://github.com/redfox-data/redfox-python-sdk#支持的平台)
- **中等价值、需适配**：用 Kimi、豆包、DeepSeek AI 搜索辅助有来源的选题研究；它们不是通用 Chat Completions。[AI 搜索官方模块](https://github.com/redfox-data/redfox-python-sdk/blob/main/redfox/endpoints/ai_search.py)
- **候选备用能力**：GPT Image 2、Seedream 5.0、Seedance 2.0；先小规模验真，不应在未确认失败扣费、数据留存和限速前成为主线路。[GPT 图片目录](https://redfox.hk/story/web/api/doc/platform/tool-gpt-image/interfaces) [豆包图片目录](https://redfox.hk/story/web/api/doc/platform/tool-doubao-image/interfaces) [豆包视频目录](https://redfox.hk/story/web/api/doc/platform/tool-doubao-video/interfaces)

## 产品与能力

官方当前列出的在线数据平台包括抖音、小红书、公众号、B站、今日头条和 TikTok；微博、视频号、快手、百家号、百度、知乎标为“即将上线”。公开能力覆盖账号/作品搜索、详情、作品列表、AI 作品检索和短视频解析。[官方平台目录接口](https://redfox.hk/story/web/api/doc/platforms) [官方 SDK README](https://github.com/redfox-data/redfox-python-sdk)

AI 工具当前包括：

| 能力 | 公开模型/功能 | 调用形态 |
| --- | --- | --- |
| GPT 图片 | `gpt-image-2`；文生图、图生图/编辑，`n=1~10`，尺寸、质量、背景和输出格式 | 提交 + 免费轮询结果 |
| 豆包图片 | Seedream 5.0 Pro / Lite；文生图、最多 4 张参考图；Lite 支持最多 10 张组图 | 提交 + 免费轮询结果 |
| 豆包视频 | Seedance 2.0；文本/图片/视频/音频输入，480p/720p/1080p、4~15 秒、可生成音频 | 提交 + 免费轮询结果 |
| AI 搜索 | Kimi、豆包、DeepSeek 纯文字搜索 | 提交 + 免费轮询结果 |

来源：[GPT 图片文档](https://redfox.hk/apis/tool/HUV4KRFQ) [Seedream Lite 文档](https://redfox.hk/apis/tool/7OM96HCF) [官方豆包图片模块](https://github.com/redfox-data/redfox-python-sdk/blob/main/redfox/endpoints/doubao_image.py) [官方豆包视频模块](https://github.com/redfox-data/redfox-python-sdk/blob/main/redfox/endpoints/doubao_video.py) [官方 AI 搜索模块](https://github.com/redfox-data/redfox-python-sdk/blob/main/redfox/endpoints/ai_search.py)

## 定价与充值

价格页的 `¥0.02–0.06/次` 只适用于标准数据接口参考价，不代表全部 AI 能力。优质数据的阶梯价为 `¥0.04 → ¥0.02/次`，实时数据为 `¥0.06 → ¥0.03/次`；账户下所有接口累计调用量决定折扣档位，3 万次以上最低 5 折，具体接口仍以各自文档为准。[价格方案](https://redfox.hk/pricing)

按官方接口元数据、`1 元 = 10 积分` 和最高 5 折换算，当前 AI 提交接口约为：GPT Image 2 `¥1.00 → ¥0.50/次`，Seedream 5.0 Pro `¥1.00 → ¥0.50/次`，Seedream 5.0 Lite `¥0.71 → ¥0.36/次`，Seedance 2.0 `¥15.00 → ¥7.50/次`，Kimi/豆包/DeepSeek AI 搜索 `¥0.06 → ¥0.03/次`；结果查询接口标为免费。这里的人民币区间是依据官方积分比例和接口元数据推算，`n`、组图数量、视频时长是否额外影响扣费，公开文档没有说清，必须在付费前向官方确认。[价格方案](https://redfox.hk/pricing) [GPT 图片目录](https://redfox.hk/story/web/api/doc/platform/tool-gpt-image/interfaces) [豆包图片目录](https://redfox.hk/story/web/api/doc/platform/tool-doubao-image/interfaces) [豆包视频目录](https://redfox.hk/story/web/api/doc/platform/tool-doubao-video/interfaces) [AI 搜索目录](https://redfox.hk/story/web/api/doc/platform/tool-ai-search/interfaces)

官网称注册赠送 200 积分；自助充值最低 100 元兑 1,000 积分，支持支付宝、微信支付和企业支付。当前公开充值配置显示 1,000 元赠 5%、3,000 元赠 10%，赠送积分有效期 365 天。[登录/注册页](https://redfox.hk/login) [价格方案](https://redfox.hk/pricing) [官方充值配置接口](https://redfox.hk/story/web/recharge/bonus-config)

退款口径偏严格：充值页明示“所有购买均为最终销售，不支持退款”；服务条款只为法律强制情形或平台故障导致的重复扣费保留例外，并明确已消耗积分和已履行企业服务不退。应按“充值原则上不可退”做预算，不要先大额充值。[服务条款](https://redfox.hk/terms) [充值页](https://redfox.hk/dashboard/recharge)

## 限速、可用性与 SLA

服务条款说明平台会设置密钥数、QPS、日调用配额并对异常高频请求限流；公开错误码包含 HTTP 429 和业务码 `4004`。GPT 图片和 Seedance 提交接口元数据出现 `rateLimit=1`，但公开页面未说明单位、按 Key 还是按账户，也未披露并发任务上限、日配额、轮询频率或幂等键。[服务条款](https://redfox.hk/terms) [API 状态码](https://redfox.hk/api-codes) [GPT 图片目录](https://redfox.hk/story/web/api/doc/platform/tool-gpt-image/interfaces)

官网和 SDK 宣传 99.99% 可用性，但服务条款以 “AS IS / AS AVAILABLE” 提供服务且不保证无中断、无错误或无延迟；价格页只称企业版可另签专属 SLA，没有公开 SLA 指标、赔付、支持响应时间或状态页。因此 99.99% 应视为营销陈述，不应当作可执行 SLA。[官网首页](https://redfox.hk/) [服务条款](https://redfox.hk/terms) [价格方案](https://redfox.hk/pricing)

官方 Python SDK默认对网络错误、429 和 5xx 最多重试 3 次，但生成提交是否具有幂等性、失败任务是否退积分未公开。对可能收费的提交请求，本项目不应照搬自动重试，应先保存任务 ID、区分“未送达”和“已受理”，否则可能重复扣费。[官方 SDK 客户端](https://github.com/redfox-data/redfox-python-sdk/blob/main/redfox/client.py)

## 数据、隐私与合规

隐私政策称个人信息原则上存储在中国境内，采取 TLS、最小权限、密钥脱敏和安全审计；会记录 API Key 元数据、调用次数、积分、错误摘要、IP、User-Agent 和操作日志。支付由第三方机构处理，官网支付界面支持支付宝和微信，整体对中国用户较友好。[隐私政策](https://redfox.hk/privacy) [Cookie 政策](https://redfox.hk/cookies) [充值页](https://redfox.hk/dashboard/recharge)

但公开政策没有明确说明 AI 提示词、参考图、生成结果的保存期限、是否用于训练、会传给哪些 GPT/豆包/Kimi/DeepSeek 上游、失败请求如何删除。结果文档还显示 OSS URL，Seedream URL 标注 24 小时有效。未签数据处理协议前，不应上传未发布商品设计、身份证明、真实客户人像、订单数据或商业机密。[隐私政策](https://redfox.hk/privacy) [GPT 图片结果](https://redfox.hk/apis/tool/H9NINDBH) [Seedream Lite 文档](https://redfox.hk/apis/tool/7OM96HCF)

服务条款要求调用方自行确保采集、存储、加工、展示和再分发数据具备授权，并遵守中国法律及抖音、小红书等平台规则；RedFox 不保证数据真实性、完整性或第三方平台持续可用。这些接口本身不等于取得平台官方授权，尤其是用户画像、账号数据和全文内容的商业化使用需要单独法务评估。[服务条款](https://redfox.hk/terms) [隐私政策](https://redfox.hk/privacy)

站点使用 `.hk` 域名，但条款适用中国大陆法律，隐私政策称境内存储，支付支持支付宝/微信；官网还宣传全球 CDN。公开页面未给出明确运营公司全称、注册地址、ICP备案号或标准合同主体，且“关于”页仍出现 `FunHub` 名称。用于正式业务或大额充值前，应先索取合同主体、发票主体、数据处理协议和企业 SLA，并从本项目 Docker 环境做免费连通性测试；现有资料不足以证明中国大陆各运营商网络长期稳定。[服务条款](https://redfox.hk/terms) [隐私政策](https://redfox.hk/privacy) [关于页面](https://redfox.hk/about) [帮助中心](https://redfox.hk/help-center)

## 对本项目的接入建议

1. **先把它当“内容情报数据源”评估**：使用免费 200 积分测试小红书/抖音/公众号/B站的搜索、详情和数据新鲜度，最贴合电商选题、竞品和爆款分析。
2. **不要直接加到现有 New-API Provider 列表**：若要接入，新增独立 `redfox` 适配器，处理专用鉴权、`code/msg/data`、submit/poll 状态机、任务超时、结果落盘和本平台业务扣费。
3. **AI 生成只做备用线路验证**：先用非敏感素材各测一次 GPT Image 2、Seedream Lite；记录实际扣分、排队时间、失败是否退款、输出 URL 有效期和图片质量。未获用户明确授权前不创建真实账号、不充值、不发起付费生成。
4. **付费前向官方书面确认**：`rateLimit=1` 的含义、并发/日配额、失败扣费与退款、幂等性、`n`/组图/视频时长计费、Prompt/图片留存和训练用途、上游处理者、合同/发票主体、企业 SLA 和中国大陆网络保障。

最终判断：**有用，但主要用在内容数据与运营研究；作为当前生图/文本 Provider 不能即插即用。** 若只为替换现有 GPT 图片线路，适配成本和条款不确定性使其优先级低于已兼容的 Packy/OpenAI 类线路；若要补齐小红书、抖音、公众号等数据能力，则值得用免费额度做受控 PoC。
