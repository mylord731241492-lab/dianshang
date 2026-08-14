'use strict';

function registerImageToolRoutes(app, options = {}) {
  const auth = options.auth;
  const uid = options.uid;
  const firstString = options.firstString;
  const buildEcommerceImagePrompt = options.buildEcommerceImagePrompt;
  const normalizeTaskImage = options.normalizeTaskImage;
  const resolveImageRoute = options.resolveImageRoute;
  const resolveImageModelKey = options.resolveImageModelKey;
  const resolveTextRoute = options.resolveTextRoute;
  const callProviderImageEdit = options.callProviderImageEdit;
  const callProviderResponses = options.callProviderResponses;
  const persistProviderImageResults = options.persistProviderImageResults;
  const withAssetAccessFields = options.withAssetAccessFields;
  const attachGeneratedResultAssets = options.attachGeneratedResultAssets;
  const createCompletedTask = options.createCompletedTask;
  const makeTaskResponse = options.makeTaskResponse;
  const loadReferenceImageFile = options.loadReferenceImageFile;
  const imageToolOutputText = options.imageToolOutputText;
  const AI_TEXT_MODEL = options.aiTextModel;
  if (typeof auth !== 'function') throw new TypeError('Image-tools 路由缺少 auth 中间件');
  if (typeof uid !== 'function') throw new TypeError('Image-tools 路由缺少 uid');
  if (typeof firstString !== 'function') throw new TypeError('Image-tools 路由缺少 firstString');
  if (typeof buildEcommerceImagePrompt !== 'function') throw new TypeError('Image-tools 路由缺少 buildEcommerceImagePrompt');
  if (typeof normalizeTaskImage !== 'function') throw new TypeError('Image-tools 路由缺少 normalizeTaskImage');
  if (typeof resolveImageRoute !== 'function') throw new TypeError('Image-tools 路由缺少 resolveImageRoute');
  if (typeof resolveImageModelKey !== 'function') throw new TypeError('Image-tools 路由缺少 resolveImageModelKey');
  if (typeof resolveTextRoute !== 'function') throw new TypeError('Image-tools 路由缺少 resolveTextRoute');
  if (typeof callProviderImageEdit !== 'function') throw new TypeError('Image-tools 路由缺少 callProviderImageEdit');
  if (typeof callProviderResponses !== 'function') throw new TypeError('Image-tools 路由缺少 callProviderResponses');
  if (typeof persistProviderImageResults !== 'function') throw new TypeError('Image-tools 路由缺少 persistProviderImageResults');
  if (typeof withAssetAccessFields !== 'function') throw new TypeError('Image-tools 路由缺少 withAssetAccessFields');
  if (typeof attachGeneratedResultAssets !== 'function') throw new TypeError('Image-tools 路由缺少 attachGeneratedResultAssets');
  if (typeof createCompletedTask !== 'function') throw new TypeError('Image-tools 路由缺少 createCompletedTask');
  if (typeof makeTaskResponse !== 'function') throw new TypeError('Image-tools 路由缺少 makeTaskResponse');
  if (typeof loadReferenceImageFile !== 'function') throw new TypeError('Image-tools 路由缺少 loadReferenceImageFile');
  if (typeof imageToolOutputText !== 'function') throw new TypeError('Image-tools 路由缺少 imageToolOutputText');
  if (!AI_TEXT_MODEL) throw new TypeError('Image-tools 路由缺少 aiTextModel');

  function normalizeImageToolUrl(item = {}) {
    const raw = item && typeof item === 'object' ? item : { url: item };
    return firstString(raw.url, raw.imageUrl, raw.image_url, raw.uploadedUrl, raw.previewUrl, raw.preview, raw.src);
  }

  function imageToolReferences(body = {}) {
    const baseImage = normalizeImageToolUrl(body.imageUrl || body.image || body.url || body.originalUrl || body.original_url);
    const refs = [];
    if (baseImage) refs.push({ url: baseImage, fileName: 'image.png' });
    if (Array.isArray(body.referenceImages)) {
      body.referenceImages
        .map(normalizeImageToolUrl)
        .filter(Boolean)
        .forEach(url => refs.push({ url }));
    }
    return refs;
  }

  function buildImageToolPrompt(body = {}, type = 'inpaint') {
    const userPrompt = String(body.prompt || '').trim();
    const baseByType = {
      erase: '请根据原图上下文，只重绘 mask 透明或白色标记区域，移除涂抹区域内的对象并自然补全背景。未涂抹区域必须保持不变，包括未涂抹区域内的文字、品牌标识、瓶身标签和商品结构。',
      outpaint: '请基于原图自然扩展画面，保持主体、透视、材质、光线、商品包装和整体电商视觉风格一致。原图主体不得变形，新增区域需要自然补全背景。'
    };
    const base = baseByType[type] || '请根据用户提示和参考图，只重绘 mask 透明或白色标记区域。未涂抹区域必须保持不变，尤其不要改动未涂抹区域内的文字、品牌标识、瓶身标签、产品包装、主体结构和整体构图。';
    const fallbackByType = {
      erase: '自然消除涂抹区域',
      outpaint: '自然扩展画布背景'
    };
    return buildEcommerceImagePrompt(
      `${base}\n用户提示：${userPrompt || fallbackByType[type] || '按涂抹区域进行局部修改'}`,
      { hasReferenceImages: true, referenceCount: imageToolReferences(body).length || 1 }
    );
  }

  function imageToolSize(body = {}) {
    const width = Number(body.imageNaturalWidth || body.width || body.canvasWidth || 0);
    const height = Number(body.imageNaturalHeight || body.height || body.canvasHeight || 0);
    if (width > 0 && height > 0) {
      const ratio = width / height;
      if (ratio > 1.15) return '16:9';
      if (ratio < 0.87) return '9:16';
    }
    return body.size || body.ratio || '1:1';
  }

  function makeImageToolResponse(providerResult = {}, body = {}, type = 'inpaint') {
    const taskId = uid(`${type}_`);
    const image = normalizeTaskImage((providerResult.images || [])[0] || {}, 0, taskId);
    const width = Number(body.imageNaturalWidth || body.width || 0);
    const height = Number(body.imageNaturalHeight || body.height || 0);
    return {
      success: true,
      id: taskId,
      taskId,
      status: 'success',
      progress: 100,
      mock: !!providerResult.mock,
      editMode: !!providerResult.editMode,
      provider: providerResult.provider,
      imageUrl: image.imageUrl,
      url: image.url,
      originalUrl: image.originalUrl,
      thumbUrl: image.preview,
      thumbnailUrl: image.preview,
      width,
      height,
      // Task 9：结果已写入账号云端资产库时，附带 assetId 与 15 分钟短时同源 accessUrl。
      assetId: image.assetId,
      accessUrl: image.accessUrl,
      accessUrlExpiresAt: image.accessUrlExpiresAt,
      resultImages: [image],
      images: [image],
      operation: type,
      request: providerResult.request
    };
  }

  async function runImageToolEdit(req, res, type = 'inpaint') {
    try {
      const references = imageToolReferences(req.body);
      const mask = firstString(req.body.maskAlphaBase64, req.body.maskBase64, req.body.mask, req.body.maskUrl);
      if (!references.length) return res.status(400).json({ success: false, code: 'IMAGE_TOOL_IMAGE_REQUIRED', message: '缺少待处理图片' });
      if (!mask) return res.status(400).json({ success: false, code: 'IMAGE_TOOL_MASK_REQUIRED', message: '请先涂抹需要处理的区域' });

      const route = resolveImageRoute(req.body, req.user && req.user.userId);
      const model = resolveImageModelKey(req.body);
      const operationType = type;
      const prompt = buildImageToolPrompt(req.body, operationType);
      const providerResult = await callProviderImageEdit(prompt, {
        ...req.body,
        body: {
          ...req.body,
          referenceImages: references,
          mask
        },
        req,
        route,
        model,
        size: imageToolSize(req.body),
        quality: req.body.quality || req.body.clarity || 'auto',
        n: 1,
        mask
      });
      if (!providerResult.success) {
        return res.status(502).json({
          success: false,
          code: providerResult.code || 'IMAGE_TOOL_PROVIDER_FAILED',
          message: providerResult.message || '图片编辑接口调用失败',
          provider: providerResult.provider
        });
      }
      const persistedImages = await persistProviderImageResults(providerResult.images, providerResult.request);
      // Task 9：工具结果写入账号云端资产库（source='tool'）；落库失败抛错走下方 500，不重放 Provider。
      const assetImages = withAssetAccessFields(
        await attachGeneratedResultAssets(req.user.userId, persistedImages, { source: 'tool' })
      );
      res.json(makeImageToolResponse({ ...providerResult, images: assetImages }, req.body, operationType));
    } catch (error) {
      res.status(500).json({
        success: false,
        code: 'IMAGE_TOOL_EDIT_ERROR',
        message: error.message || '图片编辑任务失败'
      });
    }
  }

  async function runImageToolOutpaint(req, res) {
    try {
      const references = imageToolReferences(req.body);
      if (!references.length) return res.status(400).json({ success: false, code: 'IMAGE_TOOL_IMAGE_REQUIRED', message: '缺少待扩展图片' });

      const route = resolveImageRoute(req.body, req.user && req.user.userId);
      const model = resolveImageModelKey(req.body);
      const prompt = buildImageToolPrompt(req.body, 'outpaint');
      const providerResult = await callProviderImageEdit(prompt, {
        ...req.body,
        body: {
          ...req.body,
          referenceImages: references
        },
        req,
        route,
        model,
        size: imageToolSize(req.body),
        quality: req.body.quality || req.body.clarity || 'auto',
        n: 1
      });
      if (!providerResult.success) {
        return res.status(502).json({
          success: false,
          code: providerResult.code || 'IMAGE_TOOL_OUTPAINT_FAILED',
          message: providerResult.message || '扩图接口调用失败',
          provider: providerResult.provider
        });
      }

      const persistedImages = await persistProviderImageResults(providerResult.images, providerResult.request);
      // Task 9：扩图结果写入账号云端资产库（source='tool'）；落库失败抛错走下方 500，不重放 Provider。
      const assetImages = await attachGeneratedResultAssets(req.user.userId, persistedImages, { source: 'tool' });
      const task = createCompletedTask(req, {
        prompt,
        modelKey: model,
        imageCount: 1,
        results: assetImages,
        request: providerResult.request
      });
      const taskResponse = makeTaskResponse(task);
      const imagesWithAccess = withAssetAccessFields(taskResponse.images);
      const firstAssetImage = imagesWithAccess.find((image) => image && typeof image === 'object' && image.assetId) || null;
      res.json({
        success: true,
        mock: !!providerResult.mock,
        editMode: !!providerResult.editMode,
        provider: providerResult.provider,
        operation: 'outpaint',
        ...taskResponse,
        resultImages: imagesWithAccess,
        images: imagesWithAccess,
        assetId: firstAssetImage ? firstAssetImage.assetId : undefined,
        accessUrl: firstAssetImage && firstAssetImage.accessUrl ? firstAssetImage.accessUrl : undefined,
        accessUrlExpiresAt: firstAssetImage && firstAssetImage.accessUrlExpiresAt ? firstAssetImage.accessUrlExpiresAt : undefined
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        code: 'IMAGE_TOOL_OUTPAINT_ERROR',
        message: error.message || '扩图任务失败'
      });
    }
  }

  async function runImageToolReversePrompt(req, res) {
    try {
      const imageUrl = normalizeImageToolUrl(req.body.imageUrl || req.body.image || req.body.url || req.body.originalUrl);
      if (!imageUrl) return res.status(400).json({ success: false, code: 'IMAGE_TOOL_IMAGE_REQUIRED', message: '缺少待分析图片' });

      let reference;
      try {
        reference = await loadReferenceImageFile({ url: imageUrl }, req);
      } catch (error) {
        return res.status(400).json({
          success: false,
          code: 'IMAGE_TOOL_IMAGE_UNREADABLE',
          message: error.message || '待分析图片读取失败'
        });
      }

      const route = resolveTextRoute(req.body);
      const model = String(req.body.textModel || req.body.textModelKey || route?.dm || AI_TEXT_MODEL).trim();
      const instruction = [
        '请根据下面这张电商图片，反推出适合文生图或图生图使用的中文提示词。',
        '输出一段完整提示词，包含主体、构图、光线、材质、背景、文字/包装要点、画面风格和电商转化重点。',
        '不要输出解释，不要输出列表标题。'
      ].join('\n');
      const input = [{
        role: 'user',
        content: [
          { type: 'input_text', text: instruction },
          { type: 'input_image', image_url: `data:${reference.mime};base64,${reference.buffer.toString('base64')}` }
        ]
      }];
      const providerResult = await callProviderResponses(input, { route, model });
      if (!providerResult.success) {
        return res.status(502).json({
          success: false,
          code: providerResult.code || 'IMAGE_TOOL_REVERSE_PROMPT_FAILED',
          message: providerResult.message || '反推提示词接口调用失败',
          provider: providerResult.provider
        });
      }
      const text = imageToolOutputText(providerResult) || '高质量电商产品主图，主体清晰，构图居中，商业摄影级光影，背景干净，材质真实，细节丰富。';
      res.json({
        success: true,
        mock: !!providerResult.mock,
        provider: providerResult.provider,
        prompt: text,
        text,
        rawPrompt: text,
        rawText: text
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        code: 'IMAGE_TOOL_REVERSE_PROMPT_ERROR',
        message: error.message || '反推提示词失败'
      });
    }
  }

  app.post('/api/image-tools/outpaint', auth, async (req, res) => {
    await runImageToolOutpaint(req, res);
  });

  app.post('/api/image-tools/reverse-prompt', auth, async (req, res) => {
    await runImageToolReversePrompt(req, res);
  });

  app.post('/api/image-tools/inpaint', auth, async (req, res) => {
    await runImageToolEdit(req, res, 'inpaint');
  });

  app.post('/api/image-tools/erase', auth, async (req, res) => {
    await runImageToolEdit(req, res, 'erase');
  });
}

module.exports = { registerImageToolRoutes };
