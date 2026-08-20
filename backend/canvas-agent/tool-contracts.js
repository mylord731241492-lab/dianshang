'use strict';

// 画布工具契约移植自 Infinite Canvas v0.10.0：
// canvas-agent/src/schemas.ts、tools.ts、canvas-session.ts。
// 本文件只保留 MCP 工具 schema 与浏览器执行语义，不包含本地 Codex 驱动。

const { z } = require('zod');
const { zodToJsonSchema } = require('zod-to-json-schema');

const recordSchema = z.record(z.unknown());
const positionSchema = z.object({ x: z.number(), y: z.number() });
const viewportSchema = z.object({ x: z.number(), y: z.number(), k: z.number() });
const nodeTypeSchema = z.enum(['image', 'text', 'config', 'video', 'audio']);
const generationModeSchema = z.enum(['text', 'image', 'video', 'audio']);

const canvasOpSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('add_node'), nodeType: nodeTypeSchema.optional(), id: z.string().optional(), title: z.string().optional(), x: z.number().optional(), y: z.number().optional(), width: z.number().optional(), height: z.number().optional(), position: positionSchema.optional(), metadata: recordSchema.optional() }).passthrough(),
  z.object({ type: z.literal('update_node'), id: z.string(), patch: recordSchema.optional(), metadata: recordSchema.optional() }).passthrough(),
  z.object({ type: z.literal('delete_node'), id: z.string().optional(), ids: z.array(z.string()).optional(), nodeType: nodeTypeSchema.optional() }).passthrough(),
  z.object({ type: z.literal('delete_connections'), id: z.string().optional(), ids: z.array(z.string()).optional(), all: z.boolean().optional() }).passthrough(),
  z.object({ type: z.literal('connect_nodes'), id: z.string().optional(), fromNodeId: z.string(), toNodeId: z.string() }).passthrough(),
  z.object({ type: z.literal('set_viewport'), viewport: viewportSchema }).passthrough(),
  z.object({ type: z.literal('select_nodes'), ids: z.array(z.string()) }).passthrough(),
  z.object({ type: z.literal('run_generation'), nodeId: z.string(), mode: generationModeSchema.optional(), prompt: z.string().optional(), clientRequestId: z.string().optional() }).passthrough(),
  z.object({ type: z.literal('reverse_prompt'), nodeId: z.string() }).passthrough()
]);

const textNodeSchema = z.object({
  text: z.string(),
  title: z.string().optional(),
  x: z.number().optional(),
  y: z.number().optional(),
  width: z.number().optional(),
  height: z.number().optional()
});

const generationOptionsSchema = z.object({
  model: z.string().optional(),
  size: z.string().optional(),
  quality: z.string().optional(),
  count: z.number().optional(),
  seconds: z.string().optional(),
  vquality: z.string().optional(),
  generateAudio: z.string().optional(),
  watermark: z.string().optional(),
  audioVoice: z.string().optional(),
  audioFormat: z.string().optional(),
  audioSpeed: z.string().optional(),
  audioInstructions: z.string().optional()
});

const generationFlowSchema = z.object({
  prompt: z.string(),
  title: z.string().optional(),
  x: z.number().optional(),
  y: z.number().optional(),
  referenceNodeIds: z.array(z.string()).optional()
});

