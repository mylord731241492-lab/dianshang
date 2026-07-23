const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const Database = require('better-sqlite3');

const repoRoot = path.resolve(__dirname, '..');
const bridgeSecret = 'sk-bridge-tool-loop-test-123456';
const fakePngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2nH0AAAAASUVORK5CYII=';

function listen(server, port = 0) {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => {
      server.off('error', reject);
      resolve(server.address().port);
    });
  });
}

async function freePort() {
  const server = net.createServer();
  const port = await listen(server);
  await new Promise(resolve => server.close(resolve));
  return port;
}

async function waitForHealth(baseUrl, child, stderr) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (child.exitCode !== null) {
      throw new Error(`Disposable app exited early (${child.exitCode}): ${stderr.join('')}`);
    }
    try {
      const response = await fetch(`${baseUrl}/api/health`);
      const data = await response.json();
      if (response.ok && data.success && data.database === 'ok') return;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error(`Disposable app did not become healthy: ${stderr.join('')}`);
}

function providerResponse(body) {
  const inputText = JSON.stringify(body.input || []);
  const usage = { input_tokens: 12, output_tokens: 4, total_tokens: 16 };
  const forcedToolName = String(body.tool_choice?.name || '');
  if (forcedToolName.includes('prepare_ecommerce_image_plan')) {
    if (inputText.includes('触发无效方案')) {
      return {
        id: 'resp_invalid_ecommerce_plan',
        object: 'response',
        status: 'completed',
        model: body.model,
        output: [{
          id: 'fc_invalid_ecommerce_plan',
          type: 'function_call',
          status: 'completed',
          call_id: 'call_invalid_ecommerce_plan',
          name: forcedToolName,
          arguments: JSON.stringify({ designPrompt: '过短', referenceRoles: [], copyItems: [] }),
        }],
        usage,
      };
    }
    return {
      id: 'resp_ecommerce_plan_1',
      object: 'response',
      status: 'completed',
      model: body.model,
      output: [{
        id: 'fc_ecommerce_plan_1',
        type: 'function_call',
        status: 'completed',
        call_id: 'call_ecommerce_plan_1',
        name: forcedToolName,
        arguments: JSON.stringify({
          originalRequest: '参考图1排版，用图2产品生成电商主图',
          designPrompt: '生成一张完整的洗衣液电商主图：严格按照用户指定关系参考图1的信息层级和排版节奏，并以图2洗衣液作为产品主体，保持瓶型、品牌、标签和2KG规格。',
          referenceRoles: [
            { imageIndex: 1, roleDescription: '只参考排版、构图和信息层级' },
            { imageIndex: 2, roleDescription: '作为最终洗衣液产品主体' },
          ],
          copyItems: [
            { id: 'main-title', label: '主标题', text: '茉莉白茶香氛洗衣液', source: '识别自图片 2' },
            { id: 'specification', label: '规格', text: '净含量2KG', source: '识别自图片 2' },
          ],
          ...(inputText.includes('主标题放大') ? { revisionNotes: '修改图片\n保留产品不变，把主标题放大' } : {}),
        }),
      }],
      usage,
    };
  }
  if (forcedToolName.includes('confirm_ecommerce_image_plan')) {
    return {
      id: 'resp_confirm_plan_1',
      object: 'response',
      status: 'completed',
      model: body.model,
      output: [{
        id: 'fc_confirm_plan_1',
        type: 'function_call',
        status: 'completed',
        call_id: 'call_confirm_plan_1',
        name: forcedToolName,
        arguments: JSON.stringify({
          confirmationCode: 'DEF456',
          designPrompt: '用户编辑后的完整设计方案，保持参考图角色并使用修改后的动态文案生成电商主图。',
          copyItems: [{ id: 'main-title', label: '主标题', text: '新的主标题', source: '识别自图片 2' }],
          adjustment: '标题用红色大字',
          finalPrompt: 'GPT 根据原始方案、全部参考图片和用户修改后的文案重新生成的最终生图提示词，严格执行参考关系并确保产品与文字准确。',
        }),
      }],
      usage,
    };
  }
  if (inputText.includes('左右拉长')) {
    const prepareToolForced = body.tool_choice?.type === 'function'
      && String(body.tool_choice?.name || '').endsWith('prepare_image_generation');
    const includesImagePayload = inputText.includes('"type":"input_image"');
    if (!prepareToolForced || includesImagePayload) {
      return {
        id: 'resp_native_image_1',
        object: 'response',
        status: 'completed',
        model: body.model,
        output: [{
          id: 'ig_native_1',
          type: 'image_generation_call',
          status: 'completed',
          result: fakePngBase64
        }],
        usage
      };
    }
    return {
      id: 'resp_forced_prepare_1',
      object: 'response',
      status: 'completed',
      model: body.model,
      output: [{
        id: 'fc_forced_prepare_1',
        type: 'function_call',
        status: 'completed',
        call_id: 'call_forced_prepare_1',
        name: 'prepare_image_generation',
        arguments: '{"prompt":"左右拉长","modelKey":"gpt-image-2","imageCount":1}'
      }],
      usage
    };
  }
  if (!inputText.includes('Tool result call_prepare_1')) {
    return {
      id: 'resp_prepare_1',
      object: 'response',
      status: 'completed',
      model: body.model,
      output: [{
        id: 'fc_prepare_1',
        type: 'function_call',
        status: 'completed',
        call_id: 'call_prepare_1',
        name: 'prepare_image_generation',
        arguments: '{"prompt":"测试商品图","modelKey":"gpt-image-2","imageCount":1}'
      }],
      usage
    };
  }
  return {
    id: 'resp_quote_1',
    object: 'response',
    status: 'completed',
    model: body.model,
    output: [{
      id: 'msg_quote_1',
      type: 'message',
      status: 'completed',
      role: 'assistant',
      content: [{ type: 'output_text', text: '报价已创建，请下一条消息确认。', annotations: [] }]
    }],
    usage
  };
}

