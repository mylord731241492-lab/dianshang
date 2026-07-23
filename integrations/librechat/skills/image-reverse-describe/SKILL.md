---
name: image-reverse-describe
description: 图像反推描述引擎——四层图像分析框架的第一层（描述层）。对任意一张图片，产出"取证优先、可逆可重建、严格中立"的专业级结构化描述：把画面沿深度轴（前/中/后景）与显著性轴（主体/陪体/环境）双轴拆解，精确到方位坐标、深度层级、占比、遮挡关系，并为每一项判断（深度/光线/色彩/材质）挂上可见视觉依据。Use when the user provides one or more images and wants a rigorous, exhaustive, reconstructable description of what is in the image and how it is spatially and physically structured—rather than a quick summary, an aesthetic verdict, or a type-specific critique. 触发短语包括："反推这张图""把这张图拆到能复现""精确描述这张图的前中后景""这张图的画面结构是什么""逐层拆解这张图""image reverse""图像反推""描述层"，或任何需要把一张图片转写成精确、可逆、有据可查的文字结构的场景。即使用户只说"详细描述一下这张图"，只要诉求是"准确丰富到可重建"而非"快速概括"，也应使用此 skill。Do not use this skill to deliver a good/bad judgment, emotional reading, or commercial-performance critique—those belong to later layers; this skill only produces the neutral evidence-based description they rest on.
user-invocable: true
---

# Image Reverse-Describe（图像反推描述 · 描述层）

## 快速试用

上传一张图片，选择本 Skill 后可直接说：**“把这张图反推到仅凭文字就能重建，先给结构化取证描述，再给一段完整长描述。”** 本 Skill 只做中立描述，不评价好坏。

把一张图片转写成一份**精确、可逆、有据可查**的文字结构。这是"看清楚是什么"那一层——后续的意图、功能、判断三层都建在它之上。它不评价好坏，只忠实清点，并且每一句清点都要能指回画面里的可见证据。

## 这一层为什么要独立成 skill

很多人看到一张图直接说"好看／不好看"，跳过了"它到底是什么"。判断因此是漂的。本 skill 强制把描述做扎实、做到可逆，给上层分析一个不会塌的地基。

它与 `image-analysis-router` 互补：router 负责"用哪种专业视角读这张图"并产出分类批评（意图/功能/判断层的事），本 skill 负责所有视角共用的那层**中立描述底座**。需要可复用的客观描述时，先跑本 skill，再把结果交给上层。

## 五条铁律（贯穿全程，不可妥协）

1. **取证优先**。每一句描述 = 观察 + 视觉依据。不写没有依据的断言。格式恒定："判为 X，依据：[画面里可见的线索]"。读者要能顺着依据自己复核。这是"反推"和"描述"的根本区别——反推不是说出结论，而是说出"从哪些可见痕迹得到这个结论"。

2. **可逆性是唯一硬指标**。描述合不合格，只看一条——**能否仅凭这段文字把画面布局重新画出来（blocking）**。画得出＝够了；画不出＝还在"描述得不够"而不自知。每完成一份描述，必须用这条自检（见 output-contract.md）。

3. **严格中立**。只清点，不评价。回避"强／弱／美／和谐／高级／廉价"这类主观词，把全部价值判断留给后续判断层（这是 Feldman 艺术批评里"描述阶段"的纪律：描述阶段只列事实，判断放到最后）。

4. **双轴分拆**。**显著性轴**（主体／陪体／环境，按视觉重要性分）与**深度轴**（前／中／后景，按离机距离分）是**正交**的两条轴。主体可以待在任意深度层里。必须先沿两条轴各自拆解，最后再把主体**定位到**某个深度层中。绝不把"主体"和"前中后景"混成一条——这是最常见的描述错误。

5. **量化优先、描述补足**。方位用坐标、深度用层级、光向用方位角、色彩用 HSL／色相角等**可复现的量**；同时用描述性语言补足质感（色彩说"釉质暖橙 H≈25°"而非干巴巴的"橙色"）。量化保证可复现，描述保证不失真，两者并存、不互相替代。

