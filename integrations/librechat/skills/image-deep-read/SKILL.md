---
name: image-deep-read
description: 图像深读引擎——四层图像分析框架的第二到第四层（意图层 / 功能层 / 判断层）。在中立描述（第一层）的基础上，推断一张图"为什么这样呈现、在现实里承担什么任务、做得好不好"：从置景/道具/选角/姿态等场面调度（mise-en-scène）选择反推创作意图，用传播功能学（Jakobson）判定它的社会功能与目标受众，再以"对功能的适配度"为准绳做有据可依的质量判断与风险排查（含美妆等品类的现实合规红线）。Use when the user has an image and wants to go beyond "what's in it" to "what it's trying to do and whether it works"—interpreting creative intent, social/commercial function, target audience, and evaluating quality and risk against the image's inferred purpose. 触发短语："这张图想表达什么""为什么这么设计""它在传递什么""这张图给谁看的""这个 KV 行不行""评估一下这张广告图""分析意图/功能""这张图有什么风险""深读这张图""image intent"。即使用户只说"这张图做得好不好"，只要诉求是"有据可依地判断而非凭感觉"，就用此 skill。强制纪律：意图/功能/质量都是**推断**而非观察，每个判断都要挂上它依据的画面选择 + 置信度，并在结尾列存疑清单；判断必须相对于推断出的功能，不能用绝对美学。Do not use this for the neutral physical description itself—that is the description-layer skill image-reverse-describe, which this builds on—and do not use it to produce a quick aesthetic verdict without the evidence chain.
user-invocable: true
---

# Image Deep-Read（图像深读 · 意图 / 功能 / 判断层）

## 快速试用

上传一张图片，选择本 Skill 后可直接说：**“深读这张图：它为什么这样设计、给谁看、承担什么任务、做得好不好，并列出风险和存疑。”** 如果没有描述层报告，本 Skill 会先建立紧凑的画面事实底座。

回答三个问题:这张图**为什么这样呈现**(意图)、**在现实里干什么活**(功能)、**干得好不好**(判断)。它是四层框架的后三层,建在第一层"中立描述"之上。

## 与另外两个 skill 的关系

- **`image-reverse-describe`(第一层 · 描述)是本 skill 的地基。** 那一层产出中立、可逆、带证据的画面事实;本 skill 在那些事实上做推断。**没有描述就没有合法的推断**——见下面的铁律。
- 与 `image-analysis-router` 的分工:router 按图片类型分派到对口的批评流程;本 skill 是**类型无关的通用四层推断主干**,grounded 在符号学/传播学/艺术批评的标准框架上。两者可并用,也可只用其一。

## 起手式:先有描述,再做推断

**绝不跳过描述直接谈意图。** 推断必须钉在被描述的画面事实上,否则就是投射。开工前:

- 若已有 `image-reverse-describe` 的 Part 1(结构化描述)→ 直接拿来当证据基。
- 若没有 → 先做一遍紧凑的描述(至少:主体/置景/道具/姿态/光/色/构图/文字),或直接调 `image-reverse-describe`,**再**进入本 skill。

## 唯一贯穿全程的铁律:这一层是推断,不是观察

第一层"看到什么"是可观察、可取证的。**意图、功能、质量都看不见——只能从选择反推。** 这决定了本 skill 每一句判断的形态:

> **判断 = 结论 + 它依据的画面选择 + 置信度**;不确定的,进存疑清单。

这条是把"严谨深读"和"凭感觉脑补"区分开的唯一分水岭。完整的推断纪律见 [references/inference-discipline.md](./references/inference-discipline.md)——**开工前必读**,它管着后面三层的每一步。

## 三层流水线(顺序不可逆)

判断要站在功能上,功能要站在意图上,意图要站在描述上。逐层向上,每层有自己的 master variable:

| 层 | 回答 | master variable（其余维度都喂它） | 读哪个文件 |
|:--|:--|:--|:--|
| L2 意图 | 想让你怎么感受/看见/相信 | **意图**（从选择的收敛反推） | [references/layer2-intent.md](./references/layer2-intent.md) |
| L3 功能 | 在现实里承担什么任务 | **语境**（框架变量；未知则条件式） | [references/layer3-function.md](./references/layer3-function.md) |
| L4 判断 | 干得好不好 | **适配度**（质量＝对功能的适配，非绝对美学） | [references/layer4-judgment.md](./references/layer4-judgment.md) |

读法:先读 inference-discipline.md,再按 L2→L3→L4 顺序,每层开始前读对应文件。

## 输出

产出一份 L2→L3→L4 的结构化深读,**外加一份贯穿三层的"置信度 + 存疑清单"**(每层的不确定项层层累积)。结构、字段与完整示例见 [references/output-contract.md](./references/output-contract.md)。

一份合格的深读,每个核心判断都带置信度,结尾有一段诚实的"哪些读法存疑、哪些无法判定、哪里我可能在投射"。**宁可标"无法判定",不可硬凑一个看起来合理的意图。**
