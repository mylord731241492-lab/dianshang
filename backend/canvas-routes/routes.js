'use strict';

function registerTemplateSettingsRoutes(app, options = {}) {
  const templateWorkflowState = options.templateWorkflowState;
  if (typeof templateWorkflowState !== 'function') throw new TypeError('Canvas 路由缺少 templateWorkflowState');

  app.get('/api/template/settings', (req, res) => res.json(templateWorkflowState()));
}

function registerCanvasPromptRoutes(app, options = {}) {
  const auth = options.auth;
  const canvasPromptImageLabel = options.canvasPromptImageLabel;
  const resolveTextRoute = options.resolveTextRoute;
  const callProviderResponses = options.callProviderResponses;
  const imageToolOutputText = options.imageToolOutputText;
  const AI_TEXT_MODEL = options.aiTextModel;
  if (typeof auth !== 'function') throw new TypeError('Canvas 路由缺少 auth 中间件');
  if (typeof canvasPromptImageLabel !== 'function') throw new TypeError('Canvas 路由缺少 canvasPromptImageLabel');
  if (typeof resolveTextRoute !== 'function') throw new TypeError('Canvas 路由缺少 resolveTextRoute');
  if (typeof callProviderResponses !== 'function') throw new TypeError('Canvas 路由缺少 callProviderResponses');
  if (typeof imageToolOutputText !== 'function') throw new TypeError('Canvas 路由缺少 imageToolOutputText');
  if (!AI_TEXT_MODEL) throw new TypeError('Canvas 路由缺少 aiTextModel');

  function buildCanvasPromptFallback(requirement = '', imageCount = 0) {
    const imageLine = imageCount > 0
      ? `参考图顺序：${Array.from({ length: imageCount }, (_, index) => canvasPromptImageLabel(index)).join('、')}。请严格按用户对图序的描述理解主体、风格、构图、文案和替换关系。`
      : '本次未提供参考图，请根据用户需求独立生成电商视觉。';
    return [
      imageLine,
      `用户需求：${requirement || '生成一张高质量电商产品图片。'}`,
      '生成要求：商品主体清晰，保留参考图中的产品外观、包装结构、品牌标识、颜色、材质和关键文字；只根据用户要求调整场景、背景、构图、光影、道具、营销氛围和画面风格。画面真实自然，商业摄影质感，适合电商主图或详情页使用。不要虚构价格、认证、功效和不存在的文字，不要产生乱码、水印、二维码或畸形产品。'
    ].join('\n');
  }

  function buildCanvasPromptInput(body = {}) {
    const requirement = String(body.requirement || body.prompt || body.message || body.text || '').trim();
    const requestedCount = Number(body.imageCount || body.referenceImageCount || (Array.isArray(body.referenceImages) ? body.referenceImages.length : 0) || 0);
    const imageCount = Math.max(0, Math.min(Number.isFinite(requestedCount) ? requestedCount : 0, 12));
    const imageLabels = Array.from({ length: imageCount }, (_, index) => canvasPromptImageLabel(index));
    return {
      requirement,
      imageCount,
      imageLabels,
      input: [
        '你是电商视觉提示词工程师。用户会先按顺序上传参考图，然后写出生成需求。',
        '请把用户需求整理成一段可直接提交给图片生成模型的中文提示词。',
        '必须保留用户提到的图序关系，例如“图1的产品、图2的主图/框架/风格/文案”。不要擅自调换图片顺序。',
        '提示词要明确：主体、参考图使用方式、背景/场景、构图、光影、材质、文字/包装保持规则、电商转化重点、负面约束。',
        '只输出最终提示词正文，不要输出标题、解释、编号列表或 Markdown。',
        imageCount > 0 ? `参考图顺序：${imageLabels.join('、')}` : '参考图顺序：无',
        `用户需求：${requirement || '生成一张高质量电商产品图片'}`
      ].join('\n')
    };
  }

  app.post('/api/canvas/generate-prompt', auth, async (req, res) => {
    const draft = buildCanvasPromptInput(req.body || {});
    if (!draft.requirement && draft.imageCount <= 0) {
      return res.status(400).json({ success: false, code: 'CANVAS_PROMPT_INPUT_REQUIRED', message: '请输入提示词需求或上传参考图' });
    }

    const route = resolveTextRoute(req.body || {});
    const model = String(req.body.textModel || req.body.model || route?.dm || AI_TEXT_MODEL).trim();
    const fallbackPrompt = buildCanvasPromptFallback(draft.requirement, draft.imageCount);
    const providerResult = await callProviderResponses(draft.input, { route, model });
    const providerPrompt = providerResult.success && !providerResult.mock ? imageToolOutputText(providerResult) : '';
    const prompt = providerPrompt || fallbackPrompt;

    res.json({
      success: true,
      mock: !!providerResult.mock,
      fallback: !providerPrompt,
      prompt,
      draftPrompt: prompt,
      requirement: draft.requirement,
      imageCount: draft.imageCount,
      imageLabels: draft.imageLabels,
      textModel: model,
      textRouteId: route?.id || route?.routeId || '',
      provider: providerResult.provider,
      providerError: providerResult.success ? '' : (providerResult.message || providerResult.code || '文本模型暂不可用，已生成基础提示词草稿')
    });
  });
}

