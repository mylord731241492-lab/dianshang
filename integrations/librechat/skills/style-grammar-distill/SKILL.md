---
name: style-grammar-distill
description: 风格语法提炼器（四层图像分析框架的上层 · Stage A）。输入同一位摄影师/美术指导（或同一视觉体系）的**多份** image-reverse-describe + image-deep-read 分析报告，通过跨报告的**共同点/不同点交叉聚合 + 抽象阶梯**，把"表面反复出现的特征"区分为四类——真实作者签名 / 条件性规则（goal→choice 映射）/ 受 brief 或类型默认驱动的噪声 / 例外——并爬到更高抽象层去找"表面差异底下的更大共性"，最终提炼出一份带覆盖度与置信度的**风格语法指引文件**，供下游 skill 生成器（Stage B）使用。Use when the user has several completed image analyses of one author/corpus and wants to distill the recurring picture-construction logic—the style grammar/visual language—rather than describe or judge any single image. 触发短语："提炼这位摄影师的风格""把这几份报告聚合成风格语法""找出他们画面搭建的共性""做一份美术指引文件""style grammar""风格提炼""Stage A""交叉聚合分析"。强制纪律：一条特征只有跨**多样**语料反复出现、且能与 brief/类型默认区分开，才算签名；表面不同时必须往上爬抽象层找更大共性，但不得爬到"他们会做图"这种无约束的空泛层；语料不够多样时必须标注污染与置信度，**宁可报告"此语料提炼不出非平庸的风格语言",也不许编造一个签名**。Do not use this on a single image (use image-deep-read), and do not use it to generate the downstream style skill itself (that is Stage B).
user-invocable: true
---

# Style-Grammar Distill（风格语法提炼 · Stage A）

## 快速试用

上传同一作者或视觉体系至少 4–5 份已经完成的反推与深读报告，并尽量补充客户、品类、用途等元数据；选择本 Skill 后可直接说：**“把这些报告交叉聚合成一份风格语法，区分作者签名、条件规则、brief 噪声和例外。”**

把同一位作者/同一视觉体系的**多份**图像分析报告,交叉聚合成一份**风格语法**——即"这位作者搭建画面时反复使用的生成逻辑"。这是把 N 张图的零散分析,蒸馏成一份可被下游 skill 生成器使用的指引文件。

## 在管线里的位置

`image-reverse-describe`(描述) + `image-deep-read`(意图/功能/判断) **逐张**产出报告 → **本 skill** 跨多份报告提炼**风格语法** → (Stage B)用语法生成一个风格化美术策划 skill。

**输入**:同一作者/体系的 **N 份**结构化分析报告(来自前两个 skill,或同等结构的分析)。报告的**可比性**是前提——因为它们共用 L1–L4 的维度结构,才能对齐成矩阵做交叉聚合(这是上游标准化的红利)。

## 一句话定性:你提炼的是语法，不是大脑

你恢复不了作者的思维过程,只能从成品反推出一套**决策规则**。指引文件是一部**生成语法**(恒定项 + goal→choice 规则 + 例外),不是心智地图。期待钉在这里。

## 三条贯穿全程的纪律

继承自 `image-deep-read`,但**升到跨报告/语料层**:

1. **收敛认证(D1 的语料版)**:一条原则只有当**多个独立维度**在**多张不同的图**里都指向它,才算可信签名。单维度、单张图的巧合不算。
2. **三confound分离(D4 的语料版)**:每个候选共性必须过"签名 / 类型默认 / brief 驱动"三分诊断——跨多样语料才算签名,与某品牌/campaign 绑定的算 brief 噪声,全品类都这样的算类型基线。**没有语料元数据(哪张属于哪个 brief/客户/品类)就分不开,缺则标注。**
3. **置信度 + 覆盖度 + 污染清单(D5 的语料版)**:每条语法项标"在 N/M 张、跨几个不同命题出现"+ 置信度;并对**整个语料是否够多样**给出判断。**语料窄/同源时,大声标注,不许假装。**

## 核心方法:交叉聚合 + 抽象阶梯

这是本 skill 的中枢,详见 [references/aggregation-method.md](./references/aggregation-method.md)。骨架:

1. **对齐成矩阵**:行=L1–L4 各维度/子维度,列=每张图/报告,格=该报告在该维度的发现。
2. **逐维分类**:每个维度的跨报告模式归为——**恒定** / **协变**(随 goal/brief 系统变化=条件规则)/ **自由变量**(无规律=噪声或不在意)/ **例外**(罕见的破例,最有信息量,别抹平)。
3. **抽象阶梯找"更大共性"**(★你的核心诉求):当某维度表面**不同**时,往上爬一层抽象,重测共性——黑 void vs 白 void → 爬一层"环境剥离/孤立主体"则共性成立。**爬到能找到非平庸的、仍能约束新图的恒定原则为止;爬过头到"他们会做图"这种无约束层,就退回一层。**
4. **收敛认证 + 三confound分离**:候选共性要被多维多图收敛佐证,且通过签名/类型/brief 三分诊断,才升为"签名"。

## 诚实的失败输出

如果共性只在**空泛层**才出现(爬到无约束高度才有共同点),或语料明显同源/异质混杂——**报告"此语料提炼不出非平庸的风格语言"**,并说明原因(作者本身是 range 型/变色龙,还是语料太窄/疑似混入多作者)。**这比编一个站不住的签名重要得多。** 风格提炼的头号风险就是给不存在的签名硬安一个。

## 输出

一份**风格语法指引文件**:签名层 / 条件规则层 / 恒定-变量-例外台账 / 每条规则服务的目标 / 置信度与覆盖度 / 污染与存疑清单。结构、字段与完整示例见 [references/grammar-schema.md](./references/grammar-schema.md)。

入门顺序:先读 [references/corpus-and-discipline.md](./references/corpus-and-discipline.md)(语料要求 + 纪律细节),再读 aggregation-method.md(方法),最后按 grammar-schema.md 产出。