## 执行顺序（不可颠倒——顺序有物理因果）

先立坐标系（之后一切都引用它），再搭空间骨架，再读表面（**光是因，色彩和材质是果**，所以光必须先于色彩和材质判定），文字符号作为覆盖层最后清点，最后自检。每个维度都套同一套纪律：**观察 → 取证 → 精度**。

| 步 | 维度 | 读哪个参考文件 |
|:--|:--|:--|
| 0 | 元信息与坐标系 | [references/coordinate-system.md](./references/coordinate-system.md) |
| 1 | 空间结构与深度分层 | [references/spatial-depth.md](./references/spatial-depth.md) |
| 2 | 光线 | [references/surfaces-light-color-material.md](./references/surfaces-light-color-material.md) ·§A |
| 3 | 色彩 | 同上 ·§B |
| 4 | 材质与纹理 | 同上 ·§C |
| 5 | 构图 | [references/composition-and-text.md](./references/composition-and-text.md) ·§A |
| 6 | 文字与符号 | 同上 ·§B |
| 7 | 一致性与可逆性自检 + 结构化输出（Part 1） | [references/output-contract.md](./references/output-contract.md) |
| 8 | 收拢为画面长描述（Part 2，生成式重建用） | [references/long-description.md](./references/long-description.md) |

> 这套顺序是 8 步流水线，但参考文件是按需加载的。每一步开始前读对应文件，读完再做该步，不要一次性把所有参考文件灌进来。

最终交付**两份、互为正反**：**Part 1** 是 0–7 步的结构化反推（模块化、带依据，给人分析用）；**Part 2** 是把 Part 1 重新熔回的**一段连贯长描述**（工具无关、细到能据此重建图像，给机器/重生成用）。Part 2 必须在 Part 1 完成后、依据 Part 1 来写。

## 通用判定原则

- **依据不足就明写"依据不足／不可辨"**，绝不补一个看起来合理的假设。反推 skill 的可信度，恰恰来自"敢于说不确定"。宁可少说，不可臆造。
- **不臆测不可见信息**。画面外的、被完全遮挡的、需要专门知识才能确认的（具体品牌、具体型号、拍摄器材参数），若不能从可见证据确认，一律标"不可辨"。看到一个 logo 不等于认得出品牌——能确认才命名，否则只描述其形态。
- **物理矛盾的线索要标记、但不下判断**。出现互斥的证据（多套打架的投影方向、互相矛盾的透视、光影与材质不自洽、遮挡关系成环）→ 作为**中立观察**记入"存疑清单"。但不要在描述层下"这是合成图／AI 生成"的结论——那是判断层的事。描述层只负责诚实呈现"这里的证据对不上"。
- **图片类型会改变重点，但不改变这套骨架**。平面图形图（海报／信息图）里"前中后景"退化为设计元素的 **z-order 叠放**；微距／平铺（flat-lay）／证件照里深度层退化为**单层**——所以第 1 步永远先按 spatial-depth.md 的"深度结构类型"判定，再决定到底用几层、以及"前中后景"按物理纵深还是按设计图层来理解。

## 输出

最终产出**两份**：

- **Part 1 · 结构化反推**——字段与模板见 [references/output-contract.md](./references/output-contract.md)。**务必**在结尾跑完"可逆性自检"与"跨维度一致性自检"，把发现的矛盾或不确定项**列在末尾**，而不是悄悄抹平。一份合格的反推，末尾应当有一段诚实的"存疑清单"。
- **Part 2 · 画面长描述**——把 Part 1 重新熔回的一段连贯长文，方法见 [references/long-description.md](./references/long-description.md)。工具无关，细到能据此重建图像；写完用"逐节核对"确认 Part 1 的每一节都已落入长文（细无遗漏），并以首尾两句给出全貌与气质（概述到位）。

两份是同一次反推的两种形态：Part 1 拆得开（可复核），Part 2 合得拢（可重建）。
