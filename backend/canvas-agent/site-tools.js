'use strict';

function siteToolError(status, code, message) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}

function parseJson(value, fallback = {}) {
  if (!value) return fallback;
  try {
    return typeof value === 'string' ? JSON.parse(value) : value;
  } catch {
    return fallback;
  }
}

function paginate(input, total, defaultSize = 20) {
  const pageSize = Math.max(1, Math.min(100, Math.floor(Number(input.pageSize)) || defaultSize));
  const maxPage = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(maxPage, Math.max(1, Math.floor(Number(input.page)) || 1));
  const start = (page - 1) * pageSize;
  return { page, pageSize, start, end: start + pageSize };
}

function createCanvasAgentSiteTools(options = {}) {
  const db = options.db;
  const generationTaskService = options.generationTaskService;
  const promptService = options.promptService;
  const assetService = options.assetService;
  const listRoutes = options.listRoutes;
  const listModels = options.listModels;
  const submitGeneration = options.submitGeneration;
  const describeAssetImage = options.describeAssetImage;
  if (!db) throw new TypeError('Canvas Agent 站点工具缺少 db');
  if (!generationTaskService) throw new TypeError('Canvas Agent 站点工具缺少 generationTaskService');
  if (!promptService) throw new TypeError('Canvas Agent 站点工具缺少 promptService');
  if (!assetService) throw new TypeError('Canvas Agent 站点工具缺少 assetService');
  if (typeof listRoutes !== 'function' || typeof listModels !== 'function') {
    throw new TypeError('Canvas Agent 站点工具缺少线路/模型读取器');
  }
  if (typeof submitGeneration !== 'function') throw new TypeError('Canvas Agent 站点工具缺少持久生图提交器');

  function listCanvasProjects(userId, input) {
    const keyword = String(input.keyword || '').trim().toLowerCase();
    const rows = db.prepare(`
      SELECT id,name,data,created_at,updated_at
      FROM projects
      WHERE user_id=?
      ORDER BY updated_at DESC
    `).all(userId);
    const filtered = rows.filter((row) => !keyword || String(row.name || '').toLowerCase().includes(keyword));
    const page = paginate(input, filtered.length);
    const items = filtered.slice(page.start, page.end).map((row) => {
      const data = parseJson(row.data, {});
      const workflow = data.workflowJson || data.workflowData || data.canvasData || data.workflow || data;
      return {
        id: row.id,
        title: row.name || '未命名画布',
        createdAt: row.created_at || '',
        updatedAt: row.updated_at || '',
        nodeCount: Array.isArray(workflow.nodes) ? workflow.nodes.length : 0,
        connectionCount: Array.isArray(workflow.connections)
          ? workflow.connections.length
          : (Array.isArray(workflow.edges) ? workflow.edges.length : 0)
      };
    });
    return { total: filtered.length, page: page.page, pageSize: page.pageSize, items };
  }

  function generationStatus(userId, input) {
    const taskId = String(input.taskId || '');
    const limit = Math.max(1, Math.min(100, Number(input.limit) || 20));
    const tasks = generationTaskService.listTasks(500)
      .filter((task) => task.userId === userId && (!taskId || task.id === taskId))
      .slice(0, limit)
      .map((task) => ({
        id: task.id,
        status: task.status,
        stage: task.stage,
        progress: Number(task.progress || 0),
        modelKey: task.modelKey,
        billingStatus: task.billingStatus,
        reservedCost: Number(task.reservedCost || 0),
        settledCost: Number(task.settledCost || 0),
        errorCode: task.errorCode || '',
        errorMessage: task.errorMessage || '',
        imageCount: Number(task.imageCount || 0),
        successCount: Array.isArray(task.images) ? task.images.length : 0,
        images: (Array.isArray(task.images) ? task.images : []).map((image) => ({
          assetId: image.assetId || '',
          url: image.accessUrl || image.url || ''
        })),
        createdAt: task.createdAt,
        updatedAt: task.updatedAt
      }));
    const summary = { pending: 0, running: 0, success: 0, failed: 0, cancelled: 0 };
    tasks.forEach((task) => {
      if (summary[task.status] !== undefined) summary[task.status] += 1;
    });
    return { total: tasks.length, summary, tasks };
  }

  async function imageConfig(userId) {
    const routes = (await listRoutes(userId, 'image')).filter((route) => route.enabled !== false);
    const selected = routes.find((route) => route.isDefault) || routes[0] || null;
    const models = selected ? (await listModels(userId, selected.id)).filter((model) => model.enabled !== false) : [];
    return {
      enabled: Boolean(selected && models.length),
      selectedRouteId: selected?.id || '',
      defaultModelKey: selected?.defaultModelKey || models[0]?.modelKey || '',
      routes,
      models,
      countRange: { min: 1, max: 4 },
      ratios: ['1:1', '3:4', '4:3', '9:16', '16:9'],
      qualities: ['1K', '2K', '4K']
    };
  }

  async function searchPrompts(userId, input) {
    const keyword = String(input.keyword || '').trim().toLowerCase();
    const category = String(input.category || '').trim();
    const requestedTags = Array.isArray(input.tags) ? input.tags.map((tag) => String(tag)) : [];
    const page = paginate(input, 200, 20);
    const query = {
      q: keyword,
      category,
      limit: Math.min(100, page.pageSize * 2)
    };
    const [system, user] = await Promise.all([
      Promise.resolve(promptService.listPublishedSystemPrompts(query)),
      Promise.resolve(promptService.listUserPrompts(userId, query))
    ]);
    const normalize = (item, scope) => ({
      id: item.id,
      scope,
      title: item.title,
      prompt: item.content,
      category: item.category || '',
      tags: Array.isArray(item.tags) ? item.tags : [],
      updatedAt: item.updatedAt || ''
    });
    const items = [
      ...(system.items || []).map((item) => normalize(item, 'system')),
      ...(user.items || []).map((item) => normalize(item, 'user'))
    ].filter((item) => {
      const text = `${item.title} ${item.prompt}`.toLowerCase();
      if (keyword && !text.includes(keyword)) return false;
      if (category && item.category !== category) return false;
      if (requestedTags.length && !requestedTags.every((tag) => item.tags.includes(tag))) return false;
      return true;
    });
    const actual = paginate(input, items.length, 20);
    return {
      total: items.length,
      page: actual.page,
      pageSize: actual.pageSize,
      items: items.slice(actual.start, actual.end)
    };
  }

  async function listAssets(userId, input) {
    const result = assetService.listAssets(userId, {
      q: input.keyword,
      kind: input.kind && input.kind !== 'all' ? input.kind : undefined,
      limit: Math.max(1, Math.min(100, Number(input.pageSize) || 20))
    });
    const items = await Promise.all((result.items || []).map(async (asset) => {
      const access = await assetService.createAccessUrl(userId, asset.id);
      return {
        id: asset.id,
        kind: asset.kind,
        name: asset.name,
        tags: asset.tags || [],
        source: asset.source || '',
        mimeType: asset.mimeType || '',
        width: asset.width || null,
        height: asset.height || null,
        createdAt: asset.createdAt || '',
        updatedAt: asset.updatedAt || '',
        accessUrl: access.url
      };
    }));
    return { items, nextCursor: result.nextCursor || null };
  }

  async function addExistingAsset(userId, input) {
    const assetId = String(input.assetId || '').trim();
    if (!assetId) {
      throw siteToolError(
        400,
        'CANVAS_AGENT_ASSET_UPLOAD_REQUIRED',
        '请先在 Agent 输入区上传图片，再使用返回的 assetId 保存或插入画布'
      );
    }
    assetService.getAsset(userId, assetId);
    const patch = {
      name: String(input.title || '').trim() || '未命名素材',
      tags: Array.isArray(input.tags) ? input.tags.map((tag) => String(tag)) : []
    };
    const asset = assetService.updateAsset(userId, assetId, patch);
    const access = await assetService.createAccessUrl(userId, asset.id);
    return { ok: true, asset: { ...asset, accessUrl: access.url } };
  }

  async function submitImage(input) {
    if (input.input.run === false) {
      return { ok: true, submitted: false, config: input.input };
    }
    const result = await submitGeneration({
      userId: input.userId,
      projectId: input.projectId,
      sessionId: input.sessionId,
      browserSessionId: input.browserSessionId,
      callId: input.callId,
      idempotencyKey: `agent_${input.callId}`.slice(0, 128),
      body: {
        prompt: input.input.prompt,
        model: input.input.model,
        size: input.input.size,
        quality: input.input.quality,
        imageCount: Math.max(1, Math.min(4, Number(input.input.count) || 1))
      }
    });
    const task = result.task || result;
    return {
      ok: true,
      submitted: true,
      taskId: task.id || task.taskId,
      status: task.status,
      stage: task.stage,
      replayed: Boolean(result.replayed),
      remainingBalance: result.remainingBalance
    };
  }

  async function execute(input) {
    switch (input.name) {
      case 'canvas_list_projects':
        return listCanvasProjects(input.userId, input.input || {});
      case 'generation_get_status':
        return generationStatus(input.userId, input.input || {});
      case 'workbench_image_get_config':
        return imageConfig(input.userId);
      case 'workbench_image_generate':
        return submitImage(input);
      case 'workbench_video_get_config':
        return { enabled: false, message: '当前服务端尚未开放视频生成' };
      case 'workbench_video_generate':
        throw siteToolError(501, 'CANVAS_AGENT_VIDEO_NOT_AVAILABLE', '当前服务端尚未开放视频生成');
      case 'prompts_search':
        return searchPrompts(input.userId, input.input || {});
      case 'assets_list':
        return listAssets(input.userId, input.input || {});
      case 'assets_add':
        return addExistingAsset(input.userId, input.input || {});
      case 'canvas_describe_attachment':
        if (typeof describeAssetImage !== 'function') throw siteToolError(501, 'CANVAS_AGENT_DESCRIBE_NOT_AVAILABLE', '附件内容分析暂不可用');
        return describeAssetImage(input.userId, input.input || {});
      default:
        throw siteToolError(400, 'CANVAS_AGENT_SITE_TOOL_UNKNOWN', `未知站点工具：${input.name}`);
    }
  }

  return { execute };
}

module.exports = {
  createCanvasAgentSiteTools,
  siteToolError
};