const toolInputSchemas = {
  site_navigate: z.object({ path: z.string() }),
  canvas_list_projects: z.object({ keyword: z.string().optional(), page: z.number().optional(), pageSize: z.number().optional() }),
  canvas_get_state: z.object({}).passthrough(),
  canvas_get_selection: z.object({}).passthrough(),
  canvas_export_snapshot: z.object({}).passthrough(),
  canvas_apply_ops: z.object({ ops: z.array(canvasOpSchema) }),
  canvas_create_node: z.object({ nodeType: nodeTypeSchema, title: z.string().optional(), x: z.number().optional(), y: z.number().optional(), width: z.number().optional(), height: z.number().optional(), metadata: recordSchema.optional() }),
  canvas_create_attachment_nodes: z.object({ attachmentIds: z.array(z.string()).min(1), x: z.number().optional(), y: z.number().optional(), gap: z.number().optional(), direction: z.enum(['row', 'column']).optional() }),
  canvas_create_text_node: z.object({ text: z.string().optional(), x: z.number().optional(), y: z.number().optional(), title: z.string().optional(), width: z.number().optional(), height: z.number().optional() }),
  canvas_create_text_nodes: z.object({ items: z.array(textNodeSchema).min(1), x: z.number().optional(), y: z.number().optional(), gap: z.number().optional(), direction: z.enum(['row', 'column']).optional() }),
  canvas_create_config_node: z.object({ prompt: z.string().optional(), mode: generationModeSchema.optional(), title: z.string().optional(), x: z.number().optional(), y: z.number().optional(), width: z.number().optional(), height: z.number().optional(), autoRun: z.boolean().optional() }).merge(generationOptionsSchema),
  canvas_create_image_prompt_flow: z.object({ prompt: z.string(), x: z.number().optional(), y: z.number().optional(), autoRun: z.boolean().optional() }).merge(generationOptionsSchema),
  canvas_create_generation_flow: generationFlowSchema.extend({ mode: generationModeSchema.optional(), autoRun: z.boolean().optional() }).merge(generationOptionsSchema),
  canvas_generate_text: generationFlowSchema.merge(generationOptionsSchema),
  canvas_generate_image: generationFlowSchema.merge(generationOptionsSchema),
  canvas_generate_video: generationFlowSchema.merge(generationOptionsSchema),
  canvas_generate_audio: generationFlowSchema.merge(generationOptionsSchema),
  canvas_update_node: z.object({ id: z.string(), patch: recordSchema.optional(), metadata: recordSchema.optional() }),
  canvas_update_node_text: z.object({ id: z.string(), text: z.string(), title: z.string().optional() }),
  canvas_move_nodes: z.object({ items: z.array(z.object({ id: z.string(), x: z.number().optional(), y: z.number().optional(), dx: z.number().optional(), dy: z.number().optional() })).min(1) }),
  canvas_resize_node: z.object({ id: z.string(), width: z.number(), height: z.number(), freeResize: z.boolean().optional() }),
  canvas_delete_nodes: z.object({ ids: z.array(z.string()).min(1) }),
  canvas_connect_nodes: z.object({ connections: z.array(z.object({ fromNodeId: z.string(), toNodeId: z.string() })).min(1) }),
  canvas_select_nodes: z.object({ ids: z.array(z.string()) }),
  canvas_set_viewport: z.object({ viewport: viewportSchema }),
  canvas_run_generation: z.object({ nodeId: z.string(), mode: generationModeSchema.optional(), prompt: z.string().optional() }),
  canvas_reverse_image_prompt: z.object({ nodeId: z.string().optional() }),
  canvas_describe_attachment: z.object({ attachmentId: z.string() }),
  generation_get_status: z.object({ scope: z.enum(['all', 'canvas', 'image', 'video']).optional(), taskId: z.string().optional(), nodeIds: z.array(z.string()).optional(), limit: z.number().optional() }),
  workbench_image_get_config: z.object({}).passthrough(),
  workbench_image_generate: z.object({ prompt: z.string(), model: z.string().optional(), quality: z.string().optional(), size: z.string().optional(), count: z.number().optional(), run: z.boolean().optional() }),
  workbench_video_get_config: z.object({}).passthrough(),
  workbench_video_generate: z.object({ prompt: z.string(), model: z.string().optional(), size: z.string().optional(), seconds: z.string().optional(), resolution: z.string().optional(), generateAudio: z.boolean().optional(), watermark: z.boolean().optional(), run: z.boolean().optional() }),
  prompts_search: z.object({ keyword: z.string().optional(), category: z.string().optional(), tags: z.array(z.string()).optional(), page: z.number().optional(), pageSize: z.number().optional() }),
  assets_list: z.object({ kind: z.enum(['all', 'image', 'video', 'audio']).optional(), keyword: z.string().optional(), page: z.number().optional(), pageSize: z.number().optional() }),
  assets_add: z.object({ kind: z.enum(['image']), title: z.string(), imageUrl: z.string().optional(), assetId: z.string().optional(), tags: z.array(z.string()).optional(), source: z.string().optional(), note: z.string().optional() })
};

