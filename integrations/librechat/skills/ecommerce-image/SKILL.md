---
name: ecommerce-image
description: 当用户需要生成电商主图、白底图、场景图、详情页图片或商品海报时使用。
user-invocable: true
allowed-tools:
  - prepare_image_generation
  - execute_image_generation
---

# 电商生图

1. 先确认商品主体、使用场景、图片比例、数量和需要避免的内容。
2. 调用 `prepare_image_generation` 获取模型、张数、算力和确认码。
3. 清楚展示报价，并要求用户在下一条消息回复完整确认码。
4. 没有新的用户确认消息时，禁止调用 `execute_image_generation`。
5. 生成完成后列出图片、实际消耗和剩余算力。
