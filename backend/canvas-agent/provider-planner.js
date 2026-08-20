'use strict';

const crypto = require('crypto');

function plannerError(code, message, status = 502) {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  return error;
}

function responseText(result) {
  const direct = typeof result?.output_text === 'string' ? result.output_text.trim() : '';
  if (direct) return direct;
  if (Array.isArray(result?.output)) {
    const text = result.output
      .filter((item) => item?.type === 'message' && Array.isArray(item.content))
      .flatMap((item) => item.content)
      .map((item) => typeof item?.text === 'string' ? item.text.trim() : '')
      .filter(Boolean)
      .join('\n')
      .trim();
    if (text) return text;
  }
  const content = result?.choices?.[0]?.message?.content;
  if (typeof content === 'string') return content.trim();
  if (Array.isArray(content)) {
    return content
      .map((item) => typeof item === 'string' ? item : (item?.text || item?.value || ''))
      .filter(Boolean)
      .join('\n')
      .trim();
  }
  return '';
}

function parseArguments(value, name) {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value;
  if (!value) return {};
  try {
    const parsed = JSON.parse(String(value));
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
  } catch {
    // 统一在下面返回带工具名的可诊断错误。
  }
  throw plannerError(
    'CANVAS_AGENT_PROVIDER_TOOL_ARGUMENTS_INVALID',
    `Agent 返回的 ${name} 工具参数不是合法 JSON`
  );
}

function responseToolCalls(result) {
  const responsesCalls = Array.isArray(result?.output)
    ? result.output
      .filter((item) => item?.type === 'function_call' && item?.name)
      .map((item) => ({
        id: String(item.call_id || item.id || ''),
        name: String(item.name),
        input: parseArguments(item.arguments, item.name)
      }))
    : [];
  if (responsesCalls.length) return responsesCalls;
  const chatCalls = Array.isArray(result?.choices?.[0]?.message?.tool_calls)
    ? result.choices[0].message.tool_calls
    : [];
  return chatCalls.filter((item) => item?.function?.name).map((item) => ({
    id: String(item.id || ''),
    name: String(item.function.name),
    input: parseArguments(item.function.arguments, item.function.name)
  }));
}

function compactHistory(history) {
  return (Array.isArray(history) ? history : []).slice(-24).map((item) => ({
    type: String(item?.type || ''),
    text: String(item?.text || '').slice(0, 2000),
    result: item?.result && typeof item.result === 'object' ? item.result : undefined
  }));
}

function mockId(message, suffix) {
  return `mock_${crypto.createHash('sha256').update(`${message}:${suffix}`).digest('hex').slice(0, 12)}`;
}