const toolDescriptions = {
  site_navigate: '跳转站内页面。path 只允许同源站内路径。',
  canvas_list_projects: '列出当前用户的画布项目，支持关键词和分页。',
  canvas_get_state: '读取当前网页画布的节点、连线、选区和视口。',
  canvas_get_selection: '读取当前网页画布选中的节点。',
  canvas_export_snapshot: '导出当前画布的紧凑快照。',
  canvas_apply_ops: '批量操作画布，支持节点增删改、连线、选择、视口和触发生成。',
  canvas_create_node: '创建 text、image、config、video 或 audio 节点。image 是图片节点（只展示图片并作参考图），config 是生图节点（提示词、参数与生成结果都在本节点）。',
  canvas_create_attachment_nodes: '把本轮已上传到账号资产库的图片附件创建为画布图片节点。',
  canvas_create_text_node: '创建单个文本节点。',
  canvas_create_text_nodes: '批量创建文本节点。',
  canvas_create_config_node: '创建生图节点，提示词与参数直接写入本节点，可选择立即触发生成。',
  canvas_create_image_prompt_flow: '创建生图节点并写入提示词；需要参考图时改用带 referenceNodeIds 的生成工具并连接图片节点。',
  canvas_create_generation_flow: '创建文本、图片、视频或音频生成流程。图片模式只创建生图节点，提示词直接写入本节点。',
  canvas_generate_text: '创建文本生成流程并触发生成。',
  canvas_generate_image: '创建生图节点并触发持久生图任务；referenceNodeIds 用于把已有图片节点作为参考图连入。',
  canvas_generate_video: '创建视频生成流程并触发生成。',
  canvas_generate_audio: '创建音频生成流程并触发生成。',
  canvas_update_node: '更新节点字段或 metadata。',
  canvas_update_node_text: '更新文本节点内容与标题。',
  canvas_move_nodes: '移动一个或多个节点。',
  canvas_resize_node: '调整节点尺寸。',
  canvas_delete_nodes: '删除节点和相关连线。',
  canvas_connect_nodes: '连接一个或多个节点对。',
  canvas_select_nodes: '设置当前选中节点。',
  canvas_set_viewport: '调整画布视口。',
  canvas_run_generation: '触发指定节点生成；生图继续走服务端持久任务、计费和退款。',
  canvas_reverse_image_prompt: '对指定或当前选中的图片节点反推提示词，结果写入画布上的新文本节点。',
  canvas_describe_attachment: '分析指定附件图片的内容（主体、构图、风格、文字），返回文字描述；需要看懂某张附件图时使用；attachmentId 填消息附件列表中的 assetId（attachment_ 前缀亦可，服务端会自动去除）。',
  generation_get_status: '查询当前账号的持久生成任务状态。',
  workbench_image_get_config: '读取可用图片线路、模型与默认配置。',
  workbench_image_generate: '提交持久图片生成任务。',
  workbench_video_get_config: '读取视频生成配置；未开放时返回明确状态。',
  workbench_video_generate: '提交视频生成任务；未开放时返回明确错误。',
  prompts_search: '搜索默认提示词与当前账号私有提示词。',
  assets_list: '列出当前账号资产。',
  assets_add: '把本轮已上传图片加入账号资产库或更新其标题标签。'
};