function registerTemplateImageRoutes(app, options = {}) {
  const auth = options.auth;
  const executeTemplateImageGeneration = options.executeTemplateImageGeneration;
  const pickTemplatePrompt = options.pickTemplatePrompt;
  const uid = options.uid;
  if (typeof auth !== 'function') throw new TypeError('Canvas 路由缺少 auth 中间件');
  if (typeof executeTemplateImageGeneration !== 'function') throw new TypeError('Canvas 路由缺少 executeTemplateImageGeneration');
  if (typeof pickTemplatePrompt !== 'function') throw new TypeError('Canvas 路由缺少 pickTemplatePrompt');
  if (typeof uid !== 'function') throw new TypeError('Canvas 路由缺少 uid');

  app.post('/api/template/generate-image', auth, async (req, res, next) => {
    try {
      const result = await executeTemplateImageGeneration(req.user.userId, req.body, req);
      res.status(result.asyncPending ? 202 : 200).json(result);
    } catch (error) {
      if (error.status) {
        return res.status(error.status).json({ success: false, code: error.code || 'IMAGE_GENERATION_FAILED', message: error.message, provider: error.provider });
      }
      next(error);
    }
  });

  app.post('/api/template/reverse-prompt', auth, async (req, res) => {
    const base = pickTemplatePrompt(req.body);
    const ratio = req.body.ratio || req.body.aspectRatio || '1:1';
    const platform = req.body.platform ? `，适配${req.body.platform}平台` : '';
    const prompt = `${base}，主体清晰，商业摄影级光影，背景干净，有真实材质细节${platform}`;
    const suggestions = [
      { id: 'mock_reverse_a', title: '高转化主图', label: '高转化主图', prompt, text: prompt, negativePrompt: '模糊，变形，水印，低清晰度，多余文字', ratio, selected: true, styleTags: ['电商', '主图', '高清'] },
      { id: 'mock_reverse_b', title: '场景氛围图', label: '场景氛围图', prompt: `${base}，加入自然使用场景，柔和光线，画面高级，适合详情页展示`, text: `${base}，加入自然使用场景，柔和光线，画面高级，适合详情页展示`, negativePrompt: '杂乱背景，人物畸形，品牌错字，水印', ratio, selected: false, styleTags: ['场景', '氛围'] },
      { id: 'mock_reverse_c', title: '极简白底图', label: '极简白底图', prompt: `${base}，纯白背景，产品居中，边缘锐利，干净阴影，专业棚拍`, text: `${base}，纯白背景，产品居中，边缘锐利，干净阴影，专业棚拍`, negativePrompt: '脏污背景，过曝，模糊，压缩噪点', ratio, selected: false, styleTags: ['白底', '棚拍'] }
    ].map((item, index) => ({
      ...item,
      id: item.id || `mock_reverse_${index + 1}`,
      title: item.title || item.label || `提示词 ${index + 1}`,
      label: item.label || item.title || `提示词 ${index + 1}`,
      prompt: item.prompt || item.text || '',
      text: item.text || item.prompt || '',
      negativePrompt: item.negativePrompt || '',
      negative_prompt: item.negativePrompt || '',
      ratio: item.ratio || ratio,
      styleTags: item.styleTags || [],
      style_tags: item.styleTags || [],
      referenceImageIndex: index,
      reference_image_index: index,
      selected: index === 0
    }));
    res.json({
      success: true,
      mock: true,
      prompt,
      text: prompt,
      rawPrompt: prompt,
      rawText: prompt,
      templateTaskId: uid('reverse_'),
      suggestions,
      prompts: suggestions,
      items: suggestions,
      list: suggestions,
      data: suggestions
    });
  });
}

module.exports = {
  registerTemplateSettingsRoutes,
  registerCanvasPromptRoutes,
  registerTemplateImageRoutes
};