async function postCompletion(baseUrl, user, body, messageId = 'message-tool-loop-1', agentId = '') {
  const response = await fetch(`${baseUrl}/api/integrations/librechat/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${bridgeSecret}`,
      'X-Chat-User-Id': `hjm:${user.id}`,
      'X-Chat-User-Email': user.email,
      'X-Chat-Message-Id': messageId,
      ...(agentId ? { 'X-Chat-Agent-Id': agentId } : {})
    },
    body: JSON.stringify(body)
  });
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('text/event-stream')) {
    const raw = await response.text();
    return { response, data: {}, raw };
  }
  const data = await response.json().catch(() => ({}));
  return { response, data, raw: '' };
}

async function main() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'dianshang-tool-loop-'));
  const dataDir = path.join(tempRoot, 'data');
  const uploadDir = path.join(tempRoot, 'uploads');
  const logDir = path.join(tempRoot, 'logs');
  fs.mkdirSync(dataDir, { recursive: true });
  fs.mkdirSync(uploadDir, { recursive: true });
  fs.mkdirSync(logDir, { recursive: true });

  let providerRequestCount = 0;
  const providerRequests = [];
  const fakeProvider = http.createServer((req, res) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => {
      providerRequestCount += 1;
      const body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
      providerRequests.push(body);
      if (JSON.stringify(body.input || []).includes('触发上游502')) {
        res.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end('{}');
        return;
      }
      const payload = providerResponse(body);
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(payload));
    });
  });

  const providerPort = await listen(fakeProvider);
  const appPort = await freePort();
  const baseUrl = `http://127.0.0.1:${appPort}`;
  const stdout = [];
  const stderr = [];
  const child = spawn(process.execPath, ['server.js'], {
    cwd: repoRoot,
    env: {
      ...process.env,
      PORT: String(appPort),
      DATA_DIR: dataDir,
      DB_PATH: path.join(dataDir, 'data.db'),
      UPLOAD_DIR: uploadDir,
      LOG_DIR: logDir,
      ENABLE_REAL_AI: 'true',
      ENABLE_REAL_EMAIL: 'false',
      ENABLE_REAL_PAYMENT: 'false',
      ENABLE_REAL_STORAGE: 'false',
      ENABLE_LIBRECHAT: 'true',
      LIBRECHAT_BRIDGE_SECRET: bridgeSecret,
      AI_PROVIDER_GATEWAY: 'new-api',
      NEW_API_BASE: `http://127.0.0.1:${providerPort}/v1`,
      NEW_API_KEY: 'sk-fake-provider-test-123456'
    },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true
  });
  child.stdout.on('data', chunk => stdout.push(chunk.toString('utf8')));
  child.stderr.on('data', chunk => stderr.push(chunk.toString('utf8')));

  let db;
  try {
    await waitForHealth(baseUrl, child, stderr);
    db = new Database(path.join(dataDir, 'data.db'));
    const user = db.prepare("SELECT id,email,balance FROM users WHERE username='admin'").get();
    assert(user, 'Disposable admin user was not created');

    const tools = [
      {
        type: 'function',
        function: {
          name: 'prepare_ecommerce_image_plan',
          description: 'Create an ecommerce image plan',
          parameters: { type: 'object', properties: { revisionNotes: { type: 'string' } } }
        }
      },
      {
        type: 'function',
        function: {
          name: 'confirm_ecommerce_image_plan',
          description: 'Confirm an ecommerce image plan',
          parameters: {
            type: 'object',
            properties: { confirmationCode: { type: 'string' }, copyRevision: { type: 'string' } },
            required: ['confirmationCode']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'prepare_image_generation',
          description: 'Create an image quote',
          parameters: { type: 'object', properties: { prompt: { type: 'string' } }, required: ['prompt'] }
        }
      },
      {
        type: 'function',
        function: {
          name: 'execute_image_generation',
          description: 'Execute a confirmed image quote',
          parameters: {
            type: 'object',
            properties: { confirmationCode: { type: 'string' } },
            required: ['confirmationCode']
          }
        }
      }
    ];
    const initialBody = {
      model: 'gpt-5.5',
      stream: false,
      messages: [{ role: 'user', content: '生成一张测试商品图' }],
      tools
    };
    const first = await postCompletion(baseUrl, user, initialBody);
    assert.equal(first.response.status, 200, `Initial tool request failed: ${JSON.stringify(first.data)}`);
    assert.equal(first.data.choices?.[0]?.finish_reason, 'tool_calls');

    const structuredBriefText = '平台淘宝，800x800，目标人群年轻女性和家庭，主打99.9%抑菌+持久留香+2kg大瓶装';
    const structuredRequestIndex = providerRequests.length;
    const structuredBrief = await postCompletion(baseUrl, user, {
      model: 'gpt-5.5',
      stream: false,
      messages: [{ role: 'user', content: structuredBriefText }],
      tools
    }, 'message-structured-image-brief-1');
    assert.equal(structuredBrief.response.status, 200, `Structured image brief failed: ${JSON.stringify(structuredBrief.data)}`);
    const structuredProviderRequest = providerRequests[structuredRequestIndex];
    assert(structuredProviderRequest, 'Structured image brief did not reach the text Provider');
    assert.equal(structuredProviderRequest.tool_choice?.type, 'function');
    assert.equal(structuredProviderRequest.tool_choice?.name, 'prepare_image_generation');

    const ecommercePlanRequestIndex = providerRequests.length;
    const ecommercePlanRoute = await postCompletion(baseUrl, user, {
      model: 'gpt-5.5',
      stream: false,
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: '参考图1排版，用图2产品生成电商主图' },
          { type: 'image_url', image_url: { url: `data:image/png;base64,${fakePngBase64}` } },
          { type: 'image_url', image_url: { url: `data:image/png;base64,${fakePngBase64}` } },
        ],
      }],
      tools,
    }, 'message-ecommerce-plan-route-1', 'ecommerce-main-image');
    assert.equal(ecommercePlanRoute.response.status, 200);
    const ecommercePlanProviderRequest = providerRequests[ecommercePlanRequestIndex];
    assert.equal(ecommercePlanProviderRequest.tool_choice?.name, 'prepare_ecommerce_image_plan');
    assert.match(JSON.stringify(ecommercePlanProviderRequest.input || []), /"type":"input_image"/, 'GPT planning must receive both reference images instead of guessing from placeholders');
    assert.equal(ecommercePlanProviderRequest.model, 'gpt-5.6-terra');
    assert.match(JSON.stringify(ecommercePlanRoute.data), /图1.*排版|图2.*产品/, 'GPT plan must preserve the user-defined reverse image roles');

    const excessiveImagesBalanceBefore = db.prepare('SELECT balance FROM users WHERE id=?').get(user.id).balance;
    const providerCountBeforeExcessiveImages = providerRequestCount;
    const excessiveImages = await postCompletion(baseUrl, user, {
      model: 'gpt-5.5',
      stream: false,
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: '使用这五张图片生成电商主图方案' },
          ...Array.from({ length: 5 }, () => ({
            type: 'image_url',
            image_url: { url: `data:image/png;base64,${fakePngBase64}` },
          })),
        ],
      }],
      tools,
    }, 'message-too-many-ecommerce-images', 'ecommerce-main-image');
    assert.equal(excessiveImages.response.status, 200);
    assert.match(JSON.stringify(excessiveImages.data), /一次最多读取 4 张参考图片.*已退回 5 算力/);
    assert.equal(providerRequestCount, providerCountBeforeExcessiveImages, 'Invalid local reference-image input must not call GPT-5.6');
    assert.equal(db.prepare('SELECT balance FROM users WHERE id=?').get(user.id).balance, excessiveImagesBalanceBefore, 'Invalid local reference-image input must be refunded');

    const invalidPlanBalanceBefore = db.prepare('SELECT balance FROM users WHERE id=?').get(user.id).balance;
    const invalidPlan = await postCompletion(baseUrl, user, {
      model: 'gpt-5.6',
      stream: false,
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: '触发无效方案并生成电商主图' },
          { type: 'image_url', image_url: { url: `data:image/png;base64,${fakePngBase64}` } },
        ],
      }],
      tools,
    }, 'message-invalid-ecommerce-plan', 'ecommerce-main-image');
    assert.equal(invalidPlan.response.status, 200);
    assert.match(JSON.stringify(invalidPlan.data), /未返回完整的电商主图方案.*自动退款/);
    assert.equal(db.prepare('SELECT balance FROM users WHERE id=?').get(user.id).balance, invalidPlanBalanceBefore, 'Invalid GPT-5.6 plan output must be refunded without fallback');

    const otherAgentRequestIndex = providerRequests.length;
    const otherAgentRequest = await postCompletion(baseUrl, user, {
      ...initialBody,
      model: 'gpt-5.5',
      messages: [{ role: 'user', content: '参考图1排版，用图2产品生成电商主图' }],
    }, 'message-other-agent-ecommerce-brief', 'promotion-poster-designer');
    assert.equal(otherAgentRequest.response.status, 200);
    assert.equal(providerRequests[otherAgentRequestIndex].tool_choice?.name, 'prepare_image_generation', 'Other agents must keep the ordinary image quote flow');

    const friendlyQuoteText = '### 生图报价已准备\n\n请在下一条消息回复：**确认生图 ABC123**';
    const continuationBody = {
      model: 'gpt-5.5',
      stream: false,
      messages: [
        ...initialBody.messages,
        first.data.choices[0].message,
        {
          role: 'tool',
          tool_call_id: 'call_prepare_1',
          content: friendlyQuoteText
        }
      ],
      tools
    };
    const providerCountBeforeContinuation = providerRequestCount;
    const continuation = await postCompletion(baseUrl, user, continuationBody);
    assert.equal(
      continuation.response.status,
      200,
      `Tool continuation must not be treated as a duplicate message: ${continuation.response.status} ${JSON.stringify(continuation.data)}`
    );
    assert.equal(continuation.data.choices?.[0]?.message?.content, '生图报价已生成，请回复：**确认生图 ABC123**');
    assert.equal(providerRequestCount, providerCountBeforeContinuation, 'Built-in image quote output must not call the text Provider again');

    const libreChatContentInitial = await postCompletion(
      baseUrl,
      user,
      initialBody,
      'message-tool-content-loop-1',
    );
    assert.equal(libreChatContentInitial.response.status, 200);
    assert.equal(libreChatContentInitial.data.choices?.[0]?.finish_reason, 'tool_calls');
    const providerCountBeforeContentContinuation = providerRequestCount;
    const libreChatContentContinuation = await postCompletion(baseUrl, user, {
      model: 'gpt-5.5',
      stream: false,
      messages: [
        ...initialBody.messages,
        {
          role: 'assistant',
          content: [
            { type: 'text', text: '报价已经创建。' },
            {
              type: 'tool_call',
              tool_call: {
                id: 'call_prepare_content_1',
                name: 'prepare_image_generation',
                args: '{"prompt":"测试商品图"}',
                output: friendlyQuoteText,
              },
            },
          ],
        },
      ],
      tools,
    }, 'message-tool-content-loop-1');
    assert.equal(libreChatContentContinuation.response.status, 200);
    assert.equal(
      libreChatContentContinuation.data.choices?.[0]?.message?.content,
      '生图报价已生成，请回复：**确认生图 ABC123**',
    );
    assert.equal(
      providerRequestCount,
      providerCountBeforeContentContinuation,
      'LibreChat content-array image quote output must not call the text Provider again',
    );
    const friendlyPlanText = '### 电商主图设计方案\n\n### 上图文案\n\n请回复：**确认方案 DEF456**';
    const providerCountBeforePlanContinuation = providerRequestCount;
    const planContinuation = await postCompletion(baseUrl, user, {
      model: 'gpt-5.5',
      stream: false,
      messages: [{
        role: 'assistant',
        content: [{
          type: 'tool_call',
          tool_call: {
            id: 'call_prepare_plan_1',
            name: 'prepare_ecommerce_image_plan',
            args: '{}',
            output: friendlyPlanText,
          },
        }],
      }],
      tools,
    }, 'message-plan-tool-loop-1');
    assert.equal(planContinuation.response.status, 200);
    assert.equal(planContinuation.data.choices?.[0]?.message?.content, '主图方案已整理，请检查文案表单并点击“确认方案”。');
    assert.equal(providerRequestCount, providerCountBeforePlanContinuation, 'Plan tool output must continue locally without the text Provider');

    const missingAgentConfirmation = await postCompletion(baseUrl, user, {
      model: 'gpt-5.5',
      stream: false,
      messages: [{ role: 'user', content: '确认方案 DEF456' }],
      tools,
    }, 'message-confirm-plan-without-agent');
    assert.equal(missingAgentConfirmation.response.status, 200);
    assert.match(JSON.stringify(missingAgentConfirmation.data), /旧会话缺少.*电商主图设计师.*新建会话/);
    assert.equal(providerRequestCount, providerCountBeforePlanContinuation, 'A legacy conversation without an explicit agent ID must not be guessed or sent upstream');

    const planConfirmation = await postCompletion(baseUrl, user, {
      model: 'gpt-5.5',
      stream: false,
      messages: [{ role: 'user', content: '确认方案 DEF456\n主标题：新的主标题\n文案修改（选填）：标题用红色大字' }],
      tools,
    }, 'message-confirm-plan-1', 'ecommerce-main-image');
    assert.equal(planConfirmation.response.status, 200);
    assert.equal(planConfirmation.data.choices?.[0]?.finish_reason, 'tool_calls');
    const confirmPlanCall = planConfirmation.data.choices?.[0]?.message?.tool_calls?.[0];
    assert.equal(confirmPlanCall?.function?.name, 'confirm_ecommerce_image_plan');
    assert.equal(JSON.parse(confirmPlanCall?.function?.arguments || '{}').confirmationCode, 'DEF456');
    assert.equal(JSON.parse(confirmPlanCall?.function?.arguments || '{}').copyItems?.[0]?.text, '新的主标题');
    assert.equal(providerRequestCount, providerCountBeforePlanContinuation + 1, 'Plan confirmation must ask GPT to regenerate the final prompt');
    assert.match(JSON.parse(confirmPlanCall?.function?.arguments || '{}').finalPrompt || '', /GPT 根据原始方案/, 'GPT must supply the regenerated final prompt');

    const planRevision = await postCompletion(baseUrl, user, {
      model: 'gpt-5.5',
      stream: false,
      messages: [
        {
          role: 'assistant',
          tool_calls: [{
            id: 'call_prepare_plan_revision_1',
            type: 'function',
            function: { name: 'prepare_ecommerce_image_plan', arguments: '{}' },
          }],
        },
        { role: 'tool', tool_call_id: 'call_prepare_plan_revision_1', content: friendlyPlanText },
        { role: 'user', content: '修改图片\n保留产品不变，把主标题放大' },
      ],
      tools,
    }, 'message-revise-plan-1', 'ecommerce-main-image');
    assert.equal(planRevision.response.status, 200);
    const revisePlanCall = planRevision.data.choices?.[0]?.message?.tool_calls?.[0];
    assert.equal(revisePlanCall?.function?.name, 'prepare_ecommerce_image_plan');
    assert.match(JSON.parse(revisePlanCall?.function?.arguments || '{}').revisionNotes || '', /主标题放大/);
    assert.equal(providerRequestCount, providerCountBeforePlanContinuation + 2, 'Image revisions must ask GPT-5.6 to regenerate the plan');
    const providerCountBeforeLocalConfirmation = providerRequestCount;

    const duplicate = await postCompletion(baseUrl, user, { ...continuationBody, stream: true, temperature: 0.9 });
    assert.equal(duplicate.response.status, 409, 'An exact repeated continuation must remain idempotently blocked');

    const confirmationBody = {
      model: 'gpt-5.5',
      stream: false,
      messages: [{ role: 'user', content: '确认生图 ABC123' }],
      tools
    };
    const confirmation = await postCompletion(baseUrl, user, confirmationBody, 'message-confirm-image-1');
    assert.equal(confirmation.response.status, 200, `Image confirmation routing failed: ${JSON.stringify(confirmation.data)}`);
    assert.equal(confirmation.data.choices?.[0]?.finish_reason, 'tool_calls');
    const executeCall = confirmation.data.choices?.[0]?.message?.tool_calls?.[0];
    assert.equal(executeCall?.function?.name, 'execute_image_generation');
    assert.deepEqual(JSON.parse(executeCall?.function?.arguments || '{}'), { confirmationCode: 'ABC123' });
    assert.equal(providerRequestCount, providerCountBeforeLocalConfirmation, 'Image confirmation must route locally without the text Provider');

    const productionMcpTools = tools.map(tool => ({
      ...tool,
      function: {
        ...tool.function,
        name: `${tool.function.name}_mcp_hajimi-website`,
      },
    }));
    const providerCountBeforeProductionNameConfirmation = providerRequestCount;
    const productionNameConfirmation = await postCompletion(baseUrl, user, {
      ...confirmationBody,
      tools: productionMcpTools,
    }, 'message-confirm-image-production-name-1');
    assert.equal(productionNameConfirmation.response.status, 200);
    assert.equal(productionNameConfirmation.data.choices?.[0]?.finish_reason, 'tool_calls');
    const productionExecuteCall = productionNameConfirmation.data.choices?.[0]?.message?.tool_calls?.[0];
    assert.equal(
      productionExecuteCall?.function?.name,
      'execute_image_generation_mcp_hajimi-website',
      'Image confirmation must preserve LibreChat production MCP tool names',
    );
    assert.deepEqual(JSON.parse(productionExecuteCall?.function?.arguments || '{}'), { confirmationCode: 'ABC123' });
    assert.equal(
      providerRequestCount,
      providerCountBeforeProductionNameConfirmation,
      'Production MCP image confirmation must route locally without the text Provider',
    );

    const friendlyResultText = '### 图片生成完成\n\n![生成图片 1](/uploads/generated/test.png)';
    const confirmationContinuation = await postCompletion(baseUrl, user, {
      ...confirmationBody,
      messages: [
        ...confirmationBody.messages,
        confirmation.data.choices[0].message,
        { role: 'tool', tool_call_id: executeCall.id, content: friendlyResultText }
      ]
    }, 'message-confirm-image-1');
    assert.equal(confirmationContinuation.response.status, 200);
    assert.equal(confirmationContinuation.data.choices?.[0]?.message?.content, '图片生成完成，结果见上方。需要修改时请在结果卡下方填写修改要求。');
    assert.equal(providerRequestCount, providerCountBeforeLocalConfirmation, 'Built-in image result output must not call the text Provider again');

    const imageEditIntent = await postCompletion(baseUrl, user, {
      model: 'gpt-5.5',
      stream: false,
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: '左右拉长' },
          { type: 'image_url', image_url: { url: `data:image/png;base64,${fakePngBase64}` } }
        ]
      }],
      tools
    }, 'message-native-image-guard-1');
    assert.equal(imageEditIntent.response.status, 200, `Image-edit routing failed: ${JSON.stringify(imageEditIntent.data)}`);
    assert.equal(imageEditIntent.data.choices?.[0]?.finish_reason, 'tool_calls');
    assert.equal(imageEditIntent.data.choices?.[0]?.message?.tool_calls?.[0]?.function?.name, 'prepare_image_generation');
    assert(!JSON.stringify(imageEditIntent.data).includes(fakePngBase64), 'Native image Base64 must never enter Chat text');

    const nativeImageBlocked = await postCompletion(baseUrl, user, {
      model: 'gpt-5.5',
      stream: false,
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: '左右拉长' },
          { type: 'image_url', image_url: { url: `data:image/png;base64,${fakePngBase64}` } }
        ]
      }]
    }, 'message-native-image-blocked-1');
    assert.equal(nativeImageBlocked.response.status, 200);
    assert.match(nativeImageBlocked.data.choices?.[0]?.message?.content || '', /绕过网站报价/);
    assert(!JSON.stringify(nativeImageBlocked.data).includes(fakePngBase64), 'Blocked native image output must not expose Base64');

    const providerCountBeforeFailure = providerRequestCount;
    const providerFailureBody = {
      model: 'gpt-5.5',
      stream: true,
      messages: [{ role: 'user', content: '触发上游502' }]
    };
    const providerFailure = await postCompletion(baseUrl, user, providerFailureBody, 'message-provider-502-1');
    assert.equal(providerFailure.response.status, 200, 'A refunded Provider failure must be rendered as a normal Chat response');
    assert.match(providerFailure.raw, /已自动退款/);
    assert.doesNotMatch(providerFailure.raw, /409|CHAT_REQUEST_REFUNDED/);

    const refundedRetry = await postCompletion(baseUrl, user, providerFailureBody, 'message-provider-502-1');
    assert.equal(refundedRetry.response.status, 200, 'A repeated refunded message must remain readable instead of returning 409');
    assert.match(refundedRetry.raw, /已自动退款/);
    assert.equal(providerRequestCount, providerCountBeforeFailure + 1, 'A repeated refunded message must not call Provider again');

    const charge = db.prepare('SELECT * FROM chat_text_charges WHERE request_id=?').get('message-tool-loop-1');
    const contentContinuationCharge = db.prepare('SELECT * FROM chat_text_charges WHERE request_id=?').get('message-tool-content-loop-1');
    const structuredBriefCharge = db.prepare('SELECT * FROM chat_text_charges WHERE request_id=?').get('message-structured-image-brief-1');
    const ecommercePlanRouteCharge = db.prepare('SELECT * FROM chat_text_charges WHERE request_id=?').get('message-ecommerce-plan-route-1');
    const invalidPlanCharge = db.prepare('SELECT * FROM chat_text_charges WHERE request_id=?').get('message-invalid-ecommerce-plan');
    const otherAgentCharge = db.prepare('SELECT * FROM chat_text_charges WHERE request_id=?').get('message-other-agent-ecommerce-brief');
    const imageGuardCharge = db.prepare('SELECT * FROM chat_text_charges WHERE request_id=?').get('message-native-image-guard-1');
    const nativeBlockedCharge = db.prepare('SELECT * FROM chat_text_charges WHERE request_id=?').get('message-native-image-blocked-1');
    const providerFailureCharge = db.prepare('SELECT * FROM chat_text_charges WHERE request_id=?').get('message-provider-502-1');
    const confirmationCharge = db.prepare('SELECT * FROM chat_text_charges WHERE request_id=?').get('message-confirm-image-1');
    const productionNameConfirmationCharge = db.prepare('SELECT * FROM chat_text_charges WHERE request_id=?').get('message-confirm-image-production-name-1');
    const planContinuationCharge = db.prepare('SELECT * FROM chat_text_charges WHERE request_id=?').get('message-plan-tool-loop-1');
    const planConfirmationCharge = db.prepare('SELECT * FROM chat_text_charges WHERE request_id=?').get('message-confirm-plan-1');
    const planRevisionCharge = db.prepare('SELECT * FROM chat_text_charges WHERE request_id=?').get('message-revise-plan-1');
    const finalUser = db.prepare('SELECT balance FROM users WHERE id=?').get(user.id);
    assert.equal(charge.status, 'completed');
    assert.equal(charge.cost, 5);
    assert.equal(contentContinuationCharge.status, 'completed');
    assert.equal(contentContinuationCharge.cost, 5);
    assert.equal(structuredBriefCharge.status, 'reserved', 'Structured image brief must enter the quoted image workflow');
    assert.equal(ecommercePlanRouteCharge.status, 'reserved', 'Two-reference ecommerce main-image requests must enter the plan workflow');
    assert.equal(ecommercePlanRouteCharge.model_key, 'gpt-5.6-terra', 'The ecommerce main-image agent must be billed through the configured GPT-5.6 Terra route');
    assert.equal(invalidPlanCharge.status, 'refunded', 'Invalid GPT-5.6 plan output must not fall back to templates');
    assert.equal(otherAgentCharge.model_key, 'gpt-5.6-terra', 'Legacy GPT-5.5 agent settings must resolve to the configured GPT-5.6 Terra route');
    assert.equal(imageGuardCharge.status, 'reserved', 'Forced prepare tool call must keep the image workflow charge reserved');
    assert.equal(nativeBlockedCharge.status, 'refunded', 'Native image output from a text route must be refunded');
    assert.equal(providerFailureCharge.status, 'refunded', 'Provider HTTP 502 must remain fully refunded');
    assert.equal(confirmationCharge.status, 'completed', 'Confirmed image workflow must complete its single Chat charge');
    assert.equal(productionNameConfirmationCharge.status, 'reserved', 'Production MCP named confirmation must keep its Chat charge reserved until the execute tool result returns');
    assert.equal(productionNameConfirmationCharge.cost, 5, 'Production MCP named confirmation must use the configured text cost');
    assert.equal(planContinuationCharge.status, 'completed', 'Plan output continuation must complete locally');
    assert.equal(planConfirmationCharge.status, 'reserved', 'Plan confirmation must stay reserved until its tool result returns');
    assert.equal(planRevisionCharge.status, 'reserved', 'Plan revision must stay reserved until its tool result returns');
    assert.equal(finalUser.balance, user.balance - 55, 'Each distinct Chat message must charge text exactly once');
    console.log('LibreChat tool continuation regression passed: continuation is idempotent and image intents cannot leak native Base64.');
  } finally {
    if (db) db.close();
    if (child.exitCode === null) {
      child.kill();
      await new Promise(resolve => {
        child.once('exit', resolve);
        setTimeout(resolve, 3000);
      });
    }
    await new Promise(resolve => fakeProvider.close(resolve));
    fs.rmSync(tempRoot, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
}

main().catch((error) => {
  console.error(error.stack || error.message || error);
  process.exitCode = 1;
});