const toolNames = Object.freeze(Object.keys(toolInputSchemas));
const READ_CANVAS_TOOLS = new Set(['canvas_get_state', 'canvas_get_selection', 'canvas_export_snapshot']);
const READ_SITE_TOOLS = new Set([
  'canvas_list_projects',
  'generation_get_status',
  'workbench_image_get_config',
  'workbench_video_get_config',
  'prompts_search',
  'assets_list',
  'canvas_describe_attachment'
]);
const WRITE_SITE_TOOLS = new Set(['workbench_image_generate', 'workbench_video_generate', 'assets_add']);

function jsonSchemaForTool(name) {
  const converted = zodToJsonSchema(toolInputSchemas[name], {
    name,
    $refStrategy: 'none',
    target: 'openApi3'
  });
  const schema = converted.definitions?.[name] || converted;
  const { $schema, definitions, ...parameters } = schema;
  return parameters;
}

function canvasAgentToolDefinitions() {
  return toolNames.map((name) => ({
    type: 'function',
    name,
    description: toolDescriptions[name],
    parameters: jsonSchemaForTool(name)
  }));
}

function parseToolInput(name, input) {
  if (!toolInputSchemas[name]) {
    const error = new Error(`未知 Agent 工具：${String(name)}`);
    error.status = 400;
    error.code = 'CANVAS_AGENT_TOOL_UNKNOWN';
    throw error;
  }
  const parsed = toolInputSchemas[name].safeParse(input ?? {});
  if (!parsed.success) {
    const error = new Error(`工具参数不合法：${parsed.error.issues.map((item) => item.message).join('；')}`);
    error.status = 400;
    error.code = 'CANVAS_AGENT_TOOL_INPUT_INVALID';
    throw error;
  }
  return parsed.data;
}

function compactNode(node) {
  const metadata = { ...(node?.metadata || {}) };
  delete metadata.content;
  delete metadata.dataUrl;
  if (typeof metadata.prompt === 'string' && metadata.prompt.length > 500) {
    metadata.prompt = `${metadata.prompt.slice(0, 500)}…`;
  }
  if (typeof metadata.composerContent === 'string' && metadata.composerContent.length > 500) {
    metadata.composerContent = `${metadata.composerContent.slice(0, 500)}…`;
  }
  return {
    id: String(node?.id || ''),
    type: String(node?.type || 'text'),
    title: String(node?.title || ''),
    position: node?.position || { x: 0, y: 0 },
    width: Number(node?.width) || 0,
    height: Number(node?.height) || 0,
    metadata
  };
}

function compactCanvasState(snapshot) {
  if (!snapshot || typeof snapshot !== 'object') {
    const error = new Error('当前没有可读取的画布快照');
    error.status = 409;
    error.code = 'CANVAS_AGENT_SNAPSHOT_REQUIRED';
    throw error;
  }
  return {
    projectId: String(snapshot.projectId || ''),
    title: String(snapshot.title || '未命名画布'),
    nodes: (Array.isArray(snapshot.nodes) ? snapshot.nodes : []).slice(0, 500).map(compactNode),
    connections: (Array.isArray(snapshot.connections) ? snapshot.connections : []).slice(0, 1000).map((item) => ({
      id: String(item?.id || ''),
      fromNodeId: String(item?.fromNodeId || ''),
      toNodeId: String(item?.toNodeId || '')
    })),
    selectedNodeIds: (Array.isArray(snapshot.selectedNodeIds) ? snapshot.selectedNodeIds : []).filter((id) => typeof id === 'string'),
    viewport: snapshot.viewport || { x: 0, y: 0, k: 1 }
  };
}

function nextCanvasX(snapshot) {
  const nodes = Array.isArray(snapshot?.nodes) ? snapshot.nodes : [];
  return nodes.length
    ? Math.max(...nodes.map((node) => Number(node?.position?.x || 0) + Number(node?.width || 0))) + 80
    : 0;
}

function cleanRecord(value) {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined && item !== ''));
}