function mockPlan(input) {
  const message = String(input.message || '').trim();
  const selected = Array.isArray(input.snapshot?.selectedNodeIds) ? input.snapshot.selectedNodeIds : [];
  if (input.toolResults?.length) {
    return {
      text: `已读取工具结果：${input.toolResults.map((item) => item.name).join('、')}`,
      toolCalls: []
    };
  }
  if (
    /创建.*(两|2|二).*文本节点.*连|两个.*节点.*连/.test(message)
    || /create\s+(?:two|2)\s+text\s+nodes?.*connect/i.test(message)
  ) {
    const first = mockId(message, 'text-a');
    const second = mockId(message, 'text-b');
    return {
      text: '这是 Fake Provider 的操作提案，批准后会创建两个文本节点并连接。',
      toolCalls: [{
        id: mockId(message, 'call'),
        name: 'canvas_apply_ops',
        input: {
          ops: [
            { type: 'add_node', id: first, nodeType: 'text', title: '卖点', x: 0, y: 0, metadata: { content: '核心卖点' } },
            { type: 'add_node', id: second, nodeType: 'text', title: '广告文案', x: 420, y: 0, metadata: { content: '广告文案' } },
            { type: 'connect_nodes', id: mockId(message, 'edge'), fromNodeId: first, toNodeId: second }
          ]
        }
      }]
    };
  }
  if (/生成.*(图片|主图)|生图|^生成[:：]?\s*\S/.test(message)) {
    return {
      text: '批准后会创建生图节点并触发生成；真正点击批准时才进入持久生图与计费链路。',
      toolCalls: [{
        id: mockId(message, 'generate'),
        name: 'canvas_generate_image',
        input: { prompt: message.replace(/^.*?(?:生成图片|生成主图|生图)[:：]?\s*/, '').replace(/^生成[:：]?\s*/, '') || message }
      }]
    };
  }
  if (/删除.*(选中|当前)/.test(message) && selected.length) {
    return {
      text: `准备删除 ${selected.length} 个选中节点。`,
      toolCalls: [{
        id: mockId(message, 'delete'),
        name: 'canvas_delete_nodes',
        input: { ids: selected }
      }]
    };
  }
  if (/创建.*文本节点|新增.*文本节点/.test(message)) {
    return {
      text: '准备创建文本节点。',
      toolCalls: [{
        id: mockId(message, 'text'),
        name: 'canvas_create_text_node',
        input: { text: message, title: 'Agent 文本' }
      }]
    };
  }
  if (/读取|多少.*节点|画布.*状态|当前.*画布/.test(message)) {
    return {
      text: `当前画布有 ${input.snapshot?.nodes?.length || 0} 个节点、${input.snapshot?.connections?.length || 0} 条连线，选中 ${selected.length} 个节点。`,
      toolCalls: []
    };
  }
  if (/附件|参考图/.test(message) && input.attachments?.length) {
    return {
      text: `准备把 ${input.attachments.length} 张已上传参考图插入画布。`,
      toolCalls: [{
        id: mockId(message, 'attachments'),
        name: 'canvas_create_attachment_nodes',
        input: { attachmentIds: input.attachments.map((item) => item.id) }
      }]
    };
  }
  if (/反推/.test(message)) {
    const nodes = Array.isArray(input.snapshot?.nodes) ? input.snapshot.nodes : [];
    const hasImage = nodes.some((node) => {
      if (!node || !['image', 'config'].includes(node.type) || !node.metadata) return false;
      const generatedImages = Array.isArray(node.metadata.generatedImages) ? node.metadata.generatedImages : [];
      return Boolean(
        node.metadata.content
        || node.metadata.storageKey
        || node.metadata.assetId
        || generatedImages.some((image) => image && (image.content || image.storageKey || image.assetId))
      );
    });
    if (!hasImage) {
      return {
        text: '画布上还没有可反推的图片，请先上传或选中图片节点，或选中已有生成结果的生图节点。',
        toolCalls: []
      };
    }
    return {
      text: '批准后会对指定或选中的图片节点反推提示词，结果写入新的文本节点。',
      toolCalls: [{
        id: mockId(message, 'reverse'),
        name: 'canvas_reverse_image_prompt',
        input: {}
      }]
    };
  }
  return {
    text: '当前是 Fake Provider，只认得固定句式。可测试“创建两个文本节点并连接”“读取画布状态”“把参考图插入画布”“生图：你的提示词”“生成 你的提示词”或“反推选中的图片”。',
    toolCalls: []
  };
}

