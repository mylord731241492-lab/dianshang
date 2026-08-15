'use strict';

function registerEcommerceSuiteRoutes(app, options = {}) {
  const auth = options.auth;
  const db = options.db;
  const balanceService = options.balanceService;
  const settingsState = options.settingsState;
  const normalizeEcommerceSuiteAgentConfig = options.normalizeEcommerceSuiteAgentConfig;
  const defaultEcommerceSuiteAgent = options.defaultEcommerceSuiteAgent;
  const defaultEcommerceSuiteSkills = options.defaultEcommerceSuiteSkills;
  const cleanSettingKey = options.cleanSettingKey;
  const firstString = options.firstString;
  const uid = options.uid;
  const summarizeText = options.summarizeText;
  const sanitizeSkillMarkdown = options.sanitizeSkillMarkdown;
  const loadReferenceImageFile = options.loadReferenceImageFile;
  const imageToolOutputText = options.imageToolOutputText;
  const parseJsonObjectFromText = options.parseJsonObjectFromText;
  const resolveTextRoute = options.resolveTextRoute;
  const resolveImageRoute = options.resolveImageRoute;
  const resolveImageModelKey = options.resolveImageModelKey;
  const modelCost = options.modelCost;
  const callProviderResponses = options.callProviderResponses;
  const callProviderImageEdit = options.callProviderImageEdit;
  const callProviderImageGeneration = options.callProviderImageGeneration;
  const buildEcommerceImagePrompt = options.buildEcommerceImagePrompt;
  const persistProviderImageResults = options.persistProviderImageResults;
  const createCompletedTask = options.createCompletedTask;
  const AI_IMAGE_MODEL = options.aiImageModel;
  const AI_TEXT_MODEL = options.aiTextModel;
  const CANVAS_DIALOG_ANALYSIS_TIMEOUT_MS = options.canvasDialogAnalysisTimeoutMs;
  if (typeof auth !== 'function') throw new TypeError('Ecommerce-suite 路由缺少 auth 中间件');
  if (!db) throw new TypeError('Ecommerce-suite 路由缺少 db');
  if (!balanceService) throw new TypeError('Ecommerce-suite 路由缺少 balanceService');
  if (typeof settingsState !== 'function') throw new TypeError('Ecommerce-suite 路由缺少 settingsState');
  if (typeof normalizeEcommerceSuiteAgentConfig !== 'function') throw new TypeError('Ecommerce-suite 路由缺少 normalizeEcommerceSuiteAgentConfig');
  if (!defaultEcommerceSuiteAgent) throw new TypeError('Ecommerce-suite 路由缺少 defaultEcommerceSuiteAgent');
  if (!Array.isArray(defaultEcommerceSuiteSkills)) throw new TypeError('Ecommerce-suite 路由缺少 defaultEcommerceSuiteSkills');
  if (typeof cleanSettingKey !== 'function') throw new TypeError('Ecommerce-suite 路由缺少 cleanSettingKey');
  if (typeof firstString !== 'function') throw new TypeError('Ecommerce-suite 路由缺少 firstString');
  if (typeof uid !== 'function') throw new TypeError('Ecommerce-suite 路由缺少 uid');
  if (typeof summarizeText !== 'function') throw new TypeError('Ecommerce-suite 路由缺少 summarizeText');
  if (typeof sanitizeSkillMarkdown !== 'function') throw new TypeError('Ecommerce-suite 路由缺少 sanitizeSkillMarkdown');
  if (typeof loadReferenceImageFile !== 'function') throw new TypeError('Ecommerce-suite 路由缺少 loadReferenceImageFile');
  if (typeof imageToolOutputText !== 'function') throw new TypeError('Ecommerce-suite 路由缺少 imageToolOutputText');
  if (typeof parseJsonObjectFromText !== 'function') throw new TypeError('Ecommerce-suite 路由缺少 parseJsonObjectFromText');
  if (typeof resolveTextRoute !== 'function') throw new TypeError('Ecommerce-suite 路由缺少 resolveTextRoute');
  if (typeof resolveImageRoute !== 'function') throw new TypeError('Ecommerce-suite 路由缺少 resolveImageRoute');
  if (typeof resolveImageModelKey !== 'function') throw new TypeError('Ecommerce-suite 路由缺少 resolveImageModelKey');
  if (typeof modelCost !== 'function') throw new TypeError('Ecommerce-suite 路由缺少 modelCost');
  if (typeof callProviderResponses !== 'function') throw new TypeError('Ecommerce-suite 路由缺少 callProviderResponses');
  if (typeof callProviderImageEdit !== 'function') throw new TypeError('Ecommerce-suite 路由缺少 callProviderImageEdit');
  if (typeof callProviderImageGeneration !== 'function') throw new TypeError('Ecommerce-suite 路由缺少 callProviderImageGeneration');
  if (typeof buildEcommerceImagePrompt !== 'function') throw new TypeError('Ecommerce-suite 路由缺少 buildEcommerceImagePrompt');
  if (typeof persistProviderImageResults !== 'function') throw new TypeError('Ecommerce-suite 路由缺少 persistProviderImageResults');
  if (typeof createCompletedTask !== 'function') throw new TypeError('Ecommerce-suite 路由缺少 createCompletedTask');
  if (!AI_IMAGE_MODEL) throw new TypeError('Ecommerce-suite 路由缺少 aiImageModel');
  if (!AI_TEXT_MODEL) throw new TypeError('Ecommerce-suite 路由缺少 aiTextModel');
  if (!CANVAS_DIALOG_ANALYSIS_TIMEOUT_MS) throw new TypeError('Ecommerce-suite 路由缺少 canvasDialogAnalysisTimeoutMs');

  function normalizeEcommerceSuiteSection(section = {}, fallback = {}, index = 0) {
    const key = cleanSettingKey(section.key || fallback.key, fallback.key || `section-${index + 1}`);
    return {
      ...fallback,
      ...section,
      key,
      name: String(section.name || fallback.name || key).trim(),
      description: String(section.description || fallback.description || '').trim(),
      promptGuide: String(section.promptGuide || section.prompt || fallback.promptGuide || '').trim(),
      enabled: section.enabled !== false,
      sort: Number(section.sort ?? fallback.sort ?? index + 1) || index + 1
    };
  }

  function ecommerceSuiteAgentConfig() {
    return normalizeEcommerceSuiteAgentConfig(settingsState().ecommerceSuiteAgent);
  }

  function ecommerceSuitePublicConfig() {
    const config = ecommerceSuiteAgentConfig();
    return {
      ...config,
      sections: [],
      sectionMode: 'dynamic',
      skills: config.skills
        .filter(skill => skill.enabled !== false)
        .map(({ markdown, ...skill }) => skill)
    };
  }

  function ecommerceSuiteSkillForId(config = {}, skillId = '') {
    const skills = Array.isArray(config.skills) ? config.skills : [];
    const requested = cleanSettingKey(skillId);
    return skills.find(skill => skill.enabled !== false && skill.id === requested)
      || skills.find(skill => skill.enabled !== false && skill.id === config.defaultSkillId)
      || skills.find(skill => skill.enabled !== false)
      || defaultEcommerceSuiteSkills[0];
  }

  function ecommerceSuiteSelectedSections(config = {}, sectionKeys = []) {
    if (!Array.isArray(sectionKeys) || !sectionKeys.length) return [];
    return sectionKeys
      .map((item, index) => {
        if (item && typeof item === 'object') {
          return normalizeEcommerceSuiteSection(item, {}, index);
        }
        const label = String(item || '').trim();
        return {
          key: cleanSettingKey(label, `section-${index + 1}`),
          name: label || `板块 ${index + 1}`,
          description: '',
          promptGuide: '',
          enabled: true,
          sort: index + 1
        };
      })
      .filter(section => section && section.enabled !== false)
      .slice(0, 5);
  }

  function normalizeSuiteImageReference(item = {}, role = 'reference', index = 0) {
    const raw = item && typeof item === 'object' ? item : { url: item };
    const url = firstString(raw.url, raw.imageUrl, raw.image_url, raw.originalUrl, raw.original_url, raw.preview, raw.src);
    const dataUrl = firstString(raw.dataUrl, raw.data_url, raw.base64, raw.b64_json, raw.b64Json);
    if (!url && !dataUrl) return null;
    return {
      role,
      index: index + 1,
      label: role === 'product' ? `产品图${index + 1}` : `参考图${index + 1}`,
      url,
      dataUrl,
      fileName: firstString(raw.fileName, raw.filename, raw.name, raw.title) || `${role}-${index + 1}.png`,
      mimeType: firstString(raw.mimeType, raw.mime, raw.type)
    };
  }

  function ecommerceSuiteImageBuckets(body = {}) {
    const productSource = Array.isArray(body.productImages) ? body.productImages
      : Array.isArray(body.product_images) ? body.product_images
        : [];
    const referenceSource = Array.isArray(body.referenceImages) ? body.referenceImages
      : Array.isArray(body.reference_images) ? body.reference_images
        : Array.isArray(body.images) ? body.images
          : [];
    const productImages = productSource
      .map((item, index) => normalizeSuiteImageReference(item, 'product', index))
      .filter(Boolean)
      .slice(0, 8);
    const referenceImages = referenceSource
      .map((item, index) => normalizeSuiteImageReference(item, 'reference', index))
      .filter(Boolean)
      .slice(0, 8);
    return {
      productImages,
      referenceImages,
      all: [...productImages, ...referenceImages].slice(0, 12)
    };
  }

  async function ecommerceSuiteReferencesForAnalysis(body = {}, req) {
    const buckets = ecommerceSuiteImageBuckets(body);
    const result = [];
    for (let index = 0; index < buckets.all.length; index += 1) {
      const source = buckets.all[index];
      const file = await loadReferenceImageFile(source, req);
      result.push({
        ...source,
        dataUrl: `data:${file.mime};base64,${file.buffer.toString('base64')}`,
        mime: file.mime,
        fileName: file.fileName || source.fileName
      });
    }
    return result;
  }

  function ecommerceSuiteContextFromBody(body = {}, config = ecommerceSuiteAgentConfig()) {
    const skill = ecommerceSuiteSkillForId(config, body.skillId || body.designerId);
    const sections = ecommerceSuiteSelectedSections(config, body.sectionKeys || body.sections);
    const defaults = config.defaults || defaultEcommerceSuiteAgent.defaults;
    return {
      requirement: String(body.requirement || body.prompt || body.message || body.text || '').trim(),
      brandName: String(body.brandName || body.brand || defaults.brandName || '').trim(),
      platform: String(body.platform || defaults.platform || '拼多多').trim(),
      country: String(body.country || defaults.country || '中国').trim(),
      language: String(body.language || defaults.language || '中文').trim(),
      ratio: String(body.ratio || body.aspectRatio || defaults.ratio || '1:1').trim(),
      quality: String(body.quality || body.clarity || defaults.quality || '1k').trim().toLowerCase(),
      imageCount: Math.max(1, Math.min(Number(body.imageCount || body.count || body.n || defaults.imageCount || 1) || 1, 4)),
      skill,
      sections
    };
  }

  function buildEcommerceSuitePromptInput(context = {}, references = []) {
    const productLabels = references.filter(item => item.role === 'product').map(item => item.label);
    const referenceLabels = references.filter(item => item.role !== 'product').map(item => item.label);
    const sectionText = context.sections.length
      ? context.sections.map((section, index) =>
        `${index + 1}. ${section.key} / ${section.name}：${section.promptGuide || section.description || ''}`
      ).join('\n')
      : '';
    const sectionRule = sectionText
      ? `用户显式指定了板块，请只为这些板块生成提示词：\n${sectionText}`
      : [
        '请根据设计师 skill、产品图、参考图和用户输入，自主规划本次电商套图的板块集合。',
        '板块数量建议 3-5 个；不要机械套用固定的首屏/卖点/效果/科技/场景五件套。',
        '每个板块必须服务当前商品和当前投放目的，可以是主转化视觉、信任背书、成分/结构、场景利益、包装质感、促销氛围等，但名称必须按本次需求自拟。',
        'sectionKey 使用稳定英文 kebab-case；sectionName 使用中文短名称。'
      ].join('\n');
    const skillMarkdown = sanitizeSkillMarkdown(context.skill?.markdown || '').slice(0, 8000);
    const text = [
      '你是电商套图 Agent，需要为用户生成一组可直接交给图片模型的电商套图板块提示词。',
      '必须输出 JSON 对象，不要 Markdown，不要额外解释。',
      'JSON 字段：promptPlans。未显式指定板块时，由你根据商品需求决定数组长度。',
      'promptPlans 每项字段：sectionKey、sectionName、title、prompt、negativePrompt、analysisSummary。',
      '产品图规则：产品图用于锁定真实主体、包装结构、颜色、材质、品牌识别、可辨识文字和 SKU 信息。',
      '参考图规则：参考图是允许模仿的对象。用户要求复刻/对标时，照参考图执行构图、光影、背景氛围、卖点表达和版式节奏；未要求复刻时，参考图用于迁移上述视觉结构。无论哪种情况，都不要把参考图里的其他品牌、产品或文字替换进来，最终画面只出现用户自己的产品。',
      '合规规则：不要虚构价格、认证、功效、活动标签、二维码、水印或参考图里没有且用户没要求的文字；不要生成乱码文字和畸形产品。',
      `设计师 skill：${context.skill?.name || 'Gloria'}。`,
      skillMarkdown ? `设计师 Markdown：\n${skillMarkdown}` : '设计师 Markdown：无。',
      `品牌名：${context.brandName || '未填写'}`,
      `平台：${context.platform || '拼多多'}；国家：${context.country || '中国'}；语言：${context.language || '中文'}；比例：${context.ratio || '1:1'}；清晰度：${context.quality || '1k'}`,
      productLabels.length ? `产品图顺序：${productLabels.join('、')}` : '产品图顺序：无。',
      referenceLabels.length ? `参考图顺序：${referenceLabels.join('、')}` : '参考图顺序：无。',
      `用户产品信息和需求：${context.requirement || '生成一组高质量电商套图。'}`,
      `板块生成规则：\n${sectionRule}`
    ].join('\n');

    if (!references.length) return text;
    return [{
      role: 'user',
      content: [
        { type: 'input_text', text },
        ...references.map(item => ({
          type: 'input_image',
          image_url: item.dataUrl
        }))
      ]
    }];
  }

  function mockEcommerceSuitePromptPlans(context = {}, referenceCount = 0) {
    const sections = ecommerceSuiteDynamicFallbackSections(context);
    return sections.map((section, index) => {
      const base = [
        `板块：${section.name}。`,
        context.brandName ? `品牌：${context.brandName}。` : '',
        `平台：${context.platform}，国家：${context.country}，语言：${context.language}，比例：${context.ratio}，清晰度：${context.quality.toUpperCase()}。`,
        referenceCount > 0 ? `参考输入包含 ${referenceCount} 张图片，请严格保留产品图中的主体、包装、颜色、材质、Logo、产品名和关键文字。` : '未提供参考图片时，根据用户描述生成清晰可信的商品视觉。',
        section.promptGuide || section.description || '',
        `用户需求：${context.requirement || '生成高质量电商套图。'}`,
        `设计师风格：${context.skill?.name || 'Gloria'}，${context.skill?.description || ''}。`,
        '画面要求：商品主体清晰，电商转化导向，商业摄影级光影，真实材质，版式干净高级。',
        '负面约束：不要乱码、水印、二维码、畸形产品、多余主体、虚构价格、虚构认证或夸大功效。'
      ].filter(Boolean).join('\n');
      return {
        id: `${section.key}_${index + 1}`,
        sectionKey: section.key,
        sectionName: section.name,
        title: section.name,
        prompt: base,
        negativePrompt: '乱码文字，水印，二维码，畸形产品，多余主体，虚构价格，虚构认证，夸大功效，低清晰度，脏污背景',
        analysisSummary: `已按 ${section.name} 生成提示词，将优先保持产品识别并迁移参考图的构图和电商表现。`,
        selected: index === 0
      };
    });
  }

  function ecommerceSuiteDynamicFallbackSections(context = {}) {
    if (Array.isArray(context.sections) && context.sections.length) return context.sections.slice(0, 5);
    const requirement = String(context.requirement || '');
    const sections = [
      {
        key: 'conversion-visual',
        name: '转化主视觉',
        promptGuide: '用最能打动目标买家的画面建立第一眼购买理由。'
      },
      {
        key: 'product-trust',
        name: '产品信任图',
        promptGuide: '突出真实产品识别、包装质感、材质细节和可信信息。'
      },
      {
        key: 'benefit-logic',
        name: '利益点拆解',
        promptGuide: '围绕用户需求拆出清晰可感知的核心利益，不虚构功效。'
      },
      {
        key: 'usage-moment',
        name: '使用瞬间图',
        promptGuide: '让买家理解产品在真实生活或消费场景中的价值。'
      }
    ];
    if (/成分|结构|科技|工艺|材质|原理|解析/.test(requirement)) {
      sections.splice(2, 0, {
        key: 'material-breakdown',
        name: '结构解析图',
        promptGuide: '克制呈现结构、成分、工艺或材质逻辑，避免伪科学表达。'
      });
    }
    if (/包装|礼盒|送礼|套装|规格/.test(requirement)) {
      sections.splice(3, 0, {
        key: 'package-value',
        name: '包装价值图',
        promptGuide: '突出包装、规格、组合感和送礼/陈列价值。'
      });
    }
    return sections.slice(0, 5).map((section, index) => ({
      ...section,
      description: section.promptGuide,
      enabled: true,
      sort: index + 1
    }));
  }

  function normalizeEcommerceSuitePromptPlan(raw = {}, section = {}, fallback = {}) {
    const prompt = String(raw.prompt || raw.text || raw.finalPrompt || fallback.prompt || '').trim();
    const negativePrompt = String(raw.negativePrompt || raw.negative_prompt || fallback.negativePrompt || '').trim();
    const title = String(raw.title || raw.label || raw.sectionName || raw.section_name || section.name || fallback.title || fallback.sectionName || '').trim();
    const sectionName = String(raw.sectionName || raw.section_name || section.name || fallback.sectionName || title).trim();
    const sectionKey = cleanSettingKey(
      raw.sectionKey || raw.section_key || section.key || fallback.sectionKey || sectionName || title,
      fallback.sectionKey || section.key || cleanSettingKey(title, 'section')
    );
    return {
      id: String(raw.id || fallback.id || section.key || uid('suite_plan_')),
      sectionKey,
      sectionName,
      title: title || sectionName,
      prompt,
      negativePrompt,
      analysisSummary: String(raw.analysisSummary || raw.analysis_summary || raw.summary || fallback.analysisSummary || summarizeText(prompt, 160)).trim(),
      selected: raw.selected !== false
    };
  }

  function parseEcommerceSuitePromptPlans(providerResult = {}, context = {}, referenceCount = 0) {
    const text = imageToolOutputText(providerResult);
    const parsed = parseJsonObjectFromText(text);
    const rawPlans = Array.isArray(parsed?.promptPlans) ? parsed.promptPlans
      : Array.isArray(parsed?.plans) ? parsed.plans
        : Array.isArray(parsed?.sections) ? parsed.sections
          : [];
    const fallbackPlans = mockEcommerceSuitePromptPlans(context, referenceCount);
    if (rawPlans.length) {
      return rawPlans.slice(0, 5).map((raw, index) => {
        const fallback = fallbackPlans[index] || {
          id: `section-${index + 1}`,
          sectionKey: `section-${index + 1}`,
          sectionName: `板块 ${index + 1}`,
          title: `板块 ${index + 1}`,
          prompt: '',
          negativePrompt: '',
          analysisSummary: ''
        };
        const section = { key: fallback.sectionKey, name: fallback.sectionName };
        const normalized = normalizeEcommerceSuitePromptPlan(raw, section, fallback);
        return normalized.prompt ? normalized : fallback;
      }).filter(plan => plan.prompt);
    }
    return fallbackPlans.map((fallback, index) => {
      const section = {
        key: fallback.sectionKey || fallback.key || `section-${index + 1}`,
        name: fallback.sectionName || fallback.name || fallback.title || `板块 ${index + 1}`
      };
      const raw = rawPlans.find(item => cleanSettingKey(item?.sectionKey || item?.section_key) === section.key)
        || rawPlans.find(item => String(item?.sectionName || item?.section_name || item?.title || '').trim() === section.name)
        || rawPlans[index]
        || {};
      const normalized = normalizeEcommerceSuitePromptPlan(raw, section, fallback);
      return normalized.prompt ? normalized : fallback;
    });
  }

  function ecommerceSuiteGenerationPrompt(plan = {}, context = {}) {
    return [
      `套图板块：${plan.sectionName || plan.title || plan.sectionKey}`,
      plan.prompt,
      plan.negativePrompt ? `避免：${plan.negativePrompt}` : '',
      `输出要求：生成一张适合 ${context.platform || '电商平台'} 使用的${plan.sectionName || '电商套图'}，比例 ${context.ratio || '1:1'}，语言 ${context.language || '中文'}。`
    ].filter(Boolean).join('\n');
  }

  app.get('/api/canvas/ecommerce-suite/config', (req, res) => {
    const config = ecommerceSuitePublicConfig();
    const defaults = config.defaults || defaultEcommerceSuiteAgent.defaults;
    const imageModel = resolveImageModelKey({ imageModelKey: defaults.imageModelKey || AI_IMAGE_MODEL });
    const textModel = String(defaults.textModelKey || AI_TEXT_MODEL).trim();
    res.json({
      success: true,
      enabled: config.enabled !== false,
      sectionMode: config.sectionMode || 'dynamic',
      sections: config.sections,
      skills: config.skills,
      defaultSkillId: config.defaultSkillId,
      defaults,
      textModel,
      imageModel,
      analysisCost: modelCost(textModel, 'text'),
      estimatedImageCostPerSection: modelCost(imageModel, 'image') * Math.max(1, Math.min(Number(defaults.imageCount || 1) || 1, 4))
    });
  });

  app.post('/api/canvas/ecommerce-suite/prompts', auth, async (req, res) => {
    const body = req.body || {};
    const config = ecommerceSuiteAgentConfig();
    if (config.enabled === false) {
      return res.status(403).json({ success: false, code: 'ECOMMERCE_SUITE_DISABLED', message: '电商套图 Agent 暂未启用' });
    }

    const context = ecommerceSuiteContextFromBody(body, config);
    const buckets = ecommerceSuiteImageBuckets(body);
    if (!buckets.productImages.length) {
      return res.status(400).json({ success: false, code: 'ECOMMERCE_SUITE_PRODUCT_IMAGE_REQUIRED', message: '请先上传产品图' });
    }
    if (!context.requirement && buckets.all.length <= 0) {
      return res.status(400).json({ success: false, code: 'ECOMMERCE_SUITE_INPUT_REQUIRED', message: '请输入产品信息或上传产品图/参考图' });
    }

    const u = db.prepare('SELECT * FROM users WHERE id=?').get(req.user.userId);
    if (!u) return res.status(401).json({ success: false, code: 'AUTH_USER_NOT_FOUND', message: '登录状态已失效，请重新登录' });

    const textRoute = resolveTextRoute(body);
    const imageRoute = resolveImageRoute(body, req.user.userId);
    const textModel = String(body.textModel || body.textModelKey || textRoute?.dm || AI_TEXT_MODEL).trim();
    const imageModel = resolveImageModelKey({ ...body, model: body.imageModel || body.imageModelKey || body.model || imageRoute?.dm || AI_IMAGE_MODEL });
    const analysisCost = modelCost(textModel, 'text');
    const estimatedImageCostPerSection = modelCost(imageModel, 'image') * context.imageCount;
    if (u.balance < analysisCost) {
      return res.status(400).json({ success: false, code: 'INSUFFICIENT_BALANCE', message: `算力不足，需要 ${analysisCost}，当前 ${u.balance}`, analysisCost });
    }

    let references = [];
    try {
      references = await ecommerceSuiteReferencesForAnalysis(body, req);
    } catch (error) {
      return res.status(400).json({ success: false, code: 'ECOMMERCE_SUITE_REFERENCE_UNREADABLE', message: error.message || '图片读取失败' });
    }

    const input = buildEcommerceSuitePromptInput(context, references);
    const textResult = await callProviderResponses(input, {
      route: textRoute,
      model: textModel,
      timeoutMs: CANVAS_DIALOG_ANALYSIS_TIMEOUT_MS
    });
    if (!textResult.success) {
      return res.status(502).json({
        success: false,
        code: textResult.code || 'ECOMMERCE_SUITE_PROMPT_FAILED',
        message: textResult.message || '套图提示词生成失败，请稍后重试',
        stage: 'prompt',
        provider: textResult.provider,
        analysisCost,
        estimatedImageCostPerSection
      });
    }

    const promptPlans = parseEcommerceSuitePromptPlans(textResult, context, references.length);
    if (!promptPlans.length) {
      return res.status(502).json({
        success: false,
        code: 'ECOMMERCE_SUITE_PROMPT_EMPTY',
        message: '套图板块生成失败，请补充产品信息后重试',
        stage: 'prompt',
        provider: textResult.provider,
        analysisCost,
        estimatedImageCostPerSection
      });
    }
    const nb = u.balance - analysisCost;
    db.prepare('UPDATE users SET balance=? WHERE id=?').run(nb, u.id);
    balanceService.recordBalanceLog(u.id, 'generation', -analysisCost, u.balance, nb, `电商套图提示词: ${textModel} x${promptPlans.length}`);

    res.json({
      success: true,
      mock: !!textResult.mock,
      provider: textResult.provider,
      promptPlans,
      sectionMode: 'dynamic',
      sections: promptPlans.map(plan => ({
        key: plan.sectionKey,
        name: plan.sectionName || plan.title
      })),
      skill: { id: context.skill.id, name: context.skill.name, avatarUrl: context.skill.avatarUrl, description: context.skill.description },
      analysisCost,
      estimatedImageCostPerSection,
      textModel,
      imageModel,
      textRouteId: textRoute?.id || textRoute?.routeId || '',
      imageRouteId: imageRoute?.id || imageRoute?.routeId || '',
      remainingBalance: nb
    });
  });

  app.post('/api/canvas/ecommerce-suite/generate', auth, async (req, res) => {
    const body = req.body || {};
    const config = ecommerceSuiteAgentConfig();
    if (config.enabled === false) {
      return res.status(403).json({ success: false, code: 'ECOMMERCE_SUITE_DISABLED', message: '电商套图 Agent 暂未启用' });
    }

    const context = ecommerceSuiteContextFromBody(body, config);
    const plans = (Array.isArray(body.promptPlans) ? body.promptPlans
      : Array.isArray(body.plans) ? body.plans
        : Array.isArray(body.selectedPlans) ? body.selectedPlans
          : [])
      .map((plan, index) => normalizeEcommerceSuitePromptPlan(plan, context.sections[index] || {}, {}))
      .filter(plan => plan.prompt)
      .slice(0, 5);
    if (!plans.length) {
      return res.status(400).json({ success: false, code: 'ECOMMERCE_SUITE_PROMPT_PLAN_REQUIRED', message: '请选择至少一个已生成的板块提示词' });
    }

    const buckets = ecommerceSuiteImageBuckets(body);
    if (!buckets.productImages.length) {
      return res.status(400).json({ success: false, code: 'ECOMMERCE_SUITE_PRODUCT_IMAGE_REQUIRED', message: '请先上传产品图' });
    }
    const hasReferenceImages = buckets.all.length > 0;
    const u = db.prepare('SELECT * FROM users WHERE id=?').get(req.user.userId);
    if (!u) return res.status(401).json({ success: false, code: 'AUTH_USER_NOT_FOUND', message: '登录状态已失效，请重新登录' });

    const imageRoute = resolveImageRoute(body, req.user.userId);
    const imageModel = resolveImageModelKey({ ...body, model: body.imageModel || body.imageModelKey || body.model || imageRoute?.dm || AI_IMAGE_MODEL });
    const imageCost = modelCost(imageModel, 'image') * context.imageCount * plans.length;
    if (u.balance < imageCost) {
      return res.status(400).json({ success: false, code: 'INSUFFICIENT_BALANCE', message: `算力不足，需要 ${imageCost}，当前 ${u.balance}`, imageCost });
    }

    const results = [];
    const providers = [];
    const providerRequests = [];
    const usedPlanPrompts = [];
    for (const plan of plans) {
      const basePrompt = ecommerceSuiteGenerationPrompt(plan, context);
      const prompt = buildEcommerceImagePrompt(basePrompt, {
        body: {
          ...body,
          referenceImages: buckets.all
        },
        hasReferenceImages,
        referenceCount: buckets.all.length
      });
      usedPlanPrompts.push({ plan, prompt });
      const providerOptions = {
        ...body,
        body: {
          ...body,
          referenceImages: buckets.all
        },
        req,
        route: imageRoute,
        model: imageModel,
        modelKey: imageModel,
        n: context.imageCount,
        imageCount: context.imageCount,
        ratio: context.ratio,
        size: context.ratio,
        quality: context.quality,
        clarity: context.quality
      };
      const imageResult = hasReferenceImages
        ? await callProviderImageEdit(prompt, providerOptions)
        : await callProviderImageGeneration(prompt, providerOptions);
      providers.push(imageResult.provider);
      if (imageResult.request) providerRequests.push(imageResult.request);
      if (!imageResult.success) {
        return res.status(502).json({
          success: false,
          code: imageResult.code || 'ECOMMERCE_SUITE_IMAGE_FAILED',
          message: imageResult.message || `${plan.sectionName || '套图板块'} 生图失败，请稍后重试`,
          provider: imageResult.provider,
          sectionKey: plan.sectionKey,
          sectionName: plan.sectionName,
          imageCost
        });
      }
      imageResult.images.forEach((image, index) => {
        results.push({
          ...image,
          providerRequest: imageResult.request,
          sectionKey: plan.sectionKey,
          sectionName: plan.sectionName,
          title: plan.title || plan.sectionName,
          prompt,
          negativePrompt: plan.negativePrompt || '',
          meta: {
            ...(image.meta || {}),
            sectionKey: plan.sectionKey,
            sectionName: plan.sectionName,
            operation: 'canvas-ecommerce-suite-agent'
          },
          id: image.id || `${plan.sectionKey}_${index + 1}`
        });
      });
    }

    const persistedResults = await persistProviderImageResults(results);
    const task = createCompletedTask(req, {
      prompt: plans.map(plan => `${plan.sectionName}: ${plan.prompt}`).join('\n\n'),
      finalPrompt: usedPlanPrompts.map(item => item.prompt).join('\n\n---\n\n'),
      analysisSummary: `已生成 ${plans.length} 个电商套图板块。`,
      modelKey: imageModel,
      imageCount: Math.max(1, results.length),
      results: persistedResults,
      cost: imageCost,
      totalCost: imageCost,
      imageCost,
      request: providerRequests.length === 1 ? providerRequests[0] : providerRequests,
      operation: 'canvas-ecommerce-suite-agent',
      source: 'canvas-ecommerce-suite-agent'
    });
    const nb = u.balance - imageCost;
    db.prepare('UPDATE users SET balance=? WHERE id=?').run(nb, u.id);
    balanceService.recordBalanceLog(u.id, 'generation', -imageCost, u.balance, nb, `电商套图生图: ${imageModel} x${results.length}`);

    res.json({
      success: true,
      mock: providers.some(provider => provider && provider.mode === 'mock'),
      provider: providers[providers.length - 1] || null,
      imageModel,
      imageRouteId: imageRoute?.id || imageRoute?.routeId || '',
      images: task.images.map((image, index) => ({
        ...image,
        sectionKey: results[index]?.sectionKey || '',
        sectionName: results[index]?.sectionName || '',
        prompt: results[index]?.prompt || image.prompt || ''
      })),
      resultImages: task.images,
      totalCost: imageCost,
      imageCost,
      request: providerRequests.length === 1 ? providerRequests[0] : providerRequests,
      providerRequest: providerRequests.length === 1 ? providerRequests[0] : providerRequests,
      remainingBalance: nb,
      taskId: task.id,
      id: task.id,
      status: 'success',
      progress: 100
    });
  });
}

module.exports = { registerEcommerceSuiteRoutes };