function generationMode(value) {
  return value === 'text' || value === 'video' || value === 'audio' ? value : 'image';
}

function generationTitle(mode) {
  if (mode === 'text') return '文本生成';
  if (mode === 'video') return '视频生成';
  if (mode === 'audio') return '音频生成';
  return '生图节点';
}

function textNodeOp(input, x, y, idFactory) {
  return {
    type: 'add_node',
    id: input.id || idFactory('agent_text_'),
    nodeType: 'text',
    title: input.title || '文本',
    position: { x, y },
    width: input.width,
    height: input.height,
    metadata: { content: input.text || '', status: 'success', fontSize: 14 }
  };
}

function configNodeOp(id, input, x, y) {
  const mode = generationMode(input.mode);
  const prompt = String(input.prompt || '');
  return {
    type: 'add_node',
    id,
    nodeType: 'config',
    title: String(input.title || generationTitle(mode)),
    position: { x, y },
    width: typeof input.width === 'number' ? input.width : undefined,
    height: typeof input.height === 'number' ? input.height : undefined,
    metadata: cleanRecord({
      generationMode: mode,
      composerContent: prompt,
      prompt,
      status: 'idle',
      model: input.model,
      size: input.size,
      quality: input.quality,
      count: input.count,
      seconds: input.seconds,
      vquality: input.vquality,
      generateAudio: input.generateAudio,
      watermark: input.watermark,
      audioVoice: input.audioVoice,
      audioFormat: input.audioFormat,
      audioSpeed: input.audioSpeed,
      audioInstructions: input.audioInstructions
    })
  };
}

function runGenerationOp(nodeId, mode, prompt, callId) {
  return {
    type: 'run_generation',
    nodeId,
    mode: generationMode(mode),
    prompt,
    clientRequestId: `agent_${callId}`.slice(0, 128)
  };
}

function generationFlowOps(input, snapshot, idFactory, callId) {
  const mode = generationMode(input.mode);
  const prompt = String(input.prompt || '');
  const x = Number(input.x ?? nextCanvasX(snapshot));
  const y = Number(input.y ?? 0);
  const configId = idFactory('agent_config_');
  const referenceNodeIds = Array.isArray(input.referenceNodeIds)
    ? input.referenceNodeIds.filter((id) => typeof id === 'string')
    : [];
  if (mode === 'image') {
    // 当前画布生图逻辑：提示词直接写在生图节点，参考图由图片节点连线提供，不再额外创建提示词文本节点。
    const ops = [
      configNodeOp(configId, { ...input, prompt }, x, y),
      ...referenceNodeIds.map((fromNodeId) => ({
        type: 'connect_nodes',
        id: idFactory('agent_edge_'),
        fromNodeId,
        toNodeId: configId
      })),
      { type: 'select_nodes', ids: [configId] }
    ];
    if (input.autoRun) ops.push(runGenerationOp(configId, mode, prompt, callId));
    return ops;
  }
  const textId = idFactory('agent_text_');
  const tokens = [`@[node:${textId}]`, ...referenceNodeIds.map((id) => `@[node:${id}]`)];
  const ops = [
    textNodeOp({ id: textId, text: prompt, title: String(input.title || '提示词') }, x, y, idFactory),
    configNodeOp(configId, { ...input, prompt: tokens.join('\n') }, x + 420, y),
    { type: 'connect_nodes', id: idFactory('agent_edge_'), fromNodeId: textId, toNodeId: configId },
    ...referenceNodeIds.map((fromNodeId) => ({
      type: 'connect_nodes',
      id: idFactory('agent_edge_'),
      fromNodeId,
      toNodeId: configId
    })),
    { type: 'select_nodes', ids: [configId] }
  ];
  if (input.autoRun) ops.push(runGenerationOp(configId, mode, tokens.join('\n'), callId));
  return ops;
}