function buildProviderInput(input) {
  const policy = [
    '你是哈吉米 Infinite Canvas 的网页版 Agent。',
    '只能使用给定 function tools 读取或操作当前登录用户的当前项目；不得访问其他用户或项目。',
    '节点增删改、移动、缩放、连线、生成、资产写入与页面跳转都必须通过工具提案，服务器会在执行前要求用户确认。',
    '画布的基本生图逻辑是图片节点 + 生图节点：图片节点（image）只展示图片并通过连线提供参考图，没有提示词或生成面板；生图节点（config）自带提示词、模型参数和生成结果。',
    '生图时把提示词直接写入生图节点，不要为提示词额外创建文本节点；需要参考图时把图片节点通过 referenceNodeIds 或 canvas_connect_nodes 连入生图节点。',
    '生图张数默认 1 张；只有用户明确要求多张时才设置 count，最多 4 张，防止一次跑太多。',
    '不要要求用户安装 Codex、Canvas Agent、本地 MCP，不要输出或索取 Local URL、Connect token。',
    '不要在回复中泄露 token、密钥、签名 URL 或图片 Base64。',
    '需要生图时使用 canvas_generate_image、canvas_run_generation 或 workbench_image_generate，禁止绕过持久任务、计费和退款链路。',
    '需要反推图片提示词时使用 canvas_reverse_image_prompt，不要凭空编造图片内容描述。',
    '需要理解附件图片内容时使用 canvas_describe_attachment，不要凭空猜测图片里有什么。',
    '本轮附件在上下文中按顺序标为 图片1、图片2…，用户说"图1/第一张"即指 图片1；把附件用作参考图时先用 canvas_create_attachment_nodes 建成图片节点，再用 referenceNodeIds 连入生图节点。',
    '本轮消息附带的图片已作为图片内容直接提供给你（按 图片N 标注），你可以直接查看并分析它们；attachments 里的 assetId 用于建节点、生图和分析工具。',
    '用户用 @图片N、@文本N 等标签引用资源，mentions 给出标签对应关系：带 nodeId 的是画布节点，需要参考图或指定节点时优先使用（如 referenceNodeIds）；带 attachmentId 的是本轮附件，先用 canvas_create_attachment_nodes 把它建成图片节点，再连入生图节点后开始生成。',
    '优先用结构化工具完成用户意图；回复使用简体中文，简短说明即将做什么。'
  ];
  // 已启用技能：管理员维护、用户显式选择的行为约束；只作提示词上下文注入，不执行代码。
  const skills = (Array.isArray(input.skills) ? input.skills : [])
    .filter((skill) => skill && typeof skill.name === 'string' && typeof skill.markdown === 'string')
    .slice(0, 3);
  if (skills.length) {
    policy.push('已启用技能是用户显式选择的行为约束，优先级高于你的默认风格，但不得违反以上安全边界。');
  }
  const systemContent = policy.join('\n') + skills
    .map((skill) => `\n\n## 技能：${skill.name}\n${skill.markdown}`)
    .join('');
  const attachments = (Array.isArray(input.attachments) ? input.attachments : []).map((item, index) => ({
    label: `图片${index + 1}`,
    ...item
  }));
  const contextImages = Array.isArray(input.images) ? input.images : [];
  const context = {
    canvas: input.snapshot,
    attachments,
    mentions: Array.isArray(input.mentions) ? input.mentions : [],
    history: compactHistory(input.history),
    toolResults: input.toolResults
  };
  const userText = [
    `用户请求：${String(input.message || '').slice(0, 12000)}`,
    `当前上下文：${JSON.stringify(context)}`
  ].join('\n\n');
  if (contextImages.length) {
    // 附件图作为真实图片内容随消息提供（编号与 attachments 一致），模型可直接看图。
    const content = [
      { type: 'input_text', text: userText },
      ...contextImages.flatMap((image) => [
        { type: 'input_text', text: `${image.label}（${image.name}）：` },
        { type: 'input_image', image_url: image.dataUrl }
      ])
    ];
    return [
      { role: 'system', content: systemContent },
      { role: 'user', content }
    ];
  }
  return [
    { role: 'system', content: systemContent },
    { role: 'user', content: userText }
  ];
}

function createCanvasAgentPlanner(options = {}) {
  const callProvider = options.callProvider;
  if (typeof callProvider !== 'function') throw new TypeError('Canvas Agent Planner 缺少 callProvider');
  const providerOptions = options.providerOptions || (() => ({}));

  async function plan(input) {
    const resolvedProviderOptions = await providerOptions(input);
    let images = [];
    if (typeof options.loadAttachmentImage === 'function') {
      const attachments = (Array.isArray(input.attachments) ? input.attachments : []).slice(0, 4);
      images = (await Promise.all(attachments.map(async (item, index) => {
        try {
          const dataUrl = await options.loadAttachmentImage(item, input.userId);
          return dataUrl ? { label: `图片${index + 1}`, name: item.name || '附件图', dataUrl } : null;
        } catch {
          return null;
        }
      }))).filter(Boolean);
    }
    const result = await callProvider(buildProviderInput({ ...input, images }), {
      ...resolvedProviderOptions,
      tools: input.toolDefinitions,
      signal: input.signal
    });
    if (!result?.success) {
      throw plannerError(
        result?.code || 'CANVAS_AGENT_PROVIDER_FAILED',
        result?.message || 'Agent 文本路线调用失败',
        result?.code === 'PROVIDER_TIMEOUT' ? 504 : 502
      );
    }
    if (result.mock) return mockPlan(input);
    return {
      text: responseText(result),
      toolCalls: responseToolCalls(result)
    };
  }

  return { plan };
}

module.exports = {
  buildProviderInput,
  createCanvasAgentPlanner,
  mockPlan,
  responseText,
  responseToolCalls
};