function normalizeCanvasOps(ops, idFactory, callId) {
  return ops.map((raw) => {
    const op = { ...raw };
    if (op.type === 'add_node') {
      op.id = op.id || idFactory(`agent_${op.nodeType || 'node'}_`);
      if (!op.position) op.position = { x: Number(op.x || 0), y: Number(op.y || 0) };
      delete op.x;
      delete op.y;
    }
    if (op.type === 'connect_nodes') op.id = op.id || idFactory('agent_edge_');
    if (op.type === 'run_generation') {
      op.clientRequestId = op.clientRequestId || `agent_${callId}`.slice(0, 128);
    }
    return op;
  });
}

function findNode(snapshot, id) {
  return (Array.isArray(snapshot?.nodes) ? snapshot.nodes : []).find((node) => node.id === id);
}

function prepareCanvasExecution(name, input, context) {
  const snapshot = compactCanvasState(context.snapshot);
  const idFactory = context.idFactory;
  const callId = context.callId;

  if (name === 'canvas_get_state' || name === 'canvas_export_snapshot') {
    return { kind: 'read_result', result: snapshot };
  }
  if (name === 'canvas_get_selection') {
    const selected = new Set(snapshot.selectedNodeIds);
    return {
      kind: 'read_result',
      result: { nodes: snapshot.nodes.filter((node) => selected.has(node.id)) }
    };
  }

  let ops = [];
  if (name === 'canvas_apply_ops') ops = normalizeCanvasOps(input.ops, idFactory, callId);
  if (name === 'canvas_create_node') {
    ops = normalizeCanvasOps([{
      type: 'add_node',
      nodeType: input.nodeType,
      title: input.title,
      position: { x: input.x ?? nextCanvasX(snapshot), y: input.y ?? 0 },
      width: input.width,
      height: input.height,
      metadata: input.metadata
    }], idFactory, callId);
  }
  if (name === 'canvas_create_attachment_nodes') {
    const attachments = new Map((context.attachments || []).map((item) => [item.id, item]));
    const x = Number(input.x ?? nextCanvasX(snapshot));
    const y = Number(input.y ?? 0);
    const gap = Number(input.gap ?? 40);
    let offset = 0;
    ops = input.attachmentIds.map((attachmentId) => {
      const attachment = attachments.get(attachmentId);
      if (!attachment?.assetId) {
        const error = new Error(`找不到本轮已上传附件：${attachmentId}`);
        error.status = 400;
        error.code = 'CANVAS_AGENT_ATTACHMENT_NOT_FOUND';
        throw error;
      }
      const width = Math.min(640, Number(attachment.width) || 360);
      const height = Math.min(640, Number(attachment.height) || 360);
      const op = {
        type: 'add_node',
        id: idFactory('agent_image_'),
        nodeType: 'image',
        title: attachment.name || '参考图',
        position: {
          x: input.direction === 'column' ? x : x + offset,
          y: input.direction === 'column' ? y + offset : y
        },
        width,
        height,
        metadata: {
          assetId: attachment.assetId,
          storageKey: `asset:${attachment.assetId}`,
          content: attachment.accessUrl || '',
          mimeType: attachment.type || 'image/png',
          status: 'success'
        }
      };
      offset += (input.direction === 'column' ? height : width) + gap;
      return op;
    });
  }
  if (name === 'canvas_create_text_node') {
    ops = [textNodeOp(input, input.x ?? nextCanvasX(snapshot), input.y ?? 0, idFactory)];
  }
  if (name === 'canvas_create_text_nodes') {
    const x = Number(input.x ?? nextCanvasX(snapshot));
    const y = Number(input.y ?? 0);
    const gap = Number(input.gap ?? 40);
    ops = input.items.map((item, index) => textNodeOp(
      item,
      item.x ?? (input.direction === 'row' ? x + index * (340 + gap) : x),
      item.y ?? (input.direction === 'row' ? y : y + index * (240 + gap)),
      idFactory
    ));
  }
  if (name === 'canvas_create_config_node') {
    const configId = idFactory('agent_config_');
    ops = [configNodeOp(configId, input, input.x ?? nextCanvasX(snapshot), input.y ?? 0)];
    if (input.autoRun) ops.push(runGenerationOp(configId, input.mode, input.prompt, callId));
  }
  if (name === 'canvas_create_image_prompt_flow') {
    ops = generationFlowOps({ ...input, mode: 'image' }, snapshot, idFactory, callId);
  }
  if (name === 'canvas_create_generation_flow') {
    ops = generationFlowOps(input, snapshot, idFactory, callId);
  }
  if (['canvas_generate_text', 'canvas_generate_image', 'canvas_generate_video', 'canvas_generate_audio'].includes(name)) {
    ops = generationFlowOps({
      ...input,
      mode: name.replace('canvas_generate_', ''),
      autoRun: true
    }, snapshot, idFactory, callId);
  }
  if (name === 'canvas_update_node') {
    ops = [{ type: 'update_node', id: input.id, patch: input.patch, metadata: input.metadata }];
  }
  if (name === 'canvas_update_node_text') {
    ops = [{
      type: 'update_node',
      id: input.id,
      patch: input.title ? { title: input.title } : undefined,
      metadata: { content: input.text, status: 'success' }
    }];
  }
  if (name === 'canvas_move_nodes') {
    ops = input.items.map((item) => {
      const current = findNode(snapshot, item.id);
      return {
        type: 'update_node',
        id: item.id,
        patch: {
          position: {
            x: item.x ?? ((current?.position?.x || 0) + (item.dx || 0)),
            y: item.y ?? ((current?.position?.y || 0) + (item.dy || 0))
          }
        }
      };
    });
  }
  if (name === 'canvas_resize_node') {
    ops = [{
      type: 'update_node',
      id: input.id,
      patch: { width: input.width, height: input.height },
      metadata: input.freeResize === undefined ? undefined : { freeResize: input.freeResize }
    }];
  }
  if (name === 'canvas_delete_nodes') ops = [{ type: 'delete_node', ids: input.ids }];
  if (name === 'canvas_connect_nodes') {
    ops = input.connections.map((connection) => ({
      type: 'connect_nodes',
      id: idFactory('agent_edge_'),
      ...connection
    }));
  }
  if (name === 'canvas_select_nodes') ops = [{ type: 'select_nodes', ids: input.ids }];
  if (name === 'canvas_set_viewport') ops = [{ type: 'set_viewport', viewport: input.viewport }];
  if (name === 'canvas_run_generation') {
    ops = [runGenerationOp(input.nodeId, input.mode, input.prompt, callId)];
  }
  if (name === 'canvas_reverse_image_prompt') {
    const nodes = Array.isArray(snapshot.nodes) ? snapshot.nodes : [];
    const selected = new Set(snapshot.selectedNodeIds || []);
    // 快照经 compactNode 脱敏后 metadata.content 被剥离，这里用 storageKey/assetId
    // 或生成结果判断节点已有图片。生图节点（config）也可能承载当前结果图，
    // 因此不能只认独立的图片节点（image）。
    const isImageNode = (node) => {
      if (!node || !['image', 'config'].includes(node.type) || !node.metadata) return false;
      const generatedImages = Array.isArray(node.metadata.generatedImages) ? node.metadata.generatedImages : [];
      return Boolean(
        node.metadata.content
        || node.metadata.storageKey
        || node.metadata.assetId
        || generatedImages.some((image) => image && (image.content || image.storageKey || image.assetId))
      );
    };
    const target = (input.nodeId && nodes.find((node) => node.id === input.nodeId))
      || nodes.find((node) => selected.has(node.id) && isImageNode(node))
      || nodes.find(isImageNode);
    if (!isImageNode(target)) {
      const error = new Error('没有找到可反推的图片：请先上传或选中图片节点，或选中已有生成结果的生图节点。');
      error.status = 400;
      error.code = 'CANVAS_AGENT_REVERSE_SOURCE_NOT_FOUND';
      throw error;
    }
    ops = [{ type: 'reverse_prompt', nodeId: target.id }];
  }
  if (!ops.length) {
    const error = new Error(`工具未产生可执行画布操作：${name}`);
    error.status = 400;
    error.code = 'CANVAS_AGENT_TOOL_NO_OPS';
    throw error;
  }
  return { kind: 'canvas_ops', ops };
}

function toolSummary(name, input, execution) {
  const labels = {
    site_navigate: '跳转站内页面',
    canvas_apply_ops: '批量修改画布',
    canvas_create_node: '创建节点',
    canvas_create_attachment_nodes: '把附件插入画布',
    canvas_create_text_node: '创建文本节点',
    canvas_create_text_nodes: '批量创建文本节点',
    canvas_create_config_node: '创建生图节点',
    canvas_create_image_prompt_flow: '创建生图节点流程',
    canvas_create_generation_flow: '创建生成流程',
    canvas_generate_text: '创建并执行文本生成',
    canvas_generate_image: '创建并执行图片生成',
    canvas_generate_video: '创建并执行视频生成',
    canvas_generate_audio: '创建并执行音频生成',
    canvas_update_node: '更新节点',
    canvas_update_node_text: '更新节点文案',
    canvas_move_nodes: '移动节点',
    canvas_resize_node: '调整节点尺寸',
    canvas_delete_nodes: '删除节点',
    canvas_connect_nodes: '连接节点',
    canvas_select_nodes: '选择节点',
    canvas_set_viewport: '调整画布视口',
    canvas_run_generation: '触发节点生成',
    canvas_reverse_image_prompt: '反推图片提示词',
    workbench_image_generate: '提交图片生成任务',
    workbench_video_generate: '提交视频生成任务',
    assets_add: '保存素材'
  };
  const base = labels[name] || toolDescriptions[name] || name;
  if (execution?.kind === 'canvas_ops') return `${base}（${execution.ops.length} 个操作）`;
  if (name === 'site_navigate') return `${base}：${input.path}`;
  return base;
}

function prepareToolCall(name, rawInput, context) {
  const input = parseToolInput(name, rawInput);
  if (READ_CANVAS_TOOLS.has(name)) {
    return {
      name,
      input,
      requiresConfirmation: false,
      execution: prepareCanvasExecution(name, input, context)
    };
  }
  if (READ_SITE_TOOLS.has(name)) {
    return {
      name,
      input,
      requiresConfirmation: false,
      execution: { kind: 'site_tool', name, input, write: false }
    };
  }
  if (WRITE_SITE_TOOLS.has(name)) {
    const execution = { kind: 'site_tool', name, input, write: true };
    return {
      name,
      input,
      requiresConfirmation: true,
      execution,
      summary: toolSummary(name, input, execution)
    };
  }
  if (name === 'site_navigate') {
    if (!input.path.startsWith('/') || input.path.startsWith('//')) {
      const error = new Error('只允许跳转站内路径');
      error.status = 400;
      error.code = 'CANVAS_AGENT_NAVIGATION_INVALID';
      throw error;
    }
    const execution = { kind: 'navigate', path: input.path };
    return {
      name,
      input,
      requiresConfirmation: true,
      execution,
      summary: toolSummary(name, input, execution)
    };
  }
  const execution = prepareCanvasExecution(name, input, context);
  return {
    name,
    input,
    requiresConfirmation: true,
    execution,
    summary: toolSummary(name, input, execution)
  };
}

module.exports = {
  READ_CANVAS_TOOLS,
  READ_SITE_TOOLS,
  WRITE_SITE_TOOLS,
  canvasAgentToolDefinitions,
  compactCanvasState,
  parseToolInput,
  prepareToolCall,
  toolDescriptions,
  toolInputSchemas,
  toolNames
};
